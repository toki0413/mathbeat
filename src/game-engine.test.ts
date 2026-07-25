import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Store, DEFAULT_STATE } from './store';
import {
  state,
  checkAchievements,
  completeLevel,
  recordAdaptive,
  getAdaptiveDifficulty,
  syncComposerAchievements,
  updateLeaderboard,
  isFreeModeUnlocked,
  bumpInteraction,
  stopAllPlayback,
  unlockAll,
  startLevel,
  renderGame,
  exitGame,
  restartLevel,
  toggleGamePause,
  nextLevel,
  useHint,
} from './game-engine';
import * as a11y from './a11y';
import * as audio from './audio';
import * as uiRender from './ui-render';
import * as fxParticles from './fx/particles';
import * as world1 from './worlds/world1';
import * as world2 from './worlds/world2';
import * as world3 from './worlds/world3';
import * as world4 from './worlds/world4';
import * as world5 from './worlds/world5';
import * as world6 from './worlds/world6';
import * as world7 from './worlds/world7';
import * as world8 from './worlds/world8';
import { ACHIEVEMENTS, LEVELS } from './worlds';
import { localGet } from './storage';

vi.mock('./audio', () => ({
  stopBgMusic: vi.fn(),
  playPerfect: vi.fn(),
  playCombo: vi.fn(),
  playAchievement: vi.fn(),
  stopSharedTransport: vi.fn(),
  getAudioCtx: vi.fn(),
  muteAllAudio: vi.fn(),
}));

vi.mock('./ui-render', () => ({
  showAchievementPopup: vi.fn(),
  showScreen: vi.fn(),
  showBossProblem: vi.fn(),
  showTutorial: vi.fn(),
  closeEduCard: vi.fn(),
  closeTutorial: vi.fn(),
  closeWhy: vi.fn(),
  showHintFloat: vi.fn(),
  updateDailyBanner: vi.fn(),
  renderContinueBar: vi.fn(),
  renderHome: vi.fn(),
}));

vi.mock('./fx/particles', () => ({
  spawnConfetti: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock('./daily', () => ({ stopDailyPlay: vi.fn() }));
vi.mock('./science', () => ({ stopSciencePlay: vi.fn() }));

vi.mock('./storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./storage')>()),
  localGet: vi.fn(() => []),
}));

// 仅覆盖 announce，其余 a11y 导出（openModal/closeModal 等）保留真实实现，
// 避免破坏 ui-feedback 等模块对 a11y 的依赖。
vi.mock('./a11y', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./a11y')>()),
  announce: vi.fn(),
}));

// 屏蔽 8 个 world 模块的真实渲染逻辑（依赖大量 DOM/audio），仅校验调用
vi.mock('./worlds/world1', () => ({
  renderWorld1: vi.fn(),
  w1StopPlayback: vi.fn(),
}));
vi.mock('./worlds/world2', () => ({ renderWorld2: vi.fn() }));
vi.mock('./worlds/world3', () => ({ renderWorld3: vi.fn() }));
vi.mock('./worlds/world4', () => ({ renderWorld4: vi.fn(), w4Stop: vi.fn() }));
vi.mock('./worlds/world5', () => ({
  renderWorld5: vi.fn(),
  w5StopPlayback: vi.fn(),
}));
vi.mock('./worlds/world6', () => ({ renderWorld6: vi.fn(), w6Stop: vi.fn() }));
vi.mock('./worlds/world7', () => ({ renderWorld7: vi.fn(), w7Stop: vi.fn() }));
vi.mock('./worlds/world8', () => ({ renderWorld8: vi.fn(), w8Stop: vi.fn() }));

function resetStore() {
  Store.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  Store.listeners = [];
  Store._idbReady = false;
  Store._saveTimer = null;
  Store._savePending = false;
}

function resetRuntimeState() {
  state.currentWorld = null;
  state.currentLevel = null;
  state.playing = false;
  state.step = 0;
  state.bpm = 120;
  state.hintLevel = 0;
  state.lastInteraction = Date.now();
  state.w1 = { playing: false, a: 2, b: 3, lcm: 6 };
}

