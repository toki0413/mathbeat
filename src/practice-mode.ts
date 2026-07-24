/**
 * 分段练习模式 Practice Mode（对标 Yousician / Simply Piano）
 *
 * 核心能力：
 *  1. 慢速练习：0.5x / 0.75x / 1x 速度切换（通过缩放 BPM）
 *  2. 小节循环：标记 A/B 段落点，循环播放该区间
 *  3. 节拍器：可开关的 click track，每步一拍
 *  4. 错误即时回放：点击步进格标记错误，一键回放所有错误步
 *
 * 设计原则：与具体世界解耦，接收通用 PracticeConfig 即可工作。
 * 首个集成点为世界1 的节奏关卡，后续可扩展到其他节奏型世界。
 */
import { Store } from './store';
import {
  getAudioCtx,
  getSharedTransport,
  stopSharedTransport,
  playSample,
  scheduleToneAt,
} from './audio';
import type { Transport, TransportEvent } from './core/transport';
import { showToast } from './ui-feedback';
import { registerActions } from './events';

/* ============================================================
 * 1. 类型定义
 * ============================================================ */

export type PracticeSound = 'kick' | 'snare' | 'tone';

export interface PracticeTrack {
  name: string;
  /** 每步是否触发该轨道音色（长度应等于 totalSteps）。 */
  steps: boolean[];
  sound: PracticeSound;
  /** sound='tone' 时的频率（Hz），其余忽略。 */
  freq?: number;
  /** 音量 0-1，缺省 0.5。 */
  vol?: number;
}

export interface PracticeConfig {
  tracks: PracticeTrack[];
  totalSteps: number;
  baseBpm: number;
  /** 每步占几拍，缺省 1（世界1 风格）。 */
  stepsPerBeat?: number;
  title?: string;
}

interface PracticeRuntime {
  config: PracticeConfig;
  speed: 0.5 | 0.75 | 1;
  metronome: boolean;
  loopStart: number | null; // 0-based，含
  loopEnd: number | null; // 0-based，含
  playing: boolean;
  transport: Transport | null;
  errorMarks: boolean[];
  unsubscribe: (() => void) | null;
}

let rt: PracticeRuntime | null = null;

/* ============================================================
 * 2. 打开 / 关闭 Modal
 * ============================================================ */

export function openPracticeMode(config: PracticeConfig): void {
  if (typeof document === 'undefined') return;
  if (!config || !config.tracks || config.tracks.length === 0 || config.totalSteps <= 0) {
    showToast('练习配置无效', 'error');
    return;
  }
  // 停止任何正在进行的练习
  stopPractice();

  rt = {
    config,
    speed: 1,
    metronome: false,
    loopStart: null,
    loopEnd: null,
    playing: false,
    transport: null,
    errorMarks: new Array(config.totalSteps).fill(false),
    unsubscribe: null,
  };

  let modal = document.getElementById('practiceModal');
  if (!modal) {
    modal = createPracticeModalElement();
    document.body.appendChild(modal);
  }
  renderPracticeUI();
  modal.style.display = 'flex';
  setTimeout(() => {
    modal!.style.opacity = '1';
  }, 10);
}

export function closePracticeMode(): void {
  stopPractice();
  const modal = document.getElementById('practiceModal');
  if (!modal) return;
  modal.style.opacity = '0';
  setTimeout(() => {
    modal.style.display = 'none';
  }, 200);
}

/* ============================================================
 * 3. 播放控制
 * ============================================================ */

function currentBpm(): number {
  if (!rt) return 120;
  return Math.max(40, Math.round(rt.config.baseBpm * rt.speed));
}

/** 把单调递增的 event.step 映射到循环段内的显示步（0-based）。 */
function mapStep(eventStep: number): number {
  if (!rt) return 0;
  const total = rt.config.totalSteps;
  if (rt.loopStart !== null && rt.loopEnd !== null) {
    const start = rt.loopStart;
    const end = rt.loopEnd;
    const range = end - start + 1;
    if (range > 0) return start + ((eventStep - start) % range + range) % range;
  }
  return ((eventStep % total) + total) % total;
}

