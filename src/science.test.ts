import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ===== mocks for side-effecting dependencies =====
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
  scheduleKickAt: vi.fn(),
  scheduleSnareAt: vi.fn(),
  playCorrect: vi.fn(),
}));

vi.mock('./synth', () => ({}));

vi.mock('./game-engine', () => ({
  stopAllPlayback: vi.fn(),
  checkAchievements: vi.fn(),
  isFreeModeUnlocked: vi.fn(() => false),
}));

vi.mock('./events', () => ({
  registerActions: vi.fn(),
  registerInputs: vi.fn(),
}));

vi.mock('./ui-feedback', () => ({
  showToast: vi.fn(),
}));

vi.mock('./i18n', () => ({
  t: vi.fn((key: string) => key),
}));

vi.mock('./storage', () => ({
  localSet: vi.fn(),
}));

// Mock exportScience as a spy so we can assert it was called from science.ts.
// Keep patternToMidi / patternToCSV / patternToJSON as no-op stubs since
// science.ts also imports them (re-exported) — they aren't used in tests.
vi.mock('./science/export', () => ({
  exportScience: vi.fn(),
  patternToMidi: vi.fn(() => new Uint8Array()),
  patternToCSV: vi.fn(() => ''),
  patternToJSON: vi.fn(() => ''),
}));

// We let the real ./science-deep run because its static structures feed the
// scienceState initialization (mapping/options default values). Only its
// side-effectful imports (audio/game-engine/events) are mocked above.
// We also keep ./science/parser, ./science/signal real so we exercise the
// actual delegation paths from science.ts.

import {
  SCIENCE_SAMPLES,
  SCIENCE_REAL_SAMPLES,
  SCIENCE_SCHEMA,
  SCIENCE_TYPE_NAMES,
  SCIENCE_MAPPINGS,
  SCIENCE_OPTIONS,
  scienceState,
  avg,
  validateScienceData,
  normalizeScienceData,
  scienceSampleCount,
  parseScienceCSV,
  parseScienceText,
  parseScienceTextComplete,
  selectScienceType,
  loadScienceSample,
  showScienceUploadStatus,
  goScienceStep,
  updateScienceTypeUI,
  renderScienceData,
  renderScienceCompose,
  renderScienceStats,
  renderScienceMappings,
  renderScienceKnobs,
  renderSciencePianoRoll,
  renderScienceVisualizer,
  renderScienceCompositionList,
  drawScienceDataCanvas,
  drawScienceComposeCanvas,
  updateScienceOption,
  updateScienceVisualizer,
  toggleScienceMapping,
  toggleScienceWhyPanel,
  toggleSciencePlay,
  startSciencePlay,
  stopSciencePlay,
  regenerateScienceMusic,
  animateScienceParticles,
  saveScienceComposition,
  loadScienceComposition,
  deleteScienceComposition,
  openComposerWithScience,
  shareScience,
  downloadScienceExport,
  openScienceMode,
  handleScienceFile,
} from './science';
import { Store, DEFAULT_STATE } from './store';
import * as audioMod from './audio';
import * as storageMod from './storage';
import { exportScience } from './science/export';

// Helper: build a complete DOM scaffold so render* and getElementById don't
// no-op silently. Each test can append the elements it actually needs.
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
    setTransform: vi.fn(),
    globalAlpha: 1,
  })) as any;
}

function setupDOM(opts: { withCanvases?: boolean; withLists?: boolean } = {}) {
  installCanvasMock();
  document.body.innerHTML = '';
  const ids = [
    'scienceScreen',
    'scienceStep-mode',
    'scienceStep-data',
    'scienceStep-compose',
    'scienceTypeName',
    'scienceSchemaHelp',
    'scienceDataInfo',
    'scienceDataName',
    'scienceStats',
    'scienceUploadStatus',
    'scienceMappingList',
    'scienceKnobs',
    'sciencePianoRoll',
    'scienceVisualizer',
    'scienceParticles',
    'scienceWhyPanel',
    'scienceCompositionList',
    'sciPlayBtn',
  ];
  for (const id of ids) {
    const el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
  }
  // Always create real canvas elements for canvas-related render functions
  for (const id of ['scienceDataCanvas', 'scienceComposeCanvas']) {
    const old = document.getElementById(id);
    if (old) old.remove();
    const c = document.createElement('canvas');
    c.id = id;
    c.width = 200;
    c.height = 100;
    document.body.appendChild(c);
  }
  // science-type-btn buttons for updateScienceTypeUI
  for (const t of ['dft', 'md', 'fem', 'cfd', 'xrd', 'dna', 'pulsar', 'crystal', 'quantum', 'seismic', 'eeg']) {
    const b = document.createElement('button');
    b.className = 'science-type-btn';
    b.dataset.type = t;
    document.body.appendChild(b);
  }
  // science-section
  for (const s of ['mode', 'data', 'compose']) {
    const el = document.createElement('div');
    el.className = 'science-section';
    el.id = 'scienceStep-' + s;
    document.body.appendChild(el);
  }
  // science-step-tab
  for (const s of ['mode', 'data', 'compose']) {
    const el = document.createElement('div') as HTMLElement;
    el.className = 'science-step-tab';
    el.dataset.step = s;
    document.body.appendChild(el);
  }
}

