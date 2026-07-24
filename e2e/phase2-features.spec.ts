import { test, expect, type Page } from '@playwright/test';

// 端到端验收：本轮新增的四个功能模块
// 1. 周末双倍 XP 活动
// 2. 今日推荐 3 题（基于薄弱点）
// 3. 成就解锁彩蛋动画（按稀有度）
// 4. 世界7 概率骰子练习入口

async function waitForApp(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('#loadingScreen.hidden', { timeout: 10000 });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    document.getElementById('tutorialOverlay')?.classList.remove('show');
  });
}

async function clearStorage(page: Page) {
  // 必须先在应用 origin 上才能访问 localStorage（about:blank 会抛 SecurityError）
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => {
    localStorage.clear();
    try {
      indexedDB.deleteDatabase('mathbeat_db');
    } catch (e) {}
  });
}

async function reloadApp(page: Page) {
  await page.reload();
  await page.waitForSelector('#loadingScreen.hidden', { timeout: 10000 });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    document.getElementById('tutorialOverlay')?.classList.remove('show');
  });
}

test.describe('周末双倍 XP 活动', () => {
  test('isWeekend 与 getXpMultiplier 已暴露到 window', async ({ page }) => {
    await waitForApp(page);
    const result = await page.evaluate(() => {
      const w = window as any;
      return {
        hasIsWeekend: typeof w.isWeekend === 'function',
        hasGetXpMultiplier: typeof w.getXpMultiplier === 'function',
        hasApplyXpMultiplier: typeof w.applyXpMultiplier === 'function',
        multiplier: w.getXpMultiplier ? w.getXpMultiplier() : null,
      };
    });
    expect(result.hasIsWeekend).toBeTruthy();
    expect(result.hasGetXpMultiplier).toBeTruthy();
    expect(result.hasApplyXpMultiplier).toBeTruthy();
    // multiplier 必须是 1 或 2
    expect([1, 2]).toContain(result.multiplier);
  });

  test('applyXpMultiplier 工作日返回原值 × 1，周末返回 × 2', async ({ page }) => {
    await waitForApp(page);
    const result = await page.evaluate(() => {
      const w = window as any;
      const multiplier = w.getXpMultiplier();
      const input = 50;
      return {
        multiplier,
        applied: w.applyXpMultiplier(input),
        // 不论何时都不应小于输入或超过 2 倍
        inRange: w.applyXpMultiplier(input) >= input && w.applyXpMultiplier(input) <= input * 2,
      };
    });
    expect(result.inRange).toBeTruthy();
    if (result.multiplier === 1) expect(result.applied).toBe(50);
    else expect(result.applied).toBe(100);
  });

  test('首页 #weekendXpBanner 元素存在且仅在周末显示', async ({ page }) => {
    await waitForApp(page);
    const result = await page.evaluate(() => {
      const w = window as any;
      const banner = document.getElementById('weekendXpBanner');
      const isWeekend = w.isWeekend();
      const display = banner ? banner.style.display : 'no-element';
      return { hasElement: !!banner, isWeekend, display };
    });
    expect(result.hasElement).toBeTruthy();
    if (result.isWeekend) {
      expect(result.display).toBe('flex');
    } else {
      expect(result.display).toBe('none');
    }
  });

  test('addXp 在周末实际应用双倍倍率', async ({ page }) => {
    await clearStorage(page);
    await reloadApp(page);
    const result = await page.evaluate(() => {
      const w = window as any;
      const before = (window as any).Store?.state?.xp || 0;
      const multiplier = w.getXpMultiplier();
      w.addXp(30, 'test');
      const after = (window as any).Store.state.xp;
      return { before, after, delta: after - before, multiplier };
    });
    expect(result.multiplier).toBeGreaterThanOrEqual(1);
    expect(result.delta).toBe(30 * result.multiplier);
  });
});

