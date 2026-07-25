import { describe, it, expect } from 'vitest';
import {
  isNumeric,
  toNumbers,
  mean,
  std,
  minMax,
  normalize,
  movingAverage,
  derivative,
  autocorrelation,
  fft,
  dominantFrequency,
  findPeaks,
  resample,
  histogram,
  entropy,
  zeroCrossingRate,
  featureVector,
} from './signal';

const approx = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

describe('isNumeric', () => {
  it('returns true for numeric strings and numbers', () => {
    expect(isNumeric(0)).toBe(true);
    expect(isNumeric(1.5)).toBe(true);
    expect(isNumeric('-3.2')).toBe(true);
    expect(isNumeric('1e3')).toBe(true);
    expect(isNumeric('  42 ')).toBe(true);
  });

  it('returns false for non-numeric values', () => {
    expect(isNumeric('')).toBe(false);
    expect(isNumeric(null)).toBe(false);
    expect(isNumeric(undefined)).toBe(false);
    expect(isNumeric('abc')).toBe(false);
    expect(isNumeric(NaN)).toBe(false);
  });

  it('treats NaN literal string as numeric (Number("NaN") = NaN, but isNaN check rejects)', () => {
    // Number('NaN') is NaN, so isNumeric returns false
    expect(isNumeric('NaN')).toBe(false);
  });
});

describe('toNumbers', () => {
  it('converts numeric strings to numbers', () => {
    expect(toNumbers(['1', '2', '3'])).toEqual([1, 2, 3]);
  });

  it('drops values that become NaN', () => {
    // Note: Number(null) === 0 (not NaN), so null survives as 0.
    expect(toNumbers(['1', 'abc', '3', null as any])).toEqual([1, 3, 0]);
    expect(toNumbers(['1', 'abc', '3'])).toEqual([1, 3]);
  });

  it('returns empty array for empty input', () => {
    expect(toNumbers([])).toEqual([]);
  });

  it('preserves numbers', () => {
    expect(toNumbers([1, 2.5, -3])).toEqual([1, 2.5, -3]);
  });
});

describe('mean', () => {
  it('returns 0 for empty array', () => {
    expect(mean([])).toBe(0);
  });

  it('returns the value itself for single-point array', () => {
    expect(mean([42])).toBe(42);
  });

  it('computes mean correctly', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(mean([-1, 1])).toBe(0);
  });
});

describe('std', () => {
  it('returns 0 for arrays shorter than 2', () => {
    expect(std([])).toBe(0);
    expect(std([5])).toBe(0);
  });

  it('computes sample standard deviation (n-1 denominator)', () => {
    // For [2,4,4,4,5,5,7,9], sample std ≈ 2.138
    const arr = [2, 4, 4, 4, 5, 5, 7, 9];
    const expected = Math.sqrt(arr.reduce((s, v) => s + (v - 5) ** 2, 0) / (arr.length - 1));
    expect(std(arr)).toBeCloseTo(expected, 10);
  });

  it('returns 0 when all values identical', () => {
    expect(std([3, 3, 3, 3])).toBe(0);
  });
});

describe('minMax', () => {
  it('returns {0,0} for empty array', () => {
    expect(minMax([])).toEqual({ min: 0, max: 0 });
  });

  it('returns same min and max for single element', () => {
    expect(minMax([7])).toEqual({ min: 7, max: 7 });
  });

  it('finds min and max correctly', () => {
    expect(minMax([3, -1, 5, 2, 9])).toEqual({ min: -1, max: 9 });
  });

  it('handles negative-only arrays', () => {
    expect(minMax([-5, -1, -10])).toEqual({ min: -10, max: -1 });
  });
});

describe('normalize', () => {
  it('scales array to [0,1] by default', () => {
    const out = normalize([0, 5, 10]);
    expect(out).toEqual([0, 0.5, 1]);
  });

  it('scales array to custom range', () => {
    const out = normalize([0, 5, 10], -1, 1);
    expect(out).toEqual([-1, 0, 1]);
  });

  it('returns midpoint for all-equal arrays (avoid divide-by-zero)', () => {
    const out = normalize([4, 4, 4]);
    expect(out).toEqual([0.5, 0.5, 0.5]);
  });

  it('custom midpoint when all equal', () => {
    const out = normalize([4, 4, 4], 0, 10);
    expect(out).toEqual([5, 5, 5]);
  });

  it('handles empty array', () => {
    expect(normalize([])).toEqual([]);
  });

  it('handles single-element array (becomes targetMin via divide-by-zero path)', () => {
    // max === min -> all mapped to (targetMin+targetMax)/2 = 0.5
    expect(normalize([7])).toEqual([0.5]);
  });
});

