import { state, completeLevel, recordAdaptive, updateLeaderboard, checkAchievements, nextLevel } from '../game-engine';
import { Store } from '../store';
import { LEVELS } from '../worlds';
import {
  getAudioCtx,
  playSample,
  scheduleToneAt,
  scheduleKickAt,
  scheduleSnareAt,
  playCorrect,
  playWrong,
} from '../audio';
import { showStars, showEducationCard } from '../ui-render';
import { registerActions, registerInputs } from '../events';

export function renderWorld3(container: HTMLElement, lid: string) {
  // w3BossPerfect 在 DEFAULT_STATE 中初始为 true；一旦玩家答错即设为 false，不再重置。
  const targets = { '3-1': 3 / 2, '3-2': 5 / 4, '3-3': 7 / 4, '3-4': 9 / 8, '3-5': 4 / 3, '3-B': 11 / 8 };
  state.w3 = { lid, target: targets[lid as keyof typeof targets] || 1.5, a: 440, b: 440 };
  container.innerHTML =
    '<div class="challenge-card"><div class="challenge-q">调整 B 的频率，使 A:B 接近 <span style="color:var(--w3)">' +
    state.w3.target.toFixed(3) +
    '</span></div><div style="text-align:center;margin:12px 0;font-size:28px;font-weight:900;color:var(--w3)" id="w3Ratio">1.000</div><div style="font-size:14px;font-weight:700;text-align:center;margin-bottom:8px">A=440Hz</div><input type="range" id="w3Slider" min="200" max="1000" value="440" style="width:100%;margin:8px 0" data-input="w3SliderChange"><div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;color:var(--dim)"><span>200Hz</span><span id="w3Bval">B=440Hz</span><span>1000Hz</span></div><div style="text-align:center;font-size:13px;color:var(--dim);margin-top:6px" id="w3Beat">拍频：-- Hz</div><canvas id="w3Harmonics" width="360" height="120" style="width:100%;max-width:360px;height:120px;background:var(--bg);border-radius:12px;margin:10px auto;display:block"></canvas><div class="controls-bar" style="margin-top:10px;flex-wrap:wrap;gap:6px"><button class="ctrl-btn play-btn" id="w3PlayBtn" data-action="w3PlayOnce">▶ 试听</button><button class="ctrl-btn" data-action="w3PlayJustIntonation">🎵 纯律目标</button><button class="ctrl-btn" data-action="w3PlayEqualTemperament">🎹 平均律</button><button class="ctrl-btn" data-action="w3PlayABComparison">🔁 A/B 对比</button><button class="verify-btn" data-action="w3Verify">验证</button></div><div class="result-msg" id="w3Result"></div><div class="stars-row" id="w3Stars"></div><button class="next-btn" id="w3Next" data-action="nextLevel">下一关 →</button></div>';
  w3SliderChange(440);
}

export function w3SliderChange(v: string | number | Event) {
  const val = v instanceof Event ? (v.target as HTMLInputElement).value : v;
  state.w3.b = parseInt(String(val));
  const ratio = state.w3.b / state.w3.a;
  document.getElementById('w3Bval')!.textContent = 'B=' + state.w3.b + 'Hz';
  const el = document.getElementById('w3Ratio');
  if (el) el.textContent = ratio.toFixed(3);
  const targetHz = state.w3.a * state.w3.target;
  const beat = Math.abs(state.w3.b - targetHz);
  const beatEl = document.getElementById('w3Beat');
  if (beatEl) beatEl.textContent = '拍频：' + beat.toFixed(1) + ' Hz（越接近 0 越准）';
  w3DrawHarmonics();
}

/** 绘制 A、B 的前 8 次谐波列，直观展示频率对齐 / 拍频 */
export function w3DrawHarmonics() {
  const canvas = document.getElementById('w3Harmonics') as HTMLCanvasElement;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const minF = 200;
  const maxF = 8000;
  const logW = Math.log2(maxF / minF);
  const xFor = (f: number) => ((Math.log2(f / minF) / logW) * (width - 24)) + 12;
  const yBase = height - 24;
  const hCount = 8;

  // 网格与标签
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, yBase);
  ctx.lineTo(width, yBase);
  ctx.stroke();

  // A 谐波（橙色）
  ctx.strokeStyle = '#f39c12';
  ctx.lineWidth = 2;
  for (let i = 1; i <= hCount; i++) {
    const f = state.w3.a * i;
    if (f > maxF) break;
    const x = xFor(f);
    ctx.beginPath();
    ctx.moveTo(x, yBase);
    ctx.lineTo(x, yBase - 48);
    ctx.stroke();
  }

  // B 谐波（青色）
  ctx.strokeStyle = '#00d4ff';
  for (let i = 1; i <= hCount; i++) {
    const f = state.w3.b * i;
    if (f > maxF) break;
    const x = xFor(f);
    ctx.beginPath();
    ctx.moveTo(x, yBase);
    ctx.lineTo(x, yBase - 32);
    ctx.stroke();
  }

  // 目标 B 谐波（半透明虚线）
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1.5;
  for (let i = 1; i <= hCount; i++) {
    const f = state.w3.a * state.w3.target * i;
    if (f > maxF) break;
    const x = xFor(f);
    ctx.beginPath();
    ctx.moveTo(x, yBase);
    ctx.lineTo(x, 8);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // 图例
  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#f39c12';
  ctx.fillText('A 谐波', 8, 16);
  ctx.fillStyle = '#00d4ff';
  ctx.fillText('B 谐波', 68, 16);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('纯律目标', 128, 16);
}

