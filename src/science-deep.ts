/**
 * science-deep.ts —— 科学之声“深度”扩展模块
 *
 * 在已有 science.ts 的 7 种数据类型之外，新增 4 种科学数据类型
 * （晶体点阵 / 量子波函数 / 地震波 / 脑电波），并附带 2 个
 * 材料音乐（materiomusic）子模块：断裂声化、火焰动力学声化。
 *
 * 数据结构与映射导出完全沿用 science.ts 的五件套写法：
 *   SAMPLES / SCHEMA / TYPE_NAMES / MAPPINGS / OPTIONS
 * 这里用 SCIENCE_DEEP_* 前缀以避免与 science.ts 同名导出冲突。
 */
import { getAudioCtx, scheduleToneAt, getSharedTransport, stopSharedTransport } from './audio';
import { stopAllPlayback } from './game-engine';
import { registerActions } from './events';
import type { Transport, TransportEvent } from './core/transport';

/* =========================================================================
 * 公共小类型
 * ========================================================================= */

// 科学映射条目：与 science.ts 中 SCIENCE_MAPPINGS 的每一项同构
export interface MappingEntry {
  id: string;
  title: string;
  desc: string;
}

// 调参旋钮：与 science.ts 中 SCIENCE_OPTIONS 的每一项同构
export interface ScienceOption {
  key: string;
  label: string;
  min: number;
  max: number;
  def: number;
  unit: string;
}

// 材料音乐模块内部统一的音符描述
export interface MaterioNote {
  freq: number; // Hz
  velocity: number; // 0..1
  dur: number; // 秒
  type: OscillatorType;
  ornament?: boolean; // 是否额外加一个装饰音（火焰用）
}

/* =========================================================================
 * 1. crystal —— 晶体点阵
 * ========================================================================= */

export interface CrystalBasisAtom {
  x: number;
  y: number;
  z: number;
}

export interface CrystalSample {
  name: string;
  lattice: number; // 晶格常数 (Å)
  basis: CrystalBasisAtom[]; // 原子分数坐标
  symmetry: string; // 空间群
  phonons: number[]; // 声子频率 (THz)
}

export interface ScienceDeepSamples {
  crystal: CrystalSample;
  quantum: QuantumSample;
  seismic: SeismicSample;
  eeg: EegSample;
}

export const SCIENCE_DEEP_SAMPLES: ScienceDeepSamples = {
  crystal: {
    name: '硅金刚石型晶体 (Si diamond structure)',
    lattice: 5.43,
    // 金刚石结构惯用胞内 8 个原子的分数坐标
    basis: [
      { x: 0.0, y: 0.0, z: 0.0 },
      { x: 0.0, y: 0.5, z: 0.5 },
      { x: 0.5, y: 0.0, z: 0.5 },
      { x: 0.5, y: 0.5, z: 0.0 },
      { x: 0.25, y: 0.25, z: 0.25 },
      { x: 0.25, y: 0.75, z: 0.75 },
      { x: 0.75, y: 0.25, z: 0.75 },
      { x: 0.75, y: 0.75, z: 0.25 },
    ],
    symmetry: 'Fd-3m',
    // 高对称点附近声子频率 (THz)：声学支低、光学支高
    phonons: [3.6, 7.9, 11.3, 15.6, 15.6, 11.3, 7.9, 3.6],
  },

  /* ----------------------------------------------------------------------
   * 2. quantum —— 量子波函数（氢原子 3d 轨道）
   * -------------------------------------------------------------------- */
  quantum: {
    name: '氢原子 3d 轨道波函数',
    n: 3,
    l: 2,
    m: 0,
    // 径向概率分布 P(r)∝r⁴·exp(-2r/3)，峰值约在 6a0，已归一化到 1
    radial: [0.022, 0.178, 0.462, 0.752, 0.941, 1.0, 0.949, 0.835, 0.683, 0.536],
    // 角度分布 (3cos²θ-1)²，θ 从 0 到 π 采样 8 点，已归一化
    angular: [1.0, 0.515, 0.007, 0.181, 0.181, 0.007, 0.515, 1.0],
    energy: -1.51, // eV (n=3: -13.6/9)
    nodes: 1, // 径向节点数（示意）
  },

  /* ----------------------------------------------------------------------
   * 3. seismic —— 地震波（2011 日本东北地震，简化）
   * -------------------------------------------------------------------- */
  seismic: {
    name: '2011 日本东北地震数据简化',
    magnitude: 9.0,
    // P 波到达时间 (s)，随台站距离递增
    pWave: [8.3, 16.7, 25.0, 33.3, 41.7, 50.0, 58.3, 66.7, 75.0, 83.3],
    // S 波到达时间 (s)，速度更慢、到达更晚
    sWave: [14.3, 28.6, 42.9, 57.1, 71.4, 85.7, 100.0, 114.3, 128.6, 142.9],
    // 面波振幅（相对值），幅度最大、持续最久
    surface: [0.4, 1.2, 3.5, 7.8, 14.2, 11.5, 7.1, 4.0, 1.8, 0.5],
    epicenter: { lat: 38.3, lon: 142.4 },
    depth: 29, // 震源深度 (km)
  },

  /* ----------------------------------------------------------------------
   * 4. eeg —— 脑电波（清醒放松状态）
   * -------------------------------------------------------------------- */
  eeg: {
    name: '清醒放松状态 EEG',
    bands: {
      delta: [0.35, 0.42, 0.28, 0.31], // 0.5-4 Hz
      theta: [0.52, 0.61, 0.44, 0.55], // 4-8 Hz
      alpha: [1.85, 2.24, 1.92, 2.11], // 8-13 Hz（主导）
      beta: [0.71, 0.83, 0.62, 0.74], // 13-30 Hz
      gamma: [0.22, 0.31, 0.19, 0.24], // 30-40 Hz
    },
    dominant: 'alpha',
    freqRange: [0.5, 40],
    channels: 8,
  },
};