test.describe('今日推荐 3 题（基于薄弱点）', () => {
  test('generateDailyRecommendations 已暴露且返回数组', async ({ page }) => {
    await waitForApp(page);
    const result = await page.evaluate(() => {
      const w = window as any;
      if (typeof w.generateDailyRecommendations !== 'function') return { ok: false };
      const recs = w.generateDailyRecommendations();
      return {
        ok: true,
        isArray: Array.isArray(recs),
        count: recs.length,
        maxCount: recs.length <= 3,
      };
    });
    expect(result.ok).toBeTruthy();
    expect(result.isArray).toBeTruthy();
    expect(result.maxCount).toBeTruthy();
  });

  test('全新用户首推世界1-1（推进进度）', async ({ page }) => {
    await clearStorage(page);
    await reloadApp(page);
    const recs = await page.evaluate(() => (window as any).generateDailyRecommendations());
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].levelId).toBe('1-1');
    expect(recs[0].worldId).toBe(1);
    expect(recs[0].stars).toBe(0);
  });

  test('推荐关卡点击后可跳转到游戏屏（startLevel action 接通）', async ({ page }) => {
    await clearStorage(page);
    await reloadApp(page);
    // 模拟点击首页推荐卡片
    const recCard = page.locator('.rec-card').first();
    if (await recCard.count()) {
      await recCard.click();
      await page.waitForTimeout(500);
      await page.evaluate(() => {
        document.getElementById('tutorialOverlay')?.classList.remove('show');
      });
      await expect(page.locator('#gameScreen')).toHaveClass(/active/);
    } else {
      // 没渲染卡片（DOM 缺失）也算失败
      throw new Error('推荐卡片未渲染');
    }
  });

  test('通关若干关后推荐会变化（包含已通关低星关卡）', async ({ page }) => {
    await clearStorage(page);
    await reloadApp(page);
    // 给世界1-1 记一个 1 星
    await page.evaluate(() => {
      const w = window as any;
      w.Store.state.progress['1-1'] = 1;
      w.Store.save();
    });
    const recs = await page.evaluate(() => (window as any).generateDailyRecommendations());
    // 第一条应仍是 1-1（低星重练）
    expect(recs[0].levelId).toBe('1-1');
    expect(recs[0].stars).toBe(1);
    expect(recs[0].reason).toContain('重练');
  });

  test('推荐卡片不渲染未解锁关卡（如世界2 在世界1未通关时）', async ({ page }) => {
    await clearStorage(page);
    await reloadApp(page);
    const recs = await page.evaluate(() => (window as any).generateDailyRecommendations());
    // 全新用户：世界2 锁定，不应出现在推荐里
    const hasWorld2 = recs.some((r: any) => r.worldId === 2);
    expect(hasWorld2).toBeFalsy();
  });
});

test.describe('成就解锁彩蛋动画（按稀有度）', () => {
  test('showAchievementPopup 已暴露', async ({ page }) => {
    await waitForApp(page);
    const t = await page.evaluate(() => typeof (window as any).showAchievementPopup);
    expect(t).toBe('function');
  });

  test('common 成就：popup 添加 rarity-common class', async ({ page }) => {
    await waitForApp(page);
    await page.evaluate(() => {
      (window as any).showAchievementPopup('first_star');
    });
    await page.waitForTimeout(100);
    const cls = await page.evaluate(() => document.getElementById('achievementPopup')?.className || '');
    expect(cls).toContain('show');
    expect(cls).toContain('rarity-common');
  });

  test('rare 成就：popup 添加 rarity-rare class', async ({ page }) => {
    await waitForApp(page);
    await page.evaluate(() => {
      (window as any).showAchievementPopup('all_world4');
    });
    await page.waitForTimeout(100);
    const cls = await page.evaluate(() => document.getElementById('achievementPopup')?.className || '');
    expect(cls).toContain('rarity-rare');
  });

  test('epic 成就：popup 添加 rarity-epic class', async ({ page }) => {
    await waitForApp(page);
    await page.evaluate(() => {
      (window as any).showAchievementPopup('speed_runner');
    });
    await page.waitForTimeout(100);
    const cls = await page.evaluate(() => document.getElementById('achievementPopup')?.className || '');
    expect(cls).toContain('rarity-epic');
  });

  test('legendary 成就：popup 添加 rarity-legendary class', async ({ page }) => {
    await waitForApp(page);
    await page.evaluate(() => {
      (window as any).showAchievementPopup('hidden_perfect_pitch');
    });
    await page.waitForTimeout(100);
    const cls = await page.evaluate(() => document.getElementById('achievementPopup')?.className || '');
    expect(cls).toContain('rarity-legendary');
  });

  test('popup 关闭后稀有度 class 应清除', async ({ page }) => {
    await waitForApp(page);
    await page.evaluate(() => {
      // 用最短 common 3s，但我们直接测清除逻辑
      (window as any).showAchievementPopup('first_star');
    });
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => document.getElementById('achievementPopup')?.className || '')).toContain('rarity-common');
    // 等 3.5s 关闭
    await page.waitForTimeout(3500);
    const cls = await page.evaluate(() => document.getElementById('achievementPopup')?.className || '');
    expect(cls).not.toContain('rarity-common');
    expect(cls).not.toContain('show');
  });
});

