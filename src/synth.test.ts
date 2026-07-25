import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * synth.ts 单元测试
 *
 * 通过 vi.mock 隔离 Store 与 audio 模块，使用 MockAudioContext
 * （参考 audio.test.ts 第 39-111 行）验证合成器函数对 Web Audio 节点的
 * 创建、连接与参数调度行为。
 *
 * 共享 mock 实例的访问方式：mock 工厂在 './audio' 被 import 时执行并创建
 * 单例实例；测试代码同样从 './audio' import getAudioCtx/getMasterBus/playTone
 * （得到 mock 版本），调用即可拿到同一实例。
 */

// vi.hoisted 在所有 import 之前执行，确保 mock 实例在 mock 工厂与测试代码间共享
const mocks = vi.hoisted(() => {
  const makeOsc = () => ({
    type: 'sine',
    frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  });
  const makeGain = () => ({
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  });
  const makeFilter = () => ({
    type: 'lowpass',
    frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    Q: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  });
  const makeBufferSource = () => ({
    buffer: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  });

  const mockCtx = {
    state: 'suspended',
    sampleRate: 44100,
    currentTime: 0,
    destination: { connect: vi.fn(), disconnect: vi.fn() },
    createOscillator: vi.fn(makeOsc),
    createGain: vi.fn(makeGain),
    createBiquadFilter: vi.fn(makeFilter),
    createBuffer: vi.fn((channels: number, length: number, sampleRate: number) => ({
      getChannelData: vi.fn(() => new Float32Array(length)),
      sampleRate,
      length,
      duration: length / sampleRate,
      numberOfChannels: channels,
    })),
    createBufferSource: vi.fn(makeBufferSource),
    createConvolver: vi.fn(() => ({
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createDelay: vi.fn(() => ({
      delayTime: { value: 0, setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    resume: vi.fn(() => Promise.resolve()),
    suspend: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
  };
  const mockBus = { connect: vi.fn(), disconnect: vi.fn() };
  const mockPlayTone = vi.fn();
  return { mockCtx, mockBus, mockPlayTone };
});

vi.mock('./store', () => ({
  Store: {
    state: { settings: { sfx: true } },
  },
}));

vi.mock('./audio', () => ({
  getAudioCtx: () => mocks.mockCtx,
  getMasterBus: () => mocks.mockBus,
  playTone: mocks.mockPlayTone,
}));

import { Store } from './store';
import {
  schedule808Kick,
  scheduleConga,
  scheduleClap,
  scheduleTom,
  scheduleRimshot,
  scheduleOpenHihat,
  scheduleCrash,
  playSubtractiveSynth,
  playPluck,
  playBell,
  playMarimba,
  playOrgan,
  playBass,
  playLead,
  playPad,
  createReverb,
  createDelay,
  createChorus,
  playCombo,
  playBossWarning,
  playCountdown,
  playPerfect,
  playFail,
  playMenuSwipe,
} from './synth';

// 从 hoisted 块取回共享 mock 实例
const mockCtx = mocks.mockCtx as unknown as {
  sampleRate: number;
  currentTime: number;
  createOscillator: ReturnType<typeof vi.fn>;
  createGain: ReturnType<typeof vi.fn>;
  createBiquadFilter: ReturnType<typeof vi.fn>;
  createBuffer: ReturnType<typeof vi.fn>;
  createBufferSource: ReturnType<typeof vi.fn>;
  createConvolver: ReturnType<typeof vi.fn>;
  createDelay: ReturnType<typeof vi.fn>;
};
const mockBus = mocks.mockBus as unknown as { connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> };
const mockPlayTone = mocks.mockPlayTone as unknown as ReturnType<typeof vi.fn>;

describe('synth', () => {
  beforeEach(() => {
    // 重置 sfx 开关
    Store.state.settings.sfx = true;
    // 清除所有 mock 调用记录
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /* ============================================================
     DRUM SYNTHESIS
     ============================================================ */
  describe('schedule808Kick', () => {
    it('默认参数下不抛错并创建 oscillator + gain，调用 start/stop', () => {
      expect(() => schedule808Kick(0)).not.toThrow();
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
      expect(mockCtx.createGain).toHaveBeenCalledTimes(1);
      const o = mockCtx.createOscillator.mock.results[0].value;
      const g = mockCtx.createGain.mock.results[0].value;
      expect(o.start).toHaveBeenCalledWith(0);
      expect(o.stop).toHaveBeenCalledWith(0 + 1.2);
      expect(o.connect).toHaveBeenCalledWith(g);
      expect(g.connect).toHaveBeenCalledWith(mockBus);
    });

    it('自定义 vol 正确传入 gain', () => {
      schedule808Kick(1, 0.9);
      const g = mockCtx.createGain.mock.results[0].value;
      expect(g.gain.setValueAtTime).toHaveBeenCalledWith(0.9, 1);
    });

    it('sfx=false 时立即返回，不创建任何节点', () => {
      Store.state.settings.sfx = false;
      schedule808Kick(0);
      expect(mockCtx.createOscillator).not.toHaveBeenCalled();
      expect(mockCtx.createGain).not.toHaveBeenCalled();
    });
  });

  describe('scheduleConga', () => {
    it('默认参数下不抛错并创建 oscillator + gain', () => {
      expect(() => scheduleConga(0)).not.toThrow();
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
      expect(mockCtx.createGain).toHaveBeenCalledTimes(1);
      const o = mockCtx.createOscillator.mock.results[0].value;
      expect(o.start).toHaveBeenCalledWith(0);
      expect(o.stop).toHaveBeenCalledWith(0 + 0.25);
    });

    it('自定义 vol 正确传入', () => {
      scheduleConga(0.5, 0.7);
      const g = mockCtx.createGain.mock.results[0].value;
      expect(g.gain.setValueAtTime).toHaveBeenCalledWith(0.7, 0.5);
    });

    it('sfx=false 时不创建节点', () => {
      Store.state.settings.sfx = false;
      scheduleConga(0);
      expect(mockCtx.createOscillator).not.toHaveBeenCalled();
    });
  });

  describe('scheduleClap', () => {
    it('默认参数下不抛错并创建 noise buffer + biquad filter', () => {
      expect(() => scheduleClap(0)).not.toThrow();
      // 主 burst + 2 个微 burst = 3 个 buffer / bufferSource / gain / filter
      expect(mockCtx.createBuffer).toHaveBeenCalledTimes(3);
      expect(mockCtx.createBufferSource).toHaveBeenCalledTimes(3);
      expect(mockCtx.createBiquadFilter).toHaveBeenCalledTimes(3);
      expect(mockCtx.createGain).toHaveBeenCalledTimes(3);
    });

    it('filter 类型为 bandpass', () => {
      scheduleClap(0);
      const f = mockCtx.createBiquadFilter.mock.results[0].value;
      expect(f.type).toBe('bandpass');
    });

    it('sfx=false 时不创建节点', () => {
      Store.state.settings.sfx = false;
      scheduleClap(0);
      expect(mockCtx.createBuffer).not.toHaveBeenCalled();
    });
  });

  describe('scheduleTom', () => {
    it('默认参数下不抛错并创建 oscillator + gain', () => {
      expect(() => scheduleTom(0)).not.toThrow();
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
      expect(mockCtx.createGain).toHaveBeenCalledTimes(1);
    });

    it('自定义 freq 正确设置到 oscillator', () => {
      scheduleTom(0, 0.4, 180);
      const o = mockCtx.createOscillator.mock.results[0].value;
      expect(o.frequency.setValueAtTime).toHaveBeenCalledWith(180, 0);
      expect(o.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(180 * 0.5, 0 + 0.3);
    });

    it('sfx=false 时不创建节点', () => {
      Store.state.settings.sfx = false;
      scheduleTom(0);
      expect(mockCtx.createOscillator).not.toHaveBeenCalled();
    });
  });

  describe('scheduleRimshot', () => {
    it('默认参数下不抛错并创建 noise buffer + biquad filter', () => {
      expect(() => scheduleRimshot(0)).not.toThrow();
      expect(mockCtx.createBuffer).toHaveBeenCalledTimes(1);
      expect(mockCtx.createBufferSource).toHaveBeenCalledTimes(1);
      expect(mockCtx.createBiquadFilter).toHaveBeenCalledTimes(1);
      const f = mockCtx.createBiquadFilter.mock.results[0].value;
      expect(f.type).toBe('highpass');
    });

    it('sfx=false 时不创建节点', () => {
      Store.state.settings.sfx = false;
      scheduleRimshot(0);
      expect(mockCtx.createBuffer).not.toHaveBeenCalled();
    });
  });

  describe('scheduleOpenHihat', () => {
    it('默认参数下不抛错并创建 noise buffer + biquad filter', () => {
      expect(() => scheduleOpenHihat(0)).not.toThrow();
      expect(mockCtx.createBuffer).toHaveBeenCalledTimes(1);
      expect(mockCtx.createBiquadFilter).toHaveBeenCalledTimes(1);
      const f = mockCtx.createBiquadFilter.mock.results[0].value;
      expect(f.type).toBe('highpass');
    });

    it('sfx=false 时不创建节点', () => {
      Store.state.settings.sfx = false;
      scheduleOpenHihat(0);
      expect(mockCtx.createBuffer).not.toHaveBeenCalled();
    });
  });

  describe('scheduleCrash', () => {
    it('默认参数下不抛错并创建 noise buffer + biquad filter', () => {
      expect(() => scheduleCrash(0)).not.toThrow();
      expect(mockCtx.createBuffer).toHaveBeenCalledTimes(1);
      expect(mockCtx.createBiquadFilter).toHaveBeenCalledTimes(1);
    });

    it('sfx=false 时不创建节点', () => {
      Store.state.settings.sfx = false;
      scheduleCrash(0);
      expect(mockCtx.createBuffer).not.toHaveBeenCalled();
    });
  });

  /* ============================================================
     MELODIC SYNTHESIS
     ============================================================ */
  describe('playSubtractiveSynth', () => {
    it('默认参数下不抛错并创建 oscillator + gain + filter', () => {
      expect(() => playSubtractiveSynth(440)).not.toThrow();
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
      expect(mockCtx.createGain).toHaveBeenCalledTimes(1);
      expect(mockCtx.createBiquadFilter).toHaveBeenCalledTimes(1);
    });

    it('自定义 type 与 freq 正确传入 oscillator', () => {
      playSubtractiveSynth(330, 0.5, 0.3, 'square', 1.0);
      const o = mockCtx.createOscillator.mock.results[0].value;
      expect(o.type).toBe('square');
      expect(o.frequency.value).toBe(330);
      const f = mockCtx.createBiquadFilter.mock.results[0].value;
      expect(f.type).toBe('lowpass');
      expect(f.frequency.setValueAtTime).toHaveBeenCalledWith(330 * 8, 1.0);
      const g = mockCtx.createGain.mock.results[0].value;
      expect(g.gain.setValueAtTime).toHaveBeenCalledWith(0.3, 1.0);
    });

    it('sfx=false 时不创建节点', () => {
      Store.state.settings.sfx = false;
      playSubtractiveSynth(440);
      expect(mockCtx.createOscillator).not.toHaveBeenCalled();
    });
  });

  describe('playPluck', () => {
    it('默认参数下不抛错并创建 buffer source + gain + filter', () => {
      expect(() => playPluck(440)).not.toThrow();
      expect(mockCtx.createBuffer).toHaveBeenCalledTimes(1);
      expect(mockCtx.createBufferSource).toHaveBeenCalledTimes(1);
      expect(mockCtx.createGain).toHaveBeenCalledTimes(1);
      expect(mockCtx.createBiquadFilter).toHaveBeenCalledTimes(1);
    });

    it('自定义 freq 与 dur 正确传入', () => {
      playPluck(220, 0.6, 0.3, 0.5);
      const f = mockCtx.createBiquadFilter.mock.results[0].value;
      expect(f.frequency.value).toBe(220 * 3);
      const g = mockCtx.createGain.mock.results[0].value;
      expect(g.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.001, 0.5 + 0.6);
    });

    it('sfx=false 时不创建节点', () => {
      Store.state.settings.sfx = false;
      playPluck(440);
      expect(mockCtx.createBuffer).not.toHaveBeenCalled();
    });
  });

  describe('playBell', () => {
    it('默认参数下不抛错并创建 carrier + modulator + modGain + outGain', () => {
      expect(() => playBell(440)).not.toThrow();
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);
      expect(mockCtx.createGain).toHaveBeenCalledTimes(2);
    });

    it('carrier freq = freq, modulator freq = freq*3.5', () => {
      playBell(440, 2.0, 0.25, 0.0);
      const car = mockCtx.createOscillator.mock.results[0].value;
      const mod = mockCtx.createOscillator.mock.results[1].value;
      expect(car.frequency.value).toBe(440);
      expect(mod.frequency.value).toBe(440 * 3.5);
      // modGain.gain.value = freq * 4
      const modGain = mockCtx.createGain.mock.results[0].value;
      expect(modGain.gain.value).toBe(440 * 4);
    });

    it('modGain 连接到 carrier.frequency', () => {
      playBell(440, 2.0, 0.25, 0.0);
      const modGain = mockCtx.createGain.mock.results[0].value;
      const car = mockCtx.createOscillator.mock.results[0].value;
      expect(modGain.connect).toHaveBeenCalledWith(car.frequency);
    });

    it('sfx=false 时不创建节点', () => {
      Store.state.settings.sfx = false;
      playBell(440);
      expect(mockCtx.createOscillator).not.toHaveBeenCalled();
    });
  });

  describe('playMarimba', () => {
    it('默认参数下不抛错并创建 2 个 oscillator (fundamental + 2nd harmonic)', () => {
      expect(() => playMarimba(440)).not.toThrow();
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);
      expect(mockCtx.createGain).toHaveBeenCalledTimes(2);
    });

    it('fundamental freq = freq, 2nd harmonic freq = freq*4', () => {
      playMarimba(440, 0.3, 0.3, 0.0);
      const o1 = mockCtx.createOscillator.mock.results[0].value;
      const o2 = mockCtx.createOscillator.mock.results[1].value;
      expect(o1.frequency.value).toBe(440);
      expect(o2.frequency.value).toBe(440 * 4);
    });

    it('sfx=false 时不创建节点', () => {
      Store.state.settings.sfx = false;
      playMarimba(440);
      expect(mockCtx.createOscillator).not.toHaveBeenCalled();
    });
  });

  describe('playOrgan', () => {
    it('默认参数下不抛错并创建 5 个 harmonics + 1 个 LFO', () => {
      expect(() => playOrgan(440)).not.toThrow();
      // 1 LFO + 5 harmonics = 6 oscillators
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(6);
      // 1 outGain + 1 lfoGain + 5 harmonic gains = 7 gains
      expect(mockCtx.createGain).toHaveBeenCalledTimes(7);
    });

    it('5 个 harmonics 频率为 freq*1..5', () => {
      playOrgan(220, 1.0, 0.2, 0.0);
      // LFO 是 results[0]，harmonics 是 results[1..5]
      const lfo = mockCtx.createOscillator.mock.results[0].value;
      expect(lfo.frequency.value).toBe(5);
      [1, 2, 3, 4, 5].forEach((h, i) => {
        const o = mockCtx.createOscillator.mock.results[i + 1].value;
        expect(o.type).toBe('square');
        expect(o.frequency.value).toBe(220 * h);
      });
    });

    it('LFO 连接到 lfoGain，lfoGain 连接到 outGain.gain', () => {
      playOrgan(440, 1.0, 0.2, 0.0);
      const lfo = mockCtx.createOscillator.mock.results[0].value;
      // synth.ts 中 createGain 顺序：outGain(0) → lfoGain(1) → 5 个 harmonic gains(2..6)
      const outGain = mockCtx.createGain.mock.results[0].value;
      const lfoGain = mockCtx.createGain.mock.results[1].value;
      expect(lfo.connect).toHaveBeenCalledWith(lfoGain);
      expect(lfoGain.connect).toHaveBeenCalledWith(outGain.gain);
    });

    it('sfx=false 时不创建节点', () => {
      Store.state.settings.sfx = false;
      playOrgan(440);
      expect(mockCtx.createOscillator).not.toHaveBeenCalled();
    });
  });

  describe('playBass', () => {
    it('默认参数下不抛错并创建 oscillator + gain + filter', () => {
      expect(() => playBass(110)).not.toThrow();
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
      expect(mockCtx.createGain).toHaveBeenCalledTimes(1);
      expect(mockCtx.createBiquadFilter).toHaveBeenCalledTimes(1);
      const o = mockCtx.createOscillator.mock.results[0].value;
      expect(o.type).toBe('sawtooth');
    });

    it('自定义参数正确传入', () => {
      playBass(110, 0.4, 0.35, 1.0);
      const o = mockCtx.createOscillator.mock.results[0].value;
      expect(o.frequency.value).toBe(110);
      const f = mockCtx.createBiquadFilter.mock.results[0].value;
      expect(f.frequency.setValueAtTime).toHaveBeenCalledWith(110 * 10, 1.0);
    });

    it('sfx=false 时不创建节点', () => {
      Store.state.settings.sfx = false;
      playBass(110);
      expect(mockCtx.createOscillator).not.toHaveBeenCalled();
    });
  });

  describe('playLead', () => {
    it('默认参数下不抛错并创建 oscillator + gain + filter', () => {
      expect(() => playLead(440)).not.toThrow();
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
      expect(mockCtx.createGain).toHaveBeenCalledTimes(1);
      expect(mockCtx.createBiquadFilter).toHaveBeenCalledTimes(1);
    });

    it('glide=0 时不调用 exponentialRampToValueAtTime on frequency', () => {
      playLead(440, 0.3, 0.25, 0.0, 0);
      const o = mockCtx.createOscillator.mock.results[0].value;
      expect(o.frequency.setValueAtTime).toHaveBeenCalledTimes(1);
      expect(o.frequency.setValueAtTime).toHaveBeenCalledWith(440, 0);
      expect(o.frequency.exponentialRampToValueAtTime).not.toHaveBeenCalled();
    });

    it('glide>0 时调用 setValueAtTime 与 exponentialRampToValueAtTime 进行频率斜坡', () => {
      playLead(440, 0.3, 0.25, 1.0, 0.15);
      const o = mockCtx.createOscillator.mock.results[0].value;
      // 先 setValueAtTime(freq, time)
      expect(o.frequency.setValueAtTime).toHaveBeenCalledWith(440, 1.0);
      // 再 setValueAtTime(freq*0.5, time) 起点
      expect(o.frequency.setValueAtTime).toHaveBeenCalledWith(440 * 0.5, 1.0);
      // exponentialRampToValueAtTime(freq, time+glide)
      expect(o.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(440, 1.0 + 0.15);
    });

    it('sfx=false 时不创建节点', () => {
      Store.state.settings.sfx = false;
      playLead(440, 0.3, 0.25, 0, 0.1);
      expect(mockCtx.createOscillator).not.toHaveBeenCalled();
    });
  });

  describe('playPad', () => {
    it('默认参数下不抛错并为每个 freq 创建 oscillator + LFO', () => {
      expect(() => playPad([220, 330, 440])).not.toThrow();
      // 3 个 freq 各 1 个 oscillator + 1 个 LFO = 4
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(4);
      // 1 个 outGain + 3 个 per-freq gain + 1 个 lfoGain = 5
      expect(mockCtx.createGain).toHaveBeenCalledTimes(5);
      // 每个 freq 1 个 filter
      expect(mockCtx.createBiquadFilter).toHaveBeenCalledTimes(3);
    });

    it('每个 freq 的 oscillator 频率正确', () => {
      playPad([220, 330, 440], 2.0, 0.15, 0.0);
      const o0 = mockCtx.createOscillator.mock.results[0].value;
      const o1 = mockCtx.createOscillator.mock.results[1].value;
      const o2 = mockCtx.createOscillator.mock.results[2].value;
      expect(o0.frequency.value).toBe(220);
      expect(o1.frequency.value).toBe(330);
      expect(o2.frequency.value).toBe(440);
    });

    it('sfx=false 时不创建节点', () => {
      Store.state.settings.sfx = false;
      playPad([220, 330]);
      expect(mockCtx.createOscillator).not.toHaveBeenCalled();
    });
  });

  /* ============================================================
     EFFECTS
     ============================================================ */
  describe('createReverb', () => {
    it('返回 ConvolverNode，buffer 为双通道', () => {
      const convolver = createReverb(mockCtx as unknown as AudioContext, 0.1, 0.5);
      expect(mockCtx.createConvolver).toHaveBeenCalledTimes(1);
      expect(mockCtx.createBuffer).toHaveBeenCalledWith(2, expect.any(Number), 44100);
      expect(convolver).toBeDefined();
      expect(convolver.buffer).not.toBeNull();
    });

    it('默认参数不抛错', () => {
      expect(() => createReverb(mockCtx as unknown as AudioContext)).not.toThrow();
    });
  });

  describe('createDelay', () => {
    it('返回 {input, output} 对象', () => {
      const result = createDelay(mockCtx as unknown as AudioContext, 0.3, 0.35);
      expect(result).toHaveProperty('input');
      expect(result).toHaveProperty('output');
      expect(result.input).toBeDefined();
      expect(result.output).toBeDefined();
      expect(mockCtx.createDelay).toHaveBeenCalledTimes(1);
    });

    it('默认参数不抛错', () => {
      expect(() => createDelay(mockCtx as unknown as AudioContext)).not.toThrow();
    });
  });

  describe('createChorus', () => {
    it('返回 {input, output} 对象', () => {
      const result = createChorus(mockCtx as unknown as AudioContext, 2.0, 0.015);
      expect(result).toHaveProperty('input');
      expect(result).toHaveProperty('output');
      expect(mockCtx.createDelay).toHaveBeenCalledTimes(1);
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
    });

    it('默认参数不抛错', () => {
      expect(() => createChorus(mockCtx as unknown as AudioContext)).not.toThrow();
    });
  });

  /* ============================================================
     GAME SFX
     ============================================================ */
  describe('playCombo', () => {
    it('根据 count 调用 playMarimba 多次（count+2 次，上限 8）', () => {
      playCombo(3);
      // min(3+2, 8) = 5 次 playMarimba，每次 2 个 oscillator = 10
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(5 * 2);
    });

    it('count 较大时上限为 8 次', () => {
      playCombo(20);
      // min(20+2, 8) = 8 次 playMarimba = 16 oscillators
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(8 * 2);
    });

    it('sfx=false 时不创建节点', () => {
      Store.state.settings.sfx = false;
      playCombo(3);
      expect(mockCtx.createOscillator).not.toHaveBeenCalled();
    });
  });

  describe('playBossWarning', () => {
    it('调用 playOrgan 多次（2 和弦 × 3 音 = 6 次）', () => {
      playBossWarning();
      // 6 次 playOrgan，每次 6 个 oscillator (1 LFO + 5 harmonics) = 36
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(6 * 6);
    });

    it('sfx=false 时不创建节点', () => {
      Store.state.settings.sfx = false;
      playBossWarning();
      expect(mockCtx.createOscillator).not.toHaveBeenCalled();
    });
  });

  describe('playCountdown', () => {
    it('调用 playMarimba（创建 2 个 oscillator）', () => {
      playCountdown();
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);
    });

    it('sfx=false 时不创建节点', () => {
      Store.state.settings.sfx = false;
      playCountdown();
      expect(mockCtx.createOscillator).not.toHaveBeenCalled();
    });
  });

  describe('playPerfect', () => {
    it('调用 playBell 多次（5 次）+ playPad（3 freq）', () => {
      playPerfect();
      // 5 次 playBell × 2 oscillator = 10
      // 1 次 playPad([3 freqs]) → 3 + 1 LFO = 4
      // 合计 14 oscillators
      expect(mockCtx.createOscillator).toHaveBeenCalledTimes(5 * 2 + 4);
    });

    it('sfx=false 时不创建节点', () => {
      Store.state.settings.sfx = false;
      playPerfect();
      expect(mockCtx.createOscillator).not.toHaveBeenCalled();
    });
  });

  describe('playFail', () => {
    it('调用 playTone 三次', () => {
      playFail();
      expect(mockPlayTone).toHaveBeenCalledTimes(3);
      // 验证三次的频率序列
      expect(mockPlayTone).toHaveBeenNthCalledWith(1, 200, 0.3, 'square', 0.25, expect.any(Number));
      expect(mockPlayTone).toHaveBeenNthCalledWith(2, 150, 0.4, 'square', 0.2, expect.any(Number));
      expect(mockPlayTone).toHaveBeenNthCalledWith(3, 100, 0.5, 'sawtooth', 0.15, expect.any(Number));
    });

    it('sfx=false 时不调用 playTone', () => {
      Store.state.settings.sfx = false;
      playFail();
      expect(mockPlayTone).not.toHaveBeenCalled();
    });
  });

  describe('playMenuSwipe', () => {
    it('创建 noise buffer 并应用 bandpass filter', () => {
      playMenuSwipe();
      expect(mockCtx.createBuffer).toHaveBeenCalledTimes(1);
      expect(mockCtx.createBufferSource).toHaveBeenCalledTimes(1);
      expect(mockCtx.createBiquadFilter).toHaveBeenCalledTimes(1);
      const f = mockCtx.createBiquadFilter.mock.results[0].value;
      expect(f.type).toBe('bandpass');
    });

    it('sfx=false 时不创建节点', () => {
      Store.state.settings.sfx = false;
      playMenuSwipe();
      expect(mockCtx.createBuffer).not.toHaveBeenCalled();
    });
  });
});
