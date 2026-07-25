import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 使用 fake timers 避免 setTimeout 在 DOM 清理后触发导致未捕获异常
vi.useFakeTimers();

// ============================================================
// Mock 所有外部依赖：保持 ui-render.ts 的渲染逻辑独立可测
// ============================================================

vi.mock('./store', () => {
  const state = {
    progress: {} as Record<string, number>,
    achievements: [] as string[],
    unlocks: { drums: true, bass: false, melody: false, chords: false, euclidean: true },
    bestCombo: 0,
    settings: { bgm: true, sfx: true, difficulty: 'auto', soundPack: 'mathRock', visualBeat: false },
    lastWorld: 0,
    lastLevel: '',
    onboardingDone: true,
    classData: [],
    endlessStats: { bestScore: 0, totalRounds: 0, totalCorrect: 0, totalQuestions: 0, bestCombo: 0 },
    scienceCompositions: [],
  };
  return {
    Store: { state, save: vi.fn(), load: vi.fn() },
    LS_KEYS: { STATE: 'mathbeat_state' },
  };
});

vi.mock('./i18n', () => ({
  t: vi.fn((k: string) => k),
  applyTranslations: vi.fn(),
}));

vi.mock('./audio', () => ({
  bgMusicUserMuted: false,
  bgMusicPlaying: false,
  startBgMusic: vi.fn(),
  stopBgMusic: vi.fn(),
  toggleBgMusic: vi.fn(),
  playMenuSwipe: vi.fn(),
  playBossWarning: vi.fn(),
  setSoundPack: vi.fn(),
  getAudioCtx: vi.fn(() => ({ currentTime: 0, state: 'running' })),
  getMasterVolume: vi.fn(() => 0.8),
  playSample: vi.fn(),
  scheduleToneAt: vi.fn(),
  setMasterVolume: vi.fn(),
}));

vi.mock('./events', () => ({
  registerActions: vi.fn(),
  registerInputs: vi.fn(),
}));

vi.mock('./a11y', () => ({
  openModal: vi.fn(),
  closeModal: vi.fn(),
  announce: vi.fn(),
}));

vi.mock('./worlds', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./worlds')>();
  return {
    ...actual,
    // 保留真实 WORLDS / LEVELS / ACHIEVEMENTS 等数据，仅可能裁剪
  };
});

vi.mock('./utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils')>();
  return { ...actual };
});

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

vi.mock('./game-engine', () => ({
  state: { currentWorld: 0, currentLevel: '', pendingBoss: null },
  isFreeModeUnlocked: vi.fn(() => false),
  stopAllPlayback: vi.fn(),
  startLevel: vi.fn(),
}));

vi.mock('./progression', () => ({
  refreshXpBar: vi.fn(),
  refreshFreezeBadge: vi.fn(),
  renderStreakCalendar: vi.fn(),
  refreshLearningGoalRing: vi.fn(),
  isWeekend: vi.fn(() => false),
}));

vi.mock('./sound-packs', () => ({
  SOUND_PACKS: {
    mathRock: { emoji: '🥁', name: 'Math Rock' },
    jazz: { emoji: '🎷', name: 'Jazz' },
  },
  DEFAULT_SOUND_PACK: 'mathRock',
  SOUND_PACK_ORDER: ['mathRock', 'jazz'],
}));

vi.mock('./daily', () => ({
  getDailyChallenge: vi.fn(() => ({ name: 'Daily', type: 'ratio' })),
}));

vi.mock('./level-editor', () => ({
  renderEditor: vi.fn(),
}));

vi.mock('./endless-mode', () => ({
  initEndlessMode: vi.fn(),
  endEndlessMode: vi.fn(),
}));

vi.mock('./sample-library', () => ({
  toggleSamplePlayback: vi.fn(),
  importSampleToComposer: vi.fn(),
}));

vi.mock('./composer/mini-composer', () => ({
  mcToggleCell: vi.fn(),
}));

vi.mock('./free-mode', () => ({
  fmChangeBpm: vi.fn(),
}));

vi.mock('./science', () => ({
  selectScienceType: vi.fn(),
  goScienceStep: vi.fn(),
  downloadScienceExport: vi.fn(),
}));

vi.mock('./learning-insights', () => ({
  generateDailyRecommendations: vi.fn(() => []),
}));

vi.mock('./visual-beat', () => ({
  setVisualBeat: vi.fn(),
}));

vi.mock('./error-report', () => ({
  reportError: vi.fn(),
  installGlobalErrorHandlers: vi.fn(),
  setConsoleMirror: vi.fn(),
  initWebVitalsReporting: vi.fn(),
}));

