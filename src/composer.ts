import { localGet, localSet, localRemove } from './storage';
import { Store } from './store';
import { getAudioCtx, scheduleToneAt } from './audio';
import { t } from './i18n';
import { showToast } from './ui-feedback';
import { checkAchievements } from './game-engine';
import { euclideanRhythm, genCellular, genMarkov, genCounterpoint } from './utils';

// ============================================================
// 类型定义 — 轨道与段落结构
// ============================================================
interface DrumTrack {
  kick: number[];
  snare: number[];
  hihat: number[];
  volume: number;
  muted: boolean;
  soloed: boolean;
  patternLen: number;
}
interface PitchTrack {
  pattern: number[];
  pitches: number[];
  octave: number;
  volume: number;
  muted: boolean;
  soloed: boolean;
  patternLen: number;
}
interface ChordTrack {
  pattern: number[];
  chordDegs: number[];
  octave: number;
  volume: number;
  muted: boolean;
  soloed: boolean;
  patternLen: number;
}
interface Section {
  name: string;
  cnName?: string;
  bars: number;
  tsNum: number;
  tsDen: number;
  bpm: number;
  drums: DrumTrack;
  bass: PitchTrack;
  melody: PitchTrack;
  chords: ChordTrack;
}
interface Composition {
  root: string;
  scale: string;
  sections: Section[];
}

// ============================================================
// 解锁系统
// ============================================================
const DEFAULT_UNLOCKS = {
  drums: true,
  bass: false,
  melody: false,
  chords: false,
  euclidean: true,
  modular: false,
  prime: false,
  fibonacci: false,
  symmetry: false,
  recursive: false,
  cellular: false,
  markov: false,
  counterpoint: false,
};
const UNLOCK_WORLDS = {
  bass: 2,
  melody: 3,
  chords: 4,
  modular: 2,
  prime: 3,
  fibonacci: 3,
  symmetry: 4,
  recursive: 5,
  cellular: 6,
  markov: 7,
  counterpoint: 8,
};
const WORLD_COLORS = { 1: '#FF8C42', 2: '#E8587A', 3: '#7C6BFF', 4: '#4ECDC4', 5: '#FFD166', 6: '#7BC67E' };
const WORLD_NAMES = { 1: '世界1', 2: '世界2', 3: '世界3', 4: '世界4', 5: '世界5', 6: '世界6' };

function getUnlocks() {
  const r = localGet<Record<string, boolean>>('mathbeat_unlocks');
  if (r) return Object.assign({}, DEFAULT_UNLOCKS, r);
  return Object.assign({}, DEFAULT_UNLOCKS);
}
const unlocks = getUnlocks();
function isTrackUnlocked(k: string) {
  return !!unlocks[k as keyof typeof unlocks];
}
function isGeneratorUnlocked(k: string) {
  return !!unlocks[k as keyof typeof unlocks];
}
function getUnlockWorld(k: string) {
  return UNLOCK_WORLDS[k as keyof typeof UNLOCK_WORLDS] || 0;
}

