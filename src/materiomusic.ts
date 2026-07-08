/**
 * Materiomusic 深化模块
 *
 * 基于 Buehler (2025) "Selective Imperfection as a Generative Framework"
 * (arXiv:2601.00863) 实现三个核心功能：
 *
 * 1. Scale Lab — 2^12 音阶穷举 + 熵/缺陷分析 + Hall-Petch 走廊可视化
 * 2. Protein Sonification — 氨基酸振动频率 → 音调的双向映射
 * 3. Spider Web Sonification — 3D 图结构 → 可演奏乐器
 */

import { getAudioCtx, scheduleToneAt, getSharedTransport, stopSharedTransport } from './audio';
import { stopAllPlayback } from './game-engine';
import { registerActions } from './events';
import type { Transport, TransportEvent } from './core/transport';

// ============================================================
// Part 1: Scale Lab — 2^12 音阶缺陷空间探索器
// ============================================================

/** 12 半音中选 k 个的组合，共 2^12 = 4096 种音阶 */
export interface ScaleInfo {
  bits: number;          // 12-bit bitmask
  intervals: number[];   // 音程列表 e.g. [0,2,4,5,7,9,11] for major
  noteCount: number;     // 音阶中的音数
  entropy: number;       // Shannon 熵 (0-1)
  defectDensity: number; // 缺陷密度 (0-1)
  hallPetchScore: number;// Hall-Petch 得分 (0-1)，中等区域最高
  culturalName?: string; // 文化名称（如有）
}

/** 已知的文化音阶 bitmasks */
const CULTURAL_SCALES: Record<number, string> = {
  0b101010110101: '大调 (Major)',
  0b101101010110: '自然小调 (Natural Minor)',
  0b010010010010: '全音阶 (Whole Tone)',
  0b101010101010: '全音阶 (Whole Tone) alt',
  0b001001001001: '减音阶 (Diminished)',
  0b100100100100: '减音阶 (Diminished) alt',
  0b010110101010: '五声大调 (Pentatonic Major)',
  0b001010101010: '五声小调 (Pentatonic Minor)',
  0b101011010110: '和声小调 (Harmonic Minor)',
  0b101101011010: '旋律小调上行 (Melodic Minor)',
  0b100100110010: '蓝调音阶 (Blues)',
  0b001001001100: '西班牙八音 (Spanish Octatonic)',
};

/** 将 12-bit bitmask 转为音程数组 */
function bitsToIntervals(bits: number): number[] {
  const intervals: number[] = [];
  for (let i = 0; i < 12; i++) {
    if (bits & (1 << i)) intervals.push(i);
  }
  return intervals;
}

/** 计算 Shannon 熵 */
function calcEntropy(intervals: number[]): number {
  if (intervals.length <= 1) return 0;
  const n = intervals.length;
  // 计算相邻音程间距
  const gaps: number[] = [];
  for (let i = 1; i < n; i++) gaps.push(intervals[i] - intervals[i - 1]);
  gaps.push(12 - intervals[n - 1] + intervals[0]); // wrap-around

  // Shannon 熵
  const freq: Record<number, number> = {};
  gaps.forEach(g => { freq[g] = (freq[g] || 0) + 1; });
  let entropy = 0;
  for (const g in freq) {
    const p = freq[g] / gaps.length;
    entropy -= p * Math.log2(p);
  }
  // 归一化到 0-1（最大熵 = log2(12) ≈ 3.585）
  return entropy / Math.log2(12);
}

/** 计算缺陷密度：与均匀分布的偏差 */
function calcDefectDensity(intervals: number[]): number {
  const n = intervals.length;
  if (n <= 1) return 1;
  // 理想均匀间距
  const idealGap = 12 / n;
  const gaps: number[] = [];
  for (let i = 1; i < n; i++) gaps.push(intervals[i] - intervals[i - 1]);
  gaps.push(12 - intervals[n - 1] + intervals[0]);
  // 缺陷 = 间距与理想间距的 RMS 偏差
  let sumSq = 0;
  for (const g of gaps) sumSq += (g - idealGap) ** 2;
  const rms = Math.sqrt(sumSq / gaps.length);
  // 归一化到 0-1
  return Math.min(1, rms / idealGap);
}

/** Hall-Petch 得分：中等缺陷密度最优 */
function calcHallPetchScore(defectDensity: number): number {
  // Hall-Petch: strength ∝ 1/√d, 但太高又下降
  // 用钟形函数模拟：peak at defect ~0.3
  const peak = 0.3;
  const sigma = 0.25;
  return Math.exp(-((defectDensity - peak) ** 2) / (2 * sigma ** 2));
}

