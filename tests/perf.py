"""
MathBeat 浏览器 Performance 面板实测
- 使用 Playwright + Chrome DevTools Protocol 采集 DevTools Performance trace
- 同时采集 Navigation Timing、Paint Timing、Long Task、内存与 CDP Performance 指标
- 生成的 trace 可用 Chrome DevTools Performance 面板直接打开 tests/perf-trace.json
"""
import json
import os
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
DIST_DIR = ROOT / "dist"
TRACE_PATH = ROOT / "tests" / "perf-trace.json"
REPORT_PATH = ROOT / "tests" / "perf-report.json"


def start_server():
    return subprocess.Popen(
        ["python", "-m", "http.server", "8090"],
        cwd=DIST_DIR,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def seed_save(page):
    page.evaluate("localStorage.clear()")
    state = {
        "version": "1.1",
        "screen": "home",
        "currentWorld": 0,
        "currentLevel": 0,
        "progress": {"6-B": 1},
        "unlocks": {
            "drums": True,
            "bass": True,
            "melody": True,
            "chords": True,
            "euclidean": True,
            "modular": True,
            "prime": True,
            "fibonacci": True,
            "symmetry": True,
            "recursive": True,
            "cellular": True,
            "markov": True,
            "counterpoint": True,
        },
        "scienceCompositions": [],
        "diary": [],
        "settings": {
            "bgm": False,
            "sfx": False,
            "difficulty": "auto",
            "soundPack": "mathRock",
            "masterVolume": 0.8,
        },
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
            "bestScore": 0,
            "totalRounds": 0,
            "totalCorrect": 0,
            "totalQuestions": 0,
            "bestCombo": 0,
        },
        "customLevels": [],
        "composerExported": False,
        "importedSampleId": "",
        "sharedComposer": False,
        "exportedScience": False,
        "w3RatiosHeard": [],
        "w2ReflectionAxisUsed": False,
        "w2OriginalReflectionPlayed": False,
        "w6RecursiveLayersUsed": False,
        "w7MarkovEdited": False,
        "w8BossCoveredAll": False,
    }
    page.evaluate(f"localStorage.setItem('mathbeat_state', JSON.stringify({json.dumps(state)}))")


def install_observers(page):
    page.evaluate(
        """
        window.__perf = {
          longTasks: [],
          marks: [],
          frameCount: 0,
          frameStart: performance.now()
        };
        const lt = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            window.__perf.longTasks.push({
              startTime: e.startTime,
              duration: e.duration,
              name: e.name,
              attribution: e.attribution ? e.attribution.map(a => a.name) : []
            });
          }
        });
        lt.observe({ entryTypes: ['longtask'] });

        function countFrame() {
          window.__perf.frameCount++;
          requestAnimationFrame(countFrame);
        }
        requestAnimationFrame(countFrame);
        """
    )


def mark(page, name):
    page.evaluate(f"performance.mark('{name}')")


def measure(page, name, start, end):
    page.evaluate(f"performance.measure('{name}', '{start}', '{end}')")


def collect_timing(page):
    return page.evaluate(
        """
        () => {
          const nav = performance.getEntriesByType('navigation')[0];
          const paint = performance.getEntriesByType('paint');
          const measures = performance.getEntriesByType('measure');
          return { nav: nav && nav.toJSON(), paint, measures: measures.map(m => ({name:m.name, duration:m.duration, startTime:m.startTime})) };
        }
        """
    )


def collect_memory(page):
    return page.evaluate(
        """
        () => {
          const mem = performance.memory || {};
          return {
            usedJSHeapSize: mem.usedJSHeapSize || 0,
            totalJSHeapSize: mem.totalJSHeapSize || 0,
            jsHeapSizeLimit: mem.jsHeapSizeLimit || 0,
          };
        }
        """
    )


def collect_cdp_metrics(cdp):
    return {m["name"]: m["value"] for m in cdp.send("Performance.getMetrics")["metrics"]}


def run_scenario(page):
    page.goto("http://localhost:8090/index.html")
    page.wait_for_selector("#homeScreen.active", timeout=8000)
    time.sleep(0.8)
    install_observers(page)
    mark(page, "start")
    mark(page, "homeLoaded")

    # 打开各主屏
    screens = [
        (".action-science", "#scienceScreen.active", "science"),
        ("#freeModeCard", "#freeModeScreen.active", "freeMode"),
        (".action-card:has-text('成就')", "#achievementsScreen.active", "achievements"),
        (".action-card:has-text('设置')", "#settingsScreen.active", "settings"),
        (".action-card:has-text('无尽')", "#endlessModeScreen.active", "endless"),
        (".action-card:has-text('关卡编辑器')", "#levelEditorScreen.active", "levelEditor"),
    ]
    for sel, check, name in screens:
        mark(page, f"before_{name}")
        page.click(sel)
        page.wait_for_selector(check, timeout=3000)
        mark(page, f"after_{name}")
        measure(page, f"open_{name}", f"before_{name}", f"after_{name}")
        page.evaluate("showScreen('home')")
        page.wait_for_selector("#homeScreen.active", timeout=3000)

    # 弹窗
    page.click("#dailyChallengeBanner")
    page.wait_for_selector("#dailyModal", timeout=3000)
    page.evaluate("closeDailyModal()")
    time.sleep(0.2)

    page.click(".action-card:has-text('示例曲库')")
    page.wait_for_selector("#sampleLibraryModal", timeout=3000)
    page.evaluate("closeSampleLibrary()")
    time.sleep(0.2)

    # 进入世界 1 -> 关卡 1 -> 答题
    mark(page, "before_world1")
    page.click("#worldGrid .world-card")
    page.wait_for_selector("#worldIntroOverlay.show", timeout=3000)
    mark(page, "after_world1intro")
    measure(page, "open_world1intro", "before_world1", "after_world1intro")

    page.click("#worldIntroOverlay .overlay-close")
    page.wait_for_selector("#levelScreen.active", timeout=3000)
    page.locator("#levelCards .level-card").first.click()
    page.wait_for_selector("#gameScreen.active", timeout=3000)
    mark(page, "after_level1")
    measure(page, "enter_level1", "after_world1intro", "after_level1")

    # 测量帧率：在首页可视化器运行 3 秒
    page.evaluate("showScreen('home')")
    page.wait_for_selector("#homeScreen.active", timeout=3000)
    time.sleep(3)

    mark(page, "end")
    measure(page, "totalScenario", "start", "end")


