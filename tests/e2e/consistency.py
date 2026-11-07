"""Прочитати одразу після запису: кожен запит чекає відповіді, тож розбіжність означає справжню втрату даних."""
import datetime as dt, sys, time
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:3101"
ROUNDS = 12
results = []

def check(name, cond, extra=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra else ""), flush=True)

with sync_playwright() as pw:
    m = pw.request.new_context(base_url=BASE)
    assert m.post("/api/auth/login", data={"login": "manager", "password": "manager123"}).ok
    get = lambda path: m.get(f"/api{path}").json()
    put = lambda path, data: m.put(f"/api{path}", data=data)
    courses = get("/courses"); web = next(c for c in courses if c["title"] == "Веброзробка")
    cid = web["id"]; course = get(f"/courses/{cid}")
    student = course["students"][0]["id"]
    step = next(s for s in course["steps"] if len(s["substeps"]) >= 3)
    subs = [x["id"] for x in step["substeps"]]

    def state():
        c = get(f"/courses/{cid}")
        done = any(p["step_id"] == step["id"] and p["student_id"] == student for p in c["progress"])
        ticked = {p["substep_id"] for p in c["sub_progress"] if p["student_id"] == student} & set(subs)
        return done, len(ticked)

    # Початковий стан: усі знято
    assert put(f"/courses/{cid}/progress", {"student_id": student, "step_id": step["id"], "done": False}).ok
    spent, bad = [], []
    for round_no in range(ROUNDS):
        started = time.time()
        for i, sub in enumerate(subs):
            assert put(f"/courses/{cid}/substep-progress", {"student_id": student, "substep_id": sub, "done": True}).ok
            done, n = state()
            if n != i + 1 or done != (i + 1 == len(subs)): bad.append(("тик", round_no, i, done, n))
        assert put(f"/courses/{cid}/substep-progress", {"student_id": student, "substep_id": subs[0], "done": False}).ok
        done, n = state()
        if done or n != len(subs) - 1: bad.append(("зняти", round_no, done, n))
        assert put(f"/courses/{cid}/progress", {"student_id": student, "step_id": step["id"], "done": True}).ok
        done, n = state()
        if not done or n != len(subs): bad.append(("етап так", round_no, done, n))
        assert put(f"/courses/{cid}/progress", {"student_id": student, "step_id": step["id"], "done": False}).ok
        done, n = state()
        if done or n != 0: bad.append(("етап ні", round_no, done, n))
        spent.append(time.time() - started)
    check(f"прогрес: {ROUNDS} кіл запис і читання без розбіжностей", not bad, str(bad[:6]))

    # Порядок етапів
    ids = [s["id"] for s in get(f"/courses/{cid}")["steps"]]
    bad = []
    for _ in range(ROUNDS):
        ids = ids[1:] + ids[:1]
        assert put(f"/courses/{cid}/steps-order", {"ids": ids}).ok
        now = [s["id"] for s in get(f"/courses/{cid}")["steps"]]
        if now != ids: bad.append(now)
    check("порядок етапів читається одразу після запису", not bad, str(bad[:2]))

    # Заняття: стан і списання в одній транзакції
    t = m.post("/api/users", data={"role": "teacher", "name": "Послідовний", "login": "seqteach", "password": "seqpass123"}).json()["id"]
    s = m.post("/api/users", data={"role": "student", "name": "Послідовна", "login": "seqstud", "password": "seqpass123"}).json()["id"]
    plan = m.post("/api/plans", data={"name": "Послідовний", "lessons_count": 100, "price_per_lesson": 10, "valid_days": 30}).json()["id"]
    sub_id = m.post("/api/subscriptions", data={"student_id": s, "plan_id": plan}).json()["id"]
    lesson = m.post("/api/lessons", data={"title": "Послідовний", "teacher_id": t, "student_ids": [s], "duration_min": 10}).json()["id"]
    now = dt.datetime.now(); start = max(now - dt.timedelta(hours=1), now.replace(hour=0, minute=0, second=0, microsecond=0))
    sess = m.post("/api/schedules", data={"lesson_id": lesson, "kind": "once", "date": start.strftime("%Y-%m-%d"), "time": start.strftime("%H:%M")}).json()["session_id"]
    bad = []
    used = lambda: next(x for x in get(f"/subscriptions?student_id={s}") if x["id"] == sub_id)["lessons_used"]
    for _ in range(ROUNDS):
        assert m.post(f"/api/sessions/{sess}/complete", data={"attended_ids": [s]}).ok
        if used() != 1 or get(f"/sessions/{sess}")["status"] != "completed": bad.append("проведення")
        assert m.post(f"/api/sessions/{sess}/reopen", data={}).ok
        if used() != 0 or get(f"/sessions/{sess}")["status"] != "scheduled": bad.append("повернення")
    check("списання уроку читається одразу після запису", not bad, str(bad[:4]))
    print(f"середнє коло прогресу (9 запитів на запис і читання): {sum(spent) / len(spent):.2f} с")
    m.dispose()

fails = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(fails)}/{len(results)} пройшло")
if fails: print("Провалені:", fails)
sys.exit(1 if fails else 0)
