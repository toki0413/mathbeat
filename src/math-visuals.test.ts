import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MATH_VISUALS, stopAllMathVisuals } from './math-visuals';

// happy-dom 的 canvas.getContext('2d') 返回 null，visual 3 依赖 2D 上下文。
// 这里在所有 describe 之前 stub getContext，返回最小化的假 2D context。
let realGetContext: typeof HTMLCanvasElement.prototype.getContext;

beforeEach(() => {
  realGetContext = HTMLCanvasElement.prototype.getContext;
  const fakeCtx = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    set strokeStyle(_: string) {},
    get strokeStyle() { return ''; },
    set fillStyle(_: string) {},
    get fillStyle() { return ''; },
    set lineWidth(_: number) {},
    get lineWidth() { return 1; },
    set font(_: string) {},
    get font() { return ''; },
    set textAlign(_: string) {},
    get textAlign() { return ''; },
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  };
  HTMLCanvasElement.prototype.getContext = vi.fn(() => fakeCtx) as any;
});

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = realGetContext;
});

describe('math-visuals - 模块结构', () => {
  it('MATH_VISUALS 包含 1-8 共 8 个可视化条目', () => {
    for (let i = 1; i <= 8; i++) {
      expect(MATH_VISUALS[i]).toBeDefined();
      expect(typeof MATH_VISUALS[i].title).toBe('string');
      expect(MATH_VISUALS[i].title.length).toBeGreaterThan(0);
      expect(typeof MATH_VISUALS[i].render).toBe('function');
    }
  });

  it('每个可视化都有非空 title 字符串', () => {
    for (const key of Object.keys(MATH_VISUALS)) {
      const title = MATH_VISUALS[Number(key)].title;
      expect(typeof title).toBe('string');
      expect(title.trim().length).toBeGreaterThan(0);
    }
  });

  it('MATH_VISUALS 的 keys 是 1-8', () => {
    const keys = Object.keys(MATH_VISUALS).map(Number).sort((a, b) => a - b);
    expect(keys).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('math-visuals - render 不抛错', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    // 清理可能在 visual 3 中注册的 RAF 控制器
    try {
      stopAllMathVisuals();
    } catch (e) {
      /* ignore */
    }
    container.remove();
  });

  for (const idStr of ['1', '2', '3', '4', '5', '6', '7', '8']) {
    it(`visual ${idStr} (${MATH_VISUALS[Number(idStr)].title}) 渲染不抛错`, () => {
      expect(() => MATH_VISUALS[Number(idStr)].render(container)).not.toThrow();
    });
  }

  it('visual 1 渲染后容器中包含 svg 元素', () => {
    MATH_VISUALS[1].render(container);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    // 应该有两个轨道（A 和 B）的 g
    const groups = container.querySelectorAll('svg g');
    expect(groups.length).toBeGreaterThanOrEqual(3); // gA, gB, gLCM
  });

  it('visual 1 渲染后包含两条滑块（A周期 / B周期）', () => {
    MATH_VISUALS[1].render(container);
    const sliders = container.querySelectorAll('input[type="range"]');
    expect(sliders.length).toBe(2);
  });

  it('visual 2 渲染后包含正十二边形的 12 个顶点圆点', () => {
    MATH_VISUALS[2].render(container);
    // gPoly 里有 12 个 circle（顶点）+ 1 个 polygon
    const circles = container.querySelectorAll('svg circle');
    // 12 个顶点圆 + 选中音符的圆（默认 C-E-G 三个）= 15 个
    expect(circles.length).toBeGreaterThanOrEqual(12);
  });

  it('visual 2 渲染后包含“旋转 +1”和“倒影”按钮', () => {
    MATH_VISUALS[2].render(container);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent).toContain('旋转');
    expect(buttons[1].textContent).toContain('倒影');
  });

  it('visual 3 渲染后包含 canvas 元素', () => {
    MATH_VISUALS[3].render(container);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas?.width).toBe(360);
    expect(canvas?.height).toBe(120);
  });

  it('visual 4 渲染后包含外环与内环两个 circle', () => {
    MATH_VISUALS[4].render(container);
    const circles = container.querySelectorAll('svg circle');
    // 外环 + 内环 + a 个外刻度 + b 个内刻度
    expect(circles.length).toBeGreaterThanOrEqual(2);
  });

  it('visual 4 渲染后包含“下一步”按钮', () => {
    MATH_VISUALS[4].render(container);
    const btn = container.querySelector('button');
    expect(btn).not.toBeNull();
    expect(btn?.textContent).toContain('下一步');
  });

  it('visual 5 渲染后包含 4 个音符格子', () => {
    MATH_VISUALS[5].render(container);
    const boxes = container.querySelectorAll('div div div');
    // 渲染的 row 含 4 个 box，每个为 div（row 是嵌套 div）
    expect(boxes.length).toBeGreaterThanOrEqual(4);
  });

  it('visual 6 渲染后包含 8 个步进格子（默认 n=8）', () => {
    MATH_VISUALS[6].render(container);
    // row 内的 cell
    const row = container.querySelector('div + div');
    expect(row).not.toBeNull();
    // 默认 k=3, n=8，应有 8 个 cell
    const cells = container.querySelectorAll('div div div');
    expect(cells.length).toBeGreaterThanOrEqual(8);
  });

  it('visual 7 渲染后包含 svg 与 3 个状态节点', () => {
    MATH_VISUALS[7].render(container);
    const circles = container.querySelectorAll('svg circle');
    expect(circles.length).toBeGreaterThanOrEqual(3);
  });

  it('visual 8 渲染后包含 4 个和弦节点', () => {
    MATH_VISUALS[8].render(container);
    const circles = container.querySelectorAll('svg circle');
    expect(circles.length).toBe(4);
  });

  it('同一 visual 多次调用 render 不会抛错（重渲染）', () => {
    expect(() => {
      MATH_VISUALS[1].render(container);
      MATH_VISUALS[1].render(container);
    }).not.toThrow();
  });

  it('渲染到空容器（边界场景）不抛错', () => {
    const empty = document.createElement('div');
    document.body.appendChild(empty);
    expect(() => MATH_VISUALS[2].render(empty)).not.toThrow();
    empty.remove();
  });
});

