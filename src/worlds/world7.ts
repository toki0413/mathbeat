import { state, completeLevel, recordAdaptive, updateLeaderboard, checkAchievements } from '../game-engine';
import { Store } from '../store';
import { LEVELS } from '../worlds';
import {
  scheduleToneAt,
  getAudioCtx,
  playSample,
  playCorrect,
  playWrong,
  getSharedTransport,
  stopSharedTransport,
} from '../audio';
import type { Transport, TransportEvent } from '../core/transport';
import { showStars, showEducationCard, showHintFloat } from '../ui-render';
import { registerActions, registerInputs } from '../events';

/* ===== WORLD 7: PROBABILITY & RANDOMNESS ===== */
export function renderWorld7(container: HTMLElement, lid: string) {
  if (lid === '7-1' || lid === '7-4') {
    renderW7Dice(container, lid === '7-4' ? 80 : 50);
  } else if (lid === '7-2' || lid === '7-5') {
    renderW7Markov(container);
  } else if (lid === '7-3') {
    renderW7Normal(container);
  }
}
export function renderW7Dice(container: HTMLElement, initialProb: number) {
  const prob = initialProb || 50;
  state.w7 = {
    type: 'dice',
    prob: prob,
    cells: Array(16).fill(0),
    playing: false,
    transport: null as Transport | null,
    step: 0,
    bpm: 120,
  };
  container.innerHTML =
    '<div class="challenge-card"><div class="challenge-q">掷骰子节奏：每步以概率 p 随机触发。</div><div style="margin:10px 0"><label style="font-size:14px;font-weight:700">触发概率 <span id="w7ProbVal">' +
    prob +
    '</span>%</label><input type="range" id="w7Prob" min="10" max="90" value="' +
    prob +
    '" style="width:100%;margin:6px 0" data-input="w7ProbChange"></div><div class="controls-bar"><button class="ctrl-btn" data-action="w7RollDice">🎲 掷骰子</button><button class="ctrl-btn play-btn" id="w7PlayBtn" data-action="w7TogglePlay">▶</button><button class="verify-btn" data-action="w7Verify">验证</button></div><div id="w7Grid" style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap;margin:12px 0"></div><div class="result-msg" id="w7Result"></div><div class="stars-row" id="w7Stars"></div><button class="next-btn" id="w7Next" data-action="nextLevel">下一关 →</button></div>';
  w7RollDice();
  w7RenderGrid();
  showHintFloat('拖动概率，点击“掷骰子”生成随机节奏。');
}
export function w7ProbChange(v: string) {
  state.w7.prob = parseInt(v);
  const el = document.getElementById('w7ProbVal');
  if (el) el.textContent = state.w7.prob;
}
export function w7RollDice() {
  state.w7.cells = Array(16)
    .fill(0)
    .map(() => (Math.random() * 100 < state.w7.prob ? 1 : 0));
  w7RenderGrid();
  const total = state.w7.cells.reduce((a: number, b: number) => a + b, 0);
  if (total >= 4) {
    Store.state.luckyStreak = (Store.state.luckyStreak || 0) + 1;
  } else {
    Store.state.luckyStreak = 0;
  }
  Store.save();
}
export function w7RenderGrid() {
  const el = document.getElementById('w7Grid');
  if (!el) return;
  el.innerHTML = state.w7.cells
    .map(
      (c: number, i: number) =>
        '<div class="seq-cell ' + (c ? 'active-a' : '') + '" style="width:32px;height:40px">' + (i + 1) + '</div>'
    )
    .join('');
}
export function w7Start() {
  stopSharedTransport();
  state.w7.playing = true;
  state.w7.step = 0;
  const transport = getSharedTransport(state.w7.bpm, 2);
  state.w7.transport = transport;
  transport.subscribe((event: TransportEvent) => {
    const s = event.step % 16;
    if (state.w7.cells[s]) playSample('kick', event.time, 0.5);
  });
  transport.start();
}
export function w7Stop() {
  state.w7.playing = false;
  stopSharedTransport();
  state.w7.transport = null;
}
export function w7TogglePlay() {
  if (state.w7.playing) {
    w7Stop();
    document.getElementById('w7PlayBtn')!.textContent = '▶';
  } else {
    w7Start();
    document.getElementById('w7PlayBtn')!.textContent = '⏸';
  }
}
export function w7Verify() {
  const total = state.w7.cells.reduce((a: number, b: number) => a + b, 0);
  const res = document.getElementById('w7Result')!;
  if (total >= 4) {
    playCorrect();
    res.className = 'result-msg correct';
    res.textContent = '✅ 随机节奏有效（' + total + ' 个音符）';
    document.getElementById('w7Next')!.classList.add('show');
    state.combo++;
    let stars = 3 - state.hintLevel;
    if (stars < 1) stars = 1;
    completeLevel(7, state.currentLevel, stars);
    showStars('w7Stars', stars);
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
    res.textContent = '❌ 音符太少，试着提高概率或重新掷骰子';
    recordAdaptive(state.currentLevel, 0);
  }
}

