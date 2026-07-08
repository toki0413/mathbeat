import { state, completeLevel, recordAdaptive, updateLeaderboard, checkAchievements, nextLevel } from '../game-engine';
import { Store } from '../store';
import { LEVELS, NOTE_FREQS } from '../worlds';
import {
  getAudioCtx,
  scheduleToneAt,
  scheduleKickAt,
  playCorrect,
  playWrong,
  getSharedTransport,
  stopSharedTransport,
} from '../audio';
import type { Transport, TransportEvent } from '../core/transport';
import { isPermutation } from '../utils';
import { showStars, showEducationCard } from '../ui-render';
import { registerActions } from '../events';

/* ===== WORLD 5: PERMUTATION MELODY ===== */

const W5_PROMPTS: Record<string, string> = {
  '5-1': '重新排列动机音符，创作一段旋律',
  '5-2': '排列音符，并开启逆行或倒影变换',
  '5-3': '用循环移位生成新的旋律乐句',
  '5-4': '用逆行变换扩展原始动机',
  '5-5': '组合倒影与循环移位，生成新乐句',
};

export function renderWorld5(container: HTMLElement, lid: string) {
  const lv = LEVELS[5].find((l) => l.id === lid);
  if (!lv) return;
  const motif = lv.motif || [0, 2, 4, 7];
  state.w5 = {
    lid,
    motif: motif.slice(),
    row: motif.slice(),
    selectedIdx: -1,
    swapCount: 0,
    ops: { retro: false, invert: false, rotate: 0 },
    motifMax: Math.max(...motif),
    playing: false,
    transport: null as Transport | null,
    step: 0,
    bpm: 120,
    scale: [0, 2, 4, 5, 7, 9, 11],
  };
  container.innerHTML =
    '<div class="challenge-card"><div class="challenge-q">' +
    (W5_PROMPTS[lid] || '综合运用排列、逆行、倒影、旋转生成完整旋律') +
    '</div><div class="perm-section">原动机</div><div class="perm-row" id="w5Original"></div><div class="perm-section">点击两个格子交换位置</div><div class="perm-row" id="w5Row"></div><div class="perm-ops" id="w5Ops"></div><div class="controls-bar"><button class="ctrl-btn" data-action="w5Reset">⟲</button><button class="ctrl-btn play-btn" id="w5PlayBtn" data-action="w5TogglePlay">▶</button><button class="verify-btn" data-action="w5Verify">验证</button><div class="bpm-group"><span class="bpm-val" id="w5Bpm">' +
    state.w5.bpm +
    '</span><span>BPM</span></div><button class="ctrl-btn speed-btn" data-action="w5ChangeBpm" data-args=\'[-10]\'>-</button><button class="ctrl-btn speed-btn" data-action="w5ChangeBpm" data-args=\'[10]\'>+</button></div><div class="result-msg" id="w5Result"></div><div class="stars-row" id="w5Stars"></div><button class="next-btn" id="w5Next" data-action="nextLevel">下一关 →</button></div>';
  w5RenderOriginal();
  w5RenderRow();
  w5RenderOps();
}

export function w5RenderOriginal() {
  const el = document.getElementById('w5Original');
  if (!el) return;
  el.innerHTML = state.w5.motif
    .map((d: number) => '<div class="perm-cell" style="cursor:default;background:#f0ece6">' + w5DegreeName(d) + '</div>')
    .join('');
}

export function w5RenderRow() {
  const el = document.getElementById('w5Row');
  if (!el) return;
  el.innerHTML = state.w5.row
    .map(
      (d: number, i: number) =>
        '<div id="w5c' +
        i +
        '" class="perm-cell ' +
        (i === state.w5.selectedIdx ? 'selected' : '') +
        '" data-action="w5CellClick" data-args=\'[' +
        i +
        ']\'>' +
        w5DegreeName(d) +
        '</div>'
    )
    .join('');
}

