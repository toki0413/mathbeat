import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Transport 单元测试
 *
 * Transport 基于 Web Audio `currentTime` 与 setTimeout 轮询驱动节拍调度。
 * 测试使用 vi.useFakeTimers() 控制 setTimeout，并通过 MockAudioContext
 * 控制 currentTime 来验证调度行为。
 */

class MockAudioContext {
  state = 'suspended';
  sampleRate = 44100;
  currentTime = 0;
  destination = { connect: vi.fn(), disconnect: vi.fn() };

  createOscillator = vi.fn(() => ({
    type: 'sine',
    frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }));

  createGain = vi.fn(() => ({
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));

  resume = vi.fn(() => Promise.resolve());
  suspend = vi.fn(() => Promise.resolve());
  close = vi.fn(() => Promise.resolve());
}

import { Transport, createTransport, stopAllTransports, stopOtherTransports } from './transport';

describe('Transport', () => {
  let ctx: MockAudioContext;

  beforeEach(() => {
    vi.useFakeTimers();
    ctx = new MockAudioContext();
  });

  afterEach(() => {
    // 清理活跃 Transport，避免跨用例污染 activeTransports 列表
    stopAllTransports();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /* ============================================================
     构造与基础配置
     ============================================================ */
  describe('构造与配置', () => {
    it('默认 bpm=120, stepsPerBeat=4, stepDuration = 60/120/4 = 0.125', () => {
      const t = new Transport(ctx as unknown as AudioContext);
      const events: { step: number; time: number }[] = [];
      t.subscribe((e) => events.push(e));
      t.start();
      // start 时 nextStepTime = currentTime(0) + 0.05 = 0.05
      expect(events).toHaveLength(1);
      expect(events[0].step).toBe(0);
      expect(events[0].time).toBeCloseTo(0.05, 5);
      // 推进 currentTime 让下一拍可调度
      ctx.currentTime = 0.2;
      vi.advanceTimersByTime(25);
      // 至少调度了第二拍
      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(events[1].step).toBe(1);
      expect(events[1].time).toBeCloseTo(0.175, 5);
      // stepDuration = 0.175 - 0.05 = 0.125
      expect(events[1].time - events[0].time).toBeCloseTo(0.125, 5);
    });

    it('自定义 bpm 与 stepsPerBeat 影响 stepDuration', () => {
      // bpm=60, stepsPerBeat=4 → stepDuration = 60/60/4 = 0.25
      const t = new Transport(ctx as unknown as AudioContext, 60, 4);
      const events: { step: number; time: number }[] = [];
      t.subscribe((e) => events.push(e));
      t.start();
      expect(events[0].time).toBeCloseTo(0.05, 5);
      ctx.currentTime = 0.4;
      vi.advanceTimersByTime(25);
      expect(events[1].time - events[0].time).toBeCloseTo(0.25, 5);
    });
  });

  /* ============================================================
     setBpm / getBpm
     ============================================================ */
  describe('setBpm / getBpm', () => {
    it('getBpm 返回当前 bpm', () => {
      const t = new Transport(ctx as unknown as AudioContext, 120);
      expect(t.getBpm()).toBe(120);
    });

    it('setBpm 设置新 bpm', () => {
      const t = new Transport(ctx as unknown as AudioContext, 120);
      t.setBpm(140);
      expect(t.getBpm()).toBe(140);
    });

    it('setBpm 上限 300：超出被 clamp', () => {
      const t = new Transport(ctx as unknown as AudioContext, 120);
      t.setBpm(500);
      expect(t.getBpm()).toBe(300);
    });

    it('setBpm 下限 30：低于被 clamp', () => {
      const t = new Transport(ctx as unknown as AudioContext, 120);
      t.setBpm(10);
      expect(t.getBpm()).toBe(30);
    });

    it('setBpm 在 30..300 范围内不被 clamp', () => {
      const t = new Transport(ctx as unknown as AudioContext, 120);
      t.setBpm(30);
      expect(t.getBpm()).toBe(30);
      t.setBpm(300);
      expect(t.getBpm()).toBe(300);
      t.setBpm(150);
      expect(t.getBpm()).toBe(150);
    });
  });

  /* ============================================================
     setStepsPerBeat
     ============================================================ */
  describe('setStepsPerBeat', () => {
    it('设置有效值', () => {
      const t = new Transport(ctx as unknown as AudioContext, 120, 4);
      // 通过行为验证：stepsPerBeat=2 → stepDuration = 60/120/2 = 0.25
      t.setStepsPerBeat(2);
      const events: { step: number; time: number }[] = [];
      t.subscribe((e) => events.push(e));
      t.start();
      ctx.currentTime = 0.4;
      vi.advanceTimersByTime(25);
      expect(events[1].time - events[0].time).toBeCloseTo(0.25, 5);
    });

    it('小于 1 被 clamp 到 1', () => {
      const t = new Transport(ctx as unknown as AudioContext, 120, 4);
      t.setStepsPerBeat(0);
      // stepsPerBeat=1 → stepDuration = 60/120/1 = 0.5
      const events: { step: number; time: number }[] = [];
      t.subscribe((e) => events.push(e));
      t.start();
      ctx.currentTime = 0.7;
      vi.advanceTimersByTime(25);
      expect(events[1].time - events[0].time).toBeCloseTo(0.5, 5);
    });

    it('负数也被 clamp 到 1', () => {
      const t = new Transport(ctx as unknown as AudioContext, 120, 4);
      t.setStepsPerBeat(-5);
      const events: { step: number; time: number }[] = [];
      t.subscribe((e) => events.push(e));
      t.start();
      ctx.currentTime = 0.7;
      vi.advanceTimersByTime(25);
      expect(events[1].time - events[0].time).toBeCloseTo(0.5, 5);
    });
  });

  /* ============================================================
     setLoop
     ============================================================ */
  describe('setLoop', () => {
    it('setLoop 不抛错（保留接口）', () => {
      const t = new Transport(ctx as unknown as AudioContext);
      expect(() => t.setLoop(16)).not.toThrow();
      expect(() => t.setLoop(0)).not.toThrow();
    });
  });

  /* ============================================================
     subscribe
     ============================================================ */
  describe('subscribe', () => {
    it('注册回调并在 start 后收到事件', () => {
      const t = new Transport(ctx as unknown as AudioContext);
      const cb = vi.fn();
      t.subscribe(cb);
      t.start();
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith({ step: 0, time: expect.any(Number) });
    });

    it('返回 unsubscribe 函数', () => {
      const t = new Transport(ctx as unknown as AudioContext);
      const cb = vi.fn();
      const unsub = t.subscribe(cb);
      expect(typeof unsub).toBe('function');
    });

    it('调用 unsubscribe 后回调不再被触发', () => {
      const t = new Transport(ctx as unknown as AudioContext);
      const cb = vi.fn();
      const unsub = t.subscribe(cb);
      t.start();
      expect(cb).toHaveBeenCalledTimes(1);
      unsub();
      cb.mockClear();
      // 推进时间并触发更多事件
      ctx.currentTime = 1.0;
      vi.advanceTimersByTime(25);
      expect(cb).not.toHaveBeenCalled();
    });
  });

  /* ============================================================
     start / stop / isPlaying
     ============================================================ */
  describe('start', () => {
    it('start 后 playing=true', () => {
      const t = new Transport(ctx as unknown as AudioContext);
      t.start();
      expect(t.isPlaying()).toBe(true);
    });

    it('start 后 subscribe 注册的回调收到事件', () => {
      const t = new Transport(ctx as unknown as AudioContext);
      const cb = vi.fn();
      t.subscribe(cb);
      t.start();
      expect(cb).toHaveBeenCalled();
      expect(cb.mock.calls[0][0]).toMatchObject({ step: 0 });
    });

    it('重复调用幂等（已 playing 时直接返回）', () => {
      const t = new Transport(ctx as unknown as AudioContext);
      const cb = vi.fn();
      t.subscribe(cb);
      t.start();
      t.start();
      // 只调度一次（step 0），不会重复触发
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop', () => {
    it('stop 后 playing=false', () => {
      const t = new Transport(ctx as unknown as AudioContext);
      t.start();
      t.stop();
      expect(t.isPlaying()).toBe(false);
    });

    it('stop 后 clearTimeout 被调用', () => {
      const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
      const t = new Transport(ctx as unknown as AudioContext);
      t.start();
      clearSpy.mockClear();
      t.stop();
      expect(clearSpy).toHaveBeenCalled();
    });

    it('stop 后回调不再被触发', () => {
      const t = new Transport(ctx as unknown as AudioContext);
      const cb = vi.fn();
      t.subscribe(cb);
      t.start();
      cb.mockClear();
      t.stop();
      ctx.currentTime = 1.0;
      vi.advanceTimersByTime(100);
      expect(cb).not.toHaveBeenCalled();
    });

    it('未 start 时调用 stop 不抛错', () => {
      const t = new Transport(ctx as unknown as AudioContext);
      expect(() => t.stop()).not.toThrow();
    });
  });

  describe('isPlaying', () => {
    it('初始状态返回 false', () => {
      const t = new Transport(ctx as unknown as AudioContext);
      expect(t.isPlaying()).toBe(false);
    });

    it('start 后返回 true', () => {
      const t = new Transport(ctx as unknown as AudioContext);
      t.start();
      expect(t.isPlaying()).toBe(true);
    });

    it('stop 后返回 false', () => {
      const t = new Transport(ctx as unknown as AudioContext);
      t.start();
      t.stop();
      expect(t.isPlaying()).toBe(false);
    });
  });

  /* ============================================================
     reset / restart
     ============================================================ */
  describe('reset', () => {
    it('reset 等同于 stop() + currentStep=0', () => {
      const t = new Transport(ctx as unknown as AudioContext);
      const cb = vi.fn();
      t.subscribe(cb);
      t.start();
      // 推进到更高 step
      ctx.currentTime = 1.0;
      vi.advanceTimersByTime(25);
      expect(t.isPlaying()).toBe(true);
      cb.mockClear();
      t.reset();
      // 停止
      expect(t.isPlaying()).toBe(false);
      // 推进时间，无新事件
      vi.advanceTimersByTime(100);
      expect(cb).not.toHaveBeenCalled();
      // 重新 start 后 step 从 0 开始
      t.start();
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb.mock.calls[0][0].step).toBe(0);
    });
  });

  describe('restart', () => {
    it('restart 等同于 reset() + start()', () => {
      const t = new Transport(ctx as unknown as AudioContext);
      const cb = vi.fn();
      t.subscribe(cb);
      t.start();
      ctx.currentTime = 1.0;
      vi.advanceTimersByTime(25);
      cb.mockClear();
      t.restart();
      // playing 且 step 从 0 开始
      expect(t.isPlaying()).toBe(true);
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb.mock.calls[0][0].step).toBe(0);
    });
  });

  /* ============================================================
     订阅者错误隔离
     ============================================================ */
  describe('订阅者错误隔离', () => {
    it('订阅回调中抛错不会中断其他订阅者（被 try/catch）', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const t = new Transport(ctx as unknown as AudioContext);
      const cb1 = vi.fn(() => {
        throw new Error('subscriber error');
      });
      const cb2 = vi.fn();
      t.subscribe(cb1);
      t.subscribe(cb2);
      t.start();
      // 两个订阅者都被调用，cb1 的错误未中断 cb2
      expect(cb1).toHaveBeenCalled();
      expect(cb2).toHaveBeenCalled();
      // console.error 被调用以记录错误
      expect(spy).toHaveBeenCalled();
    });
  });

  /* ============================================================
     scheduleLoop 调度边界
     ============================================================ */
  describe('scheduleLoop 调度边界', () => {
    it('nextStepTime > currentTime + lookahead 时不再调度', () => {
      const t = new Transport(ctx as unknown as AudioContext);
      const cb = vi.fn();
      t.subscribe(cb);
      t.start();
      // 第一拍 time = 0.05，已调度
      expect(cb).toHaveBeenCalledTimes(1);
      cb.mockClear();
      // 不推进 currentTime（保持 0），仅推进 timer
      // nextStepTime = 0.05 + 0.125 = 0.175 > 0 + 0.1 = lookahead 边界
      vi.advanceTimersByTime(25);
      // 不应调度新事件
      expect(cb).not.toHaveBeenCalled();
    });

    it('推进 currentTime 后能继续调度后续 step', () => {
      const t = new Transport(ctx as unknown as AudioContext);
      const cb = vi.fn();
      t.subscribe(cb);
      t.start();
      expect(cb).toHaveBeenCalledTimes(1);
      ctx.currentTime = 0.5;
      vi.advanceTimersByTime(25);
      // 推进后应继续调度
      expect(cb.mock.calls.length).toBeGreaterThan(1);
    });

    it('每次 scheduleLoop 最多调度 4 步（MAX_BATCH 限制）', () => {
      const t = new Transport(ctx as unknown as AudioContext);
      const cb = vi.fn();
      t.subscribe(cb);
      // 大幅推进 currentTime，让 nextStepTime 远小于 lookahead 窗口
      t.start();
      cb.mockClear();
      ctx.currentTime = 10.0;
      vi.advanceTimersByTime(25);
      // MAX_BATCH = 4，单次 poll 最多 4 步
      expect(cb).toHaveBeenCalledTimes(4);
    });
  });

  /* ============================================================
     工厂函数与全局管理
     ============================================================ */
  describe('工厂函数与全局管理', () => {
    it('createTransport 返回 Transport 实例', () => {
      const t = createTransport(ctx as unknown as AudioContext);
      expect(t).toBeInstanceOf(Transport);
      expect(t.isPlaying()).toBe(false);
    });

    it('createTransport 支持自定义 bpm / stepsPerBeat', () => {
      const t = createTransport(ctx as unknown as AudioContext, 90, 2);
      expect(t.getBpm()).toBe(90);
    });

    it('stopAllTransports 停止所有活跃 Transport', () => {
      const t1 = createTransport(ctx as unknown as AudioContext);
      const t2 = createTransport(ctx as unknown as AudioContext);
      t1.start();
      t2.start();
      expect(t1.isPlaying()).toBe(true);
      expect(t2.isPlaying()).toBe(true);
      stopAllTransports();
      expect(t1.isPlaying()).toBe(false);
      expect(t2.isPlaying()).toBe(false);
    });

    it('stopOtherTransports 停止除指定外的所有 Transport', () => {
      const t1 = createTransport(ctx as unknown as AudioContext);
      const t2 = createTransport(ctx as unknown as AudioContext);
      const t3 = createTransport(ctx as unknown as AudioContext);
      t1.start();
      t2.start();
      t3.start();
      stopOtherTransports(t2);
      expect(t1.isPlaying()).toBe(false);
      expect(t2.isPlaying()).toBe(true);
      expect(t3.isPlaying()).toBe(false);
    });

    it('stopAllTransports 对空列表不抛错', () => {
      expect(() => stopAllTransports()).not.toThrow();
    });

    it('stopOtherTransports 当只有指定 transport 时不停止它', () => {
      const t1 = createTransport(ctx as unknown as AudioContext);
      t1.start();
      stopOtherTransports(t1);
      expect(t1.isPlaying()).toBe(true);
    });
  });
});
