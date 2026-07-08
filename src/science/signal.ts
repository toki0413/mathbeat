/**
 * 科学之声 - 信号处理工具箱
 * 提供 FFT、峰值检测、滤波、统计特征、重采样等基础能力
 */

export function isNumeric(v: any): boolean {
  return v !== '' && v !== null && v !== undefined && !isNaN(Number(v));
}

export function toNumbers(arr: any[]): number[] {
  return arr.map((v) => Number(v)).filter((v) => !isNaN(v));
}

export function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function std(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) * (v - m), 0) / (arr.length - 1));
}

export function minMax(arr: number[]): { min: number; max: number } {
  if (!arr.length) return { min: 0, max: 0 };
  return { min: Math.min(...arr), max: Math.max(...arr) };
}

export function normalize(arr: number[], targetMin = 0, targetMax = 1): number[] {
  const { min, max } = minMax(arr);
  if (max === min) return arr.map(() => (targetMin + targetMax) / 2);
  return arr.map((v) => targetMin + ((v - min) / (max - min)) * (targetMax - targetMin));
}

export function movingAverage(arr: number[], windowSize: number): number[] {
  if (windowSize < 2) return arr.slice();
  const out: number[] = [];
  for (let i = 0; i < arr.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(arr.length, i + Math.ceil(windowSize / 2));
    let sum = 0;
    for (let j = start; j < end; j++) sum += arr[j];
    out.push(sum / (end - start));
  }
  return out;
}

export function derivative(arr: number[]): number[] {
  if (arr.length < 2) return arr.slice();
  const out: number[] = [arr[1] - arr[0]];
  for (let i = 1; i < arr.length; i++) out.push(arr[i] - arr[i - 1]);
  return out;
}

export function autocorrelation(arr: number[], maxLag?: number): number[] {
  if (!arr.length) return [];
  const m = mean(arr);
  const centered = arr.map((v) => v - m);
  const N = centered.length;
  const max = Math.min(maxLag || N, N);
  const out: number[] = [];
  for (let lag = 0; lag < max; lag++) {
    let sum = 0;
    let count = 0;
    for (let i = 0; i + lag < N; i++) {
      sum += centered[i] * centered[i + lag];
      count++;
    }
    out.push(sum / count);
  }
  return out;
}

// Cooley-Tukey FFT，要求长度为 2 的幂
export function fft(
  real: number[],
  imag?: number[]
): { real: number[]; imag: number[]; magnitude: number[]; phase: number[] } {
  const n = real.length;
  if (n & (n - 1)) {
    // 自动补零到最近的 2 的幂
    const nextPow2 = Math.pow(2, Math.ceil(Math.log2(n)));
    const r = real.slice();
    const i = (imag || new Array(n).fill(0)).slice();
    while (r.length < nextPow2) {
      r.push(0);
      i.push(0);
    }
    return fft(r, i);
  }
  const re = real.slice();
  const im = imag ? imag.slice() : new Array(n).fill(0);

  // bit-reverse
  let j = 0;
  for (let i = 0; i < n; i++) {
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
    let k = n >> 1;
    while (k & j) {
      j &= ~k;
      k >>= 1;
    }
    j |= k;
  }

  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wlenRe = Math.cos(ang);
    const wlenIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wRe = 1,
        wIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const uRe = re[i + k],
          uIm = im[i + k];
        const vRe = re[i + k + len / 2] * wRe - im[i + k + len / 2] * wIm;
        const vIm = re[i + k + len / 2] * wIm + im[i + k + len / 2] * wRe;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + len / 2] = uRe - vRe;
        im[i + k + len / 2] = uIm - vIm;
        const nextWRe = wRe * wlenRe - wIm * wlenIm;
        wIm = wRe * wlenIm + wIm * wlenRe;
        wRe = nextWRe;
      }
    }
  }
  const magnitude = re.map((r, i) => Math.sqrt(r * r + im[i] * im[i]));
  const phase = re.map((r, i) => Math.atan2(im[i], r));
  return { real: re, imag: im, magnitude, phase };
}

export function dominantFrequency(arr: number[], sampleRate = 1): { index: number; freq: number; magnitude: number } {
  if (arr.length < 2) return { index: 0, freq: 0, magnitude: 0 };
  const { magnitude } = fft(arr);
  let maxIdx = 0,
    maxMag = 0;
  for (let i = 1; i < magnitude.length / 2; i++) {
    if (magnitude[i] > maxMag) {
      maxMag = magnitude[i];
      maxIdx = i;
    }
  }
  const n = magnitude.length;
  return { index: maxIdx, freq: (maxIdx * sampleRate) / n, magnitude: maxMag };
}