export function w3PlayOnce() {
  const ctx = getAudioCtx();
  const t = ctx.currentTime + 0.02;
  scheduleToneAt(state.w3.a, 0.6, 'sine', 0.25, t);
  scheduleToneAt(state.w3.b, 0.6, 'sine', 0.25, t + 0.01);
}

function w3RecordRatioHeard() {
  const key = state.w3.target.toFixed(3);
  const set = new Set(Store.state.w3RatiosHeard || []);
  set.add(key);
  Store.state.w3RatiosHeard = Array.from(set);
  Store.save();
}

/** 播放当前目标频率比的纯律版本 */
export function w3PlayJustIntonation() {
  const ctx = getAudioCtx();
  const t = ctx.currentTime + 0.02;
  scheduleToneAt(state.w3.a, 0.6, 'sine', 0.25, t);
  scheduleToneAt(state.w3.a * state.w3.target, 0.6, 'sine', 0.25, t + 0.01);
  w3RecordRatioHeard();
}

/** 播放最接近的平均律音 */
export function w3PlayEqualTemperament() {
  const ctx = getAudioCtx();
  const t = ctx.currentTime + 0.02;
  const targetCents = 1200 * Math.log2(state.w3.target);
  const equalMidi = 69 + targetCents / 100;
  const equalFreq = 440 * Math.pow(2, (equalMidi - 69) / 12);
  scheduleToneAt(state.w3.a, 0.6, 'sine', 0.25, t);
  scheduleToneAt(equalFreq, 0.6, 'sine', 0.25, t + 0.01);
  w3RecordRatioHeard();
}

/** A/B 对比：当前 B → 纯律目标 → 平均律，连续播放便于辨认可听差 */
export function w3PlayABComparison() {
  const ctx = getAudioCtx();
  const t = ctx.currentTime + 0.05;
  const targetCents = 1200 * Math.log2(state.w3.target);
  const equalMidi = 69 + targetCents / 100;
  const equalFreq = 440 * Math.pow(2, (equalMidi - 69) / 12);
  const gap = 0.7;
  // A 参考始终陪伴
  [0, gap, gap * 2].forEach((offset) => scheduleToneAt(state.w3.a, 0.55, 'sine', 0.18, t + offset));
  // B 当前、纯律目标、平均律
  scheduleToneAt(state.w3.b, 0.55, 'sine', 0.25, t);
  scheduleToneAt(state.w3.a * state.w3.target, 0.55, 'sine', 0.25, t + gap);
  scheduleToneAt(equalFreq, 0.55, 'sine', 0.25, t + gap * 2);
  w3RecordRatioHeard();
}

export function w3Verify() {
  const targetHz = state.w3.a * state.w3.target;
  const diffHz = Math.abs(state.w3.b - targetHz);
  // 音分误差，与频率绝对值无关
  const centDiff = Math.abs(1200 * Math.log2(state.w3.b / targetHz));
  const res = document.getElementById('w3Result')!;
  if (centDiff <= 30) {
    playCorrect();
    state.combo++;
    // 按音分精度定星：≤5¢ 3 星，≤15¢ 2 星，≤30¢ 1 星；使用提示再扣星
    let baseStars = centDiff <= 5 ? 3 : centDiff <= 15 ? 2 : 1;
    let stars = Math.max(1, baseStars - state.hintLevel);
    res.className = 'result-msg correct';
    res.textContent =
      '✅ 频率比正确！B=' +
      state.w3.b +
      'Hz，误差约 ' +
      centDiff.toFixed(1) +
      ' 音分，拍频 ' +
      diffHz.toFixed(1) +
      ' Hz';
    document.getElementById('w3Next')!.classList.add('show');
    completeLevel(3, state.currentLevel, stars);
    showStars('w3Stars', stars);
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
    const direction = state.w3.b > targetHz ? '偏高' : '偏低';
    res.textContent =
      '❌ 当前 B=' +
      state.w3.b +
      'Hz（目标约 ' +
      targetHz.toFixed(1) +
      'Hz，误差 ' +
      centDiff.toFixed(1) +
      ' 音分），把滑块往' +
      (state.w3.b > targetHz ? '左' : '右') +
      '调，B 的频率' +
      direction +
      '了';
    recordAdaptive(state.currentLevel, 0);
    if (state.currentLevel === '3-B') {
      Store.state.w3BossPerfect = false;
      Store.save();
    }
  }
}
/* ===== EXPOSE GLOBALS ===== */
registerActions({ w3PlayOnce, w3PlayJustIntonation, w3PlayEqualTemperament, w3PlayABComparison, w3Verify, nextLevel });
registerInputs({ w3SliderChange });
// Keep window exposure for backwards compat
Object.assign(window as any, {
  renderWorld3: renderWorld3,
  w3PlayABComparison: w3PlayABComparison,
  w3PlayEqualTemperament: w3PlayEqualTemperament,
  w3PlayJustIntonation: w3PlayJustIntonation,
  w3PlayOnce: w3PlayOnce,
  w3SliderChange: w3SliderChange,
  w3Verify: w3Verify,
});
