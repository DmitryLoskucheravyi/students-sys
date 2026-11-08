"""Домашнє до теми роадмапу, позначка запізнення, «Вийти» завершує сесію, «продано» як знімок суми."""
import os, pathlib
from datetime import datetime, timedelta
from playwright.sync_api import sync_playwright, expect

BASE = "http://127.0.0.1:3101"
OUT = pathlib.Path(os.environ["SHOTS"]); OUT.mkdir(parents=True, exist_ok=True)
results, console = [], []

def check(name, cond, extra=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra else ""), flush=True)

def new(b, w=1360, h=860):
    ctx = b.new_context(viewport={"width": w, "height": h}, locale="uk-UA")
    p = ctx.new_page()
    p.on("console", lambda m: console.append(f"{m.type}: {m.text}") if m.type == "error" and "status of 4" not in m.text else None)
    p.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
    return ctx, p

def login(p, u, pw):
    p.goto(BASE); p.wait_for_load_state("networkidle")
    p.get_by_label("Логін").fill(u); p.locator("input[type=password]").fill(pw)
    p.get_by_role("button", name="Увійти").click(); p.wait_for_selector(".rail"); p.wait_for_load_state("networkidle")

def shot(p, n):
    p.wait_for_timeout(400); p.screenshot(path=str(OUT / f"{n}.png"))

def api(ctx, m, path, **kw): return ctx.request.fetch(f"{BASE}/api{path}", method=m, **kw)

def upload(ctx, hw_id, name="work.txt"):
    return api(ctx, "POST", f"/homework/{hw_id}/submission", multipart={"files": {"name": name, "mimeType": "text/plain", "buffer": b"print(1)"}})

future = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d 20:00:00")
past = (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d 20:00:00")

with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True)
    mc, m = new(b); login(m, "manager", "manager123")
    uid = {u["login"]: u["id"] for u in api(mc, "GET", "/users").json()}
    py = next(c for c in api(mc, "GET", "/courses").json() if c["title"] == "Python")
    py_steps = api(mc, "GET", f"/courses/{py['id']}").json()["steps"]
    # Ткаченко на Python без розкладу, веде його Олена Коваль. Шевчук на Python через розклад Мельника.
    check("учня додано на курс напряму", api(mc, "POST", f"/courses/{py['id']}/students", data={"student_id": uid["tkachenko"], "teacher_id": uid["teacher"]}).ok)

    # 1. Менеджер задає домашнє до теми роадмапу через форму
    m.goto(f"{BASE}/homework"); m.wait_for_load_state("networkidle")
    m.get_by_role("button", name="Задати домашнє").click(); hm = m.locator(".modal")
    hm.get_by_role("radio", name="До теми роадмапу").check()
    check("у режимі теми немає вибору уроку", hm.get_by_role("combobox", name="Урок").count() == 0)
    hm.get_by_role("combobox", name="Курс").click(); m.get_by_role("option", name="Python").click()
    hm.get_by_label("Назва").fill("Розібрати синтаксис")
    expect(hm.locator(".topics")).to_be_visible()
    check("без теми задати не можна", hm.get_by_role("button", name="Задати").is_disabled())
    hm.locator(".topic").first.get_by_role("checkbox").check(force=True)
    shot(m, "hr1-form")
    hm.get_by_role("button", name="Задати").click()
    m.wait_for_url("**/homework/*"); m.wait_for_load_state("networkidle")
    hw_id = int(m.url.rstrip("/").split("/")[-1])
    expect(m.locator("main")).to_contain_text("Python · роадмап")
    names = [r.inner_text() for r in m.locator(".work .row h3 .who-name").all()]
    check("домашнє отримали всі учні курсу: з розкладу й напряму", sorted(names) == ["Ілля Ткаченко", "Марко Шевчук"], str(names))
    shot(m, "hr2-detail")
    check("тему обов'язково обрати", api(mc, "POST", "/homework", data={"course_id": py["id"], "title": "x", "due_at": future, "topics": []}).status == 400)

    # 2. Учень без розкладу бачить і здає
    kc, kp = new(b); login(kp, "tkachenko", "student123")
    kp.goto(f"{BASE}/homework"); kp.wait_for_load_state("networkidle")
    check("учень курсу без розкладу бачить домашнє", kp.locator(".row", has_text="Розібрати синтаксис").count() == 1)
    check("учень здає роботу", upload(kc, hw_id).ok)
    road = api(kc, "GET", f"/courses/{py['id']}").json()
    mine = [h for h in road["homework"] if h["id"] == hw_id]
    check("домашнє на роадмапі учня", mine and uid["tkachenko"] in mine[0]["student_ids"], str(mine))
    kp.goto(f"{BASE}/"); kp.wait_for_load_state("networkidle")

    # 3. Чужий учень не бачить
    bc, bp = new(b); login(bp, "boiko", "student123")
    check("учень не з курсу не відкриє домашнє", api(bc, "GET", f"/homework/{hw_id}").status == 403)
    check("і не бачить у списку", all(h["id"] != hw_id for h in api(bc, "GET", "/homework").json()))

    # 4. Вчителі бачать лише своїх учнів курсу
    tc, tp = new(b); login(tp, "teacher", "teacher123")
    t_hw = api(tc, "GET", f"/homework/{hw_id}").json()
    check("вчитель бачить лише свого учня", [s["student_name"] for s in t_hw["students"]] == ["Ілля Ткаченко"], str([s["student_name"] for s in t_hw["students"]]))
    t_row = next(h for h in api(tc, "GET", "/homework").json() if h["id"] == hw_id)
    check("у списку вчителя рахуються лише його учні", (t_row["students_count"], t_row["submitted_count"]) == (1, 1), str(t_row))
    check("вчитель не змінює домашнє менеджера", api(tc, "PATCH", f"/homework/{hw_id}", data={"title": "x", "due_at": future}).status == 403)
    tp.goto(f"{BASE}/homework/{hw_id}"); tp.wait_for_load_state("networkidle")
    check("кнопок редагування немає", tp.get_by_role("button", name="Редагувати").count() == 0)
    sub_id = t_hw["students"][0]["submission"]["id"]
    check("вчитель перевіряє роботу свого учня", api(tc, "POST", f"/homework/submissions/{sub_id}/review", data={"status": "accepted", "grade": 11}).ok)
    mel, mp = new(b); login(mp, "melnyk", "teacher123")
    m_hw = api(mel, "GET", f"/homework/{hw_id}").json()
    check("інший вчитель бачить свого учня", [s["student_name"] for s in m_hw["students"]] == ["Марко Шевчук"])
    check("і не перевіряє чужого", api(mel, "POST", f"/homework/submissions/{sub_id}/review", data={"status": "accepted"}).status == 403)
    f_id = api(mc, "GET", f"/homework/{hw_id}").json()
    f_id = next(s for s in f_id["students"] if s["submission"])["submission"]["files"][0]["id"]
    check("чужий вчитель не отримає файл", api(mel, "GET", f"/files/{f_id}").status == 404)
    check("свій вчитель отримає файл", api(tc, "GET", f"/files/{f_id}").ok)

    # 5. Домашнє, яке задав вчитель, отримують лише його учні курсу
    r = api(tc, "POST", "/homework", data={"course_id": py["id"], "title": "Від Коваль", "due_at": future, "topics": [{"step_id": py_steps[1]["id"]}]})
    check("вчитель задає домашнє до теми свого курсу", r.status == 201)
    own = r.json()["id"]
    sc, sp = new(b); login(sp, "student", "student123")
    check("учень іншого вчителя його не бачить", api(sc, "GET", f"/homework/{own}").status == 403)
    check("свій учень бачить", api(kc, "GET", f"/homework/{own}").ok)
    check("вчитель змінює своє домашнє", api(tc, "PATCH", f"/homework/{own}", data={"title": "Від Коваль 2", "due_at": future, "topics": [{"step_id": py_steps[1]["id"]}]}).ok)
    check("курс чужого вчителя недоступний", api(tc, "POST", "/homework", data={"course_id": py["id"] + 100, "title": "x", "due_at": future, "topics": [{"step_id": py_steps[0]["id"]}]}).status in (400, 403))
    summary = api(kc, "GET", "/sessions/summary").json() if api(kc, "GET", "/sessions/summary").ok else None
    if summary is not None:
        check("лічильник «треба здати» врахував домашнє до теми", summary["homework_todo"] >= 1, str(summary["homework_todo"]))

    # 6. Позначка запізнення
    late = api(mc, "POST", "/homework", data={"course_id": py["id"], "title": "Прострочене", "due_at": past, "topics": [{"step_id": py_steps[0]["id"]}]}).json()["id"]
    check("здати після дедлайну можна", upload(kc, late).ok)
    kp.goto(f"{BASE}/homework"); kp.wait_for_load_state("networkidle")
    expect(kp.locator(".row", has_text="Прострочене").locator(".late-tag")).to_be_visible()
    check("учень бачить позначку запізнення в списку", True)
    check("вчасна робота без позначки", kp.locator(".row", has_text="Розібрати синтаксис").locator(".late-tag").count() == 0)
    m.goto(f"{BASE}/homework/{late}"); m.wait_for_load_state("networkidle")
    expect(m.locator(".work .row", has_text="Ілля Ткаченко").locator(".late-tag")).to_be_visible()
    check("менеджер бачить позначку в роботах", True)
    m.goto(f"{BASE}/homework"); m.wait_for_load_state("networkidle")
    expect(m.locator(".row", has_text="Прострочене")).to_contain_text("із запізненням: 1")
    check("у списку домашніх видно кількість запізнень", True)
    shot(kp, "hr3-late")

    # 7. «Вийти» завершує сесію на сервері: скопійований cookie більше не діє
    xc, xp = new(b); login(xp, "boiko", "student123")
    stolen = xc.cookies()
    yc = b.new_context(); yc.add_cookies(stolen)
    check("копія cookie працює до виходу", api(yc, "GET", "/auth/me").json() is not None)
    check("вихід", api(xc, "POST", "/auth/logout").ok)
    check("після виходу копія cookie не діє", api(yc, "GET", "/auth/me").json() is None)
    check("і до даних не пускає", api(yc, "GET", "/homework").status == 401)
    check("інша сесія того ж учня працює далі", api(bc, "GET", "/auth/me").json()["login"] == "boiko")
    yc.close(); xc.close()

    # 8. «Продано» — сума в момент видачі
    plan = api(mc, "POST", "/plans", data={"name": "Знімок", "lessons_count": 4, "price_per_lesson": 250, "valid_days": 30}).json()["id"]
    before = api(mc, "GET", "/stats").json()["sold"]["amount"]
    sub = api(mc, "POST", "/subscriptions", data={"student_id": uid["boiko"], "plan_id": plan}).json()["id"]
    after = api(mc, "GET", "/stats").json()["sold"]["amount"]
    check("продаж додав 1000", round(after - before, 2) == 1000, f"{before} → {after}")
    check("правка ціни й уроків", api(mc, "PATCH", f"/subscriptions/{sub}", data={"price_per_lesson": 400, "lessons_total": 8}).ok)
    edited = api(mc, "GET", "/stats").json()
    check("«продано» не змінилось після правки", edited["sold"]["amount"] == after, str(edited["sold"]["amount"]))
    month = datetime.now().strftime("%Y-%m")
    check("і в розбивці за місяцями теж", next(x for x in edited["monthly"] if x["month"] == month)["sold"] >= 1000)

    b.close()

print(f"\n{sum(ok for _, ok in results)}/{len(results)} пройшло")
print("Console errors:", console)
raise SystemExit(0 if all(ok for _, ok in results) and not console else 1)