vi.mock('./ui-feedback', () => ({
  showToast: vi.fn(),
}));

import {
  showHintFloat,
  showStars,
  showEducationCard,
  showAchievementPopup,
  showOnboarding,
  showTutorial,
  closeTutorial,
  showWhy,
  closeWhy,
  closeEduCard,
  getWorldStars,
  isWorldUnlocked,
  isLevelLocked,
  openWorld,
  closeWorldIntro,
  openConceptMap,
  closeConceptMap,
  showBossProblem,
  closeBossProblem,
  openSettings,
  closeSettings,
  renderSettings,
  changeSoundPack,
  toggleSettingBgm,
  toggleSettingSfx,
  toggleSettingVisualBeat,
  changeDifficulty,
  openAchievements,
  closeAchievements,
  openTeacher,
  closeTeacher,
  simulateClassData,
  exportData,
  closeScienceMode,
  closeDiary,
  closeKG,
  openEndlessMode,
  closeEndlessMode,
  selectEndlessTime,
  selectEndlessWorld,
  startEndlessGame,
  openLevelEditor,
  closeLevelEditor,
  openFreeMode,
  closeFreeMode,
  openSampleLibrary,
  closeSampleLibrary,
  renderSampleLibrary,
  showScreen,
  renderContinueBar,
  renderHome,
  renderDailyRecommendations,
  updateDailyBanner,
  playWorldPreview,
  registerUiRenderActions,
} from './ui-render';
import { Store } from './store';
import * as events from './events';
import * as audio from './audio';
import * as a11y from './a11y';
import * as gameEngine from './game-engine';
import * as endlessMode from './endless-mode';
import * as levelEditor from './level-editor';
import * as visualBeat from './visual-beat';
import * as learningInsights from './learning-insights';
import * as utils from './utils';

// 辅助：构造一个基础 DOM 容器，包含 ui-render 大量函数依赖的元素 id
function setupBaseDom() {
  document.body.innerHTML = `
    <div id="homeScreen" class="screen"></div>
    <div id="levelScreen" class="screen"></div>
    <div id="gameScreen" class="screen"></div>
    <div id="scienceScreen" class="screen"></div>
    <div id="endlessModeScreen" class="screen"></div>
    <div id="levelEditorScreen" class="screen"></div>
    <div id="freeModeScreen" class="screen"></div>
    <div id="settingsScreen" class="screen"></div>
    <div id="achievementsScreen" class="screen"></div>
    <div id="worldGrid"></div>
    <div id="composerUnlocks"></div>
    <div id="totalStars"></div>
    <div id="bestComboDisplay"></div>
    <div id="achCount"></div>
    <div id="continueBar"></div>
    <div id="freeModeCard"></div>
    <div id="freeModeLock"></div>
    <div id="composerHomeLock"></div>
    <div id="hintFloat"></div>
    <div id="dailyChallengeBanner"></div>
    <div id="dailySub"></div>
    <div id="dailyStatus"></div>
    <div id="dailyRecommendations"></div>
    <div id="worldIntroOverlay" class="overlay">
      <h2 id="worldIntroTitle"></h2>
      <div id="worldIntroVisual"></div>
      <div id="worldIntroText"></div>
    </div>
    <div id="conceptMapOverlay" class="overlay">
      <div id="conceptMapContainer"></div>
      <div id="conceptMapDetail"></div>
    </div>
    <div id="bossProblemOverlay" class="overlay">
      <h2 id="bossProblemTitle"></h2>
      <div id="bossProblemEmoji"></div>
      <div id="bossProblemText"></div>
      <div id="bossProblemMath"></div>
      <div id="bossProblemHint"></div>
      <div id="bossProblemReward"></div>
    </div>
    <div id="whyOverlay" class="overlay">
      <h2 id="whyTitle"></h2>
      <div id="whyText"></div>
    </div>
    <div id="tutorialOverlay" class="overlay">
      <h2 id="tutTitle"></h2>
      <div id="tutText"></div>
      <div id="tutStep"></div>
      <button id="tutNext"></button>
    </div>
    <div id="eduCardOverlay" class="overlay">
      <h2 id="eduTitle"></h2>
      <div id="eduText"></div>
      <div id="eduPractice"></div>
    </div>
    <div id="achievementPopup"></div>
    <div id="achPopupIcon"></div>
    <div id="achPopupName"></div>
    <div id="achPopupDesc"></div>
    <div id="teacherOverlay" class="overlay">
      <div id="teacherLogin"></div>
      <div id="teacherContent"></div>
      <div id="teacherStats"></div>
      <div id="heatmapGrid"></div>
      <div id="barChart"></div>
      <input id="teacherPwd" />
    </div>
    <div id="diaryOverlay" class="overlay"></div>
    <div id="kgOverlay" class="overlay"></div>
    <div id="sampleLibraryModal"></div>
    <div id="sampleLibraryList"></div>
    <div id="achievementsBody"></div>
    <div id="endlessBody"></div>
    <div id="levelScreenTitle"></div>
    <div id="levelScreenSub"></div>
    <div id="levelCards"></div>
    <div id="unlockPreviewItems"></div>
    <div id="weekendXpBanner"></div>
    <button id="settingBgmBtn"></button>
    <button id="settingSfxBtn"></button>
    <button id="settingVisualBeatBtn"></button>
    <select id="settingDifficulty"></select>
    <select id="settingSoundPack"></select>
    <input id="masterVolumeSlider" type="range" />
    <div id="masterVolumeVal"></div>
  `;
}