// ============================================================
// 音阶定义
// ============================================================
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  pentatonic: [0, 2, 4, 7, 9],
  wholetone: [0, 2, 4, 6, 8, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const ROOT_SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function getScaleNotes(root: string, scaleType: string) {
  const rs = ROOT_SEMITONES[root as keyof typeof ROOT_SEMITONES] || 0;
  return (SCALES[scaleType as keyof typeof SCALES] || SCALES.minor).map((i) => (rs + i) % 12);
}
function midiToFreq(m: number) {
  return 440 * Math.pow(2, (m - 69) / 12);
}
function scaleDegreeToMidi(root: string, scaleType: string, octave: number, degree: number) {
  const iv = SCALES[scaleType as keyof typeof SCALES] || SCALES.minor;
  const rs = ROOT_SEMITONES[root as keyof typeof ROOT_SEMITONES] || 0;
  const d = (((degree - 1) % iv.length) + iv.length) % iv.length;
  const os = Math.floor((degree - 1) / iv.length);
  return 12 * (octave + 4) + rs + iv[d] + os * 12;
}

// Return the semitone offsets for a diatonic triad built on `degree`
// (1-based) within `scaleType`. For a 7-note scale this yields the
// natural major/minor/diminished triads; for other scales it follows the
// scale step spacing.
function getDiatonicChordOffsets(scaleType: string, degree: number): number[] {
  const iv = SCALES[scaleType as keyof typeof SCALES] || SCALES.minor;
  const rootIndex = (((degree - 1) % iv.length) + iv.length) % iv.length;
  const rootOffset = iv[rootIndex];
  const offsets: number[] = [];
  for (let i = 0; i < 3; i++) {
    const idx = rootIndex + i;
    const oct = Math.floor(idx / iv.length);
    const note = iv[idx % iv.length] + oct * 12;
    offsets.push(note - rootOffset);
  }
  return offsets;
}

// ============================================================
// 数学生成器
// ============================================================
function fibSequence(n: number) {
  const f = [1, 1];
  while (f[f.length - 1] + f[f.length - 2] < n) f.push(f[f.length - 1] + f[f.length - 2]);
  return f;
}
function genFibonacci(len: number) {
  const p = new Array(len).fill(0);
  for (const f of fibSequence(len)) if (f < len) p[f] = 1;
  return p;
}
function genPrime(len: number) {
  const p = new Array(len).fill(0);
  function isP(n: number) {
    if (n < 2) return false;
    for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
    return true;
  }
  for (let i = 0; i < len; i++) if (isP(i)) p[i] = 1;
  return p;
}
function genSymmetry(len: number) {
  const h = Math.ceil(len / 2),
    hp: number[] = [];
  for (let i = 0; i < h; i++) hp.push(Math.random() > 0.5 ? 1 : 0);
  const p = [...hp];
  for (let i = len - 1; i >= h; i--) p.push(hp[len - 1 - i] || 0);
  return p.slice(0, len);
}
function genModular(len: number, m: number) {
  const p = new Array(len).fill(0);
  for (let i = 0; i < len; i++) if (i % m === 0) p[i] = 1;
  return p;
}
function genRecursive(len: number, motif: number[], depth?: number) {
  depth = depth || 2;
  let p = motif.slice();
  for (let d = 0; d < depth; d++) {
    if (p.length >= len) break;
    const n: number[] = [];
    for (const v of p) {
      if (v === 1) n.push(...motif);
      else n.push(...new Array(motif.length).fill(0));
    }
    p = n;
  }
  return p.slice(0, len);
}
function genFibonacciMelody(len: number, root: string, scaleType: string) {
  const iv = SCALES[scaleType as keyof typeof SCALES] || SCALES.minor,
    fibs = fibSequence(len * 2),
    p: number[] = [];
  for (let i = 0; i < len; i++) p.push((fibs[i % fibs.length] % iv.length) + 1);
  return p;
}
function genSymmetricMelody(len: number, root: string, scaleType: string) {
  const iv = SCALES[scaleType as keyof typeof SCALES] || SCALES.minor,
    h = Math.ceil(len / 2),
    hp: number[] = [];
  for (let i = 0; i < h; i++) hp.push(Math.floor(Math.random() * iv.length) + 1);
  const p = [...hp];
  for (let i = len - 1; i >= h; i--) p.push(hp[len - 1 - i] || 1);
  return p.slice(0, len);
}
function genSerialMelody(len: number) {
  const row: number[] = [];
  for (let i = 0; i < 12; i++) row.push(i);
  for (let i = 11; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [row[i], row[j]] = [row[j], row[i]];
  }
  const p: number[] = [];
  for (let i = 0; i < len; i++) p.push((row[i % 12] % 7) + 1);
  return p;
}

// ============================================================
// 歌曲结构定义
// ============================================================
const SONG_SECTIONS = [
  { name: 'Intro', cnName: '前奏', bars: 8, tsNum: 4, tsDen: 4, bpm: 100 },
  { name: 'Verse A', cnName: '段落A', bars: 16, tsNum: 5, tsDen: 4, bpm: 110 },
  { name: 'Chorus', cnName: '副歌', bars: 16, tsNum: 7, tsDen: 8, bpm: 120 },
  { name: 'Verse B', cnName: '段落B', bars: 16, tsNum: 5, tsDen: 4, bpm: 110 },
  { name: 'Bridge', cnName: '桥段', bars: 8, tsNum: 11, tsDen: 8, bpm: 100 },
  { name: 'Chorus 2', cnName: '副歌2', bars: 16, tsNum: 7, tsDen: 8, bpm: 125 },
  { name: 'Outro', cnName: '尾声', bars: 8, tsNum: 4, tsDen: 4, bpm: 100 },
];
function getSectionStepCount(sec: Section) {
  return sec.bars * sec.tsNum;
}
function getStepDuration(sec: Section) {
  return 60.0 / sec.bpm / 2;
}
function getSectionDuration(sec: Section) {
  return getSectionStepCount(sec) * getStepDuration(sec);
}

// ============================================================
// 预作曲数据 — "质数之旅"
// ============================================================
function buildDefaultComposition() {
  const comp: Composition = { root: 'E', scale: 'minor', sections: [] };

  // 前奏 4/4 100BPM 8bars=32步
  comp.sections.push({
    name: '前奏',
    bars: 8,
    tsNum: 4,
    tsDen: 4,
    bpm: 100,
    drums: {
      kick: euclideanRhythm(3, 8).concat(euclideanRhythm(3, 8)).concat(euclideanRhythm(3, 8)).concat(euclideanRhythm(3, 8)),
      snare: new Array(32).fill(0),
      hihat: euclideanRhythm(3, 8).concat(euclideanRhythm(3, 8)).concat(euclideanRhythm(3, 8)).concat(euclideanRhythm(3, 8)),
      volume: 0.8,
      muted: false,
      soloed: false,
      patternLen: 32,
    },
    bass: {
      pattern: genFibonacci(32),
      pitches: genFibonacciMelody(32, 'E', 'pentatonic'),
      octave: 2,
      volume: 0.7,
      muted: false,
      soloed: false,
      patternLen: 32,
    },
    melody: {
      pattern: new Array(32).fill(0),
      pitches: new Array(32).fill(1),
      octave: 4,
      volume: 0.6,
      muted: false,
      soloed: false,
      patternLen: 32,
    },
    chords: {
      pattern: new Array(32).fill(0),
      chordDegs: new Array(32).fill(1),
      octave: 3,
      volume: 0.5,
      muted: false,
      soloed: false,
      patternLen: 32,
    },
  });

  // 段落A 5/4 110BPM 16bars=80步
  const vaSteps = 80,
    vaKick = new Array(vaSteps).fill(0),
    vaSnare = new Array(vaSteps).fill(0);
  for (let b = 0; b < 16; b++) {
    vaKick[b * 5] = 1;
    vaKick[b * 5 + 3] = 1;
    vaSnare[b * 5 + 1] = 1;
    vaSnare[b * 5 + 4] = 1;
  }
  const vaHh = euclideanRhythm(7, 10),
    vaHhF: number[] = [];
  for (let i = 0; i < 8; i++) vaHhF.push(...vaHh);
  comp.sections.push({
    name: '段落A',
    bars: 16,
    tsNum: 5,
    tsDen: 4,
    bpm: 110,
    drums: {
      kick: vaKick,
      snare: vaSnare,
      hihat: vaHhF.slice(0, vaSteps),
      volume: 0.85,
      muted: false,
      soloed: false,
      patternLen: 80,
    },
    bass: {
      pattern: genPrime(vaSteps),
      pitches: genFibonacciMelody(vaSteps, 'E', 'dorian'),
      octave: 2,
      volume: 0.7,
      muted: false,
      soloed: false,
      patternLen: 80,
    },
    melody: {
      pattern: genSymmetry(40).concat(genSymmetry(40)),
      pitches: genSymmetricMelody(vaSteps, 'E', 'dorian'),
      octave: 4,
      volume: 0.6,
      muted: false,
      soloed: false,
      patternLen: 80,
    },
    chords: {
      pattern: new Array(vaSteps).fill(0),
      chordDegs: new Array(vaSteps).fill(1),
      octave: 3,
      volume: 0.5,
      muted: false,
      soloed: false,
      patternLen: 80,
    },
  });

  // 副歌 7/8 120BPM 16bars=112步
  const chSteps = 112,
    chKick = euclideanRhythm(3, 7),
    chSnare = euclideanRhythm(2, 7),
    chKF: number[] = [],
    chSF: number[] = [],
    chHF: number[] = [];
  for (let i = 0; i < 16; i++) {
    chKF.push(...chKick);
    chSF.push(...chSnare);
    chHF.push(...new Array(7).fill(1));
  }
  comp.sections.push({
    name: '副歌',
    bars: 16,
    tsNum: 7,
    tsDen: 8,
    bpm: 120,
    drums: {
      kick: chKF.slice(0, chSteps),
      snare: chSF.slice(0, chSteps),
      hihat: chHF.slice(0, chSteps),
      volume: 0.9,
      muted: false,
      soloed: false,
      patternLen: 112,
    },
    bass: {
      pattern: (function () {
        const r: number[] = [];
        for (let i = 0; i < 16; i++) r.push(...genRecursive(7, [1, 0, 1], 2));
        return r.slice(0, chSteps);
      })(),
      pitches: genFibonacciMelody(chSteps, 'E', 'minor'),
      octave: 2,
      volume: 0.75,
      muted: false,
      soloed: false,
      patternLen: 112,
    },
    melody: {
      pattern: genFibonacci(chSteps),
      pitches: genFibonacciMelody(chSteps, 'E', 'minor'),
      octave: 4,
      volume: 0.65,
      muted: false,
      soloed: false,
      patternLen: 112,
    },
    chords: {
      pattern: new Array(chSteps).fill(0),
      chordDegs: new Array(chSteps).fill(1),
      octave: 3,
      volume: 0.5,
      muted: false,
      soloed: false,
      patternLen: 112,
    },
  });
  const chPat = comp.sections[2].chords.pattern,
    chDeg = comp.sections[2].chords.chordDegs;
  for (let b = 0; b < 16; b++) {
    const ci = b % 4,
      ds = [1, 4, 3, 2];
    for (let s = 0; s < 7; s++) {
      if (b * 7 + s < chSteps) {
        chPat[b * 7 + s] = s === 0 ? 1 : 0;
        chDeg[b * 7 + s] = ds[ci];
      }
    }
  }

  // 段落B 5/4 110BPM 16bars=80步
  comp.sections.push({
    name: '段落B',
    bars: 16,
    tsNum: 5,
    tsDen: 4,
    bpm: 110,
    drums: {
      kick: vaKick.slice(),
      snare: vaSnare.slice(),
      hihat: vaHhF.slice(0, vaSteps),
      volume: 0.85,
      muted: false,
      soloed: false,
      patternLen: 80,
    },
    bass: {
      pattern: genPrime(vaSteps),
      pitches: genFibonacciMelody(vaSteps, 'E', 'dorian'),
      octave: 2,
      volume: 0.7,
      muted: false,
      soloed: false,
      patternLen: 80,
    },
    melody: {
      pattern: genSymmetry(40).concat(genSymmetry(40)),
      pitches: genSymmetricMelody(vaSteps, 'E', 'dorian'),
      octave: 4,
      volume: 0.6,
      muted: false,
      soloed: false,
      patternLen: 80,
    },
    chords: {
      pattern: new Array(vaSteps).fill(0),
      chordDegs: new Array(vaSteps).fill(1),
      octave: 3,
      volume: 0.5,
      muted: false,
      soloed: false,
      patternLen: 80,
    },
  });
  const vbPat = comp.sections[3].chords.pattern,
    vbDeg = comp.sections[3].chords.chordDegs;
  for (let b = 0; b < 16; b++) {
    const ci = b % 4,
      ds = [1, 5, 6, 4];
    for (let s = 0; s < 5; s++) {
      if (b * 5 + s < vaSteps) {
        vbPat[b * 5 + s] = s === 0 ? 1 : 0;
        vbDeg[b * 5 + s] = ds[ci];
      }
    }
  }

  // 桥段 11/8 100BPM 8bars=88步
  const brSteps = 88;
  comp.sections.push({
    name: '桥段',
    bars: 8,
    tsNum: 11,
    tsDen: 8,
    bpm: 100,
    drums: {
      kick: (function () {
        const r: number[] = [];
        for (let i = 0; i < 8; i++) r.push(...euclideanRhythm(5, 11));
        return r.slice(0, brSteps);
      })(),
      snare: (function () {
        const r: number[] = [];
        for (let i = 0; i < 8; i++) r.push(...euclideanRhythm(3, 11));
        return r.slice(0, brSteps);
      })(),
      hihat: new Array(brSteps).fill(1),
      volume: 0.8,
      muted: false,
      soloed: false,
      patternLen: 88,
    },
    bass: {
      pattern: genPrime(brSteps),
      pitches: genSerialMelody(brSteps),
      octave: 2,
      volume: 0.7,
      muted: false,
      soloed: false,
      patternLen: 88,
    },
    melody: {
      pattern: genPrime(brSteps),
      pitches: genFibonacciMelody(brSteps, 'E', 'wholetone'),
      octave: 4,
      volume: 0.6,
      muted: false,
      soloed: false,
      patternLen: 88,
    },
    chords: {
      pattern: genModular(brSteps, 11),
      chordDegs: new Array(brSteps).fill(1),
      octave: 3,
      volume: 0.5,
      muted: false,
      soloed: false,
      patternLen: 88,
    },
  });

  // 副歌2 7/8 125BPM 16bars=112步
  comp.sections.push({
    name: '副歌2',
    bars: 16,
    tsNum: 7,
    tsDen: 8,
    bpm: 125,
    drums: {
      kick: chKF.slice(0, chSteps),
      snare: chSF.slice(0, chSteps),
      hihat: chHF.slice(0, chSteps),
      volume: 0.95,
      muted: false,
      soloed: false,
      patternLen: 112,
    },
    bass: {
      pattern: (function () {
        const r: number[] = [];
        for (let i = 0; i < 16; i++) r.push(...genRecursive(7, [1, 0, 1], 2));
        return r.slice(0, chSteps);
      })(),
      pitches: genFibonacciMelody(chSteps, 'E', 'minor'),
      octave: 2,
      volume: 0.8,
      muted: false,
      soloed: false,
      patternLen: 112,
    },
    melody: {
      pattern: genFibonacci(chSteps),
      pitches: genFibonacciMelody(chSteps, 'E', 'minor'),
      octave: 4,
      volume: 0.7,
      muted: false,
      soloed: false,
      patternLen: 112,
    },
    chords: {
      pattern: new Array(chSteps).fill(0),
      chordDegs: new Array(chSteps).fill(1),
      octave: 3,
      volume: 0.55,
      muted: false,
      soloed: false,
      patternLen: 112,
    },
  });
  const ch2Pat = comp.sections[5].chords.pattern,
    ch2Deg = comp.sections[5].chords.chordDegs;
  for (let b = 0; b < 16; b++) {
    const ci = b % 4,
      ds = [1, 4, 3, 2];
    for (let s = 0; s < 7; s++) {
      if (b * 7 + s < chSteps) {
        ch2Pat[b * 7 + s] = s === 0 ? 1 : 0;
        ch2Deg[b * 7 + s] = ds[ci];
      }
    }
  }

  // 尾声 4/4 100BPM 8bars=32步
  comp.sections.push({
    name: '尾声',
    bars: 8,
    tsNum: 4,
    tsDen: 4,
    bpm: 100,
    drums: {
      kick: euclideanRhythm(3, 8).concat(euclideanRhythm(3, 8)).concat(euclideanRhythm(2, 8)).concat(euclideanRhythm(1, 8)),
      snare: new Array(32).fill(0),
      hihat: euclideanRhythm(3, 8).concat(euclideanRhythm(2, 8)).concat(euclideanRhythm(1, 8)).concat(new Array(8).fill(0)),
      volume: 0.6,
      muted: false,
      soloed: false,
      patternLen: 32,
    },
    bass: {
      pattern: genFibonacci(32),
      pitches: genFibonacciMelody(32, 'E', 'pentatonic'),
      octave: 2,
      volume: 0.5,
      muted: false,
      soloed: false,
      patternLen: 32,
    },
    melody: {
      pattern: genSymmetry(32),
      pitches: genSymmetricMelody(32, 'E', 'minor'),
      octave: 4,
      volume: 0.5,
      muted: false,
      soloed: false,
      patternLen: 32,
    },
    chords: {
      pattern: new Array(32).fill(0),
      chordDegs: new Array(32).fill(1),
      octave: 3,
      volume: 0.4,
      muted: false,
      soloed: false,
      patternLen: 32,
    },
  });

  return comp;
}

// ============================================================
// 全局状态
// ============================================================
let composition: Composition = buildDefaultComposition();
let currentSectionIdx = 0;
let isPlaying = false;
let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let compressor: DynamicsCompressorNode | null = null;
let currentStep = 0;
let globalStep = 0;
let startTime = 0;
let nextStepTime = 0;
let soloActive = false;
let useWorklet = false;
let workletNode: AudioWorkletNode | null = null;
let bgMusicPlaying = false;
let bgOsc: OscillatorNode | null = null;
let bgGain: GainNode | null = null;

// Canvas 引用
let trackCanvases: Record<string, any> = {};

// ============================================================
// 音频引擎初始化
// ============================================================
function initAudio() {
  if (audioCtx) return;
  audioCtx = getAudioCtx();

  compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -12;
  compressor.knee.value = 10;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.1;
  compressor.connect(audioCtx.destination);

  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.8;
  masterGain.connect(compressor);

  initWorklet();
}

// ============================================================
// AudioWorklet 调度器
// ============================================================
function initWorklet() {
  if (!audioCtx) return;
  try {
    const workletCode = `
      class PreciseScheduler extends AudioWorkletProcessor {
        constructor(){super();this.running=false;this.step=0;this.nextTime=0;this.stepDur=0;this.port.onmessage=e=>{
          if(e.data.cmd==='start'){this.running=true;this.step=0;this.nextTime=currentTime+0.05;this.stepDur=e.data.stepDur||0.3}
          else if(e.data.cmd==='stop'){this.running=false;this.step=0}
          else if(e.data.cmd==='stepDur'){this.stepDur=e.data.stepDur||0.3}
        }}
        process(inputs,outputs){
          if(!this.running)return true;
          while(this.nextTime<currentTime+0.1){
            this.port.postMessage({step:this.step,time:this.nextTime});
            this.nextTime+=this.stepDur;
            this.step++;
          }
          return true;
        }
      }
      registerProcessor('precise-scheduler',PreciseScheduler);
    `;
    const blob = new Blob([workletCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    audioCtx.audioWorklet
      .addModule(url)
      .then(() => {
        useWorklet = true;
        URL.revokeObjectURL(url);
      })
      .catch(() => {
        useWorklet = false;
      });
  } catch (e) {
    useWorklet = false;
  }
}

function createWorkletNode(stepDur: number) {
  if (!audioCtx) return null;
  if (workletNode) {
    try {
      workletNode.disconnect();
    } catch (e) {}
  }
  workletNode = new AudioWorkletNode(audioCtx, 'precise-scheduler');
  workletNode.port.onmessage = function (e) {
    if (e.data && e.data.step !== undefined) {
      scheduleStep(e.data.step, e.data.time);
      advanceSection();
    }
  };
  workletNode.port.postMessage({ cmd: 'start', stepDur: stepDur });
  workletNode.connect(audioCtx.destination);
  return workletNode;
}

// ============================================================
// 合成器 — 鼓组（始终使用 Web Audio 合成）
// ============================================================
function synthKick(time: number) {
  if (!audioCtx || !masterGain) return;
  const osc = audioCtx.createOscillator(),
    gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, time);
  osc.frequency.exponentialRampToValueAtTime(60, time + 0.05);
  gain.gain.setValueAtTime(0.8, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(time);
  osc.stop(time + 0.3);
}
function synthSnare(time: number) {
  if (!audioCtx || !masterGain) return;
  const bs = audioCtx.sampleRate * 0.15,
    buf = audioCtx.createBuffer(1, bs, audioCtx.sampleRate),
    data = buf.getChannelData(0);
  for (let i = 0; i < bs; i++) data[i] = Math.random() * 2 - 1;
  const n = audioCtx.createBufferSource();
  n.buffer = buf;
  const nf = audioCtx.createBiquadFilter();
  nf.type = 'bandpass';
  nf.frequency.value = 1000;
  nf.Q.value = 0.5;
  const ng = audioCtx.createGain();
  ng.gain.setValueAtTime(0.6, time);
  ng.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
  n.connect(nf);
  nf.connect(ng);
  ng.connect(masterGain);
  n.start(time);
  n.stop(time + 0.15);
  const osc = audioCtx.createOscillator(),
    og = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 200;
  og.gain.setValueAtTime(0.4, time);
  og.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
  osc.connect(og);
  og.connect(masterGain);
  osc.start(time);
  osc.stop(time + 0.08);
}
function synthHihat(time: number) {
  if (!audioCtx || !masterGain) return;
  const bs = audioCtx.sampleRate * 0.05,
    buf = audioCtx.createBuffer(1, bs, audioCtx.sampleRate),
    data = buf.getChannelData(0);
  for (let i = 0; i < bs; i++) data[i] = Math.random() * 2 - 1;
  const n = audioCtx.createBufferSource();
  n.buffer = buf;
  const f = audioCtx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 8000;
  f.Q.value = 1;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.3, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  n.connect(f);
  f.connect(g);
  g.connect(masterGain);
  n.start(time);
  n.stop(time + 0.05);
}

// ============================================================
// 播放调度
// ============================================================
const SCHEDULE_AHEAD = 0.1;
const LOOK_AHEAD = 25;
let schedulerTimer: ReturnType<typeof setInterval> | null = null;

function scheduleStep(stepIdx: number, time: number) {
  if (Store.state.settings.sfx === false) return;
  const sec = composition.sections[currentSectionIdx];
  const stepCount = getSectionStepCount(sec);
  const localStep = stepIdx % stepCount;
  const stepDur = getStepDuration(sec);
  const root = composition.root,
    scaleType = composition.scale;

  soloActive = false;
  const tk = ['drums', 'bass', 'melody', 'chords'] as const;
  for (const t of tk) if (sec[t] && sec[t].soloed) soloActive = true;

  if (sec.drums && shouldPlay(sec.drums)) {
    if (sec.drums.kick && sec.drums.kick[localStep]) synthKick(time);
    if (sec.drums.snare && sec.drums.snare[localStep]) synthSnare(time);
    if (sec.drums.hihat && sec.drums.hihat[localStep]) synthHihat(time);
  }
  if (isTrackUnlocked('bass') && sec.bass && shouldPlay(sec.bass)) {
    if (sec.bass.pattern[localStep]) {
      const deg = sec.bass.pitches[localStep] || 1;
      const freq = midiToFreq(scaleDegreeToMidi(root, scaleType, sec.bass.octave || 2, deg));
      scheduleToneAt(freq, stepDur * 0.9, 'sine', 0.5, time);
    }
  }
  if (isTrackUnlocked('melody') && sec.melody && shouldPlay(sec.melody)) {
    if (sec.melody.pattern[localStep]) {
      const deg = sec.melody.pitches[localStep] || 1;
      const freq = midiToFreq(scaleDegreeToMidi(root, scaleType, sec.melody.octave || 4, deg));
      scheduleToneAt(freq, stepDur * 0.9, 'sawtooth', 0.35, time);
    }
  }
  if (isTrackUnlocked('chords') && sec.chords && shouldPlay(sec.chords)) {
    if (sec.chords.pattern[localStep]) {
      const deg = sec.chords.chordDegs[localStep] || 1;
      const oct = sec.chords.octave || 3;
      const bm = scaleDegreeToMidi(root, scaleType, oct, deg);
      const offsets = getDiatonicChordOffsets(scaleType, deg);
      const freqs = offsets.map((off) => midiToFreq(bm + off));
      for (const f of freqs) {
        scheduleToneAt(f, stepDur * 1.5, 'triangle', 0.15, time);
      }
    }
  }
}

function shouldPlay(td: any) {
  if (td.muted) return false;
  if (soloActive && !td.soloed) return false;
  return true;
}

function scheduler() {
  if (!audioCtx) return;
  while (nextStepTime < audioCtx.currentTime + SCHEDULE_AHEAD) {
    scheduleStep(globalStep, nextStepTime);
    const sec = composition.sections[currentSectionIdx];
    nextStepTime += getStepDuration(sec);
    globalStep++;
    currentStep++;
    if (currentStep >= getSectionStepCount(sec)) {
      currentStep = 0;
      currentSectionIdx++;
      if (currentSectionIdx >= composition.sections.length) {
        stopPlayback();
        return;
      }
      updateTimelineUI();
      // 更新 worklet 步进时长
      if (useWorklet && workletNode) {
        const newSec = composition.sections[currentSectionIdx];
        workletNode.port.postMessage({ cmd: 'stepDur', stepDur: getStepDuration(newSec) });
      }
    }
  }
}

function advanceSection() {
  // worklet 模式下由 port.onmessage 驱动，不需要额外逻辑
}

function startPlayback() {
  if (isPlaying) return;
  initAudio();
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  isPlaying = true;
  globalStep = 0;
  currentStep = 0;
  currentSectionIdx = 0;
  startTime = audioCtx.currentTime;
  nextStepTime = audioCtx.currentTime + 0.05;
  updateTimelineUI();

  const sec = composition.sections[0];
  const stepDur = getStepDuration(sec);

  if (useWorklet) {
    try {
      createWorkletNode(stepDur);
    } catch (e) {
      useWorklet = false;
    }
  }
  if (!useWorklet) {
    schedulerTimer = setInterval(scheduler, LOOK_AHEAD);
  }
  requestAnimationFrame(updatePlayhead);
  const btnPlay = document.getElementById('btn-play');
  if (btnPlay) btnPlay.textContent = '⏸';
}

function stopPlayback() {
  isPlaying = false;
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
  if (workletNode) {
    try {
      workletNode.port.postMessage({ cmd: 'stop' });
      workletNode.disconnect();
    } catch (e) {}
    workletNode = null;
  }
  currentStep = 0;
  globalStep = 0;
  currentSectionIdx = 0;
  const btnPlay = document.getElementById('btn-play');
  if (btnPlay) btnPlay.textContent = '▶';
  const timeDisplay = document.getElementById('time-display');
  if (timeDisplay) timeDisplay.textContent = '0:00';
  const bpmDisplay = document.getElementById('bpm-display');
  if (bpmDisplay) bpmDisplay.textContent = String(composition.sections[0].bpm);
  updateTimelineUI();
  redrawAllCanvases();
}

function togglePlayback() {
  if (isPlaying) stopPlayback();
  else startPlayback();
}

// ============================================================
// 播放头动画
// ============================================================
function updatePlayhead() {
  if (!isPlaying) return;
  if (!audioCtx) return;
  const elapsed = audioCtx.currentTime - startTime;
  const min = Math.floor(elapsed / 60),
    sec = Math.floor(elapsed % 60);
  const timeDisplay = document.getElementById('time-display');
  if (timeDisplay) timeDisplay.textContent = min + ':' + String(sec).padStart(2, '0');
  const sec2 = composition.sections[currentSectionIdx];
  const bpmDisplay = document.getElementById('bpm-display');
  if (bpmDisplay) bpmDisplay.textContent = String(sec2.bpm);
  redrawAllCanvases();
  requestAnimationFrame(updatePlayhead);
}

// ============================================================
// Canvas 渲染引擎
// ============================================================
const CELL_W = 20,
  CELL_H = 20,
  CELL_GAP = 2,
  LABEL_W = 32;
const DPR = window.devicePixelRatio || 1;

function createTrackCanvas(trackKey: string, subRows: number, stepCount: number, sec: Section) {
  const canvas = document.createElement('canvas');
  const totalW = LABEL_W + stepCount * (CELL_W + CELL_GAP);
  const totalH = subRows * (CELL_H + CELL_GAP) + 4;
  canvas.width = totalW * DPR;
  canvas.height = totalH * DPR;
  canvas.style.width = totalW + 'px';
  canvas.style.height = totalH + 'px';
  canvas.dataset.track = trackKey;
  canvas.dataset.stepCount = String(stepCount);
  canvas.dataset.subRows = String(subRows);
  return canvas;
}

function drawDrumCanvas(canvas: HTMLCanvasElement, sec: Section, stepCount: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const subRows = 3;
  const totalW = LABEL_W + stepCount * (CELL_W + CELL_GAP);
  const totalH = subRows * (CELL_H + CELL_GAP) + 4;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, totalW, totalH);

  const labels = ['底鼓', '军鼓', '踩镲'];
  const keys = ['kick', 'snare', 'hihat'] as const;
  const colors = ['#FF8C42', '#E8587A', '#FFD166'];

  for (let row = 0; row < subRows; row++) {
    const y = row * (CELL_H + CELL_GAP) + 2;
    // 标签
    ctx.font = 'bold 10px system-ui';
    ctx.fillStyle = '#9E8E7E';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(labels[row], LABEL_W - 4, y + CELL_H / 2);
    // 格子
    const arr = sec.drums[keys[row]] || new Array(stepCount).fill(0);
    for (let col = 0; col < stepCount; col++) {
      const x = LABEL_W + col * (CELL_W + CELL_GAP);
      const isOn = arr[col];
      const isCurrent = isPlaying && currentSectionIdx === composition.sections.indexOf(sec) && col === currentStep;
      ctx.fillStyle = isOn ? colors[row] : '#E8DFD5';
      roundRect(ctx, x, y, CELL_W, CELL_H, 3);
      ctx.fill();
      if (isCurrent) {
        ctx.strokeStyle = '#FF8C42';
        ctx.lineWidth = 2;
        roundRect(ctx, x, y, CELL_W, CELL_H, 3);
        ctx.stroke();
      }
    }
  }
}

function drawPitchCanvas(canvas: HTMLCanvasElement, sec: Section, trackKey: string, stepCount: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const totalW = LABEL_W + stepCount * (CELL_W + CELL_GAP);
  const totalH = CELL_H + CELL_GAP + 4;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, totalW, totalH);

  const track = sec[trackKey as 'bass' | 'melody' | 'chords'] as PitchTrack | ChordTrack;
  if (!track) return;
  const unlocked = isTrackUnlocked(trackKey);
  const colors = { bass: '#E8587A', melody: '#7C6BFF', chords: '#4ECDC4' };
  const color = colors[trackKey as keyof typeof colors] || '#FF8C42';
  const y = 2;

  // 标签
  ctx.font = 'bold 10px system-ui';
  ctx.fillStyle = '#9E8E7E';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const trackLabels = { bass: '音高', melody: '音高', chords: '和弦' };
  ctx.fillText(trackLabels[trackKey as keyof typeof trackLabels] || '', LABEL_W - 4, y + CELL_H / 2);

  const chordNames = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

  for (let col = 0; col < stepCount; col++) {
    const x = LABEL_W + col * (CELL_W + CELL_GAP);
    const isOn = track.pattern[col];
    const isCurrent = isPlaying && currentSectionIdx === composition.sections.indexOf(sec) && col === currentStep;

    if (!unlocked) {
      ctx.fillStyle = '#E8DFD5';
      roundRect(ctx, x, y, CELL_W, CELL_H, 3);
      ctx.fill();
      // 条纹
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#000';
      for (let s = 0; s < CELL_W; s += 6) {
        ctx.fillRect(x + s, y, 2, CELL_H);
      }
      ctx.restore();
    } else {
      ctx.fillStyle = isOn ? color : '#E8DFD5';
      roundRect(ctx, x, y, CELL_W, CELL_H, 3);
      ctx.fill();
      if (isOn) {
        ctx.font = 'bold 9px system-ui';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (trackKey === 'chords') {
          const ct = track as ChordTrack;
          const deg = ct.chordDegs[col] || 1;
          ctx.fillText(chordNames[(deg - 1) % 7], x + CELL_W / 2, y + CELL_H / 2);
        } else {
          const pt = track as PitchTrack;
          const deg = pt.pitches[col] || 1;
          ctx.fillText(String(deg), x + CELL_W / 2, y + CELL_H / 2);
        }
      }
    }
    if (isCurrent) {
      ctx.strokeStyle = '#FF8C42';
      ctx.lineWidth = 2;
      roundRect(ctx, x, y, CELL_W, CELL_H, 3);
      ctx.stroke();
    }
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function redrawAllCanvases() {
  const sec = composition.sections[currentSectionIdx];
  const stepCount = getSectionStepCount(sec);
  for (const key of ['drums', 'bass', 'melody', 'chords'] as const) {
    const canvas = trackCanvases[key] as HTMLCanvasElement;
    if (!canvas) continue;
    if (key === 'drums') drawDrumCanvas(canvas, sec, stepCount);
    else drawPitchCanvas(canvas, sec, key, stepCount);
  }
}

// ============================================================
// Canvas 鼠标交互
// ============================================================
function handleCanvasClick(canvas: HTMLCanvasElement, e: any, trackKey: string, sec: Section) {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const stepCount = getSectionStepCount(sec);

  if (trackKey === 'drums') {
    const subRows = 3;
    const col = Math.floor((mx - LABEL_W) / (CELL_W + CELL_GAP));
    const row = Math.floor((my - 2) / (CELL_H + CELL_GAP));
    if (col < 0 || col >= stepCount || row < 0 || row >= subRows) return;
    const keys = ['kick', 'snare', 'hihat'] as const;
    const arr = sec.drums[keys[row]];
    if (arr) {
      arr[col] = arr[col] ? 0 : 1;
      checkComposerAchievement();
    }
  } else {
    const col = Math.floor((mx - LABEL_W) / (CELL_W + CELL_GAP));
    if (col < 0 || col >= stepCount) return;
    if (!isTrackUnlocked(trackKey)) return;
    const track = sec[trackKey as 'bass' | 'melody' | 'chords'] as PitchTrack | ChordTrack;
    if (!track) return;
    if (e.button === 2 || e.ctrlKey) {
      // 右键关闭
      track.pattern[col] = 0;
    } else {
      if (!track.pattern[col]) {
        track.pattern[col] = 1;
      } else {
        // 左键切换音高/和弦
        if (trackKey === 'chords') {
          const ct = track as ChordTrack;
          ct.chordDegs[col] = (ct.chordDegs[col] % 7) + 1;
        } else {
          const pt = track as PitchTrack;
          const scLen = (SCALES[composition.scale as keyof typeof SCALES] || SCALES.minor).length;
          pt.pitches[col] = (pt.pitches[col] % scLen) + 1;
        }
      }
    }
    checkComposerAchievement();
  }
  redrawAllCanvases();
}

// ============================================================
// 构建UI
// ============================================================
function buildTimeline() {
  const tl = document.getElementById('timeline');
  if (!tl) return;
  tl.innerHTML = '';
  for (let i = 0; i < composition.sections.length; i++) {
    const sec = composition.sections[i];
    const div = document.createElement('div');
    div.className = 'tl-section' + (i === currentSectionIdx ? ' active' : '');
    div.style.width = sec.bars * 18 + 'px';
    const dur = getSectionDuration(sec).toFixed(1);

    // 迷你波形 canvas
    const miniCanvas = document.createElement('canvas');
    miniCanvas.width = sec.bars * 18 * DPR;
    miniCanvas.height = 6 * DPR;
    miniCanvas.style.width = sec.bars * 18 + 'px';
    miniCanvas.style.height = '6px';
    miniCanvas.style.borderRadius = '2px';
    drawMiniWaveform(miniCanvas, sec);

    div.innerHTML =
      '<span class="tl-name">' +
      sec.name +
      '</span><span class="tl-info">' +
      sec.tsNum +
      '/' +
      sec.tsDen +
      ' ' +
      sec.bpm +
      '</span><span class="tl-dur">' +
      dur +
      's</span>';
    div.appendChild(miniCanvas);
    div.addEventListener(
      'click',
      (function (idx: number) {
        return function () {
          currentSectionIdx = idx;
          currentStep = 0;
          updateTimelineUI();
          buildTracks();
        };
      })(i)
    );
    tl.appendChild(div);
  }
}

function drawMiniWaveform(canvas: HTMLCanvasElement, sec: Section) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width / DPR,
    h = canvas.height / DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, w, h);
  // 简单的密度波形
  const stepCount = getSectionStepCount(sec);
  const totalHits =
    (sec.drums.kick || []).reduce((a: number, b: number) => a + b, 0) +
    (sec.drums.snare || []).reduce((a: number, b: number) => a + b, 0);
  const density = Math.min(1, totalHits / (stepCount * 0.5));
  ctx.fillStyle = 'rgba(255,140,66,' + (0.3 + density * 0.5) + ')';
  for (let x = 0; x < w; x++) {
    const noise = Math.sin(x * 0.5) * 2 + Math.sin(x * 1.3) * 1.5;
    const bh = Math.max(1, (2 + noise) * density + 1);
    ctx.fillRect(x, h / 2 - bh / 2, 1, bh);
  }
}

function updateTimelineUI() {
  const sections = document.querySelectorAll('.tl-section');
  sections.forEach(function (s, i) {
    s.classList.toggle('active', i === currentSectionIdx);
  });
}

function buildTracks() {
  const container = document.getElementById('tracks');
  if (!container) return;
  const fragment = document.createDocumentFragment();
  trackCanvases = {};
  const sec = composition.sections[currentSectionIdx];
  const stepCount = getSectionStepCount(sec);

  // 确保数组长度
  if (!sec.drums.kick || sec.drums.kick.length < stepCount)
    sec.drums.kick = padArray(sec.drums.kick || [], stepCount, 0);
  if (!sec.drums.snare || sec.drums.snare.length < stepCount)
    sec.drums.snare = padArray(sec.drums.snare || [], stepCount, 0);
  if (!sec.drums.hihat || sec.drums.hihat.length < stepCount)
    sec.drums.hihat = padArray(sec.drums.hihat || [], stepCount, 0);
  for (const tk of ['bass', 'melody', 'chords'] as const) {
    if (sec[tk]) {
      if (!sec[tk].pattern || sec[tk].pattern.length < stepCount)
        sec[tk].pattern = padArray(sec[tk].pattern || [], stepCount, 0);
      if (tk === 'chords') {
        if (!sec[tk].chordDegs || sec[tk].chordDegs.length < stepCount)
          sec[tk].chordDegs = padArray(sec[tk].chordDegs || [], stepCount, 1);
      } else {
        if (!sec[tk].pitches || sec[tk].pitches.length < stepCount)
          sec[tk].pitches = padArray(sec[tk].pitches || [], stepCount, 1);
      }
    }
  }

  buildDrumLane(fragment, sec, stepCount);
  buildPitchLane(fragment, sec, 'bass', '贝斯', stepCount);
  buildPitchLane(fragment, sec, 'melody', '旋律', stepCount);
  buildPitchLane(fragment, sec, 'chords', '和弦', stepCount);

  container.innerHTML = '';
  container.appendChild(fragment);
}

function makeLockOverlay(trackKey: string) {
  const world = getUnlockWorld(trackKey);
  if (isTrackUnlocked(trackKey)) return null;
  const overlay = document.createElement('div');
  overlay.className = 'lock-overlay';
  overlay.innerHTML =
    '<span class="lock-icon">🔒</span><span class="lock-text">完成' +
    (WORLD_NAMES[world as keyof typeof WORLD_NAMES] || '世界' + world) +
    '解锁</span>';
  return overlay;
}

function buildDrumLane(container: DocumentFragment, sec: Section, stepCount: number) {
  const lane = document.createElement('div');
  lane.className = 'track-lane';
  lane.id = 'lane-drums';

  const header = document.createElement('div');
  header.className = 'track-header';
  header.innerHTML =
    '<span class="track-name">鼓组</span>' +
    '<span class="track-ts">' +
    sec.tsNum +
    '/' +
    sec.tsDen +
    '</span>' +
    '<select class="track-len-sel" data-track="drums">' +
    '<option value="8"' +
    ((sec.drums.patternLen || stepCount) === 8 ? ' selected' : '') +
    '>8</option>' +
    '<option value="12"' +
    ((sec.drums.patternLen || stepCount) === 12 ? ' selected' : '') +
    '>12</option>' +
    '<option value="16"' +
    ((sec.drums.patternLen || stepCount) === 16 ? ' selected' : '') +
    '>16</option>' +
    '<option value="24"' +
    ((sec.drums.patternLen || stepCount) === 24 ? ' selected' : '') +
    '>24</option>' +
    '<option value="32"' +
    ((sec.drums.patternLen || stepCount) === 32 ? ' selected' : '') +
    '>32</option>' +
    '</select>' +
    '<input type="range" class="track-vol" min="0" max="100" value="' +
    (sec.drums.volume || 0.8) * 100 +
    '" data-track="drums">' +
    '<button class="btn-ms ' +
    (sec.drums.muted ? 'muted' : '') +
    '" data-track="drums" data-action="mute">M</button>' +
    '<button class="btn-ms ' +
    (sec.drums.soloed ? 'soloed' : '') +
    '" data-track="drums" data-action="solo">S</button>';
  lane.appendChild(header);

  const wrap = document.createElement('div');
  wrap.className = 'track-canvas-wrap';
  const canvas = createTrackCanvas('drums', 3, stepCount, sec);
  canvas.addEventListener('click', function (e) {
    handleCanvasClick(canvas, e, 'drums', sec);
  });
  canvas.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    handleCanvasClick(canvas, { clientX: e.clientX, clientY: e.clientY, button: 2, ctrlKey: true }, 'drums', sec);
  });
  wrap.appendChild(canvas);
  lane.appendChild(wrap);

  container.appendChild(lane);
  trackCanvases.drums = canvas;
  drawDrumCanvas(canvas, sec, stepCount);
  bindTrackControls(lane, sec, 'drums');
}

