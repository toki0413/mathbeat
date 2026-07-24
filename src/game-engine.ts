import { Store, syncComposerUnlocks, LS_KEYS } from './store';
import { localGet } from './storage';
import { WORLDS, LEVELS, ACHIEVEMENTS, MATH_CONCEPTS, LEVEL_TUTORIALS, LEVEL_HINTS } from './worlds';
import { stopBgMusic, playPerfect, playCombo, playAchievement, stopSharedTransport, getAudioCtx, muteAllAudio } from './audio';
import { spawnConfetti, showSuccessToast } from './fx/particles';
import { stopDailyPlay } from './daily';
import { stopSciencePlay } from './science';
import {
  showAchievementPopup,
  showScreen,
  showBossProblem,
  showTutorial,
  closeEduCard,
  closeTutorial,
  closeWhy,
  showHintFloat,
  renderHome,
  renderContinueBar,
} from './ui-render';
import { renderWorld1, w1StopPlayback } from './worlds/world1';
import { renderWorld2 } from './worlds/world2';
import { renderWorld3 } from './worlds/world3';
import { renderWorld4, w4Stop } from './worlds/world4';
import { renderWorld5, w5StopPlayback } from './worlds/world5';
import { renderWorld6, w6Stop } from './worlds/world6';
import { renderWorld7, w7Stop } from './worlds/world7';
import { renderWorld8, w8Stop } from './worlds/world8';
import { addXp, xpForAchievement, XP_REWARDS, recordLearningProgress } from './progression';

/* ===== GAME STATE =====
 * Runtime state backed by Store.state for persisted keys.
 * Reading a persisted property returns Store.state[prop];
 * writing it automatically updates Store and persists.
 */
const runtimeState: Record<string, any> = {
  currentWorld: null,
  currentLevel: null,
  playing: false,
  step: 0,
  bpm: 120,
  hintLevel: 0,
  hintTimer: null,
  lastInteraction: Date.now(),
  w1: { playing: false, a: 2, b: 3, lcm: 6 },
};

function isStoreKey(k: string): boolean {
  return typeof k === 'string' && Object.prototype.hasOwnProperty.call(Store.state, k);
}

// 这些键通过 Proxy 读写时会保持内存一致，但不会触发 localStorage 持久化。
// 主要用于高频变化的运行时状态（如 combo），避免每帧/每次操作都写盘。
const TRANSIENT_STORE_KEYS = new Set<string>(['combo']);

export const state: Record<string, any> = new Proxy(runtimeState, {
  get(target, prop: string | symbol) {
    if (typeof prop === 'string' && isStoreKey(prop)) {
      return (Store.state as Record<string, any>)[prop];
    }
    return Reflect.get(target, prop);
  },
  set(target, prop: string | symbol, value) {
    if (typeof prop === 'string' && isStoreKey(prop)) {
      (Store.state as Record<string, any>)[prop] = value;
      if (!TRANSIENT_STORE_KEYS.has(prop)) {
        Store.setState({ [prop]: value });
      }
      return true;
    }
    return Reflect.set(target, prop, value);
  },
});

/* ===== ADAPTIVE DIFFICULTY ===== */
export function getAdaptiveDifficulty(): string {
  const h = Store.state.adaptiveHistory || [];
  const recent = h.slice(-10);
  if (recent.length < 3) return 'auto';
  const avg = ((recent as any[]).reduce((s: number, r: any) => s + (r.stars as number), 0) as number) / recent.length;
  if (avg >= 2.5) return 'hard';
  if (avg >= 1.5) return 'medium';
  return 'easy';
}
export function recordAdaptive(levelId: string, stars: number): void {
  Store.state.adaptiveHistory = Store.state.adaptiveHistory || [];
  Store.state.adaptiveHistory.push({ levelId, stars, time: Date.now() });
  Store.save();
}

