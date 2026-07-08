import { Store, LS_KEYS } from './store';
import { localSet } from './storage';
import { playCorrect, scheduleToneAt, getSharedTransport, stopSharedTransport } from './audio';
import { escapeHtml } from './utils';
import { stopAllPlayback, checkAchievements, isFreeModeUnlocked } from './game-engine';
import { t } from './i18n';
import { showToast } from './ui-feedback';
import { getAudioCtx, scheduleKickAt, scheduleSnareAt } from './audio';
import { registerActions, registerInputs } from './events';
import type { Transport, TransportEvent } from './core/transport';
import {
  featureVector,
  findPeaks,
  normalize,
  resample,
  movingAverage,
  autocorrelation,
  dominantFrequency,
} from './science/signal';
import { parseScienceFile, ParseResult } from './science/parser';
import { exportScience, patternToMidi, patternToCSV, patternToJSON } from './science/export';
import {
  SCIENCE_DEEP_SAMPLES,
  SCIENCE_DEEP_SCHEMA,
  SCIENCE_DEEP_TYPE_NAMES,
  SCIENCE_DEEP_MAPPINGS,
  SCIENCE_DEEP_OPTIONS,
} from './science-deep';

export const SCIENCE_SAMPLES = {
  dft: {
    name: '硅(Si)能带结构',
    kpoints: [0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5],
    energies: [-5.2, -4.1, -2.8, -1.2, -0.3, 0.5, 1.6, 2.4, 3.1, 2.7, 1.5],
    bandgap: 0.8,
    fermi: 0,
  },
  md: {
    name: '水分子(H₂O)动力学',
    frames: [
      { t: 0, x: 0.02, y: 0.01, z: 0.005 },
      { t: 0.01, x: 0.03, y: 0.02, z: 0.01 },
      { t: 0.02, x: 0.01, y: 0.03, z: 0.008 },
      { t: 0.03, x: -0.01, y: 0.02, z: 0.012 },
      { t: 0.04, x: -0.02, y: 0.01, z: 0.006 },
      { t: 0.05, x: 0.0, y: 0.0, z: 0.003 },
      { t: 0.06, x: 0.015, y: -0.01, z: 0.009 },
      { t: 0.07, x: 0.025, y: 0.0, z: 0.014 },
      { t: 0.08, x: 0.02, y: 0.02, z: 0.01 },
      { t: 0.09, x: 0.005, y: 0.025, z: 0.007 },
      { t: 0.1, x: -0.01, y: 0.02, z: 0.004 },
      { t: 0.11, x: -0.02, y: 0.005, z: 0.008 },
      { t: 0.12, x: -0.015, y: -0.005, z: 0.011 },
      { t: 0.13, x: 0.0, y: -0.01, z: 0.013 },
      { t: 0.14, x: 0.015, y: 0.0, z: 0.009 },
      { t: 0.15, x: 0.03, y: 0.01, z: 0.006 },
      { t: 0.16, x: 0.025, y: 0.02, z: 0.004 },
      { t: 0.17, x: 0.01, y: 0.025, z: 0.008 },
      { t: 0.18, x: -0.01, y: 0.02, z: 0.012 },
      { t: 0.19, x: -0.02, y: 0.005, z: 0.01 },
    ],
    distances: [2.5, 2.7, 3.1, 2.8, 2.4, 2.6, 3.0, 3.3, 2.9, 2.5, 2.3, 2.7, 3.2, 3.5, 3.1, 2.8, 2.6, 2.4, 2.9, 3.1],
    frequencies: [
      1595, 3657, 3756, 1600, 3640, 3760, 1590, 3665, 3750, 1605, 3635, 3765, 1588, 3670, 3745, 1610, 3630, 3770, 1592,
      3660,
    ],
    temp: 300,
  },
  fem: {
    name: '悬臂梁应力分析',
    nodes: [
      { id: 0, stress: 120, displacement: 0.0 },
      { id: 1, stress: 145, displacement: 0.02 },
      { id: 2, stress: 180, displacement: 0.05 },
      { id: 3, stress: 220, displacement: 0.09 },
      { id: 4, stress: 265, displacement: 0.14 },
      { id: 5, stress: 310, displacement: 0.2 },
      { id: 6, stress: 350, displacement: 0.27 },
      { id: 7, stress: 290, displacement: 0.35 },
      { id: 8, stress: 240, displacement: 0.44 },
      { id: 9, stress: 195, displacement: 0.54 },
      { id: 10, stress: 160, displacement: 0.65 },
      { id: 11, stress: 135, displacement: 0.77 },
      { id: 12, stress: 125, displacement: 0.9 },
      { id: 13, stress: 130, displacement: 1.04 },
      { id: 14, stress: 150, displacement: 1.19 },
      { id: 15, stress: 185, displacement: 1.35 },
    ],
    elements: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
    modes: [220, 440, 660, 880, 1100],
  },
  cfd: {
    name: '圆柱绕流',
    cells: [
      { x: 0, y: 0, velocity: 0.5, pressure: 1.0, vorticity: 0.1 },
      { x: 0.1, y: 0.05, velocity: 1.2, pressure: 0.9, vorticity: 0.5 },
      { x: 0.2, y: 0.1, velocity: 2.1, pressure: 0.75, vorticity: 1.2 },
      { x: 0.3, y: 0.15, velocity: 1.8, pressure: 0.8, vorticity: 0.8 },
      { x: 0.4, y: 0.2, velocity: 0.9, pressure: 0.95, vorticity: 0.3 },
      { x: 0.5, y: 0.25, velocity: 0.3, pressure: 1.05, vorticity: 0.1 },
      { x: 0.6, y: 0.3, velocity: 1.5, pressure: 0.82, vorticity: 0.6 },
      { x: 0.7, y: 0.35, velocity: 2.5, pressure: 0.65, vorticity: 1.5 },
      { x: 0.8, y: 0.4, velocity: 1.9, pressure: 0.72, vorticity: 1.0 },
      { x: 0.9, y: 0.45, velocity: 1.1, pressure: 0.88, vorticity: 0.4 },
      { x: 1.0, y: 0.5, velocity: 0.6, pressure: 0.98, vorticity: 0.2 },
      { x: 1.1, y: 0.55, velocity: 0.2, pressure: 1.08, vorticity: 0.05 },
      { x: 1.2, y: 0.6, velocity: 1.3, pressure: 0.85, vorticity: 0.7 },
      { x: 1.3, y: 0.65, velocity: 2.3, pressure: 0.68, vorticity: 1.3 },
      { x: 1.4, y: 0.7, velocity: 2.0, pressure: 0.74, vorticity: 0.9 },
      { x: 1.5, y: 0.75, velocity: 1.4, pressure: 0.86, vorticity: 0.5 },
      { x: 1.6, y: 0.8, velocity: 0.8, pressure: 0.96, vorticity: 0.25 },
      { x: 1.7, y: 0.85, velocity: 0.4, pressure: 1.04, vorticity: 0.08 },
      { x: 1.8, y: 0.9, velocity: 1.0, pressure: 0.92, vorticity: 0.45 },
      { x: 1.9, y: 0.95, velocity: 2.2, pressure: 0.7, vorticity: 1.1 },
    ],
    reynolds: 1000,
  },
  xrd: {
    name: 'NaCl 粉末衍射',
    angles: [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80],
    intensities: [5, 12, 8, 45, 90, 35, 20, 110, 75, 30, 15, 60, 40, 10, 18],
    wavelength: 1.54,
    lattice: 5.64,
  },
  dna: {
    name: 'λ 噬菌体 DNA 序列',
    sequence:
      'ATGCGATCGTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGC',
    gc: 0.48,
  },
  pulsar: {
    name: '蟹状星云脉冲星 B0531+21',
    periods: [33.1, 33.2, 33.0, 33.3, 33.2, 33.1, 33.0, 33.2, 33.1, 33.3, 33.2, 33.0, 33.1, 33.2, 33.1, 33.0],
    flux: [1.2, 1.5, 1.3, 1.8, 1.6, 1.4, 1.2, 1.7, 1.5, 1.9, 1.6, 1.3, 1.4, 1.8, 1.5, 1.3],
    dm: 56.8,
  },
};
/* ===== REAL SCIENCE SAMPLES（真实科学数据样本） ===== */
export const SCIENCE_REAL_SAMPLES = {
  dft: {
    name: 'CSH NEP 等效能带（真实科学数据）',
    source: 'NEP_CPU/test_nep/stress_strain.out (PE mapped to levels)',
    kpoints: [0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45],
    energies: [-13.636, -8.874, 8.896, 30.804, 38.368, 39.861, 40.973, 43.581, 44.843, 40.777],
    fermi: 15.6035,
    bandgap: 7.0175,
    unit: 'eV (relative)',
  },
  md: {
    name: 'CSH NEP 分子动力学（真实科学数据）',
    source: 'NEP_CPU/test_nep/traj_long.xyz + thermo.out',
    frames: [
      {
        t: 0.0,
        x: -0.277,
        y: -0.4612,
        z: 4.7413,
        vx: -0.007847,
        vy: -0.002786,
        vz: -0.017376,
      },
      {
        t: 5.0,
        x: -0.277,
        y: -0.4612,
        z: 4.7412,
        vx: -0.007907,
        vy: -0.002817,
        vz: -0.017481,
      },
      {
        t: 10.0,
        x: -0.2771,
        y: -0.4612,
        z: 4.7411,
        vx: -0.007966,
        vy: -0.002848,
        vz: -0.017586,
      },
      {
        t: 15.0,
        x: -0.2771,
        y: -0.4612,
        z: 4.741,
        vx: -0.008026,
        vy: -0.002879,
        vz: -0.01769,
      },
      {
        t: 20.0,
        x: -0.2771,
        y: -0.4612,
        z: 4.7409,
        vx: -0.008085,
        vy: -0.002911,
        vz: -0.017794,
      },
      {
        t: 25.0,
        x: -0.2772,
        y: -0.4613,
        z: 4.7409,
        vx: -0.008144,
        vy: -0.002942,
        vz: -0.017899,
      },
      {
        t: 30.0,
        x: -0.2772,
        y: -0.4613,
        z: 4.7408,
        vx: -0.008203,
        vy: -0.002974,
        vz: -0.018003,
      },
      {
        t: 35.0,
        x: -0.2773,
        y: -0.4613,
        z: 4.7407,
        vx: -0.008262,
        vy: -0.003007,
        vz: -0.018107,
      },
      {
        t: 40.0,
        x: -0.2773,
        y: -0.4613,
        z: 4.7406,
        vx: -0.008322,
        vy: -0.003039,
        vz: -0.018211,
      },
      {
        t: 45.0,
        x: -0.2773,
        y: -0.4613,
        z: 4.7405,
        vx: -0.008381,
        vy: -0.003072,
        vz: -0.018315,
      },
      {
        t: 50.0,
        x: -0.2774,
        y: -0.4613,
        z: 4.7404,
        vx: -0.00844,
        vy: -0.003105,
        vz: -0.018419,
      },
      {
        t: 55.0,
        x: -0.2774,
        y: -0.4614,
        z: 4.7403,
        vx: -0.008499,
        vy: -0.003139,
        vz: -0.018524,
      },
      {
        t: 60.0,
        x: -0.2775,
        y: -0.4614,
        z: 4.7402,
        vx: -0.008558,
        vy: -0.003173,
        vz: -0.018628,
      },
      {
        t: 65.0,
        x: -0.2775,
        y: -0.4614,
        z: 4.7401,
        vx: -0.008618,
        vy: -0.003207,
        vz: -0.018733,
      },
      {
        t: 70.0,
        x: -0.2776,
        y: -0.4614,
        z: 4.74,
        vx: -0.008678,
        vy: -0.003242,
        vz: -0.018839,
      },
      {
        t: 75.0,
        x: -0.2776,
        y: -0.4614,
        z: 4.7399,
        vx: -0.008737,
        vy: -0.003277,
        vz: -0.018945,
      },
      {
        t: 80.0,
        x: -0.2776,
        y: -0.4614,
        z: 4.7398,
        vx: -0.008797,
        vy: -0.003312,
        vz: -0.019051,
      },
    ],
    distances: [
      0.0001, 0.0001, 0.0001, 0.0001, 0.0001, 0.0001, 0.0001, 0.0001, 0.0001, 0.0001, 0.0001, 0.0001, 0.0001, 0.0001,
      0.0001, 0.0001,
    ],
    frequencies: [
      1230.0, 26250.0, 3900.0, 6890.0, 6110.0, 1490.0, 1090.0, 2360.0, 2080.0, 3130.0, 5820.0, 8520.0, 6500.0, 1420.0,
      2680.0, 2620.0,
    ],
    temp: 271.53,
    pe: [
      -455.449, -456.364, -454.82, -454.513, -454.089, -454.417, -454.584, -454.482, -454.621, -454.61, -454.266,
      -454.692, -454.134, -454.47, -454.422, -454.771, -454.471,
    ],
    ke: [
      0.0780945, 1.10597, 2.17622, 2.25039, 2.5053, 2.2321, 2.53814, 2.33702, 2.24962, 2.4372, 2.39569, 2.2507, 2.53398,
      2.23039, 2.3134, 2.4047, 2.35736,
    ],
  },
  fem: {
    name: 'CSH 应力-应变 FEM（真实科学数据）',
    source: 'NEP_CPU/test_nep/stress_strain.out',
    nodes: [
      {
        id: 0,
        x: 0,
        y: 0.0586,
        z: -0.0473,
        displacement: 0.0432,
      },
      {
        id: 1,
        x: 1,
        y: 0.1228,
        z: -0.1567,
        displacement: 0.1369,
      },
      {
        id: 2,
        x: 2,
        y: 0.1933,
        z: -0.3305,
        displacement: 0.38,
      },
      {
        id: 3,
        x: 3,
        y: 0.2095,
        z: -0.4333,
        displacement: 0.6809,
      },
      {
        id: 4,
        x: 4,
        y: 0.2174,
        z: -0.4479,
        displacement: 0.9023,
      },
      {
        id: 5,
        x: 5,
        y: 0.2444,
        z: -0.4609,
        displacement: 1.0607,
      },
      {
        id: 6,
        x: 6,
        y: 0.2969,
        z: -0.4639,
        displacement: 1.1927,
      },
      {
        id: 7,
        x: 7,
        y: 0.3678,
        z: -0.4549,
        displacement: 1.3043,
      },
      {
        id: 8,
        x: 8,
        y: 0.4524,
        z: -0.4398,
        displacement: 1.3959,
      },
      {
        id: 9,
        x: 9,
        y: 0.5453,
        z: -0.408,
        displacement: 1.4634,
      },
    ],
    modes: [30.2794, 30.0792, 31.761, 32.8434, 32.5737, 32.4398, 31.966, 31.351, 31.9172, 32.7057],
    stress: [0.8568, 1.0141, 0.2009, 0.6663, 0.2929, 0.1322, 0.3305, 0.4966, 0.5026, 0.4906],
    strain_xx: [0.0244, 0.0867, 0.2281, 0.3875, 0.4911, 0.5483, 0.5806, 0.6004, 0.6126, 0.6232],
    load: 0.4984,
  },
};