describe('science.ts - 静态导出常量', () => {
  it('SCIENCE_SAMPLES 包含 7 种类型', () => {
    const keys = Object.keys(SCIENCE_SAMPLES);
    expect(keys.sort()).toEqual(['cfd', 'dft', 'dna', 'fem', 'md', 'pulsar', 'xrd']);
  });

  it('SCIENCE_REAL_SAMPLES 至少包含 dft/md/fem', () => {
    expect(SCIENCE_REAL_SAMPLES.dft).toBeDefined();
    expect(SCIENCE_REAL_SAMPLES.md).toBeDefined();
    expect(SCIENCE_REAL_SAMPLES.fem).toBeDefined();
  });

  it('SCIENCE_SCHEMA / TYPE_NAMES / MAPPINGS / OPTIONS keys 一致', () => {
    const schemaKeys = Object.keys(SCIENCE_SCHEMA).sort();
    const nameKeys = Object.keys(SCIENCE_TYPE_NAMES).sort();
    const mapKeys = Object.keys(SCIENCE_MAPPINGS).sort();
    const optKeys = Object.keys(SCIENCE_OPTIONS).sort();
    expect(schemaKeys).toEqual(nameKeys);
    expect(schemaKeys).toEqual(mapKeys);
    expect(schemaKeys).toEqual(optKeys);
  });

  it('每种类型的 OPTIONS 中 def 落在 [min, max] 范围内', () => {
    for (const type of Object.keys(SCIENCE_OPTIONS)) {
      for (const o of SCIENCE_OPTIONS[type as keyof typeof SCIENCE_OPTIONS]) {
        expect(o.def).toBeGreaterThanOrEqual(o.min);
        expect(o.def).toBeLessThanOrEqual(o.max);
      }
    }
  });

  it('每种类型的 MAPPINGS 条目都有 id/title/desc', () => {
    for (const type of Object.keys(SCIENCE_MAPPINGS)) {
      for (const m of SCIENCE_MAPPINGS[type as keyof typeof SCIENCE_MAPPINGS]) {
        expect(m.id).toBeTruthy();
        expect(m.title).toBeTruthy();
        expect(m.desc).toBeTruthy();
      }
    }
  });
});

describe('science.ts - scienceState 初始化', () => {
  it('默认 type 为 dft 且 view 为 mode', () => {
    expect(scienceState.type).toBe('dft');
    expect(scienceState.view).toBe('mode');
  });

  it('mapping/options 对每种类型都已初始化', () => {
    const types = Object.keys({ ...SCIENCE_MAPPINGS });
    for (const t of types) {
      expect(scienceState.mapping[t]).toBeDefined();
      expect(typeof scienceState.mapping[t]).toBe('object');
      expect(scienceState.options[t]).toBeDefined();
      expect(typeof scienceState.options[t]).toBe('object');
    }
  });

  it('mapping 默认仅前 3 条映射被启用', () => {
    for (const t of Object.keys(SCIENCE_MAPPINGS)) {
      const list = SCIENCE_MAPPINGS[t as keyof typeof SCIENCE_MAPPINGS];
      const enabled = list.filter((m) => scienceState.mapping[t][m.id]);
      expect(enabled.length).toBe(Math.min(3, list.length));
    }
  });

  it('options 默认值来自 SCIENCE_OPTIONS 的 def', () => {
    for (const t of Object.keys(SCIENCE_OPTIONS)) {
      for (const o of SCIENCE_OPTIONS[t as keyof typeof SCIENCE_OPTIONS]) {
        expect(scienceState.options[t][o.key]).toBe(o.def);
      }
    }
  });
});

describe('avg - 数组平均', () => {
  it('空数组返回 0', () => {
    expect(avg([])).toBe(0);
    expect(avg(null as any)).toBe(0);
    expect(avg(undefined as any)).toBe(0);
  });

  it('单点数组返回该点', () => {
    expect(avg([42])).toBe(42);
  });

  it('多元素数组返回算术平均', () => {
    expect(avg([1, 2, 3, 4, 5])).toBe(3);
    expect(avg([10, 20])).toBe(15);
  });

  it('负数与零混合正确', () => {
    expect(avg([-1, 0, 1])).toBe(0);
  });
});

describe('scienceSampleCount - 样本计数', () => {
  it('dft 类型返回 kpoints 长度', () => {
    scienceState.type = 'dft';
    scienceState.data = { kpoints: [1, 2, 3] };
    expect(scienceSampleCount({ kpoints: [1, 2, 3] })).toBe(3);
    expect(scienceSampleCount({})).toBe(0);
  });

  it('md 类型返回 frames 长度', () => {
    scienceState.type = 'md';
    expect(scienceSampleCount({ frames: [{}, {}, {}, {}] })).toBe(4);
    expect(scienceSampleCount({})).toBe(0);
  });

  it('fem / cfd / xrd / pulsar 类型返回对应数组长度', () => {
    scienceState.type = 'fem';
    expect(scienceSampleCount({ nodes: [1, 2] })).toBe(2);
    scienceState.type = 'cfd';
    expect(scienceSampleCount({ cells: [1, 2, 3] })).toBe(3);
    scienceState.type = 'xrd';
    expect(scienceSampleCount({ angles: [1, 2, 3, 4] })).toBe(4);
    scienceState.type = 'pulsar';
    expect(scienceSampleCount({ periods: [10, 20] })).toBe(2);
  });

  it('dna 类型返回序列长度', () => {
    scienceState.type = 'dna';
    expect(scienceSampleCount({ sequence: 'ATGCATGC' })).toBe(8);
    expect(scienceSampleCount({})).toBe(0);
  });

  it('未知类型返回 0', () => {
    scienceState.type = 'unknown';
    expect(scienceSampleCount({ whatever: [1, 2] })).toBe(0);
  });
});

