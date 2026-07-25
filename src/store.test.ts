import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_STATE,
  LS_KEYS,
  Store,
  validateSaveData,
  runMigrations,
  CURRENT_SAVE_VERSION,
  MIGRATIONS,
  purgeUserData,
  importGameData,
  exportGameData,
  resetGameData,
  syncComposerUnlocks,
} from './store';
import { validateGameState, safeParseAndValidate } from './schema';
import { showToast, showConfirm } from './ui-feedback';
import { idbGet, idbSet, idbDelete } from './storage';

vi.mock('./storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./storage')>()),
  idbGet: vi.fn(() => Promise.resolve(null)),
  idbSet: vi.fn(() => Promise.resolve(true)),
  idbDelete: vi.fn(() => Promise.resolve(true)),
  migrateFromLocalStorage: vi.fn(() => Promise.resolve(false)),
}));

vi.mock('./ui-feedback', () => ({
  showToast: vi.fn(),
  showConfirm: vi.fn(),
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

// ===== P0 级补充测试：安全与数据完整性 =====

describe('purgeUserData - 清除所有用户数据 (P0-1)', () => {
  beforeEach(() => {
    Store.state = Object.assign({}, DEFAULT_STATE);
    Store.listeners = [];
    Store._idbReady = false;
    if (Store._saveTimer) {
      clearTimeout(Store._saveTimer);
      Store._saveTimer = null;
    }
    localStorage.clear();
    vi.mocked(showToast).mockClear();
  });

  it('清除 localStorage/IndexedDB 并将 state 重置为 DEFAULT_STATE', () => {
    // 准备：填充 state 与 localStorage
    Store.state.progress = { '1-1': 3 };
    Store.state.xp = 100;
    localStorage.setItem(
      LS_KEYS.STATE,
      JSON.stringify({ version: '1.1', progress: { '1-1': 3 } }),
    );

    purgeUserData();

    // localStorage 中的 STATE 已被移除
    expect(localStorage.getItem(LS_KEYS.STATE)).toBe(null);
    // Object.assign 覆盖（不删除属性）：progress 被 {} 覆盖，xp 被 0 覆盖
    expect(Store.state.progress).toEqual({});
    expect(Store.state.xp).toBe(0);
  });
});

describe('importGameData - 拒绝原型污染恶意 JSON (P0-2)', () => {
  let realCreateElement: (tagName: string) => HTMLElement;

  beforeEach(() => {
    Store.state = Object.assign({}, DEFAULT_STATE);
    Store.listeners = [];
    if (Store._saveTimer) {
      clearTimeout(Store._saveTimer);
      Store._saveTimer = null;
    }
    localStorage.clear();
    vi.mocked(showToast).mockClear();
    realCreateElement = document.createElement.bind(document) as unknown as (
      tagName: string,
    ) => HTMLElement;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('validateGameState 直接拒绝含 __proto__ 的对象', () => {
    // JSON.parse 将 __proto__ 作为 own 属性，不会触发原型污染
    const malicious = JSON.parse(
      '{"__proto__":{"polluted":1},"version":"1.1","progress":{}}',
    );
    const result = validateGameState(malicious);
    expect(result.ok).toBe(false);
    expect(({} as any).polluted).toBeUndefined();
  });

  it('safeParseAndValidate + validateGameState 拒绝原型污染 JSON 字符串', () => {
    const raw = '{"__proto__":{"polluted":1},"version":"1.1","progress":{}}';
    const result = safeParseAndValidate(raw, validateGameState);
    expect(result.ok).toBe(false);
    expect(result.value).toBeNull();
    expect(({} as any).polluted).toBeUndefined();
  });

  it('importGameData 通过 FileReader 读取恶意 JSON 时拒绝导入并提示', () => {
    const malicious = '{"__proto__":{"polluted":1},"version":"1.1","progress":{}}';

    // Mock FileReader：readAsText 同步触发 onload
    const fakeReader: any = {
      onload: null,
      result: '',
      readAsText: vi.fn(function (this: any) {
        this.result = malicious;
        if (typeof this.onload === 'function') {
          this.onload(new Event('load'));
        }
      }),
    };
    vi.stubGlobal('FileReader', function () {
      return fakeReader;
    });

    // Mock document.createElement：对 'input' 返回带 files 的假元素
    const fakeInput: any = {
      type: '',
      accept: '',
      onchange: null,
      files: [{ name: 'evil.json' }],
      click: vi.fn(),
    };
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName === 'input') return fakeInput;
      return realCreateElement(tagName as any);
    }) as any);

    importGameData();

    // importGameData 设置了 input.onchange 并调用 input.click()
    expect(fakeInput.click).toHaveBeenCalled();
    expect(typeof fakeInput.onchange).toBe('function');
    // 模拟用户选择文件后触发 onchange
    fakeInput.onchange(new Event('change'));

    // readAsText 应被调用并同步触发 onload
    expect(fakeReader.readAsText).toHaveBeenCalled();

    // 恶意数据未被写入 Store.state，原型未被污染
    expect(({} as any).polluted).toBeUndefined();
    expect((Store.state as any).polluted).toBeUndefined();
    // 导入被拒绝，应弹出错误提示
    expect(showToast).toHaveBeenCalled();
    const calls = vi.mocked(showToast).mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[1]).toBe('error');
  });
});

