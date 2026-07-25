import { describe, it, expect } from 'vitest';
import {
  fibSequence,
  genFibonacci,
  genEuclidean,
  genPrime,
  genSymmetry,
  genRecursive,
  genFibonacciMelody,
  genSymmetricMelody,
  genSerialMelody,
  genCellular,
  genMarkov,
  genCounterpoint,
  getDailySeed,
  dailyHash,
} from './utils';
import { SCALES } from './worlds';

describe('fibSequence', () => {
  it('returns the seed [1, 1] when no further Fibonacci number is strictly less than n', () => {
    expect(fibSequence(0)).toEqual([1, 1]);
    expect(fibSequence(1)).toEqual([1, 1]);
    expect(fibSequence(2)).toEqual([1, 1]);
  });

  it('accumulates Fibonacci numbers strictly less than n', () => {
    expect(fibSequence(3)).toEqual([1, 1, 2]);
    expect(fibSequence(10)).toEqual([1, 1, 2, 3, 5, 8]);
    expect(fibSequence(100)).toEqual([1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89]);
  });

  it('always starts with [1, 1]', () => {
    expect(fibSequence(50).slice(0, 2)).toEqual([1, 1]);
  });

  it('every element after the first two equals the sum of the previous two', () => {
    const f = fibSequence(1000);
    for (let i = 2; i < f.length; i++) {
      expect(f[i]).toBe(f[i - 1] + f[i - 2]);
    }
  });
});

describe('genFibonacci', () => {
  it('places 1s at Fibonacci indices and 0s elsewhere for len=8', () => {
    // fibSequence(8) = [1,1,2,3,5]; all < 8 → indices 1,2,3,5 are 1
    expect(genFibonacci(8)).toEqual([0, 1, 1, 1, 0, 1, 0, 0]);
  });

  it('returns an array of length len filled with 0/1 values', () => {
    const p = genFibonacci(16);
    expect(p).toHaveLength(16);
    for (const v of p) expect(v === 0 || v === 1).toBe(true);
  });

  it('handles len=0 (empty array)', () => {
    expect(genFibonacci(0)).toEqual([]);
  });

  it('handles len=1 (no Fibonacci index fits, all zeros)', () => {
    // fibSequence(1) = [1,1]; 1 < 1 is false → no 1s placed
    expect(genFibonacci(1)).toEqual([0]);
  });

  it('handles len=2 (only index 1 fits)', () => {
    expect(genFibonacci(2)).toEqual([0, 1]);
  });

  it('handles large len without throwing and stays binary', () => {
    const p = genFibonacci(1000);
    expect(p).toHaveLength(1000);
    expect(p[0]).toBe(0); // Fibonacci numbers start at 1, so index 0 is always 0
    for (const v of p) expect(v === 0 || v === 1).toBe(true);
  });
});

