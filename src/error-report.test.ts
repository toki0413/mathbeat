import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  installGlobalErrorHandlers,
  reportError,
  setRemoteEndpoint,
  setConsoleMirror,
  getErrorBuffer,
  clearErrorBuffer,
  getSessionId,
  initWebVitalsReporting,
} from './error-report';
import type { Severity } from './error-report';

describe('sessionId', () => {
  it('getSessionId 返回非空字符串', () => {
    const id = getSessionId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('sessionId 持久化到 localStorage', () => {
    const id = getSessionId();
    expect(localStorage.getItem('mathbeat_session_id')).toBe(id);
  });

  it('多次调用 getSessionId 返回相同值', () => {
    const a = getSessionId();
    const b = getSessionId();
    expect(a).toBe(b);
  });
});

describe('reportError - buffer 写入', () => {
  beforeEach(() => {
    clearErrorBuffer();
  });

  it('写入 error buffer (含 context 前缀)', () => {
    reportError(new Error('test'), 'test context');
    const buf = getErrorBuffer();
    expect(buf.length).toBe(1);
    expect(buf[0].message).toBe('test context: test');
    expect(buf[0].type).toBe('manual');
    expect(buf[0].timestamp).toBeGreaterThan(0);
  });

  it('无 context 时 message 仅含错误信息', () => {
    reportError(new Error('boom'));
    const buf = getErrorBuffer();
    expect(buf[0].message).toBe('boom');
  });

  it('支持 severity 参数', () => {
    const sev: Severity = 'warn';
    reportError(new Error('warn test'), 'ctx', sev);
    const buf = getErrorBuffer();
    expect(buf[0].severity).toBe('warn');
  });

  it('默认 severity 为 error', () => {
    reportError(new Error('default'), 'ctx');
    const buf = getErrorBuffer();
    expect(buf[0].severity).toBe('error');
  });

  it('err 为 falsy 时不写入', () => {
    reportError(null);
    reportError(undefined);
    reportError('');
    expect(getErrorBuffer().length).toBe(0);
  });

  it('非 Error 对象被 String 化', () => {
    reportError('string error');
    const buf = getErrorBuffer();
    expect(buf[0].message).toBe('string error');
  });

  it('buffer 最新在前 (unshift)', () => {
    reportError(new Error('first'));
    reportError(new Error('second'));
    const buf = getErrorBuffer();
    expect(buf[0].message).toBe('second');
    expect(buf[1].message).toBe('first');
  });

  it('buffer 上限保护 (50 条)', () => {
    for (let i = 0; i < 60; i++) {
      reportError(new Error(`err-${i}`));
    }
    expect(getErrorBuffer().length).toBe(50);
    expect(getErrorBuffer()[0].message).toBe('err-59');
  });

  it('clearErrorBuffer 清空', () => {
    reportError(new Error('a'));
    reportError(new Error('b'));
    expect(getErrorBuffer().length).toBe(2);
    clearErrorBuffer();
    expect(getErrorBuffer().length).toBe(0);
  });
});

describe('remoteEndpoint 上报', () => {
  beforeEach(() => {
    clearErrorBuffer();
    vi.restoreAllMocks();
    setRemoteEndpoint(null);
  });
  afterEach(() => {
    setRemoteEndpoint(null);
    try {
      history.replaceState(null, '', '/');
    } catch (e) {
      /* noop */
    }
  });

  it('设置 endpoint 后 reportError 触发 fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
    setRemoteEndpoint('https://example.com/report');
    reportError(new Error('remote test'), 'ctx');
    await new Promise((r) => setTimeout(r, 100));
    expect(fetchSpy).toHaveBeenCalled();
    const callArg = fetchSpy.mock.calls[0];
    expect(callArg[0]).toBe('https://example.com/report');
    const body = JSON.parse((callArg[1] as any).body);
    expect(body.sessionId).toBeDefined();
    expect(typeof body.sessionId).toBe('string');
    expect(body.sessionId.length).toBeGreaterThan(0);
    expect(body.url).not.toContain('?');
    expect(body.appVersion).toBeDefined();
  });

  it('未设置 endpoint 时不触发 fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
    reportError(new Error('no remote'), 'ctx');
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('url 脱敏移除 query string', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
    setRemoteEndpoint('https://example.com/report');
    history.replaceState(null, '', '/path?secret=123');
    reportError(new Error('x'), 'ctx');
    await new Promise((r) => setTimeout(r, 100));
    expect(fetchSpy).toHaveBeenCalled();
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
    expect(body.url).toBe(location.origin + '/path');
    expect(body.url).not.toContain('?');
  });

  it('fetch 失败时静默 (不抛错)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
    setRemoteEndpoint('https://example.com/report');
    expect(() => reportError(new Error('fail'), 'ctx')).not.toThrow();
    await new Promise((r) => setTimeout(r, 50));
  });
});

