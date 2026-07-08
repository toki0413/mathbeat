import { test, expect, type Page } from '@playwright/test';

async function wait(page: Page, ms: number) { await page.waitForTimeout(ms); }

async function waitForApp(page: Page) {
  await page.goto('/');
  await page.waitForSelector('#loadingScreen.hidden', { timeout: 10000 });
  await page.waitForTimeout(500);
  await page.evaluate(() => { document.getElementById('tutorialOverlay')?.classList.remove('show'); });
}

// Read progress from localStorage (Store.save() persists there)
async function getProgress(page: Page): Promise<Record<string, number>> {
  return await page.evaluate(() => {
    try {
      const raw = localStorage.getItem('mathbeat_state') || '{}';
      const data = JSON.parse(raw);
      return data.progress || {};
    } catch { return {}; }
  });
}

// Play boss level: start composer, apply gen, start playing, then finish
async function playBoss(page: Page, wid: number, lid: string) {
  await page.evaluate((data: any) => {
    (window as any).startLevel(data.wid, data.lid);
  }, { wid, lid });
  await wait(page, 500);

  await page.evaluate((data: any) => {
    document.getElementById('bossProblemOverlay')?.classList.remove('show');
    (window as any).startBossComposer(data.wid, data.lid);
  }, { wid, lid });
  await wait(page, 800);

  await page.evaluate(() => { (window as any).mcApplyGen?.(); });
  await wait(page, 300);

  // Start playing first, then finish (mcComplete runs directly when playing=true)
  await page.evaluate(() => {
    try { (window as any).mcStart?.(); } catch (e) { /* audio may fail in headless */ }
  });
  await wait(page, 300);
  await page.evaluate(() => {
    try { (window as any).mcFinish?.(); } catch (e) { /* ignore */ }
  });
  await wait(page, 3000);
}

