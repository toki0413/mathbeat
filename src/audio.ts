import { Store } from './store';
import { SOUND_PACKS, DEFAULT_SOUND_PACK } from './sound-packs';
import {
  playSubtractiveSynth,
  playPluck,
  playBell,
  playMarimba,
  playOrgan,
  playBass,
  playLead,
  playPad,
  playPerfect,
  playFail,
} from './synth';
import { Transport, createTransport, stopAllTransports } from './core/transport';

export const EMBEDDED_SAMPLES: Record<string, string> = {
  kick: 'data:audio/wav;base64,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',
  snare:
    'data:audio/wav;base64,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',
  hihat:
    'data:audio/wav;base64,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',
};

export let sampleBuffers: Record<string, AudioBuffer> = {};

export async function loadEmbeddedSamples(): Promise<void> {
  const ctx = getAudioCtx();
  for (const [k, url] of Object.entries(EMBEDDED_SAMPLES)) {
    try {
      const r = await fetch(url);
      const ab = await r.arrayBuffer();
      sampleBuffers[k] = await ctx.decodeAudioData(ab);
    } catch (e) {
      console.warn('sample load failed', k, e);
    }
  }
}

export function playSample(name: string, time: number, vol?: number): void {
  if (Store.state.settings.sfx === false) return;
  const ctx = getAudioCtx();
  const buf = sampleBuffers[name];
  if (!buf) {
    scheduleFallbackDrum(name, time, vol);
    return;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = vol || 0.5;
  const bus = getMasterBus();
  src.connect(g);
  g.connect(bus);
  src.start(time);
}

export function scheduleFallbackDrum(name: string, time: number, vol?: number): void {
  if (name === 'kick') scheduleKickAt(time);
  else if (name === 'snare') scheduleSnareAt(time);
  else if (name === 'hihat') {
    const ctx = getAudioCtx();
    const bs = Math.floor(ctx.sampleRate * 0.03);
    const b = ctx.createBuffer(1, bs, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < bs; i++) d[i] = Math.random() * 2 - 1;
    const n = ctx.createBufferSource();
    n.buffer = b;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.1, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 8000;
    const bus = getMasterBus();
    n.connect(f);
    f.connect(g);
    g.connect(bus);
    n.start(time);
    n.stop(time + 0.03);
  }
}

/* ===== AUDIO ENGINE ===== */
export let audioCtx: AudioContext | null = null;
export let masterGain: GainNode | null = null;
export let masterCompressor: DynamicsCompressorNode | null = null;
export let bgmGain: GainNode | null = null;
export let analyser: AnalyserNode | null = null;
export let masterMuteGain: GainNode | null = null;

export function getAudioCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    masterCompressor = audioCtx.createDynamicsCompressor();
    masterCompressor.threshold.value = -10;
    masterCompressor.knee.value = 20;
    masterCompressor.ratio.value = 6;
    masterCompressor.attack.value = 0.003;
    masterCompressor.release.value = 0.1;
    masterGain = audioCtx.createGain();
    masterGain.gain.value = Store.state.settings.masterVolume ?? 0.8;
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    bgmGain = audioCtx.createGain();
    bgmGain.gain.value = 1.0;
    masterMuteGain = audioCtx.createGain();
    masterMuteGain.gain.value = 1.0;
    // BGM sub-bus -> compressor -> mute gate -> master -> analyser -> destination
    bgmGain.connect(masterCompressor);
    masterCompressor.connect(masterMuteGain);
    masterMuteGain.connect(masterGain);
    masterGain.connect(analyser);
    analyser.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/** 临时静音所有音频（毫秒），用于立即停止泄漏的已 schedule 节点 */
export function muteAllAudio(ms: number): void {
  if (!masterMuteGain || !audioCtx) return;
  const now = audioCtx.currentTime;
  masterMuteGain.gain.cancelScheduledValues(now);
  masterMuteGain.gain.setValueAtTime(0, now);
  masterMuteGain.gain.setValueAtTime(1, now + ms / 1000);
}

/** 设置主音量（0-1），持久化到存档 */
export function setMasterVolume(v: number): void {
  const vol = Math.max(0, Math.min(1, v));
  Store.state.settings.masterVolume = vol;
  Store.save();
  if (masterGain) {
    const ctx = masterGain.context;
    masterGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.02);
  }
}

export function getMasterVolume(): number {
  return Store.state.settings.masterVolume ?? 0.8;
}

