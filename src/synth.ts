import { Store } from './store';
import { SOUND_PACKS, DEFAULT_SOUND_PACK } from './sound-packs';
import { getAudioCtx, getMasterBus, playTone } from './audio';

/* ============================================================
   MATHBEAT SYNTH ENGINE — Advanced Web Audio Synthesis
   ============================================================ */

function sfxOff(): boolean {
  return Store.state.settings.sfx === false;
}

/* ===== DRUM SYNTHESIS ===== */

export function schedule808Kick(t: number, vol: number = 0.6): void {
  if (sfxOff()) return;
  const ctx = getAudioCtx();
  const bus = getMasterBus();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(180, t);
  o.frequency.exponentialRampToValueAtTime(30, t + 0.8);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
  o.connect(g);
  g.connect(bus);
  o.start(t);
  o.stop(t + 1.2);
}

export function scheduleConga(t: number, vol: number = 0.35): void {
  if (sfxOff()) return;
  const ctx = getAudioCtx();
  const bus = getMasterBus();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(150, t + 0.15);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  o.connect(g);
  g.connect(bus);
  o.start(t);
  o.stop(t + 0.25);
}

export function scheduleClap(t: number, vol: number = 0.3): void {
  if (sfxOff()) return;
  const ctx = getAudioCtx();
  const bus = getMasterBus();
  // main burst
  const bs = Math.floor(ctx.sampleRate * 0.08);
  const b = ctx.createBuffer(1, bs, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < bs; i++) d[i] = Math.random() * 2 - 1;
  const n = ctx.createBufferSource();
  n.buffer = b;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 1800;
  f.Q.value = 1.5;
  n.connect(f);
  f.connect(g);
  g.connect(bus);
  n.start(t);
  n.stop(t + 0.08);
  // two micro-bursts for reverb tail
  for (let i = 1; i <= 2; i++) {
    const bs2 = Math.floor(ctx.sampleRate * 0.03);
    const b2 = ctx.createBuffer(1, bs2, ctx.sampleRate);
    const d2 = b2.getChannelData(0);
    for (let j = 0; j < bs2; j++) d2[j] = Math.random() * 2 - 1;
    const n2 = ctx.createBufferSource();
    n2.buffer = b2;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(vol * 0.4, t + i * 0.015);
    g2.gain.exponentialRampToValueAtTime(0.001, t + i * 0.015 + 0.03);
    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.value = 1800;
    f2.Q.value = 1.5;
    n2.connect(f2);
    f2.connect(g2);
    g2.connect(bus);
    n2.start(t + i * 0.015);
    n2.stop(t + i * 0.015 + 0.03);
  }
}

export function scheduleTom(t: number, vol: number = 0.4, freq: number = 120): void {
  if (sfxOff()) return;
  const ctx = getAudioCtx();
  const bus = getMasterBus();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.3);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  o.connect(g);
  g.connect(bus);
  o.start(t);
  o.stop(t + 0.4);
}

export function scheduleRimshot(t: number, vol: number = 0.3): void {
  if (sfxOff()) return;
  const ctx = getAudioCtx();
  const bus = getMasterBus();
  const bs = Math.floor(ctx.sampleRate * 0.02);
  const b = ctx.createBuffer(1, bs, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < bs; i++) d[i] = Math.random() * 2 - 1;
  const n = ctx.createBufferSource();
  n.buffer = b;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 4000;
  n.connect(f);
  f.connect(g);
  g.connect(bus);
  n.start(t);
  n.stop(t + 0.02);
}

export function scheduleOpenHihat(t: number, vol: number = 0.15): void {
  if (sfxOff()) return;
  const ctx = getAudioCtx();
  const bus = getMasterBus();
  const bs = Math.floor(ctx.sampleRate * 0.2);
  const b = ctx.createBuffer(1, bs, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < bs; i++) d[i] = Math.random() * 2 - 1;
  const n = ctx.createBufferSource();
  n.buffer = b;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 6000;
  n.connect(f);
  f.connect(g);
  g.connect(bus);
  n.start(t);
  n.stop(t + 0.2);
}

