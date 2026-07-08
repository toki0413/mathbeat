/**
 * 科学之声 - 鲁棒文件解析模块
 * 支持自动分隔符检测、列名模糊匹配、多格式科学数据解析
 */

import { isNumeric, toNumbers, mean, minMax } from './signal';

export interface ParseResult {
  name: string;
  type: string;
  data: any;
  warnings: string[];
  columns?: string[];
  rows?: number;
}

export interface ParserContext {
  type: 'dft' | 'md' | 'fem' | 'cfd' | 'xrd' | 'dna' | 'pulsar';
  fileName: string;
  text: string;
  ext: string;
}

const COMMENT_MARKERS = ['#', '!', '%', '//'];

export function detectDelimiter(line: string): string {
  const candidates = [',', '\t', ';', '|', ' '];
  let best = ',';
  let bestCount = 0;
  for (const d of candidates) {
    if (d === ' ') {
      // 多个连续空格合并后计数
      const count = line.trim().split(/\s+/).length - 1;
      if (count > bestCount) {
        best = d;
        bestCount = count;
      }
    } else {
      const count = line.split(d).length - 1;
      if (count > bestCount) {
        best = d;
        bestCount = count;
      }
    }
  }
  return best;
}

export function splitLine(line: string, delimiter?: string): string[] {
  const d = delimiter || detectDelimiter(line);
  if (d === ' ')
    return line
      .trim()
      .split(/\s+/)
      .filter((v) => v.length > 0);
  return line
    .split(d)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

export function stripComments(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => {
      let cleaned = line;
      for (const m of COMMENT_MARKERS) {
        const idx = cleaned.indexOf(m);
        if (idx >= 0) cleaned = cleaned.substring(0, idx);
      }
      return cleaned;
    })
    .join('\n');
}

export function parseCSVLike(text: string, delimiter?: string): { headers: string[]; rows: any[] } {
  const clean = stripComments(text);
  const lines = clean
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 1) throw new Error('文件为空');

  // 启发式判断第一行是否为表头：包含非数字内容
  const firstLine = lines[0];
  const delim = delimiter || detectDelimiter(firstLine);
  const firstParts = splitLine(firstLine, delim);
  const looksLikeHeader = firstParts.some((v) => !isNumeric(v));

  let headers: string[];
  let dataLines: string[];
  if (looksLikeHeader) {
    headers = firstParts.map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, ''));
    dataLines = lines.slice(1);
  } else {
    headers = firstParts.map((_, i) => 'col' + (i + 1));
    dataLines = lines;
  }

  const rows = dataLines
    .map((line) => {
      const parts = splitLine(line, delim);
      const obj: any = {};
      headers.forEach((h, i) => {
        const raw = parts[i] !== undefined ? parts[i] : '';
        obj[h] =
          raw === '' || raw === 'NaN' || raw === 'nan' || raw === 'inf' || raw === '-inf'
            ? null
            : isNumeric(raw)
              ? Number(raw)
              : raw;
      });
      return obj;
    })
    .filter((r) => Object.values(r).some((v) => v !== null && v !== ''));

  return { headers, rows };
}

export function fuzzyFindColumn(headers: string[], candidates: string[]): string | null {
  const lowerHeaders = headers.map((h) => h.toLowerCase());
  for (const cand of candidates) {
    const c = cand.toLowerCase();
    // 完全匹配
    const exact = lowerHeaders.indexOf(c);
    if (exact >= 0) return headers[exact];
    // 包含匹配
    const contains = lowerHeaders.findIndex((h) => h.includes(c));
    if (contains >= 0) return headers[contains];
    // 缩写匹配
    const abbr = lowerHeaders.findIndex((h) => c.split('').every((ch) => h.includes(ch)));
    if (abbr >= 0) return headers[abbr];
  }
  return null;
}

function extractNumbersFromText(text: string): number[] {
  return text.match(/[-+]?\d*\.?\d+([eE][-+]?\d+)?/g)?.map(Number) || [];
}