/* ===== ACHIEVEMENTS ===== */
export function syncComposerAchievements(): void {
  // Composer 成就现在直接写入 Store.state.achievements，此函数保留为兼容空操作。
}
export function checkAchievements(): void {
  const p = Store.state.progress;
  const achs = Store.state.achievements || [];
  const earned = new Set(achs);
  const tryEarn = (id: string) => {
    if (!earned.has(id)) {
      earned.add(id);
      Store.state.achievements = Array.from(earned);
      Store.save();
      showAchievementPopup(id);
      playAchievement();
      // 按稀有度奖励 XP（common 20 / rare 50 / epic 100 / legendary 200）
      try {
        const ach = ACHIEVEMENTS.find((a) => a.id === id);
        const xp = xpForAchievement(ach?.rarity);
        if (xp > 0) addXp(xp, '成就 ' + (ach?.name || id));
      } catch (e) {
        /* progression 失败不影响主流程 */
      }
    }
  };
  if (Object.values(p).some((v: any) => v >= 1)) tryEarn('first_star');
  if (state.combo >= 5) tryEarn('combo_5');
  if (state.combo >= 10) tryEarn('combo_10');
  for (let w = 1; w <= 8; w++) {
    const lvls = LEVELS[w];
    if (lvls && lvls.every((l: any) => (p[l.id] || 0) >= 1)) tryEarn('all_world' + w);
  }
  if (Object.keys(p).some((k: string) => k.endsWith('-B') && p[k] >= 3)) tryEarn('perfect_boss');
  if (
    Object.keys(Store.state.bossTimes || {}).some((k: string) => {
      const t = Store.state.bossTimes[k];
      return t && t.elapsed > 0 && t.elapsed < 60000;
    })
  )
    tryEarn('speed_runner');
  if (Store.state.noHintWorld) tryEarn('no_hint_clear');
  const diary = localGet<any[]>(LS_KEYS.DIARY, []);
  if (diary.length >= 5) tryEarn('diary_5');
  if ((Store.state.scienceTypesUsed || []).length >= 4) tryEarn('science_all');
  if ((Store.state.scienceCompositions || []).length > 0) tryEarn('science_first');
  if ((Store.state.samplesPlayed || []).length >= 9) tryEarn('sample_all');
  if ((Store.state.dailyStreak || 0) >= 7) tryEarn('daily_7');
  if ((Store.state.dailyTypesCompleted || []).length >= 12) tryEarn('daily_all_types');
  if (Store.state.composerExported) tryEarn('composer_export');
  if (earned.has('math_rock_30s')) tryEarn('math_rock_30s');
  if ((Store.state.luckyStreak || 0) >= 3) tryEarn('hidden_lucky');
  if (Store.state.w3BossPerfect && (p['3-B'] || 0) >= 1) tryEarn('hidden_perfect_pitch');

  // World mastery: all levels in a world (including boss) at 3 stars
  for (let w = 1; w <= 8; w++) {
    const lvls = LEVELS[w];
    if (lvls && lvls.every((l: any) => (p[l.id] || 0) >= 3)) tryEarn('mastery_world' + w);
  }

  // All bosses at 3 stars
  const bossIds = Object.keys(LEVELS)
    .map((k) => parseInt(k, 10))
    .filter((w) => LEVELS[w])
    .flatMap((w) => LEVELS[w].filter((l: any) => l.id.endsWith('-B')).map((l: any) => l.id));
  if (bossIds.length > 0 && bossIds.every((id) => (p[id] || 0) >= 3)) tryEarn('perfect_all_bosses');

  // Endless mode score thresholds
  const endlessBest = Store.state.endlessStats?.bestScore || 0;
  if (endlessBest >= 50) tryEarn('endless_50');
  if (endlessBest >= 100) tryEarn('endless_100');

  // Explorer / creator achievements
  if (Store.state.importedSampleId) tryEarn('import_sample');
  if (Store.state.sharedComposer) tryEarn('share_composer');
  if (Store.state.exportedScience) tryEarn('export_science');
  if ((Store.state.customLevels || []).length > 0) tryEarn('create_custom_level');

  // Phase-2 feature achievements
  if ((Store.state.w3RatiosHeard || []).length >= 6) tryEarn('tuning_explorer');
  if (Store.state.w2ReflectionAxisUsed && (p['2-3'] || 0) >= 1) tryEarn('symmetry_axis');
  if (Store.state.w2OriginalReflectionPlayed) tryEarn('original_reflection');
  if (Store.state.w6RecursiveLayersUsed) tryEarn('recursive_layers');
  if (Store.state.w7MarkovEdited && (p['7-2'] || 0) >= 1) tryEarn('markov_editor');
  if (Store.state.w8BossCoveredAll && (p['8-B'] || 0) >= 1) tryEarn('graph_hamilton');
}

/* ===== LEADERBOARD ===== */
export function updateLeaderboard(levelId: string, score: number): void {
  const lb = Store.state.leaderboard || {};
  if (!lb[levelId] || score > (lb[levelId] as number)) {
    lb[levelId] = score;
    Store.state.leaderboard = lb;
    Store.save();
  }
}

