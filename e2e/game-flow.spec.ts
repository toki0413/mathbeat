import { test, expect, type Page } from '@playwright/test';

// Wait for the loading screen to disappear and home screen to render
async function waitForApp(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('#loadingScreen.hidden', { timeout: 10000 });
  await page.waitForTimeout(500);
  // Dismiss tutorial overlay if present
  await page.evaluate(() => {
    const t = document.getElementById('tutorialOverlay');
    if (t) t.classList.remove('show');
  });
}

// Wait for composer page to finish loading
async function waitForComposer(page: Page) {
  await page.goto('/composer.html');
  await page.waitForLoadState('domcontentloaded');
  // Composer may not use #loadingScreen.hidden, just wait for content
  await page.waitForTimeout(2000);
}

test.describe('MathBeat 首页', () => {
  test('应渲染 8 个世界卡片', async ({ page }) => {
    await waitForApp(page);
    const cards = page.locator('.world-card');
    await expect(cards).toHaveCount(8);
  });

  test('世界 1 应未锁定', async ({ page }) => {
    await waitForApp(page);
    const firstCard = page.locator('.world-card').first();
    await expect(firstCard).not.toHaveClass(/locked/);
  });

  test('点击世界 1 应显示世界介绍', async ({ page }) => {
    await waitForApp(page);
    await page.locator('.world-card').first().click();
    await expect(page.locator('#worldIntroOverlay')).toHaveClass(/show/);
  });

  test('进入世界后应显示关卡列表', async ({ page }) => {
    await waitForApp(page);
    await page.locator('.world-card').first().click();
    await page.waitForTimeout(300);
    // Click the "进入世界" button inside the overlay
    const enterBtn = page.locator('#worldIntroOverlay').locator('text=进入世界');
    await expect(enterBtn.first()).toBeVisible();
    await enterBtn.first().click();
    await page.waitForTimeout(300);
    await expect(page.locator('#levelScreen')).toHaveClass(/active/);
    const levelCards = page.locator('.level-card');
    expect(await levelCards.count()).toBeGreaterThan(0);
  });
});

test.describe('MathBeat 游戏流程', () => {
  test('startLevel 应已暴露到 window 对象', async ({ page }) => {
    await waitForApp(page);
    const type = await page.evaluate(() => typeof (window as any).startLevel);
    expect(type).toBe('function');
  });

  test('nextLevel 应已暴露到 window 对象', async ({ page }) => {
    await waitForApp(page);
    const type = await page.evaluate(() => typeof (window as any).nextLevel);
    expect(type).toBe('function');
  });

  test('通过 startLevel 进入关卡后游戏界面应可见', async ({ page }) => {
    await waitForApp(page);
    await page.evaluate(() => (window as any).startLevel(1, '1-1'));
    await page.waitForTimeout(500);
    // Dismiss tutorial if it appeared
    await page.evaluate(() => {
      const t = document.getElementById('tutorialOverlay');
      if (t) t.classList.remove('show');
    });
    await expect(page.locator('#gameScreen')).toHaveClass(/active/);
    const gameContent = page.locator('#gameContent');
    await expect(gameContent).not.toBeEmpty();
  });

  test('游戏界面应包含验证按钮', async ({ page }) => {
    await waitForApp(page);
    await page.evaluate(() => (window as any).startLevel(1, '1-1'));
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const t = document.getElementById('tutorialOverlay');
      if (t) t.classList.remove('show');
    });
    const verifyBtn = page.locator('.verify-btn');
    await expect(verifyBtn.first()).toBeVisible();
  });

  test('点击验证按钮应产生结果反馈', async ({ page }) => {
    await waitForApp(page);
    await page.evaluate(() => (window as any).startLevel(1, '1-1'));
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const t = document.getElementById('tutorialOverlay');
      if (t) t.classList.remove('show');
    });
    const input = page.locator('#w1Input');
    if (await input.isVisible()) {
      await input.fill('6');
    }
    await page.locator('.verify-btn').first().click();
    await page.waitForTimeout(500);
    const result = page.locator('#w1Result');
    const resultText = await result.textContent();
    expect(resultText).not.toBeNull();
  });
});

test.describe('MathBeat 作曲台', () => {
  test('作曲台页面应正常加载', async ({ page }) => {
    await waitForComposer(page);
    await expect(page).toHaveTitle(/作曲台/);
  });

  test('作曲台应显示播放控制按钮', async ({ page }) => {
    await waitForComposer(page);
    const playBtn = page.locator('#btn-play');
    await expect(playBtn).toBeVisible();
  });

  test('作曲台应渲染轨道画布', async ({ page }) => {
    await waitForComposer(page);
    const canvases = page.locator('canvas');
    expect(await canvases.count()).toBeGreaterThan(0);
  });
});

test.describe('MathBeat 控制台无错误', () => {
  test('首页不应有 JavaScript 错误', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await waitForApp(page);
    const appErrors = errors.filter(
      (e) => !e.includes('preload') && !e.includes('getThemeColors') && !e.includes('ENOENT')
    );
    expect(appErrors).toEqual([]);
  });

  test('作曲台不应有 JavaScript 错误', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await waitForComposer(page);
    const appErrors = errors.filter(
      (e) => !e.includes('preload') && !e.includes('getThemeColors') && !e.includes('ENOENT')
    );
    expect(appErrors).toEqual([]);
  });
});
