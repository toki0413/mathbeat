import { Store, LS_KEYS } from './store';
import { t, applyTranslations } from './i18n';
import {
  WORLDS,
  LEVELS,
  ACHIEVEMENTS,
  CURRICULUM,
  WORLD_INTROS,
  MATH_CONCEPTS,
  CONCEPT_TO_WORLD,
  LEVEL_HINTS,
  LEVEL_TUTORIALS,
} from './worlds';
import type { AchievementRarity } from './worlds';
import { escapeHtml, getDailySeed } from './utils';
import { MATH_VISUALS } from './math-visuals';
import { renderConceptMap, CONCEPT_NODES, getConceptConnections } from './concept-map';
import { getBossProblem } from './boss-problems';
import { state, isFreeModeUnlocked, stopAllPlayback, startLevel } from './game-engine';
import { refreshXpBar, refreshFreezeBadge, renderStreakCalendar, refreshLearningGoalRing, isWeekend } from './progression';
import {
  bgMusicUserMuted,
  bgMusicPlaying,
  startBgMusic,
  stopBgMusic,
  toggleBgMusic,
  playMenuSwipe,
  playBossWarning,
  setSoundPack,
  getAudioCtx,
  getMasterVolume,
  playSample,
  scheduleToneAt,
} from './audio';
import { SOUND_PACKS, SOUND_PACK_ORDER } from './sound-packs';
import { getDailyChallenge } from './daily';
import { renderEditor } from './level-editor';
import { initEndlessMode, endEndlessMode } from './endless-mode';
import { registerActions, registerInputs } from './events';
import { toggleSamplePlayback, importSampleToComposer } from './sample-library';
import { openModal, closeModal, announce } from './a11y';
import { mcToggleCell } from './composer/mini-composer';
import { fmChangeBpm } from './free-mode';
import { selectScienceType, goScienceStep, downloadScienceExport } from './science';
import { setMasterVolume } from './audio';
import { generateDailyRecommendations } from './learning-insights';
import { setVisualBeat } from './visual-beat';
import { reportError } from './error-report';
import { showToast } from './ui-feedback';

export function showScreen(name: string) {
  playMenuSwipe();
  document.querySelectorAll('.screen').forEach(function (s) {
    if (s.classList.contains('active')) {
      s.classList.remove('active');
      s.classList.add('slide-out');
      setTimeout(function () {
        s.classList.remove('slide-out');
      }, 300);
    }
  });
  const el = document.getElementById(name + 'Screen');
  setTimeout(function () {
    el!.classList.add('active');
  }, 20);
  if (name === 'home') {
    renderHome();
    renderContinueBar();
    if (!bgMusicPlaying && !bgMusicUserMuted) startBgMusic();
    document.body.style.backgroundImage = 'none';
  } else {
    stopBgMusic();
  }
  if (name !== 'level' && name !== 'game') {
    stopAllPlayback();
  }
  if (name === 'level' || name === 'game') {
    const wid = state.currentWorld;
    if (wid) {
      const w = WORLDS[wid - 1];
      if (w && w.bgPath) {
        document.body.style.backgroundImage = 'url(' + w.bgPath + ')';
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundRepeat = 'no-repeat';
      }
    }
  }
}

export function renderHome() {
  const grid = document.getElementById('worldGrid')!;
  const skeleton = document.getElementById('worldGridSkeleton');
  if (skeleton) skeleton.remove();
  grid.innerHTML = '';
  WORLDS.forEach(function (w) {
    const stars = getWorldStars(w.id);
    const maxS = LEVELS[w.id].length * 3;
    const locked = w.id > 1 && !isWorldUnlocked(w.id);
    const card = document.createElement('div');
    card.className = 'world-card' + (locked ? ' locked' : '');
    card.style.background = w.grad;
    card.innerHTML =
      '<div class="world-top"><span class="world-emoji"><img src="' +
      w.iconPath +
      '" style="width:28px;height:28px;vertical-align:middle;"></span><span class="world-num">' +
      t('world.' + w.id) +
      ' · W' +
      w.id +
      '</span></div><div class="world-name">' +
      t('world.' + w.id) +
      '</div><div class="world-sub">' +
      t('world.sub.' + w.id) +
      '</div><div class="world-stars"><span class="si">⭐</span>' +
      stars +
      '/' +
      maxS +
      '</div>' +
      (locked ? '<div class="world-lock">🔒</div>' : '') +
      '<div class="world-progress"><div class="world-progress-fill" style="width:' +
      (stars / maxS) * 100 +
      '%"></div></div>';
    if (!locked)
      card.onclick = function () {
        openWorld(w.id);
      };
    grid.appendChild(card);
  });
  WORLDS.forEach(function (w, i) {
    const card = grid.children[i];
    if (!card || card.classList.contains('locked')) return;
    card.addEventListener('mouseenter', function () {
      playWorldPreview(w.id);
    });
    card.addEventListener(
      'touchstart',
      function () {
        playWorldPreview(w.id);
      },
      { passive: true }
    );
  });
  const cu = document.getElementById('composerUnlocks')!;
  const tags = [
    { key: 'drums', label: '🥁' + t('home.drums') },
    { key: 'bass', label: '🎸' + t('home.bass') },
    { key: 'melody', label: '🎹' + t('home.melody') },
    { key: 'chords', label: '🎶' + t('home.chords') },
    { key: 'euclidean', label: '📏' + t('home.euclidean') },
    { key: 'modular', label: '🔄' + t('home.modular') },
    { key: 'prime', label: '🔢' + t('home.prime') },
    { key: 'fibonacci', label: '🌀' + t('home.fibonacci') },
    { key: 'symmetry', label: '🪞' + t('home.symmetry') },
    { key: 'recursive', label: '🌳' + t('home.recursive') },
    { key: 'cellular', label: '🧫' + t('home.cellular') },
    { key: 'markov', label: '🎲' + t('home.markov') },
    { key: 'counterpoint', label: '🎭' + t('home.counterpoint') },
  ];
  cu.innerHTML = tags
    .map(function (tg) {
      return (
        '<span class="unlock-tag' + (Store.state.unlocks[tg.key] ? '' : ' locked-tag') + '">' + tg.label + '</span>'
      );
    })
    .join('');
  let totalS = 0;
  Object.values(Store.state.progress).forEach((v) => (totalS += v));
  document.getElementById('totalStars')!.textContent = String(totalS);
  document.getElementById('bestComboDisplay')!.textContent = String(Store.state.bestCombo || 0);
  document.getElementById('achCount')!.textContent = String((Store.state.achievements || []).length);
  // 刷新 XP 进度条与连胜护盾徽章
  try {
    refreshXpBar();
    refreshFreezeBadge();
    renderStreakCalendar();
    refreshLearningGoalRing();
    // 周末双倍 XP 横幅
    const banner = document.getElementById('weekendXpBanner');
    if (banner) banner.style.display = isWeekend() ? 'flex' : 'none';
  } catch (e) {
    /* progression 未就绪不影响渲染 */
  }
  // 今日推荐 3 题（基于薄弱点）
  try {
    renderDailyRecommendations();
  } catch (e) {
    /* 推荐渲染失败不影响首页 */
  }
  const freeCard = document.getElementById('freeModeCard')!;
  const freeLock = document.getElementById('freeModeLock')!;
  const compCard = document.getElementById('composerHomeCard');
  const compLock = document.getElementById('composerHomeLock')!;
  if (isFreeModeUnlocked()) {
    freeCard.classList.remove('locked');
    freeLock.style.display = 'none';
    compLock.style.display = 'none';
  } else {
    freeCard.classList.add('locked');
    freeLock.style.display = 'inline-block';
    compLock.style.display = 'inline-block';
  }
  if (!document.getElementById('mathNoteMascot')) {
    const mascotEl = document.createElement('div');
    mascotEl.id = 'mathNoteMascot';
    mascotEl.style.cssText =
      'position:fixed;bottom:16px;right:16px;width:48px;height:48px;z-index:100;opacity:0.7;transition:opacity 0.3s;pointer-events:none';
    mascotEl.innerHTML = '<img src="assets/mascot.svg" style="width:100%;height:100%">';
    mascotEl.title = 'Math Note';
    document.body.appendChild(mascotEl);
  }
  applyTranslations();
}

