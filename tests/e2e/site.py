"""Сайт школи: головна з превʼю, сторінки курсів, цін і відгуків, заявка в Telegram, керування в кабінеті, старі адреси."""
import os, json, pathlib, re, struct, tempfile, urllib.request, zlib
from playwright.sync_api import sync_playwright, expect

BASE = "http://127.0.0.1:3101"
APP = BASE + "/cabinet"  # кабінет; на / тепер сайт школи
TG = os.environ["TELEGRAM_API_BASE"]
OUT = pathlib.Path(os.environ["SHOTS"]); OUT.mkdir(parents=True, exist_ok=True)
results, console = [], []

def check(name, cond, extra=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra else ""), flush=True)

def new(b, w=1280, h=900, theme="light"):
    ctx = b.new_context(viewport={"width": w, "height": h}, locale="uk-UA", color_scheme=theme)
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

def png(path, w=320, h=200):
    """Справжній PNG без бібліотек: червоне тло з білою смугою."""
    rows = b"".join(b"\x00" + b"".join((b"\xff\xff\xff" if 80 < y < 120 else b"\xd6\x11\x2b") for _ in range(w)) for y in range(h))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    pathlib.Path(path).write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b""))

def tg_messages(clear=False):
    req = urllib.request.Request(f"{TG}/_messages", method="DELETE" if clear else "GET")
    with urllib.request.urlopen(req) as r: return json.loads(r.read())

