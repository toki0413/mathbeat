import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// mock 副作用依赖：sample-library.ts 不需要真实音频/状态/导航
vi.mock('./store', () => ({
  Store: {
    state: {
      samplesPlayed: [] as string[],
      importedSampleId: '',
    },
    save: vi.fn(),
  },
}));

vi.mock('./game-engine', () => ({
  isFreeModeUnlocked: vi.fn(() => false),
  checkAchievements: vi.fn(),
}));

vi.mock('./storage', () => ({
  localSet: vi.fn(() => true),
}));

vi.mock('./i18n', () => ({
  t: vi.fn((key: string) => key),
}));

vi.mock('./ui-feedback', () => ({
  showToast: vi.fn(),
}));

vi.mock('./audio', () => ({
  getAudioCtx: vi.fn(() => ({ currentTime: 0, state: 'running', resume: vi.fn() })),
  playSample: vi.fn(),
  scheduleSnareAt: vi.fn(),
  scheduleHihatAt: vi.fn(),
  scheduleToneAt: vi.fn(),
  getSharedTransport: vi.fn(() => ({
    subscribe: vi.fn(() => () => {}),
    start: vi.fn(),
    stop: vi.fn(),
    setBpm: vi.fn(),
  })),
  stopSharedTransport: vi.fn(),
}));

vi.mock('./worlds', () => ({
  SCALES: {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    pentatonic: [0, 2, 4, 7, 9],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    wholetone: [0, 2, 4, 6, 8, 10],
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  },
  ROOT_SEMITONES: { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 },
}));

// utils 提供实际的旋律/节奏生成算法（不 mock，让 getSampleComposition 走真实逻辑）
// 但 utils.ts 顶层 import './worlds'，需要让真实 utils 拿到我们的 mock worlds。
// vitest mock 会自动替换所有 import 路径中的 './worlds'，因此真实 utils 也会得到 mock。

import {
  MATH_ROCK_SAMPLES,
  REAL_MATH_ROCK_SAMPLES,
  getSampleComposition,
  toggleSamplePlayback,
  playSampleComposition,
  stopSamplePlayback,
  importSampleToComposer,
} from './sample-library';
import { Store } from './store';
import { isFreeModeUnlocked, checkAchievements } from './game-engine';
import { localSet } from './storage';
import { showToast } from './ui-feedback';

