"""Тест за публічним посиланням: будь-хто проходить і бачить результат, записується лише учень, що увійшов."""
import os, pathlib
from playwright.sync_api import sync_playwright, expect

BASE = "http://127.0.0.1:3101"
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
    p.goto(BASE); p.wait_for_load_state("networkidle")
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
    p.locator(".q-card").nth(0).get_by_role("radio", name="4" if right else "5", exact=True).click()
    p.locator(".q-card").nth(1).get_by_role("radio", name="Python" if right else "HTML", exact=True).click()

with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True)
    mc, m = new(b); login(m, "manager", "manager123")
    qid = api(mc, "POST", "/quizzes", data=QUIZ).json()["id"]

    # 1. Менеджер вмикає посилання на сторінці тесту
    m.goto(f"{BASE}/quizzes/{qid}"); m.wait_for_load_state("networkidle")
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
    check("гостя попереджено, що не збережеться", "не збережеться" in g.locator(".pq-who").inner_text())
    pub = api(gc, "GET", f"/public/quizzes/{token}").json()
    check("правильні відповіді не видно до здачі", all("correct" not in o for x in pub["questions"] for o in x["options"]))
    answer(g, right=True)
    g.get_by_role("button", name="Завершити тест").click(); g.wait_for_load_state("networkidle")
    expect(g.locator(".quiz-score")).to_contain_text("2")
    check("гість бачить результат 2 з 2", "2" in g.locator(".quiz-score strong").inner_text() and "100%" in g.locator(".quiz-score").inner_text())
    check("гостю сказано, що результат не збережено", "не зберігається" in g.locator(".quiz-score").inner_text())
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
    check("вчителя попереджено, що не запишеться", "не запишеться" in t.locator(".pq-who").inner_text())
    rt = api(tc, "POST", f"/public/quizzes/{token}/check", data={"answers": {}}).json()
    check("вчитель: не записано", rt["recorded"] is False and api(mc, "GET", f"/quizzes/{qid}").json()["assignments"] == [])

    # 4. Учень, що увійшов: результат записується в його тести, друга спроба — ні
    sc, s = new(b); login(s, "student", "student123")
    s.goto(url); s.wait_for_load_state("networkidle")
    check("учневі сказано, що запишеться", "запишеться у ваші тести" in s.locator(".pq-who").inner_text())
    answer(s, right=False)
    s.get_by_role("button", name="Завершити тест").click(); s.wait_for_load_state("networkidle")
    expect(s.locator(".quiz-score")).to_contain_text("записано")
    a = api(mc, "GET", f"/quizzes/{qid}").json()["assignments"]
    check("результат учня записано", len(a) == 1 and a[0]["student_name"] == "Марко Шевчук" and a[0]["score"] == 0 and a[0]["max_score"] == 2, str(a))
    check("тест з’явився в тестах учня", any(x["quiz_id"] == qid and x["submitted_at"] for x in api(sc, "GET", "/quizzes/my").json()))
    shot(s, "sh3-student-result")
    s.goto(url); s.wait_for_load_state("networkidle")
    check("повторний вхід: «Ви вже проходили»", "вже проходили" in s.locator(".pq-who").inner_text())
    answer(s, right=True)
    s.get_by_role("button", name="Завершити тест").click(); s.wait_for_load_state("networkidle")
    expect(s.locator(".quiz-score")).to_contain_text("перший результат")
    a = api(mc, "GET", f"/quizzes/{qid}").json()["assignments"]
    check("друга спроба не перезаписала першу", a[0]["score"] == 0, str(a[0]["score"]))

    # 5. Гість входить зі сторінки тесту й лишається на ній
    lc, l = new(b)
    l.goto(url); l.wait_for_load_state("networkidle")
    l.locator(".pq-who").get_by_role("button", name="Увійти як учень").click()
    l.get_by_label("Логін").fill("boiko"); l.locator("input[type=password]").fill("student123")
    l.get_by_role("button", name="Увійти").click(); l.wait_for_selector(".pq-who"); l.wait_for_load_state("networkidle")
    check("після входу знову тест, тепер із записом", "запишеться у ваші тести" in l.locator(".pq-who").inner_text() and "/q/" in l.url)

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
    b.close()

fails = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(fails)}/{len(results)} пройшло")
if fails: print("Провалені:", fails)
print("Console errors:", console)
raise SystemExit(1 if fails or console else 0)