export const W7_SCALE_NAMES = ['C', 'D', 'E', 'F#', 'G#', 'A#'];
export const W7_SCALE_FREQS = [261.63, 293.66, 329.63, 369.99, 415.3, 466.16];
const W7_STATE_COUNT = 6;

function w7DefaultMatrix(): number[][] {
  const m: number[][] = [];
  for (let i = 0; i < W7_STATE_COUNT; i++) {
    const row = Array(W7_STATE_COUNT).fill(0.02);
    row[i] = 0.45;
    row[(i + 1) % W7_STATE_COUNT] = 0.25;
    row[(i + W7_STATE_COUNT - 1) % W7_STATE_COUNT] = 0.2;
    row[(i + 2) % W7_STATE_COUNT] = 0.05;
    row[(i + W7_STATE_COUNT - 2) % W7_STATE_COUNT] = 0.03;
    m.push(row);
  }
  return m;
}

export function renderW7Markov(container: HTMLElement) {
  state.w7 = {
    type: 'markov',
    matrix: w7DefaultMatrix(),
    melody: [],
    playing: false,
    transport: null as Transport | null,
    step: 0,
    bpm: 120,
  };
  container.innerHTML =
    '<div class="challenge-card"><div class="challenge-q">马尔可夫链旋律：编辑 6×6 转移矩阵，在全音阶上随机游走。</div><div style="font-size:13px;color:var(--dim);margin:6px 0">每行概率和需 ≈1。列代表下一音，行代表当前音（C D E F# G# A#）。</div><div id="w7MarkovMatrix" style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin:10px 0;font-size:12px;text-align:center"></div><div class="controls-bar" style="flex-wrap:wrap;gap:6px"><button class="ctrl-btn play-btn" id="w7PlayBtn" data-action="w7MarkovPlay">▶</button><button class="ctrl-btn" data-action="w7MarkovGen">生成旋律</button><button class="ctrl-btn" data-action="w7MarkovNormalize">归一化</button><button class="verify-btn" data-action="w7MarkovVerify">验证</button></div><div id="w7MarkovRow" style="display:flex;gap:4px;justify-content:center;margin:12px 0;flex-wrap:wrap"></div><div class="result-msg" id="w7Result"></div><div class="stars-row" id="w7Stars"></div><button class="next-btn" id="w7Next" data-action="nextLevel">下一关 →</button></div>';
  w7MarkovMatrixRender();
  w7MarkovGen();
}
export function w7MarkovStep(cur: number) {
  const row = state.w7.matrix[cur];
  let r = Math.random(),
    acc = 0;
  for (let i = 0; i < row.length; i++) {
    acc += row[i];
    if (r < acc) return i;
  }
  return row.length - 1;
}

export function w7MarkovMatrixRender() {
  const el = document.getElementById('w7MarkovMatrix');
  if (!el) return;
  let html = '<div style="font-weight:700"></div>';
  for (let j = 0; j < W7_STATE_COUNT; j++) html += '<div style="color:var(--w7);font-weight:700">' + W7_SCALE_NAMES[j] + '</div>';
  for (let i = 0; i < W7_STATE_COUNT; i++) {
    html += '<div style="font-weight:700;color:var(--w7)">' + W7_SCALE_NAMES[i] + '</div>';
    for (let j = 0; j < W7_STATE_COUNT; j++) {
      html +=
        '<input type="number" min="0" max="1" step="0.05" value="' +
        state.w7.matrix[i][j].toFixed(2) +
        '" style="width:100%;padding:2px;text-align:center;background:var(--card);border:1px solid var(--dim);border-radius:4px;color:var(--text)" data-input="w7MarkovMatrixChange" data-row="' +
        i +
        '" data-col="' +
        j +
        '">';
    }
  }
  el.innerHTML = html;
}

export function w7MarkovMatrixChange(row: number, col: number, val: string) {
  const v = parseFloat(val);
  state.w7.matrix[row][col] = isNaN(v) ? 0 : Math.max(0, v);
  Store.state.w7MarkovEdited = true;
  Store.save();
  w7MarkovMatrixRender();
}

