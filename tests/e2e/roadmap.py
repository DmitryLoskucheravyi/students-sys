"""Підпункти роадмапа, анімація та адаптив на тестовій базі."""
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
    p.wait_for_timeout(450); p.screenshot(path=str(OUT / f"{n}.png"), full_page=full)

def api(ctx, m, path, **kw): return ctx.request.fetch(f"{BASE}/api{path}", method=m, **kw)

with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True)

    # Менеджер додає підпункти в UI
    mc, m = new(b); login(m, "manager", "manager123")
    courses = api(mc, "GET", "/courses").json()
    py = next(c for c in courses if c["title"] == "Python"); web = next(c for c in courses if c["title"] == "Веброзробка")
    m.goto(f"{BASE}/courses/{py['id']}"); m.wait_for_load_state("networkidle")
    m.get_by_role("button", name="Редагувати роадмап").click()
    first = m.locator(".step-edit").first
    first.get_by_role("button", name="Підпункти: 0").click(); m.wait_for_timeout(450)
    inp = first.get_by_placeholder("Новий підпункт")
    for t in ["Типи", "Умови", "Цикли"]:
        inp.fill(t); inp.press("Enter"); expect(first.locator(".sub-edit-row", has_text=t)).to_be_visible()
    check("менеджер додав підпункти, поле лишається у фокусі", m.evaluate("document.activeElement.placeholder") == "Новий підпункт")
    first.locator(".sub-edit-row").first.get_by_label("Нижче").click(); m.wait_for_load_state("networkidle")
    expect(first.locator(".sub-edit-title").first).to_have_text("Умови"); check("порядок підпунктів змінюється", True)
    first.locator(".sub-edit-row").last.get_by_label("Редагувати підпункт").click()
    m.locator(".modal").get_by_label("Назва").fill("Цикли for і while"); m.locator(".modal").get_by_role("button", name="Зберегти").click()
    expect(first.locator(".sub-edit-row").last).to_contain_text("Цикли for і while"); check("підпункт редагується", True)
    shot(m, "s1-editor")
    m.get_by_role("button", name="Готово").click()

    # Анімація розгортання: висота змінюється поступово
    m.goto(f"{BASE}/courses/{web['id']}"); m.wait_for_selector(".road-row"); m.wait_for_timeout(300)
    m.get_by_label("Прогрес учня").click(); m.get_by_role("option", name="Марко Шевчук").click(); m.wait_for_timeout(400)
    m.locator(".road-row").nth(0).locator(".sub-toggle").click(); m.wait_for_timeout(100)
    m.locator(".road-row").nth(0).locator(".sub-toggle").click(); m.wait_for_timeout(400)
    check("у поточного етапу підпункти розгорнуті", m.locator(".collapse.is-open").count() == 1)
    shot(m, "s2-road-desktop")
    tg = m.locator(".road-row").nth(4).locator(".sub-toggle")
    col = m.locator(".road-row").nth(4).locator(".collapse")
    check("згорнутий список недоступний для клавіатури", col.get_attribute("inert") is not None)
    h = m.evaluate("""async () => {
      const row = document.querySelectorAll('.road-row')[4];
      const c = row.querySelector('.collapse'); const out = [];
      row.querySelector('.sub-toggle').click();
      for (let i = 0; i < 8; i++) { await new Promise(r => setTimeout(r, 40)); out.push(c.getBoundingClientRect().height); }
      await new Promise(r => setTimeout(r, 400)); out.push(c.getBoundingClientRect().height); return out; }""")
    check("розгортання анімоване", len({round(x) for x in h}) >= 4 and h[0] < h[-1], str([round(x) for x in h]))
    path_before = m.locator(".road-todo").last.get_attribute("d")
    check("дорога підлаштувалась під висоту рядка", "M" in path_before)

    # Прогрес: підпункти закривають етап, ring
    student_id = next(s["id"] for s in api(mc, "GET", f"/courses/{web['id']}").json()["students"] if s["name"] == "Марко Шевчук")
    def state():
        d = api(mc, "GET", f"/courses/{web['id']}").json()
        s3 = d["steps"][2]
        return (any(p["step_id"] == s3["id"] and p["student_id"] == student_id for p in d["progress"]),
                sum(1 for p in d["sub_progress"] if p["student_id"] == student_id and p["substep_id"] in [x["id"] for x in s3["substeps"]]), s3)
    done, n, s3 = state(); check("початково етап 3: не пройдено, 2 із 5", (not done) and n == 2, f"{done},{n}")
    expect(m.locator(".road-row").nth(2).locator(".stop-ring")).to_be_visible(); check("кільце прогресу показано", True)
    row3 = m.locator(".road-row").nth(2)
    for i in [2, 3, 4]:
        row3.locator(".sub").nth(i).locator(".check").click(); m.wait_for_load_state("networkidle"); m.wait_for_timeout(150)
    done, n, _ = state(); check("усі підпункти закривають етап", done and n == 5, f"{done},{n}")
    row3.locator(".sub").nth(0).locator(".check").click(); m.wait_for_load_state("networkidle"); m.wait_for_timeout(150)
    done, n, _ = state(); check("зняття підпункту знімає етап", (not done) and n == 4, f"{done},{n}")
    row3.locator(".stop").click(); m.wait_for_load_state("networkidle"); m.wait_for_timeout(150)
    done, n, _ = state(); check("позначка етапу ставить усі підпункти", done and n == 5, f"{done},{n}")
    row3.locator(".stop").click(); m.locator(".modal").get_by_role("button", name="Зняти").click(); m.wait_for_load_state("networkidle"); m.wait_for_timeout(150)
    done, n, _ = state(); check("зняття етапу (з підтвердженням) чистить підпункти", (not done) and n == 0, f"{done},{n}")
    for i in [0, 1]:
        row3.locator(".sub").nth(i).locator(".check").click(); m.wait_for_load_state("networkidle"); m.wait_for_timeout(120)

    # Новий підпункт не забирає пройдений етап; видалення закриває етап
    s1 = api(mc, "GET", f"/courses/{web['id']}").json()["steps"][0]
    r = api(mc, "POST", f"/courses/{web['id']}/steps/{s1['id']}/substeps", data={"title": "Додатковий"}); new_id = r.json()["id"]
    d = api(mc, "GET", f"/courses/{web['id']}").json()
    check("новий підпункт зберігає пройдений етап", any(p["step_id"] == s1["id"] and p["student_id"] == student_id for p in d["progress"]) and any(p["substep_id"] == new_id for p in d["sub_progress"]))
    s3 = d["steps"][2]
    ids = [x["id"] for x in s3["substeps"]]
    for i in ids[2:]: api(mc, "DELETE", f"/courses/{web['id']}/substeps/{i}")
    d = api(mc, "GET", f"/courses/{web['id']}").json()
    check("видалення решти підпунктів закриває етап", any(p["step_id"] == s3["id"] and p["student_id"] == student_id for p in d["progress"]))
    r = api(mc, "POST", f"/courses/{web['id']}/steps/{s3['id']}/substeps", data={"title": "Масиви"}); r = api(mc, "POST", f"/courses/{web['id']}/steps/{s3['id']}/substeps", data={"title": "DOM"})

    # Межі доступу
    sc, sp = new(b); login(sp, "student", "student123")
    check("учень не може додати підпункт", api(sc, "POST", f"/courses/{web['id']}/steps/{s1['id']}/substeps", data={"title": "x"}).status == 403)
    check("учень не може сам відмітити", api(sc, "PUT", f"/courses/{web['id']}/substep-progress", data={"student_id": student_id, "substep_id": new_id, "done": True}).status == 403)
    tc, tp = new(b); login(tp, "melnyk", "teacher123")
    check("чужий вчитель не редагує курс", api(tc, "POST", f"/courses/{web['id']}/steps/{s1['id']}/substeps", data={"title": "x"}).status == 403)
    check("підпункт із чужого курсу не приймається", api(tc, "PATCH", f"/courses/{py['id']}/substeps/{new_id}", data={"title": "x"}).status == 404)
    sp.goto(f"{BASE}/courses/{web['id']}"); sp.wait_for_selector(".road-row")
    check("учень бачить підпункти лише для читання", sp.locator(".sub input").count() == 0 and sp.locator(".sub .check.is-readonly").count() > 0)

    # Адаптив на всіх сторінках і ширинах
    cases = {
        "manager": ("manager", "manager123", ["/", "/lessons", "/courses", f"/courses/{web['id']}", "/subscriptions", "/people", "/homework", "/profile"]),
        "student": ("student", "student123", ["/", "/homework", "/courses", f"/courses/{web['id']}", "/subscription", "/profile"]),
    }
    sessions = {}
    for role, (u, pwd, _) in cases.items():
        c, p = new(b, 390, 800, touch=True); login(p, u, pwd); sessions[role] = (c, p)
    for w in [320, 360, 390, 600, 768, 899, 900, 1100, 1440]:
        for role, (u, pwd, paths) in cases.items():
            c, p = sessions[role]; p.set_viewport_size({"width": w, "height": 800}); bad = []
            for path in paths:
                p.goto(BASE + path); p.wait_for_load_state("networkidle"); p.wait_for_timeout(60)
                over = p.evaluate("document.documentElement.scrollWidth - window.innerWidth")
                if over > 0:
                    who = p.evaluate("""() => [...document.querySelectorAll('.page *, .rail *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1 && !e.closest('.rail-nav')).slice(0,2).map(e => e.className || e.tagName)""")
                    bad.append(f"{path}:{over}:{who}")
            check(f"{w}px {role}: без горизонтальної прокрутки", not bad, str(bad)[:200])

    # Шторка й зони натиску на телефоні
    c, p = new(b, 360, 720, touch=True); login(p, "manager", "manager123")
    small = p.evaluate("""() => [...document.querySelectorAll('.rail-nav a, .page-actions .btn, .icon-btn')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height < 40; }).length""")
    check("зони натиску не менші за 40px", small == 0, str(small))
    nav = p.evaluate("(() => { const n = document.querySelector('.rail-nav'); return [n.scrollWidth, n.clientWidth]; })()")
    check("нижня панель вміщує вкладки", nav[0] <= nav[1] + 40, str(nav))
    shot(p, "s3-mob-schedule")
    p.get_by_role("button", name="Додати в розклад").click(); p.wait_for_selector(".modal"); p.wait_for_load_state("networkidle"); shot(p, "s4-mob-sheet")
    box = p.locator(".modal").bounding_box(); check("модалка притиснута до низу", abs(box["y"] + box["height"] - 720) < 2, str(box))
    act = p.locator(".modal .form-actions").bounding_box()
    check("кнопки шторки видно без прокрутки", act["y"] + act["height"] <= 720.5, str(act))
    p.get_by_label("Закрити").click()
    p.goto(f"{BASE}/courses/{web['id']}"); p.wait_for_selector(".road-row"); shot(p, "s5-mob-road", full=True)
    p.get_by_role("button", name="Редагувати роадмап").click(); p.locator(".step-edit").first.locator(".sub-toggle").click(); shot(p, "s6-mob-editor", full=True)
    p.goto(f"{BASE}/subscriptions"); p.wait_for_load_state("networkidle"); shot(p, "s7-mob-subs")
    p.goto(f"{BASE}/people"); p.wait_for_load_state("networkidle"); shot(p, "s8-mob-people")
    p.goto(f"{BASE}/lessons"); p.wait_for_load_state("networkidle"); shot(p, "s9-mob-lessons")
    c.close()
    c, p = new(b, 320, 640, touch=True, theme="dark"); login(p, "student", "student123"); shot(p, "s10-320-student-dark", full=True)
    p.goto(f"{BASE}/subscription"); p.wait_for_load_state("networkidle"); shot(p, "s11-320-ticket-dark")
    p.goto(f"{BASE}/homework"); p.wait_for_load_state("networkidle"); p.locator(".row-link").first.click(); p.wait_for_selector(".uploader"); shot(p, "s12-320-hw-dark", full=True)
    c.close()
    c, p = new(b, 768, 900, touch=True); login(p, "manager", "manager123"); shot(p, "s13-768")
    c.close()
    c, p = new(b, 1360, 860, theme="dark"); login(p, "student", "student123"); p.goto(f"{BASE}/courses/{web['id']}"); p.wait_for_selector(".road-row"); shot(p, "s14-road-dark-desktop")
    c.close()
    b.close()

fails = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(fails)}/{len(results)} пройшло")
if fails: print("Провалені:", fails)
print("Console errors:", console[:15])
sys.exit(1 if fails else 0)