/** 预计算所有 4096 种音阶 */
export const ALL_SCALES: ScaleInfo[] = (() => {
  const scales: ScaleInfo[] = [];
  for (let bits = 1; bits < 4096; bits++) {
    const intervals = bitsToIntervals(bits);
    const entropy = calcEntropy(intervals);
    const defectDensity = calcDefectDensity(intervals);
    const hallPetchScore = calcHallPetchScore(defectDensity);
    scales.push({
      bits,
      intervals,
      noteCount: intervals.length,
      entropy,
      defectDensity,
      hallPetchScore,
      culturalName: CULTURAL_SCALES[bits],
    });
  }
  return scales;
})();

/** 按 Hall-Petch 得分排序的 Top 50 音阶 */
export const TOP_SCALES = [...ALL_SCALES].sort((a, b) => b.hallPetchScore - a.hallPetchScore).slice(0, 50);

/** Scale Lab 状态 */
export let scaleLabState = {
  selectedBits: 0b101010110101, // 大调
  playing: false,
  transport: null as Transport | null,
  step: 0,
  filterMinNotes: 5,
  filterMaxNotes: 8,
  sortBy: 'hallPetch' as 'hallPetch' | 'entropy' | 'defect' | 'notes',
};

/** 获取音阶的 MIDI 音高集合（从 C4=60 开始） */
export function scaleToMidi(scale: ScaleInfo, octaves: number = 2): number[] {
  const notes: number[] = [];
  for (let oct = 0; oct < octaves; oct++) {
    for (const iv of scale.intervals) {
      notes.push(60 + iv + oct * 12);
    }
  }
  return notes;
}

/** MIDI → 频率 */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** 播放选中音阶 */
export function playScale(bits: number) {
  const scale = ALL_SCALES.find(s => s.bits === bits);
  if (!scale) return;
  scaleLabState.selectedBits = bits;
  const ctx = getAudioCtx();
  const notes = scaleToMidi(scale, 2);
  const t0 = ctx.currentTime + 0.05;
  notes.forEach((midi, i) => {
    const freq = midiToFreq(midi);
    scheduleToneAt(freq, 0.4, 'triangle', 0.15, t0 + i * 0.12);
  });
  renderScaleLabInfo();
}

/** 循环播放音阶 */
export function startScaleLoop() {
  if (scaleLabState.playing) return;
  const scale = ALL_SCALES.find(s => s.bits === scaleLabState.selectedBits);
  if (!scale) return;
  scaleLabState.playing = true;
  scaleLabState.step = 0;
  const notes = scaleToMidi(scale, 2);
  const transport = getSharedTransport(100, 4);
  scaleLabState.transport = transport;
  transport.subscribe((event: TransportEvent) => {
    const s = event.step % notes.length;
    const midi = notes[s];
    scheduleToneAt(midiToFreq(midi), 0.15, 'triangle', 0.12, event.time);
    scaleLabState.step = s;
    updateScaleLabVisualizer(s);
  });
  transport.start();
  const btn = document.getElementById('scaleLabPlayBtn');
  if (btn) btn.textContent = '⏸ 停止';
}

export function stopScaleLoop() {
  scaleLabState.playing = false;
  stopSharedTransport();
  scaleLabState.transport = null;
  const btn = document.getElementById('scaleLabPlayBtn');
  if (btn) btn.textContent = '▶ 循环';
}

export function toggleScaleLoop() {
  if (scaleLabState.playing) stopScaleLoop();
  else startScaleLoop();
}

/** 更新可视化 */
function updateScaleLabVisualizer(step: number) {
  const cells = document.querySelectorAll('.scalelab-cell');
  cells.forEach((c, i) => {
    (c as HTMLElement).classList.toggle('playing', i === step);
  });
}

/** 渲染音阶列表 */
export function renderScaleLabList() {
  const container = document.getElementById('scaleLabList');
  if (!container) return;
  let scales = ALL_SCALES.filter(s =>
    s.noteCount >= scaleLabState.filterMinNotes &&
    s.noteCount <= scaleLabState.filterMaxNotes
  );
  // 排序
  if (scaleLabState.sortBy === 'hallPetch') {
    scales.sort((a, b) => b.hallPetchScore - a.hallPetchScore);
  } else if (scaleLabState.sortBy === 'entropy') {
    scales.sort((a, b) => b.entropy - a.entropy);
  } else if (scaleLabState.sortBy === 'defect') {
    scales.sort((a, b) => a.defectDensity - b.defectDensity);
  } else {
    scales.sort((a, b) => a.noteCount - b.noteCount);
  }
  // 取前 100 个
  scales = scales.slice(0, 100);
  let html = '<div class="scalelab-list-header">';
  html += '<span>音阶</span><span>音数</span><span>熵</span><span>缺陷</span><span>HP得分</span>';
  html += '</div>';
  for (const s of scales) {
    const isSelected = s.bits === scaleLabState.selectedBits;
    const isCultural = !!s.culturalName;
    html += `<div class="scalelab-row${isSelected ? ' selected' : ''}${isCultural ? ' cultural' : ''}" data-action="playScale" data-args='${JSON.stringify({ bits: s.bits })}'>`;
    html += `<span class="scalelab-name">${s.culturalName || '音阶 #' + s.bits}</span>`;
    html += `<span>${s.noteCount}</span>`;
    html += `<span>${(s.entropy * 100).toFixed(0)}%</span>`;
    html += `<span>${(s.defectDensity * 100).toFixed(0)}%</span>`;
    html += `<span><div class="scalelab-hp-bar" style="width:${(s.hallPetchScore * 100).toFixed(0)}%"></div>${(s.hallPetchScore * 100).toFixed(0)}%</span>`;
    html += '</div>';
  }
  container.innerHTML = html;
}

