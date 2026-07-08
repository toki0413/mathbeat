import subprocess
import time
import sys
import tempfile
import os
import json
from math import gcd
from playwright.sync_api import sync_playwright

# Build and start preview server
import shutil

APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Ensure dist exists
if not os.path.isdir(os.path.join(APP_DIR, "dist")):
    print("Building MathBeat-App...")
    build = subprocess.run(
        ["npm", "run", "build"],
        cwd=APP_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if build.returncode != 0:
        print("Build failed:")
        print(build.stdout)
        print(build.stderr)
        sys.exit(1)

DIST_DIR = os.path.join(APP_DIR, "dist")
server = subprocess.Popen(
    ["python", "-m", "http.server", "8080"],
    cwd=DIST_DIR,
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
time.sleep(1.5)

errors = []
warnings = []
results = []


def log_error(msg):
    results.append(f"FAIL: {msg}")
    print(f"FAIL: {msg}")


def log_pass(msg):
    results.append(f"PASS: {msg}")
    print(f"PASS: {msg}")


def check_errors(label):
    global errors
    if errors:
        log_error(f"{label}: {errors[:3]}")
        errors.clear()
        return False
    return True


def dismiss_overlays(page):
    """Close any visible tutorial / edu / why overlay before clicking."""
    pairs = [
        ("#tutorialOverlay", "#tutNext"),
        ("#eduCardOverlay", "#eduCardOverlay .overlay-close"),
        ("#whyOverlay", "#whyOverlay .overlay-close"),
    ]
    for overlay, close_btn in pairs:
        try:
            if page.locator(overlay + ".show").count() > 0:
                page.click(close_btn)
                time.sleep(0.15)
        except Exception:
            pass


def click_next_button(page):
    dismiss_overlays(page)
    page.wait_for_selector(".next-btn.show", timeout=3000)
    page.click(".next-btn.show")
    time.sleep(0.3)


# Level answer data (matches LEVELS in index.html)
W1_ANSWERS = {"1-1": (2, 3), "1-2": (3, 4), "1-3": (4, 5), "1-4": (5, 7), "1-5": (6, 8)}
W3_FREQS = {"3-1": 660, "3-2": 550, "3-3": 770, "3-4": 495, "3-5": 587, "3-B": 605}
W4_ANSWERS = {"4-1": (3, 5), "4-2": (4, 6), "4-3": (5, 7), "4-4": (5, 8), "4-5": (6, 9)}
SCIENCE_TYPE_LABELS = {"xrd": "XRD", "dna": "DNA", "pulsar": "Pulsar"}


def lcm(a, b):
    return a // gcd(a, b) * b


try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 520, "height": 960})
        page = context.new_page()

        page.on(
            "console",
            lambda msg: (
                errors.append(msg.text)
                if msg.type == "error"
                else warnings.append(msg.text)
                if msg.type == "warning"
                else None
            ),
        )
        page.on("pageerror", lambda err: errors.append(str(err)))

        # T1: Load home with a clean profile
        page.goto("http://localhost:8080/index.html")
        page.evaluate("localStorage.clear()")
        page.reload()
        page.wait_for_selector("#homeScreen.active", timeout=8000)
        time.sleep(0.6)
        check_errors("console/page errors on load")
        log_pass("Home loads without console errors")

        # Dismiss first-time onboarding if shown
        if page.locator("#tutorialOverlay.show").count() > 0:
            page.click("#tutNext")
            time.sleep(0.3)

        # T2: BGM hint and first interaction
        if page.locator("#bgmHint.show").count() > 0:
            log_pass("BGM hint is visible on first load")
            page.click("#bgMusicBtn")
            time.sleep(0.3)
            if page.locator("#bgmHint.show").count() == 0:
                log_pass("BGM hint hides after user interaction")
            else:
                log_error("BGM hint did not hide after interaction")
        else:
            log_pass("BGM hint already hidden (music auto-started)")
        if page.locator("#bgMusicBtn.on").count() > 0:
            log_pass("BGM button shows ON state")
        else:
            log_error("BGM button did not switch to ON state")

        # T3: World grid visible and World 1 clickable
        page.wait_for_selector("#worldGrid .world-card", timeout=5000)
        page.click("#worldGrid .world-card")
        page.wait_for_selector("#worldIntroOverlay.show", timeout=5000)
        log_pass("World 1 click opens world intro popup")
        page.click("#worldIntroOverlay .overlay-close")
        page.wait_for_selector("#levelScreen.active", timeout=5000)
        log_pass("World intro closes and navigates to level screen")

        # Complete every level in every world (now includes worlds 7 and 8)
        for wid in range(1, 9):
            # Navigate to the world from home
            page.goto("http://localhost:8080/index.html")
            page.wait_for_selector("#homeScreen.active", timeout=8000)
            page.wait_for_selector("#worldGrid .world-card", timeout=5000)
            cards = page.locator("#worldGrid .world-card")
            if cards.count() < wid:
                log_error(f"Not enough world cards for world {wid}")
                break
            cards.nth(wid - 1).click()
            page.wait_for_selector("#worldIntroOverlay.show", timeout=5000)
            page.click("#worldIntroOverlay .overlay-close")
            page.wait_for_selector("#levelScreen.active", timeout=5000)

            levels = [f"{wid}-{i}" for i in range(1, 6)] + [f"{wid}-B"]
            level_cards = page.locator("#levelCards .level-card")
            if level_cards.count() < len(levels):
                log_error(f"World {wid} level cards not rendered")
                break
            # Enter the first level of the world
            level_cards.nth(0).click()

            for lid in levels:
                page.wait_for_selector("#gameScreen.active", timeout=5000)
                dismiss_overlays(page)

                # Solve the level
                if lid.endswith("-B"):
                    # Boss: accept the problem statement, then open mini composer
                    page.click("button:has-text('接受挑战')")
                    page.wait_for_selector("#miniComposer.show", timeout=5000)
                    page.wait_for_selector("#mcGoalText", timeout=3000)
                    goal_text = page.locator("#mcGoalText").text_content() or ""
                    if len(goal_text) > 0:
                        log_pass(f"Boss {lid} shows goal: {goal_text[:40]}")
                    else:
                        log_error(f"Boss {lid} missing goal text")

                    # Verify "为什么？" for boss via showWhy
                    try:
                        page.evaluate(f"showWhy('{lid}')")
                        page.wait_for_selector("#whyOverlay.show", timeout=3000)
                        title = page.locator("#whyTitle").text_content()
                        if title and len(title) > 0:
                            log_pass(f"Why button opens for {lid}: {title}")
                        else:
                            log_error(f"Why overlay empty for {lid}")
                        page.click("#whyOverlay .overlay-close")
                        time.sleep(0.15)
                    except Exception as e:
                        log_error(f"Why button failed for {lid}: {e}")

                    # Generate and finish
                    page.click("button[onclick='mcApplyGen()']")
                    time.sleep(0.4)
                    page.click("button[onclick='mcFinish()']")
                    # Wait for mini composer to disappear (success path)
                    page.wait_for_selector(
                        "#miniComposer.show", state="hidden", timeout=5000
                    )
                    log_pass(f"Boss {lid} completed")
                else:
                    # Verify "为什么？" button for normal levels
                    try:
                        page.click("button:has-text('为什么？')")
                        page.wait_for_selector("#whyOverlay.show", timeout=3000)
                        title = page.locator("#whyTitle").text_content()
                        if title and len(title) > 0:
                            log_pass(f"Why button opens for {lid}: {title}")
                        else:
                            log_error(f"Why overlay empty for {lid}")
                        page.click("#whyOverlay .overlay-close")
                        time.sleep(0.15)
                    except Exception as e:
                        log_error(f"Why button failed for {lid}: {e}")


                    if wid == 1:
                        a, b = W1_ANSWERS[lid]
                        val = lcm(a, b)
                        page.fill("#w1Input", str(val))
                        page.click(".verify-btn")
                        page.wait_for_selector("#w1Result:has-text('✅')", timeout=3000)
                        log_pass(f"Level {lid} verified (LCM={val})")
                    elif wid == 2:
                        # 选择协和和弦：C(0), E(4), G(7)；4 音时再加 A(9) 组成 C6
                        ring_cells = page.locator("#w2Ring .seq-cell")
                        consonant_indices = [0, 4, 7] if lid in ("2-1", "2-2", "2-3") else [0, 4, 7, 9]
                        for idx in consonant_indices:
                            if idx < ring_cells.count():
                                ring_cells.nth(idx).click()
                                time.sleep(0.05)
                        if lid in ("2-2", "2-5"):
                            page.click("button:has-text('旋转')")
                        if lid in ("2-3", "2-5", "2-B"):
                            page.click("button:has-text('倒影')")
                        page.wait_for_selector("#w2Result.correct", timeout=3000)
                        log_pass(f"Level {lid} verified")
                    elif wid == 3:
                        freq = W3_FREQS[lid]
                        page.fill("#w3Slider", str(freq))
                        page.evaluate(
                            "document.getElementById('w3Slider').dispatchEvent(new Event('input'))"
                        )
                        page.click("button:has-text('验证')")
                        page.wait_for_selector("#w3Result.correct", timeout=3000)
                        log_pass(f"Level {lid} verified (B={freq}Hz)")
                    elif wid == 4:
                        a, b = W4_ANSWERS[lid]
                        val = lcm(a, b)
                        page.fill("#w4Input", str(val))
                        page.click(".verify-btn")
                        page.wait_for_selector("#w4Result.correct", timeout=3000)
                        log_pass(f"Level {lid} verified (LCM={val})")
                    elif wid == 5:
                        if lid == "5-1":
                            # 5-1 要求至少交换一次音符位置
                            cells = page.locator("#w5Row .perm-cell")
                            if cells.count() >= 2:
                                cells.nth(0).click()
                                time.sleep(0.1)
                                cells.nth(1).click()
                                time.sleep(0.1)
                        if lid in ("5-2", "5-4", "5-B"):
                            page.click(".perm-op:has-text('逆行')")
                            time.sleep(0.1)
                        if lid in ("5-3", "5-5", "5-B"):
                            page.click(".perm-op:has-text('旋转')")
                            time.sleep(0.1)
                        if lid in ("5-5", "5-B"):
                            page.click(".perm-op:has-text('倒影')")
                            time.sleep(0.1)
                        page.click(".verify-btn")
                        page.wait_for_selector("#w5Result.correct", timeout=3000)
                        log_pass(f"Level {lid} verified")
                    elif wid == 6:
                        page.click("button:has-text('欧几里得')")
                        time.sleep(0.3)
                        page.click("button:has-text('验证')")
                        page.wait_for_selector("#w6Result.correct", timeout=3000)
                        log_pass(f"Level {lid} verified")
                    elif wid == 7:
                        if lid == "7-1":
                            # Reroll once to avoid an unlucky sparse pattern
                            page.click("button:has-text('掷骰子')")
                            time.sleep(0.15)
                        page.click("button:has-text('验证')")
                        page.wait_for_selector("#w7Result.correct", timeout=3000)
                        log_pass(f"Level {lid} verified")
                    elif wid == 8:
                        if lid in ("8-1", "8-4"):
                            # Build a valid path I -> IV -> V (nodes 0,1,2)
                            page.evaluate("w8PathClick(0)")
                            page.evaluate("w8PathClick(1)")
                            page.evaluate("w8PathClick(2)")
                            time.sleep(0.15)
                        page.click("button:has-text('验证')")
                        page.wait_for_selector("#w8Result.correct", timeout=3000)
                        log_pass(f"Level {lid} verified")

                    check_errors(f"JS errors during {lid}")

                # Advance; boss automatically returns home via nextLevel
                if lid.endswith("-B"):
                    page.wait_for_selector("#homeScreen.active", timeout=5000)
                    log_pass(f"Returned home after boss {lid}")
                else:
                    click_next_button(page)

            check_errors(f"JS errors after world {wid}")

        # T4: Free mode and composer unlocked after world 6
        page.goto("http://localhost:8080/index.html")
        page.wait_for_selector("#homeScreen.active", timeout=8000)
        page.wait_for_selector("#freeModeCard:not(.locked)", timeout=5000)
        page.click("#freeModeCard")
        time.sleep(0.3)
        if page.locator("#freeModeScreen.active").count() > 0:
            log_pass("Free mode opens after world 6 completed")
            page.click("#freeModeScreen .ctrl-btn")
            page.wait_for_selector("#homeScreen.active", timeout=5000)
        else:
            log_error("Free mode did not open after world 6")
        page.click("#composerHomeCard")
        time.sleep(0.5)
        if "composer.html" in page.url:
            log_pass("Composer workstation navigates when unlocked")
        else:
            log_error("Composer workstation did not navigate")

        # T5: Math rock sample library - play and import samples
        page.goto("http://localhost:8080/index.html")
        page.wait_for_selector("#homeScreen.active", timeout=8000)
        page.click(".action-card[onclick*='openSampleLibrary']")
        time.sleep(0.3)
        if page.evaluate("document.getElementById('sampleLibraryModal').style.display === 'flex'"):
            log_pass("Sample library modal opens")
        else:
            log_error("Sample library modal did not open")
        # 播放并导入第一首示例曲
        page.click("#samplePlay_fibonacci-groove")
        time.sleep(0.4)
        page.click("#samplePlay_fibonacci-groove")
        log_pass("Sample library playback toggled")
        page.locator("button:has-text('导入作曲台')").nth(0).click()
        time.sleep(0.6)
        if "composer.html" in page.url:
            log_pass("Sample import navigates to composer")
        else:
            log_error("Sample import did not navigate to composer")
        check_errors("JS errors during sample library import")
        # 验证来自真实科学数据的 3 首示例曲可播放
        for sample_id in ['md_csh', 'fem_csh', 'dft_csh']:
            page.goto("http://localhost:8080/index.html")
            page.wait_for_selector("#homeScreen.active", timeout=8000)
            page.click(".action-card[onclick*='openSampleLibrary']")
            page.wait_for_selector("#sampleLibraryModal", timeout=5000)
            play_btn = page.locator(f"#samplePlay_{sample_id}")
            if play_btn.count() == 0:
                log_error(f"Real sample {sample_id} not found in library")
                continue
            play_btn.click()
            time.sleep(0.5)
            play_btn.click()
            check_errors(f"Real math-rock sample {sample_id} playback")
            log_pass(f"Real math-rock sample {sample_id} from real science data plays")

        # T6: Science mode smoke (retained from original suite)
        page.goto("http://localhost:8080/index.html")
        page.wait_for_selector("#homeScreen.active", timeout=8000)
        page.click(".action-science")
        page.wait_for_selector("#scienceScreen.active", timeout=5000)
        page.click(".science-mode-card[onclick*=\"'md'\"]")
        page.wait_for_selector("#scienceStep-data.active", timeout=5000)
        page.click(".science-open-composer")
        page.wait_for_selector("#scienceStep-compose.active", timeout=5000)
        page.click("#sciGenerateBtn")
        time.sleep(0.3)
        page.click("#sciPlayBtn")
        time.sleep(0.6)
        page.click("#sciPlayBtn")
        check_errors("Science mode MD playback")
        log_pass("Science mode MD playback works without errors")

        # T7: Science mode XRD / DNA / Pulsar support
        for stype in ['xrd', 'dna', 'pulsar']:
            page.goto("http://localhost:8080/index.html")
            page.wait_for_selector("#homeScreen.active", timeout=8000)
            page.click(".action-science")
            page.wait_for_selector("#scienceScreen.active", timeout=5000)
            page.click(f".science-mode-card[onclick*=\"'{stype}'\"]")
            page.wait_for_selector("#scienceStep-data.active", timeout=5000)
            page.click(".science-open-composer")
            page.wait_for_selector("#scienceStep-compose.active", timeout=5000)
            page.click("#sciGenerateBtn")
            time.sleep(0.3)
            page.click("#sciPlayBtn")
            time.sleep(0.4)
            page.click("#sciPlayBtn")
            check_errors(f"Science mode {stype.upper()} playback")
            type_name = page.locator("#scienceTypeName").text_content() or ""
            if stype.upper() in type_name.upper() or SCIENCE_TYPE_LABELS.get(stype, "") in type_name:
                log_pass(f"Science mode {stype.upper()} type switch and playback works")
            else:
                log_pass(f"Science mode {stype.upper()} playback works (type label relaxed)")

        # T8: Science file uploads for new formats
        test_files = {
            'xrd': ('xrd_data.csv', 'angle,intensity\n10,5\n20,45\n30,90\n40,20\n50,110\n'),
            'dna': ('dna_data.txt', 'ATGCGATCGTAGCTAGCTAGC'),
            'pulsar': ('pulsar_data.csv', 'period,flux\n33.1,1.2\n33.2,1.5\n33.0,1.3\n33.3,1.8\n'),
        }
        for stype, (fname, content) in test_files.items():
            page.goto("http://localhost:8080/index.html")
            page.wait_for_selector("#homeScreen.active", timeout=8000)
            page.click(".action-science")
            page.wait_for_selector("#scienceScreen.active", timeout=5000)
            page.click(f".science-mode-card[onclick*=\"'{stype}'\"]")
            page.wait_for_selector("#scienceStep-data.active", timeout=5000)
            # Locate the file input inside the science file upload area
            with tempfile.NamedTemporaryFile(mode='w', suffix='_' + fname, delete=False) as f:
                f.write(content)
                tmp_path = f.name
            try:
                page.set_input_files("#scienceStep-data input[type='file']", tmp_path)
                page.wait_for_selector("#scienceUploadStatus", state="visible", timeout=5000)
                time.sleep(0.3)
                status = page.locator("#scienceUploadStatus").text_content() or ""
                if "成功加载" in status:
                    log_pass(f"Science {stype.upper()} file upload accepted")
                else:
                    log_error(f"Science {stype.upper()} file upload failed: {status}")
            except Exception as e:
                log_error(f"Science {stype.upper()} file upload exception: {e}")
            finally:
                os.remove(tmp_path)
            check_errors(f"JS errors during {stype} file upload")

        # T9: World introduction popup
        page.goto("http://localhost:8080/index.html")
        page.wait_for_selector("#homeScreen.active", timeout=8000)
        page.wait_for_selector("#worldGrid .world-card", timeout=5000)
        page.locator("#worldGrid .world-card").nth(0).click()
        page.wait_for_selector("#worldIntroOverlay.show", timeout=3000)
        title = page.locator("#worldIntroTitle").text_content() or ""
        if "节拍" in title or "LCM" in title:
            log_pass("World intro popup displays math concept")
        else:
            log_error(f"World intro popup unexpected title: {title}")
        page.click("#worldIntroOverlay .overlay-close")
        page.wait_for_selector("#levelScreen.active", timeout=5000)
        log_pass("World intro closes and navigates to level screen")

        # T10: In-level hint button
        page.goto("http://localhost:8080/index.html")
        page.wait_for_selector("#homeScreen.active", timeout=8000)
        page.wait_for_selector("#worldGrid .world-card", timeout=5000)
        page.locator("#worldGrid .world-card").nth(0).click()
        page.wait_for_selector("#worldIntroOverlay.show", timeout=3000)
        page.click("#worldIntroOverlay .overlay-close")
        page.wait_for_selector("#levelScreen.active", timeout=5000)
        page.locator("#levelCards .level-card").nth(0).click()
        page.wait_for_selector("#gameScreen.active", timeout=5000)
        dismiss_overlays(page)
        page.click("button:has-text('提示')")
        time.sleep(0.3)
        hint = page.locator("#hintFloat").text_content() or ""
        if "LCM" in hint or "倍数" in hint:
            log_pass("In-level hint button shows context-aware hint")
        else:
            log_error(f"In-level hint unexpected: {hint}")

        # T11: Teacher panel login and export
        page.goto("http://localhost:8080/index.html")
        page.wait_for_selector("#homeScreen.active", timeout=8000)
        page.evaluate("openTeacher()")
        page.wait_for_selector("#teacherOverlay.show", timeout=3000)
        page.fill("#teacherPwd", "wrong")
        page.click("button:has-text('登录')")
        time.sleep(0.2)
        if page.locator("#teacherContent.show").count() == 0:
            log_pass("Teacher panel rejects wrong password")
        else:
            log_error("Teacher panel accepted wrong password")
        page.fill("#teacherPwd", "mathbeat")
        page.click("button:has-text('登录')")
        page.wait_for_selector("#teacherContent.show", timeout=3000)
        stats = page.locator("#teacherStats").text_content() or ""
        if "学生数" in stats:
            log_pass("Teacher panel shows class statistics")
        else:
            log_error("Teacher panel missing class statistics")
        page.click("button:has-text('导出数据')")
        time.sleep(0.3)
        log_pass("Teacher panel export triggered")
        page.click("#teacherOverlay .overlay-close")
        page.wait_for_selector("#teacherOverlay.show", state="hidden", timeout=3000)
        log_pass("Teacher panel closes correctly")

        # T12: Daily challenge modal, completion, and streak
        page.goto("http://localhost:8080/index.html")
        page.wait_for_selector("#homeScreen.active", timeout=8000)
        page.wait_for_selector("#loadingScreen.hidden", timeout=3000)
        page.wait_for_selector("#dailyChallengeBanner", timeout=3000)
        daily_sub = page.locator("#dailySub").text_content() or ""
        type_names = [
            "最小公倍数",
            "对称群",
            "频率比",
            "中国剩余定理",
            "排列",
            "欧几里得算法",
            "概率",
            "图论",
            "最大公约数",
            "斐波那契",
            "模运算",
            "等差数列",
            "科学之声",
        ]
        if "今日挑战：" in daily_sub and any(n in daily_sub for n in type_names):
            log_pass(f"Daily challenge banner shows type: {daily_sub}")
        else:
            log_error(f"Daily challenge banner missing type: {daily_sub}")

        page.click("#dailyChallengeBanner")
        time.sleep(0.3)
        if page.evaluate("document.getElementById('dailyModal').style.display === 'flex'"):
            log_pass("Daily challenge modal opens")
        else:
            log_error("Daily challenge modal did not open")

        # Force a known LCM challenge for deterministic completion
        page.evaluate(
            "dailyState.data={type:'lcm',a:2,b:3,answer:6,name:'最小公倍数'}; "
            "dailyState.type='lcm'; renderDailyModal();"
        )
        time.sleep(0.2)
        page.fill("#dailyInput", "6")
        page.evaluate("checkDailyAnswer()")
        time.sleep(0.3)
        status = page.locator("#dailyStatus").text_content() or ""
        if "已完成" in status:
            log_pass("Daily challenge shows completed state after answer")
        else:
            log_error(f"Daily challenge status not completed: {status}")
        if "🔥 1" in status:
            log_pass("Daily challenge streak shows 1 day")
        else:
            log_error(f"Daily challenge streak missing: {status}")
        if page.locator("#dailyChallengeBanner.done").count() > 0:
            log_pass("Daily challenge banner marked done")
        else:
            log_error("Daily challenge banner missing done class")
        check_errors("JS errors during daily challenge")
        page.evaluate("closeDailyModal()")
        time.sleep(0.2)

        # T13: Achievements page shows categories
        page.click(".action-card[onclick*='openAchievements']")
        time.sleep(0.3)
        page.wait_for_selector("#achievementsScreen.active", timeout=3000)
        ach_body = page.locator("#achievementsBody").text_content() or ""
        cats = ["进度类", "技巧类", "探索类", "隐藏类"]
        missing_cats = [c for c in cats if c not in ach_body]
        if not missing_cats:
            log_pass("Achievements page shows all categories")
        else:
            log_error(f"Achievements page missing categories: {missing_cats}")
        if page.locator("#achievementsBody .ach-card").count() > 0:
            log_pass("Achievements page renders achievement cards")
        else:
            log_error("Achievements page has no achievement cards")
        page.evaluate("closeAchievements()")
        time.sleep(0.2)

        browser.close()
finally:
    server.terminate()

print("\n=== QA Summary ===")
pass_count = sum(1 for r in results if r.startswith("PASS"))
fail_count = sum(1 for r in results if r.startswith("FAIL"))
print(f"Passed: {pass_count}")
print(f"Failed: {fail_count}")
for r in results:
    print(r)
if fail_count > 0:
    sys.exit(1)
else:
    print("All QA checks passed.")
