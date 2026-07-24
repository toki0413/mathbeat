/**
 * 对标成熟竞品打磨：XP 与等级系统 + 连胜护盾
 *
 * 设计原则（参考 Duolingo / Khan Academy）：
 *  - XP 单调递增，永不减少（避免挫败感）
 *  - 等级曲线温和：Lv N 需累计 40·N·(N+1)/2 XP，Lv.99 ≈ 198,000 XP
 *  - 所有玩法统一折算 XP：关卡星级 / Endless 得分 / Daily / 成就 / 连胜达标
 *  - 升级时撒花 + toast，首页 XP 条实时刷新
 *  - 连胜护盾：每累计 7 天连续打卡奖励 1 个（上限 3），断签时自动消耗
 */
import { Store } from './store';
import { ACHIEVEMENTS, type AchievementRarity } from './worlds';
import { showToast } from './ui-feedback';
import { spawnConfetti } from './fx/particles';
import { registerActions } from './events';

/* ============================================================
 * 1. 等级曲线
 * ============================================================ */

export const MAX_LEVEL = 99;

/** 计算到达 Lv N 所需的累计 XP（Lv.1 = 0，Lv.2 = 120，Lv.3 = 360…）。 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  // 40·N·(N+1)/2，从 Lv.1 到 Lv.N 的累计门槛
  // Lv N 的"本级起点"= 40 * (N-1) * N / 2
  const n = level - 1;
  return 20 * n * (n + 1);
}

/** 由累计 XP 反推等级（1-99）。 */
export function levelFromXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) {
    level++;
  }
  return level;
}

/** 当前等级已完成进度百分比（0-100）。 */
export function getLevelProgressPercent(): number {
  const xp = Store.state.xp || 0;
  const level = Store.state.level || 1;
  if (level >= MAX_LEVEL) return 100;
  const curFloor = xpForLevel(level);
  const nextFloor = xpForLevel(level + 1);
  const span = nextFloor - curFloor;
  if (span <= 0) return 100;
  return Math.min(100, Math.round(((xp - curFloor) / span) * 100));
}

/** 距离下一级还差多少 XP。 */
export function xpToNextLevel(): number {
  const xp = Store.state.xp || 0;
  const level = Store.state.level || 1;
  if (level >= MAX_LEVEL) return 0;
  return Math.max(0, xpForLevel(level + 1) - xp);
}

/* ============================================================
 * 2. XP 奖励常量
 * ============================================================ */

/** 关卡星级 → XP（首次完成额外 bonus）。 */
export const XP_REWARDS = {
  levelStar: { 1: 10, 2: 25, 3: 50 }, // 每星基础 XP
  firstClearBonus: 20, // 首次通关任意星级额外 +20
  endlessPerPoint: 1, // endless 每分 = 1 XP
  endlessFinishBonus: 15, // 完成一局 endless 额外 +15
  dailyComplete: 30, // 完成 daily 挑战
  dailyStreakMet: 10, // 每日学习目标达标
  achievement: {
    common: 20,
    rare: 50,
    epic: 100,
    legendary: 200,
  } as Record<AchievementRarity, number>,
} as const;

/** 成就稀有度 → XP 奖励。 */
export function xpForAchievement(rarity: AchievementRarity | undefined): number {
  return XP_REWARDS.achievement[rarity || 'common'];
}

/* ============================================================
 * 3. addXp 核心：累积 XP + 检测升级 + 触发动画
 * ============================================================ */

/**
 * 累加 XP。自动检测升级，若升级则触发撒花 + toast。
 * @param amount XP 数量（负数会被截断为 0）
 * @param reason 可选理由，用于 toast（如 '通关 1-3'）
 * @returns 是否触发了升级
 */
export function addXp(amount: number, reason?: string): boolean {
  if (!Number.isFinite(amount) || amount <= 0) return false;
  const oldXp = Store.state.xp || 0;
  const oldLevel = Store.state.level || 1;
  const newXp = oldXp + Math.floor(amount);
  const newLevel = levelFromXp(newXp);

  Store.state.xp = newXp;
  Store.state.level = newLevel;
  Store.save();

  // 升级检测：可能跨多级
  if (newLevel > oldLevel) {
    onLevelUp(oldLevel, newLevel);
    return true;
  }
  // 未升级但获得 XP，也轻量提示（可选，避免刷屏：仅 reason 非空时）
  if (reason) {
    // 不弹 toast，仅刷新首页 XP 条（若可见）
    refreshXpBar();
  }
  return false;
}

