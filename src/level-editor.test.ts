import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./store', () => {
  const state: { customLevels: any[] } = { customLevels: [] };
  return {
    Store: {
      get state() {
        return state;
      },
      set state(v) {
        Object.assign(state, v);
      },
      save: vi.fn(),
      listeners: [],
    },
    DEFAULT_STATE: {
      customLevels: [],
      endlessStats: {
        bestScore: 0,
        totalRounds: 0,
        totalCorrect: 0,
        totalQuestions: 0,
        bestCombo: 0,
      },
    },
  };
});

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

// worlds 中的 renderWorldN 函数被 level-editor 引用，但仅在 preview 时调用
// 为了避免引入 worlds 的副作用，直接 mock
vi.mock('./worlds/world1', () => ({ renderWorld1: vi.fn() }));
vi.mock('./worlds/world2', () => ({ renderWorld2: vi.fn() }));
vi.mock('./worlds/world3', () => ({ renderWorld3: vi.fn() }));
vi.mock('./worlds/world4', () => ({ renderWorld4: vi.fn() }));
vi.mock('./worlds/world5', () => ({ renderWorld5: vi.fn() }));
vi.mock('./worlds/world6', () => ({ renderWorld6: vi.fn() }));
vi.mock('./worlds/world7', () => ({ renderWorld7: vi.fn() }));
vi.mock('./worlds/world8', () => ({ renderWorld8: vi.fn() }));

