import { Store } from './store';
import { isFreeModeUnlocked, checkAchievements } from './game-engine';
import { localSet } from './storage';
import { t } from './i18n';
import { showToast } from './ui-feedback';
import {
  getAudioCtx,
  playSample,
  scheduleSnareAt,
  scheduleHihatAt,
  scheduleToneAt,
  getSharedTransport,
  stopSharedTransport,
} from './audio';
import type { Transport, TransportEvent } from './core/transport';
import { SCALES, ROOT_SEMITONES } from './worlds';
import {
  midiToFreq,
  genFibonacci,
  genEuclidean,
  genPrime,
  genSymmetry,
  genRecursive,
  genFibonacciMelody,
  genSymmetricMelody,
  genSerialMelody,
} from './utils';

export const MATH_ROCK_SAMPLES = [
  {
    id: 'fibonacci-groove',
    title: 'Fibonacci Groove',
    bpm: 120,
    duration: '1:08',
    tags: ['斐波那契数列', '欧几里得节奏', 'E 小调'],
    structure:
      'Intro 8 bars 4/4 + Verse 8 bars 5/4 + Chorus 8 bars 7/8。鼓组用 E(3,8) 与 E(5,8)，贝斯按 Fibonacci 1-1-2-3-5 跳音，旋律使用 E 小调五声音阶。',
  },
  {
    id: 'prime-time',
    title: 'Prime Time',
    bpm: 135,
    duration: '0:52',
    tags: ['质数索引', '7/8 拍', '不对称节奏'],
    structure:
      '全曲 7/8，共 16 bars。Kick 落在质数位置 2,3,5,7,11,13；Snare 落在 4 的倍数位置；旋律用质数索引从 E 弗里几亚音阶中挑选音高。',
  },
  {
    id: 'markov-changes',
    title: 'Markov Changes',
    bpm: 110,
    duration: '1:04',
    tags: ['马尔可夫链', '5/4 拍', '和弦进行'],
    structure:
      '5/4 进行 16 bars。和弦转移矩阵集中在 I→IV→V→vi→I，旋律由当前和弦音的马尔可夫链生成，形成顺滑的数学摇滚声部。',
  },
  {
    id: 'lcm-reunion',
    title: 'LCM Reunion',
    bpm: 115,
    duration: '0:58',
    tags: ['最小公倍数', '4:6 对位', 'A 小调'],
    structure:
      '16 bars 4/4。鼓与贝斯分别按 4 拍和 6 拍循环，每 LCM(4,6)=12 步产生一次“重逢”重音；旋律在重逢点加入强调音。',
  },
  {
    id: 'symmetric-dreams',
    title: 'Symmetric Dreams',
    bpm: 105,
    duration: '1:02',
    tags: ['对称群', '倒影', 'D 多利亚'],
    structure:
      '16 bars 4/4。旋律由两段互为逆行倒影的 8 小节组成，和弦每 4 小节做一次镜面反射，体验群论中的二面体对称。',
  },
  {
    id: 'euclidean-drive',
    title: 'Euclidean Drive',
    bpm: 140,
    duration: '0:55',
    tags: ['欧几里得算法', 'E(5,16)', 'B 小调'],
    structure:
      '16 bars 4/4。Kick 用 E(5,16)，Snare 用 E(3,8)，Hi-hat 用 E(7,16)；三条欧几里得节奏叠加产生数学摇滚典型的错位推进感。',
  },
  {
    id: 'md_csh',
    title: 'Real Sample 1',
    bpm: 125,
    duration: '0:51',
    tags: ['分子动力学', '速度自相关', 'MSD', 'A 小调'],
    structure:
      '16 bars 4/4。从 NEP 分子动力学轨迹提取速度自相关衰减时间、温度功率谱主频、Ca 原子 MSD 扩散斜率和温度峰度：自相关快衰增加 hi-hat 密度，扩散快慢改变 kick 密度，峰度决定旋律半音偏移量。',
  },
  {
    id: 'fem_csh',
    title: 'Real Sample 2',
    bpm: 115,
    duration: '0:56',
    tags: ['应力应变', '弹性模量', '屈服点', 'D 多利亚'],
    structure:
      '16 bars 4/4。从 stress_strain.out 提取初始弹性模量、屈服点位置和塑性段斜率：弹性段使用规则 4/4 kick，屈服点后切换为不规则 E(3,16)/E(7,16) 节奏，模态温度聚类决定 hi-hat 开关与和弦色彩变化。',
  },
  {
    id: 'dft_csh',
    title: 'Real Sample 3',
    bpm: 120,
    duration: '0:53',
    tags: ['等效能带', '态密度', '带隙', 'E 小调'],
    structure:
      '16 bars 4/4。从 NEP 势能曲线构造等效态密度(DOS)、识别带隙与带边：带隙内休止，费米能级附近触发 kick，导带形成旋律，价带形成 bass，能级差分正负决定大三/小三和弦色彩。',
  },
];