/* ===== HOME / FREE MODE ===== */
export function isFreeModeUnlocked(): boolean {
  return (Store.state.progress['6-B'] || 0) >= 1;
}

/* ===== IDLE HINT ===== */
let idleTimer: any = null;
let idleHintShown = false;
const IDLE_HINT_MS = 20000;

function getIdleHint(): string {
  const lid = state.currentLevel;
  if (lid && LEVEL_HINTS[lid]) return '💡 ' + LEVEL_HINTS[lid];
  return '💡 卡住的时候可以点击“为什么”按钮，看看背后的数学原理。';
}

function checkIdle() {
  if (!state.currentLevel || idleHintShown) return;
  if (Date.now() - state.lastInteraction > IDLE_HINT_MS) {
    idleHintShown = true;
    showHintFloat(getIdleHint());
  }
}

export function bumpInteraction(): void {
  state.lastInteraction = Date.now();
  idleHintShown = false;
}

function startIdleTimer(): void {
  stopIdleTimer();
  idleTimer = setInterval(checkIdle, 5000);
}

function stopIdleTimer(): void {
  if (idleTimer) {
    clearInterval(idleTimer);
    idleTimer = null;
  }
}

/* ===== CORE NAVIGATION / AUDIO ===== */
export function stopAllPlayback(): void {
  try {
    stopSharedTransport();
  } catch (e) {}
  try {
    w1StopPlayback();
  } catch (e) {}
  try {
    w4Stop();
  } catch (e) {}
  try {
    w5StopPlayback();
  } catch (e) {}
  try {
    w6Stop();
  } catch (e) {}
  try {
    w7Stop();
  } catch (e) {}
  try {
    w8Stop();
  } catch (e) {}
  try {
    (window as any).fmStop();
  } catch (e) {}
  try {
    (window as any).mcStop();
  } catch (e) {}
  try {
    stopSciencePlay();
  } catch (e) {}
  try {
    stopDailyPlay();
  } catch (e) {}
  try {
    (window as any).stopSamplePlayback();
  } catch (e) {}
  try {
    stopBgMusic();
  } catch (e) {}
  // 安全网：临时静音 500ms，强制停止所有泄漏的已 schedule 音频节点
  try {
    muteAllAudio(500);
  } catch (e) {}
}

/** 速通：一键解锁全部关卡（3星）、成就与作曲台功能 */
export function unlockAll(): void {
  // 解锁所有关卡（3星）
  Object.keys(LEVELS).forEach((widStr) => {
    const wid = Number(widStr);
    const levels = LEVELS[wid];
    levels.forEach((lv) => {
      Store.state.progress[lv.id] = 3;
    });
  });
  // 解锁所有成就
  ACHIEVEMENTS.forEach((ach) => {
    if (!Store.state.achievements.includes(ach.id)) {
      Store.state.achievements.push(ach.id);
    }
  });
  // 解锁所有作曲台功能
  syncComposerUnlocks();
  // 更新最佳连击记录
  if ((Store.state.bestCombo || 0) < 10) {
    Store.state.bestCombo = 10;
  }
  Store.save();
  showSuccessToast('已解锁全部内容！');
  spawnConfetti();
  // 如果当前在首页，刷新显示
  const homeScreen = document.getElementById('homeScreen');
  if (homeScreen && homeScreen.classList.contains('active')) {
    renderHome();
    renderContinueBar();
  }
}