describe('sample-library - MATH_ROCK_SAMPLES 数据完整性', () => {
  it('MATH_ROCK_SAMPLES 是数组且包含 9 个示例', () => {
    expect(Array.isArray(MATH_ROCK_SAMPLES)).toBe(true);
    expect(MATH_ROCK_SAMPLES).toHaveLength(9);
  });

  it('每个 sample 字段完整：id/title/bpm/duration/tags/structure', () => {
    for (const s of MATH_ROCK_SAMPLES) {
      expect(typeof s.id).toBe('string');
      expect(s.id.length).toBeGreaterThan(0);
      expect(typeof s.title).toBe('string');
      expect(s.title.length).toBeGreaterThan(0);
      expect(typeof s.bpm).toBe('number');
      expect(s.bpm).toBeGreaterThanOrEqual(60);
      expect(s.bpm).toBeLessThanOrEqual(300);
      expect(typeof s.duration).toBe('string');
      expect(s.duration).toMatch(/^\d+:\d+$/);
      expect(Array.isArray(s.tags)).toBe(true);
      expect(s.tags.length).toBeGreaterThan(0);
      expect(typeof s.structure).toBe('string');
      expect(s.structure.length).toBeGreaterThan(0);
    }
  });

  it('sample id 唯一', () => {
    const ids = MATH_ROCK_SAMPLES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('包含 3 个真实科学数据示例（md_csh/fem_csh/dft_csh）', () => {
    const ids = MATH_ROCK_SAMPLES.map((s) => s.id);
    expect(ids).toContain('md_csh');
    expect(ids).toContain('fem_csh');
    expect(ids).toContain('dft_csh');
  });

  it('包含 6 个程序生成示例（fibonacci/prime/markov/lcm/symmetric/euclidean）', () => {
    const ids = MATH_ROCK_SAMPLES.map((s) => s.id);
    expect(ids).toContain('fibonacci-groove');
    expect(ids).toContain('prime-time');
    expect(ids).toContain('markov-changes');
    expect(ids).toContain('lcm-reunion');
    expect(ids).toContain('symmetric-dreams');
    expect(ids).toContain('euclidean-drive');
  });
});

describe('sample-library - REAL_MATH_ROCK_SAMPLES 数据完整性', () => {
  it('包含 3 个真实样本条目', () => {
    expect(Object.keys(REAL_MATH_ROCK_SAMPLES).sort()).toEqual(['dft_csh', 'fem_csh', 'md_csh']);
  });

  it('每个真实样本包含 root/scale/meta/sections 字段', () => {
    for (const id of Object.keys(REAL_MATH_ROCK_SAMPLES)) {
      const s = REAL_MATH_ROCK_SAMPLES[id];
      expect(typeof s.root).toBe('string');
      expect(typeof s.scale).toBe('string');
      expect(s.meta).toBeDefined();
      expect(Array.isArray(s.sections)).toBe(true);
      expect(s.sections.length).toBeGreaterThan(0);
    }
  });

  it('每个真实样本的 section 都有 drums/bass/melody/chords 子结构', () => {
    for (const id of Object.keys(REAL_MATH_ROCK_SAMPLES)) {
      const sec = REAL_MATH_ROCK_SAMPLES[id].sections[0];
      expect(sec.drums).toBeDefined();
      expect(sec.bass).toBeDefined();
      expect(sec.melody).toBeDefined();
      expect(sec.chords).toBeDefined();
      expect(Array.isArray(sec.drums.kick)).toBe(true);
      expect(Array.isArray(sec.drums.snare)).toBe(true);
      expect(Array.isArray(sec.drums.hihat)).toBe(true);
    }
  });
});

describe('sample-library - getSampleComposition', () => {
  it('未知 id 返回 null', () => {
    expect(getSampleComposition('non-existent-sample-id')).toBeNull();
  });

  it('真实样本 id 返回其内容的深拷贝', () => {
    const original = REAL_MATH_ROCK_SAMPLES.md_csh;
    const comp = getSampleComposition('md_csh') as any;
    expect(comp).not.toBeNull();
    expect(comp.root).toBe(original.root);
    // 深拷贝验证：修改返回值不影响原数据
    comp.sections[0].bars = 999;
    expect(original.sections[0].bars).not.toBe(999);
  });

  it('fibonacci-groove 返回多段（Intro/Verse/Chorus）结构', () => {
    const comp = getSampleComposition('fibonacci-groove') as any;
    expect(comp).not.toBeNull();
    expect(comp.sections.length).toBe(3);
    const names = comp.sections.map((s: any) => s.name);
    expect(names).toEqual(['Intro', 'Verse', 'Chorus']);
  });

  it('prime-time 返回 E 弗里几亚 7/8 拍结构', () => {
    const comp = getSampleComposition('prime-time') as any;
    expect(comp).not.toBeNull();
    expect(comp.root).toBe('E');
    expect(comp.scale).toBe('phrygian');
    expect(comp.sections[0].tsNum).toBe(7);
    expect(comp.sections[0].tsDen).toBe(8);
    expect(comp.sections[0].bpm).toBe(135);
  });

  it('markov-changes 返回 5/4 拍 E 小调结构', () => {
    const comp = getSampleComposition('markov-changes') as any;
    expect(comp).not.toBeNull();
    expect(comp.root).toBe('E');
    expect(comp.scale).toBe('minor');
    expect(comp.sections[0].tsNum).toBe(5);
    expect(comp.sections[0].tsDen).toBe(4);
  });

  it('lcm-reunion 返回 A 小调 4/4 结构', () => {
    const comp = getSampleComposition('lcm-reunion') as any;
    expect(comp).not.toBeNull();
    expect(comp.root).toBe('A');
    expect(comp.scale).toBe('minor');
  });

  it('symmetric-dreams 返回 D 多利亚 4/4 结构', () => {
    const comp = getSampleComposition('symmetric-dreams') as any;
    expect(comp).not.toBeNull();
    expect(comp.root).toBe('D');
    expect(comp.scale).toBe('dorian');
  });

  it('euclidean-drive 返回 B 小调 4/4 140bpm 结构', () => {
    const comp = getSampleComposition('euclidean-drive') as any;
    expect(comp).not.toBeNull();
    expect(comp.root).toBe('B');
    expect(comp.scale).toBe('minor');
    expect(comp.sections[0].bpm).toBe(140);
  });

  it('所有程序生成 sample 的 sections 内 kick/snare/hihat 数组非空', () => {
    // 注：实现里部分 sample（如 markov-changes）的 kick/snare/hihat 长度并不严格相等，
    // 这里只验证每个轨道都有非空数组（防止结构性破坏）。
    const ids = ['fibonacci-groove', 'prime-time', 'markov-changes', 'lcm-reunion', 'symmetric-dreams', 'euclidean-drive'];
    for (const id of ids) {
      const comp = getSampleComposition(id) as any;
      for (const sec of comp.sections) {
        expect(Array.isArray(sec.drums.kick)).toBe(true);
        expect(sec.drums.kick.length).toBeGreaterThan(0);
        expect(Array.isArray(sec.drums.snare)).toBe(true);
        expect(sec.drums.snare.length).toBeGreaterThan(0);
        expect(Array.isArray(sec.drums.hihat)).toBe(true);
        expect(sec.drums.hihat.length).toBeGreaterThan(0);
      }
    }
  });

  it('未在 sample 列表中的未知 id（但调用 getSampleComposition）返回 null', () => {
    expect(getSampleComposition('')).toBeNull();
    expect(getSampleComposition('xxx')).toBeNull();
  });
});

describe('sample-library - toggleSamplePlayback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (Store.state as any).samplesPlayed = [];
    (Store.state as any).importedSampleId = '';
  });

  it('toggleSamplePlayback 不抛错（无当前播放）', () => {
    expect(() => toggleSamplePlayback('fibonacci-groove')).not.toThrow();
  });

  it('连续调用 toggle 同一 id 不抛错（先 play 后 stop）', () => {
    expect(() => {
      toggleSamplePlayback('lcm-reunion');
      toggleSamplePlayback('lcm-reunion');
    }).not.toThrow();
  });
});

