"""Тести: створення вручну й із відповіді зовнішнього ШІ, картинки, відкриття учневі з темами, проходження, сповіщення."""
import base64, os, pathlib, sys
from playwright.sync_api import sync_playwright, expect

BASE = "http://127.0.0.1:3101"
OUT = pathlib.Path(os.environ["SHOTS"]); OUT.mkdir(parents=True, exist_ok=True)
results, console = [], []
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")

def check(name, cond, extra=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra else ""), flush=True)

def new(b, w=1360, h=860, theme="light", touch=False):
    ctx = b.new_context(viewport={"width": w, "height": h}, locale="uk-UA", color_scheme=theme, has_touch=touch, is_mobile=touch,
                        permissions=["clipboard-read", "clipboard-write"])
    p = ctx.new_page()
    p.on("console", lambda m: console.append(f"{m.type}: {m.text}") if m.type == "error" and "status of 4" not in m.text else None)
    p.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
    return ctx, p

def login(p, u, pw):
    p.goto(BASE); p.wait_for_load_state("networkidle")
    p.get_by_label("Логін").fill(u); p.locator("input[type=password]").fill(pw)
    p.get_by_role("button", name="Увійти").click(); p.wait_for_selector(".rail"); p.wait_for_load_state("networkidle")

def shot(p, n, full=False):
    p.wait_for_timeout(400); p.screenshot(path=str(OUT / f"{n}.png"), full_page=full)

def api(ctx, m, path, **kw): return ctx.request.fetch(f"{BASE}/api{path}", method=m, **kw)
def toast(p, text): expect(p.locator(".toast", has_text=text).first).to_be_visible(timeout=8000)
def overflow(p): return p.evaluate("document.documentElement.scrollWidth - window.innerWidth")
def opts(*pairs): return [{"text": t, "correct": c} for t, c in pairs]