export function startLevel(wid: number, lid: string): void {
  state.currentWorld = wid;
  state.currentLevel = lid;
  state.hintLevel = 0;
  bumpInteraction();
  Store.state.lastWorld = wid;
  Store.state.lastLevel = lid;
  Store.save();
  stopAllPlayback();
  showScreen('game');
  const lv = LEVELS[wid].find((l: any) => l.id === lid);
  if (lv && lv.boss) {
    showBossProblem(wid, lid);
  } else {
    renderGame(wid, lid);
  }
  const t = LEVEL_TUTORIALS[lid];
  if (t) showTutorial(t);
  startIdleTimer();
}
export function renderGame(wid: number, lid: string): void {
  const w = WORLDS[wid - 1];
  const lv = LEVELS[wid].find((l: any) => l.id === lid);
  document.getElementById('gameLevelPill')!.textContent = w.emoji + ' ' + lv!.name;
  document.getElementById('comboBadge')!.textContent = '连击 ' + state.combo;
  const container = document.getElementById('gameContent')!;
  container.innerHTML = '';
  if (lv!.boss) {
    (window as any).startBossComposer(wid, lid);
  } else {
    switch (wid) {
      case 1:
        renderWorld1(container, lid);
        break;
      case 2:
        renderWorld2(container, lid);
        break;
      case 3:
        renderWorld3(container, lid);
        break;
      case 4:
        renderWorld4(container, lid);
        break;
      case 5:
        renderWorld5(container, lid);
        break;
      case 6:
        renderWorld6(container, lid);
        break;
      case 7:
        renderWorld7(container, lid);
        break;
      case 8:
        renderWorld8(container, lid);
        break;
    }
  }
}
export function exitGame(): void {
  stopAllPlayback();
  stopIdleTimer();
  showScreen('home');
}
export function restartLevel(): void {
  if (!state.currentWorld || !state.currentLevel) return;
  startLevel(state.currentWorld, state.currentLevel);
}
export function toggleGamePause(): void {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const btn = document.getElementById('gamePauseBtn');
  if (ctx.state === 'suspended') {
    ctx.resume();
    if (btn) btn.textContent = '⏸ 暂停';
  } else {
    ctx.suspend();
    if (btn) btn.textContent = '▶ 继续';
  }
}
export function nextLevel(): void {
  closeEduCard();
  closeTutorial();
  closeWhy();
  const lvls = LEVELS[state.currentWorld];
  const idx = lvls.findIndex((l: any) => l.id === state.currentLevel);
  if (idx >= 0 && idx < lvls.length - 1) {
    startLevel(state.currentWorld, lvls[idx + 1].id);
  } else {
    exitGame();
  }
}
export function completeLevel(wid: number, lid: string, stars: number): void {
  const old = Store.state.progress[lid] || 0;
  const isFirstClear = old === 0;
  Store.state.progress[lid] = Math.max(old, stars);
  Store.save();
  state.progress = Store.state.progress;
  playPerfect();
  if (state.combo > 1) playCombo(state.combo);
  const unlockBefore = { ...Store.state.unlocks };
  syncComposerUnlocks();
  const newKeys = Object.keys(Store.state.unlocks).filter((k) => Store.state.unlocks[k] && !unlockBefore[k]);
  if (newKeys.length) {
    const labels: Record<string, string> = {
      drums: '🥁 鼓',
      bass: '🎸 贝斯',
      melody: '🎹 旋律',
      chords: '🎶 和弦',
      euclidean: '📏 欧几里得',
      modular: '🔄 模运算',
      prime: '🔢 质数',
      fibonacci: '🌀 斐波那契',
      symmetry: '🪞 对称',
      recursive: '🌳 递归',
      cellular: '🧫 细胞自动机',
      markov: '🎲 马尔可夫',
      counterpoint: '🎭 对位',
    };
    showSuccessToast('解锁新内容：' + newKeys.map((k) => labels[k] || k).join('、'));
    spawnConfetti();
    playAchievement();
  }
  // XP 奖励：按星级 + 首次通关 bonus
  try {
    const xpReward =
      (XP_REWARDS.levelStar[stars as 1 | 2 | 3] || 0) + (isFirstClear ? XP_REWARDS.firstClearBonus : 0);
    if (xpReward > 0) addXp(xpReward, '通关 ' + lid);
    // 记录学习目标进度（首次通关计 1，重复通关也计以激励练习）
    recordLearningProgress(1);
  } catch (e) {
    /* progression 失败不影响主流程 */
  }
  if (wid >= 1 && wid <= 8) {
    const lvls = LEVELS[wid];
    const allCleared = lvls && lvls.every((l: any) => (Store.state.progress[l.id] || 0) >= 1);
    const anyHint = lvls && lvls.some((l: any) => (Store.state.levelHints[l.id] || 0) > 0);
    if (allCleared && !anyHint && !Store.state.noHintWorld) {
      Store.state.noHintWorld = true;
      Store.save();
    }
  }
}
export function useHint(): void {
  const lid = state.currentLevel;
  if (!lid) return;
  if (Store.state.settings.difficulty === 'hard') {
    showHintFloat('💡 困难模式下禁用提示');
    return;
  }
  Store.state.levelHints[lid] = (Store.state.levelHints[lid] || 0) + 1;
  Store.save();
  const h = LEVEL_HINTS[lid];
  if (h) {
    state.hintLevel = Math.min(state.hintLevel + 1, 2);
    showHintFloat('💡 ' + h);
  } else {
    showHintFloat('💡 暂时没有提示，试着点击播放听听看');
  }
}