/** 渲染 Hall-Petch 散点图（Canvas） */
export function renderHallPetchScatter() {
  const canvas = document.getElementById('scaleLabCanvas') as HTMLCanvasElement;
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, W, H);
  // 坐标轴
  ctx.strokeStyle = '#30363d';
  ctx.lineWidth = 1;
  const padL = 40, padB = 30, padT = 10, padR = 10;
  const plotW = W - padL - padR;
  const plotH = H - padB - padT;
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, H - padB);
  ctx.lineTo(W - padR, H - padB);
  ctx.stroke();
  // 轴标签
  ctx.fillStyle = '#8b949e';
  ctx.font = '10px sans-serif';
  ctx.fillText('缺陷密度 →', W / 2 - 30, H - 5);
  ctx.save();
  ctx.translate(10, H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('熵 →', -15, 0);
  ctx.restore();
  // Hall-Petch 最优走廊（中等区域）
  ctx.fillStyle = 'rgba(88, 166, 255, 0.08)';
  const corridorX1 = padL + plotW * 0.15;
  const corridorX2 = padL + plotW * 0.5;
  ctx.fillRect(corridorX1, padT, corridorX2 - corridorX1, plotH);
  ctx.strokeStyle = 'rgba(88, 166, 255, 0.3)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(corridorX1, padT);
  ctx.lineTo(corridorX1, H - padB);
  ctx.moveTo(corridorX2, padT);
  ctx.lineTo(corridorX2, H - padB);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(88, 166, 255, 0.5)';
  ctx.font = '8px sans-serif';
  ctx.fillText('Hall-Petch 走廊', corridorX1 + 5, padT + 12);
  // 绘制所有音阶点
  for (const s of ALL_SCALES) {
    const x = padL + s.defectDensity * plotW;
    const y = H - padB - s.entropy * plotH;
    const hpAlpha = s.hallPetchScore;
    if (s.culturalName) {
      ctx.fillStyle = `rgba(240, 136, 62, 0.9)`;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = `rgba(139, 148, 158, ${0.15 + hpAlpha * 0.3})`;
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
  }
  // 高亮选中音阶
  const selected = ALL_SCALES.find(s => s.bits === scaleLabState.selectedBits);
  if (selected) {
    const x = padL + selected.defectDensity * plotW;
    const y = H - padB - selected.entropy * plotH;
    ctx.strokeStyle = '#58a6ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** 渲染选中音阶信息面板 */
export function renderScaleLabInfo() {
  const el = document.getElementById('scaleLabInfo');
  if (!el) return;
  const s = ALL_SCALES.find(x => x.bits === scaleLabState.selectedBits);
  if (!s) { el.innerHTML = ''; return; }
  // 渲染音阶键盘
  let keyboard = '<div class="scalelab-keyboard">';
  for (let i = 0; i < 12; i++) {
    const isInScale = s.intervals.includes(i);
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    keyboard += `<div class="scalelab-key${isInScale ? ' active' : ''}">${noteNames[i]}</div>`;
  }
  keyboard += '</div>';
  el.innerHTML = `
    <div class="scalelab-info-name">${s.culturalName || '音阶 #' + s.bits}</div>
    ${keyboard}
    <div class="scalelab-stats">
      <div><span>音数</span><strong>${s.noteCount}</strong></div>
      <div><span>熵</span><strong>${(s.entropy * 100).toFixed(1)}%</strong></div>
      <div><span>缺陷密度</span><strong>${(s.defectDensity * 100).toFixed(1)}%</strong></div>
      <div><span>HP得分</span><strong>${(s.hallPetchScore * 100).toFixed(1)}%</strong></div>
    </div>
  `;
  // 重新渲染散点图和列表
  renderHallPetchScatter();
  renderScaleLabList();
}

/** 打开 Scale Lab */
export function openScaleLab() {
  stopAllPlayback();
  document.getElementById('scaleLabScreen')!.classList.add('active');
  renderScaleLabInfo();
}

export function closeScaleLab() {
  stopScaleLoop();
  document.getElementById('scaleLabScreen')!.classList.remove('active');
}

// ============================================================
// Part 2: Protein Sonification — 蛋白质双向映射
// ============================================================

/** 20 种氨基酸的振动频率特征 (cm⁻¹)，基于 Buehler 的 amino acid vibrational physics */
const AMINO_ACID_FREQ: Record<string, { freq: number; mw: number; hydropathy: number }> = {
  A: { freq: 2970, mw: 89, hydropathy: 1.8 },   // Alanine
  R: { freq: 3350, mw: 174, hydropathy: -4.5 },  // Arginine
  N: { freq: 3210, mw: 132, hydropathy: -3.5 },  // Asparagine
  D: { freq: 3150, mw: 133, hydropathy: -3.5 },  // Aspartate
  C: { freq: 2550, mw: 121, hydropathy: 2.5 },   // Cysteine
  E: { freq: 3180, mw: 147, hydropathy: -3.5 },  // Glutamate
  Q: { freq: 3240, mw: 146, hydropathy: -3.5 },  // Glutamine
  G: { freq: 3300, mw: 75, hydropathy: -0.4 },   // Glycine
  H: { freq: 3280, mw: 155, hydropathy: -3.2 },  // Histidine
  I: { freq: 2960, mw: 131, hydropathy: 4.5 },   // Isoleucine
  L: { freq: 2960, mw: 131, hydropathy: 3.8 },   // Leucine
  K: { freq: 3290, mw: 146, hydropathy: -3.9 },  // Lysine
  M: { freq: 2820, mw: 149, hydropathy: 1.9 },   // Methionine
  F: { freq: 3050, mw: 165, hydropathy: 2.8 },   // Phenylalanine
  P: { freq: 2980, mw: 115, hydropathy: -1.6 },  // Proline
  S: { freq: 3300, mw: 105, hydropathy: -0.8 },  // Serine
  T: { freq: 3270, mw: 119, hydropathy: -0.7 },  // Threonine
  W: { freq: 3400, mw: 204, hydropathy: -0.9 },  // Tryptophan
  Y: { freq: 3220, mw: 181, hydropathy: -1.3 },  // Tyrosine
  V: { freq: 2960, mw: 117, hydropathy: 4.2 },   // Valine
};

/** 氨基酸名称映射 */
const AA_NAMES: Record<string, string> = {
  A: 'Ala', R: 'Arg', N: 'Asn', D: 'Asp', C: 'Cys', E: 'Glu', Q: 'Gln',
  G: 'Gly', H: 'His', I: 'Ile', L: 'Leu', K: 'Lys', M: 'Met', F: 'Phe',
  P: 'Pro', S: 'Ser', T: 'Thr', W: 'Trp', Y: 'Tyr', V: 'Val',
};

/** 真实蛋白质样本序列 */
export const PROTEIN_SAMPLES: Record<string, { name: string; sequence: string; organism: string; description: string }> = {
  insulin: {
    name: '人胰岛素 (Insulin)',
    sequence: 'GIVEQCCTSICSLYQLENYCNFVNQHLCGSHLVEALYLVCGERGFFYTPKT',
    organism: 'Homo sapiens',
    description: '调节血糖的肽激素，含 A 链(21aa) + B 链(30aa)',
  },
  gfp: {
    name: '绿色荧光蛋白片段 (GFP β-barrel)',
    sequence: 'MSKGEELFTGVVPILVELDGDVNGHKFSVSGEGEGDATYGKLTLKFICTTGKLPVPWPTLVTTLTYGVQCFSRYPDHMKQHDFFKSAMPEGYVQERTIFFKDDGNYKTRAEVKFEGDTLVNRIELKGIDFKEDGNILGHKLEYNYNSHNVYIMADKQKNGIKVNFKIRHNIEDGSVQLADHYQQNTPIGDGPVLLPDNHYLSTQSALSKDPNEKRDHMVLLEFVTAAGITHGMDELYK',
    organism: 'Aequorea victoria',
    description: '238 aa 荧光蛋白，β桶状结构',
  },
  lysozyme: {
    name: 'T4 溶菌酶片段 (T4 Lysozyme)',
    sequence: 'MNIFEMLRIDDEGLRLKIYKDTEGYYTIGIGHLLTKSPSLNAAKSELDKAIGRNTNGVITKDEAEKLFNQDVDAAVRGILRNAKLKPVYDSLDAVRRAALINMVFQMGETGVAGFTNSLRMLQQKRWDEAAVNLAKSRWYNQTPNRAKRVITTFRTGTWDAY',
    organism: 'Enterobacteria phage T4',
    description: '164 aa 酶，水解细菌细胞壁',
  },
  silk: {
    name: '蜘蛛丝蛋白片段 (Spidroin)',
    sequence: 'GAGAAAAAGGAGTGQGGYGGLGSQGSGRGGLGGQGAGAAAAAGGAGTGQGGYGGLGSQGSGRGGLGGQGAG',
    organism: 'Nephila clavipes',
    description: '蜘蛛丝主要丝心蛋白重复序列，富含 Gly/Ala',
  },
};

/** 蛋白质状态 */
export let proteinState = {
  sequence: '',
  sampleKey: 'insulin',
  playing: false,
  transport: null as Transport | null,
  step: 0,
  notes: [] as { midi: number; velocity: number; aa: string }[],
  // 逆向映射：从音符序列反推氨基酸
  reverseMode: false,
  reverseInput: [] as number[],
};

/** 氨基酸 → MIDI 音高
 * 基于振动频率映射到可听范围 (220-1760 Hz)
 * freq (cm⁻¹) → Hz: f = freq * c ≈ freq * 3e10
 * 但我们映射到音乐频率范围
 */
function aaToMidi(aa: string): number {
  const data = AMINO_ACID_FREQ[aa];
  if (!data) return 60; // 默认 C4
  // 将振动频率 (2550-3400 cm⁻¹) 映射到 MIDI 48-84 (C3-C6)
  const minFreq = 2550, maxFreq = 3400;
  const ratio = (data.freq - minFreq) / (maxFreq - minFreq);
  // 分子量影响八度选择
  const mwRatio = Math.min(1, data.mw / 204);
  // 疏水性影响音色（通过 velocity）
  let midi = 48 + Math.round(ratio * 36) - Math.round(mwRatio * 6);
  // 确保在合理范围
  midi = Math.max(36, Math.min(84, midi));
  return midi;
}

/** 氨基酸 → 力度（基于疏水性） */
function aaToVelocity(aa: string): number {
  const data = AMINO_ACID_FREQ[aa];
  if (!data) return 0.5;
  // 疏水性 -4.5 到 4.5 映射到 0.2 到 0.8
  return 0.2 + (data.hydropathy + 4.5) / 9 * 0.6;
}

/** 蛋白质序列 → 音符序列（正向映射） */
export function proteinToMusic(sequence: string): { midi: number; velocity: number; aa: string }[] {
  const notes: { midi: number; velocity: number; aa: string }[] = [];
  for (const aa of sequence.toUpperCase()) {
    if (AMINO_ACID_FREQ[aa]) {
      notes.push({
        midi: aaToMidi(aa),
        velocity: aaToVelocity(aa),
        aa,
      });
    }
  }
  return notes;
}

/** 音符序列 → 氨基酸序列（逆向映射）
 * 实现 Buehler 论文的核心概念：可逆映射
 * 给定一组 MIDI 音高，反推最可能的氨基酸序列
 */
export function musicToProtein(midiNotes: number[]): string {
  // 构建逆向查找表：MIDI → 最可能的氨基酸
  const midiToAA: Record<number, string> = {};
  for (const aa of Object.keys(AMINO_ACID_FREQ)) {
    const midi = aaToMidi(aa);
    // 取该 MIDI 对应的第一个氨基酸（或更近的）
    if (!midiToAA[midi] || Math.abs(AMINO_ACID_FREQ[aa].freq - 2970) < Math.abs(AMINO_ACID_FREQ[midiToAA[midi]].freq - 2970)) {
      midiToAA[midi] = aa;
    }
  }
  // 反推
  let seq = '';
  for (const midi of midiNotes) {
    // 精确匹配
    if (midiToAA[midi]) {
      seq += midiToAA[midi];
    } else {
      // 找最近的
      let bestAA = 'G';
      let bestDist = Infinity;
      for (const aa of Object.keys(AMINO_ACID_FREQ)) {
        const dist = Math.abs(aaToMidi(aa) - midi);
        if (dist < bestDist) {
          bestDist = dist;
          bestAA = aa;
        }
      }
      seq += bestAA;
    }
  }
  return seq;
}

/** 加载蛋白质样本 */
export function loadProteinSample(key: string) {
  const sample = PROTEIN_SAMPLES[key];
  if (!sample) return;
  proteinState.sampleKey = key;
  proteinState.sequence = sample.sequence;
  proteinState.notes = proteinToMusic(sample.sequence);
  renderProteinInfo();
}

/** 播放蛋白质音乐 */
export function startProteinPlay() {
  if (proteinState.notes.length === 0) return;
  if (proteinState.playing) return;
  proteinState.playing = true;
  proteinState.step = 0;
  const transport = getSharedTransport(120, 4);
  proteinState.transport = transport;
  transport.subscribe((event: TransportEvent) => {
    const s = event.step % proteinState.notes.length;
    const note = proteinState.notes[s];
    if (note) {
      scheduleToneAt(midiToFreq(note.midi), 0.2, 'triangle', note.velocity * 0.3, event.time);
      // 添加泛音
      scheduleToneAt(midiToFreq(note.midi) * 2, 0.15, 'sine', note.velocity * 0.1, event.time);
    }
    proteinState.step = s;
    updateProteinVisualizer(s);
  });
  transport.start();
  const btn = document.getElementById('proteinPlayBtn');
  if (btn) btn.textContent = '⏸ 停止';
}

export function stopProteinPlay() {
  proteinState.playing = false;
  stopSharedTransport();
  proteinState.transport = null;
  const btn = document.getElementById('proteinPlayBtn');
  if (btn) btn.textContent = '▶ 播放';
}

export function toggleProteinPlay() {
  if (proteinState.playing) stopProteinPlay();
  else startProteinPlay();
}

function updateProteinVisualizer(step: number) {
  const cells = document.querySelectorAll('.protein-cell');
  cells.forEach((c, i) => {
    (c as HTMLElement).classList.toggle('playing', i === step);
  });
}

/** 渲染蛋白质信息面板 */
export function renderProteinInfo() {
  const el = document.getElementById('proteinInfo');
  if (!el) return;
  const sample = PROTEIN_SAMPLES[proteinState.sampleKey];
  if (!sample) return;
  // 计算氨基酸组成
  const composition: Record<string, number> = {};
  for (const aa of proteinState.sequence) {
    composition[aa] = (composition[aa] || 0) + 1;
  }
  const total = proteinState.sequence.length;
  // 渲染序列可视化（前 60 个氨基酸）
  let seqHtml = '<div class="protein-sequence">';
  for (let i = 0; i < Math.min(60, proteinState.notes.length); i++) {
    const note = proteinState.notes[i];
    const height = 20 + note.velocity * 40;
    seqHtml += `<div class="protein-cell" style="height:${height}px" title="${note.aa}=${AA_NAMES[note.aa]||note.aa} (MIDI ${note.midi})"></div>`;
  }
  seqHtml += '</div>';
  // 渲染组成
  let compHtml = '<div class="protein-composition">';
  const sortedAA = Object.entries(composition).sort((a, b) => b[1] - a[1]);
  for (const [aa, count] of sortedAA) {
    const pct = (count / total * 100).toFixed(1);
    compHtml += `<span class="protein-comp-item"><strong>${aa}</strong>:${pct}%</span>`;
  }
  compHtml += '</div>';
  el.innerHTML = `
    <div class="protein-name">${sample.name}</div>
    <div class="protein-desc">${sample.description}</div>
    <div class="protein-organism">来源: ${sample.organism} · 长度: ${total} aa</div>
    ${seqHtml}
    <div class="protein-comp-title">氨基酸组成:</div>
    ${compHtml}
    <div class="protein-music-info">
      <span>音符数: ${proteinState.notes.length}</span>
      <span>音域: ${Math.min(...proteinState.notes.map(n=>n.midi))} - ${Math.max(...proteinState.notes.map(n=>n.midi))} (MIDI)</span>
    </div>
  `;
}

/** 逆向映射测试：玩家输入音符 → 反推氨基酸 */
export function reverseMapTest(inputMidis: number[]) {
  const result = musicToProtein(inputMidis);
  const el = document.getElementById('proteinReverseResult');
  if (el) {
    let html = '<div class="protein-reverse-title">逆向映射结果：</div>';
    html += '<div class="protein-reverse-seq">';
    for (const aa of result) {
      html += `<span class="protein-reverse-aa" title="${AA_NAMES[aa]||aa}">${aa}</span>`;
    }
    html += '</div>';
    html += `<div class="protein-reverse-full">完整序列: ${result}</div>`;
    el.innerHTML = html;
  }
  // 播放结果
  const ctx = getAudioCtx();
  const t0 = ctx.currentTime + 0.05;
  inputMidis.forEach((midi, i) => {
    scheduleToneAt(midiToFreq(midi), 0.3, 'triangle', 0.15, t0 + i * 0.15);
  });
}

/** 打开蛋白质声化 */
export function openProteinMode() {
  stopAllPlayback();
  document.getElementById('proteinScreen')!.classList.add('active');
  loadProteinSample(proteinState.sampleKey);
}

export function closeProteinMode() {
  stopProteinPlay();
  document.getElementById('proteinScreen')!.classList.remove('active');
}

// ============================================================
// Part 3: Spider Web Sonification — 蜘蛛网图结构声化
// ============================================================

/** 蜘蛛网节点 */
interface WebNode {
  id: number;
  angle: number;      // 角度 (弧度)
  radius: number;     // 距中心距离
  tension: number;    // 张力 (0-1)
}

/** 蜘蛛网边 */
interface WebEdge {
  from: number;
  to: number;
  weight: number;     // 张力/长度比
}

/** 蜘蛛网结构 */
interface SpiderWeb {
  nodes: WebNode[];
  edges: WebEdge[];
  name: string;
}

/** 生成径向蜘蛛网（放射状 + 环状） */
function generateRadialWeb(rings: number, spokes: number, irregularity: number = 0.15): SpiderWeb {
  const nodes: WebNode[] = [];
  const edges: WebEdge[] = [];
  let id = 0;
  // 中心节点
  nodes.push({ id: id++, angle: 0, radius: 0, tension: 1.0 });
  // 放射状节点
  for (let r = 1; r <= rings; r++) {
    for (let s = 0; s < spokes; s++) {
      const angle = (s / spokes) * Math.PI * 2 + (r % 2) * (Math.PI / spokes); // 交错
      const radius = r / rings + (Math.random() - 0.5) * irregularity * (r / rings);
      const tension = 0.5 + Math.random() * 0.5;
      nodes.push({ id: id++, angle, radius: Math.max(0.05, radius), tension });
    }
  }
  // 放射边（从中心向外）
  for (let s = 0; s < spokes; s++) {
    for (let r = 0; r < rings; r++) {
      const from = r === 0 ? 0 : 1 + (r - 1) * spokes + s;
      const to = 1 + r * spokes + s;
      const weight = nodes[to].tension;
      edges.push({ from, to, weight });
    }
  }
  // 环边
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < spokes; s++) {
      const from = 1 + r * spokes + s;
      const to = 1 + r * spokes + ((s + 1) % spokes);
      const weight = (nodes[from].tension + nodes[to].tension) / 2;
      edges.push({ from, to, weight });
    }
  }
  return { nodes, edges, name: `径向网 ${rings}环×${spokes}辐` };
}

/** 预定义蜘蛛网样本 */
export const WEB_SAMPLES: Record<string, SpiderWeb> = {
  orb: generateRadialWeb(4, 8, 0.1),
  tangled: generateRadialWeb(3, 12, 0.4),
  sheet: generateRadialWeb(5, 6, 0.05),
};

/** 蜘蛛网状态 */
export let webState = {
  sampleKey: 'orb',
  web: WEB_SAMPLES.orb,
  playing: false,
  transport: null as Transport | null,
  step: 0,
  path: [] as number[], // 振动传播路径
};

/** 将蜘蛛网节点映射为音高
 * radius → 音高（外圈高音，内圈低音）
 * tension → 音量
 * angle → 立体声位置（简化为音色选择）
 */
function nodeToFreq(node: WebNode): number {
  // radius 0-1 → 频率 110-880 Hz
  return 110 * Math.pow(8, node.radius);
}

function nodeToVelocity(node: WebNode): number {
  return 0.1 + node.tension * 0.4;
}

/** 计算振动传播路径（从中心出发的波传播）
 * 使用 BFS 模拟波从中心向外传播
 */
function computeWavePath(web: SpiderWeb, startNode: number = 0): number[] {
  const visited = new Set<number>([startNode]);
  const path: number[] = [startNode];
  const queue: number[] = [startNode];
  // 构建邻接表
  const adj: Record<number, number[]> = {};
  for (const edge of web.edges) {
    if (!adj[edge.from]) adj[edge.from] = [];
    if (!adj[edge.to]) adj[edge.to] = [];
    adj[edge.from].push(edge.to);
    adj[edge.to].push(edge.from);
  }
  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = (adj[current] || []).sort((a, b) => {
      // 按张力排序：高张力先传播
      const wa = web.edges.find(e => (e.from === current && e.to === a) || (e.to === current && e.from === a));
      const wb = web.edges.find(e => (e.from === current && e.to === b) || (e.to === current && e.from === b));
      return (wb?.weight || 0) - (wa?.weight || 0);
    });
    for (const n of neighbors) {
      if (!visited.has(n)) {
        visited.add(n);
        path.push(n);
        queue.push(n);
      }
    }
  }
  return path;
}

