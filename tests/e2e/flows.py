"""Наскрізна перевірка: UI для основних сценаріїв, API для меж доступу."""
import datetime as dt, io, os, pathlib, sys, zipfile
from playwright.sync_api import sync_playwright, expect

BASE = "http://127.0.0.1:3101"
OUT = pathlib.Path(os.environ["SHOTS"]); OUT.mkdir(parents=True, exist_ok=True)
PNG = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63fccfc0f01f0005010201a7f3b5a80000000049454e44ae426082")
results, console = [], []

def check(name, cond, extra=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra else ""), flush=True)

def new(browser, width=1360, height=860, theme=None):
    ctx = browser.new_context(viewport={"width": width, "height": height}, locale="uk-UA", color_scheme=theme or "light")
    p = ctx.new_page()
    p.on("console", lambda m: console.append(f"{m.type}: {m.text}") if m.type == "error" and "status of 4" not in m.text else None)
    p.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
    return ctx, p

def login(p, user, pw):
    p.goto(BASE); p.wait_for_load_state("networkidle")
    p.get_by_label("Логін").fill(user)
    p.locator("input[type=password]").fill(pw)
    p.get_by_role("button", name="Увійти").click()
    p.wait_for_selector(".rail"); p.wait_for_load_state("networkidle")

def choose(p, label, option):
    p.get_by_label(label, exact=True).click()
    p.get_by_role("option", name=option).first.click()

def shot(p, name):
    p.wait_for_timeout(280)
    p.screenshot(path=str(OUT / f"{name}.png"), full_page=False)
def toast(p, text): expect(p.locator(".toast", has_text=text).first).to_be_visible(timeout=6000)

def api(ctx, method, path, **kw):
    return ctx.request.fetch(f"{BASE}/api{path}", method=method, **kw)

today = dt.date.today()
nxt = today + dt.timedelta(days=(7 - today.weekday()))  # наступний понеділок