export function w5RenderOps() {
  const el = document.getElementById('w5Ops');
  if (!el) return;
  const ops = LEVELS[5].find((l) => l.id === state.w5.lid)?.ops || [];
  let html = '';
  if (ops.includes('retro'))
    html +=
      '<div class="perm-op ' + (state.w5.ops.retro ? 'active' : '') + '" data-action="w5ToggleOp" data-args=\'["retro"]\'>逆行</div>';
  if (ops.includes('invert'))
    html +=
      '<div class="perm-op ' + (state.w5.ops.invert ? 'active' : '') + '" data-action="w5ToggleOp" data-args=\'["invert"]\'>倒影</div>';
  if (ops.includes('rotate'))
    html +=
      '<div class="perm-op ' +
      (state.w5.ops.rotate > 0 ? 'active' : '') +
      '" data-action="w5ToggleOp" data-args=\'["rotate"]\'>旋转' +
      (state.w5.ops.rotate > 0 ? ' ' + state.w5.ops.rotate : '') +
      '</div>';
  el.innerHTML = html || '<div style="font-size:13px;color:var(--dim)">本关暂无变换</div>';
}

export function w5DegreeName(d: number) {
  const names = ['do', 're', 'mi', 'fa', 'sol', 'la', 'si'];
  return names[d % 7];
}

export function w5CellClick(i: number) {
  if (state.w5.selectedIdx === -1) {
    state.w5.selectedIdx = i;
    w5RenderRow();
    return;
  }
  if (state.w5.selectedIdx === i) {
    state.w5.selectedIdx = -1;
    w5RenderRow();
    return;
  }
  const tmp = state.w5.row[i];
  state.w5.row[i] = state.w5.row[state.w5.selectedIdx];
  state.w5.row[state.w5.selectedIdx] = tmp;
  state.w5.selectedIdx = -1;
  state.w5.swapCount++;
  w5RenderRow();
}

export function w5ToggleOp(op: 'retro' | 'invert' | 'rotate') {
  if (op === 'rotate') {
    state.w5.ops.rotate = (state.w5.ops.rotate + 1) % state.w5.row.length;
    w5RenderOps();
  } else {
    state.w5.ops[op] = !state.w5.ops[op];
    w5RenderOps();
  }
}

export function w5BuildPhrase() {
  let phrase = state.w5.row.slice();
  const base = phrase.slice();
  if (state.w5.ops.retro) phrase = phrase.concat(base.slice().reverse());
  if (state.w5.ops.invert) phrase = phrase.concat(base.map((d: number) => state.w5.motifMax - d));
  if (state.w5.ops.rotate > 0)
    phrase = phrase.concat(base.map((_: number, i: number) => base[(i + state.w5.ops.rotate) % base.length]));
  if (phrase.length === 0) phrase = base;
  while (phrase.length < 32) phrase = phrase.concat(phrase.slice());
  return phrase.slice(0, 32);
}

export function w5PitchForDegree(d: number) {
  const s = state.w5.scale;
  return NOTE_FREQS[(s[d % 7] + 12 * Math.floor(d / 7)) % 12];
}

export function w5StartPlayback() {
  stopSharedTransport();
  state.w5.playing = true;
  state.w5.step = 0;
  const phrase = w5BuildPhrase();
  const transport = getSharedTransport(state.w5.bpm, 2);
  state.w5.transport = transport;
  let lastVisualStep = -1;
  transport.subscribe((event: TransportEvent) => {
    const s = event.step % 32;
    const t = event.time;
    const d = phrase[s];
    if (d !== undefined && d !== null) {
      scheduleToneAt(w5PitchForDegree(d), 0.25, 'triangle', 0.35, t);
    }
    if (s % 4 === 0) scheduleKickAt(t);
    if (s !== lastVisualStep) {
      lastVisualStep = s;
      const prev = document.querySelectorAll('.perm-cell.playhead');
      prev.forEach((el) => el.classList.remove('playhead'));
      const cell = document.getElementById('w5c' + (s % state.w5.row.length));
      if (cell) cell.classList.add('playhead');
    }
  });
  transport.start();
}

export function w5StopPlayback() {
  state.w5.playing = false;
  stopSharedTransport();
  state.w5.transport = null;
  const prev = document.querySelectorAll('.perm-cell.playhead');
  prev.forEach((el) => el.classList.remove('playhead'));
}

export function w5TogglePlay() {
  if (state.w5.playing) {
    w5StopPlayback();
    document.getElementById('w5PlayBtn')!.textContent = '▶';
  } else {
    w5StartPlayback();
    document.getElementById('w5PlayBtn')!.textContent = '⏸';
  }
}