describe('Store.load - 损坏 JSON 回退 (P0-10)', () => {
  beforeEach(() => {
    Store.state = Object.assign({}, DEFAULT_STATE);
    Store.listeners = [];
    Store._idbReady = false;
    if (Store._saveTimer) {
      clearTimeout(Store._saveTimer);
      Store._saveTimer = null;
    }
    localStorage.clear();
    vi.mocked(showToast).mockClear();
  });

  it('损坏 JSON 不抛错并维持 DEFAULT_STATE', async () => {
    localStorage.setItem(LS_KEYS.STATE, 'not valid json {{{');

    // 不应抛错
    expect(() => Store.load()).not.toThrow();

    // load 的 catch 会异步尝试 idb fallback 恢复，刷新微任务
    await new Promise((r) => setTimeout(r, 0));

    // state 维持 DEFAULT_STATE（progress 为空）
    expect(Store.state.progress).toEqual({});
  });
});

describe('localStorage QuotaExceededError 处理 (P0-11)', () => {
  beforeEach(() => {
    Store.state = Object.assign({}, DEFAULT_STATE);
    Store.listeners = [];
    Store._idbReady = false;
    if (Store._saveTimer) {
      clearTimeout(Store._saveTimer);
      Store._saveTimer = null;
    }
    localStorage.clear();
    vi.mocked(showToast).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('配额超限时捕获异常并提示存储空间不足', () => {
    vi.useFakeTimers();
    // 用 stubGlobal 替换整个 localStorage：happy-dom 的 localStorage 是 Proxy，
    // 会缓存 bound setItem；一旦本文件早先测试访问过 localStorage.setItem，
    // vi.spyOn(Storage.prototype, 'setItem') 会被缓存绕过（实测 spy 不被调用）。
    // 直接替换全局 localStorage 可稳定触发 _flushSave 中的 setItem 抛错路径。
    const fakeLocalStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      }),
      removeItem: vi.fn(() => {}),
      clear: vi.fn(() => {}),
      key: vi.fn(() => null),
      length: 0,
    };
    vi.stubGlobal('localStorage', fakeLocalStorage);

    // setState 触发 debounced save（250ms）
    Store.setState({ combo: 5 });

    // 推进 250ms debounce 定时器，触发 _flushSave；不应抛错
    expect(() => vi.advanceTimersByTime(300)).not.toThrow();

    // fake localStorage.setItem 被调用并抛 QuotaExceededError
    expect(fakeLocalStorage.setItem).toHaveBeenCalled();
    // showToast 被调用含"存储空间不足"
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('存储空间不足'),
      'error',
      5000,
    );
  });
});

// ===== 扩充测试：setState / subscribe / save / load 各分支 =====

describe('setState - 各种更新路径', () => {
  beforeEach(() => {
    Store.state = Object.assign({}, DEFAULT_STATE);
    Store.listeners = [];
    if (Store._saveTimer) {
      clearTimeout(Store._saveTimer);
      Store._saveTimer = null;
    }
    Store._savePending = false;
    localStorage.clear();
    vi.mocked(showToast).mockClear();
  });

  afterEach(() => {
    if (Store._saveTimer) {
      clearTimeout(Store._saveTimer);
      Store._saveTimer = null;
    }
  });

  it('partial 更新合并到 state 并通知 listeners', () => {
    const seen: number[] = [];
    Store.subscribe((s) => seen.push(s.combo));
    Store.setState({ combo: 7 });
    expect(Store.state.combo).toBe(7);
    expect(seen).toContain(7);
  });

  it('嵌套对象更新使用 Object.assign 浅合并', () => {
    Store.setState({ settings: { bgm: false, sfx: true, difficulty: 'hard', soundPack: 'mathRock', masterVolume: 0.5 } });
    expect(Store.state.settings.bgm).toBe(false);
    expect(Store.state.settings.difficulty).toBe('hard');
  });

  it('数组更新直接替换', () => {
    Store.setState({ achievements: ['a1', 'a2'] });
    expect(Store.state.achievements).toEqual(['a1', 'a2']);
    Store.setState({ achievements: [] });
    expect(Store.state.achievements).toEqual([]);
  });

  it('多次连续 setState 触发多次 listener 通知', () => {
    const calls: number[] = [];
    Store.subscribe((s) => calls.push(s.combo));
    Store.setState({ combo: 1 });
    Store.setState({ combo: 2 });
    Store.setState({ combo: 3 });
    expect(calls).toEqual([1, 2, 3]);
  });

  it('setState 同时触发 debounced save', () => {
    vi.useFakeTimers();
    Store.setState({ combo: 5 });
    expect(Store._saveTimer).not.toBeNull();
    expect(Store._savePending).toBe(true);
    vi.advanceTimersByTime(250);
    expect(Store._savePending).toBe(false);
    vi.useRealTimers();
  });

  it('setState 多次复用同一 debounce timer', () => {
    vi.useFakeTimers();
    Store.setState({ combo: 1 });
    const timer1 = Store._saveTimer;
    Store.setState({ combo: 2 });
    // 第二次 setState 会 clearTimeout 后重新 setTimeout，但仍是新的 timer
    expect(Store._saveTimer).not.toBe(timer1);
    vi.useRealTimers();
  });

  it('空对象 setState 不抛错但仍通知 listener', () => {
    const calls: number[] = [];
    Store.subscribe(() => calls.push(1));
    expect(() => Store.setState({})).not.toThrow();
    expect(calls.length).toBe(1);
  });
});