export function w7MarkovNormalize() {
  state.w7.matrix = state.w7.matrix.map((row: number[]) => {
    const sum = row.reduce((a: number, b: number) => a + b, 0);
    if (sum === 0) return row.map(() => 1 / row.length);
    return row.map((v: number) => (sum > 0 ? v / sum : 0));
  });
  w7MarkovMatrixRender();
}
export function w7MarkovGen() {
  let cur = 0;
  const seq = [cur];
  for (let i = 0; i < 15; i++) {
    cur = w7MarkovStep(cur);
    seq.push(cur);
  }
  state.w7.melody = seq;
  w7MarkovRender();
}
export function w7MarkovRender() {
  const el = document.getElementById('w7MarkovRow');
  if (!el) return;
  el.innerHTML = state.w7.melody
    .map((d: number, i: number) => '<div class="seq-cell active-a" style="width:32px;height:40px">' + W7_SCALE_NAMES[d] + '</div>')
    .join('');
}
export function w7MarkovPlay() {
  if (state.w7.melody.length === 0) w7MarkovGen();
  stopSharedTransport();
  state.w7.playing = true;
  state.w7.step = 0;
  const transport = getSharedTransport(state.w7.bpm, 2);
  state.w7.transport = transport;
  let playedSteps = 0;
  transport.subscribe((event: TransportEvent) => {
    const len = state.w7.melody.length;
    const s = event.step % len;
    scheduleToneAt(W7_SCALE_FREQS[state.w7.melody[s]], 0.2, 'triangle', 0.35, event.time);
    playedSteps++;
    if (playedSteps >= len) transport.stop();
  });
  transport.start();
}
export function w7MarkovStop() {
  state.w7.playing = false;
  stopSharedTransport();
  state.w7.transport = null;
}
export function w7MarkovVerify() {
  if (state.w7.melody.length === 0) w7MarkovGen();
  const res = document.getElementById('w7Result')!;
  const rowSums = state.w7.matrix.map((r: number[]) => r.reduce((a: number, b: number) => a + b, 0));
  const invalid = rowSums.some((s: number) => s < 0.95 || s > 1.05);
  if (invalid) {
    w7MarkovNormalize();
    res.className = 'result-msg wrong';
    res.textContent = '⚠️ 转移概率已自动归一化，请重新生成旋律后再验证';
    return;
  }
  if (state.w7.melody.length >= 8) {
    playCorrect();
    res.className = 'result-msg correct';
    res.textContent = '✅ 马尔可夫旋律生成成功！';
    document.getElementById('w7Next')!.classList.add('show');
    state.combo++;
    let stars = 3 - state.hintLevel;
    if (stars < 1) stars = 1;
    completeLevel(7, state.currentLevel, stars);
    showStars('w7Stars', stars);
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
    res.textContent = '❌ 旋律太短，请重新生成';
    recordAdaptive(state.currentLevel, 0);
  }
}