describe('genEuclidean', () => {
  it('delegates to euclideanRhythm: E(3,8) is the Bossa Nova pattern', () => {
    expect(genEuclidean(3, 8)).toEqual([1, 0, 0, 1, 0, 0, 1, 0]);
  });

  it('E(4,8) is the four-on-the-floor pattern', () => {
    expect(genEuclidean(4, 8)).toEqual([1, 0, 1, 0, 1, 0, 1, 0]);
  });

  it('k=0 yields all zeros', () => {
    expect(genEuclidean(0, 8)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('k>=n yields all ones', () => {
    expect(genEuclidean(8, 8)).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
    expect(genEuclidean(10, 8)).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
  });

  it('preserves the pulse count k in the output (when 0 < k < n)', () => {
    for (const [k, n] of [
      [3, 8],
      [5, 13],
      [2, 5],
      [7, 12],
    ] as const) {
      const p = genEuclidean(k, n);
      expect(p).toHaveLength(n);
      expect(p.reduce((a, b) => a + b, 0)).toBe(k);
    }
  });
});

describe('genPrime', () => {
  it('marks prime indices with 1 for len=12', () => {
    // primes < 12: 2, 3, 5, 7, 11
    expect(genPrime(12)).toEqual([0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 0, 1]);
  });

  it('correctly identifies primes for len up to 20', () => {
    // primes < 20: 2,3,5,7,11,13,17,19
    const expected = [0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1];
    expect(genPrime(20)).toEqual(expected);
  });

  it('returns an array of length len with only 0/1 values', () => {
    const p = genPrime(30);
    expect(p).toHaveLength(30);
    for (const v of p) expect(v === 0 || v === 1).toBe(true);
  });

  it('handles len=0 (empty array)', () => {
    expect(genPrime(0)).toEqual([]);
  });

  it('handles len=1 (no primes below 1)', () => {
    expect(genPrime(1)).toEqual([0]);
  });

  it('handles len=2 (no primes below 2)', () => {
    expect(genPrime(2)).toEqual([0, 0]);
  });
});

describe('genSymmetry', () => {
  it('returns an array of length len with only 0/1 values', () => {
    for (const len of [0, 1, 2, 7, 8, 16, 32]) {
      const p = genSymmetry(len);
      expect(p).toHaveLength(len);
      for (const v of p) expect(v === 0 || v === 1).toBe(true);
    }
  });

  it('is periodic with period h = ceil(len/2): p[i] === p[i % h]', () => {
    for (const len of [4, 7, 8, 13, 16]) {
      const p = genSymmetry(len);
      const h = Math.ceil(len / 2);
      for (let i = 0; i < len; i++) {
        expect(p[i]).toBe(p[i % h]);
      }
    }
  });

  it('for even len, the second half equals the first half', () => {
    const len = 8;
    const p = genSymmetry(len);
    const h = len / 2;
    expect(p.slice(0, h)).toEqual(p.slice(h, len));
  });
});

describe('genRecursive', () => {
  it('expands motif=[1,0,1] with default depth=2 to the expected prefix', () => {
    // d=0: [1,0,1] -> [1,0,1,0,0,0,1,0,1] (length 9)
    // d=1: each 1 -> [1,0,1], each 0 -> [0,0,0]; concatenated length 27
    // slice(0, 10): idx 9 comes from p[3]=0 -> 0
    expect(genRecursive(10, [1, 0, 1])).toEqual([1, 0, 1, 0, 0, 0, 1, 0, 1, 0]);
  });

  it('respects explicit depth=1 (single expansion, may be shorter than len)', () => {
    // motif=[1,0,1] expanded once -> [1,0,1,0,0,0,1,0,1], length 9
    // slice(0, 10) returns the 9 available elements
    expect(genRecursive(10, [1, 0, 1], 1)).toEqual([1, 0, 1, 0, 0, 0, 1, 0, 1]);
  });

  it('returns the motif itself (truncated) when len <= motif.length', () => {
    expect(genRecursive(3, [1, 0, 1])).toEqual([1, 0, 1]);
    expect(genRecursive(2, [1, 0, 1])).toEqual([1, 0]);
    expect(genRecursive(0, [1, 0, 1])).toEqual([]);
  });

  it('only produces 0/1 values when the motif is binary', () => {
    const p = genRecursive(50, [1, 0, 1, 0, 0, 1]);
    expect(p).toHaveLength(50);
    for (const v of p) expect(v === 0 || v === 1).toBe(true);
  });

  it('starts with the motif itself when motif[0] === 1 and len >= motif.length', () => {
    const motif = [1, 0, 1, 1, 0];
    const p = genRecursive(40, motif, 3);
    expect(p.slice(0, motif.length)).toEqual(motif);
  });

  it('handles an all-zero motif (stays all zeros, length matches len when it can grow)', () => {
    // motif=[0,0,0] expands to 9 zeros after d=0, then breaks for len=8
    const p = genRecursive(8, [0, 0, 0]);
    expect(p).toHaveLength(8);
    for (const v of p) expect(v).toBe(0);
  });
});

describe('genFibonacciMelody', () => {
  it('produces the exact pitch sequence for len=8, minor scale', () => {
    // fibSequence(16) = [1,1,2,3,5,8,13]; minor.length = 7
    // p[i] = (fibs[i % 7] % 7) + 1 → [2,2,3,4,6,2,7,2]
    expect(genFibonacciMelody(8, 'C', 'minor')).toEqual([2, 2, 3, 4, 6, 2, 7, 2]);
  });

  it('returns an array of length len with values in [1, scale.length]', () => {
    for (const scaleType of ['minor', 'major', 'pentatonic', 'chromatic']) {
      const iv = SCALES[scaleType as keyof typeof SCALES];
      const p = genFibonacciMelody(16, 'C', scaleType);
      expect(p).toHaveLength(16);
      for (const v of p) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(iv.length);
      }
    }
  });

  it('handles len=0 (empty array)', () => {
    expect(genFibonacciMelody(0, 'C', 'minor')).toEqual([]);
  });

  it('handles len=1 (single pitch derived from the first Fibonacci number)', () => {
    // fibs = fibSequence(2) = [1,1]; p[0] = (1 % 7) + 1 = 2
    expect(genFibonacciMelody(1, 'C', 'minor')).toEqual([2]);
  });

  it('falls back to minor for an unknown scaleType', () => {
    expect(genFibonacciMelody(8, 'C', 'nonexistent')).toEqual(
      genFibonacciMelody(8, 'C', 'minor')
    );
  });

  it('respects pentatonic scale length (values in [1, 5])', () => {
    const p = genFibonacciMelody(20, 'C', 'pentatonic');
    expect(p).toHaveLength(20);
    for (const v of p) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(5);
    }
  });
});

describe('genSymmetricMelody', () => {
  it('returns an array of length len with values in [1, scale.length]', () => {
    for (const scaleType of ['minor', 'major', 'pentatonic', 'wholetone']) {
      const iv = SCALES[scaleType as keyof typeof SCALES];
      const p = genSymmetricMelody(16, 'C', scaleType);
      expect(p).toHaveLength(16);
      for (const v of p) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(iv.length);
      }
    }
  });

  it('is periodic with period h = ceil(len/2): p[i] === p[i % h]', () => {
    for (const len of [4, 7, 8, 13]) {
      const p = genSymmetricMelody(len, 'C', 'minor');
      const h = Math.ceil(len / 2);
      for (let i = 0; i < len; i++) {
        expect(p[i]).toBe(p[i % h]);
      }
    }
  });

  it('handles len=0 (empty array)', () => {
    expect(genSymmetricMelody(0, 'C', 'minor')).toEqual([]);
  });

  it('handles len=1 (single random pitch in range)', () => {
    const p = genSymmetricMelody(1, 'C', 'minor');
    expect(p).toHaveLength(1);
    expect(p[0]).toBeGreaterThanOrEqual(1);
    expect(p[0]).toBeLessThanOrEqual(7);
  });

  it('falls back to minor for an unknown scaleType', () => {
    const p = genSymmetricMelody(8, 'C', 'nonexistent');
    expect(p).toHaveLength(8);
    for (const v of p) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(SCALES.minor.length);
    }
  });
});

