"""ШІ-режим роадмапа, новий логотип, заставка входу і бренд."""
import io, os, pathlib, sys
from PIL import Image
from playwright.sync_api import sync_playwright, expect

BASE = "http://127.0.0.1:3101"
APP = BASE + "/cabinet"  # кабінет; на / тепер сайт школи
OUT = pathlib.Path(os.environ["SHOTS"]); OUT.mkdir(parents=True, exist_ok=True)
results, console = [], []

def check(name, cond, extra=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra else ""), flush=True)

def new(b, w=1360, h=860, touch=False, motion="no-preference"):
    ctx = b.new_context(viewport={"width": w, "height": h}, locale="uk-UA", has_touch=touch, is_mobile=touch, reduced_motion=motion)
    p = ctx.new_page()
    p.on("console", lambda m: console.append(m.text) if m.type == "error" and "status of 4" not in m.text and "status of 5" not in m.text else None)
    p.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
    return ctx, p

def login(p, u, pw):
    p.goto(APP); p.wait_for_load_state("networkidle")
    p.get_by_label("Логін").fill(u); p.locator("input[type=password]").fill(pw)
    p.get_by_role("button", name="Увійти").click(); p.wait_for_selector(".rail"); p.wait_for_load_state("networkidle")

def api(ctx, m, path, **kw): return ctx.request.fetch(f"{BASE}/api{path}", method=m, **kw)
def toast(p, text): expect(p.locator(".toast", has_text=text).first).to_be_visible(timeout=8000)
def over(p): return p.evaluate("document.documentElement.scrollWidth - window.innerWidth")