// ===== 各类型解析器 =====

function parseDFT(ctx: ParserContext): ParseResult {
  const warnings: string[] = [];
  let data: any = {};

  if (ctx.ext === 'outcar' || ctx.text.includes('VASP') || ctx.text.toLowerCase().includes('band no.')) {
    data = parseVASPOutcar(ctx);
  } else if (ctx.ext === 'json') {
    data = JSON.parse(ctx.text);
  } else {
    const { headers, rows } = parseCSVLike(ctx.text);
    const kCol = fuzzyFindColumn(headers, ['kpoint', 'k', 'kpt', 'k-point', 'k_path']);
    const eCol = fuzzyFindColumn(headers, ['energy', 'e', 'eigenvalue', 'bandenergy']);
    if (!kCol && !eCol) throw new Error('未找到 kpoint/energy 列');
    if (!kCol) warnings.push('未找到 kpoint 列，使用行索引代替');
    if (!eCol) warnings.push('未找到 energy 列');
    data = {
      name: ctx.fileName,
      kpoints: rows.map((r, i) => (kCol ? Number(r[kCol]) : i)),
      energies: eCol ? rows.map((r) => Number(r[eCol])) : rows.map((r) => Number(Object.values(r)[0])),
      fermi: 0,
      bandgap: 0.5,
    };
    if (rows.length > 1) {
      const sorted = data.energies.slice().sort((a: number, b: number) => a - b);
      // 简单估计带隙：最大相邻间隔
      let maxGap = 0;
      for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i] - sorted[i - 1];
        if (gap > maxGap) maxGap = gap;
      }
      data.bandgap = maxGap;
    }
  }
  return { name: ctx.fileName, type: 'dft', data, warnings };
}

function parseVASPOutcar(ctx: ParserContext): any {
  const lines = ctx.text.split(/\r?\n/);
  const kpoints: number[] = [];
  const energies: number[] = [];
  let fermi = 0;
  let inBands = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('E-fermi')) {
      const nums = extractNumbersFromText(line);
      if (nums.length) fermi = nums[0];
    }
    if (line.toLowerCase().includes('k-point') && line.toLowerCase().includes('blochl')) {
      const nums = extractNumbersFromText(line);
      if (nums.length) kpoints.push(nums[nums.length - 1]);
    }
    if (line.includes('band No.')) {
      inBands = true;
      i++;
      while (i < lines.length) {
        const parts = lines[i].trim().split(/\s+/);
        if (parts.length < 2) break;
        const last = Number(parts[parts.length - 1]);
        if (!isNaN(last)) energies.push(last);
        i++;
      }
      inBands = false;
    }
  }
  return { name: ctx.fileName, kpoints, energies, fermi, bandgap: 0.5 };
}