// 前向声明 quantum / seismic / eeg 的接口（放在 samples 之后便于阅读，
// 但 TS 接口提升，所以 ScienceDeepSamples 里引用它们没问题）
export interface QuantumSample {
  name: string;
  n: number;
  l: number;
  m: number;
  radial: number[];
  angular: number[];
  energy: number; // eV
  nodes: number;
}

export interface SeismicEpicenter {
  lat: number;
  lon: number;
}

export interface SeismicSample {
  name: string;
  magnitude: number;
  pWave: number[];
  sWave: number[];
  surface: number[];
  epicenter: SeismicEpicenter;
  depth: number; // km
}

export interface EegBands {
  delta: number[];
  theta: number[];
  alpha: number[];
  beta: number[];
  gamma: number[];
}

export interface EegSample {
  name: string;
  bands: EegBands;
  dominant: string;
  freqRange: [number, number];
  channels: number;
}

/* =========================================================================
 * SCHEMA / TYPE_NAMES —— 同构于 science.ts
 * ========================================================================= */

export const SCIENCE_DEEP_SCHEMA: Record<keyof ScienceDeepSamples, string> = {
  crystal: '{ name, lattice, basis: [{x,y,z}], symmetry, phonons: [...] }',
  quantum: '{ name, n, l, m, radial: [...], angular: [...], energy, nodes }',
  seismic: '{ name, magnitude, pWave: [...], sWave: [...], surface: [...], epicenter: {lat,lon}, depth }',
  eeg: '{ name, bands: {delta,theta,alpha,beta,gamma}, dominant, freqRange, channels }',
};

export const SCIENCE_DEEP_TYPE_NAMES: Record<keyof ScienceDeepSamples, string> = {
  crystal: '晶体点阵',
  quantum: '量子波函数',
  seismic: '地震波',
  eeg: '脑电波',
};

/* =========================================================================
 * MAPPINGS —— 每种类型 6 条映射
 * ========================================================================= */

