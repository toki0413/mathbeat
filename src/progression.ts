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
 * 2.5 周末双倍 XP 活动（对标成熟产品限时活动）
 * ============================================================ */

/** 周末双倍 XP 倍率。 */
export const WEEKEND_XP_MULTIPLIER = 2;

/** 判断当前是否为周末（周六/周日，按本地时区）。 */
export function isWeekend(): boolean {
  const day = new Date().getDay();
  return day === 0 || day === 6; // 0=周日, 6=周六
}

/** 获取当前 XP 倍率（1 或 2）。 */
export function getXpMultiplier(): number {
  return isWeekend() ? WEEKEND_XP_MULTIPLIER : 1;
}

/** 应用倍率计算实际 XP。 */
export function applyXpMultiplier(amount: number): number {
  return Math.floor(amount * getXpMultiplier());
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
  // 周末双倍 XP 加成
  const multiplier = getXpMultiplier();
  const actualAmount = Math.floor(amount) * multiplier;
  const newXp = oldXp + actualAmount;
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
  renderStreakCalendar,
  openLearningGoalModal,
  closeLearningGoalModal,
  setLearningDailyTarget,
});

if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    showLevelModal,
    closeLevelModal,
    refreshXpBar,
    refreshFreezeBadge,
    renderStreakCalendar,
    openLearningGoalModal,
    closeLearningGoalModal,
    setLearningDailyTarget,
    // 周末双倍 XP 活动相关 API（供 e2e 测试与外部脚本调用）
    isWeekend,
    getXpMultiplier,
    applyXpMultiplier,
    addXp,
  });
}

/* ============================================================
 * 7. 连胜日历可视化（对标 Duolingo streak calendar）
 *
 * 基于现有 dailyStreak + dailyLastDate 反推最近 N 天打卡状态，
 * 无需新增 store 字段。未来若记录完整历史可无缝升级。
 * ============================================================ */

/** 返回 YYYY-MM-DD 格式日期。 */
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 返回距今天 offset 天的日期字符串。offset=0 为今天。 */
function dateOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return formatDate(d);
}

/** 判断某天是否在当前连胜范围内（已打卡）。 */
function isDayCompleted(dateStr: string): boolean {
  const streak = Store.state.dailyStreak || 0;
  const lastDate = Store.state.dailyLastDate || '';
  if (streak <= 0 || !lastDate) return false;
  // lastDate 是最近一次打卡日，往前推 streak-1 天都在范围内
  const last = new Date(lastDate + 'T00:00:00Z');
  const target = new Date(dateStr + 'T00:00:00Z');
  const diffDays = Math.round((last.getTime() - target.getTime()) / 86400000);
  return diffDays >= 0 && diffDays < streak;
}

/** 判断某天是否使用了护盾保护（简化：不区分，统一归入已完成）。 */

/** 渲染连胜日历到 #streakCalendar（首页）。 */
export function renderStreakCalendar(): void {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('streakCalendar');
  if (!container) return;

  const streak = Store.state.dailyStreak || 0;
  const days = 14; // 显示最近 14 天
  const today = dateOffset(0);
  const todayDone = isDayCompleted(today);

  // 生成最近 days 天的状态（从最早到最近）
  const cells: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dateStr = dateOffset(i);
    const completed = isDayCompleted(dateStr);
    const isToday = i === 0;
    const d = new Date(dateStr + 'T00:00:00Z');
    const weekday = ['日', '一', '二', '三', '四', '五', '六'][d.getUTCDay()];
    const dayNum = d.getUTCDate();

    let cls = 'streak-cell';
    if (completed) cls += ' completed';
    if (isToday) cls += ' today';
    if (isToday && !completed) cls += ' today-pending';

    const icon = completed ? '🔥' : isToday ? '○' : '';
    cells.push(
      `<div class="${cls}" title="${dateStr} 周${weekday}"><div class="streak-cell-week">${weekday}</div><div class="streak-cell-day">${dayNum}</div><div class="streak-cell-icon">${icon}</div></div>`
    );
  }

  const streakLabel = streak > 0 ? `🔥 ${streak} 天连胜` : '开始你的连胜';
  const freezeCount = getStreakFreezes();

  container.innerHTML = `
    <div class="streak-cal-header">
      <span class="streak-cal-title">${streakLabel}</span>
      ${freezeCount > 0 ? `<span class="streak-cal-freeze">🛡️ ${freezeCount}</span>` : ''}
    </div>
    <div class="streak-cal-grid">${cells.join('')}</div>
    <div class="streak-cal-hint">${todayDone ? '✅ 今日已打卡' : '完成今日挑战延续连胜！'}</div>
  `;
}

