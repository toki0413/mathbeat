// Central event delegation system — replaces inline onclick handlers
// Usage in templates: <button data-action="startLevel" data-args='[1, "1-1"]'>
// For input/select: <select data-input="w2ReflectAxisChange">

type EventHandler = (e: Event, ...args: unknown[]) => void;

const clickHandlers: Record<string, EventHandler> = {};
const inputHandlers: Record<string, EventHandler> = {};

export function registerAction(name: string, fn: EventHandler): void {
  clickHandlers[name] = fn;
}

export function registerInput(name: string, fn: EventHandler): void {
  inputHandlers[name] = fn;
}

export function registerActions(actions: Record<string, EventHandler>): void {
  for (const [name, fn] of Object.entries(actions)) {
    clickHandlers[name] = fn;
  }
}

export function registerInputs(inputs: Record<string, EventHandler>): void {
  for (const [name, fn] of Object.entries(inputs)) {
    inputHandlers[name] = fn;
  }
}

function parseArgs(el: HTMLElement): unknown[] {
  const raw = el.dataset.args;
  if (!raw) return [];
  try {
    return JSON.parse(raw) as unknown[];
  } catch {
    return [raw];
  }
}

let initialized = false;

export function initEventDelegation(): void {
  if (initialized) return;
  initialized = true;

  document.addEventListener('click', (e: MouseEvent) => {
    const el = (e.target as HTMLElement)?.closest('[data-action]') as HTMLElement | null;
    if (!el) return;
    // For overlays that should only close when clicking the backdrop itself
    if (el.dataset.selfOnly === 'true' && e.target !== el) return;
    const action = el.dataset.action;
    if (!action || !clickHandlers[action]) return;
    e.preventDefault();
    const args = parseArgs(el);
    clickHandlers[action](e, ...args);
  });

  document.addEventListener('change', (e: Event) => {
    const el = (e.target as HTMLElement)?.closest('[data-input]') as HTMLElement | null;
    if (!el) return;
    const action = el.dataset.input;
    if (!action || !inputHandlers[action]) return;
    inputHandlers[action](e);
  });

  document.addEventListener('input', (e: Event) => {
    const el = (e.target as HTMLElement)?.closest('[data-input]') as HTMLElement | null;
    if (!el) return;
    const action = el.dataset.input;
    if (!action || !inputHandlers[action]) return;
    inputHandlers[action](e);
  });

  // Keyboard activation for data-action elements (Enter / Space), so any
  // focusable [data-action] is operable without a pointer (WCAG 2.1.1).
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    const el = (document.activeElement as HTMLElement | null)?.closest('[data-action]') as HTMLElement | null;
    if (!el) return;
    if (el.tagName === 'BUTTON' || el.tagName === 'A') return; // native elements handle their own activation
    const action = el.dataset.action;
    if (!action || !clickHandlers[action]) return;
    e.preventDefault();
    const args = parseArgs(el);
    clickHandlers[action](e, ...args);
  });
}