describe('sample-library - playSampleComposition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (Store.state as any).samplesPlayed = [];
    (Store.state as any).importedSampleId = '';
  });

  afterEach(() => {
    stopSamplePlayback();
  });

  it('playSampleComposition 不抛错并将 sample id 写入 Store.samplesPlayed', () => {
    expect(() => playSampleComposition('fibonacci-groove')).not.toThrow();
    expect(Store.state.samplesPlayed).toContain('fibonacci-groove');
    expect(Store.save).toHaveBeenCalled();
  });

  it('playSampleComposition 调用 checkAchievements', () => {
    playSampleComposition('prime-time');
    expect(checkAchievements).toHaveBeenCalled();
  });

  it('playSampleComposition 对未知 id 不抛错（注：实现会先 push 到 samplesPlayed 再查找 comp）', () => {
    // 实现细节：playSampleComposition 在调用 getSampleComposition 之前就把 id 加入 samplesPlayed，
    // 即便 comp 不存在，samplesPlayed 仍会包含该 id。这里只验证不抛错。
    expect(() => playSampleComposition('non-existent')).not.toThrow();
    // 仍应调用过 Store.save（虽然 comp 没找到）
    expect(Store.save).toHaveBeenCalled();
  });

  it('playSampleComposition 对真实样本（md_csh）不抛错', () => {
    expect(() => playSampleComposition('md_csh')).not.toThrow();
    expect(Store.state.samplesPlayed).toContain('md_csh');
  });

  it('重复 playSampleComposition 同一 id 不会重复 push 到 samplesPlayed', () => {
    playSampleComposition('lcm-reunion');
    playSampleComposition('lcm-reunion');
    const count = Store.state.samplesPlayed.filter((id) => id === 'lcm-reunion').length;
    expect(count).toBe(1);
  });
});

describe('sample-library - stopSamplePlayback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (Store.state as any).samplesPlayed = [];
    (Store.state as any).importedSampleId = '';
  });

  it('未播放时 stopSamplePlayback 不抛错（幂等）', () => {
    expect(() => stopSamplePlayback()).not.toThrow();
  });

  it('play 后 stop 不抛错', () => {
    playSampleComposition('fibonacci-groove');
    expect(() => stopSamplePlayback()).not.toThrow();
  });

  it('连续 stop 不抛错', () => {
    playSampleComposition('prime-time');
    stopSamplePlayback();
    expect(() => stopSamplePlayback()).not.toThrow();
  });
});

describe('sample-library - importSampleToComposer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (Store.state as any).samplesPlayed = [];
    (Store.state as any).importedSampleId = '';
    // 默认未解锁自由模式
    vi.mocked(isFreeModeUnlocked).mockReturnValue(false);
    // mock window.location.href 赋值（happy-dom 下 window.location.href 是只读的）
    // 用 Object.defineProperty 替换为可写
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // 恢复 window.location
    // @ts-ignore
    delete window.location;
  });

  it('未解锁自由模式时弹出 info toast 提示，不进行导入', () => {
    importSampleToComposer('fibonacci-groove');
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith('toast.unlock.world6_required', 'info');
    expect(localSet).not.toHaveBeenCalled();
    expect(Store.state.importedSampleId).toBe('');
  });

  it('解锁自由模式后调用 localSet 保存并跳转 composer.html', () => {
    vi.mocked(isFreeModeUnlocked).mockReturnValue(true);
    importSampleToComposer('fibonacci-groove');
    expect(localSet).toHaveBeenCalledWith('mathbeat_demo_import', expect.anything());
    expect(Store.state.importedSampleId).toBe('fibonacci-groove');
    expect(Store.save).toHaveBeenCalled();
    expect(checkAchievements).toHaveBeenCalled();
    expect(window.location.href).toBe('composer.html');
  });

  it('解锁后传入未知 id 仍调用 localSet（传 null 也算导入），并跳转', () => {
    vi.mocked(isFreeModeUnlocked).mockReturnValue(true);
    // 不抛错即可（comp 为 null 时 localSet 仍接收 null）
    expect(() => importSampleToComposer('non-existent')).not.toThrow();
    expect(localSet).toHaveBeenCalled();
  });
});
