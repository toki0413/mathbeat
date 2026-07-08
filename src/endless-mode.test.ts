import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateQuestion,
  generateQuestionFromWorld,
  initEndlessMode,
  getEndlessState,
  submitAnswer,
  skipQuestion,
  endEndlessMode,
  playMelody,
  EndlessConfig,
} from './endless-mode';
import { Store, DEFAULT_STATE } from './store';

// Mock audio functions to avoid Web Audio API in jsdom
vi.mock('./audio', () => ({
  getAudioCtx: () => ({ currentTime: 0 }),
  scheduleToneAt: vi.fn(),
  playCorrect: vi.fn(),
  playWrong: vi.fn(),
  scheduleKickAt: vi.fn(),
  scheduleSnareAt: vi.fn(),
}));

vi.mock('./ui-render', () => ({
  showHintFloat: vi.fn(),
  closeEndlessMode: vi.fn(),
}));

vi.mock('./game-engine', () => ({
  stopAllPlayback: vi.fn(),
}));

describe('endless-mode', () => {
  beforeEach(() => {
    Store.state = { ...DEFAULT_STATE };
  });

  describe('generateQuestionFromWorld', () => {
    it('generates world 1 (LCM) questions with correctAnswer as a number', () => {
      const q = generateQuestionFromWorld(1, 1);
      expect(q.worldId).toBe(1);
      expect(typeof q.correctAnswer).toBe('number');
      expect(q.text).toContain('LCM');
      expect(q.points).toBeGreaterThan(0);
    });

    it('generates world 2 (symmetry) questions with options', () => {
      const q = generateQuestionFromWorld(2, 1);
      expect(q.worldId).toBe(2);
      expect(q.inputType).toBe('choice');
      expect(q.options).toBeDefined();
      expect(q.options!.length).toBeGreaterThan(0);
    });

    it('generates world 3 (frequency) questions with correctAnswer as number', () => {
      const q = generateQuestionFromWorld(3, 1);
      expect(q.worldId).toBe(3);
      expect(typeof q.correctAnswer).toBe('number');
      expect(q.text).toContain('频率');
    });

    it('generates world 4 (modular) questions', () => {
      const q = generateQuestionFromWorld(4, 1);
      expect(q.worldId).toBe(4);
      expect(typeof q.correctAnswer).toBe('number');
    });

    it('generates world 5 (permutation) questions with options', () => {
      const q = generateQuestionFromWorld(5, 1);
      expect(q.worldId).toBe(5);
      expect(q.inputType).toBe('choice');
      expect(q.options).toBeDefined();
    });

    it('generates world 6 (euclidean) questions', () => {
      const q = generateQuestionFromWorld(6, 1);
      expect(q.worldId).toBe(6);
      expect(typeof q.correctAnswer).toBe('number');
      expect(q.text).toContain('E(');
    });

    it('generates world 7 (probability) questions', () => {
      const q = generateQuestionFromWorld(7, 1);
      expect(q.worldId).toBe(7);
      expect(typeof q.correctAnswer).toBe('number');
      expect(q.text).toContain('概率');
    });

    it('generates world 8 (graph) questions', () => {
      const q = generateQuestionFromWorld(8, 1);
      expect(q.worldId).toBe(8);
      expect(typeof q.correctAnswer).toBe('number');
      expect(q.text).toContain('路径');
    });

    it('scales difficulty with round number', () => {
      const q1 = generateQuestionFromWorld(1, 1);
      const q20 = generateQuestionFromWorld(1, 20);
      // q20 should have higher points than q1 on average
      expect(q20.points).toBeGreaterThanOrEqual(q1.points);
    });
  });

  describe('generateQuestion bonus types', () => {
    it('can generate prime number questions at higher rounds', () => {
      let found = false;
      for (let i = 0; i < 100; i++) {
        const q = generateQuestion(10);
        if (q.text.includes('是质数吗')) {
          found = true;
          expect(q.inputType).toBe('choice');
          expect(q.options).toEqual(['是', '否']);
          expect(q.correctAnswer === '是' || q.correctAnswer === '否').toBe(true);
          break;
        }
      }
      expect(found).toBe(true);
    });

    it('can generate octave frequency questions at higher rounds', () => {
      let found = false;
      for (let i = 0; i < 100; i++) {
        const q = generateQuestion(10);
        if (q.text.includes('个八度后的频率')) {
          found = true;
          expect(q.inputType).toBe('number');
          expect(typeof q.correctAnswer).toBe('number');
          break;
        }
      }
      expect(found).toBe(true);
    });
  });

  describe('initEndlessMode', () => {
    it('initializes with default config (infinite, all worlds)', () => {
      initEndlessMode();
      const s = getEndlessState();
      expect(s.isPlaying).toBe(true);
      expect(s.round).toBe(1);
      expect(s.timeLimit).toBe(0);
      expect(s.focusedWorld).toBe(0);
      expect(s.currentQuestion).not.toBeNull();
    });

    it('initializes with 60s timed mode', () => {
      const config: EndlessConfig = { timeLimit: 60, focusedWorld: 0 };
      initEndlessMode(config);
      const s = getEndlessState();
      expect(s.timeLimit).toBe(60);
      expect(s.timeRemaining).toBe(60);
    });

    it('initializes with focused world 3', () => {
      const config: EndlessConfig = { timeLimit: 0, focusedWorld: 3 };
      initEndlessMode(config);
      const s = getEndlessState();
      expect(s.focusedWorld).toBe(3);
      expect(s.currentQuestion?.worldId).toBe(3);
    });
  });

  describe('submitAnswer', () => {
    beforeEach(() => {
      initEndlessMode();
    });

    it('awards points and increments combo on correct answer', () => {
      const s = getEndlessState();
      const correct = s.currentQuestion!.correctAnswer;
      const prevScore = s.score;
      submitAnswer(correct);
      const ns = getEndlessState();
      expect(ns.correctCount).toBe(1);
      expect(ns.combo).toBe(1);
      expect(ns.score).toBeGreaterThan(prevScore);
      expect(ns.melody.length).toBe(1);
    });

    it('resets combo and does not add melody on wrong answer', () => {
      const s = getEndlessState();
      const prevMelody = s.melody.length;
      submitAnswer('definitely-wrong');
      const ns = getEndlessState();
      expect(ns.combo).toBe(0);
      expect(ns.melody.length).toBe(prevMelody);
    });

    it('caps combo bonus at 10', () => {
      // Simulate 11 correct answers
      for (let i = 0; i < 11; i++) {
        const s = getEndlessState();
        submitAnswer(s.currentQuestion!.correctAnswer);
      }
      const ns = getEndlessState();
      expect(ns.combo).toBe(11);
      expect(ns.maxCombo).toBe(11);
    });
  });

  describe('skipQuestion', () => {
    beforeEach(() => {
      initEndlessMode();
    });

    it('resets combo', () => {
      skipQuestion();
      const ns = getEndlessState();
      expect(ns.combo).toBe(0);
    });
  });

  describe('endEndlessMode', () => {
    beforeEach(() => {
      initEndlessMode();
    });

    it('saves stats to Store and stops playing', () => {
      const s = getEndlessState();
      submitAnswer(s.currentQuestion!.correctAnswer);
      endEndlessMode();
      const ns = getEndlessState();
      expect(ns.isPlaying).toBe(false);
      expect(Store.state.endlessStats).toBeDefined();
      expect(Store.state.endlessStats!.bestScore).toBeGreaterThan(0);
    });

    it('clears timer when ending timed mode', () => {
      initEndlessMode({ timeLimit: 60, focusedWorld: 0 });
      const s = getEndlessState();
      expect(s.timerId).not.toBeNull();
      endEndlessMode();
      const ns = getEndlessState();
      expect(ns.timerId).toBeNull();
    });
  });
});
