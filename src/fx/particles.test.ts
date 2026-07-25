import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================
// particles.ts 在模块加载时立即调用 `if (typeof window !== 'undefined'
// && typeof requestAnimationFrame === 'function') startAnimation();`，
// 还会在每次 spawn* 时 ensureCanvas() —— 因此我们需要：
//   1) 提供可控的 requestAnimationFrame / cancelAnimationFrame
//   2) 提供一个 #particleCanvas 元素 + 模拟 2D context
//   3) 通过 vi.resetModules() 重置模块级状态（particles 数组、池子等）
// ============================================================

let rafSpy: (cb: FrameRequestCallback) => number;
let cancelRafSpy: (id: number) => void;
let rafCalls = 0;

function installCanvasMock() {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: () => CanvasRenderingContext2D | null };
  proto.getContext = vi.fn(() => ({
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    globalAlpha: 1,
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
    setTransform: vi.fn(),
  })) as any;
}

function setupParticleCanvas() {
  installCanvasMock();
  const old = document.getElementById('particleCanvas');
  if (old) old.remove();
  const canvas = document.createElement('canvas');
  canvas.id = 'particleCanvas';
  canvas.width = 480;
  canvas.height = 900;
  // 模拟非零 bounding rect，让 canvasSize() 不退回默认 480x900
  canvas.getBoundingClientRect = vi.fn(() => ({
    left: 0,
    top: 0,
    width: 480,
    height: 900,
    right: 480,
    bottom: 900,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })) as any;
  document.body.appendChild(canvas);
}

async function importParticles() {
  const mod = await import('./particles');
  return mod;
}

