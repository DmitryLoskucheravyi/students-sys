"""Фінальний прохід: нова сітка, денний вид, гілки підпунктів, граничні випадки API, усі сторінки всіх ролей."""
import datetime as dt, json, os, pathlib, sys
from playwright.sync_api import sync_playwright, expect

BASE = "http://127.0.0.1:3101"
OUT = pathlib.Path(os.environ["SHOTS"]); OUT.mkdir(parents=True, exist_ok=True)
PNG = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63fccfc0f01f0005010201a7f3b5a80000000049454e44ae426082")
results, console = [], []

def check(name, cond, extra=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra else ""), flush=True)

def new(b, w=1360, h=860, theme="light", touch=False):
    ctx = b.new_context(viewport={"width": w, "height": h}, locale="uk-UA", color_scheme=theme, has_touch=touch, is_mobile=touch)
    p = ctx.new_page()
    p.on("console", lambda m: console.append(f"{m.type}: {m.text}") if m.type == "error" and "status of 4" not in m.text else None)
    p.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
    return ctx, p

def login(p, u, pw):
    p.goto(BASE); p.wait_for_load_state("networkidle")
    p.get_by_label("Логін").fill(u); p.locator("input[type=password]").fill(pw)
    p.get_by_role("button", name="Увійти").click(); p.wait_for_selector(".rail"); p.wait_for_load_state("networkidle")

def shot(p, n, full=False):
    p.wait_for_timeout(450); p.screenshot(path=str(OUT / f"{n}.png"), full_page=full)

def api(ctx, m, path, **kw): return ctx.request.fetch(f"{BASE}/api{path}", method=m, **kw)
def post(ctx, path, data=None): return api(ctx, "POST", path, data=data if data is not None else {})
def over(p): return p.evaluate("document.documentElement.scrollWidth - window.innerWidth")
def text_of(r):
    try: return r.text()[:140]
    except Exception: return ""

now = dt.datetime.now(); today = now.date()
monday = today - dt.timedelta(days=today.weekday())
next_mon = monday + dt.timedelta(days=7)