export function findPeaks(
  arr: number[],
  options: { threshold?: number; minDistance?: number; prominence?: number } = {}
): number[] {
  const { threshold = 0, minDistance = 1, prominence = 0 } = options;
  const peaks: number[] = [];
  const { min, max } = minMax(arr);
  const range = max - min || 1;
  const absThresh = min + threshold * range;
  for (let i = 1; i < arr.length - 1; i++) {
    if (arr[i] > arr[i - 1] && arr[i] >= arr[i + 1] && arr[i] >= absThresh) {
      // 简单 prominence 检查：左右各找最近不低于该峰的点，如果下降幅度不足则过滤
      let left = i - 1,
        right = i + 1;
      while (left >= 0 && arr[left] < arr[i]) left--;
      while (right < arr.length && arr[right] < arr[i]) right++;
      const leftMin = left >= 0 ? Math.min(...arr.slice(left, i)) : arr[i];
      const rightMin = right < arr.length ? Math.min(...arr.slice(i + 1, right + 1)) : arr[i];
      const prom = arr[i] - Math.max(leftMin, rightMin);
      if (prom >= prominence * range) peaks.push(i);
    }
  }
  // 按 minDistance 筛选
  if (minDistance > 1 && peaks.length > 1) {
    const filtered: number[] = [peaks[0]];
    for (let i = 1; i < peaks.length; i++) {
      if (peaks[i] - filtered[filtered.length - 1] >= minDistance) filtered.push(peaks[i]);
    }
    return filtered;
  }
  return peaks;
}

export function resample(arr: number[], targetLen: number): number[] {
  if (targetLen <= 0) return [];
  if (arr.length === targetLen) return arr.slice();
  const out: number[] = [];
  for (let i = 0; i < targetLen; i++) {
    const x = (i / (targetLen - 1 || 1)) * (arr.length - 1);
    const i0 = Math.floor(x),
      i1 = Math.min(arr.length - 1, i0 + 1);
    const t = x - i0;
    out.push(arr[i0] * (1 - t) + arr[i1] * t);
  }
  return out;
}

export function histogram(arr: number[], bins = 10): { binEdges: number[]; counts: number[] } {
  const { min, max } = minMax(arr);
  const counts = new Array(bins).fill(0);
  const edges: number[] = [];
  for (let i = 0; i <= bins; i++) edges.push(min + ((max - min) * i) / bins);
  arr.forEach((v) => {
    const idx = Math.min(bins - 1, Math.floor(((v - min) / (max - min || 1)) * bins));
    counts[idx]++;
  });
  return { binEdges: edges, counts };
}

export function entropy(arr: number[], bins = 10): number {
  const { counts } = histogram(arr, bins);
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return 0;
  return -counts
    .filter((c) => c > 0)
    .reduce((sum, c) => {
      const p = c / total;
      return sum + p * Math.log2(p);
    }, 0);
}

export function zeroCrossingRate(arr: number[]): number {
  if (arr.length < 2) return 0;
  let zcr = 0;
  for (let i = 1; i < arr.length; i++) {
    if ((arr[i] >= 0 && arr[i - 1] < 0) || (arr[i] < 0 && arr[i - 1] >= 0)) zcr++;
  }
  return zcr / (arr.length - 1);
}

export function featureVector(arr: number[]): {
  mean: number;
  std: number;
  min: number;
  max: number;
  range: number;
  skewness: number;
  kurtosis: number;
  zcr: number;
  entropy: number;
  dominantFreq: number;
} {
  const m = mean(arr);
  const s = std(arr);
  const { min, max } = minMax(arr);
  const n = arr.length;
  const skewness = n > 2 ? arr.reduce((sum, v) => sum + Math.pow(v - m, 3), 0) / n / Math.pow(s || 1, 3) : 0;
  const kurtosis = n > 2 ? arr.reduce((sum, v) => sum + Math.pow(v - m, 4), 0) / n / Math.pow(s || 1, 4) : 0;
  const dom = dominantFrequency(arr);
  return {
    mean: m,
    std: s,
    min,
    max,
    range: max - min,
    skewness,
    kurtosis,
    zcr: zeroCrossingRate(arr.map((v) => v - m)),
    entropy: entropy(arr),
    dominantFreq: dom.freq,
  };
}
