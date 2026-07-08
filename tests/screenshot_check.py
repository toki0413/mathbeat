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

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 520, "height": 960})
        page = context.new_page()

        # 首页
        page.goto("http://localhost:8080/index.html")
        page.wait_for_selector("#homeScreen.active", timeout=8000)
        time.sleep(0.8)
        page.screenshot(path=os.path.join(OUT_DIR, "01_home.png"))

        # 世界1 关卡页
        page.click("#worldGrid .world-card")
        page.wait_for_selector("#worldIntroOverlay.show", timeout=5000)
        page.screenshot(path=os.path.join(OUT_DIR, "02_world_intro.png"))
        page.click("#worldIntroOverlay .overlay-close")
        page.wait_for_selector("#levelScreen.active", timeout=5000)
        time.sleep(0.3)
        page.screenshot(path=os.path.join(OUT_DIR, "03_level_screen.png"))

        # 游戏界面
        page.locator("#levelCards .level-card").nth(0).click()
        page.wait_for_selector("#gameScreen.active", timeout=5000)
        time.sleep(0.5)
        page.screenshot(path=os.path.join(OUT_DIR, "04_game_screen.png"))

        # 返回首页后的自由模式 / 示例曲库区域
        page.goto("http://localhost:8080/index.html")
        page.wait_for_selector("#homeScreen.active", timeout=8000)
        time.sleep(0.3)
        page.screenshot(path=os.path.join(OUT_DIR, "05_home_actions.png"))

        # 示例曲库弹窗
        page.click(".action-card[onclick*='openSampleLibrary']")
        time.sleep(0.5)
        page.screenshot(path=os.path.join(OUT_DIR, "06_sample_library.png"))

        browser.close()
finally:
    server.terminate()

print("Screenshots saved to", OUT_DIR)