describe('validateScienceData - 各类型校验', () => {
  beforeEach(() => {
    // 选择默认类型，再切回测试类型
  });

  it('非对象返回 false', () => {
    scienceState.type = 'dft';
    expect(validateScienceData(null)).toBe(false);
    expect(validateScienceData(undefined)).toBe(false);
    expect(validateScienceData('string')).toBe(false);
    expect(validateScienceData(42)).toBe(false);
  });

  it('dft 要求 kpoints/energies 非空数组', () => {
    scienceState.type = 'dft';
    expect(validateScienceData({ kpoints: [], energies: [] })).toBe(false);
    expect(validateScienceData({ kpoints: [1], energies: [] })).toBe(false);
    expect(validateScienceData({ kpoints: [1, 2], energies: [1, 2] })).toBe(true);
  });

  it('md 要求 frames/distances 数组且 frames 非空', () => {
    scienceState.type = 'md';
    // 源码：Array.isArray(d.frames) && Array.isArray(d.distances) && d.frames.length > 0
    expect(validateScienceData({ frames: [], distances: [] })).toBe(false);
    expect(validateScienceData({ frames: [{}], distances: [] })).toBe(true); // distances 可空
    expect(validateScienceData({ frames: [], distances: [1] })).toBe(false);
    expect(validateScienceData({ frames: [{ x: 1 }], distances: [1] })).toBe(true);
  });

  it('fem 要求 nodes/modes 非空数组', () => {
    scienceState.type = 'fem';
    expect(validateScienceData({ nodes: [], modes: [] })).toBe(false);
    expect(validateScienceData({ nodes: [{}], modes: [220] })).toBe(true);
  });

  it('cfd 要求 cells 非空数组', () => {
    scienceState.type = 'cfd';
    expect(validateScienceData({ cells: [] })).toBe(false);
    expect(validateScienceData({ cells: [{ x: 0 }] })).toBe(true);
  });

  it('xrd 要求 angles/intensities 非空数组', () => {
    scienceState.type = 'xrd';
    expect(validateScienceData({ angles: [], intensities: [] })).toBe(false);
    expect(validateScienceData({ angles: [10], intensities: [5] })).toBe(true);
  });

  it('dna 要求 sequence 非空字符串', () => {
    scienceState.type = 'dna';
    expect(validateScienceData({ sequence: '' })).toBe(false);
    expect(validateScienceData({ sequence: 'ATGC' })).toBe(true);
  });

  it('pulsar 要求 periods 非空数组', () => {
    scienceState.type = 'pulsar';
    expect(validateScienceData({ periods: [] })).toBe(false);
    expect(validateScienceData({ periods: [33.1] })).toBe(true);
  });

  it('未知类型返回 false', () => {
    scienceState.type = 'unknown-type';
    expect(validateScienceData({ kpoints: [1] })).toBe(false);
  });
});

describe('normalizeScienceData - 各类型补全', () => {
  afterEach(() => {
    scienceState.type = 'dft';
  });

  it('dft 补全缺失字段', () => {
    scienceState.type = 'dft';
    const out = normalizeScienceData({});
    expect(out.kpoints).toEqual([]);
    expect(out.energies).toEqual([]);
    expect(out.fermi).toBe(0);
    expect(out.bandgap).toBe(0.5);
    expect(out.name).toBe('DFT数据');
  });

  it('md 补全缺失字段', () => {
    scienceState.type = 'md';
    const out = normalizeScienceData({});
    expect(out.frames).toEqual([]);
    expect(out.distances).toEqual([]);
    expect(out.frequencies).toEqual([]);
    expect(out.temp).toBe(300);
    expect(out.name).toBe('MD数据');
  });

  it('fem / cfd / xrd / pulsar 补全默认值', () => {
    scienceState.type = 'fem';
    expect(normalizeScienceData({}).nodes).toEqual([]);
    expect(normalizeScienceData({}).modes).toEqual([]);
    scienceState.type = 'cfd';
    expect(normalizeScienceData({}).reynolds).toBe(1000);
    scienceState.type = 'xrd';
    expect(normalizeScienceData({}).wavelength).toBe(1.54);
    expect(normalizeScienceData({}).lattice).toBe(5.64);
    scienceState.type = 'pulsar';
    expect(normalizeScienceData({}).dm).toBe(0);
  });

  it('dna 序列被清洗为大写 ATCG', () => {
    scienceState.type = 'dna';
    const out = normalizeScienceData({ sequence: 'atgcatgcNNN', gc: 0.5 });
    expect(out.sequence).toBe('ATGCATGC');
    expect(out.gc).toBe(0.5);
    expect(out.name).toBe('DNA数据');
  });

  it('保留已有字段值不被覆盖', () => {
    scienceState.type = 'dft';
    const out = normalizeScienceData({ kpoints: [1, 2], name: 'my data' });
    expect(out.kpoints).toEqual([1, 2]);
    expect(out.name).toBe('my data');
  });
});

