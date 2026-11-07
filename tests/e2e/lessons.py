"""Урок — шаблон; вчитель і учні задаються в постановці в розклад. Плюс клікабельні посилання, статистика й дорога роадмапа."""
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
def choose(p, label, option, scope=None):
    (scope or p).get_by_label(label, exact=True).click(); p.get_by_role("option", name=option).first.click()

today = dt.date.today()
next_week = today + dt.timedelta(days=(7 - today.weekday()))  # наступний понеділок

with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True)
    mc, m = new(b); login(m, "manager", "manager123")
    mk = lambda role, name, login_: api(mc, "POST", "/users", data={"role": role, "name": name, "login": login_, "password": "staffpass1"}).json()["id"]
    teacher = mk("teacher", "Склад Вчитель", "staffteach"); teacher2 = mk("teacher", "Інший Вчитель", "otherteach")
    ann = mk("student", "Аня Перша", "annstud"); bob = mk("student", "Богдан Другий", "bobstud")

    # 1. Урок — шаблон: без людей і без плашок
    m.goto(f"{BASE}/lessons"); m.wait_for_load_state("networkidle")
    m.get_by_role("button", name="Новий урок").click()
    modal = m.locator(".modal")
    check("у формі уроку немає учнів, є лише вчитель за замовчуванням", modal.get_by_label("Учні").count() == 0 and modal.get_by_label("Вчитель", exact=True).count() == 0 and modal.get_by_label("Вчитель за замовчуванням").count() == 1)
    m.get_by_label("Назва").fill("Шаблон-урок"); m.get_by_label("Місце").fill("https://zoom.us/j/555 кабінет 3")
    modal.get_by_role("button", name="Створити").click(); toast(m, "Урок створено")
    expect(m.get_by_text("Додати в розклад").first).to_be_visible(); check("після створення відкривається постановка в розклад", True)
    m.get_by_label("Закрити").click(); m.wait_for_selector(".modal", state="detached"); m.wait_for_load_state("networkidle")
    row = m.locator(".lesson-row", has_text="Шаблон-урок")
    check("у рядку уроку немає людей і плашок", row.locator(".slot").count() == 0 and row.locator(".lesson-people").count() == 0 and "Без учнів" not in row.inner_text())
    link = row.locator("a.text-link")
    check("посилання в місці клікабельне", link.count() == 1 and link.get_attribute("href") == "https://zoom.us/j/555" and link.get_attribute("target") == "_blank" and "noopener" in link.get_attribute("rel"))
    lesson = next(l for l in api(mc, "GET", "/lessons").json() if l["title"] == "Шаблон-урок")
    check("урок не має людей у відповіді API", "teacher_id" not in lesson and "students" not in lesson)
    m.screenshot(path=str(OUT / "lessons-template.png"))

    # 2. Постановка через UI: вчитель і учень обираються тут
    row.get_by_role("button", name="В розклад").click(); m.wait_for_load_state("networkidle")
    choose(m, "Вчитель", "Склад Вчитель")
    m.get_by_label("Учні").click(); m.get_by_role("option", name="Аня Перша").click(); m.keyboard.press("Escape")
    m.locator(".weekdays button", has_text="Пн").click(); m.locator(".weekdays button", has_text="Ср").click()
    m.screenshot(path=str(OUT / "schedule-form-people.png"))
    m.locator(".modal").get_by_role("button", name="Додати", exact=True).click(); toast(m, "Додано в розклад")
    m.wait_for_selector(".modal", state="detached")
    placements = [x for x in api(mc, "GET", "/schedules").json() if x["lesson_id"] == lesson["id"]]
    check("одна постановка на два дні з вчителем і учнем", len(placements) == 1 and placements[0]["weekdays"] == [1, 3]
          and placements[0]["teacher_id"] == teacher and [s["id"] for s in placements[0]["students"]] == [ann], str(placements))
    pA = placements[0]["id"]

    # 3. Той самий урок — друга група з іншим вчителем і учнем
    r = api(mc, "POST", "/schedules", data={"lesson_id": lesson["id"], "kind": "weekly", "weekdays": [5], "time": "10:00", "teacher_id": teacher2, "student_ids": [bob]})
    check("той самий урок ставиться другій групі", r.status == 201, r.text()[:100]); pB = r.json()["schedule_id"]
    tc, tp = new(b); login(tp, "staffteach", "staffpass1")
    t2c, t2p = new(b); login(t2p, "otherteach", "staffpass1")
    ac, ap = new(b); login(ap, "annstud", "staffpass1")
    bc, bp = new(b); login(bp, "bobstud", "staffpass1")
    wk = lambda ctx: api(ctx, "GET", f"/sessions?from={next_week}&to={next_week + dt.timedelta(days=6)}").json()
    mine = lambda ctx: {s["schedule_id"] for s in wk(ctx) if s["lesson_id"] == lesson["id"]}
    check("вчитель першої групи бачить лише свої заняття", mine(tc) == {pA})
    check("вчитель другої групи бачить лише свої заняття", mine(t2c) == {pB})
    check("учні бачать лише заняття своєї групи", mine(ac) == {pA} and mine(bc) == {pB})

    # 4. Домашнє належить групі
    hw = api(tc, "POST", "/homework", data={"schedule_id": pA, "title": "ДЗ групи А", "due_at": f"{next_week + dt.timedelta(days=6)} 20:00"})
    check("вчитель задає домашнє своїй групі", hw.status == 201, hw.text()[:100]); hw_id = hw.json()["id"]
    check("вчитель не задає домашнє чужій групі", api(tc, "POST", "/homework", data={"schedule_id": pB, "title": "x", "due_at": f"{next_week} 20:00"}).status == 403)
    check("домашнє бачить учень групи", any(h["id"] == hw_id for h in api(ac, "GET", "/homework").json()))
    check("домашнє не бачить учень іншої групи того самого уроку", not any(h["id"] == hw_id for h in api(bc, "GET", "/homework").json()) and api(bc, "GET", f"/homework/{hw_id}").status == 403)
    check("вчитель іншої групи не бачить домашнє", api(t2c, "GET", f"/homework/{hw_id}").status == 403)
    staff_view = api(tc, "GET", f"/homework/{hw_id}").json()
    check("у домашньому список учнів групи", [s["student_id"] for s in staff_view["students"]] == [ann])
    m.goto(f"{BASE}/homework"); m.wait_for_load_state("networkidle")
    m.get_by_role("button", name="Задати домашнє").click()
    m.get_by_label("Урок", exact=True).click()
    opts = m.get_by_role("option").all_inner_texts()
    check("у формі домашнього групи з днями й часом", any("Шаблон-урок" in o and "Пн, Ср 17:00" in o for o in opts) and any("Шаблон-урок" in o and "Пт 10:00" in o for o in opts), str(opts[:6]))
    m.keyboard.press("Escape"); m.get_by_label("Закрити").click()

    # 5. Склад постановки з картки заняття
    sess = next(s for s in wk(mc) if s["schedule_id"] == pA)
    m.goto(BASE); m.wait_for_load_state("networkidle")
    if next_week.isocalendar()[1] != today.isocalendar()[1]:
        m.get_by_label("Наступний тиждень").click(); m.wait_for_load_state("networkidle")
    m.locator(".block", has_text="Шаблон-урок").first.click(); m.wait_for_selector(".sheet")
    expect(m.locator(".facts a.text-link")).to_have_attribute("href", "https://zoom.us/j/555"); check("посилання клікабельне в картці заняття", True)
    m.get_by_role("button", name="Змінити склад").click(); m.wait_for_load_state("networkidle")
    form = m.locator(".sheet-form")
    form.get_by_label("Учні").click(); m.get_by_role("option", name="Богдан Другий").click(); m.keyboard.press("Escape")
    form.get_by_role("button", name="Зберегти").click(); toast(m, "Склад збережено")
    check("учня додано в постановку з картки", sorted(s["id"] for s in api(mc, "GET", f"/schedules/{pA}").json()["students"]) == sorted([ann, bob]))
    m.screenshot(path=str(OUT / "sheet-people.png"))
    m.get_by_label("Закрити").click()

    # 5б. Посилання змінюється прямо в картці і лише для цього заняття
    group = sorted((s for s in wk(mc) if s["schedule_id"] == pA), key=lambda s: s["starts_at"])
    first, second = group[0], group[1]
    m.goto(BASE); m.wait_for_load_state("networkidle")
    if next_week.isocalendar()[1] != today.isocalendar()[1]:
        m.get_by_label("Наступний тиждень").click(); m.wait_for_load_state("networkidle")
    m.evaluate(f"document.querySelector('.week').scrollTop = 16 * 88")
    m.locator(".week-col").nth(0).locator(".block", has_text="Шаблон-урок").first.click(); m.wait_for_selector(".sheet")
    m.get_by_role("button", name="Змінити місце").click()
    field = m.get_by_label("Місце або посилання")
    expect(field).to_have_value("https://zoom.us/j/555 кабінет 3"); check("поле відкривається з поточним посиланням", True)
    field.fill("https://zoom.us/j/999?pwd=abc"); field.press("Enter"); toast(m, "Місце збережено")
    expect(m.locator(".facts a.text-link")).to_have_attribute("href", "https://zoom.us/j/999?pwd=abc"); check("нове посилання одразу клікабельне в картці", True)
    expect(m.locator(".facts")).to_contain_text("лише це заняття"); check("видно, що посилання лише для цього заняття", True)
    m.screenshot(path=str(OUT / "sheet-place-edit.png"))
    m.get_by_role("button", name="Змінити місце").click(); m.get_by_label("Місце або посилання").fill("щось інше"); m.get_by_label("Місце або посилання").press("Escape")
    check("Esc скасовує без збереження", "zoom.us/j/999" in m.locator(".facts").inner_text() and m.locator(".modal").count() == 1)
    m.get_by_label("Закрити").click()
    # Картка в сітці: більша година, вчитель, учні, перехід за посиланням без відкриття картки
    m.wait_for_selector(".modal", state="detached")
    blk = m.locator(".week-col").nth(0).locator(".block", has_text="Шаблон-урок").first
    hour = m.evaluate("getComputedStyle(document.querySelector('.week')).getPropertyValue('--hour').trim()")
    check("година в сітці 88 px", hour == "88px", hour)
    check("у картці видно вчителя", "Склад Вчитель" in blk.locator(".block-meta").first.inner_text())
    check("у картці видно учнів", "Аня Перша" in blk.inner_text() and "Богдан Другий" in blk.inner_text())
    lnk = blk.locator("a.block-link")
    check("іконка переходу веде на посилання цього заняття", lnk.get_attribute("href") == "https://zoom.us/j/999?pwd=abc" and lnk.get_attribute("target") == "_blank" and "noopener" in lnk.get_attribute("rel"))
    with m.context.expect_page() as popup:
        lnk.click()
    popup.value.close()
    check("клік по іконці відкриває посилання, а не картку заняття", m.locator(".modal").count() == 0)
    bb = blk.bounding_box(); check("картка на годину вміщує 4 рядки", bb["height"] >= 80, str(bb))
    blk.screenshot(path=str(OUT / "block-card.png"))
    m.screenshot(path=str(OUT / "week-big-blocks.png"))
    ap.goto(BASE); ap.wait_for_load_state("networkidle")
    if next_week.isocalendar()[1] != today.isocalendar()[1]:
        ap.get_by_label("Наступний тиждень").click(); ap.wait_for_load_state("networkidle")
    sblk = ap.locator(".block", has_text="Шаблон-урок").first
    expect(sblk).to_be_attached()
    check("учень бачить вчителя, але не склад групи", "Склад Вчитель" in sblk.inner_text() and "Богдан" not in sblk.inner_text() and sblk.locator(".block-meta").count() == 1)
    check("учень бачить іконку переходу до свого заняття", sblk.locator("a.block-link").count() >= 1)

    loc = lambda sid: api(mc, "GET", f"/sessions/{sid}").json()["location"]
    check("змінилось лише це заняття", loc(first["id"]) == "https://zoom.us/j/999?pwd=abc" and loc(second["id"]) == "https://zoom.us/j/555 кабінет 3", f"{loc(first['id'])} | {loc(second['id'])}")
    check("урок-шаблон не змінився", next(l for l in api(mc, "GET", "/lessons").json() if l["id"] == lesson["id"])["location"] == "https://zoom.us/j/555 кабінет 3")
    check("вчитель цього заняття може змінити місце", api(tc, "PATCH", f"/sessions/{second['id']}/location", data={"location": "Кабінет 7"}).ok and loc(second["id"]) == "Кабінет 7")
    check("інший вчитель не може", api(t2c, "PATCH", f"/sessions/{second['id']}/location", data={"location": "x"}).status == 403)
    check("учень не може", api(ac, "PATCH", f"/sessions/{second['id']}/location", data={"location": "x"}).status == 403)
    check("задовге значення відхилено", api(mc, "PATCH", f"/sessions/{second['id']}/location", data={"location": "x" * 201}).status == 400)
    check("порожнє значення повертає місце з уроку", api(mc, "PATCH", f"/sessions/{second['id']}/location", data={"location": ""}).ok and loc(second["id"]) == "https://zoom.us/j/555 кабінет 3")
    check("учень бачить нове посилання свого заняття", api(ac, "GET", f"/sessions/{first['id']}").json()["location"] == "https://zoom.us/j/999?pwd=abc")

    # 6. Накладки під час зміни складу
    r = api(mc, "PATCH", f"/schedules/{pB}", data={"teacher_id": teacher})
    check("вчитель без накладки призначається", r.ok, r.text()[:100])
    other = api(mc, "POST", "/lessons", data={"title": "Збіг", "duration_min": 60}).json()["id"]
    api(mc, "POST", "/schedules", data={"lesson_id": other, "kind": "weekly", "weekdays": [1], "time": "17:30", "teacher_id": teacher2})
    r = api(mc, "PATCH", f"/schedules/{pA}", data={"teacher_id": teacher2})
    check("зайнятого вчителя не призначити", r.status == 409 and "Інший Вчитель" in r.text(), r.text()[:120])
    check("після відмови склад не змінився", api(mc, "GET", f"/schedules/{pA}").json()["teacher_id"] == teacher)
    r = api(mc, "PATCH", f"/schedules/{pA}", data={"teacher_id": None})
    check("вчителя можна прибрати з постановки", r.ok and api(mc, "GET", f"/schedules/{pA}").json()["teacher_id"] is None)
    check("прибраний вчитель більше не бачить заняття", api(tc, "GET", f"/sessions/{sess['id']}").status == 404)

    # 7. Тривалість уроку змінює всі постановки, але не склад
    r = api(mc, "PATCH", f"/lessons/{lesson['id']}", data={"duration_min": 45})
    s_after = api(mc, "GET", f"/sessions/{sess['id']}").json()
    check("нова тривалість у майбутніх заняттях", r.ok and s_after["ends_at"].endswith("17:45:00"), s_after["ends_at"])
    check("зміна уроку не чіпає склад", sorted(s["id"] for s in api(mc, "GET", f"/schedules/{pA}").json()["students"]) == sorted([ann, bob]))

    # 8. Прибрати з розкладу з картки
    m.goto(BASE); m.wait_for_load_state("networkidle")
    if next_week.isocalendar()[1] != today.isocalendar()[1]:
        m.get_by_label("Наступний тиждень").click(); m.wait_for_load_state("networkidle")
    m.locator(".block", has_text="Шаблон-урок").filter(has_text="10:00").first.click(); m.wait_for_selector(".sheet")
    m.get_by_role("button", name="Прибрати з розкладу").click()
    m.locator(".modal", has_text="Прибрати").get_by_role("button", name="Прибрати").last.click(); toast(m, "Прибрано з розкладу")
    check("постановку прибрано: майбутніх занять немає", not [s for s in wk(mc) if s["schedule_id"] == pB])

    # 9. Межі доступу
    check("учень не змінює склад", api(ac, "PATCH", f"/schedules/{pA}", data={"student_ids": []}).status == 403)
    check("вчитель не змінює склад", api(tc, "PATCH", f"/schedules/{pA}", data={"student_ids": []}).status == 403)
    check("учень не бачить список постановок", api(ac, "GET", "/schedules").status == 403)
    bad = [api(mc, "PATCH", f"/schedules/{pA}", data=d).status for d in ({"teacher_id": ann}, {"teacher_id": 999999}, {"student_ids": [teacher]}, {"student_ids": "x"})]
    check("невалідний склад відхилено", all(s == 400 for s in bad), str(bad))

    # 10. Посилання: лише http(s), без виконання коду
    api(mc, "PATCH", f"/lessons/{lesson['id']}", data={"location": "javascript:alert(1) www.example.com, і текст"})
    m.goto(f"{BASE}/lessons"); m.wait_for_load_state("networkidle")
    hrefs = m.locator(".lesson-row", has_text="Шаблон-урок").locator("a").evaluate_all("as => as.map(a => a.getAttribute('href'))")
    check("javascript: не стає посиланням, www стає https без коми", hrefs == ["https://www.example.com"], str(hrefs))

    # 11. Статистика: лише менеджер, числа сходяться
    for ctx, who in ((tc, "вчитель"), (ac, "учень")):
        check(f"{who}: статистика закрита", api(ctx, "GET", "/stats").status == 403)
    anon = b.new_context(); check("аноніму статистика закрита", anon.request.get(f"{BASE}/api/stats").status == 401); anon.close()
    before = api(mc, "GET", f"/stats?from={today}&to={today}").json()
    plan = api(mc, "POST", "/plans", data={"name": "Стат", "lessons_count": 4, "price_per_lesson": 250, "valid_days": 30}).json()["id"]
    sub = api(mc, "POST", "/subscriptions", data={"student_id": ann, "plan_id": plan, "price_per_lesson": 200})
    now = dt.datetime.now(); start = max(now - dt.timedelta(hours=1), now.replace(hour=0, minute=0, second=0, microsecond=0))
    ps = api(mc, "POST", "/schedules", data={"lesson_id": other, "kind": "once", "date": str(start.date()), "time": start.strftime("%H:%M"), "student_ids": [ann, bob]}).json()
    api(mc, "POST", f"/sessions/{ps['session_id']}/complete", data={"attended_ids": [ann]})
    cs = api(mc, "POST", "/schedules", data={"lesson_id": other, "kind": "once", "date": str(start.date()), "time": "23:55" if start.hour < 23 else "23:58"}).json()
    api(mc, "POST", f"/sessions/{cs['session_id']}/cancel", data={"reason": "стат"})
    after = api(mc, "GET", f"/stats?from={today}&to={today}").json()
    check("продано: +800 ₴ і +1 абонемент", sub.ok and after["sold"]["amount"] - before["sold"]["amount"] == 800 and after["sold"]["count"] - before["sold"]["count"] == 1, str(after["sold"]))
    check("відпрацьовано: +200 ₴ за проведене", after["earned"]["amount"] - before["earned"]["amount"] == 200, str(after["earned"]))
    check("проведено +1, скасовано +1", after["sessions"]["completed"] - before["sessions"]["completed"] == 1 and after["sessions"]["cancelled"] - before["sessions"]["cancelled"] == 1, str(after["sessions"]))
    check("відвідуваність: 1 із 2 відміток", after["attendance"]["present"] - before["attendance"]["present"] == 1 and after["attendance"]["marked"] - before["attendance"]["marked"] == 2)
    check("передплачено: 3 уроки по 200 ₴ на новому абонементі", after["prepaid"]["amount"] - before["prepaid"]["amount"] == 600, str(after["prepaid"]))
    cur_month = [x for x in after["monthly"] if x["month"] == str(today)[:7]]
    check("6 місяців у динаміці, поточний останній", len(after["monthly"]) == 6 and after["monthly"][-1]["month"] == str(today)[:7] and cur_month[0]["sold"] >= 800)
    check("невалідний проміжок відхилено", api(mc, "GET", "/stats?from=2026-05-01&to=2026-01-01").status == 400 and api(mc, "GET", "/stats?from=abc").status == 400)

    # 11б. Заняття заднім числом: абонемент починається пізніше за заняття
    cara = mk("student", "Кіра Минула", "carastud")
    late_plan = api(mc, "POST", "/plans", data={"name": "starter 3.0", "lessons_count": 8, "price_per_lesson": 300, "valid_days": 60}).json()["id"]
    start_on = today + dt.timedelta(days=5)
    late_sub = api(mc, "POST", "/subscriptions", data={"student_id": cara, "plan_id": late_plan, "starts_on": str(start_on)}).json()
    old_day = today - dt.timedelta(days=3)
    back = api(mc, "POST", "/schedules", data={"lesson_id": other, "kind": "once", "date": str(old_day), "time": "08:00", "student_ids": [cara]}).json()
    opts = api(mc, "GET", f"/sessions/{back['session_id']}").json()["charge_options"][str(cara)]
    check("пропонується абонемент, що почнеться пізніше", len(opts) == 1 and opts[0]["id"] == late_sub["id"] and opts[0]["covers"] is False, str(opts))
    auto = api(mc, "POST", f"/sessions/{back['session_id']}/complete", data={"attended_ids": [cara]}).json()
    check("без вибору: попередження, як і раніше", auto.get("no_subscription") == ["Кіра Минула"], str(auto))
    api(mc, "POST", f"/sessions/{back['session_id']}/reopen", data={})
    # через UI: форма сама підставляє абонемент і пояснює
    old_week = old_day - dt.timedelta(days=old_day.weekday())
    m.goto(BASE); m.wait_for_load_state("networkidle")
    if old_week < today - dt.timedelta(days=today.weekday()):
        m.get_by_label("Попередній тиждень").click(); m.wait_for_load_state("networkidle")
    m.evaluate("document.querySelector('.week').scrollTop = 7 * 88")
    m.locator(".block", has_text="Збіг").filter(has_text="08:00").first.click(); m.wait_for_selector(".sheet")
    m.get_by_role("button", name="Провести").click()
    expect(m.locator(".attend-note")).to_contain_text("почнеться"); check("форма пояснює, що абонемент почнеться пізніше", True)
    m.screenshot(path=str(OUT / "complete-backdated.png"))
    m.locator(".sheet-form").get_by_role("button", name="Підтвердити").click(); toast(m, "Заняття проведено")
    check("помилки про відсутній абонемент немає", m.locator(".toast", has_text="Без активного").count() == 0)
    done = api(mc, "GET", f"/sessions/{back['session_id']}").json()
    used = next(s for s in api(mc, "GET", f"/subscriptions?student_id={cara}").json() if s["id"] == late_sub["id"])["lessons_used"]
    check("урок списано з абонемента за 300 ₴", done["students"][0]["price_charged"] == 300 and used == 1, str(done["students"]))
    m.get_by_label("Закрити").click()
    api(mc, "POST", f"/sessions/{back['session_id']}/reopen", data={})
    check("скасування проведення повертає урок", next(s for s in api(mc, "GET", f"/subscriptions?student_id={cara}").json() if s["id"] == late_sub["id"])["lessons_used"] == 0)
    r = api(mc, "POST", f"/sessions/{back['session_id']}/complete", data={"attended_ids": [cara], "charges": {str(cara): None}})
    check("можна провести без списання", r.ok and api(mc, "GET", f"/sessions/{back['session_id']}").json()["students"][0]["price_charged"] is None)
    api(mc, "POST", f"/sessions/{back['session_id']}/reopen", data={})
    ann_sub = next(s for s in api(mc, "GET", f"/subscriptions?student_id={ann}").json())["id"]
    bad_charges = [api(mc, "POST", f"/sessions/{back['session_id']}/complete", data={"attended_ids": [cara], "charges": c}).status
                   for c in ({str(cara): ann_sub}, {str(cara): 999999}, {str(cara): "x"}, ["x"])]
    check("чужий, неіснуючий чи битий абонемент відхилено", all(s == 400 for s in bad_charges) and api(mc, "GET", f"/sessions/{back['session_id']}").json()["status"] == "scheduled", str(bad_charges))

    # 11в. Ручне списання з абонемента без розкладу й проведення
    subs_of = lambda: next(s for s in api(mc, "GET", f"/subscriptions?student_id={cara}").json() if s["id"] == late_sub["id"])
    stats_before = api(mc, "GET", f"/stats?from={today}&to={today}").json()["earned"]
    m.goto(f"{BASE}/subscriptions"); m.wait_for_load_state("networkidle")
    srow = m.locator(".sub-row", has_text="Кіра Минула")
    srow.get_by_role("button", name="Списати").click()
    form = m.locator(".modal")
    expect(form).to_contain_text("лишилось 8 уроків"); check("форма списання показує залишок і ціну", "300" in form.inner_text())
    form.get_by_label("Уроків").fill("2"); form.get_by_label("Коментар").fill("Заняття в парку")
    expect(form.locator(".total")).to_contain_text("600"); check("форма показує суму списання", True)
    m.screenshot(path=str(OUT / "writeoff-form.png"))
    form.get_by_role("button", name="Списати").click(); toast(m, "Уроки списано")
    m.wait_for_selector(".modal", state="detached"); m.wait_for_load_state("networkidle")
    expect(m.locator(".sub-row", has_text="Кіра Минула").locator(".sub-left strong")).to_have_text("6"); check("залишок одразу оновився: 6 із 8", True)
    check("на абонементі використано 2", subs_of()["lessons_used"] == 2)
    stats_after = api(mc, "GET", f"/stats?from={today}&to={today}").json()["earned"]
    check("статистика: відпрацьовано +600 ₴ і +2 уроки", stats_after["amount"] - stats_before["amount"] == 600 and stats_after["lessons"] - stats_before["lessons"] == 2, str(stats_after))
    m.locator(".sub-row", has_text="Кіра Минула").get_by_role("button", name="Списання").click()
    item = m.locator(".charges li", has_text="Заняття в парку")
    expect(item).to_contain_text("вручну"); expect(item).to_contain_text("600"); check("ручне списання в історії", True)
    item.get_by_role("button", name="Скасувати списання").click()
    m.locator(".modal", has_text="Скасувати списання?").get_by_role("button", name="Скасувати списання").click(); toast(m, "Уроки повернуто")
    check("скасування повертає уроки", subs_of()["lessons_used"] == 0)
    m.get_by_label("Закрити").click()
    wo = api(mc, "POST", f"/subscriptions/{late_sub['id']}/writeoffs", data={"lessons": 1, "date": str(old_day)})
    check("списання заднім числом через API", wo.status == 201 and subs_of()["lessons_used"] == 1)
    hist = api(ac, "GET", f"/subscriptions/{late_sub['id']}/charges")
    check("чужий учень не бачить історію", hist.status == 403)
    kc = b.new_context(); assert kc.request.post(f"{BASE}/api/auth/login", data={"login": "carastud", "password": "staffpass1"}).ok
    own = api(kc, "GET", f"/subscriptions/{late_sub['id']}/charges").json()
    check("учениця бачить своє ручне списання", any(c["kind"] == "manual" and c["lessons"] == 1 and c["price_charged"] == 300 for c in own), str(own))
    check("учениця не скасовує списання", api(kc, "DELETE", f"/subscriptions/{late_sub['id']}/writeoffs/{next(c['writeoff_id'] for c in own if c['kind'] == 'manual')}").status == 403)
    kc.close()
    over_limit = [api(mc, "POST", f"/subscriptions/{late_sub['id']}/writeoffs", data=d).status for d in ({"lessons": 8}, {"lessons": 0}, {"lessons": "x"}, {"date": "2026-02-30"})]
    check("більше, ніж лишилось, нуль чи битий запит відхилено", all(s == 400 for s in over_limit), str(over_limit))
    check("вчитель не списує", api(tc, "POST", f"/subscriptions/{late_sub['id']}/writeoffs", data={"lessons": 1}).status == 403)
    check("учень не списує", api(ac, "POST", f"/subscriptions/{late_sub['id']}/writeoffs", data={"lessons": 1}).status == 403)
    check("неіснуюче списання не скасувати", api(mc, "DELETE", f"/subscriptions/{late_sub['id']}/writeoffs/999999").status == 404)

    for w, theme in ((1360, "light"), (390, "dark"), (320, "light")):
        c, p = new(b, w, 860, theme); login(p, "manager", "manager123")
        p.goto(f"{BASE}/stats"); p.wait_for_selector(".stat-tile")
        check(f"{w}px: статистика без прокрутки вбік", over(p) <= 0, str(over(p)))
        check(f"{w}px: 6 плиток і 6 стовпчиків", p.locator(".stat-tile").count() == 6 and p.locator(".bar").count() == 6)
        if w < 900:
            # До 360 px шість вкладок вміщуються, на 320 px панель гортається вбік (так задумано).
            fits = p.evaluate(f"""(() => {{ const n = document.querySelector('.rail-nav'), wm = document.querySelector('.wordmark');
              const scrolls = ['auto', 'scroll'].includes(getComputedStyle(n).overflowX);
              return {{ nav: n.scrollWidth <= n.clientWidth + 1 || ({w} < 360 && scrolls), word: wm.scrollWidth <= wm.clientWidth + 1 }}; }})()""")
            check(f"{w}px: статистика у верхній панелі, нижня вміщується, назва не обрізана",
                  p.get_by_role("link", name="Статистика").first.is_visible() and fits["nav"] and fits["word"], str(fits))
        p.locator(".bar-hit").last.hover()
        if w > 900:
            expect(p.locator(".bar-tip").last).to_be_visible(); check("підказка на стовпчику при наведенні", True)
        p.locator(".segmented label", has_text="Рік").click(); p.wait_for_load_state("networkidle")
        p.screenshot(path=str(OUT / f"stats-{w}-{theme}.png"), full_page=True)
        c.close()
    sc_, sp_ = new(b); login(sp_, "annstud", "staffpass1")
    check("учень не бачить пункт «Статистика»", sp_.get_by_role("link", name="Статистика").count() == 0)
    sp_.goto(f"{BASE}/stats"); sp_.wait_for_load_state("networkidle")
    check("учень не відкриває сторінку статистики", sp_.locator(".stat-tile").count() == 0)

    # 13. Кабінети вчителя й значення за замовчуванням
    m.goto(f"{BASE}/people"); m.wait_for_load_state("networkidle")
    m.locator(".segmented label", has_text="Вчителі").click()
    m.get_by_role("button", name="Новий вчитель").click()
    md = m.locator(".modal")
    md.get_by_label("Ім'я та прізвище").fill("Кабінетна Вчителька"); md.get_by_label("Логін").fill("roomteach")
    md.get_by_role("button", name="Додати кабінет").click()
    md.get_by_label("Посилання 1").fill("https://zoom.us/j/111")
    md.get_by_role("button", name="Додати кабінет").click()
    choose(m, "Сервіс кабінету 2", "Інше", md)
    md.get_by_label("Назва сервісу 2").fill("Webex"); md.get_by_label("Посилання 2").fill("https://webex.com/meet/abc")
    md.get_by_role("button", name="Зробити основним").click()
    expect(md.locator(".room.is-main")).to_contain_text("Сервіс кабінету 2")
    check("другий кабінет позначено основним", md.locator(".room.is-main").get_by_label("Назва сервісу 2").input_value() == "Webex")
    m.screenshot(path=str(OUT / "teacher-rooms.png"))
    md.get_by_role("button", name="Створити").click(); toast(m, "Акаунт створено")
    m.locator(".modal").get_by_role("button", name="Готово").click()
    rt = next(u for u in api(mc, "GET", "/users?role=teacher").json() if u["login"] == "roomteach")
    check("кабінети збережено разом із вчителем", [(r["service"], r["is_default"]) for r in rt["rooms"]] == [("Zoom", False), ("Webex", True)], str(rt["rooms"]))
    expect(m.locator(".person-row", has_text="Кабінетна Вчителька")).to_contain_text("Кабінети: Zoom, Webex"); check("кабінети видно у списку вчителів", True)
    zoom_id, webex_id = rt["rooms"][0]["id"], rt["rooms"][1]["id"]
    bad_rooms = [api(mc, "PATCH", f"/users/{rt['id']}", data={"rooms": r}).status for r in (
        [{"service": "X", "url": "javascript:alert(1)"}], [{"service": "", "url": "https://a.b"}], [{"service": "Z", "url": "https://a.b"}] * 11, "x")]
    check("небезпечне посилання, порожній сервіс, понад 10 кабінетів відхилено", all(s == 400 for s in bad_rooms), str(bad_rooms))
    check("кабінет іншому вчителю не передати", api(mc, "PATCH", f"/users/{teacher}", data={"rooms": [{"id": zoom_id, "service": "Zoom", "url": "https://x.y"}]}).status == 400)
    check("у учня кабінетів немає", api(mc, "PATCH", f"/users/{ann}", data={"rooms": []}).status == 400)

    # Урок із вчителем за замовчуванням: форма постановки підставляє вчителя й основний кабінет
    m.goto(f"{BASE}/lessons"); m.wait_for_load_state("networkidle")
    m.get_by_role("button", name="Новий урок").click()
    m.get_by_label("Назва").fill("Кабінетний урок")
    choose(m, "Вчитель за замовчуванням", "Кабінетна Вчителька")
    m.locator(".modal").get_by_role("button", name="Створити").click(); toast(m, "Урок створено")
    sf = m.locator(".modal", has_text="Додати в розклад")
    expect(sf.get_by_label("Вчитель", exact=True)).to_contain_text("Кабінетна Вчителька"); check("вчитель підставився з уроку", True)
    expect(sf.get_by_label("Кабінет", exact=True)).to_contain_text("Webex"); check("підставився основний кабінет вчителя", True)
    m.screenshot(path=str(OUT / "schedule-defaults.png"))
    sf.get_by_label("Учні").click(); m.get_by_role("option", name="Аня Перша").click(); m.keyboard.press("Escape")
    sf.locator(".weekdays button", has_text="Сб").click()
    sf.get_by_label("Час", exact=True).click(); m.locator(".timepick-col").first.get_by_role("button", name="09", exact=True).click(); m.locator(".timepick-col").nth(1).get_by_role("button", name="00", exact=True).click()
    sf.get_by_role("button", name="Додати", exact=True).click(); toast(m, "Додано в розклад")
    rlesson = next(l for l in api(mc, "GET", "/lessons").json() if l["title"] == "Кабінетний урок")
    check("урок пам'ятає вчителя за замовчуванням", rlesson["default_teacher_id"] == rt["id"] and rlesson["default_teacher_name"] == "Кабінетна Вчителька")
    rp = next(x for x in api(mc, "GET", "/schedules").json() if x["lesson_id"] == rlesson["id"])
    check("постановка з вчителем і основним кабінетом", rp["teacher_id"] == rt["id"] and rp["room_id"] == webex_id and rp["room_service"] == "Webex", str(rp))
    rsess = next(s for s in wk(mc) if s["schedule_id"] == rp["id"])
    check("посилання кабінету стало місцем заняття", rsess["location"] == "https://webex.com/meet/abc" and rsess["room_service"] == "Webex", str(rsess["location"]))

    # Вчитель змінив посилання кабінету: усі заняття бачать нове
    rooms_now = [{"id": zoom_id, "service": "Zoom", "url": "https://zoom.us/j/111"}, {"id": webex_id, "service": "Webex", "url": "https://webex.com/meet/new", "is_default": True}]
    api(mc, "PATCH", f"/users/{rt['id']}", data={"rooms": rooms_now})
    check("нове посилання кабінету одразу в занятті", api(mc, "GET", f"/sessions/{rsess['id']}").json()["location"] == "https://webex.com/meet/new")
    # Посилання окремого заняття сильніше за кабінет, а порожнє повертає кабінет
    api(mc, "PATCH", f"/sessions/{rsess['id']}/location", data={"location": "https://meet.google.com/one-off"})
    one = api(mc, "GET", f"/sessions/{rsess['id']}").json()
    check("посилання заняття сильніше за кабінет", one["location"] == "https://meet.google.com/one-off" and one["room_service"] is None)
    api(mc, "PATCH", f"/sessions/{rsess['id']}/location", data={"location": ""})
    check("очищене посилання повертає кабінет", api(mc, "GET", f"/sessions/{rsess['id']}").json()["location"] == "https://webex.com/meet/new")
    # Кабінет обирається явно, чужий відхиляється, новий вчитель приносить свій основний кабінет
    check("можна обрати інший кабінет вчителя", api(mc, "PATCH", f"/schedules/{rp['id']}", data={"room_id": zoom_id}).json()["room_id"] == zoom_id)
    check("кабінет іншого вчителя не обрати", api(mc, "PATCH", f"/schedules/{rp['id']}", data={"room_id": 999999}).status == 400)
    switched = api(mc, "PATCH", f"/schedules/{rp['id']}", data={"teacher_id": teacher2})
    check("новий вчитель без кабінетів: кабінет знято", switched.ok and switched.json()["room_id"] is None, switched.text()[:120])
    back_r = api(mc, "PATCH", f"/schedules/{rp['id']}", data={"teacher_id": rt["id"]}).json()
    check("повернення вчителя повертає його основний кабінет", back_r["room_id"] == webex_id)
    # Видалений кабінет: заняття падають назад на місце з уроку
    api(mc, "PATCH", f"/users/{rt['id']}", data={"rooms": [rooms_now[0]]})
    after_del = api(mc, "GET", f"/schedules/{rp['id']}").json()
    check("після видалення кабінету постановка без кабінету, а основним став той, що лишився", after_del["room_id"] is None and next(u for u in api(mc, "GET", "/users?role=teacher").json() if u["id"] == rt["id"])["rooms"][0]["is_default"] is True)
    check("кабінети бачить лише менеджер", api(tc, "GET", "/users").status == 403)

    # 12. Роадмап: дорога на всю ширину
    web = next(c for c in api(mc, "GET", "/courses").json() if c["title"] == "Веброзробка")
    for w, theme in ((1440, "light"), (390, "light")):
        c, p = new(b, w, 900, theme); login(p, "manager", "manager123")
        p.goto(f"{BASE}/courses/{web['id']}"); p.wait_for_selector(".road-row"); p.wait_for_timeout(500)
        page_w = p.locator(".page").bounding_box()["width"]; road_w = p.locator(".road").bounding_box()["width"]
        path_box = p.locator(".road-bed path").first.bounding_box(); text_x = p.locator(".road-text").first.bounding_box()["x"]
        check(f"{w}px: дорога на всю ширину, текст не налазить", road_w >= page_w - 100 and text_x > path_box["x"] + path_box["width"] and over(p) <= 0)
        c.close()
    b.close()

fails = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(fails)}/{len(results)} пройшло")
if fails: print("Провалені:", fails)
print("Console errors:", console[:10])
sys.exit(1 if fails or console else 0)