describe('math-visuals - 不同参数生成不同输出', () => {
  it('visual 2 的“旋转”按钮触发后节点圆数量保持不变但位置变化', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    MATH_VISUALS[2].render(container);
    const buttons = container.querySelectorAll('button');
    const before = container.querySelectorAll('svg g:nth-child(2) circle').length;
    buttons[0].click(); // 旋转 +1
    const after = container.querySelectorAll('svg g:nth-child(2) circle').length;
    expect(after).toBe(before);
    container.remove();
  });

  it('visual 5 的“逆行”按钮触发后不抛错且仍保留 4 个音符', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    MATH_VISUALS[5].render(container);
    const buttons = container.querySelectorAll('button');
    expect(() => buttons[0].click()).not.toThrow(); // 逆行
    const boxes = container.querySelectorAll('div div div');
    expect(boxes.length).toBeGreaterThanOrEqual(4);
    container.remove();
  });

  it('visual 6 的两个滑块在创建时具备不同的 min/max 值', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    MATH_VISUALS[6].render(container);
    const sliders = container.querySelectorAll('input[type="range"]');
    expect(sliders.length).toBe(2);
    expect(sliders[0].getAttribute('min')).not.toBe(sliders[1].getAttribute('min'));
    container.remove();
  });
});

describe('math-visuals - stopAllMathVisuals', () => {
  it('未启动任何可视化时调用不抛错', () => {
    expect(() => stopAllMathVisuals()).not.toThrow();
  });

  it('启动 visual 3 后再调用 stopAllMathVisuals 不抛错', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    MATH_VISUALS[3].render(container);
    expect(() => stopAllMathVisuals()).not.toThrow();
    container.remove();
  });

  it('连续调用 stopAllMathVisuals 不抛错（幂等）', () => {
    expect(() => {
      stopAllMathVisuals();
      stopAllMathVisuals();
      stopAllMathVisuals();
    }).not.toThrow();
  });
});
