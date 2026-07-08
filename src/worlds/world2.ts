import { state, completeLevel, recordAdaptive, updateLeaderboard, checkAchievements, nextLevel } from '../game-engine';
import { Store } from '../store';
import { LEVELS, NOTE_NAMES, NOTE_FREQS } from '../worlds';
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

const W2_PROMPTS: Record<string, string> = {
  '2-1': '在 12 音圆环上选择 3 个音符，组成协和和弦',
  '2-2': '选择和弦后，用旋转变换听听音程',
  '2-3': '选择和弦后，用倒影变换听听对称',
  '2-4': '在 12 音圆环上选择 4 个音符，组成更丰满的和弦',
  '2-5': '综合运用旋转与倒影，创作对称和弦',
};

/** 计算所选音符集合的协和度得分 */
export function w2ConsonanceScore(notes: number[]): number {
  if (notes.length < 2) return 0;
  const good = new Set([3, 4, 5, 7, 8, 9]); // 小三/大三/纯四/纯五/小六/大六
  const bad = new Set([1, 2, 6, 10, 11]); // 小二/大二/三全音/小七/大七
  let score = 0;
  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) {
      const iv = Math.abs(notes[i] - notes[j]) % 12;
      if (good.has(iv)) score += 1;
      else if (bad.has(iv)) score -= 1.5; // 不协和音程惩罚更重
    }
  }
  return score;
}

/** 找出第一个不协和的音程，用于提示 */
export function w2FindDissonance(notes: number[]): { a: number; b: number; iv: number; name: string } | null {
  const bad = new Set([1, 2, 6, 10, 11]);
  const names: Record<number, string> = { 1: '小二度', 2: '大二度', 6: '三全音', 10: '小七度', 11: '大七度' };
  const sorted = notes.slice().sort((x, y) => x - y);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const iv = Math.abs(sorted[j] - sorted[i]) % 12;
      if (bad.has(iv)) return { a: sorted[i], b: sorted[j], iv, name: names[iv] || iv + ' 半音' };
    }
  }
  return null;
}

export function renderWorld2(container: HTMLElement, lid: string) {
  state.w2 = {
    lid,
    selected: [],
    rotated: false,
    reflected: false,
    reflectAxis: 0,
    playing: false,
    timer: null,
    step: 0,
    nextTime: 0,
    bpm: 120,
    completed: false,
  };
  const axisOptions = Array.from({ length: 12 }, (_, i) => '<option value="' + i + '"' + (i === 0 ? ' selected' : '') + '>' + NOTE_NAMES[i] + '</option>').join('');
  container.innerHTML =
    '<div class="challenge-card"><div class="challenge-q">' +
    (W2_PROMPTS[lid] || '综合运用旋转与倒影，创作对称和弦') +
    '</div><div class="w2-ring" id="w2Ring" style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:12px 0"></div><div class="controls-bar" style="flex-wrap:wrap;gap:6px"><button class="ctrl-btn" data-action="w2Reset">⟲</button><button class="ctrl-btn play-btn" id="w2PlayBtn" data-action="w2TogglePlay">▶</button><button class="ctrl-btn" data-action="w2Rotate">↻ 旋转</button><label style="display:flex;align-items:center;gap:4px;font-size:13px;color:var(--text)">倒影轴<select id="w2ReflectAxis" class="ctrl-btn" style="padding:4px 6px" data-input="w2ReflectAxisChange">' + axisOptions + '</select></label><button class="ctrl-btn" data-action="w2Reflect">↔ 应用倒影</button><button class="ctrl-btn" data-action="w2PlayOriginalAndReflection">🎧 原+倒影</button></div><div class="result-msg" id="w2Result"></div><div class="stars-row" id="w2Stars"></div><button class="next-btn" id="w2Next" data-action="nextLevel">下一关 →</button></div>';
  w2RenderRing();
}

export function w2RenderRing() {
  const el = document.getElementById('w2Ring');
  if (!el) return;
  el.innerHTML = '';
  const preview = new Set(w2PreviewReflection());
  for (let i = 0; i < 12; i++) {
    const selected = state.w2.selected.includes(i);
    const inPreview = preview.has(i);
    let cls = 'seq-cell ';
    if (selected && inPreview) cls += 'active-c';
    else if (selected) cls += 'active-a';
    else if (inPreview) cls += 'active-b';
    const d = document.createElement('div');
    d.className = cls;
    d.style.width = '44px';
    d.style.height = '44px';
    d.style.fontSize = '12px';
    d.textContent = NOTE_NAMES[i];
    d.onclick = function () {
      w2ToggleNote(i);
    };
    el.appendChild(d);
  }
}

export function w2ToggleNote(i: number) {
  const idx = state.w2.selected.indexOf(i);
  if (idx >= 0) state.w2.selected.splice(idx, 1);
  else if (state.w2.selected.length < 4) state.w2.selected.push(i);
  w2RenderRing();
  w2CheckAuto();
}

export function w2Rotate() {
  state.w2.selected = state.w2.selected.map((n: number) => (n + 1) % 12);
  state.w2.rotated = true;
  w2RenderRing();
  w2PlayOnce();
}

export function w2ReflectAxisChange(v: string | Event) {
  const val = v instanceof Event ? (v.target as HTMLSelectElement).value : v;
  state.w2.reflectAxis = parseInt(val, 10) || 0;
  w2RenderRing();
}

export function w2PreviewReflection(): number[] {
  const axis = state.w2.reflectAxis || 0;
  const selected: number[] = state.w2.selected || [];
  return [...new Set(selected.map((n) => (2 * axis - n + 12) % 12))];
}