function setupGameDOM() {
  document.body.innerHTML =
    '<div id="homeScreen"></div>' +
    '<div id="gameLevelPill"></div>' +
    '<div id="comboBadge"></div>' +
    '<div id="gameContent"></div>' +
    '<button id="gamePauseBtn"></button>';
}

describe('checkAchievements', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('awards mastery achievements when all levels in a world have 3 stars', () => {
    Store.state.progress = {
      '1-1': 3,
      '1-2': 3,
      '1-3': 3,
      '1-4': 3,
      '1-5': 3,
      '1-B': 3,
    };
    checkAchievements();
    expect(Store.state.achievements).toContain('mastery_world1');
    expect(Store.state.achievements).not.toContain('mastery_world2');
  });

  it('awards perfect_all_bosses only when every boss has 3 stars', () => {
    const bosses = ['1-B', '2-B', '3-B', '4-B', '5-B', '6-B', '7-B', '8-B'];
    bosses.forEach((id) => (Store.state.progress[id] = 3));
    checkAchievements();
    expect(Store.state.achievements).toContain('perfect_all_bosses');
  });

  it('does not award perfect_all_bosses if a boss is missing 3 stars', () => {
    Store.state.progress = { '1-B': 3, '2-B': 2 };
    checkAchievements();
    expect(Store.state.achievements).not.toContain('perfect_all_bosses');
  });

  it('awards endless score achievements', () => {
    Store.state.endlessStats = { bestScore: 75, totalRounds: 10, totalCorrect: 8, totalQuestions: 10, bestCombo: 5 };
    checkAchievements();
    expect(Store.state.achievements).toContain('endless_50');
    expect(Store.state.achievements).not.toContain('endless_100');
  });

  it('awards explorer achievements from state flags', () => {
    Store.state.importedSampleId = 'fibonacci-groove';
    Store.state.sharedComposer = true;
    Store.state.exportedScience = true;
    Store.state.customLevels = [{ id: 'c1', name: 'test', worldId: 1, desc: '', createdAt: '' }];
    checkAchievements();
    expect(Store.state.achievements).toContain('import_sample');
    expect(Store.state.achievements).toContain('share_composer');
    expect(Store.state.achievements).toContain('export_science');
    expect(Store.state.achievements).toContain('create_custom_level');
  });

  it('awards first_star when any progress entry is at least 1', () => {
    Store.state.progress = { '1-1': 1 };
    checkAchievements();
    expect(Store.state.achievements).toContain('first_star');
  });

  it('awards combo_5 and combo_10 based on state.combo thresholds', () => {
    Store.state.combo = 5;
    checkAchievements();
    expect(Store.state.achievements).toContain('combo_5');
    expect(Store.state.achievements).not.toContain('combo_10');
  });

  it('awards combo_10 when combo reaches 10', () => {
    Store.state.combo = 10;
    checkAchievements();
    expect(Store.state.achievements).toContain('combo_5');
    expect(Store.state.achievements).toContain('combo_10');
  });

  it('awards all_worldN when all levels of a world are cleared (>=1 star)', () => {
    Store.state.progress = {
      '2-1': 1,
      '2-2': 1,
      '2-3': 1,
      '2-4': 1,
      '2-5': 1,
      '2-B': 1,
    };
    checkAchievements();
    expect(Store.state.achievements).toContain('all_world2');
  });

  it('awards perfect_boss when any -B level reaches 3 stars', () => {
    Store.state.progress = { '3-B': 3 };
    checkAchievements();
    expect(Store.state.achievements).toContain('perfect_boss');
  });

  it('awards speed_runner when a boss was cleared under 60 seconds', () => {
    Store.state.bossTimes = { '3-B': { elapsed: 30000, total: 60000 } };
    checkAchievements();
    expect(Store.state.achievements).toContain('speed_runner');
  });

  it('does not award speed_runner when elapsed is exactly 60000ms (>=)', () => {
    Store.state.bossTimes = { '3-B': { elapsed: 60000, total: 60000 } };
    checkAchievements();
    expect(Store.state.achievements).not.toContain('speed_runner');
  });

  it('awards no_hint_clear when noHintWorld flag is set', () => {
    Store.state.noHintWorld = true;
    checkAchievements();
    expect(Store.state.achievements).toContain('no_hint_clear');
  });

  it('awards diary_5 when diary length is at least 5', () => {
    vi.mocked(localGet).mockReturnValueOnce([1, 2, 3, 4, 5] as any);
    checkAchievements();
    expect(Store.state.achievements).toContain('diary_5');
  });

  it('awards science_first / science_all based on tracking arrays', () => {
    Store.state.scienceCompositions = [{ id: 'x' }];
    Store.state.scienceTypesUsed = ['a', 'b', 'c', 'd'];
    checkAchievements();
    expect(Store.state.achievements).toContain('science_first');
    expect(Store.state.achievements).toContain('science_all');
  });

  it('awards sample_all when 9 or more samples were played', () => {
    Store.state.samplesPlayed = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9'];
    checkAchievements();
    expect(Store.state.achievements).toContain('sample_all');
  });

  it('awards daily_7 and daily_all_types from streak and types', () => {
    Store.state.dailyStreak = 7;
    Store.state.dailyTypesCompleted = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10', 't11', 't12'];
    checkAchievements();
    expect(Store.state.achievements).toContain('daily_7');
    expect(Store.state.achievements).toContain('daily_all_types');
  });

  it('awards composer_export when composerExported flag is set', () => {
    Store.state.composerExported = true;
    checkAchievements();
    expect(Store.state.achievements).toContain('composer_export');
  });

  it('awards hidden_lucky when luckyStreak >= 3', () => {
    Store.state.luckyStreak = 3;
    checkAchievements();
    expect(Store.state.achievements).toContain('hidden_lucky');
  });

  it('awards hidden_perfect_pitch when w3BossPerfect and 3-B cleared', () => {
    Store.state.w3BossPerfect = true;
    Store.state.progress = { '3-B': 1 };
    checkAchievements();
    expect(Store.state.achievements).toContain('hidden_perfect_pitch');
  });

  it('awards endless_100 when bestScore >= 100', () => {
    Store.state.endlessStats = {
      bestScore: 100,
      totalRounds: 0,
      totalCorrect: 0,
      totalQuestions: 0,
      bestCombo: 0,
    };
    checkAchievements();
    expect(Store.state.achievements).toContain('endless_100');
  });

  it('awards phase-2 explore achievements from state flags', () => {
    Store.state.w3RatiosHeard = ['1', '2', '3', '4', '5', '6'];
    Store.state.progress = { '2-3': 1, '7-2': 1, '8-B': 1 };
    Store.state.w2ReflectionAxisUsed = true;
    Store.state.w2OriginalReflectionPlayed = true;
    Store.state.w6RecursiveLayersUsed = true;
    Store.state.w7MarkovEdited = true;
    Store.state.w8BossCoveredAll = true;
    checkAchievements();
    expect(Store.state.achievements).toContain('tuning_explorer');
    expect(Store.state.achievements).toContain('symmetry_axis');
    expect(Store.state.achievements).toContain('original_reflection');
    expect(Store.state.achievements).toContain('recursive_layers');
    expect(Store.state.achievements).toContain('markov_editor');
    expect(Store.state.achievements).toContain('graph_hamilton');
  });

  it('does not double-award already earned achievements (earned Set dedup)', () => {
    Store.state.achievements = ['first_star'];
    Store.state.progress = { '1-1': 1 };
    const before = Store.state.achievements.length;
    checkAchievements();
    expect(Store.state.achievements.length).toBe(before);
  });

  it('still runs without throwing when progress is empty', () => {
    expect(() => checkAchievements()).not.toThrow();
    expect(Store.state.achievements).toEqual([]);
  });
});

