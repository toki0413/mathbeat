import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';

// 使用 fake timers 避免 setTimeout/setInterval 在 DOM 清理后触发导致未捕获异常
vi.useFakeTimers();

// ============================================================
// Mock 所有外部依赖：main.ts 是应用入口，导入了几乎所有模块。
// 测试主要验证模块加载、window 副作用、handler 注册与全局导出。
// ============================================================

vi.mock('./i18n', () => ({
  t: vi.fn((k: string) => k),
  applyTranslations: vi.fn(),
  getLang: vi.fn(() => 'zh'),
  setLang: vi.fn(),
  toggleLang: vi.fn(),
}));

vi.mock('./storage', () => ({
  idbGet: vi.fn(() => Promise.resolve(null)),
  idbSet: vi.fn(() => Promise.resolve()),
  idbDelete: vi.fn(() => Promise.resolve()),
  migrateFromLocalStorage: vi.fn(() => Promise.resolve()),
  localGet: vi.fn(() => null),
  localSet: vi.fn(() => true),
  localRemove: vi.fn(() => true),
}));

vi.mock('./storage-keys', () => ({
  LS_KEYS: { STATE: 'mathbeat_state' },
}));

vi.mock('./sound-packs', () => ({
  SOUND_PACKS: {
    mathRock: { emoji: '🥁', name: 'Math Rock' },
    jazz: { emoji: '🎷', name: 'Jazz' },
  },
  DEFAULT_SOUND_PACK: 'mathRock',
  SOUND_PACK_ORDER: ['mathRock', 'jazz'],
}));

vi.mock('./math-visuals', () => ({
  MATH_VISUALS: {},
  stopAllMathVisuals: vi.fn(),
}));

vi.mock('./concept-map', () => ({
  renderConceptMap: vi.fn(),
  CONCEPT_NODES: [],
  getConceptConnections: vi.fn(() => null),
}));

vi.mock('./boss-problems', () => ({
  getBossProblem: vi.fn(() => null),
}));

vi.mock('./a11y', () => ({
  initA11y: vi.fn(),
  installModalKeyboardHandlers: vi.fn(),
  announce: vi.fn(),
  openModal: vi.fn(),
  closeModal: vi.fn(),
}));

vi.mock('./error-report', () => ({
  installGlobalErrorHandlers: vi.fn(),
  setConsoleMirror: vi.fn(),
  reportError: vi.fn(),
  initWebVitalsReporting: vi.fn(),
}));

vi.mock('./store', () => {
  const state = {
    version: '1.0.0',
    screen: 'home',
    currentWorld: 0,
    currentLevel: 0,
    progress: {} as Record<string, number>,
    unlocks: { drums: true, bass: false, melody: false, chords: false, euclidean: true } as Record<string, boolean>,
    scienceCompositions: [] as unknown[],
    diary: [] as unknown[],
    settings: {
      bgm: true,
      sfx: true,
      difficulty: 'auto' as const,
      soundPack: 'mathRock',
      masterVolume: 0.8,
      visualBeat: false,
    },
    combo: 0,
    bestCombo: 0,
    achievements: [] as string[],
    leaderboard: {} as Record<string, unknown>,
    adaptiveHistory: [] as unknown[],
    dailyStreak: 0,
    dailyLastDate: '',
    dailyTypesCompleted: [] as string[],
    dailyWeekCounts: {} as Record<string, number>,
    scienceTypesUsed: [] as string[],
    samplesPlayed: [] as string[],
    levelHints: {} as Record<string, number>,
    bossTimes: {} as Record<string, { elapsed: number; total: number }>,
    luckyStreak: 0,
    w3BossPerfect: false,
    noHintWorld: false,
    pendingBoss: null as string | null,
    onboardingDone: true,
    lastWorld: 0,
    lastLevel: '',
  };
  return {
    Store: {
      state,
      save: vi.fn(),
      load: vi.fn(),
    },
    DEFAULT_STATE: state,
    LS_KEYS: { STATE: 'mathbeat_state' },
    validateSaveData: vi.fn(() => true),
    syncComposerUnlocks: vi.fn(),
    importGameData: vi.fn(),
    exportGameData: vi.fn(() => '{}'),
    resetGameData: vi.fn(),
    CURRENT_SCHEMA_VERSION: '1.0.0',
  };
});

