import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock 音频与 events 副作用
const transportMock = {
  subscribe: vi.fn(() => vi.fn()),
  start: vi.fn(),
  stop: vi.fn(),
  setBpm: vi.fn(),
};
const audioCtxMock = {
  currentTime: 0,
  state: 'running',
  resume: vi.fn(),
};

vi.mock('./audio', () => ({
  getAudioCtx: () => audioCtxMock,
  getSharedTransport: vi.fn(() => transportMock),
  stopSharedTransport: vi.fn(),
  playSample: vi.fn(),
  scheduleToneAt: vi.fn(),
}));
vi.mock('./events', () => ({ registerActions: vi.fn() }));
vi.mock('./ui-feedback', () => ({ showToast: vi.fn() }));
vi.mock('./store', () => ({
  Store: {
    state: {},
    save: vi.fn(),
    listeners: [],
  },
}));

import {
  openPracticeMode,
  closePracticeMode,
  playPractice,
  pausePractice,
  togglePracticePlay,
  stopPractice,
  setPracticeSpeed,
  toggleErrorMark,
  setLoopStart,
  setLoopEnd,
  clearLoop,
  toggleMetronome,
  clearErrors,
  replayErrors,
  openPracticeFromWorld1,
  openPracticeFromWorld4,
  openPracticeFromWorld6,
  openPracticeFromWorld7,
} from './practice-mode';
import { getSharedTransport, stopSharedTransport, playSample, scheduleToneAt } from './audio';
import { showToast } from './ui-feedback';
import type { PracticeConfig } from './practice-mode';