describe('parseScienceCSV / parseScienceText - 委托给 parser', () => {
  beforeEach(() => {
    scienceState.type = 'dft';
  });

  it('parseScienceCSV 解析 kpoints/energies CSV', () => {
    const csv = 'kpoints,energies\n0,-1.0\n0.5,0.5\n1.0,2.0';
    const data = parseScienceCSV(csv);
    expect(data.kpoints.length).toBeGreaterThan(0);
    expect(data.energies.length).toBeGreaterThan(0);
  });

  it('parseScienceText 用 JSON 扩展名解析', () => {
    scienceState.type = 'dft';
    const json = '{"kpoints":[0,0.5,1],"energies":[-1,0,1],"fermi":0,"bandgap":1}';
    const data = parseScienceText(json, 'json', 'sample.json');
    expect(data.kpoints).toEqual([0, 0.5, 1]);
    expect(data.energies).toEqual([-1, 0, 1]);
  });

  it('parseScienceTextComplete 对合法 JSON 设置 state', () => {
    scienceState.type = 'dft';
    setupDOM();
    const json = '{"kpoints":[0,0.5,1],"energies":[-1,0,1],"fermi":0,"bandgap":1}';
    const f = new File([json], 'sample.json', { type: 'application/json' });
    parseScienceTextComplete(json, 'json', f);
    expect(scienceState.data.kpoints).toEqual([0, 0.5, 1]);
  });

  it('parseScienceTextComplete 对非法 JSON 显示错误状态', () => {
    scienceState.type = 'dft';
    setupDOM();
    const f = new File(['{ not json'], 'bad.json', { type: 'application/json' });
    expect(() => parseScienceTextComplete('{ not json', 'json', f)).not.toThrow();
    const el = document.getElementById('scienceUploadStatus') as HTMLElement;
    expect(el.style.display).toBe('block');
    expect(el.className).toContain('err');
  });

  it('parseScienceTextComplete 对不匹配 schema 显示 error', () => {
    scienceState.type = 'dft';
    setupDOM();
    // md 形状数据投喂给 dft 类型
    const json = '{"frames":[{"x":0}]}';
    const f = new File([json], 'bad.json', { type: 'application/json' });
    parseScienceTextComplete(json, 'json', f);
    const el = document.getElementById('scienceUploadStatus') as HTMLElement;
    expect(el.className).toContain('err');
  });
});

describe('selectScienceType - 切换类型并渲染', () => {
  beforeEach(() => {
    setupDOM();
    Store.state = Object.assign({}, DEFAULT_STATE);
    Store.state.scienceTypesUsed = [];
  });

  it('切换到 md 加载样本数据并切换视图', () => {
    selectScienceType('md');
    expect(scienceState.type).toBe('md');
    expect(scienceState.data).toBeDefined();
    expect(scienceState.data.frames.length).toBeGreaterThan(0);
    expect(scienceState.view).toBe('data');
  });

  it('切换到 deep 类型 crystal 加载 SCIENCE_DEEP_SAMPLES', () => {
    selectScienceType('crystal');
    expect(scienceState.type).toBe('crystal');
    expect(scienceState.data).toBeDefined();
    expect(scienceState.data.basis).toBeDefined();
  });

  it('首次使用某类型会写入 scienceTypesUsed 并 save', () => {
    const before = Store.state.scienceTypesUsed.length;
    selectScienceType('xrd');
    expect(Store.state.scienceTypesUsed.length).toBe(before + 1);
    expect(Store.state.scienceTypesUsed).toContain('xrd');
  });

  it('已使用过的类型不会重复 push', () => {
    selectScienceType('xrd');
    const n = Store.state.scienceTypesUsed.length;
    selectScienceType('xrd');
    expect(Store.state.scienceTypesUsed.length).toBe(n);
  });
});

describe('loadScienceSample / showScienceUploadStatus', () => {
  beforeEach(() => {
    setupDOM();
  });

  it('loadScienceSample 加载当前类型的示例', () => {
    scienceState.type = 'xrd';
    loadScienceSample();
    expect(scienceState.data).toBeDefined();
    expect(scienceState.data.angles).toBeDefined();
  });

  it('loadScienceSample 对 deep 类型加载对应样本', () => {
    scienceState.type = 'crystal';
    loadScienceSample();
    expect(scienceState.data.basis).toBeDefined();
    expect(scienceState.data.lattice).toBeGreaterThan(0);
  });

  it('showScienceUploadStatus 设置消息和样式 - success', () => {
    showScienceUploadStatus('ok', 'success');
    const el = document.getElementById('scienceUploadStatus') as HTMLElement;
    expect(el.textContent).toBe('ok');
    expect(el.className).toContain('ok');
    expect(el.style.display).toBe('block');
  });

  it('showScienceUploadStatus error 类型使用 err class', () => {
    showScienceUploadStatus('bad', 'error');
    const el = document.getElementById('scienceUploadStatus') as HTMLElement;
    expect(el.className).toContain('err');
  });

  it('showScienceUploadStatus info 类型不会自动隐藏', () => {
    vi.useFakeTimers();
    showScienceUploadStatus('解析中', 'info');
    const el = document.getElementById('scienceUploadStatus') as HTMLElement;
    vi.advanceTimersByTime(5000);
    expect(el.style.display).toBe('block');
    vi.useRealTimers();
  });

  it('showScienceUploadStatus success 4s 后自动隐藏', () => {
    vi.useFakeTimers();
    showScienceUploadStatus('ok', 'success');
    const el = document.getElementById('scienceUploadStatus') as HTMLElement;
    vi.advanceTimersByTime(4000);
    expect(el.style.display).toBe('none');
    vi.useRealTimers();
  });

  it('showScienceUploadStatus 在元素不存在时安全返回', () => {
    document.body.innerHTML = '';
    expect(() => showScienceUploadStatus('x', 'success')).not.toThrow();
  });
});

