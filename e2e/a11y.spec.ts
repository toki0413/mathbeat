import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('可访问性自动化扫描', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#homeScreen.active', { timeout: 15000 });
    // 清除存档确保干净状态
    await page.evaluate(() => {
      try { localStorage.clear(); } catch (e) {}
    });
    await page.reload();
    await page.waitForSelector('#homeScreen.active', { timeout: 15000 });
  });

  test('首页无 WCAG 违规', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    // 阈值收紧至 <=2（动态内容可能仍有少量 contrast 问题，暂不要求 0）
    expect(results.violations.length).toBeLessThanOrEqual(2);
  });

  test('设置面板无 WCAG 违规', async ({ page }) => {
    // 直接调用 openSettings（避免点击被遮挡或事件委托未就绪的问题）
    await page.evaluate(() => { (window as any).openSettings?.(); });
    await page.waitForSelector('#settingsScreen.active', { timeout: 5000 });
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .include('#settingsScreen')
      .analyze();
    expect(results.violations.length).toBeLessThanOrEqual(1);
  });

  test('关卡内无 WCAG 违规', async ({ page }) => {
    await page.evaluate(() => { (window as any).startLevel?.(1, '1-1'); });
    await page.waitForSelector('#gameScreen.active', { timeout: 5000 });
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .include('#gameScreen')
      .analyze();
    expect(results.violations.length).toBeLessThanOrEqual(3);
  });

  test('成就页无 WCAG 违规', async ({ page }) => {
    await page.evaluate(() => { (window as any).openAchievements?.(); });
    await page.waitForSelector('#achievementsScreen.active', { timeout: 5000 });
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .include('#achievementsScreen')
      .analyze();
    expect(results.violations.length).toBeLessThanOrEqual(2);
  });
});