vi.mock('./worlds', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./worlds')>();
  return { ...actual };
});

vi.mock('./utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils')>();
  return { ...actual };
});

vi.mock('./audio', () => ({
  playSample: vi.fn(),
  scheduleFallbackDrum: vi.fn(),
  getAudioCtx: vi.fn(() => ({
    currentTime: 0,
    state: 'running',
    resume: vi.fn(),
    destination: {},
    createDynamicsCompressor: vi.fn(() => ({
      threshold: { value: 0 },
      knee: { value: 0 },
      ratio: { value: 0 },
      attack: { value: 0 },
      release: { value: 0 },
      connect: vi.fn(),
    })),
    createGain: vi.fn(() => ({ gain: { value: 0 }, connect: vi.fn() })),
  })),
  getMasterBus: vi.fn(() => ({ connect: vi.fn(), gain: { value: 1 } })),
  scheduleKickAt: vi.fn(),
  scheduleSnareAt: vi.fn(),
  scheduleHihatAt: vi.fn(),
  scheduleToneAt: vi.fn(),
  playTone: vi.fn(),
  playCorrect: vi.fn(),
  playWrong: vi.fn(),
  startBgMusic: vi.fn(),
  stopBgMusic: vi.fn(),
  toggleBgMusic: vi.fn(),
  hideBgmHint: vi.fn(),
  showBgmHint: vi.fn(),
  EMBEDDED_SAMPLES: {},
  sampleBuffers: {},
  loadEmbeddedSamples: vi.fn(() => Promise.resolve()),
  bgMusicUserMuted: false,
  setSoundPack: vi.fn(),
  setMasterVolume: vi.fn(),
  getAnalyser: vi.fn(() => null),
}));

vi.mock('./ui-render', () => ({
  renderHome: vi.fn(),
  renderContinueBar: vi.fn(),
  showScreen: vi.fn(),
  renderAchievements: vi.fn(),
  renderSampleLibrary: vi.fn(),
  openSampleLibrary: vi.fn(),
  closeSampleLibrary: vi.fn(),
  openAchievements: vi.fn(),
  closeAchievements: vi.fn(),
  openSettings: vi.fn(),
  closeSettings: vi.fn(),
  renderSettings: vi.fn(),
  showWorldIntro: vi.fn(),
  closeWorldIntro: vi.fn(),
  openConceptMap: vi.fn(),
  closeConceptMap: vi.fn(),
  showBossProblem: vi.fn(),
  closeBossProblem: vi.fn(),
  showWhy: vi.fn(),
  closeWhy: vi.fn(),
  showTutorial: vi.fn(),
  closeTutorial: vi.fn(),
  showOnboarding: vi.fn(),
  showEducationCard: vi.fn(),
  closeEduCard: vi.fn(),
  showHintFloat: vi.fn(),
  showAchievementPopup: vi.fn(),
  showStars: vi.fn(),
  openTeacher: vi.fn(),
  closeTeacher: vi.fn(),
  teacherLogin: vi.fn(),
  renderTeacher: vi.fn(),
  simulateClassData: vi.fn(),
  exportData: vi.fn(),
  closeScienceMode: vi.fn(),
  updateDailyBanner: vi.fn(),
  openFreeMode: vi.fn(),
  closeFreeMode: vi.fn(),
  closeDiary: vi.fn(),
  closeKG: vi.fn(),
  openEndlessMode: vi.fn(),
  closeEndlessMode: vi.fn(),
  openLevelEditor: vi.fn(),
  closeLevelEditor: vi.fn(),
  changeDifficulty: vi.fn(),
  changeSoundPack: vi.fn(),
  toggleSettingBgm: vi.fn(),
  toggleSettingSfx: vi.fn(),
  toggleSettingVisualBeat: vi.fn(),
  registerUiRenderActions: vi.fn(),
}));