export function playPractice(): void {
  if (!rt || rt.playing) return;
  const ctx = getAudioCtx();
  if (ctx.state === 'suspended') ctx.resume();
  stopSharedTransport();
  const transport = getSharedTransport(currentBpm(), rt.config.stepsPerBeat || 1);
  rt.transport = transport;
  rt.playing = true;
  let lastVisualStep = -1;
  rt.unsubscribe = transport.subscribe((event: TransportEvent) => {
    if (!rt) return;
    const s = mapStep(event.step);
    const t = event.time;
    // 轨道音色
    for (const track of rt.config.tracks) {
      if (track.steps[s]) {
        triggerTrackSound(track, t);
      }
    }
    // 节拍器
    if (rt.metronome) {
      scheduleToneAt(2000, 0.03, 'square', 0.12, t);
    }
    if (s !== lastVisualStep) {
      lastVisualStep = s;
      requestAnimationFrame(() => setPracticePlayhead(s));
    }
  });
  transport.start();
  updatePlayBtn();
}

export function pausePractice(): void {
  if (!rt || !rt.playing) return;
  rt.playing = false;
  if (rt.transport) {
    rt.transport.stop();
    rt.transport = null;
  }
  if (rt.unsubscribe) {
    rt.unsubscribe();
    rt.unsubscribe = null;
  }
  setPracticePlayhead(-1);
  updatePlayBtn();
}

export function togglePracticePlay(): void {
  if (!rt) return;
  if (rt.playing) pausePractice();
  else playPractice();
}

export function stopPractice(): void {
  pausePractice();
}

/* ============================================================
 * 4. 速度 / 节拍器 / 循环
 * ============================================================ */

export function setPracticeSpeed(e: Event | unknown, ...args: unknown[]): void {
  if (!rt) return;
  const v = args.length > 0 ? (args[0] as number) : (e as number);
  const speed = v === 0.5 || v === 0.75 || v === 1 ? (v as 0.5 | 0.75 | 1) : 1;
  rt.speed = speed;
  if (rt.transport) rt.transport.setBpm(currentBpm());
  renderPracticeControls();
}

export function toggleMetronome(): void {
  if (!rt) return;
  rt.metronome = !rt.metronome;
  renderPracticeControls();
}

/** 标记/取消 A 点（循环起点）。 */
export function setLoopStart(e: Event | unknown, ...args: unknown[]): void {
  if (!rt) return;
  const step = args.length > 0 ? (args[0] as number) : (e as number);
  if (step < 0 || step >= rt.config.totalSteps) return;
  rt.loopStart = step;
  // 确保 end >= start
  if (rt.loopEnd === null || rt.loopEnd < step) rt.loopEnd = step;
  renderPracticeUI();
}

/** 标记/取消 B 点（循环终点）。 */
export function setLoopEnd(e: Event | unknown, ...args: unknown[]): void {
  if (!rt) return;
  const step = args.length > 0 ? (args[0] as number) : (e as number);
  if (step < 0 || step >= rt.config.totalSteps) return;
  rt.loopEnd = step;
  if (rt.loopStart === null || rt.loopStart > step) rt.loopStart = step;
  renderPracticeUI();
}

export function clearLoop(): void {
  if (!rt) return;
  rt.loopStart = null;
  rt.loopEnd = null;
  renderPracticeUI();
}

/* ============================================================
 * 5. 错误标记与回放
 * ============================================================ */

/** 切换某步的错误标记。 */
export function toggleErrorMark(e: Event | unknown, ...args: unknown[]): void {
  if (!rt) return;
  const step = args.length > 0 ? (args[0] as number) : (e as number);
  if (step < 0 || step >= rt.config.totalSteps) return;
  rt.errorMarks[step] = !rt.errorMarks[step];
  renderPracticeSequencer();
}