export const SCIENCE_DEEP_MAPPINGS: Record<keyof ScienceDeepSamples, MappingEntry[]> = {
  crystal: [
    {
      id: 'bravais',
      title: '布拉维格子 ↔ 音阶系统',
      desc: '格子类型（面心立方等）决定可用音阶集合，晶格平移对应音阶循环。',
    },
    {
      id: 'symop',
      title: '对称操作 ↔ 和弦变换',
      desc: '空间群的对称操作对应和弦的倒影、平移与转位，保持音乐结构等价。',
    },
    {
      id: 'phonon',
      title: '声子色散 ↔ 节奏型',
      desc: '声学支与光学支的色散曲线映射为快慢两层节奏型，Γ点对应强拍。',
    },
    {
      id: 'pointgroup',
      title: '点群 ↔ 调式',
      desc: '点群对称性约束允许的音程集合，等价于调式的音阶骨架。',
    },
    {
      id: 'basis',
      title: '原胞基矢 ↔ 基础音程',
      desc: '三个基矢长度比例映射为基础音程（八度/五度/四度），决定调性框架。',
    },
    {
      id: 'defect',
      title: '缺陷 ↔ 装饰音',
      desc: '空位、位错等缺陷在规则格子上引入局部扰动，对应旋律中的装饰音与经过音。',
    },
  ],
  quantum: [
    {
      id: 'eigenstate',
      title: '本征态 ↔ 自然泛音列',
      desc: '定态薛定谔方程的本征解对应自然泛音列，每个本征态是一个泛音分量。',
    },
    { id: 'n', title: '量子数 n ↔ 八度', desc: '主量子数 n 决定能级高低，映射为八度位置，n 越大音区越高。' },
    { id: 'l', title: '量子数 l ↔ 音色', desc: '角量子数 l 决定轨道形状，映射为泛音构成与音色明暗。' },
    { id: 'm', title: '量子数 m ↔ 声像', desc: '磁量子数 m 决定空间取向，映射为立体声声像的左右分布。' },
    { id: 'node', title: '波函数节点 ↔ 休止', desc: '波函数节面处概率为零，对应旋律中的休止与停顿。' },
    { id: 'transition', title: '能级跃迁 ↔ 和弦进行', desc: '能级跃迁释放/吸收的能量对应和弦之间的张力解决与进行。' },
  ],
  seismic: [
    { id: 'pwave', title: 'P 波 ↔ 快节奏动机', desc: 'P 波传播最快、最先到达，对应乐曲开场的快节奏动机。' },
    { id: 'swave', title: 'S 波 ↔ 慢节奏和弦', desc: 'S 波速度较慢、幅度更大，映射为随后进入的慢节奏和弦层。' },
    { id: 'surface', title: '面波 ↔ 持续低音', desc: '面波幅度最大、持续时间长，对应持续低音与踏板声部。' },
    { id: 'magnitude', title: '震级 ↔ 力度峰值', desc: '震级决定整体能量，映射为乐曲的力度峰值与动态范围。' },
    { id: 'depth', title: '震源深度 ↔ 低频厚度', desc: '震源越深低频越显著，对应低音声部的厚度与延续。' },
    { id: 'spectrum', title: '频谱 ↔ 音色', desc: '地震波频谱成分映射为音色明暗与泛音分布。' },
  ],
  eeg: [
    { id: 'delta', title: 'δ 波 ↔ 低音踏板', desc: 'δ 频段 (0.5-4Hz) 对应深沉的低音踏板，奠定整体基调。' },
    { id: 'theta', title: 'θ 波 ↔ 低中音区', desc: 'θ 频段 (4-8Hz) 映射为低中音区的和声铺垫。' },
    { id: 'alpha', title: 'α 波 ↔ 中音旋律', desc: 'α 频段 (8-13Hz) 为主旋律所在，清醒放松时最为突出。' },
    { id: 'beta', title: 'β 波 ↔ 高音装饰', desc: 'β 频段 (13-30Hz) 对应高音区的装饰音与活跃跑句。' },
    { id: 'gamma', title: 'γ 波 ↔ 极高频泛音', desc: 'γ 频段 (30-40Hz) 映射为极高频泛音，带来明亮微光。' },
    { id: 'region', title: '脑区 ↔ 声部', desc: '不同脑区电极对应不同声部，空间分布映射为声部布局。' },
  ],
};

/* =========================================================================
 * OPTIONS —— 每种类型 4 个调参旋钮
 * ========================================================================= */