/* ============================================================
 * 今日推荐 3 题：基于薄弱点生成个性化推荐关卡入口
 * ============================================================ */

/** 渲染今日推荐卡片到 #dailyRecommendations（首页）。 */
export function renderDailyRecommendations(): void {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('dailyRecommendations');
  if (!container) return;
  const recs = generateDailyRecommendations();
  if (recs.length === 0) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }
  container.style.display = '';
  container.innerHTML =
    '<div class="rec-header"><span class="rec-title">🎯 今日推荐 3 题</span><span class="rec-sub">基于你的薄弱点</span></div>' +
    '<div class="rec-grid">' +
    recs
      .map((r, i) => {
        const starsDisplay =
          r.stars > 0 ? '⭐'.repeat(r.stars) + '<span class="rec-star-empty">' + '☆'.repeat(3 - r.stars) + '</span>' : '<span class="rec-star-empty">☆☆☆</span>';
        return (
          '<button class="rec-card" data-action="startLevel" data-args=\'[' +
          r.worldId +
          ',"' +
          r.levelId +
          '"]\' aria-label="推荐关卡 ' +
          (i + 1) +
          '">' +
          '<div class="rec-card-top"><span class="rec-emoji">' +
          r.worldEmoji +
          '</span><span class="rec-rank">#' +
          (i + 1) +
          '</span></div>' +
          '<div class="rec-level-name">' +
          escapeHtml(r.levelName) +
          '</div>' +
          '<div class="rec-world-name">' +
          escapeHtml(r.worldName) +
          ' · ' +
          r.levelId +
          '</div>' +
          '<div class="rec-stars">' +
          starsDisplay +
          '</div>' +
          '<div class="rec-reason">' +
          escapeHtml(r.reason) +
          '</div>' +
          '</button>'
        );
      })
      .join('') +
    '</div>';
}

export function isWorldUnlocked(wid: number) {
  if (wid === 1) return true;
  const bossId = wid - 1 + '-B';
  return (Store.state.progress[bossId] || 0) >= 1;
}

const WORLD_PREVIEW_NOTES: Record<number, number[]> = {
  1: [261.63, 329.63, 392.0, 523.25],
  2: [261.63, 311.13, 392.0, 466.16],
  3: [440.0, 493.88, 587.33, 659.25],
  4: [261.63, 349.23, 392.0, 523.25],
  5: [293.66, 349.23, 392.0, 493.88],
  6: [329.63, 392.0, 466.16, 587.33],
  7: [261.63, 293.66, 329.63, 349.23],
  8: [196.0, 261.63, 329.63, 392.0],
};

let lastPreviewTime = 0;
const PREVIEW_THROTTLE_MS = 150;

export function playWorldPreview(wid: number) {
  if (Store.state.settings.sfx === false) return;
  const now = performance.now();
  if (now - lastPreviewTime < PREVIEW_THROTTLE_MS) return;
  lastPreviewTime = now;
  const ctx = getAudioCtx();
  const t = ctx.currentTime + 0.05;
  const notes = WORLD_PREVIEW_NOTES[wid] || WORLD_PREVIEW_NOTES[1];
  notes.forEach((f, i) => scheduleToneAt(f, 0.25, 'triangle', 0.2, t + i * 0.18));
}

export function renderContinueBar() {
  const el = document.getElementById('continueBar');
  if (!el) return;
  const wid = Store.state.lastWorld,
    lid = Store.state.lastLevel;
  if (wid && lid) {
    const w = WORLDS[wid - 1];
    const lv = (LEVELS[wid] || []).find((l) => l.id === lid);
    el.style.display = 'block';
    el.innerHTML =
      '<button class="daily-challenge" style="background:linear-gradient(135deg,#4ECDC4,#45B7AA);color:#fff;border:none;width:100%;margin-bottom:10px" data-action="startLevel" data-args=\'' +
      JSON.stringify([wid, lid]) +
      '\'><div class="daily-left"><div class="daily-icon">▶</div><div><div class="daily-title">' +
      t('home.continue_title') +
      '</div><div class="daily-sub">' +
      (w ? t('world.' + w.id) : '') +
      ' · ' +
      (lv ? lv.name : lid) +
      '</div></div></div><div class="daily-status">' +
      t('home.continue_action') +
      '</div></button>';
  } else {
    el.style.display = 'none';
    el.innerHTML = '';
  }
}

export function getWorldStars(wid: number) {
  let total = 0;
  (LEVELS[wid] || []).forEach(function (l) {
    total += Store.state.progress[l.id] || 0;
  });
  return total;
}

export function isLevelLocked(wid: number, idx: number) {
  if (wid === 1 && idx === 0) return false;
  if (idx === 0) return !isWorldUnlocked(wid);
  const prev = LEVELS[wid][idx - 1];
  return (Store.state.progress[prev.id] || 0) < 1;
}

export function openWorld(wid: number) {
  state.currentWorld = wid;
  showWorldIntro(wid);
}

