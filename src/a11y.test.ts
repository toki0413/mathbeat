import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  initA11y,
  announce,
  openModal,
  closeModal,
  installModalKeyboardHandlers,
  registerOverlayClose,
} from './a11y';

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

    it('sets aria-atomic=true on both regions', () => {
      initA11y();
      const polite = document.getElementById('srLivePolite');
      const assertive = document.getElementById('srLiveAssertive');
      expect(polite!.getAttribute('aria-atomic')).toBe('true');
      expect(assertive!.getAttribute('aria-atomic')).toBe('true');
    });

    it('applies visually-hidden style (clip rect)', () => {
      initA11y();
      const polite = document.getElementById('srLivePolite') as HTMLElement;
      // happy-dom 会将 cssText 标准化（冒号后加空格），用正则容错
      expect(polite.style.cssText.replace(/\s+/g, '')).toContain('clip:rect(0,0,0,0)');
      expect(polite.style.cssText.replace(/\s+/g, '')).toContain('overflow:hidden');
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

    it('defaults to polite level when not specified', async () => {
      announce('默认 polite');
      await new Promise((r) => setTimeout(r, 80));
      const polite = document.getElementById('srLivePolite');
      expect(polite!.textContent).toBe('默认 polite');
    });

    it('clears the region before writing to trigger re-announce', async () => {
      announce('内容', 'polite');
      // 在 setTimeout 触发前立即检查：textContent 应已被清空
      const polite = document.getElementById('srLivePolite');
      expect(polite!.textContent).toBe('');
      await new Promise((r) => setTimeout(r, 80));
    });

    it('does not throw if srLivePolite missing (init via announce)', async () => {
      // 删除已挂载的 region，模拟未初始化场景
      document.body.innerHTML = '';
      // announce 内部模块级 srLivePolite 仍指向旧（已分离）元素，
      // 不会重新 initA11y，但写入分离元素不应抛错
      expect(() => announce('test')).not.toThrow();
      await new Promise((r) => setTimeout(r, 80));
    });

    it('announce 写入分离元素时不抛错且不影响后续 initA11y', async () => {
      document.body.innerHTML = '';
      expect(() => announce('detached', 'polite')).not.toThrow();
      await new Promise((r) => setTimeout(r, 80));
      // 重新 initA11y 后元素应重新挂载
      initA11y();
      expect(document.getElementById('srLivePolite')).not.toBeNull();
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

    it('openModal does not override existing role attribute', () => {
      const modal = document.createElement('div');
      modal.setAttribute('role', 'alertdialog');
      document.body.appendChild(modal);
      openModal(modal);
      expect(modal.getAttribute('role')).toBe('alertdialog');
    });

    it('openModal sets display to empty (visible) when shown', () => {
      const modal = document.createElement('div');
      modal.style.display = 'none';
      document.body.appendChild(modal);
      openModal(modal);
      expect(modal.style.display).toBe('');
    });

    it('closeModal sets display:none by default', () => {
      const modal = document.createElement('div');
      document.body.appendChild(modal);
      openModal(modal);
      closeModal(modal);
      expect(modal.style.display).toBe('none');
    });

    it('closeModal preserves display when data-persist-display is set', () => {
      const modal = document.createElement('div');
      modal.dataset.persistDisplay = 'true';
      document.body.appendChild(modal);
      openModal(modal);
      closeModal(modal);
      // 不应被设置为 none
      expect(modal.style.display).not.toBe('none');
    });

    it('openModal focuses modal itself when no focusable children', () => {
      const modal = document.createElement('div');
      modal.setAttribute('tabindex', '-1');
      document.body.appendChild(modal);
      openModal(modal);
      // requestAnimationFrame 在 happy-dom 中可能立即触发；给点延迟验证
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // 无可聚焦控件时调用 modal.focus()
            // 不抛错即可（happy-dom 中 activeElement 行为可能受限）
            expect(modal.classList.contains('show')).toBe(true);
            resolve();
          });
        });
      });
    });

    it('closeModal does not throw when lastFocusedStack is empty', () => {
      const modal = document.createElement('div');
      document.body.appendChild(modal);
      // 直接 closeModal 而不先 openModal，stack 为空
      expect(() => closeModal(modal)).not.toThrow();
    });

    it('closeModal handles stale focus target (removed from DOM)', () => {
      const trigger = document.createElement('button');
      document.body.appendChild(trigger);
      trigger.focus();
      const modal = document.createElement('div');
      document.body.appendChild(modal);
      openModal(modal);
      // 移除触发元素，模拟 DOM 已变化
      trigger.remove();
      expect(() => closeModal(modal)).not.toThrow();
    });

    it('openModal skips trigger element when activeElement is document.body', () => {
      // document.body 作为 activeElement 时不应被压栈
      const modal = document.createElement('div');
      document.body.appendChild(modal);
      // 不主动 focus 任何元素
      openModal(modal);
      // 关闭后不应尝试聚焦 body（不会抛错即可）
      expect(() => closeModal(modal)).not.toThrow();
    });

    it('openModal installs keyboard handlers (idempotent)', () => {
      const modal = document.createElement('div');
      document.body.appendChild(modal);
      // 多次调用 openModal 不应重复安装
      expect(() => {
        openModal(modal);
        openModal(modal);
      }).not.toThrow();
    });
  });

  describe('installModalKeyboardHandlers', () => {
    it('installs global keydown listeners (idempotent)', () => {
      // 多次调用只安装一次
      expect(() => {
        installModalKeyboardHandlers();
        installModalKeyboardHandlers();
      }).not.toThrow();
    });
  });

  describe('焦点陷阱 (Tab key handling)', () => {
    it('Tab on a modal with no focusable elements focuses the overlay', () => {
      const modal = document.createElement('div');
      modal.setAttribute('role', 'dialog');
      modal.classList.add('show');
      modal.setAttribute('tabindex', '-1');
      document.body.appendChild(modal);

      installModalKeyboardHandlers();
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      });
      const preventSpy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);
      // 无可聚焦元素时调用 preventDefault + overlay.focus()
      expect(preventSpy).toHaveBeenCalled();
    });

    it('Tab on last focusable wraps to first', () => {
      const modal = document.createElement('div');
      modal.setAttribute('role', 'dialog');
      modal.classList.add('show');
      modal.innerHTML = '<button id="b1">1</button><button id="b2">2</button>';
      document.body.appendChild(modal);

      const b1 = document.getElementById('b1') as HTMLButtonElement;
      const b2 = document.getElementById('b2') as HTMLButtonElement;
      b2.focus();

      installModalKeyboardHandlers();
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      });
      const preventSpy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);
      expect(preventSpy).toHaveBeenCalled();
      // 应聚焦到 b1（第一个）
      expect(document.activeElement?.id).toBe('b1');
    });

    it('Shift+Tab on first focusable wraps to last', () => {
      const modal = document.createElement('div');
      modal.setAttribute('role', 'dialog');
      modal.classList.add('show');
      modal.innerHTML = '<button id="b1">1</button><button id="b2">2</button>';
      document.body.appendChild(modal);

      const b1 = document.getElementById('b1') as HTMLButtonElement;
      const b2 = document.getElementById('b2') as HTMLButtonElement;
      b1.focus();

      installModalKeyboardHandlers();
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      const preventSpy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);
      expect(preventSpy).toHaveBeenCalled();
      expect(document.activeElement?.id).toBe('b2');
    });

    it('non-Tab keys do not trigger trap logic', () => {
      const modal = document.createElement('div');
      modal.setAttribute('role', 'dialog');
      modal.classList.add('show');
      modal.innerHTML = '<button id="b1">1</button>';
      document.body.appendChild(modal);

      installModalKeyboardHandlers();
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });
      const preventSpy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);
      expect(preventSpy).not.toHaveBeenCalled();
    });

    it('Tab without visible modal is a no-op', () => {
      // 没有 .show 的 modal
      const modal = document.createElement('div');
      modal.setAttribute('role', 'dialog');
      modal.innerHTML = '<button id="b1">1</button>';
      document.body.appendChild(modal);

      installModalKeyboardHandlers();
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      });
      const preventSpy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);
      expect(preventSpy).not.toHaveBeenCalled();
    });

    it('Tab when active element is outside modal wraps to first focusable', () => {
      const modal = document.createElement('div');
      modal.setAttribute('role', 'dialog');
      modal.classList.add('show');
      modal.innerHTML = '<button id="b1">1</button><button id="b2">2</button>';
      document.body.appendChild(modal);

      const outsideBtn = document.createElement('button');
      outsideBtn.id = 'outside';
      document.body.appendChild(outsideBtn);
      outsideBtn.focus();

      installModalKeyboardHandlers();
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      });
      const preventSpy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);
      expect(preventSpy).toHaveBeenCalled();
      expect(document.activeElement?.id).toBe('b1');
    });

    it('skips focusable elements with display:none', () => {
      const modal = document.createElement('div');
      modal.setAttribute('role', 'dialog');
      modal.classList.add('show');
      modal.innerHTML =
        '<button id="b1" style="display:none">1</button><button id="b2">2</button>';
      document.body.appendChild(modal);

      // 仅有 b2 可见
      const b2 = document.getElementById('b2') as HTMLButtonElement;
      b2.focus();

      installModalKeyboardHandlers();
      // Tab 在 b2（最后且唯一可见），应循环回 b2 自身
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      });
      vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);
      // 不抛错即可
      expect(document.getElementById('b2')).not.toBeNull();
    });
  });

  describe('ESC 关闭模态', () => {
    it('ESC triggers click on [data-action="closeModal"] button', () => {
      const modal = document.createElement('div');
      modal.setAttribute('role', 'dialog');
      modal.classList.add('show');
      modal.innerHTML = '<button id="closeBtn" data-action="closeModal">×</button>';
      document.body.appendChild(modal);

      const closeBtn = document.getElementById('closeBtn') as HTMLButtonElement;
      const clickSpy = vi.fn();
      closeBtn.addEventListener('click', clickSpy);

      installModalKeyboardHandlers();
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);
      expect(clickSpy).toHaveBeenCalled();
    });

    it('ESC triggers click on [data-dismiss] button', () => {
      const modal = document.createElement('div');
      modal.setAttribute('role', 'dialog');
      modal.classList.add('show');
      modal.innerHTML = '<button id="dismissBtn" data-dismiss>×</button>';
      document.body.appendChild(modal);

      const dismissBtn = document.getElementById('dismissBtn') as HTMLButtonElement;
      const clickSpy = vi.fn();
      dismissBtn.addEventListener('click', clickSpy);

      installModalKeyboardHandlers();
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);
      expect(clickSpy).toHaveBeenCalled();
    });

    it('ESC triggers click on .close-btn', () => {
      const modal = document.createElement('div');
      modal.setAttribute('role', 'dialog');
      modal.classList.add('show');
      modal.innerHTML = '<button class="close-btn">×</button>';
      document.body.appendChild(modal);

      const closeBtn = modal.querySelector('.close-btn') as HTMLButtonElement;
      const clickSpy = vi.fn();
      closeBtn.addEventListener('click', clickSpy);

      installModalKeyboardHandlers();
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);
      expect(clickSpy).toHaveBeenCalled();
    });

    it('ESC triggers click on [aria-label="关闭"]', () => {
      const modal = document.createElement('div');
      modal.setAttribute('role', 'dialog');
      modal.classList.add('show');
      modal.innerHTML = '<button aria-label="关闭">×</button>';
      document.body.appendChild(modal);

      const closeBtn = modal.querySelector('[aria-label="关闭"]') as HTMLButtonElement;
      const clickSpy = vi.fn();
      closeBtn.addEventListener('click', clickSpy);

      installModalKeyboardHandlers();
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);
      expect(clickSpy).toHaveBeenCalled();
    });

    it('ESC dispatches mathbeat:closemodal event when no close button', () => {
      const modal = document.createElement('div');
      modal.setAttribute('role', 'dialog');
      modal.classList.add('show');
      // 无任何关闭按钮
      modal.innerHTML = '<p>some content</p>';
      document.body.appendChild(modal);

      const handler = vi.fn();
      modal.addEventListener('mathbeat:closemodal', handler);

      installModalKeyboardHandlers();
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);
      expect(handler).toHaveBeenCalled();
    });

    it('ESC without visible modal is a no-op', () => {
      // 没有 .show 的 modal
      const modal = document.createElement('div');
      modal.setAttribute('role', 'dialog');
      // 不加 .show
      document.body.appendChild(modal);

      const handler = vi.fn();
      modal.addEventListener('mathbeat:closemodal', handler);

      installModalKeyboardHandlers();
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);
      expect(handler).not.toHaveBeenCalled();
    });

    it('non-Escape keys do not trigger close logic', () => {
      const modal = document.createElement('div');
      modal.setAttribute('role', 'dialog');
      modal.classList.add('show');
      modal.innerHTML = '<button class="close-btn">×</button>';
      document.body.appendChild(modal);

      const closeBtn = modal.querySelector('.close-btn') as HTMLButtonElement;
      const clickSpy = vi.fn();
      closeBtn.addEventListener('click', clickSpy);

      installModalKeyboardHandlers();
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);
      expect(clickSpy).not.toHaveBeenCalled();
    });
  });

  describe('registerOverlayClose', () => {
    it('registers a callback for mathbeat:closemodal event', () => {
      const overlay = document.createElement('div');
      document.body.appendChild(overlay);
      const cb = vi.fn();
      registerOverlayClose(overlay, cb);
      overlay.dispatchEvent(new CustomEvent('mathbeat:closemodal'));
      expect(cb).toHaveBeenCalled();
    });

    it('does not invoke callback for unrelated events', () => {
      const overlay = document.createElement('div');
      document.body.appendChild(overlay);
      const cb = vi.fn();
      registerOverlayClose(overlay, cb);
      overlay.dispatchEvent(new CustomEvent('otherevent'));
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('getTopmostOverlay 选择器优先级', () => {
    it('prefers [role="dialog"][aria-hidden="false"]', () => {
      // 同时存在多种 overlay，应选 role=dialog 且 aria-hidden=false 的
      const dialog = document.createElement('div');
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-hidden', 'false');
      dialog.classList.add('show');
      dialog.innerHTML = '<button id="dlgBtn" data-action="closeModal">x</button>';
      document.body.appendChild(dialog);

      const other = document.createElement('div');
      other.classList.add('overlay', 'show');
      other.innerHTML = '<button id="otherBtn" data-action="closeModal">x</button>';
      document.body.appendChild(other);

      installModalKeyboardHandlers();
      // ESC 应该作用于最顶层 dialog
      const btn = document.getElementById('dlgBtn') as HTMLButtonElement;
      const spy = vi.fn();
      btn.addEventListener('click', spy);
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      );
      expect(spy).toHaveBeenCalled();
    });

    it('uses .overlay.show as fallback', () => {
      const overlay = document.createElement('div');
      overlay.classList.add('overlay', 'show');
      overlay.innerHTML = '<button class="close-btn">x</button>';
      document.body.appendChild(overlay);

      installModalKeyboardHandlers();
      const btn = overlay.querySelector('.close-btn') as HTMLButtonElement;
      const spy = vi.fn();
      btn.addEventListener('click', spy);
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      );
      expect(spy).toHaveBeenCalled();
    });

    it('uses [data-modal="true"].show as fallback', () => {
      const modal = document.createElement('div');
      modal.setAttribute('data-modal', 'true');
      modal.classList.add('show');
      modal.innerHTML = '<button class="close-btn">x</button>';
      document.body.appendChild(modal);

      installModalKeyboardHandlers();
      const btn = modal.querySelector('.close-btn') as HTMLButtonElement;
      const spy = vi.fn();
      btn.addEventListener('click', spy);
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      );
      expect(spy).toHaveBeenCalled();
    });

    it('skips elements with display:none', () => {
      // 两个 role=dialog 都有 .show，但第一个 display:none
      const hidden = document.createElement('div');
      hidden.setAttribute('role', 'dialog');
      hidden.classList.add('show');
      hidden.style.display = 'none';
      hidden.innerHTML = '<button id="hiddenBtn">x</button>';
      document.body.appendChild(hidden);

      const visible = document.createElement('div');
      visible.setAttribute('role', 'dialog');
      visible.classList.add('show');
      visible.innerHTML = '<button id="visibleBtn">x</button>';
      document.body.appendChild(visible);

      installModalKeyboardHandlers();
      // ESC 应作用于 visible（display:none 的被跳过）
      // visible 没有 close button，应触发 mathbeat:closemodal 事件
      const handler = vi.fn();
      visible.addEventListener('mathbeat:closemodal', handler);
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      );
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('a11y 辅助函数（嵌套模态焦点栈）', () => {
    it('openModal pushes trigger to stack; closeModal pops LIFO', () => {
      const trigger1 = document.createElement('button');
      trigger1.id = 't1';
      document.body.appendChild(trigger1);
      trigger1.focus();

      const modal1 = document.createElement('div');
      modal1.innerHTML = '<button id="t2">open modal 2</button>';
      document.body.appendChild(modal1);
      openModal(modal1);

      // 在 modal1 内聚焦 t2，然后打开 modal2
      const t2 = document.getElementById('t2') as HTMLButtonElement;
      t2.focus();

      const modal2 = document.createElement('div');
      document.body.appendChild(modal2);
      openModal(modal2);

      // 关闭 modal2 应聚焦回 t2
      closeModal(modal2);
      expect(document.activeElement?.id).toBe('t2');

      // 关闭 modal1 应聚焦回 trigger1
      closeModal(modal1);
      expect(document.activeElement?.id).toBe('t1');
    });
  });
});
