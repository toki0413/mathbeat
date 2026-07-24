/**
 * 可访问性（a11y）基础设施：
 *  - 全局 announce() 通过 aria-live 区向屏幕阅读器播报
 *  - trapFocus()/restoreFocus() 用于模态焦点管理
 *  - openModal()/closeModal() 统一封装焦点陷阱 + role=dialog
 *
 * 设计依据：WCAG 2.1 AA、ARIA Authoring Practices 1.2
 */

let srLivePolite: HTMLElement | null = null;
let srLiveAssertive: HTMLElement | null = null;
let lastFocusedStack: HTMLElement[] = [];

/** 初始化全局 aria-live 容器（应在 main.ts 启动时调用一次）。 */
export function initA11y(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('srLivePolite')) return;

  const css =
    'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;' +
    'clip:rect(0,0,0,0);white-space:nowrap;border:0;';
  srLivePolite = document.createElement('div');
  srLivePolite.id = 'srLivePolite';
  srLivePolite.setAttribute('role', 'status');
  srLivePolite.setAttribute('aria-live', 'polite');
  srLivePolite.setAttribute('aria-atomic', 'true');
  srLivePolite.setAttribute('style', css);
  document.body.appendChild(srLivePolite);

  srLiveAssertive = document.createElement('div');
  srLiveAssertive.id = 'srLiveAssertive';
  srLiveAssertive.setAttribute('role', 'alert');
  srLiveAssertive.setAttribute('aria-live', 'assertive');
  srLiveAssertive.setAttribute('aria-atomic', 'true');
  srLiveAssertive.setAttribute('style', css);
  document.body.appendChild(srLiveAssertive);
}

/**
 * 向屏幕阅读器播报消息。
 * @param msg 文本内容
 * @param level 'polite'（默认，不打断）| 'assertive'（立即打断）
 */
export function announce(msg: string, level: 'polite' | 'assertive' = 'polite'): void {
  if (typeof document === 'undefined') return;
  if (!srLivePolite) initA11y();
  const target = level === 'assertive' ? srLiveAssertive : srLivePolite;
  if (!target) return;
  // 清空再写入以触发读屏器重新播报
  target.textContent = '';
  // 微任务延迟保证 AT 能够捕获变化
  setTimeout(() => {
    if (target) target.textContent = msg;
  }, 50);
}

/** 查询当前可见的最顶层模态/overlay。 */
function getTopmostOverlay(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  // 优先匹配显式 role=dialog/aria-modal，再回退到 .overlay.show / .modal.show / .screen.active
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[role="dialog"][aria-hidden="false"], [role="dialog"].show, .overlay.show, .modal.show, [data-modal="true"].show'
    )
  );
  const visible = candidates.find((el) => {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && el.style.display !== 'none';
  });
  return visible || null;
}

/** 查询可聚焦元素（按钮/链接/input 等）。 */
function queryFocusable(container: HTMLElement): HTMLElement[] {
  const selector =
    'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),' +
    'select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),' +
    '[data-action]:not([data-action=""])';
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter((el) => {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}

/** 焦点陷阱 Tab 循环处理器。 */
function trapTabHandler(e: KeyboardEvent): void {
  if (e.key !== 'Tab') return;
  const overlay = getTopmostOverlay();
  if (!overlay) return;
  const focusable = queryFocusable(overlay);
  if (focusable.length === 0) {
    e.preventDefault();
    overlay.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement as HTMLElement | null;
  if (e.shiftKey) {
    if (active === first || !overlay.contains(active)) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (active === last || !overlay.contains(active)) {
      e.preventDefault();
      first.focus();
    }
  }
}

/** ESC 关闭最顶层模态。 */
function escapeHandler(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return;
  const overlay = getTopmostOverlay();
  if (!overlay) return;
  const closeBtn = overlay.querySelector<HTMLElement>('[data-action="closeModal"], [data-dismiss], .close-btn, [aria-label="关闭"]');
  if (closeBtn) {
    closeBtn.click();
  } else {
    // 触发自定义关闭事件
    overlay.dispatchEvent(new CustomEvent('mathbeat:closemodal', { bubbles: true }));
  }
}

let listenersInstalled = false;
/** 安装全局键盘监听（焦点陷阱 + ESC）。 */
export function installModalKeyboardHandlers(): void {
  if (listenersInstalled || typeof document === 'undefined') return;
  listenersInstalled = true;
  document.addEventListener('keydown', trapTabHandler);
  document.addEventListener('keydown', escapeHandler);
}

/**
 * 打开模态：记录当前焦点、设 role=dialog/aria-modal、聚焦首个控件。
 * @param modal 模态元素
 * @param labelId 标题元素 id（用于 aria-labelledby）
 */
export function openModal(modal: HTMLElement, labelId?: string): void {
  if (typeof document === 'undefined') return;
  installModalKeyboardHandlers();
  // 记录触发元素
  const active = document.activeElement as HTMLElement | null;
  if (active && active !== document.body) lastFocusedStack.push(active);
  // 配置 role
  if (!modal.getAttribute('role')) modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-hidden', 'false');
  if (labelId) modal.setAttribute('aria-labelledby', labelId);
  // 显示
  modal.classList.add('show');
  modal.style.display = '';
  // 聚焦首个控件
  requestAnimationFrame(() => {
    const focusable = queryFocusable(modal);
    if (focusable.length > 0) focusable[0].focus();
    else modal.focus();
  });
}

/**
 * 关闭模态：隐藏并还原焦点到触发元素。
 */
export function closeModal(modal: HTMLElement): void {
  if (typeof document === 'undefined') return;
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
  // 兜底 display:none（如果 CSS 没用 .show 控制可见性）
  if (!modal.dataset.persistDisplay) modal.style.display = 'none';
  // 还原焦点
  const last = lastFocusedStack.pop();
  if (last && document.body.contains(last)) {
    try {
      last.focus();
    } catch (e) {
      /* ignore */
    }
  }
}

/** 通用 ESC 关闭：用于无 [data-dismiss] 的 overlay。 */
export function registerOverlayClose(overlay: HTMLElement, onClose: () => void): void {
  overlay.addEventListener('mathbeat:closemodal', () => onClose());
}