export const SCIENCE_SCHEMA = {
  dft: '{ name, kpoints: [...], energies: [...], bandgap, fermi }',
  md: '{ name, frames: [{t, x, y, z}], distances: [...], frequencies: [...], temp }',
  fem: '{ name, nodes: [{id, stress, displacement}], elements: [...], modes: [...] }',
  cfd: '{ name, cells: [{x, y, velocity, pressure, vorticity}], reynolds }',
  xrd: '{ name, angles: [...], intensities: [...], wavelength, lattice }',
  dna: '{ name, sequence: "AGCT...", gc: 0.5 }',
  pulsar: '{ name, periods: [...], flux: [...], dm }',
};

export const SCIENCE_TYPE_NAMES = {
  dft: 'DFT 密度泛函',
  md: 'MD 分子动力学',
  fem: 'FEM 有限元',
  cfd: 'CFD 计算流体力学',
  xrd: 'XRD 晶体衍射',
  dna: 'DNA 序列',
  pulsar: '脉冲星/天文',
};

export const SCIENCE_MAPPINGS = {
  dft: [
    {
      id: 'ks',
      title: 'Kohn-Sham方程 ↔ 多声部生成系统',
      desc: '每个Kohn-Sham方程对应一个独立声部，自洽迭代让声部互相调整直到和谐。',
    },
    { id: 'bands', title: '能带结构 ↔ 离散音高集合', desc: 'k-path对应时间，能带能量对应旋律音高，能隙决定休止区间。' },
    { id: 'density', title: '电子密度ρ(r) ↔ 织体密度', desc: '电子密度高的区域产生更多同时发声的音符，形成厚实织体。' },
    { id: 'bz', title: '布里渊区 ↔ 曲式结构', desc: '布里渊区的高对称点成为乐段标记，划分乐曲的宏观结构。' },
    { id: 'pw', title: '平面波展开 ↔ 泛音列', desc: '平面波基组截断决定泛音数量，影响音色明亮度。' },
    { id: 'pseudo', title: '赝势 ↔ 简化记谱', desc: '赝势省略内层电子，对应音乐中抑制低声部以突出主干旋律。' },
    { id: 'soc', title: '自旋轨道耦合 ↔ 双声部对位', desc: '自旋向上与向下分裂为两条相互呼应的独立旋律线。' },
  ],
  md: [
    { id: 'newton', title: '牛顿方程 ↔ 音乐动力学', desc: '力驱动音量和织体变化，位置决定音高，速度决定节奏密度。' },
    { id: 'dt', title: '时间步长Δt ↔ 最小律动单元', desc: '时间步长映射为最小节奏细分单位，决定最快运动粒度。' },
    { id: 'verlet', title: 'Verlet算法 ↔ 前后向参考节奏', desc: 'velocity-Verlet产生预测-校正式的预进/回声节奏型。' },
    { id: 'pes', title: '势能面 ↔ 和声张力景观', desc: '势能极小值对应稳定和弦，极大值对应不协和，鞍点对应过渡。' },
    { id: 'ensemble', title: '系综 ↔ 统计音乐', desc: '温度控制随机性，压力控制织体密度，系综决定整体音乐质感。' },
    { id: 'rdf', title: '径向分布函数g(r) ↔ 音程分布', desc: 'g(r)的峰对应偏好音程，塑造旋律走向的统计特征。' },
    { id: 'msd', title: '均方位移MSD ↔ 旋律游走性', desc: '高MSD对应游走旋律，低MSD对应重复动机与固定音型。' },
    { id: 'phase', title: '相变 ↔ 风格突变', desc: '相变点触发音乐风格突变，如节奏裂变或调性转换。' },
  ],
  fem: [
    {
      id: 'weak',
      title: '弱形式/变分原理 ↔ 整体优先于局部',
      desc: '整体解决定局部细节，音乐创作以整体听觉效果为首要目标。',
    },
    { id: 'mesh', title: '网格离散化 ↔ 不规则小节线', desc: '网格密度决定小节长度与拍号变化，密网格对应细分节奏。' },
    { id: 'shape', title: '形函数 ↔ 局部动机', desc: '形函数是局部旋律动机，通过叠加发展成全局主题。' },
    {
      id: 'stiff',
      title: '刚度矩阵K ↔ 声部耦合约束',
      desc: '矩阵特征值对应自然和弦音，非对角项决定声部之间的对位关系。',
    },
    {
      id: 'load',
      title: '载荷向量F ↔ 外部驱动力',
      desc: '集中力对应sfz重音，分布力对应crescendo，周期力对应tremolo。',
    },
    { id: 'bc', title: '边界条件 ↔ 结构约束', desc: 'Dirichlet边界对应固定音高，Neumann边界对应固定动态斜率。' },
    { id: 'modal', title: '模态分析 ↔ 自然振动模式', desc: '模态振型映射为和弦排列，固有频率映射为和弦音。' },
    { id: 'nonlinear', title: '非线性分析 ↔ 音乐复杂性', desc: '几何/材料非线性引入调性偏移与复杂节奏变化。' },
  ],
  cfd: [
    {
      id: 'ns',
      title: 'N-S方程组 ↔ 音乐动力学系统',
      desc: '连续性方程对应密度守恒，对流项对应动机传播，压力梯度对应和声张力。',
    },
    { id: 'turb', title: '湍流与涡旋 ↔ 织体能级联', desc: '涡量驱动声部自指与织体能量级联，形成丰富的层次。' },
    { id: 'bc', title: '边界条件 ↔ 乐曲结构约束', desc: '边界类型决定乐曲的锚点、循环边界与渐层结构。' },
    { id: 'shock', title: '激波捕捉 ↔ 音乐突变美学', desc: '激波面对应音乐的突变与Breakdown，人工粘性软化过渡。' },
    { id: 'multiphase', title: '多相流 ↔ 音色混合', desc: '不同相态对应不同音色，混合过程对应音色融合与渐变。' },
    {
      id: 'lag_eul',
      title: '拉格朗日vs欧拉 ↔ 创作视角',
      desc: '拉格朗日视角关注单个粒子，对应独奏旋律；欧拉视角关注场，对应背景和声织体。',
    },
    {
      id: 'simple',
      title: 'SIMPLE/PISO ↔ 节奏-和声耦合求解',
      desc: '压力-速度耦合迭代对应节奏与和声的反复协调，直到整体稳定。',
    },
  ],
  xrd: [
    {
      id: 'bragg',
      title: '布拉格定律 ↔ 节拍同步',
      desc: '2d sinθ = nλ 把晶面间距、衍射角与波长绑定，对应音乐中“周期对齐才能共振”。',
    },
    { id: 'peak', title: '衍射峰 ↔ 主音/重音', desc: '每个衍射峰对应一个被放大的晶面族，映射为旋律中的重音或主音。' },
    { id: 'intensity', title: '峰强 ↔ 力度/音色厚度', desc: '强度越高，音符力度越大、织体越厚，反映晶体结构有序度。' },
    { id: 'lattice', title: '晶格常数 ↔ 基础音程', desc: '晶格常数决定布拉格角的位置，映射为基础音程或调式根音。' },
    { id: 'pattern', title: '指纹图谱 ↔ 主题辨识度', desc: '独特的衍射图谱如同音乐主题，可用于“识别”不同晶体结构。' },
  ],
  dna: [
    { id: 'atgc', title: '四碱基 ↔ 四音集合', desc: 'A/T/G/C 四种碱基映射为四个固定音高，序列即旋律。' },
    { id: 'gc', title: 'GC含量 ↔ 和声明暗', desc: 'GC含量越高，音乐越偏向“大调/明亮”；AT含量高则偏向“小调/柔和”。' },
    {
      id: 'codon',
      title: '密码子 ↔ 三音和弦',
      desc: '每三个碱基组成一个密码子，映射为一个三音和弦，体现基因的阅读框。',
    },
    { id: 'repeat', title: '重复序列 ↔ 动机重复', desc: '卫星DNA等重复序列对应音乐中的固定音型与节奏循环。' },
    { id: 'mutation', title: '突变点 ↔ 变音/装饰音', desc: '序列中的突变或SNP映射为临时变音，带来旋律转折。' },
  ],
  pulsar: [
    {
      id: 'period',
      title: '自转周期 ↔ BPM',
      desc: '脉冲星稳定的自转周期直接映射为乐曲速度BPM，毫秒脉冲星可达几百BPM。',
    },
    { id: 'flux', title: '脉冲流量 ↔ 力度包络', desc: '每个脉冲的流量变化映射为音符力度，形成“脉冲轮廓”式的动态。' },
    {
      id: 'dm',
      title: '色散量DM ↔ 低频延迟/混响',
      desc: 'DM越大，低频脉冲到达越晚，对应音乐中低频声部的延迟或混响深度。',
    },
    { id: 'drift', title: '周期漂移 ↔ 速度渐变', desc: '周期微小漂移映射为ritardando/accelerando，表现天体演化。' },
    {
      id: 'binary',
      title: '双星系统 ↔ 对位结构',
      desc: '脉冲星在双星系统中受伴星影响，周期调制映射为两条旋律的对位。',
    },
  ],
};

