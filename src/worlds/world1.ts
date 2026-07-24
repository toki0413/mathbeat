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
import { lcmCalc } from '../utils';
import { showHintFloat, showStars, showEducationCard } from '../ui-render';
import { registerActions } from '../events';
import { openPracticeFromWorld1 } from '../practice-mode';
import type { Transport, TransportEvent } from '../core/transport';

interface W1ScheduledEvent {
  step: number;
  track: 'A' | 'B';
}

export function renderWorld1(container: HTMLElement, lid: string) {
  const lv = LEVELS[1].find((l) => l.id === lid);
  if (!lv) return;
  const a = lv.a!,
    b = lv.b!;
  const lcmVal = lcmCalc(a, b);
  state.w1 = {
    playing: false,
    a,
    b,
    lcm: lcmVal,
    activeA: {},
    activeB: {},
    playedOnce: false,
    scheduledEvents: [] as W1ScheduledEvent[],
    transport: null as Transport | null,
  };
  for (let i = 1; i <= lcmVal; i++) {
    if (i % a === 0) state.w1.activeA[i] = true;
    if (i % b === 0) state.w1.activeB[i] = true;
  }
  state.bpm = 120;
  container.innerHTML =
    '<div class="challenge-card"><div class="challenge-q">用 A、B 两条轨道创作节奏，让它们在 <span style="color:var(--both)">LCM 步</span> 齐奏一次重音。</div><div class="seq-wrap" id="w1Seq"></div><div class="controls-bar"><button class="ctrl-btn" data-action="w1Reset">⟲</button><button class="ctrl-btn play-btn" id="w1PlayBtn" data-action="w1TogglePlay">▶</button><div class="bpm-group"><span class="bpm-val" id="w1Bpm">' +
    state.bpm +
    '</span><span>BPM</span></div><button class="ctrl-btn speed-btn" data-action="w1ChangeBpm" data-args=\'[-10]\'>-</button><button class="ctrl-btn speed-btn" data-action="w1ChangeBpm" data-args=\'[10]\'>+</button></div><div class="practice-entry" style="margin-top:8px;text-align:center"><button class="ctrl-btn" data-action="w1OpenPractice" style="background:linear-gradient(135deg,#7c6bff,#a78bfa);color:#fff;font-size:13px">🎯 进入分段练习</button></div><div class="challenge-card" style="margin-top:8px"><div class="challenge-q">你听到的齐奏发生在第几步？（LCM）</div><div class="challenge-input-row"><input class="challenge-input" id="w1Input" type="number" placeholder="输入LCM"><button class="verify-btn" data-action="w1Verify">验证</button></div><div class="result-msg" id="w1Result"></div><div class="stars-row" id="w1Stars"></div><button class="next-btn" id="w1Next" data-action="nextLevel">下一关 →</button></div></div>';
  w1RenderSequencer();
  showHintFloat('点击格子放置/移除音符：A 只能在 ' + a + ' 的倍数步，B 只能在 ' + b + ' 的倍数步。');
}

export function w1RenderSequencer() {
  const seq = document.getElementById('w1Seq');
  if (!seq) return;
  const a = state.w1.a,
    b = state.w1.b,
    lcm = state.w1.lcm;
  let html = '<div class="seq-row"><div class="seq-label" style="color:#FF8C42">A</div><div class="seq-cells">';
  for (let i = 1; i <= lcm; i++) {
    const ok = i % a === 0;
    const on = !!state.w1.activeA[i];
    const cls = 'seq-cell ' + (ok ? (on ? 'active-a' : '') : 'disabled') + (i === lcm ? ' target' : '');
    html +=
      '<div id="w1A' +
      i +
      '" class="' +
      cls +
      '" ' +
      (ok ? "data-action=\"w1ToggleCell\" data-args='[\"A\", " + i + "]'" : '') +
      '>' +
      i +
      '</div>';
  }
  html +=
    '</div></div><div class="seq-row"><div class="seq-label" style="color:#E8587A">B</div><div class="seq-cells">';
  for (let i = 1; i <= lcm; i++) {
    const ok = i % b === 0;
    const on = !!state.w1.activeB[i];
    const cls = 'seq-cell ' + (ok ? (on ? 'active-b' : '') : 'disabled') + (i === lcm ? ' target' : '');
    html +=
      '<div id="w1B' +
      i +
      '" class="' +
      cls +
      '" ' +
      (ok ? "data-action=\"w1ToggleCell\" data-args='[\"B\", " + i + "]'" : '') +
      '>' +
      i +
      '</div>';
  }
  html += '</div></div>';
  seq.innerHTML = html;
}

export function w1ToggleCell(track: 'A' | 'B', i: number) {
  const k = 'active' + track;
  if (state.w1[k][i]) delete state.w1[k][i];
  else state.w1[k][i] = true;
  w1RenderSequencer();
}

export function w1SetPlayhead(s: number) {
  const prev = document.querySelectorAll('.seq-cell.playhead');
  prev.forEach((el) => el.classList.remove('playhead'));
  const a = document.getElementById('w1A' + s),
    b = document.getElementById('w1B' + s);
  if (a) a.classList.add('playhead');
  if (b) b.classList.add('playhead');
}

