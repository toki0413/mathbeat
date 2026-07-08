import { describe, it, expect, vi } from 'vitest';
import { calculateDifficulty, starsHtml, encodeShareCode, decodeShareCode, CustomLevel } from './level-editor';

vi.mock('./store', () => ({
  Store: { state: { customLevels: [] }, save: vi.fn() },
  DEFAULT_STATE: {
    customLevels: [],
    endlessStats: { bestScore: 0, totalRounds: 0, totalCorrect: 0, totalQuestions: 0, bestCombo: 0 },
  },
}));

vi.mock('./ui-render', () => ({
  showScreen: vi.fn(),
  showHintFloat: vi.fn(),
}));

vi.mock('./game-engine', () => ({
  startLevel: vi.fn(),
  state: { currentWorld: null, currentLevel: null },
  // world 模块在顶层 registerActions 里引用了这些导出，mock 必须提供否则模块加载报错
  completeLevel: vi.fn(),
  recordAdaptive: vi.fn(),
  updateLeaderboard: vi.fn(),
  checkAchievements: vi.fn(),
  nextLevel: vi.fn(),
}));

describe('level-editor', () => {
  describe('calculateDifficulty', () => {
    it('rates world 1/4 easy when max(a,b) <= 5', () => {
      const level: CustomLevel = { id: '1', name: 'Test', worldId: 1, desc: '', a: 2, b: 3, createdAt: '' };
      expect(calculateDifficulty(level)).toBe(1);
    });

    it('rates world 1/4 medium when max(a,b) is 8-12', () => {
      const level: CustomLevel = { id: '1', name: 'Test', worldId: 1, desc: '', a: 10, b: 12, createdAt: '' };
      expect(calculateDifficulty(level)).toBe(3);
    });

    it('rates world 1/4 hard when max(a,b) > 16', () => {
      const level: CustomLevel = { id: '1', name: 'Test', worldId: 1, desc: '', a: 20, b: 25, createdAt: '' };
      expect(calculateDifficulty(level)).toBe(5);
    });

    it('rates world 5 easy with short motif', () => {
      const level: CustomLevel = { id: '1', name: 'Test', worldId: 5, desc: '', motif: [0, 2], createdAt: '' };
      expect(calculateDifficulty(level)).toBe(1);
    });

    it('rates world 5 harder with ops', () => {
      const level: CustomLevel = {
        id: '1',
        name: 'Test',
        worldId: 5,
        desc: '',
        motif: [0, 2, 4, 5, 7],
        ops: ['retro'],
        createdAt: '',
      };
      expect(calculateDifficulty(level)).toBe(3);
    });

    it('rates world 6 by k/n ratio', () => {
      const easy: CustomLevel = { id: '1', name: 'Test', worldId: 6, desc: '', a: 2, b: 16, createdAt: '' };
      expect(calculateDifficulty(easy)).toBe(1);
      const hard: CustomLevel = { id: '1', name: 'Test', worldId: 6, desc: '', a: 7, b: 8, createdAt: '' };
      expect(calculateDifficulty(hard)).toBe(4);
    });

    it('rates world 7 by steps and probability', () => {
      const easy: CustomLevel = { id: '1', name: 'Test', worldId: 7, desc: '', a: 50, b: 8, createdAt: '' };
      const hard: CustomLevel = { id: '1', name: 'Test', worldId: 7, desc: '', a: 50, b: 30, createdAt: '' };
      expect(calculateDifficulty(easy)).toBeLessThan(calculateDifficulty(hard));
    });

    it('returns 2 for worlds 2 and 3 by default', () => {
      expect(calculateDifficulty({ id: '1', name: 'Test', worldId: 2, desc: '', createdAt: '' })).toBe(2);
      expect(calculateDifficulty({ id: '1', name: 'Test', worldId: 3, desc: '', createdAt: '' })).toBe(2);
    });
  });

  describe('starsHtml', () => {
    it('renders 5 stars with correct colors for rating 3', () => {
      const html = starsHtml(3);
      expect(html).toContain('var(--trackA)');
      expect(html).toContain('rgba(0,0,0,.1)');
      expect(html.split('⭐').length).toBe(6); // 5 stars + 1
    });
  });

  describe('encodeShareCode / decodeShareCode', () => {
    it('round-trips world 1 level', () => {
      const level: CustomLevel = { id: '1', name: 'LCM', worldId: 1, desc: '', a: 3, b: 5, createdAt: '' };
      const code = encodeShareCode(level);
      expect(code).toMatch(/^MB/);
      const decoded = decodeShareCode(code);
      expect(decoded).not.toBeNull();
      expect(decoded!.worldId).toBe(1);
      expect(decoded!.a).toBe(3);
      expect(decoded!.b).toBe(5);
    });

    it('round-trips world 5 level with motif and ops', () => {
      const level: CustomLevel = {
        id: '1',
        name: 'Perm',
        worldId: 5,
        desc: '',
        motif: [0, 2, 4, 7],
        ops: ['retro', 'invert'],
        createdAt: '',
      };
      const code = encodeShareCode(level);
      const decoded = decodeShareCode(code);
      expect(decoded).not.toBeNull();
      expect(decoded!.worldId).toBe(5);
      expect(decoded!.motif).toEqual([0, 2, 4, 7]);
      expect(decoded!.ops).toEqual(['retro', 'invert']);
    });

    it('round-trips world 6 level', () => {
      const level: CustomLevel = { id: '1', name: 'Euc', worldId: 6, desc: '', a: 5, b: 8, createdAt: '' };
      const code = encodeShareCode(level);
      const decoded = decodeShareCode(code);
      expect(decoded).not.toBeNull();
      expect(decoded!.a).toBe(5);
      expect(decoded!.b).toBe(8);
    });

    it('round-trips world 7 level', () => {
      const level: CustomLevel = { id: '1', name: 'Prob', worldId: 7, desc: '', a: 70, b: 16, createdAt: '' };
      const code = encodeShareCode(level);
      const decoded = decodeShareCode(code);
      expect(decoded).not.toBeNull();
      expect(decoded!.a).toBe(70);
      expect(decoded!.b).toBe(16);
    });

    it('returns null for invalid share code', () => {
      expect(decodeShareCode('INVALID')).toBeNull();
      expect(decodeShareCode('MB')).toBeNull();
      expect(decodeShareCode('MB00')).toBeNull();
    });

    it('returns null for out-of-range worldId', () => {
      expect(decodeShareCode('MB99')).toBeNull();
    });
  });
});