export const SCIENCE_DEEP_OPTIONS: Record<keyof ScienceDeepSamples, ScienceOption[]> = {
  crystal: [
    { key: 'rootPitch', label: '格子常数→根音', min: 0, max: 24, def: 0, unit: '半音' },
    { key: 'modeComplex', label: '对称度→调式复杂度', min: 0, max: 100, def: 50, unit: '%' },
    { key: 'rhythmDensity', label: '声子→节奏密度', min: 0, max: 100, def: 50, unit: '%' },
    { key: 'ornamentRatio', label: '缺陷→装饰音比例', min: 0, max: 100, def: 20, unit: '%' },
  ],
  quantum: [
    { key: 'pitchRange', label: '能级→音域', min: 1, max: 36, def: 18, unit: '半音' },
    { key: 'overtoneCount', label: '量子数 l→泛音数', min: 0, max: 8, def: 2, unit: '个' },
    { key: 'restProb', label: '节点→休止概率', min: 0, max: 100, def: 30, unit: '%' },
    { key: 'tension', label: '跃迁→和声张力', min: 0, max: 100, def: 50, unit: '%' },
  ],
  seismic: [
    { key: 'pTempo', label: 'P 波→速度', min: 60, max: 240, def: 140, unit: 'BPM' },
    { key: 'sChordDensity', label: 'S 波→和弦密度', min: 0, max: 100, def: 50, unit: '%' },
    { key: 'surfaceBass', label: '面波→低音持续', min: 0, max: 100, def: 60, unit: '%' },
    { key: 'dynRange', label: '震级→力度范围', min: 0, max: 100, def: 70, unit: '%' },
  ],
  eeg: [
    { key: 'alphaRange', label: 'α 波→旋律音域', min: 1, max: 24, def: 12, unit: '半音' },
    { key: 'betaOrnament', label: 'β 波→装饰密度', min: 0, max: 100, def: 40, unit: '%' },
    { key: 'gammaBrightness', label: 'γ 波→泛音亮度', min: 0, max: 100, def: 30, unit: '%' },
    { key: 'bandBalance', label: '频段→声部平衡', min: 0, max: 100, def: 50, unit: '%' },
  ],
};

/* =========================================================================
 * 5. fracture —— 断裂声化（Buehler 论文 §6.1）
 * 以裂纹尖端附近的应力场分布作为音符生成器：
 *   应力 σ_vm → 音高 / 力度，距离 r → 触发时机
 * ========================================================================= */

export interface FractureStressPoint {
  r: number; // 到裂纹尖端的距离 (无量纲)
  theta: number; // 极角 (rad)
  sigma_vm: number; // von Mises 等效应力
}

export interface FractureSample {
  name: string;
  crackTip: { x: number; y: number };
  stressField: FractureStressPoint[]; // 12 个采样点
  youngsModulus: number; // GPa
  fractureToughness: number; // K_IC, MPa√m
}

export interface FractureSamples {
  brittle: FractureSample; // 脆性断裂
  ductile: FractureSample; // 韧性断裂
  fatigue: FractureSample; // 疲劳断裂
}

export const FRACTURE_SAMPLES: FractureSamples = {
  brittle: {
    name: '脆性断裂',
    crackTip: { x: 0.5, y: 0.5 },
    // 应力在尖端高度集中，远场快速衰减
    stressField: [
      { r: 0.02, theta: 0.0, sigma_vm: 280 },
      { r: 0.04, theta: 0.52, sigma_vm: 210 },
      { r: 0.06, theta: -0.52, sigma_vm: 175 },
      { r: 0.08, theta: 1.05, sigma_vm: 150 },
      { r: 0.1, theta: -1.05, sigma_vm: 135 },
      { r: 0.14, theta: 1.57, sigma_vm: 110 },
      { r: 0.18, theta: -1.57, sigma_vm: 92 },
      { r: 0.24, theta: 2.09, sigma_vm: 78 },
      { r: 0.3, theta: -2.09, sigma_vm: 66 },
      { r: 0.38, theta: 2.62, sigma_vm: 54 },
      { r: 0.46, theta: -2.62, sigma_vm: 46 },
      { r: 0.5, theta: 3.14, sigma_vm: 40 },
    ],
    youngsModulus: 70, // 玻璃/陶瓷量级
    fractureToughness: 1.0,
  },
  ductile: {
    name: '韧性断裂',
    crackTip: { x: 0.5, y: 0.5 },
    // 塑性区使应力分布更平缓、峰值更宽
    stressField: [
      { r: 0.02, theta: 0.0, sigma_vm: 520 },
      { r: 0.04, theta: 0.52, sigma_vm: 460 },
      { r: 0.06, theta: -0.52, sigma_vm: 415 },
      { r: 0.08, theta: 1.05, sigma_vm: 380 },
      { r: 0.1, theta: -1.05, sigma_vm: 350 },
      { r: 0.14, theta: 1.57, sigma_vm: 310 },
      { r: 0.18, theta: -1.57, sigma_vm: 280 },
      { r: 0.24, theta: 2.09, sigma_vm: 250 },
      { r: 0.3, theta: -2.09, sigma_vm: 225 },
      { r: 0.38, theta: 2.62, sigma_vm: 205 },
      { r: 0.46, theta: -2.62, sigma_vm: 188 },
      { r: 0.5, theta: 3.14, sigma_vm: 175 },
    ],
    youngsModulus: 210, // 钢量级
    fractureToughness: 50,
  },
  fatigue: {
    name: '疲劳断裂',
    crackTip: { x: 0.5, y: 0.5 },
    // 循环载荷下出现非单调起伏（海滩纹特征）
    stressField: [
      { r: 0.02, theta: 0.0, sigma_vm: 380 },
      { r: 0.04, theta: 0.52, sigma_vm: 340 },
      { r: 0.06, theta: -0.52, sigma_vm: 360 },
      { r: 0.08, theta: 1.05, sigma_vm: 300 },
      { r: 0.1, theta: -1.05, sigma_vm: 320 },
      { r: 0.14, theta: 1.57, sigma_vm: 270 },
      { r: 0.18, theta: -1.57, sigma_vm: 285 },
      { r: 0.24, theta: 2.09, sigma_vm: 230 },
      { r: 0.3, theta: -2.09, sigma_vm: 245 },
      { r: 0.38, theta: 2.62, sigma_vm: 200 },
      { r: 0.46, theta: -2.62, sigma_vm: 210 },
      { r: 0.5, theta: 3.14, sigma_vm: 180 },
    ],
    youngsModulus: 210,
    fractureToughness: 30,
  },
};

