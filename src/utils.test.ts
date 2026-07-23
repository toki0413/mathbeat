import { describe, it, expect } from 'vitest';
import {
  lcmCalc,
  gcdCalc,
  euclideanRhythm,
  arraysEqual,
  isPermutation,
  midiToFreq,
  escapeHtml,
  harmonicAmplitudes,
  evaluateFourier,
  spectralCentroid,
  classifyWaveform,
  cosineSimilarity,
} from './utils';

describe('utils', () => {
  it('lcmCalc computes LCM correctly', () => {
    expect(lcmCalc(4, 6)).toBe(12);
    expect(lcmCalc(3, 5)).toBe(15);
    expect(lcmCalc(7, 7)).toBe(7);
    expect(lcmCalc(12, 8)).toBe(24);
  });

  it('gcdCalc computes GCD correctly', () => {
    expect(gcdCalc(48, 18)).toBe(6);
    expect(gcdCalc(7, 7)).toBe(7);
    expect(gcdCalc(100, 35)).toBe(5);
    expect(gcdCalc(17, 4)).toBe(1);
  });

  it('euclideanRhythm generates correct patterns', () => {
    // Björklund algorithm: pulses distributed as evenly as possible.
    expect(euclideanRhythm(3, 8)).toEqual([1, 0, 0, 1, 0, 0, 1, 0]);
    expect(euclideanRhythm(4, 8)).toEqual([1, 0, 1, 0, 1, 0, 1, 0]);
    expect(euclideanRhythm(5, 8)).toEqual([1, 0, 1, 0, 1, 0, 1, 1]);
    expect(euclideanRhythm(5, 13)).toEqual([1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0]);
    expect(euclideanRhythm(1, 4)).toEqual([1, 0, 0, 0]);
    expect(euclideanRhythm(0, 4)).toEqual([0, 0, 0, 0]);
    expect(euclideanRhythm(8, 4)).toEqual([1, 1, 1, 1]);
  });

  it('arraysEqual returns true for identical arrays, false otherwise', () => {
    expect(arraysEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(arraysEqual([], [])).toBe(true);
    expect(arraysEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    expect(arraysEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(arraysEqual([1, 2, 3], [3, 2, 1])).toBe(false);
  });

  it('isPermutation returns true for permutations, false otherwise', () => {
    expect(isPermutation([1, 2, 3], [3, 2, 1])).toBe(true);
    expect(isPermutation([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(isPermutation([1, 2, 2], [2, 1, 2])).toBe(true);
    expect(isPermutation([1, 2, 3], [1, 2, 4])).toBe(false);
    expect(isPermutation([1, 2], [1, 2, 3])).toBe(false);
    expect(isPermutation([1, 2, 3], [1, 2])).toBe(false);
  });

  it('midiToFreq converts MIDI note 60 to ~261.63 Hz', () => {
    const freq = midiToFreq(60);
    expect(freq).toBeCloseTo(261.63, 2);
  });

  it('escapeHtml escapes <, >, and &', () => {
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('>')).toBe('&gt;');
    expect(escapeHtml('&')).toBe('&amp;');
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    const result = escapeHtml('<div class="test">Tom & Jerry\'s</div>');
    expect(result).toContain('&lt;');
    expect(result).toContain('&gt;');
    expect(result).toContain('&amp;');
  });
});

describe('harmonicAmplitudes (Fourier series coefficients)', () => {
  it('sine: only the fundamental (H1), all others zero', () => {
    expect(harmonicAmplitudes('sine', 4)).toEqual([1, 0, 0, 0]);
    expect(harmonicAmplitudes('sine', 8)).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('square: odd harmonics only, amplitude 1/k', () => {
    const amps = harmonicAmplitudes('square', 6);
    expect(amps[0]).toBe(1); // H1
    expect(amps[1]).toBe(0); // H2 (even, absent)
    expect(amps[2]).toBeCloseTo(1 / 3, 10); // H3
    expect(amps[3]).toBe(0); // H4
    expect(amps[4]).toBeCloseTo(1 / 5, 10); // H5
    expect(amps[5]).toBe(0); // H6
  });

  it('sawtooth: all harmonics, amplitude 1/k', () => {
    const amps = harmonicAmplitudes('sawtooth', 4);
    expect(amps[0]).toBe(1);
    expect(amps[1]).toBeCloseTo(1 / 2, 10);
    expect(amps[2]).toBeCloseTo(1 / 3, 10);
    expect(amps[3]).toBeCloseTo(1 / 4, 10);
  });

  it('triangle: odd harmonics only, amplitude 1/k^2 (faster convergence)', () => {
    const amps = harmonicAmplitudes('triangle', 6);
    expect(amps[0]).toBe(1); // H1
    expect(amps[1]).toBe(0); // H2
    expect(amps[2]).toBeCloseTo(1 / 9, 10); // H3 = 1/3^2
    expect(amps[3]).toBe(0); // H4
    expect(amps[4]).toBeCloseTo(1 / 25, 10); // H5 = 1/5^2
  });

  it('returns the requested length for any waveform', () => {
    expect(harmonicAmplitudes('sine', 1)).toHaveLength(1);
    expect(harmonicAmplitudes('square', 16)).toHaveLength(16);
    expect(harmonicAmplitudes('triangle', 0)).toEqual([]);
  });
});

describe('evaluateFourier (series evaluation)', () => {
  it('pure sine at phi=pi/2 peaks at 1', () => {
    expect(evaluateFourier([1, 0, 0, 0], Math.PI / 2)).toBeCloseTo(1, 10);
  });

  it('pure sine is zero at phi=0 and phi=pi', () => {
    expect(evaluateFourier([1, 0, 0, 0], 0)).toBeCloseTo(0, 10);
    expect(evaluateFourier([1, 0, 0, 0], Math.PI)).toBeCloseTo(0, 10);
  });

  it('zero amplitudes yield zero everywhere', () => {
    expect(evaluateFourier([0, 0, 0, 0], 0)).toBe(0);
    expect(evaluateFourier([0, 0, 0, 0], 1.234)).toBe(0);
  });

  it('respects the k-th harmonic: f(phi) = sum a_k * sin(k*phi)', () => {
    // H1 amplitude 0.5, H3 amplitude 0.25 -> f = 0.5*sin(phi) + 0.25*sin(3*phi)
    const amps = [0.5, 0, 0.25, 0];
    const phi = 0.7;
    const expected = 0.5 * Math.sin(phi) + 0.25 * Math.sin(3 * phi);
    expect(evaluateFourier(amps, phi)).toBeCloseTo(expected, 10);
  });

  it('is 2*pi-periodic', () => {
    const amps = [1, 0.5, 0.3, 0.1];
    const phi = 1.1;
    expect(evaluateFourier(amps, phi)).toBeCloseTo(evaluateFourier(amps, phi + 2 * Math.PI), 10);
  });
});

describe('spectralCentroid (brightness)', () => {
  it('returns 0 for an all-zero vector', () => {
    expect(spectralCentroid([0, 0, 0, 0])).toBe(0);
  });

  it('pure fundamental has centroid 1', () => {
    expect(spectralCentroid([1, 0, 0, 0])).toBe(1);
  });

  it('sawtooth (all harmonics 1/k) has centroid > 1', () => {
    const amps = harmonicAmplitudes('sawtooth', 4);
    const c = spectralCentroid(amps);
    expect(c).toBeGreaterThan(1);
    // num = 1*1 + 2*0.5 + 3*(1/3) + 4*0.25 = 4; den = 1+0.5+1/3+0.25 = 25/12
    expect(c).toBeCloseTo(4 / (1 + 0.5 + 1 / 3 + 0.25), 6);
  });

  it('adding high-frequency energy raises the centroid', () => {
    const dark = [1, 0, 0, 0];
    const bright = [1, 0, 0, 0.5];
    expect(spectralCentroid(bright)).toBeGreaterThan(spectralCentroid(dark));
  });

  it('triangle is darker than square (lower centroid for same harmonic count)', () => {
    const tri = spectralCentroid(harmonicAmplitudes('triangle', 8));
    const sq = spectralCentroid(harmonicAmplitudes('square', 8));
    expect(tri).toBeLessThan(sq);
  });
});

describe('cosineSimilarity', () => {
  it('is 1 for identical non-zero vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
  });

  it('is 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 10);
  });

  it('returns 0 when either vector is all zeros', () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
    expect(cosineSimilarity([1, 2], [0, 0])).toBe(0);
  });

  it('handles unequal lengths by truncating to the shorter', () => {
    // Only the first 2 components overlap.
    expect(cosineSimilarity([1, 0, 9, 9], [1, 0])).toBeCloseTo(1, 10);
  });

  it('is symmetric', () => {
    const a = [1, 2, 3];
    const b = [2, 1, 4];
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
  });
});

describe('classifyWaveform', () => {
  it('classifies canonical waveforms as themselves with similarity 1', () => {
    const cases = ['sine', 'square', 'sawtooth', 'triangle'] as const;
    for (const w of cases) {
      const amps = harmonicAmplitudes(w, 8);
      const result = classifyWaveform(amps);
      expect(result.type).toBe(w);
      expect(result.similarity).toBeCloseTo(1, 10);
    }
  });

  it('classifies a noisy square as square (robustness)', () => {
    // square with small perturbations on the even harmonics
    const base = harmonicAmplitudes('square', 8);
    const noisy = base.map((a, i) => (i % 2 === 1 ? a + 0.01 : a));
    const result = classifyWaveform(noisy);
    expect(result.type).toBe('square');
    expect(result.similarity).toBeGreaterThan(0.99);
  });

  it('returns a similarity in [0, 1]', () => {
    const result = classifyWaveform([1, 0.5, 0.3, 0.1, 0, 0, 0, 0]);
    expect(result.similarity).toBeGreaterThanOrEqual(0);
    expect(result.similarity).toBeLessThanOrEqual(1);
  });
});