/** 升级回调：撒花 + toast + 刷新 XP 条。 */
function onLevelUp(oldLevel: number, newLevel: number): void {
  try {
    spawnConfetti();
  } catch (e) {
    /* 粒子失败不影响主流程 */
  }
  const span = newLevel - oldLevel;
  const msg = span > 1 ? `✨ 连升 ${span} 级！现在 Lv.${newLevel}` : `🎉 升级！Lv.${newLevel}`;
  try {
    showToast(msg, 'success', 3500);
  } catch (e) {
    /* toast 失败不影响主流程 */
  }
  refreshXpBar();
}

/** 刷新首页 XP 条（若 DOM 存在）。 */
export function refreshXpBar(): void {
  if (typeof document === 'undefined') return;
  const bar = document.getElementById('xpBar');
  if (!bar) return;
  const level = Store.state.level || 1;
  const percent = getLevelProgressPercent();
  const fill = bar.querySelector('.xp-bar-fill') as HTMLElement | null;
  const label = bar.querySelector('.xp-bar-label') as HTMLElement | null;
  const remain = bar.querySelector('.xp-bar-remain') as HTMLElement | null;
  if (fill) fill.style.width = percent + '%';
  if (label) label.textContent = 'Lv.' + level;
  if (remain) remain.textContent = level >= MAX_LEVEL ? 'MAX' : '还差 ' + xpToNextLevel() + ' XP';
}

/* ============================================================
 * 4. 连胜护盾（Streak Freeze）
 * ============================================================ */

export const MAX_FREEZES = 3;
export const FREEZE_AWARD_INTERVAL = 7; // 每连续 7 天打卡奖励 1 个

/** 当前持有护盾数。 */
export function getStreakFreezes(): number {
  return Math.min(MAX_FREEZES, Store.state.streakFreezes || 0);
}

/**
 * 尝试消耗一个护盾保护连胜。
 * @returns true 表示护盾生效（保持连胜），false 表示无护盾可用
 */
export function consumeStreakFreeze(): boolean {
  const count = Store.state.streakFreezes || 0;
  if (count <= 0) return false;
  Store.state.streakFreezes = count - 1;
  Store.save();
  try {
    showToast('🛡️ 连胜护盾已保护你的 ' + (Store.state.dailyStreak || 0) + ' 天连胜！', 'info', 3500);
  } catch (e) {
    /* ignore */
  }
  refreshFreezeBadge();
  return true;
}

/**
 * 检查是否应因连续打卡奖励护盾。
 * 规则：每累计 FREEZE_AWARD_INTERVAL 天连续打卡，且当天未发放过，奖励 1 个（不超上限）。
 * 应在 dailyChallengeSuccess 之后调用。
 */
export function tryAwardStreakFreeze(): void {
  const today = new Date().toISOString().slice(0, 10);
  // 同一天只发放一次
  if (Store.state.lastFreezeAwardDate === today) return;
  const streak = Store.state.dailyStreak || 0;
  if (streak > 0 && streak % FREEZE_AWARD_INTERVAL === 0) {
    const current = Store.state.streakFreezes || 0;
    if (current < MAX_FREEZES) {
      Store.state.streakFreezes = current + 1;
      Store.state.lastFreezeAwardDate = today;
      Store.save();
      try {
        showToast(`🛡️ 连续打卡 ${streak} 天，获得 1 个连胜护盾！`, 'success', 3500);
      } catch (e) {
        /* ignore */
      }
      refreshFreezeBadge();
    }
  }
}

/** 刷新首页护盾徽章（若 DOM 存在）。 */
export function refreshFreezeBadge(): void {
  if (typeof document === 'undefined') return;
  const badge = document.getElementById('freezeBadge');
  if (!badge) return;
  const count = getStreakFreezes();
  if (count > 0) {
    badge.style.display = '';
    badge.textContent = '🛡️ ' + count;
    badge.setAttribute('aria-label', '连胜护盾 ' + count + ' 个');
  } else {
    badge.style.display = 'none';
  }
}