describe('consoleMirror', () => {
  beforeEach(() => {
    clearErrorBuffer();
    setConsoleMirror(false);
  });
  afterEach(() => {
    setConsoleMirror(false);
  });

  it('启用后 reportError 调用 console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setConsoleMirror(true);
    reportError(new Error('mirror test'));
    expect(warnSpy).toHaveBeenCalled();
  });

  it('未启用时不调用 console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    reportError(new Error('no mirror'));
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('installGlobalErrorHandlers', () => {
  beforeEach(() => {
    clearErrorBuffer();
  });

  it('安装后 window error 事件写入 buffer', () => {
    installGlobalErrorHandlers();
    const event = new ErrorEvent('error', {
      message: 'global error',
      filename: 'test.js',
      lineno: 10,
      colno: 5,
    });
    window.dispatchEvent(event);
    const buf = getErrorBuffer();
    expect(buf.length).toBeGreaterThan(0);
    expect(buf[0].message).toBe('global error');
    expect(buf[0].filename).toBe('test.js');
    expect(buf[0].lineno).toBe(10);
    expect(buf[0].colno).toBe(5);
    expect(buf[0].type).toBe('error');
    expect(buf[0].severity).toBe('error');
  });

  it('安装是幂等的 (重复调用不重复监听)', () => {
    installGlobalErrorHandlers();
    installGlobalErrorHandlers();
    clearErrorBuffer();
    const event = new ErrorEvent('error', { message: 'once' });
    window.dispatchEvent(event);
    // 即使调用两次 install，只应有一条记录
    expect(getErrorBuffer().length).toBe(1);
  });

  it('unhandledrejection 事件写入 buffer', () => {
    installGlobalErrorHandlers();
    let event: PromiseRejectionEvent;
    try {
      event = new PromiseRejectionEvent('unhandledrejection', {
        promise: Promise.reject(new Error('rejection')),
        reason: new Error('rejection'),
      });
    } catch (e) {
      // happy-dom 若无 PromiseRejectionEvent 构造器则跳过
      return;
    }
    window.dispatchEvent(event);
    const buf = getErrorBuffer();
    expect(buf.length).toBeGreaterThan(0);
    expect(buf[0].message).toBe('rejection');
    expect(buf[0].type).toBe('unhandledrejection');
  });
});

describe('initWebVitalsReporting', () => {
  it('不抛错 (happy-dom 可能无完整 PerformanceObserver)', () => {
    expect(() => initWebVitalsReporting()).not.toThrow();
  });

  it('设置 endpoint + visibilityState=hidden 时触发 sendBeacon', () => {
    clearErrorBuffer();
    setRemoteEndpoint('https://example.com/vitals');
    // mock sendBeacon
    const sendBeaconSpy = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', {
      value: sendBeaconSpy,
      configurable: true,
    });
    try {
      initWebVitalsReporting();
      // 模拟页面隐藏
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(sendBeaconSpy).toHaveBeenCalled();
    } finally {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      });
      setRemoteEndpoint(null);
    }
  });

  it('无 remoteEndpoint 时不触发 sendBeacon', () => {
    setRemoteEndpoint(null);
    const sendBeaconSpy = vi.fn();
    Object.defineProperty(navigator, 'sendBeacon', {
      value: sendBeaconSpy,
      configurable: true,
    });
    initWebVitalsReporting();
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(sendBeaconSpy).not.toHaveBeenCalled();
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
  });

  it('visibilityState=visible 时不触发上报', () => {
    setRemoteEndpoint('https://example.com/vitals');
    const sendBeaconSpy = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', {
      value: sendBeaconSpy,
      configurable: true,
    });
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    initWebVitalsReporting();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(sendBeaconSpy).not.toHaveBeenCalled();
    setRemoteEndpoint(null);
  });
});

