import { state } from '../game-engine';
import { Store } from '../store';
import {
  getAudioCtx,
  playSample,
  scheduleToneAt,
  playCorrect,
  getSharedTransport,
  stopSharedTransport,
  muteAllAudio,
} from '../audio';
import type { Transport, TransportEvent } from '../core/transport';
import { NOTE_FREQS } from '../worlds';
import { arraysEqual, euclideanRhythm, midiToFreq } from '../utils';
import { showEducationCard } from '../ui-render';
import {
  showSuccessToast,
  showErrorToast,
  spawnConfetti,
  spawnCorrectParticles,
  spawnComboParticles,
} from '../fx/particles';
import { completeLevel, nextLevel, recordAdaptive, updateLeaderboard, checkAchievements } from '../game-engine';

const MC_LENGTH = 32;

const MC_GOALS: Record<number, any> = {
  1: {
    title: '世界1 Boss：LCM大师',
    text: '让鼓（kick）与贝斯在某一步同时响起，体验“重逢”对齐。',
    check: mcCheckWorld1,
  },
  2: {
    title: '世界2 Boss：对称大师',
    text: '在旋律或和弦轨道中创作一段连续4步的回文对称模式（如 1001 或 0110）。',
    check: mcCheckWorld2,
  },
  3: {
    title: '世界3 Boss：调律师',
    text: '旋律轨道至少3个音符，且存在一组相邻音符的音程接近纯五度（7半音）或纯四度（5半音）。',
    check: mcCheckWorld3,
  },
  4: {
    title: '世界4 Boss：环论大师',
    text: '双环对齐：鼓与贝斯在第0步之后的某个LCM步同时响起。',
    check: mcCheckWorld4,
  },
  5: {
    title: '世界5 Boss：序列大师',
    text: '旋律轨道至少4个音符，且这些音高来自原始动机 [0,2,4,5,7,9] 的旋转/逆行片段。',
    check: mcCheckWorld5,
  },
  6: { title: '世界6 Boss：作曲家', text: '总音符数≥8，且鼓轨道至少1个音符，创作一段数学摇滚。', check: mcCheckWorld6 },
  7: {
    title: '世界7 Boss：随机作曲家',
    text: '用随机算法生成丰富织体：总音符数≥10且至少两条轨道发声。',
    check: mcCheckWorld7,
  },
  8: {
    title: '世界8 Boss：图论指挥',
    text: '创作覆盖 I、IV、V、vi 全部四个和弦节点至少一次的进行。',
    check: mcCheckWorld8,
  },
};

export function startBossComposer(wid: number, lid: string) {
  const g = MC_GOALS[wid] || MC_GOALS[6];
  state.mc = {
    wid,
    lid,
    playing: false,
    transport: null as Transport | null,
    finishTimeout: null as ReturnType<typeof setTimeout> | null,
    step: 0,
    bpm: 120,
    goal: g,
    startTime: Date.now(),
    tracks: [
      { name: '鼓', type: 'kick', color: 'active-a', cells: Array(MC_LENGTH).fill(0) },
      {
        name: '贝斯',
        type: 'bass',
        color: 'active-b',
        cells: Array(MC_LENGTH).fill(0),
        pitches: [0, 7, 0, 7, 4, 7, 0, 7, 0, 7, 0, 7, 4, 7, 0, 7, 0, 7, 0, 7, 4, 7, 0, 7, 0, 7, 0, 7, 4, 7, 0, 7],
      },
      {
        name: '旋律',
        type: 'melody',
        color: 'chords',
        cells: Array(MC_LENGTH).fill(0),
        pitches: [0, 2, 4, 5, 7, 9, 11, 0, 2, 4, 5, 7, 9, 11, 0, 2, 4, 5, 7, 9, 11, 0, 2, 4, 5, 7, 9, 11, 0, 2, 4, 5],
      },
      { name: '和弦', type: 'chord', color: 'active-c', cells: Array(MC_LENGTH).fill(0) },
    ],
  };
  const overlay = document.getElementById('miniComposer');
  if (overlay) overlay.classList.add('show');
  const titleEl = document.getElementById('mcTitle');
  if (titleEl) titleEl.textContent = '👑 ' + g.title;
  const gText = document.getElementById('mcGoalText');
  if (gText) gText.textContent = g.text;
  const gTarget = document.getElementById('mcGoalTarget');
  if (gTarget) gTarget.textContent = '目标：至少8个音符';
  mcRenderTracks();
}

export function exitMiniComposer() {
  mcStop();
  document.getElementById('miniComposer')!.classList.remove('show');
}

