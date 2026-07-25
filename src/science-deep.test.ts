import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- mock 音频 / game-engine / events 副作用 ----
vi.mock('./audio', () => ({
  getAudioCtx: () => ({ currentTime: 0, state: 'running', resume: vi.fn() }),
  getSharedTransport: vi.fn(() => ({
    subscribe: vi.fn(() => () => {}),
    start: vi.fn(),
    stop: vi.fn(),
    setBpm: vi.fn(),
  })),
  stopSharedTransport: vi.fn(),
  scheduleToneAt: vi.fn(),
}));

vi.mock('./game-engine', () => ({
  stopAllPlayback: vi.fn(),
}));

vi.mock('./events', () => ({ registerActions: vi.fn() }));

import {
  SCIENCE_DEEP_SAMPLES,
  SCIENCE_DEEP_SCHEMA,
  SCIENCE_DEEP_TYPE_NAMES,
  SCIENCE_DEEP_MAPPINGS,
  SCIENCE_DEEP_OPTIONS,
  FRACTURE_SAMPLES,
  FLAME_SAMPLES,
  generateFractureMusic,
  renderFractureViz,
  generateFlameMusic,
  renderFlameViz,
  openFractureMode,
  closeFractureMode,
  loadFractureSample,
  openFlameMode,
  closeFlameMode,
  loadFlameSample,
  _deepSelfCheck,
} from './science-deep';
import type {
  CrystalSample,
  QuantumSample,
  SeismicSample,
  EegSample,
  FractureSample,
  FlameSample,
  MaterioNote,
} from './science-deep';

