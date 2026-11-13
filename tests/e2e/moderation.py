"""Модерація тестів вчителя, колір абонемента, аватарки учнів, теми й іконки курсів."""
import os, pathlib
from playwright.sync_api import sync_playwright, expect

BASE = "http://127.0.0.1:3101"
APP = BASE + "/cabinet"  # кабінет; на / тепер сайт школи
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
    p.goto(APP); p.wait_for_load_state("networkidle")
    p.get_by_label("Логін").fill(u); p.locator("input[type=password]").fill(pw)
    p.get_by_role("button", name="Увійти").click(); p.wait_for_selector(".rail"); p.wait_for_load_state("networkidle")

def shot(p, n, full=False):
    p.wait_for_timeout(500); p.screenshot(path=str(OUT / f"{n}.png"), full_page=full)

def api(ctx, m, path, **kw): return ctx.request.fetch(f"{BASE}/api{path}", method=m, **kw)

QUIZ = {"title": "HTML і структура: перевірка", "description": "", "questions": [
    {"text": "Який тег задає найважливіший заголовок?", "options": [{"text": "h1", "correct": True}, {"text": "h6", "correct": False}, {"text": "head", "correct": False}]},
    {"text": "Що робить тег form?", "options": [{"text": "Збирає поля", "correct": True}, {"text": "Малює рамку", "correct": False}, {"text": "Додає таблицю", "correct": False}]},
]}

with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True)
    mc, m = new(b); login(m, "manager", "manager123")
    web = next(c for c in api(mc, "GET", "/courses").json() if c["title"] == "Веброзробка")
    course = api(mc, "GET", f"/courses/{web['id']}").json()
    check("острівців і тестів на роадмапі немає", "islands" not in course and "quizzes" not in course)
    mq = api(mc, "POST", "/quizzes", data=QUIZ).json()
    check("тест менеджера одразу схвалений", mq["status"] == "approved")
    quizzes = api(mc, "GET", "/quizzes").json()
    sc, s = new(b); login(s, "student", "student123")
    my = [{"student_id": api(sc, "GET", "/auth/me").json()["id"]}]
    check("ендпойнтів острівців немає", api(mc, "PUT", f"/courses/{web['id']}/islands/{course['steps'][0]['id']}", data={"quiz_id": mq["id"]}).status == 404)

    # 1. Вчитель створює тест: він іде на модерацію
    tc, t = new(b); login(t, "teacher", "teacher123")
    t.goto(f"{APP}/homework?tab=quizzes"); t.wait_for_load_state("networkidle")
    t.get_by_role("button", name="Новий тест").click(); t.wait_for_url("**/quizzes/new")
    check("тест вчителя на модерації", api(tc, "POST", "/quizzes", data={**QUIZ, "title": "JS від вчителя"}).json()["status"] == "pending")
    tq = api(tc, "GET", "/quizzes").json()
    check("вчитель бачить лише свої тести", [z["title"] for z in tq] == ["JS від вчителя"] and tq[0]["status"] == "pending", str([z['title'] for z in tq]))
    jsq = tq[0]["id"]
    check("вчитель не схвалює сам", api(tc, "POST", f"/quizzes/{jsq}/approve").status == 403)
    check("вчитель не бачить чужий тест", api(tc, "GET", f"/quizzes/{quizzes[0]['id']}").status == 404)
    check("неперевірений тест не відкрити учневі", api(mc, "POST", f"/quizzes/{jsq}/assignments", data={"student_id": my[0]["student_id"]}).status == 400)
    t.goto(f"{APP}/homework?tab=quizzes"); t.wait_for_load_state("networkidle")
    expect(t.locator("main")).to_contain_text("На модерації"); check("вкладка тестів у вчителя зі статусом", True)
    shot(t, "is3-teacher-tests")

    # 2. Менеджер: розділ модерації, бейдж, відхилення з причиною, повторне надсилання, схвалення
    m.goto(f"{APP}/homework?tab=quizzes"); m.wait_for_load_state("networkidle"); m.wait_for_timeout(300)
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
    check("після схвалення тест у загальному списку", any(z["id"] == jsq and z["status"] == "approved" for z in api(mc, "GET", "/quizzes").json()))

    # 3. Колір абонемента
    plans = api(mc, "GET", "/plans").json()
    base = next(x for x in plans if x["name"] == "Базовий")
    check("колір за замовчуванням червоний", base["color"] == "red")
    check("невідомий колір відхилено", api(mc, "PATCH", f"/plans/{base['id']}", data={"color": "gold"}).status == 400)
    m.goto(f"{APP}/subscriptions"); m.wait_for_load_state("networkidle")
    m.get_by_role("radio", name="Види").click()
    m.locator(".ticket").filter(has_text="Базовий").get_by_role("button", name="Змінити").click()
    m.locator(".modal").get_by_role("radio", name="Фіолетовий").click()
    stub = m.locator(".modal .tk-preview .ticket-stub").evaluate("e => getComputedStyle(e).backgroundColor")
    check("прев'ю квитка перефарбовано", stub == "rgb(116, 72, 208)", stub)
    m.locator(".modal").get_by_role("button", name="Зберегти").click(); expect(m.locator(".modal")).to_have_count(0)
    check("колір збережено", next(x for x in api(mc, "GET", "/plans").json() if x["id"] == base["id"])["color"] == "violet")
    s.goto(f"{APP}/subscription"); s.wait_for_load_state("networkidle"); s.wait_for_selector(".ticket")
    stub = s.locator(".ticket-stub").first.evaluate("e => getComputedStyle(e).backgroundColor")
    check("квиток учня у кольорі виду", stub == "rgb(116, 72, 208)", stub)
    shot(s, "is6-ticket")

    # 4. Аватарки учнів: розклад, абонементи, домашні
    api(sc, "PATCH", "/auth/avatar", data={"avatar": "cool"})
    me = api(sc, "GET", "/auth/me").json()
    m.goto(f"{APP}/subscriptions"); m.wait_for_load_state("networkidle")
    check("абонементи: аватарки поруч з іменами", m.locator(".sub-row .who .avatar").count() >= 3)
    m.goto(APP); m.wait_for_load_state("networkidle")
    check("розклад: аватарки учнів у блоках", m.locator(".block .faces .avatar").count() >= 1)
    m.locator(".block-open").first.click(); m.wait_for_timeout(500)
    check("заняття: аватарки в списку учнів", m.locator(".roster .who .avatar").count() >= 1)
    shot(m, "is7-session")
    subs = api(mc, "GET", "/subscriptions").json()
    check("API віддає аватарку учня", any(x["student_name"] == "Марко Шевчук" and x["student_avatar"] == me["avatar"] for x in subs), me.get("avatar"))
    # 5. Нові теми й іконки курсів
    for theme, icon in (("git", "git"), ("php", "php"), ("sql", "sql"), ("next", "next")):
        r = api(mc, "PATCH", f"/courses/{web['id']}", data={"title": "Веброзробка", "theme": theme, "icon": icon})
        got = next(c for c in api(mc, "GET", "/courses").json() if c["id"] == web["id"])
        check(f"тема {theme} з іконкою приймається", r.ok and got["theme"] == theme and got["icon"] == icon, r.text()[:80])
    m.goto(f"{APP}/courses/{web['id']}"); m.wait_for_selector(".road-row")
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