export const REAL_MATH_ROCK_SAMPLES: Record<string, any> = {
  md_csh: {
    root: 'A',
    scale: 'minor',
    meta: { vac_decay_steps: 1, dominant_freq_bin: 1, msd_slope: 0, temperature_kurtosis: 4.671 },
    sections: [
      {
        name: 'Real Sample 1',
        bars: 16,
        tsNum: 4,
        tsDen: 4,
        bpm: 125,
        drums: {
          kick: [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0],
          snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
          hihat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
          volume: 0.8,
        },
        bass: {
          pattern: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
          pitches: [1, 1, 5, 1, 5, 3, 5, 1, 1, 5, 1, 5, 3, 5, 1, 5],
          octave: 2,
          volume: 0.7,
        },
        melody: {
          pattern: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
          pitches: [1, 3, 5, 7, 5, 3, 1, 3, 5, 7, 5, 3, 1, 3, 5, 7],
          octave: 4,
          volume: 0.6,
        },
        chords: {
          pattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
          chordDegs: [1, 1, 1, 1, 4, 4, 4, 4, 5, 5, 5, 5, 1, 1, 1, 1],
          octave: 3,
          volume: 0.5,
        },
      },
    ],
  },
  fem_csh: {
    root: 'D',
    scale: 'dorian',
    meta: { young_modulus: 200, yield_point: 0.02, plastic_slope: 10 },
    sections: [
      {
        name: 'Real Sample 2',
        bars: 16,
        tsNum: 4,
        tsDen: 4,
        bpm: 115,
        drums: {
          kick: [1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
          snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
          hihat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
          volume: 0.8,
        },
        bass: {
          pattern: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
          pitches: [1, 3, 5, 1, 3, 5, 1, 3, 5, 1, 3, 5, 1, 3, 5, 1],
          octave: 2,
          volume: 0.7,
        },
        melody: {
          pattern: [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0],
          pitches: [1, 5, 3, 7, 5, 1, 3, 5, 7, 3, 1, 5, 3, 7, 5, 1],
          octave: 4,
          volume: 0.6,
        },
        chords: {
          pattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
          chordDegs: [1, 1, 1, 1, 4, 4, 4, 4, 5, 5, 5, 5, 1, 1, 1, 1],
          octave: 3,
          volume: 0.5,
        },
      },
    ],
  },
  dft_csh: {
    root: 'E',
    scale: 'minor',
    meta: { bandgap: 0.8, fermi: 0, dos_peak: 3 },
    sections: [
      {
        name: 'Real Sample 3',
        bars: 16,
        tsNum: 4,
        tsDen: 4,
        bpm: 120,
        drums: {
          kick: [1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0],
          snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
          hihat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
          volume: 0.8,
        },
        bass: {
          pattern: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
          pitches: [1, 5, 3, 1, 5, 3, 1, 5, 1, 5, 3, 1, 5, 3, 1, 5],
          octave: 2,
          volume: 0.7,
        },
        melody: {
          pattern: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
          pitches: [1, 3, 5, 7, 5, 3, 1, 3, 5, 7, 5, 3, 1, 3, 5, 7],
          octave: 4,
          volume: 0.6,
        },
        chords: {
          pattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
          chordDegs: [1, 1, 1, 1, 4, 4, 4, 4, 5, 5, 5, 5, 1, 1, 1, 1],
          octave: 3,
          volume: 0.5,
        },
      },
    ],
  },
};

export function getSampleComposition(id: string) {
  if (REAL_MATH_ROCK_SAMPLES[id]) return JSON.parse(JSON.stringify(REAL_MATH_ROCK_SAMPLES[id]));
  const steps = 64;
  if (id === 'fibonacci-groove') {
    return {
      root: 'E',
      scale: 'minor',
      sections: [
        {
          name: 'Intro',
          bars: 8,
          tsNum: 4,
          tsDen: 4,
          bpm: 120,
          drums: {
            kick: genEuclidean(3, 8).concat(genEuclidean(3, 8)).concat(genEuclidean(3, 8)).concat(genEuclidean(3, 8)),
            snare: new Array(32).fill(0),
            hihat: genEuclidean(5, 8).concat(genEuclidean(5, 8)).concat(genEuclidean(5, 8)).concat(genEuclidean(5, 8)),
            volume: 0.8,
          },
          bass: {
            pattern: genFibonacci(32),
            pitches: genFibonacciMelody(32, 'E', 'pentatonic'),
            octave: 2,
            volume: 0.7,
          },
          melody: { pattern: genFibonacci(32), pitches: genSymmetricMelody(32, 'E', 'minor'), octave: 4, volume: 0.6 },
          chords: { pattern: new Array(32).fill(0), chordDegs: new Array(32).fill(1), octave: 3, volume: 0.5 },
        },
        {
          name: 'Verse',
          bars: 8,
          tsNum: 5,
          tsDen: 4,
          bpm: 120,
          drums: {
            kick: (function () {
              const r = [];
              for (let b = 0; b < 8; b++) {
                r[b * 5] = 1;
                r[b * 5 + 3] = 1;
              }
              return r;
            })(),
            snare: (function () {
              const r = [];
              for (let b = 0; b < 8; b++) {
                r[b * 5 + 1] = 1;
                r[b * 5 + 4] = 1;
              }
              return r;
            })(),
            hihat: genEuclidean(7, 10)
              .concat(genEuclidean(7, 10))
              .concat(genEuclidean(7, 10))
              .concat(genEuclidean(7, 10))
              .slice(0, 40),
            volume: 0.85,
          },
          bass: { pattern: genPrime(40), pitches: genFibonacciMelody(40, 'E', 'dorian'), octave: 2, volume: 0.72 },
          melody: { pattern: genSymmetry(40), pitches: genSymmetricMelody(40, 'E', 'dorian'), octave: 4, volume: 0.62 },
          chords: { pattern: new Array(40).fill(0), chordDegs: new Array(40).fill(1), octave: 3, volume: 0.5 },
        },
        {
          name: 'Chorus',
          bars: 8,
          tsNum: 7,
          tsDen: 8,
          bpm: 120,
          drums: {
            kick: (function () {
              const k = genEuclidean(3, 7),
                r: number[] = [];
              for (let i = 0; i < 8; i++) r.push(...k);
              return r.slice(0, 56);
            })(),
            snare: (function () {
              const k = genEuclidean(2, 7),
                r: number[] = [];
              for (let i = 0; i < 8; i++) r.push(...k);
              return r.slice(0, 56);
            })(),
            hihat: new Array(56).fill(1),
            volume: 0.9,
          },
          bass: {
            pattern: (function () {
              const r: number[] = [];
              for (let i = 0; i < 8; i++) r.push(...genRecursive(7, [1, 0, 1]));
              return r.slice(0, 56);
            })(),
            pitches: genFibonacciMelody(56, 'E', 'minor'),
            octave: 2,
            volume: 0.75,
          },
          melody: { pattern: genFibonacci(56), pitches: genFibonacciMelody(56, 'E', 'minor'), octave: 4, volume: 0.65 },
          chords: { pattern: new Array(56).fill(0), chordDegs: new Array(56).fill(1), octave: 3, volume: 0.55 },
        },
      ],
    };
  } else if (id === 'prime-time') {
    const primes = [2, 3, 5, 7, 11, 13];
    const kick = new Array(steps).fill(0);
    primes.forEach((p) => {
      for (let i = p; i < steps; i += p) kick[i] = 1;
    });
    const snare = new Array(steps).fill(0);
    for (let i = 4; i < steps; i += 4) snare[i] = 1;
    const melodyPitches: number[] = [];
    for (let i = 0; i < steps; i++) melodyPitches.push((primes[i % primes.length] % 7) + 1);
    const chordPat = new Array(steps).fill(0),
      chordDegs = new Array(steps).fill(1);
    for (let b = 0; b < 16; b++) {
      const ds = [1, 4, 3, 2];
      for (let s = 0; s < 7; s++) {
        if (b * 7 + s < steps) {
          chordPat[b * 7 + s] = s === 0 ? 1 : 0;
          chordDegs[b * 7 + s] = ds[b % 4];
        }
      }
    }
    return {
      root: 'E',
      scale: 'phrygian',
      sections: [
        {
          name: 'Prime Time',
          bars: 16,
          tsNum: 7,
          tsDen: 8,
          bpm: 135,
          drums: { kick, snare, hihat: new Array(steps).fill(1), volume: 0.9 },
          bass: { pattern: genPrime(steps), pitches: genSerialMelody(steps), octave: 2, volume: 0.7 },
          melody: { pattern: genPrime(steps), pitches: melodyPitches, octave: 4, volume: 0.6 },
          chords: { pattern: chordPat, chordDegs, octave: 3, volume: 0.55 },
        },
      ],
    };
  } else if (id === 'markov-changes') {
    const ssteps = 80;
    const matrix = [
      [0.5, 0.3, 0.15, 0.05],
      [0.25, 0.35, 0.3, 0.1],
      [0.2, 0.2, 0.35, 0.25],
      [0.3, 0.2, 0.2, 0.3],
    ];
    let cur = 0;
    const prog = [cur];
    for (let i = 0; i < ssteps - 1; i++) {
      const row = matrix[cur];
      let r = Math.random(),
        acc = 0;
      for (let j = 0; j < 4; j++) {
        acc += row[j];
        if (r < acc) {
          cur = j;
          break;
        }
      }
      prog.push(cur);
    }
    const chordPat = new Array(ssteps).fill(0),
      chordDegs = prog.map((i) => i + 1);
    for (let i = 0; i < ssteps; i += 5) chordPat[i] = 1;
    const melodyPitches: number[] = [];
    for (let i = 0; i < ssteps; i++) melodyPitches.push(((prog[i] + Math.floor(Math.random() * 3)) % 7) + 1);
    return {
      root: 'E',
      scale: 'minor',
      sections: [
        {
          name: 'Markov Changes',
          bars: 16,
          tsNum: 5,
          tsDen: 4,
          bpm: 110,
          drums: {
            kick: (function () {
              const r = [];
              for (let b = 0; b < 16; b++) {
                r[b * 5] = 1;
                r[b * 5 + 3] = 1;
              }
              return r;
            })(),
            snare: (function () {
              const r = [];
              for (let b = 0; b < 16; b++) {
                r[b * 5 + 1] = 1;
                r[b * 5 + 4] = 1;
              }
              return r;
            })(),
            hihat: genEuclidean(7, 10)
              .concat(genEuclidean(7, 10))
              .concat(genEuclidean(7, 10))
              .concat(genEuclidean(7, 10))
              .concat(genEuclidean(7, 10))
              .slice(0, ssteps),
            volume: 0.85,
          },
          bass: { pattern: prog.map((v) => v % 2), pitches: prog.map((v) => v + 1), octave: 2, volume: 0.7 },
          melody: {
            pattern: new Array(ssteps).fill(0).map((_, i) => i % 2),
            pitches: melodyPitches,
            octave: 4,
            volume: 0.6,
          },
          chords: { pattern: chordPat, chordDegs, octave: 3, volume: 0.55 },
        },
      ],
    };
  } else if (id === 'lcm-reunion') {
    const kick = new Array(steps).fill(0);
    for (let i = 0; i < steps; i += 4) kick[i] = 1;
    const snare = new Array(steps).fill(0);
    for (let i = 0; i < steps; i += 6) snare[i] = 1;
    const hihat = genEuclidean(7, 16)
      .concat(genEuclidean(7, 16))
      .concat(genEuclidean(7, 16))
      .concat(genEuclidean(7, 16))
      .slice(0, steps);
    const bassPat = new Array(steps).fill(0);
    for (let i = 0; i < steps; i += 6) bassPat[i] = 1;
    const bassPitches: number[] = [];
    for (let i = 0; i < steps; i++) bassPitches.push(i % 12 === 0 ? 1 : 5);
    const melodyPat = new Array(steps).fill(0);
    for (let i = 0; i < steps; i += 12) melodyPat[i] = 1;
    const melodyPitches: number[] = [];
    for (let i = 0; i < steps; i++) melodyPitches.push(melodyPat[i] ? 7 : (i % 7) + 1);
    const chordPat = new Array(steps).fill(0),
      chordDegs = new Array(steps).fill(1);
    for (let i = 0; i < steps; i += 16) {
      chordPat[i] = 1;
      chordDegs[i] = (i / 16) % 2 === 0 ? 1 : 4;
    }
    return {
      root: 'A',
      scale: 'minor',
      sections: [
        {
          name: 'LCM Reunion',
          bars: 16,
          tsNum: 4,
          tsDen: 4,
          bpm: 115,
          drums: { kick, snare, hihat, volume: 0.85 },
          bass: { pattern: bassPat, pitches: bassPitches, octave: 2, volume: 0.72 },
          melody: { pattern: melodyPat, pitches: melodyPitches, octave: 4, volume: 0.62 },
          chords: { pattern: chordPat, chordDegs, octave: 3, volume: 0.55 },
        },
      ],
    };
  } else if (id === 'symmetric-dreams') {
    const kick = genEuclidean(4, 16)
      .concat(genEuclidean(4, 16))
      .concat(genEuclidean(4, 16))
      .concat(genEuclidean(4, 16))
      .slice(0, steps);
    const snare = new Array(steps).fill(0);
    for (let i = 8; i < steps; i += 16) snare[i] = 1;
    const hihat = genEuclidean(5, 16)
      .concat(genEuclidean(5, 16))
      .concat(genEuclidean(5, 16))
      .concat(genEuclidean(5, 16))
      .slice(0, steps);
    const melodyPat = genSymmetry(steps);
    const melodyPitches = genSymmetricMelody(steps, 'D', 'dorian');
    const chordPat = new Array(steps).fill(0),
      chordDegs = new Array(steps).fill(1);
    for (let i = 0; i < steps; i += 16) {
      chordPat[i] = 1;
      chordDegs[i] = [1, 4, 5, 1][(i / 16) % 4];
    }
    return {
      root: 'D',
      scale: 'dorian',
      sections: [
        {
          name: 'Symmetric Dreams',
          bars: 16,
          tsNum: 4,
          tsDen: 4,
          bpm: 105,
          drums: { kick, snare, hihat, volume: 0.82 },
          bass: { pattern: melodyPat, pitches: melodyPitches.map((p) => (p % 7) + 1), octave: 2, volume: 0.7 },
          melody: { pattern: melodyPat, pitches: melodyPitches, octave: 4, volume: 0.6 },
          chords: { pattern: chordPat, chordDegs, octave: 3, volume: 0.52 },
        },
      ],
    };
  } else if (id === 'euclidean-drive') {
    const kick = genEuclidean(5, 16)
      .concat(genEuclidean(5, 16))
      .concat(genEuclidean(5, 16))
      .concat(genEuclidean(5, 16))
      .slice(0, steps);
    const snare = genEuclidean(3, 8)
      .concat(genEuclidean(3, 8))
      .concat(genEuclidean(3, 8))
      .concat(genEuclidean(3, 8))
      .concat(genEuclidean(3, 8))
      .concat(genEuclidean(3, 8))
      .concat(genEuclidean(3, 8))
      .concat(genEuclidean(3, 8))
      .slice(0, steps);
    const hihat = genEuclidean(7, 16)
      .concat(genEuclidean(7, 16))
      .concat(genEuclidean(7, 16))
      .concat(genEuclidean(7, 16))
      .slice(0, steps);
    const bassPat = genEuclidean(5, 16)
      .concat(genEuclidean(5, 16))
      .concat(genEuclidean(5, 16))
      .concat(genEuclidean(5, 16))
      .slice(0, steps);
    const bassPitches: number[] = [];
    for (let i = 0; i < steps; i++) bassPitches.push(bassPat[i] ? (i % 7) + 1 : 1);
    const melodyPat = genPrime(steps);
    const melodyPitches = genSerialMelody(steps);
    const chordPat = new Array(steps).fill(0),
      chordDegs = new Array(steps).fill(1);
    for (let i = 0; i < steps; i += 8) {
      chordPat[i] = 1;
      chordDegs[i] = [1, 5, 6, 4, 1, 5, 6, 4][(i / 8) % 8];
    }
    return {
      root: 'B',
      scale: 'minor',
      sections: [
        {
          name: 'Euclidean Drive',
          bars: 16,
          tsNum: 4,
          tsDen: 4,
          bpm: 140,
          drums: { kick, snare, hihat, volume: 0.9 },
          bass: { pattern: bassPat, pitches: bassPitches, octave: 2, volume: 0.74 },
          melody: { pattern: melodyPat, pitches: melodyPitches, octave: 4, volume: 0.64 },
          chords: { pattern: chordPat, chordDegs, octave: 3, volume: 0.56 },
        },
      ],
    };
  }
  return null;
}

let samplePlayer: any = { playing: false, transport: null as Transport | null, step: 0, comp: null, currentId: null };

export function toggleSamplePlayback(id: string) {
  if (samplePlayer.playing && samplePlayer.currentId === id) {
    stopSamplePlayback();
  } else {
    playSampleComposition(id);
  }
}

export function playSampleComposition(id: string) {
  stopSamplePlayback();
  if (!Store.state.samplesPlayed.includes(id)) {
    Store.state.samplesPlayed.push(id);
    Store.save();
    checkAchievements();
  }
  const comp = getSampleComposition(id);
  if (!comp || !comp.sections || comp.sections.length === 0) return;
  samplePlayer = { playing: true, timer: null, step: 0, nextTime: 0, comp, currentId: id, sectionIdx: 0 };
  const btn = document.getElementById('samplePlay_' + id);
  if (btn) btn.textContent = '⏸';
  playSampleSection();
}

function playSampleSection() {
  if (!samplePlayer.playing) return;
  const sec = samplePlayer.comp.sections[samplePlayer.sectionIdx];
  if (!sec) {
    stopSamplePlayback();
    return;
  }
  stopSharedTransport();
  samplePlayer.step = 0;
  const scale = SCALES[samplePlayer.comp.scale as keyof typeof SCALES] || SCALES.minor;
  const rs = ROOT_SEMITONES[samplePlayer.comp.root as keyof typeof ROOT_SEMITONES] || 0;
  const len = sec.drums.kick.length;
  const transport = getSharedTransport(sec.bpm, 2);
  samplePlayer.transport = transport;
  transport.subscribe((event: TransportEvent) => {
    const s = event.step % len;
    const t = event.time;
    if (sec.drums && sec.drums.kick[s]) playSample('kick', t, sec.drums.volume || 0.8);
    if (sec.drums && sec.drums.snare[s]) scheduleSnareAt(t);
    if (sec.drums && sec.drums.hihat[s]) scheduleHihatAt(t);
    ['bass', 'melody'].forEach((key) => {
      const track = sec[key];
      if (track && track.pattern[s]) {
        const p = track.pitches[s];
        const midi =
          12 * (track.octave + 4) + rs + scale[(p - 1) % scale.length] + 12 * Math.floor((p - 1) / scale.length);
        scheduleToneAt(midiToFreq(midi), 0.25, 'triangle', (track.volume || 0.6) * 0.7, t);
      }
    });
    const ch = sec.chords;
    if (ch && ch.pattern[s]) {
      const deg = ch.chordDegs[s] - 1;
      const rootMidi = 12 * (ch.octave + 4) + rs + scale[deg % scale.length];
      [0, 2, 4].forEach((off) => {
        const note = (deg + off) % scale.length;
        const midi = rootMidi + scale[note] - scale[deg % scale.length];
        scheduleToneAt(midiToFreq(midi), 0.4, 'triangle', (ch.volume || 0.5) * 0.6, t);
      });
    }
    samplePlayer.step = s;
  });
  transport.start();
  // 小节结束后切到下一段
  const sectionDuration = len * (60.0 / sec.bpm / 2) * 1000;
  samplePlayer.sectionTimeout = setTimeout(() => {
    if (!samplePlayer.playing) return;
    samplePlayer.sectionIdx++;
    if (samplePlayer.sectionIdx >= samplePlayer.comp.sections.length) {
      stopSamplePlayback();
    } else {
      playSampleSection();
    }
  }, sectionDuration + 100);
}

export function stopSamplePlayback() {
  samplePlayer.playing = false;
  stopSharedTransport();
  samplePlayer.transport = null;
  if (samplePlayer.sectionTimeout) {
    clearTimeout(samplePlayer.sectionTimeout);
    samplePlayer.sectionTimeout = null;
  }
  if (samplePlayer.currentId) {
    const btn = document.getElementById('samplePlay_' + samplePlayer.currentId);
    if (btn) btn.textContent = '▶';
  }
  samplePlayer.currentId = null;
}

export function importSampleToComposer(id: string) {
  if (!isFreeModeUnlocked()) {
    showToast(t('toast.unlock.world6_required'), 'info');
    return;
  }
  const comp = getSampleComposition(id);
  localSet('mathbeat_demo_import', comp);
  Store.state.importedSampleId = id;
  Store.save();
  checkAchievements();
  window.location.href = 'composer.html';
}
/* ===== EXPOSE GLOBALS ===== */
Object.assign(window as any, {
  MATH_ROCK_SAMPLES: MATH_ROCK_SAMPLES,
  REAL_MATH_ROCK_SAMPLES: REAL_MATH_ROCK_SAMPLES,
  getSampleComposition: getSampleComposition,
  importSampleToComposer: importSampleToComposer,
  playSampleComposition: playSampleComposition,
  stopSamplePlayback: stopSamplePlayback,
  toggleSamplePlayback: toggleSamplePlayback,
});