/* ============================================================
 * 8. 每日学习目标进度环（对标 Duolingo daily goal）
 *
 * 复用 store.learningGoal 字段，跨日自动重置。
 * 在 completeLevel / dailyChallengeSuccess / endless 答题时调用 recordLearningProgress。
 * ============================================================ */

/** 获取今日学习目标 key（YYYY-MM-DD）。 */
function todayKey(): string {
  return dateOffset(0);
}

/** 获取本周 key（YYYY-Www）。 */
function weekKey(): string {
  const d = new Date();
  const year = d.getUTCFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  const diff = (d.getTime() - start.getTime()) / 86400000;
  const week = Math.ceil((diff + start.getUTCDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** 确保学习目标状态对齐到今天/本周（跨日自动重置）。 */
function ensureLearningGoalFresh(): void {
  const g = Store.state.learningGoal;
  if (!g) {
    Store.state.learningGoal = {
      dailyTarget: 10,
      dailyCompleted: 0,
      dailyDate: todayKey(),
      weeklyTarget: 50,
      weeklyCompleted: 0,
      weeklyKey: weekKey(),
      bestDailyStreak: 0,
      dailyStreakMet: 0,
      lastMetDate: '',
    };
    return;
  }
  const today = todayKey();
  if (g.dailyDate !== today) {
    // 跨日：检查昨天是否达标，更新 bestDailyStreak
    if (g.dailyCompleted >= g.dailyTarget) {
      // 昨天达标，dailyStreakMet 已在达标时 +1
    } else {
      // 昨天未达标，重置连续达标计数
      g.dailyStreakMet = 0;
    }
    g.dailyCompleted = 0;
    g.dailyDate = today;
  }
  const wk = weekKey();
  if (g.weeklyKey !== wk) {
    g.weeklyCompleted = 0;
    g.weeklyKey = wk;
  }
}

/** 记录一次学习行为（完成 1 题/1 关）。返回是否触发今日达标。 */
export function recordLearningProgress(count = 1): boolean {
  ensureLearningGoalFresh();
  const g = Store.state.learningGoal!;
  const wasMet = g.dailyCompleted >= g.dailyTarget;
  g.dailyCompleted += count;
  g.weeklyCompleted += count;
  const nowMet = g.dailyCompleted >= g.dailyTarget;
  if (nowMet && !wasMet) {
    // 首次达标
    g.dailyStreakMet++;
    const today = todayKey();
    if (g.lastMetDate !== today) {
      g.lastMetDate = today;
      if (g.dailyStreakMet > g.bestDailyStreak) {
        g.bestDailyStreak = g.dailyStreakMet;
      }
      Store.save();
      try {
        showToast(`🎯 今日目标达成！连续 ${g.dailyStreakMet} 天达标`, 'success', 3000);
      } catch (e) {
        /* ignore */
      }
      refreshLearningGoalRing();
      return true;
    }
  }
  Store.save();
  refreshLearningGoalRing();
  return false;
}

/** 获取今日目标完成百分比（0-100）。 */
export function getLearningGoalPercent(): number {
  ensureLearningGoalFresh();
  const g = Store.state.learningGoal!;
  if (g.dailyTarget <= 0) return 100;
  return Math.min(100, Math.round((g.dailyCompleted / g.dailyTarget) * 100));
}

/** 刷新首页学习目标进度环（若 DOM 存在）。 */
export function refreshLearningGoalRing(): void {
  if (typeof document === 'undefined') return;
  const ring = document.getElementById('learningGoalRing');
  if (!ring) return;
  ensureLearningGoalFresh();
  const g = Store.state.learningGoal!;
  const percent = getLearningGoalPercent();
  const circ = 2 * Math.PI * 26; // r=26
  const offset = circ * (1 - percent / 100);
  const circle = ring.querySelector('.ring-progress') as HTMLElement | null;
  const num = ring.querySelector('.ring-num') as HTMLElement | null;
  const label = ring.querySelector('.ring-label') as HTMLElement | null;
  if (circle) {
    circle.style.strokeDasharray = String(circ);
    circle.style.strokeDashoffset = String(offset);
  }
  if (num) num.textContent = `${g.dailyCompleted}/${g.dailyTarget}`;
  if (label) label.textContent = percent >= 100 ? '已达标' : '今日目标';
  ring.classList.toggle('completed', percent >= 100);
}

/** 设置每日目标数量。 */
export function setLearningDailyTarget(e: Event | unknown, ...args: unknown[]): void {
  const v = args.length > 0 ? (args[0] as number) : (e as number);
  const target = Math.max(1, Math.min(50, Math.floor(v)));
  ensureLearningGoalFresh();
  Store.state.learningGoal!.dailyTarget = target;
  Store.save();
  refreshLearningGoalRing();
  renderLearningGoalModalContent();
  try {
    showToast(`每日目标已设为 ${target} 题`, 'info', 2000);
  } catch (e) {
    /* ignore */
  }
}

/** 打开学习目标设置 Modal。 */
export function openLearningGoalModal(): void {
  if (typeof document === 'undefined') return;
  let modal = document.getElementById('learningGoalModal');
  if (!modal) {
    modal = createLearningGoalModalElement();
    document.body.appendChild(modal);
  }
  renderLearningGoalModalContent();
  modal.style.display = 'flex';
  setTimeout(() => {
    modal!.style.opacity = '1';
  }, 10);
}

export function closeLearningGoalModal(): void {
  const modal = document.getElementById('learningGoalModal');
  if (!modal) return;
  modal.style.opacity = '0';
  setTimeout(() => {
    modal.style.display = 'none';
  }, 200);
}

function renderLearningGoalModalContent(): void {
  const body = document.getElementById('learningGoalModalBody');
  if (!body) return;
  ensureLearningGoalFresh();
  const g = Store.state.learningGoal!;
  const percent = getLearningGoalPercent();
  const options = [5, 10, 20, 30];
  body.innerHTML = `
    <div class="lg-ring-section">
      <svg class="lg-big-ring" width="120" height="120" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(0,0,0,0.08)" stroke-width="6"/>
        <circle class="lg-big-progress" cx="32" cy="32" r="26" fill="none" stroke="url(#lgGrad)" stroke-width="6" stroke-linecap="round" transform="rotate(-90 32 32)" />
        <defs><linearGradient id="lgGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c6bff"/><stop offset="1" stop-color="#4ecdc4"/></linearGradient></defs>
        <text x="32" y="34" text-anchor="middle" font-size="11" font-weight="900" fill="var(--trackA)">${g.dailyCompleted}/${g.dailyTarget}</text>
      </svg>
      <div class="lg-percent">${percent}%</div>
    </div>
    <div class="lg-target-section">
      <div class="lg-section-title">每日目标</div>
      <div class="lg-target-options">
        ${options
          .map(
            (o) =>
              `<button class="lg-target-btn${g.dailyTarget === o ? ' active' : ''}" data-action="setLearningDailyTarget" data-args='[${o}]'>${o} 题</button>`
          )
          .join('')}
      </div>
    </div>
    <div class="lg-stats-grid">
      <div class="lg-stat"><div class="lg-stat-num">${g.dailyStreakMet}</div><div class="lg-stat-label">连续达标</div></div>
      <div class="lg-stat"><div class="lg-stat-num">${g.bestDailyStreak}</div><div class="lg-stat-label">最佳记录</div></div>
      <div class="lg-stat"><div class="lg-stat-num">${g.weeklyCompleted}</div><div class="lg-stat-label">本周完成</div></div>
      <div class="lg-stat"><div class="lg-stat-num">${g.weeklyTarget}</div><div class="lg-stat-label">周目标</div></div>
    </div>
  `;
  // 设置进度环
  const circ = 2 * Math.PI * 26;
  const offset = circ * (1 - percent / 100);
  const prog = body.querySelector('.lg-big-progress') as HTMLElement | null;
  if (prog) {
    prog.style.strokeDasharray = String(circ);
    prog.style.strokeDashoffset = String(offset);
  }
}

function createLearningGoalModalElement(): HTMLElement {
  const modal = document.createElement('div');
  modal.id = 'learningGoalModal';
  modal.className = 'share-card-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', '学习目标');
  modal.innerHTML = `
    <div class="share-card-box lg-box">
      <div class="share-card-header">
        <span class="share-card-title">🎯 学习目标</span>
        <button class="ctrl-btn share-card-close" data-action="closeLearningGoalModal" aria-label="关闭">✕</button>
      </div>
      <div class="lg-body" id="learningGoalModalBody"></div>
      <button class="ctrl-btn" data-action="closeLearningGoalModal">完成</button>
    </div>
  `;
  return modal;
}
