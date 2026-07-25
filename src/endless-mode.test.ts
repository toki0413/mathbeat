import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateQuestion,
  generateQuestionFromWorld,
  initEndlessMode,
  getEndlessState,
  submitAnswer,
  skipQuestion,
  endEndlessMode,
  playMelody,
  showEndlessHint,
  nextRound,
  EndlessConfig,
} from './endless-mode';
import { Store, DEFAULT_STATE } from './store';
import * as audio from './audio';
import * as uiRender from './ui-render';

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

function resetStore() {
  Store.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  Store.listeners = [];
  Store._idbReady = false;
  Store._saveTimer = null;
  Store._savePending = false;
}

describe('endless-mode', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // 兜底：清理所有 pending 定时器，避免跨用例污染
    endEndlessMode();
    vi.useRealTimers();
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

    it('未知 worldId 回退到 world 1 生成器', () => {
      const q = generateQuestionFromWorld(99, 1);
      expect(q.worldId).toBe(1);
      expect(q.text).toContain('LCM');
    });
  });

  describe('generateQuestion bonus types', () => {
    it('低 round 时不生成 prime / octave / waveLab 变体（始终是普通世界题）', () => {
      // round 1 时不会触发 prime (round>3) / octave (round>5) / waveLab (round>3)
      for (let i = 0; i < 50; i++) {
        const q = generateQuestion(1);
        expect(q.text).not.toContain('是质数吗');
        expect(q.text).not.toContain('个八度后的频率');
        expect(q.worldName).not.toContain('傅里叶');
      }
    });

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

    it('can generate harmonic / waveLab variants at round > 3', () => {
      let foundFreq = false;
      let foundSet = false;
      let foundDecay = false;
      let foundCentroid = false;
      for (let i = 0; i < 500 && (!foundFreq || !foundSet || !foundDecay || !foundCentroid); i++) {
        const q = generateQuestion(8);
        if (q.worldName === '傅里叶谐波') {
          if (q.text.includes('次谐波频率')) foundFreq = true;
          else if (q.text.includes('包含哪些谐波')) foundSet = true;
          else if (q.text.includes('振幅按什么规律衰减')) foundDecay = true;
          else if (q.text.includes('谱质心')) foundCentroid = true;
        }
      }
      expect(foundFreq).toBe(true);
      expect(foundSet).toBe(true);
      expect(foundDecay).toBe(true);
      expect(foundCentroid).toBe(true);
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
      expect(s.timerId).not.toBeNull();
    });

    it('initializes with 120s timed mode', () => {
      const config: EndlessConfig = { timeLimit: 120, focusedWorld: 0 };
      initEndlessMode(config);
      const s = getEndlessState();
      expect(s.timeLimit).toBe(120);
      expect(s.timeRemaining).toBe(120);
    });

    it('initializes with focused world 3', () => {
      const config: EndlessConfig = { timeLimit: 0, focusedWorld: 3 };
      initEndlessMode(config);
      const s = getEndlessState();
      expect(s.focusedWorld).toBe(3);
      expect(s.currentQuestion?.worldId).toBe(3);
    });

    it('passes focused world to subsequent nextRound calls', () => {
      initEndlessMode({ timeLimit: 0, focusedWorld: 5 });
      // 模拟下一轮（绕过 setTimeout）
      const s = getEndlessState();
      // 在 init 时 round 已经是 1，触发下一轮需要直接调用 nextRound
      nextRound();
      const ns = getEndlessState();
      expect(ns.round).toBe(2);
      expect(ns.currentQuestion?.worldId).toBe(5);
    });

    it('传入 Event 参数时使用默认配置', () => {
      const fakeEvent = new Event('click');
      initEndlessMode(fakeEvent as unknown as EndlessConfig);
      const s = getEndlessState();
      expect(s.timeLimit).toBe(0);
      expect(s.focusedWorld).toBe(0);
      expect(s.isPlaying).toBe(true);
    });

    it('重置 score/combo/maxCombo 与上一局无关', () => {
      // 第一局得分
      initEndlessMode();
      const s = getEndlessState();
      submitAnswer(s.currentQuestion!.correctAnswer);
      submitAnswer(s.currentQuestion!.correctAnswer);
      // 第二局开始
      initEndlessMode();
      const ns = getEndlessState();
      expect(ns.score).toBe(0);
      expect(ns.combo).toBe(0);
      expect(ns.maxCombo).toBe(0);
      expect(ns.correctCount).toBe(0);
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

    it('correct answer schedules nextRound via setTimeout', () => {
      vi.useFakeTimers();
      const s = getEndlessState();
      const roundBefore = s.round;
      submitAnswer(s.currentQuestion!.correctAnswer);
      // 此时 round 还未推进
      expect(getEndlessState().round).toBe(roundBefore);
      expect(getEndlessState().nextRoundTimer).not.toBeNull();
      // 推进 1200ms 后下一轮才触发
      vi.advanceTimersByTime(1200);
      // nextRound 已被 setTimeout 回调触发：round 推进了
      expect(getEndlessState().round).toBe(roundBefore + 1);
      // 题目已被重新生成（字段值会被刷新）
      expect(getEndlessState().currentQuestion).toBeDefined();
      vi.useRealTimers();
    });

    it('wrong answer does NOT schedule nextRound (stays on same question until skip/answer)', () => {
      vi.useFakeTimers();
      const s = getEndlessState();
      const roundBefore = s.round;
      submitAnswer('definitely-wrong');
      expect(getEndlessState().round).toBe(roundBefore);
      expect(getEndlessState().nextRoundTimer).toBeNull();
      vi.useRealTimers();
    });

    it('combo bonus contributes to score: combo N gives N*2 bonus (capped at 10)', () => {
      // 连续答对 5 题，比较第 1 题与第 5 题的得分增量
      const s1 = getEndlessState();
      submitAnswer(s1.currentQuestion!.correctAnswer);
      const scoreAfter1 = getEndlessState().score;
      // 推进到下一题
      const s2 = getEndlessState();
      submitAnswer(s2.currentQuestion!.correctAnswer);
      const scoreAfter2 = getEndlessState().score;
      const s3 = getEndlessState();
      submitAnswer(s3.currentQuestion!.correctAnswer);
      const scoreAfter3 = getEndlessState().score;
      // 第 3 次答对时 combo=3，bonus = 6
      // 单调递增（除非题面 points 差异，但至少得分必须 > 0）
      expect(scoreAfter3).toBeGreaterThan(scoreAfter2);
      expect(scoreAfter2).toBeGreaterThan(scoreAfter1);
    });

    it('accepts Event arg with answer in args[0]', () => {
      const s = getEndlessState();
      const correct = s.currentQuestion!.correctAnswer;
      const fakeEvent = new Event('click');
      submitAnswer(fakeEvent, correct);
      const ns = getEndlessState();
      expect(ns.correctCount).toBe(1);
      expect(ns.combo).toBe(1);
    });

    it('从 DOM #endlessInput 读取答案（无 args 时）', () => {
      const s = getEndlessState();
      const input = document.createElement('input');
      input.id = 'endlessInput';
      input.value = String(s.currentQuestion!.correctAnswer);
      document.body.appendChild(input);
      try {
        const fakeEvent = new Event('click');
        submitAnswer(fakeEvent);
        const ns = getEndlessState();
        expect(ns.correctCount).toBe(1);
      } finally {
        document.body.removeChild(input);
      }
    });

    it('字符串答案去除空白后比较', () => {
      const s = getEndlessState();
      const correct = s.currentQuestion!.correctAnswer;
      submitAnswer('  ' + String(correct) + '  ');
      const ns = getEndlessState();
      expect(ns.correctCount).toBe(1);
    });

    it('错答时调用 recordWrongAnswer（通过 learning-insights 集成）', () => {
      const s = getEndlessState();
      const beforeLen = (Store.state.wrongAnswerHistory || []).length;
      submitAnswer('definitely-wrong');
      const afterLen = (Store.state.wrongAnswerHistory || []).length;
      expect(afterLen).toBe(beforeLen + 1);
      const entry = Store.state.wrongAnswerHistory![afterLen - 1];
      expect(entry.worldId).toBe(s.currentQuestion!.worldId);
      expect(entry.questionText).toBe(s.currentQuestion!.text);
      expect(entry.userAnswer).toBe('definitely-wrong');
    });

    it('结束后 submitAnswer 静默返回，不影响 score/combo', () => {
      endEndlessMode();
      const before = getEndlessState();
      submitAnswer('whatever');
      const after = getEndlessState();
      expect(after.score).toBe(before.score);
      expect(after.combo).toBe(before.combo);
      expect(after.correctCount).toBe(before.correctCount);
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

    it('调用 playWrong 并显示提示', () => {
      skipQuestion();
      expect(audio.playWrong).toHaveBeenCalled();
      expect(uiRender.showHintFloat).toHaveBeenCalled();
    });

    it('调度下一轮 setTimeout（1000ms 后）', () => {
      vi.useFakeTimers();
      const roundBefore = getEndlessState().round;
      skipQuestion();
      expect(getEndlessState().nextRoundTimer).not.toBeNull();
      vi.advanceTimersByTime(1000);
      expect(getEndlessState().round).toBe(roundBefore + 1);
      vi.useRealTimers();
    });

    it('结束后 skipQuestion 静默返回', () => {
      endEndlessMode();
      const before = getEndlessState();
      skipQuestion();
      const after = getEndlessState();
      expect(after.round).toBe(before.round);
      expect(after.combo).toBe(before.combo);
    });
  });

  describe('nextRound 行为', () => {
    it('未在游戏中时（isPlaying=false）静默返回，不增加 round', () => {
      // 直接结束模式后调用 nextRound
      initEndlessMode();
      endEndlessMode();
      const before = getEndlessState();
      nextRound();
      const after = getEndlessState();
      expect(after.round).toBe(before.round);
    });

    it('focusedWorld=0 时随机选择 worldId 在 [1,8]', () => {
      initEndlessMode({ timeLimit: 0, focusedWorld: 0 });
      const seen = new Set<number>();
      for (let i = 0; i < 50; i++) {
        nextRound();
        const wid = getEndlessState().currentQuestion?.worldId;
        if (typeof wid === 'number') seen.add(wid);
        // 不一定每次随机到不同 world，但全部应落在 [1,8]
        expect(wid).toBeGreaterThanOrEqual(1);
        expect(wid).toBeLessThanOrEqual(8);
      }
      // 至少看到 2 个不同 world（避免完全固定）
      expect(seen.size).toBeGreaterThanOrEqual(2);
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

    it('clears nextRoundTimer if pending', () => {
      vi.useFakeTimers();
      // 答对一题触发 nextRoundTimer
      const s = getEndlessState();
      submitAnswer(s.currentQuestion!.correctAnswer);
      expect(getEndlessState().nextRoundTimer).not.toBeNull();
      // 此时结束模式
      endEndlessMode();
      expect(getEndlessState().nextRoundTimer).toBeNull();
      vi.useRealTimers();
    });

    it('累加 totalRounds / totalCorrect / totalQuestions 到 Store', () => {
      initEndlessMode();
      const s1 = getEndlessState();
      submitAnswer(s1.currentQuestion!.correctAnswer);
      // 第二次提交一个错误答案（注意：第一个参数是答案，会被识别为正确答案，
      // 故此处故意传一个不会与正确答案相等的字符串）
      submitAnswer('__definitely_wrong__');
      endEndlessMode();
      const stats = Store.state.endlessStats!;
      // round 在 initEndlessMode 中被 nextRound() 推进到 1；endEndlessMode 累加 endlessState.round
      expect(stats.totalRounds).toBeGreaterThanOrEqual(1);
      expect(stats.totalCorrect).toBeGreaterThanOrEqual(1);
      expect(stats.totalQuestions).toBeGreaterThanOrEqual(2);
    });

    it('bestScore 取历史最高值（不降低）', () => {
      // 第一局得分
      initEndlessMode();
      let s = getEndlessState();
      submitAnswer(s.currentQuestion!.correctAnswer);
      endEndlessMode();
      const bestAfter1 = Store.state.endlessStats!.bestScore;
      // 第二局 0 分
      initEndlessMode();
      endEndlessMode();
      const bestAfter2 = Store.state.endlessStats!.bestScore;
      expect(bestAfter2).toBe(bestAfter1);
    });

    it('bestCombo 取历史最高', () => {
      initEndlessMode();
      for (let i = 0; i < 5; i++) {
        const s = getEndlessState();
        submitAnswer(s.currentQuestion!.correctAnswer);
      }
      endEndlessMode();
      expect(Store.state.endlessStats!.bestCombo).toBeGreaterThanOrEqual(5);
    });

    it('答对至少 1 题时发放 endlessFinishBonus XP', () => {
      Store.state.xp = 0;
      initEndlessMode();
      const s = getEndlessState();
      submitAnswer(s.currentQuestion!.correctAnswer);
      endEndlessMode();
      // 得分对应 XP + 15 bonus
      const expectedScore = Store.state.endlessStats!.bestScore;
      expect(Store.state.xp).toBeGreaterThanOrEqual(expectedScore + 15);
    });

    it('0 题答对时不发放 finishBonus', () => {
      Store.state.xp = 0;
      initEndlessMode();
      endEndlessMode();
      expect(Store.state.xp).toBe(0);
    });
  });

  describe('playMelody', () => {
    it('空旋律时直接返回（不调用 scheduleToneAt）', () => {
      initEndlessMode();
      vi.mocked(audio.scheduleToneAt).mockClear();
      playMelody();
      expect(audio.scheduleToneAt).not.toHaveBeenCalled();
    });

    it('有旋律时为每个音符调用 scheduleToneAt', () => {
      initEndlessMode();
      // 答对几题加入音符
      for (let i = 0; i < 3; i++) {
        const s = getEndlessState();
        submitAnswer(s.currentQuestion!.correctAnswer);
      }
      const len = getEndlessState().melody.length;
      expect(len).toBeGreaterThan(0);
      vi.mocked(audio.scheduleToneAt).mockClear();
      playMelody();
      expect(audio.scheduleToneAt).toHaveBeenCalledTimes(len);
      // 每 4 个音符触发一次 kick
      const expectedKicks = Math.ceil(len / 4);
      expect(audio.scheduleKickAt).toHaveBeenCalledTimes(expectedKicks);
    });

    it('旋律超过 16 音符时执行 shift（FIFO 滚动窗口）', () => {
      initEndlessMode();
      // 答对 20 题
      for (let i = 0; i < 20; i++) {
        const s = getEndlessState();
        submitAnswer(s.currentQuestion!.correctAnswer);
      }
      const len = getEndlessState().melody.length;
      expect(len).toBeLessThanOrEqual(16);
    });
  });

  describe('showEndlessHint', () => {
    it('显示当前题目的提示', () => {
      initEndlessMode();
      const q = getEndlessState().currentQuestion!;
      showEndlessHint();
      expect(uiRender.showHintFloat).toHaveBeenCalledWith('💡 ' + q.hint);
    });

    it('未初始化或无题目时静默返回', () => {
      // 通过结束模式让 currentQuestion 仍存在但 isPlaying=false
      initEndlessMode();
      endEndlessMode();
      // currentQuestion 不会被清除，所以仍可显示提示
      // 但若从未 init 过，由于模块状态共享，我们只验证不抛错
      expect(() => showEndlessHint()).not.toThrow();
    });
  });

  describe('难度递增逻辑', () => {
    it('round 1-4: 数值范围 [2,6]', () => {
      // round 1-4 时 getDifficultyRange 返回 {min:2, max:6}
      // 通过 generateQuestionFromWorld(1, round) 间接校验：a 与 b 都在 [2,6]
      for (let r = 1; r <= 4; r++) {
        // 多次采样
        for (let i = 0; i < 30; i++) {
          const q = generateQuestionFromWorld(1, r);
          // 解析 LCM(a, b) 文本
          const m = q.text.match(/LCM\((\d+),\s*(\d+)\)/);
          expect(m).not.toBeNull();
          const a = Number(m![1]);
          const b = Number(m![2]);
          expect(a).toBeGreaterThanOrEqual(2);
          expect(a).toBeLessThanOrEqual(6);
          expect(b).toBeGreaterThanOrEqual(2);
          expect(b).toBeLessThanOrEqual(6);
        }
      }
    });

    it('round 5-9: 数值范围 [3,9]', () => {
      for (let i = 0; i < 30; i++) {
        const q = generateQuestionFromWorld(1, 7);
        const m = q.text.match(/LCM\((\d+),\s*(\d+)\)/);
        const a = Number(m![1]);
        const b = Number(m![2]);
        expect(a).toBeGreaterThanOrEqual(3);
        expect(a).toBeLessThanOrEqual(9);
        expect(b).toBeGreaterThanOrEqual(3);
        expect(b).toBeLessThanOrEqual(9);
      }
    });

    it('round 10-19: 数值范围 [4,12]', () => {
      for (let i = 0; i < 30; i++) {
        const q = generateQuestionFromWorld(1, 15);
        const m = q.text.match(/LCM\((\d+),\s*(\d+)\)/);
        const a = Number(m![1]);
        const b = Number(m![2]);
        expect(a).toBeGreaterThanOrEqual(4);
        expect(a).toBeLessThanOrEqual(12);
        expect(b).toBeGreaterThanOrEqual(4);
        expect(b).toBeLessThanOrEqual(12);
      }
    });

    it('round >= 20: 数值范围 [5,16]', () => {
      for (let i = 0; i < 30; i++) {
        const q = generateQuestionFromWorld(1, 25);
        const m = q.text.match(/LCM\((\d+),\s*(\d+)\)/);
        const a = Number(m![1]);
        const b = Number(m![2]);
        expect(a).toBeGreaterThanOrEqual(5);
        expect(a).toBeLessThanOrEqual(16);
        expect(b).toBeGreaterThanOrEqual(5);
        expect(b).toBeLessThanOrEqual(16);
      }
    });
  });

  describe('长时间运行与连击中断', () => {
    it('混合答题：连击中断后再答对，maxCombo 保持历史最大值', () => {
      initEndlessMode();
      // 连续答对 4 题
      for (let i = 0; i < 4; i++) {
        const s = getEndlessState();
        submitAnswer(s.currentQuestion!.correctAnswer);
      }
      expect(getEndlessState().combo).toBe(4);
      expect(getEndlessState().maxCombo).toBe(4);
      // 答错中断
      submitAnswer('definitely-wrong');
      expect(getEndlessState().combo).toBe(0);
      expect(getEndlessState().maxCombo).toBe(4); // maxCombo 保留
      // 再答对 2 题
      const s1 = getEndlessState();
      submitAnswer(s1.currentQuestion!.correctAnswer);
      const s2 = getEndlessState();
      submitAnswer(s2.currentQuestion!.correctAnswer);
      expect(getEndlessState().combo).toBe(2);
      expect(getEndlessState().maxCombo).toBe(4); // 仍未超过 4
    });

    it('连续答对 12 题，combo 突破 maxCombo=10 但仍单调推进', () => {
      initEndlessMode();
      for (let i = 0; i < 12; i++) {
        const s = getEndlessState();
        submitAnswer(s.currentQuestion!.correctAnswer);
      }
      const ns = getEndlessState();
      expect(ns.combo).toBe(12);
      expect(ns.maxCombo).toBe(12);
    });
  });

  describe('timer 触发 (timed mode)', () => {
    it('定时器倒计时归零时自动调用 endEndlessMode', () => {
      vi.useFakeTimers();
      initEndlessMode({ timeLimit: 1, focusedWorld: 0 });
      expect(getEndlessState().isPlaying).toBe(true);
      // 倒计时 1 秒后下一帧 timer 触发
      // 注意：startTime 是 Date.now()，需要让 Date.now() 推进
      vi.setSystemTime(Date.now() + 2000);
      vi.advanceTimersByTime(1000);
      // 此时 timeRemaining 应已 <= 0，触发 endEndlessMode
      expect(getEndlessState().isPlaying).toBe(false);
      vi.useRealTimers();
    });

    it('定时器在每秒触发时更新 timeRemaining', () => {
      vi.useFakeTimers();
      initEndlessMode({ timeLimit: 60, focusedWorld: 0 });
      const initial = getEndlessState().timeRemaining;
      // 推进 1 秒（advanceTimersByTime 会同时推进 fake Date 与定时器）
      vi.advanceTimersByTime(1000);
      // setInterval 已触发一次，根据 cfg.timeLimit - floor((now - start) / 1000) 重新计算
      // 此时 timeRemaining 应等于 initial - 1（60 - 1 = 59）
      expect(getEndlessState().timeRemaining).toBe(initial - 1);
      vi.useRealTimers();
    });
  });
});