describe('reportError - 多种错误类型与边界', () => {
  beforeEach(() => {
    clearErrorBuffer();
    setRemoteEndpoint(null);
  });

  it('TypeError 含 stack 字段', () => {
    const err = new TypeError('type fail');
    reportError(err);
    const rec = getErrorBuffer()[0];
    expect(rec.message).toBe('type fail');
    expect(rec.stack).toBeDefined();
  });

  it('RangeError 被记录', () => {
    reportError(new RangeError('out of range'));
    expect(getErrorBuffer()[0].message).toBe('out of range');
  });

  it('字符串错误无 stack', () => {
    reportError('plain string error');
    const rec = getErrorBuffer()[0];
    expect(rec.message).toBe('plain string error');
    expect(rec.stack).toBeUndefined();
  });

  it('数字错误被 String 化', () => {
    reportError(42);
    expect(getErrorBuffer()[0].message).toBe('42');
  });

  it('对象错误被 String 化', () => {
    reportError({ code: 500, msg: 'oops' });
    expect(getErrorBuffer()[0].message).toContain('object');
  });

  it('severity=fatal 被正确记录', () => {
    reportError(new Error('fatal'), 'ctx', 'fatal');
    expect(getErrorBuffer()[0].severity).toBe('fatal');
  });

  it('severity=info 被正确记录', () => {
    reportError(new Error('info'), 'ctx', 'info');
    expect(getErrorBuffer()[0].severity).toBe('info');
  });

  it('severity=warn 被正确记录', () => {
    reportError(new Error('warn'), 'ctx', 'warn');
    expect(getErrorBuffer()[0].severity).toBe('warn');
  });

  it('context 含冒号也不影响拼接', () => {
    reportError(new Error('x'), 'ctx:with:colons');
    expect(getErrorBuffer()[0].message).toBe('ctx:with:colons: x');
  });

  it('record 包含 userAgent', () => {
    reportError(new Error('ua'));
    expect(getErrorBuffer()[0].userAgent).toBeDefined();
  });

  it('record 包含 url', () => {
    reportError(new Error('url'));
    expect(getErrorBuffer()[0].url).toBeDefined();
  });

  it('record 包含 timestamp > 0', () => {
    const before = Date.now();
    reportError(new Error('ts'));
    expect(getErrorBuffer()[0].timestamp).toBeGreaterThanOrEqual(before);
  });

  it('循环引用对象不抛错', () => {
    const obj: any = { name: 'cyclic' };
    obj.self = obj;
    expect(() => reportError(obj)).not.toThrow();
    expect(getErrorBuffer().length).toBe(1);
  });

  it('超长错误信息（10000 字符）不抛错', () => {
    const longMsg = 'x'.repeat(10000);
    reportError(new Error(longMsg));
    expect(getErrorBuffer()[0].message.length).toBe(10000);
  });

  it('多次调用同一错误去重不影响写入（按调用逐条记录）', () => {
    const err = new Error('dup');
    reportError(err);
    reportError(err);
    reportError(err);
    expect(getErrorBuffer().length).toBe(3);
  });
});