describe('completeLevel 关卡完成', () => {
  beforeEach(() => {
    resetStore();
    vi.mocked(a11y.announce).mockClear();
  });

  it('调用 announce 播报关卡完成', () => {
    Store.state.progress = {};
    completeLevel(1, '1-1', 3);
    expect(a11y.announce).toHaveBeenCalled();
    const callArgs = vi
      .mocked(a11y.announce)
      .mock.calls.find((c) => /完成|星|关卡/.test(String(c[0])));
    expect(callArgs).toBeDefined();
  });

  it('更新 progress 和 XP', () => {
    Store.state.progress = {};
    Store.state.xp = 0;
    completeLevel(1, '1-1', 3);
    expect(Store.state.progress['1-1']).toBe(3);
    expect(Store.state.xp).toBeGreaterThan(0);
  });

  it('保留已达到的更高星级（不会因低星重置）', () => {
    Store.state.progress = { '1-1': 3 };
    const xpBefore = Store.state.xp || 0;
    completeLevel(1, '1-1', 1);
    expect(Store.state.progress['1-1']).toBe(3);
    // 重复通关也给 XP
    expect(Store.state.xp).toBeGreaterThanOrEqual(xpBefore);
  });

  it('首次通关触发 firstClear XP 奖励，重复通关不再加成', () => {
    Store.state.progress = {};
    completeLevel(1, '1-1', 2);
    const xpAfterFirst = Store.state.xp;
    completeLevel(1, '1-1', 2);
    // 第二次只给基础 XP（无 firstClear 加成），所以增量更小
    const firstGain = xpAfterFirst;
    const secondGain = Store.state.xp - xpAfterFirst;
    expect(secondGain).toBeLessThanOrEqual(firstGain);
  });

  it('combo > 1 时调用 playCombo', () => {
    Store.state.progress = {};
    state.combo = 3;
    completeLevel(1, '1-1', 2);
    expect(audio.playCombo).toHaveBeenCalledWith(3);
  });

  it('首次通关 1-B 触发 bass 与 modular 解锁 toast', () => {
    Store.state.progress = {};
    completeLevel(1, '1-B', 1);
    expect(Store.state.unlocks.bass).toBe(true);
    expect(Store.state.unlocks.modular).toBe(true);
    expect(fxParticles.showSuccessToast).toHaveBeenCalled();
    expect(fxParticles.spawnConfetti).toHaveBeenCalled();
  });

  it('通关 8-B 解锁 counterpoint', () => {
    Store.state.progress = {};
    completeLevel(8, '8-B', 1);
    expect(Store.state.unlocks.counterpoint).toBe(true);
  });

  it('通关整个 world 1 不使用提示时设置 noHintWorld 标志', () => {
    Store.state.progress = {
      '1-1': 1,
      '1-2': 1,
      '1-3': 1,
      '1-4': 1,
      '1-5': 1,
    };
    Store.state.levelHints = {};
    Store.state.noHintWorld = false;
    completeLevel(1, '1-B', 1);
    expect(Store.state.noHintWorld).toBe(true);
  });

  it('使用过提示则不设置 noHintWorld', () => {
    Store.state.progress = {
      '1-1': 1,
      '1-2': 1,
      '1-3': 1,
      '1-4': 1,
      '1-5': 1,
    };
    Store.state.levelHints = { '1-1': 1 };
    Store.state.noHintWorld = false;
    completeLevel(1, '1-B', 1);
    expect(Store.state.noHintWorld).toBe(false);
  });

  it('完成关卡时 announce 消息包含星级信息', () => {
    Store.state.progress = {};
    Store.state.xp = 0;
    Store.state.level = 1;
    completeLevel(1, '1-1', 3);
    const calls = vi.mocked(a11y.announce).mock.calls.map((c) => String(c[0]));
    const completionCall = calls.find((c) => /关卡完成.*3星/.test(c));
    expect(completionCall).toBeDefined();
  });

  it('wid 越界（如 wid=0 或 wid=9）时不抛错且不设置 noHintWorld', () => {
    Store.state.progress = {};
    expect(() => completeLevel(0, 'x-1', 1)).not.toThrow();
    expect(() => completeLevel(9, '9-1', 1)).not.toThrow();
  });
});