export function mcRenderTracks() {
  const el = document.getElementById('mcTracks');
  if (!el) return;
  el.innerHTML = state.mc.tracks
    .map(
      (t: any, ti: number) =>
        '<div class="mc-track"><div class="mc-track-label">' +
        t.name +
        '</div><div class="mc-cells">' +
        t.cells
          .map(
            (c: number, i: number) =>
              '<div class="mc-cell ' +
              (c ? 'on ' + t.color : '') +
              '" onclick="mcToggleCell(' +
              ti +
              ',' +
              i +
              ')"></div>'
          )
          .join('') +
        '</div></div>'
    )
    .join('');
}

export function mcToggleCell(ti: number, i: number) {
  state.mc.tracks[ti].cells[i] = state.mc.tracks[ti].cells[i] ? 0 : 1;
  mcRenderTracks();
}

export function mcApplyGen() {
  const wid = state.mc.wid;
  const len = MC_LENGTH;
  state.mc.tracks.forEach((t: any) => t.cells.fill(0));
  if (wid === 1) {
    const kick = [1, 0, 1, 0, 1, 0],
      bass = [1, 0, 0, 1, 0, 0];
    for (let i = 0; i < len; i++) {
      state.mc.tracks[0].cells[i] = kick[i % 6];
      state.mc.tracks[1].cells[i] = bass[i % 6];
    }
  } else if (wid === 2) {
    const sym = [1, 0, 0, 1];
    for (let i = 0; i < len; i++) state.mc.tracks[2].cells[i] = sym[i % 4];
  } else if (wid === 3) {
    const melody = state.mc.tracks[2];
    const seq = [0, 7, 2, 9, 4, 11];
    for (let i = 0; i < len; i++) {
      melody.cells[i] = 1;
      melody.pitches[i] = seq[i % seq.length];
    }
  } else if (wid === 4) {
    const kick = [1, 0, 1, 0, 1, 0, 1, 0],
      bass = [1, 0, 0, 0, 1, 0, 0, 0];
    for (let i = 0; i < len; i++) {
      state.mc.tracks[0].cells[i] = kick[i % 8];
      state.mc.tracks[1].cells[i] = bass[i % 8];
    }
  } else if (wid === 5) {
    const melody = state.mc.tracks[2];
    const motive = [0, 2, 4, 5, 7, 9];
    for (let i = 0; i < len; i++) {
      melody.cells[i] = 1;
      melody.pitches[i] = motive[i % 6];
    }
  } else if (wid === 6) {
    const kick = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0];
    const bass = [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
    const melody = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0];
    for (let i = 0; i < len; i++) {
      state.mc.tracks[0].cells[i] = kick[i % 16];
      state.mc.tracks[1].cells[i] = bass[i % 16];
      state.mc.tracks[2].cells[i] = melody[i % 16];
    }
  } else if (wid === 7) {
    const kick = Array(32)
      .fill(0)
      .map((_, i) => (i % 2 === 0 ? 1 : 0));
    const bass = Array(32)
      .fill(0)
      .map((_, i) => (i % 3 === 0 ? 1 : 0));
    const melody = state.mc.tracks[2];
    for (let i = 0; i < len; i++) {
      state.mc.tracks[0].cells[i] = kick[i];
      state.mc.tracks[1].cells[i] = bass[i];
      melody.cells[i] = i % 2 === 0 ? 1 : 0;
      melody.pitches[i] = i % 7;
    }
  } else if (wid === 8) {
    const prog = [0, 1, 2, 3, 0, 1, 2, 3];
    const chord = state.mc.tracks[3];
    for (let i = 0; i < len; i++) {
      chord.cells[i] = 1;
      chord.pitches = chord.pitches || [];
      chord.pitches[i] = prog[i % 8];
    }
    for (let i = 0; i < len; i += 4) {
      state.mc.tracks[0].cells[i] = 1;
      state.mc.tracks[1].cells[(i + 2) % len] = 1;
    }
  } else {
    // fallback: simple euclidean
    const pat = euclideanRhythm(5, 16);
    for (let i = 0; i < len; i++) state.mc.tracks[0].cells[i] = pat[i % 16];
  }
  mcRenderTracks();
}

export function mcTogglePlay() {
  if (state.mc.playing) {
    mcStop();
  } else {
    mcStart();
  }
}

