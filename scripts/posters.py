"""
Постери 3D-сцен карток курсів: client/public/posters/<scene>.webp (800×600, прозоре тло).
Показуються одразу (до завантаження three.js) і замість 3D (менше руху, економія трафіку, без WebGL2).

Запуск: дев-сервер на 5179 (npx vite --port 5179), потім
    python -I scripts/posters.py
Перезняти треба після зміни сцени, маскота чи кольорів курсу.
"""
import base64
import pathlib
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5179"
SCENES = ["keys", "blocks", "blob", "island", "layers", "tiles", "request"]
OUT = pathlib.Path(__file__).resolve().parent.parent / "client" / "public" / "posters"
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as pw:
    browser = pw.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    page = browser.new_page(viewport={"width": 400, "height": 300}, device_scale_factor=2)
    for scene in SCENES:
        page.goto(f"{BASE}/poster.html?scene={scene}")
        page.wait_for_function("window.__posterReady === true", timeout=60000)
        url = page.evaluate("document.querySelector('canvas').toDataURL('image/webp', 0.9)")
        data = base64.b64decode(url.split(",", 1)[1])
        (OUT / f"{scene}.webp").write_bytes(data)
        print(f"{scene}.webp  {len(data) // 1024} KB")
    browser.close()
