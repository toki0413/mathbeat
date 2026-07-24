import { toggleLang, applyTranslations, getLang, setLang, t } from './i18n';
import { idbGet, idbSet, idbDelete, migrateFromLocalStorage } from './storage';
import { SOUND_PACKS, DEFAULT_SOUND_PACK } from './sound-packs';
import { MATH_VISUALS, stopAllMathVisuals } from './math-visuals';
import { renderConceptMap, CONCEPT_NODES, getConceptConnections } from './concept-map';
import { getBossProblem } from './boss-problems';
import { initA11y, installModalKeyboardHandlers, announce } from './a11y';
import { installGlobalErrorHandlers, setConsoleMirror, reportError, initWebVitalsReporting } from './error-report';

import {
  Store,
  DEFAULT_STATE,
  LS_KEYS,
  validateSaveData,
  syncComposerUnlocks,
  importGameData,
  exportGameData,
  resetGameData,
} from './store';
import {
  WORLDS,
  LEVELS,
  CURRICULUM,
  ACHIEVEMENTS,
  WORLD_INTROS,
  MATH_CONCEPTS,
  LEVEL_TUTORIALS,
  LEVEL_HINTS,
  CONCEPT_TO_WORLD,
  NOTE_NAMES,
  NOTE_FREQS,
  SCALES,
  ROOT_SEMITONES,
} from './worlds';
import {
  escapeHtml,
  lcmCalc,
  gcdCalc,
  euclideanRhythm,
  arraysEqual,
  isPermutation,
  getDailySeed,
  dailyHash,
  midiToFreq,
  fibSequence,
  genFibonacci,
  genEuclidean,
  genPrime,
  genSymmetry,
  genRecursive,
  genFibonacciMelody,
  genSymmetricMelody,
  genSerialMelody,
} from './utils';
import {
  playSample,
  scheduleFallbackDrum,
  getAudioCtx,
  getMasterBus,
  scheduleKickAt,
  scheduleSnareAt,
  scheduleHihatAt,
  scheduleToneAt,
  playTone,
  playCorrect,
  playWrong,
  startBgMusic,
  stopBgMusic,
  toggleBgMusic,
  hideBgmHint,
  showBgmHint,
  EMBEDDED_SAMPLES,
  sampleBuffers,
  loadEmbeddedSamples,
  bgMusicUserMuted,
  setSoundPack,
  setMasterVolume,
  getAnalyser,
} from './audio';
import {
  renderHome,
  renderContinueBar,
  showScreen,
  renderAchievements,
  renderSampleLibrary,
  openSampleLibrary,
  closeSampleLibrary,
  openAchievements,
  closeAchievements,
  openSettings,
  closeSettings,
  renderSettings,
  showWorldIntro,
  closeWorldIntro,
  openConceptMap,
  closeConceptMap,
  showBossProblem,
  closeBossProblem,
  showWhy,
  closeWhy,
  showTutorial,
  closeTutorial,
  showOnboarding,
  showEducationCard,
  closeEduCard,
  showHintFloat,
  showAchievementPopup,
  showStars,
  openTeacher,
  closeTeacher,
  teacherLogin,
  renderTeacher,
  simulateClassData,
  exportData,
  closeScienceMode,
  updateDailyBanner,
  openFreeMode,
  closeFreeMode,
  closeDiary,
  closeKG,
  openEndlessMode,
  closeEndlessMode,
  openLevelEditor,
  closeLevelEditor,
  changeDifficulty,
  changeSoundPack,
  toggleSettingBgm,
  toggleSettingSfx,
  toggleSettingVisualBeat,
  registerUiRenderActions,
} from './ui-render';
import {
  state,
  getAdaptiveDifficulty,
  recordAdaptive,
  syncComposerAchievements,
  checkAchievements,
  updateLeaderboard,
  startLevel,
  exitGame,
  nextLevel,
  completeLevel,
  useHint,
  stopAllPlayback,
  isFreeModeUnlocked,
  renderGame,
  bumpInteraction,
  restartLevel,
  toggleGamePause,
} from './game-engine';
// TODO(code-splitting): worlds-bundle 约 328KB 全静态 import，路由级代码分割缺失。
// 本次未改为动态 import 以避免破坏 8 个 world 渲染函数的多处引用，后续需重构为
// 按需加载（showScreen 切屏时动态 import 对应 world 模块）。
import { renderWorld1 } from './worlds/world1';
import { renderWorld2 } from './worlds/world2';
import { renderWorld3 } from './worlds/world3';
import { renderWorld4 } from './worlds/world4';
import { renderWorld5, w5DegreeName } from './worlds/world5';
import { renderWorld6 } from './worlds/world6';
import { renderWorld7 } from './worlds/world7';
import { renderWorld8 } from './worlds/world8';
import {
  getDailyChallenge,
  dailyState,
  startDailyChallenge,
  renderDailyModal,
  renderDailyRing,
  dailyRingToggle,
  dailyRatioChange,
  dailyRatioPlay,
  renderDailyEuclidGrid,
  dailyEuclidToggle,
  dailyEuclidApply,
  closeDailyModal,
  toggleDailyPlay,
  stopDailyPlay,
  checkDailyAnswer,
  dailyPermAnswer,
  dailyGraphAnswer,
  showDailyFeedback,
  dailyChallengeSuccess,
  updateDailyStreak,
  getWeekKey,
  showDailyWhy,
  updateDailyBanner as updateDailyBannerFromDaily,
} from './daily';
import {
  SCIENCE_SAMPLES,
  SCIENCE_REAL_SAMPLES,
  SCIENCE_SCHEMA,
  SCIENCE_TYPE_NAMES,
  SCIENCE_MAPPINGS,
  SCIENCE_OPTIONS,
  scienceState as scienceStateModule,
  openScienceMode,
  goScienceStep,
  updateScienceTypeUI,
  renderScienceData,
  renderScienceVisualizer,
  renderScienceCompositionList as renderScienceCompositionListFromScience,
  loadScienceSample,
  handleScienceFile,
  parseScienceTextComplete,
  parseScienceCSV,
  parseScienceText,
  selectScienceType,
  toggleScienceMapping,
  updateScienceOption,
  toggleSciencePlay,
  regenerateScienceMusic,
  saveScienceComposition,
  loadScienceComposition,
  deleteScienceComposition,
  openComposerWithScience,
  shareScience,
  toggleScienceWhyPanel,
  downloadScienceExport,
} from './science';
import {
  initEndlessMode,
  nextRound,
  submitAnswer,
  playMelody,
  getEndlessState,
  showEndlessHint,
  endEndlessMode,
} from './endless-mode';
import {
  renderEditor,
  changeEditorWorld,
  saveCustomLevel,
  deleteCustomLevel,
  playCustomLevel,
  exportCustomLevel,
  exportCustomLevelById,
  importCustomLevel,
  previewCustomLevel,
} from './level-editor';