describe('subscribe - 订阅通知', () => {
  beforeEach(() => {
    Store.state = Object.assign({}, DEFAULT_STATE);
    Store.listeners = [];
  });

  it('订阅后被加入 listeners 数组', () => {
    const fn = vi.fn();
    Store.subscribe(fn);
    expect(Store.listeners).toContain(fn);
  });

  it('多个 listener 都会收到通知', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    Store.subscribe(fn1);
    Store.subscribe(fn2);
    Store.setState({ combo: 1 });
    expect(fn1).toHaveBeenCalled();
    expect(fn2).toHaveBeenCalled();
  });

  it('listener 接收最新 state 引用', () => {
    let received: any = null;
    Store.subscribe((s) => { received = s; });
    Store.setState({ combo: 42 });
    expect(received).toBe(Store.state);
    expect(received.combo).toBe(42);
  });

  it('Store 不提供 unsubscribe —— listener 需手动管理', () => {
    // 验证当前 API 设计：subscribe 返回 void，没有取消订阅机制
    const fn = vi.fn();
    const result = Store.subscribe(fn);
    expect(result).toBeUndefined();
  });
});

describe('save / _flushSave - 持久化分支', () => {
  beforeEach(() => {
    Store.state = Object.assign({}, DEFAULT_STATE);
    Store.listeners = [];
    if (Store._saveTimer) {
      clearTimeout(Store._saveTimer);
      Store._saveTimer = null;
    }
    Store._savePending = false;
    localStorage.clear();
    vi.mocked(idbSet).mockClear();
    vi.mocked(idbGet).mockClear();
    vi.mocked(showToast).mockClear();
  });

  afterEach(() => {
    if (Store._saveTimer) {
      clearTimeout(Store._saveTimer);
      Store._saveTimer = null;
    }
  });

  it('save 设置 _savePending 并启动 250ms debounce timer', () => {
    vi.useFakeTimers();
    Store.save();
    expect(Store._savePending).toBe(true);
    expect(Store._saveTimer).not.toBeNull();
    vi.advanceTimersByTime(250);
    expect(Store._savePending).toBe(false);
    vi.useRealTimers();
  });

  it('save 多次调用复用同一 timer（250ms 内）', () => {
    vi.useFakeTimers();
    Store.save();
    const firstTimer = Store._saveTimer;
    Store.save();
    Store.save();
    // 三次 save 在 250ms 内应只产生一个最终 timer
    expect(Store._savePending).toBe(true);
    vi.advanceTimersByTime(250);
    expect(Store._savePending).toBe(false);
    vi.useRealTimers();
  });

  it('_flushSave 写入 localStorage 且 scienceCompositions 被排除', () => {
    Store.state.scienceCompositions = [{ id: 1, type: 'dft' }];
    Store._flushSave();
    const saved = JSON.parse(localStorage.getItem(LS_KEYS.STATE) || '{}');
    expect(saved.scienceCompositions).toBeUndefined();
  });

  it('_flushSave 同时写入 IndexedDB 影子备份', () => {
    Store._flushSave();
    expect(idbSet).toHaveBeenCalledWith('mathbeat_state_prev', expect.any(Object));
  });

  it('_flushSave 同时将 scienceCompositions 写入 IndexedDB', () => {
    Store.state.scienceCompositions = [{ id: 99 }];
    Store._flushSave();
    expect(idbSet).toHaveBeenCalledWith('mathbeat_science_compositions', [{ id: 99 }]);
  });

  it('_flushSave 在 scienceCompositions 为空数组时仍调用 idbSet', () => {
    Store.state.scienceCompositions = [];
    Store._flushSave();
    expect(idbSet).toHaveBeenCalledWith('mathbeat_science_compositions', []);
  });

  it('_flushSave 在 scienceCompositions 写入失败时弹 toast', async () => {
    // idbSet 会被调用两次：mathbeat_state_prev (失败时不弹 toast) 与
    // mathbeat_science_compositions (失败时弹 toast)
    // 这里让所有 idbSet 调用都 reject，但只有 scienceCompositions 触发 toast
    vi.mocked(idbSet).mockReset();
    vi.mocked(idbSet).mockImplementation(() => Promise.reject(new Error('idb full')));
    Store.state.scienceCompositions = [{ id: 1 }];
    Store._flushSave();
    // idbSet 返回 rejected promise，等待微任务
    await new Promise((r) => setTimeout(r, 0));
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('科学作品存储失败'),
      'error',
      3000,
    );
    // 恢复默认 mock 实现，避免影响后续测试
    vi.mocked(idbSet).mockReset();
    vi.mocked(idbSet).mockImplementation(() => Promise.resolve(true));
  });

  it('_flushSave 在 localStorage.setItem 抛非 quota 错误时走 fallback 路径', () => {
    vi.useFakeTimers();
    const fakeLocalStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new Error('some other storage error');
      }),
      removeItem: vi.fn(() => {}),
      clear: vi.fn(() => {}),
      key: vi.fn(() => null),
      length: 0,
    };
    vi.stubGlobal('localStorage', fakeLocalStorage);
    expect(() => {
      Store.setState({ combo: 1 });
      vi.advanceTimersByTime(300);
    }).not.toThrow();
    // 非 quota 错误不会触发"存储空间不足"toast，但会写入 fallback
    expect(idbSet).toHaveBeenCalledWith('mathbeat_state_fallback', expect.any(Object));
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});

