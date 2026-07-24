import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.mock 工厂会被提升到文件顶部，引用的可变状态必须用 vi.hoisted 声明，
// 否则在工厂执行时变量尚未初始化。
const mocks = vi.hoisted(() => ({
  // Transport.subscribe 回调（onStep），测试中手动调用以模拟节拍
  stepCb: null as ((ev: { step: number; time: number }) => void) | null,
  // subscribe 返回的取消订阅函数
  unsubscribe: vi.fn(),
  // 可控的 AudioContext.currentTime，用于驱动 rAF 循环触发脉冲
  ctx: { currentTime: 0 },
}));

vi.mock('./a11y', () => ({
  announce: vi.fn(),
}));

vi.mock('./audio', () => ({
  getSharedTransport: vi.fn(() => ({
    subscribe: (cb: (ev: { step: number; time: number }) => void) => {
      mocks.stepCb = cb;
      return mocks.unsubscribe;
    },
  })),
  getAudioCtx: vi.fn(() => mocks.ctx),
}));

// requestAnimationFrame / cancelAnimationFrame 手动 mock：
// rafSpy 仅记录回调不立即执行，测试中手动调用以推进 rAF 循环，避免无限递归。
const rafSpy = vi.fn((cb: () => void) => {
  (rafSpy as unknown as { _cb: () => void })._cb = cb;
  return 1;
});
const cancelRafSpy = vi.fn();

describe('visual-beat', () => {
  let visualBeat: typeof import('./visual-beat');

  beforeEach(async () => {
    // @ts-ignore
    globalThis.requestAnimationFrame = rafSpy;
    // @ts-ignore
    globalThis.cancelAnimationFrame = cancelRafSpy;
    mocks.stepCb = null;
    mocks.ctx.currentTime = 0;
    mocks.unsubscribe = vi.fn();
    document.body.innerHTML = '';

    vi.resetModules();
    // 重新 import 以获取干净模块状态（enabled 等内部变量重置）
    visualBeat = await import('./visual-beat');
  });

  afterEach(() => {
    // 确保关闭，清理 DOM 与 rAF
    try {
      visualBeat.disableVisualBeat();
    } catch (e) {
      /* ignore */
    }
    vi.clearAllMocks();
  });

  /** 手动推进一帧 rAF 循环 */
  function tickRaf(): void {
    const cb = (rafSpy as unknown as { _cb: () => void })._cb;
    if (cb) cb();
  }

  it('setVisualBeat(true) 开启并创建视觉脉冲 DOM 元素', () => {
    const on = visualBeat.setVisualBeat(true);
    expect(on).toBe(true);
    expect(visualBeat.isVisualBeatEnabled()).toBe(true);
    expect(document.getElementById('visualBeatFlash')).not.toBeNull();
    expect(document.getElementById('visualBeatDot')).not.toBeNull();
  });

  it('setVisualBeat(false) 关闭并移除 DOM 元素', () => {
    visualBeat.setVisualBeat(true);
    visualBeat.setVisualBeat(false);
    expect(visualBeat.isVisualBeatEnabled()).toBe(false);
    expect(document.getElementById('visualBeatFlash')).toBeNull();
    expect(document.getElementById('visualBeatDot')).toBeNull();
  });

  it('重复 enable 幂等，不会重复创建元素', () => {
    visualBeat.enableVisualBeat();
    visualBeat.enableVisualBeat();
    expect(document.querySelectorAll('#visualBeatFlash').length).toBe(1);
    expect(document.querySelectorAll('#visualBeatDot').length).toBe(1);
  });

  it('disable 调用 transport 的取消订阅函数', () => {
    visualBeat.enableVisualBeat();
    expect(mocks.stepCb).not.toBeNull();
    visualBeat.disableVisualBeat();
    expect(mocks.unsubscribe).toHaveBeenCalled();
  });

  it('step 事件 + rAF 推进后触发视觉脉冲（强拍放大）', () => {
    visualBeat.enableVisualBeat();
    const dot = document.getElementById('visualBeatDot') as HTMLDivElement;

    // 强拍 step=0，time=5
    mocks.stepCb!({ step: 0, time: 5 });
    // 推进音频时钟到 >= 5，使 rAF 循环触发该节拍
    mocks.ctx.currentTime = 5;
    tickRaf();

    // 强拍（step%4===0）应放大到 2.2
    expect(dot.style.transform).toContain('scale(2.2');
  });

  it('弱拍使用较弱的视觉强度（scale 1.5）', () => {
    visualBeat.enableVisualBeat();
    const dot = document.getElementById('visualBeatDot') as HTMLDivElement;

    mocks.stepCb!({ step: 1, time: 3 });
    mocks.ctx.currentTime = 3;
    tickRaf();

    expect(dot.style.transform).toContain('scale(1.5');
  });

  it('getSharedTransport 抛错时降级运行（不依赖音频同步）', async () => {
    const audio = await import('./audio');
    vi.mocked(audio.getSharedTransport).mockImplementationOnce(() => {
      throw new Error('AudioContext unavailable');
    });
    // 不应抛出
    expect(() => visualBeat.enableVisualBeat()).not.toThrow();
    expect(visualBeat.isVisualBeatEnabled()).toBe(true);
    // 元素仍应创建（降级为纯 UI 提示）
    expect(document.getElementById('visualBeatFlash')).not.toBeNull();
  });
});
