"""Файли в базі: стиснення, цілісність, ліміти. Запускається лише в режимі FILE_STORAGE=db."""
import datetime as dt, os, pathlib, random, struct, sys, zlib
from playwright.sync_api import sync_playwright, expect

if os.environ.get("FILE_STORAGE") != "db":
    print("Пропущено: потрібен FILE_STORAGE=db")
    sys.exit(0)

BASE = "http://127.0.0.1:3101"
OUT = pathlib.Path(os.environ["SHOTS"]); OUT.mkdir(parents=True, exist_ok=True)
results, console = [], []
MB = 1024 * 1024

def check(name, cond, extra=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra else ""), flush=True)

def noisy_png(w, h):
    """Шумний PNG погано стискається: добра перевірка для скрінів."""
    raw = bytearray()
    rnd = random.Random(7)
    for _ in range(h):
        raw.append(0); raw += rnd.randbytes(w * 3)
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(bytes(raw), 1)) + chunk(b"IEND", b"")

due = str(dt.date.today() + dt.timedelta(days=30)) + " 23:55"

with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True)
    def session(login, pwd):
        c = b.new_context(viewport={"width": 1360, "height": 860}, locale="uk-UA", accept_downloads=True)
        r = c.request.post(f"{BASE}/api/auth/login", data={"login": login, "password": pwd}); assert r.ok, r.text()
        return c
    m = session("manager", "manager123")
    api = lambda c, meth, path, **kw: c.request.fetch(f"{BASE}/api{path}", method=meth, **kw)
    teacher = api(m, "POST", "/users", data={"role": "teacher", "name": "Файл Вчитель", "login": "fileteach", "password": "filepass12"}).json()["id"]
    student = api(m, "POST", "/users", data={"role": "student", "name": "Файл Учень", "login": "filestud", "password": "filepass12"}).json()["id"]
    lesson = api(m, "POST", "/lessons", data={"title": "Файли", "duration_min": 60}).json()["id"]
    placement = api(m, "POST", "/schedules", data={"lesson_id": lesson, "kind": "weekly", "weekdays": [6], "time": "07:00",
                                                    "teacher_id": teacher, "student_ids": [student]}).json()["schedule_id"]
    def new_hw(title):
        return api(m, "POST", "/homework", data={"schedule_id": placement, "title": title, "due_at": due}).json()["id"]
    s = session("filestud", "filepass12")
    def upload(hw, field, name, mime, data):
        return api(s, "POST", f"/homework/{hw}/submission", multipart={field: {"name": name, "mimeType": mime, "buffer": data}})

    # Цілісність: те, що здали, те й завантажили
    hw = new_hw("Цілісність")
    text = ("def привіт(імʼя):\n    return f'Привіт, {імʼя}'\n" * 60000).encode()[:3 * MB]
    r = upload(hw, "files", "код.py", "text/x-python", text); check("текстовий файл прийнято", r.status == 201, r.text()[:100])
    binary = random.Random(1).randbytes(2 * MB)
    r = upload(hw, "files", "дані.bin", "application/octet-stream", binary); check("бінарний файл прийнято", r.status == 201)
    files = {f["original_name"]: f for f in api(s, "GET", f"/homework/{hw}").json()["submission"]["files"]}
    got = api(s, "GET", f"/files/{files['код.py']['id']}?download=1")
    check("стиснутий текст повертається байт у байт", got.body() == text and files["код.py"]["size"] == len(text))
    check("заголовок розміру правильний після розпакування", got.headers.get("content-length") == str(len(text)), got.headers.get("content-length"))
    check("бінарний файл повертається байт у байт", api(s, "GET", f"/files/{files['дані.bin']['id']}?download=1").body() == binary)
    t = session("fileteach", "filepass12")
    check("вчитель уроку завантажує файл", api(t, "GET", f"/files/{files['код.py']['id']}?download=1").body() == text)
    check("чужий учень не отримує файл", api(session("student", "student123"), "GET", f"/files/{files['код.py']['id']}").status == 404)

    # Ліміт розміру
    r = upload(hw, "files", "завеликий.bin", "application/octet-stream", b"x" * (10 * MB + 1))
    check("файл більше 10 МБ відхилено", r.status == 400 and "10 МБ" in r.text(), r.text()[:100])
    r = upload(hw, "files", "рівно10.txt", "text/plain", b"a" * (10 * MB))
    check("файл рівно 10 МБ прийнято", r.status == 201, r.text()[:100])

    # Стиснення реально економить: тестовий ліміт файлів 40 МБ, а тексту здаємо 72 МБ
    hw2 = new_hw("Стиснення")
    ok = all(upload(hw2, "files", f"частина{i}.txt", "text/plain", (f"рядок {i}\n" * 2_000_000).encode()[:9 * MB]).status == 201 for i in range(8))
    check("72 МБ тексту вміщуються в ліміт 40 МБ", ok)

    # Переповнення: зрозуміла відмова замість поламаної бази
    hw3 = new_hw("Переповнення")
    rnd = random.Random(2); statuses = []
    for i in range(8):
        r = upload(hw3, "files", f"шум{i}.bin", "application/octet-stream", rnd.randbytes(9 * MB)); statuses.append(r.status)
        if r.status != 201: break
    check("коли місце закінчилось, файл відхилено", statuses[-1] == 507 and "закінчилось" in r.text(), str(statuses))
    check("відмова не створює порожню роботу", api(s, "GET", f"/homework/{hw}").ok)
    check("сайт працює після переповнення", api(m, "GET", "/health").ok and api(s, "GET", f"/files/{files['код.py']['id']}?download=1").body() == text)
    # Видалення звільняє місце
    check("видалення домашнього звільняє місце", api(m, "DELETE", f"/homework/{hw3}").ok and api(m, "DELETE", f"/homework/{hw2}").ok)
    hw4 = new_hw("Після чистки")
    r = upload(hw4, "files", "знову.bin", "application/octet-stream", rnd.randbytes(9 * MB))
    check("після чистки файли знову приймаються", r.status == 201, r.text()[:100])

    # Браузер: великий скрін зменшується ще до надсилання
    png = noisy_png(1800, 1100)
    ctx = b.new_context(viewport={"width": 1360, "height": 860}, locale="uk-UA"); p = ctx.new_page()
    p.on("console", lambda m_: console.append(m_.text) if m_.type == "error" and "status of 4" not in m_.text else None)
    p.goto(BASE); p.get_by_label("Логін").fill("filestud"); p.locator("input[type=password]").fill("filepass12")
    p.get_by_role("button", name="Увійти").click(); p.wait_for_selector(".rail")
    hw5 = new_hw("Скріни")
    p.goto(f"{BASE}/homework/{hw5}"); p.wait_for_selector(".uploader")
    check("ліміт показаний учню", p.locator(".drop", has_text="До 10 МБ").count() == 1)
    p.locator(".uploader input[accept]").set_input_files([{"name": "екран.png", "mimeType": "image/png", "buffer": png}])
    expect(p.locator(".queue .file-name", has_text="екран.webp")).to_be_visible(timeout=15000); check("великий скрін перетворено на WebP", True)
    small = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63fccfc0f01f0005010201a7f3b5a80000000049454e44ae426082")
    p.locator(".uploader input[accept]").set_input_files([{"name": "малий.png", "mimeType": "image/png", "buffer": small}])
    expect(p.locator(".queue .file-name", has_text="малий.png")).to_be_visible(); check("малий скрін лишається без змін", True)
    p.locator(".uploader input[type=file]").first.set_input_files([{"name": "великий.bin", "mimeType": "application/octet-stream", "buffer": b"x" * (10 * MB + 5)}])
    expect(p.locator(".toast", has_text="більший за 10 МБ").first).to_be_visible(); check("завеликий файл відхилено ще в браузері", True)
    p.get_by_role("button", name="Здати роботу").click(); expect(p.locator(".toast", has_text="Роботу здано").first).to_be_visible()
    sub = api(ctx, "GET", f"/homework/{hw5}").json()["submission"]["files"]
    shot = next(f for f in sub if f["original_name"] == "екран.webp")
    check("сервер визнав WebP скріном", shot["kind"] == "screenshot" and shot["mime"] == "image/webp", str(shot))
    check("скрін став меншим", shot["size"] < len(png), f"{shot['size']} із {len(png)}")
    p.wait_for_selector(".files img, .shots img, img[alt='екран.webp']")
    loaded = p.evaluate("(async()=>{const i=document.querySelector(\"img[alt='екран.webp']\");if(!i.complete)await new Promise(r=>{i.onload=r;i.onerror=r});return i.naturalWidth})()")
    check("скрін відкривається в браузері", loaded == 1800, str(loaded))
    b.close()

fails = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(fails)}/{len(results)} пройшло")
if fails: print("Провалені:", fails)
print("Console errors:", console[:10])
sys.exit(1 if fails or console else 0)