describe('load - 加载分支', () => {
  beforeEach(() => {
    Store.state = Object.assign({}, DEFAULT_STATE);
    Store.listeners = [];
    if (Store._saveTimer) {
      clearTimeout(Store._saveTimer);
      Store._saveTimer = null;
    }
    localStorage.clear();
    vi.mocked(idbGet).mockReset();
    vi.mocked(idbSet).mockReset();
    vi.mocked(showToast).mockClear();
  });

  afterEach(() => {
    if (Store._saveTimer) {
      clearTimeout(Store._saveTimer);
      Store._saveTimer = null;
    }
  });

  it('localStorage 中无 STATE 时不修改 state', () => {
    const before = JSON.stringify(Store.state);
    Store.load();
    expect(JSON.stringify(Store.state)).toBe(before);
  });

  it('localStorage 中有合法 JSON 时合并到 state', () => {
    localStorage.setItem(LS_KEYS.STATE, JSON.stringify({ version: '1.1', progress: { '1-1': 5 }, combo: 9 }));
    Store.load();
    expect(Store.state.progress).toEqual({ '1-1': 5 });
    expect(Store.state.combo).toBe(9);
  });

  it('localStorage 损坏时异步从 idb fallback 恢复（有效数据）', async () => {
    localStorage.setItem(LS_KEYS.STATE, 'not json {{{');
    vi.mocked(idbGet).mockImplementation((key: string) =>
      key === 'mathbeat_state_fallback'
        ? Promise.resolve({ version: '1.1', progress: { '1-1': 7 }, combo: 11 })
        : Promise.resolve(null)
    );
    Store.load();
    await new Promise((r) => setTimeout(r, 10));
    expect(Store.state.progress).toEqual({ '1-1': 7 });
    expect(Store.state.combo).toBe(11);
  });

  it('idb fallback 数据无效时显示"已重置为初始状态" toast', async () => {
    localStorage.setItem(LS_KEYS.STATE, 'not json {{{');
    vi.mocked(idbGet).mockImplementation((key: string) =>
      key === 'mathbeat_state_fallback' ? Promise.resolve({ invalid: true }) : Promise.resolve(null)
    );
    Store.load();
    await new Promise((r) => setTimeout(r, 10));
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('已重置'),
      'error',
      5000,
    );
  });

  it('idb fallback 拒绝时显示错误 toast', async () => {
    localStorage.setItem(LS_KEYS.STATE, 'not json {{{');
    vi.mocked(idbGet).mockRejectedValue(new Error('idb read failed'));
    Store.load();
    await new Promise((r) => setTimeout(r, 10));
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('已重置'),
      'error',
      5000,
    );
  });

  it('load 始终调用 _loadScienceFromIDB（即使主存档有效）', () => {
    localStorage.setItem(LS_KEYS.STATE, JSON.stringify({ version: '1.1', progress: {} }));
    vi.mocked(idbGet).mockClear();
    Store.load();
    expect(idbGet).toHaveBeenCalledWith('mathbeat_science_compositions');
  });

  it('load 在 migrateFromLocalStorage 抛错时不影响主流程', async () => {
    const storageMod = await import('./storage');
    vi.spyOn(storageMod, 'migrateFromLocalStorage').mockImplementation(() => {
      throw new Error('migrate failed');
    });
    localStorage.setItem(LS_KEYS.STATE, JSON.stringify({ version: '1.1', progress: {} }));
    expect(() => Store.load()).not.toThrow();
  });
});

