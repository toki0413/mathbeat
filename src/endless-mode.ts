import { Store } from './store';
import { WORLDS, CONCEPT_TO_WORLD } from './worlds';
import { getAudioCtx, scheduleToneAt, playCorrect, playWrong, scheduleKickAt, scheduleSnareAt } from './audio';
import { lcmCalc, gcdCalc, euclideanRhythm, midiToFreq } from './utils';
import { showHintFloat, closeEndlessMode } from './ui-render';
import { stopAllPlayback } from './game-engine';
import { registerActions } from './events';

export interface EndlessQuestion {
  worldId: number;
  worldName: string;
  text: string;
  correctAnswer: string | number;
  options?: string[];
  inputType: 'number' | 'choice' | 'ratio';
  hint: string;
  points: number;
}

export interface EndlessState {
  round: number;
  score: number;
  combo: number;
  maxCombo: number;
  correctCount: number;
  totalCount: number;
  currentQuestion: EndlessQuestion | null;
  melody: number[];
  isPlaying: boolean;
  timeLimit: number; // 0 = infinite, 60, 120
  timeRemaining: number;
  focusedWorld: number; // 0 = all, 1-8 = specific world
  timerId: ReturnType<typeof setInterval> | null;
  nextRoundTimer: ReturnType<typeof setTimeout> | null;
  startTime: number;
}

let endlessState: EndlessState = {
  round: 0,
  score: 0,
  combo: 0,
  maxCombo: 0,
  correctCount: 0,
  totalCount: 0,
  currentQuestion: null,
  melody: [],
  isPlaying: false,
  timeLimit: 0,
  timeRemaining: 0,
  focusedWorld: 0,
  timerId: null,
  nextRoundTimer: null,
  startTime: 0,
};

const WORLD_EMOJIS = ['🥁', '🎵', '🌊', '🔄', '🎯', '🔨', '🎲', '🕸️'];
const WORLD_NAMES = [
  '节拍与分数',
  '音程与对称',
  '频率与指数',
  '模运算与多节奏',
  '排列与旋律',
  '递归与分形',
  '概率与随机',
  '图论与和声',
];

/* ===== DIFFICULTY SCALING ===== */
function getDifficultyRange(round: number): { min: number; max: number } {
  if (round < 5) return { min: 2, max: 6 };
  if (round < 10) return { min: 3, max: 9 };
  if (round < 20) return { min: 4, max: 12 };
  return { min: 5, max: 16 };
}