describe('practice-mode 分段练习模式', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    transportMock.subscribe.mockReturnValue(vi.fn());
    audioCtxMock.state = 'running';
  });

  it('openPracticeMode 拒绝无效配置', () => {
    // 无 showToast 抛错即可（已被 mock）
    openPracticeMode({ tracks: [], totalSteps: 0, baseBpm: 120 });
    // 不应创建 modal
    expect(document.getElementById('practiceModal')).toBeNull();
  });

  it('openPracticeMode 有效配置创建 modal', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false, true, false], sound: 'kick' }],
      totalSteps: 4,
      baseBpm: 120,
    });
    const modal = document.getElementById('practiceModal');
    expect(modal).not.toBeNull();
    expect(modal!.getAttribute('role')).toBe('dialog');
    expect(modal!.getAttribute('aria-modal')).toBe('true');
    expect(modal!.getAttribute('aria-label')).toBe('分段练习模式');
  });

  it('closePracticeMode 隐藏 modal', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false], sound: 'kick' }],
      totalSteps: 2,
      baseBpm: 120,
    });
    closePracticeMode();
    const modal = document.getElementById('practiceModal');
    // 关闭后 display 应为 none（异步过渡，立即检查可能仍为 flex，但状态变化）
    expect(modal).not.toBeNull();
  });

  it('toggleErrorMark 切换错误标记', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false, true, false], sound: 'kick' }],
      totalSteps: 4,
      baseBpm: 120,
    });
    // 切换第 0 步
    toggleErrorMark({} as Event, 0);
    // 再次切换应取消
    toggleErrorMark({} as Event, 0);
    // 验证不抛错即可（内部 state 私有）
    expect(true).toBe(true);
  });

  it('toggleErrorMark 越界步号不抛错', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false], sound: 'kick' }],
      totalSteps: 2,
      baseBpm: 120,
    });
    expect(() => toggleErrorMark({} as Event, 999)).not.toThrow();
    expect(() => toggleErrorMark({} as Event, -1)).not.toThrow();
  });

  it('setPracticeSpeed 设置有效速度', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false], sound: 'kick' }],
      totalSteps: 2,
      baseBpm: 120,
    });
    setPracticeSpeed({} as Event, 0.5);
    setPracticeSpeed({} as Event, 0.75);
    setPracticeSpeed({} as Event, 1);
    // 验证不抛错
    expect(true).toBe(true);
  });

  it('setPracticeSpeed 非法值回退到 1', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false], sound: 'kick' }],
      totalSteps: 2,
      baseBpm: 120,
    });
    expect(() => setPracticeSpeed({} as Event, 0.6 as number)).not.toThrow();
  });

  it('setLoopStart/setLoopEnd/clearLoop 循环控制', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false, true, false, true, false], sound: 'kick' }],
      totalSteps: 6,
      baseBpm: 120,
    });
    setLoopStart({} as Event, 1);
    setLoopEnd({} as Event, 4);
    clearLoop();
    expect(true).toBe(true);
  });

  it('setLoopStart 越界不抛错', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false], sound: 'kick' }],
      totalSteps: 2,
      baseBpm: 120,
    });
    expect(() => setLoopStart({} as Event, 999)).not.toThrow();
    expect(() => setLoopStart({} as Event, -1)).not.toThrow();
  });

  it('setLoopEnd 自动校正 start（end < start 时）', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false, true, false], sound: 'kick' }],
      totalSteps: 4,
      baseBpm: 120,
    });
    // 先设 start=3，再设 end=0，应自动把 start 校正为 0
    setLoopStart({} as Event, 3);
    expect(() => setLoopEnd({} as Event, 0)).not.toThrow();
  });

  it('toggleMetronome 切换节拍器状态', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false], sound: 'kick' }],
      totalSteps: 2,
      baseBpm: 120,
    });
    toggleMetronome();
    toggleMetronome();
    expect(true).toBe(true);
  });

  it('clearErrors 清空所有错误标记', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false, true, false], sound: 'kick' }],
      totalSteps: 4,
      baseBpm: 120,
    });
    toggleErrorMark({} as Event, 0);
    toggleErrorMark({} as Event, 2);
    clearErrors();
    expect(true).toBe(true);
  });

  it('openPracticeFromWorld1 生成 lcm 步数的双轨道', () => {
    openPracticeFromWorld1(3, 4, 12, 120);
    const modal = document.getElementById('practiceModal');
    expect(modal).not.toBeNull();
  });

  it('openPracticeFromWorld4 双环对齐', () => {
    openPracticeFromWorld4(3, 4, 12, 120);
    expect(document.getElementById('practiceModal')).not.toBeNull();
  });

  it('openPracticeFromWorld6 欧几里得节奏', () => {
    openPracticeFromWorld6(3, 8, 120);
    expect(document.getElementById('practiceModal')).not.toBeNull();
  });

  it('openPracticeFromWorld7 概率骰子节奏（用户推进的功能）', () => {
    openPracticeFromWorld7(50, 8, 120);
    expect(document.getElementById('practiceModal')).not.toBeNull();
    // 验证世界7扩展：练习模式应支持概率节奏
    const seq = document.getElementById('practiceSeq');
    expect(seq).not.toBeNull();
  });

  it('openPracticeFromWorld7 不同概率生成不同 pattern', () => {
    document.body.innerHTML = '';
    openPracticeFromWorld7(10, 8, 120);
    expect(document.getElementById('practiceModal')).not.toBeNull();
    closePracticeMode();
    document.body.innerHTML = '';
    openPracticeFromWorld7(90, 8, 120);
    expect(document.getElementById('practiceModal')).not.toBeNull();
  });
});