export function mcStart() {
  stopSharedTransport();
  state.mc.playing = true;
  state.mc.step = 0;
  const scale = (state.w5 && state.w5.scale) || [0, 2, 4, 5, 7, 9, 11];
  const transport = getSharedTransport(state.mc.bpm, 4);
  state.mc.transport = transport;
  transport.subscribe((event: TransportEvent) => {
    const s = event.step % MC_LENGTH;
    const t = event.time;
    state.mc.tracks.forEach((track: any) => {
      if (track.cells[s]) {
        if (track.type === 'kick') playSample('kick', t, 0.5);
        else if (track.type === 'bass') {
          const p = track.pitches[s];
          scheduleToneAt(NOTE_FREQS[(scale[p % 7] + 12 * Math.floor(p / 7)) % 12] * 0.5, 0.2, 'triangle', 0.35, t);
        } else if (track.type === 'melody') {
          const p = track.pitches[s];
          scheduleToneAt(NOTE_FREQS[(scale[p % 7] + 12 * Math.floor(p / 7)) % 12], 0.2, 'triangle', 0.3, t);
        } else {
          // Diatonic triad built from the current scale and chord degree.
          const cp = track.pitches[s] || 0;
          [0, 2, 4].forEach((off) => {
            const d = cp + off;
            const semi = scale[d % 7] + 12 * Math.floor(d / 7);
            scheduleToneAt(midiToFreq(60 + semi), 0.3, 'triangle', 0.2, t);
          });
        }
      }
    });
  });
  transport.start();
}

export function mcStop() {
  state.mc.playing = false;
  if (state.mc.finishTimeout) {
    clearTimeout(state.mc.finishTimeout);
    state.mc.finishTimeout = null;
  }
  stopSharedTransport();
  state.mc.transport = null;
  // 安全网：临时静音 300ms，停止已 schedule 但尚未播放的 transport 节点
  muteAllAudio(300);
}

export function mcReset() {
  mcStop();
  state.mc.tracks.forEach((t: any) => t.cells.fill(0));
  mcRenderTracks();
}

export function mcFinish() {
  const total = state.mc.tracks.reduce((sum: number, t: any) => sum + countTrackCells(t), 0);
  const minNotesByWorld: Record<number, number> = { 1: 8, 2: 8, 3: 8, 4: 8, 5: 8, 6: 12, 7: 12, 8: 8 };
  const minNotes = minNotesByWorld[state.mc.wid] || 8;
  if (total < minNotes) {
    showErrorToast('Boss 关需要至少 ' + minNotes + ' 个音符才算完成');
    return;
  }
  const goalMet = state.mc.goal && state.mc.goal.check ? state.mc.goal.check() : false;
  if (!goalMet) {
    showErrorToast('还未满足 Boss 目标，听听看哪里不对');
    return;
  }

  // Phase 3.2：通关前自动播放一次并评估音乐性
  if (!state.mc.playing) {
    mcStart();
    showSuccessToast('先听一遍你的作品…');
    const loopMs = ((MC_LENGTH * 60.0) / state.mc.bpm / 4) * 1000;
    state.mc.finishTimeout = setTimeout(() => mcComplete(false), loopMs + 120);
    return;
  }
  mcComplete(true);
}

function mcMusicalityScore(): number {
  const tracks = state.mc.tracks;
  let score = 0;
  // 基础分：总音符数
  const total = tracks.reduce((s: number, t: any) => s + countTrackCells(t), 0);
  score += Math.min(total * 2, 40);
  // 轨道多样性
  const activeTracks = tracks.filter((t: any) => countTrackCells(t) > 0).length;
  score += activeTracks * 10;
  // 鼓组有 kick 和 snare/hihat 交替
  const drums = tracks[0];
  if (drums && countTrackCells(drums) >= 4) score += 10;
  // 避免所有音符挤在同一条轨道
  const maxTrack = Math.max(...tracks.map((t: any) => countTrackCells(t)));
  if (maxTrack < total * 0.8) score += 10;
  return Math.min(score, 100);
}

function mcComplete(playedOnce: boolean) {
  if (state.mc.finishTimeout) {
    clearTimeout(state.mc.finishTimeout);
    state.mc.finishTimeout = null;
  }
  const score = mcMusicalityScore();
  if (score < 25) {
    mcStop();
    showErrorToast('音乐性还不足（' + score + '/100），试着让鼓、贝斯、旋律都发出声音');
    return;
  }

  const total = state.mc.tracks.reduce((sum: number, t: any) => sum + countTrackCells(t), 0);
  const elapsed = Date.now() - state.mc.startTime;
  Store.state.bossTimes[state.mc.lid] = { elapsed, total };
  Store.save();
  mcStop();
  exitMiniComposer();
  playCorrect();
  state.combo++;
  let stars = 3 - state.hintLevel;
  if (!playedOnce || score < 45) stars = Math.min(stars, 2);
  if (stars < 1) stars = 1;
  completeLevel(state.mc.wid, state.mc.lid, stars);
  showSuccessToast('Boss 挑战完成！音乐性 ' + score + '/100');
  spawnConfetti();
  spawnCorrectParticles();
  if (state.combo >= 3) spawnComboParticles();
  showEducationCard(state.mc.lid);
  recordAdaptive(state.mc.lid, stars);
  updateLeaderboard(state.mc.lid, stars);
  checkAchievements();
  setTimeout(nextLevel, 1200);
}