function pickRandomWorld(): number {
  return Math.floor(Math.random() * 8) + 1;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* ===== QUESTION GENERATORS ===== */
function generateWorld1Question(round: number): EndlessQuestion {
  const { min, max } = getDifficultyRange(round);
  const a = randomInt(min, max);
  const b = randomInt(min, max);
  const lcm = lcmCalc(a, b);
  const gcd = gcdCalc(a, b);
  const isLCM = Math.random() > 0.5;
  return {
    worldId: 1,
    worldName: WORLD_NAMES[0],
    text: `LCM(${a}, ${b}) = ?`,
    correctAnswer: isLCM ? lcm : gcd,
    inputType: 'number',
    hint: `GCD(${a}, ${b}) = ${gcd}, LCM = ${(a * b) / gcd}`,
    points: Math.floor((a + b) / 2),
  };
}

function generateWorld2Question(round: number): EndlessQuestion {
  const rotations = [0, 1, 2, 3, 4, 5, 6];
  const rot = rotations[randomInt(0, rotations.length - 1)];
  const semitones = rot * 2;
  return {
    worldId: 2,
    worldName: WORLD_NAMES[1],
    text: `C大三和弦整体旋转 ${rot} 个全音（${semitones} 个半音），根音变成？`,
    correctAnswer: ['C', 'D', 'E', 'F#', 'G#', 'A#', 'C'][rot],
    options: ['C', 'D', 'E', 'F#', 'G#', 'A#', 'C'].slice(0, 4),
    inputType: 'choice',
    hint: '每旋转1个全音 = 2个半音，根音上移。',
    points: 3 + round,
  };
}

function generateWorld3Question(round: number): EndlessQuestion {
  const ratios = [
    { name: '纯五度', ratio: '3:2', freq: 660 },
    { name: '纯四度', ratio: '4:3', freq: 586.67 },
    { name: '大三度', ratio: '5:4', freq: 550 },
    { name: '小二度', ratio: '16:15', freq: 469.33 },
    { name: '大六度', ratio: '5:3', freq: 733.33 },
    { name: '小三度', ratio: '6:5', freq: 528 },
  ];
  const r = ratios[randomInt(0, ratios.length - 1)];
  return {
    worldId: 3,
    worldName: WORLD_NAMES[2],
    text: `A=440Hz，${r.name} 的频率比是 ${r.ratio}，目标频率是多少？`,
    correctAnswer: Math.round(r.freq),
    inputType: 'number',
    hint: `440 × ${r.ratio.split(':')[0]} / ${r.ratio.split(':')[1]} = ${Math.round(r.freq)}Hz`,
    points: 4 + round,
  };
}

function generateWorld4Question(round: number): EndlessQuestion {
  const { min, max } = getDifficultyRange(round);
  const a = randomInt(min, max);
  const b = randomInt(min, max);
  const gcd = gcdCalc(a, b);
  const lcm = lcmCalc(a, b);
  const isCoprime = gcd === 1;
  return {
    worldId: 4,
    worldName: WORLD_NAMES[3],
    text: `${a} 步一圈和 ${b} 步一圈，GCD=${gcd}，${isCoprime ? '它们何时第一次对齐？' : 'LCM 是多少？'}`,
    correctAnswer: isCoprime ? lcm : lcm,
    inputType: 'number',
    hint: `LCM(${a}, ${b}) = ${lcm}`,
    points: 3 + Math.floor((a + b) / 3),
  };
}

function generateWorld5Question(round: number): EndlessQuestion {
  const motifs = [
    [0, 2, 4, 7],
    [0, 2, 4, 5, 7],
    [0, 3, 5, 7],
    [0, 2, 3, 5, 7, 9],
  ];
  const m = motifs[randomInt(0, motifs.length - 1)];
  const ops = ['逆行', '倒影', '循环移位'];
  const op = ops[randomInt(0, ops.length - 1)];
  let result: number[];
  if (op === '逆行') result = m.slice().reverse();
  else if (op === '倒影') result = m.map((v) => 12 - v);
  else result = [...m.slice(1), m[0]];
  return {
    worldId: 5,
    worldName: WORLD_NAMES[4],
    text: `动机 [${m.join(',')}] 经过「${op}」后变为？`,
    correctAnswer: result.join(','),
    options: [result.join(','), m.slice().reverse().join(','), m.map((v) => (v + 2) % 12).join(','), m.join(',')],
    inputType: 'choice',
    hint: `${op}：${op === '逆行' ? '从后往前排列' : op === '倒影' ? '以6为轴映射' : '把第一个音移到最后'}`,
    points: 5 + round,
  };
}

function generateWorld6Question(round: number): EndlessQuestion {
  const k = randomInt(2, 8);
  const n = randomInt(k + 2, 16);
  const pattern = euclideanRhythm(k, n);
  const count = pattern.filter((v) => v === 1).length;
  return {
    worldId: 6,
    worldName: WORLD_NAMES[5],
    text: `Euclidean 节奏 E(${k}, ${n}) 有多少个脉冲？`,
    correctAnswer: count,
    inputType: 'number',
    hint: `E(${k}, ${n}) = [${pattern.join('')}]，共 ${count} 个脉冲`,
    points: 3 + Math.floor(n / 3),
  };
}

function generateWorld7Question(round: number): EndlessQuestion {
  const p = randomInt(30, 80);
  const steps = randomInt(8, 16);
  const expected = Math.round((steps * p) / 100);
  return {
    worldId: 7,
    worldName: WORLD_NAMES[6],
    text: `${steps} 步节奏，每步以 ${p}% 概率填充，期望有多少个音符？`,
    correctAnswer: expected,
    inputType: 'number',
    hint: `${steps} × ${p}% = ${(steps * p) / 100}，四舍五入 = ${expected}`,
    points: 3 + round,
  };
}

function generateWorld8Question(round: number): EndlessQuestion {
  const chords = ['I', 'IV', 'V', 'vi'];
  const start = chords[randomInt(0, chords.length - 1)];
  const end = chords[randomInt(0, chords.length - 1)];
  const paths = [
    [start, end],
    [start, 'IV', end],
    [start, 'V', end],
    [start, 'vi', 'IV', end],
  ];
  const path = paths[randomInt(0, paths.length - 1)];
  return {
    worldId: 8,
    worldName: WORLD_NAMES[7],
    text: `从 ${start} 到 ${end} 的最短路径经过几个和弦？`,
    correctAnswer: path.length,
    inputType: 'number',
    hint: `一条可行路径：${path.join(' → ')}，共 ${path.length} 个和弦`,
    points: 4 + round,
  };
}

function isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}