export const SCIENCE_OPTIONS = {
  dft: [
    { key: 'kscale', label: 'k-scale', min: 1, max: 10, def: 5, unit: '' },
    { key: 'pitchRange', label: '能量→音高范围', min: 1, max: 24, def: 12, unit: '半音' },
    { key: 'restThresh', label: '带隙→休止阈值', min: 0, max: 100, def: 30, unit: '%' },
    { key: 'scfIters', label: 'SCF自洽迭代次数', min: 0, max: 20, def: 5, unit: '次' },
  ],
  md: [
    { key: 'noteDuration', label: '时间步→音符时长', min: 1, max: 8, def: 2, unit: '分' },
    { key: 'distanceVel', label: '速度→力度', min: 0, max: 100, def: 50, unit: '%' },
    { key: 'tempRand', label: '温度→随机性', min: 0, max: 100, def: 30, unit: '%' },
    { key: 'pitchRange', label: '势能→音高范围', min: 1, max: 24, def: 12, unit: '半音' },
    { key: 'rdfThresh', label: 'RDF峰→音程偏好', min: 0, max: 100, def: 20, unit: '%' },
  ],
  fem: [
    { key: 'measureLen', label: '网格密度→小节长度', min: 2, max: 16, def: 4, unit: '拍' },
    { key: 'chordTension', label: '应力→和弦紧张度', min: 0, max: 100, def: 50, unit: '%' },
    { key: 'voiceLeading', label: '模态→声部连接', min: 0, max: 100, def: 50, unit: '%' },
    { key: 'harmonicCount', label: '模态泛音数量', min: 1, max: 8, def: 3, unit: '个' },
  ],
  cfd: [
    { key: 'velocityDyn', label: '速度→力度', min: 0, max: 100, def: 60, unit: '%' },
    { key: 'vorticityComplex', label: '涡量→复杂度', min: 0, max: 100, def: 50, unit: '%' },
    { key: 'pressureBass', label: '压力→低音运动', min: 0, max: 100, def: 40, unit: '%' },
    { key: 'reynoldsTrans', label: 'Reynolds→转捩阈值', min: 0, max: 100, def: 50, unit: '%' },
  ],
  xrd: [
    { key: 'peakThresh', label: '峰识别阈值', min: 5, max: 95, def: 30, unit: '%' },
    { key: 'pitchRange', label: '角度→音高范围', min: 1, max: 24, def: 12, unit: '半音' },
    { key: 'intensityDyn', label: '强度→力度', min: 0, max: 100, def: 70, unit: '%' },
    { key: 'harmonics', label: '布拉格级次', min: 1, max: 5, def: 2, unit: 'n' },
  ],
  dna: [
    { key: 'baseTempo', label: '碱基→BPM', min: 60, max: 240, def: 120, unit: 'BPM' },
    { key: 'codonChord', label: '密码子→和弦', min: 0, max: 1, def: 1, unit: '' },
    { key: 'gcBrightness', label: 'GC含量→明暗', min: 0, max: 100, def: 50, unit: '%' },
    { key: 'repeatLoop', label: '重复序列→循环', min: 0, max: 1, def: 1, unit: '' },
  ],
  pulsar: [
    { key: 'baseBpm', label: '周期→BPM', min: 60, max: 300, def: 120, unit: 'BPM' },
    { key: 'fluxDyn', label: '流量→力度', min: 0, max: 100, def: 60, unit: '%' },
    { key: 'dmDelay', label: 'DM→延迟深度', min: 0, max: 100, def: 40, unit: '%' },
    { key: 'driftRate', label: '周期漂移率', min: 0, max: 100, def: 20, unit: '%' },
  ],
};

export let scienceState: any = {
  type: 'dft',
  data: JSON.parse(JSON.stringify(SCIENCE_SAMPLES.dft)),
  mapping: {},
  options: {},
  pattern: [],
  playing: false,
  transport: null as Transport | null,
  step: 0,
  visualizerBars: [],
  view: 'mode',
  whyOpen: false,
};
(function initScienceMapping() {
  const allMappings = { ...SCIENCE_MAPPINGS, ...SCIENCE_DEEP_MAPPINGS } as Record<string, { id: string }[]>;
  for (const type in allMappings) {
    scienceState.mapping[type] = {};
    allMappings[type].forEach((m, i) => (scienceState.mapping[type][m.id] = i < 3));
  }
  const allOptions = { ...SCIENCE_OPTIONS, ...SCIENCE_DEEP_OPTIONS } as Record<string, { key: string; def: number }[]>;
  for (const type in allOptions) {
    const opts: Record<string, number> = {};
    allOptions[type].forEach((o) => (opts[o.key] = o.def));
    scienceState.options[type] = opts;
  }
})();