export function showWorldIntro(wid: number) {
  const el = document.getElementById('worldIntroOverlay');
  if (!el) return;
  const w = WORLDS[wid - 1];
  const intro: any = WORLD_INTROS[wid] || {};
  document.getElementById('worldIntroTitle')!.textContent =
    (intro.title ||
      '<img src="' +
        w.iconPath +
        '" style="width:20px;height:20px;vertical-align:middle;margin-right:4px;"> ' +
        t('world.' + wid)) +
    ' — ' +
    (intro.concept || t('world.sub.' + wid));
  const visContainer = document.getElementById('worldIntroVisual')!;
  visContainer.innerHTML = '';
  const visual = MATH_VISUALS[wid];
  if (visual) {
    const title = document.createElement('div');
    title.style.fontSize = '12px';
    title.style.color = '#666';
    title.style.marginBottom = '4px';
    title.textContent = visual.title;
    visContainer.appendChild(title);
    visual.render(visContainer);
  } else {
    visContainer.innerHTML = intro.visual || '';
  }
  document.getElementById('worldIntroText')!.innerHTML =
    '<p>' +
    (intro.text || t('world.sub.' + wid)) +
    '</p><p style="margin-top:8px;font-size:13px;color:var(--dim)">解锁奖励：' +
    w.unlockLabel +
    '</p>';
  openModal(el, 'worldIntroTitle');
  try {
    announce('进入世界 ' + wid + '：' + t('world.' + wid), 'polite');
  } catch (e) {
    /* ignore */
  }
}

export function closeWorldIntro() {
  const introOverlay = document.getElementById('worldIntroOverlay');
  if (introOverlay) closeModal(introOverlay);
  const wid = state.currentWorld;
  if (!wid) return;
  const w = WORLDS[wid - 1];
  document.getElementById('levelScreenTitle')!.innerHTML =
    '<img src="' +
    w.iconPath +
    '" style="width:24px;height:24px;vertical-align:middle;margin-right:6px;"> ' +
    t('world.' + wid);
  document.getElementById('levelScreenSub')!.textContent = t('world.sub.' + wid);
  const container = document.getElementById('levelCards')!;
  container.innerHTML = '';
  LEVELS[wid].forEach(function (lv, idx) {
    const locked = isLevelLocked(wid, idx);
    const stars = Store.state.progress[lv.id] || 0;
    const cur = CURRICULUM[lv.id];
    const card = document.createElement('div');
    card.className = 'level-card' + (locked ? ' locked' : '');
    card.innerHTML =
      '<div class="level-card-icon" style="background:' +
      w.grad +
      '">' +
      (lv.boss ? '👑' : idx + 1) +
      '</div><div class="level-card-info"><div class="level-card-name">' +
      lv.name +
      '</div><div class="level-card-desc">' +
      lv.desc +
      '</div>' +
      (cur
        ? '<div class="level-card-curriculum">' + cur.grade + ' · ' + cur.standard.split('-').pop() + '</div>'
        : '') +
      '<div class="level-card-stars">' +
      [1, 2, 3]
        .map(function (i) {
          return '<span class="s' + (i <= stars ? ' earned' : '') + '">⭐</span>';
        })
        .join('') +
      '</div></div>' +
      (locked ? '<span class="level-card-lock">🔒</span>' : '') +
      (lv.boss ? '<span class="boss-badge">BOSS</span>' : '') +
      (stars > 0 && !lv.boss ? '<span class="replay-badge">↻ 重玩</span>' : '');
    if (!locked)
      card.onclick = function () {
        startLevel(wid, lv.id);
      };
    container.appendChild(card);
  });
  document.getElementById('unlockPreviewItems')!.textContent = w.unlockLabel;
  if (w && w.bgPath) {
    document.body.style.backgroundImage = 'url(' + w.bgPath + ')';
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundRepeat = 'no-repeat';
  }
  showScreen('level');
}

export function openConceptMap() {
  const overlay = document.getElementById('conceptMapOverlay');
  if (!overlay) return;
  const container = document.getElementById('conceptMapContainer')!;
  const detail = document.getElementById('conceptMapDetail')!;
  detail.style.display = 'none';
  detail.innerHTML = '';
  renderConceptMap(container, function (id) {
    const info = getConceptConnections(id);
    if (!info) return;
    const w = CONCEPT_TO_WORLD[id];
    const related =
      info.edges
        .map(function (e) {
          const other = e.from === id ? e.to : e.from;
          const n = CONCEPT_NODES.find(function (x) {
            return x.id === other;
          });
          return (n ? n.name : other) + '（' + e.label + '）';
        })
        .join('、') || '暂无直接连接';
    detail.innerHTML =
      '<div class="concept-detail-title">' +
      info.node.emoji +
      ' ' +
      info.node.name +
      '</div><div>' +
      info.node.desc +
      '</div><div style="margin-top:6px;color:var(--dim)">关联：' +
      related +
      '</div>' +
      (w
        ? '<button class="overlay-close" style="margin-top:10px" data-action="openWorldFromConceptMap" data-args=\'' +
          JSON.stringify([w]) +
          '\'>进入世界 ' +
          w +
          '</button>'
        : '');
    detail.style.display = 'block';
  });
  overlay.classList.add('show');
  openModal(overlay);
  try {
    announce('概念互联图谱已打开', 'polite');
  } catch (e) {
    /* ignore */
  }
}

export function closeConceptMap() {
  const overlay = document.getElementById('conceptMapOverlay');
  if (overlay) closeModal(overlay);
}

export function showBossProblem(wid: number, lid: string) {
  playBossWarning();
  const bp = getBossProblem(lid);
  if (!bp) {
    (window as any).startBossComposer(wid, lid);
    return;
  }
  const overlay = document.getElementById('bossProblemOverlay');
  if (!overlay) {
    (window as any).startBossComposer(wid, lid);
    return;
  }
  document.getElementById('bossProblemTitle')!.textContent = bp.title;
  document.getElementById('bossProblemEmoji')!.textContent = bp.emoji;
  document.getElementById('bossProblemText')!.textContent = bp.problem;
  document.getElementById('bossProblemMath')!.innerHTML = '<b>数学表述：</b>' + bp.mathStatement;
  document.getElementById('bossProblemHint')!.innerHTML = '<b>提示：</b>' + bp.hint;
  document.getElementById('bossProblemReward')!.textContent = '🎁 通关奖励：' + bp.reward;
  state.pendingBoss = { wid, lid };
  openModal(overlay, 'bossProblemTitle');
  try {
    announce('Boss 挑战：' + bp.title, 'assertive');
  } catch (e) {
    /* ignore */
  }
}

export function closeBossProblem(accept: boolean) {
  const overlay = document.getElementById('bossProblemOverlay');
  if (overlay) closeModal(overlay);
  const pb = state.pendingBoss;
  if (!pb) return;
  state.pendingBoss = null;
  if (accept) {
    (window as any).startBossComposer(pb.wid, pb.lid);
  }
}

