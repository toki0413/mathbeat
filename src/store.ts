import { idbGet, idbSet, idbDelete, migrateFromLocalStorage } from './storage';
import { t } from './i18n';
import { showToast, showConfirm } from './ui-feedback';
import { LS_KEYS } from './storage-keys';
import { validateGameState, safeParseAndValidate } from './schema';

export interface Settings {
  bgm: boolean;
  sfx: boolean;
  difficulty: 'easy' | 'auto' | 'hard';
  soundPack: string;
  masterVolume: number;
  /** 听障视觉节拍模式：开启后节拍会以视觉闪烁/缩放呈现，不依赖音频（WCAG 1.4.2 替代） */
  visualBeat?: boolean;
}

export interface GameState {
  version: string;
  screen: string;
  currentWorld: number;
  currentLevel: number;
  progress: Record<string, number>;
  unlocks: Record<string, boolean>;
  scienceCompositions: unknown[];
  diary: unknown[];
  settings: Settings;
  combo: number;
  bestCombo: number;
  achievements: string[];
  leaderboard: Record<string, unknown>;
  adaptiveHistory: unknown[];
  dailyStreak: number;
  dailyLastDate: string;
  dailyTypesCompleted: string[];
  dailyWeekCounts: Record<string, number>;
  scienceTypesUsed: string[];
  samplesPlayed: string[];
  levelHints: Record<string, number>;
  bossTimes: Record<string, { elapsed: number; total: number }>;
  luckyStreak: number;
  w3BossPerfect: boolean;
  noHintWorld: boolean;
  pendingBoss: string | null;
  onboardingDone: boolean;
  lastWorld: number;
  lastLevel: string;
  classData?: unknown[];
  endlessStats?: {
    bestScore: number;
    totalRounds: number;
    totalCorrect: number;
    totalQuestions: number;
    bestCombo: number;
  };
  customLevels?: {
    id: string;
    name: string;
    worldId: number;
    desc: string;
    a?: number;
    b?: number;
    motif?: number[];
    ops?: string[];
    createdAt: string;
  }[];
  composerExported?: boolean;
  importedSampleId?: string;
  sharedComposer?: boolean;
  exportedScience?: boolean;
  // phase-2 interaction tracking
  w3RatiosHeard?: string[];
  w2ReflectionAxisUsed?: boolean;
  w2OriginalReflectionPlayed?: boolean;
  w6RecursiveLayersUsed?: boolean;
  w7MarkovEdited?: boolean;
  w8BossCoveredAll?: boolean;
  // Harmonics Lab (Fourier / additive synthesis) tracking
  waveLabChallengesDone?: number;
  // 方向3：社交分享与激励循环
  weeklyLeaderboard?: Record<string, WeeklyScoreEntry[]>;
  importedChallengeCodes?: string[];
  lastCheckinPromptDate?: string;
  // 方向4：个性化学习路径
  wrongAnswerHistory?: WrongAnswerRecord[];
  learningGoal?: LearningGoal;
  // 对标成熟竞品打磨：XP 与等级系统 + 连胜护盾
  xp?: number; // 累积 XP（单调递增）
  level?: number; // 当前等级（1-99，由 xp 派生但缓存）
  streakFreezes?: number; // 持有护盾数（上限 3）
  lastFreezeAwardDate?: string; // 上次因 7 天连续打卡奖励护盾的日期
}

/** 方向3：周榜条目。 */
export interface WeeklyScoreEntry {
  score: number;
  combo: number;
  rounds: number;
  accuracy: number;
  date: string; // YYYY-MM-DD
}

/** 方向4：错题记录。 */
export interface WrongAnswerRecord {
  worldId: number;
  worldName: string;
  questionText: string;
  correctAnswer: string | number;
  userAnswer: string | number;
  timestamp: number;
}

/** 方向4：学习目标与进度。 */
export interface LearningGoal {
  dailyTarget: number;
  dailyCompleted: number;
  dailyDate: string;
  weeklyTarget: number;
  weeklyCompleted: number;
  weeklyKey: string;
  bestDailyStreak: number;
  dailyStreakMet: number;
  lastMetDate: string;
}

export const CURRENT_SAVE_VERSION = '1.1';

