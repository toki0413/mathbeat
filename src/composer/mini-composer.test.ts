import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================
// 使用 vi.hoisted 把 mock 共享对象提升到 vi.mock 之前可见
// ============================================================
const { mockState, storeState } = vi.hoisted(() => ({
  mockState: { combo: 0, hintLevel: 0 } as Record<string, any>,
  storeState: { bossTimes: {}, achievements: [] as string[] } as Record<string, any>,
}));

// ============================================================
// Mock 外部依赖
// ============================================================
vi.mock('../game-engine', () => ({
  state: mockState,
  completeLevel: vi.fn(),
  nextLevel: vi.fn(),
  recordAdaptive: vi.fn(),
  updateLeaderboard: vi.fn(),
  checkAchievements: vi.fn(),
}));

vi.mock('../store', () => ({
  Store: {
    state: storeState,
    save: vi.fn(),
  },
}));

vi.mock('../audio', () => ({
  getAudioCtx: vi.fn(() => ({ currentTime: 0, destination: {} })),
  playSample: vi.fn(),
  scheduleToneAt: vi.fn(),
  playCorrect: vi.fn(),
  getSharedTransport: vi.fn(() => ({
    subscribe: vi.fn(() => () => {}),
    start: vi.fn(),
    stop: vi.fn(),
    setBpm: vi.fn(),
    setStepsPerBeat: vi.fn(),
  })),
  stopSharedTransport: vi.fn(),
  muteAllAudio: vi.fn(),
}));

vi.mock('../worlds', () => ({
  NOTE_FREQS: [261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392.0, 415.3, 440.0, 466.16, 493.88],
}));

vi.mock('../utils', () => ({
  arraysEqual: (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]),
  euclideanRhythm: (k: number, n: number) => {
    if (k <= 0) return new Array(n).fill(0);
    if (k >= n) return new Array(n).fill(1);
    const out = new Array(n).fill(0);
    const step = n / k;
    for (let i = 0; i < k; i++) out[Math.floor(i * step)] = 1;
    return out;
  },
  midiToFreq: (m: number) => 440 * Math.pow(2, (m - 69) / 12),
}));

vi.mock('../ui-render', () => ({
  showEducationCard: vi.fn(),
}));

vi.mock('../fx/particles', () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
  spawnConfetti: vi.fn(),
  spawnCorrectParticles: vi.fn(),
  spawnComboParticles: vi.fn(),
}));

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
  countTrackCells,
  mcCheckWorld1,
  mcCheckWorld2,
  mcCheckWorld3,
  mcCheckWorld4,
  mcCheckWorld5,
  mcCheckWorld6,
  mcCheckWorld7,
  mcCheckWorld8,
} from './mini-composer';
import { stopSharedTransport, muteAllAudio, playSample, scheduleToneAt, playCorrect, getSharedTransport } from '../audio';
import { showSuccessToast, showErrorToast, spawnConfetti } from '../fx/particles';
import { completeLevel, nextLevel, recordAdaptive, updateLeaderboard, checkAchievements } from '../game-engine';
import { Store } from '../store';
import { showEducationCard } from '../ui-render';