function parseMD(ctx: ParserContext): ParseResult {
  const warnings: string[] = [];
  let data: any = {};

  if (ctx.ext === 'lammpstrj' || ctx.ext === 'out' || ctx.text.toLowerCase().includes('item: timestep')) {
    data = parseLammpsDump(ctx);
  } else if (ctx.ext === 'xyz' || ctx.text.toLowerCase().includes('xyz')) {
    data = parseXYZ(ctx);
  } else if (ctx.ext === 'json') {
    data = JSON.parse(ctx.text);
  } else {
    const { headers, rows } = parseCSVLike(ctx.text);
    const hasCoords = ['x', 'y', 'z'].every((axis) => fuzzyFindColumn(headers, [axis]));
    const distCol = fuzzyFindColumn(headers, ['distance', 'r', 'dist', 'length']);
    const freqCol = fuzzyFindColumn(headers, ['frequency', 'freq', 'f']);
    const tempCol = fuzzyFindColumn(headers, ['temp', 'temperature', 't']);

    if (hasCoords) {
      const xCol = fuzzyFindColumn(headers, ['x'])!;
      const yCol = fuzzyFindColumn(headers, ['y'])!;
      const zCol = fuzzyFindColumn(headers, ['z'])!;
      const tCol = fuzzyFindColumn(headers, ['t', 'time', 'timestep', 'step']);
      data.frames = rows.map((r, i) => ({
        t: tCol ? Number(r[tCol]) : i * 0.01,
        x: Number(r[xCol]),
        y: Number(r[yCol]),
        z: Number(r[zCol]),
      }));
      data.distances = [];
    } else if (distCol) {
      data.distances = rows.map((r) => Number(r[distCol]));
      data.frames = rows.map((r, i) => ({ t: i * 0.01, x: 0, y: 0, z: 0 }));
    } else {
      throw new Error('MD 数据需要 x/y/z 坐标或 distance 列');
    }
    data.frequencies = freqCol ? rows.map((r) => Number(r[freqCol])) : [];
    data.temp = tempCol ? Number(rows[0][tempCol]) : 300;
    data.name = ctx.fileName;
  }

  // 如果没有距离数组，从 frames 计算质心位移近似
  if (!data.distances || data.distances.length === 0) {
    data.distances = data.frames.map((f: any, i: number) => {
      if (i === 0) return 0;
      const prev = data.frames[i - 1];
      return Math.sqrt(Math.pow(f.x - prev.x, 2) + Math.pow(f.y - prev.y, 2) + Math.pow(f.z - prev.z, 2));
    });
    warnings.push('未提供 distance 列，已从坐标帧估算原子运动距离');
  }
  return { name: ctx.fileName, type: 'md', data, warnings };
}

function parseLammpsDump(ctx: ParserContext): any {
  const lines = ctx.text.split(/\r?\n/);
  const frames: any[] = [];
  const distances: number[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].toLowerCase();
    if (line.includes('item: timestep')) {
      const timestep = parseInt(lines[i + 1] || '0') || frames.length;
      i += 2;
      let natoms = 0;
      while (i < lines.length && !lines[i].toLowerCase().includes('item: atoms')) {
        if (lines[i].toLowerCase().includes('item: number of atoms')) natoms = parseInt(lines[i + 1] || '0');
        i++;
      }
      i++; // skip "ITEM: ATOMS ..."
      let xsum = 0,
        ysum = 0,
        zsum = 0,
        cnt = 0;
      let xmin = Infinity,
        ymin = Infinity,
        zmin = Infinity;
      let xmax = -Infinity,
        ymax = -Infinity,
        zmax = -Infinity;
      for (let k = 0; k < natoms && i < lines.length; k++) {
        const parts = lines[i].trim().split(/\s+/);
        if (parts.length >= 5) {
          const x = parseFloat(parts[2]),
            y = parseFloat(parts[3]),
            z = parseFloat(parts[4]);
          if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            xsum += x;
            ysum += y;
            zsum += z;
            cnt++;
            xmin = Math.min(xmin, x);
            xmax = Math.max(xmax, x);
            ymin = Math.min(ymin, y);
            ymax = Math.max(ymax, y);
            zmin = Math.min(zmin, z);
            zmax = Math.max(zmax, z);
          }
        }
        i++;
      }
      if (cnt > 0) {
        frames.push({ t: timestep * 0.001, x: xsum / cnt, y: ysum / cnt, z: zsum / cnt });
        distances.push(Math.sqrt(Math.pow(xmax - xmin, 2) + Math.pow(ymax - ymin, 2) + Math.pow(zmax - zmin, 2)));
      }
    } else {
      i++;
    }
  }
  return { name: ctx.fileName, frames, distances, frequencies: distances.map(() => 200), temp: 300 };
}