describe('goScienceStep / updateScienceTypeUI', () => {
  beforeEach(() => {
    setupDOM();
    scienceState.type = 'dft';
  });

  it('goScienceStep 切换 view 并激活对应 section', () => {
    goScienceStep('data');
    expect(scienceState.view).toBe('data');
    const el = document.getElementById('scienceStep-data') as HTMLElement;
    expect(el.classList.contains('active')).toBe(true);
  });

  it('goScienceStep compose 触发 renderScienceCompose', () => {
    scienceState.data = JSON.parse(JSON.stringify(SCIENCE_SAMPLES.dft));
    expect(() => goScienceStep('compose')).not.toThrow();
    expect(scienceState.view).toBe('compose');
  });

  it('goScienceStep 在 section 不存在时不抛错', () => {
    document.body.innerHTML = '';
    expect(() => goScienceStep('mode')).not.toThrow();
  });

  it('updateScienceTypeUI 高亮匹配的按钮', () => {
    scienceState.type = 'md';
    updateScienceTypeUI();
    const mdBtn = document.querySelector('.science-type-btn[data-type="md"]') as HTMLElement;
    const dftBtn = document.querySelector('.science-type-btn[data-type="dft"]') as HTMLElement;
    expect(mdBtn.classList.contains('active')).toBe(true);
    expect(dftBtn.classList.contains('active')).toBe(false);
  });

  it('updateScienceTypeUI 设置中文名称', () => {
    scienceState.type = 'xrd';
    updateScienceTypeUI();
    const nameEl = document.getElementById('scienceTypeName') as HTMLElement;
    expect(nameEl.textContent).toBe('XRD 晶体衍射');
  });

  it('updateScienceTypeUI 对 deep 类型设置对应名称', () => {
    scienceState.type = 'crystal';
    updateScienceTypeUI();
    const nameEl = document.getElementById('scienceTypeName') as HTMLElement;
    expect(nameEl.textContent).toContain('晶体');
  });

  it('updateScienceTypeUI 对未知类型回退为 type 字符串', () => {
    scienceState.type = 'unknown-xyz';
    updateScienceTypeUI();
    const nameEl = document.getElementById('scienceTypeName') as HTMLElement;
    expect(nameEl.textContent).toBe('unknown-xyz');
  });
});

describe('render 系列函数', () => {
  beforeEach(() => {
    setupDOM({ withCanvases: true });
    scienceState.type = 'dft';
    scienceState.data = JSON.parse(JSON.stringify(SCIENCE_SAMPLES.dft));
  });

  it('renderScienceData 渲染 schema/info/name', () => {
    renderScienceData();
    const info = document.getElementById('scienceDataInfo') as HTMLElement;
    expect(info.innerHTML).toContain('名称');
    expect(info.innerHTML).toContain('样本数');
    const help = document.getElementById('scienceSchemaHelp') as HTMLElement;
    expect(help.innerHTML).toContain('kpoints');
  });

  it('renderScienceData 对 deep 类型 schema 来自 SCIENCE_DEEP_SCHEMA', () => {
    scienceState.type = 'crystal';
    scienceState.data = { name: 'crystal-test', lattice: 5.43, basis: [], phonons: [] } as any;
    renderScienceData();
    const help = document.getElementById('scienceSchemaHelp') as HTMLElement;
    expect(help.innerHTML).toContain('lattice');
  });

  it('renderScienceStats 各类型不抛错', () => {
    const types = ['dft', 'md', 'fem', 'cfd', 'xrd', 'dna', 'pulsar'];
    for (const t of types) {
      scienceState.type = t;
      const samples = (SCIENCE_SAMPLES as Record<string, any>)[t];
      scienceState.data = JSON.parse(JSON.stringify(samples));
      expect(() => renderScienceStats()).not.toThrow();
      const el = document.getElementById('scienceStats') as HTMLElement;
      expect(el.innerHTML).toContain('science-stat');
    }
  });

  it('renderScienceStats 在元素不存在时安全返回', () => {
    document.body.innerHTML = '';
    expect(() => renderScienceStats()).not.toThrow();
  });

  it('renderScienceMappings 渲染当前类型的映射卡片', () => {
    scienceState.type = 'dft';
    renderScienceMappings();
    const el = document.getElementById('scienceMappingList') as HTMLElement;
    expect(el.innerHTML).toContain('science-mapping-card');
  });

  it('renderScienceKnobs 渲染调参旋钮', () => {
    scienceState.type = 'dft';
    renderScienceKnobs();
    const el = document.getElementById('scienceKnobs') as HTMLElement;
    expect(el.innerHTML).toContain('science-knob');
    expect(el.innerHTML).toContain('input');
  });

  it('renderSciencePianoRoll 渲染 4 行 32 列', () => {
    scienceState.pattern = [[1, 0, 0, 0], [0, 440, 0, 0]];
    renderSciencePianoRoll();
    const el = document.getElementById('sciencePianoRoll') as HTMLElement;
    const rows = el.querySelectorAll('.science-piano-row');
    expect(rows.length).toBe(4);
    expect(rows[0].querySelectorAll('.science-piano-cell').length).toBe(32);
  });

  it('renderScienceVisualizer 创建 16 个 bar', () => {
    renderScienceVisualizer();
    const el = document.getElementById('scienceVisualizer') as HTMLElement;
    const bars = el.querySelectorAll('.science-vbar');
    expect(bars.length).toBe(16);
  });

  it('renderScienceCompose 整合所有渲染步骤', () => {
    expect(() => renderScienceCompose()).not.toThrow();
  });

  it('drawScienceDataCanvas 在 canvas 不可用时返回', () => {
    document.body.innerHTML = '';
    expect(() => drawScienceDataCanvas()).not.toThrow();
  });

  it('drawScienceDataCanvas 对各类型不抛错', () => {
    const types = ['dft', 'md', 'fem', 'cfd', 'xrd', 'dna', 'pulsar'];
    for (const t of types) {
      scienceState.type = t;
      scienceState.data = JSON.parse(JSON.stringify((SCIENCE_SAMPLES as Record<string, any>)[t]));
      expect(() => drawScienceDataCanvas()).not.toThrow();
    }
  });

  it('drawScienceComposeCanvas 在 pattern 为空时返回', () => {
    scienceState.pattern = [];
    expect(() => drawScienceComposeCanvas()).not.toThrow();
  });

  it('drawScienceComposeCanvas 在 canvas 不存在时返回', () => {
    document.body.innerHTML = '';
    scienceState.pattern = [[1, 0, 0, 0]];
    expect(() => drawScienceComposeCanvas()).not.toThrow();
  });
});

