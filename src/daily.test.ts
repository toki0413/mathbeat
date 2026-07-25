import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Store, DEFAULT_STATE } from './store';

// mock 副作用依赖
vi.mock('./game-engine', () => ({
  state: { currentWorld: 1, currentLevel: 0 },
  stopAllPlayback: vi.fn(),
  checkAchievements: vi.fn(),
}));
vi.mock('./audio', () => ({
  getAudioCtx: () => ({ currentTime: 0, state: 'running', resume: vi.fn() }),
  scheduleToneAt: vi.fn(),
  scheduleKickAt: vi.fn(),
  scheduleSnareAt: vi.fn(),
  getSharedTransport: vi.fn(() => ({
    subscribe: vi.fn(() => () => {}),
    start: vi.fn(),
    stop: vi.fn(),
    setBpm: vi.fn(),
  })),
  stopSharedTransport: vi.fn(),
}));
vi.mock('./events', () => ({ registerActions: vi.fn(), registerInputs: vi.fn() }));
vi.mock('./ui-render', () => ({ renderHome: vi.fn(), showWhy: vi.fn() }));
// 用 vi.hoisted 提升变量，让 mock factory 能引用
const { consumeStreakFreezeMock } = vi.hoisted(() => {
  const consumeStreakFreezeMock = vi.fn((): boolean => {
    // 真实模拟减量；Store 在调用时已就绪
    try {
      // 通过全局对象读取 Store（避免 ESM 循环）
      const w = globalThis as any;
      const Store = w.__testStore;
      if (!Store) return true;
      const cur = (Store.state.streakFreezes || 0) as number;
      if (cur <= 0) return false;
      Store.state.streakFreezes = cur - 1;
      return true;
    } catch (e) {
      return true;
    }
  });
  return { consumeStreakFreezeMock };
});

vi.mock('./progression', () => ({
  addXp: vi.fn(),
  XP_REWARDS: { dailyComplete: 30 },
  tryAwardStreakFreeze: vi.fn(),
  consumeStreakFreeze: consumeStreakFreezeMock,
  recordLearningProgress: vi.fn(),
}));
vi.mock('./learning-insights', () => ({
  recordWrongAnswer: vi.fn(),
}));

import {
  getDailyChallenge,
  getWeekKey,
  updateDailyStreak,
  dailyState,
  startDailyChallenge,
  showDailyFeedback,
  closeDailyModal,
  renderDailyModal,
  renderDailyRing,
  dailyRingToggle,
  dailyRatioChange,
  dailyRatioPlay,
  renderDailyEuclidGrid,
  dailyEuclidToggle,
  dailyEuclidApply,
  toggleDailyPlay,
  stopDailyPlay,
  dailyMathPlay,
  checkDailyAnswer,
  dailyPermAnswer,
  dailyGraphAnswer,
  dailySciencePlay,
  dailyScienceAnswer,
  dailyChallengeSuccess,
  updateDailyBanner,
  showDailyWhy,
} from './daily';

import { recordWrongAnswer } from './learning-insights';
import { addXp, tryAwardStreakFreeze, recordLearningProgress } from './progression';
import { renderHome, showWhy } from './ui-render';
import { stopAllPlayback, checkAchievements } from './game-engine';
import {
  scheduleToneAt,
  scheduleKickAt,
  scheduleSnareAt,
  getSharedTransport,
  stopSharedTransport,
} from './audio';
import { euclideanRhythm } from './utils';

function resetStore() {
  Store.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  Store.listeners = [];
  Store._idbReady = false;
  // 暴露 Store 给 hoisted mock 使用
  (globalThis as any).__testStore = Store;
}

/** 找到对应 type 的某天 */
function findDateForType(targetType: string): Date {
  for (let i = 0; i < 500; i++) {
    const date = new Date('2026-01-01T12:00:00Z');
    date.setUTCDate(date.getUTCDate() + i);
    vi.setSystemTime(date);
    const d = getDailyChallenge();
    if (d.type === targetType) return date;
  }
  throw new Error(`No date found for type ${targetType}`);
}

/** 设置 dailyState.data 用于单类型测试 */
function setDailyData(data: any) {
  dailyState.data = data;
  dailyState.type = data.type;
  dailyState.answer = data.answer;
  dailyState.selected = [];
  dailyState.euclidCells = Array(data.n || 16).fill(0);
  dailyState.playing = false;
  dailyState.transport = null;
  dailyState.autoStopTimer = null;
  dailyState.ratioB = 440;
}

/** 构造一个完整 DOM mock（覆盖 daily modal 各 id） */
function setupDailyDOM() {
  document.body.innerHTML =
    '<div id="dailyModal" style="opacity:0"></div>' +
    '<div id="dailyDate"></div>' +
    '<div id="dailyFeedback"></div>' +
    '<div id="dailyBody"></div>' +
    '<div id="dailyRing"></div>' +
    '<div id="dailyBval"></div>' +
    '<div id="dailyRatioVal"></div>' +
    '<div id="dailyEuclidGrid"></div>' +
    '<div id="dailyChallengeBanner"></div>' +
    '<div id="dailySub"></div>' +
    '<div id="dailyStatus"></div>' +
    '<div id="dailyPlayBtn">▶ 播放</div>';
}

beforeEach(() => {
  resetStore();
  (window as any).spawnConfetti = vi.fn();
});