export function renderW7Normal(container: HTMLElement) {
  state.w7 = {
    type: 'normal',
    mu: 8,
    sigma: 3,
    velocities: Array(16).fill(0.5),
    playing: false,
    transport: null as Transport | null,
    step: 0,
    bpm: 120,
  };
  container.innerHTML =
    '<div class="challenge-card"><div class="challenge-q">正态分布力度：用钟形曲线给 16 步分配力度。</div><div style="margin:8px 0"><label style="font-size:14px;font-weight:700">峰值位置 μ</label><input type="range" id="w7Mu" min="0" max="15" value="8" style="width:100%;margin:4px 0" data-input="w7NormalUpdate"></div><div style="margin:8px 0"><label style="font-size:14px;font-weight:700">标准差 σ</label><input type="range" id="w7Sigma" min="1" max="5" value="3" style="width:100%;margin:4px 0" data-input="w7NormalUpdate"></div><div class="controls-bar"><button class="ctrl-btn play-btn" id="w7PlayBtn" data-action="w7NormalPlay">▶</button><button class="ctrl-btn" data-action="w7NormalGen">生成曲线</button><button class="verify-btn" data-action="w7NormalVerify">验证</button></div><div id="w7NormalBars" style="display:flex;align-items:flex-end;gap:3px;justify-content:center;height:90px;margin:12px 0"></div><div class="result-msg" id="w7Result"></div><div class="stars-row" id="w7Stars"></div><button class="next-btn" id="w7Next" data-action="nextLevel">下一关 →</button></div>';
  w7NormalGen();
}
export function w7NormalUpdate() {
  const mu = parseInt((document.getElementById('w7Mu') as HTMLInputElement).value),
    sigma = parseInt((document.getElementById('w7Sigma') as HTMLInputElement).value);
  state.w7.mu = mu;
  state.w7.sigma = sigma;
  w7NormalGen();
}
export function w7NormalGen() {
  const mu = state.w7.mu,
    sigma = state.w7.sigma;
  state.w7.velocities = Array(16)
    .fill(0)
    .map((_, i) => {
      const v = Math.exp(-Math.pow(i - mu, 2) / (2 * sigma * sigma));
      return Math.max(0.1, Math.min(1, v));
    });
  w7NormalRender();
}
export function w7NormalRender() {
  const el = document.getElementById('w7NormalBars');
  if (!el) return;
  el.innerHTML = state.w7.velocities
    .map(
      (v: number) =>
        '<div style="width:22px;background:var(--w7);border-radius:4px 4px 0 0;height:' +
        v * 80 +
        'px;opacity:' +
        (0.4 + v * 0.6) +
        '"></div>'
    )
    .join('');
}
export function w7NormalPlay() {
  stopSharedTransport();
  state.w7.playing = true;
  state.w7.step = 0;
  const freqs = [261.63, 293.66, 329.63, 349.23, 392.0];
  const transport = getSharedTransport(state.w7.bpm, 2);
  state.w7.transport = transport;
  let playedSteps = 0;
  transport.subscribe((event: TransportEvent) => {
    const s = event.step % 16;
    const v = state.w7.velocities[s];
    scheduleToneAt(freqs[s % 5], 0.2, 'sine', 0.15 + 0.4 * v, event.time);
    playedSteps++;
    if (playedSteps >= 16) transport.stop();
  });
  transport.start();
}
export function w7NormalStop() {
  state.w7.playing = false;
  stopSharedTransport();
  state.w7.transport = null;
}
export function w7NormalVerify() {
  const mu = state.w7.mu;
  let peak = -1,
    peakIdx = -1;
  state.w7.velocities.forEach((v: number, i: number) => {
    if (v > peak) {
      peak = v;
      peakIdx = i;
    }
  });
  const left = state.w7.velocities.slice(0, mu),
    right = state.w7.velocities.slice(mu + 1);
  const leftUp = left.every((v: number, i: number) => i === 0 || v >= left[i - 1]);
  const rightDown = right.every((v: number, i: number) => i === 0 || v <= right[i - 1]);
  const res = document.getElementById('w7Result')!;
  if (Math.abs(peakIdx - mu) <= 1 && (leftUp || left.length === 0) && (rightDown || right.length === 0)) {
    playCorrect();
    res.className = 'result-msg correct';
    res.textContent = '✅ 力度曲线呈钟形分布！';
    document.getElementById('w7Next')!.classList.add('show');
    state.combo++;
    let stars = 3 - state.hintLevel;
    if (stars < 1) stars = 1;
    completeLevel(7, state.currentLevel, stars);
    showStars('w7Stars', stars);
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
    res.textContent = '❌ 曲线还不够像钟形，调整 μ 和 σ 再试试';
    recordAdaptive(state.currentLevel, 0);
  }
}
/* ===== EXPOSE GLOBALS ===== */
// register click + input handlers with the delegation system. Inputs that need
// extra context (matrix cell coords, slider value) read it from the event target.
registerActions({
  w7RollDice,
  w7TogglePlay,
  w7Verify,
  w7MarkovPlay,
  w7MarkovGen,
  w7MarkovNormalize,
  w7MarkovVerify,
  w7NormalPlay,
  w7NormalGen,
  w7NormalVerify,
});
registerInputs({
  w7ProbChange: (e) => w7ProbChange((e.target as HTMLInputElement).value),
  w7NormalUpdate,
  w7MarkovMatrixChange: (e) => {
    const el = e.target as HTMLInputElement;
    w7MarkovMatrixChange(parseInt(el.dataset.row || '0'), parseInt(el.dataset.col || '0'), el.value);
  },
});
Object.assign(window as any, {
  renderW7Dice: renderW7Dice,
  renderW7Markov: renderW7Markov,
  renderW7Normal: renderW7Normal,
  renderWorld7: renderWorld7,
  w7MarkovGen: w7MarkovGen,
  w7MarkovMatrixChange: w7MarkovMatrixChange,
  w7MarkovMatrixRender: w7MarkovMatrixRender,
  w7MarkovNormalize: w7MarkovNormalize,
  w7MarkovPlay: w7MarkovPlay,
  w7MarkovRender: w7MarkovRender,
  w7MarkovStep: w7MarkovStep,
  w7MarkovStop: w7MarkovStop,
  w7MarkovVerify: w7MarkovVerify,
  w7NormalGen: w7NormalGen,
  w7NormalPlay: w7NormalPlay,
  w7NormalRender: w7NormalRender,
  w7NormalStop: w7NormalStop,
  w7NormalUpdate: w7NormalUpdate,
  w7NormalVerify: w7NormalVerify,
  w7ProbChange: w7ProbChange,
  w7RenderGrid: w7RenderGrid,
  w7RollDice: w7RollDice,
  w7Start: w7Start,
  w7Stop: w7Stop,
  w7TogglePlay: w7TogglePlay,
  w7Verify: w7Verify,
});