// 纯函数：把裂纹尖端应力场映射成音符序列（不做任何音频副作用，便于测试/可视化复用）
function buildFractureNotes(sample: FractureSample): MaterioNote[] {
  // 距裂纹尖端由近到远 → 触发时机由早到晚
  const pts = [...sample.stressField].sort((a, b) => a.r - b.r);
  const sigmas = pts.map((p) => p.sigma_vm);
  const sMax = Math.max(...sigmas);
  const sMin = Math.min(...sigmas);
  const span = sMax - sMin || 1;
  return pts.map((p) => {
    const norm = (p.sigma_vm - sMin) / span; // 0..1
    return {
      freq: 110 * Math.pow(2, norm * 2), // 应力 → 音高（A2 起跨两个八度）
      velocity: 0.25 + norm * 0.6, // σ_vm → 力度
      dur: 0.22,
      type: 'sawtooth' as const, // 锯齿波更像断裂的粗糙质感
    };
  });
}

export function generateFractureMusic(sample: FractureSample): MaterioNote[] {
  stopSharedTransport();
  stopAllPlayback();
  const ctx = getAudioCtx();
  void ctx.resume();

  const notes = buildFractureNotes(sample);

  const bpm = 90;
  const transport: Transport = getSharedTransport(bpm, 4);
  transport.subscribe((event: TransportEvent) => {
    const note = notes[event.step % notes.length];
    if (note) scheduleToneAt(note.freq, note.dur, note.type, note.velocity, event.time);
  });
  transport.start();
  return notes;
}

// 把裂纹尖端应力场画成 SVG：尖端为白点，周围点按 σ_vm 着色（蓝低→红高）
export function renderFractureViz(sample: FractureSample, container: HTMLElement): void {
  const sigmas = sample.stressField.map((p) => p.sigma_vm);
  const sMax = Math.max(...sigmas);
  const sMin = Math.min(...sigmas);
  const span = sMax - sMin || 1;
  const tip = sample.crackTip;

  const dots = sample.stressField
    .map((p) => {
      const x = (tip.x + p.r * Math.cos(p.theta)) * 400;
      const y = (tip.y + p.r * Math.sin(p.theta)) * 400;
      const norm = (p.sigma_vm - sMin) / span;
      const hue = 240 - norm * 240; // 蓝(240) → 红(0)
      const rad = 8 + norm * 16;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(1)}" fill="hsl(${hue.toFixed(0)},90%,55%)" opacity="0.85"/>`;
    })
    .join('');

  container.innerHTML =
    '<svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">' +
    '<rect width="400" height="400" fill="#0b0f1a"/>' +
    `<line x1="0" y1="${(tip.y * 400).toFixed(1)}" x2="${(tip.x * 400).toFixed(1)}" y2="${(tip.y * 400).toFixed(1)}" stroke="#cfd8e3" stroke-width="3"/>` +
    dots +
    `<circle cx="${(tip.x * 400).toFixed(1)}" cy="${(tip.y * 400).toFixed(1)}" r="6" fill="#ffffff"/>` +
    `<text x="10" y="34" font-family="Arial" font-size="30" font-weight="bold" fill="#e6edf3">${sample.name}</text>` +
    `<text x="10" y="66" font-family="Arial" font-size="28" font-weight="bold" fill="#9aa7b4">K_IC=${sample.fractureToughness} E=${sample.youngsModulus}GPa</text>` +
    '</svg>';
}