function generatePrimeQuestion(round: number): EndlessQuestion {
  const n = randomInt(10 + round, 60 + round * 2);
  const answer = isPrime(n) ? '是' : '否';
  return {
    worldId: 3,
    worldName: WORLD_NAMES[2],
    text: `${n} 是质数吗？`,
    correctAnswer: answer,
    options: ['是', '否'],
    inputType: 'choice',
    hint: '质数只能被 1 和自身整除',
    points: 3 + round,
  };
}

function generateOctaveQuestion(round: number): EndlessQuestion {
  const octaves = randomInt(1, 3);
  const base = randomInt(220, 880);
  const target = Math.round(base * Math.pow(2, octaves));
  return {
    worldId: 3,
    worldName: WORLD_NAMES[2],
    text: `${base}Hz 向上移 ${octaves} 个八度后的频率是多少？`,
    correctAnswer: target,
    inputType: 'number',
    hint: `每高一个八度频率 ×2，${base} × 2^${octaves} = ${target}`,
    points: 4 + round,
  };
}

/* ===== MAIN GENERATOR ===== */
export function generateQuestion(round: number): EndlessQuestion {
  if (round > 3 && Math.random() < 0.25) return generatePrimeQuestion(round);
  if (round > 5 && Math.random() < 0.25) return generateOctaveQuestion(round);
  const worldId = pickRandomWorld();
  switch (worldId) {
    case 1:
      return generateWorld1Question(round);
    case 2:
      return generateWorld2Question(round);
    case 3:
      return generateWorld3Question(round);
    case 4:
      return generateWorld4Question(round);
    case 5:
      return generateWorld5Question(round);
    case 6:
      return generateWorld6Question(round);
    case 7:
      return generateWorld7Question(round);
    case 8:
      return generateWorld8Question(round);
    default:
      return generateWorld1Question(round);
  }
}

/* ===== MELODY BUILDER ===== */
const SCALE_DEGREES = [60, 62, 64, 65, 67, 69, 71]; // C major scale MIDI

function addMelodyNote(correct: boolean): void {
  if (!correct) return;
  const note = SCALE_DEGREES[randomInt(0, SCALE_DEGREES.length - 1)];
  endlessState.melody.push(note);
  if (endlessState.melody.length > 16) endlessState.melody.shift();
  // Play the note immediately as reward
  const ctx = getAudioCtx();
  const t = ctx.currentTime + 0.05;
  scheduleToneAt(midiToFreq(note), 0.3, 'sine', 0.3, t);
  if (endlessState.melody.length % 4 === 0) {
    scheduleKickAt(t + 0.1);
  }
}

export function playMelody(): void {
  if (endlessState.melody.length === 0) return;
  const ctx = getAudioCtx();
  const t = ctx.currentTime + 0.05;
  endlessState.melody.forEach((note, i) => {
    scheduleToneAt(midiToFreq(note), 0.25, 'sine', 0.25, t + i * 0.3);
    if (i % 4 === 0) scheduleKickAt(t + i * 0.3);
  });
}

/* ===== MODE SELECTION & INIT ===== */
export interface EndlessConfig {
  timeLimit: number; // 0, 60, 120
  focusedWorld: number; // 0 = all, 1-8
}