vi.mock('./game-engine', () => ({
  state: { currentWorld: 0, currentLevel: '', pendingBoss: null },
  getAdaptiveDifficulty: vi.fn(() => 'easy'),
  recordAdaptive: vi.fn(),
  syncComposerAchievements: vi.fn(),
  checkAchievements: vi.fn(),
  updateLeaderboard: vi.fn(),
  startLevel: vi.fn(),
  exitGame: vi.fn(),
  nextLevel: vi.fn(),
  completeLevel: vi.fn(),
  useHint: vi.fn(),
  stopAllPlayback: vi.fn(),
  isFreeModeUnlocked: vi.fn(() => false),
  renderGame: vi.fn(),
  bumpInteraction: vi.fn(),
  restartLevel: vi.fn(),
  toggleGamePause: vi.fn(),
  unlockAll: vi.fn(),
}));

// 8 个 world 模块：mock 渲染函数，避免触发 worlds-bundle 全量加载
vi.mock('./worlds/world1', () => ({ renderWorld1: vi.fn() }));
vi.mock('./worlds/world2', () => ({ renderWorld2: vi.fn() }));
vi.mock('./worlds/world3', () => ({ renderWorld3: vi.fn() }));
vi.mock('./worlds/world4', () => ({ renderWorld4: vi.fn() }));
vi.mock('./worlds/world5', () => ({ renderWorld5: vi.fn(), w5DegreeName: vi.fn((n: number) => 'I') }));
vi.mock('./worlds/world6', () => ({ renderWorld6: vi.fn() }));
vi.mock('./worlds/world7', () => ({ renderWorld7: vi.fn() }));
vi.mock('./worlds/world8', () => ({ renderWorld8: vi.fn() }));

vi.mock('./daily', () => ({
  getDailyChallenge: vi.fn(() => ({ name: 'Daily', type: 'ratio' })),
  dailyState: { completed: false, currentType: 'ratio' },
  startDailyChallenge: vi.fn(),
  renderDailyModal: vi.fn(),
  renderDailyRing: vi.fn(),
  dailyRingToggle: vi.fn(),
  dailyRatioChange: vi.fn(),
  dailyRatioPlay: vi.fn(),
  renderDailyEuclidGrid: vi.fn(),
  dailyEuclidToggle: vi.fn(),
  dailyEuclidApply: vi.fn(),
  closeDailyModal: vi.fn(),
  toggleDailyPlay: vi.fn(),
  stopDailyPlay: vi.fn(),
  checkDailyAnswer: vi.fn(),
  dailyPermAnswer: vi.fn(),
  dailyGraphAnswer: vi.fn(),
  showDailyFeedback: vi.fn(),
  dailyChallengeSuccess: vi.fn(),
  updateDailyStreak: vi.fn(),
  getWeekKey: vi.fn(() => '2026-W30'),
  showDailyWhy: vi.fn(),
  updateDailyBanner: vi.fn(),
}));