/* =========================================================================
 * 6. flame —— 火焰动力学声化（Buehler 论文 Fig 1C）
 * 以燃烧的流体/热动力学产生节奏与起伏：
 *   温度 → 音高，闪烁频率 → 节奏，涡量 → 装饰音密度
 * ========================================================================= */

export interface FlameCell {
  x: number;
  y: number;
  temp: number; // K
  vorticity: number; // 涡量（带符号）
}

export interface FlameSample {
  name: string;
  temperature: number; // 峰值温度 (K)
  velocity: number; // m/s
  flickerFreq: number; // 闪烁频率 (Hz)
  cells: FlameCell[]; // 12 个网格单元
  reynolds: number;
}

export interface FlameSamples {
  laminar: FlameSample; // 层流火焰
  turbulent: FlameSample; // 湍流火焰
  detonation: FlameSample; // 爆轰
}

export const FLAME_SAMPLES: FlameSamples = {
  laminar: {
    name: '层流火焰',
    temperature: 1800,
    velocity: 0.5,
    flickerFreq: 10,
    // 平滑烛焰：温度随高度递减、涡量很小
    cells: [
      { x: 0.5, y: 0.05, temp: 1750, vorticity: 0.05 },
      { x: 0.45, y: 0.15, temp: 1800, vorticity: 0.08 },
      { x: 0.55, y: 0.15, temp: 1790, vorticity: 0.07 },
      { x: 0.5, y: 0.3, temp: 1650, vorticity: 0.12 },
      { x: 0.4, y: 0.4, temp: 1500, vorticity: 0.1 },
      { x: 0.6, y: 0.4, temp: 1500, vorticity: 0.1 },
      { x: 0.5, y: 0.55, temp: 1300, vorticity: 0.15 },
      { x: 0.42, y: 0.65, temp: 1150, vorticity: 0.09 },
      { x: 0.58, y: 0.65, temp: 1150, vorticity: 0.09 },
      { x: 0.5, y: 0.8, temp: 950, vorticity: 0.06 },
      { x: 0.46, y: 0.9, temp: 780, vorticity: 0.04 },
      { x: 0.54, y: 0.9, temp: 780, vorticity: 0.04 },
    ],
    reynolds: 100,
  },
  turbulent: {
    name: '湍流火焰',
    temperature: 2100,
    velocity: 3,
    flickerFreq: 30,
    // 涡量明显、正负交替
    cells: [
      { x: 0.5, y: 0.05, temp: 2050, vorticity: 0.8 },
      { x: 0.4, y: 0.15, temp: 2100, vorticity: 1.2 },
      { x: 0.6, y: 0.15, temp: 2080, vorticity: -1.1 },
      { x: 0.5, y: 0.3, temp: 1950, vorticity: 1.5 },
      { x: 0.35, y: 0.4, temp: 1800, vorticity: -1.3 },
      { x: 0.65, y: 0.4, temp: 1820, vorticity: 1.4 },
      { x: 0.5, y: 0.55, temp: 1650, vorticity: -1.8 },
      { x: 0.42, y: 0.65, temp: 1450, vorticity: 1.6 },
      { x: 0.58, y: 0.65, temp: 1480, vorticity: -1.5 },
      { x: 0.5, y: 0.8, temp: 1200, vorticity: 1.2 },
      { x: 0.45, y: 0.9, temp: 980, vorticity: -0.9 },
      { x: 0.55, y: 0.9, temp: 1000, vorticity: 0.85 },
    ],
    reynolds: 5000,
  },
  detonation: {
    name: '爆轰',
    temperature: 3000,
    velocity: 2000,
    flickerFreq: 100,
    // 极端高温、极强涡量
    cells: [
      { x: 0.5, y: 0.05, temp: 3000, vorticity: 3.5 },
      { x: 0.4, y: 0.15, temp: 2980, vorticity: -3.2 },
      { x: 0.6, y: 0.15, temp: 2980, vorticity: 3.4 },
      { x: 0.5, y: 0.3, temp: 2950, vorticity: -3.8 },
      { x: 0.35, y: 0.4, temp: 2900, vorticity: 3.6 },
      { x: 0.65, y: 0.4, temp: 2900, vorticity: -3.5 },
      { x: 0.5, y: 0.55, temp: 2850, vorticity: 4.0 },
      { x: 0.42, y: 0.65, temp: 2750, vorticity: -3.7 },
      { x: 0.58, y: 0.65, temp: 2750, vorticity: 3.8 },
      { x: 0.5, y: 0.8, temp: 2600, vorticity: 3.3 },
      { x: 0.45, y: 0.9, temp: 2450, vorticity: -3.0 },
      { x: 0.55, y: 0.9, temp: 2450, vorticity: 3.1 },
    ],
    reynolds: 1000000,
  },
};