import {
  spawnParticles,
  spawnParticlesAtElement,
  spawnCorrectParticles,
  spawnComboParticles,
  spawnConfetti,
  animateParticles,
  showSuccessToast,
  showErrorToast,
} from './fx/particles';
import {
  startBossComposer,
  exitMiniComposer,
  mcRenderTracks,
  mcToggleCell,
  mcApplyGen,
  mcTogglePlay,
  mcStart,
  mcStop,
  mcReset,
  mcFinish,
} from './composer/mini-composer';
import { fmInit, fmRenderTracks, fmToggleCell, fmPlay, fmStop, fmTogglePlay, fmReset, fmChangeBpm } from './free-mode';
import {
  MATH_ROCK_SAMPLES,
  REAL_MATH_ROCK_SAMPLES,
  getSampleComposition,
  toggleSamplePlayback,
  playSampleComposition,
  stopSamplePlayback,
  importSampleToComposer,
} from './sample-library';

import * as audio from './audio';
import * as uiRender from './ui-render';
import * as gameEngine from './game-engine';
import * as dailyModule from './daily';
import * as scienceModule from './science';
import * as scienceDeep from './science-deep';
import * as materiomusic from './materiomusic';
import * as waveLab from './wave-lab';
import * as utils from './utils';
import * as world1 from './worlds/world1';
import * as world2 from './worlds/world2';
import * as world3 from './worlds/world3';
import * as world4 from './worlds/world4';
import * as world5 from './worlds/world5';
import * as world6 from './worlds/world6';
import * as world7 from './worlds/world7';
import * as world8 from './worlds/world8';
import * as conceptMap from './concept-map';
import * as bossProblems from './boss-problems';
import * as mathVisuals from './math-visuals';
import * as soundPacks from './sound-packs';
import * as store from './store';
import * as i18nModule from './i18n';
import * as storage from './storage';
import * as endlessModule from './endless-mode';
import * as levelEditorModule from './level-editor';
import * as progressionModule from './progression';
import * as practiceModeModule from './practice-mode';
import * as learningInsightsModule from './learning-insights';
import { refreshXpBar, refreshFreezeBadge } from './progression';
import { registerActions, initEventDelegation } from './events';
import { setVisualBeat } from './visual-beat';