function buildPitchLane(container: DocumentFragment, sec: Section, trackKey: string, label: string, stepCount: number) {
  const track = sec[trackKey as 'bass' | 'melody' | 'chords'] as PitchTrack | ChordTrack;
  if (!track) return;
  const unlocked = isTrackUnlocked(trackKey);
  const world = getUnlockWorld(trackKey);

  const lane = document.createElement('div');
  lane.className = 'track-lane';
  lane.id = 'lane-' + trackKey;

  const header = document.createElement('div');
  header.className = 'track-header';
  let hHTML = '<span class="track-name">' + label + '</span>';
  if (!unlocked) {
    const color = WORLD_COLORS[world as keyof typeof WORLD_COLORS] || '#999';
    hHTML += '<span class="unlock-badge" style="background:' + color + '">🔒 世界' + world + '</span>';
  }
  hHTML += '<span class="track-ts">' + sec.tsNum + '/' + sec.tsDen + '</span>';
  hHTML +=
    '<select class="track-len-sel" data-track="' +
    trackKey +
    '">' +
    '<option value="8"' +
    ((track.patternLen || stepCount) === 8 ? ' selected' : '') +
    '>8</option>' +
    '<option value="12"' +
    ((track.patternLen || stepCount) === 12 ? ' selected' : '') +
    '>12</option>' +
    '<option value="16"' +
    ((track.patternLen || stepCount) === 16 ? ' selected' : '') +
    '>16</option>' +
    '<option value="24"' +
    ((track.patternLen || stepCount) === 24 ? ' selected' : '') +
    '>24</option>' +
    '<option value="32"' +
    ((track.patternLen || stepCount) === 32 ? ' selected' : '') +
    '>32</option>' +
    '</select>';
  hHTML +=
    '<input type="range" class="track-vol" min="0" max="100" value="' +
    (track.volume || 0.7) * 100 +
    '" data-track="' +
    trackKey +
    '"' +
    (unlocked ? '' : ' disabled') +
    '>';
  hHTML +=
    '<button class="btn-ms ' +
    (track.muted ? 'muted' : '') +
    '" data-track="' +
    trackKey +
    '" data-action="mute"' +
    (unlocked ? '' : ' disabled') +
    '>M</button>';
  hHTML +=
    '<button class="btn-ms ' +
    (track.soloed ? 'soloed' : '') +
    '" data-track="' +
    trackKey +
    '" data-action="solo"' +
    (unlocked ? '' : ' disabled') +
    '>S</button>';
  header.innerHTML = hHTML;
  lane.appendChild(header);

  const wrap = document.createElement('div');
  wrap.className = 'track-canvas-wrap';
  const canvas = createTrackCanvas(trackKey, 1, stepCount, sec);
  if (unlocked) {
    canvas.addEventListener('click', function (e) {
      handleCanvasClick(canvas, e, trackKey, sec);
    });
    canvas.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      handleCanvasClick(canvas, { clientX: e.clientX, clientY: e.clientY, button: 2, ctrlKey: true }, trackKey, sec);
    });
  }
  wrap.appendChild(canvas);
  lane.appendChild(wrap);

  if (!unlocked) {
    const overlay = makeLockOverlay(trackKey);
    if (overlay) lane.appendChild(overlay);
  }

  container.appendChild(lane);
  trackCanvases[trackKey] = canvas;
  drawPitchCanvas(canvas, sec, trackKey, stepCount);
  if (unlocked) bindTrackControls(lane, sec, trackKey);
}