export function openScienceMode() {
  stopAllPlayback();
  document.getElementById('scienceScreen')!.classList.add('active');
  goScienceStep('mode');
  renderScienceCompositionList();
}
export function selectScienceType(type: string) {
  scienceState.type = type;
  // Check deep samples first, then original
  const deepData = (SCIENCE_DEEP_SAMPLES as Record<string, any>)[type];
  if (deepData) {
    scienceState.data = JSON.parse(JSON.stringify(deepData));
  } else {
    scienceState.data = JSON.parse(JSON.stringify((SCIENCE_SAMPLES as Record<string, any>)[type]));
  }
  goScienceStep('data');
  renderScienceData();
  updateScienceTypeUI();
  if (!Store.state.scienceTypesUsed.includes(type)) {
    Store.state.scienceTypesUsed.push(type);
    Store.save();
    checkAchievements();
  }
}
export function goScienceStep(step: string) {
  scienceState.view = step;
  document.querySelectorAll('.science-section').forEach((s) => s.classList.remove('active'));
  const el = document.getElementById('scienceStep-' + step);
  if (el) el.classList.add('active');
  document.querySelectorAll('.science-step-tab').forEach((t) => {
    (t as HTMLElement).classList.toggle('active', (t as HTMLElement).dataset.step === step);
  });
  if (step === 'compose') renderScienceCompose();
}
export function updateScienceTypeUI() {
  document
    .querySelectorAll('.science-type-btn')
    .forEach((b) =>
      (b as HTMLElement).classList.toggle('active', (b as HTMLElement).dataset.type === scienceState.type)
    );
  const nameEl = document.getElementById('scienceTypeName');
  if (nameEl) nameEl.textContent =
    SCIENCE_TYPE_NAMES[scienceState.type as keyof typeof SCIENCE_TYPE_NAMES] ||
    SCIENCE_DEEP_TYPE_NAMES[scienceState.type as keyof typeof SCIENCE_DEEP_TYPE_NAMES] ||
    scienceState.type;
}
export function loadScienceSample() {
  const deepData = (SCIENCE_DEEP_SAMPLES as Record<string, any>)[scienceState.type];
  if (deepData) {
    scienceState.data = JSON.parse(JSON.stringify(deepData));
  } else {
    scienceState.data = JSON.parse(JSON.stringify((SCIENCE_SAMPLES as Record<string, any>)[scienceState.type]));
  }
  renderScienceData();
  showScienceUploadStatus('已加载示例数据', 'success');
}
export function showScienceUploadStatus(msg: string, type: string) {
  const el = document.getElementById('scienceUploadStatus');
  if (!el) return;
  el.textContent = msg;
  el.className = 'science-upload-status ' + (type === 'error' ? 'err' : type === 'info' ? 'info' : 'ok');
  el.style.display = 'block';
  // Don't auto-hide progress/info messages (caller will update them)
  if (type !== 'info') {
    setTimeout(() => {
      if (el) el.style.display = 'none';
    }, 4000);
  }
}
export function handleScienceFile(input: HTMLInputElement) {
  const f = input.files![0];
  if (!f) return;
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  const LARGE_FILE_THRESHOLD = 2 * 1024 * 1024;
  // For large files, read in chunks and show progress
  if (
    f.size > LARGE_FILE_THRESHOLD &&
    (ext === 'csv' || ext === 'txt' || ext === 'out' || ext === 'outcar' || ext === 'lammpstrj' || ext === 'log')
  ) {
    showScienceUploadStatus('📊 正在流式解析大文件 (' + (f.size / 1024 / 1024).toFixed(1) + 'MB)...', 'info');
    let offset = 0;
    const CHUNK_SIZE = 512 * 1024;
    let fullText = '';
    function readNextChunk() {
      const blob = f.slice(offset, offset + CHUNK_SIZE);
      const r = new FileReader();
      r.onload = function (e) {
        fullText += e.target!.result;
        offset += CHUNK_SIZE;
        const pct = Math.min(100, Math.round((offset / f.size) * 100));
        showScienceUploadStatus('📊 解析中... ' + pct + '%', 'info');
        if (offset < f.size) {
          // Yield to UI thread between chunks
          setTimeout(readNextChunk, 0);
        } else {
          parseScienceTextComplete(fullText, ext, f);
        }
      };
      r.onerror = function () {
        showScienceUploadStatus('文件读取失败', 'error');
      };
      r.readAsText(blob);
    }
    readNextChunk();
    return;
  }
  // Small file: read all at once
  const r = new FileReader();
  r.onload = function (e) {
    const text = e.target!.result as string;
    parseScienceTextComplete(text, ext, f);
  };
  r.onerror = function () {
    showScienceUploadStatus('文件读取失败', 'error');
  };
  r.readAsText(f);
}
export function parseScienceTextComplete(text: string, ext: string, f: File) {
  // 使用新的鲁棒解析器
  try {
    const result = parseScienceFile({ type: scienceState.type, fileName: f.name, text, ext });
    const parsed = result.data;
    if (validateScienceData(parsed)) {
      scienceState.data = normalizeScienceData(parsed);
      renderScienceData();
      let msg = '✅ 成功加载：' + (scienceState.data.name || f.name);
      if (result.warnings && result.warnings.length) msg += ' (' + result.warnings.join('; ') + ')';
      showScienceUploadStatus(msg, 'success');
    } else {
      showScienceUploadStatus(
        '数据格式不匹配。期望：' + (
          SCIENCE_SCHEMA[scienceState.type as keyof typeof SCIENCE_SCHEMA] ||
          SCIENCE_DEEP_SCHEMA[scienceState.type as keyof typeof SCIENCE_DEEP_SCHEMA] ||
          'JSON'
        ),
        'error'
      );
    }
  } catch (e) {
    showScienceUploadStatus('解析失败：' + ((e as Error).message || String(e)), 'error');
  }
}
export function parseScienceCSV(text: string) {
  // 保持旧函数签名以兼容，实际委托给新解析器
  const result = parseScienceFile({ type: scienceState.type, fileName: 'csv-import.csv', text, ext: 'csv' });
  return result.data;
}
export function parseScienceText(text: string, ext: string, name?: string) {
  // 保持旧函数签名以兼容，实际委托给新解析器
  const result = parseScienceFile({ type: scienceState.type, fileName: name || 'text-import.' + ext, text, ext });
  return result.data;
}
export function normalizeScienceData(d: any) {
  const t = scienceState.type;
  const out = Object.assign({}, d);
  if (t === 'dft') {
    out.kpoints = out.kpoints || [];
    out.energies = out.energies || [];
    out.fermi = out.fermi || 0;
    out.bandgap = out.bandgap || 0.5;
    out.name = out.name || 'DFT数据';
  } else if (t === 'md') {
    out.frames = out.frames || [];
    out.distances = out.distances || [];
    out.frequencies = out.frequencies || [];
    out.temp = out.temp || 300;
    out.name = out.name || 'MD数据';
  } else if (t === 'fem') {
    out.nodes = out.nodes || [];
    out.elements = out.elements || [];
    out.modes = out.modes || [];
    out.name = out.name || 'FEM数据';
  } else if (t === 'cfd') {
    out.cells = out.cells || [];
    out.reynolds = out.reynolds || 1000;
    out.name = out.name || 'CFD数据';
  } else if (t === 'xrd') {
    out.angles = out.angles || [];
    out.intensities = out.intensities || [];
    out.wavelength = out.wavelength || 1.54;
    out.lattice = out.lattice || 5.64;
    out.name = out.name || 'XRD数据';
  } else if (t === 'dna') {
    out.sequence = (out.sequence || '').toUpperCase().replace(/[^ATCG]/g, '');
    out.gc = out.gc || 0.5;
    out.name = out.name || 'DNA数据';
  } else if (t === 'pulsar') {
    out.periods = out.periods || [];
    out.flux = out.flux || [];
    out.dm = out.dm || 0;
    out.name = out.name || 'Pulsar数据';
  }
  return out;
}
export function validateScienceData(d: any) {
  if (!d || typeof d !== 'object') return false;
  const t = scienceState.type;
  if (t === 'dft')
    return Array.isArray(d.kpoints) && Array.isArray(d.energies) && d.kpoints.length > 0 && d.energies.length > 0;
  if (t === 'md') return Array.isArray(d.frames) && Array.isArray(d.distances) && d.frames.length > 0;
  if (t === 'fem') return Array.isArray(d.nodes) && Array.isArray(d.modes) && d.nodes.length > 0;
  if (t === 'cfd') return Array.isArray(d.cells) && d.cells.length > 0;
  if (t === 'xrd') return Array.isArray(d.angles) && Array.isArray(d.intensities) && d.angles.length > 0;
  if (t === 'dna') return typeof d.sequence === 'string' && d.sequence.length > 0;
  if (t === 'pulsar') return Array.isArray(d.periods) && d.periods.length > 0;
  return false;
}
export function renderScienceData() {
  updateScienceTypeUI();
  const schema =
    SCIENCE_SCHEMA[scienceState.type as keyof typeof SCIENCE_SCHEMA] ||
    SCIENCE_DEEP_SCHEMA[scienceState.type as keyof typeof SCIENCE_DEEP_SCHEMA] ||
    'JSON';
  const help = document.getElementById('scienceSchemaHelp');
  if (help) help.innerHTML = '<b>期望格式：</b><code>' + schema + '</code>';
  const info = document.getElementById('scienceDataInfo');
  const d = scienceState.data;
  if (info)
    info.innerHTML =
      '<b>名称：</b>' +
      (d.name || '未命名') +
      '<br><b>类型：</b>' +
      (SCIENCE_TYPE_NAMES[scienceState.type as keyof typeof SCIENCE_TYPE_NAMES] ||
        SCIENCE_DEEP_TYPE_NAMES[scienceState.type as keyof typeof SCIENCE_DEEP_TYPE_NAMES] ||
        scienceState.type) +
       '<br><b>样本数：</b>' +
       scienceSampleCount(d);
  const nameEl = document.getElementById('scienceDataName');
  if (nameEl) nameEl.textContent = d.name || '示例数据';
  drawScienceDataCanvas();
  renderScienceStats();
}
export function scienceSampleCount(d: any) {
  const t = scienceState.type;
  if (t === 'dft') return d.kpoints ? d.kpoints.length : 0;
  if (t === 'md') return d.frames ? d.frames.length : 0;
  if (t === 'fem') return d.nodes ? d.nodes.length : 0;
  if (t === 'cfd') return d.cells ? d.cells.length : 0;
  if (t === 'xrd') return d.angles ? d.angles.length : 0;
  if (t === 'dna') return d.sequence ? d.sequence.length : 0;
  if (t === 'pulsar') return d.periods ? d.periods.length : 0;
  return 0;
}
export function renderScienceStats() {
  const el = document.getElementById('scienceStats');
  if (!el) return;
  const d = scienceState.data,
    t = scienceState.type;
  let stats: { label: string; value: string | number }[] = [];
  if (t === 'dft') {
    const e = d.energies || [];
    stats = [
      { label: '能带', value: e.length },
      { label: '最小能量', value: (Math.min.apply(null, e) || 0).toFixed(1) },
      { label: '最大能量', value: (Math.max.apply(null, e) || 0).toFixed(1) },
      { label: '带隙', value: (d.bandgap || 0).toFixed(1) },
    ];
  } else if (t === 'md') {
    stats = [
      { label: '帧数', value: d.frames ? d.frames.length : 0 },
      { label: '温度', value: (d.temp || 0) + 'K' },
      { label: '平均距离', value: (avg(d.distances) || 0).toFixed(2) },
      { label: '频率数', value: d.frequencies ? d.frequencies.length : 0 },
    ];
  } else if (t === 'fem') {
    const s = (d.nodes || []).map((n: any) => n.stress);
    stats = [
      { label: '节点', value: d.nodes ? d.nodes.length : 0 },
      { label: '最大应力', value: (Math.max.apply(null, s) || 0).toFixed(0) },
      { label: '模态数', value: d.modes ? d.modes.length : 0 },
      {
        label: '最大位移',
        value: (
          Math.max.apply(
            null,
            (d.nodes || []).map((n: any) => n.displacement)
          ) || 0
        ).toFixed(2),
      },
    ];
  } else if (t === 'cfd') {
    const v = (d.cells || []).map((c: any) => c.velocity);
    stats = [
      { label: '网格', value: d.cells ? d.cells.length : 0 },
      { label: '最大速度', value: (Math.max.apply(null, v) || 0).toFixed(2) },
      { label: 'Re数', value: d.reynolds || 0 },
      { label: '平均涡量', value: (avg((d.cells || []).map((c: any) => c.vorticity)) || 0).toFixed(2) },
    ];
  } else if (t === 'xrd') {
    const ints = d.intensities || [];
    stats = [
      { label: '数据点', value: ints.length },
      { label: '最大强度', value: (Math.max.apply(null, ints) || 0).toFixed(0) },
      { label: '波长', value: (d.wavelength || 0).toFixed(2) },
      { label: '晶格', value: (d.lattice || 0).toFixed(2) },
    ];
  } else if (t === 'dna') {
    const seq = d.sequence || '';
    stats = [
      { label: '碱基数', value: seq.length },
      { label: 'GC含量', value: ((d.gc || 0) * 100).toFixed(1) + '%' },
      { label: 'A', value: seq.split('A').length - 1 },
      { label: '密码子数', value: Math.floor(seq.length / 3) },
    ];
  } else if (t === 'pulsar') {
    const p = d.periods || [];
    stats = [
      { label: '脉冲数', value: p.length },
      { label: '平均周期', value: (avg(p) || 0).toFixed(2) + 'ms' },
      { label: '最小周期', value: (Math.min.apply(null, p) || 0).toFixed(2) },
      { label: 'DM', value: (d.dm || 0).toFixed(1) },
    ];
  }
  el.innerHTML = stats
    .map(
      (s) =>
        '<div class="science-stat"><div class="label">' +
        s.label +
        '</div><div class="value">' +
        s.value +
        '</div></div>'
    )
    .join('');
}
export function avg(arr: number[]) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a: number, b: number) => a + b, 0) / arr.length;
}
export function drawScienceDataCanvas() {
  const c = document.getElementById('scienceDataCanvas') as HTMLCanvasElement;
  if (!c) return;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, c.width, c.height);
  const d = scienceState.data,
    t = scienceState.type;
  let values = [],
    labels = [];
  if (t === 'dft') {
    values = d.energies || [];
    labels = d.kpoints || [];
  } else if (t === 'md') {
    values = d.distances || [];
    labels = d.frames ? d.frames.map((f: any, i: number) => i) : [];
  } else if (t === 'fem') {
    values = (d.nodes || []).map((n: any) => n.stress);
    labels = (d.nodes || []).map((n: any) => n.id);
  } else if (t === 'cfd') {
    values = (d.cells || []).map((c: any) => c.velocity);
    labels = (d.cells || []).map((_: any, i: number) => i);
  } else if (t === 'xrd') {
    values = d.intensities || [];
    labels = d.angles || [];
  } else if (t === 'dna') {
    values = (d.sequence || '').split('').map((base: string, i: number) => {
      const map: Record<string, number> = { A: 1, T: 2, G: 3, C: 4 };
      return map[base] || 0;
    });
    labels = Array.from({ length: values.length }, (_, i) => i);
  } else if (t === 'pulsar') {
    values = d.flux || [];
    labels = d.periods || [];
  }
  if (values.length === 0) return;
  const min = Math.min.apply(null, values),
    max = Math.max.apply(null, values),
    range = max - min || 1;
  ctx.strokeStyle = 'rgba(155,89,182,.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  values.forEach((v: number, i: number) => {
    const x = 30 + ((c.width - 60) * i) / (values.length - 1);
    const y = c.height - 30 - ((c.height - 60) * (v - min)) / range;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.fillStyle = '#fff';
  values.forEach((v: number, i: number) => {
    const x = 30 + ((c.width - 60) * i) / (values.length - 1);
    const y = c.height - 30 - ((c.height - 60) * (v - min)) / range;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}
export function renderScienceCompose() {
  drawScienceComposeCanvas();
  renderScienceMappings();
  renderScienceKnobs();
  regenerateScienceMusic();
  renderSciencePianoRoll();
  renderScienceVisualizer();
}
export function drawScienceComposeCanvas() {
  const c = document.getElementById('scienceComposeCanvas') as HTMLCanvasElement;
  if (!c) return;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, c.width, c.height);
  const pat = scienceState.pattern || [];
  if (pat.length === 0) return;
  const rows = 4,
    cellW = c.width / 32,
    cellH = (c.height - 40) / rows;
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < 32; i++) {
      const v = pat[i] ? pat[i][r] : 0;
      ctx.fillStyle = v ? 'hsl(' + (280 + r * 30) + ',80%,60%)' : 'rgba(255,255,255,.06)';
      ctx.fillRect(i * cellW, 20 + r * cellH, cellW - 1, cellH - 1);
    }
  }
}
export function renderScienceMappings() {
  const el = document.getElementById('scienceMappingList');
  if (!el) return;
  const allMappings = { ...SCIENCE_MAPPINGS, ...SCIENCE_DEEP_MAPPINGS } as Record<string, { id: string; title: string; desc: string }[]>;
  el.innerHTML = (allMappings[scienceState.type] || [])
    .map(
      (m: { id: string; title: string; desc: string }, i: number) =>
        '<div class="science-mapping-card ' +
        (scienceState.mapping[scienceState.type][m.id] ? 'enabled' : '') +
        '"><div class="science-mapping-header"><div><div class="science-mapping-title">' +
        m.title +
        '</div><div class="science-mapping-desc">' +
        m.desc +
        '</div></div><div class="science-toggle ' +
        (scienceState.mapping[scienceState.type][m.id] ? 'on' : '') +
        '" data-action="toggleScienceMapping" data-args=\'["' +
        m.id +
        '"]\'></div></div></div>'
    )
    .join('');
}
export function toggleScienceMapping(id: string) {
  const m = scienceState.mapping[scienceState.type];
  m[id] = !m[id];
  renderScienceMappings();
  regenerateScienceMusic();
}
export function toggleScienceWhyPanel() {
  const el = document.getElementById('scienceWhyPanel');
  if (!el) return;
  const visible = el.style.display !== 'none';
  el.style.display = visible ? 'none' : 'block';
  if (!visible)
    el.innerHTML = (({ ...SCIENCE_MAPPINGS, ...SCIENCE_DEEP_MAPPINGS }) as Record<string, { id: string; title: string; desc: string }[]>)[
      scienceState.type
    ]
      .map((m: { title: string; desc: string }) => '<b>' + m.title + '</b><br>' + m.desc)
      .join('<br><br>');
}
export function renderScienceKnobs() {
  const el = document.getElementById('scienceKnobs');
  if (!el) return;
  const allOpts = { ...SCIENCE_OPTIONS, ...SCIENCE_DEEP_OPTIONS } as Record<string, { key: string; label: string; min: number; max: number; def: number; unit: string }[]>;
  el.innerHTML = (allOpts[scienceState.type] || [])
    .map(
      (o: { key: string; label: string; min: number; max: number; def: number; unit: string }) =>
        '<div class="science-knob-group"><div class="science-knob-label"><span>' +
        o.label +
        '</span><span id="sciVal_' +
        o.key +
        '">' +
        scienceState.options[scienceState.type][o.key] +
        o.unit +
        '</span></div><input class="science-knob" type="range" min="' +
        o.min +
        '" max="' +
        o.max +
        '" value="' +
        scienceState.options[scienceState.type][o.key] +
        '" data-input="updateScienceOption" data-opt-key="' +
        o.key +
        '"></div>'
    )
    .join('');
}
export function updateScienceOption(key: string, val: string) {
  const num = parseInt(val);
  scienceState.options[scienceState.type][key] = num;
  const el = document.getElementById('sciVal_' + key);
  if (el) {
    const allOpts2 = { ...SCIENCE_OPTIONS, ...SCIENCE_DEEP_OPTIONS } as Record<string, { key: string; unit: string }[]>;
    const opt = (allOpts2[scienceState.type] || []).find(
      (x: { key: string }) => x.key === key
    );
    el.textContent = num + (opt ? opt.unit : '');
  }
  regenerateScienceMusic();
}
export function regenerateScienceMusic() {
  const type = scienceState.type,
    d = scienceState.data,
    opts = scienceState.options[type],
    map = scienceState.mapping[type];
  let pattern = [];
  const scale = [0, 2, 4, 5, 7, 9, 11];
  const baseFreq = 261.63;
  if (type === 'dft') {
    const k = d.kpoints || [],
      e = d.energies || [];
    const n = Math.min(k.length, e.length, 32);
    const fermi = d.fermi || 0,
      bandgap = d.bandgap || 0.5;
    const emin = Math.min.apply(null, e) || 0,
      emax = Math.max.apply(null, e) || 1,
      er = emax - emin || 1;
    const kmax = Math.max.apply(null, k) || 1;
    const voices = e.slice(0, n).map((energy: any, idx: number) => ({
      energy: energy,
      k: k[idx] || 0,
      idx: idx,
      isVB: energy < fermi,
      isCB: energy >= fermi,
      distToGap: Math.abs(energy - fermi),
    }));
    voices.forEach((v: any) => {
      const pitchIdx = Math.floor(((v.energy - emin) / er) * opts.pitchRange) % 12;
      const semitone = scale[pitchIdx % scale.length] + 12 * Math.floor(pitchIdx / scale.length);
      v.semitone = semitone;
      v.midi = 60 + semitone;
    });
    const scfIters = Math.max(0, opts.scfIters || 5);
    for (let iter = 0; iter < scfIters; iter++) {
      const newMidis = voices.map((v: any, i: number) => {
        let shift = 0,
          weight = 0;
        voices.forEach((o: any, j: number) => {
          if (i === j) return;
          const eDiff = Math.abs(v.energy - o.energy);
          const w = 1 / (1 + eDiff * 10);
          const midiDiff = v.midi - o.midi;
          const intervals = [0, 7, 5, 4, 3, 9, 8];
          let best = 0,
            bestDev = Infinity;
          intervals.forEach((iv) => {
            const dev = Math.abs(midiDiff - iv);
            if (dev < bestDev) {
              bestDev = dev;
              best = iv;
            }
          });
          shift += (best - midiDiff) * w;
          weight += w;
        });
        return weight > 0 ? v.midi + shift / weight : v.midi;
      });
      voices.forEach((v: any, i: number) => (v.midi = newMidis[i]));
    }
    voices.forEach((v: any) => {
      v.freq = 440 * Math.pow(2, (v.midi - 69) / 12);
    });
    for (let i = 0; i < n; i++) {
      const row = [0, 0, 0, 0];
      const v = voices[i];
      const inGap = v.distToGap < bandgap * (opts.restThresh / 100);
      if (
        map.bands &&
        !inGap &&
        (Math.abs(v.energy - fermi - bandgap / 2) < bandgap * 0.6 ||
          Math.abs(v.energy - fermi + bandgap / 2) < bandgap * 0.6)
      )
        row[0] = 1;
      if (map.ks && !inGap) row[1] = v.freq;
      if (map.density) row[2] = 0.2 + 0.8 * (v.k / kmax) * (1 - v.distToGap / (er / 2 + 0.001));
      if (map.pw && i % Math.max(1, Math.floor(n / 4)) === 0) row[3] = 1;
      pattern.push(row);
    }
  } else if (type === 'md') {
    const frames = d.frames || [],
      dist = d.distances || [],
      freqs = d.frequencies || [];
    const n = Math.min(frames.length, 32);
    const temp = d.temp || 300;
    const dmin = Math.min.apply(null, dist) || 0,
      dmax = Math.max.apply(null, dist) || 1,
      drange = dmax - dmin || 1;
    const velocities = frames.map((f: any, i: number) =>
      i > 0
        ? Math.sqrt(
            Math.pow(f.x - (frames[i - 1].x || 0), 2) +
              Math.pow(f.y - (frames[i - 1].y || 0), 2) +
              Math.pow(f.z - (frames[i - 1].z || 0), 2)
          ) / Math.max(0.001, (f.t || 0.01) - (frames[i - 1].t || 0))
        : 0
    );
    const vmax = Math.max.apply(null, velocities) || 1;
    const distDerivs = dist.map((v: number, i: number) => (i > 0 ? v - (dist[i - 1] || v) : 0));
    const rdfPeaks = [];
    const rdfWindow = Math.max(1, Math.floor(dist.length / 5));
    for (let i = rdfWindow; i < dist.length - rdfWindow; i++) {
      let isPeak = true;
      for (let j = 1; j <= rdfWindow; j++)
        if (dist[i] <= dist[i - j] || dist[i] <= dist[i + j]) {
          isPeak = false;
          break;
        }
      if (isPeak) rdfPeaks.push(dist[i]);
    }
    const msd = frames.map((f: any, i: number) => Math.pow(f.x || 0, 2) + Math.pow(f.y || 0, 2) + Math.pow(f.z || 0, 2));
    const msdMax = Math.max.apply(null, msd) || 1;
    for (let i = 0; i < n; i++) {
      const row = [0, 0, 0, 0];
      const di = dist[i] || 0,
        vi = velocities[i] || 0,
        freq = freqs[i % freqs.length] || 440;
      if (map.pes) {
        const potential = (di - dmin) / drange;
        const semitone = Math.floor(potential * (opts.pitchRange || 12)) % 12;
        row[1] = baseFreq * Math.pow(2, semitone / 12);
      } else {
        row[1] = freq;
      }
      row[2] = (vi / vmax) * (opts.distanceVel / 100);
      if (map.newton && i > 0) {
        if (distDerivs[i] < 0) row[0] = 1;
        else if (distDerivs[i] > 0.05 * drange) row[3] = 1;
      }
      if (map.rdf && rdfPeaks.some((p) => Math.abs(di - p) < (opts.rdfThresh / 100) * drange)) row[2] += 0.25;
      if (map.ensemble && Math.random() < (temp / 1000) * (opts.tempRand / 100)) row[3] = 1;
      if (map.dt && i % Math.max(1, Math.floor(frames.length / (opts.noteDuration * 4) || 1)) === 0) row[0] = 1;
      if (map.msd && msd[i] / msdMax > 0.7) row[1] = row[1] * 1.059;
      pattern.push(row);
    }
  } else if (type === 'fem') {
    const nodes = d.nodes || [],
      modes = d.modes || [];
    const n = Math.min(nodes.length, 32);
    const stresses = nodes.map((x: any) => x.stress || 0);
    const smax = Math.max.apply(null, stresses) || 1,
      smin = Math.min.apply(null, stresses) || 0;
    const disps = nodes.map((x: any) => x.displacement || 0);
    const dmax = Math.max.apply(null, disps) || 1;
    const modalFreqs = (modes || [])
      .map((m: any) => (typeof m === 'number' ? m : m.frequency || 1))
      .sort((a: number, b: number) => a - b);
    const fundamental = modalFreqs[0] || 1;
    const harmonicCount = Math.max(1, opts.harmonicCount || 3);
    for (let i = 0; i < n; i++) {
      const row = [0, 0, 0, 0];
      const node = nodes[i] || {},
        stress = node.stress || 0,
        disp = node.displacement || 0;
      const sNorm = (stress - smin) / (smax - smin || 1);
      if (map.modal) {
        const modeIdx = i % Math.min(modalFreqs.length || 1, harmonicCount);
        const ratio = modalFreqs.length > 0 ? modalFreqs[modeIdx] / fundamental : 1;
        row[1] = baseFreq * ratio * (1 + disp / dmax);
      } else {
        row[1] = baseFreq * Math.pow(2, ((disp * 12) % 12) / 12);
      }
      row[2] = (opts.chordTension / 100) * sNorm;
      if (map.load && i % Math.max(1, Math.floor(n / (opts.measureLen || 4))) === 0) row[0] = 1;
      if (map.shape && i % Math.max(2, Math.floor(n / 4)) === 0) row[3] = 1;
      if (map.bc && (i === 0 || i === n - 1)) row[0] = 1;
      if (map.nonlinear && sNorm > 0.7) row[1] = row[1] * 1.059;
      if (map.stiff && i > 0) {
        const prevStress = (nodes[i - 1].stress || 0 - smin) / (smax - smin || 1);
        const diff = Math.abs(sNorm - prevStress);
        row[2] += diff * (opts.voiceLeading / 100);
      }
      pattern.push(row);
    }
  } else if (type === 'cfd') {
    const cells = d.cells || [];
    const n = Math.min(cells.length, 32);
    const velocities = cells.map((c: any) => c.velocity || 0),
      pressures = cells.map((c: any) => c.pressure || 0),
      vorticities = cells.map((c: any) => c.vorticity || 0);
    const vmax = Math.max.apply(null, velocities) || 1;
    const pmax = Math.max.apply(null, pressures) || 1,
      pmin = Math.min.apply(null, pressures) || 0,
      prange = pmax - pmin || 1;
    const vomax = Math.max.apply(null, vorticities) || 1;
    const re = d.reynolds || 1000;
    const reThresh = 2300 * (opts.reynoldsTrans / 100);
    const isTurbulent = re > reThresh;
    const vGrad = velocities.map((v: number, i: number) => (i > 0 ? v - (velocities[i - 1] || v) : 0));
    for (let i = 0; i < n; i++) {
      const row = [0, 0, 0, 0];
      const v = cells[i].velocity || 0,
        p = cells[i].pressure || 0,
        vo = cells[i].vorticity || 0;
      const vNorm = v / vmax,
        pNorm = (p - pmin) / prange,
        voNorm = vo / vomax;
      if (map.ns) row[1] = baseFreq * Math.pow(2, (pNorm * 12) / 12);
      else row[1] = baseFreq;
      row[2] = (opts.velocityDyn / 100) * vNorm;
      if (map.turb && voNorm > 1 - opts.vorticityComplex / 100) row[3] = 1;
      if (map.shock && Math.abs(vGrad[i]) > 0.4 * vmax) row[0] = 1;
      if (map.bc && (i === 0 || i === n - 1)) row[0] = 1;
      if (map.simple && isTurbulent && Math.random() < 0.15) row[3] = 1;
      if (map.lag_eul && i % Math.max(1, Math.floor(n / 3)) === 0) row[1] = row[1] * (1 + vNorm);
      pattern.push(row);
    }
  } else if (type === 'xrd') {
    const angles = d.angles || [],
      intensities = d.intensities || [];
    const n = Math.min(angles.length, 32);
    const imin = Math.min.apply(null, intensities) || 0,
      imax = Math.max.apply(null, intensities) || 1,
      irange = imax - imin || 1;
    const athresh = imin + (opts.peakThresh / 100) * irange;
    const peaks = [];
    for (let i = 1; i < intensities.length - 1; i++)
      if (intensities[i] > athresh && intensities[i] > intensities[i - 1] && intensities[i] > intensities[i + 1])
        peaks.push(i);
    const amin = Math.min.apply(null, angles) || 0,
      amax = Math.max.apply(null, angles) || 1,
      arange = amax - amin || 1;
    for (let i = 0; i < n; i++) {
      const row = [0, 0, 0, 0];
      const a = angles[i] || 0,
        inten = intensities[i] || 0;
      const aNorm = (a - amin) / arange;
      const iNorm = (inten - imin) / irange;
      const semitone = Math.floor(aNorm * (opts.pitchRange || 12)) % 12;
      row[1] = baseFreq * Math.pow(2, semitone / 12);
      row[2] = (opts.intensityDyn / 100) * iNorm;
      if (map.bragg && peaks.includes(i)) row[0] = 1;
      if (map.peak && peaks.includes(i)) row[1] = row[1] * Math.pow(2, opts.harmonics / 12);
      if (map.intensity && iNorm > 0.7) row[2] += 0.2;
      if (map.lattice && i % Math.max(1, Math.floor(n / 4)) === 0) row[3] = 1;
      if (map.pattern && peaks.some((p) => Math.abs(i - p) <= 1)) row[1] = row[1] * 1.059;
      pattern.push(row);
    }
  } else if (type === 'dna') {
    const seq: string = (d.sequence || '').toUpperCase();
    const total = Math.min(seq.length, 96);
    const chunk = Math.max(1, Math.floor(total / 32)) || 1;
    const gc = d.gc || 0.5;
    const baseNote: Record<string, number> = { A: 0, T: 2, G: 4, C: 7 };
    const modeOffset = gc > opts.gcBrightness / 100 ? 2 : 0;
    for (let i = 0; i < 32; i++) {
      const row = [0, 0, 0, 0];
      const idx = i * chunk;
      const base = seq[idx] || 'A';
      const semitone = (baseNote[base] || 0) + modeOffset;
      row[1] = baseFreq * Math.pow(2, semitone / 12);
      row[2] = 0.4 + 0.4 * gc;
      if (map.atgc) {
        const next = seq[idx + 1] || base;
        const avgNote = Math.round(((baseNote[base] || 0) + (baseNote[next] || 0)) / 2);
        row[1] = baseFreq * Math.pow(2, avgNote / 12);
      }
      if (map.gc) row[2] += 0.1 * (gc - 0.5);
      if (map.codon && i % 3 === 0) {
        const tri = seq.substr(idx, 3) || 'ATG';
        const notes = tri.split('').map((c: string) => baseNote[c] || 0);
        row[1] = baseFreq * Math.pow(2, (notes[0] || 0) / 12);
        row[3] = 1;
      }
      if (map.repeat && base === seq[idx + chunk]) row[0] = 1;
      if (map.mutation && base === 'N') row[1] = row[1] * 1.414;
      pattern.push(row);
    }
  } else if (type === 'pulsar') {
    const periods = d.periods || [],
      flux = d.flux || [];
    const n = Math.min(periods.length, 32);
    const pmin = Math.min.apply(null, periods) || 0,
      pmax = Math.max.apply(null, periods) || 1,
      prange = pmax - pmin || 1;
    const fmin = Math.min.apply(null, flux) || 0,
      fmax = Math.max.apply(null, flux) || 1,
      frange = fmax - fmin || 1;
    const dm = d.dm || 0;
    const bpm = opts.baseBpm || 120;
    const beatSteps = Math.max(1, Math.round((60 / bpm) * 16));
    for (let i = 0; i < n; i++) {
      const row = [0, 0, 0, 0];
      const p = periods[i] || 0,
        f = flux[i] || 0;
      const pNorm = (p - pmin) / prange;
      const fNorm = (f - fmin) / frange;
      row[1] = baseFreq * Math.pow(2, (pNorm * 12) / 12);
      row[2] = (opts.fluxDyn / 100) * fNorm;
      if (map.period && i % beatSteps === 0) row[0] = 1;
      if (map.flux && fNorm > 0.7) row[2] += 0.25;
      if (map.dm) {
        const delayFactor = (dm / 100) * (opts.dmDelay / 100);
        row[2] += delayFactor * 0.3;
      }
      if (map.drift && i > 0) {
        const drift = (periods[i] - periods[i - 1]) / prange;
        row[1] = row[1] * Math.pow(2, drift);
      }
      if (map.binary && i % 2 === 0) row[3] = 1;
      pattern.push(row);
    }
  } else if (type === 'crystal') {
    // 晶体点阵：声子频率 → 音高，对称操作 → 和声变换，缺陷 → 装饰音
    const phonons = (d.phonons || []) as number[];
    const basis = (d.basis || []) as { x: number; y: number; z: number }[];
    const n = Math.min(Math.max(phonons.length, basis.length, 8), 32);
    const pmax = Math.max.apply(null, phonons) || 20;
    const pmin = Math.min.apply(null, phonons) || 0;
    const pspan = pmax - pmin || 1;
    const root = opts.rootPitch || 0;
    for (let i = 0; i < n; i++) {
      const row = [0, 0, 0, 0];
      const ph = phonons[i % phonons.length] || 0;
      const phNorm = (ph - pmin) / pspan;
      // 声学支（低频）→ 低音区，光学支（高频）→ 高音区
      const semitone = (root + Math.floor(phNorm * 24)) % 36;
      row[1] = baseFreq * Math.pow(2, semitone / 12);
      if (map.phonon) row[2] = 0.3 + phNorm * 0.5;
      else row[2] = 0.4;
      // 对称操作：相邻原子坐标的对称变换对应和弦转位
      if (map.symop && i > 0) {
        const prev = phonons[(i - 1) % phonons.length] || 0;
        const inv = pmax - prev + pmin; // 倒影对称
        const invNorm = (inv - pmin) / pspan;
        row[1] = baseFreq * Math.pow(2, ((root + Math.floor(invNorm * 24)) % 36) / 12);
      }
      if (map.bravais && i % 7 === 0) row[0] = 1; // 格子平移周期 = 音阶循环点
      if (map.pointgroup) {
        // 对称约束的音程：仅允许 1,3,5,7 半音
        const allowed = [0, 3, 5, 7];
        const idx = allowed[Math.floor(phNorm * allowed.length) % allowed.length];
        row[1] = baseFreq * Math.pow(2, ((root + idx) % 36) / 12);
      }
      if (map.basis) {
        // 基矢长度比 → 基础音程
        const atom = basis[i % basis.length] || { x: 0, y: 0, z: 0 };
        const dist = Math.sqrt(atom.x * atom.x + atom.y * atom.y + atom.z * atom.z);
        row[1] *= 1 + (dist - 0.5) * (opts.modeComplex / 1000);
      }
      if (map.defect && Math.random() < (opts.ornamentRatio / 100)) row[3] = 1;
      if (i % Math.max(1, Math.floor(n / (opts.rhythmDensity / 20 || 1))) === 0) row[0] = 1;
      pattern.push(row);
    }
  } else if (type === 'quantum') {
    // 量子波函数：径向概率 → 音高包络，角度分布 → 声像，节点 → 休止
    const radial = (d.radial || []) as number[];
    const angular = (d.angular || []) as number[];
    const n = Math.min(radial.length, 32);
    const rmax = Math.max.apply(null, radial) || 1;
    const range = opts.pitchRange || 18;
    const overtoneN = opts.overtoneCount || 2;
    const restP = opts.restProb / 100;
    for (let i = 0; i < n; i++) {
      const row = [0, 0, 0, 0];
      const r = radial[i] || 0;
      const rNorm = r / rmax; // 径向概率归一化
      // 本征态 → 自然泛音列：基频 × (k+1)
      const harmonicIdx = i % (overtoneN + 1);
      const freq = baseFreq * (harmonicIdx + 1) * Math.pow(2, (rNorm * range) / 12);
      if (map.eigenstate) row[1] = freq;
      else row[1] = baseFreq * Math.pow(2, (rNorm * range) / 12);
      // 量子数 n → 八度
      if (map.n) row[1] *= Math.pow(2, (d.n - 3) || 0);
      // 量子数 l → 泛音构成（音色明暗）
      if (map.l) row[2] = 0.2 + rNorm * 0.4 + (d.l / 10);
      else row[2] = 0.3 + rNorm * 0.4;
      // 量子数 m → 声像（用 velocity 模拟）
      if (map.m) row[2] *= 1 + (d.m / 10);
      // 波函数节点 → 休止
      if (map.node && rNorm < 0.15) {
        row[1] = 0;
        row[2] = 0;
      } else if (map.node && Math.random() < restP) {
        row[1] = 0;
        row[2] = 0;
      }
      // 能级跃迁 → 和弦进行
      if (map.transition && i > 0) {
        const tension = opts.tension / 100;
        const prevR = (radial[i - 1] || 0) / rmax;
        const delta = Math.abs(rNorm - prevR);
        if (delta > 0.3 * tension) row[0] = 1; // 大跃迁 = 强拍
      }
      // 角度分布影响节奏
      const aNorm = angular[i % angular.length] || 0;
      if (aNorm > 0.5) row[3] = 1;
      pattern.push(row);
    }
  } else if (type === 'seismic') {
    // 地震波：P 波 → 快节奏动机，S 波 → 慢和弦，面波 → 持续低音
    const pWave = (d.pWave || []) as number[];
    const sWave = (d.sWave || []) as number[];
    const surface = (d.surface || []) as number[];
    const n = Math.min(Math.max(pWave.length, sWave.length, surface.length), 32);
    const sMax = Math.max.apply(null, surface) || 1;
    const bpm = opts.pTempo || 140;
    const beatEvery = Math.max(1, Math.round(16 * 120 / bpm));
    for (let i = 0; i < n; i++) {
      const row = [0, 0, 0, 0];
      // P 波 → 快节奏动机（高频短促）
      const pArrival = pWave[i] || 0;
      if (map.pwave && i % Math.max(1, Math.floor(beatEvery / 2)) === 0) {
        row[1] = baseFreq * 2 * Math.pow(2, (pArrival % 12) / 12);
        row[2] = 0.3 + (opts.dynRange / 200);
        row[0] = 1;
      }
      // S 波 → 慢节奏和弦层
      const sArrival = sWave[i] || 0;
      if (map.swave) {
        const chordDensity = opts.sChordDensity / 100;
        if (Math.random() < chordDensity) {
          row[1] = baseFreq * Math.pow(2, (sArrival % 7) / 12);
          row[2] += 0.25;
        }
      }
      // 面波 → 持续低音
      const amp = surface[i] || 0;
      if (map.surface) {
        const ampNorm = amp / sMax;
        const bassFreq = baseFreq * 0.25 * (1 + ampNorm * 0.5);
        row[1] = row[1] || bassFreq;
        row[2] += (opts.surfaceBass / 100) * ampNorm * 0.4;
      }
      // 震级 → 力度峰值
      if (map.magnitude) {
        const magNorm = (d.magnitude || 5) / 10;
        row[2] = Math.min(1, row[2] + magNorm * (opts.dynRange / 100) * 0.3);
      }
      // 震源深度 → 低频厚度
      if (map.depth && (d.depth || 0) > 20) {
        row[1] = row[1] ? row[1] * 0.8 : baseFreq * 0.2;
      }
      // 频谱 → 音色
      if (map.spectrum && i % 4 === 0) row[3] = 1;
      pattern.push(row);
    }
  } else if (type === 'eeg') {
    // 脑电波：5 个频段 → 5 个声部，α 为主旋律
    const bands = d.bands || {};
    const delta = (bands.delta || []) as number[];
    const theta = (bands.theta || []) as number[];
    const alpha = (bands.alpha || []) as number[];
    const beta = (bands.beta || []) as number[];
    const gamma = (bands.gamma || []) as number[];
    const n = Math.min(Math.max(delta.length, alpha.length), 32);
    const aMax = Math.max.apply(null, alpha) || 1;
    const alphaRange = opts.alphaRange || 12;
    const betaOrn = opts.betaOrnament / 100;
    const gammaBright = opts.gammaBrightness / 100;
    const balance = opts.bandBalance / 100;
    for (let i = 0; i < n; i++) {
      const row = [0, 0, 0, 0];
      const aVal = alpha[i] || 0;
      const aNorm = aVal / aMax;
      // α 波 → 中音旋律（主旋律）
      if (map.alpha) {
        const semitone = Math.floor(aNorm * alphaRange);
        row[1] = baseFreq * Math.pow(2, semitone / 12);
        row[2] = 0.3 + aNorm * 0.5;
      }
      // δ 波 → 低音踏板
      if (map.delta) {
        const dVal = delta[i] || 0;
        row[1] = row[1] || baseFreq * 0.25;
        row[2] += dVal * 0.15 * balance;
        if (i % 8 === 0) row[0] = 1;
      }
      // θ 波 → 低中音和声
      if (map.theta) {
        const tVal = theta[i] || 0;
        row[1] = row[1] ? row[1] * 1.2 : baseFreq * 0.5;
        row[2] += tVal * 0.1 * balance;
      }
      // β 波 → 高音装饰
      if (map.beta) {
        const bVal = beta[i] || 0;
        if (Math.random() < bVal * betaOrn) {
          row[1] *= 1.5; // 高五度装饰
          row[3] = 1;
        }
      }
      // γ 波 → 极高频泛音
      if (map.gamma) {
        const gVal = gamma[i] || 0;
        row[2] += gVal * gammaBright * 0.2;
        if (gVal > 0.2) row[1] *= (1 + gammaBright * 0.3);
      }
      // 脑区 → 声部布局（用节奏区分）
      if (map.region && i % d.channels === 0) row[0] = 1;
      pattern.push(row);
    }
  }
  scienceState.pattern = applySignalEnhancements(pattern, scienceState.type, scienceState.data, opts);
  renderSciencePianoRoll();
  renderScienceVisualizer();
  drawScienceComposeCanvas();
}