export function getAnalyser(): AnalyserNode | null {
  getAudioCtx();
  return analyser;
}

let lastFlashTime = -1;
const FLASH_THROTTLE_MS = 80;

/** 在指定时间安排一次屏幕打击闪光反馈（节流，避免密集触发） */
function scheduleHitFlash(time: number, color: string): void {
  const ctx = getAudioCtx();
  const delay = Math.max(0, (time - ctx.currentTime) * 1000);
  // 忽略太远未来的闪光，避免 setTimeout 堆积
  if (delay > 2000) return;
  const scheduledWallTime = performance.now() + delay;
  if (scheduledWallTime - lastFlashTime < FLASH_THROTTLE_MS) return;
  lastFlashTime = scheduledWallTime;
  setTimeout(() => {
    const el = document.getElementById('hitFlashOverlay');
    if (!el) return;
    el.style.backgroundColor = color;
    el.style.opacity = '0.18';
    setTimeout(() => {
      el.style.opacity = '0';
    }, 90);
  }, delay);
}

/* ===== UNIFIED TRANSPORT ===== */
let sharedTransport: Transport | null = null;

export function getSharedTransport(bpm = 120, stepsPerBeat = 4): Transport {
  const ctx = getAudioCtx();
  if (!sharedTransport) {
    sharedTransport = createTransport(ctx, bpm, stepsPerBeat);
  } else {
    sharedTransport.setBpm(bpm);
    sharedTransport.setStepsPerBeat(stepsPerBeat);
  }
  return sharedTransport;
}

export function stopSharedTransport(): void {
  if (sharedTransport) {
    sharedTransport.stop();
    sharedTransport = null;
  }
  stopAllTransports();
}

let currentSoundPack = DEFAULT_SOUND_PACK;
export function setSoundPack(id: string): void {
  currentSoundPack = id;
}
export function getSoundPack(): string {
  return currentSoundPack;
}

export function getMasterBus(): DynamicsCompressorNode {
  getAudioCtx();
  return masterCompressor!;
}

export function scheduleKickAt(t: number): void {
  scheduleHitFlash(t, '#FF8C42');
  const pack = SOUND_PACKS[currentSoundPack];
  const kick = pack?.kick;
  if (sampleBuffers.kick) {
    playSample('kick', t, kick?.vol ?? 0.55);
    return;
  }
  const ctx = getAudioCtx();
  const bus = getMasterBus();
  const o = ctx.createOscillator(),
    g = ctx.createGain();
  o.type = kick?.oscType || 'sine';
  o.frequency.setValueAtTime(kick?.freqStart ?? 150, t);
  o.frequency.exponentialRampToValueAtTime(kick?.freqEnd ?? 30, t + (kick?.decay ?? 0.15));
  g.gain.setValueAtTime(kick?.vol ?? 0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + (kick?.decay ?? 0.3));
  o.connect(g);
  g.connect(bus);
  o.start(t);
  o.stop(t + (kick?.decay ?? 0.3));
}

export function scheduleSnareAt(t: number): void {
  scheduleHitFlash(t, '#4ECDC4');
  const pack = SOUND_PACKS[currentSoundPack];
  const snare = pack?.snare;
  if (sampleBuffers.snare) {
    playSample('snare', t, snare?.vol ?? 0.35);
    return;
  }
  const ctx = getAudioCtx();
  const bus = getMasterBus();
  const bs = Math.floor(ctx.sampleRate * (snare?.noiseDecay ?? 0.08));
  const b = ctx.createBuffer(1, bs, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < bs; i++) d[i] = Math.random() * 2 - 1;
  const n = ctx.createBufferSource();
  n.buffer = b;
  const g = ctx.createGain();
  g.gain.setValueAtTime(snare?.vol ?? 0.25, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + (snare?.noiseDecay ?? 0.12));
  const f = ctx.createBiquadFilter();
  f.type = snare?.filterType || 'highpass';
  f.frequency.value = snare?.filterFreq ?? 1000;
  n.connect(f);
  f.connect(g);
  g.connect(bus);
  n.start(t);
  n.stop(t + (snare?.noiseDecay ?? 0.12));
}

