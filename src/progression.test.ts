import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Store, DEFAULT_STATE } from './store';
import {
  MAX_LEVEL,
  xpForLevel,
  levelFromXp,
  getLevelProgressPercent,
  xpToNextLevel,
  addXp,
  XP_REWARDS,
  xpForAchievement,
  MAX_FREEZES,
  FREEZE_AWARD_INTERVAL,
  getStreakFreezes,
  consumeStreakFreeze,
  tryAwardStreakFreeze,
} from './progression';

// mock 副作用依赖，避免污染全局 actions 注册表与 DOM 调用
vi.mock('./events', () => ({ registerActions: vi.fn() }));
vi.mock('./ui-feedback', () => ({ showToast: vi.fn() }));
vi.mock('./fx/particles', () => ({ spawnConfetti: vi.fn() }));

// 固定时间为周三，避免周末 2 倍 XP 倍率干扰断言
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-22T12:00:00Z')); // 周三
});
afterEach(() => {
  vi.useRealTimers();
});

function resetStore() {
  Store.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  Store.listeners = [];
  Store._idbReady = false;
}

describe('xpForLevel / levelFromXp 等级曲线', () => {
  beforeEach(resetStore);

  it('Lv.1 起点 XP 为 0', () => {
    expect(xpForLevel(1)).toBe(0);
  });

  it('Lv.2 需 40 XP，Lv.3 需 120 XP（20·n·(n+1) 公式）', () => {
    expect(xpForLevel(2)).toBe(40);
    expect(xpForLevel(3)).toBe(120);
    expect(xpForLevel(4)).toBe(240); // 20*3*4
  });

  it('Lv.99 累计 XP ≈ 194040', () => {
    expect(xpForLevel(99)).toBe(20 * 98 * 99);
  });

  it('levelFromXp 由 XP 反推等级', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(39)).toBe(1); // 不够 40
    expect(levelFromXp(40)).toBe(2);
    expect(levelFromXp(120)).toBe(3);
    expect(levelFromXp(239)).toBe(3); // 不够 240
    expect(levelFromXp(240)).toBe(4);
  });

  it('levelFromXp 超大 XP 封顶 MAX_LEVEL', () => {
    expect(levelFromXp(9999999)).toBe(MAX_LEVEL);
  });

  it('xpForLevel 与 levelFromXp 互逆（边界点）', () => {
    for (let lv = 1; lv <= MAX_LEVEL; lv++) {
      const threshold = xpForLevel(lv);
      expect(levelFromXp(threshold)).toBe(lv);
    }
  });
});

describe('getLevelProgressPercent / xpToNextLevel', () => {
  beforeEach(resetStore);

  it('Lv.1 起点进度 0%', () => {
    Store.state.xp = 0;
    Store.state.level = 1;
    expect(getLevelProgressPercent()).toBe(0);
    expect(xpToNextLevel()).toBe(40);
  });

  it('Lv.1 中段进度 50%', () => {
    Store.state.xp = 20;
    Store.state.level = 1;
    expect(getLevelProgressPercent()).toBe(50);
    expect(xpToNextLevel()).toBe(20);
  });

  it('Lv.2 起点进度 0%', () => {
    Store.state.xp = 40;
    Store.state.level = 2;
    expect(getLevelProgressPercent()).toBe(0);
    // Lv.2→Lv.3 需 120，已有 40，还差 80
    expect(xpToNextLevel()).toBe(80);
  });

  it('MAX_LEVEL 进度 100%，剩余 0', () => {
    Store.state.xp = 9999999;
    Store.state.level = MAX_LEVEL;
    expect(getLevelProgressPercent()).toBe(100);
    expect(xpToNextLevel()).toBe(0);
  });
});

describe('addXp 累加与升级检测', () => {
  beforeEach(resetStore);

  it('累加 XP 并写入 Store', () => {
    Store.state.xp = 0;
    Store.state.level = 1;
    const leveled = addXp(30, '测试');
    expect(leveled).toBe(false);
    expect(Store.state.xp).toBe(30);
    expect(Store.state.level).toBe(1);
  });

  it('跨级升级返回 true 并更新 level', () => {
    Store.state.xp = 0;
    Store.state.level = 1;
    // 一次加 300 XP，应从 Lv.1 跨到 Lv.4（240 门槛）
    const leveled = addXp(300);
    expect(leveled).toBe(true);
    expect(Store.state.level).toBe(4);
    expect(Store.state.xp).toBe(300);
  });

  it('恰好达到升级阈值', () => {
    Store.state.xp = 0;
    Store.state.level = 1;
    addXp(40);
    expect(Store.state.level).toBe(2);
  });

  it('非正数 XP 不生效', () => {
    Store.state.xp = 10;
    expect(addXp(0)).toBe(false);
    expect(addXp(-5)).toBe(false);
    expect(addXp(NaN)).toBe(false);
    expect(Store.state.xp).toBe(10);
  });

  it('floor 处理小数 XP', () => {
    Store.state.xp = 0;
    addXp(12.9);
    expect(Store.state.xp).toBe(12);
  });
});