test.describe('完整通关测试', () => {

  test('通关 World 1: LCM & Poly-rhythm (6关)', async ({ page }) => {
    await waitForApp(page);

    const levels: Record<string, number> = { '1-1': 6, '1-2': 12, '1-3': 20, '1-4': 35, '1-5': 24 };
    for (const [lid, lcm] of Object.entries(levels)) {
      await page.evaluate((lid: string) => { (window as any).startLevel(1, lid); }, lid);
      await wait(page, 600);
      await page.evaluate(() => { document.getElementById('tutorialOverlay')?.classList.remove('show'); });
      await page.evaluate((v: number) => {
        const i = document.getElementById('w1Input') as HTMLInputElement;
        if (i) i.value = String(v);
        (window as any).w1Verify?.();
      }, lcm);
      await wait(page, 300);
      await page.evaluate(() => { (window as any).nextLevel(); });
      await wait(page, 300);
    }

    await playBoss(page, 1, '1-B');
    const progress = await getProgress(page);
    expect(progress['1-B']).toBeGreaterThan(0);
  });

  test('通关 World 2: Symmetry & Harmony (6关)', async ({ page }) => {
    await waitForApp(page);

    const setups: Record<string, () => void> = {
      '2-1': () => { const w: any = window; w.w2ToggleNote?.(0); w.w2ToggleNote?.(4); w.w2ToggleNote?.(7); w.w2Verify?.(); },
      '2-2': () => { const w: any = window; w.w2ToggleNote?.(0); w.w2ToggleNote?.(4); w.w2ToggleNote?.(7); w.w2Rotate?.(); w.w2Verify?.(); },
      '2-3': () => { const w: any = window; w.w2ToggleNote?.(0); w.w2ToggleNote?.(4); w.w2ToggleNote?.(7); w.w2Reflect?.(); w.w2Verify?.(); },
      '2-4': () => { const w: any = window; w.w2ToggleNote?.(0); w.w2ToggleNote?.(4); w.w2ToggleNote?.(7); w.w2ToggleNote?.(11); w.w2Verify?.(); },
      '2-5': () => { const w: any = window; w.w2ToggleNote?.(0); w.w2ToggleNote?.(4); w.w2ToggleNote?.(7); w.w2Rotate?.(); w.w2Reflect?.(); w.w2Verify?.(); },
    };
    for (const lid of ['2-1', '2-2', '2-3', '2-4', '2-5']) {
      await page.evaluate((lid: string) => { (window as any).startLevel(2, lid); }, lid);
      await wait(page, 600);
      await page.evaluate(() => { document.getElementById('tutorialOverlay')?.classList.remove('show'); });
      await page.evaluate(setups[lid]);
      await wait(page, 400);
      await page.evaluate(() => { (window as any).nextLevel(); });
      await wait(page, 300);
    }

    await playBoss(page, 2, '2-B');
    const progress = await getProgress(page);
    expect(progress['2-B']).toBeGreaterThan(0);
  });

  test('通关 World 3: Frequencies & Exponents (6关)', async ({ page }) => {
    await waitForApp(page);

    const levels: Record<string, number> = { '3-1': 660, '3-2': 550, '3-3': 770, '3-4': 495, '3-5': 587 };
    for (const [lid, freq] of Object.entries(levels)) {
      await page.evaluate((lid: string) => { (window as any).startLevel(3, lid); }, lid);
      await wait(page, 600);
      await page.evaluate(() => { document.getElementById('tutorialOverlay')?.classList.remove('show'); });
      await page.evaluate((f: number) => {
        const s = document.getElementById('w3Slider') as HTMLInputElement;
        if (s) { s.value = String(f); s.dispatchEvent(new Event('input', { bubbles: true })); }
        (window as any).w3Verify?.();
      }, freq);
      await wait(page, 400);
      await page.evaluate(() => { (window as any).nextLevel(); });
      await wait(page, 300);
    }

    await playBoss(page, 3, '3-B');
    const progress = await getProgress(page);
    expect(progress['3-B']).toBeGreaterThan(0);
  });

  test('通关 World 4: Modular Arithmetic (6关)', async ({ page }) => {
    await waitForApp(page);

    const levels: Record<string, number> = { '4-1': 15, '4-2': 12, '4-3': 35, '4-4': 40, '4-5': 18 };
    for (const [lid, lcm] of Object.entries(levels)) {
      await page.evaluate((lid: string) => { (window as any).startLevel(4, lid); }, lid);
      await wait(page, 600);
      await page.evaluate(() => { document.getElementById('tutorialOverlay')?.classList.remove('show'); });
      await page.evaluate((v: number) => {
        const i = document.getElementById('w4Input') as HTMLInputElement;
        if (i) i.value = String(v);
        (window as any).w4Verify?.();
      }, lcm);
      await wait(page, 300);
      await page.evaluate(() => { (window as any).nextLevel(); });
      await wait(page, 300);
    }

    await playBoss(page, 4, '4-B');
    const progress = await getProgress(page);
    expect(progress['4-B']).toBeGreaterThan(0);
  });

  test('通关 World 5: Permutations & Melody (6关)', async ({ page }) => {
    await waitForApp(page);

    const setups: Record<string, () => void> = {
      '5-1': () => { const w: any = window; w.w5CellClick?.(0); w.w5CellClick?.(1); w.w5Verify?.(); },
      '5-2': () => { const w: any = window; w.w5CellClick?.(0); w.w5CellClick?.(1); w.w5ToggleOp?.('retro'); w.w5Verify?.(); },
      '5-3': () => { const w: any = window; w.w5CellClick?.(0); w.w5CellClick?.(1); w.w5ToggleOp?.('rotate'); w.w5Verify?.(); },
      '5-4': () => { const w: any = window; w.w5CellClick?.(0); w.w5CellClick?.(1); w.w5ToggleOp?.('retro'); w.w5Verify?.(); },
      '5-5': () => { const w: any = window; w.w5CellClick?.(0); w.w5CellClick?.(1); w.w5ToggleOp?.('invert'); w.w5ToggleOp?.('rotate'); w.w5Verify?.(); },
    };
    for (const lid of ['5-1', '5-2', '5-3', '5-4', '5-5']) {
      await page.evaluate((lid: string) => { (window as any).startLevel(5, lid); }, lid);
      await wait(page, 600);
      await page.evaluate(() => { document.getElementById('tutorialOverlay')?.classList.remove('show'); });
      await page.evaluate(setups[lid]);
      await wait(page, 400);
      await page.evaluate(() => { (window as any).nextLevel(); });
      await wait(page, 300);
    }

    await playBoss(page, 5, '5-B');
    const progress = await getProgress(page);
    expect(progress['5-B']).toBeGreaterThan(0);
  });

  test('通关 World 6: Recursion & Fractals (6关)', async ({ page }) => {
    await waitForApp(page);

    for (const lid of ['6-1', '6-2', '6-3', '6-4', '6-5']) {
      await page.evaluate((lid: string) => { (window as any).startLevel(6, lid); }, lid);
      await wait(page, 600);
      await page.evaluate(() => { document.getElementById('tutorialOverlay')?.classList.remove('show'); });
      await page.evaluate(() => { (window as any).w6ApplyEuclid?.(); });
      await wait(page, 300);
      await page.evaluate(() => { (window as any).w6Verify?.(); });
      await wait(page, 400);
      await page.evaluate(() => { (window as any).nextLevel(); });
      await wait(page, 300);
    }

    await playBoss(page, 6, '6-B');
    const progress = await getProgress(page);
    expect(progress['6-B']).toBeGreaterThan(0);
  });

  test('通关 World 7: Probability & Random (6关)', async ({ page }) => {
    await waitForApp(page);

    const setups: Record<string, () => void> = {
      '7-1': () => { const w: any = window; w.w7RollDice?.(); w.w7RollDice?.(); w.w7RollDice?.(); w.w7Verify?.(); },
      '7-2': () => { const w: any = window; w.w7MarkovNormalize?.(); w.w7MarkovGen?.(); w.w7MarkovVerify?.(); },
      '7-3': () => { const w: any = window; w.w7NormalGen?.(); w.w7NormalVerify?.(); },
      '7-4': () => { const w: any = window; w.w7RollDice?.(); w.w7RollDice?.(); w.w7RollDice?.(); w.w7Verify?.(); },
      '7-5': () => { const w: any = window; w.w7MarkovNormalize?.(); w.w7MarkovGen?.(); w.w7MarkovVerify?.(); },
    };
    for (const lid of ['7-1', '7-2', '7-3', '7-4', '7-5']) {
      await page.evaluate((lid: string) => { (window as any).startLevel(7, lid); }, lid);
      await wait(page, 600);
      await page.evaluate(() => { document.getElementById('tutorialOverlay')?.classList.remove('show'); });
      await page.evaluate(setups[lid]);
      await wait(page, 400);
      await page.evaluate(() => { (window as any).nextLevel(); });
      await wait(page, 300);
    }

    await playBoss(page, 7, '7-B');
    const progress = await getProgress(page);
    expect(progress['7-B']).toBeGreaterThan(0);
  });

  test('通关 World 8: Graph Theory (6关)', async ({ page }) => {
    await waitForApp(page);

    const setups: Record<string, () => void> = {
      '8-1': () => { const w: any = window; w.w8PathClick?.(0); w.w8PathClick?.(1); w.w8PathClick?.(2); w.w8PathClick?.(3); w.w8PathVerify?.(); },
      '8-2': () => { const w: any = window; w.w8MatrixToggle?.(0,1); w.w8MatrixToggle?.(1,2); w.w8MatrixToggle?.(2,3); w.w8MatrixToggle?.(3,0); w.w8MatrixGen?.(); w.w8MatrixVerify?.(); },
      '8-3': () => { const w: any = window; w.w8DijkstraRun?.(); w.w8DijkstraVerify?.(); },
      '8-4': () => { const w: any = window; w.w8PathClick?.(0); w.w8PathClick?.(1); w.w8PathClick?.(2); w.w8PathClick?.(3); w.w8PathVerify?.(); },
      '8-5': () => { const w: any = window; w.w8MatrixToggle?.(0,1); w.w8MatrixToggle?.(1,2); w.w8MatrixToggle?.(2,3); w.w8MatrixToggle?.(3,0); w.w8MatrixGen?.(); w.w8MatrixVerify?.(); },
    };
    for (const lid of ['8-1', '8-2', '8-3', '8-4', '8-5']) {
      await page.evaluate((lid: string) => { (window as any).startLevel(8, lid); }, lid);
      await wait(page, 600);
      await page.evaluate(() => { document.getElementById('tutorialOverlay')?.classList.remove('show'); });
      await page.evaluate(setups[lid]);
      await wait(page, 400);
      await page.evaluate(() => { (window as any).nextLevel(); });
      await wait(page, 300);
    }

    await playBoss(page, 8, '8-B');
    const progress = await getProgress(page);
    expect(progress['8-B']).toBeGreaterThan(0);
  });
});