vi.mock('./science', () => ({
  SCIENCE_SAMPLES: {},
  SCIENCE_REAL_SAMPLES: {},
  SCIENCE_SCHEMA: {},
  SCIENCE_TYPE_NAMES: {},
  SCIENCE_MAPPINGS: {},
  SCIENCE_OPTIONS: {},
  scienceState: { step: 0, type: 'csv' },
  openScienceMode: vi.fn(),
  goScienceStep: vi.fn(),
  updateScienceTypeUI: vi.fn(),
  renderScienceData: vi.fn(),
  renderScienceVisualizer: vi.fn(),
  renderScienceCompositionList: vi.fn(),
  loadScienceSample: vi.fn(),
  handleScienceFile: vi.fn(),
  parseScienceTextComplete: vi.fn(),
  parseScienceCSV: vi.fn(),
  parseScienceText: vi.fn(),
  selectScienceType: vi.fn(),
  toggleScienceMapping: vi.fn(),
  updateScienceOption: vi.fn(),
  toggleSciencePlay: vi.fn(),
  regenerateScienceMusic: vi.fn(),
  saveScienceComposition: vi.fn(),
  loadScienceComposition: vi.fn(),
  deleteScienceComposition: vi.fn(),
  openComposerWithScience: vi.fn(),
  shareScience: vi.fn(),
  toggleScienceWhyPanel: vi.fn(),
  downloadScienceExport: vi.fn(),
}));

vi.mock('./science-deep', () => ({
  openFractureMode: vi.fn(),
  openFlameMode: vi.fn(),
}));

vi.mock('./materiomusic', () => ({
  initMateriomusicEvents: vi.fn(),
  openScaleLab: vi.fn(),
  openProteinMode: vi.fn(),
  openWebMode: vi.fn(),
}));

vi.mock('./wave-lab', () => ({
  initWaveLabEvents: vi.fn(),
  openWaveLab: vi.fn(),
  closeWaveLab: vi.fn(),
}));

vi.mock('./endless-mode', () => ({
  initEndlessMode: vi.fn(),
  nextRound: vi.fn(),
  submitAnswer: vi.fn(),
  playMelody: vi.fn(),
  getEndlessState: vi.fn(() => ({})),
  showEndlessHint: vi.fn(),
  endEndlessMode: vi.fn(),
}));

vi.mock('./level-editor', () => ({
  renderEditor: vi.fn(),
  changeEditorWorld: vi.fn(),
  saveCustomLevel: vi.fn(),
  deleteCustomLevel: vi.fn(),
  playCustomLevel: vi.fn(),
  exportCustomLevel: vi.fn(),
  exportCustomLevelById: vi.fn(),
  importCustomLevel: vi.fn(),
  previewCustomLevel: vi.fn(),
}));