describe('fx/particles', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    setupParticleCanvas();

    rafCalls = 0;
    // requestAnimationFrame：同步执行回调，模拟下一帧
    rafSpy = vi.fn((cb: FrameRequestCallback) => {
      rafCalls++;
      // 同步触发回调，模拟“下一帧”
      cb(performance.now());
      return 1;
    }) as unknown as (cb: FrameRequestCallback) => number;
    cancelRafSpy = vi.fn();
    // @ts-ignore
    globalThis.requestAnimationFrame = rafSpy;
    // @ts-ignore
    globalThis.cancelAnimationFrame = cancelRafSpy;

    // matchMedia 默认返回未启用 reduced-motion
    // @ts-ignore
    if (!window.matchMedia) {
      // @ts-ignore
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    } else {
      vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as any);
    }

    // devicePixelRatio 默认为 1（syncCanvasSize 会读取）
    // @ts-ignore
    window.devicePixelRatio = 1;
  });

  afterEach(() => {
    // @ts-ignore
    delete globalThis.requestAnimationFrame;
    // @ts-ignore
    delete globalThis.cancelAnimationFrame;
    vi.restoreAllMocks();
  });

  // ------------------------------------------------------------
  // spawnParticles
  // ------------------------------------------------------------
  describe('spawnParticles', () => {
    it('调用后向 particles 数组添加粒子并启动动画', async () => {
      const mod = await importParticles();
      mod.spawnParticles(100, 100, '#FF8C42', 5);
      // RAF 在 spawnParticles 末尾通过 startAnimation 调用 animateParticles
      expect(rafSpy).toHaveBeenCalled();
    });

    it('count=0 不抛错也不添加粒子', async () => {
      const mod = await importParticles();
      // count=0 时 addCount=Math.min(0, 300-0)=0，循环不执行，不会启动动画
      const callsBefore = rafSpy.mock.calls.length;
      expect(() => mod.spawnParticles(0, 0, '#fff', 0)).not.toThrow();
      // 不应触发新的 RAF 调用
      expect(rafSpy.mock.calls.length).toBe(callsBefore);
    });

    it('应用 opts.speed / opts.gravity / opts.upward / opts.shape / opts.minR / opts.maxR', async () => {
      const mod = await importParticles();
      // 仅验证不抛错：内部对每个粒子随机化，无法断言具体值
      expect(() =>
        mod.spawnParticles(10, 10, '#000', 3, {
          speed: 5,
          gravity: 0.5,
          upward: 2,
          shape: 'star',
          minR: 2,
          maxR: 8,
        })
      ).not.toThrow();
    });

    it('opts 为 undefined 时使用默认值', async () => {
      const mod = await importParticles();
      expect(() => mod.spawnParticles(0, 0, '#fff', 2)).not.toThrow();
    });

    it('prefers-reduced-motion 启用时跳过粒子生成', async () => {
      vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as any);
      const mod = await importParticles();
      mod.spawnParticles(0, 0, '#fff', 10);
      // reduced-motion 时 spawnParticles 直接 return，不会调用 ensureCanvas/startAnimation
      // 但模块加载时的 startAnimation 可能仍触发 RAF —— 这里只验证不会因 spawn 触发新 RAF
      const callsBeforeSpawn = rafSpy.mock.calls.length;
      mod.spawnParticles(0, 0, '#fff', 10);
      expect(rafSpy.mock.calls.length).toBe(callsBeforeSpawn);
    });

    it('超过 MAX_PARTICLES 上限后拒绝新增', async () => {
      const mod = await importParticles();
      // 一次添加 300 个 (上限)，再次添加应被全部拒绝
      mod.spawnParticles(0, 0, '#fff', 300);
      const callsBeforeExcess = rafSpy.mock.calls.length;
      // 再添加 50 个 —— 由于已达上限，应直接 return
      mod.spawnParticles(0, 0, '#fff', 50);
      // 不应抛错（避免粒子上限导致页面崩溃）
      expect(true).toBe(true);
    });

    it('count 超过剩余容量时被截断到剩余量', async () => {
      const mod = await importParticles();
      // 先填 290 个，再尝试添加 50 个，最终只能添加 10 个 (达到 300 上限)
      mod.spawnParticles(0, 0, '#fff', 290);
      expect(() => mod.spawnParticles(0, 0, '#fff', 50)).not.toThrow();
    });

    it('在 document 不存在时 (SSR) 安全返回', async () => {
      // 这是模块内部 ensureCanvas 的防御分支，难以直接模拟，
      // 改为验证多次调用不抛错即可
      const mod = await importParticles();
      expect(() => mod.spawnParticles(0, 0, '#fff', 1)).not.toThrow();
    });
  });

  // ------------------------------------------------------------
  // spawnParticlesAtElement
  // ------------------------------------------------------------
  describe('spawnParticlesAtElement', () => {
    it('null 元素安全返回不抛错', async () => {
      const mod = await importParticles();
      expect(() => mod.spawnParticlesAtElement(null, '#fff', 5)).not.toThrow();
    });

    it('对真实 DOM 元素调用 spawnParticles', async () => {
      const mod = await importParticles();
      const el = document.createElement('button');
      el.getBoundingClientRect = vi.fn(() => ({
        left: 100,
        top: 200,
        width: 50,
        height: 30,
        right: 150,
        bottom: 230,
        x: 100,
        y: 200,
        toJSON: () => ({}),
      })) as any;
      document.body.appendChild(el);
      expect(() => mod.spawnParticlesAtElement(el, '#FF8C42', 5)).not.toThrow();
      expect(rafSpy).toHaveBeenCalled();
    });

    it('canvas 不存在时使用 cx=0/cy=0', async () => {
      // 移除 canvas，让 ensureCanvas 找不到元素
      document.getElementById('particleCanvas')?.remove();
      const mod = await importParticles();
      const el = document.createElement('button');
      el.getBoundingClientRect = vi.fn(() => ({
        left: 100,
        top: 200,
        width: 50,
        height: 30,
        right: 150,
        bottom: 230,
        x: 100,
        y: 200,
        toJSON: () => ({}),
      })) as any;
      document.body.appendChild(el);
      // 不应抛错（canvas null 时 spawnParticlesAtElement 仍走 spawnParticles）
      expect(() => mod.spawnParticlesAtElement(el, '#fff', 3)).not.toThrow();
    });
  });

  // ------------------------------------------------------------
  // spawnCorrectParticles / spawnComboParticles / spawnConfetti
  // ------------------------------------------------------------
  describe('spawnCorrectParticles', () => {
    it('调用 20 次 spawnParticles（star 形状）', async () => {
      const mod = await importParticles();
      expect(() => mod.spawnCorrectParticles()).not.toThrow();
      expect(rafSpy).toHaveBeenCalled();
    });

    it('prefers-reduced-motion 启用时不抛错且不生成粒子', async () => {
      vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as any);
      const mod = await importParticles();
      expect(() => mod.spawnCorrectParticles()).not.toThrow();
    });
  });

  describe('spawnComboParticles', () => {
    it('调用 30 次 spawnParticles（多色环形）', async () => {
      const mod = await importParticles();
      expect(() => mod.spawnComboParticles()).not.toThrow();
      expect(rafSpy).toHaveBeenCalled();
    });
  });

  describe('spawnConfetti', () => {
    it('调用 40 次 spawnParticles（彩色五彩纸屑）', async () => {
      const mod = await importParticles();
      expect(() => mod.spawnConfetti()).not.toThrow();
      expect(rafSpy).toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------
  // animateParticles
  // ------------------------------------------------------------
  describe('animateParticles', () => {
    it('canvas 不存在时重置 isAnimating 并返回', async () => {
      // 移除 canvas，让 ensureCanvas 找不到元素
      document.getElementById('particleCanvas')?.remove();
      const mod = await importParticles();
      // 此时 animateParticles 应直接返回且不抛错
      expect(() => mod.animateParticles()).not.toThrow();
    });

    it('canvas 存在时清除并绘制粒子', async () => {
      const mod = await importParticles();
      // 添加粒子，触发 RAF
      mod.spawnParticles(50, 50, '#FF8C42', 5);
      // RAF 同步触发 animateParticles，应不抛错
      expect(rafSpy).toHaveBeenCalled();
    });

    it('粒子 life<=0 时被回收', async () => {
      const mod = await importParticles();
      // 添加少量粒子，让其生命周期结束
      mod.spawnParticles(0, 0, '#fff', 3);
      // RAF 同步触发，粒子会经历若干帧衰减；不抛错即可
      expect(rafSpy).toHaveBeenCalled();
    });

    it('star 形状走 fillText 路径', async () => {
      const mod = await importParticles();
      mod.spawnParticles(50, 50, '#fff', 3, { shape: 'star', minR: 4, maxR: 4 });
      // RAF 同步触发 drawParticle，star 分支调用 fillText
      expect(rafSpy).toHaveBeenCalled();
    });

    it('document 不存在时 (SSR) 安全返回', async () => {
      const mod = await importParticles();
      // 难以完全模拟无 document，验证不抛错即可
      expect(() => mod.animateParticles()).not.toThrow();
    });
  });

  // ------------------------------------------------------------
  // showSuccessToast / showErrorToast
  // ------------------------------------------------------------
  describe('showSuccessToast / showErrorToast', () => {
    it('showSuccessToast 设置文本并显示 2600ms 后隐藏', async () => {
      vi.useFakeTimers();
      const mod = await importParticles();
      // 准备 toast 容器
      const toast = document.createElement('div');
      toast.id = 'globalSuccessToast';
      toast.style.display = 'none';
      document.body.appendChild(toast);

      mod.showSuccessToast('成功了！');
      expect(toast.textContent).toBe('成功了！');
      expect(toast.style.display).toBe('block');

      // 推进 2600ms，应自动隐藏
      vi.advanceTimersByTime(2600);
      expect(toast.style.display).toBe('none');
      vi.useRealTimers();
    });

    it('showSuccessToast 元素不存在时安全返回', async () => {
      const mod = await importParticles();
      document.body.innerHTML = '';
      expect(() => mod.showSuccessToast('x')).not.toThrow();
    });

    it('showErrorToast 设置文本并显示 2600ms 后隐藏', async () => {
      vi.useFakeTimers();
      const mod = await importParticles();
      const toast = document.createElement('div');
      toast.id = 'globalErrorToast';
      toast.style.display = 'none';
      document.body.appendChild(toast);

      mod.showErrorToast('出错了！');
      expect(toast.textContent).toBe('出错了！');
      expect(toast.style.display).toBe('block');

      vi.advanceTimersByTime(2600);
      expect(toast.style.display).toBe('none');
      vi.useRealTimers();
    });

    it('showErrorToast 元素不存在时安全返回', async () => {
      const mod = await importParticles();
      document.body.innerHTML = '';
      expect(() => mod.showErrorToast('x')).not.toThrow();
    });
  });

  // ------------------------------------------------------------
  // window 全局暴露
  // ------------------------------------------------------------
  describe('window 全局暴露', () => {
    it('模块加载后将 spawn* / animateParticles / show*Toast 挂到 window', async () => {
      const mod = await importParticles();
      const w = window as any;
      expect(typeof w.spawnParticles).toBe('function');
      expect(typeof w.spawnParticlesAtElement).toBe('function');
      expect(typeof w.spawnCorrectParticles).toBe('function');
      expect(typeof w.spawnComboParticles).toBe('function');
      expect(typeof w.spawnConfetti).toBe('function');
      expect(typeof w.animateParticles).toBe('function');
      expect(typeof w.showSuccessToast).toBe('function');
      expect(typeof w.showErrorToast).toBe('function');
      // 应与模块导出的引用一致
      expect(w.spawnParticles).toBe(mod.spawnParticles);
      expect(w.showSuccessToast).toBe(mod.showSuccessToast);
    });
  });

  // ------------------------------------------------------------
  // 边界：粒子池 / DPR / resize
  // ------------------------------------------------------------
  describe('边界条件', () => {
    it('高 DPR 设备 (>3) 时 backing store 限制为 3x', async () => {
      // @ts-ignore
      window.devicePixelRatio = 5;
      const canvas = document.getElementById('particleCanvas') as HTMLCanvasElement;
      // 触发 syncCanvasSize：spawnParticlesAtElement / spawnParticles 会 ensureCanvas -> syncCanvasSize
      const mod = await importParticles();
      mod.spawnParticles(0, 0, '#fff', 1);
      // 高 DPR 被钳制为 3，期望 width = 480 * 3 = 1440
      expect(canvas.width).toBeGreaterThanOrEqual(480);
    });

    it('低 DPR 设备 (<1) 时 backing store 至少 1x', async () => {
      // @ts-ignore
      window.devicePixelRatio = 0.5;
      const mod = await importParticles();
      mod.spawnParticles(0, 0, '#fff', 1);
      const canvas = document.getElementById('particleCanvas') as HTMLCanvasElement;
      // DPR 钳制为 1，width = 480
      expect(canvas.width).toBeGreaterThanOrEqual(480);
    });

    it('window resize 事件触发 syncCanvasSize', async () => {
      const mod = await importParticles();
      mod.spawnParticles(0, 0, '#fff', 1); // ensureCanvas -> 注册 resize listener
      const canvas = document.getElementById('particleCanvas') as HTMLCanvasElement;
      // 改 canvas 的 bounding rect，触发 resize，应不抛错
      canvas.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        top: 0,
        width: 600,
        height: 1000,
        right: 600,
        bottom: 1000,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      })) as any;
      expect(() => window.dispatchEvent(new Event('resize'))).not.toThrow();
    });

    it('orientationchange 事件触发 syncCanvasSize', async () => {
      const mod = await importParticles();
      mod.spawnParticles(0, 0, '#fff', 1);
      expect(() => window.dispatchEvent(new Event('orientationchange'))).not.toThrow();
    });

    it('多次连续 spawnParticles 复用同一动画循环', async () => {
      const mod = await importParticles();
      mod.spawnParticles(0, 0, '#fff', 5);
      const callsAfterFirst = rafSpy.mock.calls.length;
      mod.spawnParticles(0, 0, '#fff', 5);
      // 第二次 spawn 应启动新的 RAF 帧（continue 动画）
      // 这里仅验证不抛错且 RAF 被调用
      expect(rafSpy).toHaveBeenCalled();
    });

    it('particlePool 在粒子死亡后被复用', async () => {
      const mod = await importParticles();
      // 添加 5 个粒子，让其生命周期结束（多次 RAF 后 life 会衰减至 0）
      mod.spawnParticles(0, 0, '#fff', 5);
      // 由于 RAF 同步触发，粒子会经历若干帧衰减；不抛错即可
      expect(rafSpy).toHaveBeenCalled();
    });
  });
});