/* ============================================================
 * 5. 等级详情 Modal
 * ============================================================ */

export function showLevelModal(): void {
  if (typeof document === 'undefined') return;
  let modal = document.getElementById('levelModal');
  if (!modal) {
    modal = createLevelModalElement();
    document.body.appendChild(modal);
  }
  renderLevelModalContent();
  modal.style.display = 'flex';
  setTimeout(() => {
    modal!.style.opacity = '1';
  }, 10);
}

export function closeLevelModal(): void {
  const modal = document.getElementById('levelModal');
  if (!modal) return;
  modal.style.opacity = '0';
  setTimeout(() => {
    modal.style.display = 'none';
  }, 200);
}

function renderLevelModalContent(): void {
  const body = document.getElementById('levelModalBody');
  if (!body) return;
  const xp = Store.state.xp || 0;
  const level = Store.state.level || 1;
  const percent = getLevelProgressPercent();
  const remain = xpToNextLevel();
  const freezes = getStreakFreezes();

  // 统计成就 XP（已解锁的）
  const earned = new Set(Store.state.achievements || []);
  let achXp = 0;
  for (const a of ACHIEVEMENTS) {
    if (earned.has(a.id)) achXp += xpForAchievement(a.rarity);
  }

  body.innerHTML = `
    <div class="lv-header">
      <div class="lv-badge Lv${level}">Lv.${level}</div>
      <div class="lv-xp-text">${xp} XP</div>
    </div>
    <div class="lv-progress">
      <div class="lv-progress-bar"><div class="lv-progress-fill" style="width:${percent}%"></div></div>
      <div class="lv-progress-meta">
        <span>${percent}%</span>
        <span>${level >= MAX_LEVEL ? '已达满级 🏆' : '还差 ' + remain + ' XP 升级'}</span>
      </div>
    </div>
    <div class="lv-stats-grid">
      <div class="lv-stat"><div class="lv-stat-num">${achXp}</div><div class="lv-stat-label">成就 XP</div></div>
      <div class="lv-stat"><div class="lv-stat-num">${freezes}</div><div class="lv-stat-label">连胜护盾</div></div>
      <div class="lv-stat"><div class="lv-stat-num">${Store.state.dailyStreak || 0}</div><div class="lv-stat-label">连续打卡</div></div>
      <div class="lv-stat"><div class="lv-stat-num">${(Store.state.achievements || []).length}</div><div class="lv-stat-label">成就数</div></div>
    </div>
    <div class="lv-rules">
      <div class="lv-rules-title">XP 获取规则</div>
      <ul>
        <li>关卡 1星 +10 · 2星 +25 · 3星 +50（首次通关额外 +20）</li>
        <li>Endless 模式每分 = 1 XP，完成一局额外 +15</li>
        <li>每日挑战完成 +30 XP</li>
        <li>成就解锁：普通 +20 · 稀有 +50 · 史诗 +100 · 传说 +200</li>
        <li>每连续 7 天打卡获得 1 个连胜护盾（上限 3 个）</li>
      </ul>
    </div>
  `;
}

function createLevelModalElement(): HTMLElement {
  const modal = document.createElement('div');
  modal.id = 'levelModal';
  modal.className = 'share-card-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', '等级与 XP');
  modal.innerHTML = `
    <div class="share-card-box lv-box">
      <div class="share-card-header">
        <span class="share-card-title">✨ 等级与 XP</span>
        <button class="ctrl-btn share-card-close" data-action="closeLevelModal" aria-label="关闭">✕</button>
      </div>
      <div id="levelModalBody" class="lv-body"></div>
      <button class="ctrl-btn" data-action="closeLevelModal">关闭</button>
    </div>
  `;
  return modal;
}

/* ============================================================
 * 6. 注册 actions
 * ============================================================ */

registerActions({
  showLevelModal,
  closeLevelModal,
});

if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    showLevelModal,
    closeLevelModal,
    refreshXpBar,
    refreshFreezeBadge,
  });
}