describe('movingAverage', () => {
  it('returns the array unchanged when windowSize < 2', () => {
    expect(movingAverage([1, 2, 3], 1)).toEqual([1, 2, 3]);
    expect(movingAverage([1, 2, 3], 0)).toEqual([1, 2, 3]);
  });

  it('averages a window of size 3', () => {
    // windowSize=3 -> floor(3/2)=1 left, ceil(3/2)=2 right
    // i=0: [0..2) -> [1,2] mean 1.5
    // i=1: [0..3) -> [1,2,3] mean 2
    // i=2: [1..3) -> [2,3] mean 2.5
    const out = movingAverage([1, 2, 3], 3);
    expect(out).toHaveLength(3);
    expect(out[0]).toBeCloseTo(1.5, 10);
    expect(out[1]).toBeCloseTo(2, 10);
    expect(out[2]).toBeCloseTo(2.5, 10);
  });

  it('handles empty array', () => {
    expect(movingAverage([], 3)).toEqual([]);
  });

  it('handles windowSize larger than array', () => {
    const out = movingAverage([1, 2], 10);
    expect(out).toHaveLength(2);
    // both elements averaged over [0..2) -> 1.5
    expect(out[0]).toBeCloseTo(1.5, 10);
    expect(out[1]).toBeCloseTo(1.5, 10);
  });
});

describe('derivative', () => {
  it('returns input for arrays shorter than 2', () => {
    expect(derivative([])).toEqual([]);
    expect(derivative([5])).toEqual([5]);
  });

  it('computes first differences', () => {
    expect(derivative([1, 3, 6, 10])).toEqual([2, 2, 3, 4]);
  });

  it('returns zeros for constant array', () => {
    expect(derivative([5, 5, 5, 5])).toEqual([0, 0, 0, 0]);
  });
});

describe('autocorrelation', () => {
  it('returns empty for empty input', () => {
    expect(autocorrelation([])).toEqual([]);
  });

  it('returns single value for single-element array', () => {
    const out = autocorrelation([3]);
    expect(out).toHaveLength(1);
    // variance of single point (centered = 0) -> 0
    expect(out[0]).toBe(0);
  });

  it('lag 0 equals variance (with mean subtracted)', () => {
    const arr = [1, 2, 3, 4, 5];
    const m = mean(arr);
    const centered = arr.map((v) => v - m);
    const expectedLag0 = centered.reduce((s, v) => s + v * v, 0) / arr.length;
    const out = autocorrelation(arr);
    expect(out[0]).toBeCloseTo(expectedLag0, 10);
  });

  it('respects maxLag parameter', () => {
    const arr = [1, 2, 3, 4, 5];
    const out = autocorrelation(arr, 2);
    expect(out).toHaveLength(2);
  });

  it('symmetric signal produces symmetric autocorrelation around lag 0', () => {
    const arr = [1, 2, 3, 2, 1];
    const out = autocorrelation(arr);
    expect(out[0]).toBeGreaterThanOrEqual(out[1]);
    expect(out[1]).toBeGreaterThanOrEqual(out[2]);
  });
});

