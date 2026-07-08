"""
MathBeat 端到端冒烟测试
验证所有主界面入口按钮、设置、成就、每日/科学/作曲台/示例库/自由/无尽/关卡编辑器
均可正常打开，并验证 World 1-1 的答题链路。
"""
import json
import os
import subprocess
import time
import sys
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

DIST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dist")

server = subprocess.Popen(
    ["python", "-m", "http.server", "8080"],
    cwd=DIST_DIR,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
time.sleep(1.5)

errors = []
passed = []


def log_pass(msg):
    passed.append(msg)
    print(f"PASS: {msg}")


def log_error(msg):
    errors.append(msg)
    print(f"FAIL: {msg}")


def dismiss_overlays(page):
    for _ in range(5):
        if page.locator("#tutorialOverlay.show").count() > 0:
            page.click("#tutNext")
            time.sleep(0.2)
        elif page.locator("#whyOverlay.show").count() > 0:
            page.click("#whyOverlay .overlay-close")
            time.sleep(0.2)
        else:
            break


def go_home(page):
    page.evaluate("showScreen('home')")
    page.wait_for_selector("#homeScreen.active", timeout=3000)


def check_opens(page, trigger_selector, check_selector, name):
    try:
        page.click(trigger_selector)
        page.wait_for_selector(check_selector, timeout=3000)
        log_pass(f"{name} opens ({check_selector})")
        return True
    except PlaywrightTimeout:
        log_error(f"{name} did not open {check_selector}")
        return False


try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 520, "height": 960})
        page = context.new_page()
        page.on("pageerror", lambda err: log_error(f"JS error: {err}"))
        page.on(
            "console",
            lambda msg: log_error(f"Console {msg.type}: {msg.text}")
            if msg.type == "error"
            else None,
        )


        page.goto("http://localhost:8080/index.html")
        page.evaluate("localStorage.clear()")
        # Seed a save that unlocks free mode and skips onboarding.
        seed_state = {
            "version": "1.1",
            "screen": "home",
            "currentWorld": 0,
            "currentLevel": 0,
            "progress": {"6-B": 1},
            "unlocks": {
                "drums": True, "bass": True, "melody": True, "chords": True,
                "euclidean": True, "modular": True, "prime": True,
                "fibonacci": True, "symmetry": True, "recursive": True,
            },
            "scienceCompositions": [],
            "diary": [],
            "settings": {"bgm": False, "sfx": False, "difficulty": "auto", "soundPack": "mathRock"},
            "combo": 0,
            "bestCombo": 0,
            "achievements": [],
            "leaderboard": {},
            "adaptiveHistory": [],
            "dailyStreak": 0,
            "dailyLastDate": "",
            "dailyTypesCompleted": [],
            "dailyWeekCounts": {},
            "scienceTypesUsed": [],
            "samplesPlayed": [],
            "levelHints": {},
            "bossTimes": {},
            "luckyStreak": 0,
            "w3BossPerfect": True,
            "noHintWorld": False,
            "pendingBoss": None,
            "onboardingDone": True,
            "lastWorld": 0,
            "lastLevel": "",
            "endlessStats": {
                "bestScore": 0, "totalRounds": 0, "totalCorrect": 0,
                "totalQuestions": 0, "bestCombo": 0,
            },
            "customLevels": [],
            "composerExported": False,
            "importedSampleId": "",
            "sharedComposer": False,
            "exportedScience": False,
        }
        page.evaluate(f"localStorage.setItem('mathbeat_state', JSON.stringify({json.dumps(seed_state)}))")
        page.reload()
        page.wait_for_selector("#homeScreen.active", timeout=8000)
        time.sleep(0.6)
        dismiss_overlays(page)
        log_pass("Home loads")

        # Main navigation screens
        check_opens(page, ".action-science", "#scienceScreen.active", "Science button")
        go_home(page)
        check_opens(page, "#freeModeCard", "#freeModeScreen.active", "Free mode button")
        go_home(page)
        check_opens(page, ".action-card:has-text('成就')", "#achievementsScreen.active", "Achievements button")
        go_home(page)
        check_opens(page, ".action-card:has-text('设置')", "#settingsScreen.active", "Settings button")
        go_home(page)
        check_opens(page, ".action-card:has-text('无尽')", "#endlessModeScreen.active", "Endless mode button")
        go_home(page)
        check_opens(page, ".action-card:has-text('关卡编辑器')", "#levelEditorScreen.active", "Level editor button")
        go_home(page)

        # Modals
        check_opens(page, "#dailyChallengeBanner", "#dailyModal", "Daily challenge banner")
        page.evaluate("closeDailyModal()")
        time.sleep(0.2)
        check_opens(page, ".action-card:has-text('示例曲库')", "#sampleLibraryModal", "Sample library button")
        page.evaluate("closeSampleLibrary()")
        time.sleep(0.2)

        # World 1 -> level 1 -> verify
        page.click("#worldGrid .world-card")
        page.wait_for_selector("#worldIntroOverlay.show", timeout=3000)
        log_pass("World 1 intro opens")
        page.click("#worldIntroOverlay .overlay-close")
        page.wait_for_selector("#levelScreen.active", timeout=3000)
        page.locator("#levelCards .level-card").first.click()
        page.wait_for_selector("#gameScreen.active", timeout=3000)
        dismiss_overlays(page)
        page.fill("#w1Input", "6")
        page.click(".verify-btn")
        time.sleep(0.8)
        text = page.locator("#w1Result").text_content() or ""
        if "齐奏" in text:
            log_pass("World 1-1 verify succeeds")
        else:
            log_error(f"World 1-1 verify failed: {text[:80]}")

        browser.close()
finally:
    server.terminate()

print(f"\n{len(passed)} passed, {len(errors)} failed")
if errors:
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)