with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True)

    # --- Вхід
    ctx, p = new(b)
    p.goto(BASE); p.wait_for_load_state("networkidle"); p.wait_for_timeout(900); shot(p, "01-login")
    p.get_by_label("Логін").fill("manager"); p.locator("input[type=password]").fill("wrongpass1")
    p.get_by_role("button", name="Увійти").click()
    expect(p.locator(".form-error")).to_contain_text("Неправильний"); check("неправильний пароль відхилено", True)
    login(p, "manager", "manager123"); check("менеджер увійшов", p.locator(".page-head h1").inner_text() == "Розклад")
    shot(p, "02-manager-schedule")

    # --- Менеджер створює людей
    p.get_by_role("link", name="Люди").click(); p.wait_for_load_state("networkidle")
    p.get_by_role("button", name="Новий учень").click()
    p.get_by_label("Ім'я та прізвище").fill("Соня Тестова"); p.get_by_label("Логін").fill("sonia")
    pwd_input = p.locator(".modal input[type=password]"); pwd_input.fill("sonia-pass-1")
    p.locator(".modal").get_by_role("button", name="Створити").click()
    expect(p.locator(".creds")).to_contain_text("sonia"); check("менеджер створив учня, показано дані входу", True)
    shot(p, "03-credentials")
    p.locator(".modal").get_by_role("button", name="Готово").click()
    p.locator(".segmented label", has_text="Вчителі").click()
    p.get_by_role("button", name="Новий вчитель").click()
    p.get_by_label("Ім'я та прізвище").fill("Петро Вчитель"); p.get_by_label("Логін").fill("petro")
    p.locator(".modal input[type=password]").fill("petro-pass-1")
    p.locator(".modal").get_by_role("button", name="Створити").click()
    expect(p.locator(".creds")).to_contain_text("petro"); check("менеджер створив вчителя", True)
    p.locator(".modal").get_by_role("button", name="Готово").click()
    shot(p, "04-people")

    # --- Абонемент: новий вид, видача зі скоригованою ціною
    p.get_by_role("link", name="Абонементи").click(); p.wait_for_load_state("networkidle")
    p.locator(".segmented label", has_text="Види").click()
    p.get_by_role("button", name="Новий абонемент").click()
    p.get_by_label("Назва").fill("Тестовий 5")
    p.get_by_label("Уроків").fill("5"); p.get_by_label("Вартість заняття").fill("500")
    p.locator(".modal").get_by_role("button", name="Створити").click(); toast(p, "Абонемент створено")
    p.wait_for_load_state("networkidle"); shot(p, "05-plans")
    p.locator(".segmented label", has_text="Видані").click()
    p.get_by_role("button", name="Видати абонемент").click(); p.wait_for_load_state("networkidle")
    choose(p, "Учень", "Соня Тестова"); choose(p, "Абонемент", "Тестовий 5")
    p.get_by_label("Вартість заняття").fill("420")
    expect(p.locator(".field-hint", has_text="до базової")).to_contain_text("−80")
    check("різниця вартості показана", True); shot(p, "06-issue")
    p.locator(".modal").get_by_role("button", name="Видати").click(); toast(p, "Абонемент видано")
    expect(p.locator(".sub-row", has_text="Соня Тестова")).to_contain_text("420"); check("абонемент видано з ціною 420", True)
    p.wait_for_timeout(300); shot(p, "07-subscriptions")

    # --- Курс і роадмап
    p.get_by_role("link", name="Курси").click(); p.wait_for_load_state("networkidle")
    p.get_by_role("button", name="Новий курс").click()
    p.get_by_label("Назва").fill("Тест-курс"); p.locator(".modal").get_by_role("button", name="Створити").click(); toast(p, "Курс створено")
    p.locator(".course", has_text="Тест-курс").click(); p.wait_for_load_state("networkidle")
    p.get_by_role("button", name="Додати етапи").click()
    for t in ["Перший", "Другий", "Третій"]:
        p.get_by_role("button", name="Додати етап").click()
        p.locator(".modal").get_by_label("Назва").fill(t)
        p.locator(".modal").get_by_role("button", name="Додати").click(); p.wait_for_selector(".modal", state="detached"); p.wait_for_load_state("networkidle")
    p.get_by_label("Нижче").first.click(); p.wait_for_load_state("networkidle"); p.wait_for_timeout(200)
    expect(p.locator(".road-editor .row h3").first).to_have_text("Другий"); check("роадмап: порядок етапів змінюється", True)
    shot(p, "08-roadmap-edit")
    p.get_by_role("button", name="Готово").click()

    # --- Урок як сутність + постійно/одноразово
    p.get_by_role("link", name="Уроки", exact=True).click(); p.wait_for_load_state("networkidle")
    shot(p, "09-lessons")
    p.get_by_role("button", name="Новий урок").click(); p.wait_for_load_state("networkidle")
    p.get_by_label("Назва").fill("Тест-урок"); choose(p, "Курс", "Тест-курс")
    check("форма уроку без вчителя й учнів", p.locator(".modal").get_by_label("Вчитель", exact=True).count() == 0 and p.locator(".modal").get_by_label("Учні").count() == 0)
    shot(p, "10-lesson-form")
    p.locator(".modal").get_by_role("button", name="Створити").click(); toast(p, "Урок створено")
    # після створення одразу відкривається постановка: тут обирають вчителя, учнів і час
    p.wait_for_selector(".modal >> text=Додати в розклад"); p.wait_for_load_state("networkidle")
    choose(p, "Вчитель", "Петро Вчитель")
    p.get_by_label("Учні").click(); p.get_by_role("option", name="Соня Тестова").click(); p.keyboard.press("Escape")
    p.locator(".weekdays button", has_text="Вт").click()
    shot(p, "11-schedule-form-weekly")
    p.locator(".modal").get_by_role("button", name="Додати", exact=True).click(); toast(p, "Додано в розклад")
    p.wait_for_selector(".modal", state="detached"); p.wait_for_load_state("networkidle")
    check("у списку уроків немає плашок розкладу", p.locator(".lesson-row", has_text="Тест-урок").locator(".slot").count() == 0)
    placements = [x for x in api(ctx, "GET", "/schedules").json() if x["title"] == "Тест-урок"]
    check("постійний урок у розкладі з вчителем і учнем", len(placements) == 1 and placements[0]["weekdays"] == [2] and placements[0]["time"] == "17:00"
          and placements[0]["teacher_name"] == "Петро Вчитель" and [s["name"] for s in placements[0]["students"]] == ["Соня Тестова"], str(placements))

    # накладка: той самий вчитель і час
    p.locator(".lesson-row", has_text="Тест-урок").get_by_role("button", name="В розклад").click(); p.wait_for_load_state("networkidle")
    choose(p, "Вчитель", "Петро Вчитель")
    p.get_by_label("Учні").click(); p.get_by_role("option", name="Соня Тестова").click(); p.keyboard.press("Escape")
    p.locator(".segmented label", has_text="Одноразово").click()
    # наступний вівторок
    tue = today + dt.timedelta(days=((1 - today.weekday()) % 7 or 7))
    p.get_by_label("Дата", exact=True).click()
    if tue.month != today.month: p.get_by_label("Наступний місяць").click()
    p.locator(f".calendar-grid button:not(.is-outside)", has_text=str(tue.day)).filter(has_text=__import__('re').compile(rf"^{tue.day}$")).click()
    shot(p, "12-schedule-form-once")
    p.locator(".modal").get_by_role("button", name="Додати", exact=True).click()
    # той самий урок виключається лише при зміні; нова подія того ж уроку конфліктує сама із собою
    toast(p, "вже веде"); check("розклад не дає поставити вчителя в накладку", True)
    p.get_by_label("Час", exact=True).click(); p.locator(".timepick-col").first.get_by_role("button", name="19", exact=True).click()
    p.locator(".timepick-col").nth(1).get_by_role("button", name="00", exact=True).click()
    p.locator(".modal").get_by_role("button", name="Додати", exact=True).click(); toast(p, "Додано в розклад")
    p.wait_for_selector(".modal", state="detached"); p.wait_for_load_state("networkidle")
    once = [x for x in api(ctx, "GET", "/schedules").json() if x["title"] == "Тест-урок" and x["kind"] == "once"]
    check("одноразовий урок у розкладі", len(once) == 1 and once[0]["time"] == "19:00", str(once))

    lessons = api(ctx, "GET", "/lessons").json()
    lesson = next(l for l in lessons if l["title"] == "Тест-урок")
    people = api(ctx, "GET", "/users").json()
    petro_id = next(u["id"] for u in people if u["login"] == "petro"); sonia_id = next(u["id"] for u in people if u["login"] == "sonia")

    # --- Сьогоднішнє заняття, яке вже почалося, щоб провести його (через API менеджера)
    # У межах сьогодні: абонемент видано сьогодні, і вчорашнє заняття він не покриває.
    now = dt.datetime.now(); start = max(now - dt.timedelta(hours=2), now.replace(hour=0, minute=0, second=0, microsecond=0))
    r = api(ctx, "POST", "/schedules", data={"lesson_id": lesson["id"], "kind": "once", "date": start.strftime("%Y-%m-%d"), "time": start.strftime("%H:%M"),
                                              "teacher_id": petro_id, "student_ids": [sonia_id]})
    check("створено заняття в минулому для тесту", r.ok, r.text()[:120])
    past_id = r.json()["session_id"]
    ctx.close()

    # --- Вчитель
    ctx, p = new(b, theme="dark"); login(p, "petro", "petro-pass-1")
    expect(p.locator(".block").first).to_be_attached(timeout=10000); check("вчитель бачить розклад", True)
    shot(p, "13-teacher-schedule-dark")
    t = ctx
    tue_sessions = api(t, "GET", f"/sessions?from={tue}&to={tue}").json()
    weekly = next(s for s in tue_sessions if s["kind"] == "weekly" and s["starts_at"].endswith("17:00:00"))
    # Скасування через UI
    if tue >= today and tue.isocalendar()[1] != today.isocalendar()[1]:
        p.get_by_label("Наступний тиждень").click(); p.wait_for_load_state("networkidle")
    p.locator(".block.is-weekly", has_text="Тест-урок").first.click(); p.wait_for_selector(".sheet")
    p.wait_for_load_state("networkidle"); shot(p, "14-session-sheet-dark")
    p.locator(".sheet-actions").get_by_role("button", name="Скасувати").click()
    p.get_by_label("Причина").fill("Хворію")
    p.get_by_role("button", name="Скасувати заняття").click(); toast(p, "Заняття скасовано")
    expect(p.locator(".sheet-when .status")).to_have_text("Скасовано"); check("вчитель скасував заняття", True)
    p.get_by_role("button", name="Повернути в план").click(); p.locator(".modal", has_text="Відновити").get_by_role("button", name="Повернути в план").click()
    toast(p, "повернуто"); expect(p.locator(".sheet-when .status")).to_have_text("Заплановано"); check("скасоване заняття можна відновити", True)
    # Перенесення через UI
    p.locator(".sheet-actions").get_by_role("button", name="Перенести").click()
    p.get_by_label("Час", exact=True).click(); p.locator(".timepick-col").first.get_by_role("button", name="20", exact=True).click()
    p.locator(".timepick-col").nth(1).get_by_role("button", name="30", exact=True).click()
    p.locator(".sheet-form").get_by_role("button", name="Перенести").click(); toast(p, "Заняття перенесено")
    p.wait_for_load_state("networkidle")
    expect(p.locator(".sheet-when")).to_contain_text("20:30"); check("вчитель переніс заняття лише цього тижня", True)
    following = api(t, "GET", f"/sessions?from={tue + dt.timedelta(days=7)}&to={tue + dt.timedelta(days=7)}").json()
    check("наступний тиждень не змінився", following and following[0]["starts_at"].endswith("17:00:00"))
    p.get_by_label("Закрити").click()

    # Проведення: списання за скоригованою ціною
    subs_before = None
    p.goto(f"{BASE}/"); p.wait_for_load_state("networkidle")
    r = api(t, "POST", f"/sessions/{past_id}/complete", data={"attended_ids": [sonia_id]})
    check("вчитель провів заняття", r.ok, r.text()[:150])
    r2 = api(t, "GET", f"/sessions/{past_id}").json()
    check("списано 420 ₴ зі скоригованого абонемента", r2["students"][0]["price_charged"] == 420, str(r2["students"]))

    # Домашнє
    p.get_by_role("link", name="Завдання").click(); p.wait_for_load_state("networkidle")
    p.get_by_role("button", name="Задати домашнє").click(); p.wait_for_load_state("networkidle")
    choose(p, "Урок", "Тест-урок"); p.get_by_label("Назва").fill("Тест ДЗ"); p.get_by_label("Завдання").fill("Здайте код і скрін")
    shot(p, "15-homework-form-dark")
    p.locator(".modal").get_by_role("button", name="Задати").click(); toast(p, "Домашнє задано")
    p.wait_for_selector(".work"); hw_url = p.url; hw_id = hw_url.rstrip("/").split("/")[-1]
    check("вчитель задав домашнє", hw_id.isdigit())
    teacher_ctx, teacher_page = ctx, p

    # --- Учень
    ctx, p = new(b); login(p, "sonia", "sonia-pass-1"); s = ctx
    p.wait_for_selector(".summary"); shot(p, "16-student-schedule")
    check("учень бачить зріз: 4 уроки лишилось", p.locator(".summary-item strong").first.inner_text() == "4", p.locator(".summary-item strong").first.inner_text())
    # Межі доступу
    check("учню заборонено список людей", api(s, "GET", "/users").status == 403)
    check("учню заборонено створювати абонемент", api(s, "POST", "/plans", data={"name": "x", "lessons_count": 1, "price_per_lesson": 1, "valid_days": 1}).status == 403)
    check("учень не може скасувати заняття напряму", api(s, "POST", f"/sessions/{weekly['id']}/cancel", data={}).status == 403)
    sess = api(s, "GET", f"/sessions/{past_id}").json()
    check("учень не бачить склад групи", "students" not in sess)
    # Запит на перенесення через UI
    if tue.isocalendar()[1] != today.isocalendar()[1]:
        p.get_by_label("Наступний тиждень").click(); p.wait_for_load_state("networkidle")
    p.locator(".block.is-weekly, .block.is-once", has_text="Тест-урок").last.click(); p.wait_for_selector(".sheet"); p.wait_for_load_state("networkidle")
    p.get_by_role("button", name="Попросити скасувати").click()
    p.get_by_label("Причина").fill("Іду до лікаря")
    p.get_by_role("button", name="Надіслати запит").click(); toast(p, "Запит надіслано")
    expect(p.locator(".note", has_text="Запит надіслано")).to_be_visible(); check("учень надіслав запит на скасування", True)
    p.get_by_label("Закрити").click()

    # Здача ДЗ: файл, ZIP, скрін
    p.goto(f"{BASE}/homework/{hw_id}"); p.wait_for_selector(".uploader")
    p.locator(".uploader input[type=file]").nth(0).set_input_files([{"name": "звіт №1.txt", "mimeType": "text/plain", "buffer": "Привіт".encode()}])
    tmp = OUT / "proj"; (tmp / "src").mkdir(parents=True, exist_ok=True); (tmp / "src/index.js").write_text("console.log(1)"); (tmp / "node_modules").mkdir(exist_ok=True); (tmp / "node_modules/x.js").write_text("skip")
    p.locator(".uploader input[webkitdirectory]").set_input_files(str(tmp))
    expect(p.locator(".queue", has_text="proj.zip")).to_be_visible(timeout=8000); check("папка запакована у ZIP у браузері", True)
    p.locator(".uploader input[accept]").set_input_files([{"name": "ekran.png", "mimeType": "image/png", "buffer": PNG}])
    p.get_by_label("Коментар").fill("Готово"); shot(p, "17-upload")
    p.get_by_role("button", name="Здати роботу").click(); toast(p, "Роботу здано")
    p.wait_for_selector(".files"); expect(p.locator(".work-head .status")).to_have_text("На перевірці"); check("учень здав файл, ZIP і скрін", True)
    p.wait_for_load_state("networkidle"); shot(p, "18-submitted")
    subm = api(s, "GET", f"/homework/{hw_id}").json()["submission"]
    kinds = sorted(f["kind"] for f in subm["files"]); check("типи файлів збережено", kinds == ["archive", "file", "screenshot"], str(kinds))
    fz = next(f for f in subm["files"] if f["kind"] == "archive"); fs = next(f for f in subm["files"] if f["kind"] == "screenshot"); ft = next(f for f in subm["files"] if f["kind"] == "file")
    check("кирилична назва файлу збереглась", ft["original_name"] == "звіт №1.txt", ft["original_name"])
    raw = api(s, "GET", f"/files/{fz['id']}?download=1")
    names = zipfile.ZipFile(io.BytesIO(raw.body())).namelist()
    check("ZIP без node_modules", any(n.endswith("src/index.js") for n in names) and not any("node_modules" in n for n in names), str(names))
    check("файл віддається як завантаження", "attachment" in raw.headers.get("content-disposition", ""))
    check("скрін показується вбудовано", "inline" in api(s, "GET", f"/files/{fs['id']}").headers.get("content-disposition", ""))
    # Підробки
    fake = api(s, "POST", f"/homework/{hw_id}/submission", multipart={"archive": {"name": "fake.zip", "mimeType": "application/zip", "buffer": b"not zip"}})
    check("підроблений ZIP відхилено", fake.status == 400, fake.text()[:80])
    fake2 = api(s, "POST", f"/homework/{hw_id}/submission", multipart={"screenshots": {"name": "x.png", "mimeType": "image/png", "buffer": b"<svg onload=alert(1)>"}})
    check("підроблений скрін відхилено", fake2.status == 400)
    exe = api(s, "POST", f"/homework/{hw_id}/submission", multipart={"files": {"name": "virus.exe", "mimeType": "application/octet-stream", "buffer": b"MZ"}})
    check("exe відхилено", exe.status == 400)
    # Роадмап і абонемент учня
    p.get_by_role("link", name="Абонемент").click(); p.wait_for_load_state("networkidle"); shot(p, "19-my-subscription")
    p.get_by_role("link", name="Курси").click(); p.wait_for_load_state("networkidle")
    student_ctx, student_page = ctx, p

    # Інший учень не бачить чужий файл
    ctx, other = new(b); login(other, "student", "student123")
    check("чужий учень не отримує файл", api(ctx, "GET", f"/files/{fz['id']}").status == 404)
    check("чужий учень не бачить ДЗ", api(ctx, "GET", f"/homework/{hw_id}").status == 403)
    p3 = other
    p3.get_by_role("link", name="Курси").click(); p3.wait_for_load_state("networkidle")
    p3.locator(".course", has_text="Веброзробка").click(); p3.wait_for_load_state("networkidle"); p3.wait_for_timeout(200); shot(p3, "20-student-roadmap")
    p3.get_by_role("link", name="Завдання").click(); p3.wait_for_load_state("networkidle"); shot(p3, "21-student-homework")
    ctx.close()

    # --- Вчитель перевіряє, повертає, потім приймає
    t, tp = teacher_ctx, teacher_page
    tp.goto(hw_url); tp.wait_for_selector(".work"); tp.wait_for_load_state("networkidle")
    tp.get_by_role("button", name="Перевірити").click(); tp.wait_for_selector(".grades")
    tp.wait_for_load_state("networkidle"); shot(tp, "22-review-dark")
    tp.get_by_role("button", name="Повернути", exact=True).click(); toast(tp, "Напишіть, що виправити"); check("повернення без коментаря відхилено", True)
    tp.get_by_label("Коментар учню").fill("Додайте адаптив")
    tp.get_by_role("button", name="Повернути", exact=True).click(); toast(tp, "Роботу повернуто"); tp.wait_for_load_state("networkidle")

    sp = student_page
    sp.goto(f"{BASE}/homework/{hw_id}"); sp.wait_for_selector(".feedback"); check("учень бачить коментар вчителя", "адаптив" in sp.locator(".feedback").inner_text())
    sp.get_by_role("button", name="Здати знову").click(); toast(sp, "Роботу здано"); check("учень здав повторно", True)

    tp.reload(); tp.wait_for_selector(".work"); tp.wait_for_load_state("networkidle")
    tp.get_by_role("button", name="Перевірити").click(); tp.wait_for_selector(".grades")
    tp.locator(".grades button", has_text="11").click(); tp.get_by_role("button", name="Прийняти").click(); toast(tp, "Роботу прийнято")
    sp.reload(); sp.wait_for_selector(".grade-big"); check("учень бачить оцінку 11", sp.locator(".grade-big").inner_text() == "11")
    shot(sp, "23-graded")

    # Запит учня бачить менеджер; вчитель схвалює
    tp.goto(BASE); tp.wait_for_selector(".requests"); check("вчитель бачить запит учня", "Соня" in tp.locator(".requests").inner_text()); shot(tp, "24-requests-dark")
    tp.locator(".request").get_by_role("button", name="Схвалити").click(); toast(tp, "Запит схвалено"); tp.wait_for_selector(".requests", state="detached")
    check("запит схвалено, панель зникла", True)

    # Скасування проведення повертає урок
    r = api(t, "POST", f"/sessions/{past_id}/reopen", data={})
    left = api(student_ctx, "GET", "/sessions/summary").json()["lessons_left"]
    check("скасування проведення повертає урок", r.ok and left == 5, str(left))

    # Прогрес роадмапу вчителем
    courses = api(t, "GET", "/courses").json(); c = next(x for x in courses if x["title"] == "Тест-курс")
    tp.goto(f"{BASE}/courses/{c['id']}"); tp.wait_for_selector(".road"); tp.locator(".stop").first.click(); tp.wait_for_load_state("networkidle"); tp.wait_for_timeout(300)
    expect(tp.locator(".stop.is-done")).to_have_count(1); check("вчитель позначив етап", True); shot(tp, "25-roadmap-teacher-dark")

    # Зміна пароля
    r = api(student_ctx, "POST", "/auth/password", data={"current": "sonia-pass-1", "next": "sonia-pass-2"}); check("учень змінив пароль", r.ok)
    # Вимкнення акаунта
    ctx, p = new(b); login(p, "manager", "manager123"); m = ctx
    uid = next(u for u in api(m, "GET", "/users").json() if u["login"] == "sonia")["id"]
    api(m, "PATCH", f"/users/{uid}", data={"is_active": False})
    check("вимкнений учень одразу втрачає сесію", api(student_ctx, "GET", "/sessions/summary").status == 401)
    check("вчитель не може створювати людей", api(t, "POST", "/users", data={"role": "student", "name": "x", "login": "xxx", "password": "12345678"}).status == 403)
    check("не можна створити ще менеджера", api(m, "POST", "/users", data={"role": "manager", "name": "x", "login": "xxx", "password": "12345678"}).status == 400)

    # --- Адаптив і темна тема менеджера
    for path, name in [("/", "26-mob-schedule"), ("/lessons", "27-mob-lessons"), ("/subscriptions", "28-mob-subs")]:
        cm, pm = new(b, 390, 800); login(pm, "manager", "manager123"); pm.goto(BASE + path); pm.wait_for_load_state("networkidle"); pm.wait_for_timeout(200)
        over = pm.evaluate("document.documentElement.scrollWidth - window.innerWidth")
        check(f"без гориз. прокрутки {path}", over <= 0, str(over)); shot(pm, name); cm.close()
    cm, pm = new(b, 390, 800); login(pm, "student", "student123"); pm.wait_for_selector(".week.is-single"); shot(pm, "29-mob-student"); print("mob over", pm.evaluate("document.documentElement.scrollWidth - window.innerWidth"))
    pm.goto(BASE + "/subscription"); pm.wait_for_load_state("networkidle"); shot(pm, "30-mob-ticket"); cm.close()
    b.close()

fails = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(fails)}/{len(results)} пройшло")
if fails: print("Провалені:", fails)
print("Console errors:", console[:15])
sys.exit(1 if fails else 0)