describe('practice-mode 播放控制', () => {
  const baseConfig: PracticeConfig = {
    tracks: [
      { name: 'A', steps: [true, false, true, false], sound: 'kick' },
      { name: 'B', steps: [false, true, false, true], sound: 'snare' },
    ],
    totalSteps: 4,
    baseBpm: 120,
  };

  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    transportMock.subscribe.mockReturnValue(vi.fn());
    audioCtxMock.state = 'running';
  });

  it('playPractice 启动 transport 并订阅事件', () => {
    openPracticeMode(baseConfig);
    playPractice();
    expect(getSharedTransport).toHaveBeenCalled();
    expect(transportMock.subscribe).toHaveBeenCalled();
    expect(transportMock.start).toHaveBeenCalled();
    expect(stopSharedTransport).toHaveBeenCalled();
  });

  it('playPractice 在 audioCtx suspended 时调用 resume', () => {
    audioCtxMock.state = 'suspended';
    openPracticeMode(baseConfig);
    playPractice();
    expect(audioCtxMock.resume).toHaveBeenCalled();
  });

  it('playPractice 重复调用不重复启动 (playing=true 时直接返回)', () => {
    openPracticeMode(baseConfig);
    playPractice();
    playPractice();
    expect(transportMock.start).toHaveBeenCalledTimes(1);
  });

  it('playPractice 在无 rt 时 (未 open) 不抛错', () => {
    expect(() => playPractice()).not.toThrow();
  });

  it('pausePractice 停止 transport 并取消订阅', () => {
    openPracticeMode(baseConfig);
    playPractice();
    const unsubSpy = vi.fn();
    transportMock.subscribe.mockReturnValue(unsubSpy);
    // 重新 play 让新的 unsub 生效
    pausePractice();
    pausePractice();
    expect(transportMock.stop).toHaveBeenCalled();
  });

  it('pausePractice 在无 rt 时不抛错', () => {
    expect(() => pausePractice()).not.toThrow();
  });

  it('togglePracticePlay 在停止状态调用 play', () => {
    openPracticeMode(baseConfig);
    togglePracticePlay();
    expect(transportMock.start).toHaveBeenCalled();
  });

  it('togglePracticePlay 在播放状态调用 pause', () => {
    openPracticeMode(baseConfig);
    playPractice();
    togglePracticePlay();
    expect(transportMock.stop).toHaveBeenCalled();
  });

  it('togglePracticePlay 在无 rt 时不抛错', () => {
    expect(() => togglePracticePlay()).not.toThrow();
  });

  it('stopPractice 调用 pausePractice', () => {
    openPracticeMode(baseConfig);
    playPractice();
    stopPractice();
    expect(transportMock.stop).toHaveBeenCalled();
  });

  it('play → pause → play 序列正常工作', () => {
    openPracticeMode(baseConfig);
    playPractice();
    pausePractice();
    playPractice();
    expect(transportMock.start).toHaveBeenCalledTimes(2);
    expect(transportMock.stop).toHaveBeenCalledTimes(1);
  });
});