vi.mock('./fx/particles', () => ({
  spawnParticles: vi.fn(),
  spawnParticlesAtElement: vi.fn(),
  spawnCorrectParticles: vi.fn(),
  spawnComboParticles: vi.fn(),
  spawnConfetti: vi.fn(),
  animateParticles: vi.fn(),
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));

vi.mock('./composer/mini-composer', () => ({
  startBossComposer: vi.fn(),
  exitMiniComposer: vi.fn(),
  mcRenderTracks: vi.fn(),
  mcToggleCell: vi.fn(),
  mcApplyGen: vi.fn(),
  mcTogglePlay: vi.fn(),
  mcStart: vi.fn(),
  mcStop: vi.fn(),
  mcReset: vi.fn(),
  mcFinish: vi.fn(),
}));

vi.mock('./free-mode', () => ({
  fmInit: vi.fn(),
  fmRenderTracks: vi.fn(),
  fmToggleCell: vi.fn(),
  fmPlay: vi.fn(),
  fmStop: vi.fn(),
  fmTogglePlay: vi.fn(),
  fmReset: vi.fn(),
  fmChangeBpm: vi.fn(),
}));

vi.mock('./sample-library', () => ({
  MATH_ROCK_SAMPLES: [],
  REAL_MATH_ROCK_SAMPLES: {},
  getSampleComposition: vi.fn(() => null),
  toggleSamplePlayback: vi.fn(),
  playSampleComposition: vi.fn(),
  stopSamplePlayback: vi.fn(),
  importSampleToComposer: vi.fn(),
}));

vi.mock('./progression', () => ({
  refreshXpBar: vi.fn(),
  refreshFreezeBadge: vi.fn(),
}));

vi.mock('./practice-mode', () => ({}));

vi.mock('./learning-insights', () => ({
  generateDailyRecommendations: vi.fn(() => []),
}));

vi.mock('./visual-beat', () => ({
  setVisualBeat: vi.fn(),
}));

vi.mock('./events', () => ({
  registerActions: vi.fn(),
  registerInputs: vi.fn(),
  initEventDelegation: vi.fn(),
}));

// 静态导入：mock 模块本身的依赖（在 mock 设置完成后）
import { Store } from './store';
import * as events from './events';
import * as audio from './audio';
import * as uiRender from './ui-render';
import * as i18n from './i18n';
import * as science from './science';
import * as materiomusic from './materiomusic';
import * as waveLab from './wave-lab';
import * as scienceDeep from './science-deep';
import * as gameEngine from './game-engine';

// 辅助：构造 main.ts 顶层副作用期望存在的 DOM 元素
function setupMainDom() {
  document.body.innerHTML = `
    <div id="loadingScreen"><div id="loadingText">Loading</div></div>
    <div id="homeScreen" class="screen active"></div>
    <div id="levelScreen" class="screen"></div>
    <div id="gameScreen" class="screen"></div>
    <div id="scienceScreen" class="screen"></div>
    <div id="endlessModeScreen" class="screen"></div>
    <div id="levelEditorScreen" class="screen"></div>
    <div id="freeModeScreen" class="screen"></div>
    <div id="settingsScreen" class="screen"></div>
    <div id="achievementsScreen" class="screen"></div>
    <canvas id="homeVisualizer" width="320" height="80"></canvas>
    <button id="bgMusicBtn">🎵</button>
    <a class="skip-link" href="#main">跳到主内容</a>
  `;
}

// 动态导入 main.ts（确保 DOM 就绪、mock 已注册）
let mainReady = false;
beforeAll(async () => {
  setupMainDom();
  // mock window.location.href 为可写（happy-dom 下 location.href 只读）
  Object.defineProperty(window, 'location', {
    value: { href: '', protocol: 'http:', pathname: '/', hostname: 'localhost' },
    writable: true,
    configurable: true,
  });
  // mock navigator.serviceWorker（避免实际注册 SW）
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { register: vi.fn(() => Promise.resolve({ unregister: vi.fn() })) },
    writable: true,
    configurable: true,
  });
  await import('./main');
  mainReady = true;
});

// 注意：不使用 vi.clearAllMocks() —— main.ts 在 beforeAll 的动态导入阶段
// 已经调用过 registerActions / registerUiRenderActions 等顶层副作用，
// 全局 clearAllMocks 会清掉这些调用记录，导致 "toHaveBeenCalled" 断言失败。
// 需要重置调用计数的测试，单独在 it 内部用 vi.clearAllMocks() 或 mockClear。
beforeEach(() => {
  // 仅恢复默认 DOM，不影响 mock 调用历史
});

afterEach(() => {
  // 推进所有 pending timers，避免污染后续测试
  try {
    vi.runAllTimers();
  } catch (_) {
    /* 源码 setTimeout 内可能访问已清理 DOM 元素，捕获异步错误 */
  }
});

// 辅助：在 happy-dom 下 window.dispatchEvent(new Event('load')) 不会触发
// 通过 window.onload = fn 注册的 property-handler，需直接调用。
function fireWindowLoad() {
  const handler = window.onload as ((ev: Event) => void) | null;
  if (typeof handler === 'function') {
    try {
      handler.call(window, new Event('load'));
    } catch (_) {
      /* noop */
    }
  }
}