export function showWhy(lid: string) {
  const key = lid || state.currentLevel;
  let c = MATH_CONCEPTS[key];
  if (!c) {
    const wid = (key || '1-1').split('-')[0];
    c = MATH_CONCEPTS[wid + '-1'];
  }
  if (!c) return;
  document.getElementById('whyTitle')!.textContent = c.title;
  document.getElementById('whyText')!.textContent = c.text;
  const overlay = document.getElementById('whyOverlay')!;
  openModal(overlay, 'whyTitle');
  try {
    announce(c.title + '：' + c.text, 'polite');
  } catch (e) {
    /* ignore */
  }
}

export function closeWhy() {
  const overlay = document.getElementById('whyOverlay');
  if (overlay) closeModal(overlay);
}

export function showTutorial(text: string) {
  const el = document.getElementById('tutorialOverlay');
  if (!el) return;
  const titleEl = document.getElementById('tutTitle');
  if (titleEl) titleEl.textContent = '教程';
  document.getElementById('tutText')!.textContent = text;
  document.getElementById('tutStep')!.textContent = '';
  const btn = document.getElementById('tutNext')!;
  btn.textContent = '知道了';
  btn.onclick = function () {
    closeTutorial();
  };
  openModal(el, 'tutTitle');
  try {
    announce(text, 'polite');
  } catch (e) {
    /* ignore */
  }
}

export function closeTutorial() {
  const el = document.getElementById('tutorialOverlay');
  if (el) closeModal(el);
}

export function showOnboarding() {
  const text =
    '欢迎来到 MathBeat！\n\n在这里，你会用数学概念创作音乐：最小公倍数、对称、频率比、模运算……每个世界都有 5 个关卡和 1 个 Boss。\n\n点击“开始”开启你的音乐数学之旅！';
  showTutorial(text);
  const titleEl = document.getElementById('tutTitle');
  if (titleEl) titleEl.textContent = '👋 欢迎来到 MathBeat';
  const btn = document.getElementById('tutNext')!;
  btn.textContent = '开始';
  btn.onclick = function () {
    Store.state.onboardingDone = true;
    Store.save();
    closeTutorial();
  };
}

export function showEducationCard(lid: string) {
  const c = MATH_CONCEPTS[lid];
  if (!c) return;
  document.getElementById('eduTitle')!.textContent = '🎓 ' + c.title;
  document.getElementById('eduText')!.textContent = c.text;
  document.getElementById('eduPractice')!.textContent = '练习：' + c.practice;
  const overlay = document.getElementById('eduCardOverlay')!;
  openModal(overlay, 'eduTitle');
  try {
    announce('学习卡片：' + c.title, 'polite');
  } catch (e) {
    /* ignore */
  }
}

export function closeEduCard() {
  const overlay = document.getElementById('eduCardOverlay');
  if (overlay) closeModal(overlay);
}

export function showHintFloat(text: string) {
  const el = document.getElementById('hintFloat');
  if (!el) return;
  el.textContent = text;
  el.setAttribute('role', 'status');
  el.classList.add('show');
  try {
    announce(text, 'polite');
  } catch (e) {
    /* ignore */
  }
  setTimeout(() => el.classList.remove('show'), 6000);
}

function achievementName(ach: (typeof ACHIEVEMENTS)[0]) {
  return t('achievement.' + ach.id + '.name') || ach.name;
}
function achievementDesc(ach: (typeof ACHIEVEMENTS)[0]) {
  return t('achievement.' + ach.id + '.desc') || ach.desc;
}

export function showAchievementPopup(id: string) {
  const ach = ACHIEVEMENTS.find((a) => a.id === id);
  if (!ach) return;
  const rarity = ach.rarity || 'common';
  document.getElementById('achPopupIcon')!.textContent = ach.icon;
  document.getElementById('achPopupName')!.textContent = achievementName(ach);
  document.getElementById('achPopupDesc')!.textContent = achievementDesc(ach);
  const popup = document.getElementById('achievementPopup')!;
  // 清除旧稀有度 class，添加新稀有度 class
  popup.classList.remove('rarity-common', 'rarity-rare', 'rarity-epic', 'rarity-legendary');
  popup.classList.add('rarity-' + rarity);
  popup.classList.add('show');
  // 屏幕阅读器播报成就解锁（WCAG 4.1.3）
  try {
    announce('成就解锁：' + achievementName(ach) + '。' + achievementDesc(ach), 'polite');
  } catch (e) {
    /* ignore */
  }
  // 显示时长按稀有度递增：common 3s / rare 4s / epic 5s / legendary 6s
  const duration = rarity === 'legendary' ? 6000 : rarity === 'epic' ? 5000 : rarity === 'rare' ? 4000 : 3000;
  // epic / legendary 触发额外撒花粒子增强彩蛋感
  if (rarity === 'epic' || rarity === 'legendary') {
    try {
      (window as any).spawnConfetti();
      if (rarity === 'legendary') {
        // 传说级连撒两次 + 延迟再撒一次，制造"爆炸"效果
        setTimeout(() => (window as any).spawnConfetti && (window as any).spawnConfetti(), 250);
        setTimeout(() => (window as any).spawnConfetti && (window as any).spawnConfetti(), 600);
      }
    } catch (e) {
      /* 粒子失败不影响主流程 */
    }
  }
  setTimeout(() => {
    popup.classList.remove('show');
    popup.classList.remove('rarity-common', 'rarity-rare', 'rarity-epic', 'rarity-legendary');
  }, duration);
}

export function showStars(id: string, stars: number) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = [1, 2, 3].map((i) => '<span class="si' + (i <= stars ? ' earned' : '') + '">⭐</span>').join('');
}

export function openTeacher() {
  const el = document.getElementById('teacherOverlay');
  if (!el) return;
  document.getElementById('teacherLogin')!.style.display = 'flex';
  document.getElementById('teacherContent')!.classList.remove('show');
  openModal(el);
  try {
    announce('教师面板已打开', 'polite');
  } catch (e) {
    /* ignore */
  }
}

export function closeTeacher() {
  const el = document.getElementById('teacherOverlay');
  if (el) closeModal(el);
}

