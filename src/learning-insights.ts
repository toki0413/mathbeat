/**
 * 学习洞察模块（对标 Khan Academy 的 Mastery / Duolingo 的 Weakness）
 *
 * 三大能力：
 *  1. 错题本：记录答错的题目，支持查看与清除
 *  2. 薄弱点识别：按世界分组统计错题数 + 低星关卡，推荐复习
 *  3. 学习曲线趋势图：基于 adaptiveHistory 绘制最近 20 次得分趋势
 *
 * 数据来源：Store.state.wrongAnswerHistory + adaptiveHistory + progress
 */
import { Store, type WrongAnswerRecord } from './store';
import { WORLDS, LEVELS } from './worlds';
import { showToast } from './ui-feedback';
import { registerActions } from './events';

/* ============================================================
 * 1. 错题记录
 * ============================================================ */

/** 错题本最大容量，超出后自动剔除最旧的（FIFO）。 */
export const MAX_WRONG_ANSWERS = 50;

/** 记录一道错题。 */
export function recordWrongAnswer(rec: Omit<WrongAnswerRecord, 'timestamp'>): void {
  if (!Store.state.wrongAnswerHistory) Store.state.wrongAnswerHistory = [];
  const entry: WrongAnswerRecord = { ...rec, timestamp: Date.now() };
  Store.state.wrongAnswerHistory.push(entry);
  // 控制容量
  if (Store.state.wrongAnswerHistory.length > MAX_WRONG_ANSWERS) {
    Store.state.wrongAnswerHistory = Store.state.wrongAnswerHistory.slice(-MAX_WRONG_ANSWERS);
  }
  Store.save();
}

/** 清空错题本。 */
export function clearWrongAnswers(): void {
  Store.state.wrongAnswerHistory = [];
  Store.save();
  renderWrongAnswerBook();
  try {
    showToast('错题本已清空', 'info', 2000);
  } catch (e) {
    /* ignore */
  }
}

/** 删除单条错题。 */
export function removeWrongAnswer(e: Event | unknown, ...args: unknown[]): void {
  const ts = args.length > 0 ? (args[0] as number) : (e as number);
  if (!Store.state.wrongAnswerHistory) return;
  Store.state.wrongAnswerHistory = Store.state.wrongAnswerHistory.filter((r) => r.timestamp !== ts);
  Store.save();
  renderWrongAnswerBook();
}

/* ============================================================
 * 2. 薄弱点识别
 * ============================================================ */

export interface WeakPoint {
  worldId: number;
  worldName: string;
  worldEmoji: string;
  wrongCount: number;
  lowStarLevels: { id: string; name: string; stars: number }[];
  /** 综合薄弱分（0-100，越高越薄弱）。 */
  score: number;
}

/** 识别薄弱点：按世界聚合错题数 + 1 星/0 星关卡。 */
export function identifyWeakPoints(): WeakPoint[] {
  const wrongs = Store.state.wrongAnswerHistory || [];
  const progress = Store.state.progress || {};
  const result: WeakPoint[] = [];

  for (const w of WORLDS) {
    const wrongCount = wrongs.filter((r) => r.worldId === w.id).length;
    const levels = LEVELS[w.id] || [];
    const lowStarLevels = levels
      .filter((l) => {
        const s = progress[l.id] || 0;
        return s < 2; // 0 星（未通关）或 1 星
      })
      .map((l) => ({ id: l.id, name: l.name, stars: progress[l.id] || 0 }))
      .slice(0, 3);

    // 综合分：错题数 × 8 + 低星关卡数 × 15
    const score = Math.min(100, wrongCount * 8 + lowStarLevels.length * 15);
    if (wrongCount > 0 || lowStarLevels.length > 0) {
      result.push({
        worldId: w.id,
        worldName: w.name,
        worldEmoji: w.emoji,
        wrongCount,
        lowStarLevels,
        score,
      });
    }
  }
  return result.sort((a, b) => b.score - a.score);
}