describe('science-deep —— 科学之声深度扩展模块', () => {
  describe('静态数据结构 SCIENCE_DEEP_SAMPLES', () => {
    it('crystal 晶体样本字段完整且符合金刚石结构', () => {
      const c: CrystalSample = SCIENCE_DEEP_SAMPLES.crystal;
      expect(c.name).toContain('硅');
      expect(c.lattice).toBeGreaterThan(0);
      expect(c.basis.length).toBe(8); // 金刚石惯用胞 8 原子
      c.basis.forEach((atom) => {
        expect(atom.x).toBeGreaterThanOrEqual(0);
        expect(atom.x).toBeLessThanOrEqual(1);
        expect(atom.y).toBeGreaterThanOrEqual(0);
        expect(atom.y).toBeLessThanOrEqual(1);
        expect(atom.z).toBeGreaterThanOrEqual(0);
        expect(atom.z).toBeLessThanOrEqual(1);
      });
      expect(c.symmetry).toBe('Fd-3m');
      expect(c.phonons.length).toBe(8);
    });

    it('quantum 量子波函数样本字段完整', () => {
      const q: QuantumSample = SCIENCE_DEEP_SAMPLES.quantum;
      expect(q.n).toBe(3);
      expect(q.l).toBe(2);
      expect(q.m).toBe(0);
      expect(q.radial.length).toBe(10);
      expect(q.angular.length).toBe(8);
      expect(q.energy).toBeCloseTo(-1.51, 2);
      expect(q.nodes).toBe(1);
    });

    it('seismic 地震波样本字段完整且 P 波早于 S 波', () => {
      const s: SeismicSample = SCIENCE_DEEP_SAMPLES.seismic;
      expect(s.magnitude).toBe(9.0);
      expect(s.pWave.length).toBe(10);
      expect(s.sWave.length).toBe(10);
      expect(s.surface.length).toBe(10);
      // P 波到达时间应小于 S 波
      for (let i = 0; i < s.pWave.length; i++) {
        expect(s.pWave[i]).toBeLessThan(s.sWave[i]);
      }
      expect(s.epicenter.lat).toBe(38.3);
      expect(s.epicenter.lon).toBe(142.4);
      expect(s.depth).toBe(29);
    });

    it('eeg 脑电波样本字段完整', () => {
      const e: EegSample = SCIENCE_DEEP_SAMPLES.eeg;
      expect(e.bands.delta.length).toBe(4);
      expect(e.bands.theta.length).toBe(4);
      expect(e.bands.alpha.length).toBe(4);
      expect(e.bands.beta.length).toBe(4);
      expect(e.bands.gamma.length).toBe(4);
      expect(e.dominant).toBe('alpha');
      expect(e.freqRange).toEqual([0.5, 40]);
      expect(e.channels).toBe(8);
    });
  });

  describe('SCHEMA / TYPE_NAMES', () => {
    it('SCHEMA 包含全部 4 种类型且为字符串', () => {
      expect(Object.keys(SCIENCE_DEEP_SCHEMA).length).toBe(4);
      expect(SCIENCE_DEEP_SCHEMA.crystal).toContain('lattice');
      expect(SCIENCE_DEEP_SCHEMA.quantum).toContain('radial');
      expect(SCIENCE_DEEP_SCHEMA.seismic).toContain('pWave');
      expect(SCIENCE_DEEP_SCHEMA.eeg).toContain('bands');
    });

    it('TYPE_NAMES 包含全部 4 种类型且为中文名', () => {
      expect(Object.keys(SCIENCE_DEEP_TYPE_NAMES).length).toBe(4);
      expect(SCIENCE_DEEP_TYPE_NAMES.crystal).toBe('晶体点阵');
      expect(SCIENCE_DEEP_TYPE_NAMES.quantum).toBe('量子波函数');
      expect(SCIENCE_DEEP_TYPE_NAMES.seismic).toBe('地震波');
      expect(SCIENCE_DEEP_TYPE_NAMES.eeg).toBe('脑电波');
    });
  });

  describe('MAPPINGS / OPTIONS', () => {
    it('每种类型恰好 6 条映射', () => {
      (['crystal', 'quantum', 'seismic', 'eeg'] as const).forEach((k) => {
        expect(SCIENCE_DEEP_MAPPINGS[k].length).toBe(6);
        SCIENCE_DEEP_MAPPINGS[k].forEach((m) => {
          expect(m.id).toBeTruthy();
          expect(m.title).toBeTruthy();
          expect(m.desc).toBeTruthy();
        });
      });
    });

    it('每种类型恰好 4 个调参旋钮', () => {
      (['crystal', 'quantum', 'seismic', 'eeg'] as const).forEach((k) => {
        expect(SCIENCE_DEEP_OPTIONS[k].length).toBe(4);
        SCIENCE_DEEP_OPTIONS[k].forEach((o) => {
          expect(o.key).toBeTruthy();
          expect(o.label).toBeTruthy();
          expect(o.min).toBeLessThanOrEqual(o.max);
          expect(o.def).toBeGreaterThanOrEqual(o.min);
          expect(o.def).toBeLessThanOrEqual(o.max);
          expect(o.unit).toBeTruthy();
        });
      });
    });
  });

  describe('FRACTURE_SAMPLES', () => {
    it('包含 brittle / ductile / fatigue 三类断裂', () => {
      expect(Object.keys(FRACTURE_SAMPLES).length).toBe(3);
      expect(FRACTURE_SAMPLES.brittle).toBeDefined();
      expect(FRACTURE_SAMPLES.ductile).toBeDefined();
      expect(FRACTURE_SAMPLES.fatigue).toBeDefined();
    });

    it('每个样本应力场含 12 个采样点', () => {
      Object.values(FRACTURE_SAMPLES).forEach((s: FractureSample) => {
        expect(s.stressField.length).toBe(12);
        s.stressField.forEach((p) => {
          expect(typeof p.r).toBe('number');
          expect(typeof p.theta).toBe('number');
          expect(typeof p.sigma_vm).toBe('number');
          expect(p.sigma_vm).toBeGreaterThan(0);
        });
        expect(s.youngsModulus).toBeGreaterThan(0);
        expect(s.fractureToughness).toBeGreaterThan(0);
      });
    });

    it('脆性断裂远场衰减快于韧性断裂', () => {
      // 取最远点的应力值比较
      const brittleFar = FRACTURE_SAMPLES.brittle.stressField[11].sigma_vm;
      const ductileFar = FRACTURE_SAMPLES.ductile.stressField[11].sigma_vm;
      // 韧性断裂远场应力更高（塑性区扩展）
      expect(ductileFar).toBeGreaterThan(brittleFar);
    });

    it('疲劳断裂存在非单调起伏（海滩纹特征）', () => {
      const sigmas = FRACTURE_SAMPLES.fatigue.stressField.map((p) => p.sigma_vm);
      let nonMonotonic = false;
      for (let i = 1; i < sigmas.length - 1; i++) {
        // 局部反弹：先降后升
        if (sigmas[i] < sigmas[i - 1] && sigmas[i] < sigmas[i + 1]) {
          nonMonotonic = true;
          break;
        }
      }
      expect(nonMonotonic).toBe(true);
    });
  });

  describe('FLAME_SAMPLES', () => {
    it('包含 laminar / turbulent / detonation 三类火焰', () => {
      expect(Object.keys(FLAME_SAMPLES).length).toBe(3);
      expect(FLAME_SAMPLES.laminar).toBeDefined();
      expect(FLAME_SAMPLES.turbulent).toBeDefined();
      expect(FLAME_SAMPLES.detonation).toBeDefined();
    });

    it('每个样本含 12 个网格单元', () => {
      Object.values(FLAME_SAMPLES).forEach((s: FlameSample) => {
        expect(s.cells.length).toBe(12);
        s.cells.forEach((c) => {
          expect(c.x).toBeGreaterThanOrEqual(0);
          expect(c.x).toBeLessThanOrEqual(1);
          expect(c.y).toBeGreaterThanOrEqual(0);
          expect(c.y).toBeLessThanOrEqual(1);
          expect(c.temp).toBeGreaterThan(0);
        });
        expect(s.temperature).toBeGreaterThan(0);
        expect(s.flickerFreq).toBeGreaterThan(0);
        expect(s.reynolds).toBeGreaterThan(0);
      });
    });

    it('层流火焰温度 < 湍流火焰 < 爆轰', () => {
      expect(FLAME_SAMPLES.laminar.temperature).toBeLessThan(FLAME_SAMPLES.turbulent.temperature);
      expect(FLAME_SAMPLES.turbulent.temperature).toBeLessThan(FLAME_SAMPLES.detonation.temperature);
    });

    it('层流火焰涡量绝对值 < 湍流 < 爆轰', () => {
      const laminarMax = Math.max(...FLAME_SAMPLES.laminar.cells.map((c) => Math.abs(c.vorticity)));
      const turbMax = Math.max(...FLAME_SAMPLES.turbulent.cells.map((c) => Math.abs(c.vorticity)));
      const detoMax = Math.max(...FLAME_SAMPLES.detonation.cells.map((c) => Math.abs(c.vorticity)));
      expect(laminarMax).toBeLessThan(turbMax);
      expect(turbMax).toBeLessThan(detoMax);
    });
  });

  describe('generateFractureMusic', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('返回 12 个音符', () => {
      const notes = generateFractureMusic(FRACTURE_SAMPLES.brittle);
      expect(notes.length).toBe(12);
    });

    it('每个音符频率/力度/时长/类型合法', () => {
      const notes = generateFractureMusic(FRACTURE_SAMPLES.ductile);
      notes.forEach((n: MaterioNote) => {
        expect(n.freq).toBeGreaterThan(0);
        expect(n.velocity).toBeGreaterThan(0);
        expect(n.velocity).toBeLessThanOrEqual(1);
        expect(n.dur).toBeGreaterThan(0);
        expect(n.type).toBe('sawtooth');
        expect(n.ornament).toBeUndefined(); // 断裂声化无装饰音
      });
    });

    it('应力越大频率越高（按归一化递增）', () => {
      // 构造一个应力单调递增的样本
      const sample: FractureSample = {
        name: '单调样本',
        crackTip: { x: 0.5, y: 0.5 },
        stressField: Array.from({ length: 12 }, (_, i) => ({
          r: 0.02 + i * 0.04,
          theta: 0,
          sigma_vm: 50 + i * 20,
        })),
        youngsModulus: 100,
        fractureToughness: 10,
      };
      const notes = generateFractureMusic(sample);
      // 排序后按 r 由近到远，应力也递增，所以 freq 也应递增
      for (let i = 1; i < notes.length; i++) {
        expect(notes[i].freq).toBeGreaterThanOrEqual(notes[i - 1].freq);
      }
    });

    it('三种断裂样本生成的音符序列分布不同', () => {
      // 每个样本应力场被独立归一化到 [0,1]，所以 freq 范围相同 (110-440 Hz)
      // 但因应力分布形态不同，频率序列（按 r 排序）不同
      const n1 = generateFractureMusic(FRACTURE_SAMPLES.brittle).map((n) => n.freq);
      const n2 = generateFractureMusic(FRACTURE_SAMPLES.ductile).map((n) => n.freq);
      const n3 = generateFractureMusic(FRACTURE_SAMPLES.fatigue).map((n) => n.freq);
      // 序列应彼此不同
      expect(JSON.stringify(n1)).not.toBe(JSON.stringify(n2));
      expect(JSON.stringify(n1)).not.toBe(JSON.stringify(n3));
      expect(JSON.stringify(n2)).not.toBe(JSON.stringify(n3));
      // 但频率都在 [110, 440] 范围内（A2 跨两个八度到 A4）
      [...n1, ...n2, ...n3].forEach((f) => {
        expect(f).toBeGreaterThanOrEqual(110);
        expect(f).toBeLessThanOrEqual(440);
      });
    });

    it('边界：所有应力相等时（span=0）不抛错', () => {
      const sample: FractureSample = {
        name: '等应力',
        crackTip: { x: 0.5, y: 0.5 },
        stressField: Array.from({ length: 12 }, () => ({
          r: 0.1,
          theta: 0,
          sigma_vm: 100,
        })),
        youngsModulus: 100,
        fractureToughness: 10,
      };
      expect(() => generateFractureMusic(sample)).not.toThrow();
      const notes = generateFractureMusic(sample);
      expect(notes.length).toBe(12);
      // 所有 freq 应相等
      notes.forEach((n) => expect(n.freq).toBeCloseTo(notes[0].freq, 5));
    });

    it('边界：单点应力场不抛错', () => {
      const sample: FractureSample = {
        name: '单点',
        crackTip: { x: 0.5, y: 0.5 },
        stressField: [{ r: 0.1, theta: 0, sigma_vm: 100 }],
        youngsModulus: 100,
        fractureToughness: 10,
      };
      const notes = generateFractureMusic(sample);
      expect(notes.length).toBe(1);
    });

    it('边界：空应力场返回空数组', () => {
      const sample: FractureSample = {
        name: '空',
        crackTip: { x: 0.5, y: 0.5 },
        stressField: [],
        youngsModulus: 100,
        fractureToughness: 10,
      };
      const notes = generateFractureMusic(sample);
      expect(notes.length).toBe(0);
    });

    it('边界：超大应力场仍正常返回', () => {
      const sample: FractureSample = {
        name: '超大',
        crackTip: { x: 0.5, y: 0.5 },
        stressField: Array.from({ length: 1000 }, (_, i) => ({
          r: 0.001 * (i + 1),
          theta: i * 0.1,
          sigma_vm: 100 + i,
        })),
        youngsModulus: 100,
        fractureToughness: 10,
      };
      const notes = generateFractureMusic(sample);
      expect(notes.length).toBe(1000);
    });
  });

  describe('renderFractureViz', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('渲染 SVG 含 12 个圆点 + 1 个尖端白点', () => {
      const container = document.createElement('div');
      renderFractureViz(FRACTURE_SAMPLES.brittle, container);
      expect(container.innerHTML).toContain('<svg');
      // 12 个 stressField 圆点 + 1 个 crackTip 白点
      const circles = container.innerHTML.match(/<circle/g);
      expect(circles).not.toBeNull();
      expect(circles!.length).toBe(13);
    });

    it('SVG 包含名称与 K_IC/E 元数据', () => {
      const container = document.createElement('div');
      renderFractureViz(FRACTURE_SAMPLES.brittle, container);
      expect(container.innerHTML).toContain('脆性断裂');
      expect(container.innerHTML).toContain('K_IC=');
      expect(container.innerHTML).toContain('E=');
      expect(container.innerHTML).toContain('GPa');
    });

    it('包含背景矩形与裂纹线', () => {
      const container = document.createElement('div');
      renderFractureViz(FRACTURE_SAMPLES.ductile, container);
      expect(container.innerHTML).toContain('<rect');
      expect(container.innerHTML).toContain('<line');
    });

    it('边界：空应力场不抛错', () => {
      const container = document.createElement('div');
      const empty: FractureSample = {
        name: '空',
        crackTip: { x: 0.5, y: 0.5 },
        stressField: [],
        youngsModulus: 100,
        fractureToughness: 10,
      };
      expect(() => renderFractureViz(empty, container)).not.toThrow();
      // 仍应有 svg + crackTip 白点（1 个 circle）
      const circles = container.innerHTML.match(/<circle/g);
      expect(circles!.length).toBe(1);
    });

    it('边界：所有应力相等（span=0）不抛错', () => {
      const container = document.createElement('div');
      const equal: FractureSample = {
        name: '等应力',
        crackTip: { x: 0.5, y: 0.5 },
        stressField: Array.from({ length: 5 }, () => ({
          r: 0.1,
          theta: 0,
          sigma_vm: 100,
        })),
        youngsModulus: 100,
        fractureToughness: 10,
      };
      expect(() => renderFractureViz(equal, container)).not.toThrow();
    });
  });

  describe('generateFlameMusic', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('返回 12 个音符', () => {
      const notes = generateFlameMusic(FLAME_SAMPLES.laminar);
      expect(notes.length).toBe(12);
    });

    it('每个音符字段合法且类型为 triangle', () => {
      const notes = generateFlameMusic(FLAME_SAMPLES.turbulent);
      notes.forEach((n: MaterioNote) => {
        expect(n.freq).toBeGreaterThan(0);
        expect(n.velocity).toBeGreaterThan(0);
        expect(n.velocity).toBeLessThanOrEqual(1);
        expect(n.dur).toBeGreaterThan(0);
        expect(n.type).toBe('triangle');
      });
    });

    it('层流火焰涡量小，应无装饰音', () => {
      const notes = generateFlameMusic(FLAME_SAMPLES.laminar);
      const hasOrnament = notes.some((n) => n.ornament === true);
      expect(hasOrnament).toBe(false);
    });

    it('湍流/爆轰火焰涡量大，应有装饰音', () => {
      const turbulent = generateFlameMusic(FLAME_SAMPLES.turbulent);
      const detonation = generateFlameMusic(FLAME_SAMPLES.detonation);
      expect(turbulent.some((n) => n.ornament === true)).toBe(true);
      expect(detonation.some((n) => n.ornament === true)).toBe(true);
    });

    it('边界：所有温度相等（span=0）不抛错', () => {
      const sample: FlameSample = {
        name: '等温',
        temperature: 1500,
        velocity: 1,
        flickerFreq: 10,
        cells: Array.from({ length: 12 }, (_, i) => ({
          x: 0.5,
          y: i * 0.08,
          temp: 1500,
          vorticity: 0.05,
        })),
        reynolds: 100,
      };
      expect(() => generateFlameMusic(sample)).not.toThrow();
      const notes = generateFlameMusic(sample);
      notes.forEach((n) => expect(n.freq).toBeCloseTo(notes[0].freq, 5));
    });

    it('边界：单 cell 不抛错', () => {
      const sample: FlameSample = {
        name: '单cell',
        temperature: 1500,
        velocity: 1,
        flickerFreq: 10,
        cells: [{ x: 0.5, y: 0.5, temp: 1500, vorticity: 0.1 }],
        reynolds: 100,
      };
      const notes = generateFlameMusic(sample);
      expect(notes.length).toBe(1);
    });

    it('边界：空 cells 返回空数组', () => {
      const sample: FlameSample = {
        name: '空',
        temperature: 1500,
        velocity: 1,
        flickerFreq: 10,
        cells: [],
        reynolds: 100,
      };
      const notes = generateFlameMusic(sample);
      expect(notes.length).toBe(0);
    });
  });

  describe('renderFlameViz', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('渲染 SVG 含 12 个圆点（cells）', () => {
      const container = document.createElement('div');
      renderFlameViz(FLAME_SAMPLES.laminar, container);
      expect(container.innerHTML).toContain('<svg');
      const circles = container.innerHTML.match(/<circle/g);
      expect(circles).not.toBeNull();
      expect(circles!.length).toBe(12);
    });

    it('SVG 包含名称与温度/Reynolds 元数据', () => {
      const container = document.createElement('div');
      renderFlameViz(FLAME_SAMPLES.detonation, container);
      expect(container.innerHTML).toContain('爆轰');
      expect(container.innerHTML).toContain('T=');
      expect(container.innerHTML).toContain('Re=');
      expect(container.innerHTML).toContain('K');
    });

    it('包含背景矩形', () => {
      const container = document.createElement('div');
      renderFlameViz(FLAME_SAMPLES.turbulent, container);
      expect(container.innerHTML).toContain('<rect');
    });

    it('边界：空 cells 不抛错', () => {
      const container = document.createElement('div');
      const empty: FlameSample = {
        name: '空',
        temperature: 1500,
        velocity: 1,
        flickerFreq: 10,
        cells: [],
        reynolds: 100,
      };
      // Math.max(...) 对空数组返回 -Infinity，会被 norm 计算成 NaN
      // 这里仅验证不抛错（已有 try/catch 之外的逻辑可能产生 NaN 字符串）
      expect(() => renderFlameViz(empty, container)).not.toThrow();
    });

    it('边界：极端温度（< 700K）不抛错', () => {
      const container = document.createElement('div');
      const cold: FlameSample = {
        name: '冷焰',
        temperature: 600,
        velocity: 0.1,
        flickerFreq: 5,
        cells: Array.from({ length: 12 }, (_, i) => ({
          x: 0.5,
          y: i * 0.08,
          temp: 600 + i * 5,
          vorticity: 0.05,
        })),
        reynolds: 50,
      };
      expect(() => renderFlameViz(cold, container)).not.toThrow();
    });
  });

  describe('Fracture Mode UI 状态管理', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      document.body.innerHTML =
        '<div id="fractureScreen"></div>' +
        '<div id="fractureViz"></div>' +
        '<div id="fractureInfo"></div>';
    });

    it('openFractureMode 添加 active 类并加载 brittle 样本', () => {
      openFractureMode();
      const screen = document.getElementById('fractureScreen')!;
      expect(screen.classList.contains('active')).toBe(true);
      // fractureInfo 应被填充
      const info = document.getElementById('fractureInfo')!;
      expect(info.innerHTML).toContain('脆性断裂');
      expect(info.innerHTML).toContain('GPa');
    });

    it('closeFractureMode 移除 active 类', () => {
      openFractureMode();
      closeFractureMode();
      const screen = document.getElementById('fractureScreen')!;
      expect(screen.classList.contains('active')).toBe(false);
    });

    it('loadFractureSample 切换到 ductile 更新 info', () => {
      loadFractureSample('ductile');
      const info = document.getElementById('fractureInfo')!;
      expect(info.innerHTML).toContain('韧性断裂');
      expect(info.innerHTML).toContain('210'); // youngsModulus
      expect(info.innerHTML).toContain('50'); // fractureToughness
    });

    it('loadFractureSample 切换到 fatigue 更新 info', () => {
      loadFractureSample('fatigue');
      const info = document.getElementById('fractureInfo')!;
      expect(info.innerHTML).toContain('疲劳断裂');
    });

    it('loadFractureSample 无效 key 回退到 brittle', () => {
      loadFractureSample('nonexistent-key');
      const info = document.getElementById('fractureInfo')!;
      expect(info.innerHTML).toContain('脆性断裂');
    });

    it('loadFractureSample 渲染 fractureViz', () => {
      loadFractureSample('ductile');
      const viz = document.getElementById('fractureViz')!;
      expect(viz.innerHTML).toContain('<svg');
      expect(viz.innerHTML).toContain('韧性断裂');
    });

    it('openFractureMode 在无 DOM 元素时不抛错', () => {
      document.body.innerHTML = '';
      expect(() => openFractureMode()).not.toThrow();
    });

    it('closeFractureMode 在无 DOM 元素时不抛错', () => {
      document.body.innerHTML = '';
      expect(() => closeFractureMode()).not.toThrow();
    });

    it('loadFractureSample 在无 DOM 元素时不抛错', () => {
      document.body.innerHTML = '';
      expect(() => loadFractureSample('ductile')).not.toThrow();
    });
  });

  describe('Flame Mode UI 状态管理', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      document.body.innerHTML =
        '<div id="flameScreen"></div>' + '<div id="flameViz"></div>' + '<div id="flameInfo"></div>';
    });

    it('openFlameMode 添加 active 类并加载 laminar 样本', () => {
      openFlameMode();
      const screen = document.getElementById('flameScreen')!;
      expect(screen.classList.contains('active')).toBe(true);
      const info = document.getElementById('flameInfo')!;
      expect(info.innerHTML).toContain('层流火焰');
      expect(info.innerHTML).toContain('K');
    });

    it('closeFlameMode 移除 active 类', () => {
      openFlameMode();
      closeFlameMode();
      const screen = document.getElementById('flameScreen')!;
      expect(screen.classList.contains('active')).toBe(false);
    });

    it('loadFlameSample 切换到 turbulent 更新 info', () => {
      loadFlameSample('turbulent');
      const info = document.getElementById('flameInfo')!;
      expect(info.innerHTML).toContain('湍流火焰');
      expect(info.innerHTML).toContain('2100');
      // info 用 "Re: "（viz 才用 "Re="）
      expect(info.innerHTML).toContain('Re:');
      expect(info.innerHTML).toContain('5000');
    });

    it('loadFlameSample 切换到 detonation 更新 info', () => {
      loadFlameSample('detonation');
      const info = document.getElementById('flameInfo')!;
      expect(info.innerHTML).toContain('爆轰');
      expect(info.innerHTML).toContain('3000');
      expect(info.innerHTML).toContain('1000000');
    });

    it('loadFlameSample 无效 key 回退到 laminar', () => {
      loadFlameSample('nonexistent-key');
      const info = document.getElementById('flameInfo')!;
      expect(info.innerHTML).toContain('层流火焰');
    });

    it('loadFlameSample 渲染 flameViz SVG', () => {
      loadFlameSample('turbulent');
      const viz = document.getElementById('flameViz')!;
      expect(viz.innerHTML).toContain('<svg');
      expect(viz.innerHTML).toContain('湍流火焰');
    });

    it('openFlameMode 在无 DOM 元素时不抛错', () => {
      document.body.innerHTML = '';
      expect(() => openFlameMode()).not.toThrow();
    });

    it('closeFlameMode 在无 DOM 元素时不抛错', () => {
      document.body.innerHTML = '';
      expect(() => closeFlameMode()).not.toThrow();
    });

    it('loadFlameSample 在无 DOM 元素时不抛错', () => {
      document.body.innerHTML = '';
      expect(() => loadFlameSample('turbulent')).not.toThrow();
    });
  });

  describe('_deepSelfCheck 自检', () => {
    it('返回 true（断言都通过）', () => {
      const result = _deepSelfCheck();
      expect(result).toBe(true);
    });

    it('不影响后续调用 generateFractureMusic', () => {
      _deepSelfCheck();
      const notes = generateFractureMusic(FRACTURE_SAMPLES.brittle);
      expect(notes.length).toBe(12);
    });
  });
});