export function scheduleHihatAt(t: number): void {
  const pack = SOUND_PACKS[currentSoundPack];
  const hihat = pack?.hihat;
  if (sampleBuffers.hihat) {
    playSample('hihat', t, hihat?.vol ?? 0.18);
    return;
  }
  const ctx = getAudioCtx();
  const bus = getMasterBus();
  const bs = Math.floor(ctx.sampleRate * (hihat?.noiseDecay ?? 0.03));
  const b = ctx.createBuffer(1, bs, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < bs; i++) d[i] = Math.random() * 2 - 1;
  const n = ctx.createBufferSource();
  n.buffer = b;
  const g = ctx.createGain();
  g.gain.setValueAtTime(hihat?.vol ?? 0.1, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + (hihat?.noiseDecay ?? 0.03));
  const f = ctx.createBiquadFilter();
  f.type = hihat?.filterType || 'bandpass';
  f.frequency.value = hihat?.filterFreq ?? 8000;
  n.connect(f);
  f.connect(g);
  g.connect(bus);
  n.start(t);
  n.stop(t + (hihat?.noiseDecay ?? 0.03));
}

export function scheduleConga(t: number, vol?: number, freq?: number): void {
  const pack = SOUND_PACKS[currentSoundPack];
  const conga = pack?.conga;
  const ctx = getAudioCtx();
  const bus = getMasterBus();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  const f = freq ?? conga?.freqStart ?? 220;
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(conga?.freqEnd ?? 150, t + (conga?.decay ?? 0.15));
  g.gain.setValueAtTime(vol ?? conga?.vol ?? 0.35, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + (conga?.decay ?? 0.25));
  o.connect(g);
  g.connect(bus);
  o.start(t);
  o.stop(t + (conga?.decay ?? 0.25));
}

export function scheduleClap(t: number, vol?: number): void {
  const pack = SOUND_PACKS[currentSoundPack];
  const clap = pack?.clap;
  const ctx = getAudioCtx();
  const bus = getMasterBus();
  const decay = clap?.noiseDecay ?? 0.08;
  const filterFreq = clap?.filterFreq ?? 1800;
  const filterType = clap?.filterType || 'bandpass';
  const v = vol ?? clap?.vol ?? 0.3;
  const bs = Math.floor(ctx.sampleRate * decay);
  const b = ctx.createBuffer(1, bs, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < bs; i++) d[i] = Math.random() * 2 - 1;
  const n = ctx.createBufferSource();
  n.buffer = b;
  const g = ctx.createGain();
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + decay);
  const f = ctx.createBiquadFilter();
  f.type = filterType;
  f.frequency.value = filterFreq;
  f.Q.value = 1.5;
  n.connect(f);
  f.connect(g);
  g.connect(bus);
  n.start(t);
  n.stop(t + decay);
  for (let i = 1; i <= 2; i++) {
    const bs2 = Math.floor(ctx.sampleRate * 0.03);
    const b2 = ctx.createBuffer(1, bs2, ctx.sampleRate);
    const d2 = b2.getChannelData(0);
    for (let j = 0; j < bs2; j++) d2[j] = Math.random() * 2 - 1;
    const n2 = ctx.createBufferSource();
    n2.buffer = b2;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(v * 0.4, t + i * 0.015);
    g2.gain.exponentialRampToValueAtTime(0.001, t + i * 0.015 + 0.03);
    const f2 = ctx.createBiquadFilter();
    f2.type = filterType;
    f2.frequency.value = filterFreq;
    f2.Q.value = 1.5;
    n2.connect(f2);
    f2.connect(g2);
    g2.connect(bus);
    n2.start(t + i * 0.015);
    n2.stop(t + i * 0.015 + 0.03);
  }
}

export function scheduleTom(t: number, vol?: number, freq?: number): void {
  const pack = SOUND_PACKS[currentSoundPack];
  const tom = pack?.tom;
  const ctx = getAudioCtx();
  const bus = getMasterBus();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  const f = freq ?? tom?.freqStart ?? 120;
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(tom?.freqEnd ?? f * 0.5, t + (tom?.decay ?? 0.3));
  g.gain.setValueAtTime(vol ?? tom?.vol ?? 0.4, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + (tom?.decay ?? 0.4));
  o.connect(g);
  g.connect(bus);
  o.start(t);
  o.stop(t + (tom?.decay ?? 0.4));
}