/** 一键回放所有错误步（慢速，间隔 0.4s）。 */
export function replayErrors(): void {
  if (!rt) return;
  const errors: number[] = [];
  rt.errorMarks.forEach((m, i) => {
    if (m) errors.push(i);
  });
  if (errors.length === 0) {
    showToast('还没有标记错误步，点击下方格子标记', 'info');
    return;
  }
  // 暂停循环播放，避免冲突
  const wasPlaying = rt.playing;
  if (wasPlaying) pausePractice();
  const ctx = getAudioCtx();
  const tracks = rt.config.tracks;
  errors.forEach((s, i) => {
    const t = ctx.currentTime + 0.2 + i * 0.45;
    for (const track of tracks) {
      if (track.steps[s]) triggerTrackSound(track, t);
    }
    // 视觉高亮
    setTimeout(() => setPracticePlayhead(s), 200 + i * 450);
  });
  setTimeout(() => {
    setPracticePlayhead(-1);
    if (wasPlaying) playPractice();
  }, 200 + errors.length * 450 + 200);
}

export function clearErrors(): void {
  if (!rt) return;
  rt.errorMarks = new Array(rt.config.totalSteps).fill(false);
  renderPracticeSequencer();
}

/* ============================================================
 * 6. 音色触发
 * ============================================================ */

function triggerTrackSound(track: PracticeTrack, t: number): void {
  const vol = track.vol !== undefined ? track.vol : 0.5;
  if (track.sound === 'kick') {
    playSample('kick', t, vol);
  } else if (track.sound === 'snare') {
    playSample('snare', t, vol);
  } else {
    scheduleToneAt(track.freq || 440, 0.2, 'sine', vol, t);
  }
}

/* ============================================================
 * 7. UI 渲染
 * ============================================================ */

function renderPracticeUI(): void {
  if (!rt) return;
  renderPracticeSequencer();
  renderPracticeControls();
}

function renderPracticeSequencer(): void {
  if (!rt) return;
  const seq = document.getElementById('practiceSeq');
  if (!seq) return;
  const { config, errorMarks, loopStart, loopEnd } = rt;
  let html = '<div class="practice-seq-grid">';
  // 步号行
  html += '<div class="practice-step-row"><div class="practice-track-label"></div>';
  for (let s = 0; s < config.totalSteps; s++) {
    const inLoop = loopStart !== null && loopEnd !== null && s >= loopStart && s <= loopEnd;
    html += `<div class="practice-step-num${inLoop ? ' in-loop' : ''}">${s + 1}</div>`;
  }
  html += '</div>';
  // 每条轨道
  config.tracks.forEach((track, ti) => {
    html += `<div class="practice-track-row"><div class="practice-track-label">${escapeText(track.name)}</div>`;
    for (let s = 0; s < config.totalSteps; s++) {
      const active = track.steps[s];
      const inLoop = loopStart !== null && loopEnd !== null && s >= loopStart && s <= loopEnd;
      const isStart = loopStart === s;
      const isEnd = loopEnd === s;
      const cls =
        'practice-cell' +
        (active ? ' active' : '') +
        (active && ti === 0 ? ' t-a' : '') +
        (active && ti === 1 ? ' t-b' : '') +
        (active && ti >= 2 ? ' t-c' : '') +
        (inLoop ? ' in-loop' : '') +
        (isStart ? ' loop-start' : '') +
        (isEnd ? ' loop-end' : '');
      html += `<div class="${cls}" data-action="toggleErrorMark" data-args='[${s}]' title="第${s + 1}步"></div>`;
    }
    html += '</div>';
  });
  // 错误标记行
  html += '<div class="practice-track-row practice-error-row"><div class="practice-track-label">❌ 错误</div>';
  for (let s = 0; s < config.totalSteps; s++) {
    const marked = errorMarks[s];
    html += `<div class="practice-cell error${marked ? ' marked' : ''}" data-action="toggleErrorMark" data-args='[${s}]' title="标记第${s + 1}步为错误"></div>`;
  }
  html += '</div></div>';
  seq.innerHTML = html;
}