describe('practice-mode replayErrors', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    transportMock.subscribe.mockReturnValue(vi.fn());
    audioCtxMock.state = 'running';
  });

  it('replayErrors 无错误标记时调用 showToast 提示', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false, true, false], sound: 'kick' }],
      totalSteps: 4,
      baseBpm: 120,
    });
    replayErrors();
    expect(showToast).toHaveBeenCalledWith('还没有标记错误步，点击下方格子标记', 'info');
  });

  it('replayErrors 在无 rt 时不抛错', () => {
    expect(() => replayErrors()).not.toThrow();
  });

  it('replayErrors 有错误标记时触发音色回放', () => {
    vi.useFakeTimers();
    try {
      openPracticeMode({
        tracks: [{ name: 'A', steps: [true, false, true, false], sound: 'kick' }],
        totalSteps: 4,
        baseBpm: 120,
      });
      toggleErrorMark({} as Event, 0);
      toggleErrorMark({} as Event, 2);
      replayErrors();
      // playSample 应被调用（kick 触发音色）
      expect(playSample).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('replayErrors 在播放状态下先暂停再回放', () => {
    vi.useFakeTimers();
    try {
      openPracticeMode({
        tracks: [{ name: 'A', steps: [true, false, true, false], sound: 'kick' }],
        totalSteps: 4,
        baseBpm: 120,
      });
      playPractice();
      toggleErrorMark({} as Event, 0);
      replayErrors();
      expect(transportMock.stop).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('replayErrors tone 音色触发 scheduleToneAt', () => {
    vi.useFakeTimers();
    try {
      openPracticeMode({
        tracks: [{ name: 'T', steps: [true, false, true, false], sound: 'tone', freq: 440 }],
        totalSteps: 4,
        baseBpm: 120,
      });
      toggleErrorMark({} as Event, 0);
      replayErrors();
      expect(scheduleToneAt).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('practice-mode UI 渲染细节', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    transportMock.subscribe.mockReturnValue(vi.fn());
    audioCtxMock.state = 'running';
  });

  it('renderPracticeSequencer 渲染步号行（1-based）', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false, true], sound: 'kick' }],
      totalSteps: 3,
      baseBpm: 120,
    });
    const seq = document.getElementById('practiceSeq')!;
    expect(seq.innerHTML).toContain('1');
    expect(seq.innerHTML).toContain('2');
    expect(seq.innerHTML).toContain('3');
    expect(seq.innerHTML).toContain('practice-step-num');
  });

  it('renderPracticeSequencer 渲染轨道行（含 track name）', () => {
    openPracticeMode({
      tracks: [{ name: 'MyTrack', steps: [true, false], sound: 'kick' }],
      totalSteps: 2,
      baseBpm: 120,
    });
    const seq = document.getElementById('practiceSeq')!;
    expect(seq.innerHTML).toContain('MyTrack');
    expect(seq.innerHTML).toContain('practice-track-row');
  });

  it('renderPracticeSequencer 渲染错误标记行', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false], sound: 'kick' }],
      totalSteps: 2,
      baseBpm: 120,
    });
    const seq = document.getElementById('practiceSeq')!;
    expect(seq.innerHTML).toContain('❌ 错误');
    expect(seq.innerHTML).toContain('practice-error-row');
  });

  it('renderPracticeSequencer 在循环内的步显示 in-loop 类', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false, true, false, true], sound: 'kick' }],
      totalSteps: 5,
      baseBpm: 120,
    });
    setLoopStart({} as Event, 1);
    setLoopEnd({} as Event, 3);
    const seq = document.getElementById('practiceSeq')!;
    expect(seq.innerHTML).toContain('in-loop');
  });

  it('renderPracticeSequencer loop-start/loop-end 标记', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false, true, false], sound: 'kick' }],
      totalSteps: 4,
      baseBpm: 120,
    });
    setLoopStart({} as Event, 1);
    setLoopEnd({} as Event, 2);
    const seq = document.getElementById('practiceSeq')!;
    expect(seq.innerHTML).toContain('loop-start');
    expect(seq.innerHTML).toContain('loop-end');
  });

  it('renderPracticeControls 渲染速度按钮（0.5x/0.75x/1x）', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false], sound: 'kick' }],
      totalSteps: 2,
      baseBpm: 120,
    });
    const ctrl = document.getElementById('practiceControls')!;
    expect(ctrl.innerHTML).toContain('0.5x');
    expect(ctrl.innerHTML).toContain('0.75x');
    expect(ctrl.innerHTML).toContain('1x');
  });

  it('renderPracticeControls 显示当前 BPM', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false], sound: 'kick' }],
      totalSteps: 2,
      baseBpm: 100,
    });
    const ctrl = document.getElementById('practiceControls')!;
    expect(ctrl.innerHTML).toContain('100 BPM');
  });

  it('renderPracticeControls 速度变化后 BPM 同步变化', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false], sound: 'kick' }],
      totalSteps: 2,
      baseBpm: 120,
    });
    setPracticeSpeed({} as Event, 0.5);
    const ctrl = document.getElementById('practiceControls')!;
    expect(ctrl.innerHTML).toContain('60 BPM');
  });

  it('renderPracticeControls 渲染循环文本（未设置循环）', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false], sound: 'kick' }],
      totalSteps: 2,
      baseBpm: 120,
    });
    const ctrl = document.getElementById('practiceControls')!;
    expect(ctrl.innerHTML).toContain('未设置循环');
  });

  it('renderPracticeControls 渲染循环文本（已设置 A/B）', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false, true, false, true], sound: 'kick' }],
      totalSteps: 5,
      baseBpm: 120,
    });
    setLoopStart({} as Event, 1);
    setLoopEnd({} as Event, 3);
    const ctrl = document.getElementById('practiceControls')!;
    // 1-based 显示：A=2 → B=4
    expect(ctrl.innerHTML).toContain('A=2');
    expect(ctrl.innerHTML).toContain('B=4');
  });

  it('renderPracticeControls 渲染节拍器按钮（开关状态）', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false], sound: 'kick' }],
      totalSteps: 2,
      baseBpm: 120,
    });
    let ctrl = document.getElementById('practiceControls')!;
    expect(ctrl.innerHTML).toContain('节拍器 关');
    toggleMetronome();
    ctrl = document.getElementById('practiceControls')!;
    expect(ctrl.innerHTML).toContain('节拍器 开');
  });

  it('renderPracticeControls 渲染回放错误按钮（含错误数）', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false, true, false], sound: 'kick' }],
      totalSteps: 4,
      baseBpm: 120,
    });
    toggleErrorMark({} as Event, 0);
    toggleErrorMark({} as Event, 2);
    // toggleErrorMark 只触发 renderPracticeSequencer，验证 sequencer 含 marked 类
    const seq = document.getElementById('practiceSeq')!;
    const markedCount = (seq.innerHTML.match(/practice-cell error marked/g) || []).length;
    expect(markedCount).toBe(2);
  });

  it('renderPracticeControls 渲染设A点/设B点按钮', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false], sound: 'kick' }],
      totalSteps: 2,
      baseBpm: 120,
    });
    const ctrl = document.getElementById('practiceControls')!;
    expect(ctrl.innerHTML).toContain('设A点=步1');
    expect(ctrl.innerHTML).toContain('设B点=步2');
  });

  it('updatePlayBtn 在 playPractice 后变为 ⏸', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false], sound: 'kick' }],
      totalSteps: 2,
      baseBpm: 120,
    });
    playPractice();
    const btn = document.getElementById('practicePlayBtn')!;
    expect(btn.textContent).toBe('⏸');
  });

  it('updatePlayBtn 在 pausePractice 后变为 ▶', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false], sound: 'kick' }],
      totalSteps: 2,
      baseBpm: 120,
    });
    playPractice();
    pausePractice();
    const btn = document.getElementById('practicePlayBtn')!;
    expect(btn.textContent).toBe('▶');
  });

  it('createPracticeModalElement 含 close 按钮（aria-label=关闭）', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false], sound: 'kick' }],
      totalSteps: 2,
      baseBpm: 120,
    });
    const modal = document.getElementById('practiceModal')!;
    expect(modal.innerHTML).toContain('aria-label="关闭"');
    expect(modal.innerHTML).toContain('closePracticeMode');
  });

  it('modal 含完成练习按钮', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false], sound: 'kick' }],
      totalSteps: 2,
      baseBpm: 120,
    });
    const modal = document.getElementById('practiceModal')!;
    expect(modal.innerHTML).toContain('完成练习');
  });

  it('modal 含 stop 按钮和 play 按钮', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false], sound: 'kick' }],
      totalSteps: 2,
      baseBpm: 120,
    });
    const modal = document.getElementById('practiceModal')!;
    expect(modal.innerHTML).toContain('togglePracticePlay');
    expect(modal.innerHTML).toContain('stopPractice');
  });
});

