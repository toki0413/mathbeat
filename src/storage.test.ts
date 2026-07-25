import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  idbGet,
  idbSet,
  idbDelete,
  migrateFromLocalStorage,
  localGet,
  localSet,
  localRemove,
} from './storage';

// happy-dom 中 localStorage 的方法位于原型链上（且并非直接等于 Storage.prototype），
// 直接赋值会被忽略，Storage.prototype 修改也不生效。
// 用 vi.spyOn 可以正确处理原型链并在 mockRestore() 后还原。
function mockLocalStorageThrow(name: 'setItem' | 'getItem' | 'removeItem', err: Error) {
  return vi.spyOn(localStorage, name).mockImplementation(() => {
    throw err;
  });
}

describe('storage localStorage 路径', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('localSet 返回 true 且 localGet 往返字符串', () => {
    expect(localSet('k', 'v')).toBe(true);
    expect(localGet('k')).toBe('v');
  });

  it('localSet/localGet 对象往返', () => {
    localSet('obj', { a: 1, b: [2, 3] });
    expect(localGet('obj')).toEqual({ a: 1, b: [2, 3] });
  });

  it('localGet 缺省 fallback', () => {
    expect(localGet('missing', 'fallback')).toBe('fallback');
  });

  it('localGet 未命中且无 fallback 返回 undefined', () => {
    expect(localGet('missing')).toBeUndefined();
  });

  it('localGet 容错损坏的 JSON 返回 fallback', () => {
    localStorage.setItem('bad', '{not json');
    expect(localGet('bad', 'default')).toBe('default');
  });

  it('localRemove 删除', () => {
    localSet('k', 'v');
    expect(localRemove('k')).toBe(true);
    expect(localGet('k')).toBeUndefined();
  });

  it('localRemove 不存在的 key 也返回 true', () => {
    expect(localRemove('never_set')).toBe(true);
  });
});

describe('storage 各种数据类型往返', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('数字往返', () => {
    expect(localSet('n', 42)).toBe(true);
    expect(localGet('n')).toBe(42);
    expect(localSet('neg', -3.14)).toBe(true);
    expect(localGet('neg')).toBe(-3.14);
    expect(localSet('zero', 0)).toBe(true);
    expect(localGet('zero')).toBe(0);
  });

  it('布尔值往返', () => {
    expect(localSet('t', true)).toBe(true);
    expect(localGet('t')).toBe(true);
    expect(localSet('f', false)).toBe(true);
    expect(localGet('f')).toBe(false);
  });

  it('null 往返', () => {
    localSet('null_val', null);
    expect(localGet('null_val')).toBeNull();
  });

  it('嵌套对象往返', () => {
    const nested = { a: { b: { c: { d: [1, 2, { e: 'deep' }] } } } };
    localSet('nested', nested);
    expect(localGet('nested')).toEqual(nested);
  });

  it('数组往返（含混合类型）', () => {
    const arr = [1, 'two', true, null, { x: 1 }, [2, 3]];
    localSet('arr', arr);
    expect(localGet('arr')).toEqual(arr);
  });

  it('空数组与空对象往返', () => {
    localSet('empty_arr', []);
    localSet('empty_obj', {});
    expect(localGet('empty_arr')).toEqual([]);
    expect(localGet('empty_obj')).toEqual({});
  });
});

describe('storage localStorage 错误恢复', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('localSet 在 localStorage 抛错时返回 false', () => {
    const spy = mockLocalStorageThrow('setItem', new Error('QuotaExceededError'));
    expect(localSet('k', 'v')).toBe(false);
    spy.mockRestore();
  });

  it('localGet 在 localStorage.getItem 抛错时返回 fallback', () => {
    const spy = mockLocalStorageThrow('getItem', new Error('SecurityError'));
    expect(localGet('k', 'default')).toBe('default');
    spy.mockRestore();
  });

  it('localRemove 在 localStorage 抛错时返回 false', () => {
    const spy = mockLocalStorageThrow('removeItem', new Error('SecurityError'));
    expect(localRemove('k')).toBe(false);
    spy.mockRestore();
  });

  it('localGet 容错 JSON.parse 抛错（非 string）', () => {
    // 设置一个无法解析的 raw 值
    localStorage.setItem('broken', 'undefined');
    expect(localGet('broken', 'fallback')).toBe('fallback');
  });
});