function bindTrackControls(lane: HTMLDivElement, sec: Section, trackKey: string) {
  const track = sec[trackKey as 'drums' | 'bass' | 'melody' | 'chords'] as DrumTrack | PitchTrack | ChordTrack;
  const vol = lane.querySelector('.track-vol[data-track="' + trackKey + '"]') as HTMLInputElement | null;
  if (vol)
    vol.addEventListener('input', function (e) {
      track.volume = Number((e.target as HTMLInputElement).value) / 100;
    });
  const muteBtn = lane.querySelector('.btn-ms[data-track="' + trackKey + '"][data-action="mute"]');
  if (muteBtn)
    muteBtn.addEventListener('click', function (e) {
      track.muted = !track.muted;
      (e.currentTarget as HTMLElement).classList.toggle('muted');
    });
  const soloBtn = lane.querySelector('.btn-ms[data-track="' + trackKey + '"][data-action="solo"]');
  if (soloBtn)
    soloBtn.addEventListener('click', function (e) {
      track.soloed = !track.soloed;
      (e.currentTarget as HTMLElement).classList.toggle('soloed');
    });
  const lenSel = lane.querySelector('.track-len-sel[data-track="' + trackKey + '"]') as HTMLSelectElement | null;
  if (lenSel)
    lenSel.addEventListener('change', function (e) {
      track.patternLen = parseInt((e.target as HTMLSelectElement).value);
    });
}

