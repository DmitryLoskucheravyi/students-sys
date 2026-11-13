"""Вигляд курсу: іконка й колірна тема в списку, на сторінці курсу й у формі."""
import os, pathlib, sys
from playwright.sync_api import sync_playwright, expect

BASE = "http://127.0.0.1:3101"
APP = BASE + "/cabinet"  # кабінет; на / тепер сайт школи
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
    p.goto(APP); p.wait_for_load_state("networkidle")
    p.get_by_label("Логін").fill(u); p.locator("input[type=password]").fill(pw)
    p.get_by_role("button", name="Увійти").click(); p.wait_for_selector(".rail"); p.wait_for_load_state("networkidle")

def api(ctx, m, path, **kw): return ctx.request.fetch(f"{BASE}/api{path}", method=m, **kw)
def toast(p, text): expect(p.locator(".toast", has_text=text).first).to_be_visible(timeout=8000)
def overflow(p): return p.evaluate("document.documentElement.scrollWidth - window.innerWidth")
def bg(loc): return loc.evaluate("e => getComputedStyle(e).backgroundColor")

with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True)
    mc, m = new(b); login(m, "manager", "manager123")

    # 1. Новий курс із іконкою та темою
    m.goto(f"{APP}/courses"); m.wait_for_load_state("networkidle")
    m.get_by_role("button", name="Новий курс").click(); form = m.locator(".modal")
    form.get_by_label("Назва").fill("TypeScript з нуля")
    check("за замовчуванням шкільна тема й іконка роадмапу",
          form.get_by_role("radio", name="Роадмап", exact=True).get_attribute("aria-checked") == "true" and form.locator(".look-theme.is-on").inner_text().startswith("Шкільна"))
    form.get_by_role("radio", name="TypeScript", exact=True).click()
    form.locator(".look-theme", has_text="Типізована").click()
    expect(form.locator(".look-preview")).to_have_class(__import__("re").compile("ct-typed")); check("попередній перегляд одразу в новій темі", True)
    check("попередній перегляд показує назву", "TypeScript з нуля" in form.locator(".look-preview").inner_text())
    m.screenshot(path=str(OUT / "look1-form.png"))
    form.get_by_role("button", name="Створити").click(); toast(m, "Курс створено")
    card = m.locator(".course", has_text="TypeScript з нуля")
    expect(card).to_have_class(__import__("re").compile("ct-typed")); check("картка курсу в темі", True)
    check("на картці монограма TS", card.locator(".course-ico text").text_content() == "TS")
    check("плашка іконки синя", bg(card.locator(".course-ico")) == "rgb(49, 120, 198)", bg(card.locator(".course-ico")))
    check("вебкурс із демо-даних у помаранчевій темі", "ct-web" in m.locator(".course", has_text="Веброзробка").get_attribute("class"))
    m.screenshot(path=str(OUT / "look2-list.png"))

    # 2. Сторінка курсу в темі: дорога, кружки, кнопки
    web = next(c for c in api(mc, "GET", "/courses").json() if c["title"] == "Веброзробка")
    m.goto(f"{APP}/courses/{web['id']}"); m.wait_for_selector(".road-row")
    check("сторінка курсу в темі", "ct-web" in m.locator(".course-page").get_attribute("class"))
    m.get_by_label("Прогрес учня").click(); m.get_by_role("option", name="Марко Шевчук").click(); m.wait_for_timeout(300)
    done_stop = m.locator(".stop.is-done").first
    check("пройдений етап у кольорі теми", bg(done_stop) == "rgb(228, 87, 46)", bg(done_stop))
    stroke = m.locator(".road-done.is-done").first.evaluate("e => getComputedStyle(e).stroke")
    check("пройдена дорога в кольорі теми", stroke == "rgb(228, 87, 46)", stroke)
    check("заголовок з іконкою курсу", m.locator("h1 .course-ico").count() == 1)
    m.screenshot(path=str(OUT / "look3-course-web.png"))

    # 3. Зміна теми курсу, жовта тема з темним текстом
    m.get_by_role("button", name="Редагувати курс").click(); form = m.locator(".modal")
    check("форма показує збережені іконку й тему", form.get_by_role("radio", name="Веб", exact=True).get_attribute("aria-checked") == "true"
          and form.locator(".look-theme.is-on").inner_text().startswith("Вебова"))
    form.locator(".look-theme", has_text="Скриптова").click(); form.get_by_role("radio", name="JavaScript", exact=True).click()
    form.get_by_role("button", name="Зберегти").click(); toast(m, "Зміни збережено")
    expect(m.locator(".course-page")).to_have_class(__import__("re").compile("ct-script")); check("тема змінилась без перезавантаження", True)
    m.mouse.move(5, 5); m.wait_for_timeout(600)
    ink = m.locator(".stop.is-done").first.evaluate("e => getComputedStyle(e).color")
    check("на жовтому темний текст", ink == "rgb(42, 33, 0)", ink)
    m.screenshot(path=str(OUT / "look4-course-script.png"))
    api(mc, "PATCH", f"/courses/{web['id']}", data={"title": "Веброзробка", "summary": web["summary"], "icon": "web", "theme": "web"})

    # 4. Сервер перевіряє значення; старий клієнт без полів вигляду їх не скидає
    bad = [api(mc, "POST", "/courses", data={"title": "x", "theme": "neon"}).status, api(mc, "POST", "/courses", data={"title": "x", "icon": "<svg>"}).status]
    check("невідомі тема чи іконка відхилені", bad == [400, 400], str(bad))
    api(mc, "PATCH", f"/courses/{web['id']}", data={"title": "Веброзробка", "summary": web["summary"]})
    after = next(c for c in api(mc, "GET", "/courses").json() if c["id"] == web["id"])
    check("зміна без полів вигляду лишає тему", after["theme"] == "web" and after["icon"] == "web", str(after))
    tc, tp = new(b); login(tp, "teacher", "teacher123")
    check("вчитель не змінює вигляд курсу", api(tc, "PATCH", f"/courses/{web['id']}", data={"title": "x", "theme": "typed"}).status == 403)

    # 5. Учень бачить тему, темний режим, телефон
    for theme in ["light", "dark"]:
        c, p = new(b, 1360, 860, theme=theme); login(p, "student", "student123")
        p.goto(f"{APP}/courses"); p.wait_for_load_state("networkidle")
        check(f"{theme}: учень бачить курси в темах", p.locator(".course.ct-web").count() == 1 and p.locator(".course.ct-snake").count() == 1)
        p.goto(f"{APP}/courses/{web['id']}"); p.wait_for_selector(".road-row")
        p.screenshot(path=str(OUT / f"look5-student-{theme}.png"))
        c.close()
    for w in [320, 390]:
        c, p = new(b, w, 760, touch=True); login(p, "manager", "manager123")
        p.goto(f"{APP}/courses"); p.wait_for_load_state("networkidle")
        check(f"{w}px: список курсів без прокрутки вбік", overflow(p) <= 0, str(overflow(p)))
        p.get_by_role("button", name="Новий курс").click(); p.wait_for_selector(".look")
        wide = p.evaluate("(() => { const m = document.querySelector('.modal'); return m.scrollWidth - m.clientWidth; })()")
        check(f"{w}px: вибір вигляду вміщується", wide <= 0, str(wide))
        if w == 320: p.screenshot(path=str(OUT / "look6-mobile-form.png"), full_page=True)
        c.close()
    b.close()

fails = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(fails)}/{len(results)} пройшло")
if fails: print("Провалені:", fails)
print("Console errors:", console[:15])
sys.exit(1 if fails or console else 0)