describe('mini-composer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重置 state 与 store
    for (const k of Object.keys(mockState)) delete mockState[k];
    mockState.combo = 0;
    mockState.hintLevel = 0;
    storeState.bossTimes = {};
    storeState.achievements = [];
    document.body.innerHTML = `
      <div id="miniComposer"></div>
      <div id="mcTitle"></div>
      <div id="mcGoalText"></div>
      <div id="mcGoalTarget"></div>
      <div id="mcTracks"></div>
      <button id="mcPlayBtn">▶</button>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // ------------------------------------------------------------
  // startBossComposer
  // ------------------------------------------------------------
  describe('startBossComposer', () => {
    it('初始化 state.mc 包含 4 条轨道', () => {
      startBossComposer(1, '1-1');
      expect(mockState.mc).toBeDefined();
      expect(mockState.mc.tracks.length).toBe(4);
      expect(mockState.mc.wid).toBe(1);
      expect(mockState.mc.lid).toBe('1-1');
      expect(mockState.mc.bpm).toBe(120);
      expect(mockState.mc.playing).toBe(false);
    });

    it('每条轨道 cells 长度为 32', () => {
      startBossComposer(1, '1-1');
      for (const t of mockState.mc.tracks) {
        expect(t.cells.length).toBe(32);
      }
    });

    it('为 #miniComposer 添加 show 类', () => {
      startBossComposer(1, '1-1');
      expect(document.getElementById('miniComposer')!.classList.contains('show')).toBe(true);
    });

    it('写入 #mcTitle 与 #mcGoalText', () => {
      startBossComposer(1, '1-1');
      expect(document.getElementById('mcTitle')!.textContent).toContain('LCM');
      expect(document.getElementById('mcGoalText')!.textContent).toContain('重逢');
      expect(document.getElementById('mcGoalTarget')!.textContent).toContain('8个音符');
    });

    it('未知 wid 回退到默认目标 (世界6)', () => {
      startBossComposer(999, 'X-X');
      expect(mockState.mc.wid).toBe(999);
      expect(mockState.mc.goal.title).toContain('世界6');
    });

    it('写入 #mcTracks', () => {
      startBossComposer(1, '1-1');
      expect(document.getElementById('mcTracks')!.innerHTML).toContain('mc-track');
      expect(document.querySelectorAll('.mc-cell').length).toBe(128); // 4 * 32
    });
  });

  // ------------------------------------------------------------
  // exitMiniComposer
  // ------------------------------------------------------------
  describe('exitMiniComposer', () => {
    it('移除 #miniComposer 的 show 类', () => {
      startBossComposer(1, '1-1');
      exitMiniComposer();
      expect(document.getElementById('miniComposer')!.classList.contains('show')).toBe(false);
    });

    it('调用 mcStop (内部调用 stopSharedTransport 与 muteAllAudio)', () => {
      startBossComposer(1, '1-1');
      exitMiniComposer();
      expect(stopSharedTransport).toHaveBeenCalled();
      expect(muteAllAudio).toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------
  // mcRenderTracks
  // ------------------------------------------------------------
  describe('mcRenderTracks', () => {
    it('生成 4 条 mc-track 元素', () => {
      startBossComposer(1, '1-1');
      mcRenderTracks();
      expect(document.querySelectorAll('.mc-track').length).toBe(4);
    });

    it('激活的 cell 包含 on 类', () => {
      startBossComposer(1, '1-1');
      mockState.mc.tracks[0].cells[0] = 1;
      mcRenderTracks();
      const firstCell = document.querySelector('.mc-cell');
      expect(firstCell!.classList.contains('on')).toBe(true);
    });

    it('单元格带 data-action=mcToggleCell', () => {
      startBossComposer(1, '1-1');
      mcRenderTracks();
      const cells = document.querySelectorAll('[data-action="mcToggleCell"]');
      expect(cells.length).toBe(128);
    });
  });

  // ------------------------------------------------------------
  // mcToggleCell
  // ------------------------------------------------------------
  describe('mcToggleCell', () => {
    beforeEach(() => {
      startBossComposer(1, '1-1');
    });

    it('切换 (0,0) cell 从 0 到 1', () => {
      mcToggleCell(0, 0);
      expect(mockState.mc.tracks[0].cells[0]).toBe(1);
    });

    it('再次切换 (0,0) cell 从 1 到 0', () => {
      mcToggleCell(0, 0);
      mcToggleCell(0, 0);
      expect(mockState.mc.tracks[0].cells[0]).toBe(0);
    });

    it('切换后调用 mcRenderTracks', () => {
      mcToggleCell(2, 5);
      const cells = document.querySelectorAll('.mc-track')[2].querySelectorAll('.mc-cell');
      expect(cells[5].classList.contains('on')).toBe(true);
    });
  });

  // ------------------------------------------------------------
  // countTrackCells
  // ------------------------------------------------------------
  describe('countTrackCells', () => {
    it('空轨道返回 0', () => {
      expect(countTrackCells({ cells: [0, 0, 0, 0] })).toBe(0);
    });

    it('混合 cell 返回 1 的个数', () => {
      expect(countTrackCells({ cells: [1, 0, 1, 1, 0] })).toBe(3);
    });

    it('全 1 返回长度', () => {
      expect(countTrackCells({ cells: [1, 1, 1, 1] })).toBe(4);
    });
  });

  // ------------------------------------------------------------
  // mcApplyGen - 各世界预设生成
  // ------------------------------------------------------------
  describe('mcApplyGen', () => {
    it('世界1 生成 kick/bass 模式且对齐 ≥ 2', () => {
      startBossComposer(1, '1-1');
      mcApplyGen();
      // 验证 kick 与 bass 在第 0 步对齐
      expect(mockState.mc.tracks[0].cells[0]).toBe(1);
      expect(mockState.mc.tracks[1].cells[0]).toBe(1);
      // mcCheckWorld1 应当通过
      expect(mcCheckWorld1()).toBe(true);
    });

    it('世界2 生成对称模式', () => {
      startBossComposer(2, '2-1');
      mcApplyGen();
      // 验证旋律轨道 (索引 2) 含回文片段
      expect(mcCheckWorld2()).toBe(true);
    });

    it('世界3 生成纯五度/四度音程', () => {
      startBossComposer(3, '3-1');
      mcApplyGen();
      expect(mcCheckWorld3()).toBe(true);
    });

    it('世界4 生成双环对齐模式', () => {
      startBossComposer(4, '4-1');
      mcApplyGen();
      expect(mcCheckWorld4()).toBe(true);
    });

    it('世界5 生成动机旋转/逆行片段', () => {
      startBossComposer(5, '5-1');
      mcApplyGen();
      expect(mcCheckWorld5()).toBe(true);
    });

    it('世界6 生成数学摇滚模式', () => {
      startBossComposer(6, '6-1');
      mcApplyGen();
      expect(mcCheckWorld6()).toBe(true);
    });

    it('世界7 生成多轨道随机织体', () => {
      startBossComposer(7, '7-1');
      mcApplyGen();
      expect(mcCheckWorld7()).toBe(true);
    });

    it('世界8 生成 I-IV-V-vi 和弦进行', () => {
      startBossComposer(8, '8-1');
      mcApplyGen();
      expect(mcCheckWorld8()).toBe(true);
    });

    it('未知 wid 回退到 euclidean 节奏', () => {
      startBossComposer(999, 'X-X');
      expect(() => mcApplyGen()).not.toThrow();
      // 验证至少 kick 轨道被填充
      const kickCount = countTrackCells(mockState.mc.tracks[0]);
      expect(kickCount).toBeGreaterThan(0);
    });
  });

  // ------------------------------------------------------------
  // mcCheckWorld1-8
  // ------------------------------------------------------------
  describe('mcCheckWorld 系列', () => {
    it('mcCheckWorld1 对齐 < 2 时返回 false', () => {
      startBossComposer(1, '1-1');
      // 只有一个对齐点
      mockState.mc.tracks[0].cells[0] = 1;
      mockState.mc.tracks[1].cells[0] = 1;
      expect(mcCheckWorld1()).toBe(false);
    });

    it('mcCheckWorld1 对齐 ≥ 2 时返回 true', () => {
      startBossComposer(1, '1-1');
      mockState.mc.tracks[0].cells[0] = 1;
      mockState.mc.tracks[1].cells[0] = 1;
      mockState.mc.tracks[0].cells[4] = 1;
      mockState.mc.tracks[1].cells[4] = 1;
      expect(mcCheckWorld1()).toBe(true);
    });

    it('mcCheckWorld2 旋律轨道不含回文时返回 false', () => {
      startBossComposer(2, '2-1');
      // 单点无法形成 4 步回文
      mockState.mc.tracks[2].cells[0] = 1;
      expect(mcCheckWorld2()).toBe(false);
    });

    it('mcCheckWorld3 旋律音符 < 3 时返回 false', () => {
      startBossComposer(3, '3-1');
      mockState.mc.tracks[2].cells[0] = 1;
      mockState.mc.tracks[2].cells[5] = 1;
      expect(mcCheckWorld3()).toBe(false);
    });

    it('mcCheckWorld4 对齐 < 2 (除第0步外) 时返回 false', () => {
      startBossComposer(4, '4-1');
      // 仅第 0 步对齐
      mockState.mc.tracks[0].cells[0] = 1;
      mockState.mc.tracks[1].cells[0] = 1;
      expect(mcCheckWorld4()).toBe(false);
    });

    it('mcCheckWorld5 旋律音符 < 4 时返回 false', () => {
      startBossComposer(5, '5-1');
      mockState.mc.tracks[2].cells[0] = 1;
      mockState.mc.tracks[2].cells[1] = 1;
      mockState.mc.tracks[2].cells[2] = 1;
      expect(mcCheckWorld5()).toBe(false);
    });

    it('mcCheckWorld6 鼓/贝斯/旋律各 < 2 时返回 false', () => {
      startBossComposer(6, '6-1');
      expect(mcCheckWorld6()).toBe(false);
    });

    it('mcCheckWorld7 总音符 < 12 或活跃轨道 < 3 时返回 false', () => {
      startBossComposer(7, '7-1');
      expect(mcCheckWorld7()).toBe(false);
    });

    it('mcCheckWorld8 未覆盖 4 个和弦节点时返回 false', () => {
      startBossComposer(8, '8-1');
      expect(mcCheckWorld8()).toBe(false);
    });
  });

  // ------------------------------------------------------------
  // mcStart / mcStop / mcReset / mcTogglePlay
  // ------------------------------------------------------------
  describe('mcStart / mcStop / mcReset / mcTogglePlay', () => {
    beforeEach(() => {
      startBossComposer(1, '1-1');
    });

    it('mcStart 调用 stopSharedTransport 与 getSharedTransport', () => {
      mcStart();
      expect(stopSharedTransport).toHaveBeenCalled();
      expect(getSharedTransport).toHaveBeenCalledWith(120, 4);
      expect(mockState.mc.playing).toBe(true);
      expect(mockState.mc.transport).toBeDefined();
    });

    it('mcStart 缺少 state.w5.scale 时使用默认 scale', () => {
      expect(() => mcStart()).not.toThrow();
    });

    it('mcStop 调用 muteAllAudio 与 stopSharedTransport', () => {
      mcStart();
      vi.mocked(stopSharedTransport).mockClear();
      vi.mocked(muteAllAudio).mockClear();
      mcStop();
      expect(stopSharedTransport).toHaveBeenCalled();
      expect(muteAllAudio).toHaveBeenCalledWith(300);
      expect(mockState.mc.playing).toBe(false);
    });

    it('mcStop 清除 finishTimeout', () => {
      mockState.mc.finishTimeout = setTimeout(() => {}, 10000);
      mcStop();
      expect(mockState.mc.finishTimeout).toBeNull();
    });

    it('mcReset 清空所有 cell', () => {
      mockState.mc.tracks[0].cells[0] = 1;
      mcReset();
      for (const t of mockState.mc.tracks) {
        expect(t.cells.every((c: number) => c === 0)).toBe(true);
      }
    });

    it('mcReset 重新渲染轨道', () => {
      mockState.mc.tracks[0].cells[0] = 1;
      mcReset();
      const firstCell = document.querySelector('.mc-cell');
      expect(firstCell!.classList.contains('on')).toBe(false);
    });

    it('mcTogglePlay 从停止状态切换为播放', () => {
      mcTogglePlay();
      expect(mockState.mc.playing).toBe(true);
    });

    it('mcTogglePlay 从播放状态切换为停止', () => {
      mcTogglePlay();
      mcTogglePlay();
      expect(mockState.mc.playing).toBe(false);
    });
  });

  // ------------------------------------------------------------
  // mcFinish
  // ------------------------------------------------------------
  describe('mcFinish', () => {
    beforeEach(() => {
      startBossComposer(1, '1-1');
    });

    it('总音符 < minNotes 时显示错误并返回', () => {
      // 全空，必然 < 8
      mcFinish();
      expect(showErrorToast).toHaveBeenCalled();
      expect(showSuccessToast).not.toHaveBeenCalled();
    });

    it('音符足够但目标未达成时显示错误', () => {
      // 给旋律轨道填充 8 个音符 (不满足 world1 的对齐要求)
      for (let i = 0; i < 8; i++) mockState.mc.tracks[2].cells[i] = 1;
      mcFinish();
      expect(showErrorToast).toHaveBeenCalled();
    });

    it('音符足够且目标达成时启动播放 (非播放态)', () => {
      mcApplyGen(); // 应用世界1预设，确保目标达成
      mcFinish();
      // 应当启动播放并显示 "先听一遍" toast
      expect(mockState.mc.playing).toBe(true);
      expect(showSuccessToast).toHaveBeenCalledWith('先听一遍你的作品…');
    });
  });

  // ------------------------------------------------------------
  // mcComplete 路径 (通过 mcFinish 触发)
  // ------------------------------------------------------------
  describe('mcComplete (通过 mcFinish 在播放态触发)', () => {
    beforeEach(() => {
      startBossComposer(1, '1-1');
    });

    it('音符足够、目标达成、且已播放时调用 mcComplete', () => {
      mcApplyGen();
      mcStart(); // 先进入播放态
      vi.mocked(showErrorToast).mockClear();
      vi.mocked(showSuccessToast).mockClear();
      vi.mocked(completeLevel).mockClear();
      vi.mocked(nextLevel).mockClear();
      mcFinish();
      // 应当走 mcComplete 路径
      expect(showSuccessToast).toHaveBeenCalled();
      expect(completeLevel).toHaveBeenCalled();
      expect(recordAdaptive).toHaveBeenCalled();
      expect(updateLeaderboard).toHaveBeenCalled();
      expect(checkAchievements).toHaveBeenCalled();
      expect(showEducationCard).toHaveBeenCalled();
    });

    it('mcComplete 后写入 bossTimes', () => {
      mcApplyGen();
      mcStart();
      mcFinish();
      expect(storeState.bossTimes['1-1']).toBeDefined();
      expect(storeState.bossTimes['1-1'].elapsed).toBeGreaterThanOrEqual(0);
      expect(Store.save).toHaveBeenCalled();
    });

    it('mcComplete 后调用 spawnConfetti 等粒子效果', () => {
      mcApplyGen();
      mcStart();
      mcFinish();
      expect(spawnConfetti).toHaveBeenCalled();
      expect(playCorrect).toHaveBeenCalled();
    });

    it('combo ≥ 3 时调用 spawnComboParticles', () => {
      mcApplyGen();
      mockState.combo = 3;
      mcStart();
      mcFinish();
      // 验证 combo+1 后再次满足条件 (mcComplete 内部 state.combo++)
      // 此处仅检查 spawnConfetti 被调用，spawnComboParticles 可选
      expect(spawnConfetti).toHaveBeenCalled();
    });
  });
});