function padArray(arr: number[], len: number, fillVal?: number) {
  fillVal = fillVal || 0;
  const r = arr.slice();
  while (r.length < len) r.push(fillVal);
  return r;
}

// ============================================================
// 数学生成面板
// ============================================================
const GENERATORS = [
  { key: 'euclidean', label: '欧几里得节奏', unlockKey: 'euclidean', world: 1 },
  { key: 'modular', label: '模运算模式', unlockKey: 'modular', world: 2 },
  { key: 'prime', label: '质数模式', unlockKey: 'prime', world: 3 },
  { key: 'fibonacci', label: '斐波那契旋律', unlockKey: 'fibonacci', world: 3 },
  { key: 'symmetry', label: '对称模式', unlockKey: 'symmetry', world: 4 },
  { key: 'recursive', label: '递归/分形', unlockKey: 'recursive', world: 5 },
  { key: 'cellular', label: '细胞自动机', unlockKey: 'cellular', world: 6 },
  { key: 'markov', label: '马尔可夫旋律', unlockKey: 'markov', world: 7 },
  { key: 'counterpoint', label: '对位声部', unlockKey: 'counterpoint', world: 8 },
];

const genExplanations = {
  fibonacci:
    '斐波那契节奏：在斐波那契数列位置（1,1,2,3,5,8,13...）上放置击打点。自然界最基本的递归数列产生独特的非对称节奏。',
  euclidean: '欧几里得节奏：将K个击打尽可能均匀地分布在N个步进中（Björklund算法）。非洲传统复节奏的数学本质。',
  prime: '质数模式：仅在质数位置（2,3,5,7,11,13...）放置击打。质数的不可除性产生不可预测的节奏，体现数论之美。',
  symmetry: '对称模式：生成回文式节奏（前半 = 后半的镜像），展示反射对称性。对称性是数学和音乐共同的基本结构。',
  modular: '模运算模式：在步进编号能被M整除的位置放置击打。模运算是数论的基础运算，产生周期性节奏。',
  recursive:
    '递归/分形模式：定义短动机，将每个1替换为动机、每个0替换为休止，产生类Cantor集的分形结构。自相似性是分形几何的核心。',
  cellular:
    '细胞自动机：一维元胞自动机（Rule 30/90/110）的中列输出。简单的局部规则产生复杂的全局模式，是复杂系统研究的经典模型。',
  markov:
    '马尔可夫旋律：下一个音只依赖当前音，按转移矩阵在调式音阶上随机游走。体现“无记忆性”随机过程。',
  counterpoint:
    '对位声部：以调式中心为轴，将旋律音高做倒影并移低八度，生成与旋律对称的 accompanying 声部。',
};

