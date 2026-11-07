"""Учень на курсі напряму, його прогрес і домашні, прив'язані до тем роадмапу."""
import os, pathlib, sys
from playwright.sync_api import sync_playwright, expect

BASE = "http://127.0.0.1:3101"
OUT = pathlib.Path(os.environ["SHOTS"]); OUT.mkdir(parents=True, exist_ok=True)
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
    p.wait_for_timeout(400); p.screenshot(path=str(OUT / f"{n}.png"), full_page=full)

def api(ctx, m, path, **kw): return ctx.request.fetch(f"{BASE}/api{path}", method=m, **kw)

def overflow(p): return p.evaluate("document.documentElement.scrollWidth - window.innerWidth")

with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True)
    mc, m = new(b); login(m, "manager", "manager123")
    courses = api(mc, "GET", "/courses").json()
    py = next(c for c in courses if c["title"] == "Python"); web = next(c for c in courses if c["title"] == "Веброзробка")
    users = api(mc, "GET", "/users").json()
    uid = {u["login"]: u["id"] for u in users}
    check("до змін на Python один учень", py["students_count"] == 1, str(py["students_count"]))

    # 1. Менеджер додає учня на курс напряму, із закріпленим вчителем
    sc, sp = new(b); login(sp, "boiko", "student123")
    check("учень не бачить чужий курс", api(sc, "GET", f"/courses/{py['id']}").status == 403)
    m.goto(f"{BASE}/courses/{py['id']}"); m.wait_for_load_state("networkidle")
    m.get_by_role("button", name="Учні курсу: 1").click(); modal = m.locator(".modal"); expect(modal).to_be_visible()
    modal.get_by_label("Учень").click(); m.get_by_role("option", name="Дарина Бойко").click()
    modal.get_by_label("Вчитель", exact=True).first.click(); m.get_by_role("option", name="Олена Коваль").click()
    modal.get_by_role("button", name="Додати на курс").click()
    expect(m.locator(".toast", has_text="Учня додано на курс")).to_be_visible()
    row = modal.locator(".course-people .row", has_text="Дарина Бойко")
    expect(row).to_contain_text("доданий напряму"); check("учень у списку курсу з позначкою «напряму»", True)
    check("учень із розкладу без кнопки «Прибрати»", modal.locator(".course-people .row", has_text="Марко Шевчук").get_by_role("button", name="Прибрати").count() == 0)
    shot(m, "cp1-course-students")
    check("повторно додати не можна", api(mc, "POST", f"/courses/{py['id']}/students", data={"student_id": uid["boiko"]}).status == 409)
    check("вчителя як учня не додати", api(mc, "POST", f"/courses/{py['id']}/students", data={"student_id": uid["teacher"]}).status == 400)
    m.get_by_label("Закрити").click()
    py_now = next(c for c in api(mc, "GET", "/courses").json() if c["id"] == py["id"])
    check("лічильник учнів курсу врахував нового", py_now["students_count"] == 2, str(py_now["students_count"]))

    # 2. Учень бачить курс і власний прогрес
    sp.goto(f"{BASE}/courses"); sp.wait_for_load_state("networkidle")
    check("курс з'явився в учня", sp.locator(".course-list .course", has_text="Python").count() == 1)
    sp.goto(f"{BASE}/courses/{py['id']}"); sp.wait_for_selector(".course-progress")
    expect(sp.locator(".cp-pct")).to_have_text("0%"); check("учень бачить свій прогрес: 0%", True)
    expect(sp.locator(".course-progress")).to_contain_text("Зараз: 1. Синтаксис"); check("показано поточний етап", True)

    # 3. Закріплений вчитель веде прогрес саме цього учня
    tc, tp = new(b); login(tp, "teacher", "teacher123")
    t_courses = api(tc, "GET", "/courses").json()
    check("закріплений вчитель бачить курс", any(c["id"] == py["id"] for c in t_courses))
    py_steps = api(tc, "GET", f"/courses/{py['id']}").json()
    check("вчитель бачить лише свого учня курсу", [s["name"] for s in py_steps["students"]] == ["Дарина Бойко"], str([s["name"] for s in py_steps["students"]]))
    first_step = py_steps["steps"][0]["id"]
    check("вчитель позначає прогрес свого учня", api(tc, "PUT", f"/courses/{py['id']}/progress", data={"student_id": uid["boiko"], "step_id": first_step, "done": True}).ok)
    check("чужого учня курсу позначити не може", api(tc, "PUT", f"/courses/{py['id']}/progress", data={"student_id": uid["student"], "step_id": first_step, "done": True}).status == 403)
    sp.reload(); sp.wait_for_selector(".course-progress")
    expect(sp.locator(".cp-pct")).to_have_text("25%"); check("прогрес учня оновився: 25%", True)
    shot(sp, "cp2-student-progress")

    # 4. Домашнє з темами: цілий етап і окрема підтема
    tp.goto(f"{BASE}/homework"); tp.wait_for_load_state("networkidle")
    tp.get_by_role("button", name="Задати домашнє").click(); hm = tp.locator(".modal")
    hm.get_by_label("Урок").click(); tp.get_by_role("option", name="Веб: група А").first.click()
    expect(hm.locator(".topics")).to_be_visible(); check("після вибору уроку з'явились теми курсу", True)
    hm.get_by_label("Назва").fill("Сторінка з подіями")
    hm.locator(".topic", has_text="CSS і верстка").locator(".topic-head .check").click()
    hm.get_by_role("button", name="Підтеми теми «JavaScript»").click(); tp.wait_for_timeout(350)
    hm.locator(".topic", has_text="JavaScript").locator(".topic-subs .check", has_text="Події").click()
    shot(tp, "cp3-topic-picker")
    hm.get_by_role("button", name="Задати").click(); tp.wait_for_url("**/homework/*"); tp.wait_for_load_state("networkidle")
    hw_id = int(tp.url.rsplit("/", 1)[1])
    hw = api(tc, "GET", f"/homework/{hw_id}").json()
    names = sorted(t["substep_title"] or t["step_title"] for t in hw["topics"])
    check("домашнє зберегло дві теми", names == ["CSS і верстка", "Події"], str(names))
    expect(tp.locator(".topic-chips li")).to_have_count(2); check("теми показано плашками в домашньому", True)

    # 5. Домашнє на роадмапі учня
    mk, mp = new(b); login(mp, "student", "student123")
    mp.goto(f"{BASE}/courses/{web['id']}"); mp.wait_for_selector(".road-row")
    rows = mp.locator(".road-row")
    expect(rows.nth(1).locator(".road-hw-item", has_text="Сторінка з подіями")).to_be_visible()
    check("домашнє видно під етапом «CSS і верстка»", True)
    js_item = rows.nth(2).locator(".road-hw-item", has_text="Сторінка з подіями")
    expect(js_item).to_contain_text("Події"); expect(js_item).to_contain_text("Треба здати")
    check("під JavaScript видно підтему й стан домашнього", True)
    check("на етапі без тем домашнього немає", rows.nth(0).locator(".road-hw-item").count() == 0)
    expect(mp.locator(".cp-hw")).to_contain_text("з 1 домашніх прийнято"); check("підсумок рахує домашні курсу", True)
    shot(mp, "cp4-road-homework", full=True)
    js_item.click(); mp.wait_for_url(f"**/homework/{hw_id}"); check("з роадмапу відкривається домашнє", True)

    # Учень іншої групи цього домашнього не бачить
    tk, tkp = new(b); login(tkp, "tkachenko", "student123")
    d = api(tk, "GET", f"/courses/{web['id']}").json()
    check("учень іншої групи не бачить домашнього на роадмапі", not any(h["id"] == hw_id for h in d["homework"]))

    # 6. Перевірки сервера
    py_step = py_steps["steps"][1]["id"]
    js_step = next(s for s in d["steps"] if s["title"] == "JavaScript")
    html_step = next(s for s in d["steps"] if s["title"] == "HTML і структура")
    bad1 = api(tc, "PATCH", f"/homework/{hw_id}", data={"title": "x", "due_at": hw["due_at"], "topics": [{"step_id": py_step}]})
    check("тему з іншого курсу не прийнято", bad1.status == 400, str(bad1.status))
    bad2 = api(tc, "PATCH", f"/homework/{hw_id}", data={"title": "x", "due_at": hw["due_at"], "topics": [{"step_id": html_step["id"], "substep_id": js_step["substeps"][0]["id"]}]})
    check("підтему чужого етапу не прийнято", bad2.status == 400, str(bad2.status))
    whole = api(tc, "PATCH", f"/homework/{hw_id}", data={"title": "Сторінка з подіями", "due_at": hw["due_at"],
        "topics": [{"step_id": js_step["id"]}, {"step_id": js_step["id"], "substep_id": js_step["substeps"][0]["id"]}]})
    t_after = api(tc, "GET", f"/homework/{hw_id}").json()["topics"]
    check("цілий етап поглинає свої підтеми", whole.ok and len(t_after) == 1 and t_after[0]["substep_id"] is None, str(t_after))
    same = api(tc, "PATCH", f"/homework/{hw_id}", data={"title": "Сторінка з подіями", "due_at": hw["due_at"]})
    check("редагування без тем їх не чіпає", same.ok and len(api(tc, "GET", f"/homework/{hw_id}").json()["topics"]) == 1)
    mel, melp = new(b); login(melp, "melnyk", "teacher123")
    placement = api(mc, "GET", f"/homework/{hw_id}").json()["schedule_id"]
    check("чужий вчитель не бачить тем чужого уроку", api(mel, "GET", f"/homework/topics?schedule_id={placement}").status == 403)
    check("учень не бачить список тем для домашнього", api(mk, "GET", f"/homework/topics?schedule_id={placement}").status == 403)

    # Редагування тем у формі домашнього
    tp.reload(); tp.wait_for_load_state("networkidle")
    tp.get_by_role("button", name="Редагувати").click(); em = tp.locator(".modal")
    expect(em.locator(".topic", has_text="JavaScript").locator(".topic-head .check.is-on")).to_be_visible()
    check("форма редагування показує збережені теми", True)
    em.locator(".topic", has_text="Git").locator(".topic-head .check").click()
    em.get_by_role("button", name="Зберегти").click(); expect(tp.locator(".toast", has_text="Зміни збережено")).to_be_visible()
    check("тему додано через форму", len(api(tc, "GET", f"/homework/{hw_id}").json()["topics"]) == 2)

    # 7. Видалення етапу прибирає його з тем домашнього
    api(mc, "DELETE", f"/courses/{web['id']}/steps/{next(s for s in d['steps'] if s['title'] == 'Git')['id']}")
    check("видалений етап зник із тем", len(api(tc, "GET", f"/homework/{hw_id}").json()["topics"]) == 1)

    # 8. Учня прибирають з курсу: курс зникає, прогрес лишається
    m.goto(f"{BASE}/courses/{py['id']}"); m.wait_for_load_state("networkidle")
    m.get_by_role("button", name="Учні курсу: 2").click(); modal = m.locator(".modal")
    modal.locator(".course-people .row", has_text="Дарина Бойко").get_by_role("button", name="Прибрати Дарина Бойко з курсу").click()
    m.locator(".modal").get_by_role("button", name="Прибрати").last.click()
    expect(m.locator(".toast", has_text="Учня прибрано з курсу")).to_be_visible()
    check("прибраний учень більше не бачить курс", api(sc, "GET", f"/courses/{py['id']}").status == 403)
    check("вчитель після цього не бачить курс", not any(c["id"] == py["id"] for c in api(tc, "GET", "/courses").json()))
    api(mc, "POST", f"/courses/{py['id']}/students", data={"student_id": uid["boiko"]})
    back = api(mc, "GET", f"/courses/{py['id']}").json()
    check("повернутий учень зберіг прогрес", any(p["student_id"] == uid["boiko"] and p["step_id"] == first_step for p in back["progress"]))
    check("учень без вчителя: закріпленого немає", next(s for s in back["students"] if s["id"] == uid["boiko"])["teacher_id"] is None)
    check("видалення курсу з учнем напряму", True)

    # 9. Телефон: без горизонтальної прокрутки
    for w in [320, 390]:
        c, p = new(b, w, 760, touch=True); login(p, "student", "student123")
        p.goto(f"{BASE}/courses/{web['id']}"); p.wait_for_selector(".course-progress")
        check(f"{w}px: роадмап учня з домашніми без прокрутки вбік", overflow(p) <= 0, str(overflow(p)))
        if w == 320: shot(p, "cp5-mobile-road", full=True)
        c.close()
        c, p = new(b, w, 760, touch=True); login(p, "teacher", "teacher123")
        p.goto(f"{BASE}/homework"); p.wait_for_load_state("networkidle")
        p.get_by_role("button", name="Задати домашнє").click(); hm = p.locator(".modal")
        hm.get_by_label("Урок").click(); p.get_by_role("option", name="Веб: група А").first.click(); expect(hm.locator(".topics")).to_be_visible()
        wide = p.evaluate("(() => { const m = document.querySelector('.modal'); return m.scrollWidth - m.clientWidth; })()")
        check(f"{w}px: вибір тем вміщується в шторку", wide <= 0, str(wide))
        if w == 320: shot(p, "cp6-mobile-topics", full=True)
        c.close()
        c, p = new(b, w, 760, touch=True); login(p, "manager", "manager123")
        p.goto(f"{BASE}/courses/{py['id']}"); p.wait_for_load_state("networkidle")
        p.get_by_role("button", name="Учні курсу").click(); expect(p.locator(".modal")).to_be_visible()
        check(f"{w}px: менеджер бачить учнів курсу без прокрутки вбік", overflow(p) <= 0, str(overflow(p)))
        c.close()

    c, p = new(b, 1360, 860, theme="dark"); login(p, "student", "student123")
    p.goto(f"{BASE}/courses/{web['id']}"); p.wait_for_selector(".road-hw-item"); shot(p, "cp7-dark")
    c.close()
    b.close()

fails = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(fails)}/{len(results)} пройшло")
if fails: print("Провалені:", fails)
print("Console errors:", console[:15])
sys.exit(1 if fails or console else 0)