describe('genSerialMelody', () => {
  it('returns an array of length len with values in [1, 7]', () => {
    for (const len of [1, 7, 12, 24, 50]) {
      const p = genSerialMelody(len);
      expect(p).toHaveLength(len);
      for (const v of p) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(7);
      }
    }
  });

  it('handles len=0 (empty array)', () => {
    expect(genSerialMelody(0)).toEqual([]);
  });

  it('handles len=1 (single pitch in [1, 7])', () => {
    const p = genSerialMelody(1);
    expect(p).toHaveLength(1);
    expect(p[0]).toBeGreaterThanOrEqual(1);
    expect(p[0]).toBeLessThanOrEqual(7);
  });

  it('within the first 12 steps, the mod-7 residue set covers all of 0..6 (row is a permutation of 0..11)', () => {
    const p = genSerialMelody(12);
    const mods = p.map((v) => v - 1);
    expect(new Set(mods).size).toBe(7);
  });

  it('cycles the 12-tone row for len > 12 (first 12 == second 12)', () => {
    const p = genSerialMelody(24);
    expect(p).toHaveLength(24);
    expect(p.slice(0, 12)).toEqual(p.slice(12, 24));
  });
});

describe('genCellular', () => {
  it('default rule is 30: returns len binary values', () => {
    const p = genCellular(16);
    expect(p).toHaveLength(16);
    for (const v of p) expect(v === 0 || v === 1).toBe(true);
  });

  it('is deterministic for the same len (rule 30)', () => {
    expect(genCellular(8)).toEqual(genCellular(8));
  });

  it('explicit rule=30 matches the default', () => {
    expect(genCellular(16, 30)).toEqual(genCellular(16));
  });

  it('rule=0 produces a single 1 followed by zeros (state collapses to all-zero)', () => {
    // initial center cell is 1 (out[0]); after step 1, rule 0 makes everything 0
    expect(genCellular(8, 0)).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('rule=255 produces all ones (every neighborhood maps to 1)', () => {
    expect(genCellular(8, 255)).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
  });

  it('handles len=0 (empty array)', () => {
    expect(genCellular(0)).toEqual([]);
  });

  it('handles len=1 (single cell, single step: out[0] = initial center = 1)', () => {
    expect(genCellular(1)).toEqual([1]);
  });

  it('handles large len without throwing and stays binary', () => {
    const p = genCellular(500);
    expect(p).toHaveLength(500);
    for (const v of p) expect(v === 0 || v === 1).toBe(true);
  });
});

describe('genMarkov', () => {
  it('returns pattern of all 1s with the same length as pitches', () => {
    const { pattern, pitches } = genMarkov(16, 'C', 'minor');
    expect(pattern).toHaveLength(16);
    expect(pitches).toHaveLength(16);
    for (const v of pattern) expect(v).toBe(1);
  });

  it('pitches are within [1, scale.length] for minor (7)', () => {
    const { pitches } = genMarkov(50, 'C', 'minor');
    for (const v of pitches) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(SCALES.minor.length);
    }
  });

  it('pitches are within [1, scale.length] for pentatonic (5)', () => {
    const { pitches } = genMarkov(50, 'C', 'pentatonic');
    for (const v of pitches) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(SCALES.pentatonic.length);
    }
  });

  it('pitches start at 1 (initial state cur=0, push cur+1)', () => {
    const { pitches } = genMarkov(10, 'C', 'minor');
    expect(pitches[0]).toBe(1);
  });

  it('handles len=0 (empty pattern and pitches)', () => {
    const { pattern, pitches } = genMarkov(0, 'C', 'minor');
    expect(pattern).toEqual([]);
    expect(pitches).toEqual([]);
  });

  it('handles len=1 (single pitch of 1, pattern [1])', () => {
    const { pattern, pitches } = genMarkov(1, 'C', 'minor');
    expect(pattern).toEqual([1]);
    expect(pitches).toEqual([1]);
  });

  it('falls back to minor for an unknown scaleType (pitches in [1, 7])', () => {
    const { pitches } = genMarkov(50, 'C', 'nonexistent');
    for (const v of pitches) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(SCALES.minor.length);
    }
  });

  it('handles large len without throwing', () => {
    const { pattern, pitches } = genMarkov(500, 'C', 'major');
    expect(pattern).toHaveLength(500);
    expect(pitches).toHaveLength(500);
  });
});