describe('storage IndexedDB 路径 (happy-dom 无 IDB → 走 fallback)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('idbSet/idbGet 往返对象 (fallback 写入 localStorage)', async () => {
    const ok = await idbSet('test_key', { a: 1 });
    expect(ok).toBe(true);
    const v = await idbGet('test_key');
    expect(v).toEqual({ a: 1 });
  });

  it('idbSet/idbGet 往返字符串', async () => {
    await idbSet('str_key', 'hello');
    const v = await idbGet('str_key');
    expect(v).toBe('hello');
  });

  it('idbDelete 删除后 idbGet 返回 null', async () => {
    await idbSet('test_key', 'value');
    const delOk = await idbDelete('test_key');
    expect(delOk).toBe(true);
    const v = await idbGet('test_key');
    expect(v).toBeNull();
  });

  it('idbGet 未命中返回 null', async () => {
    const v = await idbGet('nonexistent_key_xyz');
    expect(v).toBeNull();
  });

  it('IndexedDB 不可用时降级到 localStorage', async () => {
    // happy-dom 中 indexedDB 本就为 undefined，模块加载时 useFallback 已为 true
    // 显式断言不可用，确保 idbSet 走 localStorage
    expect((window as any).indexedDB).toBeUndefined();
    await idbSet('fallback_key', 'data');
    // 降级后应写入 localStorage，且为 JSON 序列化
    expect(localStorage.getItem('fallback_key')).toBe(JSON.stringify('data'));
    // idbGet 也能从 localStorage 读回
    const v = await idbGet('fallback_key');
    expect(v).toBe('data');
  });

  it('idbDelete 在 fallback 模式下移除 localStorage key', async () => {
    await idbSet('to_del', 'val');
    expect(localStorage.getItem('to_del')).not.toBeNull();
    await idbDelete('to_del');
    expect(localStorage.getItem('to_del')).toBeNull();
  });

  it('idbSet fallback 在 localStorage 抛错时返回 false', async () => {
    const spy = mockLocalStorageThrow('setItem', new Error('QuotaExceededError'));
    const ok = await idbSet('quota_key', 'val');
    expect(ok).toBe(false);
    spy.mockRestore();
  });

  it('idbGet fallback 在 localStorage.getItem 抛错时返回 null', async () => {
    const spy = mockLocalStorageThrow('getItem', new Error('SecurityError'));
    const v = await idbGet('any_key');
    expect(v).toBeNull();
    spy.mockRestore();
  });

  it('idbGet fallback 在 JSON 损坏时返回 null', async () => {
    localStorage.setItem('bad_json', '{not valid json');
    const v = await idbGet('bad_json');
    expect(v).toBeNull();
  });

  it('idbDelete fallback 在 localStorage 抛错时返回 false', async () => {
    const spy = mockLocalStorageThrow('removeItem', new Error('SecurityError'));
    const ok = await idbDelete('any_key');
    expect(ok).toBe(false);
    spy.mockRestore();
  });

  it('idbSet 处理无法 JSON 序列化的值（循环引用）返回 false', async () => {
    // 循环引用会导致 JSON.stringify 抛错
    const circular: any = { a: 1 };
    circular.self = circular;
    const ok = await idbSet('circular', circular);
    expect(ok).toBe(false);
  });

  it('idbSet 处理 undefined 值（JSON.stringify 返回 undefined）', async () => {
    // JSON.stringify(undefined) 返回 undefined（非字符串），localStorage.setItem 会抛错
    const ok = await idbSet('undef', undefined);
    expect(ok).toBe(false);
  });

  it('idbSet 处理函数值（无法序列化）返回 false', async () => {
    const ok = await idbSet('fn', function () {});
    expect(ok).toBe(false);
  });

  it('idbSet 处理 Symbol 值（无法序列化）返回 false', async () => {
    const ok = await idbSet('sym', Symbol('s'));
    expect(ok).toBe(false);
  });
});