describe('regenerateScienceMusic - 各类型生成 pattern', () => {
  beforeEach(() => {
    setupDOM();
  });

  it('dft 生成 pattern（长度 <= 32）', () => {
    scienceState.type = 'dft';
    scienceState.data = JSON.parse(JSON.stringify(SCIENCE_SAMPLES.dft));
    regenerateScienceMusic();
    expect(scienceState.pattern.length).toBeGreaterThan(0);
    expect(scienceState.pattern.length).toBeLessThanOrEqual(32);
    expect(Array.isArray(scienceState.pattern[0])).toBe(true);
  });

  it('md 生成 pattern 且每个 row 长度为 4', () => {
    scienceState.type = 'md';
    scienceState.data = JSON.parse(JSON.stringify(SCIENCE_SAMPLES.md));
    regenerateScienceMusic();
    expect(scienceState.pattern.length).toBeGreaterThan(0);
    scienceState.pattern.forEach((row: number[]) => {
      expect(row.length).toBe(4);
    });
  });

  it('fem / cfd / xrd / dna / pulsar 各类型生成 pattern', () => {
    const types = ['fem', 'cfd', 'xrd', 'dna', 'pulsar'] as const;
    for (const t of types) {
      scienceState.type = t;
      scienceState.data = JSON.parse(JSON.stringify((SCIENCE_SAMPLES as Record<string, any>)[t]));
      expect(() => regenerateScienceMusic()).not.toThrow();
      expect(scienceState.pattern.length).toBeGreaterThan(0);
    }
  });

  it('deep 类型 crystal / quantum / seismic / eeg 生成 pattern', () => {
    const types = ['crystal', 'quantum', 'seismic', 'eeg'] as const;
    for (const t of types) {
      scienceState.type = t;
      // 数据由 selectScienceType 加载，这里直接调用
      selectScienceType(t);
      expect(() => regenerateScienceMusic()).not.toThrow();
      expect(scienceState.pattern.length).toBeGreaterThan(0);
    }
  });

  it('toggleScienceMapping 翻转映射后重新生成 pattern', () => {
    scienceState.type = 'dft';
    scienceState.data = JSON.parse(JSON.stringify(SCIENCE_SAMPLES.dft));
    const before = scienceState.mapping.dft.ks;
    toggleScienceMapping('ks');
    expect(scienceState.mapping.dft.ks).toBe(!before);
  });

  it('updateScienceOption 更新值并重新生成', () => {
    scienceState.type = 'dft';
    scienceState.data = JSON.parse(JSON.stringify(SCIENCE_SAMPLES.dft));
    updateScienceOption('pitchRange', '20');
    expect(scienceState.options.dft.pitchRange).toBe(20);
  });
});

describe('toggleScienceWhyPanel', () => {
  beforeEach(() => {
    setupDOM();
    scienceState.type = 'dft';
  });

  it('切换 whyPanel 显示状态并填充内容', () => {
    const el = document.getElementById('scienceWhyPanel') as HTMLElement;
    el.style.display = 'none';
    toggleScienceWhyPanel();
    expect(el.style.display).toBe('block');
    expect(el.innerHTML).toContain('Kohn-Sham');
  });

  it('再次切换隐藏', () => {
    const el = document.getElementById('scienceWhyPanel') as HTMLElement;
    el.style.display = 'block';
    toggleScienceWhyPanel();
    expect(el.style.display).toBe('none');
  });

  it('元素不存在时安全返回', () => {
    document.body.innerHTML = '';
    expect(() => toggleScienceWhyPanel()).not.toThrow();
  });
});

describe('播放控制 toggleSciencePlay / start / stop', () => {
  beforeEach(() => {
    setupDOM();
    scienceState.type = 'dft';
    scienceState.data = JSON.parse(JSON.stringify(SCIENCE_SAMPLES.dft));
    scienceState.pattern = [];
    scienceState.playing = false;
  });

  it('startSciencePlay 创建 transport 并启动', () => {
    startSciencePlay();
    expect(scienceState.playing).toBe(true);
    expect(scienceState.transport).not.toBeNull();
    const btn = document.getElementById('sciPlayBtn') as HTMLElement;
    expect(btn.textContent).toContain('暂停');
  });

  it('startSciencePlay 在 pattern 为空时先 regenerate', () => {
    scienceState.pattern = [];
    startSciencePlay();
    expect(scienceState.pattern.length).toBeGreaterThan(0);
  });

  it('stopSciencePlay 重置状态并恢复按钮文本', () => {
    startSciencePlay();
    stopSciencePlay();
    expect(scienceState.playing).toBe(false);
    expect(scienceState.transport).toBeNull();
    const btn = document.getElementById('sciPlayBtn') as HTMLElement;
    expect(btn.textContent).toContain('播放');
  });

  it('toggleSciencePlay 在停止时启动、在播放时停止', () => {
    expect(scienceState.playing).toBe(false);
    toggleSciencePlay();
    expect(scienceState.playing).toBe(true);
    toggleSciencePlay();
    expect(scienceState.playing).toBe(false);
  });

  it('updateScienceVisualizer 更新 bar 高度', () => {
    scienceState.pattern = [[0, 0, 0.5, 0], [1, 440, 0.8, 0]];
    renderScienceVisualizer();
    updateScienceVisualizer(0);
    const bars = document.querySelectorAll('.science-vbar');
    expect(bars.length).toBe(16);
  });
});

