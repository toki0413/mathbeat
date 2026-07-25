import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ui-feedback.ts 实际只依赖 './a11y'（announce / openModal / closeModal）。
// 任务描述建议 mock store/audio/i18n，但 ui-feedback.ts 并未直接 import 这些模块。
// 这里 mock 真实依赖 './a11y'，避免触发 a11y 内部的 DOM/RAF 副作用。
vi.mock('./a11y', () => ({
  announce: vi.fn(),
  openModal: vi.fn(),
  closeModal: vi.fn(),
}));

import { showToast, showConfirm } from './ui-feedback';
import { announce, openModal, closeModal } from './a11y';

describe('ui-feedback - showToast', () => {
  let rafSpy: (cb: FrameRequestCallback) => number;
  let cancelRafSpy: (id: number) => void;

  beforeEach(() => {
    vi.useFakeTimers();
    // requestAnimationFrame 在 happy-dom 下不一定可用，统一替换为可控 mock
    rafSpy = vi.fn((cb: FrameRequestCallback) => {
      // 同步触发回调，模拟“下一帧”
      cb(performance.now());
      return 1;
    }) as unknown as (cb: FrameRequestCallback) => number;
    cancelRafSpy = vi.fn();
    // @ts-ignore
    globalThis.requestAnimationFrame = rafSpy;
    // @ts-ignore
    globalThis.cancelAnimationFrame = cancelRafSpy;
    document.body.innerHTML = '';
    vi.mocked(announce).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    // @ts-ignore
    delete globalThis.requestAnimationFrame;
    // @ts-ignore
    delete globalThis.cancelAnimationFrame;
  });

  it('showToast 创建并插入 toast 元素到 DOM', () => {
    showToast('hello', 'info');
    const container = document.getElementById('toastContainer');
    expect(container).not.toBeNull();
    const toast = container?.querySelector('.toast');
    expect(toast).not.toBeNull();
    expect(toast?.textContent).toBe('hello');
  });

  it('showToast 默认 type 为 info，应用 toast-info class', () => {
    showToast('default');
    const toast = document.querySelector('.toast');
    expect(toast?.classList.contains('toast-info')).toBe(true);
    expect(toast?.classList.contains('toast-success')).toBe(false);
    expect(toast?.classList.contains('toast-error')).toBe(false);
  });

  it('不同 type 应用不同 class', () => {
    showToast('i', 'info');
    showToast('s', 'success');
    showToast('e', 'error');
    const toasts = document.querySelectorAll('.toast');
    expect(toasts).toHaveLength(3);
    expect(toasts[0].classList.contains('toast-info')).toBe(true);
    expect(toasts[1].classList.contains('toast-success')).toBe(true);
    expect(toasts[2].classList.contains('toast-error')).toBe(true);
  });

  it('error 类型 toast 的 role=alert，其他类型 role=status', () => {
    showToast('ok', 'success');
    showToast('bad', 'error');
    const toasts = document.querySelectorAll('.toast');
    expect(toasts[0].getAttribute('role')).toBe('status');
    expect(toasts[1].getAttribute('role')).toBe('alert');
  });

  it('showToast 调用 announce 进行无障碍播报', () => {
    showToast('info-msg', 'info');
    expect(announce).toHaveBeenCalledWith('info-msg', 'polite');
    showToast('error-msg', 'error');
    expect(announce).toHaveBeenCalledWith('error-msg', 'assertive');
  });

  it('showToast 通过 requestAnimationFrame 添加 toast-visible class', () => {
    showToast('visible-test', 'info');
    const toast = document.querySelector('.toast') as HTMLElement;
    expect(toast.classList.contains('toast-visible')).toBe(true);
  });

  it('showToast 在 duration 毫秒后开始移除流程（移除 toast-visible）', () => {
    showToast('auto-remove', 'info', 1000);
    const toast = document.querySelector('.toast') as HTMLElement;
    expect(toast.classList.contains('toast-visible')).toBe(true);
    // 推进到 duration 时刻：toast-visible 被移除
    vi.advanceTimersByTime(1000);
    expect(toast.classList.contains('toast-visible')).toBe(false);
  });

  it('showToast 在 duration + 350ms 后从 DOM 中彻底移除', () => {
    showToast('gone', 'info', 1000);
    expect(document.querySelectorAll('.toast')).toHaveLength(1);
    // duration 触发“开始移除”
    vi.advanceTimersByTime(1000);
    // transitionend 不会触发（happy-dom 不派发），靠兜底 setTimeout(350)
    expect(document.querySelectorAll('.toast')).toHaveLength(1);
    vi.advanceTimersByTime(350);
    expect(document.querySelectorAll('.toast')).toHaveLength(0);
  });

  it('多次调用 showToast 会创建多个 toast 元素（无最大数量限制逻辑）', () => {
    // 实现未限制最大 toast 数；这里只验证多次调用都能插入
    for (let i = 0; i < 5; i++) showToast('msg-' + i, 'info');
    expect(document.querySelectorAll('.toast')).toHaveLength(5);
  });

  it('首次调用 showToast 会创建 container，后续调用复用同一 container', () => {
    showToast('a', 'info');
    const c1 = document.getElementById('toastContainer');
    showToast('b', 'info');
    const c2 = document.getElementById('toastContainer');
    expect(c1).toBe(c2);
    expect(document.querySelectorAll('#toastContainer')).toHaveLength(1);
  });
});

