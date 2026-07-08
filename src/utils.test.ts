import { describe, it, expect } from 'vitest';
import { lcmCalc, gcdCalc, euclideanRhythm, arraysEqual, isPermutation, midiToFreq, escapeHtml } from './utils';

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