export function w2Reflect() {
  state.w2.selected = w2PreviewReflection();
  state.w2.reflected = true;
  if ((state.w2.reflectAxis || 0) !== 0) {
    Store.state.w2ReflectionAxisUsed = true;
    Store.save();
  }
  w2RenderRing();
  w2PlayOnce();
}

/** 同时播放原象和弦与按当前倒影轴生成的倒影和弦 */
export function w2PlayOriginalAndReflection() {
  const ctx = getAudioCtx();
  const t = ctx.currentTime + 0.02;
  const reflection = w2PreviewReflection();
  state.w2.selected.forEach((n: number, i: number) => scheduleToneAt(NOTE_FREQS[n], 0.55, 'triangle', 0.2, t + i * 0.03));
  reflection.forEach((n: number, i: number) => scheduleToneAt(NOTE_FREQS[n], 0.55, 'sine', 0.2, t + 0.18 + i * 0.03));
  if (state.w2.selected.length >= 3 || reflection.length >= 3) scheduleKickAt(t);
  Store.state.w2OriginalReflectionPlayed = true;
  Store.save();
  w2CheckAuto();
}

export function w2PlayOnce() {
  const ctx = getAudioCtx();
  const t = ctx.currentTime + 0.02;
  state.w2.selected.forEach((n: number, i: number) => scheduleToneAt(NOTE_FREQS[n], 0.4, 'triangle', 0.25, t + i * 0.03));
  if (state.w2.selected.length >= 3) {
    scheduleKickAt(t);
  }
  w2CheckAuto();
}

export function w2TogglePlay() {
  w2PlayOnce();
  document.getElementById('w2PlayBtn')!.textContent = '▶';
}

export function w2Reset() {
  state.w2.selected = [];
  state.w2.rotated = false;
  state.w2.reflected = false;
  state.w2.reflectAxis = 0;
  const axisSel = document.getElementById('w2ReflectAxis') as HTMLSelectElement;
  if (axisSel) axisSel.value = '0';
  state.w2.completed = false;
  w2RenderRing();
  document.getElementById('w2Result')!.textContent = '';
  document.getElementById('w2Result')!.className = 'result-msg';
  document.getElementById('w2Next')!.classList.remove('show');
}

export function w2CheckAuto() {
  const lv = LEVELS[2].find((l) => l.id === state.w2.lid);
  if (!lv) return;
  let ok = true,
    msg = '';
  const score = w2ConsonanceScore(state.w2.selected);

  if (state.w2.selected.length < 3) {
    ok = false;
    msg = '❌ 至少选 3 个音符';
  } else if (score < 0) {
    ok = false;
    const dis = w2FindDissonance(state.w2.selected);
    if (dis) {
      msg =
        '❌ ' + NOTE_NAMES[dis.a] + ' 与 ' + NOTE_NAMES[dis.b] + ' 形成不协和的 ' + dis.name + '，请替换其中一个音符';
    } else {
      msg = '❌ 当前和弦不够协和，试着选择大三/小三/纯四/纯五度音程';
    }
  } else if (lv.id === '2-2' && !state.w2.rotated) {
    ok = false;
    msg = '❌ 请使用旋转变换';
  } else if (lv.id === '2-3' && !state.w2.reflected) {
    ok = false;
    msg = '❌ 请使用倒影变换';
  } else if (lv.id === '2-B' && !(state.w2.rotated && state.w2.reflected)) {
    ok = false;
    msg = '❌ Boss 需要同时使用旋转和倒影';
  }

  const res = document.getElementById('w2Result')!;
  if (ok) {
    res.className = 'result-msg correct';
    res.textContent = '✅ 和弦结构成立！';
    document.getElementById('w2Next')!.classList.add('show');
    // Score directly to avoid recursion with w2Verify
    if (!state.w2.completed) {
      state.w2.completed = true;
      playCorrect();
      state.combo++;
      let stars = 3 - state.hintLevel;
      if (stars < 1) stars = 1;
      const lid = state.w2.lid || state.currentLevel;
      completeLevel(2, lid, stars);
      showStars('w2Stars', stars);
      (window as any).spawnConfetti();
      (window as any).spawnCorrectParticles();
      if (state.combo >= 3) (window as any).spawnComboParticles();
      showEducationCard(lid);
      recordAdaptive(lid, stars);
      updateLeaderboard(lid, stars);
      checkAchievements();
    }
  } else {
    res.className = 'result-msg wrong';
    res.textContent = msg;
  }
}

export function w2Verify() {
  w2CheckAuto();
  if (!document.getElementById('w2Result')!.classList.contains('correct')) {
    playWrong();
    state.combo = 0;
  }
}
/* ===== EXPOSE GLOBALS ===== */
registerActions({ w2Reset, w2TogglePlay, w2Rotate, w2Reflect, w2PlayOriginalAndReflection, nextLevel });
registerInputs({ w2ReflectAxisChange });
// Keep window exposure for backwards compat
Object.assign(window as any, {
  renderWorld2: renderWorld2,
  w2CheckAuto: w2CheckAuto,
  w2ConsonanceScore: w2ConsonanceScore,
  w2FindDissonance: w2FindDissonance,
  w2PlayOnce: w2PlayOnce,
  w2PlayOriginalAndReflection: w2PlayOriginalAndReflection,
  w2PreviewReflection: w2PreviewReflection,
  w2Reflect: w2Reflect,
  w2ReflectAxisChange: w2ReflectAxisChange,
  w2RenderRing: w2RenderRing,
  w2Reset: w2Reset,
  w2Rotate: w2Rotate,
  w2ToggleNote: w2ToggleNote,
  w2TogglePlay: w2TogglePlay,
  w2Verify: w2Verify,
});
