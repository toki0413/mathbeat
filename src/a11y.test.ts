import { describe, it, expect, beforeEach } from 'vitest';
import { initA11y, announce, openModal, closeModal } from './a11y';

describe('a11y', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    // 重新挂载 aria-live 区并刷新模块内引用（announce 依赖模块级变量）
    initA11y();
  });

  describe('initA11y', () => {
    it('creates polite + assertive aria-live regions', () => {
      initA11y();
      const polite = document.getElementById('srLivePolite');
      const assertive = document.getElementById('srLiveAssertive');
      expect(polite).not.toBeNull();
      expect(assertive).not.toBeNull();
      expect(polite!.getAttribute('aria-live')).toBe('polite');
      expect(assertive!.getAttribute('aria-live')).toBe('assertive');
      expect(polite!.getAttribute('role')).toBe('status');
      expect(assertive!.getAttribute('role')).toBe('alert');
    });

    it('is idempotent (does not duplicate regions)', () => {
      initA11y();
      initA11y();
      expect(document.querySelectorAll('#srLivePolite')).toHaveLength(1);
      expect(document.querySelectorAll('#srLiveAssertive')).toHaveLength(1);
    });
  });

  describe('announce', () => {
    it('writes polite messages to the polite region', async () => {
      announce('关卡完成', 'polite');
      await new Promise((r) => setTimeout(r, 80));
      const polite = document.getElementById('srLivePolite');
      expect(polite!.textContent).toBe('关卡完成');
    });

    it('writes assertive messages to the assertive region', async () => {
      announce('密码错误', 'assertive');
      await new Promise((r) => setTimeout(r, 80));
      const assertive = document.getElementById('srLiveAssertive');
      expect(assertive!.textContent).toBe('密码错误');
    });

    it('overwrites previous message (re-announces)', async () => {
      announce('第一条', 'polite');
      await new Promise((r) => setTimeout(r, 80));
      announce('第二条', 'polite');
      await new Promise((r) => setTimeout(r, 80));
      const polite = document.getElementById('srLivePolite');
      expect(polite!.textContent).toBe('第二条');
    });
  });

  describe('openModal / closeModal', () => {
    it('sets role=dialog, aria-modal=true, aria-hidden=false and focuses first control', () => {
      const modal = document.createElement('div');
      modal.innerHTML = '<button id="firstBtn">关闭</button>';
      document.body.appendChild(modal);
      openModal(modal, 'someTitle');
      expect(modal.getAttribute('role')).toBe('dialog');
      expect(modal.getAttribute('aria-modal')).toBe('true');
      expect(modal.getAttribute('aria-hidden')).toBe('false');
      expect(modal.getAttribute('aria-labelledby')).toBe('someTitle');
      expect(modal.classList.contains('show')).toBe(true);
    });

    it('closeModal hides modal and sets aria-hidden=true', () => {
      const modal = document.createElement('div');
      document.body.appendChild(modal);
      openModal(modal);
      closeModal(modal);
      expect(modal.classList.contains('show')).toBe(false);
      expect(modal.getAttribute('aria-hidden')).toBe('true');
    });

    it('openModal without labelId does not set aria-labelledby', () => {
      const modal = document.createElement('div');
      document.body.appendChild(modal);
      openModal(modal);
      expect(modal.hasAttribute('aria-labelledby')).toBe(false);
    });

    it('closeModal restores focus to the previously focused element', () => {
      const trigger = document.createElement('button');
      trigger.id = 'trigger';
      document.body.appendChild(trigger);
      trigger.focus();
      const modal = document.createElement('div');
      document.body.appendChild(modal);
      openModal(modal);
      closeModal(modal);
      expect(document.activeElement).toBe(trigger);
    });
  });
});