export function scheduleCrash(t: number, vol: number = 0.25): void {
  if (sfxOff()) return;
  const ctx = getAudioCtx();
  const bus = getMasterBus();
  const bs = Math.floor(ctx.sampleRate * 1.5);
  const b = ctx.createBuffer(1, bs, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < bs; i++) d[i] = Math.random() * 2 - 1;
  const n = ctx.createBufferSource();
  n.buffer = b;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 3000;
  n.connect(f);
  f.connect(g);
  g.connect(bus);
  n.start(t);
  n.stop(t + 1.5);
}

/* ===== MELODIC SYNTHESIS ===== */

export function playSubtractiveSynth(
  freq: number,
  dur: number = 0.4,
  vol: number = 0.3,
  type: OscillatorType = 'sawtooth',
  t?: number
): void {
  if (sfxOff()) return;
  const ctx = getAudioCtx();
  const time = t || ctx.currentTime;
  const bus = getMasterBus();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  o.type = type;
  o.frequency.value = freq;
  f.type = 'lowpass';
  f.frequency.setValueAtTime(freq * 8, time);
  f.frequency.exponentialRampToValueAtTime(freq * 2, time + dur * 0.3);
  g.gain.setValueAtTime(vol, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);
  o.connect(f);
  f.connect(g);
  g.connect(bus);
  o.start(time);
  o.stop(time + dur);
}

