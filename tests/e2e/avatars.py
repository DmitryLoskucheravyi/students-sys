"""Аватарки: лише з готового набору; свою обирає кожен, учням ставить менеджер."""
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

def api(ctx, m, path, **kw): return ctx.request.fetch(f"{BASE}/api{path}", method=m, **kw)
def toast(p, text): expect(p.locator(".toast", has_text=text).first).to_be_visible(timeout=8000)
def overflow(p): return p.evaluate("document.documentElement.scrollWidth - window.innerWidth")

with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True)

    # 1. Учень обирає аватарку в профілі
    sc, s = new(b); login(s, "student", "student123")
    check("без аватарки в меню ініціали", s.locator(".rail-user .avatar").inner_text() == "МШ")
    s.goto(f"{BASE}/profile"); s.wait_for_selector(".avatar-pick")
    check("у наборі 20 аватарок і варіант без неї", s.locator(".avatar-opt").count() == 21)
    s.get_by_role("radio", name="Дебаг-качка").click(); toast(s, "Аватарку змінено")
    expect(s.locator(".rail-user .avatar.has-art")).to_be_visible(); check("меню одразу показує нову аватарку", True)
    check("обрана позначена", s.get_by_role("radio", name="Дебаг-качка").get_attribute("aria-checked") == "true")
    s.screenshot(path=str(OUT / "avatar-profile.png"))
    s.reload(); s.wait_for_selector(".rail")
    check("аватарка зберігається після перезавантаження", api(sc, "GET", "/auth/me").json()["avatar"] == "duck" and s.locator(".rail-user .avatar.has-art").count() == 1)

    # 2. Лише з набору
    bad = [api(sc, "PATCH", "/auth/avatar", data={"avatar": v}).status for v in ("https://evil/x.png", "<svg/>", "nope", 5)]
    check("чужі значення відхилено", bad == [400, 400, 400, 400], str(bad))
    check("без аватарки можна повернути ініціали", api(sc, "PATCH", "/auth/avatar", data={"avatar": None}).json()["avatar"] is None)
    check("учень не змінює чужі аватарки", api(sc, "PATCH", "/users/1", data={"avatar": "cat"}).status == 403)

    # 3. Менеджер: своя аватарка й аватарка учня
    mc, m = new(b); login(m, "manager", "manager123")
    m.goto(f"{BASE}/profile"); m.get_by_role("radio", name="Галактичний мозок").click(); toast(m, "Аватарку змінено")
    check("менеджер змінив свою аватарку", api(mc, "GET", "/auth/me").json()["avatar"] == "galaxy")
    m.goto(f"{BASE}/people"); m.wait_for_load_state("networkidle")
    row = m.locator(".person-row", has_text="Дарина Бойко")
    row.get_by_role("button", name="Редагувати").click(); form = m.locator(".modal")
    form.get_by_role("radio", name="Котик").click()
    form.get_by_role("button", name="Зберегти").click(); toast(m, "Зміни збережено")
    expect(row.locator(".avatar.has-art")).to_be_visible(); check("менеджер поставив аватарку учневі", True)
    boiko = next(u for u in api(mc, "GET", "/users").json() if u["login"] == "boiko")
    check("аватарка учня збережена", boiko["avatar"] == "cat")
    api(mc, "PATCH", f"/users/{boiko['id']}", data={"name": boiko["name"]})
    check("зміна без поля аватарки її не скидає", next(u for u in api(mc, "GET", "/users").json() if u["login"] == "boiko")["avatar"] == "cat")
    check("менеджер не поставить вигадану", api(mc, "PATCH", f"/users/{boiko['id']}", data={"avatar": "x"}).status == 400)
    bc, bp = new(b); login(bp, "boiko", "student123")
    check("учень бачить аватарку від менеджера", bp.locator(".rail-user .avatar.has-art").count() == 1)

    # 4. Телефон і темна тема
    for w, theme in [(320, "light"), (390, "dark")]:
        c, p = new(b, w, 760, theme=theme, touch=True); login(p, "student", "student123")
        p.goto(f"{BASE}/profile"); p.wait_for_selector(".avatar-pick")
        check(f"{w}px {theme}: без прокрутки вбік", overflow(p) <= 0, str(overflow(p)))
        p.screenshot(path=str(OUT / f"avatar-{w}-{theme}.png"), full_page=True)
        c.close()
    b.close()

fails = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(fails)}/{len(results)} пройшло")
if fails: print("Провалені:", fails)
print("Console errors:", console[:15])
sys.exit(1 if fails or console else 0)