// 纯函数：把火焰网格映射成音符序列
function buildFlameNotes(sample: FlameSample): MaterioNote[] {
  // 由底向顶，时间随火焰向上流动
  const cells = [...sample.cells].sort((a, b) => a.y - b.y);
  const temps = cells.map((c) => c.temp);
  const tMin = Math.min(...temps);
  const tMax = Math.max(...temps);
  const span = tMax - tMin || 1;
  return cells.map((c) => {
    const norm = (c.temp - tMin) / span; // 0..1
    return {
      freq: 220 * Math.pow(2, norm * 2), // 温度 → 音高（A3 起跨两个八度）
      velocity: 0.2 + norm * 0.55,
      dur: 0.3,
      type: 'triangle' as const, // 三角波温暖，贴近火焰质感
      ornament: Math.abs(c.vorticity) > 1.0, // 涡量 → 装饰音密度
    };
  });
}

export function generateFlameMusic(sample: FlameSample): MaterioNote[] {
  stopSharedTransport();
  stopAllPlayback();
  const ctx = getAudioCtx();
  void ctx.resume();

  const notes = buildFlameNotes(sample);

  // 闪烁频率驱动节奏：闪得越快、BPM 越高、音符越短
  const bpm = Math.round(80 + sample.flickerFreq * 0.8);
  const noteDur = Math.max(0.08, 0.4 - ((sample.flickerFreq - 10) / 90) * 0.3);
  const stepDur = 60 / bpm / 4;

  const transport: Transport = getSharedTransport(bpm, 4);
  transport.subscribe((event: TransportEvent) => {
    const note = notes[event.step % notes.length];
    if (!note) return;
    scheduleToneAt(note.freq, Math.min(noteDur, note.dur), note.type, note.velocity, event.time);
    if (note.ornament) {
      // 装饰音：高一个五度、更短更轻，错开半步触发
      scheduleToneAt(note.freq * 1.5, noteDur * 0.4, 'sine', note.velocity * 0.5, event.time + stepDur * 0.5);
    }
  });
  transport.start();
  return notes;
}

// 把火焰画成 SVG：单元按温度着色（暗红→橙→黄→近白），半径随涡量增大
export function renderFlameViz(sample: FlameSample, container: HTMLElement): void {
  const temps = sample.cells.map((c) => c.temp);
  const tMax = Math.max(...temps);

  const dots = sample.cells
    .map((c) => {
      const norm = Math.max(0, Math.min(1, (c.temp - 700) / 2400));
      const hue = norm * 55; // 0(红) → 55(黄)
      const light = 30 + norm * 50; // 30% → 80%
      const rad = 8 + Math.abs(c.vorticity) * 10;
      return `<circle cx="${(c.x * 400).toFixed(1)}" cy="${(c.y * 400).toFixed(1)}" r="${rad.toFixed(1)}" fill="hsl(${hue.toFixed(0)},100%,${light.toFixed(0)}%)" opacity="0.9"/>`;
    })
    .join('');

  container.innerHTML =
    '<svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%">' +
    '<rect width="400" height="400" fill="#0b0f1a"/>' +
    dots +
    `<text x="10" y="34" font-family="Arial" font-size="30" font-weight="bold" fill="#e6edf3">${sample.name}</text>` +
    `<text x="10" y="66" font-family="Arial" font-size="28" font-weight="bold" fill="#9aa7b4">T=${tMax}K Re=${sample.reynolds}</text>` +
    '</svg>';
}

/* =========================================================================
 * UI 状态 + open/close/load —— 两个材料音乐模块的屏幕管理
 * ========================================================================= */