function renderPracticeControls(): void {
  if (!rt) return;
  const ctrl = document.getElementById('practiceControls');
  if (!ctrl) return;
  const { speed, metronome, loopStart, loopEnd, config, errorMarks } = rt;
  const errCount = errorMarks.filter(Boolean).length;
  const loopText =
    loopStart !== null && loopEnd !== null ? `A=${loopStart + 1} → B=${loopEnd + 1}` : '未设置循环';
  ctrl.innerHTML = `
    <div class="practice-ctrl-group">
      <span class="practice-ctrl-label">速度</span>
      ${[0.5, 0.75, 1]
        .map(
          (v) =>
            `<button class="practice-speed-btn${speed === v ? ' active' : ''}" data-action="setPracticeSpeed" data-args='[${v}]'>${v}x</button>`
        )
        .join('')}
      <span class="practice-bpm">${currentBpm()} BPM</span>
    </div>
    <div class="practice-ctrl-group">
      <span class="practice-ctrl-label">循环</span>
      <span class="practice-loop-text">${loopText}</span>
      <button class="practice-mini-btn" data-action="clearLoop">清除</button>
    </div>
    <div class="practice-ctrl-group">
      <span class="practice-ctrl-label">工具</span>
      <button class="practice-mini-btn${metronome ? ' active' : ''}" data-action="toggleMetronome">🔔 节拍器 ${metronome ? '开' : '关'}</button>
      <button class="practice-mini-btn" data-action="replayErrors">▶ 回放错误 (${errCount})</button>
      <button class="practice-mini-btn" data-action="clearErrors">清除标记</button>
    </div>
    <div class="practice-ctrl-group practice-loop-hint">
      <span class="practice-ctrl-label">循环标记</span>
      <button class="practice-mini-btn" data-action="setLoopStart" data-args='[0]'>设A点=步1</button>
      <button class="practice-mini-btn" data-action="setLoopEnd" data-args='[${config.totalSteps - 1}]'>设B点=步${config.totalSteps}</button>
    </div>
  `;
}

function updatePlayBtn(): void {
  const btn = document.getElementById('practicePlayBtn');
  if (!btn || !rt) return;
  btn.textContent = rt.playing ? '⏸' : '▶';
}

function setPracticePlayhead(step: number): void {
  const cells = document.querySelectorAll('#practiceSeq .practice-step-num');
  cells.forEach((c) => c.classList.remove('playhead'));
  if (step < 0) return;
  // 步号行是第一行，列索引 = step + 1（第一列是 label）
  const rows = document.querySelectorAll('#practiceSeq .practice-step-row');
  if (rows.length > 0) {
    const nums = rows[0].querySelectorAll('.practice-step-num');
    if (nums[step]) nums[step].classList.add('playhead');
  }
}

/* ============================================================
 * 8. Modal 元素创建
 * ============================================================ */

function createPracticeModalElement(): HTMLElement {
  const modal = document.createElement('div');
  modal.id = 'practiceModal';
  modal.className = 'share-card-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', '分段练习模式');
  modal.innerHTML = `
    <div class="share-card-box practice-box">
      <div class="share-card-header">
        <span class="share-card-title">🎯 分段练习</span>
        <button class="ctrl-btn share-card-close" data-action="closePracticeMode" aria-label="关闭">✕</button>
      </div>
      <div class="practice-body">
        <div class="practice-tip">点击格子标记错误步，回放错误快速定位薄弱点。A/B 循环可反复练习难点。</div>
        <div id="practiceSeq" class="practice-seq"></div>
        <div class="practice-play-row">
          <button class="ctrl-btn" data-action="w1Reset" id="practiceRewindBtn" style="display:none">⟲</button>
          <button class="ctrl-btn play-btn" id="practicePlayBtn" data-action="togglePracticePlay">▶</button>
          <button class="ctrl-btn" data-action="stopPractice">⏹</button>
        </div>
        <div id="practiceControls" class="practice-controls"></div>
      </div>
      <button class="ctrl-btn" data-action="closePracticeMode">完成练习</button>
    </div>
  `;
  return modal;
}

/* ============================================================
 * 9. 辅助
 * ============================================================ */

