import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================
// Mock 外部依赖
// ============================================================
vi.mock('./audio', () => ({
  getAudioCtx: vi.fn(() => ({
    currentTime: 0,
    destination: {},
    createGain: vi.fn(() => ({
      gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
  })),
  scheduleToneAt: vi.fn(),
  getSharedTransport: vi.fn(() => ({
    subscribe: vi.fn(() => vi.fn()),
    start: vi.fn(),
    stop: vi.fn(),
    setBpm: vi.fn(),
    setStepsPerBeat: vi.fn(),
  })),
  stopSharedTransport: vi.fn(),
}));

vi.mock('./game-engine', () => ({
  stopAllPlayback: vi.fn(),
}));

vi.mock('./events', () => ({
  registerActions: vi.fn(),
}));

import {
  ALL_SCALES,
  TOP_SCALES,
  scaleLabState,
  scaleToMidi,
  midiToFreq,
  playScale,
  startScaleLoop,
  stopScaleLoop,
  toggleScaleLoop,
  renderScaleLabList,
  renderHallPetchScatter,
  renderScaleLabInfo,
  openScaleLab,
  closeScaleLab,
  PROTEIN_SAMPLES,
  proteinState,
  proteinToMusic,
  musicToProtein,
  loadProteinSample,
  startProteinPlay,
  stopProteinPlay,
  toggleProteinPlay,
  renderProteinInfo,
  reverseMapTest,
  openProteinMode,
  closeProteinMode,
  WEB_SAMPLES,
  webState,
  startWebPlay,
  stopWebPlay,
  toggleWebPlay,
  renderWebViz,
  loadWebSample,
  openWebMode,
  closeWebMode,
  initMateriomusicEvents,
} from './materiomusic';
import { getAudioCtx, scheduleToneAt, getSharedTransport, stopSharedTransport } from './audio';
import { stopAllPlayback } from './game-engine';
import { registerActions } from './events';

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

describe('materiomusic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installCanvasMock();
    document.body.innerHTML = `
      <div id="scaleLabScreen"></div>
      <div id="scaleLabList"></div>
      <div id="scaleLabInfo"></div>
      <canvas id="scaleLabCanvas" width="300" height="200"></canvas>
      <button id="scaleLabPlayBtn">▶ 循环</button>
      <div id="proteinScreen"></div>
      <div id="proteinInfo"></div>
      <div id="proteinReverseResult"></div>
      <button id="proteinPlayBtn">▶ 播放</button>
      <div id="webScreen"></div>
      <div id="webViz"></div>
      <div id="webInfo"></div>
      <button id="webPlayBtn">▶ 播放</button>
    `;
    // 重置三个状态对象到默认值
    scaleLabState.selectedBits = 0b101010110101;
    scaleLabState.playing = false;
    scaleLabState.transport = null;
    scaleLabState.step = 0;
    scaleLabState.filterMinNotes = 5;
    scaleLabState.filterMaxNotes = 8;
    scaleLabState.sortBy = 'hallPetch';

    proteinState.sequence = '';
    proteinState.sampleKey = 'insulin';
    proteinState.playing = false;
    proteinState.transport = null;
    proteinState.step = 0;
    proteinState.notes = [];
    proteinState.reverseMode = false;
    proteinState.reverseInput = [];

    webState.sampleKey = 'orb';
    webState.web = WEB_SAMPLES.orb;
    webState.playing = false;
    webState.transport = null;
    webState.step = 0;
    webState.path = [];
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // ------------------------------------------------------------
  // Part 1: Scale Lab 数据结构与纯函数
  // ------------------------------------------------------------
  describe('Scale Lab 常量与纯函数', () => {
    it('ALL_SCALES 包含 4095 种音阶 (bits 1..4095)', () => {
      expect(ALL_SCALES.length).toBe(4095);
      expect(ALL_SCALES[0].bits).toBe(1);
      expect(ALL_SCALES[ALL_SCALES.length - 1].bits).toBe(4095);
    });

    it('每个 ScaleInfo 字段完整且数值合法', () => {
      for (const s of ALL_SCALES) {
        expect(typeof s.bits).toBe('number');
        expect(Array.isArray(s.intervals)).toBe(true);
        expect(s.noteCount).toBe(s.intervals.length);
        expect(s.entropy).toBeGreaterThanOrEqual(0);
        expect(s.entropy).toBeLessThanOrEqual(1);
        expect(s.defectDensity).toBeGreaterThanOrEqual(0);
        expect(s.defectDensity).toBeLessThanOrEqual(1);
        expect(s.hallPetchScore).toBeGreaterThanOrEqual(0);
        expect(s.hallPetchScore).toBeLessThanOrEqual(1);
      }
    });

    it('大调音阶 (bits 2773) 命中文化名称与正确音程', () => {
      const major = ALL_SCALES.find(s => s.bits === 0b101010110101);
      expect(major).toBeDefined();
      expect(major!.culturalName).toBe('大调 (Major)');
      expect(major!.intervals).toEqual([0, 2, 4, 5, 7, 9, 11]);
      expect(major!.noteCount).toBe(7);
    });

    it('TOP_SCALES 长度为 50 且按 hallPetchScore 降序', () => {
      expect(TOP_SCALES.length).toBe(50);
      for (let i = 1; i < TOP_SCALES.length; i++) {
        expect(TOP_SCALES[i - 1].hallPetchScore).toBeGreaterThanOrEqual(TOP_SCALES[i].hallPetchScore);
      }
    });

    it('scaleToMidi 返回从 C4=60 开始的 MIDI 数组', () => {
      const major = ALL_SCALES.find(s => s.bits === 0b101010110101)!;
      const midi = scaleToMidi(major, 2);
      expect(midi.length).toBe(14);
      expect(midi[0]).toBe(60);
      expect(midi[7]).toBe(72);
    });

    it('scaleToMidi 默认 octaves=2', () => {
      const sine = ALL_SCALES.find(s => s.bits === 1)!;
      expect(scaleToMidi(sine).length).toBe(2);
    });

    it('midiToFreq: A4 (69) -> 440 Hz', () => {
      expect(midiToFreq(69)).toBeCloseTo(440, 1);
    });

    it('midiToFreq: C4 (60) -> ~261.63 Hz', () => {
      expect(midiToFreq(60)).toBeCloseTo(261.63, 1);
    });
  });

  // ------------------------------------------------------------
  // Part 1: Scale Lab 渲染入口
  // ------------------------------------------------------------
  describe('Scale Lab 渲染', () => {
    it('renderScaleLabInfo 写入 #scaleLabInfo 并构建键盘', () => {
      renderScaleLabInfo();
      const el = document.getElementById('scaleLabInfo')!;
      expect(el.innerHTML).toContain('scalelab-info-name');
      expect(el.innerHTML).toContain('scalelab-keyboard');
      expect(el.querySelectorAll('.scalelab-key').length).toBe(12);
    });

    it('renderScaleLabList 写入 #scaleLabList 并包含表头', () => {
      renderScaleLabList();
      const el = document.getElementById('scaleLabList')!;
      expect(el.innerHTML).toContain('scalelab-list-header');
      expect(el.querySelectorAll('.scalelab-row').length).toBeGreaterThan(0);
    });

    it('renderScaleLabList 选中的音阶在列表中带 selected 类', () => {
      // 选一个在 TOP_SCALES 中且音符数在 5-8 之间的音阶（确保它在 top 100 内）
      const candidate = TOP_SCALES.find(s => s.noteCount >= 5 && s.noteCount <= 8);
      expect(candidate).toBeDefined();
      scaleLabState.selectedBits = candidate!.bits;
      renderScaleLabList();
      const selected = document.querySelector('.scalelab-row.selected');
      expect(selected).not.toBeNull();
    });

    it('renderScaleLabList 按 sortBy=entropy 排序不抛错', () => {
      scaleLabState.sortBy = 'entropy';
      expect(() => renderScaleLabList()).not.toThrow();
    });

    it('renderScaleLabList 按 sortBy=defect 排序不抛错', () => {
      scaleLabState.sortBy = 'defect';
      expect(() => renderScaleLabList()).not.toThrow();
    });

    it('renderScaleLabList 按 sortBy=notes 排序不抛错', () => {
      scaleLabState.sortBy = 'notes';
      expect(() => renderScaleLabList()).not.toThrow();
    });

    it('renderHallPetchScatter 不抛错并写入 canvas', () => {
      expect(() => renderHallPetchScatter()).not.toThrow();
    });

    it('renderScaleLabInfo 缺少 DOM 元素时不抛错', () => {
      document.body.innerHTML = '';
      expect(() => renderScaleLabInfo()).not.toThrow();
    });

    it('renderScaleLabList 缺少 DOM 元素时不抛错', () => {
      document.body.innerHTML = '';
      expect(() => renderScaleLabList()).not.toThrow();
    });

    it('renderHallPetchScatter 缺少 canvas 时不抛错', () => {
      document.body.innerHTML = '';
      expect(() => renderHallPetchScatter()).not.toThrow();
    });
  });

  // ------------------------------------------------------------
  // Part 1: Scale Lab 播放控制
  // ------------------------------------------------------------
  describe('Scale Lab 播放控制', () => {
    it('playScale 调用 scheduleToneAt 多次并更新 selectedBits', () => {
      const bits = 0b101010110101; // 大调
      playScale(bits);
      expect(scaleLabState.selectedBits).toBe(bits);
      expect(scheduleToneAt).toHaveBeenCalled();
      // 大调 octaves=2 -> 14 个音符
      expect(vi.mocked(scheduleToneAt).mock.calls.length).toBe(14);
    });

    it('playScale 首音频率对应 C4 (~261.63 Hz)', () => {
      playScale(0b101010110101);
      const firstCall = vi.mocked(scheduleToneAt).mock.calls[0];
      expect(firstCall[0]).toBeCloseTo(261.63, 1);
      expect(firstCall[1]).toBe(0.4);
      expect(firstCall[2]).toBe('triangle');
    });

    it('playScale 无效 bits 直接返回不抛错', () => {
      expect(() => playScale(99999)).not.toThrow();
    });

    it('startScaleLoop 启动 transport 并更新按钮文本', () => {
      startScaleLoop();
      expect(scaleLabState.playing).toBe(true);
      expect(getSharedTransport).toHaveBeenCalled();
      const btn = document.getElementById('scaleLabPlayBtn')!;
      expect(btn.textContent).toContain('停止');
    });

    it('startScaleLoop 重复调用不重复启动', () => {
      startScaleLoop();
      startScaleLoop();
      expect(vi.mocked(getSharedTransport).mock.calls.length).toBe(1);
    });

    it('stopScaleLoop 重置状态并更新按钮', () => {
      startScaleLoop();
      stopScaleLoop();
      expect(scaleLabState.playing).toBe(false);
      expect(scaleLabState.transport).toBeNull();
      expect(stopSharedTransport).toHaveBeenCalled();
      const btn = document.getElementById('scaleLabPlayBtn')!;
      expect(btn.textContent).toContain('循环');
    });

    it('toggleScaleLoop 在停止状态启动', () => {
      expect(scaleLabState.playing).toBe(false);
      toggleScaleLoop();
      expect(scaleLabState.playing).toBe(true);
    });

    it('toggleScaleLoop 在播放状态停止', () => {
      startScaleLoop();
      toggleScaleLoop();
      expect(scaleLabState.playing).toBe(false);
    });

    it('openScaleLab 调用 stopAllPlayback 并添加 active 类', () => {
      openScaleLab();
      expect(stopAllPlayback).toHaveBeenCalled();
      const screen = document.getElementById('scaleLabScreen')!;
      expect(screen.classList.contains('active')).toBe(true);
    });

    it('closeScaleLab 调用 stopScaleLoop 并移除 active 类', () => {
      openScaleLab();
      closeScaleLab();
      const screen = document.getElementById('scaleLabScreen')!;
      expect(screen.classList.contains('active')).toBe(false);
    });
  });

  // ------------------------------------------------------------
  // Part 2: Protein 数据结构与纯函数
  // ------------------------------------------------------------
  describe('Protein Sonification 常量与纯函数', () => {
    it('PROTEIN_SAMPLES 包含 4 个真实样本', () => {
      const keys = Object.keys(PROTEIN_SAMPLES);
      expect(keys).toEqual(expect.arrayContaining(['insulin', 'gfp', 'lysozyme', 'silk']));
      expect(keys.length).toBe(4);
    });

    it('每个样本包含 name/sequence/organism/description', () => {
      for (const k of Object.keys(PROTEIN_SAMPLES)) {
        const s = PROTEIN_SAMPLES[k];
        expect(typeof s.name).toBe('string');
        expect(typeof s.sequence).toBe('string');
        expect(s.sequence.length).toBeGreaterThan(0);
        expect(typeof s.organism).toBe('string');
        expect(typeof s.description).toBe('string');
      }
    });

    it('proteinToMusic 将序列转为音符数组', () => {
      const notes = proteinToMusic('ACDEFGHIKLMNPQRSTVWY');
      expect(notes.length).toBe(20);
      for (const n of notes) {
        expect(typeof n.midi).toBe('number');
        expect(n.midi).toBeGreaterThanOrEqual(36);
        expect(n.midi).toBeLessThanOrEqual(84);
        expect(typeof n.velocity).toBe('number');
        expect(n.velocity).toBeGreaterThan(0);
        expect(n.velocity).toBeLessThanOrEqual(1);
        expect(typeof n.aa).toBe('string');
      }
    });

    it('proteinToMusic 跳过非氨基酸字符', () => {
      // X 不是标准氨基酸（不在 AMINO_ACID_FREQ 中），1/!/Z 也不是
      // 输入 'A1CX!Z' 只包含 2 个合法氨基酸: A, C
      const notes = proteinToMusic('A1CX!Z');
      expect(notes.length).toBe(2);
      expect(notes.map(n => n.aa).join('')).toBe('AC');
    });

    it('proteinToMusic 大小写不敏感', () => {
      const upper = proteinToMusic('AC');
      const lower = proteinToMusic('ac');
      expect(upper).toEqual(lower);
    });

    it('proteinToMusic 空序列返回空数组', () => {
      expect(proteinToMusic('')).toEqual([]);
    });

    it('musicToProtein 返回由合法氨基酸组成的字符串', () => {
      // 标准氨基酸集合（含 E=Glutamate）：ARDNCQEGHIKLMFPSTWYV
      const valid = new Set('ARDNCQEGHIKLMFPSTWYV');
      const seq = musicToProtein([60, 62, 64, 65, 67, 69, 71, 72]);
      expect(seq.length).toBe(8);
      for (const c of seq) expect(valid.has(c)).toBe(true);
    });

    it('musicToProtein 单个 MIDI 返回单个氨基酸', () => {
      const seq = musicToProtein([60]);
      expect(seq.length).toBe(1);
    });

    it('musicToProtein 空输入返回空字符串', () => {
      expect(musicToProtein([])).toBe('');
    });
  });

  // ------------------------------------------------------------
  // Part 2: Protein 状态与渲染
  // ------------------------------------------------------------
  describe('Protein 状态与渲染', () => {
    it('loadProteinSample 加载胰岛素并填充 proteinState', () => {
      loadProteinSample('insulin');
      expect(proteinState.sampleKey).toBe('insulin');
      expect(proteinState.sequence).toBe(PROTEIN_SAMPLES.insulin.sequence);
      expect(proteinState.notes.length).toBeGreaterThan(0);
    });

    it('loadProteinSample 无效 key 直接返回', () => {
      proteinState.sequence = 'OLD';
      loadProteinSample('nonexistent');
      expect(proteinState.sequence).toBe('OLD');
    });

    it('renderProteinInfo 写入 #proteinInfo 包含序列可视化', () => {
      loadProteinSample('insulin');
      renderProteinInfo();
      const el = document.getElementById('proteinInfo')!;
      expect(el.innerHTML).toContain('protein-name');
      expect(el.innerHTML).toContain('protein-sequence');
      expect(el.innerHTML).toContain('protein-composition');
    });

    it('renderProteinInfo 缺少 DOM 不抛错', () => {
      document.body.innerHTML = '';
      expect(() => renderProteinInfo()).not.toThrow();
    });

    it('reverseMapTest 调用 scheduleToneAt 并写入 #proteinReverseResult', () => {
      reverseMapTest([60, 62, 64, 65, 67]);
      expect(scheduleToneAt).toHaveBeenCalled();
      const el = document.getElementById('proteinReverseResult')!;
      expect(el.innerHTML).toContain('protein-reverse');
    });

    it('startProteinPlay 无音符时不启动', () => {
      proteinState.notes = [];
      startProteinPlay();
      expect(proteinState.playing).toBe(false);
      expect(getSharedTransport).not.toHaveBeenCalled();
    });

    it('startProteinPlay 加载样本后启动 transport', () => {
      loadProteinSample('insulin');
      startProteinPlay();
      expect(proteinState.playing).toBe(true);
      expect(getSharedTransport).toHaveBeenCalled();
      const btn = document.getElementById('proteinPlayBtn')!;
      expect(btn.textContent).toContain('停止');
    });

    it('startProteinPlay 重复调用不重复启动', () => {
      loadProteinSample('insulin');
      startProteinPlay();
      startProteinPlay();
      expect(vi.mocked(getSharedTransport).mock.calls.length).toBe(1);
    });

    it('stopProteinPlay 重置状态并更新按钮', () => {
      loadProteinSample('insulin');
      startProteinPlay();
      stopProteinPlay();
      expect(proteinState.playing).toBe(false);
      expect(stopSharedTransport).toHaveBeenCalled();
      const btn = document.getElementById('proteinPlayBtn')!;
      expect(btn.textContent).toContain('播放');
    });

    it('toggleProteinPlay 在停止状态启动', () => {
      loadProteinSample('insulin');
      toggleProteinPlay();
      expect(proteinState.playing).toBe(true);
    });

    it('toggleProteinPlay 在播放状态停止', () => {
      loadProteinSample('insulin');
      startProteinPlay();
      toggleProteinPlay();
      expect(proteinState.playing).toBe(false);
    });

    it('openProteinMode 调用 stopAllPlayback 并添加 active 类', () => {
      openProteinMode();
      expect(stopAllPlayback).toHaveBeenCalled();
      const screen = document.getElementById('proteinScreen')!;
      expect(screen.classList.contains('active')).toBe(true);
    });

    it('closeProteinMode 调用 stopProteinPlay 并移除 active 类', () => {
      openProteinMode();
      closeProteinMode();
      const screen = document.getElementById('proteinScreen')!;
      expect(screen.classList.contains('active')).toBe(false);
    });
  });

  // ------------------------------------------------------------
  // Part 3: Spider Web 数据结构与播放
  // ------------------------------------------------------------
  describe('Spider Web 数据结构与播放', () => {
    it('WEB_SAMPLES 包含 orb/tangled/sheet 三个样本', () => {
      const keys = Object.keys(WEB_SAMPLES);
      expect(keys).toEqual(expect.arrayContaining(['orb', 'tangled', 'sheet']));
      expect(keys.length).toBe(3);
    });

    it('每个 web 样本包含 nodes/edges/name', () => {
      for (const k of Object.keys(WEB_SAMPLES)) {
        const w = WEB_SAMPLES[k];
        expect(Array.isArray(w.nodes)).toBe(true);
        expect(w.nodes.length).toBeGreaterThan(0);
        expect(Array.isArray(w.edges)).toBe(true);
        expect(typeof w.name).toBe('string');
      }
    });

    it('renderWebViz 写入 #webViz 包含 SVG', () => {
      renderWebViz();
      const el = document.getElementById('webViz')!;
      expect(el.innerHTML).toContain('<svg');
      expect(el.innerHTML).toContain('web-node');
    });

    it('renderWebViz 同时写入 #webInfo 统计', () => {
      renderWebViz();
      const info = document.getElementById('webInfo')!;
      expect(info.innerHTML).toContain('web-stats');
      expect(info.innerHTML).toContain('节点');
      expect(info.innerHTML).toContain('边');
    });

    it('renderWebViz 缺少 DOM 不抛错', () => {
      document.body.innerHTML = '';
      expect(() => renderWebViz()).not.toThrow();
    });

    it('loadWebSample 切换 webState.web', () => {
      loadWebSample('tangled');
      expect(webState.sampleKey).toBe('tangled');
      expect(webState.web).toBe(WEB_SAMPLES.tangled);
    });

    it('loadWebSample 无效 key 直接返回', () => {
      const before = webState.web;
      loadWebSample('nonexistent');
      expect(webState.web).toBe(before);
    });

    it('startWebPlay 启动 transport 并计算 path', () => {
      startWebPlay();
      expect(webState.playing).toBe(true);
      expect(webState.path.length).toBeGreaterThan(0);
      expect(getSharedTransport).toHaveBeenCalled();
      const btn = document.getElementById('webPlayBtn')!;
      expect(btn.textContent).toContain('停止');
    });

    it('startWebPlay 重复调用不重复启动', () => {
      startWebPlay();
      startWebPlay();
      expect(vi.mocked(getSharedTransport).mock.calls.length).toBe(1);
    });

    it('stopWebPlay 重置状态并更新按钮', () => {
      startWebPlay();
      stopWebPlay();
      expect(webState.playing).toBe(false);
      expect(webState.transport).toBeNull();
      expect(stopSharedTransport).toHaveBeenCalled();
      const btn = document.getElementById('webPlayBtn')!;
      expect(btn.textContent).toContain('播放');
    });

    it('toggleWebPlay 在停止状态启动', () => {
      expect(webState.playing).toBe(false);
      toggleWebPlay();
      expect(webState.playing).toBe(true);
    });

    it('toggleWebPlay 在播放状态停止', () => {
      startWebPlay();
      toggleWebPlay();
      expect(webState.playing).toBe(false);
    });

    it('openWebMode 调用 stopAllPlayback 并添加 active 类', () => {
      openWebMode();
      expect(stopAllPlayback).toHaveBeenCalled();
      const screen = document.getElementById('webScreen')!;
      expect(screen.classList.contains('active')).toBe(true);
    });

    it('closeWebMode 调用 stopWebPlay 并移除 active 类', () => {
      openWebMode();
      closeWebMode();
      const screen = document.getElementById('webScreen')!;
      expect(screen.classList.contains('active')).toBe(false);
    });
  });

  // ------------------------------------------------------------
  // 事件注册
  // ------------------------------------------------------------
  describe('initMateriomusicEvents', () => {
    it('调用 registerActions 注册一批 action', () => {
      initMateriomusicEvents();
      expect(registerActions).toHaveBeenCalled();
      const arg = vi.mocked(registerActions).mock.calls[0][0] as Record<string, unknown>;
      expect(arg.playScale).toBeDefined();
      expect(arg.toggleScaleLoop).toBeDefined();
      expect(arg.closeScaleLab).toBeDefined();
      expect(arg.setScaleFilter).toBeDefined();
      expect(arg.toggleProteinPlay).toBeDefined();
      expect(arg.closeProteinMode).toBeDefined();
      expect(arg.loadProteinSample).toBeDefined();
      expect(arg.reverseMapTest).toBeDefined();
      expect(arg.toggleWebPlay).toBeDefined();
      expect(arg.closeWebMode).toBeDefined();
      expect(arg.loadWebSample).toBeDefined();
    });

    it('注册的 playScale handler 调用底层 playScale', () => {
      initMateriomusicEvents();
      const arg = vi.mocked(registerActions).mock.calls[0][0] as Record<string, (a: any) => void>;
      vi.mocked(scheduleToneAt).mockClear();
      arg.playScale({ bits: 0b101010110101 });
      expect(scheduleToneAt).toHaveBeenCalled();
    });

    it('注册的 setScaleFilter handler 更新 filterMinNotes', () => {
      initMateriomusicEvents();
      const arg = vi.mocked(registerActions).mock.calls[0][0] as Record<string, (a: any) => void>;
      arg.setScaleFilter({ min: 3, max: 9, sortBy: 'entropy' });
      expect(scaleLabState.filterMinNotes).toBe(3);
      expect(scaleLabState.filterMaxNotes).toBe(9);
      expect(scaleLabState.sortBy).toBe('entropy');
    });

    it('注册的 loadProteinSample handler 加载样本', () => {
      initMateriomusicEvents();
      const arg = vi.mocked(registerActions).mock.calls[0][0] as Record<string, (a: any) => void>;
      arg.loadProteinSample({ key: 'gfp' });
      expect(proteinState.sampleKey).toBe('gfp');
      expect(proteinState.sequence).toBe(PROTEIN_SAMPLES.gfp.sequence);
    });

    it('注册的 loadWebSample handler 切换 web 样本', () => {
      initMateriomusicEvents();
      const arg = vi.mocked(registerActions).mock.calls[0][0] as Record<string, (a: any) => void>;
      arg.loadWebSample({ key: 'sheet' });
      expect(webState.sampleKey).toBe('sheet');
      expect(webState.web).toBe(WEB_SAMPLES.sheet);
    });

    it('注册的 reverseMapTest handler 默认参数不抛错', () => {
      initMateriomusicEvents();
      const arg = vi.mocked(registerActions).mock.calls[0][0] as Record<string, (a: any) => void>;
      expect(() => arg.reverseMapTest({})).not.toThrow();
    });
  });
});