describe('migrateFromLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('IndexedDB 不可用时返回 false (不迁移)', async () => {
    // 预置一些 mathbeat_ 数据，确保不是因为无数据而返回 false
    localStorage.setItem('mathbeat_x', JSON.stringify({ v: 1 }));
    const result = await migrateFromLocalStorage();
    expect(result).toBe(false);
  });

  it('无 mathbeat_ 数据时返回 false', async () => {
    localStorage.setItem('other_key', JSON.stringify({ v: 1 }));
    const result = await migrateFromLocalStorage();
    expect(result).toBe(false);
  });

  it('localStorage 为空时返回 false', async () => {
    const result = await migrateFromLocalStorage();
    expect(result).toBe(false);
  });
});

// ===== IndexedDB 真实路径测试（mock indexedDB）=====
// 通过 vi.resetModules + 重新 import 触发模块重新加载，
// 让 storage.ts 顶层 `if (!window.indexedDB) useFallback = true` 检查能感知到 mock

interface FakeIDBRequest<T = any> {
  result: T;
  error: any;
  onsuccess: ((ev: any) => void) | null;
  onerror: ((ev: any) => void) | null;
  onupgradeneeded: ((ev: any) => void) | null;
}

function createFakeIDB() {
  const storeData = new Map<string, any>();

  const fakeTransaction = {
    objectStore: () => ({
      get: (key: string) => {
        const req: any = { result: storeData.has(key) ? storeData.get(key) : null, onsuccess: null, onerror: null };
        setTimeout(() => req.onsuccess && req.onsuccess({}), 0);
        return req;
      },
      put: (value: any, key: string) => {
        storeData.set(key, value);
        const req: any = { result: undefined, onsuccess: null, onerror: null };
        setTimeout(() => req.onsuccess && req.onsuccess({}), 0);
        return req;
      },
      delete: (key: string) => {
        storeData.delete(key);
        const req: any = { result: undefined, onsuccess: null, onerror: null };
        setTimeout(() => req.onsuccess && req.onsuccess({}), 0);
        return req;
      },
    }),
    oncomplete: null,
    onerror: null,
  };

  const fakeDB = {
    objectStoreNames: { contains: () => true },
    transaction: () => {
      const tx: any = fakeTransaction;
      // 模拟 oncomplete 异步触发
      setTimeout(() => {
        if (tx.oncomplete) tx.oncomplete({});
      }, 0);
      return tx;
    },
    close: vi.fn(),
  };

  const fakeOpenRequest: any = {
    result: null,
    error: null,
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
  };

  const fakeIndexedDB = {
    open: vi.fn(() => {
      // 模拟异步成功，并触发 onupgradeneeded 第一次
      setTimeout(() => {
        fakeOpenRequest.result = fakeDB;
        if (fakeOpenRequest.onupgradeneeded) fakeOpenRequest.onupgradeneeded({ target: fakeOpenRequest });
        if (fakeOpenRequest.onsuccess) fakeOpenRequest.onsuccess({});
      }, 0);
      return fakeOpenRequest;
    }),
  };

  return { fakeIndexedDB, fakeDB, storeData, fakeOpenRequest };
}