export function w5Reset() {
  w5StopPlayback();
  state.w5.row = state.w5.motif.slice();
  state.w5.ops = { retro: false, invert: false, rotate: 0 };
  state.w5.selectedIdx = -1;
  state.w5.swapCount = 0;
  document.getElementById('w5PlayBtn')!.textContent = '▶';
  w5RenderRow();
  w5RenderOps();
  document.getElementById('w5Result')!.textContent = '';
  document.getElementById('w5Result')!.className = 'result-msg';
  document.getElementById('w5Next')!.classList.remove('show');
}

export function w5ChangeBpm(delta: number) {
  state.w5.bpm = Math.max(60, Math.min(240, state.w5.bpm + delta));
  document.getElementById('w5Bpm')!.textContent = state.w5.bpm;
  if (state.w5.transport) {
    state.w5.transport.setBpm(state.w5.bpm);
  }
}

export function w5Verify() {
  const lv = LEVELS[5].find((l) => l.id === state.w5.lid);
  if (!lv) return;
  const sortedMotif = state.w5.motif.slice().sort((a: number, b: number) => a - b);
  const sortedRow = state.w5.row.slice().sort((a: number, b: number) => a - b);
  let ok = true,
    msg = '';

  for (let i = 0; i < sortedMotif.length; i++) {
    if (sortedMotif[i] !== sortedRow[i]) ok = false;
  }

  if (!ok) {
    msg = '❌ 当前行必须包含原动机的所有音符（一个排列）';
  } else if (state.w5.lid === '5-1' && state.w5.swapCount === 0) {
    ok = false;
    msg = '❌ 请至少交换两个音符的位置，创作一个新排列';
  } else if (
    lv.ops &&
    lv.ops.includes('retro') &&
    lv.ops.includes('invert') &&
    !(state.w5.ops.retro || state.w5.ops.invert)
  ) {
    ok = false;
    msg = '❌ 请开启逆行或倒影变换';
  } else if (lv.ops && lv.ops.includes('rotate') && state.w5.ops.rotate === 0) {
    ok = false;
    msg = '❌ 请使用旋转变换';
  } else if (
    state.w5.lid === '5-B' &&
    [state.w5.ops.retro, state.w5.ops.invert, state.w5.ops.rotate > 0].filter(Boolean).length < 2
  ) {
    ok = false;
    msg = '❌ Boss挑战：至少使用两种变换';
  }

  const res = document.getElementById('w5Result')!;
  if (msg) {
    playWrong();
    state.combo = 0;
    res.className = 'result-msg wrong';
    res.textContent = msg;
    recordAdaptive(state.currentLevel, 0);
  } else {
    playCorrect();
    res.className = 'result-msg correct';
    res.textContent = '✅ 旋律结构成立！';
    state.combo++;
    let s = 3 - state.hintLevel;
    if (s < 1) s = 1;
    completeLevel(5, state.currentLevel, s);
    showStars('w5Stars', s);
    document.getElementById('w5Next')!.classList.add('show');
    (window as any).spawnConfetti();
    (window as any).spawnCorrectParticles();
    if (state.combo >= 3) (window as any).spawnComboParticles();
    showEducationCard(state.currentLevel);
    recordAdaptive(state.currentLevel, s);
    updateLeaderboard(state.currentLevel, s);
    checkAchievements();
  }
}
/* ===== EXPOSE GLOBALS ===== */
// click handlers wired into the delegated event system; arg-taking fns are
// wrapped so the event object stays out of the real parameters
registerActions({
  w5Reset,
  w5TogglePlay,
  w5Verify,
  w5ChangeBpm: (_e, delta) => w5ChangeBpm(delta as number),
  w5CellClick: (_e, i) => w5CellClick(i as number),
  w5ToggleOp: (_e, op) => w5ToggleOp(op as 'retro' | 'invert' | 'rotate'),
});
Object.assign(window as any, {
  renderWorld5: renderWorld5,
  w5BuildPhrase: w5BuildPhrase,
  w5CellClick: w5CellClick,
  w5ChangeBpm: w5ChangeBpm,
  w5DegreeName: w5DegreeName,
  w5PitchForDegree: w5PitchForDegree,
  w5RenderOps: w5RenderOps,
  w5RenderOriginal: w5RenderOriginal,
  w5RenderRow: w5RenderRow,
  w5Reset: w5Reset,
  w5StartPlayback: w5StartPlayback,
  w5StopPlayback: w5StopPlayback,
  w5ToggleOp: w5ToggleOp,
  w5TogglePlay: w5TogglePlay,
  w5Verify: w5Verify,
});