describe('fft', () => {
  it('returns 4 arrays of equal length to input (power of 2)', () => {
    const out = fft([1, 0, 0, 0]);
    expect(out.real).toHaveLength(4);
    expect(out.imag).toHaveLength(4);
    expect(out.magnitude).toHaveLength(4);
    expect(out.phase).toHaveLength(4);
  });

  it('FFT of impulse is constant DC (all ones)', () => {
    // [1,0,0,0] -> real all 1, imag all 0
    const out = fft([1, 0, 0, 0]);
    out.real.forEach((r) => expect(r).toBeCloseTo(1, 6));
    out.imag.forEach((i) => expect(i).toBeCloseTo(0, 6));
    out.magnitude.forEach((m) => expect(m).toBeCloseTo(1, 6));
  });

  it('FFT of constant signal has only DC bin nonzero', () => {
    const out = fft([2, 2, 2, 2]);
    expect(out.real[0]).toBeCloseTo(8, 6); // sum
    expect(out.magnitude[0]).toBeCloseTo(8, 6);
    for (let i = 1; i < 4; i++) {
      expect(out.magnitude[i]).toBeCloseTo(0, 6);
    }
  });

  it('FFT of a sine wave concentrates energy in expected bin', () => {
    // 8 samples, 1 cycle over 8 samples -> bin 1
    const n = 8;
    const sig = Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * i) / n));
    const out = fft(sig);
    let maxIdx = 0;
    let maxMag = 0;
    for (let i = 1; i < n / 2; i++) {
      if (out.magnitude[i] > maxMag) {
        maxMag = out.magnitude[i];
        maxIdx = i;
      }
    }
    expect(maxIdx).toBe(1);
  });

  it('auto zero-pads to next power of 2 when length is not power of 2', () => {
    // length 3 -> padded to 4
    const out = fft([1, 2, 3]);
    expect(out.real.length).toBe(4);
    // DC bin should equal sum of input
    expect(out.real[0]).toBeCloseTo(6, 6);
  });

  it('handles empty input (length 0 -> recursive base case)', () => {
    // length 0 satisfies (0 & -1) === 0 (no padding), bit-reversal loop does nothing
    const out = fft([]);
    expect(out.real).toEqual([]);
    expect(out.imag).toEqual([]);
  });

  it('accepts imaginary input', () => {
    // FFT of [1+i, 0, 0, 0] should give real=1, imag=1 (constant in freq)
    const out = fft([1], [1]);
    expect(out.real[0]).toBeCloseTo(1, 6);
    expect(out.imag[0]).toBeCloseTo(1, 6);
  });

  it('large power-of-2 array does not throw', () => {
    const n = 8192;
    const arr = new Array(n).fill(0).map((_, i) => Math.sin((2 * Math.PI * i) / n) * 5);
    expect(() => fft(arr)).not.toThrow();
    const out = fft(arr);
    expect(out.real).toHaveLength(n);
  });
});

describe('dominantFrequency', () => {
  it('returns zeros for arrays shorter than 2', () => {
    const out = dominantFrequency([5]);
    expect(out).toEqual({ index: 0, freq: 0, magnitude: 0 });
    expect(dominantFrequency([])).toEqual({ index: 0, freq: 0, magnitude: 0 });
  });

  it('detects the dominant frequency of a sine wave', () => {
    // 16 samples, 2 cycles -> bin 2
    const n = 16;
    const sr = 16; // sample rate 16 Hz, so freq resolution = 1 Hz
    const sig = Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 2 * i) / n));
    const out = dominantFrequency(sig, sr);
    expect(out.index).toBe(2);
    expect(out.freq).toBeCloseTo(2, 6);
    expect(out.magnitude).toBeGreaterThan(0);
  });

  it('sample rate scales the returned frequency', () => {
    const n = 16;
    const sig = Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 2 * i) / n));
    const out1 = dominantFrequency(sig, 16);
    const out2 = dominantFrequency(sig, 32);
    expect(out2.freq).toBeCloseTo(out1.freq * 2, 6);
  });
});

