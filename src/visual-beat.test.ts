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

  describe('triggerVisualFeedback 听障视觉反馈', () => {
    it('correct 触发绿色 dot 与 announce("答对")', async () => {
      const a11yMod = await import('./a11y');
      visualBeat.triggerVisualFeedback('correct');
      const dot = document.getElementById('visualBeatDot');
      const bg = (dot?.style.background || '').toLowerCase().replace(/\s+/g, '');
      // #7bc67e 对应 rgb(123,198,126)；happy-dom 可能保留 hex 或归一为 rgb
      expect(bg === '#7bc67e' || bg === 'rgb(123,198,126)').toBe(true);
      expect(a11yMod.announce).toHaveBeenCalledWith('答对', 'assertive');
    });

    it('wrong 触发红色 dot 与 announce("答错")', async () => {
      const a11yMod = await import('./a11y');
      visualBeat.triggerVisualFeedback('wrong');
      const dot = document.getElementById('visualBeatDot');
      const bg = (dot?.style.background || '').toLowerCase().replace(/\s+/g, '');
      // #e85d5d 对应 rgb(232,93,93)
      expect(bg === '#e85d5d' || bg === 'rgb(232,93,93)').toBe(true);
      expect(a11yMod.announce).toHaveBeenCalledWith('答错', 'assertive');
    });

    it('click 不改 dot 颜色（仅高亮）', () => {
      // 先用 correct 设绿色背景，再触发 click，确认背景未被 click 改动
      visualBeat.triggerVisualFeedback('correct');
      const dot = document.getElementById('visualBeatDot');
      const bgBefore = (dot?.style.background || '').toLowerCase().replace(/\s+/g, '');
      visualBeat.triggerVisualFeedback('click');
      const bgAfter = (dot?.style.background || '').toLowerCase().replace(/\s+/g, '');
      // click 仅改 opacity，不改 background
      expect(bgAfter).toBe(bgBefore);
      // 不应为红色（wrong 的颜色）
      expect(bgAfter).not.toBe('#e85d5d');
      expect(bgAfter).not.toBe('rgb(232,93,93)');
    });
  });

  describe('prefers-reduced-motion 支持', () => {
    it('reduced-motion 时 triggerVisualFeedback correct 不放大', () => {
      const original = window.matchMedia;
      window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as any;
      visualBeat.triggerVisualFeedback('correct');
      const dot = document.getElementById('visualBeatDot');
      // reduced-motion 下不设 transform scale(2.0)，仅静态改色
      expect(dot?.style.transform).not.toContain('scale(2');
      window.matchMedia = original;
    });

    it('reduced-motion 时 enableVisualBeat 读取 matchMedia', () => {
      const original = window.matchMedia;
      const matchMediaSpy = vi.fn().mockReturnValue({ matches: true });
      window.matchMedia = matchMediaSpy as any;
      // enableVisualBeat 内部 readReducedMotion 会调用 matchMedia
      visualBeat.enableVisualBeat();
      expect(matchMediaSpy).toHaveBeenCalled();
      visualBeat.disableVisualBeat();
      window.matchMedia = original;
    });

    it('reduced-motion 时 triggerVisualFeedback wrong 仅改 dot 颜色（无 flash）', () => {
      const original = window.matchMedia;
      window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as any;
      visualBeat.triggerVisualFeedback('wrong');
      const dot = document.getElementById('visualBeatDot');
      const flash = document.getElementById('visualBeatFlash');
      const bg = (dot?.style.background || '').toLowerCase().replace(/\s+/g, '');
      expect(bg === '#e85d5d' || bg === 'rgb(232,93,93)').toBe(true);
      // reduced-motion 不会设置 flash boxShadow
      expect(flash?.style.boxShadow).not.toContain('120px');
      window.matchMedia = original;
    });

    it('reduced-motion 时 triggerVisualFeedback click 仍仅改 opacity', () => {
      const original = window.matchMedia;
      window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as any;
      visualBeat.triggerVisualFeedback('click');
      const dot = document.getElementById('visualBeatDot');
      expect(dot?.style.opacity).toBe('1');
      window.matchMedia = original;
    });
  });

  // ===== 扩充测试：setTimeout 衰减 / 错误降级 / pending 上限 =====

  describe('triggerPulse 衰减阶段', () => {
    beforeEach(() => {
      // 仅 mock setTimeout / clearTimeout，保留 requestAnimationFrame 走 rafSpy
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('强拍触发后 140ms 衰减回透明状态', () => {
      visualBeat.enableVisualBeat();
      const flash = document.getElementById('visualBeatFlash') as HTMLDivElement;
      const dot = document.getElementById('visualBeatDot') as HTMLDivElement;

      mocks.stepCb!({ step: 0, time: 5 });
      mocks.ctx.currentTime = 5;
      tickRaf();
      // 触发瞬间应设置非透明 boxShadow 与 scale(2.2)
      expect(flash.style.boxShadow).toContain('120px');
      expect(dot.style.transform).toContain('scale(2.2');

      // 推进 140ms，衰减回调将 boxShadow 清空、transform 复位
      vi.advanceTimersByTime(150);
      expect(flash.style.boxShadow).toContain('transparent');
      expect(dot.style.transform).toContain('scale(1)');
      expect(dot.style.opacity).toBe('0.85');
    });

    it('弱拍触发后 140ms 衰减回透明状态', () => {
      visualBeat.enableVisualBeat();
      const flash = document.getElementById('visualBeatFlash') as HTMLDivElement;
      const dot = document.getElementById('visualBeatDot') as HTMLDivElement;

      mocks.stepCb!({ step: 2, time: 1 });
      mocks.ctx.currentTime = 1;
      tickRaf();
      // 弱拍 scale(1.5) 与 rgba(126,184,212,...) 颜色
      expect(dot.style.transform).toContain('scale(1.5');

      vi.advanceTimersByTime(150);
      expect(flash.style.boxShadow).toContain('transparent');
      expect(dot.style.opacity).toBe('0.85');
    });

    it('衰减回调在元素已被移除时安全返回', () => {
      visualBeat.enableVisualBeat();
      mocks.stepCb!({ step: 0, time: 1 });
      mocks.ctx.currentTime = 1;
      tickRaf();
      // 在 setTimeout 触发前 disable，移除元素
      visualBeat.disableVisualBeat();
      // 推进定时器，回调应安全返回（不抛错）
      expect(() => vi.advanceTimersByTime(150)).not.toThrow();
    });
  });

  describe('triggerVisualFeedback 衰减阶段', () => {
    beforeEach(() => {
      // 仅 mock setTimeout / clearTimeout，保留 requestAnimationFrame 走 rafSpy
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('correct 触发后 140ms 衰减回默认 dot 颜色 #ff8c42', () => {
      visualBeat.triggerVisualFeedback('correct');
      const dot = document.getElementById('visualBeatDot') as HTMLDivElement;
      const flash = document.getElementById('visualBeatFlash') as HTMLDivElement;
      // 触发瞬间：绿色 dot、放大、flash 有 boxShadow
      expect(flash.style.boxShadow).toContain('120px');
      expect(dot.style.transform).toContain('scale(2');

      vi.advanceTimersByTime(150);
      // 衰减：flash 清空、dot 复位、颜色回到 #ff8c42
      expect(flash.style.boxShadow).toContain('transparent');
      expect(dot.style.transform).toContain('scale(1)');
      const bgAfter = (dot.style.background || '').toLowerCase().replace(/\s+/g, '');
      expect(bgAfter === '#ff8c42' || bgAfter === 'rgb(255,140,66)').toBe(true);
    });

    it('wrong 触发后 140ms 衰减回默认 dot 颜色 #ff8c42', () => {
      visualBeat.triggerVisualFeedback('wrong');
      const dot = document.getElementById('visualBeatDot') as HTMLDivElement;
      vi.advanceTimersByTime(150);
      const bgAfter = (dot.style.background || '').toLowerCase().replace(/\s+/g, '');
      expect(bgAfter === '#ff8c42' || bgAfter === 'rgb(255,140,66)').toBe(true);
    });

    it('click 触发后 140ms 衰减 opacity 回 0.85', () => {
      visualBeat.triggerVisualFeedback('click');
      const dot = document.getElementById('visualBeatDot') as HTMLDivElement;
      expect(dot.style.opacity).toBe('1');
      vi.advanceTimersByTime(150);
      expect(dot.style.opacity).toBe('0.85');
    });

    it('衰减回调在元素被移除后安全返回（不抛错）', () => {
      visualBeat.triggerVisualFeedback('correct');
      // 在 setTimeout 触发前清空 DOM
      document.body.innerHTML = '';
      expect(() => vi.advanceTimersByTime(150)).not.toThrow();
    });
  });

  describe('announce 错误降级', () => {
    it('enableVisualBeat 中 announce 抛错时被捕获', async () => {
      const a11yMod = await import('./a11y');
      vi.mocked(a11yMod.announce).mockImplementationOnce(() => {
        throw new Error('announce failed');
      });
      expect(() => visualBeat.enableVisualBeat()).not.toThrow();
      expect(visualBeat.isVisualBeatEnabled()).toBe(true);
      visualBeat.disableVisualBeat();
    });

    it('disableVisualBeat 中 announce 抛错时被捕获', async () => {
      visualBeat.enableVisualBeat();
      const a11yMod = await import('./a11y');
      vi.mocked(a11yMod.announce).mockImplementationOnce(() => {
        throw new Error('announce failed');
      });
      expect(() => visualBeat.disableVisualBeat()).not.toThrow();
      expect(visualBeat.isVisualBeatEnabled()).toBe(false);
    });

    it('triggerVisualFeedback 中 announce 抛错时被捕获', async () => {
      const a11yMod = await import('./a11y');
      vi.mocked(a11yMod.announce).mockImplementationOnce(() => {
        throw new Error('announce failed');
      });
      expect(() => visualBeat.triggerVisualFeedback('correct')).not.toThrow();
    });
  });

  describe('unsubscribeStep 错误降级', () => {
    it('disableVisualBeat 中 unsubscribe 抛错时被捕获', () => {
      mocks.unsubscribe = vi.fn(() => {
        throw new Error('unsubscribe failed');
      });
      visualBeat.enableVisualBeat();
      expect(() => visualBeat.disableVisualBeat()).not.toThrow();
      expect(visualBeat.isVisualBeatEnabled()).toBe(false);
    });
  });

  describe('rafLoop 错误降级', () => {
    it('getAudioCtx 抛错时使用 performance.now() 作为 ctxTime', async () => {
      const audioMod = await import('./audio');
      vi.mocked(audioMod.getAudioCtx).mockImplementationOnce(() => {
        throw new Error('audio context unavailable');
      });
      visualBeat.enableVisualBeat();
      // 推进一帧 rAF：getAudioCtx 抛错时应降级使用 performance.now()/1000
      // 不抛错即可
      expect(() => tickRaf()).not.toThrow();
    });
  });

  describe('onStep pending 队列上限', () => {
    it('pending 超过 MAX_PENDING (64) 时丢弃最旧条目', () => {
      visualBeat.enableVisualBeat();
      // 注入 70 个 step 事件，超过 MAX_PENDING=64
      for (let i = 0; i < 70; i++) {
        mocks.stepCb!({ step: i, time: i + 1 });
      }
      // 推进 rAF，触发所有 pending 中的节拍
      mocks.ctx.currentTime = 100;
      // tickRaf 会调用 triggerPulse 多次直到 pending 为空
      // 不抛错即可（验证丢弃机制不会抛异常）
      expect(() => tickRaf()).not.toThrow();
    });

    it('disabled 时 onStep 不入队', () => {
      // 不 enable，直接调用 stepCb（实际上 mocks.stepCb 仅在 enable 后被赋值）
      // 这里改为：enable 后立即 disable，再触发 step 不应影响
      visualBeat.enableVisualBeat();
      const cb = mocks.stepCb;
      visualBeat.disableVisualBeat();
      // cb 仍指向旧的 onStep 函数，但 enabled=false 后 onStep 直接 return
      expect(() => cb!({ step: 0, time: 5 })).not.toThrow();
    });
  });

  describe('disable 状态切换与 rAF 取消', () => {
    it('disable 取消已注册的 rAF id', () => {
      visualBeat.enableVisualBeat();
      // rafId 已被 enableVisualBeat 设置（rafSpy 返回 1）
      // disable 应调用 cancelAnimationFrame
      cancelRafSpy.mockClear();
      visualBeat.disableVisualBeat();
      expect(cancelRafSpy).toHaveBeenCalled();
    });

    it('未 enable 时 disable 是无操作', () => {
      expect(() => visualBeat.disableVisualBeat()).not.toThrow();
      expect(visualBeat.isVisualBeatEnabled()).toBe(false);
    });

    it('rafLoop 在 disabled 时立即退出且不重新调度 rAF', () => {
      visualBeat.enableVisualBeat();
      rafSpy.mockClear();
      // disable 后再手动触发 rafLoop（通过保留的 _cb）：
      // 由于 enabled=false，rafLoop 会直接 return 且不调度下一帧
      const cb = (rafSpy as unknown as { _cb: () => void })._cb;
      visualBeat.disableVisualBeat();
      if (cb) {
        expect(() => cb()).not.toThrow();
        // rafSpy 不应被再次调用（不重新调度）
        expect(rafSpy).not.toHaveBeenCalled();
      }
    });
  });

  describe('各种节拍类型', () => {
    it('step=0 强拍使用 #ff8c42 颜色', () => {
      visualBeat.enableVisualBeat();
      const dot = document.getElementById('visualBeatDot') as HTMLDivElement;
      mocks.stepCb!({ step: 0, time: 1 });
      mocks.ctx.currentTime = 1;
      tickRaf();
      expect(dot.style.background).toBe('#ff8c42');
    });

    it('step=4 强拍也使用 #ff8c42 颜色（每 4 步强拍）', () => {
      visualBeat.enableVisualBeat();
      const dot = document.getElementById('visualBeatDot') as HTMLDivElement;
      mocks.stepCb!({ step: 4, time: 1 });
      mocks.ctx.currentTime = 1;
      tickRaf();
      expect(dot.style.background).toBe('#ff8c42');
      expect(dot.style.transform).toContain('scale(2.2');
    });

    it('step=8 强拍使用 #ff8c42 颜色（跨小节强拍）', () => {
      visualBeat.enableVisualBeat();
      const dot = document.getElementById('visualBeatDot') as HTMLDivElement;
      mocks.stepCb!({ step: 8, time: 1 });
      mocks.ctx.currentTime = 1;
      tickRaf();
      expect(dot.style.background).toBe('#ff8c42');
    });

    it('step=1 弱拍使用 #7eb8d4 颜色', () => {
      visualBeat.enableVisualBeat();
      const dot = document.getElementById('visualBeatDot') as HTMLDivElement;
      mocks.stepCb!({ step: 1, time: 1 });
      mocks.ctx.currentTime = 1;
      tickRaf();
      expect(dot.style.background).toBe('#7eb8d4');
    });

    it('step=2 弱拍使用 #7eb8d4 颜色', () => {
      visualBeat.enableVisualBeat();
      const dot = document.getElementById('visualBeatDot') as HTMLDivElement;
      mocks.stepCb!({ step: 2, time: 1 });
      mocks.ctx.currentTime = 1;
      tickRaf();
      expect(dot.style.background).toBe('#7eb8d4');
      expect(dot.style.transform).toContain('scale(1.5');
    });

    it('step=3 弱拍使用 #7eb8d4 颜色', () => {
      visualBeat.enableVisualBeat();
      const dot = document.getElementById('visualBeatDot') as HTMLDivElement;
      mocks.stepCb!({ step: 3, time: 1 });
      mocks.ctx.currentTime = 1;
      tickRaf();
      expect(dot.style.background).toBe('#7eb8d4');
    });

    it('step=5 弱拍使用 #7eb8d4 颜色', () => {
      visualBeat.enableVisualBeat();
      const dot = document.getElementById('visualBeatDot') as HTMLDivElement;
      mocks.stepCb!({ step: 5, time: 1 });
      mocks.ctx.currentTime = 1;
      tickRaf();
      expect(dot.style.background).toBe('#7eb8d4');
    });
  });

  describe('视觉反馈：颜色变化 / 缩放 / 透明度', () => {
    it('correct 设置 opacity=1 与 scale(2.0)', () => {
      visualBeat.triggerVisualFeedback('correct');
      const dot = document.getElementById('visualBeatDot') as HTMLDivElement;
      expect(dot.style.opacity).toBe('1');
      expect(dot.style.transform).toContain('scale(2');
    });

    it('wrong 设置 opacity=1 与 scale(2.0)', () => {
      visualBeat.triggerVisualFeedback('wrong');
      const dot = document.getElementById('visualBeatDot') as HTMLDivElement;
      expect(dot.style.opacity).toBe('1');
      expect(dot.style.transform).toContain('scale(2');
    });

    it('correct flash 使用绿色 rgba(123,198,126,0.55)', () => {
      visualBeat.triggerVisualFeedback('correct');
      const flash = document.getElementById('visualBeatFlash') as HTMLDivElement;
      expect(flash.style.boxShadow).toContain('123,198,126');
    });

    it('wrong flash 使用红色 rgba(232,93,93,0.55)', () => {
      visualBeat.triggerVisualFeedback('wrong');
      const flash = document.getElementById('visualBeatFlash') as HTMLDivElement;
      expect(flash.style.boxShadow).toContain('232,93,93');
    });

    it('click 不触发 flash boxShadow', () => {
      visualBeat.triggerVisualFeedback('click');
      const flash = document.getElementById('visualBeatFlash') as HTMLDivElement;
      // click 仅改 dot opacity，不设置 flash boxShadow
      expect(flash.style.boxShadow).not.toContain('120px');
    });
  });

  describe('readReducedMotion 边界', () => {
    it('window.matchMedia 不存在时返回 false', () => {
      const original = window.matchMedia;
      // @ts-ignore
      delete window.matchMedia;
      // 重新 import 模块以触发 readReducedMotion
      // 但 readReducedMotion 在 enableVisualBeat 中调用，所以直接 enable
      expect(() => visualBeat.enableVisualBeat()).not.toThrow();
      visualBeat.disableVisualBeat();
      window.matchMedia = original;
    });

    it('window.matchMedia 抛错时返回 false（try/catch 降级）', () => {
      const original = window.matchMedia;
      window.matchMedia = vi.fn(() => {
        throw new Error('matchMedia not supported');
      }) as any;
      // 不应抛错（readReducedMotion 内部 try/catch）
      expect(() => visualBeat.enableVisualBeat()).not.toThrow();
      visualBeat.disableVisualBeat();
      window.matchMedia = original;
    });
  });

  describe('ensureElements 幂等性', () => {
    it('元素已存在且仍在 DOM 中时不重复创建', () => {
      visualBeat.enableVisualBeat();
      const flash1 = document.getElementById('visualBeatFlash');
      // 再次调用 triggerVisualFeedback 会触发 ensureElements，但不应重复创建
      visualBeat.triggerVisualFeedback('correct');
      const flashes = document.querySelectorAll('#visualBeatFlash');
      expect(flashes.length).toBe(1);
      expect(document.getElementById('visualBeatFlash')).toBe(flash1);
    });

    it('元素已从 DOM 移除时被重新创建', () => {
      visualBeat.enableVisualBeat();
      const flash1 = document.getElementById('visualBeatFlash');
      flash1?.remove();
      // 调用 triggerVisualFeedback 应重新创建元素
      visualBeat.triggerVisualFeedback('correct');
      const flash2 = document.getElementById('visualBeatFlash');
      expect(flash2).not.toBeNull();
      expect(flash2).not.toBe(flash1);
    });
  });

  describe('setVisualBeat 切换', () => {
    it('setVisualBeat(true) 后再 setVisualBeat(false) 切换状态', () => {
      expect(visualBeat.setVisualBeat(true)).toBe(true);
      expect(visualBeat.isVisualBeatEnabled()).toBe(true);
      expect(visualBeat.setVisualBeat(false)).toBe(false);
      expect(visualBeat.isVisualBeatEnabled()).toBe(false);
    });

    it('setVisualBeat(false) 在未开启时也无副作用', () => {
      expect(visualBeat.setVisualBeat(false)).toBe(false);
    });
  });
});