export function countTrackCells(track: any) {
  return track.cells.reduce((a: number, b: number) => a + b, 0);
}

export function mcCheckWorld1() {
  const kick = state.mc.tracks[0].cells,
    bass = state.mc.tracks[1].cells;
  let alignments = 0;
  for (let i = 0; i < kick.length; i++) if (kick[i] && bass[i]) alignments++;
  return alignments >= 2;
}

export function mcCheckWorld2() {
  const isPal = (c: number[]) => {
    for (let i = 0; i <= c.length - 4; i++) {
      const a = c[i],
        b = c[i + 1],
        d = c[i + 2],
        e = c[i + 3];
      if (a === e && b === d && (a || b)) return true;
    }
    return false;
  };
  const t2 = state.mc.tracks[2],
    t3 = state.mc.tracks[3];
  return (isPal(t2.cells) && countTrackCells(t2) >= 2) || (isPal(t3.cells) && countTrackCells(t3) >= 2);
}

export function mcCheckWorld3() {
  const melody = state.mc.tracks[2];
  const idx: number[] = [];
  melody.cells.forEach((v: number, i: number) => {
    if (v) idx.push(i);
  });
  if (idx.length < 3) return false;
  const good = [5, 7];
  for (let i = 1; i < idx.length; i++) {
    const diff = Math.abs(melody.pitches[idx[i]] - melody.pitches[idx[i - 1]]) % 12;
    if (good.includes(diff)) return true;
  }
  return false;
}

export function mcCheckWorld4() {
  const kick = state.mc.tracks[0].cells,
    bass = state.mc.tracks[1].cells;
  let alignments = 0;
  for (let i = 1; i < kick.length; i++) if (kick[i] && bass[i]) alignments++;
  return alignments >= 2;
}

export function mcCheckWorld5() {
  const t = state.mc.tracks[2];
  const idx: number[] = [];
  t.cells.forEach((v: number, i: number) => {
    if (v) idx.push(i);
  });
  if (idx.length < 4) return false;
  const pitches = idx.map((i) => t.pitches[i] % 12).sort((a, b) => a - b);
  const motive = [0, 2, 4, 5, 7, 9];
  for (let start = 0; start < 6; start++) {
    const seg = [];
    for (let i = 0; i < pitches.length; i++) seg.push(motive[(start + i) % 6]);
    if (
      arraysEqual(
        seg.sort((a, b) => a - b),
        pitches
      )
    )
      return true;
  }
  return false;
}

export function mcCheckWorld6() {
  const counts = state.mc.tracks.map(countTrackCells);
  return (
    counts[0] >= 2 &&
    counts[1] >= 2 &&
    counts[2] >= 2 &&
    state.mc.tracks.reduce((s: number, t: any) => s + countTrackCells(t), 0) >= 12
  );
}

export function mcCheckWorld7() {
  const counts = state.mc.tracks.map(countTrackCells);
  const active = counts.filter((c: number) => c > 0).length;
  return state.mc.tracks.reduce((s: number, t: any) => s + countTrackCells(t), 0) >= 12 && active >= 3;
}

export function mcCheckWorld8() {
  const chord = state.mc.tracks[3];
  const seen = new Set<number>();
  chord.cells.forEach((v: number, i: number) => {
    if (v) seen.add((chord.pitches[i] || 0) % 4);
  });
  const otherTracks = state.mc.tracks.slice(0, 3).reduce((s: number, t: any) => s + countTrackCells(t), 0);
  return seen.size >= 4 && otherTracks >= 2;
}
/* ===== EXPOSE GLOBALS ===== */
Object.assign(window as any, {
  countTrackCells: countTrackCells,
  exitMiniComposer: exitMiniComposer,
  mcApplyGen: mcApplyGen,
  mcCheckWorld1: mcCheckWorld1,
  mcCheckWorld2: mcCheckWorld2,
  mcCheckWorld3: mcCheckWorld3,
  mcCheckWorld4: mcCheckWorld4,
  mcCheckWorld5: mcCheckWorld5,
  mcCheckWorld6: mcCheckWorld6,
  mcCheckWorld7: mcCheckWorld7,
  mcCheckWorld8: mcCheckWorld8,
  mcFinish: mcFinish,
  mcRenderTracks: mcRenderTracks,
  mcReset: mcReset,
  mcStart: mcStart,
  mcStop: mcStop,
  mcToggleCell: mcToggleCell,
  mcTogglePlay: mcTogglePlay,
  startBossComposer: startBossComposer,
});