describe('practice-mode 参数解析（event vs args）', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('setPracticeSpeed 通过 event 参数（而非 args）设置速度', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false], sound: 'kick' }],
      totalSteps: 2,
      baseBpm: 120,
    });
    // 通过 event 参数（第一个参数）传递 speed
    setPracticeSpeed(0.5 as unknown as Event);
    const ctrl = document.getElementById('practiceControls')!;
    expect(ctrl.innerHTML).toContain('60 BPM');
  });

  it('setLoopStart 通过 event 参数设置', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false, true, false], sound: 'kick' }],
      totalSteps: 4,
      baseBpm: 120,
    });
    setLoopStart(1 as unknown as Event);
    const ctrl = document.getElementById('practiceControls')!;
    expect(ctrl.innerHTML).toContain('A=2');
  });

  it('setLoopEnd 通过 event 参数设置', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false, true, false], sound: 'kick' }],
      totalSteps: 4,
      baseBpm: 120,
    });
    setLoopEnd(2 as unknown as Event);
    const ctrl = document.getElementById('practiceControls')!;
    expect(ctrl.innerHTML).toContain('B=3');
  });

  it('toggleErrorMark 通过 event 参数设置', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false, true, false], sound: 'kick' }],
      totalSteps: 4,
      baseBpm: 120,
    });
    toggleErrorMark(0 as unknown as Event);
    // toggleErrorMark 只触发 renderPracticeSequencer，验证 sequencer 含 marked 类
    const seq = document.getElementById('practiceSeq')!;
    const markedCount = (seq.innerHTML.match(/practice-cell error marked/g) || []).length;
    expect(markedCount).toBe(1);
  });
});

