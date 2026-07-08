import { toggleLang, applyTranslations, getLang, setLang, t } from './i18n';
import { idbGet, idbSet, idbDelete, migrateFromLocalStorage } from './storage';
import { SOUND_PACKS, DEFAULT_SOUND_PACK } from './sound-packs';
import { MATH_VISUALS } from './math-visuals';
import { renderConceptMap, CONCEPT_NODES, getConceptConnections } from './concept-map';
import { getBossProblem } from './boss-problems';

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
import * as materiomusic from './materiomusic';
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
import { registerActions, initEventDelegation } from './events';

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

function startHomeVisualizer() {
  const canvas = document.getElementById('homeVisualizer') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const analyser = getAnalyser();
  if (!analyser) return;
  const data = new Uint8Array(analyser.frequencyBinCount);
  let running = true;

  function draw() {
    if (!running) return;
    const active = !!document.getElementById('homeScreen')?.classList.contains('active');
    if (active) {
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
      // 不在首页时降低刷新频率，减少 CPU/GPU 占用
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      setTimeout(draw, 300);
    }
  }
  draw();
}

window.onload = function () {
  // 初始化事件委托，接管 data-action / data-input 的全局点击与输入监听
  initEventDelegation();
  materiomusic.initMateriomusicEvents();
  Store.load();
  setSoundPack(Store.state.settings.soundPack || 'mathRock');
  getAudioCtx();
  loadEmbeddedSamples().catch(function () {});
  setTimeout(function () {
    document.getElementById('loadingScreen')!.classList.add('hidden');
    renderHome();
    renderContinueBar();
    updateDailyBanner();
    applyTranslations();
    startHomeVisualizer();
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
  tryStartBgOnce: tryStartBgOnce,
  useHint: useHint,
  // materiomusic
  openScaleLab: materiomusic.openScaleLab,
  openProteinMode: materiomusic.openProteinMode,
  openWebMode: materiomusic.openWebMode,
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
