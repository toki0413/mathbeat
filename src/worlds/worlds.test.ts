import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ===== MOCKS ===== */
vi.mock('../audio', () => ({
  getAudioCtx: vi.fn(() => ({ currentTime: 0, destination: {}, createOscillator: vi.fn(), createGain: vi.fn() })),
  playSample: vi.fn(),
  scheduleToneAt: vi.fn(),
  scheduleKickAt: vi.fn(),
  scheduleSnareAt: vi.fn(),
  playCorrect: vi.fn(),
  playWrong: vi.fn(),
  getSharedTransport: vi.fn(() => ({ subscribe: vi.fn(), start: vi.fn(), stop: vi.fn(), setBpm: vi.fn() })),
  stopSharedTransport: vi.fn(),
}));

vi.mock('../ui-render', () => ({
  showHintFloat: vi.fn(),
  showStars: vi.fn(),
  showEducationCard: vi.fn(),
  showAchievementPopup: vi.fn(),
  showScreen: vi.fn(),
  showBossProblem: vi.fn(),
  showTutorial: vi.fn(),
  closeEduCard: vi.fn(),
  closeTutorial: vi.fn(),
  closeWhy: vi.fn(),
  renderHome: vi.fn(),
  renderContinueBar: vi.fn(),
  updateDailyBanner: vi.fn(),
}));

vi.mock('../events', () => ({
  registerActions: vi.fn(),
  registerInputs: vi.fn(),
}));

vi.mock('../practice-mode', () => ({
  openPracticeFromWorld1: vi.fn(),
  openPracticeFromWorld4: vi.fn(),
  openPracticeFromWorld6: vi.fn(),
  openPracticeFromWorld7: vi.fn(),
}));

vi.mock('../game-engine', () => {
  const state: Record<string, any> = {};
  return {
    state,
    completeLevel: vi.fn(),
    recordAdaptive: vi.fn(),
    updateLeaderboard: vi.fn(),
    checkAchievements: vi.fn(),
    nextLevel: vi.fn(),
  };
});

/* ===== IMPORTS (after mocks are hoisted) ===== */
import {
  WORLDS,
  LEVELS,
  SCALES,
  ACHIEVEMENTS,
  ROOT_SEMITONES,
  NOTE_NAMES,
  NOTE_FREQS,
} from '../worlds';
import {
  state,
  completeLevel,
  recordAdaptive,
  updateLeaderboard,
  checkAchievements,
} from '../game-engine';
import { playCorrect, playWrong } from '../audio';
import { lcmCalc, gcdCalc } from '../utils';
import { renderWorld1, w1RenderSequencer, w1ToggleCell, w1Verify } from './world1';
import { renderWorld2 } from './world2';
import { renderWorld3 } from './world3';
import { renderWorld4 } from './world4';
import { renderWorld5 } from './world5';
import { renderWorld6 } from './world6';
import { renderWorld7 } from './world7';
import { renderWorld8 } from './world8';

/* ===== SETUP ===== */
let container: HTMLElement;

function resetState() {
  Object.keys(state).forEach((k) => delete state[k]);
  state.combo = 0;
  state.currentLevel = '1-1';
  state.currentWorld = 1;
  state.hintLevel = 0;
  state.bpm = 120;
}

beforeEach(() => {
  document.body.innerHTML = '';
  container = document.createElement('div');
  document.body.appendChild(container);
  resetState();
  vi.clearAllMocks();
  (window as any).spawnConfetti = vi.fn();
  (window as any).spawnCorrectParticles = vi.fn();
  (window as any).spawnComboParticles = vi.fn();
});