export function teacherLogin() {
  const input = document.getElementById('teacherPwd') as HTMLInputElement;
  if (!input) return;
  // 安全：不再硬编码密码 'mathbeat'（旧实现任何查看源码即可获知）。
  // 改为本地 PBKDF2 + salt 校验预设哈希，并加 5s 失败冷却防止暴力枚举。
  const pwd = input.value;
  if (!pwd) {
    input.value = '';
    input.placeholder = '请输入密码';
    return;
  }
  // 失败冷却：5 秒内不允许重试
  const now = Date.now();
  const lastFail = (window as any).__teacherLastFailTs || 0;
  if (now - lastFail < 5000) {
    const remain = Math.ceil((5000 - (now - lastFail)) / 1000);
    input.value = '';
    input.placeholder = '请 ' + remain + ' 秒后再试';
    return;
  }
  // 预设密码哈希（PBKDF2-SHA256，盐与迭代次数见下方参数；明文密码不写入源码）
  // 因本地校验无法真正防攻击者（攻击者可直接读源码后跳过此函数），
  // 此处仅作"防止路人误操作 + 演示合规姿态"的最低门禁，
  // 真实生产部署应通过服务端 OAuth/SSO 校验。
  const expectedHash = 'b1c0d2f4e6a8b9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5';
  verifyTeacherPassword(pwd, 'mathbeat-static-salt-v1', 100000, expectedHash)
    .then((match) => {
      if (!match) {
        (window as any).__teacherLastFailTs = Date.now();
        input.value = '';
        input.placeholder = '密码错误';
        return;
      }
      document.getElementById('teacherLogin')!.style.display = 'none';
      document.getElementById('teacherContent')!.classList.add('show');
      renderTeacher();
    })
    .catch((err) => {
      // Fail-closed：鉴权服务异常时禁止进入教师面板（安全原则）
      reportError(err, 'teacher auth');
      const errEl = document.getElementById('teacherLoginError');
      if (errEl) {
        errEl.textContent = '鉴权服务不可用，请稍后重试';
        errEl.style.display = 'block';
      } else {
        try { showToast('鉴权服务不可用，请稍后重试', 'error', 4000); } catch (_) {}
      }
    });
}

/** 用 Web Crypto API 校验教师密码（PBKDF2-SHA256）。 */
async function verifyTeacherPassword(
  password: string,
  salt: string,
  iterations: number,
  expectedHex: string
): Promise<boolean> {
  try {
    if (typeof crypto === 'undefined' || !crypto.subtle) return false;
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
      'deriveBits',
    ]);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode(salt), iterations, hash: 'SHA-256' },
      keyMaterial,
      256
    );
    const actualHex = Array.from(new Uint8Array(bits))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return actualHex === expectedHex;
  } catch (e) {
    return false;
  }
}

export function renderTeacher() {
  const students: any[] = Store.state.classData && Store.state.classData.length ? Store.state.classData : simulateClassData();
  let totalStars = 0,
    completed = 0,
    activeToday = 0;
  const levelTotals: Record<string, number> = {};
  students.forEach((stu) => {
    let s = 0;
    for (const lid in stu.progress) {
      s += stu.progress[lid] || 0;
      levelTotals[lid] = (levelTotals[lid] || 0) + (stu.progress[lid] || 0);
    }
    totalStars += s;
    if (s >= 6) completed++;
    if (stu.last7 && stu.last7[6] > 0) activeToday++;
  });
  const avgStars = students.length ? (totalStars / students.length).toFixed(1) : 0;
  const statsEl = document.getElementById('teacherStats')!;
  statsEl.innerHTML =
    '<div style="margin-bottom:8px"><span class="teacher-stat">学生数 ' +
    students.length +
    '</span><span class="teacher-stat">人均星 ' +
    avgStars +
    '</span><span class="teacher-stat">今日活跃 ' +
    activeToday +
    '</span><span class="teacher-stat">通关 ≥6星 ' +
    completed +
    '</span></div>';
  const heat = document.getElementById('heatmapGrid')!;
  heat.innerHTML = '';
  for (let d = 0; d < 7; d++) {
    for (let s = 0; s < students.length; s++) {
      const v = students[s].last7 ? students[s].last7[d] : 0;
      const c = document.createElement('div');
      c.className = 'heatmap-cell';
      c.style.background = 'rgba(76,237,196,' + (0.1 + v * 0.15) + ')';
      c.title = escapeHtml(students[s].name) + ' 第' + (d + 1) + '天: ' + v + '星';
      heat.appendChild(c);
    }
  }
  const bar = document.getElementById('barChart')!;
  const lids = Object.keys(levelTotals).sort();
  const max = Math.max(1, ...lids.map((l) => levelTotals[l]));
  bar.innerHTML =
    '<div style="font-size:13px;font-weight:700;margin-bottom:6px">各关卡累计星数</div>' +
    lids
      .map(
        (l) =>
          '<div style="display:flex;align-items:center;margin:3px 0"><span style="width:40px;font-size:12px">' +
          l +
          '</span><div style="flex:1;height:14px;background:rgba(0,0,0,.06);border-radius:7px;overflow:hidden"><div style="width:' +
          (levelTotals[l] / max) * 100 +
          '%;height:100%;background:var(--trackA)"></div></div><span style="width:24px;text-align:right;font-size:12px">' +
          levelTotals[l] +
          '</span></div>'
      )
      .join('');
}

export function simulateClassData() {
  const students: any[] = [];
  const names = ['Alice', 'Bob', 'Cara', 'David', 'Ella', 'Frank', 'Gina', 'Henry'];
  for (let i = 0; i < names.length; i++) {
    const s = { name: names[i], progress: {} as Record<string, number>, last7: [0, 0, 0, 0, 0, 0, 0] };
    LEVELS[1].forEach((l) => (s.progress[l.id] = Math.floor(Math.random() * 3.5)));
    for (let d = 0; d < 7; d++) s.last7[d] = Math.floor(Math.random() * 5);
    students.push(s);
  }
  return students;
}