/** 播放蜘蛛网振动 */
export function startWebPlay() {
  if (webState.playing) return;
  webState.playing = true;
  webState.path = computeWavePath(webState.web);
  webState.step = 0;
  const transport = getSharedTransport(80, 4);
  webState.transport = transport;
  transport.subscribe((event: TransportEvent) => {
    const s = event.step % webState.path.length;
    const nodeId = webState.path[s];
    const node = webState.web.nodes[nodeId];
    if (node && node.radius > 0) {
      const freq = nodeToFreq(node);
      const vel = nodeToVelocity(node);
      scheduleToneAt(freq, 0.3, 'sine', vel, event.time);
      // 添加谐波模拟共振
      scheduleToneAt(freq * 1.5, 0.2, 'sine', vel * 0.3, event.time);
    }
    webState.step = s;
    updateWebVisualizer(s);
  });
  transport.start();
  const btn = document.getElementById('webPlayBtn');
  if (btn) btn.textContent = '⏸ 停止';
}

export function stopWebPlay() {
  webState.playing = false;
  stopSharedTransport();
  webState.transport = null;
  const btn = document.getElementById('webPlayBtn');
  if (btn) btn.textContent = '▶ 播放';
}

export function toggleWebPlay() {
  if (webState.playing) stopWebPlay();
  else startWebPlay();
}

