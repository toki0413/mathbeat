import { test, expect } from '@playwright/test';

test.describe('教师鉴权安全', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#homeScreen.active', { timeout: 15000 });
  });

  test('空密码不应进入教师面板', async ({ page }) => {
    await page.evaluate(() => { (window as any).openTeacher?.(); });
    await page.waitForSelector('#teacherLogin', { timeout: 5000 });
    // 直接调用 teacherLogin 传空密码
    await page.evaluate(() => {
      const pwdInput = document.getElementById('teacherPwd') as HTMLInputElement;
      pwdInput.value = '';
      return (window as any).teacherLogin?.();
    });
    // 等 200ms 确认未放行
    await page.waitForTimeout(200);
    const entered = await page.evaluate(() => document.getElementById('teacherContent')?.classList.contains('show'));
    expect(entered).toBe(false);
  });

  test('错误密码不应进入教师面板', async ({ page }) => {
    await page.evaluate(() => { (window as any).openTeacher?.(); });
    await page.waitForSelector('#teacherLogin', { timeout: 5000 });
    await page.evaluate(() => {
      const pwdInput = document.getElementById('teacherPwd') as HTMLInputElement;
      pwdInput.value = 'wrongpassword';
      (window as any).teacherLogin?.();
    });
    await page.waitForTimeout(500); // PBKDF2 100k 迭代需时间
    const entered = await page.evaluate(() => document.getElementById('teacherContent')?.classList.contains('show'));
    expect(entered).toBe(false);
  });

  test('鉴权异常时 fail-closed（不进入面板）', async ({ page }) => {
    await page.evaluate(() => { (window as any).openTeacher?.(); });
    await page.waitForSelector('#teacherLogin', { timeout: 5000 });
    // 破坏 crypto.subtle 让 verifyTeacherPassword 抛错
    await page.evaluate(() => {
      Object.defineProperty(window.crypto, 'subtle', { value: undefined, configurable: true });
      const pwdInput = document.getElementById('teacherPwd') as HTMLInputElement;
      pwdInput.value = 'anything';
      (window as any).teacherLogin?.();
    });
    await page.waitForTimeout(300);
    const entered = await page.evaluate(() => document.getElementById('teacherContent')?.classList.contains('show'));
    expect(entered).toBe(false); // fail-closed
  });
});
