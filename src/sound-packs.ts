/**
 * 多流派音色包
 * 每个音色包定义 kick/snare/hihat/tone 的合成参数，
 * 让同一组数学序列在不同风格下呈现不同听感。
 */

export interface SoundPack {
  id: string;
  name: string;
  nameEn: string;
  emoji: string;
  desc: string;
  descEn: string;
  // 鼓机合成参数
  kick: { oscType: OscillatorType; freqStart: number; freqEnd: number; decay: number; vol: number };
  snare: { noiseDecay: number; filterFreq: number; filterType: BiquadFilterType; vol: number };
  hihat: { noiseDecay: number; filterFreq: number; filterType: BiquadFilterType; vol: number };
  clap: { noiseDecay: number; filterFreq: number; filterType: BiquadFilterType; vol: number };
  conga: { freqStart: number; freqEnd: number; decay: number; vol: number };
  tom: { freqStart: number; freqEnd: number; decay: number; vol: number };
  rimshot: { noiseDecay: number; filterFreq: number; vol: number };
  openHihat: { noiseDecay: number; filterFreq: number; filterType: BiquadFilterType; vol: number };
  crash: { noiseDecay: number; filterFreq: number; filterType: BiquadFilterType; vol: number };
  // 旋律/和弦音色参数
  tone: {
    oscType: OscillatorType;
    attack: number;
    release: number;
    volScale: number;
    // 高级合成器选择
    synthType: 'fm' | 'am' | 'subtractive' | 'pluck' | 'bell' | 'marimba' | 'organ' | 'bass' | 'lead' | 'pad';
  };
  // 流派特征：影响节奏密度、音符时长偏好
  trait: { noteDurationScale: number; densityBias: number };
}

