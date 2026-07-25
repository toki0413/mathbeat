import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================
// 使用 vi.hoisted 把 mock 共享对象提升到 vi.mock 之前可见
// ============================================================
const { mockState, mockTransportCallbacks } = vi.hoisted(() => ({
  mockState: {} as Record<string, any>,
  mockTransportCallbacks: [] as ((e: any) => void)[],
}));

// ============================================================
// Mock 外部依赖
// ============================================================
vi.mock('./game-engine', () => ({
  state: mockState,
}));

vi.mock('./audio', () => ({
  getAudioCtx: vi.fn(() => ({ currentTime: 0, destination: {} })),
  playSample: vi.fn(),
  scheduleHihatAt: vi.fn(),
  scheduleToneAt: vi.fn(),
  getSharedTransport: vi.fn(() => ({
    subscribe: vi.fn((cb: (e: any) => void) => {
      // 暴露 callback 以便测试中可以手动触发
      mockTransportCallbacks.push(cb);
      return () => {};
    }),
    start: vi.fn(),
    stop: vi.fn(),
    setBpm: vi.fn(),
    setStepsPerBeat: vi.fn(),
  })),
  stopSharedTransport: vi.fn(),
}));

vi.mock('./worlds', () => ({
  NOTE_FREQS: [261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392.0, 415.3, 440.0, 466.16, 493.88],
}));

vi.mock('./worlds/world5', () => ({
  w5DegreeName: (d: number) => {
    const names = ['do', 're', 'mi', 'fa', 'sol', 'la', 'si'];
    return names[d % 7];
  },
}));

vi.mock('./events', () => ({
  registerActions: vi.fn(),
}));

import {
  fmInit,
  fmRenderTracks,
  fmToggleCell,
  fmPlay,
  fmStop,
  fmTogglePlay,
  fmReset,
  fmChangeBpm,
} from './free-mode';
import { getSharedTransport, stopSharedTransport, playSample, scheduleToneAt, scheduleHihatAt } from './audio';
import { registerActions } from './events';