describe('genCounterpoint', () => {
  it('inverts source pitches around the scale center with default octaveShift=-1', () => {
    // minor: iv.length=7, center=ceil(7/2)=4
    // pitches[i] = 2*4 - d + (-1)*7 = 1 - d
    const source = [1, 3, 5, 7];
    const { pattern, pitches } = genCounterpoint(source, 'minor');
    expect(pattern).toEqual([1, 1, 1, 1]);
    expect(pitches).toEqual([0, -2, -4, -6]);
  });

  it('respects explicit octaveShift=0 (pure inversion, no octave displacement)', () => {
    const source = [1, 3, 5, 7];
    const center = Math.ceil(SCALES.minor.length / 2); // 4
    const { pitches } = genCounterpoint(source, 'minor', 0);
    expect(pitches).toEqual(source.map((d) => 2 * center - d));
  });

  it('lengths of pattern and pitches match the source', () => {
    const source = [1, 2, 3, 4, 5, 6, 7];
    const { pattern, pitches } = genCounterpoint(source, 'major');
    expect(pattern).toHaveLength(source.length);
    expect(pitches).toHaveLength(source.length);
  });

  it('handles an empty source (empty result)', () => {
    const { pattern, pitches } = genCounterpoint([], 'minor');
    expect(pattern).toEqual([]);
    expect(pitches).toEqual([]);
  });

  it('handles a single-element source', () => {
    const source = [3];
    const center = Math.ceil(SCALES.major.length / 2); // 4
    const { pattern, pitches } = genCounterpoint(source, 'major', -1);
    expect(pattern).toEqual([1]);
    expect(pitches).toEqual([2 * center - 3 + -1 * SCALES.major.length]);
  });

  it('falls back to minor for an unknown scaleType', () => {
    const source = [1, 2, 3];
    const { pitches } = genCounterpoint(source, 'nonexistent', -1);
    const center = Math.ceil(SCALES.minor.length / 2);
    expect(pitches).toEqual(
      source.map((d) => 2 * center - d + -1 * SCALES.minor.length)
    );
  });

  it('satisfies 2*center - d + octaveShift*scale.length for every pitch (dorian, octaveShift=-2)', () => {
    const source = [1, 2, 3, 4, 5];
    const scaleType = 'dorian';
    const octaveShift = -2;
    const iv = SCALES[scaleType as keyof typeof SCALES];
    const center = Math.ceil(iv.length / 2);
    const { pitches } = genCounterpoint(source, scaleType, octaveShift);
    for (let i = 0; i < source.length; i++) {
      expect(pitches[i]).toBe(2 * center - source[i] + octaveShift * iv.length);
    }
  });
});