export const DEFAULT_STATE: GameState = {
  version: CURRENT_SAVE_VERSION,
  screen: 'home',
  currentWorld: 0,
  currentLevel: 0,
  progress: {},
  unlocks: {
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
  },
  scienceCompositions: [],
  diary: [],
  settings: { bgm: true, sfx: true, difficulty: 'auto', soundPack: 'mathRock', masterVolume: 0.8 },
  combo: 0,
  bestCombo: 0,
  achievements: [],
  leaderboard: {},
  adaptiveHistory: [],
  dailyStreak: 0,
  dailyLastDate: '',
  dailyTypesCompleted: [],
  dailyWeekCounts: {},
  scienceTypesUsed: [],
  samplesPlayed: [],
  levelHints: {},
  bossTimes: {},
  luckyStreak: 0,
  w3BossPerfect: true,
  noHintWorld: false,
  pendingBoss: null,
  onboardingDone: false,
  lastWorld: 0,
  lastLevel: '',
  endlessStats: { bestScore: 0, totalRounds: 0, totalCorrect: 0, totalQuestions: 0, bestCombo: 0 },
  customLevels: [],
  composerExported: false,
  importedSampleId: '',
  sharedComposer: false,
  exportedScience: false,
  w3RatiosHeard: [],
  w2ReflectionAxisUsed: false,
  w2OriginalReflectionPlayed: false,
  w6RecursiveLayersUsed: false,
  w7MarkovEdited: false,
  w8BossCoveredAll: false,
  // 方向3/4 字段初始化
  weeklyLeaderboard: {},
  importedChallengeCodes: [],
  lastCheckinPromptDate: '',
  wrongAnswerHistory: [],
  learningGoal: {
    dailyTarget: 10,
    dailyCompleted: 0,
    dailyDate: '',
    weeklyTarget: 50,
    weeklyCompleted: 0,
    weeklyKey: '',
    bestDailyStreak: 0,
    dailyStreakMet: 0,
    lastMetDate: '',
  },
  // XP / 等级 / 护盾
  xp: 0,
  level: 1,
  streakFreezes: 0,
  lastFreezeAwardDate: '',
};

type MigrationFn = (state: Record<string, unknown>) => void;

interface Migration {
  version: string;
  migrate: MigrationFn;
}

/** 存档版本迁移表。按 version 从小到大执行，用于补全旧存档缺失字段。 */
export const MIGRATIONS: Migration[] = [
  {
    version: '1.0',
    migrate(s) {
      if (typeof s.version !== 'string') s.version = '1.0';
      if (!s.progress || typeof s.progress !== 'object') s.progress = {};
      if (!s.unlocks || typeof s.unlocks !== 'object') {
        s.unlocks = Object.assign({}, DEFAULT_STATE.unlocks);
      }
      if (!Array.isArray(s.scienceCompositions)) s.scienceCompositions = [];
      if (!Array.isArray(s.diary)) s.diary = [];
      if (!s.settings || typeof s.settings !== 'object') s.settings = Object.assign({}, DEFAULT_STATE.settings);
      if (typeof s.combo !== 'number') s.combo = 0;
      if (typeof s.bestCombo !== 'number') s.bestCombo = 0;
      if (!Array.isArray(s.achievements)) s.achievements = [];
      if (!s.leaderboard || typeof s.leaderboard !== 'object') s.leaderboard = {};
      if (!Array.isArray(s.adaptiveHistory)) s.adaptiveHistory = [];
      if (typeof s.dailyStreak !== 'number') s.dailyStreak = 0;
      if (typeof s.dailyLastDate !== 'string') s.dailyLastDate = '';
      if (!Array.isArray(s.dailyTypesCompleted)) s.dailyTypesCompleted = [];
      if (!s.dailyWeekCounts || typeof s.dailyWeekCounts !== 'object') s.dailyWeekCounts = {};
      if (!Array.isArray(s.scienceTypesUsed)) s.scienceTypesUsed = [];
      if (!Array.isArray(s.samplesPlayed)) s.samplesPlayed = [];
      if (!s.levelHints || typeof s.levelHints !== 'object') s.levelHints = {};
      if (!s.bossTimes || typeof s.bossTimes !== 'object') s.bossTimes = {};
      if (typeof s.luckyStreak !== 'number') s.luckyStreak = 0;
      if (typeof s.w3BossPerfect !== 'boolean') s.w3BossPerfect = true;
      if (typeof s.noHintWorld !== 'boolean') s.noHintWorld = false;
      if (s.pendingBoss !== null && typeof s.pendingBoss !== 'string') s.pendingBoss = null;
      if (typeof s.onboardingDone !== 'boolean') s.onboardingDone = false;
      if (typeof s.lastWorld !== 'number') s.lastWorld = 0;
      if (typeof s.lastLevel !== 'string') s.lastLevel = '';
      if (!s.endlessStats || typeof s.endlessStats !== 'object')
        s.endlessStats = Object.assign({}, DEFAULT_STATE.endlessStats);
      if (!Array.isArray(s.customLevels)) s.customLevels = [];
      if (typeof s.composerExported !== 'boolean') s.composerExported = false;
    },
  },
  {
    version: '1.1',
    migrate(s) {
      // 方向3/4 字段补全（旧存档可能缺失）
      if (!s.weeklyLeaderboard || typeof s.weeklyLeaderboard !== 'object') s.weeklyLeaderboard = {};
      if (!Array.isArray(s.importedChallengeCodes)) s.importedChallengeCodes = [];
      if (typeof s.lastCheckinPromptDate !== 'string') s.lastCheckinPromptDate = '';
      if (!Array.isArray(s.wrongAnswerHistory)) s.wrongAnswerHistory = [];
      if (!s.learningGoal || typeof s.learningGoal !== 'object') {
        s.learningGoal = Object.assign({}, DEFAULT_STATE.learningGoal);
      }
      // XP / 等级 / 护盾
      if (typeof s.xp !== 'number') s.xp = 0;
      if (typeof s.level !== 'number') s.level = 1;
      if (typeof s.streakFreezes !== 'number') s.streakFreezes = 0;
      if (typeof s.lastFreezeAwardDate !== 'string') s.lastFreezeAwardDate = '';
      s.version = CURRENT_SAVE_VERSION;
    },
  },
];