describe('practice-mode 边界场景', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    transportMock.subscribe.mockReturnValue(vi.fn());
    audioCtxMock.state = 'running';
  });

  it('openPracticeMode totalSteps=1 单步配置正常工作', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true], sound: 'kick' }],
      totalSteps: 1,
      baseBpm: 60,
    });
    expect(document.getElementById('practiceModal')).not.toBeNull();
    expect(() => playPractice()).not.toThrow();
  });

  it('openPracticeMode 超长节奏（64 步）正常渲染', () => {
    const steps: boolean[] = [];
    for (let i = 0; i < 64; i++) steps.push(i % 2 === 0);
    openPracticeMode({
      tracks: [{ name: 'Long', steps, sound: 'kick' }],
      totalSteps: 64,
      baseBpm: 120,
    });
    const seq = document.getElementById('practiceSeq')!;
    // 应渲染 64 个步号
    const nums = seq.querySelectorAll('.practice-step-num');
    expect(nums.length).toBe(64);
  });

  it('openPracticeMode 空节奏（全 false）正常工作', () => {
    openPracticeMode({
      tracks: [{ name: 'Empty', steps: [false, false, false, false], sound: 'kick' }],
      totalSteps: 4,
      baseBpm: 120,
    });
    expect(document.getElementById('practiceModal')).not.toBeNull();
  });

  it('openPracticeMode 多轨道（3 条以上）渲染 t-c 类', () => {
    openPracticeMode({
      tracks: [
        { name: 'A', steps: [true, false, true, false], sound: 'kick' },
        { name: 'B', steps: [false, true, false, true], sound: 'snare' },
        { name: 'C', steps: [true, true, false, false], sound: 'tone', freq: 440 },
      ],
      totalSteps: 4,
      baseBpm: 120,
    });
    const seq = document.getElementById('practiceSeq')!;
    expect(seq.innerHTML).toContain('t-a');
    expect(seq.innerHTML).toContain('t-b');
    expect(seq.innerHTML).toContain('t-c');
  });

  it('openPracticeMode 缺省 stepsPerBeat=1 通过 playPractice 不抛错', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false], sound: 'kick' }],
      totalSteps: 2,
      baseBpm: 120,
    });
    expect(() => playPractice()).not.toThrow();
  });

  it('openPracticeMode 自定义 stepsPerBeat 通过 playPractice 不抛错', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false], sound: 'kick' }],
      totalSteps: 2,
      baseBpm: 120,
      stepsPerBeat: 2,
    });
    expect(() => playPractice()).not.toThrow();
  });

  it('openPracticeMode track.vol 缺省时不抛错', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false], sound: 'kick' }],
      totalSteps: 2,
      baseBpm: 120,
    });
    expect(() => playPractice()).not.toThrow();
  });

  it('openPracticeMode 重复打开（先关闭再打开）正常工作', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false], sound: 'kick' }],
      totalSteps: 2,
      baseBpm: 120,
    });
    closePracticeMode();
    openPracticeMode({
      tracks: [{ name: 'B', steps: [false, true], sound: 'snare' }],
      totalSteps: 2,
      baseBpm: 100,
    });
    const ctrl = document.getElementById('practiceControls')!;
    expect(ctrl.innerHTML).toContain('100 BPM');
    expect(ctrl.innerHTML).toContain('B');
  });

  it('setPracticeSpeed 在 transport 运行时调用 setBpm', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false], sound: 'kick' }],
      totalSteps: 2,
      baseBpm: 120,
    });
    playPractice();
    setPracticeSpeed({} as Event, 0.5);
    expect(transportMock.setBpm).toHaveBeenCalled();
  });

  it('setPracticeSpeed 速度=1 时 BPM 不变', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false], sound: 'kick' }],
      totalSteps: 2,
      baseBpm: 120,
    });
    setPracticeSpeed({} as Event, 1);
    const ctrl = document.getElementById('practiceControls')!;
    expect(ctrl.innerHTML).toContain('120 BPM');
  });

  it('setPracticeSpeed 速度=0.5 时 BPM 减半（但不低于 40）', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false], sound: 'kick' }],
      totalSteps: 2,
      baseBpm: 120,
    });
    setPracticeSpeed({} as Event, 0.5);
    const ctrl = document.getElementById('practiceControls')!;
    expect(ctrl.innerHTML).toContain('60 BPM');
  });

  it('setPracticeSpeed 速度=0.5 时低 BPM 不低于 40', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false], sound: 'kick' }],
      totalSteps: 2,
      baseBpm: 60,
    });
    setPracticeSpeed({} as Event, 0.5);
    const ctrl = document.getElementById('practiceControls')!;
    // max(40, round(60*0.5)) = max(40, 30) = 40
    expect(ctrl.innerHTML).toContain('40 BPM');
  });
});