describe('daily getDailyChallenge 每日挑战生成', () => {
  beforeEach(() => {
    resetStore();
  });

  it('返回包含 type 字段的对象', () => {
    const d = getDailyChallenge();
    expect(d).toBeDefined();
    expect(typeof d.type).toBe('string');
    expect(typeof d.name).toBe('string');
  });

  it('type 必为预定义的 13 种之一', () => {
    const validTypes = [
      'lcm',
      'symmetry',
      'ratio',
      'crt',
      'permutation',
      'euclidean',
      'probability',
      'graph',
      'gcd',
      'fibonacci',
      'mod',
      'series',
      'science',
    ];
    const d = getDailyChallenge();
    expect(validTypes).toContain(d.type);
  });

  it('同一天多次调用返回相同结果（基于 seed）', () => {
    const a = getDailyChallenge();
    const b = getDailyChallenge();
    expect(a.type).toBe(b.type);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('每种 type 都包含 answer 字段', () => {
    const d = getDailyChallenge();
    expect(d.answer).toBeDefined();
  });

  it('lcm 类型 answer 等于 lcmCalc(a,b)', () => {
    // 多次生成不同 seed，验证 lcm 类型时 answer 正确
    // 由于 type 由 seed 决定，这里仅验证已知 type 时的字段
    const d = getDailyChallenge();
    if (d.type === 'lcm') {
      const a = d.a as number;
      const b = d.b as number;
      // 验证 answer 是 a,b 的最小公倍数
      const gcd = (x: number, y: number): number => (y === 0 ? x : gcd(y, x % y));
      const expectedLcm = (a * b) / gcd(a, b);
      expect(d.answer).toBe(expectedLcm);
    }
  });

  it('gcd 类型 answer 等于 gcd(a,b)', () => {
    const d = getDailyChallenge();
    if (d.type === 'gcd') {
      const a = d.a as number;
      const b = d.b as number;
      const gcd = (x: number, y: number): number => (y === 0 ? x : gcd(y, x % y));
      expect(d.answer).toBe(gcd(a, b));
    }
  });

  it('probability 类型 answer = round(n*p/100)', () => {
    const d = getDailyChallenge();
    if (d.type === 'probability') {
      const expected = Math.round(((d.n as number) * (d.p as number)) / 100);
      expect(d.answer).toBe(expected);
    }
  });

  it('mod 类型 answer = a mod b', () => {
    const d = getDailyChallenge();
    if (d.type === 'mod') {
      const a = d.a as number;
      const b = d.b as number;
      expect(d.answer).toBe(a % b);
    }
  });

  it('series 类型 answer = seq 最后项 + diff', () => {
    const d = getDailyChallenge();
    if (d.type === 'series') {
      const seq = d.seq as number[];
      const diff = d.diff as number;
      expect(d.answer).toBe(seq[seq.length - 1] + diff);
    }
  });

  it('fibonacci 类型 answer = seq 最后项', () => {
    const d = getDailyChallenge();
    if (d.type === 'fibonacci') {
      const seq = d.seq as number[];
      expect(d.answer).toBe(seq[seq.length - 1]);
    }
  });

  it('crt 类型 answer 满足同余条件', () => {
    const d = getDailyChallenge();
    if (d.type === 'crt') {
      const x = d.answer as number;
      const m1 = d.m1 as number;
      const m2 = d.m2 as number;
      const r1 = d.r1 as number;
      const r2 = d.r2 as number;
      expect(x % m1).toBe(r1);
      expect(x % m2).toBe(r2);
      expect(x).toBeGreaterThan(0);
    }
  });
});

describe('daily getDailyChallenge 全类型覆盖', () => {
  beforeEach(() => {
    resetStore();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const allTypes = [
    'lcm',
    'symmetry',
    'ratio',
    'crt',
    'permutation',
    'euclidean',
    'probability',
    'graph',
    'gcd',
    'fibonacci',
    'mod',
    'series',
    'science',
  ];

  for (const t of allTypes) {
    it(`type=${t} 字段齐全且满足约束`, () => {
      const date = findDateForType(t);
      vi.setSystemTime(date);
      const d = getDailyChallenge();
      expect(d.type).toBe(t);
      if (t === 'lcm') {
        expect(typeof d.a).toBe('number');
        expect(typeof d.b).toBe('number');
        expect(d.answer).toBeGreaterThan(0);
      } else if (t === 'symmetry') {
        expect(Array.isArray(d.answer)).toBe(true);
        expect(d.answer.length).toBe(3);
      } else if (t === 'ratio') {
        expect(typeof d.target).toBe('number');
        expect(typeof d.tolerance).toBe('number');
      } else if (t === 'crt') {
        expect(d.answer % d.m1).toBe(d.r1);
        expect(d.answer % d.m2).toBe(d.r2);
      } else if (t === 'permutation') {
        expect(Array.isArray(d.motive)).toBe(true);
        expect(Array.isArray(d.row)).toBe(true);
        expect(typeof d.answer).toBe('boolean');
      } else if (t === 'euclidean') {
        expect(typeof d.k).toBe('number');
        expect(typeof d.n).toBe('number');
        expect(Array.isArray(d.answer)).toBe(true);
        expect(d.answer.length).toBe(d.n);
        expect(d.answer.reduce((s: number, x: number) => s + x, 0)).toBe(d.k);
      } else if (t === 'probability') {
        expect(d.answer).toBe(Math.round((d.n * d.p) / 100));
      } else if (t === 'graph') {
        expect(Array.isArray(d.edges)).toBe(true);
        expect(Array.isArray(d.path)).toBe(true);
        expect(typeof d.answer).toBe('boolean');
      } else if (t === 'gcd') {
        const gcd = (x: number, y: number): number => (y === 0 ? x : gcd(y, x % y));
        expect(d.answer).toBe(gcd(d.a, d.b));
      } else if (t === 'fibonacci') {
        expect(Array.isArray(d.seq)).toBe(true);
        expect(d.answer).toBe(d.seq[d.seq.length - 1]);
      } else if (t === 'mod') {
        expect(d.answer).toBe(d.a % d.b);
      } else if (t === 'series') {
        expect(Array.isArray(d.seq)).toBe(true);
        expect(d.answer).toBe(d.seq[d.seq.length - 1] + d.diff);
      } else if (t === 'science') {
        expect(Array.isArray(d.options)).toBe(true);
        expect(d.options.length).toBe(4);
        expect(typeof d.answer).toBe('string');
        expect(d.sample).toBeDefined();
      }
    });
  }
});

describe('daily getWeekKey 周标识', () => {
  it('返回 YYYY-MM-DD 字串（周一为起点）', () => {
    const key = getWeekKey();
    expect(typeof key).toBe('string');
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('同周内调用返回相同值', () => {
    const a = getWeekKey();
    const b = getWeekKey();
    expect(a).toBe(b);
  });

  it('周日和下周一 weekKey 相同（源码 getDay()+1 逻辑）', () => {
    vi.useFakeTimers();
    // 2026-07-19 是周日（getDay=0）
    vi.setSystemTime(new Date('2026-07-19T12:00:00Z'));
    const sundayKey = getWeekKey();
    // 2026-07-20 是下周一
    vi.setSystemTime(new Date('2026-07-20T12:00:00Z'));
    const nextMondayKey = getWeekKey();
    // 源码 d.setDate(d.getDate() - d.getDay() + 1) 在周日会把日期设为下周一
    expect(sundayKey).toBe(nextMondayKey);
    vi.useRealTimers();
  });

  it('跨周返回不同 weekKey', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-13T12:00:00Z'));
    const w1 = getWeekKey();
    vi.setSystemTime(new Date('2026-07-20T12:00:00Z'));
    const w2 = getWeekKey();
    expect(w1).not.toBe(w2);
    vi.useRealTimers();
  });
});

describe('daily updateDailyStreak 连胜更新', () => {
  beforeEach(() => {
    resetStore();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('首次打卡 streak=1', () => {
    vi.setSystemTime(new Date('2026-07-22T12:00:00Z'));
    Store.state.dailyStreak = 0;
    Store.state.dailyLastDate = '';
    updateDailyStreak();
    expect(Store.state.dailyStreak).toBe(1);
    expect(Store.state.dailyLastDate).toBe('2026-07-22');
  });

  it('昨日已打卡则 streak +1', () => {
    vi.setSystemTime(new Date('2026-07-22T12:00:00Z'));
    Store.state.dailyStreak = 5;
    Store.state.dailyLastDate = '2026-07-21';
    updateDailyStreak();
    expect(Store.state.dailyStreak).toBe(6);
  });

  it('同日重复打卡不增加 streak', () => {
    vi.setSystemTime(new Date('2026-07-22T12:00:00Z'));
    Store.state.dailyStreak = 5;
    Store.state.dailyLastDate = '2026-07-22';
    updateDailyStreak();
    expect(Store.state.dailyStreak).toBe(5);
  });

  it('断签且无护盾时 streak 重置为 1', () => {
    vi.setSystemTime(new Date('2026-07-22T12:00:00Z'));
    Store.state.dailyStreak = 10;
    Store.state.dailyLastDate = '2026-07-18'; // 4 天前断签
    Store.state.streakFreezes = 0;
    updateDailyStreak();
    expect(Store.state.dailyStreak).toBe(1);
  });

  it('断签但有护盾时护盾消耗并延续连胜 +1', () => {
    vi.setSystemTime(new Date('2026-07-22T12:00:00Z'));
    Store.state.dailyStreak = 10;
    Store.state.dailyLastDate = '2026-07-18';
    Store.state.streakFreezes = 2;
    updateDailyStreak();
    expect(Store.state.dailyStreak).toBe(11);
    expect(Store.state.streakFreezes).toBe(1);
  });

  it('断签且有护盾但 prevStreak=0 时不消耗护盾', () => {
    vi.setSystemTime(new Date('2026-07-22T12:00:00Z'));
    Store.state.dailyStreak = 0;
    Store.state.dailyLastDate = '2026-07-18';
    Store.state.streakFreezes = 2;
    updateDailyStreak();
    // prevStreak === 0 时不进入 consumeStreakFreeze 分支
    expect(Store.state.dailyStreak).toBe(1);
    expect(Store.state.streakFreezes).toBe(2);
  });

  it('跨日（昨日打卡）继续连胜', () => {
    vi.setSystemTime(new Date('2026-07-23T00:30:00Z'));
    Store.state.dailyStreak = 6;
    Store.state.dailyLastDate = '2026-07-22';
    updateDailyStreak();
    expect(Store.state.dailyStreak).toBe(7);
  });

  it('连签 7 天无护盾奖励场景下 streak 单调递增', () => {
    vi.setSystemTime(new Date('2026-07-15T12:00:00Z'));
    Store.state.dailyStreak = 0;
    Store.state.dailyLastDate = '';
    for (let i = 0; i < 7; i++) {
      const date = new Date('2026-07-15T12:00:00Z');
      date.setUTCDate(date.getUTCDate() + i);
      vi.setSystemTime(date);
      updateDailyStreak();
    }
    expect(Store.state.dailyStreak).toBe(7);
  });
});

describe('daily startDailyChallenge 启动挑战', () => {
  beforeEach(() => {
    resetStore();
    setupDailyDOM();
  });

  it('初始化 dailyState 并显示 modal', () => {
    startDailyChallenge();
    expect(dailyState).toBeDefined();
    expect(dailyState.type).toBeTruthy();
    expect(dailyState.answer).toBeDefined();
    expect(dailyState.data).toBeDefined();
  });

  it('显示 modal 并设置 opacity', () => {
    vi.useFakeTimers();
    startDailyChallenge();
    const modal = document.getElementById('dailyModal')!;
    expect(modal.style.display).toBe('flex');
    // 触发 setTimeout 回调
    vi.advanceTimersByTime(20);
    expect(modal.style.opacity).toBe('1');
    vi.useRealTimers();
  });

  it('设置 dailyDate 为今日日期', () => {
    startDailyChallenge();
    const date = document.getElementById('dailyDate')!.textContent;
    expect(date).toBeTruthy();
  });

  it('初始化时调用 stopAllPlayback', () => {
    startDailyChallenge();
    expect(stopAllPlayback).toHaveBeenCalled();
  });

  it('清空 feedback', () => {
    document.getElementById('dailyFeedback')!.textContent = '残留文字';
    startDailyChallenge();
    expect(document.getElementById('dailyFeedback')!.textContent).toBe('');
  });

  it('euclidean 类型时初始化 euclidCells 为 n 长度', () => {
    vi.useFakeTimers();
    // 找到 euclidean 那天
    const date = findDateForType('euclidean');
    vi.setSystemTime(date);
    startDailyChallenge();
    expect(dailyState.euclidCells.length).toBe(dailyState.data.n);
    vi.useRealTimers();
  });
});

describe('daily showDailyFeedback 反馈显示', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="dailyFeedback"></div>';
  });

  it('success=true 显示 ✅', () => {
    showDailyFeedback('答对了', true);
    const fb = document.getElementById('dailyFeedback')!;
    expect(fb.innerHTML).toContain('✅');
    expect(fb.innerHTML).toContain('答对了');
  });

  it('success=false 显示 ❌', () => {
    showDailyFeedback('再想想', false);
    const fb = document.getElementById('dailyFeedback')!;
    expect(fb.innerHTML).toContain('❌');
    expect(fb.innerHTML).toContain('再想想');
  });

  it('使用 var(--success) / var(--error) 颜色变量', () => {
    showDailyFeedback('成功', true);
    expect(document.getElementById('dailyFeedback')!.innerHTML).toContain('var(--success)');
    showDailyFeedback('失败', false);
    expect(document.getElementById('dailyFeedback')!.innerHTML).toContain('var(--error)');
  });
});

describe('daily renderDailyModal 各类型渲染', () => {
  beforeEach(() => {
    resetStore();
    setupDailyDOM();
  });

  it('lcm 类型渲染输入框与播放按钮', () => {
    setDailyData({ type: 'lcm', a: 3, b: 4, answer: 12, name: '最小公倍数' });
    renderDailyModal();
    const body = document.getElementById('dailyBody')!.innerHTML;
    expect(body).toContain('dailyInput');
    expect(body).toContain('toggleDailyPlay');
  });

  it('symmetry 类型渲染圆环', () => {
    setDailyData({ type: 'symmetry', chord: [0, 4, 8], answer: [0, 4, 8], name: '对称群' });
    renderDailyModal();
    expect(document.getElementById('dailyBody')!.innerHTML).toContain('dailyRing');
  });

  it('ratio 类型渲染滑块并调用 dailyRatioChange', () => {
    setDailyData({ type: 'ratio', target: 660, answer: 660, tolerance: 5, name: '频率比' });
    renderDailyModal();
    const body = document.getElementById('dailyBody')!.innerHTML;
    expect(body).toContain('dailyRatioSlider');
    expect(body).toContain('dailyBval');
  });

  it('crt 类型渲染同余输入', () => {
    setDailyData({ type: 'crt', m1: 3, m2: 5, r1: 1, r2: 2, answer: 7, name: '中国剩余定理' });
    renderDailyModal();
    const body = document.getElementById('dailyBody')!.innerHTML;
    expect(body).toContain('dailyCrtInput');
    expect(body).toContain('x ≡ 1 (mod 3)');
  });

  it('permutation 类型渲染动机与排列', () => {
    setDailyData({
      type: 'permutation',
      motif: [0, 2, 4, 7],
      row: [2, 0, 7, 4],
      answer: true,
      name: '排列',
    });
    renderDailyModal();
    const body = document.getElementById('dailyBody')!.innerHTML;
    expect(body).toContain('dailyPermAnswer');
    expect(body).toContain('原动机');
  });

  it('euclidean 类型渲染网格', () => {
    setDailyData({ type: 'euclidean', k: 3, n: 8, answer: [1, 0, 1, 0, 0, 1, 0, 0], name: '欧几里得算法' });
    renderDailyModal();
    const body = document.getElementById('dailyBody')!.innerHTML;
    expect(body).toContain('dailyEuclidGrid');
    expect(body).toContain('E(3,8)');
  });

  it('probability 类型渲染期望输入', () => {
    setDailyData({ type: 'probability', n: 20, p: 30, answer: 6, name: '概率' });
    renderDailyModal();
    const body = document.getElementById('dailyBody')!.innerHTML;
    expect(body).toContain('dailyProbInput');
  });

  it('graph 类型渲染路径与判断按钮', () => {
    setDailyData({
      type: 'graph',
      edges: [[0, 1]],
      path: [0, 1, 2],
      answer: true,
      name: '图论',
    });
    renderDailyModal();
    const body = document.getElementById('dailyBody')!.innerHTML;
    expect(body).toContain('dailyGraphAnswer');
    expect(body).toContain('I → IV → V');
  });

  it('gcd 类型渲染 desc 与试听按钮', () => {
    setDailyData({
      type: 'gcd',
      a: 12,
      b: 8,
      answer: 4,
      name: '最大公约拍',
      desc: '两段循环分别为 12 拍和 8 拍，能共同划分成的最大小节长度是几拍？',
    });
    renderDailyModal();
    const body = document.getElementById('dailyBody')!.innerHTML;
    expect(body).toContain('GCD(12,8)');
    expect(body).toContain('dailyMathPlay');
  });

  it('fibonacci 类型渲染序列', () => {
    setDailyData({
      type: 'fibonacci',
      seq: [2, 3, 5, 8, 13, 21, 34],
      answer: 34,
      name: '黄金节奏列',
      desc: '每个节奏块的长度等于前两个块之和，下一个块应占几拍？',
    });
    renderDailyModal();
    const body = document.getElementById('dailyBody')!.innerHTML;
    expect(body).toContain('2 , 3 , 5');
  });

  it('mod 类型渲染 desc 与试听', () => {
    setDailyData({
      type: 'mod',
      a: 17,
      b: 5,
      answer: 2,
      name: '音高级数取模',
      desc: '在 12 音循环圈里走了 17 个半音，每 5 个半音为一组，余多少？',
    });
    renderDailyModal();
    const body = document.getElementById('dailyBody')!.innerHTML;
    expect(body).toContain('17 mod 5');
  });

  it('series 类型渲染等差序列', () => {
    setDailyData({
      type: 'series',
      seq: [2, 4, 6, 8, 10],
      diff: 2,
      answer: 12,
      name: '等差音程列',
      desc: '每次音高上升 2 个半音，下一项是多少？',
    });
    renderDailyModal();
    const body = document.getElementById('dailyBody')!.innerHTML;
    expect(body).toContain('2 , 4 , 6');
  });

  it('science 类型渲染试听与选项按钮', () => {
    setDailyData({
      type: 'science',
      answer: 'dft',
      options: [
        { key: 'dft', name: '硅能带结构' },
        { key: 'md', name: '水分子' },
        { key: 'fem', name: '应力分析' },
        { key: 'cfd', name: '流体' },
      ],
      name: '科学之声',
      sample: { name: '测试样本', kpoints: [0, 1, 2], energies: [-1, 0, 1] },
    });
    renderDailyModal();
    const body = document.getElementById('dailyBody')!.innerHTML;
    expect(body).toContain('dailySciencePlay');
    expect(body).toContain('dailyScienceAnswer');
  });

  it('未知 type 不抛错（容错）', () => {
    setDailyData({ type: 'unknown', answer: null, name: '未知' });
    expect(() => renderDailyModal()).not.toThrow();
  });

  it('dailyBody 不存在时安全返回', () => {
    document.body.innerHTML = '';
    setDailyData({ type: 'lcm', a: 3, b: 4, answer: 12, name: '最小公倍数' });
    expect(() => renderDailyModal()).not.toThrow();
  });
});

describe('daily renderDailyRing / dailyRingToggle', () => {
  beforeEach(() => {
    resetStore();
    setupDailyDOM();
    setDailyData({ type: 'symmetry', chord: [0, 4, 8], answer: [0, 4, 8], name: '对称群' });
  });

  it('renderDailyRing 渲染 12 个音符 cell', () => {
    renderDailyRing();
    const ring = document.getElementById('dailyRing')!;
    expect(ring.children.length).toBe(12);
    expect(ring.children[0].textContent).toBe('C');
  });

  it('dailyRingToggle 添加选中（少于 4 时）', () => {
    dailyState.selected = [];
    dailyRingToggle(0);
    expect(dailyState.selected).toContain(0);
  });

  it('dailyRingToggle 取消已选中', () => {
    dailyState.selected = [0];
    dailyRingToggle(0);
    expect(dailyState.selected).not.toContain(0);
  });

  it('dailyRingToggle 已选 4 个时不再增加', () => {
    dailyState.selected = [0, 1, 2, 3];
    dailyRingToggle(4);
    expect(dailyState.selected.length).toBe(4);
    expect(dailyState.selected).not.toContain(4);
  });

  it('renderDailyRing 在 #dailyRing 不存在时安全返回', () => {
    document.body.innerHTML = '';
    expect(() => renderDailyRing()).not.toThrow();
  });

  it('点击 cell 触发 dailyRingToggle', () => {
    renderDailyRing();
    const cell = document.getElementById('dailyRing')!.children[0] as HTMLElement;
    expect(cell.onclick).toBeInstanceOf(Function);
    cell.onclick!(new MouseEvent('click'));
    expect(dailyState.selected).toContain(0);
  });
});

describe('daily dailyRatioChange / dailyRatioPlay', () => {
  beforeEach(() => {
    resetStore();
    setupDailyDOM();
    setDailyData({ type: 'ratio', target: 660, answer: 660, tolerance: 5, name: '频率比' });
  });

  it('dailyRatioChange 接受数字参数', () => {
    dailyRatioChange(550);
    expect(dailyState.ratioB).toBe(550);
    expect(document.getElementById('dailyBval')!.textContent).toBe('B=550Hz');
    expect(document.getElementById('dailyRatioVal')!.textContent).toBe('1.250');
  });

  it('dailyRatioChange 接受字符串参数', () => {
    dailyRatioChange('700');
    expect(dailyState.ratioB).toBe(700);
  });

  it('dailyRatioChange 接受 Event 参数', () => {
    const input = document.createElement('input');
    input.value = '600';
    const ev = new Event('input');
    Object.defineProperty(ev, 'target', { value: input, enumerable: false });
    dailyRatioChange(ev);
    expect(dailyState.ratioB).toBe(600);
  });

  it('dailyRatioChange 在 dailyRatioVal 不存在时不抛错', () => {
    document.body.innerHTML = '<div id="dailyBval"></div>';
    expect(() => dailyRatioChange(500)).not.toThrow();
    expect(dailyState.ratioB).toBe(500);
  });

  it('dailyRatioPlay 调用 scheduleToneAt 两次', () => {
    (scheduleToneAt as any).mockClear();
    dailyRatioPlay();
    expect(scheduleToneAt).toHaveBeenCalledTimes(2);
  });

  it('dailyRatioPlay ratioB 缺省时使用 440', () => {
    delete dailyState.ratioB;
    (scheduleToneAt as any).mockClear();
    dailyRatioPlay();
    // 第二次调用应使用 440
    const lastCall = (scheduleToneAt as any).mock.calls[1];
    expect(lastCall[0]).toBe(440);
  });
});

describe('daily renderDailyEuclidGrid / dailyEuclidToggle / dailyEuclidApply', () => {
  beforeEach(() => {
    resetStore();
    setupDailyDOM();
    setDailyData({
      type: 'euclidean',
      k: 3,
      n: 8,
      answer: [1, 0, 1, 0, 0, 1, 0, 0],
      name: '欧几里得算法',
    });
  });

  it('renderDailyEuclidGrid 渲染 n 个 cell', () => {
    renderDailyEuclidGrid();
    const grid = document.getElementById('dailyEuclidGrid')!;
    expect(grid.children.length).toBe(8);
  });

  it('renderDailyEuclidGrid 在容器不存在时安全返回', () => {
    document.body.innerHTML = '';
    expect(() => renderDailyEuclidGrid()).not.toThrow();
  });

  it('dailyEuclidToggle 切换 cell 状态', () => {
    dailyState.euclidCells = [0, 0, 0, 0, 0, 0, 0, 0];
    dailyEuclidToggle({} as Event, 2);
    expect(dailyState.euclidCells[2]).toBe(1);
    dailyEuclidToggle({} as Event, 2);
    expect(dailyState.euclidCells[2]).toBe(0);
  });

  it('dailyEuclidApply 应用欧几里得算法', () => {
    dailyState.euclidCells = [0, 0, 0, 0, 0, 0, 0, 0];
    dailyEuclidApply();
    // 应用后长度等于 n，且 1 的数量等于 k
    expect(dailyState.euclidCells.length).toBe(8);
    expect(dailyState.euclidCells.reduce((s: number, x: number) => s + x, 0)).toBe(3);
  });
});

describe('daily closeDailyModal / toggleDailyPlay / stopDailyPlay', () => {
  beforeEach(() => {
    resetStore();
    setupDailyDOM();
    setDailyData({ type: 'lcm', a: 3, b: 4, answer: 12, name: '最小公倍数' });
  });

  it('closeDailyModal 隐藏 modal 并调用 stopDailyPlay', () => {
    const modal = document.getElementById('dailyModal')!;
    modal.style.display = 'flex';
    closeDailyModal();
    expect(modal.style.display).toBe('none');
    expect(stopSharedTransport).toHaveBeenCalled();
  });

  it('toggleDailyPlay 在未播放时启动 transport', () => {
    (stopSharedTransport as any).mockClear();
    (getSharedTransport as any).mockClear();
    dailyState.playing = false;
    toggleDailyPlay();
    expect(dailyState.playing).toBe(true);
    expect(getSharedTransport).toHaveBeenCalled();
    expect(dailyState.transport).toBeDefined();
    const btn = document.getElementById('dailyPlayBtn');
    expect(btn!.textContent).toBe('⏸ 暂停');
  });

  it('toggleDailyPlay 在已播放时调用 stopDailyPlay', () => {
    dailyState.playing = true;
    dailyState.transport = { stop: vi.fn() } as any;
    (stopSharedTransport as any).mockClear();
    toggleDailyPlay();
    expect(dailyState.playing).toBe(false);
    expect(stopSharedTransport).toHaveBeenCalled();
  });

  it('stopDailyPlay 清理 playing / transport / autoStopTimer', () => {
    dailyState.playing = true;
    dailyState.transport = { foo: 'bar' } as any;
    dailyState.autoStopTimer = setTimeout(() => {}, 1000) as any;
    stopDailyPlay();
    expect(dailyState.playing).toBe(false);
    expect(dailyState.transport).toBeNull();
    expect(dailyState.autoStopTimer).toBeNull();
    const btn = document.getElementById('dailyPlayBtn');
    expect(btn!.textContent).toBe('▶ 播放');
  });

  it('stopDailyPlay autoStopTimer 为 null 时安全通过', () => {
    dailyState.autoStopTimer = null;
    expect(() => stopDailyPlay()).not.toThrow();
  });

  it('toggleDailyPlay 启动后 transport subscribe 回调被正确触发', () => {
    (getSharedTransport as any).mockImplementationOnce(() => ({
      subscribe: vi.fn((cb) => {
        // 模拟事件回调
        cb({ step: 0, time: 0 });
        cb({ step: 3, time: 0.1 });
        cb({ step: 4, time: 0.2 });
        return () => {};
      }),
      start: vi.fn(),
      stop: vi.fn(),
      setBpm: vi.fn(),
    }));
    (scheduleKickAt as any).mockClear();
    (scheduleSnareAt as any).mockClear();
    (scheduleToneAt as any).mockClear();
    toggleDailyPlay();
    // 至少触发了几次音色调度
    expect(scheduleKickAt).toHaveBeenCalled();
  });
});

describe('daily dailyMathPlay 各类型试听', () => {
  beforeEach(() => {
    resetStore();
    setupDailyDOM();
    (scheduleToneAt as any).mockClear();
    (scheduleKickAt as any).mockClear();
    (scheduleSnareAt as any).mockClear();
    (stopSharedTransport as any).mockClear();
    (getSharedTransport as any).mockClear();
  });

  afterEach(() => {
    if (dailyState.autoStopTimer) {
      clearTimeout(dailyState.autoStopTimer);
      dailyState.autoStopTimer = null;
    }
  });

  it('gcd 类型启动 transport 并设置 autoStopTimer', () => {
    vi.useFakeTimers();
    setDailyData({
      type: 'gcd',
      a: 4,
      b: 6,
      answer: 12,
      name: '最大公约拍',
      desc: 'desc',
    });
    dailyMathPlay({} as Event, 'gcd');
    expect(getSharedTransport).toHaveBeenCalled();
    expect(dailyState.autoStopTimer).not.toBeNull();
    vi.useRealTimers();
  });

  it('gcd 类型 transport subscribe 回调正确触发 kick/snare/tone', () => {
    setDailyData({
      type: 'gcd',
      a: 4,
      b: 6,
      answer: 12,
      name: '最大公约拍',
      desc: 'desc',
    });
    (getSharedTransport as any).mockImplementationOnce(() => ({
      subscribe: vi.fn((cb) => {
        cb({ step: 0, time: 0 }); // s%a=0 s%b=0 三响
        cb({ step: 4, time: 0.1 }); // s%a=0 仅 square tone
        cb({ step: 6, time: 0.2 }); // s%b=0
        return () => {};
      }),
      start: vi.fn(),
      stop: vi.fn(),
      setBpm: vi.fn(),
    }));
    dailyMathPlay({} as Event, 'gcd');
    expect(scheduleToneAt).toHaveBeenCalled();
  });

  it('fibonacci 类型逐项 scheduleToneAt', () => {
    setDailyData({
      type: 'fibonacci',
      seq: [2, 3, 5, 8, 13, 21, 34],
      answer: 34,
      name: '黄金节奏列',
      desc: 'desc',
    });
    dailyMathPlay({} as Event, 'fibonacci');
    // 序列长度 7 次 + 0
    expect(scheduleToneAt).toHaveBeenCalledTimes(7);
  });

  it('mod 类型 scheduleToneAt 两次', () => {
    setDailyData({
      type: 'mod',
      a: 17,
      b: 5,
      answer: 2,
      name: '音高级数取模',
      desc: 'desc',
    });
    dailyMathPlay({} as Event, 'mod');
    expect(scheduleToneAt).toHaveBeenCalledTimes(2);
  });

  it('series 类型为每项 scheduleToneAt', () => {
    setDailyData({
      type: 'series',
      seq: [2, 4, 6, 8, 10],
      diff: 2,
      answer: 12,
      name: '等差音程列',
      desc: 'desc',
    });
    dailyMathPlay({} as Event, 'series');
    expect(scheduleToneAt).toHaveBeenCalledTimes(5);
  });

  it('未知 kind 不调用任何 schedule 函数', () => {
    setDailyData({ type: 'gcd', a: 4, b: 6, answer: 12, name: 'G', desc: 'd' });
    (scheduleToneAt as any).mockClear();
    dailyMathPlay({} as Event, 'unknown');
    expect(scheduleToneAt).not.toHaveBeenCalled();
  });

  it('kind 与 type 不匹配时不触发（如 gcd kind 但 type=fibonacci）', () => {
    setDailyData({
      type: 'fibonacci',
      seq: [1, 2],
      answer: 2,
      name: 'F',
      desc: 'd',
    });
    (scheduleToneAt as any).mockClear();
    (getSharedTransport as any).mockClear();
    dailyMathPlay({} as Event, 'gcd');
    expect(getSharedTransport).not.toHaveBeenCalled();
  });
});

describe('daily checkDailyAnswer 各类型验证', () => {
  beforeEach(() => {
    resetStore();
    setupDailyDOM();
    (recordWrongAnswer as any).mockClear();
  });

  it('lcm 答对触发 dailyChallengeSuccess', () => {
    setDailyData({ type: 'lcm', a: 3, b: 4, answer: 12, name: '最小公倍数' });
    document.body.innerHTML += '<input id="dailyInput" value="12">';
    checkDailyAnswer();
    expect(document.getElementById('dailyFeedback')!.innerHTML).toContain('✅');
  });

  it('lcm 答错记录错题', () => {
    setDailyData({ type: 'lcm', a: 3, b: 4, answer: 12, name: '最小公倍数' });
    document.body.innerHTML += '<input id="dailyInput" value="10">';
    checkDailyAnswer();
    expect(document.getElementById('dailyFeedback')!.innerHTML).toContain('❌');
    expect(recordWrongAnswer).toHaveBeenCalled();
  });

  it('lcm 输入非数字时答错', () => {
    setDailyData({ type: 'lcm', a: 3, b: 4, answer: 12, name: '最小公倍数' });
    document.body.innerHTML += '<input id="dailyInput" value="abc">';
    checkDailyAnswer();
    expect(recordWrongAnswer).toHaveBeenCalled();
  });

  it('symmetry 选 3 个正确音答对', () => {
    setDailyData({ type: 'symmetry', chord: [0, 4, 8], answer: [0, 4, 8], name: '对称群' });
    dailyState.selected = [0, 4, 8];
    checkDailyAnswer();
    expect(document.getElementById('dailyFeedback')!.innerHTML).toContain('✅');
  });

  it('symmetry 选 3 个但顺序不同也答对（排序后比较）', () => {
    setDailyData({ type: 'symmetry', chord: [0, 4, 8], answer: [0, 4, 8], name: '对称群' });
    dailyState.selected = [8, 0, 4];
    checkDailyAnswer();
    expect(document.getElementById('dailyFeedback')!.innerHTML).toContain('✅');
  });

  it('symmetry 选项不是 3 个时提示选择 3 个', () => {
    setDailyData({ type: 'symmetry', chord: [0, 4, 8], answer: [0, 4, 8], name: '对称群' });
    dailyState.selected = [0, 4];
    checkDailyAnswer();
    expect(document.getElementById('dailyFeedback')!.innerHTML).toContain('请选择 3 个音符');
  });

  it('symmetry 选错答案记录错题', () => {
    setDailyData({ type: 'symmetry', chord: [0, 4, 8], answer: [0, 4, 8], name: '对称群' });
    dailyState.selected = [0, 1, 2];
    checkDailyAnswer();
    expect(recordWrongAnswer).toHaveBeenCalled();
  });

  it('ratio 在 tolerance 内答对', () => {
    setDailyData({ type: 'ratio', target: 660, answer: 660, tolerance: 5, name: '频率比' });
    dailyState.ratioB = 662;
    checkDailyAnswer();
    expect(document.getElementById('dailyFeedback')!.innerHTML).toContain('✅');
  });

  it('ratio 超出 tolerance 答错', () => {
    setDailyData({ type: 'ratio', target: 660, answer: 660, tolerance: 5, name: '频率比' });
    dailyState.ratioB = 700;
    checkDailyAnswer();
    expect(recordWrongAnswer).toHaveBeenCalled();
  });

  it('ratio ratioB 缺省时使用 440（必然答错）', () => {
    setDailyData({ type: 'ratio', target: 660, answer: 660, tolerance: 5, name: '频率比' });
    delete dailyState.ratioB;
    checkDailyAnswer();
    expect(recordWrongAnswer).toHaveBeenCalled();
  });

  it('crt 答对', () => {
    setDailyData({ type: 'crt', m1: 3, m2: 5, r1: 1, r2: 2, answer: 7, name: '中国剩余定理' });
    document.body.innerHTML += '<input id="dailyCrtInput" value="7">';
    checkDailyAnswer();
    expect(document.getElementById('dailyFeedback')!.innerHTML).toContain('✅');
  });

  it('crt 答错', () => {
    setDailyData({ type: 'crt', m1: 3, m2: 5, r1: 1, r2: 2, answer: 7, name: '中国剩余定理' });
    document.body.innerHTML += '<input id="dailyCrtInput" value="10">';
    checkDailyAnswer();
    expect(recordWrongAnswer).toHaveBeenCalled();
  });

  it('euclidean 正确答案', () => {
    const correct = euclideanRhythm(3, 8);
    setDailyData({
      type: 'euclidean',
      k: 3,
      n: 8,
      answer: correct,
      name: '欧几里得算法',
    });
    dailyState.euclidCells = correct.slice();
    checkDailyAnswer();
    expect(document.getElementById('dailyFeedback')!.innerHTML).toContain('✅');
  });

  it('euclidean 错误答案', () => {
    const correct = euclideanRhythm(3, 8);
    setDailyData({
      type: 'euclidean',
      k: 3,
      n: 8,
      answer: correct,
      name: '欧几里得算法',
    });
    dailyState.euclidCells = [1, 1, 1, 1, 0, 0, 0, 0];
    checkDailyAnswer();
    expect(recordWrongAnswer).toHaveBeenCalled();
  });

  it('probability 答对', () => {
    setDailyData({ type: 'probability', n: 20, p: 30, answer: 6, name: '概率' });
    document.body.innerHTML += '<input id="dailyProbInput" value="6">';
    checkDailyAnswer();
    expect(document.getElementById('dailyFeedback')!.innerHTML).toContain('✅');
  });

  it('probability 答错', () => {
    setDailyData({ type: 'probability', n: 20, p: 30, answer: 6, name: '概率' });
    document.body.innerHTML += '<input id="dailyProbInput" value="5">';
    checkDailyAnswer();
    expect(recordWrongAnswer).toHaveBeenCalled();
  });

  it('gcd 答对', () => {
    setDailyData({
      type: 'gcd',
      a: 12,
      b: 8,
      answer: 4,
      name: '最大公约拍',
      desc: 'd',
    });
    document.body.innerHTML += '<input id="dailyInput" value="4">';
    checkDailyAnswer();
    expect(document.getElementById('dailyFeedback')!.innerHTML).toContain('✅');
  });

  it('fibonacci 答对', () => {
    setDailyData({
      type: 'fibonacci',
      seq: [2, 3, 5, 8, 13, 21, 34],
      answer: 34,
      name: '黄金节奏列',
      desc: 'd',
    });
    document.body.innerHTML += '<input id="dailyInput" value="34">';
    checkDailyAnswer();
    expect(document.getElementById('dailyFeedback')!.innerHTML).toContain('✅');
  });

  it('mod 答对', () => {
    setDailyData({
      type: 'mod',
      a: 17,
      b: 5,
      answer: 2,
      name: '音高级数取模',
      desc: 'd',
    });
    document.body.innerHTML += '<input id="dailyInput" value="2">';
    checkDailyAnswer();
    expect(document.getElementById('dailyFeedback')!.innerHTML).toContain('✅');
  });

  it('series 答对', () => {
    setDailyData({
      type: 'series',
      seq: [2, 4, 6, 8, 10],
      diff: 2,
      answer: 12,
      name: '等差音程列',
      desc: 'd',
    });
    document.body.innerHTML += '<input id="dailyInput" value="12">';
    checkDailyAnswer();
    expect(document.getElementById('dailyFeedback')!.innerHTML).toContain('✅');
  });

  it('permutation / graph 类型在 checkDailyAnswer 中走默认分支（不答对也不记错题）', () => {
    setDailyData({
      type: 'permutation',
      motive: [0, 2, 4, 7],
      row: [2, 0, 7, 4],
      answer: true,
      name: '排列',
    });
    // checkDailyAnswer 不识别 permutation 类型，correct=false
    checkDailyAnswer();
    expect(document.getElementById('dailyFeedback')!.innerHTML).toContain('❌');
  });
});

describe('daily dailyPermAnswer / dailyGraphAnswer', () => {
  beforeEach(() => {
    resetStore();
    setupDailyDOM();
    (recordWrongAnswer as any).mockClear();
  });

  it('dailyPermAnswer 答对', () => {
    setDailyData({
      type: 'permutation',
      motive: [0, 2, 4, 7],
      row: [2, 0, 7, 4],
      answer: true,
      name: '排列',
    });
    dailyPermAnswer({} as Event, true);
    expect(document.getElementById('dailyFeedback')!.innerHTML).toContain('✅');
  });

  it('dailyPermAnswer 答错记录错题', () => {
    setDailyData({
      type: 'permutation',
      motive: [0, 2, 4, 7],
      row: [2, 0, 7, 4],
      answer: true,
      name: '排列',
    });
    dailyPermAnswer({} as Event, false);
    expect(recordWrongAnswer).toHaveBeenCalled();
  });

  it('dailyGraphAnswer 答对', () => {
    setDailyData({
      type: 'graph',
      edges: [[0, 1]],
      path: [0, 1, 2],
      answer: true,
      name: '图论',
    });
    dailyGraphAnswer({} as Event, true);
    expect(document.getElementById('dailyFeedback')!.innerHTML).toContain('✅');
  });

  it('dailyGraphAnswer 答错', () => {
    setDailyData({
      type: 'graph',
      edges: [[0, 1]],
      path: [0, 1, 2],
      answer: true,
      name: '图论',
    });
    dailyGraphAnswer({} as Event, false);
    expect(recordWrongAnswer).toHaveBeenCalled();
    expect(document.getElementById('dailyFeedback')!.innerHTML).toContain('❌');
  });
});

describe('daily dailySciencePlay / dailyScienceAnswer', () => {
  beforeEach(() => {
    resetStore();
    setupDailyDOM();
    (scheduleToneAt as any).mockClear();
  });

  it('dailyScienceAnswer 答对', () => {
    setDailyData({
      type: 'science',
      answer: 'dft',
      options: [{ key: 'dft', name: 'X' }],
      name: '科学之声',
      sample: { kpoints: [0, 1], energies: [0, 1] },
    });
    dailyScienceAnswer({} as Event, 'dft');
    expect(document.getElementById('dailyFeedback')!.innerHTML).toContain('✅');
  });

  it('dailyScienceAnswer 答错', () => {
    setDailyData({
      type: 'science',
      answer: 'dft',
      options: [{ key: 'dft', name: 'X' }],
      name: '科学之声',
      sample: {},
    });
    dailyScienceAnswer({} as Event, 'md');
    expect(document.getElementById('dailyFeedback')!.innerHTML).toContain('❌');
  });

  it('dailySciencePlay sample 缺省时使用默认 freqs', () => {
    setDailyData({
      type: 'science',
      answer: 'dft',
      options: [],
      name: '科学之声',
    });
    delete dailyState.data.sample;
    dailySciencePlay();
    expect(scheduleToneAt).toHaveBeenCalledTimes(4);
  });

  it('dailySciencePlay sample 含数值数组时映射为旋律', () => {
    setDailyData({
      type: 'science',
      answer: 'dft',
      options: [],
      name: '科学之声',
      sample: { kpoints: [0, 0.5, 1.0, 0.25], energies: [-1, 0, 1, 0.5] },
    });
    dailySciencePlay();
    expect(scheduleToneAt).toHaveBeenCalled();
  });

  it('dailySciencePlay sample 嵌套对象数组时从子对象取值', () => {
    setDailyData({
      type: 'science',
      answer: 'md',
      options: [],
      name: '科学之声',
      sample: {
        frames: [
          { x: 1, y: 2 },
          { x: 3, y: 4 },
          { x: 5, y: 6 },
        ],
      },
    });
    dailySciencePlay();
    expect(scheduleToneAt).toHaveBeenCalled();
  });

  it('dailySciencePlay sample 含 DNA 字符串时映射为音高', () => {
    setDailyData({
      type: 'science',
      answer: 'dna',
      options: [],
      name: '科学之声',
      sample: { sequence: 'ATGCATGC' },
    });
    dailySciencePlay();
    expect(scheduleToneAt).toHaveBeenCalled();
  });

  it('dailySciencePlay sample 既无数组又无字符串序列时 fallback', () => {
    setDailyData({
      type: 'science',
      answer: 'X',
      options: [],
      name: '科学之声',
      sample: { name: 'empty' },
    });
    dailySciencePlay();
    expect(scheduleToneAt).toHaveBeenCalledTimes(4);
  });
});

describe('daily dailyChallengeSuccess 成功路径', () => {
  beforeEach(() => {
    resetStore();
    setupDailyDOM();
    vi.useFakeTimers();
    (addXp as any).mockClear();
    (tryAwardStreakFreeze as any).mockClear();
    (recordLearningProgress as any).mockClear();
    (renderHome as any).mockClear();
    (checkAchievements as any).mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('首次完成：写入 achievements + 更新 streak + 调用 XP', () => {
    setDailyData({ type: 'lcm', a: 3, b: 4, answer: 12, name: '最小公倍数' });
    dailyChallengeSuccess();
    expect(Store.state.achievements.length).toBe(1);
    expect(Store.state.achievements[0]).toMatch(/^daily_/);
    expect(addXp).toHaveBeenCalled();
    expect(tryAwardStreakFreeze).toHaveBeenCalled();
    expect(recordLearningProgress).toHaveBeenCalledWith(1);
    expect(renderHome).toHaveBeenCalled();
    expect(checkAchievements).toHaveBeenCalled();
  });

  it('首次完成：将 type 写入 dailyTypesCompleted', () => {
    setDailyData({ type: 'lcm', a: 3, b: 4, answer: 12, name: '最小公倍数' });
    dailyChallengeSuccess();
    expect(Store.state.dailyTypesCompleted).toContain('lcm');
  });

  it('首次完成：周计数 +1', () => {
    setDailyData({ type: 'lcm', a: 3, b: 4, answer: 12, name: '最小公倍数' });
    dailyChallengeSuccess();
    const weekKey = getWeekKey();
    expect(Store.state.dailyWeekCounts[weekKey]).toBe(1);
  });

  it('重复完成同一天：不重复奖励', () => {
    setDailyData({ type: 'lcm', a: 3, b: 4, answer: 12, name: '最小公倍数' });
    dailyChallengeSuccess();
    (addXp as any).mockClear();
    dailyChallengeSuccess();
    expect(addXp).not.toHaveBeenCalled();
  });

  it('已完成的 type 不重复写入 dailyTypesCompleted', () => {
    setDailyData({ type: 'lcm', a: 3, b: 4, answer: 12, name: '最小公倍数' });
    Store.state.dailyTypesCompleted = ['lcm'];
    dailyChallengeSuccess();
    expect(Store.state.dailyTypesCompleted.filter((t) => t === 'lcm').length).toBe(1);
  });

  it('spawnConfetti 被调用', () => {
    setDailyData({ type: 'lcm', a: 3, b: 4, answer: 12, name: '最小公倍数' });
    dailyChallengeSuccess();
    expect((window as any).spawnConfetti).toHaveBeenCalled();
  });
});

describe('daily updateDailyBanner', () => {
  beforeEach(() => {
    resetStore();
    setupDailyDOM();
  });

  it('未完成时显示开始挑战', () => {
    updateDailyBanner();
    const el = document.getElementById('dailyChallengeBanner')!;
    expect(el.classList.contains('done')).toBe(false);
    expect(document.getElementById('dailyStatus')!.textContent).toContain('开始挑战');
  });

  it('已完成时显示已完成', () => {
    // 把今日 challenge key 写入 achievements
    const d = getDailyChallenge();
    const key = 'daily_' + (function () {
      const d = new Date();
      return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    })();
    Store.state.achievements = [key];
    updateDailyBanner();
    expect(document.getElementById('dailyChallengeBanner')!.classList.contains('done')).toBe(true);
    expect(document.getElementById('dailyStatus')!.textContent).toContain('已完成');
  });

  it('连胜大于 0 时显示火焰', () => {
    Store.state.dailyStreak = 5;
    updateDailyBanner();
    expect(document.getElementById('dailyStatus')!.textContent).toContain('🔥');
    expect(document.getElementById('dailyStatus')!.textContent).toContain('5');
  });

  it('dailySub 显示今日挑战名', () => {
    updateDailyBanner();
    expect(document.getElementById('dailySub')!.textContent).toContain('今日挑战');
  });

  it('dailySub 不存在时安全通过', () => {
    document.body.innerHTML = '<div id="dailyChallengeBanner"></div><div id="dailyStatus"></div>';
    expect(() => updateDailyBanner()).not.toThrow();
  });

  it('dailyChallengeBanner 不存在时安全通过', () => {
    document.body.innerHTML = '<div id="dailySub"></div><div id="dailyStatus"></div>';
    expect(() => updateDailyBanner()).not.toThrow();
  });
});

describe('daily showDailyWhy', () => {
  beforeEach(() => {
    resetStore();
    (showWhy as any).mockClear();
  });

  const typeToExpected = {
    lcm: '1-1',
    symmetry: '2-1',
    ratio: '3-1',
    crt: '4-1',
    permutation: '5-1',
    euclidean: '6-1',
    probability: '7-1',
    graph: '8-1',
    gcd: '1-1',
    fibonacci: '6-1',
    mod: '4-1',
    series: '1-1',
    science: '1-1',
  };

  for (const [type, expected] of Object.entries(typeToExpected)) {
    it(`type=${type} 调用 showWhy('${expected}')`, () => {
      setDailyData({ type, answer: null, name: type });
      showDailyWhy();
      expect(showWhy).toHaveBeenCalledWith(expected);
    });
  }
});

describe('daily 损坏存档容错', () => {
  beforeEach(() => {
    resetStore();
    setupDailyDOM();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('dailyLastDate 为 undefined 时按首次打卡处理', () => {
    vi.setSystemTime(new Date('2026-07-22T12:00:00Z'));
    (Store.state as any).dailyLastDate = undefined;
    (Store.state as any).dailyStreak = undefined;
    updateDailyStreak();
    expect(Store.state.dailyStreak).toBe(1);
  });

  it('dailyStreak 为非数字时安全处理', () => {
    vi.setSystemTime(new Date('2026-07-22T12:00:00Z'));
    (Store.state as any).dailyStreak = 'invalid';
    Store.state.dailyLastDate = '2026-07-21';
    expect(() => updateDailyStreak()).not.toThrow();
  });

  it('updateDailyBanner 在 achievements 为 null 时不抛错', () => {
    setDailyData({ type: 'lcm', a: 3, b: 4, answer: 12, name: '最小公倍数' });
    (Store.state as any).achievements = null;
    (Store.state as any).dailyStreak = 0;
    expect(() => updateDailyBanner()).not.toThrow();
  });

  it('dailyChallengeSuccess 在 achievements 为 null 时抛错（源码已知行为）', () => {
    setDailyData({ type: 'lcm', a: 3, b: 4, answer: 12, name: '最小公倍数' });
    (Store.state as any).achievements = null;
    expect(() => dailyChallengeSuccess()).toThrow();
  });
});