describe('animateScienceParticles', () => {
  beforeEach(() => {
    setupDOM();
  });

  it('创建粒子元素并在 1s 后移除', () => {
    vi.useFakeTimers();
    animateScienceParticles();
    const container = document.getElementById('scienceParticles') as HTMLElement;
    expect(container.children.length).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(container.children.length).toBe(0);
    vi.useRealTimers();
  });

  it('元素不存在时安全返回', () => {
    document.body.innerHTML = '';
    expect(() => animateScienceParticles()).not.toThrow();
  });
});

describe('saveScienceComposition / loadScienceComposition / deleteScienceComposition', () => {
  beforeEach(() => {
    setupDOM();
    Store.state = Object.assign({}, DEFAULT_STATE);
    Store.state.scienceCompositions = [];
    scienceState.type = 'dft';
    scienceState.data = JSON.parse(JSON.stringify(SCIENCE_SAMPLES.dft));
    scienceState.pattern = [[1, 440, 0.5, 0]];
    // 重置 options/mapping 为默认值，避免其他测试的修改影响
    scienceState.options.dft = {};
    for (const o of SCIENCE_OPTIONS.dft) scienceState.options.dft[o.key] = o.def;
    scienceState.mapping.dft = {};
    SCIENCE_MAPPINGS.dft.forEach((m, i) => (scienceState.mapping.dft[m.id] = i < 3));
    vi.mocked(audioMod.playCorrect).mockClear();
  });

  it('saveScienceComposition 写入 Store 并播放正确音效', () => {
    saveScienceComposition();
    expect(Store.state.scienceCompositions.length).toBe(1);
    const comp = Store.state.scienceCompositions[0] as any;
    expect(comp.type).toBe('dft');
    expect(comp.pattern).toEqual([[1, 440, 0.5, 0]]);
    expect(comp.id).toBeGreaterThan(0);
    expect(audioMod.playCorrect).toHaveBeenCalled();
  });

  it('renderScienceCompositionList 在空列表时显示提示', () => {
    Store.state.scienceCompositions = [];
    renderScienceCompositionList();
    const el = document.getElementById('scienceCompositionList') as HTMLElement;
    expect(el.innerHTML).toContain('还没有保存');
  });

  it('renderScienceCompositionList 渲染已有作品', () => {
    saveScienceComposition();
    renderScienceCompositionList();
    const el = document.getElementById('scienceCompositionList') as HTMLElement;
    expect(el.innerHTML).toContain('science-composition-item');
  });

  it('loadScienceComposition 还原 type/data/options/mapping', () => {
    saveScienceComposition();
    const id = (Store.state.scienceCompositions[0] as any).id;
    // 改变 state 再加载
    scienceState.type = 'md';
    scienceState.pattern = [];
    scienceState.options.md = {};
    scienceState.mapping.md = {};
    loadScienceComposition(id);
    expect(scienceState.type).toBe('dft');
    // pattern 会被 renderScienceCompose 重新生成，但 type/data/options/mapping 应被还原
    expect(scienceState.options.dft.pitchRange).toBe(SCIENCE_OPTIONS.dft[1].def);
    expect(scienceState.mapping.dft.ks).toBeDefined();
    expect(scienceState.view).toBe('compose');
  });

  it('loadScienceComposition 对不存在 id 安全返回', () => {
    expect(() => loadScienceComposition(99999)).not.toThrow();
  });

  it('deleteScienceComposition 从 Store 移除', () => {
    saveScienceComposition();
    const id = (Store.state.scienceCompositions[0] as any).id;
    deleteScienceComposition(id);
    expect(Store.state.scienceCompositions.length).toBe(0);
  });
});

describe('openComposerWithScience - 跳转作曲台', () => {
  beforeEach(() => {
    setupDOM();
    scienceState.type = 'dft';
    scienceState.data = { name: 'test' } as any;
    scienceState.pattern = [[1, 440, 0, 0]];
    Store.state = Object.assign({}, DEFAULT_STATE);
    vi.mocked(storageMod.localSet).mockClear();
  });

  it('未解锁自由模式时仅显示 toast 且不跳转', async () => {
    const gameEngine = await import('./game-engine');
    vi.mocked(gameEngine.isFreeModeUnlocked).mockReturnValue(false);
    openComposerWithScience();
    expect(storageMod.localSet).not.toHaveBeenCalled();
  });

  it('已解锁时写入 localSet 并触发跳转', async () => {
    const gameEngine = await import('./game-engine');
    vi.mocked(gameEngine.isFreeModeUnlocked).mockReturnValue(true);
    const origLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { href: '' },
    });
    try {
      openComposerWithScience();
      expect(storageMod.localSet).toHaveBeenCalledWith(
        'mathbeat_science_export',
        expect.objectContaining({ type: 'dft' }),
      );
      expect(Store.state.exportedScience).toBe(true);
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: origLocation,
      });
    }
  });
});