/* ===== 1. worlds.ts DATA INTEGRITY ===== */
describe('worlds.ts data integrity', () => {
  it('WORLDS has 8 entries with required fields', () => {
    expect(WORLDS).toHaveLength(8);
    for (const w of WORLDS) {
      expect(typeof w.id).toBe('number');
      expect(typeof w.name).toBe('string');
      expect(typeof w.sub).toBe('string');
      expect(typeof w.emoji).toBe('string');
      expect(typeof w.grad).toBe('string');
      expect(typeof w.unlockLabel).toBe('string');
    }
  });

  it('LEVELS contains worlds 1-8, each with 5 normal + 1 boss', () => {
    for (let wid = 1; wid <= 8; wid++) {
      const levels = LEVELS[wid];
      expect(Array.isArray(levels)).toBe(true);
      expect(levels).toHaveLength(6);
      const bosses = levels.filter((l) => l.boss === true);
      expect(bosses).toHaveLength(1);
      const normals = levels.filter((l) => !l.boss);
      expect(normals).toHaveLength(5);
    }
  });

  it('level ids match `${worldId}-${n}` or `${worldId}-B`', () => {
    for (let wid = 1; wid <= 8; wid++) {
      for (const lv of LEVELS[wid]) {
        expect(lv.id).toMatch(new RegExp(`^${wid}-([1-5]|B)$`));
      }
    }
  });

  it('worlds 1 and 4 levels have a and b fields', () => {
    for (const lv of LEVELS[1]) {
      expect(typeof lv.a).toBe('number');
      expect(typeof lv.b).toBe('number');
    }
    for (const lv of LEVELS[4]) {
      expect(typeof lv.a).toBe('number');
      expect(typeof lv.b).toBe('number');
    }
  });

  it('world 5 levels have motif arrays', () => {
    for (const lv of LEVELS[5]) {
      expect(Array.isArray(lv.motif)).toBe(true);
      expect(lv.motif!.length).toBeGreaterThan(0);
    }
  });

  it('SCALES contains all 8 required scale types', () => {
    const keys = ['major', 'minor', 'dorian', 'mixolydian', 'pentatonic', 'phrygian', 'wholetone', 'chromatic'];
    for (const k of keys) {
      expect(SCALES).toHaveProperty(k);
      expect(Array.isArray((SCALES as Record<string, number[]>)[k])).toBe(true);
    }
  });

  it('each SCALES entry is ascending and has no duplicates', () => {
    for (const key of Object.keys(SCALES)) {
      const arr = (SCALES as Record<string, number[]>)[key];
      // ascending (non-decreasing strictly)
      for (let i = 1; i < arr.length; i++) {
        expect(arr[i]).toBeGreaterThan(arr[i - 1]);
      }
      // no duplicates
      const set = new Set(arr);
      expect(set.size).toBe(arr.length);
    }
  });

  it('NOTE_NAMES has 12 entries', () => {
    expect(NOTE_NAMES).toHaveLength(12);
    expect(new Set(NOTE_NAMES).size).toBe(12);
  });

  it('NOTE_FREQS has 12 entries in ascending order', () => {
    expect(NOTE_FREQS).toHaveLength(12);
    for (let i = 1; i < NOTE_FREQS.length; i++) {
      expect(NOTE_FREQS[i]).toBeGreaterThan(NOTE_FREQS[i - 1]);
    }
  });

  it('ROOT_SEMITONES corresponds to NOTE_NAMES one-to-one', () => {
    for (let i = 0; i < 12; i++) {
      const name = NOTE_NAMES[i];
      expect(ROOT_SEMITONES).toHaveProperty(name);
      expect((ROOT_SEMITONES as Record<string, number>)[name]).toBe(i);
    }
    expect(Object.keys(ROOT_SEMITONES)).toHaveLength(12);
  });
});