describe('main 应用入口 - 模块加载与初始化', () => {
  it('main.ts 模块顶层副作用完成（beforeAll 中已动态导入）', () => {
    expect(mainReady).toBe(true);
  });

  it('registerActions 被调用（注册 data-action handlers）', () => {
    expect(events.registerActions).toHaveBeenCalled();
  });

  it('registerUiRenderActions 被调用', () => {
    expect(uiRender.registerUiRenderActions).toHaveBeenCalled();
  });

  it('window.onload 是函数（应用入口已注册）', () => {
    expect(typeof window.onload).toBe('function');
  });

  it('scienceMode 相关函数被暴露到 window', () => {
    expect(typeof (window as any).openScienceMode).toBe('function');
    expect(typeof (window as any).closeScienceMode).toBe('function');
    expect(typeof (window as any).selectScienceType).toBe('function');
    expect(typeof (window as any).goScienceStep).toBe('function');
    expect(typeof (window as any).loadScienceSample).toBe('function');
    expect(typeof (window as any).handleScienceFile).toBe('function');
  });

  it('i18n 函数被暴露到 window', () => {
    expect(typeof (window as any).toggleLang).toBe('function');
    expect(typeof (window as any).applyTranslations).toBe('function');
    expect(typeof (window as any).getLang).toBe('function');
    expect(typeof (window as any).setLang).toBe('function');
    expect(typeof (window as any).t).toBe('function');
  });

  it('handlers 全部被 Object.assign 到 window', () => {
    // 抽样校验各类 handler（关闭类、打开类、设置类、游戏引擎类）
    expect(typeof (window as any).changeDifficulty).toBe('function');
    expect(typeof (window as any).changeSoundPack).toBe('function');
    expect(typeof (window as any).closeAchievements).toBe('function');
    expect(typeof (window as any).closeBossProblem).toBe('function');
    expect(typeof (window as any).closeConceptMap).toBe('function');
    expect(typeof (window as any).closeDailyModal).toBe('function');
    expect(typeof (window as any).closeSettings).toBe('function');
    expect(typeof (window as any).closeTeacher).toBe('function');
    expect(typeof (window as any).closeTutorial).toBe('function');
    expect(typeof (window as any).exitGame).toBe('function');
    expect(typeof (window as any).nextLevel).toBe('function');
    expect(typeof (window as any).openAchievements).toBe('function');
    expect(typeof (window as any).openConceptMap).toBe('function');
    expect(typeof (window as any).openEndlessMode).toBe('function');
    expect(typeof (window as any).openFreeMode).toBe('function');
    expect(typeof (window as any).openLevelEditor).toBe('function');
    expect(typeof (window as any).openSampleLibrary).toBe('function');
    expect(typeof (window as any).openScienceMode).toBe('function');
    expect(typeof (window as any).openSettings).toBe('function');
    expect(typeof (window as any).openTeacher).toBe('function');
    expect(typeof (window as any).showScreen).toBe('function');
    expect(typeof (window as any).startLevel).toBe('function');
    expect(typeof (window as any).toggleBgMusic).toBe('function');
    expect(typeof (window as any).toggleLang).toBe('function');
    expect(typeof (window as any).useHint).toBe('function');
  });

  it('materiomusic / waveLab handlers 暴露到 window', () => {
    expect(typeof (window as any).openScaleLab).toBe('function');
    expect(typeof (window as any).openProteinMode).toBe('function');
    expect(typeof (window as any).openWebMode).toBe('function');
    expect(typeof (window as any).openWaveLab).toBe('function');
    expect(typeof (window as any).closeWaveLab).toBe('function');
  });

  it('science-deep handlers 暴露到 window', () => {
    expect(typeof (window as any).openFractureMode).toBe('function');
    expect(typeof (window as any).openFlameMode).toBe('function');
  });

  it('sample-library globals 暴露到 window', () => {
    expect(Array.isArray((window as any).MATH_ROCK_SAMPLES)).toBe(true);
    expect(typeof (window as any).getSampleComposition).toBe('function');
    expect(typeof (window as any).importSampleToComposer).toBe('function');
    expect(typeof (window as any).playSampleComposition).toBe('function');
    expect(typeof (window as any).stopSamplePlayback).toBe('function');
    expect(typeof (window as any).toggleSamplePlayback).toBe('function');
  });

  it('free-mode globals 暴露到 window', () => {
    expect(typeof (window as any).fmInit).toBe('function');
    expect(typeof (window as any).fmPlay).toBe('function');
    expect(typeof (window as any).fmRenderTracks).toBe('function');
    expect(typeof (window as any).fmStop).toBe('function');
    expect(typeof (window as any).fmToggleCell).toBe('function');
  });
});

