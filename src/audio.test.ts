import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./synth', () => ({
  playPerfect: vi.fn(),
  playFail: vi.fn(),
  playSubtractiveSynth: vi.fn(),
  playPluck: vi.fn(),
  playBell: vi.fn(),
  playMarimba: vi.fn(),
  playOrgan: vi.fn(),
  playBass: vi.fn(),
  playLead: vi.fn(),
  playPad: vi.fn(),
  createReverb: vi.fn(),
  createDelay: vi.fn(),
  createChorus: vi.fn(),
  playCombo: vi.fn(),
  playBossWarning: vi.fn(),
  playCountdown: vi.fn(),
  playMenuSwipe: vi.fn(),
  playStar: vi.fn(),
  playLevelComplete: vi.fn(),
  playAchievement: vi.fn(),
  playUnlock: vi.fn(),
  playClick: vi.fn(),
  schedule808Kick: vi.fn(),
  scheduleConga: vi.fn(),
  scheduleClap: vi.fn(),
  scheduleTom: vi.fn(),
  scheduleRimshot: vi.fn(),
  scheduleOpenHihat: vi.fn(),
  scheduleCrash: vi.fn(),
}));

class MockAudioContext {
  state = 'suspended';
  sampleRate = 44100;
  currentTime = 0;
  destination = { connect: vi.fn(), disconnect: vi.fn() };

  createOscillator = vi.fn(() => ({
    type: 'sine',
    frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }));

  createGain = vi.fn(() => ({
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));

  createBiquadFilter = vi.fn(() => ({
    type: 'lowpass',
    frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    Q: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));

  createDynamicsCompressor = vi.fn(() => ({
    threshold: { value: 0 },
    knee: { value: 0 },
    ratio: { value: 0 },
    attack: { value: 0 },
    release: { value: 0 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));

  createBuffer = vi.fn(() => ({
    getChannelData: vi.fn(() => new Float32Array(100)),
    sampleRate: 44100,
    length: 100,
    duration: 100 / 44100,
    numberOfChannels: 1,
  }));

  createBufferSource = vi.fn(() => ({
    buffer: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }));

  createAnalyser = vi.fn(() => ({
    fftSize: 256,
    frequencyBinCount: 128,
    getByteFrequencyData: vi.fn(),
    getByteTimeDomainData: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));

  resume = vi.fn(() => Promise.resolve());
  suspend = vi.fn(() => Promise.resolve());
  close = vi.fn(() => Promise.resolve());
}

describe('audio', () => {
  let audioModule: typeof import('./audio');
  let storeModule: typeof import('./store');

  beforeEach(async () => {
    vi.resetModules();
    // @ts-ignore
    globalThis.AudioContext = MockAudioContext;
    // @ts-ignore
    globalThis.webkitAudioContext = MockAudioContext;

    storeModule = await import('./store');
    storeModule.Store.state.settings.sfx = true;

    audioModule = await import('./audio');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('getAudioCtx creates an AudioContext', () => {
    const ctx = audioModule.getAudioCtx();
    expect(ctx).toBeInstanceOf(MockAudioContext);
    expect(ctx.state).toBe('suspended');
    expect(ctx.resume).toHaveBeenCalled();
  });

  it('playCorrect does not throw when sfx is enabled', () => {
    expect(() => audioModule.playCorrect()).not.toThrow();
  });

  it('playWrong does not throw when sfx is enabled', () => {
    expect(() => audioModule.playWrong()).not.toThrow();
  });

  it('setSoundPack / getSoundPack work correctly', () => {
    expect(audioModule.getSoundPack()).toBe('mathRock');
    audioModule.setSoundPack('minimal');
    expect(audioModule.getSoundPack()).toBe('minimal');
    audioModule.setSoundPack('chiptune');
    expect(audioModule.getSoundPack()).toBe('chiptune');
  });
});