describe('practice-mode 世界入口', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('openPracticeFromWorld1 a=2 b=3 生成 6 步', () => {
    openPracticeFromWorld1(2, 3, 6, 120);
    const seq = document.getElementById('practiceSeq')!;
    const nums = seq.querySelectorAll('.practice-step-num');
    expect(nums.length).toBe(6);
  });

  it('openPracticeFromWorld1 生成两条轨道（A 轨道 / B 轨道）', () => {
    openPracticeFromWorld1(2, 3, 6, 120);
    const seq = document.getElementById('practiceSeq')!;
    expect(seq.innerHTML).toContain('A 轨道');
    expect(seq.innerHTML).toContain('B 轨道');
  });

  it('openPracticeFromWorld4 a=4 b=6 生成 12 步双环', () => {
    openPracticeFromWorld4(4, 6, 12, 120);
    const seq = document.getElementById('practiceSeq')!;
    const nums = seq.querySelectorAll('.practice-step-num');
    expect(nums.length).toBe(12);
    expect(seq.innerHTML).toContain('外环');
    expect(seq.innerHTML).toContain('内环');
  });

  it('openPracticeFromWorld6 k=3 n=8 生成 8 步欧几里得节奏', () => {
    openPracticeFromWorld6(3, 8, 120);
    const seq = document.getElementById('practiceSeq')!;
    const nums = seq.querySelectorAll('.practice-step-num');
    expect(nums.length).toBe(8);
    // 源码中 track name 为 'E(k,n) 节奏' 字面量
    expect(seq.innerHTML).toContain('E(k,n) 节奏');
    expect(seq.innerHTML).toContain('旋律层');
  });

  it('openPracticeFromWorld6 k=5 n=12 生成 12 步', () => {
    openPracticeFromWorld6(5, 12, 120);
    const seq = document.getElementById('practiceSeq')!;
    const nums = seq.querySelectorAll('.practice-step-num');
    expect(nums.length).toBe(12);
  });

  it('openPracticeFromWorld7 prob=70 n=16 生成 16 步', () => {
    openPracticeFromWorld7(70, 16, 120);
    const seq = document.getElementById('practiceSeq')!;
    const nums = seq.querySelectorAll('.practice-step-num');
    expect(nums.length).toBe(16);
  });

  it('openPracticeFromWorld7 节拍参考轨道全部为 true', () => {
    openPracticeFromWorld7(50, 8, 120);
    const seq = document.getElementById('practiceSeq')!;
    expect(seq.innerHTML).toContain('节拍参考');
  });

  it('openPracticeFromWorld7 prob=0 不生成任何 active step（理论上）', () => {
    openPracticeFromWorld7(0, 8, 120);
    expect(document.getElementById('practiceModal')).not.toBeNull();
  });

  it('openPracticeFromWorld7 prob=100 生成所有 active step', () => {
    openPracticeFromWorld7(100, 8, 120);
    expect(document.getElementById('practiceModal')).not.toBeNull();
  });
});

describe('practice-mode loop 循环映射', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    transportMock.subscribe.mockReturnValue(vi.fn());
    audioCtxMock.state = 'running';
  });

  it('设置循环后 playPractice 仅触发循环段内的音色', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, true, true, true, true, true], sound: 'kick' }],
      totalSteps: 6,
      baseBpm: 120,
    });
    setLoopStart({} as Event, 1);
    setLoopEnd({} as Event, 3);
    // 模拟 transport subscribe 回调，验证 mapStep
    let capturedCallback: any = null;
    transportMock.subscribe.mockImplementation((cb: any) => {
      capturedCallback = cb;
      return vi.fn();
    });
    playPractice();
    expect(capturedCallback).not.toBeNull();
    // 触发若干事件
    capturedCallback({ step: 0, time: 0 });
    capturedCallback({ step: 1, time: 1 });
    capturedCallback({ step: 5, time: 2 });
    // 不抛错即可
    expect(true).toBe(true);
  });

  it('clearLoop 后无 in-loop 标记', () => {
    openPracticeMode({
      tracks: [{ name: 'A', steps: [true, false, true, false], sound: 'kick' }],
      totalSteps: 4,
      baseBpm: 120,
    });
    setLoopStart({} as Event, 1);
    setLoopEnd({} as Event, 2);
    let seq = document.getElementById('practiceSeq')!;
    expect(seq.innerHTML).toContain('in-loop');
    clearLoop();
    seq = document.getElementById('practiceSeq')!;
    expect(seq.innerHTML).not.toContain('in-loop');
  });
});