export function playPluck(freq: number, dur: number = 0.6, vol: number = 0.3, t?: number): void {
  if (sfxOff()) return;
  const ctx = getAudioCtx();
  const time = t || ctx.currentTime;
  const bus = getMasterBus();
  const period = 1 / freq;
  const samples = Math.floor(ctx.sampleRate * period);
  const b = ctx.createBuffer(1, samples, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < samples; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = b;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq * 3;
  src.connect(f);
  f.connect(g);
  g.connect(bus);
  src.start(time);
  src.stop(time + dur);
}

export function playBell(freq: number, dur: number = 2.0, vol: number = 0.25, t?: number): void {
  if (sfxOff()) return;
  const ctx = getAudioCtx();
  const time = t || ctx.currentTime;
  const bus = getMasterBus();
  const car = ctx.createOscillator();
  const mod = ctx.createOscillator();
  const modGain = ctx.createGain();
  const outGain = ctx.createGain();
  car.type = 'sine';
  mod.type = 'sine';
  car.frequency.value = freq;
  mod.frequency.value = freq * 3.5;
  modGain.gain.value = freq * 4;
  outGain.gain.setValueAtTime(vol, time);
  outGain.gain.exponentialRampToValueAtTime(0.001, time + dur);
  mod.connect(modGain);
  modGain.connect(car.frequency);
  car.connect(outGain);
  outGain.connect(bus);
  mod.start(time);
  car.start(time);
  mod.stop(time + dur);
  car.stop(time + dur);
}

export function playMarimba(freq: number, dur: number = 0.3, vol: number = 0.3, t?: number): void {
  if (sfxOff()) return;
  const ctx = getAudioCtx();
  const time = t || ctx.currentTime;
  const bus = getMasterBus();
  // fundamental
  const o1 = ctx.createOscillator();
  const g1 = ctx.createGain();
  o1.type = 'sine';
  o1.frequency.value = freq;
  g1.gain.setValueAtTime(vol, time);
  g1.gain.exponentialRampToValueAtTime(0.001, time + dur);
  o1.connect(g1);
  g1.connect(bus);
  o1.start(time);
  o1.stop(time + dur);
  // 2nd harmonic (much quieter, wooden overtone)
  const o2 = ctx.createOscillator();
  const g2 = ctx.createGain();
  o2.type = 'sine';
  o2.frequency.value = freq * 4;
  g2.gain.setValueAtTime(vol * 0.15, time);
  g2.gain.exponentialRampToValueAtTime(0.001, time + dur * 0.6);
  o2.connect(g2);
  g2.connect(bus);
  o2.start(time);
  o2.stop(time + dur * 0.6);
}

export function playOrgan(freq: number, dur: number = 1.0, vol: number = 0.2, t?: number): void {
  if (sfxOff()) return;
  const ctx = getAudioCtx();
  const time = t || ctx.currentTime;
  const bus = getMasterBus();
  const harmonics = [1, 2, 3, 4, 5];
  const gains = [1, 0.5, 0.3, 0.2, 0.1];
  const outGain = ctx.createGain();
  outGain.gain.setValueAtTime(vol, time);
  outGain.gain.exponentialRampToValueAtTime(0.001, time + dur);
  outGain.connect(bus);
  // tremolo
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.type = 'sine';
  lfo.frequency.value = 5;
  lfoGain.gain.value = 0.08;
  lfo.connect(lfoGain);
  lfoGain.connect(outGain.gain);
  lfo.start(time);
  lfo.stop(time + dur);
  harmonics.forEach((h, i) => {
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = freq * h;
    const g = ctx.createGain();
    g.gain.value = gains[i];
    o.connect(g);
    g.connect(outGain);
    o.start(time);
    o.stop(time + dur);
  });
}

export function playBass(freq: number, dur: number = 0.4, vol: number = 0.35, t?: number): void {
  if (sfxOff()) return;
  const ctx = getAudioCtx();
  const time = t || ctx.currentTime;
  const bus = getMasterBus();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  o.type = 'sawtooth';
  o.frequency.value = freq;
  f.type = 'lowpass';
  f.frequency.setValueAtTime(freq * 10, time);
  f.frequency.exponentialRampToValueAtTime(freq * 2, time + 0.1);
  g.gain.setValueAtTime(vol, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);
  o.connect(f);
  f.connect(g);
  g.connect(bus);
  o.start(time);
  o.stop(time + dur);
}

export function playLead(freq: number, dur: number = 0.3, vol: number = 0.25, t?: number, glide: number = 0): void {
  if (sfxOff()) return;
  const ctx = getAudioCtx();
  const time = t || ctx.currentTime;
  const bus = getMasterBus();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(freq, time);
  if (glide > 0) {
    o.frequency.setValueAtTime(freq * 0.5, time);
    o.frequency.exponentialRampToValueAtTime(freq, time + glide);
  }
  f.type = 'lowpass';
  f.Q.value = 4;
  f.frequency.setValueAtTime(freq * 6, time);
  f.frequency.exponentialRampToValueAtTime(freq * 3, time + dur * 0.5);
  g.gain.setValueAtTime(vol, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);
  o.connect(f);
  f.connect(g);
  g.connect(bus);
  o.start(time);
  o.stop(time + dur);
}

export function playPad(freqs: number[], dur: number = 2.0, vol: number = 0.15, t?: number): void {
  if (sfxOff()) return;
  const ctx = getAudioCtx();
  const time = t || ctx.currentTime;
  const bus = getMasterBus();
  const outGain = ctx.createGain();
  outGain.gain.setValueAtTime(vol, time);
  outGain.gain.exponentialRampToValueAtTime(0.001, time + dur);
  outGain.connect(bus);
  freqs.forEach((freq) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = 1 / freqs.length;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq * 4;
    o.connect(f);
    f.connect(g);
    g.connect(outGain);
    o.start(time);
    o.stop(time + dur);
  });
  // slow chorus-like LFO
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.type = 'sine';
  lfo.frequency.value = 0.3;
  lfoGain.gain.value = 0.02;
  lfo.connect(lfoGain);
  lfoGain.connect(outGain.gain);
  lfo.start(time);
  lfo.stop(time + dur);
}

/* ===== EFFECTS ===== */

export function createReverb(ctx: AudioContext, duration: number = 1.5, decay: number = 0.8): ConvolverNode {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const impulse = ctx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);
  for (let i = 0; i < length; i++) {
    const n = length - i;
    left[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay);
    right[i] = (Math.random() * 2 - 1) * Math.pow(n / length, decay);
  }
  const convolver = ctx.createConvolver();
  convolver.buffer = impulse;
  return convolver;
}