function applySignalEnhancements(pattern: any[], type: string, d: any, opts: any): any[] {
  if (!pattern || pattern.length === 0) return pattern;
  const out = pattern.map((r) => r.slice());
  if (type === 'dft') {
    const e = d.energies || [];
    if (e.length >= 4) {
      try {
        const dom = dominantFrequency(e);
        const peaks = findPeaks(e, { threshold: 0.3, minDistance: 2, prominence: 0.05 });
        // 用 FFT 主频调制第 1 轨旋律音量
        const strength = Math.min(1, dom.magnitude / (e.length || 1));
        out.forEach((row, i) => {
          if (row[1]) row[2] = Math.min(1, row[2] + strength * 0.3);
        });
        // 在峰值位置给 kick 加强调
        peaks.forEach((idx) => {
          if (idx < out.length) out[idx][0] = 1;
        });
      } catch (_) {}
    }
  } else if (type === 'md') {
    const dist = d.distances || [];
    if (dist.length >= 4) {
      try {
        const smoothed = movingAverage(dist, 3);
        const peaks = findPeaks(smoothed, { threshold: 0.2, minDistance: 2, prominence: 0.05 });
        const acf = autocorrelation(smoothed, Math.floor(smoothed.length / 2));
        const period = acf.findIndex((v, i) => i > 0 && v > acf[0] * 0.5);
        // 自相关周期决定重复节奏
        if (period > 2) {
          out.forEach((row, i) => {
            if (i % period === 0) row[0] = 1;
          });
        }
        peaks.forEach((idx) => {
          if (idx < out.length) out[idx][3] = 1;
        });
      } catch (_) {}
    }
  } else if (type === 'fem') {
    const stresses = (d.nodes || []).map((n: any) => n.stress || 0);
    if (stresses.length >= 4) {
      try {
        const dom = dominantFrequency(stresses);
        const peaks = findPeaks(stresses, { threshold: 0.3, minDistance: 2 });
        peaks.forEach((idx) => {
          if (idx < out.length) {
            out[idx][0] = 1;
            out[idx][2] = Math.min(1, out[idx][2] + 0.2);
          }
        });
        out.forEach((row, i) => {
          if (row[1]) row[1] = row[1] * (1 + dom.freq * 0.05);
        });
      } catch (_) {}
    }
  } else if (type === 'cfd') {
    const vels = (d.cells || []).map((c: any) => c.velocity || 0);
    if (vels.length >= 4) {
      try {
        const dom = dominantFrequency(vels);
        const zcr = Math.floor(vels.length / Math.max(1, dom.freq) / 2);
        out.forEach((row, i) => {
          if (zcr > 2 && i % zcr === 0) row[3] = 1;
        });
      } catch (_) {}
    }
  } else if (type === 'xrd') {
    const ints = d.intensities || [];
    if (ints.length >= 4) {
      try {
        const peaks = findPeaks(ints, { threshold: 0.25, minDistance: 2, prominence: 0.05 });
        peaks.forEach((idx) => {
          if (idx < out.length) {
            out[idx][0] = 1;
            out[idx][2] = Math.min(1, out[idx][2] + 0.25);
          }
        });
      } catch (_) {}
    }
  } else if (type === 'pulsar') {
    const flux = d.flux || [];
    if (flux.length >= 4) {
      try {
        const acf = autocorrelation(flux, Math.floor(flux.length / 2));
        let period = 0;
        for (let i = 1; i < acf.length; i++) {
          if (acf[i] > acf[0] * 0.6) {
            period = i;
            break;
          }
        }
        if (period > 1) {
          out.forEach((row, i) => {
            if (i % period === 0) out[i][0] = 1;
          });
        }
      } catch (_) {}
    }
  }
  return out;
}