function parseXYZ(ctx: ParserContext): any {
  const lines = ctx.text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const frames: any[] = [];
  const distances: number[] = [];
  let i = 0;
  while (i < lines.length) {
    const natoms = parseInt(lines[i]);
    if (isNaN(natoms)) {
      i++;
      continue;
    }
    i++; // skip comment/title line
    let xsum = 0,
      ysum = 0,
      zsum = 0,
      cnt = 0;
    let xmin = Infinity,
      ymin = Infinity,
      zmin = Infinity;
    let xmax = -Infinity,
      ymax = -Infinity,
      zmax = -Infinity;
    for (let k = 0; k < natoms && i < lines.length; k++) {
      const parts = lines[i].split(/\s+/);
      if (parts.length >= 4) {
        const x = parseFloat(parts[1]),
          y = parseFloat(parts[2]),
          z = parseFloat(parts[3]);
        if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
          xsum += x;
          ysum += y;
          zsum += z;
          cnt++;
          xmin = Math.min(xmin, x);
          xmax = Math.max(xmax, x);
          ymin = Math.min(ymin, y);
          ymax = Math.max(ymax, y);
          zmin = Math.min(zmin, z);
          zmax = Math.max(zmax, z);
        }
      }
      i++;
    }
    if (cnt > 0) {
      frames.push({ t: frames.length * 0.01, x: xsum / cnt, y: ysum / cnt, z: zsum / cnt });
      distances.push(Math.sqrt(Math.pow(xmax - xmin, 2) + Math.pow(ymax - ymin, 2) + Math.pow(zmax - zmin, 2)));
    }
  }
  return { name: ctx.fileName, frames, distances, frequencies: distances.map(() => 200), temp: 300 };
}

function parseFEM(ctx: ParserContext): ParseResult {
  let data: any;
  if (ctx.ext === 'json') {
    data = JSON.parse(ctx.text);
  } else {
    const { headers, rows } = parseCSVLike(ctx.text);
    const stressCol = fuzzyFindColumn(headers, ['stress', 's', 'sigma', 'mises']);
    const dispCol = fuzzyFindColumn(headers, ['displacement', 'disp', 'u', 'deformation']);
    const modeCol = fuzzyFindColumn(headers, ['mode', 'frequency', 'freq', 'eigen']);
    if (!stressCol && !dispCol) throw new Error('FEM 数据需要 stress 或 displacement 列');
    data = {
      name: ctx.fileName,
      nodes: rows.map((r, i) => ({
        id: i,
        stress: stressCol ? Number(r[stressCol]) : 0,
        displacement: dispCol ? Number(r[dispCol]) : 0,
      })),
      elements: rows.map((r, i) => i),
      modes: modeCol ? rows.map((r) => Number(r[modeCol])).filter((v) => !isNaN(v)) : [],
    };
  }
  return { name: ctx.fileName, type: 'fem', data, warnings: [] };
}

function parseCFD(ctx: ParserContext): ParseResult {
  let data: any;
  if (ctx.ext === 'json') {
    data = JSON.parse(ctx.text);
  } else {
    const { headers, rows } = parseCSVLike(ctx.text);
    const velCol = fuzzyFindColumn(headers, ['velocity', 'vel', 'u', 'speed']);
    const presCol = fuzzyFindColumn(headers, ['pressure', 'p', 'pres']);
    const vorCol = fuzzyFindColumn(headers, ['vorticity', 'vort', 'omega', 'w']);
    const reCol = fuzzyFindColumn(headers, ['reynolds', 're', 'reynoldsnumber']);
    if (!velCol && !presCol && !vorCol) throw new Error('CFD 数据需要 velocity/pressure/vorticity 列');
    data = {
      name: ctx.fileName,
      cells: rows.map((r, i) => ({
        x: Number(r[fuzzyFindColumn(headers, ['x']) || Object.keys(r)[0]]) || i,
        y: Number(r[fuzzyFindColumn(headers, ['y']) || Object.keys(r)[1] || Object.keys(r)[0]]) || 0,
        velocity: velCol ? Number(r[velCol]) : 0,
        pressure: presCol ? Number(r[presCol]) : 0,
        vorticity: vorCol ? Number(r[vorCol]) : 0,
      })),
      reynolds: reCol && rows.length ? Number(rows[0][reCol]) : 1000,
    };
  }
  return { name: ctx.fileName, type: 'cfd', data, warnings: [] };
}