export function createDelay(
  ctx: AudioContext,
  delayTime: number = 0.3,
  feedback: number = 0.35
): { input: GainNode; output: GainNode } {
  const input = ctx.createGain();
  const delay = ctx.createDelay(1.0);
  const feedbackGain = ctx.createGain();
  const output = ctx.createGain();
  delay.delayTime.value = delayTime;
  feedbackGain.gain.value = feedback;
  input.connect(delay);
  delay.connect(feedbackGain);
  feedbackGain.connect(delay);
  delay.connect(output);
  return { input, output };
}

export function createChorus(
  ctx: AudioContext,
  rate: number = 2.0,
  depth: number = 0.015
): { input: GainNode; output: GainNode } {
  const input = ctx.createGain();
  const delay = ctx.createDelay(0.05);
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  const output = ctx.createGain();
  lfo.type = 'sine';
  lfo.frequency.value = rate;
  lfoGain.gain.value = depth;
  delay.delayTime.value = 0.015;
  lfo.connect(lfoGain);
  lfoGain.connect(delay.delayTime);
  input.connect(delay);
  delay.connect(output);
  lfo.start();
  return { input, output };
}

/* ===== GAME SFX ===== */

export function playCombo(count: number): void {
  if (sfxOff()) return;
  const ctx = getAudioCtx();
  const t = ctx.currentTime;
  const base = 523.25;
  const notes = [0, 2, 4, 5, 7, 9, 11, 12];
  const maxNotes = Math.min(count + 2, 8);
  for (let i = 0; i < maxNotes; i++) {
    const f = base * Math.pow(2, notes[i] / 12);
    playMarimba(f, 0.2, 0.25, t + i * 0.06);
  }
}

export function playBossWarning(): void {
  if (sfxOff()) return;
  const ctx = getAudioCtx();
  const t = ctx.currentTime;
  const chords = [
    [110, 138.59, 164.81],
    [82.41, 110, 138.59],
  ];
  chords.forEach((chord, ci) => {
    chord.forEach((freq) => {
      playOrgan(freq, 1.0, 0.15, t + ci * 0.6);
    });
  });
}

export function playCountdown(): void {
  if (sfxOff()) return;
  const ctx = getAudioCtx();
  playMarimba(880, 0.08, 0.15, ctx.currentTime);
}

export function playPerfect(): void {
  if (sfxOff()) return;
  const ctx = getAudioCtx();
  const t = ctx.currentTime;
  const arp = [523.25, 659.25, 783.99, 1046.5, 1318.51];
  arp.forEach((f, i) => playBell(f, 1.5, 0.2, t + i * 0.12));
  playPad([392.0, 523.25, 659.25], 2.5, 0.12, t);
}

export function playFail(): void {
  if (sfxOff()) return;
  const ctx = getAudioCtx();
  const t = ctx.currentTime;
  playTone(200, 0.3, 'square', 0.25, t);
  playTone(150, 0.4, 'square', 0.2, t + 0.15);
  playTone(100, 0.5, 'sawtooth', 0.15, t + 0.3);
}

export function playMenuSwipe(): void {
  if (sfxOff()) return;
  const ctx = getAudioCtx();
  const t = ctx.currentTime;
  const bus = getMasterBus();
  const bs = Math.floor(ctx.sampleRate * 0.15);
  const b = ctx.createBuffer(1, bs, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < bs; i++) {
    const env = 1 - i / bs;
    d[i] = (Math.random() * 2 - 1) * env;
  }
  const n = ctx.createBufferSource();
  n.buffer = b;
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(2000, t);
  f.frequency.exponentialRampToValueAtTime(8000, t + 0.15);
  g.gain.setValueAtTime(0.15, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  n.connect(f);
  f.connect(g);
  g.connect(bus);
  n.start(t);
  n.stop(t + 0.15);
}