describe('XP_REWARDS / xpForAchievement', () => {
  it('关卡星级 XP 奖励', () => {
    expect(XP_REWARDS.levelStar[1]).toBe(10);
    expect(XP_REWARDS.levelStar[2]).toBe(25);
    expect(XP_REWARDS.levelStar[3]).toBe(50);
    expect(XP_REWARDS.firstClearBonus).toBe(20);
  });

  it('Endless 与 Daily 奖励常量', () => {
    expect(XP_REWARDS.endlessPerPoint).toBe(1);
    expect(XP_REWARDS.endlessFinishBonus).toBe(15);
    expect(XP_REWARDS.dailyComplete).toBe(30);
  });

  it('成就稀有度 XP 分级', () => {
    expect(xpForAchievement('common')).toBe(20);
    expect(xpForAchievement('rare')).toBe(50);
    expect(xpForAchievement('epic')).toBe(100);
    expect(xpForAchievement('legendary')).toBe(200);
  });

  it('未指定稀有度默认按 common', () => {
    expect(xpForAchievement(undefined)).toBe(20);
  });

  it('常量约束', () => {
    expect(MAX_FREEZES).toBe(3);
    expect(FREEZE_AWARD_INTERVAL).toBe(7);
  });
});

describe('连胜护盾 consumeStreakFreeze', () => {
  beforeEach(resetStore);

  it('无护盾时返回 false 且不报错', () => {
    Store.state.streakFreezes = 0;
    expect(consumeStreakFreeze()).toBe(false);
    expect(Store.state.streakFreezes).toBe(0);
  });

  it('有护盾时消耗并返回 true', () => {
    Store.state.streakFreezes = 2;
    expect(consumeStreakFreeze()).toBe(true);
    expect(Store.state.streakFreezes).toBe(1);
  });

  it('连续消耗至 0', () => {
    Store.state.streakFreezes = 1;
    expect(consumeStreakFreeze()).toBe(true);
    expect(consumeStreakFreeze()).toBe(false);
    expect(Store.state.streakFreezes).toBe(0);
  });
});

describe('getStreakFreezes 上限', () => {
  beforeEach(resetStore);

  it('不超过 MAX_FREEZES', () => {
    Store.state.streakFreezes = 99;
    expect(getStreakFreezes()).toBe(MAX_FREEZES);
  });

  it('正常返回持有数', () => {
    Store.state.streakFreezes = 2;
    expect(getStreakFreezes()).toBe(2);
  });
});

describe('tryAwardStreakFreeze 连续打卡奖励', () => {
  beforeEach(resetStore);

  it('streak=7 且当天未发放时奖励 1 个护盾', () => {
    Store.state.dailyStreak = 7;
    Store.state.streakFreezes = 0;
    Store.state.lastFreezeAwardDate = '';
    tryAwardStreakFreeze();
    expect(Store.state.streakFreezes).toBe(1);
    expect(Store.state.lastFreezeAwardDate).toBe(new Date().toISOString().slice(0, 10));
  });

  it('同一天重复调用不重复奖励', () => {
    Store.state.dailyStreak = 7;
    Store.state.streakFreezes = 1;
    Store.state.lastFreezeAwardDate = new Date().toISOString().slice(0, 10);
    tryAwardStreakFreeze();
    expect(Store.state.streakFreezes).toBe(1); // 不变
  });

  it('streak 非 7 的倍数不奖励', () => {
    Store.state.dailyStreak = 8;
    Store.state.streakFreezes = 0;
    Store.state.lastFreezeAwardDate = '';
    tryAwardStreakFreeze();
    expect(Store.state.streakFreezes).toBe(0);
  });

  it('streak=14 奖励（7 的倍数）', () => {
    Store.state.dailyStreak = 14;
    Store.state.streakFreezes = 0;
    Store.state.lastFreezeAwardDate = '';
    tryAwardStreakFreeze();
    expect(Store.state.streakFreezes).toBe(1);
  });

  it('已达 MAX_FREEZES 不再奖励', () => {
    Store.state.dailyStreak = 7;
    Store.state.streakFreezes = MAX_FREEZES;
    Store.state.lastFreezeAwardDate = '';
    tryAwardStreakFreeze();
    expect(Store.state.streakFreezes).toBe(MAX_FREEZES);
  });

  it('streak=0 不奖励', () => {
    Store.state.dailyStreak = 0;
    Store.state.streakFreezes = 0;
    Store.state.lastFreezeAwardDate = '';
    tryAwardStreakFreeze();
    expect(Store.state.streakFreezes).toBe(0);
  });
});