with sync_playwright() as pw:
    b = pw.chromium.launch()

    # 1. Порожній сайт: нічого не обрано — превʼю курсів, цін і відгуків немає, але сайт працює
    gc, g = new(b, 390, 844)
    g.goto(BASE); g.wait_for_load_state("networkidle")
    check("на / — сайт, а не вхід", g.locator(".s-hero h1").is_visible() and g.get_by_label("Логін").count() == 0)
    check("без обраного превʼю приховані", g.locator(".s-course, .s-ticket, .s-review").count() == 0)
    check("без телефону кнопки «Зателефонувати» немає", g.locator("a[href^='tel:']").count() == 0)
    pub = api(gc, "GET", "/site").json()
    check("публічні дані без учнів і порожні", pub["courses"] == [] and pub["plans"] == [] and pub["reviews"] == [] and "students" not in json.dumps(pub))

    # 2. Менеджер налаштовує сайт у кабінеті
    mc, m = new(b)
    login(m, "manager", "manager123")
    check("у меню менеджера є «Сайт»", m.locator(".rail-nav a", has_text="Сайт").count() == 1)
    m.locator(".rail-nav a", has_text="Сайт").click(); m.wait_for_load_state("networkidle")
    check("кабінет на /cabinet", m.url.startswith(APP + "/site"), m.url)
    expect(m.get_by_text("Заявок ще немає")).to_be_visible()
    m.locator(".page-dock").get_by_role("radio", name="На сайті").check()
    course_box = m.locator(".showcase section").first.locator(".check").first
    course_box.click(); expect(m.locator(".toast").last).to_contain_text("Збережено")
    plan_boxes = m.locator(".showcase section").nth(1).locator(".check:not(.is-disabled)")
    plan_boxes.nth(0).click(); m.wait_for_timeout(300); plan_boxes.nth(1).click(); m.wait_for_timeout(300)
    sc = api(mc, "GET", "/site-admin/showcase").json()
    course_name = next(c["title"] for c in sc["courses"] if c["on_site"])
    check("вибір курсу й абонементів зберігся", sum(c["on_site"] for c in sc["courses"]) == 1 and sum(p["on_site"] for p in sc["plans"]) == 2)
    m.locator(".page-dock").get_by_role("radio", name="Контакти").check()
    m.get_by_label("Телефон").fill("067 123 45 67"); m.get_by_label("Telegram").fill("@be_smart_school")
    m.get_by_label("Адреса").fill("вул. Тестова, 1")
    m.get_by_role("button", name="Зберегти").click(); expect(m.locator(".toast").last).to_contain_text("Контакти збережено")
    check("телефон нормалізовано", m.get_by_label("Телефон").input_value() == "+380671234567", m.get_by_label("Телефон").input_value())
    bad = api(mc, "PUT", "/site-admin/settings", data={"email": "не пошта", "telegram": "javascript:alert(1)"})
    check("неправильні email і Telegram відхилено", bad.status == 400 and api(mc, "GET", "/site-admin/settings").json()["email"] == "")
    m.locator(".page-dock").get_by_role("radio", name="Відгуки").check()
    m.get_by_role("button", name="Новий відгук").first.click()
    d = m.get_by_role("dialog")
    d.get_by_label("Ім'я").fill("Олена Тест"); d.get_by_label("Хто це").fill("мама учня")
    d.get_by_label("Відгук").fill("Дитина з радістю йде на заняття.\nДякуємо!")
    d.get_by_role("button", name="Додати").click(); expect(m.locator(".toast").last).to_contain_text("Відгук додано")
    m.get_by_role("button", name="Новий відгук").first.click()
    d = m.get_by_role("dialog")
    d.get_by_label("Ім'я").fill("Прихований Автор"); d.get_by_label("Відгук").fill("Цей текст не має бути на сайті")
    d.locator(".check", has_text="Показувати на сайті").click()
    d.get_by_role("button", name="Додати").click(); expect(m.locator(".row", has_text="Прихований Автор")).to_contain_text("Прихований")
    check("у кабінеті обидва відгуки", m.locator(".review-row").count() == 2)
    shot(m, "site-admin-reviews")
    # Проєкти учнів: скрін завантажується з форми й зменшується в браузері
    m.locator(".page-dock").get_by_role("radio", name="Проєкти").check()
    expect(m.get_by_text("Проєктів ще немає")).to_be_visible()
    m.get_by_role("button", name="Новий проєкт").first.click()
    d = m.get_by_role("dialog")
    shot_file = os.path.join(tempfile.mkdtemp(), "shot.png"); png(shot_file, 2400, 1500)
    d.locator("input[type=file]").set_input_files(shot_file)
    expect(d.locator(".project-image-box img")).to_be_visible()
    check("скрін завантажено й показано в формі", d.locator(".project-image-box img").evaluate("i => i.complete && i.naturalWidth > 0"))
    d.get_by_label("Назва").fill("Гра «Змійка»"); d.get_by_label("Автор").fill("Іван, 12 років")
    d.get_by_label("Посилання на проєкт").fill("example.com/snake")
    d.get_by_label("Опис").fill("Класична змійка на Python і pygame.")
    d.get_by_role("button", name="Додати").click(); expect(m.locator(".toast").last).to_contain_text("Проєкт додано")
    projects = api(mc, "GET", "/site-admin/projects").json()
    check("посилання доповнено до https", projects[0]["url"] == "https://example.com/snake", projects[0]["url"])
    m.goto(f"{BASE}/api/site-admin/images/{projects[0]['image']}")
    dims = m.evaluate("[document.images[0].naturalWidth, document.images[0].naturalHeight]")
    check("великий скрін зменшено до 1600 px", dims == [1600, 1000], str(dims))
    m.goto(f"{APP}/site?tab=projects"); m.wait_for_load_state("networkidle")
    own = mc.request.post(f"{BASE}/api/site-admin/images", multipart={"image": {"name": "d.png", "mimeType": "image/png", "buffer": pathlib.Path(shot_file).read_bytes()}}).json()
    check("не картинка відхилена", mc.request.post(f"{BASE}/api/site-admin/images", multipart={"image": {"name": "x.png", "mimeType": "image/png", "buffer": b"not an image"}}).status == 400)
    hidden = api(mc, "POST", "/site-admin/projects", data={"title": "Чернетка", "is_published": False, "image": own["image"]}).json()
    check("javascript: у посиланні відхилено", api(mc, "POST", "/site-admin/projects", data={"title": "x", "url": "javascript:alert(1)"}).status == 400)
    check("чужа назва картинки відхилена", api(mc, "POST", "/site-admin/projects", data={"title": "x", "image": "../../etc/passwd"}).status == 400)
    m.reload(); m.wait_for_load_state("networkidle")
    check("у кабінеті два проєкти, один прихований", m.locator(".project-row").count() == 2 and m.locator(".project-row", has_text="Чернетка").locator(".status").count() == 1)
    shot(m, "site-admin-projects")
    check("відгуки й заявки закриті для анонімів", api(gc, "GET", "/site-admin/reviews").status == 401 and api(gc, "GET", "/site-admin/leads").status == 401)
    tc, t = new(b); login(t, "teacher", "teacher123")
    check("вчителю керування сайтом закрите", api(tc, "GET", "/site-admin/leads").status == 403 and t.locator(".rail-nav a", has_text="Сайт").count() == 0)
    tc.close()

    # 3. Сайт для відвідувача: телефон
    g.goto(BASE); g.wait_for_load_state("networkidle")
    check("тема сайту світла навіть із темною системною", g.evaluate("document.documentElement.dataset.theme") == "light")
    expect(g.locator(".s-course")).to_have_count(1)
    check("превʼю курсу з назвою", course_name in g.locator(".s-course").inner_text(), course_name)
    check("превʼю двох абонементів", g.locator(".s-ticket").count() == 2)
    check("на сайті лише опублікований відгук", g.locator(".s-review").count() == 1 and "Олена Тест" in g.locator(".s-review").inner_text() and "Прихований" not in g.content())
    expect(g.locator(".s-project")).to_have_count(1)
    check("превʼю проєкту учня без чернетки", "Змійка" in g.locator(".s-project").inner_text() and "Чернетка" not in g.content())
    g.locator(".s-project img").scroll_into_view_if_needed()
    expect(g.locator(".s-project img")).to_be_visible()
    # Картинка лінива: чекаємо, доки справді завантажиться, а не лише потрапить у вікно
    loaded = g.locator(".s-project img").evaluate("i => i.complete && i.naturalWidth > 0 || new Promise(r => { i.onload = () => r(i.naturalWidth > 0); i.onerror = () => r(false); setTimeout(() => r(false), 10000); })")
    check("скрін проєкту видно на сайті", loaded)
    check("посилання проєкту — у новій вкладці", g.locator(".s-project-link").get_attribute("target") == "_blank" and "noopener" in g.locator(".s-project-link").get_attribute("rel"))
    check("скрін прихованого проєкту відвідувачу недоступний", api(gc, "GET", f"/site/images/{hidden['image']}").status == 404 and api(gc, "GET", "/site/images/00000000-0000-0000-0000-000000000000.bin").status == 404)
    check("кнопка «Зателефонувати» з номером", g.locator(".s-hero a[href='tel:+380671234567']").count() == 1)
    check("контакти у футері", "+380 67 123 45 67" in g.locator(".s-foot").inner_text() and g.locator(".s-foot a[href='https://t.me/be_smart_school'][aria-label='Telegram']").count() == 1)
    over = g.evaluate("document.documentElement.scrollWidth - innerWidth")
    check("телефон: без прокрутки вбік", over <= 0, str(over))
    shot(g, "site-home-phone", full=True)
    # Меню: «Для учнів» веде в кабінет
    g.get_by_role("button", name="Меню").click()
    check("у меню «Для учнів» → /cabinet", g.locator("#s-menu a", has_text="Для учнів").get_attribute("href") == "/cabinet")
    g.locator("#s-menu").get_by_role("link", name="Ціни").click()
    expect(g.get_by_role("heading", name="Ціни", level=1)).to_be_visible()
    check("меню закривається після переходу", g.locator("#s-menu").count() == 0)
    check("сторінка цін: ті самі абонементи", g.locator(".s-ticket").count() == 2)
    g.goto(f"{BASE}/courses"); g.wait_for_load_state("networkidle")
    g.locator(".s-course").first.get_by_role("link", name="Детальніше").click(); g.wait_for_load_state("networkidle")
    expect(g.get_by_role("heading", name=course_name, level=1)).to_be_visible()
    check("сторінка курсу з програмою", g.locator(".s-program > li").count() >= 1)
    check("назва вкладки — курс", course_name in g.title())
    shot(g, "site-course-phone", full=True)
    g.goto(f"{BASE}/projects"); g.wait_for_load_state("networkidle")
    check("сторінка проєктів", g.locator(".s-project").count() == 1 and g.get_by_role("heading", name="Проєкти учнів", level=1).is_visible())
    g.goto(f"{BASE}/reviews"); g.wait_for_load_state("networkidle")
    check("сторінка відгуків", g.locator(".s-review").count() == 1)
    hidden_course = next(c for c in sc["courses"] if not c["on_site"])
    check("прихований курс недоступний", api(gc, "GET", f"/site/courses/{hidden_course['id']}").status == 404)
    g.goto(f"{BASE}/courses/{hidden_course['id']}"); g.wait_for_load_state("networkidle")
    expect(g.get_by_role("heading", name="Курс не знайдено")).to_be_visible(); check("сторінка прихованого курсу — не знайдено", True)
    g.goto(f"{BASE}/no-such-page"); g.wait_for_load_state("networkidle")
    expect(g.get_by_role("heading", name="Сторінку не знайдено")).to_be_visible(); check("404 на сайті", True)

    # 4. Заявка: форма, «або», «Зателефонувати», Telegram
    tg_messages(clear=True)
    g.goto(BASE); g.wait_for_load_state("networkidle")
    g.locator(".s-head").get_by_role("button", name="Записатись").click()
    d = g.get_by_role("dialog", name="Записатись")
    check("у формі ім'я, телефон і необов'язкове «Додатково»", d.get_by_label("Ім'я").is_visible() and d.get_by_label("Телефон").is_visible() and d.get_by_label("Додатково").is_visible())
    check("під формою «або» і «Зателефонувати»", d.locator(".or-line").inner_text().strip() == "або" and d.locator("a.call-btn[href='tel:+380671234567']").count() == 1)
    shot(g, "site-lead-phone")
    d.get_by_label("Ім'я").fill("Марко Петренко"); d.get_by_label("Телефон").fill("12345")
    d.get_by_role("button", name="Надіслати заявку").click()
    expect(d.locator(".form-error")).to_contain_text("номер"); check("короткий номер відхилено", True)
    d.get_by_label("Телефон").fill("(067) 765-43-21")
    d.get_by_label("Додатково").fill("Цікавить <b>Python</b> для сина")
    d.get_by_role("button", name="Надіслати заявку").click()
    expect(g.get_by_role("dialog", name="Заявку надіслано")).to_contain_text("Дякуємо, Марко!")
    msgs = tg_messages()
    check("заявка пішла в Telegram адміну", len(msgs) == 1 and msgs[0]["chat_id"] == "42", str(msgs)[:200])
    check("у повідомленні ім'я, телефон, екранований текст", msgs and "Марко Петренко" in msgs[0]["text"] and "+380677654321" in msgs[0]["text"] and "&lt;b&gt;Python&lt;/b&gt;" in msgs[0]["text"])
    g.get_by_role("button", name="Готово").click()
    # Заявка з курсу підставляє курс у «Додатково»
    g.goto(f"{BASE}/courses"); g.locator(".s-course").first.get_by_role("link", name="Детальніше").click(); g.wait_for_load_state("networkidle")
    g.get_by_role("button", name="Записатись на курс").click()
    check("заявка з курсу підставляє курс", g.get_by_role("dialog").get_by_label("Додатково").input_value() == f"Курс: {course_name}")
    g.keyboard.press("Escape")
    # Бот із заповненою пасткою: відповідь «успіх», але нічого не збережено
    r = api(gc, "POST", "/site/leads", data={"name": "Bot", "phone": "+380501112233", "website": "http://spam"})
    check("пастка для ботів", r.status == 201 and len(tg_messages()) == 1)

    # 5. Менеджер бачить заявку
    m.reload(); m.wait_for_load_state("networkidle")
    expect(m.locator(".rail-nav a", has_text="Сайт").locator(".nav-badge")).to_have_text("1")
    check("лічильник нових заявок у меню", True)
    m.locator(".page-dock").get_by_role("radio", name="Заявки").check()
    row = m.locator(".lead-row").first
    expect(row).to_contain_text("Марко Петренко")
    check("заявка в кабінеті з телефоном і текстом", row.locator("a[href='tel:+380677654321']").count() == 1 and "<b>Python</b>" in row.inner_text())
    check("бот у заявки не потрапив", m.locator(".lead-row").count() == 1)
    shot(m, "site-admin-leads")
    row.get_by_role("button", name="Опрацьовано").click()
    expect(row).to_contain_text("Опрацьовано")
    expect(m.locator(".rail-nav a", has_text="Сайт").locator(".nav-badge")).to_have_count(0); check("після опрацювання лічильник зник", True)

    # 6. Десктоп і старі адреси
    dc, dp = new(b, 1366, 860, theme="dark")
    dp.goto(BASE); dp.wait_for_load_state("networkidle")
    check("десктоп: меню в шапці, бургера немає", dp.locator(".s-nav").is_visible() and not dp.locator(".s-burger").is_visible())
    check("десктоп: «Для учнів» у шапці", dp.locator(".s-nav a[href='/cabinet']").is_visible())
    over = dp.evaluate("document.documentElement.scrollWidth - innerWidth")
    check("десктоп: без прокрутки вбік", over <= 0, str(over))
    shot(dp, "site-home-desktop", full=True)
    dp.locator(".s-nav a[href='/cabinet']").click(); dp.wait_for_load_state("networkidle")
    check("«Для учнів» відкриває вхід", dp.get_by_label("Логін").is_visible() and dp.url.rstrip("/") == APP)
    check("на вході є шлях назад на сайт", dp.locator("a.login-site[href='/']").count() == 1)
    dp.goto(f"{BASE}/homework?tab=quizzes"); dp.wait_for_load_state("networkidle")
    check("стара адреса веде в кабінет", dp.url == f"{APP}/homework?tab=quizzes", dp.url)
    dp.goto(f"{BASE}/subscription"); dp.wait_for_load_state("networkidle")
    check("стара адреса абонемента теж", dp.url == f"{APP}/subscription", dp.url)
    login(dp, "student", "student123")
    check("учень входить у кабінет на /cabinet", dp.url.startswith(APP) and dp.locator(".rail").is_visible())
    check("тема кабінету — темна з системи", dp.evaluate("document.documentElement.dataset.theme") == "dark")
    dc.close(); mc.close(); gc.close()
    b.close()

fails = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(fails)}/{len(results)} пройшло")
print("Console errors:", console)
raise SystemExit(1 if fails or console else 0)
