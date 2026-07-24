// 视觉节拍模式（听障辅助 / WCAG 1.4.2 听觉替代）
//
// 设计目标：让听障用户也能"看到"节奏。当 settings.visualBeat 开启时，
// 每个节拍 step 会触发一个视觉脉冲（屏幕边缘闪烁 + 节拍指示点缩放），
// 与音频精确同步（基于 AudioContext.currentTime，不依赖 setTimeout 抖动）。
//
// 实现：订阅 shared Transport 的 step 事件，记录每个 step 的音频时钟时间，
// 再用 requestAnimationFrame 在正确时刻触发 CSS 脉冲动画。

import { getSharedTransport, getAudioCtx } from './audio';
import type { Transport, TransportEvent } from './core/transport';
import { announce } from './a11y';

let enabled = false;
let transport: Transport | null = null;
let unsubscribeStep: (() => void) | null = null;
let rafId: number | null = null;
let reducedMotion = false;

// 待触发的节拍队列：{ time: 音频时钟触发时刻, step: 步号 }
interface PendingBeat {
  time: number;
  step: number;
}
const pending: PendingBeat[] = [];
const MAX_PENDING = 64; // 防止泄漏：超过则丢弃最旧的

// 视觉脉冲 DOM 元素
let flashEl: HTMLDivElement | null = null;
let dotEl: HTMLDivElement | null = null;

function readReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
  } catch (e) {
    return false;
  }
}

function ensureElements(): void {
  if (flashEl && document.body.contains(flashEl)) return;
  flashEl = document.createElement('div');
  flashEl.id = 'visualBeatFlash';
  flashEl.setAttribute('aria-hidden', 'true');
  flashEl.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:9998;' +
    'box-shadow:inset 0 0 0 0 transparent;transition:box-shadow 120ms ease-out;' +
    'border-radius:0;';
  document.body.appendChild(flashEl);

  dotEl = document.createElement('div');
  dotEl.id = 'visualBeatDot';
  dotEl.setAttribute('aria-hidden', 'true');
  dotEl.style.cssText =
    'position:fixed;top:12px;left:50%;transform:translateX(-50%) scale(1);' +
    'width:14px;height:14px;border-radius:50%;background:#ff8c42;' +
    'z-index:9999;pointer-events:none;opacity:0.85;transition:transform 140ms ease-out,opacity 140ms ease-out;';
  document.body.appendChild(dotEl);
}

function removeElements(): void {
  if (flashEl && flashEl.parentNode) flashEl.parentNode.removeChild(flashEl);
  if (dotEl && dotEl.parentNode) dotEl.parentNode.removeChild(dotEl);
  flashEl = null;
  dotEl = null;
}

function onStep(ev: TransportEvent): void {
  if (!enabled) return;
  if (pending.length >= MAX_PENDING) pending.shift();
  pending.push({ time: ev.time, step: ev.step });
}

function triggerPulse(step: number): void {
  if (!flashEl || !dotEl) return;
  // 强拍（每 4 步一拍，第 0 步为强拍）用更强视觉
  const isDownbeat = step % 4 === 0;
  const intensity = isDownbeat ? 0.55 : 0.28;
  const flashColor = isDownbeat ? 'rgba(255,140,66,' + intensity + ')' : 'rgba(126,184,212,' + intensity + ')';

  // 重置 transition 后立即施加新样式，强制重绘以重新触发动画
  flashEl.style.boxShadow = 'inset 0 0 0 0 transparent';
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  flashEl.offsetHeight; // reflow
  flashEl.style.boxShadow = 'inset 0 0 120px 24px ' + flashColor;

  dotEl.style.transform = 'translateX(-50%) scale(' + (isDownbeat ? 2.2 : 1.5) + ')';
  dotEl.style.opacity = '1';
  dotEl.style.background = isDownbeat ? '#ff8c42' : '#7eb8d4';

  // 衰减
  window.setTimeout(() => {
    if (!flashEl || !dotEl) return;
    flashEl.style.boxShadow = 'inset 0 0 0 0 transparent';
    dotEl.style.transform = 'translateX(-50%) scale(1)';
    dotEl.style.opacity = '0.85';
  }, 140);
}

