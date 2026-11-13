"""Тест за публічним посиланням: будь-хто проходить і бачить результат, записується лише учень, що увійшов."""
import os, pathlib
from playwright.sync_api import sync_playwright, expect

BASE = "http://127.0.0.1:3101"
APP = BASE + "/cabinet"  # кабінет; на / тепер сайт школи
OUT = pathlib.Path(os.environ["SHOTS"]); OUT.mkdir(parents=True, exist_ok=True)
results, console = [], []

def check(name, cond, extra=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra else ""), flush=True)

def new(b, w=1280, h=900, theme="light"):
    ctx = b.new_context(viewport={"width": w, "height": h}, locale="uk-UA", color_scheme=theme)
    ctx.grant_permissions(["clipboard-read", "clipboard-write"], origin=BASE)
    p = ctx.new_page()
    p.on("console", lambda m: console.append(f"{m.type}: {m.text}") if m.type == "error" and "status of 4" not in m.text else None)
    p.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
    return ctx, p

def login(p, u, pw):
    p.goto(APP); p.wait_for_load_state("networkidle")
    p.get_by_label("Логін").fill(u); p.locator("input[type=password]").fill(pw)
    p.get_by_role("button", name="Увійти").click(); p.wait_for_selector(".rail"); p.wait_for_load_state("networkidle")

def shot(p, n, full=False):
    p.wait_for_timeout(400); p.screenshot(path=str(OUT / f"{n}.png"), full_page=full)

def api(ctx, m, path, **kw): return ctx.request.fetch(f"{BASE}/api{path}", method=m, **kw)

QUIZ = {"title": "Публічний тест", "description": "Перевір себе", "questions": [
    {"text": "2 + 2 =", "options": [{"text": "4", "correct": True}, {"text": "5", "correct": False}, {"text": "22", "correct": False}]},
    {"text": "Що з цього мова програмування?", "options": [{"text": "Python", "correct": True}, {"text": "HTML", "correct": False}, {"text": "JSON", "correct": False}]},
]}

def answer(p, right=True):
    p.get_by_role("radio", name="4" if right else "5", exact=True).click()
    p.get_by_role("radio", name="Python" if right else "HTML", exact=True).click()

