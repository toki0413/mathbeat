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
  container.appendChild(el);

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

  function cleanup() {
    overlay.classList.add('confirm-fade-out');
    overlay.addEventListener('transitionend', () => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    });
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 300);
  }
}