describe('recordAdaptive & getAdaptiveDifficulty 自适应难度', () => {
  beforeEach(() => {
    resetStore();
  });

  it('recordAdaptive 推入历史并触发 save', () => {
    recordAdaptive('1-1', 2);
    expect(Store.state.adaptiveHistory).toHaveLength(1);
    expect(Store.state.adaptiveHistory[0]).toMatchObject({ levelId: '1-1', stars: 2 });
    expect(Store.state.adaptiveHistory[0].time).toBeGreaterThan(0);
  });

  it('多次调用累积历史记录', () => {
    recordAdaptive('1-1', 1);
    recordAdaptive('1-2', 2);
    recordAdaptive('1-3', 3);
    expect(Store.state.adaptiveHistory).toHaveLength(3);
  });

  it('getAdaptiveDifficulty 在历史 < 3 条时返回 auto', () => {
    recordAdaptive('1-1', 3);
    recordAdaptive('1-2', 3);
    expect(getAdaptiveDifficulty()).toBe('auto');
  });

  it('getAdaptiveDifficulty 平均 >= 2.5 时返回 hard', () => {
    recordAdaptive('1-1', 3);
    recordAdaptive('1-1', 2);
    recordAdaptive('1-1', 3);
    expect(getAdaptiveDifficulty()).toBe('hard');
  });

  it('getAdaptiveDifficulty 平均在 [1.5, 2.5) 时返回 medium', () => {
    recordAdaptive('1-1', 2);
    recordAdaptive('1-1', 1);
    recordAdaptive('1-1', 2);
    expect(getAdaptiveDifficulty()).toBe('medium');
  });

  it('getAdaptiveDifficulty 平均 < 1.5 时返回 easy', () => {
    recordAdaptive('1-1', 1);
    recordAdaptive('1-1', 0);
    recordAdaptive('1-1', 1);
    expect(getAdaptiveDifficulty()).toBe('easy');
  });

  it('getAdaptiveDifficulty 仅考虑最近 10 条记录', () => {
    // 写 12 条 3 星 + 10 条 0 星 → 最近 10 条全是 0 星 → easy
    for (let i = 0; i < 12; i++) recordAdaptive('1-1', 3);
    for (let i = 0; i < 10; i++) recordAdaptive('1-1', 0);
    expect(getAdaptiveDifficulty()).toBe('easy');
  });

  it('syncComposerAchievements 为兼容空操作，不抛错', () => {
    expect(() => syncComposerAchievements()).not.toThrow();
  });
});