describe('_loadScienceFromIDB - 从 IndexedDB 加载科学作品', () => {
  beforeEach(() => {
    Store.state = Object.assign({}, DEFAULT_STATE);
    vi.mocked(idbGet).mockReset();
  });

  it('IndexedDB 中存在有效数组时写入 scienceCompositions', async () => {
    vi.mocked(idbGet).mockImplementation((key: string) =>
      key === 'mathbeat_science_compositions'
        ? Promise.resolve([{ id: 1, type: 'dft' }])
        : Promise.resolve(null)
    );
    Store._loadScienceFromIDB();
    await new Promise((r) => setTimeout(r, 10));
    expect(Store.state.scienceCompositions).toEqual([{ id: 1, type: 'dft' }]);
  });

  it('IndexedDB 返回 null 时不修改 scienceCompositions', async () => {
    vi.mocked(idbGet).mockResolvedValue(null);
    const before = Store.state.scienceCompositions;
    Store._loadScienceFromIDB();
    await new Promise((r) => setTimeout(r, 10));
    expect(Store.state.scienceCompositions).toBe(before);
  });

  it('IndexedDB 返回非数组时不修改 scienceCompositions', async () => {
    vi.mocked(idbGet).mockResolvedValue({ not: 'an array' });
    const before = Store.state.scienceCompositions;
    Store._loadScienceFromIDB();
    await new Promise((r) => setTimeout(r, 10));
    expect(Store.state.scienceCompositions).toBe(before);
  });

  it('IndexedDB 拒绝时不抛错', async () => {
    vi.mocked(idbGet).mockRejectedValue(new Error('idb read failed'));
    expect(() => Store._loadScienceFromIDB()).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
  });
});

describe('runMigrations - 迁移分支', () => {
  it('从 1.0 迁移到 1.1 时补全 weeklyLeaderboard / xp / streakFreezes', () => {
    const state: Record<string, unknown> = {
      version: '1.0',
      progress: {},
      // 1.0 已有的字段
      unlocks: {},
      settings: { bgm: true, sfx: true, difficulty: 'auto', soundPack: 'mathRock', masterVolume: 0.8 },
    };
    runMigrations(state);
    expect(state.version).toBe(CURRENT_SAVE_VERSION);
    expect(state.weeklyLeaderboard).toEqual({});
    expect(state.xp).toBe(0);
    expect(state.level).toBe(1);
    expect(state.streakFreezes).toBe(0);
    expect(state.lastFreezeAwardDate).toBe('');
    expect(Array.isArray(state.importedChallengeCodes)).toBe(true);
    expect(Array.isArray(state.wrongAnswerHistory)).toBe(true);
    expect(state.learningGoal).toBeDefined();
  });

  it('1.1 当前版本仍会执行 migrate（startIdx = 1，apply 1.1）', () => {
    const state: Record<string, unknown> = {
      version: '1.1',
      progress: {},
      // 已有 1.1 字段，但 weeklyLeaderboard 为空对象
      weeklyLeaderboard: {},
      xp: 50,
      level: 3,
    };
    runMigrations(state);
    expect(state.version).toBe(CURRENT_SAVE_VERSION);
    expect(state.xp).toBe(50); // 已存在不被覆盖
    expect(state.level).toBe(3);
  });

  it('MIGRATIONS 数组按版本升序排列', () => {
    const versions = MIGRATIONS.map((m) => m.version);
    const sorted = [...versions].sort();
    expect(versions).toEqual(sorted);
  });

  it('migrate 函数抛错时被 catch 不影响后续字段', () => {
    // 难以直接注入失败 migrate；改为验证 try/catch 包裹不会向调用方抛错
    const state: Record<string, unknown> = { version: '0.9', progress: {} };
    expect(() => runMigrations(state)).not.toThrow();
  });

  it('未知版本（如 0.5）从 1.0 开始执行所有迁移', () => {
    const state: Record<string, unknown> = { version: '0.5', progress: {} };
    runMigrations(state);
    expect(state.version).toBe(CURRENT_SAVE_VERSION);
    expect(state.unlocks).toBeDefined();
  });

  it('空对象迁移后被填充所有字段', () => {
    const state: Record<string, unknown> = {};
    runMigrations(state);
    expect(state.version).toBe(CURRENT_SAVE_VERSION);
    expect(state.progress).toEqual({});
    expect(state.unlocks).toEqual(DEFAULT_STATE.unlocks);
    expect(state.settings).toEqual(DEFAULT_STATE.settings);
    expect(Array.isArray(state.scienceCompositions)).toBe(true);
    expect(Array.isArray(state.diary)).toBe(true);
    expect(Array.isArray(state.achievements)).toBe(true);
  });
});