describe('free-mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重置 state
    for (const k of Object.keys(mockState)) delete mockState[k];
    mockTransportCallbacks.length = 0;
    document.body.innerHTML = `
      <div id="fmBpm">120</div>
      <div id="freeTracks"></div>
      <button id="fmPlayBtn">▶</button>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // ------------------------------------------------------------
  // fmInit
  // ------------------------------------------------------------
  describe('fmInit', () => {
    it('初始化 state.free 包含 4 条轨道', () => {
      fmInit();
      expect(mockState.free).toBeDefined();
      expect(mockState.free.tracks.length).toBe(4);
      expect(mockState.free.bpm).toBe(120);
      expect(mockState.free.scale).toEqual([0, 2, 4, 5, 7, 9, 11]);
    });

    it('每条轨道 cells 长度为 16', () => {
      fmInit();
      for (const t of mockState.free.tracks) {
        expect(t.cells.length).toBe(16);
        expect(t.cells.every((c: number) => c === 0)).toBe(true);
      }
    });

    it('旋律轨道包含 pitches', () => {
      fmInit();
      const melody = mockState.free.tracks.find((t: any) => t.type === 'melody');
      expect(melody.pitches).toBeDefined();
      expect(melody.pitches.length).toBe(16);
    });

    it('写入 #fmBpm', () => {
      const el = document.getElementById('fmBpm')!;
      el.textContent = '';
      fmInit();
      expect(el.textContent).toBe('120');
    });

    it('不抛错即使 #fmBpm 不存在', () => {
      document.body.innerHTML = '<div id="freeTracks"></div>';
      expect(() => fmInit()).not.toThrow();
    });

    it('fmInit 后调用 fmRenderTracks 写入 #freeTracks', () => {
      fmInit();
      const el = document.getElementById('freeTracks')!;
      expect(el.innerHTML).toContain('free-track');
      expect(el.querySelectorAll('.free-cell').length).toBe(64); // 4 轨 * 16 步
    });
  });

  // ------------------------------------------------------------
  // fmRenderTracks
  // ------------------------------------------------------------
  describe('fmRenderTracks', () => {
    it('state.free 未初始化时不抛错', () => {
      expect(() => fmRenderTracks()).not.toThrow();
    });

    it('缺少 #freeTracks 不抛错', () => {
      fmInit();
      document.body.innerHTML = '';
      expect(() => fmRenderTracks()).not.toThrow();
    });

    it('单元格点击带 data-action=fmToggleCell', () => {
      fmInit();
      const cells = document.querySelectorAll('[data-action="fmToggleCell"]');
      expect(cells.length).toBe(64);
    });

    it('旋律轨道格子带 do/re/mi 度数文本', () => {
      fmInit();
      const trackEls = document.querySelectorAll('.free-track');
      const melodyTrack = trackEls[3]; // 第 4 条 = 旋律
      const cells = melodyTrack.querySelectorAll('.free-cell');
      // pitches = [0, 2, 4, 5, 7, 9, 11, ...] → w5DegreeName(d) = names[d % 7]
      // pitches[0]=0 → 'do', pitches[1]=2 → 'mi'
      expect(cells[0].textContent).toBe('do');
      expect(cells[1].textContent).toBe('mi');
    });

    it('激活的 cell 包含 on 类', () => {
      fmInit();
      mockState.free.tracks[0].cells[0] = 1;
      fmRenderTracks();
      const firstCell = document.querySelector('.free-cell');
      expect(firstCell!.classList.contains('on')).toBe(true);
    });
  });

  // ------------------------------------------------------------
  // fmToggleCell
  // ------------------------------------------------------------
  describe('fmToggleCell', () => {
    beforeEach(() => {
      fmInit();
    });

    it('切换 (0,0) cell 从 0 到 1', () => {
      fmToggleCell(new Event('click'), 0, 0);
      expect(mockState.free.tracks[0].cells[0]).toBe(1);
    });

    it('再次切换 (0,0) cell 从 1 到 0', () => {
      fmToggleCell(new Event('click'), 0, 0);
      fmToggleCell(new Event('click'), 0, 0);
      expect(mockState.free.tracks[0].cells[0]).toBe(0);
    });

    it('切换后调用 fmRenderTracks (DOM 已更新)', () => {
      fmToggleCell(new Event('click'), 1, 5);
      const cells = document.querySelectorAll('.free-track')[1].querySelectorAll('.free-cell');
      expect(cells[5].classList.contains('on')).toBe(true);
    });

    it('state.free 未初始化时不抛错', () => {
      for (const k of Object.keys(mockState)) delete mockState[k];
      expect(() => fmToggleCell(new Event('click'), 0, 0)).not.toThrow();
    });
  });

  // ------------------------------------------------------------
  // fmPlay / fmStop
  // ------------------------------------------------------------
  describe('fmPlay / fmStop', () => {
    beforeEach(() => {
      fmInit();
    });

    it('fmPlay 启动 transport 并订阅', () => {
      fmPlay();
      expect(mockState.free.playing).toBe(true);
      expect(getSharedTransport).toHaveBeenCalledWith(120, 4);
      expect(mockTransportCallbacks.length).toBeGreaterThan(0);
    });

    it('fmPlay 在 transport 回调中触发鼓/镲/旋律音色', () => {
      // 设置各种类型 cell
      mockState.free.tracks[0].cells[0] = 1; // kick
      mockState.free.tracks[1].cells[0] = 1; // snare
      mockState.free.tracks[2].cells[0] = 1; // hihat
      mockState.free.tracks[3].cells[0] = 1; // melody
      fmPlay();
      const cb = mockTransportCallbacks[mockTransportCallbacks.length - 1];
      vi.mocked(playSample).mockClear();
      vi.mocked(scheduleHihatAt).mockClear();
      vi.mocked(scheduleToneAt).mockClear();
      cb({ step: 0, time: 0 });
      expect(playSample).toHaveBeenCalledTimes(2); // kick + snare
      expect(scheduleHihatAt).toHaveBeenCalledTimes(1);
      expect(scheduleToneAt).toHaveBeenCalledTimes(1);
    });

    it('fmPlay state.free 未初始化时不抛错', () => {
      for (const k of Object.keys(mockState)) delete mockState[k];
      expect(() => fmPlay()).not.toThrow();
    });

    it('fmStop 重置 playing 状态', () => {
      fmPlay();
      fmStop();
      expect(mockState.free.playing).toBe(false);
      expect(stopSharedTransport).toHaveBeenCalled();
      expect(mockState.free.transport).toBeNull();
    });

    it('fmStop state.free 未初始化时不抛错', () => {
      for (const k of Object.keys(mockState)) delete mockState[k];
      expect(() => fmStop()).not.toThrow();
    });
  });

  // ------------------------------------------------------------
  // fmTogglePlay
  // ------------------------------------------------------------
  describe('fmTogglePlay', () => {
    beforeEach(() => {
      fmInit();
    });

    it('从停止状态切换为播放', () => {
      fmTogglePlay();
      expect(mockState.free.playing).toBe(true);
      const btn = document.getElementById('fmPlayBtn')!;
      expect(btn.textContent).toBe('⏸');
    });

    it('从播放状态切换为停止', () => {
      fmTogglePlay();
      fmTogglePlay();
      expect(mockState.free.playing).toBe(false);
      const btn = document.getElementById('fmPlayBtn')!;
      expect(btn.textContent).toBe('▶');
    });

    it('state.free 未初始化时不抛错', () => {
      for (const k of Object.keys(mockState)) delete mockState[k];
      expect(() => fmTogglePlay()).not.toThrow();
    });
  });

  // ------------------------------------------------------------
  // fmReset
  // ------------------------------------------------------------
  describe('fmReset', () => {
    beforeEach(() => {
      fmInit();
    });

    it('fmReset 清空所有 cell', () => {
      mockState.free.tracks[0].cells[0] = 1;
      mockState.free.tracks[1].cells[5] = 1;
      fmReset();
      for (const t of mockState.free.tracks) {
        expect(t.cells.every((c: number) => c === 0)).toBe(true);
      }
    });

    it('fmReset 调用 fmStop', () => {
      fmPlay();
      vi.mocked(stopSharedTransport).mockClear();
      fmReset();
      expect(stopSharedTransport).toHaveBeenCalled();
    });

    it('fmReset 重置按钮文本', () => {
      const btn = document.getElementById('fmPlayBtn')!;
      btn.textContent = '⏸';
      fmReset();
      expect(btn.textContent).toBe('▶');
    });

    it('fmReset 重新渲染轨道', () => {
      mockState.free.tracks[0].cells[0] = 1;
      fmReset();
      const firstCell = document.querySelector('.free-cell');
      expect(firstCell!.classList.contains('on')).toBe(false);
    });

    it('state.free 未初始化时不抛错', () => {
      for (const k of Object.keys(mockState)) delete mockState[k];
      expect(() => fmReset()).not.toThrow();
    });
  });

  // ------------------------------------------------------------
  // fmChangeBpm
  // ------------------------------------------------------------
  describe('fmChangeBpm', () => {
    beforeEach(() => {
      fmInit();
    });

    it('+10 后 bpm 从 120 变为 130', () => {
      fmChangeBpm(10);
      expect(mockState.free.bpm).toBe(130);
      const el = document.getElementById('fmBpm')!;
      expect(el.textContent).toBe('130');
    });

    it('-10 后 bpm 从 120 变为 110', () => {
      fmChangeBpm(-10);
      expect(mockState.free.bpm).toBe(110);
    });

    it('上限 240', () => {
      fmChangeBpm(200);
      expect(mockState.free.bpm).toBe(240);
    });

    it('下限 60', () => {
      fmChangeBpm(-200);
      expect(mockState.free.bpm).toBe(60);
    });

    it('transport 存在时调用 setBpm', () => {
      const setBpm = vi.fn();
      mockState.free.transport = { setBpm };
      fmChangeBpm(10);
      expect(setBpm).toHaveBeenCalledWith(130);
    });

    it('state.free 未初始化时不抛错', () => {
      for (const k of Object.keys(mockState)) delete mockState[k];
      expect(() => fmChangeBpm(10)).not.toThrow();
    });
  });

  // ------------------------------------------------------------
  // 事件注册
  // ------------------------------------------------------------
  describe('事件注册 (顶层 registerActions)', () => {
    it('模块加载时注册 fmToggleCell/fmInit/fmChangeBpm 到 window', () => {
      // vi.clearAllMocks() 会清除 registerActions 调用记录，
      // 但 window 上的全局暴露 (Object.assign) 仍然保留
      expect((window as any).fmToggleCell).toBeDefined();
      expect((window as any).fmInit).toBeDefined();
      expect((window as any).fmChangeBpm).toBeDefined();
      expect((window as any).fmReset).toBeDefined();
      expect((window as any).fmStop).toBeDefined();
      expect((window as any).fmTogglePlay).toBeDefined();
    });
  });
});