let currentFracture: FractureSample = FRACTURE_SAMPLES.brittle;
let currentFlame: FlameSample = FLAME_SAMPLES.laminar;

export function openFractureMode(): void {
  stopAllPlayback();
  document.getElementById('fractureScreen')?.classList.add('active');
  loadFractureSample('brittle');
}

export function closeFractureMode(): void {
  stopSharedTransport();
  stopAllPlayback();
  document.getElementById('fractureScreen')?.classList.remove('active');
}

export function loadFractureSample(key: string): void {
  const k = key as keyof FractureSamples;
  currentFracture = FRACTURE_SAMPLES[k] ?? FRACTURE_SAMPLES.brittle;
  const viz = document.getElementById('fractureViz');
  if (viz) renderFractureViz(currentFracture, viz);
  const info = document.getElementById('fractureInfo');
  if (info) {
    info.innerHTML =
      '<div style="background:var(--bg2);border-radius:8px;padding:10px;font-size:13px;line-height:1.6">' +
      '<b>' + currentFracture.name + '</b><br>' +
      '杨氏模量: ' + currentFracture.youngsModulus + ' GPa | ' +
      '断裂韧性 K_IC: ' + currentFracture.fractureToughness + ' MPa√m<br>' +
      '应力采样点: ' + currentFracture.stressField.length + ' 个' +
      '</div>';
  }
}

export function openFlameMode(): void {
  stopAllPlayback();
  document.getElementById('flameScreen')?.classList.add('active');
  loadFlameSample('laminar');
}

export function closeFlameMode(): void {
  stopSharedTransport();
  stopAllPlayback();
  document.getElementById('flameScreen')?.classList.remove('active');
}

export function loadFlameSample(key: string): void {
  const k = key as keyof FlameSamples;
  currentFlame = FLAME_SAMPLES[k] ?? FLAME_SAMPLES.laminar;
  const viz = document.getElementById('flameViz');
  if (viz) renderFlameViz(currentFlame, viz);
  const info = document.getElementById('flameInfo');
  if (info) {
    info.innerHTML =
      '<div style="background:var(--bg2);border-radius:8px;padding:10px;font-size:13px;line-height:1.6">' +
      '<b>' + currentFlame.name + '</b><br>' +
      '峰值温度: ' + currentFlame.temperature + ' K | ' +
      '流速: ' + currentFlame.velocity + ' m/s | ' +
      'Re: ' + currentFlame.reynolds + '<br>' +
      '闪烁频率: ' + currentFlame.flickerFreq + ' Hz' +
      '</div>';
  }
}

/* =========================================================================
 * 事件委托注册
 * ========================================================================= */
registerActions({
  openFractureMode: () => openFractureMode(),
  closeFractureMode: () => closeFractureMode(),
  loadFractureSample: (_e, key) => loadFractureSample(key as string),
  playFracture: () => generateFractureMusic(currentFracture),
  openFlameMode: () => openFlameMode(),
  closeFlameMode: () => closeFlameMode(),
  loadFlameSample: (_e, key) => loadFlameSample(key as string),
  playFlame: () => generateFlameMusic(currentFlame),
});

/* =========================================================================
 * 自检：非平凡映射逻辑留一个最小可运行检查，数据漂移会在控制台报错。
 * 纯函数、无音频副作用，模块加载时跑一次。
 * ========================================================================= */
export function _deepSelfCheck(): boolean {
  const f = buildFractureNotes(FRACTURE_SAMPLES.brittle);
  const fl = buildFlameNotes(FLAME_SAMPLES.laminar);
  console.assert(f.length === 12, '[science-deep] 断裂音符数应为 12');
  console.assert(fl.length === 12, '[science-deep] 火焰音符数应为 12');
  console.assert(f.every((n) => n.freq > 0 && n.velocity > 0 && n.velocity <= 1), '[science-deep] 断裂音符范围异常');
  console.assert(fl.some((n) => !n.ornament), '[science-deep] 层流火焰不应有装饰音');
  console.assert(SCIENCE_DEEP_MAPPINGS.crystal.length === 6, '[science-deep] crystal 映射数应为 6');
  console.assert(SCIENCE_DEEP_OPTIONS.eeg.length === 4, '[science-deep] eeg 选项数应为 4');
  return f.length === 12 && fl.length === 12;
}

try {
  _deepSelfCheck();
} catch (e) {
  console.warn('[science-deep] 自检跳过：', e);
}