function buildGenTypeDropdown() {
  const sel = document.getElementById('gen-type') as HTMLSelectElement;
  sel.innerHTML = '';
  for (const gen of GENERATORS) {
    const opt = document.createElement('option');
    opt.value = gen.key;
    if (isGeneratorUnlocked(gen.unlockKey)) {
      opt.textContent = gen.label;
    } else {
      opt.textContent = '🔒 ' + gen.label + ' (世界' + gen.world + ')';
      opt.disabled = true;
      opt.className = 'gen-locked';
    }
    sel.appendChild(opt);
  }
  for (const gen of GENERATORS) {
    if (isGeneratorUnlocked(gen.unlockKey)) {
      sel.value = gen.key;
      break;
    }
  }
}

function buildGenTargetDropdown() {
  const sel = document.getElementById('gen-target') as HTMLSelectElement;
  if (!sel) return;
  sel.innerHTML = '';
  const tracks = [
    { key: 'drums', label: '鼓组', alwaysUnlocked: true },
    { key: 'bass', label: '贝斯' },
    { key: 'melody', label: '旋律' },
    { key: 'chords', label: '和弦' },
  ];
  for (const t of tracks) {
    if (t.alwaysUnlocked || isTrackUnlocked(t.key)) {
      const opt = document.createElement('option');
      opt.value = t.key;
      opt.textContent = t.label;
      sel.appendChild(opt);
    }
  }
}

// ============================================================
// 数学生成面板（续）
// ============================================================
function applyGenerator() {
  const sel = document.getElementById('gen-type') as HTMLSelectElement;
  const type = sel.value;
  const targetSel = document.getElementById('gen-target') as HTMLSelectElement;
  const target = targetSel.value;
  const sec = composition.sections[currentSectionIdx];
  if (!sec || !sec[target as keyof Section]) return;
  const track = sec[target as keyof Section] as any;
  const stepCount = getSectionStepCount(sec);
  const notes = getScaleNotes(composition.root, composition.scale);
  if (type === 'euclidean') {
    const kInput = document.getElementById('gen-euclid-k') as HTMLInputElement | null;
    const k = Math.max(1, Math.min(stepCount, parseInt(kInput?.value || '4', 10) || 4));
    track.pattern = euclideanRhythm(k, stepCount);
  } else if (type === 'modular') {
    const mInput = document.getElementById('gen-mod-m') as HTMLInputElement | null;
    const m = Math.max(2, parseInt(mInput?.value || '3', 10) || 3);
    track.pattern = genModular(stepCount, m);
  } else if (type === 'prime') {
    track.pattern = genPrime(stepCount);
  } else if (type === 'fibonacci') {
    track.pattern = genFibonacci(stepCount);
  } else if (type === 'symmetry') {
    track.pattern = genSymmetry(stepCount);
  } else if (type === 'recursive') {
    track.pattern = genRecursive(stepCount, [1, 0, 1], 2);
  } else if (type === 'cellular') {
    const ruleInput = document.getElementById('gen-cell-rule') as HTMLInputElement | null;
    const rule = Math.max(0, Math.min(255, parseInt(ruleInput?.value || '30', 10) || 30));
    track.pattern = genCellular(stepCount, rule);
  } else if (type === 'markov') {
    const result = genMarkov(stepCount, composition.root, composition.scale);
    track.pattern = result.pattern;
    track.pitches = result.pitches;
  } else if (type === 'counterpoint') {
    const melodyTrack = sec.melody;
    if (!melodyTrack || !melodyTrack.pitches || melodyTrack.pitches.length === 0) {
      showToast('对位声部需要先有旋律轨数据');
      return;
    }
    const result = genCounterpoint(melodyTrack.pitches, composition.scale, -1);
    track.pattern = result.pattern;
    track.pitches = result.pitches;
  }
  buildTracks();
}