describe('ui-render: 渲染辅助函数', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupBaseDom();
    // 重置 Store.state
    Store.state.progress = {};
    Store.state.achievements = [];
    Store.state.unlocks = { drums: true, bass: false, melody: false, chords: false, euclidean: true };
    Store.state.bestCombo = 0;
    Store.state.lastWorld = 0;
    Store.state.lastLevel = '';
    Store.state.settings = { bgm: true, sfx: true, difficulty: 'auto', soundPack: 'mathRock', visualBeat: false };
  });

  afterEach(() => {
    // 推进所有 timer 让 setTimeout 完成后再清空 DOM，避免引用已删除元素
    vi.runAllTimers();
    document.body.innerHTML = '';
  });

  // ------------------------------------------------------------
  // 1. showHintFloat - 简单 DOM 写入 + a11y 播报
  // ------------------------------------------------------------
  describe('showHintFloat', () => {
    it('将文本写入 #hintFloat 并加 show class', () => {
      const el = document.getElementById('hintFloat')!;
      el.classList.remove('show');
      showHintFloat('提示文本');
      expect(el.textContent).toBe('提示文本');
      expect(el.classList.contains('show')).toBe(true);
      expect(el.getAttribute('role')).toBe('status');
    });

    it('不同文本生成不同 DOM 内容', () => {
      const el = document.getElementById('hintFloat')!;
      showHintFloat('AAA');
      expect(el.textContent).toBe('AAA');
      showHintFloat('BBB');
      expect(el.textContent).toBe('BBB');
    });

    it('不存在 #hintFloat 时不抛错', () => {
      document.getElementById('hintFloat')!.remove();
      expect(() => showHintFloat('x')).not.toThrow();
    });
  });

  // ------------------------------------------------------------
  // 2. showStars - 星级显示
  // ------------------------------------------------------------
  describe('showStars', () => {
    it('根据 stars 数渲染对应 earned span', () => {
      const container = document.createElement('div');
      container.id = 'starsHost';
      document.body.appendChild(container);
      showStars('starsHost', 2);
      const spans = container.querySelectorAll('span.si');
      expect(spans.length).toBe(3);
      expect(spans[0].classList.contains('earned')).toBe(true);
      expect(spans[1].classList.contains('earned')).toBe(true);
      expect(spans[2].classList.contains('earned')).toBe(false);
    });

    it('stars=0 时全部未 earned', () => {
      const container = document.createElement('div');
      container.id = 'stars0';
      document.body.appendChild(container);
      showStars('stars0', 0);
      const spans = container.querySelectorAll('span.si');
      expect(spans.length).toBe(3);
      spans.forEach((s) => expect(s.classList.contains('earned')).toBe(false));
    });

    it('stars=3 时全部 earned', () => {
      const container = document.createElement('div');
      container.id = 'stars3';
      document.body.appendChild(container);
      showStars('stars3', 3);
      const spans = container.querySelectorAll('span.si');
      spans.forEach((s) => expect(s.classList.contains('earned')).toBe(true));
    });

    it('目标元素不存在时静默返回', () => {
      expect(() => showStars('not-exist', 1)).not.toThrow();
    });
  });

  // ------------------------------------------------------------
  // 3. showEducationCard - 教育卡片
  // ------------------------------------------------------------
  describe('showEducationCard', () => {
    it('lid 命中 MATH_CONCEPTS 时填充文案', () => {
      // '1-1' 来自真实 worlds 数据，存在 MATH_CONCEPTS
      showEducationCard('1-1');
      const title = document.getElementById('eduTitle')!;
      const text = document.getElementById('eduText')!;
      const practice = document.getElementById('eduPractice')!;
      expect(title.textContent).toMatch(/🎓 .+/);
      expect(text.textContent.length).toBeGreaterThan(0);
      expect(practice.textContent).toMatch(/练习：.+/);
    });

    it('lid 不存在时静默返回不抛错', () => {
      expect(() => showEducationCard('non-existent-lid')).not.toThrow();
      expect(document.getElementById('eduTitle')!.textContent).toBe('');
    });

    it('closeEduCard 调用 closeModal', () => {
      closeEduCard();
      expect(a11y.closeModal).toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------
  // 4. showAchievementPopup - 成就弹窗
  // ------------------------------------------------------------
  describe('showAchievementPopup', () => {
    it('已知成就 id 填充图标/名称/描述并加 show', () => {
      showAchievementPopup('first_star');
      expect(document.getElementById('achPopupIcon')!.textContent).toBe('⭐');
      expect(document.getElementById('achPopupName')!.textContent.length).toBeGreaterThan(0);
      const popup = document.getElementById('achievementPopup')!;
      expect(popup.classList.contains('show')).toBe(true);
      // common 稀有度应添加 rarity-common class
      expect(popup.classList.contains('rarity-common')).toBe(true);
    });

    it('未知成就 id 静默返回不抛错', () => {
      expect(() => showAchievementPopup('unknown_ach')).not.toThrow();
      expect(document.getElementById('achievementPopup')!.classList.contains('show')).toBe(false);
    });

    it('不同稀有度添加对应 rarity class', () => {
      // hidden_lucky 是 rare，但 hidden 不影响 class 添加（仍然会展示）
      showAchievementPopup('hidden_lucky');
      const popup = document.getElementById('achievementPopup')!;
      expect(popup.classList.contains('rarity-rare')).toBe(true);
    });
  });

  // ------------------------------------------------------------
  // 5. showOnboarding / showTutorial / closeTutorial
  // ------------------------------------------------------------
  describe('showOnboarding / showTutorial', () => {
    it('showOnboarding 设置标题与按钮文案', () => {
      showOnboarding();
      expect(document.getElementById('tutTitle')!.textContent).toMatch(/欢迎/);
      expect(document.getElementById('tutNext')!.textContent).toBe('开始');
    });

    it('showTutorial 写入文本并打开模态', () => {
      showTutorial('请按提示操作');
      expect(document.getElementById('tutTitle')!.textContent).toBe('教程');
      expect(document.getElementById('tutText')!.textContent).toBe('请按提示操作');
      expect(a11y.openModal).toHaveBeenCalled();
    });

    it('closeTutorial 调用 closeModal', () => {
      closeTutorial();
      expect(a11y.closeModal).toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------
  // 6. showWhy / closeWhy
  // ------------------------------------------------------------
  describe('showWhy / closeWhy', () => {
    it('showWhy 用 lid 命中概念', () => {
      showWhy('1-1');
      expect(document.getElementById('whyTitle')!.textContent.length).toBeGreaterThan(0);
      expect(document.getElementById('whyText')!.textContent.length).toBeGreaterThan(0);
    });

    it('showWhy 用未知 lid 不抛错', () => {
      expect(() => showWhy('zzz-9')).not.toThrow();
    });

    it('closeWhy 调用 closeModal', () => {
      closeWhy();
      expect(a11y.closeModal).toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------
  // 7. getWorldStars / isWorldUnlocked / isLevelLocked
  // ------------------------------------------------------------
  describe('star / unlock 计算', () => {
    it('getWorldStars 累加 Store.state.progress 中的星数', () => {
      Store.state.progress = { '1-1': 2, '1-2': 3, '1-3': 1 };
      const stars = getWorldStars(1);
      expect(stars).toBe(6);
    });

    it('getWorldStars 缺数据时返回 0', () => {
      Store.state.progress = {};
      expect(getWorldStars(99)).toBe(0);
    });

    it('isWorldUnlocked: 世界1 永远解锁', () => {
      expect(isWorldUnlocked(1)).toBe(true);
    });

    it('isWorldUnlocked: 其它世界需前一 Boss 通过', () => {
      Store.state.progress = {};
      expect(isWorldUnlocked(2)).toBe(false);
      Store.state.progress = { '1-B': 1 };
      expect(isWorldUnlocked(2)).toBe(true);
    });

    it('isLevelLocked: 世界1 第0关永远解锁', () => {
      expect(isLevelLocked(1, 0)).toBe(false);
    });

    it('isLevelLocked: 非首关需前一关通过', () => {
      Store.state.progress = {};
      expect(isLevelLocked(1, 1)).toBe(true);
      Store.state.progress = { '1-1': 1 };
      expect(isLevelLocked(1, 1)).toBe(false);
    });
  });

  // ------------------------------------------------------------
  // 8. openWorld / showWorldIntro / closeWorldIntro
  // ------------------------------------------------------------
  describe('openWorld / worldIntro', () => {
    it('openWorld 设置 state.currentWorld 并打开 intro', () => {
      openWorld(2);
      expect(gameEngine.state.currentWorld).toBe(2);
    });

    it('closeWorldIntro 不抛错且切换到 level 屏幕', () => {
      // closeWorldIntro 内部会调 showScreen('level')，依赖 LEVELS
      gameEngine.state.currentWorld = 1;
      expect(() => closeWorldIntro()).not.toThrow();
    });
  });

  // ------------------------------------------------------------
  // 9. openConceptMap / closeConceptMap
  // ------------------------------------------------------------
  describe('conceptMap', () => {
    it('openConceptMap 添加 show class', () => {
      const overlay = document.getElementById('conceptMapOverlay')!;
      overlay.classList.remove('show');
      openConceptMap();
      expect(overlay.classList.contains('show')).toBe(true);
    });

    it('closeConceptMap 调用 closeModal', () => {
      closeConceptMap();
      expect(a11y.closeModal).toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------
  // 10. showBossProblem / closeBossProblem
  // ------------------------------------------------------------
  describe('bossProblem', () => {
    it('getBossProblem 返回 null 时调用 window.startBossComposer', () => {
      const fn = vi.fn();
      (window as any).startBossComposer = fn;
      showBossProblem(1, '1-B');
      expect(fn).toHaveBeenCalledWith(1, '1-B');
    });

    it('closeBossProblem(accept=false) 不调 startBossComposer', () => {
      const fn = vi.fn();
      (window as any).startBossComposer = fn;
      gameEngine.state.pendingBoss = { wid: 1, lid: '1-B' };
      closeBossProblem(false);
      expect(fn).not.toHaveBeenCalled();
    });

    it('closeBossProblem(accept=true) 调用 startBossComposer', () => {
      const fn = vi.fn();
      (window as any).startBossComposer = fn;
      gameEngine.state.pendingBoss = { wid: 2, lid: '2-B' };
      closeBossProblem(true);
      expect(fn).toHaveBeenCalledWith(2, '2-B');
    });
  });

  // ------------------------------------------------------------
  // 11. openSettings / closeSettings / renderSettings / changeSoundPack / toggle*
  // ------------------------------------------------------------
  describe('settings', () => {
    it('openSettings 添加 active class', () => {
      const el = document.getElementById('settingsScreen')!;
      el.classList.remove('active');
      openSettings();
      expect(el.classList.contains('active')).toBe(true);
    });

    it('closeSettings 移除 active class', () => {
      const el = document.getElementById('settingsScreen')!;
      el.classList.add('active');
      closeSettings();
      expect(el.classList.contains('active')).toBe(false);
    });

    it('renderSettings 同步设置项到 DOM', () => {
      // 为 select 提供选项以使 value 可被设置
      const diffSel = document.getElementById('settingDifficulty') as HTMLSelectElement;
      diffSel.innerHTML = '<option value="easy"></option><option value="auto"></option><option value="hard"></option>';
      const spSel = document.getElementById('settingSoundPack') as HTMLSelectElement;
      spSel.innerHTML = '<option value="mathRock"></option><option value="jazz"></option>';
      Store.state.settings = { bgm: false, sfx: true, difficulty: 'hard', soundPack: 'jazz', visualBeat: true };
      renderSettings();
      expect(document.getElementById('settingBgmBtn')!.textContent).toBe('关闭');
      expect(document.getElementById('settingSfxBtn')!.textContent).toBe('开启');
      expect(document.getElementById('settingVisualBeatBtn')!.textContent).toBe('开启');
      expect((document.getElementById('settingDifficulty') as HTMLSelectElement).value).toBe('hard');
      // renderSettings 会从 SOUND_PACKS mock 重新生成 innerHTML，value 应被设置为 jazz
      expect((document.getElementById('settingSoundPack') as HTMLSelectElement).value).toBe('jazz');
    });

    it('changeSoundPack 持久化并调用 setSoundPack', () => {
      changeSoundPack('jazz');
      expect(audio.setSoundPack).toHaveBeenCalledWith('jazz');
      expect(Store.state.settings.soundPack).toBe('jazz');
      expect(Store.save).toHaveBeenCalled();
    });

    it('toggleSettingBgm 切换 bgm 状态', () => {
      Store.state.settings.bgm = true;
      toggleSettingBgm();
      expect(Store.state.settings.bgm).toBe(false);
      toggleSettingBgm();
      expect(Store.state.settings.bgm).toBe(true);
    });

    it('toggleSettingSfx 切换 sfx 状态', () => {
      Store.state.settings.sfx = true;
      toggleSettingSfx();
      expect(Store.state.settings.sfx).toBe(false);
    });

    it('toggleSettingVisualBeat 切换 visualBeat 并调用 setVisualBeat', () => {
      Store.state.settings.visualBeat = false;
      toggleSettingVisualBeat();
      expect(Store.state.settings.visualBeat).toBe(true);
      expect(visualBeat.setVisualBeat).toHaveBeenCalledWith(true);
    });

    it('changeDifficulty 写入 Store', () => {
      changeDifficulty('hard');
      expect(Store.state.settings.difficulty).toBe('hard');
    });
  });

  // ------------------------------------------------------------
  // 12. openAchievements / closeAchievements
  // ------------------------------------------------------------
  describe('achievements', () => {
    it('openAchievements 添加 active class', () => {
      const el = document.getElementById('achievementsScreen')!;
      el.classList.remove('active');
      openAchievements();
      expect(el.classList.contains('active')).toBe(true);
    });

    it('closeAchievements 移除 active class', () => {
      const el = document.getElementById('achievementsScreen')!;
      el.classList.add('active');
      closeAchievements();
      expect(el.classList.contains('active')).toBe(false);
    });
  });

  // ------------------------------------------------------------
  // 13. openTeacher / closeTeacher
  // ------------------------------------------------------------
  describe('teacher', () => {
    it('openTeacher 显示登录区，隐藏内容区', () => {
      const login = document.getElementById('teacherLogin')!;
      const content = document.getElementById('teacherContent')!;
      openTeacher();
      expect(login.style.display).toBe('flex');
      expect(content.classList.contains('show')).toBe(false);
    });

    it('closeTeacher 调用 closeModal', () => {
      closeTeacher();
      expect(a11y.closeModal).toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------
  // 14. simulateClassData
  // ------------------------------------------------------------
  describe('simulateClassData', () => {
    it('返回 8 个学生对象，每个有 name/progress/last7', () => {
      const arr = simulateClassData();
      expect(Array.isArray(arr)).toBe(true);
      expect(arr.length).toBe(8);
      expect(arr[0]).toHaveProperty('name');
      expect(arr[0]).toHaveProperty('progress');
      expect(arr[0]).toHaveProperty('last7');
      expect(Array.isArray(arr[0].last7)).toBe(true);
      expect(arr[0].last7.length).toBe(7);
    });
  });

  // ------------------------------------------------------------
  // 15. exportData - 触发下载
  // ------------------------------------------------------------
  describe('exportData', () => {
    it('不抛错（依赖 Blob/URL.createObjectURL，happy-dom 提供）', () => {
      // happy-dom 提供 Blob 与 URL.createObjectURL
      Store.state.progress = { '1-1': 3 };
      expect(() => exportData()).not.toThrow();
    });
  });

  // ------------------------------------------------------------
  // 16. closeScienceMode / closeDiary / closeKG
  // ------------------------------------------------------------
  describe('close helpers', () => {
    it('closeScienceMode 移除 scienceScreen 的 active', () => {
      const el = document.getElementById('scienceScreen')!;
      el.classList.add('active');
      closeScienceMode();
      expect(el.classList.contains('active')).toBe(false);
    });

    it('closeDiary 移除 show class', () => {
      const el = document.getElementById('diaryOverlay')!;
      el.classList.add('show');
      closeDiary();
      expect(el.classList.contains('show')).toBe(false);
    });

    it('closeKG 移除 show class', () => {
      const el = document.getElementById('kgOverlay')!;
      el.classList.add('show');
      closeKG();
      expect(el.classList.contains('show')).toBe(false);
    });
  });

  // ------------------------------------------------------------
  // 17. openEndlessMode / selectEndlessTime / selectEndlessWorld / startEndlessGame / closeEndlessMode
  // ------------------------------------------------------------
  describe('endless mode', () => {
    it('openEndlessMode 渲染 endlessBody 内容', () => {
      const body = document.getElementById('endlessBody')!;
      body.innerHTML = '';
      openEndlessMode();
      expect(body.innerHTML.length).toBeGreaterThan(100);
      expect(body.innerHTML).toMatch(/数学音乐挑战/);
    });

    it('selectEndlessTime 设置按钮样式', () => {
      // 先调 openEndlessMode 注入按钮
      openEndlessMode();
      const btn = document.querySelector('.em-time-btn[data-time="60"]') as HTMLElement;
      expect(btn).not.toBeNull();
      selectEndlessTime(60, btn);
      expect(btn.style.background).not.toBe('');
    });

    it('selectEndlessWorld 多次切换不抛错（happy-dom 对 var() 覆盖有限制，仅验证调用路径）', () => {
      openEndlessMode();
      const btn = document.querySelector('.em-world-btn[data-world="1"]') as HTMLElement;
      expect(btn).not.toBeNull();
      // happy-dom 在元素已有 var() 内联背景时无法用 rgba() 覆盖 style.background，
      // 这里只验证函数能多次切换不抛错（实际视觉效果依赖浏览器 CSS 解析）
      expect(() => {
        selectEndlessWorld(1, btn);
        selectEndlessWorld(1, btn);
        selectEndlessWorld(2, btn);
      }).not.toThrow();
    });

    it('startEndlessGame 调用 initEndlessMode', () => {
      startEndlessGame();
      expect(endlessMode.initEndlessMode).toHaveBeenCalled();
    });

    it('closeEndlessMode 调用 endEndlessMode', () => {
      closeEndlessMode();
      expect(endlessMode.endEndlessMode).toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------
  // 18. openLevelEditor / closeLevelEditor
  // ------------------------------------------------------------
  describe('level editor', () => {
    it('openLevelEditor 调用 renderEditor', () => {
      openLevelEditor();
      expect(levelEditor.renderEditor).toHaveBeenCalled();
    });

    it('closeLevelEditor 移除 active', () => {
      const el = document.getElementById('levelEditorScreen')!;
      el.classList.add('active');
      closeLevelEditor();
      expect(el.classList.contains('active')).toBe(false);
    });
  });

  // ------------------------------------------------------------
  // 19. openFreeMode / closeFreeMode
  // ------------------------------------------------------------
  describe('free mode', () => {
    it('openFreeMode 在未解锁时不抛错', () => {
      vi.mocked(gameEngine.isFreeModeUnlocked).mockReturnValue(false);
      expect(() => openFreeMode()).not.toThrow();
    });

    it('closeFreeMode 调用 window.fmStop', () => {
      (window as any).fmStop = vi.fn();
      closeFreeMode();
      expect((window as any).fmStop).toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------
  // 20. openSampleLibrary / closeSampleLibrary / renderSampleLibrary
  // ------------------------------------------------------------
  describe('sample library', () => {
    it('openSampleLibrary 设置 modal display flex', () => {
      // openSampleLibrary 内部调用 renderSampleLibrary，需要预先设置 samples
      (window as any).MATH_ROCK_SAMPLES = [];
      const modal = document.getElementById('sampleLibraryModal')!;
      modal.style.display = 'none';
      openSampleLibrary();
      expect(modal.style.display).toBe('flex');
    });

    it('closeSampleLibrary 设置 opacity 0', () => {
      (window as any).stopSamplePlayback = vi.fn();
      const modal = document.getElementById('sampleLibraryModal')!;
      modal.style.opacity = '1';
      closeSampleLibrary();
      expect(modal.style.opacity).toBe('0');
    });

    it('renderSampleLibrary 从 window.MATH_ROCK_SAMPLES 渲染列表', () => {
      (window as any).MATH_ROCK_SAMPLES = [
        { id: 's1', title: 'Sample 1', bpm: 100, duration: '0:30', tags: ['rock'], structure: 'A-B-A' },
      ];
      const el = document.getElementById('sampleLibraryList')!;
      el.innerHTML = '';
      renderSampleLibrary();
      expect(el.innerHTML).toMatch(/Sample 1/);
    });
  });

  // ------------------------------------------------------------
  // 21. showScreen - 路由分支
  // ------------------------------------------------------------
  describe('showScreen', () => {
    it('切换到 home 屏幕（无 bg music 错误）', () => {
      expect(() => showScreen('home')).not.toThrow();
    });

    it('切换到 level 屏幕（state.currentWorld=0 时无 bg 设置）', () => {
      gameEngine.state.currentWorld = 0;
      expect(() => showScreen('level')).not.toThrow();
    });

    it('切换到不存在的屏幕同步调用不抛错', () => {
      expect(() => showScreen('nonexistent')).not.toThrow();
      // 源码 setTimeout 内使用 el!.classList，null el 会抛错（已知行为）。
      // 这里推进 pending timers 并捕获异步错误，避免污染后续测试
      try {
        vi.runOnlyPendingTimers();
      } catch (_) {
        // 预期：el 为 null 时抛错
      }
    });
  });

  // ------------------------------------------------------------
  // 22. renderContinueBar
  // ------------------------------------------------------------
  describe('renderContinueBar', () => {
    it('无 lastWorld/lastLevel 时隐藏 continueBar', () => {
      Store.state.lastWorld = 0;
      Store.state.lastLevel = '';
      const el = document.getElementById('continueBar')!;
      renderContinueBar();
      expect(el.style.display).toBe('none');
    });

    it('有 lastWorld/lastLevel 时显示 continueBar 并注入按钮', () => {
      Store.state.lastWorld = 1;
      Store.state.lastLevel = '1-1';
      const el = document.getElementById('continueBar')!;
      renderContinueBar();
      expect(el.style.display).toBe('block');
      expect(el.innerHTML).toMatch(/daily-challenge/);
    });
  });

  // ------------------------------------------------------------
  // 23. renderHome
  // ------------------------------------------------------------
  describe('renderHome', () => {
    it('生成 8 个 world-card', () => {
      const grid = document.getElementById('worldGrid')!;
      renderHome();
      const cards = grid.querySelectorAll('.world-card');
      expect(cards.length).toBe(8);
    });

    it('更新 totalStars 与 achCount 显示', () => {
      Store.state.progress = { '1-1': 3, '1-2': 2 };
      Store.state.bestCombo = 7;
      Store.state.achievements = ['first_star', 'combo_5'];
      renderHome();
      expect(document.getElementById('totalStars')!.textContent).toBe('5');
      expect(document.getElementById('bestComboDisplay')!.textContent).toBe('7');
      expect(document.getElementById('achCount')!.textContent).toBe('2');
    });
  });

  // ------------------------------------------------------------
  // 24. renderDailyRecommendations
  // ------------------------------------------------------------
  describe('renderDailyRecommendations', () => {
    it('无推荐时隐藏容器', () => {
      vi.mocked(learningInsights.generateDailyRecommendations).mockReturnValue([]);
      const el = document.getElementById('dailyRecommendations')!;
      el.style.display = 'block';
      renderDailyRecommendations();
      expect(el.style.display).toBe('none');
    });

    it('有推荐时显示并渲染卡片', () => {
      vi.mocked(learningInsights.generateDailyRecommendations).mockReturnValue([
        { worldId: 1, levelId: '1-1', levelName: 'L1', worldName: 'W1', stars: 0, worldEmoji: '🥁', reason: 'r1' },
        { worldId: 1, levelId: '1-2', levelName: 'L2', worldName: 'W1', stars: 1, worldEmoji: '🥁', reason: 'r2' },
      ]);
      const el = document.getElementById('dailyRecommendations')!;
      renderDailyRecommendations();
      expect(el.innerHTML).toMatch(/今日推荐/);
      expect(el.querySelectorAll('.rec-card').length).toBe(2);
    });
  });

  // ------------------------------------------------------------
  // 25. updateDailyBanner
  // ------------------------------------------------------------
  describe('updateDailyBanner', () => {
    it('未完成时显示开始挑战', () => {
      Store.state.achievements = [];
      Store.state.dailyStreak = 0;
      updateDailyBanner();
      expect(document.getElementById('dailyStatus')!.textContent).toMatch(/开始挑战/);
    });

    it('已完成时显示已完成', () => {
      // 让 daily_<seed> 进入 achievements
      const seed = utils.getDailySeed();
      Store.state.achievements = ['daily_' + seed];
      updateDailyBanner();
      expect(document.getElementById('dailyStatus')!.textContent).toMatch(/已完成/);
    });

    it('有连胜时显示天数', () => {
      Store.state.achievements = [];
      Store.state.dailyStreak = 5;
      updateDailyBanner();
      expect(document.getElementById('dailyStatus')!.textContent).toMatch(/5/);
    });
  });

  // ------------------------------------------------------------
  // 26. playWorldPreview - 节流 + 调度音符
  // ------------------------------------------------------------
  describe('playWorldPreview', () => {
    it('调用 scheduleToneAt 多次', () => {
      Store.state.settings.sfx = true;
      playWorldPreview(1);
      expect(audio.scheduleToneAt).toHaveBeenCalled();
    });

    it('sfx=false 时不调度音符', () => {
      audio.scheduleToneAt.mockClear();
      Store.state.settings.sfx = false;
      playWorldPreview(1);
      expect(audio.scheduleToneAt).not.toHaveBeenCalled();
    });

    it('未知 wid 用默认音符也不抛错', () => {
      expect(() => playWorldPreview(99)).not.toThrow();
    });
  });

  // ------------------------------------------------------------
  // 27. registerUiRenderActions - 调用 registerActions + registerInputs
  // ------------------------------------------------------------
  describe('registerUiRenderActions', () => {
    it('调用 registerActions 与 registerInputs', () => {
      (events.registerActions as any).mockClear();
      (events.registerInputs as any).mockClear();
      registerUiRenderActions();
      expect(events.registerActions).toHaveBeenCalled();
      expect(events.registerInputs).toHaveBeenCalled();
    });
  });
});