export const SOUND_PACKS: Record<string, SoundPack> = {
  mathRock: {
    id: 'mathRock',
    name: '数学摇滚',
    nameEn: 'Math Rock',
    emoji: '🎸',
    desc: '紧凑、错拍、清晰的鼓组与旋律',
    descEn: 'Tight, syncopated drums and melody',
    kick: { oscType: 'sine', freqStart: 150, freqEnd: 30, decay: 0.3, vol: 0.5 },
    snare: { noiseDecay: 0.12, filterFreq: 1000, filterType: 'highpass', vol: 0.25 },
    hihat: { noiseDecay: 0.03, filterFreq: 8000, filterType: 'bandpass', vol: 0.1 },
    clap: { noiseDecay: 0.08, filterFreq: 1800, filterType: 'bandpass', vol: 0.3 },
    conga: { freqStart: 220, freqEnd: 150, decay: 0.15, vol: 0.35 },
    tom: { freqStart: 120, freqEnd: 60, decay: 0.3, vol: 0.4 },
    rimshot: { noiseDecay: 0.02, filterFreq: 4000, vol: 0.3 },
    openHihat: { noiseDecay: 0.2, filterFreq: 6000, filterType: 'highpass', vol: 0.15 },
    crash: { noiseDecay: 1.5, filterFreq: 3000, filterType: 'highpass', vol: 0.25 },
    tone: { oscType: 'sine', attack: 0.005, release: 0.25, volScale: 0.3, synthType: 'pluck' },
    trait: { noteDurationScale: 1.0, densityBias: 1.0 },
  },
  minimal: {
    id: 'minimal',
    name: '极简主义',
    nameEn: 'Minimal',
    emoji: '◻️',
    desc: '相位循环、长音、微妙的渐变',
    descEn: 'Phase loops, long tones, subtle shifts',
    kick: { oscType: 'sine', freqStart: 90, freqEnd: 40, decay: 0.5, vol: 0.35 },
    snare: { noiseDecay: 0.25, filterFreq: 600, filterType: 'bandpass', vol: 0.15 },
    hihat: { noiseDecay: 0.08, filterFreq: 5000, filterType: 'lowpass', vol: 0.06 },
    clap: { noiseDecay: 0.12, filterFreq: 1200, filterType: 'bandpass', vol: 0.2 },
    conga: { freqStart: 200, freqEnd: 140, decay: 0.2, vol: 0.25 },
    tom: { freqStart: 100, freqEnd: 50, decay: 0.4, vol: 0.3 },
    rimshot: { noiseDecay: 0.03, filterFreq: 3000, vol: 0.2 },
    openHihat: { noiseDecay: 0.25, filterFreq: 4000, filterType: 'lowpass', vol: 0.08 },
    crash: { noiseDecay: 2.0, filterFreq: 2000, filterType: 'lowpass', vol: 0.15 },
    tone: { oscType: 'triangle', attack: 0.08, release: 0.8, volScale: 0.22, synthType: 'pad' },
    trait: { noteDurationScale: 1.8, densityBias: 0.6 },
  },
  ambient: {
    id: 'ambient',
    name: '氛围音乐',
    nameEn: 'Ambient',
    emoji: '🌫️',
    desc: '宽广、柔和、类似铺底音的声场',
    descEn: 'Wide, soft, pad-like soundscape',
    kick: { oscType: 'sine', freqStart: 70, freqEnd: 35, decay: 0.9, vol: 0.25 },
    snare: { noiseDecay: 0.4, filterFreq: 400, filterType: 'lowpass', vol: 0.1 },
    hihat: { noiseDecay: 0.15, filterFreq: 3000, filterType: 'lowpass', vol: 0.04 },
    clap: { noiseDecay: 0.25, filterFreq: 800, filterType: 'lowpass', vol: 0.15 },
    conga: { freqStart: 180, freqEnd: 120, decay: 0.3, vol: 0.2 },
    tom: { freqStart: 80, freqEnd: 40, decay: 0.5, vol: 0.25 },
    rimshot: { noiseDecay: 0.04, filterFreq: 2500, vol: 0.15 },
    openHihat: { noiseDecay: 0.35, filterFreq: 2500, filterType: 'lowpass', vol: 0.06 },
    crash: { noiseDecay: 2.5, filterFreq: 1500, filterType: 'lowpass', vol: 0.12 },
    tone: { oscType: 'sine', attack: 0.15, release: 1.4, volScale: 0.18, synthType: 'pad' },
    trait: { noteDurationScale: 2.5, densityBias: 0.4 },
  },
  chiptune: {
    id: 'chiptune',
    name: '芯片音乐',
    nameEn: 'Chiptune',
    emoji: '🕹️',
    desc: '8-bit 方波与锯齿波，短促有力',
    descEn: '8-bit square and saw waves, punchy',
    kick: { oscType: 'square', freqStart: 180, freqEnd: 25, decay: 0.12, vol: 0.4 },
    snare: { noiseDecay: 0.08, filterFreq: 2000, filterType: 'highpass', vol: 0.22 },
    hihat: { noiseDecay: 0.02, filterFreq: 10000, filterType: 'highpass', vol: 0.12 },
    clap: { noiseDecay: 0.05, filterFreq: 3000, filterType: 'highpass', vol: 0.25 },
    conga: { freqStart: 250, freqEnd: 180, decay: 0.1, vol: 0.3 },
    tom: { freqStart: 140, freqEnd: 70, decay: 0.2, vol: 0.35 },
    rimshot: { noiseDecay: 0.015, filterFreq: 5000, vol: 0.35 },
    openHihat: { noiseDecay: 0.08, filterFreq: 8000, filterType: 'highpass', vol: 0.12 },
    crash: { noiseDecay: 0.6, filterFreq: 6000, filterType: 'highpass', vol: 0.2 },
    tone: { oscType: 'square', attack: 0.002, release: 0.12, volScale: 0.25, synthType: 'subtractive' },
    trait: { noteDurationScale: 0.6, densityBias: 1.2 },
  },
  idm: {
    id: 'idm',
    name: '智能舞曲',
    nameEn: 'IDM',
    emoji: '⚡',
    desc: '碎拍、Glitch、非规则包络',
    descEn: 'Breakbeats, glitch, irregular envelopes',
    kick: { oscType: 'sawtooth', freqStart: 120, freqEnd: 40, decay: 0.18, vol: 0.45 },
    snare: { noiseDecay: 0.06, filterFreq: 2500, filterType: 'bandpass', vol: 0.2 },
    hihat: { noiseDecay: 0.04, filterFreq: 9000, filterType: 'highpass', vol: 0.14 },
    clap: { noiseDecay: 0.05, filterFreq: 2200, filterType: 'bandpass', vol: 0.28 },
    conga: { freqStart: 210, freqEnd: 150, decay: 0.12, vol: 0.3 },
    tom: { freqStart: 110, freqEnd: 55, decay: 0.25, vol: 0.38 },
    rimshot: { noiseDecay: 0.018, filterFreq: 4500, vol: 0.32 },
    openHihat: { noiseDecay: 0.1, filterFreq: 7000, filterType: 'bandpass', vol: 0.14 },
    crash: { noiseDecay: 0.8, filterFreq: 5000, filterType: 'highpass', vol: 0.22 },
    tone: { oscType: 'sawtooth', attack: 0.003, release: 0.18, volScale: 0.2, synthType: 'fm' },
    trait: { noteDurationScale: 0.8, densityBias: 1.4 },
  },
  orchestral: {
    id: 'orchestral',
    name: '管弦乐',
    nameEn: 'Orchestral',
    emoji: '🎻',
    desc: '弦乐与打击乐，宏大的数学交响',
    descEn: 'Strings and percussion, grand mathematical symphony',
    kick: { oscType: 'sine', freqStart: 100, freqEnd: 40, decay: 0.6, vol: 0.45 },
    snare: { noiseDecay: 0.18, filterFreq: 800, filterType: 'bandpass', vol: 0.2 },
    hihat: { noiseDecay: 0.06, filterFreq: 6000, filterType: 'highpass', vol: 0.08 },
    clap: { noiseDecay: 0.1, filterFreq: 1500, filterType: 'bandpass', vol: 0.25 },
    conga: { freqStart: 200, freqEnd: 140, decay: 0.18, vol: 0.3 },
    tom: { freqStart: 100, freqEnd: 50, decay: 0.35, vol: 0.35 },
    rimshot: { noiseDecay: 0.025, filterFreq: 3500, vol: 0.25 },
    openHihat: { noiseDecay: 0.2, filterFreq: 5000, filterType: 'highpass', vol: 0.1 },
    crash: { noiseDecay: 2.0, filterFreq: 2500, filterType: 'highpass', vol: 0.28 },
    tone: { oscType: 'triangle', attack: 0.06, release: 1.0, volScale: 0.22, synthType: 'organ' },
    trait: { noteDurationScale: 1.5, densityBias: 0.7 },
  },
  electronic: {
    id: 'electronic',
    name: '电子舞曲',
    nameEn: 'Electronic',
    emoji: '🎹',
    desc: 'House/Techno 风格，4/4 稳定节拍',
    descEn: 'House/Techno style, steady 4/4 beat',
    kick: { oscType: 'sine', freqStart: 160, freqEnd: 30, decay: 0.4, vol: 0.55 },
    snare: { noiseDecay: 0.1, filterFreq: 1200, filterType: 'highpass', vol: 0.28 },
    hihat: { noiseDecay: 0.03, filterFreq: 8000, filterType: 'highpass', vol: 0.12 },
    clap: { noiseDecay: 0.08, filterFreq: 2000, filterType: 'bandpass', vol: 0.32 },
    conga: { freqStart: 230, freqEnd: 160, decay: 0.14, vol: 0.32 },
    tom: { freqStart: 130, freqEnd: 65, decay: 0.28, vol: 0.36 },
    rimshot: { noiseDecay: 0.02, filterFreq: 4000, vol: 0.28 },
    openHihat: { noiseDecay: 0.15, filterFreq: 7000, filterType: 'highpass', vol: 0.14 },
    crash: { noiseDecay: 1.2, filterFreq: 3500, filterType: 'highpass', vol: 0.26 },
    tone: { oscType: 'sawtooth', attack: 0.005, release: 0.3, volScale: 0.28, synthType: 'lead' },
    trait: { noteDurationScale: 1.0, densityBias: 1.1 },
  },
};

export const DEFAULT_SOUND_PACK = 'mathRock';
export const SOUND_PACK_ORDER = ['mathRock', 'electronic', 'orchestral', 'minimal', 'ambient', 'chiptune', 'idm'];
