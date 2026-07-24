/**
 * 全局错误捕获与上报基础设施。
 *
 * 设计目标：
 *  - 捕获同步异常 (window.onerror) 与未处理的 Promise rejection
 *  - 提供本地环形缓冲区存储最近 N 条错误（可在开发者面板查看）
 *  - 提供 reportError() 给业务代码主动上报
 *  - 不依赖任何第三方（Sentry 等），但保留上报 hook 接口
 *  - 默认不上报到任何远端（保护用户隐私，COPPA 友好）
 *  - 采集会话标识、severity 分级、Web Vitals 以增强可观测性
 *
 * 若需启用远端上报，调用 setRemoteEndpoint(url)。
 */

export type Severity = 'info' | 'warn' | 'error' | 'fatal';

export interface ErrorRecord {
  type: 'error' | 'unhandledrejection' | 'manual';
  severity: Severity;
  message: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  timestamp: number;
  userAgent?: string;
  url?: string;
  sessionId?: string;
  appVersion?: string;
}

const BUFFER_MAX = 50;
const SESSION_KEY = 'mathbeat_session_id';
const APP_VERSION_KEY = 'mathbeat_app_version';
const buffer: ErrorRecord[] = [];
let remoteEndpoint: string | null = null;
let installed = false;
let consoleMirror = false;
let sessionId = '';

/** 生成或读取会话标识（localStorage 持久化，缺省回退 Date.now()+random）。 */
function getOrCreateSessionId(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const existing = localStorage.getItem(SESSION_KEY);
      if (existing) return existing;
    }
  } catch (e) {
    /* localStorage 不可用时走生成路径 */
  }
  let id = '';
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      id = crypto.randomUUID();
    }
  } catch (e) {
    /* noop */
  }
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SESSION_KEY, id);
    }
  } catch (e) {
    /* noop */
  }
  return id;
}

/** 返回当前会话标识。 */
export function getSessionId(): string {
  return sessionId;
}

/** 读取应用版本（localStorage 或 __APP_VERSION__ 全局，缺省 'unknown'）。 */
function getAppVersion(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem(APP_VERSION_KEY);
      if (v) return v;
    }
  } catch (e) {
    /* noop */
  }
  try {
    const g = globalThis as { __APP_VERSION__?: string };
    if (g.__APP_VERSION__) return g.__APP_VERSION__;
  } catch (e) {
    /* noop */
  }
  return 'unknown';
}

// 模块加载时初始化会话标识
sessionId = getOrCreateSessionId();

/** 设置远端上报端点（启用后所有错误会异步 POST 到该 URL）。 */
export function setRemoteEndpoint(url: string | null): void {
  remoteEndpoint = url;
}

/** 启用控制台镜像（错误会同时 console.warn 输出，便于本地调试）。 */
export function setConsoleMirror(enabled: boolean): void {
  consoleMirror = enabled;
}

/** 读取错误缓冲区副本（最近的在前）。 */
export function getErrorBuffer(): ErrorRecord[] {
  return buffer.slice();
}

/** 清空错误缓冲区。 */
export function clearErrorBuffer(): void {
  buffer.length = 0;
}

/** 主动上报错误。severity 默认 'error'。 */
export function reportError(err: unknown, context?: string, severity: Severity = 'error'): void {
  if (!err) return;
  const record: ErrorRecord = {
    type: 'manual',
    severity,
    message: (context ? context + ': ' : '') + (err instanceof Error ? err.message : String(err)),
    stack: err instanceof Error ? err.stack : undefined,
    timestamp: Date.now(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    url: typeof location !== 'undefined' ? location.href : undefined,
  };
  pushRecord(record);
  if (consoleMirror) console.warn('[MathBeat Error]', record);
  deliverToRemote(record);
}

function pushRecord(record: ErrorRecord): void {
  buffer.unshift(record);
  if (buffer.length > BUFFER_MAX) buffer.length = BUFFER_MAX;
}

function deliverToRemote(record: ErrorRecord): void {
  if (!remoteEndpoint || typeof fetch === 'undefined') return;
  try {
    const sanitizedUrl = record.url ? record.url.split('?')[0] : record.url;
    const simplifiedUA = record.userAgent
      ? record.userAgent.split(' ')[0].slice(0, 40)
      : record.userAgent;
    const payload = {
      ...record,
      url: sanitizedUrl,
      userAgent: simplifiedUA,
      sessionId: getSessionId(),
      appVersion: getAppVersion(),
    };
    fetch(remoteEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: 'omit',
      mode: 'cors',
    }).catch(() => {
      /* 网络失败静默，不影响主流程 */
    });
  } catch (e) {
    /* noop */
  }
}

/**
 * 初始化 Web Vitals 采集（LCP / CLS / INP，原生 PerformanceObserver）。
 * 页面隐藏时一次性上报到 remoteEndpoint（若已设置），优先 sendBeacon，回退 fetch keepalive。
 * 全部失败静默。
 */
export function initWebVitalsReporting(): void {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return;

  let lcp = 0;
  let cls = 0;
  let inp = 0;
  const inpDurations: number[] = [];

  try {
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        lcp = entry.startTime;
      }
    });
    obs.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {
    /* noop */
  }

  try {
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
        if (!shift.hadRecentInput) {
          cls += shift.value ?? 0;
        }
      }
    });
    obs.observe({ type: 'layout-shift', buffered: true });
  } catch (e) {
    /* noop */
  }

  try {
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 0) {
          inpDurations.push(entry.duration);
        }
      }
      if (inpDurations.length > 0) {
        inp = Math.max(...inpDurations);
      }
    });
    obs.observe({ type: 'event', buffered: true });
  } catch (e) {
    /* noop */
  }

  let reported = false;
  const reportVitals = (): void => {
    if (reported) return;
    if (typeof document === 'undefined' || document.visibilityState !== 'hidden') return;
    if (!remoteEndpoint) return;
    reported = true;
    try {
      const payload = JSON.stringify({
        type: 'web-vitals',
        sessionId: getSessionId(),
        lcp,
        cls,
        inp,
        url: typeof location !== 'undefined' ? location.href : '',
        ts: Date.now(),
      });
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon(remoteEndpoint, payload);
      } else if (typeof fetch !== 'undefined') {
        fetch(remoteEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
          credentials: 'omit',
          mode: 'cors',
        }).catch(() => {
          /* noop */
        });
      }
    } catch (e) {
      /* noop */
    }
  };

  try {
    document.addEventListener('visibilitychange', reportVitals);
  } catch (e) {
    /* noop */
  }
}

/** 安装全局错误监听。应在 main.ts 启动时调用一次。 */
export function installGlobalErrorHandlers(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (e: ErrorEvent) => {
    const record: ErrorRecord = {
      type: 'error',
      severity: 'error',
      message: e.message || 'Unknown error',
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
      stack: e.error instanceof Error ? e.error.stack : undefined,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: location.href,
    };
    pushRecord(record);
    if (consoleMirror) console.warn('[MathBeat window.onerror]', record);
    deliverToRemote(record);
  });

  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    const reason = e.reason;
    const record: ErrorRecord = {
      type: 'unhandledrejection',
      severity: 'error',
      message: reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : 'Unhandled promise rejection',
      stack: reason instanceof Error ? reason.stack : undefined,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: location.href,
    };
    pushRecord(record);
    if (consoleMirror) console.warn('[MathBeat unhandledrejection]', record);
    deliverToRemote(record);
  });
}