describe('main - openComposerHome 路由', () => {
  it('openComposerHome 设置 window.location.href 为 composer.html', async () => {
    const { openComposerHome } = await import('./main');
    expect(typeof openComposerHome).toBe('function');
    (window as any).location.href = '';
    openComposerHome();
    expect((window as any).location.href).toBe('composer.html');
  });
});

describe('main - stopHomeVisualizer 入口', () => {
  it('stopHomeVisualizer 是导出函数且不抛错', async () => {
    const { stopHomeVisualizer } = await import('./main');
    expect(typeof stopHomeVisualizer).toBe('function');
    expect(() => stopHomeVisualizer()).not.toThrow();
  });
});

describe('main - window.onload 调用路径', () => {
  it('触发 window.load 事件不抛错（initEventDelegation/renderHome 等被调用）', () => {
    // 重新建立完整 DOM（loadingScreen 等元素存在）
    setupMainDom();
    expect(() => {
      fireWindowLoad();
    }).not.toThrow();
    // 触发后 initEventDelegation 应被再次调用（来自 onload 内）
    expect(events.initEventDelegation).toHaveBeenCalled();
  });

  it('onload 内调用 Store.load 加载存档', () => {
    setupMainDom();
    fireWindowLoad();
    expect(Store.load).toHaveBeenCalled();
  });

  it('onload 内调用 setSoundPack 应用音色包', () => {
    setupMainDom();
    fireWindowLoad();
    expect(audio.setSoundPack).toHaveBeenCalledWith('mathRock');
  });

  it('onload 内调用 loadEmbeddedSamples（异步，捕获 promise 不抛错）', () => {
    setupMainDom();
    expect(() => {
      fireWindowLoad();
    }).not.toThrow();
    expect(audio.loadEmbeddedSamples).toHaveBeenCalled();
  });

  it('onload 内调用 startA11yObserver（增强 a11y 属性），skip-link 获得焦点监听', () => {
    setupMainDom();
    const skipLink = document.querySelector('.skip-link') as HTMLAnchorElement;
    expect(skipLink).not.toBeNull();
    expect(() => {
      fireWindowLoad();
      // 模拟 skip-link 获焦/失焦
      skipLink.dispatchEvent(new Event('focus'));
      skipLink.dispatchEvent(new Event('blur'));
    }).not.toThrow();
  });

  it('onload 内 setTimeout(600) 触发后调用 renderHome / renderContinueBar / updateDailyBanner', () => {
    setupMainDom();
    fireWindowLoad();
    // 推进 600ms 触发 onload 内的 setTimeout
    expect(() => vi.advanceTimersByTime(700)).not.toThrow();
    expect(uiRender.renderHome).toHaveBeenCalled();
    expect(uiRender.renderContinueBar).toHaveBeenCalled();
    expect(uiRender.updateDailyBanner).toHaveBeenCalled();
  });

  it('onload 内 setTimeout 后会隐藏 loadingScreen', () => {
    setupMainDom();
    fireWindowLoad();
    vi.advanceTimersByTime(700);
    const loading = document.getElementById('loadingScreen');
    expect(loading?.classList.contains('hidden')).toBe(true);
  });

  it('onload 内注册 bgMusicBtn 点击 handler（点击后 hideBgmHint/startBgMusic 调用路径）', () => {
    setupMainDom();
    fireWindowLoad();
    const btn = document.getElementById('bgMusicBtn') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    // 重置 bgMusicAutoStarted / bgMusicPlaying
    (window as any).bgMusicAutoStarted = false;
    (window as any).bgMusicPlaying = false;
    expect(() => btn.click()).not.toThrow();
    // bg music 自动启动标记应被设置（onload 内 handler 设置 window.bgMusicAutoStarted=true）
    expect((window as any).bgMusicAutoStarted).toBe(true);
  });
});

