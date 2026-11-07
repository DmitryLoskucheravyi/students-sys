"""Урок як окрема сутність: спершу урок, потім вчитель і учні. І дорога роадмапа на всю ширину."""
import datetime as dt, os, pathlib, sys
from playwright.sync_api import sync_playwright, expect

BASE = "http://127.0.0.1:3101"
OUT = pathlib.Path(os.environ["SHOTS"]); OUT.mkdir(parents=True, exist_ok=True)
results, console = [], []

def check(name, cond, extra=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra else ""), flush=True)

def new(b, w=1360, h=860, theme="light"):
    ctx = b.new_context(viewport={"width": w, "height": h}, locale="uk-UA", color_scheme=theme)
    p = ctx.new_page()
    p.on("console", lambda m: console.append(m.text) if m.type == "error" and "status of 4" not in m.text else None)
    p.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
    return ctx, p

def login(p, u, pw):
    p.goto(BASE); p.wait_for_load_state("networkidle")
    p.get_by_label("Логін").fill(u); p.locator("input[type=password]").fill(pw)
    p.get_by_role("button", name="Увійти").click(); p.wait_for_selector(".rail"); p.wait_for_load_state("networkidle")

def api(ctx, m, path, **kw): return ctx.request.fetch(f"{BASE}/api{path}", method=m, **kw)
def toast(p, text): expect(p.locator(".toast", has_text=text).first).to_be_visible(timeout=8000)
def over(p): return p.evaluate("document.documentElement.scrollWidth - window.innerWidth")
def lesson_by(ctx, title): return next(l for l in api(ctx, "GET", "/lessons").json() if l["title"] == title)