describe('findPeaks', () => {
  it('finds peaks in a simple array', () => {
    // peaks at index 2 and 5
    const arr = [0, 1, 5, 1, 0, 3, 0];
    const peaks = findPeaks(arr);
    expect(peaks).toContain(2);
    expect(peaks).toContain(5);
  });

  it('returns empty array for monotonic data', () => {
    expect(findPeaks([1, 2, 3, 4, 5])).toEqual([]);
    expect(findPeaks([5, 4, 3, 2, 1])).toEqual([]);
  });

  it('respects threshold option (relative 0..1)', () => {
    const arr = [0, 1, 2, 1, 0, 8, 9, 8, 0];
    // range is 0..9 -> 9. threshold 0.5 -> absThresh = 0 + 0.5*9 = 4.5
    // peak at idx 2 (val 2) is below threshold -> filtered
    // peak at idx 6 (val 9) is above -> kept
    const peaks = findPeaks(arr, { threshold: 0.5 });
    expect(peaks).not.toContain(2);
    expect(peaks).toContain(6);
  });

  it('respects minDistance option', () => {
    const arr = [0, 1, 5, 1, 4, 1, 5, 1, 0];
    // peaks at idx 2, 4, 6
    const peaks = findPeaks(arr, { minDistance: 3 });
    expect(peaks[0]).toBe(2);
    // subsequent peaks must be >= 3 apart from the last accepted
    for (let i = 1; i < peaks.length; i++) {
      expect(peaks[i] - peaks[i - 1]).toBeGreaterThanOrEqual(3);
    }
  });

  it('respects prominence option', () => {
    // Higher peaks on each side of the test peaks ensure real prominence values.
    // arr = [9, 0, 5, 0, 1, 0, 4, 0, 9]
    //   peak at idx 2 (val 5): leftMin=0, rightMin=0 -> prom = 5
    //   peak at idx 4 (val 1): prom = 1
    //   peak at idx 6 (val 4): leftMin=0, rightMin=0 -> prom = 4
    // range = 9. With prominence 0.5 -> threshold = 0.5 * 9 = 4.5
    //   idx 2 (prom 5): pass
    //   idx 4 (prom 1): fail
    //   idx 6 (prom 4): fail
    const arr = [9, 0, 5, 0, 1, 0, 4, 0, 9];
    const peaksAll = findPeaks(arr);
    expect(peaksAll).toContain(2);
    expect(peaksAll).toContain(4);
    expect(peaksAll).toContain(6);
    const peaksProm = findPeaks(arr, { prominence: 0.5 });
    expect(peaksProm).toContain(2);
    expect(peaksProm).not.toContain(4);
    expect(peaksProm).not.toContain(6);
  });

  it('handles empty array', () => {
    expect(findPeaks([])).toEqual([]);
  });

  it('handles array too short for peaks', () => {
    expect(findPeaks([1])).toEqual([]);
    expect(findPeaks([1, 2])).toEqual([]);
  });
});

describe('resample', () => {
  it('returns empty for targetLen <= 0', () => {
    expect(resample([1, 2, 3], 0)).toEqual([]);
    expect(resample([1, 2, 3], -1)).toEqual([]);
  });

  it('returns a copy when targetLen equals input length', () => {
    const arr = [1, 2, 3];
    const out = resample(arr, 3);
    expect(out).toEqual(arr);
    expect(out).not.toBe(arr);
  });

  it('upsamples linearly', () => {
    // [0, 10] -> 3 points: 0, 5, 10
    const out = resample([0, 10], 3);
    expect(out).toHaveLength(3);
    expect(out[0]).toBeCloseTo(0, 10);
    expect(out[1]).toBeCloseTo(5, 10);
    expect(out[2]).toBeCloseTo(10, 10);
  });

  it('downsamples by linear interpolation', () => {
    const out = resample([0, 1, 2, 3, 4], 3);
    expect(out).toHaveLength(3);
    expect(out[0]).toBeCloseTo(0, 10);
    expect(out[2]).toBeCloseTo(4, 10);
    expect(out[1]).toBeCloseTo(2, 10);
  });

  it('handles single-element source (returns repeated value)', () => {
    const out = resample([7], 3);
    expect(out).toEqual([7, 7, 7]);
  });
});

