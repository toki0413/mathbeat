/**
 * Harmonics Lab — 傅里叶/加法合成实验室
 *
 * 教学核心：任意周期波形都可分解为正弦谐波之和（傅里叶级数），
 * 而各次谐波的相对振幅正是人耳感知为"音色"的物理量。
 *
 * 玩家通过调节前 N 次谐波的振幅，实时观察合成波形、聆听音色变化，
 * 并在"猜波形"挑战中用数学规则判定是否通关——把三角级数、谐波序列、
 * 收敛速度等数学概念转化为可听可视的交互。
 *
 * 数学锚点：
 *   f(φ) = Σₖ aₖ · sin(k·φ)        （傅里叶级数，一个周期 = 2π）
 *   方波：奇次谐波，aₖ = 1/k
 *   锯齿波：全谐波，aₖ = 1/k
 *   三角波：奇次谐波，aₖ = 1/k²      （收敛更快，更"圆滑"）
 */

import { getAudioCtx, getMasterBus } from './audio';
import { stopAllPlayback } from './game-engine';
import { registerActions, registerInputs } from './events';
import { Store } from './store';
import { spawnConfetti, showSuccessToast } from './fx/particles';
import {
  harmonicAmplitudes,
  evaluateFourier,
  spectralCentroid,
  classifyWaveform,
  cosineSimilarity,
  type WaveformType,
} from './utils';

const NUM_HARMONICS = 8;
const FUNDAMENTAL = 220; // A3

const WAVE_NAMES: Record<WaveformType, string> = {
  sine: '正弦波 (Sine)',
  square: '方波 (Square)',
  sawtooth: '锯齿波 (Sawtooth)',
  triangle: '三角波 (Triangle)',
};

const WAVE_FORMULAS: Record<WaveformType, string> = {
  sine: 'f(φ) = sin(φ)',
  square: 'f(φ) = (4/π)·Σ sin((2k−1)φ)/(2k−1)',
  sawtooth: 'f(φ) = (2/π)·Σ (−1)ᵏ⁺¹·sin(kφ)/k',
  triangle: 'f(φ) = (8/π²)·Σ sin((2k−1)φ)/(2k−1)²',
};

interface WaveLabState {
  amps: number[];
  fundamental: number;
  playing: boolean;
  oscs: OscillatorNode[];
  gains: GainNode[];
  master: GainNode | null;
  challengeTarget: WaveformType | null;
}

const wlState: WaveLabState = {
  amps: harmonicAmplitudes('sine', NUM_HARMONICS),
  fundamental: FUNDAMENTAL,
  playing: false,
  oscs: [],
  gains: [],
  master: null,
  challengeTarget: null,
};

/* ===== AUDIO: additive synthesis with one sine oscillator per harmonic ===== */

function startTone() {
  if (wlState.playing) return;
  const ctx = getAudioCtx();
  const master = ctx.createGain();
  master.gain.value = 0.0;
  master.connect(getMasterBus());
  // Smooth fade-in to avoid clicks.
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.03);

  wlState.oscs = [];
  wlState.gains = [];
  for (let k = 0; k < NUM_HARMONICS; k++) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = wlState.fundamental * (k + 1);
    const g = ctx.createGain();
    g.gain.value = wlState.amps[k];
    osc.connect(g);
    g.connect(master);
    osc.start();
    wlState.oscs.push(osc);
    wlState.gains.push(g);
  }
  wlState.master = master;
  wlState.playing = true;
  const btn = document.getElementById('waveLabPlayBtn');
  if (btn) btn.textContent = '⏸ 停止';
}

function stopTone() {
  if (!wlState.playing) return;
  const ctx = getAudioCtx();
  if (wlState.master) {
    try {
      wlState.master.gain.cancelScheduledValues(ctx.currentTime);
      wlState.master.gain.setValueAtTime(wlState.master.gain.value, ctx.currentTime);
      wlState.master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.03);
    } catch {
      /* ignore */
    }
  }
  const oscs = wlState.oscs;
  const master = wlState.master;
  setTimeout(() => {
    oscs.forEach((o) => {
      try {
        o.stop();
        o.disconnect();
      } catch {
        /* ignore */
      }
    });
    if (master) try { master.disconnect(); } catch { /* ignore */ }
  }, 60);
  wlState.oscs = [];
  wlState.gains = [];
  wlState.master = null;
  wlState.playing = false;
  const btn = document.getElementById('waveLabPlayBtn');
  if (btn) btn.textContent = '▶ 播放';
}

function togglePlay() {
  if (wlState.playing) stopTone();
  else startTone();
}

/** Live-update harmonic gains while playing (no click, no restart). */
function applyAmps() {
  const ctx = getAudioCtx();
  for (let k = 0; k < wlState.gains.length; k++) {
    const g = wlState.gains[k];
    if (g) {
      try {
        g.gain.setTargetAtTime(wlState.amps[k], ctx.currentTime, 0.01);
      } catch {
        g.gain.value = wlState.amps[k];
      }
    }
  }
  drawWaveform();
  renderStats();
}

