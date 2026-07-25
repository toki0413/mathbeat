import { describe, it, expect } from 'vitest';
import { BOSS_PROBLEMS, getBossProblem } from './boss-problems';

describe('boss-problems BOSS 题目表', () => {
  it('包含全部 8 个世界的 Boss 关', () => {
    for (let w = 1; w <= 8; w++) {
      const id = `${w}-B`;
      expect(BOSS_PROBLEMS[id]).toBeDefined();
      expect(BOSS_PROBLEMS[id].worldId).toBe(w);
    }
  });

  it('每个 BossProblem 字段完整', () => {
    for (const id of Object.keys(BOSS_PROBLEMS)) {
      const p = BOSS_PROBLEMS[id];
      expect(p.id).toBe(id);
      expect(typeof p.title).toBe('string');
      expect(p.title.length).toBeGreaterThan(0);
      expect(typeof p.emoji).toBe('string');
      expect(typeof p.problem).toBe('string');
      expect(typeof p.mathStatement).toBe('string');
      expect(typeof p.hint).toBe('string');
      expect(typeof p.reward).toBe('string');
    }
  });

  it('getBossProblem 返回对应记录', () => {
    expect(getBossProblem('1-B')?.id).toBe('1-B');
    expect(getBossProblem('8-B')?.worldId).toBe(8);
  });

  it('getBossProblem 不存在时返回 null', () => {
    expect(getBossProblem('nonexistent')).toBeNull();
    expect(getBossProblem('1-1')).toBeNull(); // 非 Boss 关
    expect(getBossProblem('')).toBeNull();
  });

  it('Boss 题目与世界数学主题对应（粗校验）', () => {
    // 抽样校验数学描述包含主题关键词
    expect(BOSS_PROBLEMS['1-B'].mathStatement).toContain('LCM');
    expect(BOSS_PROBLEMS['2-B'].mathStatement).toContain('D₁₂'); // 二面体群
    expect(BOSS_PROBLEMS['3-B'].mathStatement).toContain('3/2'); // 五度相生
    expect(BOSS_PROBLEMS['4-B'].mathStatement).toContain('CRT');
    expect(BOSS_PROBLEMS['5-B'].mathStatement).toContain('S₆'); // 对称群
    expect(BOSS_PROBLEMS['6-B'].mathStatement).toContain('φ'); // 黄金比例
    expect(BOSS_PROBLEMS['7-B'].mathStatement).toContain('π'); // 马尔可夫平稳分布（含 π）
    expect(BOSS_PROBLEMS['8-B'].mathStatement).toContain('欧拉回路'); // 图论
  });
});
