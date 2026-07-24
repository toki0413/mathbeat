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
  getSharedTransport,
  stopSharedTransport,
} from '../audio';
import type { Transport, TransportEvent } from '../core/transport';
import { lcmCalc } from '../utils';
import { showStars, showEducationCard } from '../ui-render';
import { registerActions } from '../events';
import { openPracticeFromWorld4 } from '../practice-mode';

export function renderWorld4(container: HTMLElement, lid: string) {
  const lv = LEVELS[4].find((l) => l.id === lid);
  if (!lv) return;
  const a = lv.a!,
    b = lv.b!;
  state.w4 = { lid, a, b, lcm: lcmCalc(a, b), playing: false, transport: null as Transport | null, step: 0, bpm: 100 };
  container.innerHTML =
    '<div class="challenge-card"><div class="challenge-q">双环对齐：外环每 ' +
    a +
    '步一圈，内环每 ' +
    b +
    ' 步一圈。它们何时重合？</div><div style="margin:12px 0"><div style="font-size:13px;font-weight:700;margin-bottom:4px">外环位置</div><div class="w4bar" id="w4barA" style="height:16px;background:#f5f0ea;border-radius:8px;overflow:hidden"><div style="width:0%;height:100%;background:var(--trackA);transition:width .1s linear"></div></div></div><div style="margin:12px 0"><div style="font-size:13px;font-weight:700;margin-bottom:4px">内环位置</div><div class="w4bar" id="w4barB" style="height:16px;background:#f5f0ea;border-radius:8px;overflow:hidden"><div style="width:0%;height:100%;background:var(--trackB);transition:width .1s linear"></div></div></div><div class="controls-bar"><button class="ctrl-btn play-btn" id="w4PlayBtn" data-action="w4TogglePlay">▶</button><button class="ctrl-btn" data-action="w4Reset">⟲</button></div><div class="practice-entry" style="margin-top:8px;text-align:center"><button class="ctrl-btn" data-action="w4OpenPractice" style="background:linear-gradient(135deg,#7c6bff,#a78bfa);color:#fff;font-size:13px">🎯 进入分段练习</button></div><div class="challenge-card" style="margin-top:8px"><div class="challenge-q">它们在多少步后重合？</div><div class="challenge-input-row"><input class="challenge-input" id="w4Input" type="number" placeholder="输入LCM"><button class="verify-btn" data-action="w4Verify">验证</button></div><div class="result-msg" id="w4Result"></div><div class="stars-row" id="w4Stars"></div><button class="next-btn" id="w4Next" data-action="nextLevel">下一关 →</button></div></div>';
}
export function w4Start() {
  stopSharedTransport();
  state.w4.playing = true;
  state.w4.step = 0;
  const transport = getSharedTransport(state.w4.bpm, 1);
  state.w4.transport = transport;
  let lastVisualStep = -1;
  transport.subscribe((event: TransportEvent) => {
    const s = event.step;
    const t = event.time;
    const posA = (s % state.w4.a) / state.w4.a;
    const posB = (s % state.w4.b) / state.w4.b;
    const barA = document.querySelector('#w4barA div') as HTMLElement;
    const barB = document.querySelector('#w4barB div') as HTMLElement;
    if (barA) barA.style.width = posA * 100 + '%';
    if (barB) barB.style.width = posB * 100 + '%';
    if (s % state.w4.a === 0 && s % state.w4.b === 0 && s > 0) {
      scheduleKickAt(t);
      scheduleToneAt(660, 0.2, 'sine', 0.25, t);
    } else if (s % state.w4.a === 0) {
      scheduleKickAt(t);
    } else if (s % state.w4.b === 0) {
      scheduleSnareAt(t);
    }
    if (s !== lastVisualStep) {
      lastVisualStep = s;
      if (s > 0 && s % state.w4.lcm === 0) state.w4.step = 0;
    }
  });
  transport.start();
}
export function w4Stop() {
  state.w4.playing = false;
  stopSharedTransport();
  state.w4.transport = null;
}
export function w4TogglePlay() {
  if (state.w4.playing) {
    w4Stop();
    document.getElementById('w4PlayBtn')!.textContent = '▶';
  } else {
    w4Start();
    document.getElementById('w4PlayBtn')!.textContent = '⏸';
  }
}
export function w4Reset() {
  w4Stop();
  state.w4.step = 0;
  document.getElementById('w4PlayBtn')!.textContent = '▶';
}

/** 打开分段练习模式（基于当前关卡的双环配置）。 */
export function w4OpenPractice() {
  if (!state.w4 || !state.w4.a) return;
  w4Stop();
  openPracticeFromWorld4(state.w4.a, state.w4.b, state.w4.lcm, state.w4.bpm || 100);
}
export function w4Verify() {
  const v = parseInt((document.getElementById('w4Input') as HTMLInputElement).value);
  const res = document.getElementById('w4Result')!;
  if (v === state.w4.lcm) {
    playCorrect();
    res.className = 'result-msg correct';
    res.textContent = '✅ 重合在 ' + state.w4.lcm + ' 步！';
    document.getElementById('w4Next')!.classList.add('show');
    state.combo++;
    let stars = 3 - state.hintLevel;
    if (stars < 1) stars = 1;
    completeLevel(4, state.currentLevel, stars);
    showStars('w4Stars', stars);
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
    res.textContent = '❌ 再听听看重合点在哪里';
    recordAdaptive(state.currentLevel, 0);
  }
}
/* ===== EXPOSE GLOBALS ===== */
registerActions({ w4TogglePlay, w4Reset, w4Verify, w4OpenPractice, nextLevel });
// Keep window exposure for backwards compat
Object.assign(window as any, {
  renderWorld4: renderWorld4,
  w4Reset: w4Reset,
  w4Start: w4Start,
  w4Stop: w4Stop,
  w4TogglePlay: w4TogglePlay,
  w4Verify: w4Verify,
  w4OpenPractice: w4OpenPractice,
});