with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True)
    mc, m = new(b); login(m, "manager", "manager123")
    teacher = api(mc, "POST", "/users", data={"role": "teacher", "name": "Склад Вчитель", "login": "staffteach", "password": "staffpass1"}).json()["id"]
    student = api(mc, "POST", "/users", data={"role": "student", "name": "Склад Учень", "login": "staffstud", "password": "staffpass1"}).json()["id"]

    # 1. Урок створюється без людей
    m.goto(f"{BASE}/lessons"); m.wait_for_load_state("networkidle")
    m.get_by_role("button", name="Новий урок").click()
    m.get_by_label("Назва").fill("Сутність-урок")
    m.locator(".modal").get_by_role("button", name="Створити").click(); toast(m, "Урок створено")
    expect(m.get_by_text("Склад: Сутність-урок")).to_be_visible(); check("після створення відкривається склад", True)
    m.locator(".modal").get_by_role("button", name="Пізніше").click(); m.wait_for_selector(".modal", state="detached"); m.wait_for_load_state("networkidle")
    row = m.locator(".lesson-row", has_text="Сутність-урок")
    expect(row).to_contain_text("Без вчителя"); expect(row).to_contain_text("Без учнів"); check("урок без вчителя й учнів у списку", True)
    lesson = lesson_by(mc, "Сутність-урок")
    check("у базі урок без вчителя", lesson["teacher_id"] is None and lesson["students"] == [])
    m.screenshot(path=str(OUT / "lessons-empty.png"))

    # 2. Розклад без вчителя: менеджер бачить і може провести
    now = dt.datetime.now(); start = max(now - dt.timedelta(hours=1), now.replace(hour=0, minute=0, second=0, microsecond=0))
    past = api(mc, "POST", "/schedules", data={"lesson_id": lesson["id"], "kind": "once", "date": str(start.date()), "time": start.strftime("%H:%M")})
    check("урок без вчителя можна поставити в розклад", past.status == 201, past.text()[:100])
    future_day = dt.date.today() + dt.timedelta(days=(7 - dt.date.today().weekday()) + 2)
    fut = api(mc, "POST", "/schedules", data={"lesson_id": lesson["id"], "kind": "once", "date": str(future_day), "time": "10:00"}).json()["session_id"]
    s_past = past.json()["session_id"]
    sheet = api(mc, "GET", f"/sessions/{s_past}").json()
    check("заняття без вчителя відкривається", sheet["teacher_name"] is None and sheet["students"] == [])
    m.goto(BASE); m.wait_for_load_state("networkidle")
    blk = m.locator(".block", has_text="Сутність-урок").first
    expect(blk).to_be_attached(); blk.click(); m.wait_for_selector(".sheet")
    expect(m.locator(".facts")).to_contain_text("Без вчителя"); check("у картці заняття написано «Без вчителя»", True)
    m.get_by_label("Закрити").click()
    check("менеджер проводить заняття без вчителя", api(mc, "POST", f"/sessions/{s_past}/complete", data={"attended_ids": []}).ok)
    api(mc, "POST", f"/sessions/{s_past}/reopen", data={})

    # 3. Склад через UI: вчитель і учень
    m.goto(f"{BASE}/lessons"); m.wait_for_load_state("networkidle")
    m.locator(".lesson-row", has_text="Сутність-урок").get_by_role("button", name="Склад").click()
    m.get_by_label("Вчитель").click(); m.get_by_role("option", name="Склад Вчитель").click()
    m.get_by_label("Учні").click(); m.get_by_role("option", name="Склад Учень").click(); m.keyboard.press("Escape")
    m.locator(".modal").get_by_role("button", name="Зберегти").click(); toast(m, "Склад збережено")
    m.wait_for_selector(".modal", state="detached"); m.wait_for_load_state("networkidle")
    lesson = lesson_by(mc, "Сутність-урок")
    check("вчителя й учня додано", lesson["teacher_id"] == teacher and [s["id"] for s in lesson["students"]] == [student])
    m.screenshot(path=str(OUT / "lessons-staffed.png"))
    tc, tp = new(b); login(tp, "staffteach", "staffpass1")
    check("доданий вчитель бачить заняття уроку", any(s["id"] == fut for s in api(tc, "GET", f"/sessions?from={future_day}&to={future_day}").json()))
    sc, sp = new(b); login(sp, "staffstud", "staffpass1")
    check("доданий учень бачить заняття уроку", any(s["id"] == fut for s in api(sc, "GET", f"/sessions?from={future_day}&to={future_day}").json()))

    # 4. Редагування уроку не стирає склад, а склад не стирає урок
    r = api(mc, "PATCH", f"/lessons/{lesson['id']}", data={"title": "Сутність-урок", "duration_min": 45, "location": "Кабінет 5"})
    after = lesson_by(mc, "Сутність-урок")
    check("зміна тривалості зберігає вчителя й учнів", r.ok and after["teacher_id"] == teacher and len(after["students"]) == 1 and after["duration_min"] == 45)
    fut_sess = api(mc, "GET", f"/sessions/{fut}").json()
    check("тривалість поширилась на майбутнє заняття", fut_sess["ends_at"].endswith("10:45:00"), fut_sess["ends_at"])
    r = api(mc, "PATCH", f"/lessons/{lesson['id']}", data={"student_ids": []})
    after = lesson_by(mc, "Сутність-урок")
    check("зміна складу зберігає поля уроку", r.ok and after["location"] == "Кабінет 5" and after["duration_min"] == 45 and after["teacher_id"] == teacher)

    # 5. Накладка перевіряється в момент призначення вчителя
    other = api(mc, "POST", "/lessons", data={"title": "Інший урок", "duration_min": 60}).json()["id"]
    api(mc, "POST", "/schedules", data={"lesson_id": other, "kind": "once", "date": str(future_day), "time": "10:15"})
    busy_teacher = api(mc, "POST", "/users", data={"role": "teacher", "name": "Зайнятий Вчитель", "login": "busyteach", "password": "busypass1"}).json()["id"]
    api(mc, "PATCH", f"/lessons/{other}", data={"teacher_id": busy_teacher})
    r = api(mc, "PATCH", f"/lessons/{lesson['id']}", data={"teacher_id": busy_teacher})
    check("зайнятого вчителя не призначити: є накладка", r.status == 409 and "Зайнятий Вчитель" in r.text(), r.text()[:120])
    check("після відмови вчитель не змінився", lesson_by(mc, "Сутність-урок")["teacher_id"] == teacher)

    # 6. Прибрати вчителя: він втрачає доступ
    r = api(mc, "PATCH", f"/lessons/{lesson['id']}", data={"teacher_id": None})
    check("вчителя можна прибрати", r.ok and lesson_by(mc, "Сутність-урок")["teacher_id"] is None)
    check("прибраний вчитель більше не бачить заняття", api(tc, "GET", f"/sessions/{fut}").status == 404)
    check("прибраний вчитель не може його скасувати", api(tc, "POST", f"/sessions/{fut}/cancel", data={}).status in (403, 404))
    hw = api(mc, "POST", "/homework", data={"lesson_id": lesson["id"], "title": "ДЗ без вчителя", "due_at": f"{future_day} 20:00"})
    check("домашнє до уроку без вчителя", hw.status == 201)
    m.goto(f"{BASE}/homework"); m.wait_for_load_state("networkidle")
    expect(m.locator("body")).to_contain_text("ДЗ без вчителя"); check("список домашніх показує урок без вчителя", True)
    m.goto(f"{BASE}/homework/{hw.json()['id']}"); m.wait_for_load_state("networkidle")
    check("сторінка домашнього без «null»", "null" not in m.locator("main").inner_text() and "undefined" not in m.locator("main").inner_text())

    # 7. Межі доступу й зламані запити
    check("учень не змінює склад", api(sc, "PATCH", f"/lessons/{lesson['id']}", data={"teacher_id": None}).status == 403)
    check("вчитель не змінює склад", api(tc, "PATCH", f"/lessons/{lesson['id']}", data={"student_ids": []}).status == 403)
    bad = [api(mc, "PATCH", f"/lessons/{lesson['id']}", data=d).status for d in ({"teacher_id": student}, {"teacher_id": 999999}, {"student_ids": [teacher]}, {"teacher_id": "abc"}, {"title": ""})]
    check("невалідний склад відхилено", all(s == 400 for s in bad), str(bad))
    check("неіснуючий урок", api(mc, "PATCH", "/lessons/999999", data={"teacher_id": None}).status == 404)

    # 8. Роадмап: дорога на всю ширину
    web = next(c for c in api(mc, "GET", "/courses").json() if c["title"] == "Веброзробка")
    for w, theme in ((1440, "light"), (1920, "dark"), (390, "light"), (320, "light")):
        c, p = new(b, w, 900, theme); login(p, "manager", "manager123")
        p.goto(f"{BASE}/courses/{web['id']}"); p.wait_for_selector(".road-row"); p.wait_for_timeout(500)
        page_w = p.locator(".page").bounding_box()["width"]; road_w = p.locator(".road").bounding_box()["width"]
        bed = p.evaluate("getComputedStyle(document.querySelector('.road-bed path')).strokeWidth")
        stop = p.locator(".stop").first.bounding_box(); path_box = p.locator(".road-bed path").first.bounding_box()
        text_x = p.locator(".road-text").first.bounding_box()["x"]
        wide = w >= 900
        check(f"{w}px: дорога на всю ширину сторінки", road_w >= page_w - 100, f"{road_w} із {page_w}")
        check(f"{w}px: дорога широка ({bed})", float(bed.replace('px', '')) >= (30 if wide else 16))
        check(f"{w}px: текст не налазить на дорогу", text_x > path_box["x"] + path_box["width"], f"текст {text_x}, дорога до {path_box['x'] + path_box['width']}")
        check(f"{w}px: кружки на дорозі й без прокрутки вбік", stop["width"] >= (56 if wide else 44) and over(p) <= 0, f"{stop['width']} over={over(p)}")
        p.screenshot(path=str(OUT / f"road-{w}-{theme}.png"))
        c.close()
    b.close()

fails = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(fails)}/{len(results)} пройшло")
if fails: print("Провалені:", fails)
print("Console errors:", console[:10])
sys.exit(1 if fails or console else 0)