function updateGenParams() {
  const type = (document.getElementById('gen-type') as HTMLSelectElement).value;
  const container = document.getElementById('gen-params');
  if (!container) return;
  container.innerHTML = '';
  if (type === 'euclidean') {
    container.innerHTML = '<label>K: <input type="number" id="gen-euclid-k" value="4" min="1" max="64"></label>';
  } else if (type === 'modular') {
    container.innerHTML = '<label>M: <input type="number" id="gen-mod-m" value="3" min="2" max="12"></label>';
  } else if (type === 'cellular') {
    container.innerHTML =
      '<label>Rule: <input type="number" id="gen-cell-rule" value="30" min="0" max="255"></label>';
  }
}

function buildSimTargetDropdown() {
  const sel = document.getElementById('sim-target') as HTMLSelectElement | null;
  if (!sel) return;
  sel.innerHTML = '';
  const tracks = [
    { key: 'drums', label: '鼓组' },
    { key: 'bass', label: '贝斯' },
    { key: 'melody', label: '旋律' },
    { key: 'chords', label: '和弦' },
  ];
  for (const t of tracks) {
    if (isTrackUnlocked(t.key)) {
      const opt = document.createElement('option');
      opt.value = t.key;
      opt.textContent = t.label;
      sel.appendChild(opt);
    }
  }
}

function updateSimMapping() {
  // no-op placeholder for future simulation mapping
}

function loadSimSample() {
  // no-op placeholder for future simulation sample loading
}

function importSimFile() {
  const input = document.getElementById('sim-file-input') as HTMLInputElement;
  if (input) input.click();
}

function handleSimFile(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function () {
    showToast('已加载模拟文件：' + file.name, 'info');
  };
  reader.readAsText(file);
}

function generateSimPattern() {
  const target = (document.getElementById('sim-target') as HTMLSelectElement)?.value || 'drums';
  const sec = composition.sections[currentSectionIdx];
  if (!sec || !sec[target as keyof Section]) return;
  (sec[target as keyof Section] as any).pattern = euclideanRhythm(4, getSectionStepCount(sec));
  buildTracks();
}

function updateMIDIButton() {
  const btn = document.getElementById('btn-midi');
  if (!btn) return;
  btn.textContent = '导出 MIDI';
}

function updateSimTabVisibility() {
  const panel = document.getElementById('panel-sim');
  if (!panel) return;
}

function freqToScaleDegree(freq: number, root: string, scaleType: string): number {
  if (!freq || freq <= 0) return 1;
  const target = 69 + 12 * Math.log2(freq / 440);
  let best = 1;
  let bestDiff = Infinity;
  for (let d = 1; d <= 40; d++) {
    const m = scaleDegreeToMidi(root, scaleType, 0, d);
    const diff = Math.abs(m - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = d;
    }
  }
  return best;
}

function loadComposition(comp: any) {
  if (!comp || !Array.isArray(comp.sections) || comp.sections.length === 0) return;
  stopPlayback();
  composition = comp;
  composition.root = composition.root || 'C';
  composition.scale = composition.scale || 'minor';
  currentSectionIdx = 0;
  globalStep = 0;
  currentStep = 0;

  for (const sec of composition.sections) {
    if (!sec.drums) sec.drums = { kick: [], snare: [], hihat: [], volume: 0.8, muted: false, soloed: false, patternLen: 0 };
    if (!sec.bass) sec.bass = { pattern: [], pitches: [], octave: 2, volume: 0.7, muted: false, soloed: false, patternLen: 0 };
    if (!sec.melody) sec.melody = { pattern: [], pitches: [], octave: 4, volume: 0.6, muted: false, soloed: false, patternLen: 0 };
    if (!sec.chords) sec.chords = { pattern: [], chordDegs: [], octave: 3, volume: 0.5, muted: false, soloed: false, patternLen: 0 };
  }

  const rootSel = document.getElementById('sel-root') as HTMLSelectElement | null;
  if (rootSel) rootSel.value = composition.root;
  const scaleSel = document.getElementById('sel-scale') as HTMLSelectElement | null;
  if (scaleSel) scaleSel.value = composition.scale;

  buildTimeline();
  buildTracks();
}

function loadScienceExport() {
  const data = localGet<any>('mathbeat_science_export', null);
  if (!data || !Array.isArray(data.pattern)) return;
  localRemove('mathbeat_science_export');

  const pattern = data.pattern;
  const stepCount = pattern.length;
  const tsNum = 4;
  const bars = Math.ceil(stepCount / tsNum);
  const root = composition.root;
  const scaleType = composition.scale;

  const kick = new Array(stepCount).fill(0);
  const snare = new Array(stepCount).fill(0);
  const melPat = new Array(stepCount).fill(0);
  const melPit = new Array(stepCount).fill(1);

  for (let i = 0; i < stepCount; i++) {
    const row = pattern[i] || [];
    if (row[0]) kick[i] = 1;
    if (row[3]) snare[i] = 1;
    if (row[1]) {
      melPat[i] = 1;
      melPit[i] = freqToScaleDegree(Number(row[1]), root, scaleType);
    }
  }

  loadComposition({
    root,
    scale: scaleType,
    sections: [
      {
        name: 'Science',
        cnName: '科学之声',
        bars,
        tsNum,
        tsDen: 4,
        bpm: 120,
        drums: { kick, snare, hihat: new Array(stepCount).fill(0), volume: 0.8 },
        bass: { pattern: new Array(stepCount).fill(0), pitches: new Array(stepCount).fill(1), octave: 2, volume: 0.7 },
        melody: { pattern: melPat, pitches: melPit, octave: 4, volume: 0.6 },
        chords: { pattern: new Array(stepCount).fill(0), chordDegs: new Array(stepCount).fill(1), octave: 3, volume: 0.5 },
      },
    ],
  });
}

function loadDemoImport() {
  const comp = localGet<any>('mathbeat_demo_import', null);
  if (!comp) return;
  localRemove('mathbeat_demo_import');
  loadComposition(comp);
}