export function w1StartPlayback() {
  const ctx = getAudioCtx();
  stopSharedTransport();
  state.w1.scheduledEvents = [];
  state.w1.playedOnce = true;
  const transport = getSharedTransport(state.bpm, 1); // 世界1 每步 = 1 拍
  state.w1.transport = transport;
  let lastVisualStep = -1;
  transport.subscribe((event: TransportEvent) => {
    // 世界1 的 step 是 1-based
    const s = (event.step % state.w1.lcm) + 1;
    const t = event.time;
    // 每个 LCM 循环开始时清空事件，避免数组无限增长
    if (s === 1) state.w1.scheduledEvents = [];
    if (state.w1.activeA[s] && state.w1.activeB[s]) {
      playSample('kick', t, 0.45);
      playSample('snare', t, 0.35);
      scheduleToneAt(660, 0.15, 'sine', 0.25, t);
      state.w1.scheduledEvents.push({ step: s, track: 'A' });
      state.w1.scheduledEvents.push({ step: s, track: 'B' });
    } else if (state.w1.activeA[s]) {
      playSample('kick', t, 0.5);
      state.w1.scheduledEvents.push({ step: s, track: 'A' });
    } else if (state.w1.activeB[s]) {
      playSample('snare', t, 0.4);
      state.w1.scheduledEvents.push({ step: s, track: 'B' });
    }
    if (s !== lastVisualStep) {
      lastVisualStep = s;
      requestAnimationFrame(() => w1SetPlayhead(s));
    }
  });
  transport.start();
}

export function w1StopPlayback() {
  state.w1.playing = false;
  stopSharedTransport();
  if (state.w1.transport) {
    state.w1.transport = null;
  }
  w1SetPlayhead(-1);
}

export function w1TogglePlay() {
  if (state.w1.playing) {
    w1StopPlayback();
    document.getElementById('w1PlayBtn')!.textContent = '▶';
  } else {
    state.w1.playing = true;
    w1StartPlayback();
    document.getElementById('w1PlayBtn')!.textContent = '⏸';
  }
}

export function w1Reset() {
  w1StopPlayback();
  state.w1.playedOnce = false;
  state.w1.scheduledEvents = [];
  document.getElementById('w1PlayBtn')!.textContent = '▶';
  w1RenderSequencer();
}

export function w1ChangeBpm(delta: number) {
  state.bpm = Math.max(60, Math.min(240, state.bpm + delta));
  document.getElementById('w1Bpm')!.textContent = state.bpm;
  if (state.w1.transport) {
    state.w1.transport.setBpm(state.bpm);
  }
}

/** 打开分段练习模式（基于当前关卡的双轨道配置）。 */
export function w1OpenPractice() {
  if (!state.w1 || !state.w1.a) return;
  w1StopPlayback();
  openPracticeFromWorld1(state.w1.a, state.w1.b, state.w1.lcm, state.bpm || 120);
}

export function w1Verify() {
  const input = parseInt((document.getElementById('w1Input') as HTMLInputElement).value);
  const correct = state.w1.lcm;
  const lcm = state.w1.lcm;
  const hasA = !!state.w1.activeA[lcm];
  const hasB = !!state.w1.activeB[lcm];
  const anyA = Object.keys(state.w1.activeA).length > 0;
  const anyB = Object.keys(state.w1.activeB).length > 0;
  const res = document.getElementById('w1Result')!;

  if (input !== correct) {
    playWrong();
    state.combo = 0;
    res.className = 'result-msg wrong';
    res.textContent = '❌ LCM 不对，再听听齐奏点在哪里';
    recordAdaptive(state.currentLevel, 0);
    return;
  }
  if (!anyA || !anyB) {
    playWrong();
    state.combo = 0;
    res.className = 'result-msg wrong';
    res.textContent = '❌ 两条轨道都要有音符';
    recordAdaptive(state.currentLevel, 0);
    return;
  }
  if (!hasA || !hasB) {
    playWrong();
    state.combo = 0;
    res.className = 'result-msg wrong';
    res.textContent = '❌ 齐奏点（第 ' + lcm + ' 步）两条轨道都要响';
    recordAdaptive(state.currentLevel, 0);
    return;
  }
  playCorrect();
  res.className = 'result-msg correct';
  res.textContent = '✅ 齐奏在第 ' + correct + ' 步！LCM(' + state.w1.a + ',' + state.w1.b + ')=' + correct;
  state.combo++;
  Store.setState({ combo: state.combo, bestCombo: Math.max(state.combo, Store.state.bestCombo || 0) });
  let stars = 3 - state.hintLevel;
  if (stars < 1) stars = 1;
  completeLevel(state.currentWorld, state.currentLevel, stars);
  showStars('w1Stars', stars);
  document.getElementById('w1Next')!.classList.add('show');
  (window as any).spawnConfetti();
  (window as any).spawnCorrectParticles();
  if (state.combo >= 3) (window as any).spawnComboParticles();
  showEducationCard(state.currentLevel);
  recordAdaptive(state.currentLevel, stars);
  updateLeaderboard(state.currentLevel, stars);
  checkAchievements();
}
/* ===== EXPOSE GLOBALS ===== */
// 带参数的 handler 用 wrapper 跳过事件委托传入的 Event 首参，避免参数错位
registerActions({
  w1Reset,
  w1TogglePlay,
  w1ChangeBpm: (_e: Event, delta: unknown) => w1ChangeBpm(delta as number),
  w1Verify,
  w1OpenPractice,
  w1ToggleCell: (_e: Event, track: unknown, i: unknown) => w1ToggleCell(track as 'A' | 'B', i as number),
});
// Keep window exposure for backwards compat
Object.assign(window as any, {
  renderWorld1: renderWorld1,
  w1ChangeBpm: w1ChangeBpm,
  w1RenderSequencer: w1RenderSequencer,
  w1Reset: w1Reset,
  w1SetPlayhead: w1SetPlayhead,
  w1StartPlayback: w1StartPlayback,
  w1StopPlayback: w1StopPlayback,
  w1ToggleCell: w1ToggleCell,
  w1TogglePlay: w1TogglePlay,
  w1Verify: w1Verify,
});