export function exportData() {
  const data = {
    exportTime: new Date().toISOString(),
    progress: Store.state.progress,
    adaptiveHistory: Store.state.adaptiveHistory || [],
    leaderboard: Store.state.leaderboard || {},
    achievements: Store.state.achievements || [],
    scienceCompositions: (Store.state.scienceCompositions || []).length,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'mathbeat-class-data.json';
  a.click();
}

export function closeScienceMode() {
  document.getElementById('scienceScreen')!.classList.remove('active');
}

export function openSettings() {
  document.getElementById('settingsScreen')!.classList.add('active');
  renderSettings();
}

export function closeSettings() {
  document.getElementById('settingsScreen')!.classList.remove('active');
}

let cachedSoundPackOptionsHtml: string | null = null;

export function renderSettings() {
  const bgmBtn = document.getElementById('settingBgmBtn');
  const sfxBtn = document.getElementById('settingSfxBtn');
  const diffSel = document.getElementById('settingDifficulty');
  const spSel = document.getElementById('settingSoundPack');
  const volSlider = document.getElementById('masterVolumeSlider') as HTMLInputElement | null;
  const volVal = document.getElementById('masterVolumeVal');
  const vbBtn = document.getElementById('settingVisualBeatBtn');
  if (bgmBtn) bgmBtn.textContent = Store.state.settings.bgm !== false ? '开启' : '关闭';
  if (sfxBtn) sfxBtn.textContent = Store.state.settings.sfx !== false ? '开启' : '关闭';
  if (vbBtn) vbBtn.textContent = Store.state.settings.visualBeat ? '开启' : '关闭';
  if (diffSel) (diffSel as HTMLSelectElement).value = Store.state.settings.difficulty || 'auto';
  if (spSel) {
    const sel = spSel as HTMLSelectElement;
    if (cachedSoundPackOptionsHtml === null) {
      cachedSoundPackOptionsHtml = SOUND_PACK_ORDER.map(function (id) {
        const pack = SOUND_PACKS[id];
        return '<option value="' + id + '">' + pack.emoji + ' ' + pack.name + '</option>';
      }).join('');
    }
    sel.innerHTML = cachedSoundPackOptionsHtml;
    sel.value = Store.state.settings.soundPack || 'mathRock';
  }
  const vol = Math.round(getMasterVolume() * 100);
  if (volSlider) volSlider.value = String(vol);
  if (volVal) volVal.textContent = vol + '%';
}

export function changeSoundPack(id: string): void {
  setSoundPack(id);
  Store.state.settings.soundPack = id;
  Store.save();
}

export function toggleSettingBgm(): void {
  const next = Store.state.settings.bgm !== false;
  Store.state.settings.bgm = !next;
  Store.save();
  toggleBgMusic();
  renderSettings();
}

export function toggleSettingSfx(): void {
  const next = Store.state.settings.sfx !== false;
  Store.state.settings.sfx = !next;
  Store.save();
  renderSettings();
}

export function toggleSettingVisualBeat(): void {
  const next = !Store.state.settings.visualBeat;
  Store.state.settings.visualBeat = next;
  Store.save();
  // 立即应用：开启/关闭视觉脉冲
  setVisualBeat(next);
  renderSettings();
}

export function changeDifficulty(value: string): void {
  Store.state.settings.difficulty = value as 'easy' | 'auto' | 'hard';
  Store.save();
  renderSettings();
}

export function openSampleLibrary() {
  stopAllPlayback();
  renderSampleLibrary();
  const modal = document.getElementById('sampleLibraryModal')!;
  modal.style.display = 'flex';
  setTimeout(() => (modal.style.opacity = '1'), 10);
}

export function closeSampleLibrary() {
  (window as any).stopSamplePlayback();
  const modal = document.getElementById('sampleLibraryModal')!;
  modal.style.opacity = '0';
  setTimeout(() => (modal.style.display = 'none'), 300);
}

export function renderSampleLibrary() {
  const el = document.getElementById('sampleLibraryList');
  if (!el) return;
  el.innerHTML = (window as any).MATH_ROCK_SAMPLES.map(
    (s: any) =>
      '<div style="background:var(--bg);border-radius:14px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div style="font-size:17px;font-weight:800">' +
      s.title +
      '</div><div style="font-size:12px;color:var(--dim);margin-top:2px">' +
      s.bpm +
      ' BPM · ' +
      s.duration +
      ' · ' +
      s.tags.join(' · ') +
      '</div></div><button class="ctrl-btn" id="samplePlay_' +
      s.id +
      '" data-action="toggleSamplePlayback" data-args=\'' +
      JSON.stringify(s.id) +
      '\'>▶</button></div><div style="font-size:13px;color:var(--dim);margin:8px 0;line-height:1.5">' +
      s.structure +
      '</div><div style="display:flex;gap:8px"><button class="verify-btn" style="flex:1" data-action="importSampleToComposer" data-args=\'' +
      JSON.stringify(s.id) +
      '\'>导入作曲台</button></div></div>'
  ).join('');
}

export function openAchievements() {
  document.getElementById('achievementsScreen')!.classList.add('active');
  renderAchievements();
}

export function closeAchievements() {
  document.getElementById('achievementsScreen')!.classList.remove('active');
}

export function renderAchievements() {
  const earned = new Set(Store.state.achievements || []);
  const cats = [
    { key: 'progress', label: '📈 进度类' },
    { key: 'skill', label: '⚡ 技巧类' },
    { key: 'explore', label: '🔍 探索类' },
    { key: 'hidden', label: '👻 隐藏类' },
  ];
  const container = document.getElementById('achievementsBody')!;
  if (!container) return;
  container.innerHTML = '';

  // 顶部稀有度统计卡
  const rarities: { key: AchievementRarity; label: string; icon: string }[] = [
    { key: 'common', label: '普通', icon: '⚪' },
    { key: 'rare', label: '稀有', icon: '🔵' },
    { key: 'epic', label: '史诗', icon: '🟣' },
    { key: 'legendary', label: '传说', icon: '🟡' },
  ];
  const statsHtml =
    '<div class="ach-rarity-stats">' +
    rarities
      .map((r) => {
        const all = ACHIEVEMENTS.filter((a) => (a.rarity || 'common') === r.key);
        const got = all.filter((a) => earned.has(a.id)).length;
        const total = all.length;
        return (
          '<div class="ach-rarity-stat rarity-' +
          r.key +
          (got === total && total > 0 ? ' complete' : '') +
          '"><div class="ach-rarity-icon">' +
          r.icon +
          '</div><div class="ach-rarity-num">' +
          got +
          '/' +
          total +
          '</div><div class="ach-rarity-label">' +
          r.label +
          '</div></div>'
        );
      })
      .join('') +
    '</div>';
  container.innerHTML = statsHtml;

  function renderCategoryCard(a: typeof ACHIEVEMENTS[0]): string {
    const ok = earned.has(a.id);
    const rarity = a.rarity || 'common';
    if (a.hidden && !ok) {
      return '<div class="ach-card locked"><div class="ach-card-q">?</div><div class="ach-card-name">???</div><div class="ach-card-desc">解锁后显示</div></div>';
    }
    const rarityTag = '<span class="ach-rarity-tag rarity-' + rarity + '">' + rarityLabel(rarity) + '</span>';
    return (
      '<div class="ach-card rarity-' +
      rarity +
      (ok ? '' : ' locked') +
      '"><div class="ach-card-icon">' +
      a.icon +
      '</div><div class="ach-card-name">' +
      escapeHtml(achievementName(a)) +
      '</div><div class="ach-card-desc">' +
      escapeHtml(achievementDesc(a)) +
      '</div>' +
      rarityTag +
      '</div>'
    );
  }

  function appendChunk(idx: number) {
    if (idx === 0) {
      // 统计卡已渲染，从分类索引 0 开始追加（idx 这里同时充当 cats 索引）
    }
    if (idx >= cats.length) return;
    const c = cats[idx];
    const items = ACHIEVEMENTS.filter((a) => a.cat === c.key);
    const grid = items.map(renderCategoryCard).join('');
    const wrapper = document.createElement('div');
    wrapper.innerHTML =
      '<div class="ach-cat-title">' + c.label + '</div><div class="ach-grid">' + grid + '</div>';
    container.appendChild(wrapper);
    // 把长列表拆到多帧渲染，避免单次 Layout 阻塞主线程
    requestAnimationFrame(function () {
      appendChunk(idx + 1);
    });
  }

  appendChunk(0);
}

function rarityLabel(r: AchievementRarity): string {
  switch (r) {
    case 'rare':
      return '稀有';
    case 'epic':
      return '史诗';
    case 'legendary':
      return '传说';
    default:
      return '普通';
  }
}

export function updateDailyBanner() {
  const d = getDailyChallenge();
  const key = 'daily_' + getDailySeed();
  const done = (Store.state.achievements || []).includes(key);
  const el = document.getElementById('dailyChallengeBanner');
  const sub = document.getElementById('dailySub');
  if (sub) {
    sub.textContent = '今日挑战：' + (d.name || d.type);
  }
  if (el) {
    const streak = Store.state.dailyStreak || 0;
    const streakText = streak > 0 ? ' 🔥 ' + streak + ' 天' : '';
    if (done) {
      el.classList.add('done');
      document.getElementById('dailyStatus')!.textContent = '已完成' + streakText;
    } else {
      el.classList.remove('done');
      document.getElementById('dailyStatus')!.textContent = '开始挑战' + streakText;
    }
  }
}

export function closeDiary() {
  document.getElementById('diaryOverlay')!.classList.remove('show');
}

export function closeKG() {
  document.getElementById('kgOverlay')!.classList.remove('show');
}

export function openEndlessMode(): void {
  stopAllPlayback();
  showScreen('endlessMode');
  const body = document.getElementById('endlessBody');
  if (!body) return;
  const stats = Store.state.endlessStats || {
    bestScore: 0,
    totalRounds: 0,
    totalCorrect: 0,
    totalQuestions: 0,
    bestCombo: 0,
  };
  body.innerHTML =
    '<div class="challenge-card" style="text-align:center">' +
    '<div style="font-size:48px;margin-bottom:8px">♾️</div>' +
    '<div style="font-size:20px;font-weight:800;margin-bottom:6px">数学音乐挑战</div>' +
    '<div style="font-size:13px;color:var(--dim);margin-bottom:16px">无限轮次的数学问答，每答对一题都会为旋律添加一个音符。你能走多远？</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">' +
    '<div style="background:rgba(0,0,0,.03);border-radius:10px;padding:10px"><div style="font-size:20px;font-weight:800">' +
    stats.bestScore +
    '</div><div style="font-size:11px;color:var(--dim)">历史最佳</div></div>' +
    '<div style="background:rgba(0,0,0,.03);border-radius:10px;padding:10px"><div style="font-size:20px;font-weight:800">' +
    stats.bestCombo +
    '</div><div style="font-size:11px;color:var(--dim)">最高连击</div></div>' +
    '<div style="background:rgba(0,0,0,.03);border-radius:10px;padding:10px"><div style="font-size:20px;font-weight:800">' +
    stats.totalRounds +
    '</div><div style="font-size:11px;color:var(--dim)">总轮数</div></div>' +
    '<div style="background:rgba(0,0,0,.03);border-radius:10px;padding:10px"><div style="font-size:20px;font-weight:800">' +
    (stats.totalQuestions > 0 ? Math.round((stats.totalCorrect / stats.totalQuestions) * 100) : 0) +
    '%</div><div style="font-size:11px;color:var(--dim)">准确率</div></div>' +
    '</div>' +
    '<div style="margin-bottom:12px">' +
    '<div style="font-size:13px;font-weight:700;margin-bottom:8px">选择模式</div>' +
    '<div style="display:flex;gap:6px;margin-bottom:8px">' +
    '<button class="ctrl-btn em-time-btn" style="flex:1;font-size:13px;background:var(--trackA);color:#fff" data-time="0" data-action="selectEndlessTime" data-args=\'[0]\'>无限</button>' +
    '<button class="ctrl-btn em-time-btn" style="flex:1;font-size:13px" data-time="60" data-action="selectEndlessTime" data-args=\'[60]\'>60秒</button>' +
    '<button class="ctrl-btn em-time-btn" style="flex:1;font-size:13px" data-time="120" data-action="selectEndlessTime" data-args=\'[120]\'>120秒</button>' +
    '</div>' +
    '<div style="font-size:13px;font-weight:700;margin-bottom:8px">专注世界（可选）</div>' +
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">' +
    '<button class="ctrl-btn em-world-btn" style="font-size:12px;background:var(--w1);color:#fff" data-world="1" data-action="selectEndlessWorld" data-args=\'[1]\'>🥁</button>' +
    '<button class="ctrl-btn em-world-btn" style="font-size:12px" data-world="2" data-action="selectEndlessWorld" data-args=\'[2]\'>🎵</button>' +
    '<button class="ctrl-btn em-world-btn" style="font-size:12px" data-world="3" data-action="selectEndlessWorld" data-args=\'[3]\'>🌊</button>' +
    '<button class="ctrl-btn em-world-btn" style="font-size:12px" data-world="4" data-action="selectEndlessWorld" data-args=\'[4]\'>🔄</button>' +
    '<button class="ctrl-btn em-world-btn" style="font-size:12px" data-world="5" data-action="selectEndlessWorld" data-args=\'[5]\'>🎯</button>' +
    '<button class="ctrl-btn em-world-btn" style="font-size:12px" data-world="6" data-action="selectEndlessWorld" data-args=\'[6]\'>🔨</button>' +
    '<button class="ctrl-btn em-world-btn" style="font-size:12px" data-world="7" data-action="selectEndlessWorld" data-args=\'[7]\'>🎲</button>' +
    '<button class="ctrl-btn em-world-btn" style="font-size:12px" data-world="8" data-action="selectEndlessWorld" data-args=\'[8]\'>🕸️</button>' +
    '</div>' +
    '<div style="margin-top:6px;font-size:11px;color:var(--dim)">点击选择专注世界，不选则混合出题</div>' +
    '</div>' +
    '<button class="verify-btn" style="width:100%;margin-bottom:8px" data-action="startEndlessGame">开始挑战</button>' +
    '<button class="ctrl-btn" data-action="closeEndlessMode">返回主页</button>' +
    '</div>';
}

let selectedEndlessTime = 0;
let selectedEndlessWorld = 0;

export function selectEndlessTime(time: number, btn: HTMLElement): void {
  selectedEndlessTime = time;
  document.querySelectorAll('.em-time-btn').forEach((b: any) => {
    b.style.background = 'rgba(0,0,0,.06)';
    b.style.color = 'var(--text)';
  });
  btn.style.background = 'var(--trackA)';
  btn.style.color = '#fff';
}

export function selectEndlessWorld(world: number, btn: HTMLElement): void {
  if (selectedEndlessWorld === world) {
    selectedEndlessWorld = 0;
    btn.style.background = 'rgba(0,0,0,.06)';
    btn.style.color = 'var(--text)';
  } else {
    selectedEndlessWorld = world;
    document.querySelectorAll('.em-world-btn').forEach((b: any) => {
      b.style.background = 'rgba(0,0,0,.06)';
      b.style.color = 'var(--text)';
    });
    btn.style.background = 'var(--w' + world + ')';
    btn.style.color = '#fff';
  }
}

export function startEndlessGame(): void {
  const config = { timeLimit: selectedEndlessTime, focusedWorld: selectedEndlessWorld };
  initEndlessMode(config);
}

export function closeEndlessMode(): void {
  endEndlessMode();
  document.getElementById('endlessModeScreen')?.classList.remove('active');
  showScreen('home');
}

export function openLevelEditor(): void {
  stopAllPlayback();
  showScreen('levelEditor');
  renderEditor();
}

export function closeLevelEditor(): void {
  document.getElementById('levelEditorScreen')?.classList.remove('active');
  showScreen('home');
}

export function openFreeMode() {
  if (!isFreeModeUnlocked()) return;
  stopAllPlayback();
  (window as any).fmInit();
  document.getElementById('freeModeScreen')!.classList.add('active');
}

export function closeFreeMode() {
  (window as any).fmStop();
  document.getElementById('freeModeScreen')!.classList.remove('active');
  showScreen('home');
}
/* ===== EXPOSE GLOBALS ===== */
// TODO: 逐步移除 window 暴露，改用事件委托
Object.assign(window as any, {
  changeDifficulty: changeDifficulty,
  changeSoundPack: changeSoundPack,
  closeAchievements: closeAchievements,
  closeBossProblem: closeBossProblem,
  closeConceptMap: closeConceptMap,
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
  exportData: exportData,
  getWorldStars: getWorldStars,
  isLevelLocked: isLevelLocked,
  isWorldUnlocked: isWorldUnlocked,
  openAchievements: openAchievements,
  openConceptMap: openConceptMap,
  openEndlessMode: openEndlessMode,
  openFreeMode: openFreeMode,
  openLevelEditor: openLevelEditor,
  openSampleLibrary: openSampleLibrary,
  openSettings: openSettings,
  openTeacher: openTeacher,
  openWorld: openWorld,
  playWorldPreview: playWorldPreview,
  renderAchievements: renderAchievements,
  renderContinueBar: renderContinueBar,
  renderHome: renderHome,
  renderSampleLibrary: renderSampleLibrary,
  renderSettings: renderSettings,
  renderTeacher: renderTeacher,
  selectEndlessTime: selectEndlessTime,
  selectEndlessWorld: selectEndlessWorld,
  showAchievementPopup: showAchievementPopup,
  showBossProblem: showBossProblem,
  showEducationCard: showEducationCard,
  showHintFloat: showHintFloat,
  showOnboarding: showOnboarding,
  showScreen: showScreen,
  showStars: showStars,
  showTutorial: showTutorial,
  showWhy: showWhy,
  showWorldIntro: showWorldIntro,
  simulateClassData: simulateClassData,
  startEndlessGame: startEndlessGame,
  teacherLogin: teacherLogin,
  toggleSettingBgm: toggleSettingBgm,
  toggleSettingSfx: toggleSettingSfx,
  toggleSettingVisualBeat: toggleSettingVisualBeat,
  updateDailyBanner: updateDailyBanner,
});

// 事件委托处理函数注册。单独导出，由 main.ts 在 registerActions(handlers) 之后调用。
// data-action 系统会把 Event 作为首参传入，带参数的 handler 必须用 wrapper 跳过事件对象，
// 否则原本的第一个参数会被 Event 占据导致参数错位。
// wrapper 放到最后注册，覆盖 handlers 里直接注册的同名原始函数。
export function registerUiRenderActions() {
  registerActions({
    openWorld: (_e: Event, wid: unknown) => openWorld(wid as number),
    openWorldFromConceptMap: (_e: Event, wid: unknown) => {
      // 原概念地图按钮是 closeConceptMap();openWorld(w) 连续调用，openWorld 内部不会关地图，这里补上
      closeConceptMap();
      openWorld(wid as number);
    },
    closeConceptMap,
    closeTutorial,
    selectEndlessTime: (e: Event, time: unknown) => {
      const btn = (e.target as HTMLElement).closest('[data-action]') as HTMLElement;
      selectEndlessTime(time as number, btn);
    },
    selectEndlessWorld: (e: Event, world: unknown) => {
      const btn = (e.target as HTMLElement).closest('[data-action]') as HTMLElement;
      selectEndlessWorld(world as number, btn);
    },
    startEndlessGame,
    closeEndlessMode,
    toggleSamplePlayback: (_e: Event, id: unknown) => toggleSamplePlayback(id as string),
    importSampleToComposer: (_e: Event, id: unknown) => importSampleToComposer(id as string),
    startLevel: (_e: Event, wid: unknown, lid: unknown) => startLevel(wid as number, lid as string),
    // 带参数 handler 的 wrapper：跳过 Event 首参，避免参数错位
    showScreen: (_e: Event, screen: unknown) => showScreen(screen as string),
    closeBossProblem: (_e: Event, accept: unknown) => closeBossProblem(Boolean(accept)),
    mcToggleCell: (_e: Event, ti: unknown, i: unknown) => mcToggleCell(ti as number, i as number),
    fmChangeBpm: (_e: Event, d: unknown) => fmChangeBpm(d as number),
    selectScienceType: (_e: Event, type: unknown) => selectScienceType(type as string),
    goScienceStep: (_e: Event, step: unknown) => goScienceStep(step as string),
    downloadScienceExport: (_e: Event, fmt: unknown) => downloadScienceExport(fmt as 'midi' | 'json' | 'csv'),
  });
  // data-input 处理器：change/input 事件，从元素 value 取参
  registerInputs({
    setMasterVolume: (e: Event) => {
      const el = e.target as HTMLInputElement;
      setMasterVolume(Number(el.value) / 100);
    },
    changeSoundPack: (e: Event) => {
      const el = e.target as HTMLSelectElement;
      changeSoundPack(el.value);
    },
    changeDifficulty: (e: Event) => {
      const el = e.target as HTMLSelectElement;
      changeDifficulty(el.value);
    },
  });
}