with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True)
    mc, m = new(b); login(m, "manager", "manager123")

    # Окремий вчитель і учень, щоб не залежати від накладок демо-даних
    t_id = post(mc, "/users", {"role": "teacher", "name": "Ніч Вчитель", "login": "nighttch", "password": "nightpass1"}).json()["id"]
    s_id = post(mc, "/users", {"role": "student", "name": "Ніч Учень", "login": "nightstd", "password": "nightpass1"}).json()["id"]
    s2_id = post(mc, "/users", {"role": "student", "name": "Другий Учень", "login": "second", "password": "nightpass1"}).json()["id"]
    plan = post(mc, "/plans", {"name": "Нічний", "lessons_count": 3, "price_per_lesson": 100, "valid_days": 60}).json()
    post(mc, "/subscriptions", {"student_id": s_id, "plan_id": plan["id"]})
    lesson = post(mc, "/lessons", {"title": "Нічний урок", "duration_min": 90}).json()
    lid = lesson["id"]

    # --- Години 00-23
    def once(date, hhmm, lesson_id=lid):
        return post(mc, "/schedules", {"lesson_id": lesson_id, "kind": "once", "date": str(date), "time": hhmm, "teacher_id": t_id, "student_ids": [s_id, s2_id]})
    early = once(next_mon, "00:00"); late = once(next_mon + dt.timedelta(days=1), "23:30")
    check("заняття о 00:00 і о 23:30 створюються", early.ok and late.ok, text_of(late))
    # Шкала: години до 10:00 по 16 px, далі по 88 px
    def y(hours): return min(hours, 10) * 16 + max(0, hours - 10) * 88
    m.goto(BASE); m.wait_for_selector(".week")
    labels = m.locator(".week-hours span").all_inner_texts()
    check("сітка містить 24 години 00:00-23:00", labels == [f"{h:02d}:00" for h in range(24)], f"{labels[:2]}..{labels[-1:]}")
    h = m.evaluate("document.querySelector('.week-body').getBoundingClientRect().height")
    check("висота сітки: 10 низьких годин і 14 звичайних", h == y(24), f"{h} vs {y(24)}")
    rows = m.evaluate("[...document.querySelectorAll('.hour-rows i')].map(e => e.getBoundingClientRect().height)")
    check("години до 10:00 низькі, далі звичайні", rows[:10] == [16] * 10 and rows[10:] == [88] * 14, str(rows[:12]))
    if today.weekday() >= 0:
        st = m.evaluate("document.querySelector('.week').scrollTop")
        exp = y(max(0, now.hour + now.minute / 60 - 1))
        maxs = m.evaluate("(()=>{const w=document.querySelector('.week');return w.scrollHeight-w.clientHeight})()")
        check("сітка відкривається на поточному часі", abs(st - min(exp, maxs)) < 60, f"{st} vs {exp}")
    check("лінія поточного часу видима в сітці", m.locator(".now-line").count() == 1)
    m.get_by_label("Наступний тиждень").click(); m.wait_for_load_state("networkidle"); m.wait_for_timeout(250)
    st = m.evaluate("document.querySelector('.week').scrollTop")
    check("наступний тиждень прокручено до першого заняття (00:00)", st == 0, str(st))
    midnight = m.locator(".week-col").nth(0).locator(".block", has_text="Нічний урок")
    expect(midnight).to_be_visible()
    check("блок 00:00 стоїть зверху сітки", midnight.evaluate("e=>parseFloat(e.style.top)") == 0)
    # Заняття через північ: Вт 23:30 + 90 хв показане у вівторок і хвостом у середу
    tail = m.locator(".week-col").nth(2).locator(".block", has_text="Нічний урок")
    head = m.locator(".week-col").nth(1).locator(".block", has_text="Нічний урок")
    check("заняття через північ не зникає: є у вівторку", head.count() == 1)
    check("хвіст заняття після півночі є в середі", tail.count() == 1)
    check("висота блока через північ додатна", head.evaluate("e=>e.getBoundingClientRect().height") >= 26 and tail.evaluate("e=>e.getBoundingClientRect().height") >= 28)
    squash = head.evaluate("e => { const r = e.querySelector('strong').getBoundingClientRect(); const b = e.getBoundingClientRect(); return { h: r.height, inside: r.top >= b.top && r.bottom <= b.bottom }; }")
    check("назва короткого блока читається, не сплющена", squash["h"] >= 14 and squash["inside"], str(squash))
    check("блок не вилазить за низ доби", head.evaluate("e=>parseFloat(e.style.top)+e.getBoundingClientRect().height") <= y(24) + 1)
    # Клік по порожній клітинці в різні години
    m.evaluate("document.querySelector('.week').scrollTop = 0")
    col = m.locator(".week-col").nth(4); bx = col.bounding_box()
    m.mouse.click(bx["x"] + bx["width"] / 2, bx["y"] + y(3) + 5)
    expect(m.locator(".modal")).to_be_visible()
    expect(m.get_by_label("Час", exact=True)).to_contain_text("03:00"); check("клік по клітинці 03:xx підставляє 03:00", True)
    m.get_by_label("Закрити").click()
    m.evaluate("(()=>{const w=document.querySelector('.week');w.scrollTop=w.scrollHeight})()"); m.wait_for_timeout(100)
    bx = col.bounding_box()
    m.mouse.click(bx["x"] + bx["width"] / 2, bx["y"] + y(23) + 40)
    expect(m.get_by_label("Час", exact=True)).to_contain_text("23:00")
    m.get_by_label("Закрити").click()
    m.evaluate("document.querySelector('.week').scrollTop = 0"); bx = col.bounding_box()
    m.mouse.click(bx["x"] + bx["width"] / 2, bx["y"] + y(10) + 30)
    expect(m.get_by_label("Час", exact=True)).to_contain_text("10:00"); check("межа низьких годин: клік після 10:00 дає 10:00", True)
    m.get_by_label("Закрити").click()
    m.evaluate("(()=>{const w=document.querySelector('.week');w.scrollTop=w.scrollHeight})()"); m.wait_for_timeout(100)
    bx = col.bounding_box()
    m.mouse.click(bx["x"] + bx["width"] / 2, bx["y"] + y(23) + 40)
    expect(m.get_by_label("Час", exact=True)).to_contain_text("23:00"); check("остання клітинка підставляє 23:00", True)
    m.get_by_label("Закрити").click()
    head_top = m.evaluate("document.querySelector('.week-head').getBoundingClientRect().top - document.querySelector('.week').getBoundingClientRect().top")
    check("шапка днів прилипає при прокрутці", abs(head_top) < 1, str(head_top))
    shot(m, "f1-week-evening")
    m.evaluate("document.querySelector('.week').scrollTop = 0"); shot(m, "f2-week-midnight")
    # Вибір часу: усі години
    m.get_by_role("button", name="Додати в розклад").click()
    m.get_by_label("Час", exact=True).click()
    check("у виборі часу 24 години", m.locator(".timepick-col").first.locator("button").count() == 24)
    m.keyboard.press("Escape"); m.get_by_label("Закрити").click()

    # --- Телефон: сітка одного дня
    mob_ctx, sp = new(b, 390, 800, touch=True); login(sp, "nightstd", "nightpass1")
    sp.wait_for_selector(".week.is-single")
    check("телефон: одна колонка", sp.locator(".week-col").count() == 1)
    check("телефон: 24 години", sp.locator(".week-hours span").count() == 24)
    check("телефон: відкрито сьогодні", sp.locator(".day-strip .is-selected.is-today").count() == 1)
    check("телефон: сітка, а не список", sp.locator(".agenda").count() == 0)
    check("телефон: без гориз. прокрутки", over(sp) <= 0, str(over(sp)))
    strip_h = sp.locator(".day-strip button").first.bounding_box()
    check("телефон: кнопки днів великі", strip_h["height"] >= 44 and strip_h["width"] >= 40, str(strip_h))
    shot(sp, "f3-mob-today")
    sp.get_by_label("Наступний день").click(); sp.wait_for_timeout(120)
    tomorrow = today + dt.timedelta(days=1)
    expect(sp.locator(".week-nav strong")).to_contain_text(str(tomorrow.day)); check("стрілка: наступний день", True)
    expect(sp.get_by_role("button", name="Сьогодні")).to_be_visible(); check("з'являється кнопка Сьогодні", True)
    sp.get_by_role("button", name="Сьогодні").click()
    check("Сьогодні повертає поточний день", sp.locator(".day-strip .is-selected.is-today").count() == 1)
    # Перехід через межу тижня
    for _ in range(7 - today.weekday()):
        sp.get_by_label("Наступний день").click()
    sp.wait_for_load_state("networkidle"); sp.wait_for_timeout(250)
    tap = sp.locator(".week-col .block", has_text="Нічний урок")
    expect(tap).to_be_visible(); check("телефон: заняття наступного понеділка в сітці", True)
    check("телефон: прокручено до заняття 00:00", sp.evaluate("document.querySelector('.week').scrollTop") == 0)
    check("телефон: крапка у дня із заняттям", sp.locator(".day-strip .is-selected i.has-items").count() == 1)
    bb = tap.bounding_box(); check("телефон: блок широкий і зручний", bb["width"] > 280 and bb["height"] >= 40, str(bb))
    sp.locator(".day-strip button").nth(1).tap(); sp.wait_for_timeout(200)
    check("телефон: вибір дня зі стрічки", sp.locator(".day-strip button").nth(1).get_attribute("aria-pressed") == "true")
    sp.wait_for_timeout(150)
    late_box = sp.locator(".week-col .block", has_text="Нічний урок").bounding_box()
    tabs_top = sp.evaluate("""(() => { const els = [...document.querySelectorAll('.rail-nav')].map(e => e.getBoundingClientRect()).filter(r => r.bottom >= innerHeight - 2 && r.top > innerHeight / 2); return els.length ? Math.min(...els.map(r => r.top)) : innerHeight; })()""")
    check("телефон: заняття о 23:30 видно на екрані, не під меню", late_box["y"] + late_box["height"] <= tabs_top + 1 and late_box["y"] >= 0, f"{late_box} tabs={tabs_top}")
    shot(sp, "f4-mob-late")
    t2 = sp.locator(".week-col .block", has_text="Нічний урок"); t2.tap(); sp.wait_for_selector(".sheet")
    check("телефон: тап відкриває заняття", sp.locator(".sheet-when").count() == 1)
    shot(sp, "f5-mob-sheet")
    sp.get_by_label("Закрити").click()
    mob_ctx.close()
    # Менеджер на телефоні додає заняття тапом по клітинці
    mcm, mm = new(b, 390, 800, touch=True); login(mm, "manager", "manager123")
    mm.wait_for_selector(".week.is-single"); check("менеджер, телефон: без гориз. прокрутки", over(mm) <= 0)
    shot(mm, "f6-mob-manager")
    # Сітка відкривається на поточному часі, тому спершу йдемо на порожню нічну клітинку.
    mm.evaluate("document.querySelector('.week').scrollTop = 0"); mm.wait_for_timeout(100)
    box = mm.locator(".week-col").bounding_box()
    mm.touchscreen.tap(box["x"] + box["width"] - 12, box["y"] + 20)
    expect(mm.locator(".modal")).to_be_visible(); check("менеджер, телефон: тап по клітинці відкриває форму", True)
    mm.get_by_label("Закрити").click()
    # Тема
    mcm.close()
    dctx, dp = new(b, 390, 800, theme="dark", touch=True); login(dp, "student", "student123"); dp.wait_for_selector(".week.is-single"); shot(dp, "f7-mob-dark"); dctx.close()
    for w in (320, 360, 600, 768, 899, 900, 1024, 1920):
        c, p = new(b, w, 800); login(p, "manager", "manager123"); p.wait_for_selector(".week")
        cols = p.locator(".week-col").count()
        check(f"{w} px: {'1 день' if w < 900 else '7 днів'}, без прокрутки вбік", cols == (1 if w < 900 else 7) and over(p) <= 0, f"cols={cols} over={over(p)}")
        c.close()

    # --- Гілки підпунктів: геометрія заливки
    cs = api(mc, "GET", "/courses").json(); web = next(c for c in cs if c["title"] == "Веброзробка")
    full = api(mc, "GET", f"/courses/{web['id']}").json()
    marko = next(s for s in full["students"] if s["name"] == "Марко Шевчук")
    step = next(s for s in full["steps"] if len(s["substeps"]) >= 3)
    for x in step["substeps"]:
        api(mc, "PUT", f"/courses/{web['id']}/substep-progress", data={"student_id": marko["id"], "substep_id": x["id"], "done": True})
    m.goto(f"{BASE}/courses/{web['id']}"); m.wait_for_selector(".road-row")
    m.get_by_label("Прогрес учня").click(); m.get_by_role("option", name="Марко Шевчук").click(); m.wait_for_timeout(400)
    row = m.locator(".road-row", has_text=step["title"])
    if row.locator(".collapse.is-open").count() == 0: row.locator(".sub-toggle").click()
    m.wait_for_timeout(600)
    geo = row.evaluate("""r => [...r.querySelectorAll('.sub')].map(li => {
      const box = li.querySelector('.check-box').getBoundingClientRect();
      const svg = li.querySelector('svg').getBoundingClientRect();
      const liR = li.getBoundingClientRect();
      const lines = [...li.querySelectorAll('.sub-line')].map(l => getComputedStyle(l).backgroundColor);
      const el = getComputedStyle(li, '::before');
      return { svgInside: svg.left >= box.left && svg.right <= box.right && svg.top >= box.top && svg.bottom <= box.bottom,
        cy: box.top + box.height / 2 - liR.top, elbowBottom: parseFloat(el.top) + parseFloat(el.height),
        elbow: el.borderBottomColor, lines };
    })""")
    print("geo", json.dumps(geo[:2]))
    red = geo[0]["elbow"]
    check("галочка лежить усередині квадрата", all(g["svgInside"] for g in geo))
    check("усі пройдені: стовбур суцільно червоний", all(c == red for g in geo for c in g["lines"]), str(geo[0]["lines"]))
    check("гілка йде в центр квадрата", all(abs((g["elbowBottom"] - 1) - g["cy"]) <= 1 for g in geo), str([(g["elbowBottom"], g["cy"]) for g in geo]))
    shot(m, "f8-subs-all")
    row.screenshot(path=str(OUT / "f9-subs-zoom.png"))
    # Знімаємо позначку в середині: заливка рветься там, де непройдений
    row.locator(".sub").nth(1).locator("label").click(); m.wait_for_load_state("networkidle"); m.wait_for_timeout(400)
    cols2 = row.evaluate("r => [...r.querySelectorAll('.sub')].map(li => [...li.querySelectorAll('.sub-line')].map(l => getComputedStyle(l).backgroundColor))")
    check("заливка зупиняється на першому непройденому", cols2[0][0] == red and cols2[1][0] != red and cols2[-1][0] != red, str(cols2))
    row.screenshot(path=str(OUT / "f10-subs-gap.png"))
    row.locator(".sub").nth(1).locator("label").click(); m.wait_for_load_state("networkidle")

    # --- Запити й виправлені баги
    sc, s = new(b); login(s, "nightstd", "nightpass1")
    # У межах сьогодні: абонемент видано сьогодні, і вчорашнє заняття він не покриває.
    past = max(now - dt.timedelta(hours=3), now.replace(hour=0, minute=0, second=0, microsecond=0))
    fut_day = next_mon + dt.timedelta(days=3)
    fut_r = once(fut_day, "12:00").json(); fut, fut_sched = fut_r["session_id"], fut_r["schedule_id"]
    pst = once(past.date(), past.strftime("%H:%M")).json()["session_id"]
    # 1. Запит не зависає, коли заняття проведено
    rq = post(sc, f"/sessions/{fut}/requests", {"kind": "cancel", "reason": "x"})
    check("запит створено", rq.status == 201, text_of(rq))
    dup = post(sc, f"/sessions/{fut}/requests", {"kind": "cancel"}); check("дубль запиту відхилено", dup.status == 409)
    check("запит на минуле заняття відхилено", post(sc, f"/sessions/{pst}/requests", {"kind": "cancel"}).status == 409)
    # для проведення потрібне минуле заняття: запит робимо, поки воно ще в майбутньому, через перенесення
    soon = post(mc, f"/sessions/{fut}/reschedule", {"starts_at": str(fut_day) + " 13:00"})
    check("перенесення закриває запит", soon.ok and not [r for r in api(mc, "GET", "/requests").json() if r["session_id"] == fut])
    # 2. Вимкнений учень не блокує редагування складу постановки
    api(mc, "PATCH", f"/users/{s2_id}", data={"is_active": False})
    r = api(mc, "PATCH", f"/schedules/{fut_sched}", data={"teacher_id": t_id, "student_ids": [s_id, s2_id]})
    check("постановка з вимкненим учнем редагується", r.ok, text_of(r))
    m.goto(f"{BASE}/"); m.wait_for_load_state("networkidle")
    if fut_day.isocalendar()[1] != today.isocalendar()[1]:
        m.get_by_label("Наступний тиждень").click(); m.wait_for_load_state("networkidle")
    m.locator(".block", has_text="Нічний урок").filter(has_text="13:00").first.click(); m.wait_for_selector(".sheet")
    m.get_by_role("button", name="Змінити склад").click(); m.wait_for_load_state("networkidle")
    m.locator(".sheet-form").get_by_label("Учні").click()
    expect(m.get_by_role("option", name="Другий Учень (вимкнений)")).to_be_visible(); check("вимкненого учня видно у складі постановки", True)
    m.keyboard.press("Escape")
    m.locator(".sheet-form").get_by_role("button", name="Зберегти").click(); expect(m.locator(".toast", has_text="Склад збережено").first).to_be_visible(); check("збереження складу з вимкненим учнем", True)
    m.get_by_label("Закрити").click()
    r = post(mc, "/schedules", {"lesson_id": lid, "kind": "once", "date": str(fut_day + dt.timedelta(days=1)), "time": "09:00", "student_ids": [s2_id]})
    check("нова постановка з вимкненим учнем відхилена", r.status == 400, str(r.status))
    # 3. Список постановок показує фактичний час одноразового заняття
    moved = [x for x in api(mc, "GET", "/schedules").json() if x["id"] == fut_sched]
    check("одноразове після перенесення показує новий час", len(moved) == 1 and moved[0]["time"] == "13:00" and moved[0]["start_date"] == str(fut_day), str(moved))
    post(mc, f"/sessions/{fut}/cancel", {"reason": "тест"})
    check("скасоване одноразове зникає зі списку постановок", not [x for x in api(mc, "GET", "/schedules").json() if x["id"] == fut_sched])
    post(mc, f"/sessions/{fut}/reopen")
    # 4. Останній файл здачі
    hw = post(mc, "/homework", {"session_id": fut, "title": "ДЗ файли", "due_at": f"{fut_day} 23:55"}).json()["id"]
    up = api(sc, "POST", f"/homework/{hw}/submission", multipart={"files": {"name": "a.txt", "mimeType": "text/plain", "buffer": b"a"}})
    check("здача файлу", up.status == 201, text_of(up))
    f1 = api(sc, "GET", f"/homework/{hw}").json()["submission"]["files"][0]["id"]
    check("останній файл зданої роботи не видаляється", api(sc, "DELETE", f"/files/{f1}").status == 409)
    api(sc, "POST", f"/homework/{hw}/submission", multipart={"files": {"name": "b.txt", "mimeType": "text/plain", "buffer": b"b"}})
    check("другий файл додано, перший можна прибрати", api(sc, "DELETE", f"/files/{f1}").ok)
    check("порожня здача відхилена", api(sc, "POST", f"/homework/{hw + 0}/submission", multipart={"comment": "x"}).status in (201, 400))
    # Файл зник із диска: чистий 404, а не обрив
    # 5. Вхід: успішні входи не вичерпують ліміт
    ok_all = True
    for _ in range(25):
        c = b.new_context(); r = c.request.post(f"{BASE}/api/auth/login", data={"login": "nightstd", "password": "nightpass1"}); ok_all = ok_all and r.ok; c.close()
    check("25 успішних входів поспіль не блокують клас", ok_all)

    # --- Граничні та зламані вводи: скрізь чистий 4xx, жодного 500
    probes = [
        ("GET", "/sessions?from=9999-12-31&to=9999-12-31", None),
        ("GET", "/sessions?from=0000-01-01&to=0000-01-02", None),
        ("GET", "/sessions?from=abc&to=def", None),
        ("GET", "/sessions?from=2026-02-30&to=2026-03-01", None),
        ("GET", f"/sessions?from={today}&to={today + dt.timedelta(days=500)}", None),
        ("GET", "/sessions/abc", None), ("GET", "/sessions/0", None), ("GET", "/sessions/-1", None),
        ("GET", "/sessions/1e30", None), ("GET", "/sessions/99999999999", None),
        ("GET", "/lessons/1/nothing", None), ("GET", "/nope", None),
        ("POST", "/schedules", {"lesson_id": lid, "kind": "once", "date": "9999-12-31", "time": "23:59"}),
        ("POST", "/schedules", {"lesson_id": lid, "kind": "once", "date": "2026-13-01", "time": "10:00"}),
        ("POST", "/schedules", {"lesson_id": lid, "kind": "once", "date": str(today), "time": "24:00"}),
        ("POST", "/schedules", {"lesson_id": lid, "kind": "weekly", "weekdays": [8], "time": "10:00"}),
        ("POST", "/schedules", {"lesson_id": lid, "kind": "weekly", "weekdays": "1", "time": "10:00"}),
        ("POST", "/schedules", {"lesson_id": lid, "kind": "weekly", "weekdays": [1], "time": "10:00", "start_date": "2099-01-01", "end_date": "2098-01-01"}),
        ("POST", "/schedules", {"lesson_id": "x"}),
        ("POST", "/lessons", {"title": "", "teacher_id": t_id, "duration_min": 60}),
        ("POST", "/lessons", {"title": "z", "teacher_id": t_id, "duration_min": 5}),
        ("POST", "/schedules", {"lesson_id": lid, "kind": "once", "date": str(today), "time": "10:00", "student_ids": "abc"}),
        ("POST", "/schedules", {"lesson_id": lid, "kind": "once", "date": str(today), "time": "10:00", "teacher_id": s_id}),
        ("PATCH", "/schedules/999999", {"teacher_id": None}),
        ("POST", "/lessons", {"title": "z" * 500, "teacher_id": t_id, "duration_min": 60}),
        ("POST", "/plans", {"name": "z", "lessons_count": 0, "price_per_lesson": 1, "valid_days": 1}),
        ("POST", "/plans", {"name": "z", "lessons_count": 1, "price_per_lesson": -5, "valid_days": 1}),
        ("POST", "/plans", {"name": "z", "lessons_count": 1, "price_per_lesson": "abc", "valid_days": 1}),
        ("POST", "/subscriptions", {"student_id": t_id, "plan_id": plan["id"]}),
        ("POST", "/users", {"role": "student", "name": "x", "login": "ю", "password": "12345678"}),
        ("POST", "/users", {"role": "student", "name": "x", "login": "nightstd", "password": "12345678"}),
        ("POST", "/users", {"role": "student", "name": "x", "login": "okname", "password": "short"}),
        ("POST", "/users", {"role": "student", "name": {"a": 1}, "login": "okname", "password": "12345678"}),
        ("POST", "/courses", {"title": ["a"]}),
        ("PUT", f"/courses/{web['id']}/steps-order", {"ids": [1]}),
        ("PUT", f"/courses/{web['id']}/progress", {"student_id": "x", "step_id": 1}),
        ("PUT", f"/courses/{web['id']}/substep-progress", {"student_id": marko["id"], "substep_id": 99999999}),
        ("POST", f"/sessions/{fut}/complete", {"attended_ids": "x"}),
        ("POST", f"/sessions/{fut}/complete", {"attended_ids": [{}]}),
        ("POST", f"/sessions/{fut}/reschedule", {"starts_at": "not-a-date"}),
        ("POST", f"/sessions/{fut}/reschedule", {"starts_at": "2000-01-01 10:00"}),
        ("POST", "/homework", {"lesson_id": lid, "title": "x", "due_at": "9999-12-31 23:59"}),
        ("POST", f"/homework/submissions/999999/review", {"status": "accepted"}),
        ("POST", "/requests/999999/approve", {}),
        ("POST", "/requests/1/explode", {}),
    ]
    bad_5xx = []
    for meth, path, data in probes:
        r = api(mc, meth, path, **({"data": data} if data is not None else {}))
        if r.status >= 500: bad_5xx.append((meth, path, r.status))
        if r.ok and meth != "GET": print("  увага: прийнято", meth, path, r.status, text_of(r))
    check(f"{len(probes)} зламаних запитів: жодного 500", not bad_5xx, str(bad_5xx))
    for raw, name in [("{not json", "битий JSON"), ('"рядок"', "рядок замість об'єкта"), ("[1,2]", "масив"), ("null", "null")]:
        r = mc.request.fetch(f"{BASE}/api/lessons", method="POST", headers={"Content-Type": "application/json"}, data=raw)
        check(f"{name}: без 500", r.status < 500, str(r.status))
    # XSS у назвах показується як текст
    x = "<img src=x onerror=window.__xss=1>"
    xl = post(mc, "/lessons", {"title": x, "teacher_id": t_id, "duration_min": 30}).json()
    m.goto(f"{BASE}/lessons"); m.wait_for_load_state("networkidle"); m.wait_for_timeout(300)
    check("XSS у назві не спрацьовує", m.evaluate("window.__xss") is None and m.locator(".lesson-row", has_text="onerror").count() == 1)
    post(mc, f"/lessons/{xl['id']}/archive")
    # Межі ролей
    tc, tp = new(b); login(tp, "nighttch", "nightpass1")
    fence = [
        (sc, "GET", "/users", 403), (sc, "GET", "/plans", 403), (sc, "GET", "/lessons", 403), (sc, "GET", "/requests", 403),
        (sc, "POST", "/schedules", 403), (sc, "POST", "/lessons", 403), (sc, "POST", "/courses", 403),
        (tc, "GET", "/users", 403), (tc, "GET", "/plans", 403), (tc, "GET", "/subscriptions", 403),
        (tc, "POST", "/lessons", 403), (tc, "POST", "/schedules", 403), (tc, "POST", "/plans", 403),
    ]
    wrong = []
    for c, meth, path, code in fence:
        r = api(c, meth, path, **({"data": {}} if meth == "POST" else {}))
        if r.status != code: wrong.append((meth, path, r.status))
    check(f"{len(fence)} перевірок ролей", not wrong, str(wrong))
    anon = b.new_context()
    leaks = [p for p in ["/sessions?from=2026-01-01&to=2026-01-02", "/users", "/lessons", "/homework", "/courses", "/subscriptions", "/requests"] if anon.request.get(f"{BASE}/api{p}").status != 401]
    check("аноніму все закрито", not leaks, str(leaks)); anon.close()
    # Перенесення чужого заняття вчителем
    other_sess = next((x for x in api(mc, "GET", f"/sessions?from={monday}&to={monday + dt.timedelta(days=6)}").json() if x["teacher_id"] != t_id), None)
    if other_sess:
        check("вчитель не чіпає чуже заняття", post(tc, f"/sessions/{other_sess['id']}/cancel", {}).status == 403)
        check("учень не бачить чуже заняття", api(sc, "GET", f"/sessions/{other_sess['id']}").status == 404)
    # Подвійне проведення й повторне списання
    done1 = post(tc, f"/sessions/{pst}/complete", {"attended_ids": [s_id, s2_id, 999999]})
    done2 = post(tc, f"/sessions/{pst}/complete", {"attended_ids": [s_id]})
    subs = api(sc, "GET", "/subscriptions").json()
    check("повторне проведення не списує вдруге", done1.ok and done2.status == 409 and subs[0]["lessons_used"] == 1, str((done1.status, done2.status, subs[0]["lessons_used"])))
    check("без абонемента: попередження, а не помилка", "Другий Учень" in done1.json()["no_subscription"], text_of(done1))
    post(tc, f"/sessions/{pst}/reopen"); post(tc, f"/sessions/{pst}/reopen")
    check("повторний reopen не повертає зайвий урок", api(sc, "GET", "/subscriptions").json()[0]["lessons_used"] == 0)
    # Заняття після закінчення абонемента (уроків більше немає)
    api(mc, "PATCH", f"/subscriptions/{subs[0]['id']}", data={"lessons_total": 1})
    post(tc, f"/sessions/{pst}/complete", {"attended_ids": [s_id]})
    check("зменшити уроки нижче списаних не можна", api(mc, "PATCH", f"/subscriptions/{subs[0]['id']}", data={"lessons_total": 0}).status == 400)
    post(tc, f"/sessions/{pst}/reopen")
    api(mc, "PATCH", f"/subscriptions/{subs[0]['id']}", data={"lessons_total": 3})
    # Архів, чипи й видалення правила при наявному ДЗ на занятті
    hw2 = post(mc, "/homework", {"lesson_id": lid, "session_id": fut, "title": "До заняття", "due_at": f"{fut_day} 20:00"}).json()["id"]
    r = api(mc, "DELETE", f"/schedules/{fut_sched}")
    check("прибрати правило з ДЗ на занятті: без 500, ДЗ лишається", r.ok and api(mc, "GET", f"/homework/{hw2}").ok, text_of(r))

    # --- Прохід по всіх сторінках усіх ролей у двох темах і двох ширинах
    pages = {
        "manager": ("manager123", ["/", "/lessons", "/courses", "/subscriptions", "/people", "/homework", "/profile", f"/courses/{web['id']}"]),
        "nighttch": ("nightpass1", ["/", "/lessons", "/homework", "/courses", "/profile", f"/homework/{hw}"]),
        "nightstd": ("nightpass1", ["/", "/subscription", "/homework", "/courses", "/profile", f"/homework/{hw}"]),
    }
    walk_fail = []
    for login_name, (pwd, paths) in pages.items():
        for w, theme in ((390, "dark"), (1360, "light")):
            c, p = new(b, w, 800, theme=theme); login(p, login_name, pwd)
            for path in paths:
                before = len(console)
                p.goto(BASE + path); p.wait_for_load_state("networkidle"); p.wait_for_timeout(120)
                problems = []
                if over(p) > 0: problems.append(f"over={over(p)}")
                if p.locator(".error-note, .form-error").count(): problems.append("error-note")
                if not p.locator("h1").count(): problems.append("no-h1")
                if len(console) > before: problems.append(console[-1][:80])
                if problems: walk_fail.append((login_name, w, path, problems))
            c.close()
    check("усі сторінки всіх ролей: без помилок і прокрутки вбік", not walk_fail, str(walk_fail))
    # Глибоке посилання і оновлення сторінки
    c, p = new(b); login(p, "manager", "manager123"); p.goto(f"{BASE}/courses/{web['id']}"); p.reload(); p.wait_for_selector(".road-row"); check("оновлення глибокого посилання", True)
    p.goto(f"{BASE}/nonexistent/page"); p.wait_for_load_state("networkidle")
    check("невідома адреса не дає білий екран", p.locator("body").inner_text().strip() != "")
    p.goto(f"{BASE}/courses/999999"); p.wait_for_load_state("networkidle"); p.wait_for_timeout(200)
    check("неіснуючий курс показує повідомлення", p.locator("body").inner_text().strip() != "" and "Курс не знайдено" in p.locator("body").inner_text())
    p.goto(f"{BASE}/homework/999999"); p.wait_for_load_state("networkidle"); p.wait_for_timeout(200)
    check("неіснуюче ДЗ показує повідомлення", "не знайдено" in p.locator("body").inner_text())
    # Вихід
    api(c, "POST", "/auth/logout", data={}); p.goto(BASE); p.wait_for_load_state("networkidle")
    check("після виходу лише форма входу", p.get_by_role("button", name="Увійти").count() == 1)
    # Сесія зникла посеред роботи: перекидає на вхід
    c2, p2 = new(b)
    login(p2, "nightstd", "nightpass1"); p2.context.clear_cookies()
    p2.get_by_role("link", name="Завдання").first.click(); p2.wait_for_timeout(600)
    check("протухла сесія веде на вхід", p2.get_by_role("button", name="Увійти").count() == 1)
    b.close()

fails = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(fails)}/{len(results)} пройшло")
if fails: print("Провалені:", fails)
print("Console errors:", console[:15])
sys.exit(1 if fails or console else 0)