export function initEndlessMode(e?: EndlessConfig | Event, ...args: unknown[]): void {
  const config = e instanceof Event ? undefined : e;
  const cfg = config || { timeLimit: 0, focusedWorld: 0 };
  endlessState = {
    round: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    correctCount: 0,
    totalCount: 0,
    currentQuestion: null,
    melody: [],
    isPlaying: true,
    timeLimit: cfg.timeLimit,
    timeRemaining: cfg.timeLimit,
    focusedWorld: cfg.focusedWorld,
    timerId: null,
    nextRoundTimer: null,
    startTime: Date.now(),
  };
  if (cfg.timeLimit > 0) {
    endlessState.timerId = setInterval(() => {
      if (!endlessState.isPlaying) return;
      endlessState.timeRemaining = Math.max(
        0,
        cfg.timeLimit - Math.floor((Date.now() - endlessState.startTime) / 1000)
      );
      if (endlessState.timeRemaining <= 0) {
        endEndlessMode();
      } else {
        renderTimer();
      }
    }, 1000);
  }
  nextRound();
}

export function generateQuestionFromWorld(worldId: number, round: number): EndlessQuestion {
  switch (worldId) {
    case 1:
      return generateWorld1Question(round);
    case 2:
      return generateWorld2Question(round);
    case 3:
      return generateWorld3Question(round);
    case 4:
      return generateWorld4Question(round);
    case 5:
      return generateWorld5Question(round);
    case 6:
      return generateWorld6Question(round);
    case 7:
      return generateWorld7Question(round);
    case 8:
      return generateWorld8Question(round);
    default:
      return generateWorld1Question(round);
  }
}

export function nextRound(): void {
  if (!endlessState.isPlaying) return;
  endlessState.round++;
  const worldId = endlessState.focusedWorld > 0 ? endlessState.focusedWorld : pickRandomWorld();
  endlessState.currentQuestion = generateQuestionFromWorld(worldId, endlessState.round);
  renderEndlessUI();
}

export function submitAnswer(e: Event | string | number, ...args: unknown[]): void {
  let answer: string | number;
  if (typeof e === 'string' || typeof e === 'number') {
    answer = e;
  } else if (args.length > 0) {
    answer = args[0] as string | number;
  } else {
    answer = (document.getElementById('endlessInput') as HTMLInputElement).value;
  }
  if (!endlessState.currentQuestion || !endlessState.isPlaying) return;
  endlessState.totalCount++;
  const q = endlessState.currentQuestion;
  const correct = String(answer).trim() === String(q.correctAnswer).trim();

  if (correct) {
    endlessState.correctCount++;
    endlessState.combo++;
    endlessState.maxCombo = Math.max(endlessState.maxCombo, endlessState.combo);
    const comboBonus = Math.min(endlessState.combo, 10);
    const points = q.points + comboBonus * 2;
    endlessState.score += points;
    playCorrect();
    addMelodyNote(true);
    showHintFloat(`✅ +${points} 分！连击 x${endlessState.combo}`);
  } else {
    endlessState.combo = 0;
    playWrong();
    showHintFloat(`❌ 正确答案是 ${q.correctAnswer}`);
  }

  renderEndlessUI();
  if (correct) {
    if (endlessState.nextRoundTimer) clearTimeout(endlessState.nextRoundTimer);
    endlessState.nextRoundTimer = setTimeout(() => nextRound(), 1200);
  }
}

export function skipQuestion(): void {
  if (!endlessState.currentQuestion || !endlessState.isPlaying) return;
  endlessState.combo = 0;
  playWrong();
  showHintFloat(`跳过！正确答案是 ${endlessState.currentQuestion.correctAnswer}`);
  if (endlessState.nextRoundTimer) clearTimeout(endlessState.nextRoundTimer);
  endlessState.nextRoundTimer = setTimeout(() => nextRound(), 1000);
}

export function endEndlessMode(): void {
  if (endlessState.timerId) {
    clearInterval(endlessState.timerId);
    endlessState.timerId = null;
  }
  if (endlessState.nextRoundTimer) {
    clearTimeout(endlessState.nextRoundTimer);
    endlessState.nextRoundTimer = null;
  }
  endlessState.isPlaying = false;
  // Save stats
  const stats = Store.state.endlessStats || {
    bestScore: 0,
    totalRounds: 0,
    totalCorrect: 0,
    totalQuestions: 0,
    bestCombo: 0,
  };
  stats.bestScore = Math.max(stats.bestScore, endlessState.score);
  stats.totalRounds += endlessState.round;
  stats.totalCorrect += endlessState.correctCount;
  stats.totalQuestions += endlessState.totalCount;
  stats.bestCombo = Math.max(stats.bestCombo, endlessState.maxCombo);
  Store.state.endlessStats = stats;
  Store.save();
  showEndlessResults();
}