describe('ui-feedback - showConfirm', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.mocked(announce).mockClear();
    vi.mocked(openModal).mockClear();
    vi.mocked(closeModal).mockClear();
  });

  it('showConfirm 创建 overlay 和 dialog 并插入到 DOM', () => {
    showConfirm('确定要继续吗？', () => {});
    const overlay = document.querySelector('.confirm-overlay');
    expect(overlay).not.toBeNull();
    const box = document.querySelector('.confirm-box');
    expect(box).not.toBeNull();
    expect(box?.getAttribute('role')).toBe('dialog');
    expect(box?.getAttribute('aria-modal')).toBe('true');
  });

  it('showConfirm 显示传入的消息文本', () => {
    showConfirm('真的要删除吗？', () => {});
    const msg = document.querySelector('.confirm-message');
    expect(msg?.textContent).toBe('真的要删除吗？');
  });

  it('点击“确定”按钮触发 onConfirm 回调并清理 overlay', () => {
    const onConfirm = vi.fn();
    showConfirm('继续？', onConfirm);
    const confirmBtn = document.querySelector('.confirm-btn-primary') as HTMLButtonElement;
    expect(confirmBtn).toBeTruthy();
    confirmBtn.click();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    // overlay 应该被加上 fade-out class
    const overlay = document.querySelector('.confirm-overlay') as HTMLElement;
    expect(overlay.classList.contains('confirm-fade-out')).toBe(true);
  });

  it('点击“取消”按钮触发 onCancel 回调（如提供）并清理 overlay', () => {
    const onCancel = vi.fn();
    showConfirm('继续？', () => {}, onCancel);
    const cancelBtn = document.querySelector('.confirm-btn-secondary') as HTMLButtonElement;
    expect(cancelBtn).toBeTruthy();
    cancelBtn.click();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('未提供 onCancel 时点击“取消”不抛错', () => {
    expect(() => {
      showConfirm('继续？', () => {});
      const cancelBtn = document.querySelector('.confirm-btn-secondary') as HTMLButtonElement;
      cancelBtn.click();
    }).not.toThrow();
  });

  it('showConfirm 调用 announce 进行播报并打开模态焦点陷阱', () => {
    showConfirm('操作确认', () => {});
    expect(announce).toHaveBeenCalledWith('操作确认', 'assertive');
    expect(openModal).toHaveBeenCalledTimes(1);
  });

  it('点击确定后调用 closeModal 关闭模态', () => {
    showConfirm('继续？', () => {});
    const confirmBtn = document.querySelector('.confirm-btn-primary') as HTMLButtonElement;
    confirmBtn.click();
    expect(closeModal).toHaveBeenCalledTimes(1);
  });

  it('showConfirm 自身不抛错（边界：空消息）', () => {
    expect(() => showConfirm('', () => {})).not.toThrow();
  });
});