/** 对解析后的存档对象执行迁移，补全缺失字段并升级版本号。 */
export function runMigrations(state: Record<string, unknown>): void {
  const versions = MIGRATIONS.map((m) => m.version);
  const savedVersion = state.version && typeof state.version === 'string' ? (state.version as string) : '';
  const currentIdx = savedVersion ? versions.indexOf(savedVersion) : -1;

  // 如果存档版本比当前代码更新（未来版本），保留原版本，避免降级覆盖。
  if (currentIdx === -1 && savedVersion && savedVersion > CURRENT_SAVE_VERSION) {
    return;
  }

  const startIdx = currentIdx >= 0 ? currentIdx : 0;
  for (let i = startIdx; i < MIGRATIONS.length; i++) {
    try {
      MIGRATIONS[i].migrate(state);
    } catch (e) {
      console.warn('save migration failed', MIGRATIONS[i].version, e);
    }
  }
}

export { LS_KEYS } from './storage-keys';

interface StoreAPI {
  state: GameState;
  listeners: ((state: GameState) => void)[];
  _idbReady: boolean;
  setState(p: Partial<GameState>): void;
  subscribe(f: (state: GameState) => void): void;
  save(): void;
  load(): void;
  _loadScienceFromIDB(): void;
  _flushSave(): void;
  _saveTimer: ReturnType<typeof setTimeout> | null;
  _savePending: boolean;
}