export function scheduleRimshot(t: number, vol?: number): void {
  const pack = SOUND_PACKS[currentSoundPack];
  const rimshot = pack?.rimshot;
  const ctx = getAudioCtx();
  const bus = getMasterBus();
  const decay = rimshot?.noiseDecay ?? 0.02;
  const bs = Math.floor(ctx.sampleRate * decay);
  const b = ctx.createBuffer(1, bs, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < bs; i++) d[i] = Math.random() * 2 - 1;
  const n = ctx.createBufferSource();
  n.buffer = b;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol ?? rimshot?.vol ?? 0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + decay);
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = rimshot?.filterFreq ?? 4000;
  n.connect(f);
  f.connect(g);
  g.connect(bus);
  n.start(t);
  n.stop(t + decay);
}

export function scheduleOpenHihat(t: number, vol?: number): void {
  const pack = SOUND_PACKS[currentSoundPack];
  const openHihat = pack?.openHihat;
  const ctx = getAudioCtx();
  const bus = getMasterBus();
  const decay = openHihat?.noiseDecay ?? 0.2;
  const bs = Math.floor(ctx.sampleRate * decay);
  const b = ctx.createBuffer(1, bs, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < bs; i++) d[i] = Math.random() * 2 - 1;
  const n = ctx.createBufferSource();
  n.buffer = b;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol ?? openHihat?.vol ?? 0.15, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + decay);
  const f = ctx.createBiquadFilter();
  f.type = openHihat?.filterType || 'highpass';
  f.frequency.value = openHihat?.filterFreq ?? 6000;
  n.connect(f);
  f.connect(g);
  g.connect(bus);
  n.start(t);
  n.stop(t + decay);
}

export function scheduleCrash(t: number, vol?: number): void {
  const pack = SOUND_PACKS[currentSoundPack];
  const crash = pack?.crash;
  const ctx = getAudioCtx();
  const bus = getMasterBus();
  const decay = crash?.noiseDecay ?? 1.5;
  const bs = Math.floor(ctx.sampleRate * decay);
  const b = ctx.createBuffer(1, bs, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < bs; i++) d[i] = Math.random() * 2 - 1;
  const n = ctx.createBufferSource();
  n.buffer = b;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol ?? crash?.vol ?? 0.25, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + decay);
  const f = ctx.createBiquadFilter();
  f.type = crash?.filterType || 'highpass';
  f.frequency.value = crash?.filterFreq ?? 3000;
  n.connect(f);
  f.connect(g);
  g.connect(bus);
  n.start(t);
  n.stop(t + decay);
}

export function scheduleToneAt(freq: number, dur: number, type: OscillatorType, vol: number, t: number): void {
  const pack = SOUND_PACKS[currentSoundPack];
  const synthType = pack?.tone?.synthType;
  if (synthType) {
    switch (synthType) {
      case 'fm':
        playFMSynth(freq, dur, vol, t);
        return;
      case 'am':
        playAMSynth(freq, dur, vol, t);
        return;
      case 'subtractive':
        playSubtractiveSynth(freq, dur, vol, type, t);
        return;
      case 'pluck':
        playPluck(freq, dur, vol, t);
        return;
      case 'bell':
        playBell(freq, dur, vol, t);
        return;
      case 'marimba':
        playMarimba(freq, dur, vol, t);
        return;
      case 'organ':
        playOrgan(freq, dur, vol, t);
        return;
      case 'bass':
        playBass(freq, dur, vol, t);
        return;
      case 'lead':
        playLead(freq, dur, vol, t, 0);
        return;
      case 'pad':
        playPad([freq], dur, vol, t);
        return;
    }
  }
  const ctx = getAudioCtx();
  const bus = getMasterBus();
  const o = ctx.createOscillator(),
    g = ctx.createGain();
  o.type = type || 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol || 0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + (dur || 0.3));
  o.connect(g);
  g.connect(bus);
  o.start(t);
  o.stop(t + (dur || 0.3));
}

export function playTone(freq: number, dur?: number, type?: OscillatorType, vol?: number, time?: number): void {
  if (Store.state.settings.sfx === false) return;
  const ctx = getAudioCtx();
  const t = time || ctx.currentTime;
  scheduleToneAt(freq, dur || 0.3, type || 'sine', vol || 0.3, t);
}

function haptic(pattern: number[]) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      /* noop */
    }
  }
}

export function playCorrect(): void {
  if (Store.state.settings.sfx === false) return;
  playPerfect();
  haptic([40, 40, 40]);
}

export function playWrong(): void {
  if (Store.state.settings.sfx === false) return;
  playFail();
  haptic([120]);
}

export let bgMusicPlaying = false;
export let bgMusicStep = 0;
export let bgMusicInterval: ReturnType<typeof setTimeout> | null = null;
export let bgMusicNodes: { node: AudioNode; stopTime: number }[] = [];
export let bgMusicUserMuted = false;
export let bgMusicAutoStarted = false;