function updateWebVisualizer(step: number) {
  const nodeId = webState.path[step];
  const node = document.querySelector(`.web-node[data-id="${nodeId}"]`);
  if (node) {
    (node as HTMLElement).classList.add('vibrating');
    setTimeout(() => (node as HTMLElement).classList.remove('vibrating'), 200);
  }
}

/** 渲染蜘蛛网可视化 (SVG) */
export function renderWebViz() {
  const container = document.getElementById('webViz');
  if (!container) return;
  const web = webState.web;
  const size = 300;
  const cx = size / 2, cy = size / 2;
  let svg = `<svg viewBox="0 0 ${size} ${size}" style="width:100%;max-width:${size}px">`;
  // 绘制边
  for (const edge of web.edges) {
    const from = web.nodes[edge.from];
    const to = web.nodes[edge.to];
    const x1 = cx + Math.cos(from.angle) * from.radius * (size / 2 - 10);
    const y1 = cy + Math.sin(from.angle) * from.radius * (size / 2 - 10);
    const x2 = cx + Math.cos(to.angle) * to.radius * (size / 2 - 10);
    const y2 = cy + Math.sin(to.angle) * to.radius * (size / 2 - 10);
    const opacity = 0.2 + edge.weight * 0.5;
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#58a6ff" stroke-width="${0.5 + edge.weight}" opacity="${opacity}" />`;
  }
  // 绘制节点
  for (const node of web.nodes) {
    const x = cx + Math.cos(node.angle) * node.radius * (size / 2 - 10);
    const y = cy + Math.sin(node.angle) * node.radius * (size / 2 - 10);
    const r = 2 + node.tension * 4;
    svg += `<circle class="web-node" data-id="${node.id}" cx="${x}" cy="${y}" r="${r}" fill="${node.id === 0 ? '#f0883e' : '#e6edf3'}" opacity="${0.6 + node.tension * 0.4}" />`;
  }
  svg += '</svg>';
  container.innerHTML = svg;
  // 信息
  const info = document.getElementById('webInfo');
  if (info) {
    info.innerHTML = `
      <div class="web-name">${web.name}</div>
      <div class="web-stats">
        <span>节点: ${web.nodes.length}</span>
        <span>边: ${web.edges.length}</span>
        <span>波路径长度: ${computeWavePath(web).length}</span>
      </div>
      <div class="web-desc">振动从中心向外传播，按张力大小依次激发各节点。外圈节点产生高频，内圈产生低频，模拟蜘蛛感知猎物振动的机制。</div>
    `;
  }
}