describe('getDailySeed', () => {
  it('returns a non-empty string', () => {
    const s = getDailySeed();
    expect(typeof s).toBe('string');
    expect(s.length).toBeGreaterThan(0);
  });

  it('matches the format YYYY-M-D (no zero-padding) for today', () => {
    const s = getDailySeed();
    const d = new Date();
    const expected = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    expect(s).toBe(expected);
  });

  it('is stable across consecutive calls in the same frame', () => {
    expect(getDailySeed()).toBe(getDailySeed());
  });
});

describe('dailyHash', () => {
  it('is deterministic (same input → same output)', () => {
    expect(dailyHash('2026-7-25', 100)).toBe(dailyHash('2026-7-25', 100));
    expect(dailyHash('hello', 1000)).toBe(dailyHash('hello', 1000));
  });

  it('returns a value in [0, mod)', () => {
    for (const mod of [2, 7, 100, 1000, 65536]) {
      const h = dailyHash('2026-7-25', mod);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(mod);
    }
  });

  it('returns 0 for an empty seed', () => {
    expect(dailyHash('', 100)).toBe(0);
    expect(dailyHash('', 1)).toBe(0);
  });

  it('returns 0 when mod=1 (everything is congruent to 0)', () => {
    expect(dailyHash('anything', 1)).toBe(0);
    expect(dailyHash('2026-7-25', 1)).toBe(0);
  });

  it('matches the manual h = (h*31 + charCode) % mod computation', () => {
    const seed = '2026-7-25';
    const mod = 100;
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = (h * 31 + seed.charCodeAt(i)) % mod;
    }
    expect(dailyHash(seed, mod)).toBe(h);
  });

  it('produces different hashes for different seeds (in general)', () => {
    const a = dailyHash('2026-7-25', 1000);
    const b = dailyHash('2026-7-26', 1000);
    expect(a).not.toBe(b);
  });
});