describe('storage 真实 IndexedDB 路径', () => {
  let originalIndexedDB: any;

  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    if (originalIndexedDB !== undefined) {
      (window as any).indexedDB = originalIndexedDB;
    } else {
      delete (window as any).indexedDB;
    }
    vi.restoreAllMocks();
  });

  it('idbSet/idbGet 通过 IndexedDB 往返数据', async () => {
    const { fakeIndexedDB } = createFakeIDB();
    originalIndexedDB = (window as any).indexedDB;
    (window as any).indexedDB = fakeIndexedDB;

    const { idbSet, idbGet } = await import('./storage');
    const ok = await idbSet('idb_key', { hello: 'world' });
    expect(ok).toBe(true);
    const v = await idbGet('idb_key');
    expect(v).toEqual({ hello: 'world' });
  });

  it('idbGet 未命中返回 null', async () => {
    const { fakeIndexedDB } = createFakeIDB();
    originalIndexedDB = (window as any).indexedDB;
    (window as any).indexedDB = fakeIndexedDB;

    const { idbGet } = await import('./storage');
    const v = await idbGet('missing');
    expect(v).toBeNull();
  });

  it('idbDelete 通过 IndexedDB 删除数据', async () => {
    const { fakeIndexedDB } = createFakeIDB();
    originalIndexedDB = (window as any).indexedDB;
    (window as any).indexedDB = fakeIndexedDB;

    const { idbSet, idbDelete, idbGet } = await import('./storage');
    await idbSet('to_del', 'val');
    const ok = await idbDelete('to_del');
    expect(ok).toBe(true);
    const v = await idbGet('to_del');
    expect(v).toBeNull();
  });

  it('openDB onerror 时降级到 localStorage', async () => {
    // 构造一个 onerror 触发的 fake indexedDB
    const fakeOpenRequest: any = {
      result: null,
      error: new Error('open failed'),
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
    };
    const fakeIndexedDB = {
      open: vi.fn(() => {
        setTimeout(() => {
          if (fakeOpenRequest.onerror) fakeOpenRequest.onerror({});
        }, 0);
        return fakeOpenRequest;
      }),
    };
    originalIndexedDB = (window as any).indexedDB;
    (window as any).indexedDB = fakeIndexedDB;

    const { idbSet, idbGet } = await import('./storage');
    // 第一次 openDB 失败，useFallback 变为 true，应降级到 localStorage
    const ok = await idbSet('fallback_test', 'val');
    expect(ok).toBe(true);
    expect(localStorage.getItem('fallback_test')).toBe(JSON.stringify('val'));
    const v = await idbGet('fallback_test');
    expect(v).toBe('val');
  });

  it('migrateFromLocalStorage 在有 IDB 时迁移 mathbeat_ 键', async () => {
    const { fakeIndexedDB } = createFakeIDB();
    originalIndexedDB = (window as any).indexedDB;
    (window as any).indexedDB = fakeIndexedDB;

    // 预置 mathbeat_ 数据
    localStorage.setItem('mathbeat_state', JSON.stringify({ version: '1.0' }));
    localStorage.setItem('mathbeat_lang', JSON.stringify('zh'));
    localStorage.setItem('other_key', JSON.stringify({ keep: true }));

    const { migrateFromLocalStorage, idbGet } = await import('./storage');
    const result = await migrateFromLocalStorage();
    expect(result).toBe(true);

    // 已迁移标记
    const migrated = await idbGet('_migrated');
    expect(migrated).not.toBeNull();
    expect(migrated.count).toBe(2);
  });

  it('migrateFromLocalStorage 第二次调用返回 false（已迁移）', async () => {
    const { fakeIndexedDB } = createFakeIDB();
    originalIndexedDB = (window as any).indexedDB;
    (window as any).indexedDB = fakeIndexedDB;

    localStorage.setItem('mathbeat_x', JSON.stringify({ v: 1 }));

    const { migrateFromLocalStorage } = await import('./storage');
    const first = await migrateFromLocalStorage();
    expect(first).toBe(true);
    const second = await migrateFromLocalStorage();
    expect(second).toBe(false);
  });

  it('migrateFromLocalStorage 在有 IDB 但无 mathbeat_ 键时返回 false', async () => {
    const { fakeIndexedDB } = createFakeIDB();
    originalIndexedDB = (window as any).indexedDB;
    (window as any).indexedDB = fakeIndexedDB;

    localStorage.setItem('other_key', JSON.stringify({ v: 1 }));

    const { migrateFromLocalStorage } = await import('./storage');
    const result = await migrateFromLocalStorage();
    expect(result).toBe(false);
  });

  it('migrateFromLocalStorage 容错损坏的 localStorage 值', async () => {
    const { fakeIndexedDB } = createFakeIDB();
    originalIndexedDB = (window as any).indexedDB;
    (window as any).indexedDB = fakeIndexedDB;

    // 一个损坏的 mathbeat_ 值（无效 JSON）
    localStorage.setItem('mathbeat_broken', '{invalid json');
    localStorage.setItem('mathbeat_ok', JSON.stringify({ v: 1 }));

    const { migrateFromLocalStorage } = await import('./storage');
    const result = await migrateFromLocalStorage();
    // 应只迁移有效的 1 个，count=1 > 0 → true
    expect(result).toBe(true);
  });
});