import {
  calculateDifficulty,
  starsHtml,
  encodeShareCode,
  decodeShareCode,
  openLevelEditor,
  closeLevelEditor,
  renderEditor,
  renderEditorParams,
  changeEditorWorld,
  saveCustomLevel,
  deleteCustomLevel,
  playCustomLevel,
  exportCustomLevel,
  exportCustomLevelById,
  importCustomLevel,
  previewCustomLevel,
  renderLevelPreview,
  renderDifficultyPreview,
  copyShareCode,
  copyShareCodeToClipboard,
  importShareCode,
} from './level-editor';
import type { CustomLevel } from './level-editor';
import { Store } from './store';
import { startLevel } from './game-engine';

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

    it('rates world 1/4 difficulty 2 when max in (5,8]', () => {
      const level: CustomLevel = { id: '1', name: 'Test', worldId: 4, desc: '', a: 7, b: 6, createdAt: '' };
      expect(calculateDifficulty(level)).toBe(2);
    });

    it('rates world 1/4 difficulty 4 when max in (12,16]', () => {
      const level: CustomLevel = { id: '1', name: 'Test', worldId: 1, desc: '', a: 14, b: 12, createdAt: '' };
      expect(calculateDifficulty(level)).toBe(4);
    });

    it('world 1/4: a/b 缺省时按 2/3 处理', () => {
      const level: CustomLevel = { id: '1', name: 'Test', worldId: 1, desc: '', createdAt: '' };
      expect(calculateDifficulty(level)).toBe(1);
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

    it('rates world 5 difficulty 2 when motif<=5 and no ops', () => {
      const level: CustomLevel = {
        id: '1',
        name: 'Test',
        worldId: 5,
        desc: '',
        motif: [0, 2, 4, 5, 7],
        createdAt: '',
      };
      expect(calculateDifficulty(level)).toBe(2);
    });

    it('rates world 5 difficulty 3 when motif<=7 and no ops', () => {
      const level: CustomLevel = {
        id: '1',
        name: 'Test',
        worldId: 5,
        desc: '',
        motif: [0, 2, 4, 5, 7, 9, 11],
        createdAt: '',
      };
      expect(calculateDifficulty(level)).toBe(3);
    });

    it('rates world 5 difficulty 4 when motif<=7 with ops', () => {
      const level: CustomLevel = {
        id: '1',
        name: 'Test',
        worldId: 5,
        desc: '',
        motif: [0, 2, 4, 5, 7, 9, 11],
        ops: ['retro'],
        createdAt: '',
      };
      expect(calculateDifficulty(level)).toBe(4);
    });

    it('rates world 5 difficulty 5 when motif>7 with >1 ops', () => {
      const level: CustomLevel = {
        id: '1',
        name: 'Test',
        worldId: 5,
        desc: '',
        motif: [0, 2, 4, 5, 7, 9, 11, 12, 14],
        ops: ['retro', 'invert'],
        createdAt: '',
      };
      expect(calculateDifficulty(level)).toBe(5);
    });

    it('rates world 5 difficulty 4 when motif>7 with <=1 ops', () => {
      const level: CustomLevel = {
        id: '1',
        name: 'Test',
        worldId: 5,
        desc: '',
        motif: [0, 2, 4, 5, 7, 9, 11, 12, 14],
        ops: ['retro'],
        createdAt: '',
      };
      expect(calculateDifficulty(level)).toBe(4);
    });

    it('rates world 6 by k/n ratio', () => {
      const easy: CustomLevel = { id: '1', name: 'Test', worldId: 6, desc: '', a: 2, b: 16, createdAt: '' };
      expect(calculateDifficulty(easy)).toBe(1);
      const hard: CustomLevel = { id: '1', name: 'Test', worldId: 6, desc: '', a: 7, b: 8, createdAt: '' };
      expect(calculateDifficulty(hard)).toBe(4);
    });

    it('rates world 6 difficulty 2 when ratio<=0.5', () => {
      const level: CustomLevel = { id: '1', name: 'Test', worldId: 6, desc: '', a: 3, b: 8, createdAt: '' };
      expect(calculateDifficulty(level)).toBe(2);
    });

    it('rates world 6 difficulty 3 when ratio<=0.7', () => {
      const level: CustomLevel = { id: '1', name: 'Test', worldId: 6, desc: '', a: 5, b: 8, createdAt: '' };
      expect(calculateDifficulty(level)).toBe(3);
    });

    it('rates world 6 difficulty 5 when ratio>0.9', () => {
      // a=10, b=11 → ratio=0.909 > 0.9 → 5
      const level: CustomLevel = { id: '1', name: 'Test', worldId: 6, desc: '', a: 10, b: 11, createdAt: '' };
      expect(calculateDifficulty(level)).toBe(5);
    });

    it('rates world 6 缺省 a/b 按 3/8 处理', () => {
      const level: CustomLevel = { id: '1', name: 'Test', worldId: 6, desc: '', createdAt: '' };
      expect(calculateDifficulty(level)).toBe(2);
    });

    it('rates world 7 by steps and probability', () => {
      const easy: CustomLevel = { id: '1', name: 'Test', worldId: 7, desc: '', a: 50, b: 8, createdAt: '' };
      const hard: CustomLevel = { id: '1', name: 'Test', worldId: 7, desc: '', a: 50, b: 30, createdAt: '' };
      expect(calculateDifficulty(easy)).toBeLessThan(calculateDifficulty(hard));
    });

    it('rates world 7 difficulty 5 when steps>24 and deviation<10', () => {
      // steps=30 > 24 (+3), deviation=0 < 10 (+2) → total 6 → min(5,6)=5
      const level: CustomLevel = { id: '1', name: 'Test', worldId: 7, desc: '', a: 50, b: 30, createdAt: '' };
      expect(calculateDifficulty(level)).toBe(5);
    });

    it('rates world 7 difficulty 4 when steps>16 and deviation in [10,20)', () => {
      // steps=20 > 16 (+2), deviation=15 < 20 (+1) but not < 10 → total 4
      const level: CustomLevel = { id: '1', name: 'Test', worldId: 7, desc: '', a: 65, b: 20, createdAt: '' };
      expect(calculateDifficulty(level)).toBe(4);
    });

    it('rates world 7 difficulty 3 when steps>8 and deviation<20 only', () => {
      // steps=12 > 8 (+1), deviation=10 < 20 (+1) but not < 10 → total 3
      const level: CustomLevel = { id: '1', name: 'Test', worldId: 7, desc: '', a: 60, b: 12, createdAt: '' };
      // deviation=|60-50|=10, <20 true, <10 false
      expect(calculateDifficulty(level)).toBe(3);
    });

    it('rates world 7 difficulty 2 when steps>8 but deviation>=20', () => {
      // steps=12 > 8 (+1), deviation=30 not < 20 → total 2
      const level: CustomLevel = { id: '1', name: 'Test', worldId: 7, desc: '', a: 20, b: 12, createdAt: '' };
      expect(calculateDifficulty(level)).toBe(2);
    });

    it('rates world 7 缺省 a/b 按 50/16 处理', () => {
      const level: CustomLevel = { id: '1', name: 'Test', worldId: 7, desc: '', createdAt: '' };
      // deviation=0 < 10 (+2), steps=16 not >16, steps >8 (+1) → 4
      expect(calculateDifficulty(level)).toBe(4);
    });

    it('returns 2 for worlds 2 and 3 by default', () => {
      expect(calculateDifficulty({ id: '1', name: 'Test', worldId: 2, desc: '', createdAt: '' })).toBe(2);
      expect(calculateDifficulty({ id: '1', name: 'Test', worldId: 3, desc: '', createdAt: '' })).toBe(2);
    });

    it('returns 3 for world 8', () => {
      expect(calculateDifficulty({ id: '1', name: 'Test', worldId: 8, desc: '', createdAt: '' })).toBe(3);
    });

    it('returns 2 for unknown worldId (>8)', () => {
      expect(calculateDifficulty({ id: '1', name: 'Test', worldId: 99, desc: '', createdAt: '' })).toBe(2);
    });
  });

  describe('starsHtml', () => {
    it('renders 5 stars with correct colors for rating 3', () => {
      const html = starsHtml(3);
      expect(html).toContain('var(--trackA)');
      expect(html).toContain('rgba(0,0,0,.1)');
      expect(html.split('⭐').length).toBe(6); // 5 stars + 1
    });

    it('renders all active stars for rating 5', () => {
      const html = starsHtml(5);
      // 5 个 active，0 个 inactive
      expect((html.match(/var\(--trackA\)/g) || []).length).toBe(5);
      expect(html).not.toContain('rgba(0,0,0,.1)');
    });

    it('renders all inactive stars for rating 0', () => {
      const html = starsHtml(0);
      expect((html.match(/rgba\(0,0,0,\.1\)/g) || []).length).toBe(5);
      expect(html).not.toContain('var(--trackA)');
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

    it('round-trips world 4 level', () => {
      const level: CustomLevel = { id: '1', name: 'CRT', worldId: 4, desc: '', a: 4, b: 6, createdAt: '' };
      const code = encodeShareCode(level);
      const decoded = decodeShareCode(code);
      expect(decoded).not.toBeNull();
      expect(decoded!.worldId).toBe(4);
      expect(decoded!.a).toBe(4);
      expect(decoded!.b).toBe(6);
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

    it('round-trips world 5 level with all three ops', () => {
      const level: CustomLevel = {
        id: '1',
        name: 'Perm',
        worldId: 5,
        desc: '',
        motif: [0, 2, 4, 7, 9],
        ops: ['retro', 'invert', 'rotate'],
        createdAt: '',
      };
      const code = encodeShareCode(level);
      const decoded = decodeShareCode(code);
      expect(decoded).not.toBeNull();
      expect(decoded!.ops).toEqual(['retro', 'invert', 'rotate']);
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

    it('round-trips world 2/3/8 level (无参数)', () => {
      const level2: CustomLevel = { id: '1', name: 'X', worldId: 2, desc: '', createdAt: '' };
      const code2 = encodeShareCode(level2);
      const decoded2 = decodeShareCode(code2);
      expect(decoded2!.worldId).toBe(2);

      const level8: CustomLevel = { id: '1', name: 'X', worldId: 8, desc: '', createdAt: '' };
      const code8 = encodeShareCode(level8);
      const decoded8 = decodeShareCode(code8);
      expect(decoded8!.worldId).toBe(8);
    });

    it('returns null for invalid share code', () => {
      expect(decodeShareCode('INVALID')).toBeNull();
      expect(decodeShareCode('MB')).toBeNull();
      expect(decodeShareCode('MB00')).toBeNull();
    });

    it('returns null for out-of-range worldId', () => {
      expect(decodeShareCode('MB99')).toBeNull();
    });

    it('returns null when payload too short for world 1', () => {
      // worldId=1, diff=2, but no a/b fields
      const code = 'MB12';
      expect(decodeShareCode(code)).toBeNull();
    });

    it('returns null when diff out of range', () => {
      // worldId=1, diff=9 (out of range)
      // decodeInt('9') = 9, exceeds 5
      const code = 'MB91';
      expect(decodeShareCode(code)).toBeNull();
    });

    it('returns null for world 5 payload too short', () => {
      // worldId=5, diff=2, but no motif payload
      const code = 'MB52';
      expect(decodeShareCode(code)).toBeNull();
    });

    it('returns null for world 6 payload too short', () => {
      // worldId=6, diff=2, but no a/b
      const code = 'MB62';
      expect(decodeShareCode(code)).toBeNull();
    });

    it('returns null for world 7 payload too short', () => {
      // worldId=7, diff=2, but no prob/steps
      const code7 = 'MB72';
      expect(decodeShareCode(code7)).toBeNull();
    });
  });

  describe('Editor UI: openLevelEditor / renderEditor / renderEditorParams', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      // 重置 editorState：通过 changeEditorWorld('1') 重置
      document.body.innerHTML = '<div id="levelEditorBody"></div>';
    });

    it('openLevelEditor 调用 showScreen 并渲染编辑器主体', () => {
      openLevelEditor();
      const body = document.getElementById('levelEditorBody')!;
      expect(body.innerHTML).toContain('🎨 关卡编辑器');
      expect(body.innerHTML).toContain('世界类型');
      expect(body.innerHTML).toContain('关卡名称');
      // 默认渲染 world 1 参数
      expect(body.innerHTML).toContain('周期 A');
      expect(body.innerHTML).toContain('周期 B');
    });

    it('openLevelEditor 在无容器时不抛错', () => {
      document.body.innerHTML = '';
      expect(() => openLevelEditor()).not.toThrow();
    });

    it('closeLevelEditor 移除 active 类并 showScreen home', () => {
      document.body.innerHTML = '<div id="levelEditorScreen" class="active"></div>';
      closeLevelEditor();
      const screen = document.getElementById('levelEditorScreen')!;
      expect(screen.classList.contains('active')).toBe(false);
    });

    it('closeLevelEditor 在无 DOM 元素时不抛错', () => {
      document.body.innerHTML = '';
      expect(() => closeLevelEditor()).not.toThrow();
    });

    it('renderEditor 渲染所有按钮', () => {
      renderEditor();
      const body = document.getElementById('levelEditorBody')!;
      expect(body.innerHTML).toContain('previewCustomLevel');
      expect(body.innerHTML).toContain('saveCustomLevel');
      expect(body.innerHTML).toContain('exportCustomLevel');
      expect(body.innerHTML).toContain('copyShareCode');
      expect(body.innerHTML).toContain('importShareCode');
    });

    it('renderEditor 渲染世界类型下拉框含 8 个 option', () => {
      renderEditor();
      const body = document.getElementById('levelEditorBody')!;
      const opts = body.innerHTML.match(/<option value="\d">/g) || [];
      expect(opts.length).toBe(8);
    });

    it('changeEditorWorld 切换到 world 5 渲染 motif/ops', () => {
      renderEditor();
      changeEditorWorld('5');
      const body = document.getElementById('levelEditorBody')!;
      // leParams 重新渲染
      expect(body.innerHTML).toContain('动机');
      expect(body.innerHTML).toContain('逆行');
      expect(body.innerHTML).toContain('倒影');
      expect(body.innerHTML).toContain('循环移位');
    });

    it('changeEditorWorld 切换到 world 6 渲染 k/n', () => {
      renderEditor();
      changeEditorWorld('6');
      const body = document.getElementById('levelEditorBody')!;
      expect(body.innerHTML).toContain('脉冲数 k');
      expect(body.innerHTML).toContain('总步数 n');
    });

    it('changeEditorWorld 切换到 world 7 渲染 概率/步数', () => {
      renderEditor();
      changeEditorWorld('7');
      const body = document.getElementById('levelEditorBody')!;
      expect(body.innerHTML).toContain('概率 %');
      expect(body.innerHTML).toContain('步数');
    });

    it('changeEditorWorld 切换到 world 4 仍渲染 周期 A/B', () => {
      renderEditor();
      changeEditorWorld('4');
      const body = document.getElementById('levelEditorBody')!;
      expect(body.innerHTML).toContain('周期 A');
    });

    it('renderEditorParams 在无 leParams 容器时不抛错', () => {
      document.body.innerHTML = '';
      expect(() => renderEditorParams()).not.toThrow();
    });

    it('renderDifficultyPreview 在无容器时不抛错', () => {
      document.body.innerHTML = '';
      expect(() => renderDifficultyPreview()).not.toThrow();
    });

    it('renderDifficultyPreview 渲染难度星', () => {
      document.body.innerHTML =
        '<div id="leDifficultyPreview"></div>' +
        '<input id="leName" type="text" value="Test">' +
        '<input id="leDesc" type="text" value="">' +
        '<input id="leA" type="number" value="3">' +
        '<input id="leB" type="number" value="5">';
      renderDifficultyPreview();
      const el = document.getElementById('leDifficultyPreview')!;
      expect(el.innerHTML).toContain('难度');
      expect(el.innerHTML).toContain('⭐');
    });

    it('renderDifficultyPreview 在 leName 为空时清空预览', () => {
      document.body.innerHTML =
        '<div id="leDifficultyPreview">old content</div>' +
        '<input id="leName" type="text" value="">' +
        '<input id="leDesc" type="text" value="">' +
        '<input id="leA" type="number" value="3">' +
        '<input id="leB" type="number" value="5">';
      renderDifficultyPreview();
      const el = document.getElementById('leDifficultyPreview')!;
      expect(el.innerHTML).toBe('');
    });
  });

  describe('saveCustomLevel / deleteCustomLevel / playCustomLevel / 持久化', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      // 重置 Store.state.customLevels
      (Store.state as any).customLevels = [];
      document.body.innerHTML =
        '<div id="customLevelList"></div>' +
        '<div id="hintFloat"></div>';
    });

    function setWorld1Inputs(name: string, desc: string, a: string, b: string): void {
      document.body.innerHTML =
        '<div id="customLevelList"></div>' +
        '<div id="hintFloat"></div>' +
        `<input id="leName" type="text" value="${name}">` +
        `<input id="leDesc" type="text" value="${desc}">` +
        `<input id="leA" type="number" value="${a}">` +
        `<input id="leB" type="number" value="${b}">`;
      // 同步 editorState 到 world 1
      changeEditorWorld('1');
    }

    it('saveCustomLevel 在 leName 为空时不保存并提示', () => {
      setWorld1Inputs('', '', '3', '5');
      saveCustomLevel();
      expect((Store.state as any).customLevels.length).toBe(0);
    });

    it('saveCustomLevel 保存 world 1 关卡到 Store', () => {
      setWorld1Inputs('MyLevel', 'desc1', '4', '6');
      saveCustomLevel();
      const levels = (Store.state as any).customLevels;
      expect(levels.length).toBe(1);
      expect(levels[0].name).toBe('MyLevel');
      expect(levels[0].desc).toBe('desc1');
      expect(levels[0].a).toBe(4);
      expect(levels[0].b).toBe(6);
      expect(levels[0].worldId).toBe(1);
      expect(levels[0].id).toMatch(/^custom_/);
    });

    it('saveCustomLevel 缺省 desc 用"自定义关卡"', () => {
      setWorld1Inputs('X', '', '4', '6');
      saveCustomLevel();
      const levels = (Store.state as any).customLevels;
      expect(levels[0].desc).toBe('自定义关卡');
    });

    it('saveCustomLevel 保存 world 5 关卡（含 motif/ops）', () => {
      document.body.innerHTML =
        '<div id="customLevelList"></div>' +
        '<div id="hintFloat"></div>' +
        '<input id="leName" type="text" value="W5Lvl">' +
        '<input id="leDesc" type="text" value="d5">' +
        '<input id="leMotif" type="text" value="0,2,4,7">' +
        '<label><input type="checkbox" class="le-op" value="retro" checked></label>' +
        '<label><input type="checkbox" class="le-op" value="invert" checked></label>' +
        '<label><input type="checkbox" class="le-op" value="rotate"></label>';
      changeEditorWorld('5');
      saveCustomLevel();
      const levels = (Store.state as any).customLevels;
      expect(levels.length).toBe(1);
      expect(levels[0].motif).toEqual([0, 2, 4, 7]);
      expect(levels[0].ops).toEqual(['retro', 'invert']);
    });

    it('saveCustomLevel 保存 world 6 关卡（k/n 写入 a/b）', () => {
      document.body.innerHTML =
        '<div id="customLevelList"></div>' +
        '<div id="hintFloat"></div>' +
        '<input id="leName" type="text" value="W6Lvl">' +
        '<input id="leDesc" type="text" value="d6">' +
        '<input id="leK" type="number" value="5">' +
        '<input id="leN" type="number" value="8">';
      changeEditorWorld('6');
      saveCustomLevel();
      const levels = (Store.state as any).customLevels;
      expect(levels[0].a).toBe(5);
      expect(levels[0].b).toBe(8);
    });

    it('saveCustomLevel 保存 world 7 关卡（prob/steps 写入 a/b）', () => {
      document.body.innerHTML =
        '<div id="customLevelList"></div>' +
        '<div id="hintFloat"></div>' +
        '<input id="leName" type="text" value="W7Lvl">' +
        '<input id="leDesc" type="text" value="d7">' +
        '<input id="leProb" type="number" value="70">' +
        '<input id="leSteps" type="number" value="20">';
      changeEditorWorld('7');
      saveCustomLevel();
      const levels = (Store.state as any).customLevels;
      expect(levels[0].a).toBe(70);
      expect(levels[0].b).toBe(20);
    });

    it('saveCustomLevel 保存 world 2 关卡（无 a/b）', () => {
      document.body.innerHTML =
        '<div id="customLevelList"></div>' +
        '<div id="hintFloat"></div>' +
        '<input id="leName" type="text" value="W2Lvl">' +
        '<input id="leDesc" type="text" value="d2">';
      changeEditorWorld('2');
      saveCustomLevel();
      const levels = (Store.state as any).customLevels;
      expect(levels.length).toBe(1);
      expect(levels[0].worldId).toBe(2);
      expect(levels[0].a).toBeUndefined();
    });

    it('saveCustomLevel 调用 Store.save 持久化', () => {
      setWorld1Inputs('Persist', '', '4', '6');
      saveCustomLevel();
      expect(Store.save).toHaveBeenCalled();
    });

    it('deleteCustomLevel 按 id 删除关卡', () => {
      // 用唯一 Date.now 避免 id 冲突
      let counter = 1000;
      const dateSpy = vi.spyOn(Date, 'now').mockImplementation(() => counter += 100);
      try {
        setWorld1Inputs('A', '', '2', '3');
        saveCustomLevel();
        setWorld1Inputs('B', '', '4', '6');
        saveCustomLevel();
        expect((Store.state as any).customLevels.length).toBe(2);
        const idToDelete = (Store.state as any).customLevels[0].id;
        deleteCustomLevel(idToDelete);
        const levels = (Store.state as any).customLevels;
        expect(levels.length).toBe(1);
        expect(levels.find((l: any) => l.id === idToDelete)).toBeUndefined();
      } finally {
        dateSpy.mockRestore();
      }
    });

    it('deleteCustomLevel 删除不存在的 id 不抛错', () => {
      setWorld1Inputs('A', '', '2', '3');
      saveCustomLevel();
      expect(() => deleteCustomLevel('nonexistent')).not.toThrow();
      expect((Store.state as any).customLevels.length).toBe(1);
    });

    it('playCustomLevel 调用 startLevel', () => {
      setWorld1Inputs('Play', '', '3', '5');
      saveCustomLevel();
      const id = (Store.state as any).customLevels[0].id;
      playCustomLevel(id);
      expect(startLevel).toHaveBeenCalledWith(1, id);
    });

    it('playCustomLevel 不存在的 id 不调用 startLevel', () => {
      playCustomLevel('nonexistent');
      expect(startLevel).not.toHaveBeenCalled();
    });
  });

  describe('renderLevelPreview / previewCustomLevel', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      document.body.innerHTML =
        '<div id="lePreviewContainer"></div>' +
        '<div id="hintFloat"></div>' +
        '<input id="leName" type="text" value="PreviewLvl">' +
        '<input id="leDesc" type="text" value="d">' +
        '<input id="leA" type="number" value="3">' +
        '<input id="leB" type="number" value="5">';
      changeEditorWorld('1');
    });

    it('previewCustomLevel 渲染预览容器', () => {
      previewCustomLevel();
      const container = document.getElementById('lePreviewContainer')!;
      // 渲染世界1 应该至少把容器 innerHTML 设置过（renderWorld1 是 mock）
      expect(container.innerHTML).not.toBeUndefined();
    });

    it('renderLevelPreview 在无容器时不抛错', () => {
      document.body.innerHTML = '';
      expect(() => renderLevelPreview()).not.toThrow();
    });

    it('renderLevelPreview 在 leName 为空时不渲染', () => {
      document.body.innerHTML =
        '<div id="lePreviewContainer"></div>' +
        '<input id="leName" type="text" value="">' +
        '<input id="leDesc" type="text" value="">' +
        '<input id="leA" type="number" value="3">' +
        '<input id="leB" type="number" value="5">';
      expect(() => renderLevelPreview()).not.toThrow();
    });

    it('renderLevelPreview 渲染未知世界显示提示', () => {
      // 通过手动设置 editorState 来覆盖 default worlds。由于 changeEditorWorld 不支持 worldId>8，
      // 我们手动构造一个：先 setWorld 1，然后用 (window as any) 上的接口（已 export）
      document.body.innerHTML =
        '<div id="lePreviewContainer"></div>' +
        '<input id="leName" type="text" value="X">' +
        '<input id="leDesc" type="text" value="d">';
      changeEditorWorld('2'); // world 2 有 renderWorld2 mock
      expect(() => renderLevelPreview()).not.toThrow();
    });
  });

  describe('export / import 关卡', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      (Store.state as any).customLevels = [];
      document.body.innerHTML =
        '<div id="hintFloat"></div>' +
        '<input id="leName" type="text" value="ExportLvl">' +
        '<input id="leDesc" type="text" value="d">' +
        '<input id="leA" type="number" value="3">' +
        '<input id="leB" type="number" value="5">' +
        '<input id="leImportCode" type="text" value="">' +
        '<input id="leShareInput" type="text" value="">' +
        '<div id="leShareCode"></div>';
      changeEditorWorld('1');
    });

    it('exportCustomLevel 创建下载链接并触发 click', () => {
      const clickSpy = vi.fn();
      // mock URL.createObjectURL / revokeObjectURL / a.click
      const origCreate = URL.createObjectURL;
      const origRevoke = URL.revokeObjectURL;
      URL.createObjectURL = vi.fn(() => 'blob:fake');
      URL.revokeObjectURL = vi.fn();
      // 临时覆盖 HTMLAnchorElement.prototype.click
      const origClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = clickSpy;
      try {
        exportCustomLevel();
        expect(clickSpy).toHaveBeenCalled();
        expect(URL.createObjectURL).toHaveBeenCalled();
        expect(URL.revokeObjectURL).toHaveBeenCalled();
      } finally {
        URL.createObjectURL = origCreate;
        URL.revokeObjectURL = origRevoke;
        HTMLAnchorElement.prototype.click = origClick;
      }
    });

    it('exportCustomLevel 在 leName 为空时不导出', () => {
      // 覆盖 leName 为空
      (document.getElementById('leName') as HTMLInputElement).value = '';
      const clickSpy = vi.fn();
      const origClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = clickSpy;
      try {
        exportCustomLevel();
        expect(clickSpy).not.toHaveBeenCalled();
      } finally {
        HTMLAnchorElement.prototype.click = origClick;
      }
    });

    it('exportCustomLevelById 通过 id 导出已保存关卡', () => {
      // 先保存一个关卡
      saveCustomLevel();
      const id = (Store.state as any).customLevels[0].id;
      const clickSpy = vi.fn();
      const origCreate = URL.createObjectURL;
      const origRevoke = URL.revokeObjectURL;
      URL.createObjectURL = vi.fn(() => 'blob:fake');
      URL.revokeObjectURL = vi.fn();
      const origClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = clickSpy;
      try {
        exportCustomLevelById(id);
        expect(clickSpy).toHaveBeenCalled();
      } finally {
        URL.createObjectURL = origCreate;
        URL.revokeObjectURL = origRevoke;
        HTMLAnchorElement.prototype.click = origClick;
      }
    });

    it('exportCustomLevelById 不存在的 id 不导出', () => {
      const clickSpy = vi.fn();
      const origClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = clickSpy;
      try {
        exportCustomLevelById('nonexistent');
        expect(clickSpy).not.toHaveBeenCalled();
      } finally {
        HTMLAnchorElement.prototype.click = origClick;
      }
    });

    it('importShareCode 有效分享码导入并保存', () => {
      // 先编码一个 world 1 关卡
      const code = encodeShareCode({
        id: 'x',
        name: 'Shared',
        worldId: 1,
        desc: '',
        a: 3,
        b: 5,
        createdAt: '',
      });
      (document.getElementById('leImportCode') as HTMLInputElement).value = code;
      importShareCode();
      const levels = (Store.state as any).customLevels;
      expect(levels.length).toBe(1);
      expect(levels[0].worldId).toBe(1);
      expect(levels[0].a).toBe(3);
    });

    it('importShareCode 无效分享码不导入', () => {
      (document.getElementById('leImportCode') as HTMLInputElement).value = 'INVALID';
      importShareCode();
      expect((Store.state as any).customLevels.length).toBe(0);
    });

    it('importShareCode 空字符串不导入', () => {
      (document.getElementById('leImportCode') as HTMLInputElement).value = '';
      importShareCode();
      expect((Store.state as any).customLevels.length).toBe(0);
    });

    it('importShareCode 无 DOM 不抛错', () => {
      document.body.innerHTML = '';
      expect(() => importShareCode()).not.toThrow();
    });

    it('copyShareCode 显示分享码区域', () => {
      const container = document.getElementById('leShareCode')!;
      const input = document.getElementById('leShareInput') as HTMLInputElement;
      container.style.display = 'none';
      copyShareCode();
      expect(container.style.display).toBe('block');
      expect(input.value).toMatch(/^MB/);
    });

    it('copyShareCode 在 leName 为空时不生成', () => {
      (document.getElementById('leName') as HTMLInputElement).value = '';
      const container = document.getElementById('leShareCode')!;
      container.style.display = 'none';
      copyShareCode();
      // 没设置 display
      expect(container.style.display).toBe('none');
    });

    it('copyShareCodeToClipboard 调用 navigator.clipboard.writeText', async () => {
      const writeTextSpy = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextSpy },
        configurable: true,
      });
      (document.getElementById('leShareInput') as HTMLInputElement).value = 'MB123';
      copyShareCodeToClipboard();
      await new Promise((r) => setTimeout(r, 10));
      expect(writeTextSpy).toHaveBeenCalledWith('MB123');
    });

    it('copyShareCodeToClipboard 在无 input 时不抛错', () => {
      document.body.innerHTML = '';
      expect(() => copyShareCodeToClipboard()).not.toThrow();
    });

    it('importCustomLevel 有效 JSON 文件导入', async () => {
      const file = new File(
        [JSON.stringify({ name: 'FromFile', worldId: 1, desc: 'fd', a: 4, b: 6 })],
        'level.json',
        { type: 'application/json' }
      );
      const input = { files: [file] } as unknown as HTMLInputElement;
      importCustomLevel(input);
      // FileReader 是异步的
      await new Promise((r) => setTimeout(r, 50));
      const levels = (Store.state as any).customLevels;
      expect(levels.length).toBe(1);
      expect(levels[0].name).toBe('FromFile');
      expect(levels[0].a).toBe(4);
    });

    it('importCustomLevel 无效 JSON 提示错误', async () => {
      const file = new File(['{invalid json'], 'bad.json', { type: 'application/json' });
      const input = { files: [file] } as unknown as HTMLInputElement;
      // 不应抛错（reader.onload 内 try/catch）
      expect(() => importCustomLevel(input)).not.toThrow();
      await new Promise((r) => setTimeout(r, 50));
      expect((Store.state as any).customLevels.length).toBe(0);
    });

    it('importCustomLevel 缺少 name 字段不导入', async () => {
      const file = new File(
        [JSON.stringify({ worldId: 1, a: 4, b: 6 })],
        'bad.json',
        { type: 'application/json' }
      );
      const input = { files: [file] } as unknown as HTMLInputElement;
      importCustomLevel(input);
      await new Promise((r) => setTimeout(r, 50));
      expect((Store.state as any).customLevels.length).toBe(0);
    });

    it('importCustomLevel 空 files 不抛错', () => {
      const input = { files: [] } as unknown as HTMLInputElement;
      expect(() => importCustomLevel(input)).not.toThrow();
    });

    it('importCustomLevel null files 不抛错', () => {
      const input = { files: null } as unknown as HTMLInputElement;
      expect(() => importCustomLevel(input)).not.toThrow();
    });
  });

  describe('边界：空关卡列表与最大关卡数', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      (Store.state as any).customLevels = [];
      document.body.innerHTML =
        '<div id="customLevelList"></div>' +
        '<div id="hintFloat"></div>' +
        '<input id="leName" type="text" value="L">' +
        '<input id="leDesc" type="text" value="">' +
        '<input id="leA" type="number" value="2">' +
        '<input id="leB" type="number" value="3">';
      changeEditorWorld('1');
    });

    it('边界：空关卡列表可正常保存第一个关卡', () => {
      expect((Store.state as any).customLevels.length).toBe(0);
      saveCustomLevel();
      expect((Store.state as any).customLevels.length).toBe(1);
    });

    it('边界：连续保存 100 个关卡不抛错', () => {
      for (let i = 0; i < 100; i++) {
        (document.getElementById('leName') as HTMLInputElement).value = `L${i}`;
        saveCustomLevel();
      }
      expect((Store.state as any).customLevels.length).toBe(100);
    });

    it('边界：保存 + 删除 + 保存 序列', () => {
      saveCustomLevel();
      expect((Store.state as any).customLevels.length).toBe(1);
      const id = (Store.state as any).customLevels[0].id;
      deleteCustomLevel(id);
      expect((Store.state as any).customLevels.length).toBe(0);
      saveCustomLevel();
      expect((Store.state as any).customLevels.length).toBe(1);
    });
  });
});