with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True)
    mc, m = new(b); login(m, "manager", "manager123")
    qid = api(mc, "POST", "/quizzes", data=QUIZ).json()["id"]

    # 1. Менеджер вмикає посилання на сторінці тесту
    m.goto(f"{APP}/quizzes/{qid}"); m.wait_for_load_state("networkidle")
    m.get_by_role("button", name="Поділитися посиланням").click()
    m.locator(".modal").get_by_role("button", name="Створити посилання").click()
    url_in = m.locator(".modal").get_by_label("Посилання на тест"); expect(url_in).to_be_visible()
    url = url_in.input_value()
    check("посилання виду /q/<токен>", url.startswith(f"{BASE}/q/") and len(url.split("/q/")[1]) >= 12, url)
    m.locator(".modal").get_by_role("button", name="Скопіювати").click(); m.wait_for_timeout(200)
    check("посилання копіюється", m.evaluate("navigator.clipboard.readText()") == url)
    shot(m, "sh1-share")
    token = url.split("/q/")[1]
    check("повторне ввімкнення дає те саме посилання", api(mc, "POST", f"/quizzes/{qid}/share").json()["share_token"] == token)

    # 2. Гість без входу: проходить, бачить результат, нічого не зберігається
    gc, g = new(b, 390, 844)
    g.goto(url); g.wait_for_load_state("networkidle")
    check("гість бачить тест без входу", "Публічний тест" in g.locator(".pq-title").inner_text() and g.locator(".rail").count() == 0)
    check("без плашки про запис, шапки й лічильника питань", g.locator(".pq-who, .pq-head").count() == 0 and "питання" not in g.locator(".pq-title").evaluate("e => e.nextElementSibling?.textContent ?? ''"))
    check("логотип той самий, що на сторінці входу", g.locator(".pq-logo .bs-logo .bs-be-in").count() == 1)
    check("без лінії над кнопками", g.locator(".quiz-submit").evaluate("e => getComputedStyle(e).borderTopWidth") == "0px")
    check("без смуги прогресу, кнопки звуку й лічильника", g.locator(".qr-bar, .qr-sound").count() == 0 and "Відповіли" not in g.locator(".quiz-submit").inner_text())
    pub = api(gc, "GET", f"/public/quizzes/{token}").json()
    check("правильні відповіді не видно до здачі", all("correct" not in o for x in pub["questions"] for o in x["options"]))
    answer(g, right=True)
    g.get_by_role("button", name="Завершити тест").click(); g.wait_for_load_state("networkidle")
    expect(g.locator(".quiz-score")).to_contain_text("2")
    check("гість бачить результат 2 / 2", g.locator(".qr-big").inner_text().replace("\n", " ").split() == ["2", "/", "2"], g.locator(".qr-big").inner_text())
    check("смужка: дві поділки, обидві заповнені", g.locator(".qr-meter i").count() == 2 and g.locator(".qr-meter i.is-on").count() == 2)
    check("під балом без пояснень і кнопки входу", g.locator(".quiz-score p:not(.qr-big)").count() == 0 and g.locator(".quiz-score").get_by_role("button", name="Увійти").count() == 0
          and "зберіг" not in g.locator(".quiz-score").inner_text())
    check("після здачі видно правильні відповіді", g.locator(".q-opt.is-correct").count() == 2)
    over = g.evaluate("document.documentElement.scrollWidth - window.innerWidth")
    check("телефон: без прокрутки вбік", over <= 0, str(over))
    shot(g, "sh2-guest-result", full=True)
    g.get_by_role("button", name="Пройти ще раз").click()
    check("гість може пройти ще раз", g.locator(".quiz-score").count() == 0 and g.locator(".q-opt.is-on").count() == 0)
    r = api(gc, "POST", f"/public/quizzes/{token}/check", data={"answers": {}}).json()
    check("порожні відповіді: 0 балів, без запису", r["score"] == 0 and r["recorded"] is False)
    check("API гостя без запису", api(mc, "GET", f"/quizzes/{qid}").json()["assignments"] == [])

    # 3. Співробітник: бачить результат, але не записується
    tc, t = new(b); login(t, "teacher", "teacher123")
    t.goto(url); t.wait_for_load_state("networkidle")
    rt = api(tc, "POST", f"/public/quizzes/{token}/check", data={"answers": {}}).json()
    check("вчитель: не записано", rt["recorded"] is False and api(mc, "GET", f"/quizzes/{qid}").json()["assignments"] == [])

    # 4. Учень, що увійшов: результат записується в його тести, друга спроба — ні
    sc, s = new(b); login(s, "student", "student123")
    s.goto(url); s.wait_for_load_state("networkidle")
    answer(s, right=False)
    s.get_by_role("button", name="Завершити тест").click(); s.wait_for_load_state("networkidle")
    expect(s.locator(".quiz-score")).to_be_visible()
    check("учню, чий результат записано, без «Пройти ще раз»", s.locator(".quiz-score").get_by_role("button", name="Пройти ще раз").count() == 0)
    a = api(mc, "GET", f"/quizzes/{qid}").json()["assignments"]
    check("результат учня записано", len(a) == 1 and a[0]["student_name"] == "Марко Шевчук" and a[0]["score"] == 0 and a[0]["max_score"] == 2, str(a))
    check("тест з’явився в тестах учня", any(x["quiz_id"] == qid and x["submitted_at"] for x in api(sc, "GET", "/quizzes/my").json()))
    shot(s, "sh3-student-result")
    s.goto(url); s.wait_for_load_state("networkidle")
    answer(s, right=True)
    s.get_by_role("button", name="Завершити тест").click(); s.wait_for_load_state("networkidle")
    expect(s.locator(".quiz-score")).to_be_visible()
    a = api(mc, "GET", f"/quizzes/{qid}").json()["assignments"]
    check("друга спроба не перезаписала першу", a[0]["score"] == 0, str(a[0]["score"]))

    # 6. Вимкнене посилання, несхвалений тест, сміття в токені
    check("відповідь без правильного варіанта відхилено", api(gc, "POST", f"/public/quizzes/{token}/check", data={"answers": {"999999": [1]}}).status in (200, 400))
    check("вимкнути посилання", api(mc, "DELETE", f"/quizzes/{qid}/share").ok)
    check("вимкнене посилання не працює", api(gc, "GET", f"/public/quizzes/{token}").status == 404)
    g.goto(url); g.wait_for_load_state("networkidle")
    check("гість бачить «Посилання недійсне»", "недійсне" in g.locator("main, .pq").first.inner_text())
    check("сміття в токені", api(gc, "GET", "/public/quizzes/..%2F..%2Fetc").status == 404)
    tq = api(tc, "POST", "/quizzes", data={**QUIZ, "title": "Вчительський"}).json()["id"]
    check("несхваленим тестом не поділитись", api(tc, "POST", f"/quizzes/{tq}/share").status == 400)
    check("гість не вмикає посилання", api(gc, "POST", f"/quizzes/{qid}/share").status == 401)
    # 7. Код у питанні: блок на темному тлі; у варіантах лише кольори
    code_q = {"title": "Код", "description": "", "questions": [{
        "text": "Що виведе цей код?\n^^\nconst items = [1, 2, 3];\nconsole.log(items.length);\n^^",
        "options": [{"text": "^^3^^", "correct": True}, {"text": "^^undefined^^", "correct": False}, {"text": "Помилка", "correct": False}]}]}
    cq = api(mc, "POST", "/quizzes", data=code_q).json()["id"]
    ctoken = api(mc, "POST", f"/quizzes/{cq}/share").json()["share_token"]
    kc, k = new(b)
    k.goto(f"{BASE}/q/{ctoken}"); k.wait_for_selector(".qr-card .code-block")
    blk = k.locator(".qr-card .code-block")
    check("код у питанні — блок на темному тлі", blk.evaluate("e => getComputedStyle(e).backgroundColor") == "rgb(30, 30, 30)")
    check("переноси коду збережено", blk.inner_text().split("\n") ==["const items = [1, 2, 3];", "console.log(items.length);"], blk.inner_text())
    check("ключове слово підсвічено як у VS Code", blk.locator(".hl-keyword", has_text="const").evaluate("e => getComputedStyle(e).color") == "rgb(86, 156, 214)")
    check("виклик функції підсвічено", blk.locator(".hl-function", has_text="log").count() == 1)
    opt = k.locator(".qr-opt .code-text").first
    check("у варіанті код без тла", opt.evaluate("e => getComputedStyle(e).backgroundColor") in ("rgba(0, 0, 0, 0)", "transparent"))
    check("у варіанті число підсвічено", opt.locator(".hl-number").count() == 1)
    shot(k, "sh4-code")
    dc, d = new(b, 1280, 860)
    d.goto(f"{BASE}/q/{ctoken}"); d.wait_for_selector(".qr-card"); d.wait_for_timeout(2800)
    lb = d.locator(".pq-logo").bounding_box()
    check("логотип у нижньому лівому куті", lb["x"] < 40 and lb["y"] + lb["height"] > 860 - 40, str(lb))
    check("логотип збирається й далі живе", "pq-be" in d.locator(".pq-logo .bs-be").evaluate("e => getComputedStyle(e).animationName"))
    check("логотип великий", lb["height"] >= 60, str(lb))
    shot(d, "sh5-public-desktop")
    b.close()

fails = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(fails)}/{len(results)} пройшло")
if fails: print("Провалені:", fails)
print("Console errors:", console)
raise SystemExit(1 if fails or console else 0)
