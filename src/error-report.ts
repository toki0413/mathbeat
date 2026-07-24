/**
 * 全局错误捕获与上报基础设施。
 *
 * 设计目标：
 *  - 捕获同步异常 (window.onerror) 与未处理的 Promise rejection
 *  - 提供本地环形缓冲区存储最近 N 条错误（可在开发者面板查看）
 *  - 提供 reportError() 给业务代码主动上报
 *  - 不依赖任何第三方（Sentry 等），但保留上报 hook 接口
 *  - 默认不上报到任何远端（保护用户隐私，COPPA 友好）
 *
 * 若需启用远端上报，调用 setRemoteEndpoint(url)。
 */

export interface ErrorRecord {
  type: 'error' | 'unhandledrejection' | 'manual';
  message: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  timestamp: number;
  userAgent?: string;
  url?: string;
}

const BUFFER_MAX = 50;
const buffer: ErrorRecord[] = [];
let remoteEndpoint: string | null = null;
let installed = false;
let consoleMirror = false;

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

/** 主动上报错误。 */
export function reportError(err: unknown, context?: string): void {
  if (!err) return;
  const record: ErrorRecord = {
    type: 'manual',
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
    fetch(remoteEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
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

/** 安装全局错误监听。应在 main.ts 启动时调用一次。 */
export function installGlobalErrorHandlers(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (e: ErrorEvent) => {
    const record: ErrorRecord = {
      type: 'error',
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