const BGM_LOOKAHEAD = 0.15;
const BGM_POLL_MS = 60;
const BGM_CHORD_INTERVAL = 2.6;

function bgmScheduleChord(ctx: AudioContext, time: number, root: number, step: number): number {
  const bus = bgmGain;
  if (!bus) return 0;
  const intervals = [
    [0, 4, 7],
    [0, 3, 7],
    [0, 4, 7, 11],
    [0, 5, 7],
  ][step % 4];
  const stopTime = time + 2.5;
  intervals.forEach((iv, i) => {
    const f = root * Math.pow(2, iv / 12);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = i === 0 ? 'triangle' : 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(0.045 / (i + 1), time + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, stopTime);
    o.connect(g);
    g.connect(bus);
    o.start(time);
    o.stop(stopTime);
    bgMusicNodes.push({ node: o, stopTime }, { node: g, stopTime });
  });
  return intervals.length;
}

/** 立即停止所有 BGM 节点 */
function stopAllBgmNodes(): void {
  const now = audioCtx ? audioCtx.currentTime : 0;
  bgMusicNodes.forEach(function (entry) {
    try {
      if ((entry.node as any).stop) (entry.node as any).stop(now);
      entry.node.disconnect();
    } catch (e) {}
  });
  bgMusicNodes = [];
}

function bgmCleanupNodes() {
  // 清理已停止的节点引用，避免数组无限增长
  const ctx = getAudioCtx();
  const now = ctx.currentTime;
  bgMusicNodes = bgMusicNodes.filter((entry) => {
    if (entry.stopTime < now) {
      try {
        entry.node.disconnect();
      } catch (e) {}
      return false;
    }
    return true;
  });
}

export function startBgMusic(): void {
  if (bgMusicPlaying || bgMusicUserMuted) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  bgMusicPlaying = true;
  const btn = document.getElementById('bgMusicBtn');
  if (btn) {
    btn.textContent = '🔊';
    btn.classList.add('on');
    btn.classList.remove('off');
  }
  const roots = [261.63, 329.63, 392.0];
  let rootIdx = 0;
  let step = 0;
  let nextChordTime = ctx.currentTime + 0.05;
  bgmCleanupNodes();

  function scheduler() {
    if (!bgMusicPlaying) return;
    // 限制每次最多 schedule 1 个 chord，防止标签页切回时爆发式 schedule
    let scheduled = 0;
    while (nextChordTime < ctx.currentTime + BGM_LOOKAHEAD && scheduled < 1) {
      const root = roots[rootIdx % roots.length];
      bgmScheduleChord(ctx, nextChordTime, root, step);
      rootIdx++;
      step++;
      nextChordTime += BGM_CHORD_INTERVAL;
      scheduled++;
    }
    // 定期清理已停止的 BGM 节点，防止数组无限增长
    if (step % 5 === 0) bgmCleanupNodes();
    bgMusicInterval = setTimeout(scheduler, BGM_POLL_MS);
  }
  scheduler();
}

export function stopBgMusic(): void {
  if (!bgMusicPlaying) return;
  bgMusicPlaying = false;
  if (bgMusicInterval) {
    clearTimeout(bgMusicInterval);
    bgMusicInterval = null;
  }
  stopAllBgmNodes();
  // 额外安全网：临时静音 500ms，覆盖已 schedule 但尚未停止的节点
  muteAllAudio(500);
  const btn = document.getElementById('bgMusicBtn');
  if (btn) {
    btn.textContent = '🔇';
    btn.classList.remove('on');
    btn.classList.add('off');
  }
}

export function toggleBgMusic(): void {
  if (bgMusicPlaying) {
    bgMusicUserMuted = true;
    stopBgMusic();
  } else {
    bgMusicUserMuted = false;
    startBgMusic();
  }
}

export function hideBgmHint(): void {
  const h = document.getElementById('bgmHint');
  if (h) h.classList.remove('show');
}

export function showBgmHint(): void {
  const h = document.getElementById('bgmHint');
  if (h && !bgMusicAutoStarted && !bgMusicUserMuted) h.classList.add('show');
}