describe('deliverToRemote - 脱敏与边界', () => {
  beforeEach(() => {
    clearErrorBuffer();
    vi.restoreAllMocks();
    setRemoteEndpoint(null);
  });
  afterEach(() => {
    setRemoteEndpoint(null);
  });

  it('userAgent 被截断到 40 字符以内', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
    setRemoteEndpoint('https://example.com/r');
    // mock navigator.userAgent 为长字符串
    const longUA = 'Mozilla/5.0 ' + 'x'.repeat(80);
    Object.defineProperty(navigator, 'userAgent', {
      value: longUA,
      configurable: true,
    });
    try {
      reportError(new Error('ua test'));
      await new Promise((r) => setTimeout(r, 50));
      expect(fetchSpy).toHaveBeenCalled();
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
      // simplifiedUA = userAgent.split(' ')[0].slice(0, 40)
      expect(body.userAgent.length).toBeLessThanOrEqual(40);
      expect(body.userAgent).toBe('Mozilla/5.0');
    } finally {
      Object.defineProperty(navigator, 'userAgent', {
        value: '',
        configurable: true,
      });
    }
  });

  it('url 为 undefined 时不抛错', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
    setRemoteEndpoint('https://example.com/r');
    // 直接通过 reportError 触发；record.url 由 location.href 决定
    reportError(new Error('no url'));
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('fetch 不存在时静默 (typeof fetch === undefined)', async () => {
    // 临时移除 fetch
    const origFetch = globalThis.fetch;
    // @ts-expect-error 测试需要
    delete globalThis.fetch;
    setRemoteEndpoint('https://example.com/r');
    expect(() => reportError(new Error('no fetch'), 'ctx')).not.toThrow();
    globalThis.fetch = origFetch;
  });

  it('payload 含 sessionId 和 appVersion 字段', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
    setRemoteEndpoint('https://example.com/r');
    reportError(new Error('payload test'), 'ctx');
    await new Promise((r) => setTimeout(r, 50));
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
    expect(body.sessionId).toBeDefined();
    expect(body.appVersion).toBeDefined();
    expect(body.type).toBe('manual');
  });
});

describe('installGlobalErrorHandlers - 边界场景', () => {
  beforeEach(() => {
    clearErrorBuffer();
  });

  it('error 事件 message 为空时使用默认值', () => {
    installGlobalErrorHandlers();
    const event = new ErrorEvent('error', {
      message: '',
      filename: 'a.js',
      lineno: 1,
      colno: 1,
    });
    window.dispatchEvent(event);
    const rec = getErrorBuffer()[0];
    expect(rec.message).toBe('Unknown error');
  });

  it('error 事件 error 字段非 Error 时 stack 为 undefined', () => {
    installGlobalErrorHandlers();
    const event = new ErrorEvent('error', {
      message: 'str err',
      error: 'string error' as any,
    });
    window.dispatchEvent(event);
    const rec = getErrorBuffer()[0];
    expect(rec.stack).toBeUndefined();
  });

  it('unhandledrejection reason 为字符串时直接使用', () => {
    installGlobalErrorHandlers();
    let event: PromiseRejectionEvent;
    try {
      event = new PromiseRejectionEvent('unhandledrejection', {
        promise: Promise.reject('rejection string'),
        reason: 'rejection string',
      });
    } catch (e) {
      return; // happy-dom 不支持
    }
    window.dispatchEvent(event);
    expect(getErrorBuffer()[0].message).toBe('rejection string');
  });

  it('unhandledrejection reason 为对象时使用默认消息', () => {
    installGlobalErrorHandlers();
    let event: PromiseRejectionEvent;
    try {
      event = new PromiseRejectionEvent('unhandledrejection', {
        promise: Promise.reject({ code: 500 }),
        reason: { code: 500 } as any,
      });
    } catch (e) {
      return;
    }
    window.dispatchEvent(event);
    expect(getErrorBuffer()[0].message).toBe('Unhandled promise rejection');
  });

  it('consoleMirror 启用时 window error 也输出 console.warn', () => {
    setConsoleMirror(true);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    installGlobalErrorHandlers();
    try {
      const event = new ErrorEvent('error', { message: 'mirror test' });
      window.dispatchEvent(event);
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      setConsoleMirror(false);
    }
  });
});