with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True)
    mc, m = new(b); login(m, "manager", "manager123")
    users = {u["login"]: u["id"] for u in api(mc, "GET", "/users").json()}
    web = next(c for c in api(mc, "GET", "/courses").json() if c["title"] == "Веброзробка")

    # 1. Сторінка «Завдання» і вкладка тестів
    check("у навігації «Завдання»", m.locator(".rail-nav a", has_text="Завдання").count() == 1 and m.locator(".rail-nav a", has_text="Домашні").count() == 0)
    m.goto(f"{BASE}/homework"); m.wait_for_load_state("networkidle")
    expect(m.locator("h1")).to_have_text("Завдання"); check("сторінка називається «Завдання»", True)
    m.get_by_role("radio", name="Тести").click(); m.wait_for_load_state("networkidle")
    expect(m.locator(".quiz-row", has_text="React: основи")).to_be_visible(); check("вкладка «Тести» показує тести", "tab=quizzes" in m.url)

    # 2. Новий тест вручну: картинка, одна й кілька правильних
    m.get_by_role("button", name="Тест із ШІ").click(); m.wait_for_url("**/quizzes/new?import=1")
    ai = m.locator(".modal"); expect(ai).to_contain_text("Скопіюйте промпт"); check("«Тест із ШІ» одразу відкриває вставку", True)
    ai.get_by_label("Відповідь ШІ").fill("Назва: Швидкий\n\n? Два плюс два?\n+ 4\n- 3\n- 5")
    ai.get_by_role("button", name="Розставити питання").click()
    check("назва з відповіді ШІ підставилась", m.get_by_label("Назва тесту").input_value() == "Швидкий" and m.locator(".q-card").count() == 1)
    m.goto(f"{BASE}/homework?tab=quizzes"); m.wait_for_load_state("networkidle")
    m.get_by_role("button", name="Новий тест").click(); m.wait_for_url("**/quizzes/new")
    m.get_by_label("Назва тесту").fill("JS: типи даних")
    c1 = m.locator(".q-card").nth(0)
    c1.get_by_label("Питання", exact=True).fill("Який тип у числа 5?")
    for i, t in enumerate(["number", "string", "boolean", "bigint"]): c1.get_by_label(f"Питання 1, варіант {i + 1}").fill(t)
    expect(c1.locator(".text-red", has_text="Позначте правильну")).to_be_visible(); check("редактор нагадує позначити правильну", True)
    c1.locator(".q-option").nth(0).locator(".check").click()
    c1.locator("input[type=file]").set_input_files(files=[{"name": "five.png", "mimeType": "image/png", "buffer": PNG}])
    expect(c1.locator(".q-image img")).to_be_visible(); check("картинка до питання завантажилась", True)
    c1.get_by_role("button", name="Варіант", exact=True).click(); c1.get_by_role("button", name="Варіант", exact=True).click()
    check("не більше 6 варіантів", c1.locator(".q-option").count() == 6 and c1.get_by_role("button", name="Варіант", exact=True).is_disabled())
    for _ in range(3): c1.locator(".q-option").last.get_by_role("button", name="Прибрати варіант").click()
    check("не менше 3 варіантів", c1.locator(".q-option").count() == 3 and c1.locator(".q-option").last.get_by_role("button").is_disabled())
    m.get_by_role("button", name="Додати питання").click()
    c2 = m.locator(".q-card").nth(1)
    c2.get_by_label("Питання", exact=True).fill("Які типи примітивні?")
    for i, t in enumerate(["string", "number", "object", "array"]): c2.get_by_label(f"Питання 2, варіант {i + 1}").fill(t)
    c2.locator(".q-option").nth(0).locator(".check").click(); c2.locator(".q-option").nth(1).locator(".check").click()

    # Відповідь зовнішнього ШІ: копіюємо промпт, вставляємо відповідь, негодяще пропущено з причиною
    m.get_by_role("button", name="Вставити з ШІ").click(); ai = m.locator(".modal")
    ai.get_by_role("button", name="Скопіювати промпт").click(); toast(m, "Промпт скопійовано")
    copied = m.evaluate("navigator.clipboard.readText()").replace("\r\n", "\n")
    check("промпт скопійовано з форматом", "? Текст першого питання" in copied and "«+ » для правильного" in copied)
    ai.get_by_role("button", name="Показати").click()
    check("промпт можна переглянути", ai.get_by_label("Текст промпту").input_value() == copied)
    expect(ai.get_by_role("button", name="Розставити питання")).to_be_disabled()
    ai.get_by_label("Відповідь ШІ").fill("Я не зрозумів завдання")
    expect(ai.locator(".qi-result.is-empty")).to_be_visible(); check("без питань показує підказку", True)
    ai.get_by_label("Відповідь ШІ").fill("""Ось тест:

Назва: Інша назва

**? Що повертає typeof null?**
+ object
- null
- undefined

? Зайве питання
+ так
- ні

? Які значення хибні?
+ 0
+ порожній рядок
- "0"
- []""")
    expect(ai.locator(".qi-result")).to_contain_text("Знайдено 2 питання")
    expect(ai.locator(".qi-skipped")).to_contain_text("Питання 2"); check("пропущене питання з причиною", "щонайменше 3" in ai.locator(".qi-skipped").inner_text())
    shot(m, "q0-import")
    ai.get_by_role("button", name="Розставити питання").click(); m.wait_for_selector(".modal", state="detached")
    expect(m.locator(".q-card")).to_have_count(4); check("з відповіді додано 2 придатні питання з 3", True)
    expect(m.locator(".q-card").nth(3).locator(".q-option.is-correct")).to_have_count(2); check("кілька правильних розставлено", True)
    check("назву, задану вручну, не перезаписано", m.get_by_label("Назва тесту").input_value() == "JS: типи даних")
    shot(m, "q1-editor", full=True)
    m.get_by_role("button", name="Створити тест").click(); toast(m, "Тест створено")
    m.wait_for_url("**/quizzes/*"); m.wait_for_load_state("networkidle")
    quiz_id = int(m.url.rsplit("/", 1)[1])
    quiz = api(mc, "GET", f"/quizzes/{quiz_id}").json()
    check("тест збережено з 4 питаннями", len(quiz["questions"]) == 4, str(len(quiz["questions"])))
    check("картинка в першому питанні", bool(quiz["questions"][0]["image"]))
    check("друге питання з двома правильними", quiz["questions"][1]["multiple"] and sum(o["correct"] for o in quiz["questions"][1]["options"]) == 2)

    # 3. Сервер перевіряє тест і картинки
    base_q = {"text": "x", "options": opts(("a", True), ("b", False), ("c", False))}
    bad = {
        "2 варіанти": {"title": "t", "questions": [{"text": "x", "options": opts(("a", True), ("b", False))}]},
        "7 варіантів": {"title": "t", "questions": [{"text": "x", "options": opts(*[(f"o{i}", i == 0) for i in range(7)])}]},
        "без правильної": {"title": "t", "questions": [{"text": "x", "options": opts(("a", False), ("b", False), ("c", False))}]},
        "повтор варіанта": {"title": "t", "questions": [{"text": "x", "options": opts(("a", True), ("A", False), ("c", False))}]},
        "чужа картинка": {"title": "t", "questions": [{**base_q, "image": "00000000-0000-0000-0000-000000000000.bin"}]},
        "без питань": {"title": "t", "questions": []},
    }
    codes = {k: api(mc, "POST", "/quizzes", data=v).status for k, v in bad.items()}
    check("сервер відхиляє неправильні тести", all(c == 400 for c in codes.values()), str(codes))
    img = quiz["questions"][0]["image"]
    r = api(mc, "GET", f"/quizzes/images/{img}")
    check("менеджер бачить картинку", r.ok and r.headers["content-type"] == "image/png")
    up = api(mc, "POST", "/quizzes/images", multipart={"image": {"name": "x.png", "mimeType": "image/png", "buffer": b"not an image"}})
    check("не картинку не приймає", up.status == 400)
    tk, tkp = new(b); login(tkp, "teacher", "teacher123")
    check("вчитель бачить лише власні тести, не чужі картинки", api(tk, "GET", "/quizzes").json() == [] and api(tk, "GET", f"/quizzes/images/{img}").status == 404)

    # 4. Відкриття учневі з курсом і темою
    bc, bp = new(b); login(bp, "boiko", "student123")
    check("до відкриття учень не бачить картинку", api(bc, "GET", f"/quizzes/images/{img}").status == 404)
    m.get_by_role("button", name="Відкрити учневі").click(); sheet = m.locator(".modal")
    sheet.get_by_label("Учень").click(); m.get_by_role("option", name="Дарина Бойко").click()
    sheet.get_by_label("Курс").click(); m.get_by_role("option", name="Веброзробка").click()
    expect(sheet.locator(".topics")).to_be_visible()
    sheet.locator(".topic", has_text="JavaScript").locator(".topic-head .check").click()
    shot(m, "q2-assign")
    sheet.get_by_role("button", name="Відкрити тест").click(); toast(m, "Тест відкрито учневі")
    row = m.locator(".quiz-assign", has_text="Дарина Бойко")
    expect(row).to_contain_text("Треба пройти"); expect(row.locator(".topic-chips")).to_contain_text("JavaScript")
    check("учень у списку тесту з темою", True)
    check("двічі тому самому учневі не відкрити", api(mc, "POST", f"/quizzes/{quiz_id}/assignments", data={"student_id": users["boiko"]}).status == 409)
    aid = next(a["id"] for a in api(mc, "GET", f"/quizzes/{quiz_id}").json()["assignments"] if a["student_id"] == users["boiko"])

    # 5. Учень: сповіщення, роадмап, проходження
    bp.reload(); bp.wait_for_load_state("networkidle")
    expect(bp.locator(".rail-nav a", has_text="Завдання").locator(".nav-badge")).to_have_text("1"); check("кружечок сповіщення на «Завдання»", True)
    shot(bp, "q3-badge")
    before = api(bc, "GET", f"/quizzes/assignments/{aid}").json()
    check("до здачі учень не бачить правильних відповідей", all("correct" not in o for x in before["questions"] for o in x["options"]))
    other, otherp = new(b); login(otherp, "tkachenko", "student123")
    check("чужий учень не відкриє тест", api(other, "GET", f"/quizzes/assignments/{aid}").status == 403)
    bp.goto(f"{BASE}/courses/{web['id']}"); bp.wait_for_selector(".road-row")
    go = bp.locator(".road-row").nth(2).locator(".road-hw-item.is-quiz", has_text="JS: типи даних")
    expect(go).to_contain_text("Пройти тест"); check("на роадмапі в темі світиться «Пройти тест»", True)
    shot(bp, "q4-road-quiz")
    go.click(); bp.wait_for_url(f"**/tests/{aid}"); bp.wait_for_selector(".q-img"); bp.wait_for_function("document.querySelector('.q-img').complete")
    check("картинка показується учневі", bp.evaluate("document.querySelector('.q-img').naturalWidth") > 0)
    cards = bp.locator(".q-take > li")
    expect(cards.nth(1)).to_contain_text("Кілька правильних відповідей"); check("питання з кількома відповідями підписане", True)
    cards.nth(0).get_by_role("radio", name="string", exact=True).click(); cards.nth(0).get_by_role("radio", name="number", exact=True).click()
    check("в одиночному питанні вибір замінюється", cards.nth(0).locator(".q-opt.is-on").count() == 1)
    cards.nth(1).get_by_role("checkbox", name="string").click()
    cards.nth(2).get_by_role("radio", name="object").click()
    expect(bp.locator(".quiz-submit")).to_contain_text("Відповіли на 3 з 4")
    bp.get_by_role("button", name="Здати тест").click()
    bp.locator(".modal").get_by_role("button", name="Здати").click(); toast(bp, "Тест здано")
    expect(bp.locator(".quiz-score")).to_contain_text("2 з 4"); check("бал рахується правильно: 2 з 4", True)
    check("помилки й правильні відповіді позначено", bp.locator(".q-card.is-wrong").count() == 2 and bp.locator(".q-opt.is-correct").count() == 6)
    shot(bp, "q5-result", full=True)
    expect(bp.locator(".nav-badge")).to_have_count(0); check("після здачі кружечок зник", True)
    check("повторно здати не можна", api(bc, "POST", f"/quizzes/assignments/{aid}/submit", data={"answers": {}}).status == 409)

    # Сервер не приймає подвійну відповідь в одиночному питанні
    mk, mp = new(b); login(mp, "student", "student123")
    seed_a = api(mk, "GET", "/quizzes/my").json()[0]
    sq = api(mk, "GET", f"/quizzes/assignments/{seed_a['id']}").json()["questions"][0]
    r = api(mk, "POST", f"/quizzes/assignments/{seed_a['id']}/submit", data={"answers": {str(sq["id"]): [o["id"] for o in sq["options"][:2]]}})
    check("дві відповіді в одиночному питанні відхилено", r.status == 400)
    r = api(mk, "POST", f"/quizzes/assignments/{seed_a['id']}/submit", data={"answers": {str(sq["id"]): [quiz["questions"][0]["options"][0]["id"]]}})
    check("варіант з іншого тесту відхилено", r.status == 400)

    # 6. Менеджер бачить результат, дає ще спробу, редагує
    m.reload(); m.wait_for_load_state("networkidle")
    expect(m.locator(".quiz-assign", has_text="Дарина Бойко")).to_contain_text("2 з 4"); check("менеджер бачить бал учня", True)
    m.get_by_role("button", name="Ще спроба для Дарина Бойко").click(); m.locator(".modal").get_by_role("button", name="Дати спробу").click()
    toast(m, "Тест знову відкрито")
    check("ще спроба стирає результат", api(mc, "GET", f"/quizzes/assignments/{aid}").json()["submitted_at"] is None)
    check("сповіщення повернулось", api(bc, "GET", "/notifications").json()["quizzes"] == 1)
    m.get_by_role("button", name="Редагувати тест").click(); m.wait_for_url("**/edit")
    m.locator(".q-card").nth(0).get_by_label("Питання", exact=True).fill("Який тип має 5?")
    m.locator(".q-card").nth(3).get_by_role("button", name="Видалити питання 4").click()
    m.get_by_role("button", name="Зберегти тест").click(); toast(m, "Тест збережено")
    q2 = api(mc, "GET", f"/quizzes/{quiz_id}").json()
    check("редагування: 3 питання, той самий id першого", len(q2["questions"]) == 3 and q2["questions"][0]["id"] == quiz["questions"][0]["id"] and q2["questions"][0]["text"] == "Який тип має 5?")
    check("редагування зберегло учня", len(q2["assignments"]) == 1)

    # 7. Сповіщення про оцінку домашнього
    hw = next(h for h in api(mk, "GET", "/homework").json() if h["title"] == "Адаптивна картка профілю")
    api(mk, "POST", f"/homework/{hw['id']}/submission", multipart={"files": {"name": "card.txt", "mimeType": "text/plain", "buffer": b"done"}})
    sub = next(s for s in api(tk, "GET", f"/homework/{hw['id']}").json()["students"] if s["student_id"] == users["student"])["submission"]
    n0 = api(mk, "GET", "/notifications").json()
    api(tk, "POST", f"/homework/submissions/{sub['id']}/review", data={"status": "accepted", "grade": 11, "feedback": "Чудово"})
    n1 = api(mk, "GET", "/notifications").json()
    check("оцінка вчителя дає сповіщення", n1["reviews"] == n0["reviews"] + 1 and n1["count"] == n0["count"] + 1, f"{n0} → {n1}")
    mp.goto(f"{BASE}/homework"); mp.wait_for_load_state("networkidle")
    expect(mp.locator(".nav-badge")).to_have_text(str(n1["count"]))
    expect(mp.locator(".row-link", has_text="Адаптивна картка профілю").locator(".new-dot")).to_be_visible(); check("нова оцінка позначена в списку", True)
    expect(mp.locator(".hw-group", has_text="Тести").locator(".quiz-row", has_text="React: основи")).to_contain_text("Треба пройти"); check("учень бачить тести на сторінці завдань", True)
    shot(mp, "q6-student-tasks", full=True)
    mp.locator(".row-link", has_text="Адаптивна картка профілю").click(); mp.wait_for_load_state("networkidle")
    expect(mp.locator(".nav-badge")).to_have_text(str(n1["count"] - 1)); check("перегляд роботи гасить сповіщення", True)
    api(tk, "POST", f"/homework/submissions/{sub['id']}/review", data={"status": "returned", "feedback": "Додай мобільну версію"})
    check("новий відгук знову сповіщає", api(mk, "GET", "/notifications").json()["reviews"] == 1)
    check("вчитель і менеджер без сповіщень", api(tk, "GET", "/notifications").json()["count"] == 0)
    # Учня прибрали з групи: роботу він уже не відкриє, тож і сповіщення про неї не висить
    roster = [s["id"] for s in api(mc, "GET", f"/schedules/{hw['schedule_id']}").json()["students"]]
    api(mc, "PATCH", f"/schedules/{hw['schedule_id']}", data={"student_ids": [x for x in roster if x != users["student"]]})
    check("після виходу з групи сповіщення про оцінку зникає", api(mk, "GET", "/notifications").json()["reviews"] == 0)
    api(mc, "PATCH", f"/schedules/{hw['schedule_id']}", data={"student_ids": roster})
    check("повернення в групу повертає сповіщення", api(mk, "GET", "/notifications").json()["reviews"] == 1)

    # 8. Телефон
    for w in [320, 390]:
        c, p = new(b, w, 760, touch=True); login(p, "student", "student123")
        expect(p.locator(".rail-nav .nav-badge")).to_be_visible()
        p.goto(f"{BASE}/tests/{seed_a['id']}"); p.wait_for_selector(".q-take")
        check(f"{w}px: проходження тесту без прокрутки вбік", overflow(p) <= 0, str(overflow(p)))
        sub_box = p.locator(".quiz-submit").bounding_box(); nav_box = p.locator(".rail-nav").bounding_box()
        check(f"{w}px: кнопка здачі над нижньою панеллю", sub_box["y"] + sub_box["height"] <= nav_box["y"] + 1, f"{sub_box} {nav_box}")
        if w == 320: shot(p, "q7-mobile-take")
        c.close()
        c, p = new(b, w, 760, touch=True); login(p, "manager", "manager123")
        p.goto(f"{BASE}/quizzes/{quiz_id}/edit"); p.wait_for_selector(".q-card")
        check(f"{w}px: редактор тесту без прокрутки вбік", overflow(p) <= 0, str(overflow(p)))
        if w == 320: shot(p, "q8-mobile-editor", full=True)
        p.goto(f"{BASE}/quizzes/{quiz_id}"); p.wait_for_load_state("networkidle")
        check(f"{w}px: сторінка тесту без прокрутки вбік", overflow(p) <= 0, str(overflow(p)))
        c.close()

    c, p = new(b, 1360, 860, theme="dark"); login(p, "boiko", "student123")
    p.goto(f"{BASE}/tests/{aid}"); p.wait_for_selector(".q-take"); shot(p, "q9-dark")
    c.close()

    # 9. Видалення тесту
    m.goto(f"{BASE}/quizzes/{quiz_id}"); m.wait_for_load_state("networkidle")
    m.get_by_role("button", name="Видалити тест").click(); m.locator(".modal").get_by_role("button", name="Видалити").click()
    toast(m, "Тест видалено")
    check("видалення тесту закриває його в учня", api(bc, "GET", f"/quizzes/assignments/{aid}").status == 404 and api(bc, "GET", "/notifications").json()["quizzes"] == 0)
    b.close()

fails = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(fails)}/{len(results)} пройшло")
if fails: print("Провалені:", fails)
print("Console errors:", console[:15])
sys.exit(1 if fails or console else 0)
