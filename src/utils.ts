import { SCALES } from './worlds';

export function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}
export function fibSequence(n: number): number[] {
  const f = [1, 1];
  while (f[f.length - 1] + f[f.length - 2] < n) f.push(f[f.length - 1] + f[f.length - 2]);
  return f;
}
export function genFibonacci(len: number): number[] {
  const p = new Array(len).fill(0);
  for (const f of fibSequence(len)) if (f < len) p[f] = 1;
  return p;
}
export function genEuclidean(k: number, n: number): number[] {
  return euclideanRhythm(k, n);
}
export function genPrime(len: number): number[] {
  const p = new Array(len).fill(0);
  function isP(n: number): boolean {
    if (n < 2) return false;
    for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
    return true;
  }
  for (let i = 0; i < len; i++) if (isP(i)) p[i] = 1;
  return p;
}
export function genSymmetry(len: number): number[] {
  const h = Math.ceil(len / 2),
    hp = [];
  for (let i = 0; i < h; i++) hp.push(Math.random() > 0.5 ? 1 : 0);
  const p = [...hp];
  for (let i = len - 1; i >= h; i--) p.push(hp[len - 1 - i] || 0);
  return p.slice(0, len);
}
export function genRecursive(len: number, motif: number[], depth?: number): number[] {
  depth = depth || 2;
  let p = motif.slice();
  for (let d = 0; d < depth; d++) {
    if (p.length >= len) break;
    const n = [];
    for (const v of p) {
      if (v === 1) n.push(...motif);
      else n.push(...new Array(motif.length).fill(0));
    }
    p = n;
  }
  return p.slice(0, len);
}
export function genFibonacciMelody(len: number, root: string, scaleType: string): number[] {
  const iv = SCALES[scaleType as keyof typeof SCALES] || SCALES.minor,
    fibs = fibSequence(len * 2),
    p = [];
  for (let i = 0; i < len; i++) p.push((fibs[i % fibs.length] % iv.length) + 1);
  return p;
}
export function genSymmetricMelody(len: number, root: string, scaleType: string): number[] {
  const iv = SCALES[scaleType as keyof typeof SCALES] || SCALES.minor,
    h = Math.ceil(len / 2),
    hp = [];
  for (let i = 0; i < h; i++) hp.push(Math.floor(Math.random() * iv.length) + 1);
  const p = [...hp];
  for (let i = len - 1; i >= h; i--) p.push(hp[len - 1 - i] || 1);
  return p.slice(0, len);
}
export function genSerialMelody(len: number): number[] {
  const row = [];
  for (let i = 0; i < 12; i++) row.push(i);
  for (let i = 11; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [row[i], row[j]] = [row[j], row[i]];
  }
  const p = [];
  for (let i = 0; i < len; i++) p.push((row[i % 12] % 7) + 1);
  return p;
}
export function escapeHtml(str: string): string {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
export function lcmCalc(a: number, b: number): number {
  return (a / gcdCalc(a, b)) * b;
}
export function gcdCalc(a: number, b: number): number {
  while (b) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}
export function euclideanRhythm(k: number, n: number): number[] {
  if (k <= 0) return new Array(n).fill(0);
  if (k >= n) return new Array(n).fill(1);

  // Björklund's algorithm implemented as iterative group merging.
  // Start with k [1] groups and (n-k) [0] groups, then repeatedly append
  // trailing groups onto leading groups until all remaining groups begin
  // with the same value. The merged result is the most even distribution.
  const groups: number[][] = [];
  for (let i = 0; i < k; i++) groups.push([1]);
  for (let i = 0; i < n - k; i++) groups.push([0]);

  let first = groups[0][0];
  let last = groups[groups.length - 1][0];
  while (first !== last) {
    const len = groups.length;
    // how many trailing groups have the same value as the last group
    let trailing = 0;
    while (trailing < len && groups[len - 1 - trailing][0] === last) trailing++;
    // how many leading groups have the same value as the first group
    let leading = 0;
    while (leading < len && groups[leading][0] === first) leading++;
    // merge the smaller block into the larger one
    const merge = Math.min(leading, trailing);
    for (let i = 0; i < merge; i++) {
      groups[i] = groups[i].concat(groups[len - merge + i]);
    }
    groups.splice(len - merge, merge);
    first = groups[0][0];
    last = groups[groups.length - 1][0];
  }

  return groups.flat();
}
export function arraysEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
/** 一维元胞自动机：取中列输出，可产生类 Rule 30/90/110 的复杂模式 */
export function genCellular(len: number, rule: number = 30): number[] {
  let state = new Array(len).fill(0);
  state[Math.floor(len / 2)] = 1;
  const out: number[] = [];
  for (let s = 0; s < len; s++) {
    out.push(state[Math.floor(len / 2)]);
    const next = new Array(len).fill(0);
    for (let i = 0; i < len; i++) {
      const l = state[(i - 1 + len) % len];
      const c = state[i];
      const r = state[(i + 1) % len];
      const idx = (l << 2) | (c << 1) | r;
      next[i] = (rule >> idx) & 1;
    }
    state = next;
  }
  return out;
}

/** 马尔可夫链旋律：在调式音阶上随机游走，返回 pattern + pitches */
export function genMarkov(
  len: number,
  root: string,
  scaleType: string
): { pattern: number[]; pitches: number[] } {
  const iv = SCALES[scaleType as keyof typeof SCALES] || SCALES.minor;
  const n = iv.length;
  const matrix: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row = new Array(n).fill(0.03);
    row[i] = 0.45;
    row[(i + 1) % n] += 0.22;
    row[(i - 1 + n) % n] += 0.17;
    row[(i + 2) % n] += 0.08;
    row[(i - 2 + n) % n] += 0.05;
    matrix.push(row);
  }
  let cur = 0;
  const pitches: number[] = [];
  for (let i = 0; i < len; i++) {
    pitches.push(cur + 1);
    let r = Math.random(), acc = 0;
    for (let j = 0; j < n; j++) {
      acc += matrix[cur][j];
      if (r < acc) {
        cur = j;
        break;
      }
    }
  }
  return { pattern: new Array(len).fill(1), pitches };
}

/** 对位声部：将源旋律音高按调式中心做倒影，适合生成与旋律对称的贝斯/和弦线 */
export function genCounterpoint(
  sourcePitches: number[],
  scaleType: string,
  octaveShift: number = -1
): { pattern: number[]; pitches: number[] } {
  const iv = SCALES[scaleType as keyof typeof SCALES] || SCALES.minor;
  const center = Math.ceil(iv.length / 2);
  const pitches = sourcePitches.map((d) => {
    const inv = 2 * center - d;
    return inv + octaveShift * iv.length;
  });
  const pattern = sourcePitches.map(() => 1);
  return { pattern, pitches };
}

export function isPermutation(a: number[], b: number[]): boolean {
  return arraysEqual(
    a.slice().sort((x, y) => x - y),
    b.slice().sort((x, y) => x - y)
  );
}
export function getDailySeed(): string {
  const d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
export function dailyHash(seed: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % mod;
  return h;
}