describe('getAppVersion 边界', () => {
  it('localStorage 无版本时返回 unknown（通过 remote payload 验证）', async () => {
    clearErrorBuffer();
    vi.restoreAllMocks();
    localStorage.removeItem('mathbeat_app_version');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
    setRemoteEndpoint('https://example.com/r');
    reportError(new Error('v'));
    await new Promise((r) => setTimeout(r, 50));
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
    expect(body.appVersion).toBe('unknown');
    setRemoteEndpoint(null);
  });

  it('localStorage 含版本时返回存储的版本', async () => {
    clearErrorBuffer();
    vi.restoreAllMocks();
    localStorage.setItem('mathbeat_app_version', '1.2.3');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
    setRemoteEndpoint('https://example.com/r');
    reportError(new Error('v2'));
    await new Promise((r) => setTimeout(r, 50));
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
    expect(body.appVersion).toBe('1.2.3');
    localStorage.removeItem('mathbeat_app_version');
    setRemoteEndpoint(null);
  });

  it('__APP_VERSION__ 全局变量作为版本回退', async () => {
    clearErrorBuffer();
    vi.restoreAllMocks();
    localStorage.removeItem('mathbeat_app_version');
    (globalThis as any).__APP_VERSION__ = '9.9.9-beta';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
    setRemoteEndpoint('https://example.com/r');
    try {
      reportError(new Error('v3'));
      await new Promise((r) => setTimeout(r, 50));
      const body = JSON.parse((fetchSpy.mock.calls[0][1] as any).body);
      expect(body.appVersion).toBe('9.9.9-beta');
    } finally {
      delete (globalThis as any).__APP_VERSION__;
      setRemoteEndpoint(null);
    }
  });
});

describe('sessionId 边界', () => {
  it('sessionId 已写入 localStorage（模块加载时持久化）', () => {
    const id = getSessionId();
    expect(localStorage.getItem('mathbeat_session_id')).toBe(id);
  });

  it('getSessionId 多次返回相同值（缓存稳定）', () => {
    const id1 = getSessionId();
    const id2 = getSessionId();
    expect(id1).toBe(id2);
  });

  it('清除 localStorage 后仍能正常返回缓存值', () => {
    const cachedId = getSessionId();
    localStorage.removeItem('mathbeat_session_id');
    // getSessionId 返回缓存值，不重新读取 localStorage
    const id = getSessionId();
    expect(id).toBe(cachedId);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });
});

describe('批量上报与去重', () => {
  beforeEach(() => {
    clearErrorBuffer();
  });

  it('连续上报 100 个错误（批量场景）', () => {
    for (let i = 0; i < 100; i++) {
      reportError(new Error(`batch-${i}`), `ctx-${i}`);
    }
    // buffer 上限 50
    expect(getErrorBuffer().length).toBe(50);
    // 最新在前
    expect(getErrorBuffer()[0].message).toBe('ctx-99: batch-99');
    expect(getErrorBuffer()[49].message).toBe('ctx-50: batch-50');
  });

  it('同 message 不同 context 视为不同记录', () => {
    reportError(new Error('same'), 'ctx1');
    reportError(new Error('same'), 'ctx2');
    const buf = getErrorBuffer();
    expect(buf.length).toBe(2);
    expect(buf[0].message).toBe('ctx2: same');
    expect(buf[1].message).toBe('ctx1: same');
  });

  it('混合 severity 不影响顺序', () => {
    reportError(new Error('a'), 'ctx', 'info');
    reportError(new Error('b'), 'ctx', 'fatal');
    reportError(new Error('c'), 'ctx', 'warn');
    const buf = getErrorBuffer();
    expect(buf[0].message).toBe('ctx: c');
    expect(buf[0].severity).toBe('warn');
    expect(buf[1].severity).toBe('fatal');
    expect(buf[2].severity).toBe('info');
  });
});