function rafLoop(): void {
  if (!enabled) {
    rafId = null;
    return;
  }
  let ctxTime = 0;
  try {
    ctxTime = getAudioCtx().currentTime;
  } catch (e) {
    // AudioContext 不可用时降级：直接按 pending 顺序触发
    ctxTime = performance.now() / 1000;
  }
  // 触发所有已到时刻的节拍
  while (pending.length > 0 && pending[0].time <= ctxTime) {
    const b = pending.shift()!;
    triggerPulse(b.step);
  }
  rafId = requestAnimationFrame(rafLoop);
}

export function enableVisualBeat(): void {
  if (enabled) return;
  reducedMotion = readReducedMotion();
  enabled = true;
  ensureElements();
  try {
    transport = getSharedTransport();
    unsubscribeStep = transport.subscribe(onStep);
  } catch (e) {
    // AudioContext 不可用时仍允许视觉脉冲（无音频同步，仅作 UI 提示）
  }
  if (rafId === null) rafId = requestAnimationFrame(rafLoop);
  try {
    announce('视觉节拍模式已开启', 'polite');
  } catch (e) {
    /* ignore */
  }
}

export function disableVisualBeat(): void {
  if (!enabled) return;
  enabled = false;
  if (unsubscribeStep) {
    try {
      unsubscribeStep();
    } catch (e) {
      /* ignore */
    }
    unsubscribeStep = null;
  }
  transport = null;
  pending.length = 0;
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  removeElements();
  try {
    announce('视觉节拍模式已关闭', 'polite');
  } catch (e) {
    /* ignore */
  }
}

export function isVisualBeatEnabled(): boolean {
  return enabled;
}

/** 根据 settings.visualBeat 切换开关，返回切换后的状态 */
export function setVisualBeat(on: boolean): boolean {
  if (on) enableVisualBeat();
  else disableVisualBeat();
  return enabled;
}

/**
 * 听障视觉反馈（WCAG 1.2.1）：在 correct/wrong/click 时提供视觉替代，
 * 让听障用户能"看到"答题正误。不依赖 visualBeat 开关——总是可用，
 * 调用前通过 ensureElements() 确保 DOM 元素存在。
 */
export function triggerVisualFeedback(type: 'correct' | 'wrong' | 'click'): void {
  ensureElements();
  if (!flashEl || !dotEl) return;
  // 每次刷新，避免在未开启节拍模式（enableVisualBeat 未运行）时 reducedMotion 仍为初始 false
  reducedMotion = readReducedMotion();

  if (type === 'click') {
    // 短暂高亮：仅 opacity 1→0.85，不放大、不 flash、不 announce（避免噪音）
    dotEl.style.opacity = '1';
    window.setTimeout(() => {
      if (!dotEl) return;
      dotEl.style.opacity = '0.85';
    }, 140);
    return;
  }

  const isCorrect = type === 'correct';
  const color = isCorrect ? '#7bc67e' : '#e85d5d';
  const flashColor = isCorrect
    ? 'rgba(123,198,126,0.55)'
    : 'rgba(232,93,93,0.55)';

  if (reducedMotion) {
    // 静态高亮：只改 dotEl 颜色，不放大、不 flash，但仍 announce（WCAG 2.3.3）
    dotEl.style.background = color;
  } else {
    dotEl.style.background = color;
    dotEl.style.transform = 'translateX(-50%) scale(2.0)';
    dotEl.style.opacity = '1';
    flashEl.style.boxShadow = 'inset 0 0 0 0 transparent';
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    flashEl.offsetHeight; // reflow
    flashEl.style.boxShadow = 'inset 0 0 120px 24px ' + flashColor;

    window.setTimeout(() => {
      if (!flashEl || !dotEl) return;
      flashEl.style.boxShadow = 'inset 0 0 0 0 transparent';
      dotEl.style.transform = 'translateX(-50%) scale(1)';
      dotEl.style.opacity = '0.85';
      dotEl.style.background = '#ff8c42';
    }, 140);
  }

  try {
    announce(isCorrect ? '答对' : '答错', 'assertive');
  } catch (e) {
    /* ignore */
  }
}