/* ===== UI RENDERING ===== */
function renderEndlessUI(): void {
  const container = document.getElementById('endlessBody');
  if (!container) return;
  const q = endlessState.currentQuestion;
  if (!q) return;

  const emoji = WORLD_EMOJIS[q.worldId - 1];
  const worldColor = [
    'var(--w1)',
    'var(--w2)',
    'var(--w3)',
    'var(--w4)',
    'var(--w5)',
    'var(--w6)',
    'var(--w7)',
    'var(--w8)',
  ][q.worldId - 1];

  let html = `<div class="challenge-card" style="border-left:4px solid ${worldColor}">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div style="font-size:13px;font-weight:700;color:${worldColor}">${emoji} ${q.worldName}</div>
      <div style="display:flex;align-items:center;gap:8px">
        ${endlessState.focusedWorld > 0 ? '<span style="font-size:11px;background:rgba(0,0,0,.06);padding:2px 8px;border-radius:8px">专注</span>' : ''}
        ${endlessState.timeLimit > 0 ? `<span id="endlessTimer" style="font-size:14px;font-weight:800;color:${endlessState.timeRemaining <= 10 ? 'var(--error)' : 'var(--trackA)'}">${endlessState.timeRemaining}s</span>` : ''}
        <span style="font-size:12px;color:var(--dim)">第 ${endlessState.round} 轮</span>
      </div>
    </div>
    <div class="challenge-q" style="font-size:16px">${q.text}</div>`;

  if (q.inputType === 'choice' && q.options) {
    html += `<div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">`;
    q.options.forEach((opt, i) => {
      html += `<button class="ctrl-btn" style="text-align:left;padding:10px 14px;font-size:15px;background:var(--card);border:2px solid #e8e4de" data-action="submitAnswer" data-args='${JSON.stringify([opt])}'>${String.fromCharCode(65 + i)}. ${opt}</button>`;
    });
    html += `</div>`;
  } else {
    html += `<div class="challenge-input-row" style="margin-top:12px">
      <input class="challenge-input" id="endlessInput" type="text" placeholder="输入答案" onkeydown="if(event.key==='Enter')submitAnswer(document.getElementById('endlessInput').value)">
      <button class="verify-btn" data-action="submitAnswer">提交</button>
    </div>`;
  }

  html += `<div style="margin-top:10px;display:flex;gap:8px">
    <button class="ctrl-btn" style="font-size:12px" data-action="showEndlessHint">💡 提示</button>
    <button class="ctrl-btn" style="font-size:12px;background:var(--dim);color:#fff" data-action="skipQuestion">跳过</button>
    ${endlessState.timeLimit === 0 ? '<button class="ctrl-btn" style="font-size:12px;background:var(--error);color:#fff" data-action="endEndlessMode">结束</button>' : ''}
  </div>`;

  if (endlessState.melody.length > 0) {
    html += `<div style="margin-top:12px">
      <div style="font-size:12px;font-weight:700;color:var(--dim);margin-bottom:4px">🎵 你的旋律（${endlessState.melody.length} 音符）</div>
      <button class="ctrl-btn" style="font-size:12px" data-action="playMelody">▶ 播放旋律</button>
    </div>`;
  }

  html += `</div>
  <div style="display:flex;gap:10px;margin-top:10px">
    <div class="challenge-card" style="flex:1;text-align:center">
      <div style="font-size:24px;font-weight:900;color:var(--trackA)">${endlessState.score}</div>
      <div style="font-size:11px;color:var(--dim)">得分</div>
    </div>
    <div class="challenge-card" style="flex:1;text-align:center">
      <div style="font-size:24px;font-weight:900;color:var(--trackB)">${endlessState.combo}</div>
      <div style="font-size:11px;color:var(--dim)">连击</div>
    </div>
    <div class="challenge-card" style="flex:1;text-align:center">
      <div style="font-size:24px;font-weight:900;color:var(--success)">${endlessState.correctCount}/${endlessState.totalCount}</div>
      <div style="font-size:11px;color:var(--dim)">正确率</div>
    </div>
  </div>`;

  container.innerHTML = html;

  // Focus input
  setTimeout(() => {
    const input = document.getElementById('endlessInput') as HTMLInputElement;
    if (input) input.focus();
  }, 50);
}