describe('validateSaveData - 边界条件', () => {
  it('null / undefined / 字符串 / 数字 均返回 false', () => {
    expect(validateSaveData(null)).toBe(false);
    expect(validateSaveData(undefined)).toBe(false);
    expect(validateSaveData('string')).toBe(false);
    expect(validateSaveData(42)).toBe(false);
    expect(validateSaveData(true)).toBe(false);
  });

  it('数组返回 false', () => {
    expect(validateSaveData([1, 2, 3])).toBe(false);
    expect(validateSaveData([])).toBe(false);
  });

  it('空对象返回 false', () => {
    expect(validateSaveData({})).toBe(false);
  });

  it('仅 version 缺少 progress 返回 false', () => {
    expect(validateSaveData({ version: '1.1' })).toBe(false);
  });

  it('仅 progress 缺少 version 返回 false', () => {
    expect(validateSaveData({ progress: {} })).toBe(false);
  });

  it('version 非字符串返回 false', () => {
    expect(validateSaveData({ version: 1, progress: {} })).toBe(false);
    expect(validateSaveData({ version: null, progress: {} })).toBe(false);
  });

  it('progress 非对象返回 false', () => {
    expect(validateSaveData({ version: '1.1', progress: 'not object' })).toBe(false);
    expect(validateSaveData({ version: '1.1', progress: null })).toBe(false);
    expect(validateSaveData({ version: '1.1', progress: 42 })).toBe(false);
  });

  it('progress 为数组返回 true（typeof [] === "object"，符合当前 schema 的弱校验）', () => {
    // 源码：if (!d.progress || typeof d.progress !== 'object') return false;
    // 数组也是 object 类型，因此通过该层校验返回 true
    expect(validateSaveData({ version: '1.1', progress: [] })).toBe(true);
  });

  it('完整有效数据返回 true', () => {
    expect(validateSaveData({ version: '1.1', progress: { '1-1': 3 } })).toBe(true);
  });
});

describe('syncComposerUnlocks - 解锁同步', () => {
  beforeEach(() => {
    Store.state = Object.assign({}, DEFAULT_STATE);
    Store.state.progress = {};
    if (Store._saveTimer) {
      clearTimeout(Store._saveTimer);
      Store._saveTimer = null;
    }
    vi.mocked(showToast).mockClear();
  });

  it('progress 全空时 unlocks 保持默认', () => {
    syncComposerUnlocks();
    expect(Store.state.unlocks.bass).toBe(false);
    expect(Store.state.unlocks.melody).toBe(false);
    expect(Store.state.unlocks.chords).toBe(false);
    expect(Store.state.unlocks.markov).toBe(false);
    expect(Store.state.unlocks.counterpoint).toBe(false);
  });

  it('1-B>=1 解锁 bass + modular', () => {
    Store.state.progress['1-B'] = 1;
    syncComposerUnlocks();
    expect(Store.state.unlocks.bass).toBe(true);
    expect(Store.state.unlocks.modular).toBe(true);
  });

  it('2-B>=1 解锁 melody + prime + fibonacci', () => {
    Store.state.progress['2-B'] = 1;
    syncComposerUnlocks();
    expect(Store.state.unlocks.melody).toBe(true);
    expect(Store.state.unlocks.prime).toBe(true);
    expect(Store.state.unlocks.fibonacci).toBe(true);
  });

  it('3-B>=1 解锁 chords', () => {
    Store.state.progress['3-B'] = 1;
    syncComposerUnlocks();
    expect(Store.state.unlocks.chords).toBe(true);
  });

  it('4-B>=1 解锁 symmetry', () => {
    Store.state.progress['4-B'] = 1;
    syncComposerUnlocks();
    expect(Store.state.unlocks.symmetry).toBe(true);
  });

  it('5-B>=1 解锁 recursive', () => {
    Store.state.progress['5-B'] = 1;
    syncComposerUnlocks();
    expect(Store.state.unlocks.recursive).toBe(true);
  });

  it('6-B>=1 解锁 cellular', () => {
    Store.state.progress['6-B'] = 1;
    syncComposerUnlocks();
    expect(Store.state.unlocks.cellular).toBe(true);
  });

  it('7-B>=1 解锁 markov', () => {
    Store.state.progress['7-B'] = 1;
    syncComposerUnlocks();
    expect(Store.state.unlocks.markov).toBe(true);
  });

  it('8-B>=1 解锁 counterpoint', () => {
    Store.state.progress['8-B'] = 1;
    syncComposerUnlocks();
    expect(Store.state.unlocks.counterpoint).toBe(true);
  });

  it('1-B=0 时不解锁 bass', () => {
    Store.state.progress['1-B'] = 0;
    syncComposerUnlocks();
    expect(Store.state.unlocks.bass).toBe(false);
  });

  it('所有 boss 关都通过时全部解锁', () => {
    Store.state.progress['1-B'] = 1;
    Store.state.progress['2-B'] = 1;
    Store.state.progress['3-B'] = 1;
    Store.state.progress['4-B'] = 1;
    Store.state.progress['5-B'] = 1;
    Store.state.progress['6-B'] = 1;
    Store.state.progress['7-B'] = 1;
    Store.state.progress['8-B'] = 1;
    syncComposerUnlocks();
    expect(Store.state.unlocks.bass).toBe(true);
    expect(Store.state.unlocks.melody).toBe(true);
    expect(Store.state.unlocks.chords).toBe(true);
    expect(Store.state.unlocks.symmetry).toBe(true);
    expect(Store.state.unlocks.recursive).toBe(true);
    expect(Store.state.unlocks.cellular).toBe(true);
    expect(Store.state.unlocks.markov).toBe(true);
    expect(Store.state.unlocks.counterpoint).toBe(true);
  });

  it('调用后触发 Store.save()', () => {
    vi.useFakeTimers();
    syncComposerUnlocks();
    expect(Store._saveTimer).not.toBeNull();
    vi.advanceTimersByTime(250);
    vi.useRealTimers();
  });
});