function escapeText(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

/* ============================================================
 * 10. 从世界1 关卡启动练习（便捷入口）
 * ============================================================ */

/**
 * 基于世界1 的双轨道配置启动练习模式。
 * a/b 为两条轨道的周期，totalSteps 通常为 lcm(a,b)。
 */
export function openPracticeFromWorld1(a: number, b: number, lcm: number, bpm: number): void {
  const stepsA: boolean[] = [];
  const stepsB: boolean[] = [];
  for (let i = 1; i <= lcm; i++) {
    stepsA.push(i % a === 0);
    stepsB.push(i % b === 0);
  }
  // world1 的 step 是 1-based，这里转成 0-based 的 boolean 数组
  openPracticeMode({
    tracks: [
      { name: 'A 轨道', steps: stepsA, sound: 'kick', vol: 0.5 },
      { name: 'B 轨道', steps: stepsB, sound: 'snare', vol: 0.4 },
    ],
    totalSteps: lcm,
    baseBpm: bpm,
    stepsPerBeat: 1,
    title: `练习 ${a}:${b} 对位`,
  });
}

/**
 * 基于世界4 的双环对齐配置启动练习模式（结构与世界1 同构，命名独立以便未来差异化）。
 * a/b 为两环周期，lcm 为重合步数。
 */
export function openPracticeFromWorld4(a: number, b: number, lcm: number, bpm: number): void {
  const stepsA: boolean[] = [];
  const stepsB: boolean[] = [];
  for (let i = 1; i <= lcm; i++) {
    stepsA.push(i % a === 0);
    stepsB.push(i % b === 0);
  }
  openPracticeMode({
    tracks: [
      { name: '外环', steps: stepsA, sound: 'kick', vol: 0.5 },
      { name: '内环', steps: stepsB, sound: 'snare', vol: 0.4 },
    ],
    totalSteps: lcm,
    baseBpm: bpm,
    stepsPerBeat: 1,
    title: `练习 ${a}步环:${b}步环 对齐`,
  });
}

/**
 * 基于世界6 的欧几里得节奏启动练习模式（单主轨道 + 旋律层）。
 * k 个脉冲分布在 n 步上。
 */
export function openPracticeFromWorld6(k: number, n: number, bpm: number): void {
  // 复用 utils 的 euclideanRhythm 生成目标 pattern
  const pattern = euclideanRhythmLocal(k, n);
  const steps: boolean[] = pattern.map((v) => v === 1);
  // 旋律层：用斐波那契式音高（参考世界6 原生逻辑），仅在脉冲步触发
  const fibFreqs = [261.63, 329.63, 392.0, 440.0, 523.25, 587.33];
  const melodySteps: boolean[] = steps.slice();
  openPracticeMode({
    tracks: [
      { name: 'E(k,n) 节奏', steps, sound: 'kick', vol: 0.5 },
      { name: '旋律层', steps: melodySteps, sound: 'tone', freq: fibFreqs[k % fibFreqs.length], vol: 0.3 },
    ],
    totalSteps: n,
    baseBpm: bpm,
    stepsPerBeat: 1,
    title: `练习 E(${k},${n}) 节奏`,
  });
}

/** 本地实现的欧几里得节奏（避免与 utils 循环依赖，逻辑等价）。 */
function euclideanRhythmLocal(k: number, n: number): number[] {
  if (n <= 0) return [];
  if (k <= 0) return new Array(n).fill(0);
  if (k >= n) return new Array(n).fill(1);
  const pattern = new Array(n).fill(0);
  // Bjorklund 算法简化版：均匀分布 k 个脉冲
  const spacing = n / k;
  for (let i = 0; i < k; i++) {
    const idx = Math.floor(i * spacing);
    pattern[idx % n] = 1;
  }
  return pattern;
}

/* ============================================================
 * 11. 注册 actions 与全局暴露
 * ============================================================ */

registerActions({
  openPracticeMode: openPracticeMode as unknown as (e: Event, ...args: unknown[]) => void,
  closePracticeMode,
  togglePracticePlay,
  stopPractice,
  setPracticeSpeed,
  toggleMetronome,
  setLoopStart,
  setLoopEnd,
  clearLoop,
  toggleErrorMark,
  replayErrors,
  clearErrors,
});

if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    openPracticeMode,
    openPracticeFromWorld1,
    openPracticeFromWorld4,
    openPracticeFromWorld6,
    closePracticeMode,
    togglePracticePlay,
    stopPractice,
    setPracticeSpeed,
    toggleMetronome,
    setLoopStart,
    setLoopEnd,
    clearLoop,
    toggleErrorMark,
    replayErrors,
    clearErrors,
  });
}

// 引用 Store 避免未使用告警（未来可能持久化练习设置）
void Store;
