import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_STATE, LS_KEYS, Store, validateSaveData, runMigrations, CURRENT_SAVE_VERSION } from './store';

vi.mock('./storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./storage')>()),
  idbGet: vi.fn(() => Promise.resolve(null)),
  idbSet: vi.fn(() => Promise.resolve(true)),
  idbDelete: vi.fn(() => Promise.resolve(true)),
  migrateFromLocalStorage: vi.fn(() => Promise.resolve(false)),
}));

describe('Store', () => {
  beforeEach(() => {
    Store.state = Object.assign({}, DEFAULT_STATE);
    Store.listeners = [];
    Store._idbReady = false;
    localStorage.clear();
  });

  it('DEFAULT_STATE has correct initial values', () => {
    expect(DEFAULT_STATE.screen).toBe('home');
    expect(DEFAULT_STATE.currentWorld).toBe(0);
    expect(DEFAULT_STATE.currentLevel).toBe(0);
    expect(DEFAULT_STATE.settings.bgm).toBe(true);
    expect(DEFAULT_STATE.settings.sfx).toBe(true);
    expect(DEFAULT_STATE.settings.difficulty).toBe('auto');
    expect(DEFAULT_STATE.combo).toBe(0);
    expect(DEFAULT_STATE.bestCombo).toBe(0);
    expect(DEFAULT_STATE.unlocks.drums).toBe(true);
    expect(DEFAULT_STATE.unlocks.euclidean).toBe(true);
    expect(DEFAULT_STATE.unlocks.bass).toBe(false);
    expect(DEFAULT_STATE.unlocks.melody).toBe(false);
    expect(DEFAULT_STATE.dailyStreak).toBe(0);
    expect(DEFAULT_STATE.dailyLastDate).toBe('');
    expect(DEFAULT_STATE.achievements).toEqual([]);
    expect(DEFAULT_STATE.scienceCompositions).toEqual([]);
  });

  it('validateSaveData returns true for valid data, false for invalid', () => {
    expect(validateSaveData(null)).toBe(false);
    expect(validateSaveData(undefined)).toBe(false);
    expect(validateSaveData('string')).toBe(false);
    expect(validateSaveData(123)).toBe(false);
    expect(validateSaveData({})).toBe(false);
    expect(validateSaveData({ version: '1.0' })).toBe(false);
    expect(validateSaveData({ progress: {} })).toBe(false);
    expect(validateSaveData({ version: '1.0', progress: {} })).toBe(true);
    expect(validateSaveData({ version: '1.0', progress: { '1-1': 3 } })).toBe(true);
    expect(validateSaveData({ version: 1, progress: {} })).toBe(false);
  });

  it('Store.load() initializes state correctly from localStorage', () => {
    const saved = {
      screen: 'world',
      currentWorld: 2,
      currentLevel: 5,
      combo: 10,
      bestCombo: 20,
      progress: { '1-1': 3 },
    };
    localStorage.setItem(LS_KEYS.STATE, JSON.stringify(saved));
    Store.load();
    expect(Store.state.screen).toBe('world');
    expect(Store.state.currentWorld).toBe(2);
    expect(Store.state.currentLevel).toBe(5);
    expect(Store.state.combo).toBe(10);
    expect(Store.state.bestCombo).toBe(20);
    expect(Store.state.progress).toEqual({ '1-1': 3 });
  });

  it('Store.save() persists state to localStorage', () => {
    Store.state.screen = 'level';
    Store.state.currentWorld = 1;
    Store.state.currentLevel = 3;
    Store.state.combo = 5;
    Store.save();
    Store._flushSave();
    const saved = JSON.parse(localStorage.getItem(LS_KEYS.STATE) || '{}');
    expect(saved.screen).toBe('level');
    expect(saved.currentWorld).toBe(1);
    expect(saved.currentLevel).toBe(3);
    expect(saved.combo).toBe(5);
    expect(saved.scienceCompositions).toBeUndefined();
  });

  it('LS_KEYS has all expected keys', () => {
    expect(LS_KEYS.STATE).toBe('mathbeat_state');
    expect(LS_KEYS.UNLOCKS).toBe('mathbeat_unlocks');
    expect(LS_KEYS.LANG).toBe('mathbeat_lang');
    expect(LS_KEYS.SCIENCE_COMP).toBe('mathbeat_science_compositions');
    expect(LS_KEYS.DIARY).toBe('mathbeat_diary');
    expect(LS_KEYS.SCIENCE_EXPORT).toBe('mathbeat_science_export');
    expect(LS_KEYS.DEMO_IMPORT).toBe('mathbeat_demo_import');
    expect(LS_KEYS.ACHIEVEMENTS).toBe('mathbeat_achievements');
  });

  it('runMigrations fills missing fields and upgrades version', () => {
    const legacy: Record<string, unknown> = { version: '0.9', progress: { '1-1': 3 } };
    runMigrations(legacy);
    expect(legacy.version).toBe(CURRENT_SAVE_VERSION);
    expect(legacy.unlocks).toEqual(DEFAULT_STATE.unlocks);
    expect(legacy.settings).toEqual(DEFAULT_STATE.settings);
    expect(legacy.combo).toBe(0);
    expect(legacy.diary).toEqual([]);
    expect(legacy.lastWorld).toBe(0);
    expect(legacy.lastLevel).toBe('');
  });

  it('Store.load() migrates legacy saves without version', () => {
    const saved = { progress: { '1-1': 3 } };
    localStorage.setItem(LS_KEYS.STATE, JSON.stringify(saved));
    Store.load();
    expect(Store.state.version).toBe(CURRENT_SAVE_VERSION);
    expect(Store.state.progress).toEqual({ '1-1': 3 });
    expect(Store.state.unlocks).toEqual(DEFAULT_STATE.unlocks);
    expect(Store.state.settings).toEqual(DEFAULT_STATE.settings);
  });

  it('runMigrations preserves future versions instead of downgrading', () => {
    const future: Record<string, unknown> = { version: '9.9', progress: { '1-1': 3 }, futureField: true };
    runMigrations(future);
    expect(future.version).toBe('9.9');
    expect(future.futureField).toBe(true);
  });
});
