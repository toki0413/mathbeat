import { state, completeLevel, recordAdaptive, updateLeaderboard, checkAchievements } from '../game-engine';
import { Store } from '../store';
import { LEVELS, NOTE_FREQS, SCALES, ROOT_SEMITONES } from '../worlds';
import {
  scheduleToneAt,
  scheduleKickAt,
  getAudioCtx,
  playSample,
  playCorrect,
  playWrong,
  getSharedTransport,
  stopSharedTransport,
} from '../audio';
import type { Transport, TransportEvent } from '../core/transport';
import { showStars, showEducationCard } from '../ui-render';
import { arraysEqual, euclideanRhythm } from '../utils';
import { registerActions } from '../events';
import { openPracticeFromWorld6 } from '../practice-mode';

/* ===== WORLD 6: RECURSIVE RHYTHM ===== */
export function renderWorld6(container: HTMLElement, lid: string) {
  const targets = {
    '6-1': { k: 3, n: 8 },
    '6-2': { k: 5, n: 8 },
    '6-3': { k: 4, n: 7 },
    '6-4': { k: 4, n: 9 },
    '6-5': { k: 3, n: 10 },
    '6-B': { k: 5, n: 13 },
  };
  const t = targets[lid as keyof typeof targets] || { k: 3, n: 8 };
  state.w6 = {
    lid,
    target: t,
    cells: Array(t.n).fill(0),
    melody: w6GenFibonacciMelody(t.n),
    melodyEnabled: false,
    chords: w6GenPrimeChordMask(t.n),
    chordEnabled: false,
    recursiveEnabled: false,
    playing: false,
    transport: null as Transport | null,
    step: 0,
    bpm: 120,
  };
  container.innerHTML =
    '<div class="challenge-card"><div class="challenge-q">用欧几里得算法生成 E(' +
    t.k +
    ',' +
    t.n +
    ') 节奏，或自己点击格子。</div><div id="w6Grid" style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap;margin:12px 0"></div><div class="controls-bar" style="flex-wrap:wrap;gap:6px"><button class="ctrl-btn" data-action="w6Reset">⟲</button><button class="ctrl-btn play-btn" id="w6PlayBtn" data-action="w6TogglePlay">▶</button><button class="ctrl-btn" data-action="w6ApplyEuclid">📏 欧几里得</button><button class="ctrl-btn' +
    (state.w6.melodyEnabled ? ' active-a' : '') +
    '" id="w6MelodyBtn" data-action="w6ToggleMelody">🌀 旋律</button><button class="ctrl-btn' +
    (state.w6.chordEnabled ? ' active-a' : '') +
    '" id="w6ChordBtn" data-action="w6ToggleChords">🔢 质数和弦</button><button class="ctrl-btn' +
    (state.w6.recursiveEnabled ? ' active-a' : '') +
    '" id="w6RecursiveBtn" data-action="w6ToggleRecursive">🌳 递归</button><button class="verify-btn" data-action="w6Verify">验证</button></div><div class="practice-entry" style="margin-top:8px;text-align:center"><button class="ctrl-btn" data-action="w6OpenPractice" style="background:linear-gradient(135deg,#7c6bff,#a78bfa);color:#fff;font-size:13px">🎯 进入分段练习</button></div><div class="result-msg" id="w6Result"></div><div class="stars-row" id="w6Stars"></div><button class="next-btn" id="w6Next" data-action="nextLevel">下一关 →</button></div>';
  w6RenderGrid();
}
export function w6RenderGrid() {
  const el = document.getElementById('w6Grid');
  if (!el) return;
  const rootOff = ROOT_SEMITONES['C'];
  const scale = SCALES.minor;
  el.innerHTML = state.w6.cells
    .map((c: number, i: number) => {
      const isChord = state.w6.chords[i];
      const note = state.w6.melody[i];
      const semi = rootOff + scale[note % scale.length] + 12 * Math.floor(note / scale.length);
      const noteName = NOTE_NAMES[semi % 12];
      let label = String(i + 1);
      if (state.w6.melodyEnabled && c) label += '<br><small>' + noteName + '</small>';
      else if (state.w6.chordEnabled && isChord) label += '<br><small>♫</small>';
      return (
        '<div class="seq-cell ' +
        (c ? 'active-a' : isChord && state.w6.chordEnabled ? 'active-b' : '') +
        '" style="width:32px;height:40px;line-height:1.1" data-action="w6ToggleCell" data-args=\'[' +
        i +
        ']\'>' +
        label +
        '</div>'
      );
    })
    .join('');
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function w6IsPrime(n: number): boolean {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}

/** 用 Fibonacci 数列映射到小调音阶的音高级 */
export function w6GenFibonacciMelody(n: number): number[] {
  const out: number[] = [];
  let a = 1, b = 1;
  for (let i = 0; i < n; i++) {
    if (i === 0) out.push(0);
    else if (i === 1) out.push(1);
    else {
      const c = a + b;
      a = b;
      b = c;
      out.push(c);
    }
  }
  return out;
}

/** 质数索引位置（1-indexed）标记为和弦触发点 */
export function w6GenPrimeChordMask(n: number): boolean[] {
  return Array.from({ length: n }, (_, i) => w6IsPrime(i + 1));
}
export function w6ToggleCell(i: number) {
  state.w6.cells[i] = state.w6.cells[i] ? 0 : 1;
  w6RenderGrid();
}
export function w6ApplyEuclid() {
  state.w6.cells = euclideanRhythm(state.w6.target.k, state.w6.target.n);
  w6RenderGrid();
}
export function w6Start() {
  stopSharedTransport();
  state.w6.playing = true;
  state.w6.step = 0;
  const transport = getSharedTransport(state.w6.bpm, 2);
  state.w6.transport = transport;
  const rootOff = ROOT_SEMITONES['C'];
  const scale = SCALES.minor;
  const stepDur = 30 / state.w6.bpm; // steps per beat = 2 => step = 0.5 beat
  transport.subscribe((event: TransportEvent) => {
    const n = state.w6.cells.length;
    const s = event.step % n;
    if (state.w6.cells[s]) playSample('kick', event.time, 0.5);

    if (state.w6.melodyEnabled && state.w6.cells[s]) {
      const note = state.w6.melody[s];
      const semi = rootOff + scale[note % scale.length] + 12 * Math.floor(note / scale.length);
      const oct = Math.floor(semi / 12);
      const freq = NOTE_FREQS[semi % 12] * Math.pow(2, oct);
      scheduleToneAt(freq, 0.25, 'triangle', 0.22, event.time);
    }

    if (state.w6.chordEnabled && state.w6.chords[s]) {
      const note = state.w6.melody[s];
      [0, 2, 4].forEach((off, idx) => {
        const d = note + off;
        const semi = rootOff + scale[d % scale.length] + 12 * Math.floor(d / scale.length);
        const oct = Math.floor(semi / 12);
        const freq = NOTE_FREQS[semi % 12] * Math.pow(2, oct);
        scheduleToneAt(freq, 0.35, 'sine', 0.12, event.time + idx * 0.02);
      });
    }

    if (state.w6.recursiveEnabled && state.w6.cells[s]) {
      // 自相似：每个主击在更短的时间尺度内重复同一欧几里得片段
      const subStep = stepDur / 4;
      for (let j = 0; j < 4; j++) {
        scheduleKickAt(event.time + j * subStep);
      }
    }
  });
  transport.start();
}
export function w6Stop() {
  state.w6.playing = false;
  stopSharedTransport();
  state.w6.transport = null;
}
export function w6TogglePlay() {
  if (state.w6.playing) {
    w6Stop();
    document.getElementById('w6PlayBtn')!.textContent = '▶';
  } else {
    w6Start();
    document.getElementById('w6PlayBtn')!.textContent = '⏸';
  }
}
export function w6Reset() {
  w6Stop();
  state.w6.cells = Array(state.w6.target.n).fill(0);
  state.w6.melodyEnabled = false;
  state.w6.chordEnabled = false;
  state.w6.recursiveEnabled = false;
  state.w6.step = 0;
  document.getElementById('w6PlayBtn')!.textContent = '▶';
  w6UpdateLayerButtons();
  w6RenderGrid();
  document.getElementById('w6Result')!.textContent = '';
  document.getElementById('w6Next')!.classList.remove('show');
}

function w6UpdateLayerButtons() {
  const mb = document.getElementById('w6MelodyBtn');
  const cb = document.getElementById('w6ChordBtn');
  const rb = document.getElementById('w6RecursiveBtn');
  if (mb) mb.className = 'ctrl-btn' + (state.w6.melodyEnabled ? ' active-a' : '');
  if (cb) cb.className = 'ctrl-btn' + (state.w6.chordEnabled ? ' active-a' : '');
  if (rb) rb.className = 'ctrl-btn' + (state.w6.recursiveEnabled ? ' active-a' : '');
}

export function w6ToggleMelody() {
  state.w6.melodyEnabled = !state.w6.melodyEnabled;
  w6UpdateLayerButtons();
  w6RenderGrid();
  w6CheckRecursiveLayers();
}

export function w6ToggleChords() {
  state.w6.chordEnabled = !state.w6.chordEnabled;
  w6UpdateLayerButtons();
  w6RenderGrid();
  w6CheckRecursiveLayers();
}

export function w6ToggleRecursive() {
  state.w6.recursiveEnabled = !state.w6.recursiveEnabled;
  w6UpdateLayerButtons();
  w6CheckRecursiveLayers();
}

function w6CheckRecursiveLayers() {
  if (state.w6.melodyEnabled && state.w6.chordEnabled && state.w6.recursiveEnabled) {
    Store.state.w6RecursiveLayersUsed = true;
    Store.save();
  }
}

/** 打开分段练习模式（基于当前关卡的 E(k,n) 配置）。 */
export function w6OpenPractice() {
  if (!state.w6 || !state.w6.target) return;
  w6Stop();
  openPracticeFromWorld6(state.w6.target.k, state.w6.target.n, state.w6.bpm || 120);
}

export function w6Verify() {
  const target = euclideanRhythm(state.w6.target.k, state.w6.target.n);
  const ok = arraysEqual(state.w6.cells, target);
  const res = document.getElementById('w6Result')!;
  if (ok) {
    playCorrect();
    res.className = 'result-msg correct';
    res.textContent = '✅ 节奏与 E(' + state.w6.target.k + ',' + state.w6.target.n + ') 一致！';
    document.getElementById('w6Next')!.classList.add('show');
    state.combo++;
    let stars = 3 - state.hintLevel;
    if (stars < 1) stars = 1;
    completeLevel(6, state.currentLevel, stars);
    showStars('w6Stars', stars);
    (window as any).spawnConfetti();
    (window as any).spawnCorrectParticles();
    if (state.combo >= 3) (window as any).spawnComboParticles();
    showEducationCard(state.currentLevel);
    recordAdaptive(state.currentLevel, stars);
    updateLeaderboard(state.currentLevel, stars);
    checkAchievements();
  } else {
    playWrong();
    state.combo = 0;
    res.className = 'result-msg wrong';
    res.textContent = '❌ 当前节奏与目标不一致，试试“欧几里得”按钮';
    recordAdaptive(state.currentLevel, 0);
  }
}
/* ===== EXPOSE GLOBALS ===== */
// wire click handlers into the delegation system; the one cell toggler needs
// its index pulled out of data-args rather than the event object
registerActions({
  w6Reset,
  w6TogglePlay,
  w6ApplyEuclid,
  w6ToggleMelody,
  w6ToggleChords,
  w6ToggleRecursive,
  w6Verify,
  w6OpenPractice,
  w6ToggleCell: (_e, i) => w6ToggleCell(i as number),
});
Object.assign(window as any, {
  renderWorld6: renderWorld6,
  w6ApplyEuclid: w6ApplyEuclid,
  w6GenFibonacciMelody: w6GenFibonacciMelody,
  w6GenPrimeChordMask: w6GenPrimeChordMask,
  w6RenderGrid: w6RenderGrid,
  w6Reset: w6Reset,
  w6Start: w6Start,
  w6Stop: w6Stop,
  w6ToggleCell: w6ToggleCell,
  w6ToggleChords: w6ToggleChords,
  w6ToggleMelody: w6ToggleMelody,
  w6TogglePlay: w6TogglePlay,
  w6ToggleRecursive: w6ToggleRecursive,
  w6Verify: w6Verify,
});