/* ===== 2. world1 RENDER & VERIFY ===== */
describe('world1 render & verify', () => {
  it('renderWorld1 writes sequencer markup to container', () => {
    renderWorld1(container, '1-1');
    expect(container.innerHTML).toContain('w1Seq');
    expect(container.innerHTML).toContain('w1Input');
    expect(container.innerHTML).toContain('w1Verify');
  });

  it('renderWorld1 returns early for unknown lid', () => {
    const before = container.innerHTML;
    renderWorld1(container, 'does-not-exist');
    expect(container.innerHTML).toBe(before);
  });

  it('w1RenderSequencer is safe when #w1Seq is missing', () => {
    expect(() => w1RenderSequencer()).not.toThrow();
  });

  it('w1ToggleCell toggles state.w1.activeA[2]', () => {
    renderWorld1(container, '1-1'); // a=2, b=3 -> activeA = {2:true,4:true,6:true}
    expect(state.w1.activeA[2]).toBeTruthy();
    w1ToggleCell('A', 2);
    expect(state.w1.activeA[2]).toBeFalsy();
    w1ToggleCell('A', 2);
    expect(state.w1.activeA[2]).toBeTruthy();
  });

  it('w1Verify calls playWrong and resets combo on wrong input', () => {
    renderWorld1(container, '1-1'); // lcm=6
    const input = document.getElementById('w1Input') as HTMLInputElement;
    input.value = '999';
    state.combo = 5;
    w1Verify();
    expect(playWrong).toHaveBeenCalled();
    expect(state.combo).toBe(0);
    expect(playCorrect).not.toHaveBeenCalled();
  });

  it('w1Verify prompts error when input is correct but no notes', () => {
    renderWorld1(container, '1-1'); // lcm=6
    state.w1.activeA = {};
    state.w1.activeB = {};
    const input = document.getElementById('w1Input') as HTMLInputElement;
    input.value = String(state.w1.lcm);
    w1Verify();
    expect(playWrong).toHaveBeenCalled();
    expect(playCorrect).not.toHaveBeenCalled();
    expect(completeLevel).not.toHaveBeenCalled();
  });

  it('w1Verify calls playCorrect and completeLevel on correct input with chord at LCM', () => {
    renderWorld1(container, '1-1'); // a=2,b=3,lcm=6; activeA[6]=true, activeB[6]=true
    const input = document.getElementById('w1Input') as HTMLInputElement;
    input.value = String(state.w1.lcm);
    w1Verify();
    expect(playCorrect).toHaveBeenCalled();
    expect(completeLevel).toHaveBeenCalledWith(1, state.currentLevel, expect.any(Number));
    expect(recordAdaptive).toHaveBeenCalled();
    expect(updateLeaderboard).toHaveBeenCalled();
    expect(checkAchievements).toHaveBeenCalled();
  });
});

/* ===== 3. world2-8 SMOKE TESTS ===== */
describe('world2 smoke test', () => {
  it('renderWorld2 renders markup without throwing', () => {
    expect(() => renderWorld2(container, '2-1')).not.toThrow();
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});

describe('world3 smoke test', () => {
  it('renderWorld3 renders markup without throwing', () => {
    expect(() => renderWorld3(container, '3-1')).not.toThrow();
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});

describe('world4 smoke test', () => {
  it('renderWorld4 renders markup without throwing', () => {
    expect(() => renderWorld4(container, '4-1')).not.toThrow();
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});

describe('world5 smoke test', () => {
  it('renderWorld5 renders markup without throwing', () => {
    expect(() => renderWorld5(container, '5-1')).not.toThrow();
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});

describe('world6 smoke test', () => {
  it('renderWorld6 renders markup without throwing', () => {
    expect(() => renderWorld6(container, '6-1')).not.toThrow();
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});

describe('world7 smoke test', () => {
  it('renderWorld7 renders markup without throwing', () => {
    expect(() => renderWorld7(container, '7-1')).not.toThrow();
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});

describe('world8 smoke test', () => {
  it('renderWorld8 renders markup without throwing', () => {
    expect(() => renderWorld8(container, '8-1')).not.toThrow();
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});

/* ===== 4. MATH CORRECTNESS ===== */
describe('math correctness', () => {
  it('world1: lcmCalc(a,b) is a common multiple of a and b', () => {
    for (const lv of LEVELS[1]) {
      const { a, b } = lv;
      const lcm = lcmCalc(a!, b!);
      expect(lcm % a!).toBe(0);
      expect(lcm % b!).toBe(0);
      // lcm equals a*b/gcd
      expect(lcm).toBe((a! * b!) / gcdCalc(a!, b!));
    }
  });

  it('world4: gcdCalc(a,b) matches expected values', () => {
    const expected: Record<string, number> = {
      '4-1': 1, // (3,5)
      '4-2': 2, // (4,6)
      '4-3': 1, // (5,7)
      '4-4': 1, // (5,8)
      '4-5': 3, // (6,9)
      '4-B': 1, // (7,9)
    };
    for (const lv of LEVELS[4]) {
      const { a, b } = lv;
      const g = gcdCalc(a!, b!);
      expect(g).toBe(expected[lv.id]);
      // gcd must divide both a and b
      expect(a! % g).toBe(0);
      expect(b! % g).toBe(0);
    }
  });

  it('world5: motif elements are pitch classes in [0, 11]', () => {
    for (const lv of LEVELS[5]) {
      for (const n of lv.motif!) {
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(11);
        expect(Number.isInteger(n)).toBe(true);
      }
    }
  });
});
