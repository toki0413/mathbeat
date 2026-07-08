import subprocess
import time
import os
from playwright.sync_api import sync_playwright

APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST_DIR = os.path.join(APP_DIR, "dist")
OUT_DIR = os.path.join(APP_DIR, "tests", "screenshots")
os.makedirs(OUT_DIR, exist_ok=True)

server = subprocess.Popen(
    ["python", "-m", "http.server", "8080"],
    cwd=DIST_DIR,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
time.sleep(1.5)

errors = []
def handle_error(msg):
    errors.append(msg)
    print("JS ERROR:", msg)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 520, "height": 960})
        page = context.new_page()
        page.on("pageerror", lambda err: handle_error(str(err)))
        page.on("console", lambda msg: handle_error(str(msg.text)) if msg.type == "error" else None)

        page.goto("http://localhost:8080/index.html")
        page.wait_for_selector("#homeScreen.active", timeout=8000)

        # 进入科学之声
        page.click(".action-science")
        page.wait_for_selector("#scienceScreen.active", timeout=5000)
        time.sleep(0.3)
        page.screenshot(path=os.path.join(OUT_DIR, "07_science_home.png"))

        # 选择 MD（分子动力学）
        page.click(".science-mode-card[onclick*=\"'md'\"]")
        page.wait_for_selector("#scienceStep-data.active", timeout=5000)
        time.sleep(0.5)
        page.screenshot(path=os.path.join(OUT_DIR, "08_science_md_data.png"))

        # 进入作曲台
        page.click(".science-open-composer")
        page.wait_for_selector("#scienceStep-compose.active", timeout=5000)
        time.sleep(0.3)
        page.screenshot(path=os.path.join(OUT_DIR, "09_science_compose.png"))

        # 生成并播放
        page.click("#sciGenerateBtn")
        time.sleep(0.3)
        page.click("#sciPlayBtn")
        time.sleep(0.6)
        page.click("#sciPlayBtn")
        time.sleep(0.2)
        page.screenshot(path=os.path.join(OUT_DIR, "10_science_generated.png"))

        # 切换到 XRD 并上传文件
        page.goto("http://localhost:8080/index.html")
        page.wait_for_selector("#homeScreen.active", timeout=8000)
        page.click(".action-science")
        page.wait_for_selector("#scienceScreen.active", timeout=5000)
        page.click(".science-mode-card[onclick*=\"'xrd'\"]")
        page.wait_for_selector("#scienceStep-data.active", timeout=5000)
        time.sleep(0.3)
        page.screenshot(path=os.path.join(OUT_DIR, "11_science_xrd.png"))

        browser.close()
finally:
    server.terminate()

if errors:
    print("ERRORS:", errors)
else:
    print("Science mode smoke test completed with no JS errors.")