def main():
    server = start_server()
    time.sleep(1.5)
    trace_events = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 520, "height": 960})
            page = context.new_page()

            page.goto("http://localhost:8090/index.html")
            seed_save(page)
            page.reload()

            cdp = context.new_cdp_session(page)
            cdp.send("Performance.enable")
            metrics_before = collect_cdp_metrics(cdp)

            # DevTools Performance trace
            cdp.on(
                "Tracing.dataCollected",
                lambda params: trace_events.extend(params.get("value", [])),
            )
            cdp.send(
                "Tracing.start",
                {
                    "categories": ",".join(
                        [
                            "devtools.timeline",
                            "disabled-by-default-devtools.timeline",
                            "disabled-by-default-devtools.timeline.frame",
                            "v8",
                            "disabled-by-default-v8.cpu_profiler",
                            "loading",
                        ]
                    ),
                    "options": "sampling-frequency=10000",
                },
            )

            run_scenario(page)

            cdp.send("Tracing.end")
            # 等待 tracingComplete
            for _ in range(50):
                if trace_events:
                    break
                time.sleep(0.1)
            time.sleep(0.5)

            metrics_after = collect_cdp_metrics(cdp)
            timing = collect_timing(page)
            memory = collect_memory(page)
            long_tasks = page.evaluate("() => window.__perf.longTasks")
            frame_count = page.evaluate("() => window.__perf.frameCount")

            browser.close()

            # 保存 trace（Chrome DevTools Performance 面板可直接打开）
            TRACE_PATH.write_text(
                json.dumps(trace_events, ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8",
            )

            # 统计长任务
            long_task_total = sum(t["duration"] for t in long_tasks)
            long_task_count = len(long_tasks)
            long_task_over_50 = [t for t in long_tasks if t["duration"] >= 50]

            # 内存变化
            mem_delta = (
                metrics_after.get("JSHeapUsedSize", 0)
                - metrics_before.get("JSHeapUsedSize", 0)
            )

            report = {
                "summary": {
                    "totalScenarioMs": next(
                        (m["duration"] for m in timing.get("measures", []) if m["name"] == "totalScenario"),
                        None,
                    ),
                    "longTaskCount": long_task_count,
                    "longTaskTotalMs": round(long_task_total, 2),
                    "longTasksOver50ms": len(long_task_over_50),
                    "homeFrameCount3s": frame_count,
                    "estimatedFps3s": round(frame_count / 3, 1),
                    "jsHeapUsedDeltaBytes": mem_delta,
                    "jsHeapUsedAfterMB": round(
                        metrics_after.get("JSHeapUsedSize", 0) / 1024 / 1024, 2
                    ),
                },
                "navigationTiming": timing.get("nav"),
                "paintTiming": timing.get("paint"),
                "screenOpenMeasures": [
                    m for m in timing.get("measures", []) if m["name"].startswith("open_")
                ],
                "cdpMetrics": {
                    "before": metrics_before,
                    "after": metrics_after,
                },
                "memory": memory,
                "longTasks": long_tasks[:20],
                "tracePath": str(TRACE_PATH.relative_to(ROOT)),
            }
            REPORT_PATH.write_text(
                json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
            )

            print("=" * 60)
            print("MathBeat Performance 实测报告")
            print("=" * 60)
            print(f"总场景耗时: {report['summary']['totalScenarioMs']:.0f} ms")
            print(f"Long Task 总数: {long_task_count}, 累计 {long_task_total:.1f} ms")
            print(f">= 50ms 长任务: {len(long_task_over_50)} 个")
            print(f"首页 3s 帧数: {frame_count}, 估算 FPS: {report['summary']['estimatedFps3s']}")
            print(f"JS Heap 增长: {mem_delta / 1024:.1f} KB")
            print(f"JS Heap 最终: {report['summary']['jsHeapUsedAfterMB']} MB")
            print(f"Trace 文件: {TRACE_PATH}")
            print(f"报告文件: {REPORT_PATH}")
            print("=" * 60)
            if long_task_over_50:
                print("严重长任务 (>50ms):")
                for t in long_task_over_50[:5]:
                    print(f"  {t['startTime']:.0f}ms +{t['duration']:.1f}ms {t['name']}")
    finally:
        server.terminate()


if __name__ == "__main__":
    main()
