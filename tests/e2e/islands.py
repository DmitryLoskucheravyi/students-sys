"""Острівці тестування на роадмапі, модерація тестів вчителя, колір абонемента й аватарки учнів."""
import os, pathlib
from playwright.sync_api import sync_playwright, expect

BASE = "http://127.0.0.1:3101"
OUT = pathlib.Path(os.environ["SHOTS"]); OUT.mkdir(parents=True, exist_ok=True)
results, console = [], []

def check(name, cond, extra=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra else ""), flush=True)

def new(b, w=1440, h=900, theme="light", motion="no-preference"):
    ctx = b.new_context(viewport={"width": w, "height": h}, locale="uk-UA", color_scheme=theme, reduced_motion=motion)
    ctx.grant_permissions(["clipboard-read", "clipboard-write"], origin=BASE)
    p = ctx.new_page()
    p.on("console", lambda m: console.append(f"{m.type}: {m.text}") if m.type == "error" and "status of 4" not in m.text else None)
    p.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
    return ctx, p

def login(p, u, pw):
    p.goto(BASE); p.wait_for_load_state("networkidle")
    p.get_by_label("Логін").fill(u); p.locator("input[type=password]").fill(pw)
    p.get_by_role("button", name="Увійти").click(); p.wait_for_selector(".rail"); p.wait_for_load_state("networkidle")

def shot(p, n, full=False):
    p.wait_for_timeout(500); p.screenshot(path=str(OUT / f"{n}.png"), full_page=full)

def api(ctx, m, path, **kw): return ctx.request.fetch(f"{BASE}/api{path}", method=m, **kw)

ANSWER = """```text
Назва: HTML і структура: перевірка

? Який тег задає найважливіший заголовок?
+ h1
- h6
- head

? Що робить тег form?
+ Збирає поля, які надсилаються разом
- Малює рамку
- Додає таблицю
```"""

def painted(p, sel):
    """Чи намальовано щось на полотні острівця (не порожні пікселі)."""
    return p.evaluate(f"""(() => {{ const c = document.querySelector('{sel} canvas'); if (!c || !c.width) return 0;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0;
      for (let i = 3; i < d.length; i += 16) if (d[i] > 10) n++; return n; }})()""")