export function renderSciencePianoRoll() {
  const el = document.getElementById('sciencePianoRoll');
  if (!el) return;
  const pat = scienceState.pattern || [];
  let html = '';
  for (let r = 0; r < 4; r++) {
    html += '<div class="science-piano-row">';
    for (let i = 0; i < 32; i++) {
      const v = pat[i] ? pat[i][r] : 0;
      const cls =
        'science-piano-cell ' +
        (v && r === 0 ? 'hit-a' : '') +
        (v && r === 1 ? 'hit' : '') +
        (v && r === 2 ? 'hit-b' : '') +
        (v && r === 3 ? 'hit-c' : '');
      html += '<div class="' + cls + '"></div>';
    }
    html += '</div>';
  }
  el.innerHTML = html;
}
export function renderScienceVisualizer() {
  const el = document.getElementById('scienceVisualizer');
  if (!el) return;
  el.innerHTML = '';
  for (let i = 0; i < 16; i++) {
    const bar = document.createElement('div');
    bar.className = 'science-vbar';
    bar.style.height = '10%';
    el.appendChild(bar);
  }
}
export function toggleSciencePlay() {
  if (scienceState.playing) {
    stopSciencePlay();
  } else {
    startSciencePlay();
  }
}
export function startSciencePlay() {
  if (!scienceState.pattern || scienceState.pattern.length === 0) regenerateScienceMusic();
  stopSharedTransport();
  scienceState.playing = true;
  scienceState.step = 0;
  const bpm = 120;
  const transport = getSharedTransport(bpm, 4);
  scienceState.transport = transport;
  transport.subscribe((event: TransportEvent) => {
    const s = event.step % scienceState.pattern.length;
    const t = event.time;
    const row = scienceState.pattern[s];
    if (row) {
      if (row[0]) scheduleKickAt(t);
      if (row[1]) scheduleToneAt(row[1], 0.15, 'sine', 0.25 + (row[2] || 0) * 0.5, t);
      if (row[3]) scheduleSnareAt(t);
    }
    scienceState.step = s;
    updateScienceVisualizer(s);
    animateScienceParticles();
  });
  transport.start();
  const btn = document.getElementById('sciPlayBtn');
  if (btn) btn.textContent = '⏸ 暂停';
}
export function stopSciencePlay() {
  scienceState.playing = false;
  stopSharedTransport();
  scienceState.transport = null;
  const btn = document.getElementById('sciPlayBtn');
  if (btn) btn.textContent = '▶ 播放';
}
export function updateScienceVisualizer(step: number) {
  const bars = document.querySelectorAll('.science-vbar');
  const pat = scienceState.pattern || [];
  bars.forEach((b, i) => {
    const idx = (step + i) % pat.length;
    const row = pat[idx];
    const h = row ? 10 + (row[2] || 0) * 90 : 10;
    (b as HTMLElement).style.height = h + '%';
  });
  const cells = document.querySelectorAll('.science-piano-cell');
  cells.forEach((c, i) => {
    const col = i % 32;
    const row = Math.floor(i / 32);
    const patRow = pat[col];
    c.classList.remove('hit', 'hit-a', 'hit-b', 'hit-c');
    if (patRow && patRow[row]) {
      c.classList.add(row === 0 ? 'hit-a' : row === 1 ? 'hit' : row === 2 ? 'hit-b' : 'hit-c');
    }
  });
}
export function animateScienceParticles() {
  const el = document.getElementById('scienceParticles');
  if (!el) return;
  const p = document.createElement('div');
  p.className = 'science-particle';
  p.style.left = 20 + Math.random() * 440 + 'px';
  p.style.top = 60 + Math.random() * 20 + 'px';
  p.style.background = 'hsl(' + (260 + Math.random() * 60) + ',80%,70%)';
  el.appendChild(p);
  setTimeout(() => p.remove(), 1000);
}
export function saveScienceComposition() {
  const name =
    (scienceState.data.name ||
      SCIENCE_TYPE_NAMES[scienceState.type as keyof typeof SCIENCE_TYPE_NAMES] ||
      SCIENCE_DEEP_TYPE_NAMES[scienceState.type as keyof typeof SCIENCE_DEEP_TYPE_NAMES] ||
      scienceState.type) +
    ' ' +
    new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const comp = {
    id: Date.now(),
    name: name,
    type: scienceState.type,
    data: scienceState.data,
    pattern: scienceState.pattern,
    options: JSON.parse(JSON.stringify(scienceState.options[scienceState.type])),
    mapping: JSON.parse(JSON.stringify(scienceState.mapping[scienceState.type])),
    date: Date.now(),
  };
  Store.state.scienceCompositions = Store.state.scienceCompositions || [];
  Store.state.scienceCompositions.push(comp);
  Store.save();
  renderScienceCompositionList();
  playCorrect();
}
export function renderScienceCompositionList() {
  const el = document.getElementById('scienceCompositionList');
  if (!el) return;
  const list = (Store.state.scienceCompositions || []) as any[];
  if (list.length === 0) {
    el.innerHTML = '<div class="science-empty">还没有保存的科学音乐作品</div>';
    return;
  }
  el.innerHTML =
    '<div class="science-composition-list">' +
    list
      .map(
        (c) =>
          '<div class="science-composition-item"><div><div class="name">' +
          escapeHtml(c.name) +
          '</div><div class="meta">' +
          ((({ ...SCIENCE_TYPE_NAMES, ...SCIENCE_DEEP_TYPE_NAMES }) as Record<string, string>)[c.type] || c.type) +
          ' · ' +
          new Date(c.date).toLocaleDateString('zh-CN') +
          '</div></div><div class="actions"><button style="background:var(--science);color:#fff" data-action="loadScienceComposition" data-args=\'[' +
          c.id +
          ']\'">加载</button><button style="background:rgba(0,0,0,.06);color:var(--text)" data-action="deleteScienceComposition" data-args=\'[' +
          c.id +
          ']\'">删除</button></div></div>'
      )
      .join('') +
    '</div>';
}
export function loadScienceComposition(id: number) {
  const c = ((Store.state.scienceCompositions || []) as any[]).find((x: any) => x.id === id);
  if (!c) return;
  scienceState.type = c.type;
  scienceState.data = c.data;
  scienceState.pattern = c.pattern || [];
  scienceState.options[c.type] = JSON.parse(JSON.stringify(c.options || {}));
  scienceState.mapping[c.type] = JSON.parse(JSON.stringify(c.mapping || {}));
  goScienceStep('compose');
}
export function deleteScienceComposition(id: number) {
  Store.state.scienceCompositions = ((Store.state.scienceCompositions || []) as any[]).filter((x: any) => x.id !== id);
  Store.save();
  renderScienceCompositionList();
}
export function openComposerWithScience() {
  if (!isFreeModeUnlocked()) {
    showToast(t('toast.unlock.world6_required'), 'info');
    return;
  }
  localSet('mathbeat_science_export', {
    type: scienceState.type,
    data: scienceState.data,
    pattern: scienceState.pattern,
  });
  Store.state.exportedScience = true;
  Store.save();
  checkAchievements();
  window.location.href = 'composer.html';
}
export function shareScience() {
  const typeName =
    SCIENCE_TYPE_NAMES[scienceState.type as keyof typeof SCIENCE_TYPE_NAMES] ||
    SCIENCE_DEEP_TYPE_NAMES[scienceState.type as keyof typeof SCIENCE_DEEP_TYPE_NAMES] ||
    scienceState.type;
  const text = t('science.share_text').replace('{type}', typeName);
  if (navigator.share) {
    navigator.share({ title: t('science.title'), text: text, url: location.href });
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => showToast(t('toast.science.copied'), 'success'));
  } else {
    showToast(text, 'info');
  }
}