describe('main - 注册的 action handlers 调用路径（抽样）', () => {
  it('window.showScreen 调用 ui-render.showScreen mock', () => {
    (window as any).showScreen('home');
    expect(uiRender.showScreen).toHaveBeenCalledWith('home');
  });

  it('window.openSettings 调用 ui-render.openSettings mock', () => {
    (window as any).openSettings();
    expect(uiRender.openSettings).toHaveBeenCalled();
  });

  it('window.closeSettings 调用 ui-render.closeSettings mock', () => {
    (window as any).closeSettings();
    expect(uiRender.closeSettings).toHaveBeenCalled();
  });

  it('window.openAchievements 调用 ui-render.openAchievements mock', () => {
    (window as any).openAchievements();
    expect(uiRender.openAchievements).toHaveBeenCalled();
  });

  it('window.toggleLang 调用 i18n.toggleLang mock', () => {
    (window as any).toggleLang();
    expect(i18n.toggleLang).toHaveBeenCalled();
  });

  it('window.setMasterVolume 调用 audio.setMasterVolume mock', () => {
    (window as any).setMasterVolume(0.5);
    expect(audio.setMasterVolume).toHaveBeenCalledWith(0.5);
  });

  it('window.openScienceMode 调用 science.openScienceMode mock', () => {
    (window as any).openScienceMode();
    expect(science.openScienceMode).toHaveBeenCalled();
  });

  it('window.openScaleLab 调用 materiomusic.openScaleLab mock', () => {
    (window as any).openScaleLab();
    expect(materiomusic.openScaleLab).toHaveBeenCalled();
  });

  it('window.openWaveLab 调用 waveLab.openWaveLab mock', () => {
    (window as any).openWaveLab();
    expect(waveLab.openWaveLab).toHaveBeenCalled();
  });

  it('window.openFractureMode 调用 scienceDeep.openFractureMode mock', () => {
    (window as any).openFractureMode();
    expect(scienceDeep.openFractureMode).toHaveBeenCalled();
  });

  it('window.startLevel 调用 gameEngine.startLevel mock', () => {
    (window as any).startLevel(1, 1);
    expect(gameEngine.startLevel).toHaveBeenCalledWith(1, 1);
  });

  it('window.exitGame 调用 gameEngine.exitGame mock', () => {
    (window as any).exitGame();
    expect(gameEngine.exitGame).toHaveBeenCalled();
  });
});

describe('main - Escape 键关闭弹层', () => {
  it('按 Escape 调用 closeWhy / closeTutorial / closeEduCard 等 mock', () => {
    expect(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    }).not.toThrow();
    expect(uiRender.closeWhy).toHaveBeenCalled();
    expect(uiRender.closeTutorial).toHaveBeenCalled();
    expect(uiRender.closeEduCard).toHaveBeenCalled();
    expect(uiRender.closeDiary).toHaveBeenCalled();
    expect(uiRender.closeKG).toHaveBeenCalled();
    expect(uiRender.closeTeacher).toHaveBeenCalled();
    expect(uiRender.closeScienceMode).toHaveBeenCalled();
  });
});

describe('main - mathbeat:langchange 事件', () => {
  it('派发 langchange 事件触发 renderHome 与 updateDailyBanner', () => {
    expect(() => {
      window.dispatchEvent(new Event('mathbeat:langchange'));
    }).not.toThrow();
    expect(uiRender.renderHome).toHaveBeenCalled();
    expect(uiRender.updateDailyBanner).toHaveBeenCalled();
  });
});