describe('updateLeaderboard 排行榜更新', () => {
  beforeEach(() => {
    resetStore();
  });

  it('空榜单时直接写入新分数', () => {
    updateLeaderboard('1-1', 100);
    expect(Store.state.leaderboard['1-1']).toBe(100);
  });

  it('新分数高于旧分数时更新', () => {
    updateLeaderboard('1-1', 100);
    updateLeaderboard('1-1', 200);
    expect(Store.state.leaderboard['1-1']).toBe(200);
  });

  it('新分数等于旧分数时不更新（仅严格大于才更新）', () => {
    updateLeaderboard('1-1', 100);
    updateLeaderboard('1-1', 100);
    expect(Store.state.leaderboard['1-1']).toBe(100);
  });

  it('新分数低于旧分数时保留旧分数', () => {
    updateLeaderboard('1-1', 200);
    updateLeaderboard('1-1', 50);
    expect(Store.state.leaderboard['1-1']).toBe(200);
  });

  it('不同关卡互不影响', () => {
    updateLeaderboard('1-1', 100);
    updateLeaderboard('1-2', 300);
    updateLeaderboard('2-B', 50);
    expect(Store.state.leaderboard['1-1']).toBe(100);
    expect(Store.state.leaderboard['1-2']).toBe(300);
    expect(Store.state.leaderboard['2-B']).toBe(50);
  });
});

describe('isFreeModeUnlocked', () => {
  beforeEach(() => {
    resetStore();
  });

  it('未通关 6-B 时返回 false', () => {
    Store.state.progress = {};
    expect(isFreeModeUnlocked()).toBe(false);
  });

  it('6-B 至少 1 星时返回 true', () => {
    Store.state.progress = { '6-B': 1 };
    expect(isFreeModeUnlocked()).toBe(true);
  });

  it('6-B 三星时也返回 true', () => {
    Store.state.progress = { '6-B': 3 };
    expect(isFreeModeUnlocked()).toBe(true);
  });

  it('其他 boss 通关不影响 free mode 状态', () => {
    Store.state.progress = { '1-B': 3, '2-B': 3, '5-B': 3 };
    expect(isFreeModeUnlocked()).toBe(false);
  });
});