declare global {
  interface Window {
    bgMusicAutoStarted: boolean;
    bgMusicUserMuted: boolean;
    bgMusicPlaying: boolean;
  }
}

/* bg music auto-start */
function tryStartBgOnce() {
  if (!window.bgMusicAutoStarted && !window.bgMusicUserMuted && Store.state.settings.bgm !== false) {
    window.bgMusicAutoStarted = true;
    hideBgmHint();
    try {
      const a = getAudioCtx();
      if (a && a.state === 'suspended') a.resume();
      startBgMusic();
    } catch (e) {}
  }
}

/* ===== INIT ===== */

/* Accessibility enhancement: make non-native [data-action] elements keyboard-
 * focusable, give them role=button, and label emoji/symbol-only controls so
 * screen-reader users can operate the app without a pointer (WCAG 2.1/4.1).
 * Runs once and via a MutationObserver for dynamically rendered screens. */
const A11Y_ACTION_LABELS: Record<string, string> = {
  back: '返回',
  closeScaleLab: '返回',
  closeProteinMode: '返回',
  closeWebMode: '返回',
  w1TogglePlay: '播放或暂停',
  w1Reset: '重置',
  w1Verify: '验证',
  nextLevel: '下一关',
  showHome: '返回首页',
  openScienceMode: '打开科学之声',
  openScaleLab: '打开音阶实验室',
  openProteinMode: '打开蛋白质声化',
  openWebMode: '打开蜘蛛网声化',
  openWaveLab: '打开谐波实验室',
  closeWaveLab: '返回',
  wlTogglePlay: '播放或暂停谐波',
  wlPreset: '应用波形预设',
  wlChallenge: '开始猜波形挑战',
  wlVerifyChallenge: '验证挑战',
};

function labelForAction(el: HTMLElement): string | null {
  const action = el.dataset.action || '';
  if (A11Y_ACTION_LABELS[action]) return A11Y_ACTION_LABELS[action];
  const text = (el.textContent || '').trim();
  // Emoji / single-symbol-only controls need a textual label.
  if (text && text.length <= 3 && /[^\u4e00-\u9fa5a-zA-Z0-9]/.test(text)) {
    return action || text;
  }
  return null;
}

function enhanceA11y(root: ParentNode) {
  const nodes = root.querySelectorAll<HTMLElement>('[data-action]:not([data-a11y])');
  nodes.forEach((el) => {
    el.setAttribute('data-a11y', '1');
    const tag = el.tagName;
    if (tag !== 'BUTTON' && tag !== 'A' && tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') {
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
      if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
    }
    const label = labelForAction(el);
    if (label && !el.hasAttribute('aria-label')) el.setAttribute('aria-label', label);
  });
  // Decorative canvases should be hidden from assistive tech.
  root.querySelectorAll('canvas:not([aria-hidden])').forEach((c) => c.setAttribute('aria-hidden', 'true'));
}