function parseXRD(ctx: ParserContext): ParseResult {
  let data: any;
  if (ctx.ext === 'json') {
    data = JSON.parse(ctx.text);
  } else {
    // XRD 常见格式：两列（angle, intensity），可能无表头
    const { headers, rows } = parseCSVLike(ctx.text);
    const angleCol = fuzzyFindColumn(headers, ['angle', 'theta', '2theta', 'twotheta', 'q']);
    const intCol = fuzzyFindColumn(headers, ['intensity', 'i', 'counts', 'cps']);
    if (angleCol && intCol) {
      data = {
        name: ctx.fileName,
        angles: rows.map((r) => Number(r[angleCol])),
        intensities: rows.map((r) => Number(r[intCol])),
        wavelength: 1.54,
        lattice: 5.64,
      };
    } else {
      // 回退：只要两列数字就认为是 angle/intensity
      const nums = rows
        .map((r) => Object.values(r).filter((v) => typeof v === 'number') as number[])
        .filter((r) => r.length >= 2);
      if (nums.length < 3) throw new Error('XRD 文本需要至少 3 组角度-强度数据');
      data = {
        name: ctx.fileName,
        angles: nums.map((r) => r[0]),
        intensities: nums.map((r) => r[1]),
        wavelength: 1.54,
        lattice: 5.64,
      };
    }
  }
  return { name: ctx.fileName, type: 'xrd', data, warnings: [] };
}

function parseDNA(ctx: ParserContext): ParseResult {
  const seq = ctx.text.replace(/[^ATCGatcg]/g, '').toUpperCase();
  if (seq.length < 3) throw new Error('DNA 文件需要包含 ATCG 序列');
  const gc = seq.split('').filter((c) => c === 'G' || c === 'C').length / seq.length;
  return {
    name: ctx.fileName,
    type: 'dna',
    data: { name: ctx.fileName, sequence: seq, gc },
    warnings: [],
  };
}

function parsePulsar(ctx: ParserContext): ParseResult {
  let data: any;
  if (ctx.ext === 'json') {
    data = JSON.parse(ctx.text);
  } else {
    const { headers, rows } = parseCSVLike(ctx.text);
    const pCol = fuzzyFindColumn(headers, ['period', 'p', 'period_ms', 'spin']);
    const fCol = fuzzyFindColumn(headers, ['flux', 'f', 'intensity', 'counts']);
    const dmCol = fuzzyFindColumn(headers, ['dm', 'dispersion', 'dispersionmeasure']);
    if (!pCol && !fCol) {
      // 回退两列数字
      const nums = rows
        .map((r) => Object.values(r).filter((v) => typeof v === 'number') as number[])
        .filter((r) => r.length >= 2);
      if (nums.length < 3) throw new Error('Pulsar 文本需要至少 3 组周期-流量数据');
      data = { name: ctx.fileName, periods: nums.map((r) => r[0]), flux: nums.map((r) => r[1]), dm: 0 };
    } else {
      data = {
        name: ctx.fileName,
        periods: pCol ? rows.map((r) => Number(r[pCol])) : rows.map((_, i) => i),
        flux: fCol ? rows.map((r) => Number(r[fCol])) : rows.map(() => 1),
        dm: dmCol && rows.length ? Number(rows[0][dmCol]) : 0,
      };
    }
  }
  return { name: ctx.fileName, type: 'pulsar', data, warnings: [] };
}

export function parseScienceFile(ctx: ParserContext): ParseResult {
  switch (ctx.type) {
    case 'dft':
      return parseDFT(ctx);
    case 'md':
      return parseMD(ctx);
    case 'fem':
      return parseFEM(ctx);
    case 'cfd':
      return parseCFD(ctx);
    case 'xrd':
      return parseXRD(ctx);
    case 'dna':
      return parseDNA(ctx);
    case 'pulsar':
      return parsePulsar(ctx);
    default:
      throw new Error('未知科学类型: ' + ctx.type);
  }
}
