import { announce, openModal, closeModal } from './a11y';

export type ToastType = 'info' | 'success' | 'error';

let toastContainer: HTMLElement | null = null;

function ensureToastContainer(): HTMLElement {
  if (toastContainer && document.body.contains(toastContainer)) return toastContainer;
  toastContainer = document.createElement('div');
  toastContainer.id = 'toastContainer';
  document.body.appendChild(toastContainer);
  return toastContainer;
}

export function showToast(message: string, type: ToastType = 'info', duration = 2500) {
  const container = ensureToastContainer();
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = message;
  // role=alert 让屏幕阅读器在 toast 出现时主动播报（WCAG 4.1.3 Status Messages）
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  container.appendChild(el);
  // 同步通过全局 aria-live 区播报，确保 AT 一定能听到
  try {
    announce(message, type === 'error' ? 'assertive' : 'polite');
  } catch (e) {
    /* a11y 失败不影响主流程 */
  }

  requestAnimationFrame(() => {
    el.classList.add('toast-visible');
  });

  setTimeout(() => {
    el.classList.remove('toast-visible');
    el.addEventListener('transitionend', () => {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 350);
  }, duration);
}

export function showConfirm(message: string, onConfirm: () => void, onCancel?: () => void) {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';

  const box = document.createElement('div');
  box.className = 'confirm-box';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', '确认');

  const msg = document.createElement('div');
  msg.className = 'confirm-message';
  msg.textContent = message;

  const actions = document.createElement('div');
  actions.className = 'confirm-actions';

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'confirm-btn confirm-btn-primary';
  confirmBtn.textContent = '确定';
  confirmBtn.onclick = () => {
    cleanup();
    onConfirm();
  };

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'confirm-btn confirm-btn-secondary';
  cancelBtn.textContent = '取消';
  cancelBtn.onclick = () => {
    cleanup();
    if (onCancel) onCancel();
  };

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  box.appendChild(msg);
  box.appendChild(actions);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  // 播报确认提示并启用焦点陷阱（WCAG 2.4.3 / 2.4.11）
  try {
    announce(message, 'assertive');
    openModal(box);
  } catch (e) {
    /* a11y 失败不影响主流程 */
  }

  function cleanup() {
    try {
      closeModal(box);
    } catch (e) {
      /* ignore */
    }
    overlay.classList.add('confirm-fade-out');
    overlay.addEventListener('transitionend', () => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    });
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 300);
  }
}