/** 加载蜘蛛网样本 */
export function loadWebSample(key: string) {
  const web = WEB_SAMPLES[key];
  if (!web) return;
  webState.sampleKey = key;
  webState.web = web;
  renderWebViz();
}

/** 打开蜘蛛网声化 */
export function openWebMode() {
  stopAllPlayback();
  document.getElementById('webScreen')!.classList.add('active');
  renderWebViz();
}

export function closeWebMode() {
  stopWebPlay();
  document.getElementById('webScreen')!.classList.remove('active');
}

// ============================================================
// 事件注册
// ============================================================

export function initMateriomusicEvents() {
  registerActions({
    playScale: (args: any) => playScale(args.bits),
    toggleScaleLoop: () => toggleScaleLoop(),
    closeScaleLab: () => closeScaleLab(),
    setScaleFilter: (args: any) => {
      if (args.min !== undefined) scaleLabState.filterMinNotes = args.min;
      if (args.max !== undefined) scaleLabState.filterMaxNotes = args.max;
      if (args.sortBy) scaleLabState.sortBy = args.sortBy;
      renderScaleLabList();
    },
    toggleProteinPlay: () => toggleProteinPlay(),
    closeProteinMode: () => closeProteinMode(),
    loadProteinSample: (args: any) => loadProteinSample(args.key),
    reverseMapTest: (args: any) => reverseMapTest(args.midis || [60, 62, 64, 65, 67]),
    toggleWebPlay: () => toggleWebPlay(),
    closeWebMode: () => closeWebMode(),
    loadWebSample: (args: any) => loadWebSample(args.key),
  });
}
