import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Store, DEFAULT_STATE } from './store';
import { checkAchievements } from './game-engine';

vi.mock('./audio', () => ({
  stopBgMusic: vi.fn(),
  playPerfect: vi.fn(),
  playCombo: vi.fn(),
  playAchievement: vi.fn(),
  stopSharedTransport: vi.fn(),
  getAudioCtx: vi.fn(),
}));

vi.mock('./ui-render', () => ({
  showAchievementPopup: vi.fn(),
  showScreen: vi.fn(),
  showBossProblem: vi.fn(),
  showTutorial: vi.fn(),
  closeEduCard: vi.fn(),
  closeTutorial: vi.fn(),
  closeWhy: vi.fn(),
  showHintFloat: vi.fn(),
  updateDailyBanner: vi.fn(),
  renderContinueBar: vi.fn(),
  renderHome: vi.fn(),
}));

vi.mock('./fx/particles', () => ({
  spawnConfetti: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock('./daily', () => ({ stopDailyPlay: vi.fn() }));
vi.mock('./science', () => ({ stopSciencePlay: vi.fn() }));

vi.mock('./storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./storage')>()),
  localGet: vi.fn(() => []),
}));

function resetStore() {
  Store.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  Store.listeners = [];
  Store._idbReady = false;
}

describe('checkAchievements', () => {
  beforeEach(() => {
    resetStore();
  });

  it('awards mastery achievements when all levels in a world have 3 stars', () => {
    Store.state.progress = {
      '1-1': 3,
      '1-2': 3,
      '1-3': 3,
      '1-4': 3,
      '1-5': 3,
      '1-B': 3,
    };
    checkAchievements();
    expect(Store.state.achievements).toContain('mastery_world1');
    expect(Store.state.achievements).not.toContain('mastery_world2');
  });

  it('awards perfect_all_bosses only when every boss has 3 stars', () => {
    const bosses = ['1-B', '2-B', '3-B', '4-B', '5-B', '6-B', '7-B', '8-B'];
    bosses.forEach((id) => (Store.state.progress[id] = 3));
    checkAchievements();
    expect(Store.state.achievements).toContain('perfect_all_bosses');
  });

  it('does not award perfect_all_bosses if a boss is missing 3 stars', () => {
    Store.state.progress = { '1-B': 3, '2-B': 2 };
    checkAchievements();
    expect(Store.state.achievements).not.toContain('perfect_all_bosses');
  });

  it('awards endless score achievements', () => {
    Store.state.endlessStats = { bestScore: 75, totalRounds: 10, totalCorrect: 8, totalQuestions: 10, bestCombo: 5 };
    checkAchievements();
    expect(Store.state.achievements).toContain('endless_50');
    expect(Store.state.achievements).not.toContain('endless_100');
  });

  it('awards explorer achievements from state flags', () => {
    Store.state.importedSampleId = 'fibonacci-groove';
    Store.state.sharedComposer = true;
    Store.state.exportedScience = true;
    Store.state.customLevels = [{ id: 'c1', name: 'test', worldId: 1, desc: '', createdAt: '' }];
    checkAchievements();
    expect(Store.state.achievements).toContain('import_sample');
    expect(Store.state.achievements).toContain('share_composer');
    expect(Store.state.achievements).toContain('export_science');
    expect(Store.state.achievements).toContain('create_custom_level');
  });
});