test.describe('附加功能测试', () => {
  test('每日挑战可访问', async ({ page }) => {
    await waitForApp(page);
    await page.evaluate(() => { (window as any).startDailyChallenge?.(); });
    await wait(page, 800);
    const result = await page.evaluate(() => {
      const modal = document.getElementById('dailyModal');
      const body = document.getElementById('dailyBody');
      return {
        modalVisible: modal ? modal.style.display === 'flex' : false,
        bodyHasContent: body ? body.innerText.length > 0 : false,
      };
    });
    expect(result.modalVisible && result.bodyHasContent).toBeTruthy();
  });

  test('无尽模式可访问', async ({ page }) => {
    await waitForApp(page);
    await page.evaluate(() => { (window as any).openEndlessMode?.(); });
    await wait(page, 500);
    const result = await page.evaluate(() => {
      const screen = document.getElementById('endlessModeScreen');
      const body = document.getElementById('endlessBody');
      return {
        screenActive: screen ? screen.classList.contains('active') : false,
        bodyHasContent: body ? body.innerText.length > 0 : false,
      };
    });
    expect(result.screenActive && result.bodyHasContent).toBeTruthy();
  });

  test('作曲台完整功能', async ({ page }) => {
    await page.goto('/composer.html');
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => { document.getElementById('loadingScreen')?.classList.add('hidden'); });
    await page.waitForTimeout(2000);
    const playBtn = page.locator('#btn-play');
    await expect(playBtn).toBeVisible();
    const canvases = page.locator('canvas');
    expect(await canvases.count()).toBeGreaterThan(0);
  });

  test('成就页面可访问', async ({ page }) => {
    await waitForApp(page);
    await page.evaluate(() => { (window as any).openAchievements?.(); });
    await wait(page, 500);
    const result = await page.evaluate(() => {
      const screen = document.getElementById('achievementsScreen');
      const body = document.getElementById('achievementsBody');
      return {
        screenActive: screen ? screen.classList.contains('active') : false,
        bodyHasContent: body ? body.innerText.length > 0 : false,
      };
    });
    expect(result.screenActive && result.bodyHasContent).toBeTruthy();
  });
});
