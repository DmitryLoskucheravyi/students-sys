"""Заставка входу: червона заливка огинає форму, книга над усією сторінкою. Пошук людей за ім'ям і прізвищем."""
import os, pathlib
from playwright.sync_api import sync_playwright, expect

BASE = "http://127.0.0.1:3101"
OUT = pathlib.Path(os.environ["SHOTS"]); OUT.mkdir(parents=True, exist_ok=True)
results, console = [], []

def check(name, cond, extra=""):
    results.append((name, bool(cond)))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra else ""), flush=True)

def new(b, w=1360, h=860, touch=False, motion="no-preference"):
    ctx = b.new_context(viewport={"width": w, "height": h}, locale="uk-UA", has_touch=touch, is_mobile=touch, reduced_motion=motion)
    p = ctx.new_page()
    p.on("console", lambda m: console.append(f"{m.type}: {m.text}") if m.type == "error" and "status of 4" not in m.text else None)
    p.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
    return ctx, p

def wait_for(p, js, ms=6000):
    for _ in range(ms // 100):
        if p.evaluate(js): return True
        p.wait_for_timeout(100)
    return False

with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True)

    # 1. Широкий екран: заливка росте й огинає форму
    c, p = new(b)
    p.goto(BASE); p.wait_for_selector(".login-form")
    check("на сторінці входу немає перемикача теми", p.locator(".login .theme-btn, .login-theme").count() == 0)
    check("заливка видна на широкому екрані", p.locator(".login-flow").is_visible())
    check("заливка доросла", wait_for(p, "document.querySelector('.login-flow').dataset.grown === '1'"))
    clip = p.evaluate("getComputedStyle(document.querySelector('.login-flow')).clipPath")
    check("форма заливки задана кривою", clip.startswith("path("), clip[:40])
    # Червоне є вгорі й унизу правої колонки, а поля форми лишаються на білому
    box = p.locator(".login-flow").bounding_box(); field = p.get_by_label("Логін").bounding_box()
    hit = lambda x, y: p.evaluate(f"""(() => {{ const el = document.querySelector('.login-flow');
        const r = el.getBoundingClientRect(); const ctx = document.createElement('canvas').getContext('2d');
        const d = getComputedStyle(el).clipPath.slice(6, -2); return ctx.isPointInPath(new Path2D(d), {x} - r.left, {y} - r.top); }})()""")
    check("червоне заходить угорі колонки", hit(box["x"] + 20, box["y"] + 5))
    check("і внизу", hit(box["x"] + box["width"] * 0.5, box["y"] + box["height"] - 3))
    check("під полем логіна біле", not hit(field["x"] + 5, field["y"] + 5) and not hit(field["x"] + field["width"] - 5, field["y"] + field["height"] - 5))
    check("книга над усією сторінкою", p.locator(".book3d").bounding_box()["width"] == 1360)
    p.get_by_label("Логін").fill("manager"); p.locator("input[type=password]").fill("manager123")
    p.get_by_role("button", name="Увійти").click(); p.wait_for_selector(".rail")
    check("поля форми доступні поверх заливки", True)

    # 2. Пошук людей
    p.goto(f"{BASE}/people"); p.wait_for_load_state("networkidle")
    search = p.get_by_label("Пошук за ім’ям і прізвищем")
    names = lambda: [x.inner_text() for x in p.locator(".person-row h3").all()]
    total = len(names())
    search.fill("бойко"); check("знаходить за прізвищем", names() == ["Дарина Бойко"], str(names()))
    search.fill("БОЙКО дар"); check("порядок і регістр не важливі", names() == ["Дарина Бойко"])
    search.fill("марко"); check("знаходить за ім'ям", names() == ["Марко Шевчук"])
    search.fill("нікого такого"); check("порожній результат має пояснення", p.get_by_text("Нікого не знайдено").is_visible())
    p.get_by_role("button", name="Очистити пошук").click()
    check("очищення повертає весь список", len(names()) == total and total >= 3, str(total))
    p.get_by_role("radio", name="Вчителі").check(force=True)
    search.fill("мельник"); check("пошук працює й серед вчителів", names() == ["Андрій Мельник"], str(names()))
    p.screenshot(path=str(OUT / "lp-people-search.png"))
    c.close()

    # 3. Телефон: заливки немає, прокрутки вбік теж
    c, p = new(b, 390, 800, touch=True)
    p.goto(BASE); p.wait_for_selector(".login-form")
    check("на телефоні заливка прихована", not p.locator(".login-flow").is_visible())
    check("на телефоні без прокрутки вбік", p.evaluate("document.documentElement.scrollWidth - innerWidth") <= 0)
    c.close()

    # 4. Без анімацій: заливка одразу в кінцевій формі
    c, p = new(b, motion="reduce")
    p.goto(BASE); p.wait_for_selector(".login-form"); p.wait_for_timeout(300)
    check("без анімацій заливка одразу на місці", p.evaluate("getComputedStyle(document.querySelector('.login-flow')).clipPath").startswith("path("))
    c.close()
    b.close()

print(f"\n{sum(ok for _, ok in results)}/{len(results)} пройшло")
print("Console errors:", console)
raise SystemExit(0 if all(ok for _, ok in results) and not console else 1)