function startA11yObserver() {
  if (typeof MutationObserver === 'undefined') return;
  enhanceA11y(document.body);
  let a11yDebounce: ReturnType<typeof setTimeout> | null = null;
  const obs = new MutationObserver(() => {
    if (a11yDebounce) clearTimeout(a11yDebounce);
    a11yDebounce = setTimeout(() => enhanceA11y(document.body), 50);
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

let homeVizRunning = false;
let homeVizLastActive = 0;

/* 停止首页可视化器的 RAF/setTimeout 循环，供切屏/卸载时调用 */
export function stopHomeVisualizer() {
  homeVizRunning = false;
}

function startHomeVisualizer() {
  const canvas = document.getElementById('homeVisualizer') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const analyser = getAnalyser();
  if (!analyser) return;
  const data = new Uint8Array(analyser.frequencyBinCount);
  homeVizRunning = true;
  homeVizLastActive = Date.now();

  function draw() {
    if (!homeVizRunning) return;
    const active = !!document.getElementById('homeScreen')?.classList.contains('active');
    if (active) {
      homeVizLastActive = Date.now();
      requestAnimationFrame(draw);
      analyser!.getByteFrequencyData(data);
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      const bars = 32;
      const barW = canvas!.width / bars;
      for (let i = 0; i < bars; i++) {
        const idx = Math.floor((i / bars) * (data.length / 2));
        const h = (data[idx] / 255) * canvas!.height;
        const hue = 20 + (i / bars) * 160;
        ctx!.fillStyle = 'hsla(' + hue + ', 80%, 60%, 0.75)';
        ctx!.fillRect(i * barW + 1, canvas!.height - h, barW - 2, h);
      }
    } else {
      // 不在首页时降低刷新频率；超过 10 秒未活跃则完全停止以释放 CPU/GPU
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      if (Date.now() - homeVizLastActive > 10000) {
        homeVizRunning = false;
        return;
      }
      setTimeout(draw, 300);
    }
  }
  draw();
}

window.onload = function () {
  // 初始化全局错误捕获与 a11y 基础设施（必须在所有其他逻辑之前）
  try {
    installGlobalErrorHandlers();
    // 开发环境镜像错误到 console，便于调试
    if (import.meta.env && import.meta.env.DEV) setConsoleMirror(true);
    initA11y();
    installModalKeyboardHandlers();
    // file:// 协议提示（原 index.html 内联 <script>，为收紧 CSP 迁移至此）
    if (location.protocol === 'file:') {
      const txt = document.getElementById('loadingText');
      if (txt) txt.innerHTML = '正在本地运行... <span style="font-size:12px">部分功能（PWA离线、MIDI导出）可能需要服务器环境</span>';
    }
    // skip-link 焦点切换（原 onfocus/onblur 内联属性，为收紧 CSP 迁移至此）
    const skipLink = document.querySelector('.skip-link') as HTMLAnchorElement | null;
    if (skipLink) {
      skipLink.addEventListener('focus', () => {
        skipLink.style.left = '0';
      });
      skipLink.addEventListener('blur', () => {
        skipLink.style.left = '-9999px';
      });
    }
  } catch (e) {
    reportError(e, 'init global handlers');
  }
  // Web Vitals 采集（LCP/CLS/INP），失败静默不影响主流程
  try {
    initWebVitalsReporting();
  } catch (e) {
    reportError(e, 'web-vitals init');
  }
  // 初始化事件委托，接管 data-action / data-input 的全局点击与输入监听
  initEventDelegation();
  startA11yObserver();
  materiomusic.initMateriomusicEvents();
  waveLab.initWaveLabEvents();
  Store.load();
  setSoundPack(Store.state.settings.soundPack || 'mathRock');
  // 听障视觉节拍模式：按存档设置初始化（WCAG 1.4.2 听觉替代）
  try {
    if (Store.state.settings.visualBeat) setVisualBeat(true);
  } catch (e) {
    reportError(e, 'visual-beat init');
  }
  try {
    getAudioCtx();
  } catch (e) {
    reportError(e, 'getAudioCtx');
  }
  loadEmbeddedSamples().catch(function (e) {
    reportError(e, 'loadEmbeddedSamples');
    // 音频加载失败时给用户视觉提示
    try {
      const toast = document.createElement('div');
      toast.className = 'toast error';
      toast.setAttribute('role', 'alert');
      toast.textContent = '⚠️ 音频加载失败，游戏可继续但可能无声';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 4000);
    } catch (_) {
      /* noop */
    }
  });
  setTimeout(function () {
    document.getElementById('loadingScreen')!.classList.add('hidden');
    renderHome();
    renderContinueBar();
    updateDailyBanner();
    applyTranslations();
    startHomeVisualizer();
    // 刷新 XP 进度条与连胜护盾徽章（若首页 DOM 存在）
    try {
      refreshXpBar();
      refreshFreezeBadge();
    } catch (e) {
      /* ignore */
    }
    if (!Store.state.onboardingDone) {
      showOnboarding();
    }
    if (Store.state.settings.bgm !== false && !bgMusicUserMuted) {
      showBgmHint();
    }
  }, 600);
  document.addEventListener(
    'click',
    function () {
      tryStartBgOnce();
      bumpInteraction();
    },
    { once: true }
  );
  document.addEventListener(
    'touchstart',
    function () {
      tryStartBgOnce();
      bumpInteraction();
    },
    { once: true }
  );
  document.addEventListener(
    'keydown',
    function () {
      tryStartBgOnce();
      bumpInteraction();
    },
    { once: true }
  );
  document.getElementById('bgMusicBtn')!.addEventListener('click', function () {
    window.bgMusicAutoStarted = true;
    hideBgmHint();
    if (!window.bgMusicPlaying && !window.bgMusicUserMuted && Store.state.settings.bgm !== false) {
      startBgMusic();
    }
  });
};

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    closeWhy();
    closeTutorial();
    closeEduCard();
    closeDiary();
    closeKG();
    closeTeacher();
    closeScienceMode();
  }
});