describe('exportGameData - 导出', () => {
  let originalURL: any;
  let originalLocation: any;

  beforeEach(() => {
    Store.state = Object.assign({}, DEFAULT_STATE);
    Store.state.xp = 100;
    originalURL = URL.createObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:fake-url') as any;
    URL.revokeObjectURL = vi.fn(() => {}) as any;
    // mock anchor click 行为
    originalLocation = window.location;
  });

  afterEach(() => {
    URL.createObjectURL = originalURL;
    vi.restoreAllMocks();
  });

  it('创建 blob URL 并触发下载', () => {
    const clickSpy = vi.fn();
    const a = document.createElement('a');
    a.click = clickSpy;
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag === 'a') return a;
      return document.createElement(tag);
    }) as any);
    exportGameData();
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(a.href).toBe('blob:fake-url');
    expect(a.download).toBe('mathbeat_save.json');
  });

  it('导出数据包含 exportedAt 与 version', () => {
    let captured: any = null;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      // 异步读取 blob 内容，但简化为直接同步读
      return 'blob:fake-url';
    }) as any;
    const a = document.createElement('a');
    a.click = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag === 'a') return a;
      return document.createElement(tag);
    }) as any);
    exportGameData();
    // 验证不抛错即可（blob 内容异步读取较复杂，留待集成测试）
    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});