export const Store: StoreAPI = {
  state: Object.assign({}, DEFAULT_STATE),
  listeners: [],
  _idbReady: false,
  _saveTimer: null as ReturnType<typeof setTimeout> | null,
  _savePending: false,

  setState(p) {
    Object.assign(this.state, p);
    this.listeners.forEach((f) => f(this.state));
    this.save();
  },

  subscribe(f) {
    this.listeners.push(f);
  },

  save() {
    this._savePending = true;
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this._savePending = false;
      this._flushSave();
    }, 250);
  },

  _flushSave() {
    try {
      const stateCopy = Object.assign({}, this.state);
      delete (stateCopy as unknown as Record<string, unknown>).scienceCompositions;
      localStorage.setItem(LS_KEYS.STATE, JSON.stringify(stateCopy));
    } catch (e) {
      // localStorage 配额超限或被禁用时给出可见提示，避免进度静默丢失
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('quota') || msg.includes('Quota') || msg.includes('QUOTA')) {
        try {
          showToast('存储空间不足，进度可能无法保存，请清理浏览器数据', 'error', 5000);
        } catch (_) {
          /* noop */
        }
      }
      // 同时尝试将状态降级写 IndexedDB
      try {
        idbSet('mathbeat_state_fallback', this.state).catch(() => {});
      } catch (_) {
        /* noop */
      }
    }
    if (this.state.scienceCompositions) {
      idbSet('mathbeat_science_compositions', this.state.scienceCompositions).catch(function () {
        try {
          showToast('科学作品存储失败（可能空间不足）', 'error', 3000);
        } catch (_) {
          /* noop */
        }
      });
    }
  },

  load() {
    try {
      const s = localStorage.getItem(LS_KEYS.STATE);
      if (s) {
        const parsed = JSON.parse(s);
        runMigrations(parsed);
        Object.assign(this.state, parsed);
      }
    } catch (e) {
      /* noop */
    }
    this._loadScienceFromIDB();
    try {
      migrateFromLocalStorage();
    } catch (e) {
      /* noop */
    }
  },

  _loadScienceFromIDB() {
    idbGet('mathbeat_science_compositions')
      .then(function (val: unknown) {
        if (val && Array.isArray(val)) {
          Store.state.scienceCompositions = val as unknown[];
        }
      })
      .catch(function () {});
  },
};

export function validateSaveData(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (typeof d.version !== 'string') return false;
  if (!d.progress || typeof d.progress !== 'object') return false;
  return true;
}

export function syncComposerUnlocks(): void {
  const progress = Store.state.progress;
  const u = Object.assign({}, Store.state.unlocks);
  if ((progress['1-B'] || 0) >= 1) {
    u.bass = true;
    u.modular = true;
  }
  if ((progress['2-B'] || 0) >= 1) {
    u.melody = true;
    u.prime = true;
    u.fibonacci = true;
  }
  if ((progress['3-B'] || 0) >= 1) {
    u.chords = true;
  }
  if ((progress['4-B'] || 0) >= 1) {
    u.symmetry = true;
  }
  if ((progress['5-B'] || 0) >= 1) {
    u.recursive = true;
  }
  if ((progress['6-B'] || 0) >= 1) {
    u.cellular = true;
  }
  if ((progress['7-B'] || 0) >= 1) {
    u.markov = true;
  }
  if ((progress['8-B'] || 0) >= 1) {
    u.counterpoint = true;
  }
  Store.state.unlocks = u;
  Store.save();
}

export function importGameData(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = function () {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const raw = reader.result as string;
        // 严格 schema 校验：防止存储型 XSS 与崩溃型输入
        // （旧实现仅校验 version/progress，scienceCompositions[].type 等字段
        //  未净化就被 innerHTML 拼接，构成存储型 XSS 链）
        const validated = safeParseAndValidate(raw, validateGameState);
        if (!validated.ok || !validated.value) {
          showToast(t('toast.save.import_invalid') + '：' + validated.errors.slice(0, 3).join('; '), 'error');
          return;
        }
        const data = validated.value as unknown as Record<string, unknown>;
        runMigrations(data);
        Store.state = Object.assign({}, DEFAULT_STATE, data) as GameState;
        Store.save();
        showToast(t('toast.save.import_success'), 'success');
        setTimeout(() => window.location.reload(), 600);
      } catch (e) {
        showToast(t('toast.save.read_failed'), 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

export function exportGameData(): void {
  const data = Object.assign({}, Store.state, { version: '1.0', exportedAt: new Date().toISOString() });
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mathbeat_save.json';
  a.click();
  URL.revokeObjectURL(url);
}

export function resetGameData(): void {
  showConfirm(t('confirm.reset_progress'), () => {
    Store.state = Object.assign({}, DEFAULT_STATE);
    Store.save();
    showToast(t('toast.save.reset_done'), 'success');
    setTimeout(() => window.location.reload(), 600);
  });
}

// 暴露 Store 到 window（供 e2e 测试与外部脚本访问用户进度）
if (typeof window !== 'undefined') {
  (window as any).Store = Store;
}