function showEndlessResults(): void {
  const container = document.getElementById('endlessBody');
  if (!container) return;
  const stats = Store.state.endlessStats || {
    bestScore: 0,
    totalRounds: 0,
    totalCorrect: 0,
    totalQuestions: 0,
    bestCombo: 0,
  };
  const accuracy =
    endlessState.totalCount > 0 ? Math.round((endlessState.correctCount / endlessState.totalCount) * 100) : 0;

  let html = `<div class="challenge-card" style="text-align:center">
    <div style="font-size:32px;font-weight:900;color:var(--trackA)">${endlessState.score}</div>
    <div style="font-size:14px;color:var(--dim);margin-bottom:12px">最终得分</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div style="background:rgba(0,0,0,.03);border-radius:10px;padding:10px">
        <div style="font-size:20px;font-weight:800">${endlessState.round}</div>
        <div style="font-size:11px;color:var(--dim)">总轮数</div>
      </div>
      <div style="background:rgba(0,0,0,.03);border-radius:10px;padding:10px">
        <div style="font-size:20px;font-weight:800">${accuracy}%</div>
        <div style="font-size:11px;color:var(--dim)">正确率</div>
      </div>
      <div style="background:rgba(0,0,0,.03);border-radius:10px;padding:10px">
        <div style="font-size:20px;font-weight:800">${endlessState.maxCombo}</div>
        <div style="font-size:11px;color:var(--dim)">最大连击</div>
      </div>
      <div style="background:rgba(0,0,0,.03);border-radius:10px;padding:10px">
        <div style="font-size:20px;font-weight:800">${endlessState.melody.length}</div>
        <div style="font-size:11px;color:var(--dim)">旋律音符</div>
      </div>
    </div>
    <div style="font-size:13px;color:var(--dim);margin-bottom:12px">历史最佳: ${stats.bestScore} 分 | 历史最高连击: ${stats.bestCombo}</div>
    <div style="display:flex;gap:10px;justify-content:center">
      <button class="verify-btn" data-action="initEndlessMode">再来一次</button>
      <button class="ctrl-btn" data-action="closeEndlessMode">返回主页</button>
    </div>
  </div>`;

  if (endlessState.melody.length > 0) {
    html += `<div class="challenge-card" style="margin-top:10px">
      <div style="font-size:14px;font-weight:700;margin-bottom:8px">🎵 本次创作的旋律</div>
      <button class="ctrl-btn" style="margin-bottom:8px" data-action="playMelody">▶ 播放旋律</button>
      <div style="font-size:12px;color:var(--dim)">每答对一题，都会为旋律添加一个音符</div>
    </div>`;
  }

  container.innerHTML = html;
}

export function showEndlessHint(): void {
  if (!endlessState.currentQuestion) return;
  showHintFloat('💡 ' + endlessState.currentQuestion.hint);
}

function renderTimer(): void {
  const el = document.getElementById('endlessTimer');
  if (!el) return;
  el.textContent = endlessState.timeRemaining + 's';
  el.style.color = endlessState.timeRemaining <= 10 ? 'var(--error)' : 'var(--trackA)';
}

export function getEndlessState(): EndlessState {
  return endlessState;
}
/* ===== EXPOSE GLOBALS ===== */
registerActions({ submitAnswer, showEndlessHint, skipQuestion, endEndlessMode, playMelody, initEndlessMode, closeEndlessMode });
// Keep window exposure for backwards compat
Object.assign(window as any, {
  endEndlessMode: endEndlessMode,
  generateQuestion: generateQuestion,
  generateQuestionFromWorld: generateQuestionFromWorld,
  getEndlessState: getEndlessState,
  initEndlessMode: initEndlessMode,
  nextRound: nextRound,
  playMelody: playMelody,
  showEndlessHint: showEndlessHint,
  skipQuestion: skipQuestion,
  submitAnswer: submitAnswer,
});