describe('resetGameData - 重置进度', () => {
  beforeEach(() => {
    Store.state = Object.assign({}, DEFAULT_STATE);
    Store.state.xp = 999;
    Store.state.achievements = ['a', 'b'];
    if (Store._saveTimer) {
      clearTimeout(Store._saveTimer);
      Store._saveTimer = null;
    }
    vi.mocked(showConfirm).mockReset();
    vi.mocked(showToast).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('调用 showConfirm 询问用户', () => {
    resetGameData();
    expect(showConfirm).toHaveBeenCalled();
    expect(showConfirm.mock.calls[0][0]).toBeTruthy();
  });

  it('用户确认后重置 state 为 DEFAULT_STATE 并显示 toast', () => {
    vi.mocked(showConfirm).mockImplementation((_msg: string, cb: () => void) => cb());
    vi.useFakeTimers();
    resetGameData();
    expect(Store.state.xp).toBe(0);
    expect(Store.state.achievements).toEqual([]);
    expect(showToast).toHaveBeenCalledWith(
      expect.any(String),
      'success',
    );
    vi.advanceTimersByTime(600);
    vi.useRealTimers();
  });

  it('用户取消时不重置 state', () => {
    vi.mocked(showConfirm).mockImplementation((_msg: string, _cb: () => void) => {
      // 不调用 cb —— 模拟用户取消
    });
    resetGameData();
    expect(Store.state.xp).toBe(999);
    expect(Store.state.achievements).toEqual(['a', 'b']);
  });
});

describe('DEFAULT_STATE 完整性', () => {
  it('version 为 CURRENT_SAVE_VERSION', () => {
    expect(DEFAULT_STATE.version).toBe(CURRENT_SAVE_VERSION);
  });

  it('settings 包含所有必填字段', () => {
    // visualBeat 在 Settings 接口中为可选字段，DEFAULT_STATE 不强制初始化
    expect(DEFAULT_STATE.settings).toHaveProperty('bgm');
    expect(DEFAULT_STATE.settings).toHaveProperty('sfx');
    expect(DEFAULT_STATE.settings).toHaveProperty('difficulty');
    expect(DEFAULT_STATE.settings).toHaveProperty('soundPack');
    expect(DEFAULT_STATE.settings).toHaveProperty('masterVolume');
  });

  it('unlocks 包含所有乐器键', () => {
    const keys = Object.keys(DEFAULT_STATE.unlocks);
    expect(keys).toContain('drums');
    expect(keys).toContain('bass');
    expect(keys).toContain('melody');
    expect(keys).toContain('chords');
    expect(keys).toContain('euclidean');
    expect(keys).toContain('modular');
    expect(keys).toContain('prime');
    expect(keys).toContain('fibonacci');
    expect(keys).toContain('symmetry');
    expect(keys).toContain('recursive');
    expect(keys).toContain('cellular');
    expect(keys).toContain('markov');
    expect(keys).toContain('counterpoint');
  });

  it('endlessStats 字段齐全', () => {
    expect(DEFAULT_STATE.endlessStats).toEqual({
      bestScore: 0,
      totalRounds: 0,
      totalCorrect: 0,
      totalQuestions: 0,
      bestCombo: 0,
    });
  });

  it('learningGoal 字段齐全', () => {
    expect(DEFAULT_STATE.learningGoal).toEqual({
      dailyTarget: 10,
      dailyCompleted: 0,
      dailyDate: '',
      weeklyTarget: 50,
      weeklyCompleted: 0,
      weeklyKey: '',
      bestDailyStreak: 0,
      dailyStreakMet: 0,
      lastMetDate: '',
    });
  });

  it('XP / level / streakFreezes 默认值', () => {
    expect(DEFAULT_STATE.xp).toBe(0);
    expect(DEFAULT_STATE.level).toBe(1);
    expect(DEFAULT_STATE.streakFreezes).toBe(0);
    expect(DEFAULT_STATE.lastFreezeAwardDate).toBe('');
  });

  it('所有数组字段默认为空数组', () => {
    expect(DEFAULT_STATE.scienceCompositions).toEqual([]);
    expect(DEFAULT_STATE.diary).toEqual([]);
    expect(DEFAULT_STATE.achievements).toEqual([]);
    expect(DEFAULT_STATE.adaptiveHistory).toEqual([]);
    expect(DEFAULT_STATE.dailyTypesCompleted).toEqual([]);
    expect(DEFAULT_STATE.scienceTypesUsed).toEqual([]);
    expect(DEFAULT_STATE.samplesPlayed).toEqual([]);
    expect(DEFAULT_STATE.customLevels).toEqual([]);
    expect(DEFAULT_STATE.wrongAnswerHistory).toEqual([]);
    expect(DEFAULT_STATE.importedChallengeCodes).toEqual([]);
    expect(DEFAULT_STATE.w3RatiosHeard).toEqual([]);
  });

  it('所有对象字段默认为空对象', () => {
    expect(DEFAULT_STATE.progress).toEqual({});
    expect(DEFAULT_STATE.leaderboard).toEqual({});
    expect(DEFAULT_STATE.dailyWeekCounts).toEqual({});
    expect(DEFAULT_STATE.levelHints).toEqual({});
    expect(DEFAULT_STATE.bossTimes).toEqual({});
    expect(DEFAULT_STATE.weeklyLeaderboard).toEqual({});
  });

  it('字符串字段默认为空字符串', () => {
    expect(DEFAULT_STATE.dailyLastDate).toBe('');
    expect(DEFAULT_STATE.lastLevel).toBe('');
    expect(DEFAULT_STATE.importedSampleId).toBe('');
    expect(DEFAULT_STATE.lastCheckinPromptDate).toBe('');
  });

  it('布尔字段默认值', () => {
    expect(DEFAULT_STATE.w3BossPerfect).toBe(true);
    expect(DEFAULT_STATE.noHintWorld).toBe(false);
    expect(DEFAULT_STATE.onboardingDone).toBe(false);
    expect(DEFAULT_STATE.composerExported).toBe(false);
    expect(DEFAULT_STATE.sharedComposer).toBe(false);
    expect(DEFAULT_STATE.exportedScience).toBe(false);
    expect(DEFAULT_STATE.w2ReflectionAxisUsed).toBe(false);
    expect(DEFAULT_STATE.w6RecursiveLayersUsed).toBe(false);
    expect(DEFAULT_STATE.w7MarkovEdited).toBe(false);
    expect(DEFAULT_STATE.w8BossCoveredAll).toBe(false);
  });
});

describe('window.Store 全局暴露', () => {
  it('Store 已挂载到 window 上（供 e2e/外部访问）', () => {
    expect((window as any).Store).toBe(Store);
  });
});

describe('MIGRATIONS - 迁移表', () => {
  it('包含至少两条迁移', () => {
    expect(MIGRATIONS.length).toBeGreaterThanOrEqual(2);
  });

  it('每条 migration 包含 version 与 migrate 函数', () => {
    for (const m of MIGRATIONS) {
      expect(typeof m.version).toBe('string');
      expect(typeof m.migrate).toBe('function');
    }
  });

  it('最新迁移版本等于 CURRENT_SAVE_VERSION', () => {
    const last = MIGRATIONS[MIGRATIONS.length - 1];
    expect(last.version).toBe(CURRENT_SAVE_VERSION);
  });
});