// World 1 playback shortcut: Spacebar toggles play/stop when not typing in an input
document.addEventListener('keydown', function (e) {
  if (e.code === 'Space' && state.currentWorld === 1) {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    e.preventDefault();
    if (typeof (window as any).w1TogglePlay === 'function') {
      (window as any).w1TogglePlay();
    }
  }
});

/* Expose science mode functions for inline HTML handlers and QA */
(window as any).openScienceMode = scienceModule.openScienceMode;
(window as any).closeScienceMode = closeScienceMode;
(window as any).selectScienceType = scienceModule.selectScienceType;
(window as any).goScienceStep = scienceModule.goScienceStep;
(window as any).loadScienceSample = scienceModule.loadScienceSample;
(window as any).handleScienceFile = scienceModule.handleScienceFile;
(window as any).parseScienceTextComplete = scienceModule.parseScienceTextComplete;
(window as any).parseScienceCSV = scienceModule.parseScienceCSV;
(window as any).parseScienceText = scienceModule.parseScienceText;
(window as any).toggleScienceMapping = scienceModule.toggleScienceMapping;
(window as any).updateScienceOption = scienceModule.updateScienceOption;
(window as any).toggleSciencePlay = scienceModule.toggleSciencePlay;
(window as any).saveScienceComposition = scienceModule.saveScienceComposition;
(window as any).loadScienceComposition = scienceModule.loadScienceComposition;
(window as any).deleteScienceComposition = scienceModule.deleteScienceComposition;
(window as any).openComposerWithScience = scienceModule.openComposerWithScience;
(window as any).shareScience = scienceModule.shareScience;
(window as any).toggleScienceWhyPanel = scienceModule.toggleScienceWhyPanel;
(window as any).regenerateScienceMusic = scienceModule.regenerateScienceMusic;
(window as any).downloadScienceExport = scienceModule.downloadScienceExport;

/* Expose i18n functions for inline HTML handlers and QA */
(window as any).toggleLang = i18nModule.toggleLang;
(window as any).applyTranslations = i18nModule.applyTranslations;
(window as any).getLang = i18nModule.getLang;
(window as any).setLang = i18nModule.setLang;
(window as any).t = i18nModule.t;

/* Listen for language changes to re-render dynamic content */
if (typeof window !== 'undefined') {
  window.addEventListener('mathbeat:langchange', function (e) {
    if (typeof renderHome === 'function') renderHome();
    if (typeof updateDailyBanner === 'function') updateDailyBanner();
    if (typeof renderSettings === 'function' && document.getElementById('settingsScreen')!.classList.contains('active'))
      renderSettings();
    if (
      typeof renderAchievements === 'function' &&
      document.getElementById('achievementsScreen')!.classList.contains('active')
    )
      renderAchievements();
    if (typeof renderSampleLibrary === 'function') renderSampleLibrary();
  });
}

export function openComposerHome() {
  window.location.href = 'composer.html';
}

