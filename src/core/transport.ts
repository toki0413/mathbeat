/**
 * MathBeat 统一音频 Transport
 *
 * 基于 Web Audio API `currentTime` 驱动，替代各 world 中分散的 setTimeout scheduler。
 * 所有节奏/旋律播放应通过 Transport 订阅事件，自身不再直接 setTimeout。
 */

export interface TransportEvent {
  step: number; // 从 0 开始递增的步序号
  time: number; // 精确的音频时钟触发时间（秒）
}

export type TransportCallback = (event: TransportEvent) => void;

export class Transport {
  private ctx: AudioContext;
  private bpm: number;
  private stepsPerBeat: number;
  private stepDuration!: number;
  private playing = false;
  private nextStepTime = 0;
  private currentStep = 0;
  private subscribers: TransportCallback[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lookahead = 0.1; // 提前调度窗口（秒）
  private pollInterval = 25; // scheduler 轮询间隔（毫秒）

  constructor(ctx: AudioContext, bpm = 120, stepsPerBeat = 4) {
    this.ctx = ctx;
    this.bpm = bpm;
    this.stepsPerBeat = stepsPerBeat;
    this.updateStepDuration();
  }

  private updateStepDuration() {
    this.stepDuration = 60.0 / this.bpm / this.stepsPerBeat;
  }

  setBpm(bpm: number) {
    this.bpm = Math.max(30, Math.min(300, bpm));
    this.updateStepDuration();
  }

  getBpm() {
    return this.bpm;
  }

  setStepsPerBeat(stepsPerBeat: number) {
    this.stepsPerBeat = Math.max(1, stepsPerBeat);
    this.updateStepDuration();
  }

  setLoop(length: number) {
    // 预留：未来支持按指定步数循环
    void length;
  }

  subscribe(cb: TransportCallback): () => void {
    this.subscribers.push(cb);
    return () => {
      const idx = this.subscribers.indexOf(cb);
      if (idx >= 0) this.subscribers.splice(idx, 1);
    };
  }

  start() {
    if (this.playing) return;
    this.playing = true;
    this.nextStepTime = this.ctx.currentTime + 0.05;
    this.scheduleLoop();
  }

  stop() {
    this.playing = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const idx = activeTransports.indexOf(this);
    if (idx >= 0) activeTransports.splice(idx, 1);
  }

  reset() {
    this.stop();
    this.currentStep = 0;
  }

  restart() {
    this.reset();
    this.start();
  }

  isPlaying() {
    return this.playing;
  }

  private scheduleLoop() {
    if (!this.playing) return;
    // 限制每次最多 schedule 4 步，防止标签页切回时爆发式调度
    let scheduled = 0;
    const MAX_BATCH = 4;
    while (
      this.nextStepTime < this.ctx.currentTime + this.lookahead &&
      scheduled < MAX_BATCH
    ) {
      const event: TransportEvent = { step: this.currentStep, time: this.nextStepTime };
      this.subscribers.forEach((cb) => {
        try {
          cb(event);
        } catch (e) {
          console.error('Transport subscriber error:', e);
        }
      });
      this.currentStep++;
      this.nextStepTime += this.stepDuration;
      scheduled++;
    }
    this.timer = setTimeout(() => this.scheduleLoop(), this.pollInterval);
  }
}

/** 当前所有活跃 Transport 实例，用于全局停止 */
const activeTransports: Transport[] = [];

/**
 * 创建一个 Transport 并加入全局管理列表。
 * 调用方负责在不需要时调用 transport.stop()。
 */
export function createTransport(ctx: AudioContext, bpm = 120, stepsPerBeat = 4): Transport {
  const t = new Transport(ctx, bpm, stepsPerBeat);
  activeTransports.push(t);
  return t;
}

/** 停止并清空所有活跃 Transport */
export function stopAllTransports(): void {
  // 复制数组：stop() 内部会 splice activeTransports，直接 forEach 会跳过元素
  [...activeTransports].forEach((t) => t.stop());
  activeTransports.length = 0;
}

/** 停止除指定 Transport 外的所有 Transport（避免多个播放源冲突） */
export function stopOtherTransports(except: Transport): void {
  for (let i = activeTransports.length - 1; i >= 0; i--) {
    const t = activeTransports[i];
    if (t !== except) {
      t.stop();
      activeTransports.splice(i, 1);
    }
  }
}