test.describe('世界7 概率骰子练习入口', () => {
  test('openPracticeFromWorld7 已暴露', async ({ page }) => {
    await waitForApp(page);
    const t = await page.evaluate(() => typeof (window as any).openPracticeFromWorld7);
    expect(t).toBe('function');
  });

  test('世界7-1 关卡渲染"进入分段练习"按钮', async ({ page }) => {
    // 先解锁世界7：给世界6 boss 一星
    await clearStorage(page);
    await reloadApp(page);
    await page.evaluate(() => {
      (window as any).Store.state.progress['6-B'] = 1;
      (window as any).Store.save();
    });
    await page.evaluate(() => {
      (window as any).startLevel(7, '7-1');
    });
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      document.getElementById('tutorialOverlay')?.classList.remove('show');
    });
    // 按钮文案应包含"练习"
    const btnText = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('[data-action="w7OpenPractice"]')) as HTMLElement[];
      return btns.map((b) => b.textContent || '').join('|');
    });
    expect(btnText).toContain('练习');
  });

  test('w7OpenPractice action 已注册且可调用（不抛错）', async ({ page }) => {
    await clearStorage(page);
    await reloadApp(page);
    await page.evaluate(() => {
      (window as any).Store.state.progress['6-B'] = 1;
      (window as any).Store.save();
    });
    await page.evaluate(() => {
      (window as any).startLevel(7, '7-1');
    });
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      document.getElementById('tutorialOverlay')?.classList.remove('show');
    });
    // 直接调用 w7OpenPractice，应不抛错
    const err = await page.evaluate(() => {
      try {
        (window as any).w7OpenPractice();
        return null;
      } catch (e: any) {
        return e.message || String(e);
      }
    });
    expect(err).toBeNull();
    await page.waitForTimeout(300);
    // 应出现练习模式 UI（practice-screen 或类似容器）
    // practice-mode 通常在 #gameScreen 内替换内容
    const hasPractice = await page.evaluate(() => {
      const txt = document.getElementById('gameContent')?.innerText || '';
      return txt.includes('练习') || txt.includes('概率');
    });
    expect(hasPractice).toBeTruthy();
  });

  test('世界7-4 关卡同样有练习入口（80% 概率）', async ({ page }) => {
    await clearStorage(page);
    await reloadApp(page);
    await page.evaluate(() => {
      (window as any).Store.state.progress['6-B'] = 1;
      (window as any).Store.save();
    });
    await page.evaluate(() => {
      (window as any).startLevel(7, '7-4');
    });
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      document.getElementById('tutorialOverlay')?.classList.remove('show');
    });
    const hasBtn = await page.evaluate(() => {
      return document.querySelectorAll('[data-action="w7OpenPractice"]').length > 0;
    });
    expect(hasBtn).toBeTruthy();
  });

  test('世界7-2 马尔可夫关卡不应有练习入口（只有 7-1/7-4 骰子关卡有）', async ({ page }) => {
    await clearStorage(page);
    await reloadApp(page);
    await page.evaluate(() => {
      (window as any).Store.state.progress['6-B'] = 1;
      (window as any).Store.save();
    });
    await page.evaluate(() => {
      (window as any).startLevel(7, '7-2');
    });
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      document.getElementById('tutorialOverlay')?.classList.remove('show');
    });
    const count = await page.evaluate(() => {
      return document.querySelectorAll('[data-action="w7OpenPractice"]').length;
    });
    expect(count).toBe(0);
  });
});