/* ============================================================
 * 2.5 今日推荐 3 题（基于薄弱点 + 错题历史）
 * ============================================================ */

export interface RecommendedLevel {
  levelId: string;
  worldId: number;
  worldName: string;
  worldEmoji: string;
  levelName: string;
  levelDesc: string;
  /** 当前星级（0-3，0 表示未通关）。 */
  stars: number;
  /** 推荐理由。 */
  reason: string;
  /** 推荐强度（0-100，越高越优先）。 */
  priority: number;
}

/**
 * 基于薄弱点 + 错题历史生成今日推荐 3 题。
 * 策略：
 *  1. 优先推荐错题数最多的世界中的低星关卡（重练）
 *  2. 其次推荐未通关的关卡（推动进度）
 *  3. 不足 3 题时用下一关（推进）补齐
 *  返回的关卡已解锁（前置 boss 已通过）
 */
export function generateDailyRecommendations(): RecommendedLevel[] {
  const weakPoints = identifyWeakPoints();
  const progress = Store.state.progress || {};
  const recommendations: RecommendedLevel[] = [];
  const seen = new Set<string>();

  // 工具：检查关卡是否已解锁
  const isUnlocked = (wid: number, lid: string): boolean => {
    if (wid === 1) return true;
    const bossId = wid - 1 + '-B';
    return (progress[bossId] || 0) >= 1;
  };

  // 第一轮：从薄弱世界中挑选低星关卡
  for (const wp of weakPoints) {
    if (recommendations.length >= 3) break;
    for (const lv of wp.lowStarLevels) {
      if (recommendations.length >= 3) break;
      if (seen.has(lv.id)) continue;
      if (!isUnlocked(wp.worldId, lv.id)) continue;
      const w = WORLDS.find((x) => x.id === wp.worldId);
      const level = (LEVELS[wp.worldId] || []).find((l) => l.id === lv.id);
      if (!w || !level) continue;
      seen.add(lv.id);
      recommendations.push({
        levelId: lv.id,
        worldId: wp.worldId,
        worldName: wp.worldName,
        worldEmoji: wp.worldEmoji,
        levelName: level.name,
        levelDesc: level.desc,
        stars: lv.stars,
        reason: lv.stars === 0 ? '尚未通关，推荐挑战' : '当前低星，建议重练提升',
        priority: 80 - recommendations.length * 10,
      });
    }
  }

  // 第二轮：找未通关的关卡（推动进度）
  if (recommendations.length < 3) {
    for (let wid = 1; wid <= 8 && recommendations.length < 3; wid++) {
      const levels = LEVELS[wid] || [];
      for (const level of levels) {
        if (recommendations.length >= 3) break;
        if (seen.has(level.id)) continue;
        if (!isUnlocked(wid, level.id)) continue;
        const s = progress[level.id] || 0;
        if (s === 0) {
          // 找到第一个未通关关卡
          seen.add(level.id);
          const w = WORLDS.find((x) => x.id === wid);
          if (!w) continue;
          recommendations.push({
            levelId: level.id,
            worldId: wid,
            worldName: w.name,
            worldEmoji: w.emoji,
            levelName: level.name,
            levelDesc: level.desc,
            stars: 0,
            reason: '推进进度，开启新内容',
            priority: 50,
          });
          break; // 每个世界只推一个未通关关卡
        }
      }
    }
  }

  // 第三轮：用已通关但未满星的关卡补齐（追求三星）
  if (recommendations.length < 3) {
    for (let wid = 1; wid <= 8 && recommendations.length < 3; wid++) {
      const levels = LEVELS[wid] || [];
      for (const level of levels) {
        if (recommendations.length >= 3) break;
        if (seen.has(level.id)) continue;
        if (!isUnlocked(wid, level.id)) continue;
        const s = progress[level.id] || 0;
        if (s > 0 && s < 3) {
          seen.add(level.id);
          const w = WORLDS.find((x) => x.id === wid);
          if (!w) continue;
          recommendations.push({
            levelId: level.id,
            worldId: wid,
            worldName: w.name,
            worldEmoji: w.emoji,
            levelName: level.name,
            levelDesc: level.desc,
            stars: s,
            reason: '冲击三星，巩固掌握',
            priority: 30,
          });
        }
      }
    }
  }

  return recommendations.slice(0, 3);
}