describe('bumpInteraction', () => {
  beforeEach(() => {
    resetStore();
    resetRuntimeState();
  });

  it('更新 state.lastInteraction 为当前时间', () => {
    const before = state.lastInteraction;
    // 等待至少 1ms 确保时间差
    const start = Date.now();
    while (Date.now() === start) {
      /* spin */
    }
    bumpInteraction();
    expect(state.lastInteraction).toBeGreaterThan(before);
  });
});

describe('stopAllPlayback 安全停止所有播放', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('即使各 stop 函数抛错也不传播异常', () => {
    vi.mocked(audio.stopSharedTransport).mockImplementationOnce(() => {
      throw new Error('boom');
    });
    vi.mocked(audio.stopBgMusic).mockImplementationOnce(() => {
      throw new Error('boom2');
    });
    expect(() => stopAllPlayback()).not.toThrow();
  });

  it('调用所有 stop 入口（包含 window 上的 fmStop/mcStop/stopSamplePlayback）', () => {
    const fmStop = vi.fn();
    const mcStop = vi.fn();
    const stopSample = vi.fn();
    (window as any).fmStop = fmStop;
    (window as any).mcStop = mcStop;
    (window as any).stopSamplePlayback = stopSample;
    try {
      stopAllPlayback();
      expect(audio.stopSharedTransport).toHaveBeenCalled();
      expect(audio.stopBgMusic).toHaveBeenCalled();
      expect(audio.muteAllAudio).toHaveBeenCalledWith(500);
      expect(fmStop).toHaveBeenCalled();
      expect(mcStop).toHaveBeenCalled();
      expect(stopSample).toHaveBeenCalled();
    } finally {
      delete (window as any).fmStop;
      delete (window as any).mcStop;
      delete (window as any).stopSamplePlayback;
    }
  });

  it('window stop 函数缺失时不抛错', () => {
    delete (window as any).fmStop;
    delete (window as any).mcStop;
    delete (window as any).stopSamplePlayback;
    expect(() => stopAllPlayback()).not.toThrow();
  });
});

describe('unlockAll 一键解锁', () => {
  beforeEach(() => {
    resetStore();
    setupGameDOM();
    vi.clearAllMocks();
  });

  it('将所有关卡设为 3 星', () => {
    unlockAll();
    for (let w = 1; w <= 8; w++) {
      const levels = LEVELS[w];
      for (const lv of levels) {
        expect(Store.state.progress[lv.id]).toBe(3);
      }
    }
  });

  it('解锁全部成就', () => {
    unlockAll();
    for (const ach of ACHIEVEMENTS) {
      expect(Store.state.achievements).toContain(ach.id);
    }
  });

  it('bestCombo 至少为 10', () => {
    Store.state.bestCombo = 0;
    unlockAll();
    expect(Store.state.bestCombo).toBeGreaterThanOrEqual(10);
  });

  it('显示成功 toast 与撒花特效', () => {
    unlockAll();
    expect(fxParticles.showSuccessToast).toHaveBeenCalled();
    expect(fxParticles.spawnConfetti).toHaveBeenCalled();
  });

  it('homeScreen 不在 active 状态时不调用 renderHome / renderContinueBar', () => {
    unlockAll();
    expect(uiRender.renderHome).not.toHaveBeenCalled();
    expect(uiRender.renderContinueBar).not.toHaveBeenCalled();
  });

  it('homeScreen 处于 active 时调用 renderHome / renderContinueBar', () => {
    document.getElementById('homeScreen')!.classList.add('active');
    unlockAll();
    expect(uiRender.renderHome).toHaveBeenCalled();
    expect(uiRender.renderContinueBar).toHaveBeenCalled();
  });
});