export function downloadScienceExport(format: 'midi' | 'json' | 'csv') {
  if (!scienceState.pattern || scienceState.pattern.length === 0) regenerateScienceMusic();
  const payload = {
    type: scienceState.type,
    name: scienceState.data.name ||
      SCIENCE_TYPE_NAMES[scienceState.type as keyof typeof SCIENCE_TYPE_NAMES] ||
      SCIENCE_DEEP_TYPE_NAMES[scienceState.type as keyof typeof SCIENCE_DEEP_TYPE_NAMES] ||
      scienceState.type,
    data: scienceState.data,
    pattern: scienceState.pattern,
    options: scienceState.options[scienceState.type],
    mapping: scienceState.mapping[scienceState.type],
    bpm: 120,
  };
  exportScience(payload, format);
  showScienceUploadStatus('已导出 ' + format.toUpperCase(), 'success');
}
/* ===== EXPOSE GLOBALS ===== */
// register delegated handlers. mapping/composition ids ride on data-args; the
// option knob reads its key from a data attribute since inputs only get the event
registerActions({
  toggleScienceMapping: (_e, id) => toggleScienceMapping(id as string),
  loadScienceComposition: (_e, id) => loadScienceComposition(id as number),
  deleteScienceComposition: (_e, id) => deleteScienceComposition(id as number),
});
registerInputs({
  updateScienceOption: (e) => {
    const el = e.target as HTMLInputElement;
    updateScienceOption(el.dataset.optKey || '', el.value);
  },
});
Object.assign(window as any, {
  animateScienceParticles: animateScienceParticles,
  avg: avg,
  deleteScienceComposition: deleteScienceComposition,
  downloadScienceExport: downloadScienceExport,
  drawScienceComposeCanvas: drawScienceComposeCanvas,
  drawScienceDataCanvas: drawScienceDataCanvas,
  goScienceStep: goScienceStep,
  handleScienceFile: handleScienceFile,
  loadScienceComposition: loadScienceComposition,
  loadScienceSample: loadScienceSample,
  normalizeScienceData: normalizeScienceData,
  openComposerWithScience: openComposerWithScience,
  openScienceMode: openScienceMode,
  parseScienceCSV: parseScienceCSV,
  parseScienceText: parseScienceText,
  parseScienceTextComplete: parseScienceTextComplete,
  regenerateScienceMusic: regenerateScienceMusic,
  renderScienceCompose: renderScienceCompose,
  renderScienceCompositionList: renderScienceCompositionList,
  renderScienceData: renderScienceData,
  renderScienceKnobs: renderScienceKnobs,
  renderScienceMappings: renderScienceMappings,
  renderSciencePianoRoll: renderSciencePianoRoll,
  renderScienceStats: renderScienceStats,
  renderScienceVisualizer: renderScienceVisualizer,
  saveScienceComposition: saveScienceComposition,
  scienceSampleCount: scienceSampleCount,
  selectScienceType: selectScienceType,
  shareScience: shareScience,
  showScienceUploadStatus: showScienceUploadStatus,
  startSciencePlay: startSciencePlay,
  stopSciencePlay: stopSciencePlay,
  toggleScienceMapping: toggleScienceMapping,
  toggleSciencePlay: toggleSciencePlay,
  toggleScienceWhyPanel: toggleScienceWhyPanel,
  updateScienceOption: updateScienceOption,
  updateScienceTypeUI: updateScienceTypeUI,
  updateScienceVisualizer: updateScienceVisualizer,
  validateScienceData: validateScienceData,
});
