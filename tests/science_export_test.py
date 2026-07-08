import subprocess
import time
import os
import tempfile
from playwright.sync_api import sync_playwright

APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST_DIR = os.path.join(APP_DIR, "dist")

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

        # 设置下载目录
        download_dir = tempfile.mkdtemp(prefix="mathbeat_export_")
        cdp_session = context.new_cdp_session(page)
        cdp_session.send("Browser.setDownloadBehavior", {
            "behavior": "allow",
            "downloadPath": download_dir,
            "eventsEnabled": True
        })

        page.goto("http://localhost:8080/index.html")
        page.wait_for_selector("#homeScreen.active", timeout=8000)

        # 进入科学之声并选择 DFT
        page.click(".action-science")
        page.wait_for_selector("#scienceScreen.active", timeout=5000)
        page.click(".science-mode-card[onclick*=\"'dft'\"]")
        page.wait_for_selector("#scienceStep-data.active", timeout=5000)

        # 进入作曲台并生成音乐
        page.click(".science-open-composer")
        page.wait_for_selector("#scienceStep-compose.active", timeout=5000)
        page.click("#sciGenerateBtn")
        time.sleep(0.3)

        # 验证导出按钮存在
        for fmt in ["midi", "json", "csv"]:
            btn = page.locator(f"button[onclick*=\"downloadScienceExport('{fmt}')\"]")
            if btn.count() == 0:
                handle_error(f"导出按钮 {fmt.upper()} 不存在")
            else:
                print(f"PASS: {fmt.upper()} export button exists")

        # 触发 JSON 导出并检测下载
        with page.expect_download(timeout=5000) as download_info:
            page.click("button[onclick*=\"downloadScienceExport('json')\"]")
        download = download_info.value
        download_path = os.path.join(download_dir, download.suggested_filename)
        download.save_as(download_path)
        if os.path.exists(download_path) and os.path.getsize(download_path) > 0:
            print("PASS: JSON export downloaded")
        else:
            handle_error("JSON export download failed")

        # 验证导出文件内容可读
        try:
            with open(download_path, "r", encoding="utf-8") as f:
                payload = f.read()
                if '"type":' in payload and '"pattern":' in payload:
                    print("PASS: JSON export has expected fields")
                else:
                    handle_error("JSON export missing expected fields")
        except Exception as e:
            handle_error(f"JSON export read failed: {e}")

        browser.close()
finally:
    server.terminate()

if errors:
    print("ERRORS:", errors)
    raise SystemExit(1)
else:
    print("Science export test completed with no JS errors.")