function exportMIDI() {
  const ticksPerStep = 240;
  const ticksPerQuarter = 480;

  function writeUint16BE(value: number): number[] {
    return [(value >> 8) & 0xff, value & 0xff];
  }

  function writeUint32BE(value: number): number[] {
    return [(value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
  }

  function writeVLQ(value: number): number[] {
    if (value === 0) return [0];
    const bytes: number[] = [];
    let v = value;
    do {
      bytes.unshift((v & 0x7f) | 0x80);
      v >>= 7;
    } while (v > 0);
    bytes[bytes.length - 1] &= 0x7f;
    return bytes;
  }

  function toBase64(bytes: Uint8Array): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    let i = 0;
    while (i < bytes.length) {
      const b1 = bytes[i++];
      const b2 = i < bytes.length ? bytes[i++] : 0;
      const b3 = i < bytes.length ? bytes[i++] : 0;
      const enc1 = b1 >> 2;
      const enc2 = ((b1 & 3) << 4) | (b2 >> 4);
      const enc3 = ((b2 & 15) << 2) | (b3 >> 6);
      const enc4 = b3 & 63;
      result += chars[enc1] + chars[enc2] + chars[enc3] + chars[enc4];
    }
    const pad = bytes.length % 3;
    if (pad === 1) {
      result = result.slice(0, -2) + '==';
    } else if (pad === 2) {
      result = result.slice(0, -1) + '=';
    }
    return result;
  }

  interface MidiEvent {
    tick: number;
    data: number[];
  }
  const events: MidiEvent[] = [];
  let absTick = 0;

  for (let si = 0; si < composition.sections.length; si++) {
    const sec = composition.sections[si];
    const stepCount = getSectionStepCount(sec);
    const root = composition.root;
    const scaleType = composition.scale;

    // Tempo
    const usPerQuarter = Math.round(60_000_000 / sec.bpm);
    events.push({
      tick: absTick,
      data: [0xff, 0x51, 0x03, (usPerQuarter >> 16) & 0xff, (usPerQuarter >> 8) & 0xff, usPerQuarter & 0xff],
    });

    // Time signature
    const dd = sec.tsDen === 4 ? 2 : sec.tsDen === 8 ? 3 : sec.tsDen === 2 ? 1 : 2;
    events.push({
      tick: absTick,
      data: [0xff, 0x58, 0x04, sec.tsNum, dd, 0x18, 0x08],
    });

    let soloActive = false;
    const trackKeys = ['drums', 'bass', 'melody', 'chords'] as const;
    for (const tk of trackKeys) {
      if (sec[tk] && sec[tk].soloed) soloActive = true;
    }

    function shouldPlayTrack(td: any) {
      if (td.muted) return false;
      if (soloActive && !td.soloed) return false;
      return true;
    }

    for (let step = 0; step < stepCount; step++) {
      const stepTick = absTick + step * ticksPerStep;

      if (sec.drums && shouldPlayTrack(sec.drums)) {
        if (sec.drums.kick && sec.drums.kick[step]) {
          events.push({ tick: stepTick, data: [0x99, 36, 100] });
          events.push({ tick: stepTick + 120, data: [0x89, 36, 0] });
        }
        if (sec.drums.snare && sec.drums.snare[step]) {
          events.push({ tick: stepTick, data: [0x99, 38, 100] });
          events.push({ tick: stepTick + 120, data: [0x89, 38, 0] });
        }
        if (sec.drums.hihat && sec.drums.hihat[step]) {
          events.push({ tick: stepTick, data: [0x99, 42, 80] });
          events.push({ tick: stepTick + 120, data: [0x89, 42, 0] });
        }
      }

      if (isTrackUnlocked('bass') && sec.bass && shouldPlayTrack(sec.bass)) {
        if (sec.bass.pattern && sec.bass.pattern[step]) {
          const deg = sec.bass.pitches[step] || 1;
          const note = scaleDegreeToMidi(root, scaleType, sec.bass.octave || 2, deg);
          events.push({ tick: stepTick, data: [0x90, note, 100] });
          events.push({ tick: stepTick + 200, data: [0x80, note, 0] });
        }
      }

      if (isTrackUnlocked('melody') && sec.melody && shouldPlayTrack(sec.melody)) {
        if (sec.melody.pattern && sec.melody.pattern[step]) {
          const deg = sec.melody.pitches[step] || 1;
          const note = scaleDegreeToMidi(root, scaleType, sec.melody.octave || 4, deg);
          events.push({ tick: stepTick, data: [0x91, note, 90] });
          events.push({ tick: stepTick + 200, data: [0x81, note, 0] });
        }
      }

      if (isTrackUnlocked('chords') && sec.chords && shouldPlayTrack(sec.chords)) {
        if (sec.chords.pattern && sec.chords.pattern[step]) {
          const deg = sec.chords.chordDegs[step] || 1;
          const oct = sec.chords.octave || 3;
          const bm = scaleDegreeToMidi(root, scaleType, oct, deg);
          const offsets = getDiatonicChordOffsets(scaleType, deg);
          const chordNotes = offsets.map((off) => bm + off);
          for (const n of chordNotes) {
            events.push({ tick: stepTick, data: [0x92, n, 80] });
            events.push({ tick: stepTick + 360, data: [0x82, n, 0] });
          }
        }
      }
    }

    absTick += stepCount * ticksPerStep;
  }

  events.sort((a, b) => a.tick - b.tick);

  const trackBytes: number[] = [];
  let lastTick = 0;
  for (const evt of events) {
    const delta = evt.tick - lastTick;
    trackBytes.push(...writeVLQ(delta));
    trackBytes.push(...evt.data);
    lastTick = evt.tick;
  }

  trackBytes.push(...writeVLQ(0));
  trackBytes.push(0xff, 0x2f, 0x00);

  const header: number[] = [];
  header.push(0x4d, 0x54, 0x68, 0x64);
  header.push(...writeUint32BE(6));
  header.push(...writeUint16BE(1));
  header.push(...writeUint16BE(1));
  header.push(...writeUint16BE(ticksPerQuarter));

  const trackHeader: number[] = [];
  trackHeader.push(0x4d, 0x54, 0x72, 0x6b);
  trackHeader.push(...writeUint32BE(trackBytes.length));

  const allBytes = new Uint8Array([...header, ...trackHeader, ...trackBytes]);
  const base64 = toBase64(allBytes);

  const a = document.createElement('a');
  a.href = 'data:audio/midi;base64,' + base64;
  a.download = 'mathbeat-composition.mid';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  Store.state.composerExported = true;
  Store.save();
  checkComposerAchievement();
}

function shareComposition() {
  const shareData = {
    title: 'MathBeat 作品',
    version: 1,
    root: composition.root,
    scale: composition.scale,
    sections: composition.sections.map((sec) => ({
      name: sec.name,
      cnName: sec.cnName,
      bpm: sec.bpm,
      tsNum: sec.tsNum,
      tsDen: sec.tsDen,
      bars: sec.bars,
      drums: sec.drums,
      bass: sec.bass,
      melody: sec.melody,
      chords: sec.chords,
    })),
  };
  const text = JSON.stringify(shareData);
  function markShared() {
    Store.state.sharedComposer = true;
    Store.save();
    checkAchievements();
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(function () {
        showToast(t('toast.composer.copied'), 'success');
        markShared();
      })
      .catch(function () {
        showToast(t('toast.composer.copy_failed') + text.slice(0, 300) + '...', 'error');
        markShared();
      });
  } else {
    showToast(t('toast.composer.copy_failed') + text.slice(0, 300) + '...', 'info');
    markShared();
  }
}

function importComposition(text: string) {
  try {
    const payload = JSON.parse(text);
    if (!payload || !Array.isArray(payload.sections) || payload.sections.length === 0) {
      throw new Error('invalid');
    }
    loadComposition(payload);
    showToast('作品导入成功', 'success');
  } catch (e) {
    showToast('无效的作品格式', 'error');
  }
}

function checkComposerAchievement() {
  const achs = Store.state.achievements || [];
  const totalDuration = composition.sections.reduce((sum, sec) => sum + getSectionDuration(sec), 0);
  if (totalDuration >= 30 && !achs.includes('math_rock_30s')) {
    achs.push('math_rock_30s');
  }
  if (Store.state.composerExported && !achs.includes('composer_export')) {
    achs.push('composer_export');
  }
  Store.save();
}

function toggleBgMusic() {
  if (!audioCtx) initAudio();
  if (!audioCtx || !masterGain) return;
  if (bgMusicPlaying) {
    if (bgOsc) {
      try {
        bgOsc.stop();
        bgOsc.disconnect();
      } catch (e) {}
    }
    if (bgGain) {
      try {
        bgGain.disconnect();
      } catch (e) {}
    }
    bgMusicPlaying = false;
  } else {
    if (Store.state.settings.bgm === false) return;
    bgOsc = audioCtx.createOscillator();
    bgGain = audioCtx.createGain();
    bgOsc.type = 'sine';
    bgOsc.frequency.value = 220;
    bgGain.gain.value = 0.1;
    bgOsc.connect(bgGain);
    bgGain.connect(masterGain);
    bgOsc.start();
    bgMusicPlaying = true;
  }
}

// ============================================================
// 事件绑定与初始化
// ============================================================
document.getElementById('btn-back')?.addEventListener('click', function () {
  window.location.href = 'index.html';
});
document.getElementById('btn-play')?.addEventListener('click', togglePlayback);
document.getElementById('btn-stop')?.addEventListener('click', stopPlayback);
document.getElementById('btn-generate')?.addEventListener('click', applyGenerator);
document.getElementById('gen-type')?.addEventListener('change', updateGenParams);
document.getElementById('btn-bg-music')?.addEventListener('click', toggleBgMusic);
document.getElementById('btn-share')?.addEventListener('click', shareComposition);
document.getElementById('btn-import')?.addEventListener('click', function () {
  document.getElementById('import-file-input')?.click();
});
document.getElementById('import-file-input')?.addEventListener('change', function (e) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function () {
    importComposition(String(reader.result));
  };
  reader.readAsText(file);
  target.value = '';
});

const mathToggle = document.getElementById('math-toggle');
if (mathToggle) {
  mathToggle.addEventListener('click', function () {
    const toggle = document.getElementById('math-toggle'),
      content = document.getElementById('math-content');
    if (toggle) toggle.classList.toggle('open');
    if (content) content.classList.toggle('open');
  });
}

document.querySelectorAll('.math-tab').forEach(function (tab) {
  tab.addEventListener('click', function () {
    document.querySelectorAll('.math-tab').forEach(function (t) {
      t.classList.remove('active');
    });
    tab.classList.add('active');
    const tabName = (tab as HTMLElement).dataset.tab;
    const panelMath = document.getElementById('panel-math');
    const panelSim = document.getElementById('panel-sim');
    if (panelMath) panelMath.style.display = tabName === 'math' ? 'block' : 'none';
    if (panelSim) panelSim.className = 'sim-panel' + (tabName === 'sim' ? ' active' : '');
  });
});

document.getElementById('sim-type')?.addEventListener('change', updateSimMapping);
document.getElementById('btn-sim-sample')?.addEventListener('click', loadSimSample);
document.getElementById('btn-sim-import')?.addEventListener('click', importSimFile);
document.getElementById('sim-file-input')?.addEventListener('change', handleSimFile);
document.getElementById('btn-sim-gen')?.addEventListener('click', generateSimPattern);

document.getElementById('sel-root')?.addEventListener('change', function (e) {
  composition.root = (e.target as HTMLSelectElement).value;
  buildTracks();
});
document.getElementById('sel-scale')?.addEventListener('change', function (e) {
  composition.scale = (e.target as HTMLSelectElement).value;
  buildTracks();
});

document.getElementById('bpm-down')?.addEventListener('click', function () {
  const sec = composition.sections[currentSectionIdx];
  sec.bpm = Math.max(40, sec.bpm - 10);
  const bpmDisplay = document.getElementById('bpm-display');
  if (bpmDisplay) bpmDisplay.textContent = String(sec.bpm);
  buildTimeline();
});
document.getElementById('bpm-up')?.addEventListener('click', function () {
  const sec = composition.sections[currentSectionIdx];
  sec.bpm = Math.min(300, sec.bpm + 10);
  const bpmDisplay = document.getElementById('bpm-display');
  if (bpmDisplay) bpmDisplay.textContent = String(sec.bpm);
  buildTimeline();
});

async function init() {
  buildTimeline();
  buildTracks();
  buildGenTypeDropdown();
  buildGenTargetDropdown();
  buildSimTargetDropdown();
  updateGenParams();
  updateMIDIButton();
  updateSimTabVisibility();
  updateSimMapping();
  loadScienceExport();
  loadDemoImport();

  try {
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume();
  } catch (e) {
    console.warn('音频初始化失败，将使用合成器回退', e);
  }

  setTimeout(function () {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) loadingScreen.classList.add('hidden');
  }, 500);
}

init();