describe('shareScience - 分享', () => {
  beforeEach(() => {
    setupDOM();
    scienceState.type = 'dft';
  });

  it('navigator.share 不可用时走 clipboard 路径', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    });
    shareScience();
    // 异步 await，刷新微任务
    await new Promise((r) => setTimeout(r, 0));
    expect(writeText).toHaveBeenCalled();
  });

  it('navigator.clipboard 也不可用时走 toast 路径', () => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    expect(() => shareScience()).not.toThrow();
  });

  it('navigator.share 可用时调用 share', async () => {
    const share = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: share,
    });
    shareScience();
    await new Promise((r) => setTimeout(r, 0));
    expect(share).toHaveBeenCalled();
  });
});

describe('downloadScienceExport - 导出', () => {
  beforeEach(() => {
    setupDOM();
    scienceState.type = 'dft';
    scienceState.data = JSON.parse(JSON.stringify(SCIENCE_SAMPLES.dft));
    scienceState.pattern = [[1, 440, 0.5, 0]];
  });

  it('midi 格式调用 exportScience 并显示成功', () => {
    downloadScienceExport('midi');
    expect(exportScience).toHaveBeenCalled();
    const el = document.getElementById('scienceUploadStatus') as HTMLElement;
    expect(el.textContent).toContain('MIDI');
  });

  it('json 格式调用 exportScience', () => {
    downloadScienceExport('json');
    expect(exportScience).toHaveBeenCalled();
  });

  it('csv 格式调用 exportScience', () => {
    downloadScienceExport('csv');
    expect(exportScience).toHaveBeenCalled();
  });

  it('pattern 为空时先 regenerate', () => {
    scienceState.pattern = [];
    downloadScienceExport('midi');
    expect(scienceState.pattern.length).toBeGreaterThan(0);
    expect(exportScience).toHaveBeenCalled();
  });
});

describe('handleScienceFile - 文件上传', () => {
  beforeEach(() => {
    setupDOM();
    scienceState.type = 'dft';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('HTMLInputElement 无文件时安全返回', () => {
    const input = document.createElement('input');
    input.type = 'file';
    expect(() => handleScienceFile(input)).not.toThrow();
  });

  it('Event 目标无 files 时安全返回', () => {
    const ev = { target: document.createElement('input') } as any;
    expect(() => handleScienceFile(ev)).not.toThrow();
  });

  // 构造一个通过 instanceof HTMLInputElement 检查的假 input。
  // 直接用 Object.setPrototypeOf 让 plain object 被识别为 HTMLInputElement。
  function makeFakeInput(files: File[]): HTMLInputElement {
    const fake = { files, type: 'file' } as unknown as HTMLInputElement;
    Object.setPrototypeOf(fake, HTMLInputElement.prototype);
    return fake;
  }

  it('小文件走 FileReader.readAsText 路径', () => {
    const json = '{"kpoints":[0,1],"energies":[0,1]}';
    const file = new File([json], 's.json', { type: 'application/json' });
    const input = makeFakeInput([file]);
    // 模拟 FileReader：构造一个会同步触发 onload 的假实例
    const fakeReader: any = {
      onload: null,
      onerror: null,
      result: '',
      readAsText: vi.fn(function (this: any) {
        this.result = json;
        if (typeof this.onload === 'function')
          this.onload({ target: { result: json } } as any);
      }),
    };
    vi.stubGlobal('FileReader', function () { return fakeReader; });
    expect(() => handleScienceFile(input)).not.toThrow();
    expect(fakeReader.readAsText).toHaveBeenCalled();
  });

  it('大文件 (>2MB) 走分块读取路径', () => {
    // 构造一个大文件对象（不实际包含 2MB 数据，只模拟 size）
    const bigText = '{"kpoints":[0,1],"energies":[0,1]}';
    const file = {
      name: 'big.csv',
      size: 3 * 1024 * 1024,
      slice: vi.fn(() => ({ size: 100 })),
    } as unknown as File;
    const input = makeFakeInput([file]);
    const fakeReader: any = {
      onload: null,
      onerror: null,
      result: bigText,
      readAsText: vi.fn(function (this: any) {
        if (typeof this.onload === 'function')
          this.onload({ target: { result: bigText } } as any);
      }),
    };
    vi.stubGlobal('FileReader', function () { return fakeReader; });
    expect(() => handleScienceFile(input)).not.toThrow();
    expect(fakeReader.readAsText).toHaveBeenCalled();
  });

  it('FileReader onerror 路径显示错误', () => {
    const file = new File(['x'], 's.json', { type: 'application/json' });
    const input = makeFakeInput([file]);
    const fakeReader: any = {
      onload: null,
      onerror: null,
      result: '',
      readAsText: vi.fn(function (this: any) {
        if (typeof this.onerror === 'function') this.onerror(new Event('error'));
      }),
    };
    vi.stubGlobal('FileReader', function () { return fakeReader; });
    expect(() => handleScienceFile(input)).not.toThrow();
    const el = document.getElementById('scienceUploadStatus') as HTMLElement;
    expect(el.className).toContain('err');
  });
});

describe('openScienceMode - 进入科学模式', () => {
  beforeEach(() => {
    setupDOM();
  });

  it('调用 stopAllPlayback 并激活 scienceScreen', async () => {
    const gameEngine = await import('./game-engine');
    vi.mocked(gameEngine.stopAllPlayback).mockClear();
    openScienceMode();
    expect(gameEngine.stopAllPlayback).toHaveBeenCalled();
    const screen = document.getElementById('scienceScreen') as HTMLElement;
    expect(screen.classList.contains('active')).toBe(true);
    expect(scienceState.view).toBe('mode');
  });
});