/* ===== ENHANCED SYNTHESIS ===== */
export function playFMSynth(freq: number, dur: number = 0.3, vol: number = 0.3, t?: number): void {
  if (Store.state.settings.sfx === false) return;
  const ctx = getAudioCtx();
  const time = t || ctx.currentTime;
  const bus = getMasterBus();
  const carrier = ctx.createOscillator();
  const modulator = ctx.createOscillator();
  const modGain = ctx.createGain();
  const outGain = ctx.createGain();
  carrier.type = 'sine';
  modulator.type = 'sine';
  carrier.frequency.value = freq;
  modulator.frequency.value = freq * 2.5;
  modGain.gain.value = freq * 1.5;
  outGain.gain.setValueAtTime(vol, time);
  outGain.gain.exponentialRampToValueAtTime(0.001, time + dur);
  modulator.connect(modGain);
  modGain.connect(carrier.frequency);
  carrier.connect(outGain);
  outGain.connect(bus);
  modulator.start(time);
  carrier.start(time);
  modulator.stop(time + dur);
  carrier.stop(time + dur);
}

export function playAMSynth(freq: number, dur: number = 0.3, vol: number = 0.3, t?: number): void {
  if (Store.state.settings.sfx === false) return;
  const ctx = getAudioCtx();
  const time = t || ctx.currentTime;
  const bus = getMasterBus();
  const carrier = ctx.createOscillator();
  const modulator = ctx.createOscillator();
  const modGain = ctx.createGain();
  const outGain = ctx.createGain();
  carrier.type = 'triangle';
  modulator.type = 'sine';
  carrier.frequency.value = freq;
  modulator.frequency.value = freq * 0.5;
  modGain.gain.value = 0.5;
  outGain.gain.setValueAtTime(vol, time);
  outGain.gain.exponentialRampToValueAtTime(0.001, time + dur);
  modulator.connect(modGain);
  modGain.connect(outGain.gain);
  carrier.connect(outGain);
  outGain.connect(bus);
  modulator.start(time);
  carrier.start(time);
  modulator.stop(time + dur);
  carrier.stop(time + dur);
}

export function playNoiseBurst(dur: number = 0.05, vol: number = 0.2, t?: number): void {
  if (Store.state.settings.sfx === false) return;
  const ctx = getAudioCtx();
  const time = t || ctx.currentTime;
  const bus = getMasterBus();
  const bs = Math.floor(ctx.sampleRate * dur);
  const b = ctx.createBuffer(1, bs, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < bs; i++) d[i] = Math.random() * 2 - 1;
  const n = ctx.createBufferSource();
  n.buffer = b;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);
  n.connect(g);
  g.connect(bus);
  n.start(time);
  n.stop(time + dur);
}

/* ===== UI FEEDBACK SFX ===== */
export function playClick(): void {
  if (Store.state.settings.sfx === false) return;
  const ctx = getAudioCtx();
  playTone(880, 0.05, 'sine', 0.08, ctx.currentTime);
}

export function playUnlock(): void {
  if (Store.state.settings.sfx === false) return;
  const ctx = getAudioCtx();
  const t = ctx.currentTime;
  playTone(523.25, 0.15, 'sine', 0.3, t);
  playTone(659.25, 0.15, 'sine', 0.3, t + 0.1);
  playTone(783.99, 0.2, 'sine', 0.3, t + 0.2);
  playTone(1046.5, 0.3, 'sine', 0.3, t + 0.3);
}

export function playAchievement(): void {
  if (Store.state.settings.sfx === false) return;
  const ctx = getAudioCtx();
  const t = ctx.currentTime;
  playFMSynth(523.25, 0.2, 0.25, t);
  playFMSynth(659.25, 0.2, 0.25, t + 0.15);
  playFMSynth(783.99, 0.2, 0.25, t + 0.3);
  playFMSynth(1046.5, 0.4, 0.25, t + 0.45);
}

export function playStar(): void {
  if (Store.state.settings.sfx === false) return;
  const ctx = getAudioCtx();
  playTone(880, 0.12, 'sine', 0.2, ctx.currentTime);
}

export function playLevelComplete(): void {
  if (Store.state.settings.sfx === false) return;
  const ctx = getAudioCtx();
  const t = ctx.currentTime;
  playTone(392.0, 0.15, 'sine', 0.25, t);
  playTone(523.25, 0.15, 'sine', 0.25, t + 0.12);
  playTone(659.25, 0.15, 'sine', 0.25, t + 0.24);
  playTone(783.99, 0.3, 'sine', 0.25, t + 0.36);
}

/* Re-export advanced synthesis */
export * from './synth';