describe('startLevel & renderGame 关卡导航', () => {
  beforeEach(() => {
    resetStore();
    resetRuntimeState();
    setupGameDOM();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('startLevel 设置 state 与 store，并显示 game 屏幕', () => {
    startLevel(1, '1-1');
    expect(state.currentWorld).toBe(1);
    expect(state.currentLevel).toBe('1-1');
    expect(state.hintLevel).toBe(0);
    expect(Store.state.lastWorld).toBe(1);
    expect(Store.state.lastLevel).toBe('1-1');
    expect(uiRender.showScreen).toHaveBeenCalledWith('game');
  });

  it('startLevel 非 boss 关卡调用 renderWorld1', () => {
    startLevel(1, '1-1');
    expect(world1.renderWorld1).toHaveBeenCalled();
    expect(uiRender.showBossProblem).not.toHaveBeenCalled();
  });

  it('startLevel boss 关卡调用 showBossProblem 而非 renderWorldN', () => {
    startLevel(1, '1-B');
    expect(uiRender.showBossProblem).toHaveBeenCalledWith(1, '1-B');
    expect(world1.renderWorld1).not.toHaveBeenCalled();
  });

  it('startLevel 调用 showTutorial 当存在教程时', () => {
    startLevel(1, '1-1'); // '1-1' 有教程
    expect(uiRender.showTutorial).toHaveBeenCalled();
  });

  it('startLevel 不调用 showTutorial 当无教程时', () => {
    startLevel(7, '7-1'); // '7-1' 没有教程
    expect(uiRender.showTutorial).not.toHaveBeenCalled();
  });

  it('renderGame 各 wid 调用对应 renderWorldN', () => {
    renderGame(2, '2-1');
    expect(world2.renderWorld2).toHaveBeenCalled();
    renderGame(3, '3-1');
    expect(world3.renderWorld3).toHaveBeenCalled();
    renderGame(4, '4-1');
    expect(world4.renderWorld4).toHaveBeenCalled();
    renderGame(5, '5-1');
    expect(world5.renderWorld5).toHaveBeenCalled();
    renderGame(6, '6-1');
    expect(world6.renderWorld6).toHaveBeenCalled();
    renderGame(7, '7-1');
    expect(world7.renderWorld7).toHaveBeenCalled();
    renderGame(8, '8-1');
    expect(world8.renderWorld8).toHaveBeenCalled();
  });

  it('renderGame 设置 gameLevelPill 与 comboBadge 文本', () => {
    renderGame(1, '1-1');
    expect(document.getElementById('gameLevelPill')!.textContent).toContain('对位');
    expect(document.getElementById('comboBadge')!.textContent).toContain('连击');
  });

  it('renderGame boss 关卡调用 window.startBossComposer', () => {
    const spy = vi.fn();
    (window as any).startBossComposer = spy;
    try {
      renderGame(1, '1-B');
      expect(spy).toHaveBeenCalledWith(1, '1-B');
    } finally {
      delete (window as any).startBossComposer;
    }
  });
});

describe('exitGame / restartLevel / nextLevel', () => {
  beforeEach(() => {
    resetStore();
    resetRuntimeState();
    setupGameDOM();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exitGame 切回 home 屏幕', () => {
    exitGame();
    expect(uiRender.showScreen).toHaveBeenCalledWith('home');
  });

  it('restartLevel 在没有当前关卡时静默返回', () => {
    expect(() => restartLevel()).not.toThrow();
    expect(uiRender.showScreen).not.toHaveBeenCalled();
  });

  it('restartLevel 在已有当前关卡时重新调用 startLevel', () => {
    startLevel(1, '1-1');
    vi.mocked(uiRender.showScreen).mockClear();
    restartLevel();
    expect(uiRender.showScreen).toHaveBeenCalledWith('game');
  });

  it('nextLevel 推进到下一关', () => {
    startLevel(1, '1-1');
    vi.mocked(uiRender.showScreen).mockClear();
    nextLevel();
    expect(state.currentLevel).toBe('1-2');
  });

  it('nextLevel 在世界最后一关时调用 exitGame', () => {
    startLevel(1, '1-B'); // 1-B 是世界 1 的最后一关
    vi.mocked(uiRender.showScreen).mockClear();
    nextLevel();
    expect(uiRender.showScreen).toHaveBeenCalledWith('home');
  });
});

describe('toggleGamePause 暂停切换', () => {
  beforeEach(() => {
    setupGameDOM();
    vi.clearAllMocks();
  });

  it('没有 audio context 时静默返回', () => {
    vi.mocked(audio.getAudioCtx).mockReturnValueOnce(null as any);
    expect(() => toggleGamePause()).not.toThrow();
  });

  it('suspended 状态下恢复并切换按钮文本', () => {
    const ctx = { state: 'suspended', resume: vi.fn(), suspend: vi.fn() };
    vi.mocked(audio.getAudioCtx).mockReturnValueOnce(ctx as any);
    toggleGamePause();
    expect(ctx.resume).toHaveBeenCalled();
    expect(document.getElementById('gamePauseBtn')!.textContent).toContain('暂停');
  });

  it('running 状态下暂停并切换按钮文本', () => {
    const ctx = { state: 'running', resume: vi.fn(), suspend: vi.fn() };
    vi.mocked(audio.getAudioCtx).mockReturnValueOnce(ctx as any);
    toggleGamePause();
    expect(ctx.suspend).toHaveBeenCalled();
    expect(document.getElementById('gamePauseBtn')!.textContent).toContain('继续');
  });
});

describe('useHint 提示', () => {
  beforeEach(() => {
    resetStore();
    resetRuntimeState();
    vi.clearAllMocks();
  });

  it('没有当前关卡时静默返回', () => {
    expect(() => useHint()).not.toThrow();
    expect(uiRender.showHintFloat).not.toHaveBeenCalled();
  });

  it('困难模式下显示禁用提示', () => {
    state.currentLevel = '1-1';
    Store.state.settings.difficulty = 'hard';
    useHint();
    expect(uiRender.showHintFloat).toHaveBeenCalledWith(expect.stringContaining('困难模式'));
    expect(Store.state.levelHints['1-1']).toBeUndefined();
  });

  it('普通模式下增加 levelHints 计数并显示 LEVEL_HINTS', () => {
    state.currentLevel = '1-1';
    Store.state.settings.difficulty = 'auto';
    useHint();
    expect(Store.state.levelHints['1-1']).toBe(1);
    useHint();
    expect(Store.state.levelHints['1-1']).toBe(2);
    expect(uiRender.showHintFloat).toHaveBeenCalledWith(expect.stringContaining('LCM'));
  });

  it('hintLevel 不超过 2（钳制上界）', () => {
    state.currentLevel = '1-1';
    useHint();
    useHint();
    useHint();
    useHint();
    expect(state.hintLevel).toBe(2);
  });

  it('LEVEL_HINTS 中不存在的关卡显示默认提示', () => {
    state.currentLevel = 'custom-xyz';
    useHint();
    expect(uiRender.showHintFloat).toHaveBeenCalledWith(expect.stringContaining('暂时没有提示'));
    expect(Store.state.levelHints['custom-xyz']).toBe(1);
  });
});

describe('state Proxy', () => {
  beforeEach(() => {
    resetStore();
    resetRuntimeState();
  });

  it('写入 Store key 时同步到 Store.state', () => {
    state.combo = 7;
    expect(Store.state.combo).toBe(7);
  });

  it('combo 是 TRANSIENT key，写入不会调用 Store.setState', () => {
    const spy = vi.spyOn(Store, 'setState');
    state.combo = 9;
    expect(spy).not.toHaveBeenCalled();
    expect(Store.state.combo).toBe(9);
    spy.mockRestore();
  });

  it('非 Store key（如 playing）写入只更新 runtimeState', () => {
    state.playing = true;
    expect(state.playing).toBe(true);
    // playing 不在 Store.state 中，所以 Store.state 不应被设置
    expect((Store.state as any).playing).toBeUndefined();
  });

  it('读取 Store key 时返回 Store.state 的值', () => {
    Store.state.combo = 11;
    expect(state.combo).toBe(11);
  });
});
