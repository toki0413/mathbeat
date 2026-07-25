import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================
// 使用 vi.hoisted 把 mock 共享对象提升到 vi.mock 之前可见
// ============================================================
const { storeState, capturedActions, capturedInputs } = vi.hoisted(() => ({
  storeState: { waveLabChallengesDone: 0, achievements: [] as string[] },
  capturedActions: {} as Record<string, (e?: Event, ...args: unknown[]) => void>,
  capturedInputs: {} as Record<string, (e: Event) => void>,
}));

// ============================================================
// Mock 外部依赖
// ============================================================
vi.mock('./audio', () => ({
  getAudioCtx: vi.fn(() => ({
    currentTime: 0,
    destination: {},
    createGain: vi.fn(() => ({
      gain: {
        value: 0,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        cancelScheduledValues: vi.fn(),
        setTargetAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createOscillator: vi.fn(() => ({
      type: 'sine',
      frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    })),
  })),
  getMasterBus: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
}));

vi.mock('./game-engine', () => ({
  stopAllPlayback: vi.fn(),
}));

vi.mock('./events', () => ({
  registerActions: vi.fn((actions: Record<string, (e?: Event, ...args: unknown[]) => void>) => {
    Object.assign(capturedActions, actions);
  }),
  registerInputs: vi.fn((inputs: Record<string, (e: Event) => void>) => {
    Object.assign(capturedInputs, inputs);
  }),
}));

vi.mock('./store', () => ({
  Store: {
    state: storeState,
    save: vi.fn(),
  },
}));

vi.mock('./fx/particles', () => ({
  spawnConfetti: vi.fn(),
  showSuccessToast: vi.fn(),
}));

// 使用真实的 utils 实现 (纯数学函数)
vi.mock('./utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils')>();
  return { ...actual };
});

import { openWaveLab, closeWaveLab, initWaveLabEvents } from './wave-lab';
import { getAudioCtx } from './audio';
import { stopAllPlayback } from './game-engine';
import { registerActions, registerInputs } from './events';
import { spawnConfetti, showSuccessToast } from './fx/particles';
import { harmonicAmplitudes } from './utils';

// 为 happy-dom 提供 canvas 2D 上下文 mock
function installCanvasMock() {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: () => CanvasRenderingContext2D | null };
  proto.getContext = vi.fn(() => ({
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    setLineDash: vi.fn(),
    fillText: vi.fn(),
  })) as any;
}

describe('wave-lab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installCanvasMock();
    // 清空 captured handlers
    for (const k of Object.keys(capturedActions)) delete capturedActions[k];
    for (const k of Object.keys(capturedInputs)) delete capturedInputs[k];
    // 重置 store
    storeState.waveLabChallengesDone = 0;
    storeState.achievements = [];
    // 构建基础 DOM（openWaveLab 会填充 #waveLabPanel）
    document.body.innerHTML = `
      <div id="waveLabScreen"></div>
      <div id="waveLabPanel"></div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // ------------------------------------------------------------
  // 渲染入口
  // ------------------------------------------------------------
  describe('openWaveLab / closeWaveLab', () => {
    it('openWaveLab 添加 active 类并构建面板', () => {
      openWaveLab();
      const screen = document.getElementById('waveLabScreen')!;
      expect(screen.classList.contains('active')).toBe(true);
      const panel = document.getElementById('waveLabPanel')!;
      expect(panel.innerHTML).toContain('waveLabCanvas');
      expect(panel.innerHTML).toContain('wavelab-presets');
      expect(panel.innerHTML).toContain('wavelab-harmonics');
      expect(panel.innerHTML).toContain('waveLabPlayBtn');
      expect(panel.innerHTML).toContain('waveLabChallenge');
      expect(panel.innerHTML).toContain('waveLabStats');
      expect(panel.innerHTML).toContain('waveLabInfo');
    });

    it('openWaveLab 构建面板包含 8 个谐波滑块', () => {
      openWaveLab();
      const sliders = document.querySelectorAll('.wavelab-slider');
      expect(sliders.length).toBe(8);
      for (let k = 0; k < 8; k++) {
        expect(document.getElementById('wlSlider' + k)).not.toBeNull();
        expect(document.getElementById('wlVal' + k)).not.toBeNull();
      }
    });

    it('openWaveLab 调用 stopAllPlayback', () => {
      openWaveLab();
      expect(stopAllPlayback).toHaveBeenCalled();
    });

    it('openWaveLab 写入 stats 与 info', () => {
      openWaveLab();
      const stats = document.getElementById('waveLabStats')!;
      expect(stats.innerHTML).toContain('wavelab-stat');
      const info = document.getElementById('waveLabInfo')!;
      expect(info.innerHTML).toContain('wavelab-formula');
    });

    it('openWaveLab 缺少 #waveLabScreen 直接返回不抛错', () => {
      document.body.innerHTML = '';
      expect(() => openWaveLab()).not.toThrow();
    });

    it('openWaveLab 缺少 #waveLabPanel 不抛错', () => {
      document.body.innerHTML = '<div id="waveLabScreen"></div>';
      expect(() => openWaveLab()).not.toThrow();
    });

    it('closeWaveLab 移除 active 类', () => {
      openWaveLab();
      closeWaveLab();
      const screen = document.getElementById('waveLabScreen')!;
      expect(screen.classList.contains('active')).toBe(false);
    });

    it('closeWaveLab 不抛错 (即使没有先 open)', () => {
      expect(() => closeWaveLab()).not.toThrow();
    });
  });

  // ------------------------------------------------------------
  // 事件注册
  // ------------------------------------------------------------
  describe('initWaveLabEvents', () => {
    it('注册 actions 与 inputs', () => {
      initWaveLabEvents();
      expect(registerActions).toHaveBeenCalled();
      expect(registerInputs).toHaveBeenCalled();
      expect(capturedActions.openWaveLab).toBeDefined();
      expect(capturedActions.closeWaveLab).toBeDefined();
      expect(capturedActions.wlTogglePlay).toBeDefined();
      expect(capturedActions.wlPreset).toBeDefined();
      expect(capturedActions.wlChallenge).toBeDefined();
      expect(capturedActions.wlVerifyChallenge).toBeDefined();
      expect(capturedInputs.wlSliderChange).toBeDefined();
    });

    it('注册的 openWaveLab handler 添加 active 类', () => {
      initWaveLabEvents();
      capturedActions.openWaveLab();
      const screen = document.getElementById('waveLabScreen')!;
      expect(screen.classList.contains('active')).toBe(true);
    });

    it('注册的 closeWaveLab handler 移除 active 类', () => {
      initWaveLabEvents();
      capturedActions.openWaveLab();
      capturedActions.closeWaveLab();
      const screen = document.getElementById('waveLabScreen')!;
      expect(screen.classList.contains('active')).toBe(false);
    });
  });

  // ------------------------------------------------------------
  // 用户操作 handler 调用路径
  // ------------------------------------------------------------
  describe('handler 调用路径', () => {
    beforeEach(() => {
      initWaveLabEvents();
      openWaveLab();
    });

    it('wlTogglePlay 切换播放状态并更新按钮文本', () => {
      const btn = document.getElementById('waveLabPlayBtn')!;
      expect(btn.textContent).toContain('播放');
      capturedActions.wlTogglePlay();
      expect(btn.textContent).toContain('停止');
      expect(getAudioCtx).toHaveBeenCalled();
      capturedActions.wlTogglePlay();
      expect(btn.textContent).toContain('播放');
    });

    it('wlPreset(square) 应用方波预设并更新滑块', () => {
      // 先把第一个滑块设为非方波值
      const slider0 = document.getElementById('wlSlider0') as HTMLInputElement;
      slider0.value = '0.5';
      capturedActions.wlPreset(new Event('click'), 'square');
      // 方波归一化后第一个滑块应为 1
      expect(parseFloat(slider0.value)).toBeCloseTo(1, 5);
    });

    it('wlPreset(sine) 仅含基波', () => {
      capturedActions.wlPreset(new Event('click'), 'sine');
      const slider0 = document.getElementById('wlSlider0') as HTMLInputElement;
      const slider1 = document.getElementById('wlSlider1') as HTMLInputElement;
      expect(parseFloat(slider0.value)).toBeCloseTo(1, 5);
      expect(parseFloat(slider1.value)).toBeCloseTo(0, 5);
    });

    it('wlPreset(sawtooth) 全谐波', () => {
      capturedActions.wlPreset(new Event('click'), 'sawtooth');
      const slider0 = document.getElementById('wlSlider0') as HTMLInputElement;
      const slider1 = document.getElementById('wlSlider1') as HTMLInputElement;
      expect(parseFloat(slider0.value)).toBeCloseTo(1, 5);
      expect(parseFloat(slider1.value)).toBeGreaterThan(0);
    });

    it('wlPreset(triangle) 仅奇次谐波', () => {
      capturedActions.wlPreset(new Event('click'), 'triangle');
      const slider0 = document.getElementById('wlSlider0') as HTMLInputElement;
      const slider1 = document.getElementById('wlSlider1') as HTMLInputElement;
      // 三角波仅奇次谐波，第 2 个滑块 (k=2) 应为 0
      expect(parseFloat(slider0.value)).toBeCloseTo(1, 5);
      expect(parseFloat(slider1.value)).toBeCloseTo(0, 5);
    });

    it('wlChallenge 启动挑战并写入 #waveLabChallenge', () => {
      capturedActions.wlChallenge();
      const el = document.getElementById('waveLabChallenge')!;
      expect(el.innerHTML).toContain('wavelab-challenge-box');
      expect(el.innerHTML).toContain('目标波形');
    });

    it('wlVerifyChallenge 在没有挑战目标时不抛错', () => {
      expect(() => capturedActions.wlVerifyChallenge()).not.toThrow();
    });

    it('wlSliderChange 更新对应谐波值与显示', () => {
      const slider = document.getElementById('wlSlider2') as HTMLInputElement;
      slider.value = '0.42';
      // 通过 defineProperty 设置 dataset，避免 happy-dom dataset 只读问题
      Object.defineProperty(slider, 'dataset', { value: { args: '["2"]' }, configurable: true });
      const valEl = document.getElementById('wlVal2')!;
      const fakeEvent = { target: slider } as unknown as Event;
      capturedInputs.wlSliderChange(fakeEvent);
      expect(valEl.textContent).toBe('0.42');
    });
  });

  // ------------------------------------------------------------
  // 挑战模式 — 通关路径
  // ------------------------------------------------------------
  describe('挑战模式通关路径', () => {
    let randomSpy: ReturnType<typeof vi.spyOn> | null = null;

    beforeEach(() => {
      initWaveLabEvents();
      openWaveLab();
    });

    afterEach(() => {
      if (randomSpy) { randomSpy.mockRestore(); randomSpy = null; }
    });

    // 辅助：startChallenge 使用 Math.floor(Math.random() * 3) 从
    // ['square', 'sawtooth', 'triangle'] 中选取目标
    // index 0 -> square, 1 -> sawtooth, 2 -> triangle
    function mockChallengeTarget(index: number) {
      randomSpy = vi.spyOn(Math, 'random').mockReturnValue(index / 3);
    }

    it('挑战目标为 square 且玩家精确匹配时通关', () => {
      mockChallengeTarget(0); // 目标 = square
      capturedActions.wlChallenge();
      // 直接套用 square 预设保证 100% 相似度
      capturedActions.wlPreset(new Event('click'), 'square');
      vi.mocked(showSuccessToast).mockClear();
      vi.mocked(spawnConfetti).mockClear();
      capturedActions.wlVerifyChallenge();
      const el = document.getElementById('waveLabChallenge')!;
      expect(el.innerHTML).toContain('wavelab-success');
      expect(showSuccessToast).toHaveBeenCalled();
      expect(spawnConfetti).toHaveBeenCalled();
    });

    it('通关后增加 waveLabChallengesDone 计数', () => {
      mockChallengeTarget(0); // 目标 = square
      const before = storeState.waveLabChallengesDone || 0;
      capturedActions.wlChallenge();
      capturedActions.wlPreset(new Event('click'), 'square');
      capturedActions.wlVerifyChallenge();
      expect(storeState.waveLabChallengesDone).toBe(before + 1);
    });

    it('挑战目标为 triangle 且玩家精确匹配时通关', () => {
      mockChallengeTarget(2); // 目标 = triangle
      capturedActions.wlChallenge();
      capturedActions.wlPreset(new Event('click'), 'triangle');
      capturedActions.wlVerifyChallenge();
      const el = document.getElementById('waveLabChallenge')!;
      expect(el.innerHTML).toContain('wavelab-success');
    });

    it('玩家未匹配目标时显示失败提示', () => {
      mockChallengeTarget(1); // 目标 = sawtooth
      capturedActions.wlChallenge();
      // sine 与 sawtooth 的余弦相似度 ≈ 0.82 < 0.92，必然失败
      capturedActions.wlPreset(new Event('click'), 'sine');
      capturedActions.wlVerifyChallenge();
      const el = document.getElementById('waveLabChallenge')!;
      expect(el.innerHTML).toContain('wavelab-fail');
    });

    it('挑战失败时不增加计数', () => {
      mockChallengeTarget(1); // 目标 = sawtooth
      const before = storeState.waveLabChallengesDone || 0;
      capturedActions.wlChallenge();
      capturedActions.wlPreset(new Event('click'), 'sine');
      capturedActions.wlVerifyChallenge();
      expect(storeState.waveLabChallengesDone).toBe(before);
    });
  });

  // ------------------------------------------------------------
  // 纯函数 (来自 utils，wave-lab 间接使用)
  // ------------------------------------------------------------
  describe('依赖的纯函数 (来自 utils)', () => {
    it('harmonicAmplitudes(sine, 8) 仅含基波', () => {
      const amps = harmonicAmplitudes('sine', 8);
      expect(amps[0]).toBe(1);
      for (let k = 1; k < 8; k++) expect(amps[k]).toBe(0);
    });

    it('harmonicAmplitudes(square, 8) 仅含奇次且按 1/k 衰减', () => {
      const amps = harmonicAmplitudes('square', 8);
      expect(amps[0]).toBe(1);
      expect(amps[1]).toBe(0);
      expect(amps[2]).toBeCloseTo(1 / 3, 5);
      expect(amps[3]).toBe(0);
      expect(amps[4]).toBeCloseTo(1 / 5, 5);
    });
  });
});