/* ===== EXPOSE GLOBALS FOR INLINE HTML HANDLERS ===== */
// TODO: 逐步移除 window 暴露，改用事件委托
const handlers = {
  changeDifficulty: changeDifficulty,
  changeSoundPack: changeSoundPack,
  closeAchievements: closeAchievements,
  closeBossProblem: closeBossProblem,
  closeConceptMap: closeConceptMap,
  closeDailyModal: closeDailyModal,
  closeDiary: closeDiary,
  closeEduCard: closeEduCard,
  closeEndlessMode: closeEndlessMode,
  closeFreeMode: closeFreeMode,
  closeKG: closeKG,
  closeLevelEditor: closeLevelEditor,
  closeSampleLibrary: closeSampleLibrary,
  closeScienceMode: closeScienceMode,
  closeSettings: closeSettings,
  closeTeacher: closeTeacher,
  closeTutorial: closeTutorial,
  closeWhy: closeWhy,
  closeWorldIntro: closeWorldIntro,
  downloadScienceExport: downloadScienceExport,
  exitGame: exitGame,
  exitMiniComposer: exitMiniComposer,
  exportData: exportData,
  exportGameData: exportGameData,
  fmChangeBpm: fmChangeBpm,
  fmReset: fmReset,
  fmTogglePlay: fmTogglePlay,
  goScienceStep: goScienceStep,
  handleScienceFile: handleScienceFile,
  importGameData: importGameData,
  loadScienceSample: loadScienceSample,
  mcApplyGen: mcApplyGen,
  mcFinish: mcFinish,
  mcReset: mcReset,
  mcTogglePlay: mcTogglePlay,
  nextLevel: nextLevel,
  openAchievements: openAchievements,
  openComposerHome: openComposerHome,
  openComposerWithScience: openComposerWithScience,
  openConceptMap: openConceptMap,
  openEndlessMode: openEndlessMode,
  openFreeMode: openFreeMode,
  openLevelEditor: openLevelEditor,
  openSampleLibrary: openSampleLibrary,
  openScienceMode: openScienceMode,
  openSettings: openSettings,
  openTeacher: openTeacher,
  regenerateScienceMusic: regenerateScienceMusic,
  resetGameData: resetGameData,
  restartLevel: restartLevel,
  saveScienceComposition: saveScienceComposition,
  selectScienceType: selectScienceType,
  setMasterVolume: setMasterVolume,
  shareScience: shareScience,
  showDailyWhy: showDailyWhy,
  showScreen: showScreen,
  showWhy: showWhy,
  startDailyChallenge: startDailyChallenge,
  startLevel: startLevel,
  teacherLogin: teacherLogin,
  toggleBgMusic: toggleBgMusic,
  toggleGamePause: toggleGamePause,
  toggleLang: toggleLang,
  toggleSciencePlay: toggleSciencePlay,
  unlockAll: gameEngine.unlockAll,
  toggleScienceWhyPanel: toggleScienceWhyPanel,
  toggleSettingBgm: toggleSettingBgm,
  toggleSettingSfx: toggleSettingSfx,
  toggleSettingVisualBeat: toggleSettingVisualBeat,
  tryStartBgOnce: tryStartBgOnce,
  useHint: useHint,
  // materiomusic
  openScaleLab: materiomusic.openScaleLab,
  openProteinMode: materiomusic.openProteinMode,
  openWebMode: materiomusic.openWebMode,
  // wave lab (Fourier / additive synthesis)
  openWaveLab: waveLab.openWaveLab,
  closeWaveLab: waveLab.closeWaveLab,
  // science-deep (fracture/flame materiomusic)
  openFractureMode: scienceDeep.openFractureMode,
  openFlameMode: scienceDeep.openFlameMode,
  // sample-library globals
  MATH_ROCK_SAMPLES: MATH_ROCK_SAMPLES,
  REAL_MATH_ROCK_SAMPLES: REAL_MATH_ROCK_SAMPLES,
  getSampleComposition: getSampleComposition,
  importSampleToComposer: importSampleToComposer,
  playSampleComposition: playSampleComposition,
  stopSamplePlayback: stopSamplePlayback,
  toggleSamplePlayback: toggleSamplePlayback,
  // free-mode globals
  fmInit: fmInit,
  fmPlay: fmPlay,
  fmRenderTracks: fmRenderTracks,
  fmStop: fmStop,
  fmToggleCell: fmToggleCell,
};
// 兼容备份：部分 HTML 仍用 onclick 直接调用 window 全局，先保留
Object.assign(window as any, handlers);
// 注册到事件委托系统，供 data-action 调用
registerActions(handlers as any);
// 带参数的 handler 需要 wrapper 跳过 Event 首参，放最后注册以覆盖上面的原始函数
registerUiRenderActions();

// 注册 Service Worker（PWA 离线缓存）。原本是 index.html 内联 <script>，
// 为收紧 CSP（script-src 'self'）迁移至此。
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* SW 注册失败不影响主流程 */
    });
  });
}