with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True, args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])

    # --- Заставка входу: кроки анімації лого, книга, цифри
    c, p = new(b)
    p.goto(APP, wait_until="commit"); p.wait_for_selector(".bs-logo")
    # Кабінет вантажиться окремим шматком, і поки браузер зайнятий, таймер тесту відстає від анімації.
    # Тож не чекаємо, а ставимо всі анімації лого в одну мить від їхнього старту.
    seek = lambda t: p.evaluate("t => document.getAnimations().filter(a => a.effect?.target?.closest?.('.bs-logo')).forEach(a => { a.pause(); a.currentTime = t; })", t)
    seek(350)
    tail_early = p.locator(".bs-tail").first.bounding_box()["width"]
    school_y = p.evaluate("new DOMMatrix(getComputedStyle(document.querySelector('.bs-under > span')).transform).m42")
    visible = p.evaluate("[...document.querySelectorAll('.bs-tail > span')].map(s => s.getBoundingClientRect().width)")
    check("спершу видно лише BS: хвости букв згорнуті", tail_early < 1, str(tail_early))
    check("у згорнутому стані немає смужок від прихованих букв", all(v < 1 for v in visible), str(visible))
    p.locator(".bs-logo").screenshot(path=str(OUT / "logo-start.png"))
    check("School спершу схований під Smart", school_y < -10, str(school_y))
    seek(1050)
    tail_mid = p.locator(".bs-tail").first.bounding_box()["width"]
    check("букви виїжджають убік", tail_mid > tail_early + 10, str(tail_mid))
    seek(4000)
    school_after = p.evaluate("new DOMMatrix(getComputedStyle(document.querySelector('.bs-under > span')).transform).m42")
    check("School виїхав на своє місце", abs(school_after) < 1, str(school_after))
    smart = p.locator(".bs-stack .bs-word").bounding_box(); school = p.locator(".bs-under").bounding_box()
    be = p.locator(".bs-be-in").bounding_box(); stack = p.locator(".bs-stack").bounding_box()
    check("BE стоїть вертикально на висоту Smart і School", be["height"] > be["width"] * 1.5 and abs(be["y"] + be["height"] - stack["y"] - stack["height"]) < stack["height"] * 0.08
          and be["x"] + be["width"] < stack["x"], f"{be} {stack}")
    check("BE написано великими", p.locator(".bs-be").text_content().strip() == "BE")
    p.locator(".login-art").screenshot(path=str(OUT / "logo-final.png"))
    check("School стоїть точно під Smart", abs(smart["x"] - school["x"]) < 1 and school["y"] >= smart["y"] + smart["height"] - 1, f"{smart} {school}")
    # Тривимірна книга: фази за часом, потім перемотування в конкретні миті
    for _ in range(60):
        if p.evaluate("!!document.querySelector('.book3d canvas')"): break
        p.wait_for_timeout(100)
    check("книга малюється в WebGL", p.locator(".book3d canvas").count() == 1 or "open" in (p.get_attribute(".book3d", "data-seen") or ""))
    for _ in range(120):
        if p.get_attribute(".book3d", "data-phase") == "gone": break
        p.wait_for_timeout(100)
    seen = (p.get_attribute(".book3d", "data-seen") or "").split(",")
    check("книга вилітає закритою, розгортається, згортається й вилітає", seen[:2] == ["wait", "closed"] and "open" in seen and "closing" in seen and seen[-1] == "gone", str(seen))
    check("після вильоту сцену прибрано", p.locator(".book3d canvas").count() == 0)
    bits = p.locator(".bits span").all_text_contents()
    check("цифри у фоні окремі: по одній", len(bits) >= 3 and all(x in ("0", "1") for x in bits), str(bits))
    moves = p.evaluate("[...document.querySelectorAll('.bits span')].map(s => s.style.getPropertyValue('--dx'))")
    # Зсуви випадкові: збіг двох можливий, тож перевіряємо, що цифри не рухаються однаково
    check("кожна цифра пливе у свій бік", len(moves) < 2 or len(set(moves)) > 1, str(moves))
    ys = p.evaluate("[...document.querySelectorAll('.bits span')].map(s => new DOMMatrix(getComputedStyle(s).transform).m42)")
    check("цифри рухаються лише по горизонталі", all(abs(y) < 0.01 for y in ys), str(ys))
    c.close()
    c, p = new(b); p.goto(APP); p.wait_for_selector(".bs-logo")
    for _ in range(60):
        if p.evaluate("!!document.querySelector('.book3d')?.bookSeek"): break
        p.wait_for_timeout(100)
    def light_in(top_part):
        art = p.locator(".login-art").bounding_box()
        img = Image.open(io.BytesIO(p.screenshot(clip={"x": art["x"], "y": art["y"], "width": art["width"], "height": art["height"] * top_part}))).convert("RGB")
        return sum(1 for px in img.getdata() if px[0] > 225 and px[1] > 205 and px[2] > 190)
    p.evaluate("document.querySelector('.bs-logo').style.visibility = 'hidden'")
    p.evaluate("document.querySelector('.book3d').bookSeek(0.5)")
    check("посередині книга розгорнута й видна", p.get_attribute(".book3d", "data-phase") == "open" and light_in(0.7) > 3000, str(light_in(0.7)))
    p.locator(".login-art").screenshot(path=str(OUT / "book-open.png"))
    p.evaluate("document.querySelector('.book3d').bookSeek(0.2)")
    check("на початку книга ще закрита або розгортається", p.get_attribute(".book3d", "data-phase") in ("closed", "turning"))
    p.evaluate("document.querySelector('.book3d').bookSeek(0.999)")
    check("наприкінці книги в кадрі вже немає", light_in(1) < 200, str(light_in(1)))
    p.evaluate("document.querySelector('.bs-logo').style.visibility = ''")
    check("літачка більше немає", p.locator(".plane").count() == 0)
    check("галочки більше немає", p.locator(".login-tick").count() == 0)
    check("назва вкладки", p.title() == "Be Smart School")
    check("старої назви немає на екрані входу", "Зошит" not in p.locator("body").inner_text())
    check("логотип доступний скрінрідеру", p.get_by_role("img", name="Be Smart School").count() == 1)
    c.close()
    c, p = new(b, motion="reduce"); p.goto(APP); p.wait_for_selector(".bs-logo"); p.wait_for_timeout(100)
    check("без анімацій лого одразу повне", p.locator(".bs-tail").first.bounding_box()["width"] > 10)
    p.wait_for_timeout(1500)
    art = p.locator(".login-art").bounding_box()
    p.evaluate("document.querySelector('.bs-logo').style.visibility = 'hidden'")
    img = Image.open(io.BytesIO(p.screenshot(clip={"x": art["x"] + art["width"] / 2, "y": art["y"], "width": art["width"] / 2, "height": art["height"] / 2}))).convert("RGB")
    lit = sum(1 for px in img.getdata() if px[0] > 225 and px[1] > 205 and px[2] > 190)
    check("без анімацій книга спокійно лежить угорі праворуч", p.get_attribute(".book3d", "data-phase") == "still" and lit > 2000, str(lit))
    check("без анімацій цифри у фоні не бігають", p.locator(".bits span").count() == 0)
    c.close()
    for w in (320, 360, 390, 768, 900, 1920):
        c, p = new(b, w, 700); p.goto(APP); p.wait_for_selector(".bs-logo"); p.wait_for_timeout(1900)
        logo = p.locator(".bs-logo").bounding_box(); art = p.locator(".login-art").bounding_box()
        check(f"{w} px: лого влізає в панель, прокрутки вбік немає", logo["x"] + logo["width"] <= art["x"] + art["width"] and logo["y"] >= art["y"] and over(p) <= 0, f"{logo} art={art}")
        c.close()

    # --- ШІ: повний сценарій менеджера
    mc, m = new(b); login(m, "manager", "manager123")
    check("бренд у меню", "School" in m.locator(".wordmark").inner_text())
    courses = api(mc, "GET", "/courses").json()
    py = next(x for x in courses if x["title"] == "Python"); web = next(x for x in courses if x["title"] == "Веброзробка")
    before = api(mc, "GET", f"/courses/{py['id']}").json()
    m.goto(f"{APP}/courses/{py['id']}"); m.wait_for_load_state("networkidle")
    m.get_by_role("button", name="Роадмап зі ШІ").click()
    src = m.get_by_label("Текст програми")
    expect(src).to_be_focused(); check("поле тексту у фокусі", True)
    check("кнопка неактивна без тексту", m.get_by_role("button", name="Розкласти").is_disabled())
    check("є попередження про Google Gemini", m.locator(".ai-note", has_text="Google Gemini").count() == 1)
    src.fill("Програма курсу: основи, функції, підсумковий проєкт.")
    m.get_by_role("button", name="Розкласти").click()
    expect(m.get_by_role("heading", name="Перевірте чернетку")).to_be_visible(); check("чернетка відкрита", True)
    check("чернетка: 3 етапи", m.locator(".ai-draft > li").count() == 3)
    check("нічого не записано до підтвердження", len(api(mc, "GET", f"/courses/{py['id']}").json()["steps"]) == len(before["steps"]))
    m.screenshot(path=str(OUT / "ai-draft.png"))
    m.get_by_label("Назва етапу 1").fill("Основи мови")
    m.get_by_label("Прибрати підпункт 2 етапу 1").click()
    m.locator(".ai-draft > li").nth(1).get_by_role("button", name="Підпункт", exact=True).click()
    m.get_by_label("Підпункт 4 етапу 2", exact=True).fill("Рекурсія")
    m.get_by_label("Прибрати етап 3").click()
    check("правки чернетки", m.locator(".ai-draft > li").count() == 2)
    m.get_by_role("button", name="Додати етап").click()
    check("порожній етап блокує запис", m.get_by_role("button", name="Додати в роадмап").is_disabled())
    m.get_by_label("Прибрати етап 3").click()
    m.get_by_role("button", name="До тексту").click()
    expect(m.get_by_label("Текст програми")).to_have_value("Програма курсу: основи, функції, підсумковий проєкт."); check("текст зберігся при поверненні", True)
    m.get_by_role("button", name="Розкласти").click()
    expect(m.locator(".ai-draft > li")).to_have_count(3)
    m.get_by_label("Назва етапу 1").fill("Основи мови")
    m.get_by_role("button", name="Додати в роадмап").click(); toast(m, "Роадмап оновлено")
    m.wait_for_selector(".modal", state="detached"); m.wait_for_load_state("networkidle")
    after = api(mc, "GET", f"/courses/{py['id']}").json()
    added = after["steps"][len(before["steps"]):]
    check("етапи додані в кінець", [s["title"] for s in added] == ["Основи мови", "Функції", "Проєкт"] and after["steps"][:len(before["steps"])] == before["steps"], str([s["title"] for s in added]))
    check("підпункти збережені в порядку", [x["title"] for x in added[1]["substeps"]] == ["Аргументи", "Повернення", "Область видимості"])
    expect(m.locator(".road-row", has_text="Основи мови")).to_be_visible(); check("новий етап видно на дорозі", True)

    # Заміна стирає старе лише після підтвердження
    m.get_by_role("button", name="Роадмап зі ШІ").click()
    m.get_by_label("Текст програми").fill("ще раз"); m.get_by_role("button", name="Розкласти").click()
    expect(m.get_by_role("heading", name="Перевірте чернетку")).to_be_visible()
    m.locator(".segmented label", has_text="Замінити все").click()
    m.get_by_role("button", name="Додати в роадмап").click()
    expect(m.get_by_text("Замінити весь роадмап?")).to_be_visible(); check("заміна просить підтвердження", True)
    m.locator(".modal", has_text="Замінити весь роадмап?").get_by_role("button", name="Назад").or_(m.locator(".modal", has_text="Замінити весь роадмап?").get_by_role("button", name="Скасувати")).first.click()
    check("без підтвердження нічого не змінено", len(api(mc, "GET", f"/courses/{py['id']}").json()["steps"]) == len(after["steps"]))
    m.keyboard.press("Escape")
    r = api(mc, "POST", f"/courses/{py['id']}/roadmap/import", data={"replace": True, "steps": [{"title": "Єдиний", "substeps": ["a"]}]})
    now = api(mc, "GET", f"/courses/{py['id']}").json()
    check("заміна лишає тільки нові етапи", r.status == 201 and [s["title"] for s in now["steps"]] == ["Єдиний"])

    # Помилки Gemini: людина бачить причину, а текст не губиться
    m.reload(); m.wait_for_load_state("networkidle")
    for word, msg in [("СЦЕНАРІЙ_ЛІМІТ", "ліміт Gemini"), ("СЦЕНАРІЙ_БИТИЙ", "неповну відповідь"), ("СЦЕНАРІЙ_ПОРОЖНЬО", "не вдалося знайти етапи")]:
        m.get_by_role("button", name="Роадмап зі ШІ").click()
        m.get_by_label("Текст програми").fill(word); m.get_by_role("button", name="Розкласти").click()
        toast(m, msg); check(f"помилка показана: {msg}", True)
        expect(m.get_by_label("Текст програми")).to_have_value(word)
        m.get_by_label("Закрити").click(); m.wait_for_selector(".modal", state="detached"); m.wait_for_timeout(100)
    r = api(mc, "POST", f"/courses/{py['id']}/roadmap/draft", data={"text": "СЦЕНАРІЙ_РЕЗЕРВ"})
    check("перша модель впала: працює резервна", r.ok and len(r.json()["steps"]) == 3, str(r.status))

    # Файл із текстом
    m.get_by_role("button", name="Роадмап зі ШІ").click()
    m.get_by_label("Текстовий файл").set_input_files([{"name": "план.txt", "mimeType": "text/plain", "buffer": "План із файлу".encode()}])
    expect(m.get_by_label("Текст програми")).to_have_value("План із файлу"); check("текст береться з файлу", True)
    m.get_by_label("Текстовий файл").set_input_files([{"name": "big.txt", "mimeType": "text/plain", "buffer": b"x" * (1024 * 1024 + 1)}])
    toast(m, "Файл завеликий"); check("завеликий файл відхилено", True)
    m.get_by_label("Закрити").click()

    # Шкідливий текст із відповіді моделі лишається текстом
    x = "<img src=x onerror=window.__ai=1>"
    api(mc, "POST", f"/courses/{py['id']}/roadmap/import", data={"steps": [{"title": x, "substeps": [x]}]})
    m.reload(); m.wait_for_load_state("networkidle"); m.wait_for_timeout(250)
    check("HTML у назвах не виконується", m.evaluate("window.__ai") is None)

    # --- Межі доступу та зламані запити
    tc, t = new(b); login(t, "teacher", "teacher123")
    sc, s = new(b); login(s, "student", "student123")
    te = api(tc, "GET", "/courses").json()
    mine = {x["id"] for x in te}
    other = next(x["id"] for x in courses if x["id"] not in mine) if any(x["id"] not in mine for x in courses) else None
    if other:
        check("вчитель чужого курсу: чернетка заборонена", api(tc, "POST", f"/courses/{other}/roadmap/draft", data={"text": "x"}).status == 403)
        check("вчитель чужого курсу: запис заборонено", api(tc, "POST", f"/courses/{other}/roadmap/import", data={"steps": [{"title": "x", "substeps": []}]}).status == 403)
    if mine:
        check("вчитель свого курсу може розкласти", api(tc, "POST", f"/courses/{next(iter(mine))}/roadmap/draft", data={"text": "x"}).ok)
    check("учню чернетка заборонена", api(sc, "POST", f"/courses/{web['id']}/roadmap/draft", data={"text": "x"}).status == 403)
    check("учню запис заборонено", api(sc, "POST", f"/courses/{web['id']}/roadmap/import", data={"steps": [{"title": "x", "substeps": []}]}).status == 403)
    s.goto(f"{APP}/courses/{web['id']}"); s.wait_for_selector(".road-row")
    check("учень не бачить кнопку ШІ", s.get_by_role("button", name="Роадмап зі ШІ").count() == 0)
    anon = b.new_context()
    check("аноніму закрито", anon.request.post(f"{BASE}/api/courses/{web['id']}/roadmap/draft", data={"text": "x"}).status == 401); anon.close()
    probes = [
        ("draft", {"text": ""}, 400), ("draft", {"text": "x" * 30001}, 400), ("draft", {"text": 5}, 400), ("draft", {}, 400),
        ("import", {"steps": []}, 400), ("import", {"steps": "x"}, 400), ("import", {}, 400), ("import", {"steps": [{"title": "  "}]}, 400),
    ]
    wrong = []
    for kind, body, code in probes:
        got = api(mc, "POST", f"/courses/{web['id']}/roadmap/{kind}", data=body).status
        if got != code: wrong.append((kind, str(body)[:30], got))
    check("зламані запити ШІ відхилено", not wrong, str(wrong))
    check("неіснуючий курс", api(mc, "POST", "/courses/999999/roadmap/draft", data={"text": "x"}).status == 404)

    # --- Телефон
    cm, pm = new(b, 390, 800, touch=True); login(pm, "manager", "manager123")
    check("телефон: назва школи вміщується в шапці", pm.evaluate("(()=>{const w=document.querySelector('.wordmark');return w.scrollWidth<=w.clientWidth+1})()") and over(pm) <= 0)
    pm.screenshot(path=str(OUT / "brand-mobile.png"))
    pm.goto(f"{APP}/courses/{web['id']}"); pm.wait_for_load_state("networkidle")
    check("телефон: сторінка курсу без прокрутки вбік", over(pm) <= 0, str(over(pm)))
    pm.screenshot(path=str(OUT / "ai-mobile-course.png"))
    pm.get_by_role("button", name="Роадмап зі ШІ").tap()
    pm.get_by_label("Текст програми").fill("Текст"); pm.get_by_role("button", name="Розкласти").tap()
    expect(pm.get_by_role("heading", name="Перевірте чернетку")).to_be_visible()
    box = pm.get_by_role("button", name="Додати в роадмап").bounding_box()
    check("телефон: кнопка запису видима", box["y"] + box["height"] <= 800 and over(pm) <= 0, str(box))
    pm.screenshot(path=str(OUT / "ai-mobile-draft.png"))
    wide = pm.evaluate("(()=>{const r=document.querySelector('.ai-sub .input').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})()")
    check("телефон: поля чернетки в межах екрана", wide)
    cm.close()

    # Здоров'я сервісу
    check("/healthz відповідає", mc.request.get(f"{BASE}/healthz").json()["ok"] is True)
    check("/api/health перевіряє базу", api(mc, "GET", "/health").json()["ok"] is True)
    b.close()

fails = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(fails)}/{len(results)} пройшло")
if fails: print("Провалені:", fails)
print("Console errors:", console[:15])
sys.exit(1 if fails or console else 0)