with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True)
    mc, m = new(b); login(m, "manager", "manager123")
    web = next(c for c in api(mc, "GET", "/courses").json() if c["title"] == "Веброзробка")
    course = api(mc, "GET", f"/courses/{web['id']}").json()
    steps = course["steps"]
    check("острівців спочатку немає", course["islands"] == [])

    # 1. Інструменти острівця в картці етапу: копіювання теми попереднього етапу й промпту
    m.goto(f"{BASE}/courses/{web['id']}"); m.wait_for_selector(".road-row"); m.wait_for_timeout(400)
    row2 = m.locator(".road-row").nth(1)
    check("кнопка «Додати тестування на острівець»", row2.get_by_role("button", name="Додати тестування на острівець").is_visible())
    check("без острівця на місці номер", row2.locator(".road-num").count() == 1 and row2.locator(".road-island").count() == 0)
    row2.get_by_role("button", name="Скопіювати тему").click(); m.wait_for_timeout(200)
    clip = m.evaluate("navigator.clipboard.readText()")
    check("тема копіюється з попереднього етапу", clip.startswith("Етап 1. HTML і структура") and "Семантика" in clip, clip[:60])
    row2.get_by_role("button", name="Скопіювати промпт").click(); m.wait_for_timeout(200)
    clip = m.evaluate("navigator.clipboard.readText()")
    check("промпт містить формат і тему", "Склади тест" in clip and clip.index("Матеріал:") < clip.index("Етап 1. HTML і структура"), clip[-60:])

    # 2. Менеджер ставить острівець із новим тестом із відповіді ШІ
    row2.get_by_role("button", name="Додати тестування на острівець").click()
    md = m.locator(".modal"); expect(md).to_be_visible()
    check("п'ять дизайнів на вибір", md.locator(".isle-design").count() == 5)
    md.get_by_label("Відповідь ШІ").fill(ANSWER)
    expect(md.get_by_role("status")).to_contain_text("Знайдено 2")
    md.get_by_role("radio", name="Деплой").click()
    m.wait_for_timeout(1500)
    check("прев'ю дизайнів намальовані в 3D", painted(m, ".isle-design.is-on .island3d") > 50)
    shot(m, "is1-form")
    md.get_by_role("button", name="Поставити острівець").click(); m.wait_for_load_state("networkidle")
    expect(md).to_have_count(0)
    course = api(mc, "GET", f"/courses/{web['id']}").json()
    isl = course["islands"]
    check("острівець збережено з дизайном", len(isl) == 1 and isl[0]["step_id"] == steps[1]["id"] and isl[0]["design"] == "rocket" and isl[0]["quiz_status"] == "approved", str(isl))
    quizzes = api(mc, "GET", "/quizzes").json()
    check("тест менеджера одразу в загальному списку", any(z["title"] == "HTML і структура: перевірка" and z["status"] == "approved" for z in quizzes))
    m.wait_for_selector(".road-island"); m.wait_for_timeout(1800)
    check("острівець замість номера", row2.locator(".road-island").count() == 1 and row2.locator(".road-num").count() == 0)
    check("острівець намальовано", painted(m, ".road-island") > 200)
    # Анімація: два кадри відрізняються
    a1 = m.evaluate("document.querySelector('.road-island canvas').toDataURL()"); m.wait_for_timeout(400)
    a2 = m.evaluate("document.querySelector('.road-island canvas').toDataURL()")
    check("острівець живий: кадри змінюються", a1 != a2)
    box = row2.locator(".road-island").bounding_box(); card = row2.locator(".road-text").bounding_box()
    check("острівець не налазить на картку", box["x"] + box["width"] <= card["x"] + 2 or box["x"] >= card["x"] + card["width"] - 2, f"{box} {card}")
    m.evaluate("window.scrollTo(0, 0)"); row2.scroll_into_view_if_needed(); shot(m, "is2-road")

    # 3. Учень натискає острівець: тест відкривається йому, проходить, бал на острівці
    sc, s = new(b); login(s, "student", "student123")
    s.goto(f"{BASE}/courses/{web['id']}"); s.wait_for_selector(".road-island")
    check("учень бачить «Пройти тест»", "Пройти тест" in s.locator(".road-island").inner_text())
    s.locator(".island-hit").click(); s.wait_for_url("**/tests/*"); s.wait_for_load_state("networkidle")
    check("відкрився тест острівця", "HTML і структура: перевірка" in s.locator("h1").inner_text())
    s.locator(".q-card").nth(0).get_by_role("radio", name="h1", exact=True).click()
    s.locator(".q-card").nth(1).get_by_role("radio", name="Збирає поля, які надсилаються разом").click()
    s.get_by_role("button", name="Здати тест").click(); s.wait_for_load_state("networkidle")
    expect(s.locator(".quiz-score")).to_contain_text("2")
    s.goto(f"{BASE}/courses/{web['id']}"); s.wait_for_selector(".road-island")
    check("на острівці бал учня", "2 з 2" in s.locator(".road-island").inner_text())
    my = api(sc, "GET", "/quizzes/my").json()
    check("тест прив'язано до попереднього етапу", any(a["quiz_title"].startswith("HTML") for a in my))
    again = api(sc, "POST", f"/courses/{web['id']}/islands/{steps[1]['id']}/start").json()
    check("повторне натискання не створює нову спробу", again["id"] == next(a["id"] for a in my if a["quiz_title"].startswith("HTML")))

    # 4. Вчитель: тест іде на модерацію, учні острівець не бачать до схвалення
    tc, t = new(b); login(t, "teacher", "teacher123")
    t.goto(f"{BASE}/courses/{web['id']}"); t.wait_for_selector(".road-row")
    row4 = t.locator(".road-row").nth(3)
    row4.get_by_role("button", name="Додати тестування на острівець").click()
    td = t.locator(".modal"); expect(td).to_be_visible()
    check("вчителя попереджено про модерацію", "перевіряє менеджер" in td.inner_text())
    td.get_by_label("Відповідь ШІ").fill(ANSWER.replace("HTML і структура: перевірка", "JS від вчителя"))
    td.get_by_role("radio", name="Git-дерево").click()
    td.get_by_role("button", name="Поставити острівець").click(); t.wait_for_load_state("networkidle")
    expect(td).to_have_count(0)
    t.wait_for_selector(".road-row:nth-child(4) .road-island")
    check("вчитель бачить острівець «На модерації»", "На модерації" in row4.locator(".road-island").inner_text())
    st = api(sc, "GET", f"/courses/{web['id']}").json()["islands"]
    check("учень не бачить неперевірений острівець", len(st) == 1)
    tq = api(tc, "GET", "/quizzes").json()
    check("вчитель бачить лише свої тести", [z["title"] for z in tq] == ["JS від вчителя"] and tq[0]["status"] == "pending", str([z['title'] for z in tq]))
    jsq = tq[0]["id"]
    check("вчитель не схвалює сам", api(tc, "POST", f"/quizzes/{jsq}/approve").status == 403)
    check("вчитель не бачить чужий тест", api(tc, "GET", f"/quizzes/{quizzes[0]['id']}").status == 404)
    check("неперевірений тест не відкрити учневі", api(mc, "POST", f"/quizzes/{jsq}/assignments", data={"student_id": my[0]["student_id"]}).status == 400)
    t.goto(f"{BASE}/homework?tab=quizzes"); t.wait_for_load_state("networkidle")
    check("вкладка тестів у вчителя зі статусом", "На модерації" in t.locator("main").inner_text())
    shot(t, "is3-teacher-tests")

    # 5. Менеджер: розділ модерації, бейдж, відхилення з причиною, повторне надсилання, схвалення
    m.goto(f"{BASE}/homework?tab=quizzes"); m.wait_for_load_state("networkidle"); m.wait_for_timeout(300)
    check("розділ «На модерації»", m.locator(".moderation").count() == 1 and "JS від вчителя" in m.locator(".moderation").inner_text())
    check("бейдж модерації в навігації", m.locator(".rail .nav-badge").first.inner_text() == "1")
    gen = m.locator("section[aria-label='Усі тести']").inner_text()
    check("неперевірений тест не в загальному списку", "JS від вчителя" not in gen and "HTML і структура: перевірка" in gen)
    shot(m, "is4-moderation")
    m.locator(".moderation").get_by_role("button", name="Переглянути").click(); m.wait_for_url(f"**/quizzes/{jsq}")
    m.get_by_role("button", name="Відхилити").click()
    m.locator(".modal").get_by_label("Що виправити").fill("Додайте питання про DOM")
    m.locator(".modal").get_by_role("button", name="Відхилити").click(); expect(m.locator(".modal")).to_have_count(0)
    tq = api(tc, "GET", "/quizzes").json()[0]
    check("вчитель бачить причину відхилення", tq["status"] == "rejected" and tq["review_note"] == "Додайте питання про DOM")
    full = api(tc, "GET", f"/quizzes/{jsq}").json()
    body = {"title": full["title"], "description": "", "questions": [{"id": x["id"], "text": x["text"], "image": None, "options": x["options"]} for x in full["questions"]]}
    check("виправлений тест знову на модерації", api(tc, "PUT", f"/quizzes/{jsq}", data=body).ok and api(tc, "GET", "/quizzes").json()[0]["status"] == "pending")
    check("менеджер схвалює", api(mc, "POST", f"/quizzes/{jsq}/approve").ok)
    check("після схвалення вчитель не змінює тест", api(tc, "PUT", f"/quizzes/{jsq}", data=body).status == 403)
    st = api(sc, "GET", f"/courses/{web['id']}").json()["islands"]
    check("після схвалення учень бачить острівець", len(st) == 2)
    check("вчитель бачить схвалені тести в бібліотеці", any(z["id"] == quizzes[0]["id"] for z in api(tc, "GET", "/quizzes/library").json()))

    # 6. Острівець: зміна дизайну, прибирання, чужий курс і невідомий дизайн
    check("невідомий дизайн відхилено", api(mc, "PUT", f"/courses/{web['id']}/islands/{steps[1]['id']}", data={"quiz_id": jsq, "design": "lava"}).status == 400)
    py = next(c for c in api(mc, "GET", "/courses").json() if c["title"] == "Python")
    py_step = api(mc, "GET", f"/courses/{py['id']}").json()["steps"][0]["id"]
    check("етап іншого курсу не підходить", api(mc, "PUT", f"/courses/{web['id']}/islands/{py_step}", data={"quiz_id": jsq, "design": "git"}).status == 404)
    check("учень не ставить острівець", api(sc, "PUT", f"/courses/{web['id']}/islands/{steps[0]['id']}", data={"quiz_id": jsq, "design": "git"}).status == 403)
    m.goto(f"{BASE}/courses/{web['id']}"); m.wait_for_selector(".road-island")
    m.locator(".road-row").nth(3).get_by_role("button", name="Змінити острівець").click()
    md = m.locator(".modal"); md.get_by_role("radio", name="Серверна").click()
    md.get_by_role("button", name="Зберегти").click(); m.wait_for_load_state("networkidle")
    isl = {i["step_id"]: i for i in api(mc, "GET", f"/courses/{web['id']}").json()["islands"]}
    check("дизайн змінено", isl[steps[3]["id"]]["design"] == "server")
    m.locator(".road-row").nth(3).get_by_role("button", name="Змінити острівець").click()
    m.locator(".modal").get_by_role("button", name="Прибрати").click()
    m.locator(".modal").last.get_by_role("button", name="Прибрати").click(); m.wait_for_load_state("networkidle")
    check("острівець прибрано, тест лишився", len(api(mc, "GET", f"/courses/{web['id']}").json()["islands"]) == 1 and api(mc, "GET", f"/quizzes/{jsq}").ok)

    # 7. Телефон і темна тема, зменшений рух
    pc, p = new(b, 390, 844, "dark", motion="reduce"); login(p, "student", "student123")
    p.goto(f"{BASE}/courses/{web['id']}"); p.wait_for_selector(".road-island"); p.wait_for_timeout(1500)
    check("телефон: острівець намальовано", painted(p, ".road-island") > 100)
    over = p.evaluate("document.documentElement.scrollWidth - window.innerWidth")
    check("телефон: без прокрутки вбік", over <= 0, str(over))
    p.locator(".road-island").scroll_into_view_if_needed(); shot(p, "is5-mobile-dark")
    pc.close()

    # 8. Колір абонемента
    plans = api(mc, "GET", "/plans").json()
    base = next(x for x in plans if x["name"] == "Базовий")
    check("колір за замовчуванням червоний", base["color"] == "red")
    check("невідомий колір відхилено", api(mc, "PATCH", f"/plans/{base['id']}", data={"color": "gold"}).status == 400)
    m.goto(f"{BASE}/subscriptions"); m.wait_for_load_state("networkidle")
    m.get_by_role("radio", name="Види").click()
    m.locator(".ticket").filter(has_text="Базовий").get_by_role("button", name="Змінити").click()
    m.locator(".modal").get_by_role("radio", name="Фіолетовий").click()
    stub = m.locator(".modal .tk-preview .ticket-stub").evaluate("e => getComputedStyle(e).backgroundColor")
    check("прев'ю квитка перефарбовано", stub == "rgb(116, 72, 208)", stub)
    m.locator(".modal").get_by_role("button", name="Зберегти").click(); expect(m.locator(".modal")).to_have_count(0)
    check("колір збережено", next(x for x in api(mc, "GET", "/plans").json() if x["id"] == base["id"])["color"] == "violet")
    s.goto(f"{BASE}/subscription"); s.wait_for_load_state("networkidle"); s.wait_for_selector(".ticket")
    stub = s.locator(".ticket-stub").first.evaluate("e => getComputedStyle(e).backgroundColor")
    check("квиток учня у кольорі виду", stub == "rgb(116, 72, 208)", stub)
    shot(s, "is6-ticket")

    # 9. Аватарки учнів: розклад, абонементи, домашні
    api(sc, "PATCH", "/auth/avatar", data={"avatar": "cool"})
    me = api(sc, "GET", "/auth/me").json()
    m.goto(f"{BASE}/subscriptions"); m.wait_for_load_state("networkidle")
    check("абонементи: аватарки поруч з іменами", m.locator(".sub-row .who .avatar").count() >= 3)
    m.goto(BASE); m.wait_for_load_state("networkidle")
    check("розклад: аватарки учнів у блоках", m.locator(".block .faces .avatar").count() >= 1)
    m.locator(".block-open").first.click(); m.wait_for_timeout(500)
    check("заняття: аватарки в списку учнів", m.locator(".roster .who .avatar").count() >= 1)
    shot(m, "is7-session")
    subs = api(mc, "GET", "/subscriptions").json()
    check("API віддає аватарку учня", any(x["student_name"] == "Марко Шевчук" and x["student_avatar"] == me["avatar"] for x in subs), me.get("avatar"))
    # 10. Нові теми й іконки курсів
    for theme, icon in (("git", "git"), ("php", "php"), ("sql", "sql"), ("next", "next")):
        r = api(mc, "PATCH", f"/courses/{web['id']}", data={"title": "Веброзробка", "theme": theme, "icon": icon})
        got = next(c for c in api(mc, "GET", "/courses").json() if c["id"] == web["id"])
        check(f"тема {theme} з іконкою приймається", r.ok and got["theme"] == theme and got["icon"] == icon, r.text()[:80])
    m.goto(f"{BASE}/courses/{web['id']}"); m.wait_for_selector(".road-row")
    check("сторінка курсу в монохромній темі", "ct-next" in m.locator(".course-page").get_attribute("class"))
    m.get_by_role("button", name="Редагувати курс").click()
    md = m.locator(".modal"); expect(md.locator(".look-themes")).to_be_visible()
    check("у виборі 9 тем і 28 іконок", md.locator(".look-theme").count() == 9 and md.locator(".look-icon").count() == 28,
          f"{md.locator('.look-theme').count()} {md.locator('.look-icon').count()}")
    md.locator(".look").scroll_into_view_if_needed(); shot(m, "is8-look")
    m.keyboard.press("Escape")
    api(mc, "PATCH", f"/courses/{web['id']}", data={"title": "Веброзробка", "theme": "web", "icon": "web"})
    b.close()

fails = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(fails)}/{len(results)} пройшло")
if fails: print("Провалені:", fails)
print("Console errors:", console)
raise SystemExit(1 if fails or console else 0)