/* ============================================================
 * 3. 学习曲线趋势图
 * ============================================================ */

export interface LearningCurvePoint {
  levelId: string;
  stars: number;
  time: number;
}

/** 获取最近 N 次学习记录（用于绘制趋势图）。 */
export function getLearningCurve(limit = 20): LearningCurvePoint[] {
  const h = (Store.state.adaptiveHistory || []) as { levelId: string; stars: number; time: number }[];
  return h.slice(-limit).map((r) => ({ levelId: r.levelId, stars: r.stars, time: r.time }));
}

/** 在 Canvas 上绘制学习曲线。 */
export function drawLearningCurve(canvasId: string): void {
  if (typeof document === 'undefined') return;
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const data = getLearningCurve(20);
  const W = canvas.width;
  const H = canvas.height;
  // 清空
  ctx.clearRect(0, 0, W, H);

  if (data.length === 0) {
    ctx.fillStyle = '#999';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('暂无学习数据，完成关卡后显示趋势', W / 2, H / 2);
    return;
  }

  const padding = { top: 16, right: 16, bottom: 24, left: 28 };
  const plotW = W - padding.left - padding.right;
  const plotH = H - padding.top - padding.bottom;

  // 背景网格（0/1/2/3 星横线）
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#999';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'right';
  for (let s = 0; s <= 3; s++) {
    const y = padding.top + plotH * (1 - s / 3);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(W - padding.right, y);
    ctx.stroke();
    ctx.fillText(String(s) + '★', padding.left - 4, y + 3);
  }

  // 数据点坐标
  const points = data.map((d, i) => {
    const x = padding.left + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
    const y = padding.top + plotH * (1 - d.stars / 3);
    return { x, y, d };
  });

  // 渐变填充区域
  const grad = ctx.createLinearGradient(0, padding.top, 0, H - padding.bottom);
  grad.addColorStop(0, 'rgba(124, 107, 255, 0.3)');
  grad.addColorStop(1, 'rgba(124, 107, 255, 0.02)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(points[0].x, H - padding.bottom);
  for (const p of points) ctx.lineTo(p.x, p.y);
  ctx.lineTo(points[points.length - 1].x, H - padding.bottom);
  ctx.closePath();
  ctx.fill();

  // 折线
  ctx.strokeStyle = '#7c6bff';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    if (i === 0) ctx.moveTo(points[i].x, points[i].y);
    else ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();

  // 数据点
  for (const p of points) {
    ctx.fillStyle = p.d.stars >= 3 ? '#4ecdc4' : p.d.stars >= 2 ? '#7c6bff' : '#ff8c42';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // 平均分标注
  const avg = data.reduce((s, d) => s + d.stars, 0) / data.length;
  ctx.fillStyle = '#555';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('平均 ' + avg.toFixed(1) + '★ · 共 ' + data.length + ' 次', padding.left, H - 6);
}

/* ============================================================
 * 4. UI：学习洞察 Modal
 * ============================================================ */

export function openLearningInsights(): void {
  if (typeof document === 'undefined') return;
  let modal = document.getElementById('learningInsightsModal');
  if (!modal) {
    modal = createLearningInsightsModal();
    document.body.appendChild(modal);
  }
  renderLearningInsights();
  modal.style.display = 'flex';
  setTimeout(() => {
    modal!.style.opacity = '1';
  }, 10);
}

export function closeLearningInsights(): void {
  const modal = document.getElementById('learningInsightsModal');
  if (!modal) return;
  modal.style.opacity = '0';
  setTimeout(() => {
    modal.style.display = 'none';
  }, 200);
}

function renderLearningInsights(): void {
  // Tab 切换默认显示薄弱点
  renderWeakPointsTab();
}

function renderWeakPointsTab(): void {
  const body = document.getElementById('liWeakPoints');
  if (!body) return;
  const wps = identifyWeakPoints();
  if (wps.length === 0) {
    body.innerHTML =
      '<div class="li-empty">🎉 暂无薄弱点，继续保持！<br><span class="li-empty-sub">完成更多关卡以生成个性化分析</span></div>';
    return;
  }
  body.innerHTML = wps
    .slice(0, 5)
    .map((wp) => {
      const barColor = wp.score >= 60 ? '#ff8c42' : wp.score >= 30 ? '#ffb347' : '#4ecdc4';
      const levelChips =
        wp.lowStarLevels.length > 0
          ? '<div class="li-wp-levels">' +
            wp.lowStarLevels
              .map(
                (l) =>
                  `<span class="li-wp-chip" title="${escapeText(l.name)}">${l.id} ${l.stars}★</span>`
              )
              .join('') +
            '</div>'
          : '';
      return `
        <div class="li-wp-card">
          <div class="li-wp-header">
            <span class="li-wp-emoji">${wp.worldEmoji}</span>
            <span class="li-wp-name">${escapeText(wp.worldName)}</span>
            <span class="li-wp-wrong">❌ ${wp.wrongCount} 错</span>
          </div>
          <div class="li-wp-bar"><div class="li-wp-bar-fill" style="width:${wp.score}%;background:${barColor}"></div></div>
          ${levelChips}
        </div>
      `;
    })
    .join('');
}

function renderWrongAnswerBook(): void {
  const body = document.getElementById('liWrongAnswers');
  if (!body) return;
  const wrongs = (Store.state.wrongAnswerHistory || []).slice().reverse(); // 最新在前
  if (wrongs.length === 0) {
    body.innerHTML =
      '<div class="li-empty">📖 错题本为空<br><span class="li-empty-sub">答错时会自动记录到这里</span></div>';
    return;
  }
  const items = wrongs
    .slice(0, 30)
    .map((r) => {
      const date = new Date(r.timestamp);
      const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      // worldId 为 0 表示每日挑战，否则从 WORLDS 取 emoji
      const emoji = r.worldId > 0 ? (WORLDS.find((w) => w.id === r.worldId)?.emoji || '') : '📅';
      return `
        <div class="li-wa-item">
          <div class="li-wa-meta"><span class="li-wa-world">${emoji} ${escapeText(r.worldName)}</span><span class="li-wa-date">${dateStr}</span></div>
          <div class="li-wa-q">${escapeText(r.questionText)}</div>
          <div class="li-wa-answers"><span class="li-wa-correct">✓ ${escapeText(String(r.correctAnswer))}</span><span class="li-wa-user">✗ ${escapeText(String(r.userAnswer))}</span></div>
          <button class="li-wa-del" data-action="removeWrongAnswer" data-args='[${r.timestamp}]' aria-label="删除">✕</button>
        </div>
      `;
    })
    .join('');
  body.innerHTML =
    `<div class="li-wa-toolbar"><span>共 ${wrongs.length} 条</span><button class="li-wa-clear" data-action="clearWrongAnswers">清空</button></div>` +
    items;
}

function renderLearningCurveTab(): void {
  const body = document.getElementById('liCurve');
  if (!body) return;
  const data = getLearningCurve(20);
  const avg = data.length > 0 ? (data.reduce((s, d) => s + d.stars, 0) / data.length).toFixed(2) : '—';
  const best = data.length > 0 ? Math.max(...data.map((d) => d.stars)) : '—';
  body.innerHTML = `
    <div class="li-curve-stats">
      <div class="li-curve-stat"><div class="li-curve-num">${data.length}</div><div class="li-curve-label">总练习</div></div>
      <div class="li-curve-stat"><div class="li-curve-num">${avg}</div><div class="li-curve-label">平均星级</div></div>
      <div class="li-curve-stat"><div class="li-curve-num">${best}</div><div class="li-curve-label">最高星级</div></div>
    </div>
    <canvas id="learningCurveCanvas" width="340" height="180" style="width:100%;max-width:340px;display:block;margin:8px auto"></canvas>
    <div class="li-curve-legend"><span class="dot" style="background:#4ecdc4"></span>3★ <span class="dot" style="background:#7c6bff"></span>2★ <span class="dot" style="background:#ff8c42"></span>0-1★</div>
  `;
  // 延迟绘制确保 canvas 已挂载
  setTimeout(() => drawLearningCurve('learningCurveCanvas'), 30);
}

/** Tab 切换。 */
export function switchInsightsTab(e: Event | unknown, ...args: unknown[]): void {
  const tab = args.length > 0 ? (args[0] as string) : (e as string);
  // 更新 tab 按钮状态
  document.querySelectorAll('.li-tab').forEach((b) => b.classList.remove('active'));
  const btn = document.querySelector(`.li-tab[data-tab="${tab}"]`);
  if (btn) btn.classList.add('active');
  // 切换面板
  document.querySelectorAll('.li-panel').forEach((p) => (p as HTMLElement).style.display = 'none');
  const panel = document.getElementById('liPanel' + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (panel) panel.style.display = '';
  // 按需渲染
  if (tab === 'weakPoints') renderWeakPointsTab();
  else if (tab === 'wrongAnswers') renderWrongAnswerBook();
  else if (tab === 'curve') renderLearningCurveTab();
}

function createLearningInsightsModal(): HTMLElement {
  const modal = document.createElement('div');
  modal.id = 'learningInsightsModal';
  modal.className = 'share-card-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', '学习洞察');
  modal.innerHTML = `
    <div class="share-card-box li-box">
      <div class="share-card-header">
        <span class="share-card-title">📊 学习洞察</span>
        <button class="ctrl-btn share-card-close" data-action="closeLearningInsights" aria-label="关闭">✕</button>
      </div>
      <div class="li-tabs">
        <button class="li-tab active" data-tab="weakPoints" data-action="switchInsightsTab" data-args='["weakPoints"]'>🎯 薄弱点</button>
        <button class="li-tab" data-tab="wrongAnswers" data-action="switchInsightsTab" data-args='["wrongAnswers"]'>📖 错题本</button>
        <button class="li-tab" data-tab="curve" data-action="switchInsightsTab" data-args='["curve"]'>📈 学习曲线</button>
      </div>
      <div class="li-body">
        <div class="li-panel" id="liPanelWeakPoints"></div>
        <div class="li-panel" id="liPanelWrongAnswers" style="display:none"></div>
        <div class="li-panel" id="liPanelCurve" style="display:none"></div>
      </div>
      <button class="ctrl-btn" data-action="closeLearningInsights">关闭</button>
    </div>
  `;
  // 修正面板 id（switchInsightsTab 用 liPanel + Capitalized）
  return modal;
}

/** 渲染薄弱点时需要的 panel id 校正：liPanelWeakPoints 等。 */

/* ============================================================
 * 5. 辅助
 * ============================================================ */

function escapeText(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

/* ============================================================
 * 6. 注册 actions 与全局暴露
 * ============================================================ */

registerActions({
  openLearningInsights,
  closeLearningInsights,
  switchInsightsTab,
  clearWrongAnswers,
  removeWrongAnswer,
});

if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    openLearningInsights,
    closeLearningInsights,
    switchInsightsTab,
    clearWrongAnswers,
    removeWrongAnswer,
    recordWrongAnswer,
    identifyWeakPoints,
    drawLearningCurve,
    generateDailyRecommendations,
  });
}