function setHarmonic(k: number, v: number) {
  wlState.amps[k] = Math.max(0, Math.min(1, v));
  applyAmps();
}

function applyPreset(wave: WaveformType) {
  wlState.amps = harmonicAmplitudes(wave, NUM_HARMONICS).map((a) => Math.min(1, a));
  // Normalize so the fundamental stays at 1 for audible comparison.
  if (wave !== 'sine') {
    const max = Math.max(...wlState.amps);
    if (max > 0) wlState.amps = wlState.amps.map((a) => a / max);
  }
  syncSliders();
  applyAmps();
}

/* ===== RENDERING ===== */

function drawWaveform() {
  const canvas = document.getElementById('waveLabCanvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Midline
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();

  // Individual harmonics (faint) — show the building blocks.
  const ampMax = 1.2;
  for (let k = 0; k < NUM_HARMONICS; k++) {
    if (wlState.amps[k] <= 0.001) continue;
    ctx.strokeStyle = 'rgba(124,107,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x++) {
      const phase = (x / W) * Math.PI * 2;
      const y = H / 2 - (wlState.amps[k] * Math.sin((k + 1) * phase) / ampMax) * (H / 2 - 6);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Sum (Fourier series) — the synthesized waveform.
  ctx.strokeStyle = '#FF8C42';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let x = 0; x <= W; x++) {
    const phase = (x / W) * Math.PI * 2;
    const y = H / 2 - (evaluateFourier(wlState.amps, phase) / ampMax) * (H / 2 - 6);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function renderStats() {
  const el = document.getElementById('waveLabStats');
  if (!el) return;
  const centroid = spectralCentroid(wlState.amps);
  const active = wlState.amps.filter((a) => a > 0.001).length;
  const cls = classifyWaveform(wlState.amps);
  const target = wlState.challengeTarget;
  let html =
    '<div class="wavelab-stat"><span>活跃谐波</span><strong>' + active + ' / ' + NUM_HARMONICS + '</strong></div>' +
    '<div class="wavelab-stat"><span>谱质心</span><strong>' + centroid.toFixed(2) + '</strong></div>' +
    '<div class="wavelab-stat"><span>最接近波形</span><strong>' + WAVE_NAMES[cls.type] + '</strong></div>' +
    '<div class="wavelab-stat"><span>相似度</span><strong>' + (cls.similarity * 100).toFixed(0) + '%</strong></div>';
  if (target) {
    const ref = harmonicAmplitudes(target, NUM_HARMONICS).map((a) => Math.min(1, a));
    const sim = cosineSimilarity(wlState.amps, ref);
    html += '<div class="wavelab-stat wavelab-target"><span>目标：' + WAVE_NAMES[target] + '</span><strong>' + (sim * 100).toFixed(0) + '%</strong></div>';
  }
  el.innerHTML = html;
}

function syncSliders() {
  for (let k = 0; k < NUM_HARMONICS; k++) {
    const s = document.getElementById('wlSlider' + k) as HTMLInputElement | null;
    if (s) s.value = String(wlState.amps[k]);
    const v = document.getElementById('wlVal' + k);
    if (v) v.textContent = wlState.amps[k].toFixed(2);
  }
}

function renderHarmonicControls(): string {
  let html = '<div class="wavelab-harmonics">';
  for (let k = 0; k < NUM_HARMONICS; k++) {
    html +=
      '<div class="wavelab-harm-row">' +
      '<label class="wavelab-harm-label">H' + (k + 1) +
      ' <span class="wavelab-harm-freq">(' + (wlState.fundamental * (k + 1)) + 'Hz)</span></label>' +
      '<input type="range" min="0" max="1" step="0.01" value="' + wlState.amps[k] + '" ' +
      'class="wavelab-slider" id="wlSlider' + k + '" data-input="wlSliderChange" data-args=\'["' + k + '"]\' ' +
      'aria-label="第 ' + (k + 1) + ' 次谐波振幅" />' +
      '<span class="wavelab-harm-val" id="wlVal' + k + '">' + wlState.amps[k].toFixed(2) + '</span>' +
      '</div>';
  }
  html += '</div>';
  return html;
}

function renderInfo() {
  const cls = classifyWaveform(wlState.amps);
  const el = document.getElementById('waveLabInfo');
  if (el) {
    el.innerHTML =
      '<div class="wavelab-formula">' + WAVE_FORMULAS[cls.type] + '</div>' +
      '<div class="wavelab-desc">当前合成波形最接近 <strong>' + WAVE_NAMES[cls.type] + '</strong>。' +
      '谱质心越高，高频能量越多，音色越"明亮"。</div>';
  }
}

/* ===== CHALLENGE MODE ===== */

function startChallenge() {
  const types: WaveformType[] = ['square', 'sawtooth', 'triangle'];
  wlState.challengeTarget = types[Math.floor(Math.random() * types.length)];
  // Reset to sine so the player builds from scratch.
  wlState.amps = harmonicAmplitudes('sine', NUM_HARMONICS);
  syncSliders();
  applyAmps();
  const el = document.getElementById('waveLabChallenge');
  if (el) {
    el.innerHTML =
      '<div class="wavelab-challenge-box">🎯 目标波形：<strong>' + WAVE_NAMES[wlState.challengeTarget] + '</strong>' +
      '<button class="wavelab-verify-btn" data-action="wlVerifyChallenge">验证</button></div>';
  }
  renderInfo();
  renderStats();
}

function verifyChallenge() {
  if (!wlState.challengeTarget) return;
  const ref = harmonicAmplitudes(wlState.challengeTarget, NUM_HARMONICS).map((a) => Math.min(1, a));
  const sim = cosineSimilarity(wlState.amps, ref);
  const el = document.getElementById('waveLabChallenge');
  if (!el) return;
  if (sim >= 0.92) {
    el.innerHTML =
      '<div class="wavelab-challenge-box wavelab-success">✅ 相似度 ' + (sim * 100).toFixed(0) + '% — 通关！' +
      WAVE_FORMULAS[wlState.challengeTarget] + '</div>';
    try {
      spawnConfetti();
      showSuccessToast('傅里叶挑战通过！已记录探索成就。');
    } catch {
      /* particles optional */
    }
    markChallengeComplete();
  } else {
    el.innerHTML =
      '<div class="wavelab-challenge-box wavelab-fail">❌ 相似度仅 ' + (sim * 100).toFixed(0) + '%。' +
      '提示：' + challengeHint(wlState.challengeTarget) + '</div>';
  }
}

function challengeHint(t: WaveformType): string {
  if (t === 'square') return '方波只含奇次谐波 (H1, H3, H5…)，振幅按 1/k 衰减。';
  if (t === 'sawtooth') return '锯齿波含全部谐波，振幅按 1/k 衰减。';
  return '三角波只含奇次谐波，但振幅按 1/k² 衰减得更快。';
}

function markChallengeComplete() {
  const used = Store.state.waveLabChallengesDone || 0;
  Store.state.waveLabChallengesDone = used + 1;
  Store.save();
  const achs = new Set(Store.state.achievements || []);
  let changed = false;
  if (!achs.has('wavelab_first')) { achs.add('wavelab_first'); changed = true; }
  if ((Store.state.waveLabChallengesDone || 0) >= 3 && !achs.has('wavelab_master')) {
    achs.add('wavelab_master'); changed = true;
  }
  if (changed) {
    Store.state.achievements = Array.from(achs);
    Store.save();
  }
  wlState.challengeTarget = null;
}

/* ===== SCREEN ===== */

export function openWaveLab() {
  stopAllPlayback();
  const screen = document.getElementById('waveLabScreen');
  if (!screen) return;
  screen.classList.add('active');
  // (Re)build the interactive panel content.
  const panel = document.getElementById('waveLabPanel');
  if (panel) {
    panel.innerHTML =
      '<div class="wavelab-canvas-wrap"><canvas id="waveLabCanvas" width="448" height="180"></canvas></div>' +
      '<div class="wavelab-presets">' +
        '<button class="wavelab-preset-btn" data-action="wlPreset" data-args=\'["sine"]\'>正弦</button>' +
        '<button class="wavelab-preset-btn" data-action="wlPreset" data-args=\'["square"]\'>方波</button>' +
        '<button class="wavelab-preset-btn" data-action="wlPreset" data-args=\'["sawtooth"]\'>锯齿</button>' +
        '<button class="wavelab-preset-btn" data-action="wlPreset" data-args=\'["triangle"]\'>三角</button>' +
      '</div>' +
      renderHarmonicControls() +
      '<div class="wavelab-controls">' +
        '<button class="ctrl-btn play-btn" id="waveLabPlayBtn" data-action="wlTogglePlay">▶ 播放</button>' +
        '<button class="ctrl-btn" data-action="wlChallenge">🎯 猜波形挑战</button>' +
      '</div>' +
      '<div id="waveLabChallenge"></div>' +
      '<div id="waveLabStats" class="wavelab-stats"></div>' +
      '<div id="waveLabInfo" class="wavelab-info edu-text"></div>';
  }
  syncSliders();
  drawWaveform();
  renderStats();
  renderInfo();
}

export function closeWaveLab() {
  stopTone();
  document.getElementById('waveLabScreen')!.classList.remove('active');
}

export function initWaveLabEvents() {
  registerActions({
    openWaveLab: () => openWaveLab(),
    closeWaveLab: () => closeWaveLab(),
    wlTogglePlay: () => togglePlay(),
    wlPreset: (_e: Event, wave: unknown) => applyPreset(wave as WaveformType),
    wlChallenge: () => startChallenge(),
    wlVerifyChallenge: () => verifyChallenge(),
  });
  registerInputs({
    wlSliderChange: (e: Event) => {
      const input = e.target as HTMLInputElement;
      const k = parseInt(input.dataset.args ? JSON.parse(input.dataset.args)[0] : '0', 10);
      setHarmonic(k, parseFloat(input.value));
      const v = document.getElementById('wlVal' + k);
      if (v) v.textContent = parseFloat(input.value).toFixed(2);
    },
  });
}