describe('histogram', () => {
  it('returns bins+1 edges and bins counts', () => {
    const out = histogram([1, 2, 3, 4, 5], 5);
    expect(out.binEdges).toHaveLength(6);
    expect(out.counts).toHaveLength(5);
    expect(out.counts.reduce((a, b) => a + b, 0)).toBe(5);
  });

  it('places each value in the correct bin', () => {
    // Avoid values exactly at bin edges; the max value gets clamped to last bin.
    const out = histogram([0.5, 1.5, 2.5, 3.5], 4);
    expect(out.counts).toEqual([1, 1, 1, 1]);
  });

  it('clamps the max value into the last bin', () => {
    const out = histogram([0, 1, 2, 3, 4], 4);
    // 0->bin0, 1->bin1, 2->bin2, 3->bin3, 4->bin3 (clamped)
    expect(out.counts).toEqual([1, 1, 1, 2]);
  });

  it('uses default 10 bins', () => {
    const out = histogram([1, 2, 3]);
    expect(out.counts).toHaveLength(10);
    expect(out.binEdges).toHaveLength(11);
  });

  it('handles empty array', () => {
    const out = histogram([]);
    expect(out.counts).toHaveLength(10);
    expect(out.counts.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('puts all identical values in the first bin (divide-by-zero fallback to range=1)', () => {
    // When min === max, divisor (max-min||1) becomes 1, so ((v-min)/1)*bins = 0 -> idx 0.
    const out = histogram([5, 5, 5, 5], 4);
    expect(out.counts.reduce((a, b) => a + b, 0)).toBe(4);
    expect(out.counts[0]).toBe(4);
  });
});

describe('entropy', () => {
  it('returns 0 for empty array', () => {
    expect(entropy([])).toBe(0);
  });

  it('returns 0 for uniform values (single bin occupied)', () => {
    // Note: source returns -0 here (negation of 0); use toBeCloseTo for sign-agnostic check.
    expect(entropy([5, 5, 5, 5])).toBeCloseTo(0, 10);
  });

  it('returns max log2(bins) when uniformly distributed across bins', () => {
    // 4 values across 4 distinct bins -> entropy = log2(4) = 2
    const arr = [0, 1, 2, 3];
    const e = entropy(arr, 4);
    expect(e).toBeCloseTo(2, 6);
  });

  it('entropy is non-negative', () => {
    const e = entropy([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5);
    expect(e).toBeGreaterThanOrEqual(0);
  });
});

describe('zeroCrossingRate', () => {
  it('returns 0 for arrays shorter than 2', () => {
    expect(zeroCrossingRate([])).toBe(0);
    expect(zeroCrossingRate([5])).toBe(0);
  });

  it('counts sign changes correctly', () => {
    // [1, -1, 1, -1] -> 3 crossings / 3 = 1.0
    expect(zeroCrossingRate([1, -1, 1, -1])).toBeCloseTo(1, 6);
  });

  it('returns 0 for all-positive signal', () => {
    expect(zeroCrossingRate([1, 2, 3, 4])).toBe(0);
  });

  it('handles zero values (treated as non-negative)', () => {
    // [1, 0, -1, 0, 1]: crossings at 0->-1 and -1->0(=non-neg)... 
    // rule: prev<0 && cur>=0 OR prev>=0 && cur<0
    // step 1: prev=1>=0, cur=0>=0 -> no
    // step 2: prev=0>=0, cur=-1<0 -> yes
    // step 3: prev=-1<0, cur=0>=0 -> yes
    // step 4: prev=0>=0, cur=1>=0 -> no
    // 2 crossings / 4 = 0.5
    expect(zeroCrossingRate([1, 0, -1, 0, 1])).toBeCloseTo(0.5, 6);
  });
});

describe('featureVector', () => {
  it('returns all expected keys', () => {
    const fv = featureVector([1, 2, 3, 4, 5]);
    expect(fv).toHaveProperty('mean');
    expect(fv).toHaveProperty('std');
    expect(fv).toHaveProperty('min');
    expect(fv).toHaveProperty('max');
    expect(fv).toHaveProperty('range');
    expect(fv).toHaveProperty('skewness');
    expect(fv).toHaveProperty('kurtosis');
    expect(fv).toHaveProperty('zcr');
    expect(fv).toHaveProperty('entropy');
    expect(fv).toHaveProperty('dominantFreq');
  });

  it('computes mean, min, max, range consistently', () => {
    const arr = [1, 2, 3, 4, 5];
    const fv = featureVector(arr);
    expect(fv.mean).toBe(3);
    expect(fv.min).toBe(1);
    expect(fv.max).toBe(5);
    expect(fv.range).toBe(4);
  });

  it('skewness is 0 for symmetric distribution', () => {
    const arr = [-2, -1, 0, 1, 2];
    const fv = featureVector(arr);
    expect(Math.abs(fv.skewness)).toBeLessThan(1e-9);
  });

  it('handles small arrays (n <= 2) by zeroing higher moments', () => {
    const fv = featureVector([1, 2]);
    expect(fv.skewness).toBe(0);
    expect(fv.kurtosis).toBe(0);
  });

  it('handles empty array without throwing', () => {
    expect(() => featureVector([])).not.toThrow();
    const fv = featureVector([]);
    expect(fv.mean).toBe(0);
    expect(fv.min).toBe(0);
    expect(fv.max).toBe(0);
  });

  it('dominantFreq is 0 for constant signal', () => {
    const fv = featureVector([3, 3, 3, 3, 3, 3, 3, 3]);
    expect(fv.dominantFreq).toBe(0);
  });
});

describe('featureVector - large input stability', () => {
  it('does not throw for large input', () => {
    const n = 4096;
    const arr = new Array(n).fill(0).map((_, i) => Math.sin(i * 0.01));
    expect(() => featureVector(arr)).not.toThrow();
  });
});
