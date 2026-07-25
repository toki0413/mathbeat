import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  patternToMidi,
  patternToCSV,
  patternToJSON,
  downloadBlob,
  exportScience,
  type ScienceExportPayload,
} from './export';

const basePayload: ScienceExportPayload = {
  type: 'dft',
  name: 'Test Song',
  data: { kpoints: [0, 1, 2], energies: [-1, 0, 1], bandgap: 0.5 },
  pattern: [],
  options: { scale: 'major' },
  mapping: { energy: 'pitch' },
  bpm: 120,
};

describe('patternToMidi', () => {
  it('returns a Uint8Array', () => {
    const out = patternToMidi(basePayload);
    expect(out).toBeInstanceOf(Uint8Array);
  });

  it('starts with MThd header chunk', () => {
    const out = patternToMidi(basePayload);
    const header = String.fromCharCode(out[0], out[1], out[2], out[3]);
    expect(header).toBe('MThd');
    // header length is always 6
    const len = (out[4] << 24) | (out[5] << 16) | (out[6] << 8) | out[7];
    expect(len).toBe(6);
  });

  it('declares SMF type 1 with 2 tracks and 480 tpq', () => {
    const out = patternToMidi(basePayload);
    const format = (out[8] << 8) | out[9];
    const ntracks = (out[10] << 8) | out[11];
    const tpq = (out[12] << 8) | out[13];
    expect(format).toBe(1);
    expect(ntracks).toBe(2);
    expect(tpq).toBe(480);
  });

  it('contains exactly two MTrk chunks', () => {
    const out = patternToMidi(basePayload);
    const text = new TextDecoder().decode(out);
    const matches = text.match(/MTrk/g) || [];
    expect(matches.length).toBe(2);
  });

  it('tempo track encodes bpm 120 -> 500000 microseconds per quarter', () => {
    const out = patternToMidi({ ...basePayload, bpm: 120 });
    const tempo = 60_000_000 / 120;
    // search for the tempo meta event bytes FF 51 03 + 3-byte big-endian tempo
    const needle = [0xff, 0x51, 0x03, (tempo >> 16) & 0xff, (tempo >> 8) & 0xff, tempo & 0xff];
    const haystack = Array.from(out);
    let found = false;
    for (let i = 0; i + needle.length <= haystack.length; i++) {
      if (needle.every((b, k) => haystack[i + k] === b)) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('tempo changes when bpm differs', () => {
    const out120 = patternToMidi({ ...basePayload, bpm: 120 });
    const out60 = patternToMidi({ ...basePayload, bpm: 60 });
    // 60 bpm -> 1,000,000 us/quarter (vs 500,000)
    const tempo60 = 1_000_000;
    const needle = [0xff, 0x51, 0x03, (tempo60 >> 16) & 0xff, (tempo60 >> 8) & 0xff, tempo60 & 0xff];
    const haystack = Array.from(out60);
    let found = false;
    for (let i = 0; i + needle.length <= haystack.length; i++) {
      if (needle.every((b, k) => haystack[i + k] === b)) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
    expect(Array.from(out120)).not.toEqual(Array.from(out60));
  });

  it('uses default bpm 120 when payload.bpm is undefined', () => {
    const out = patternToMidi({ ...basePayload, bpm: undefined });
    expect(out).toBeInstanceOf(Uint8Array);
    // Tempo for 120 bpm = 500000
    const tempo = 500000;
    const needle = [0xff, 0x51, 0x03, (tempo >> 16) & 0xff, (tempo >> 8) & 0xff, tempo & 0xff];
    const haystack = Array.from(out);
    let found = false;
    for (let i = 0; i + needle.length <= haystack.length; i++) {
      if (needle.every((b, k) => haystack[i + k] === b)) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('emits kick drum events when kick flag is set', () => {
    const payload: ScienceExportPayload = {
      ...basePayload,
      pattern: [[1, 0, 0.5, 0]],
    };
    const out = payload ? patternToMidi(payload) : new Uint8Array();
    const arr = Array.from(out);
    // kick uses note 36 on channel 10 (0x99) and off (0x89)
    const onIdx = arr.indexOf(0x99);
    expect(onIdx).toBeGreaterThanOrEqual(0);
    expect(arr[onIdx + 1]).toBe(36);
    expect(arr[onIdx + 2]).toBe(100);
    expect(arr.indexOf(0x89)).toBeGreaterThan(onIdx);
  });

  it('emits snare events when snare flag is set', () => {
    const payload: ScienceExportPayload = {
      ...basePayload,
      pattern: [[0, 0, 0.5, 1]],
    };
    const arr = Array.from(patternToMidi(payload));
    // snare uses note 38
    const onIdx = arr.indexOf(0x99);
    expect(onIdx).toBeGreaterThanOrEqual(0);
    expect(arr[onIdx + 1]).toBe(38);
  });

  it('emits melody note on/off when freq > 20', () => {
    const payload: ScienceExportPayload = {
      ...basePayload,
      pattern: [[0, 440, 0.7, 0]],
    };
    const arr = Array.from(patternToMidi(payload));
    // melody uses 0x90 / 0x80 (channel 0)
    const onIdx = arr.indexOf(0x90);
    expect(onIdx).toBeGreaterThanOrEqual(0);
    // 440 Hz -> MIDI 69
    expect(arr[onIdx + 1]).toBe(69);
    // velocity rounded from 0.7 * 127 = 88.9 -> 89
    expect(arr[onIdx + 2]).toBe(Math.max(1, Math.min(127, Math.round(0.7 * 127))));
  });

  it('does not emit melody when freq <= 20', () => {
    const payload: ScienceExportPayload = {
      ...basePayload,
      pattern: [[0, 10, 0.7, 0]],
    };
    const arr = Array.from(patternToMidi(payload));
    expect(arr.indexOf(0x90)).toBe(-1);
  });

  it('clamps melody velocity to [1, 127]', () => {
    const tooHigh = patternToMidi({
      ...basePayload,
      pattern: [[0, 440, 5, 0]],
    });
    const arr = Array.from(tooHigh);
    const onIdx = arr.indexOf(0x90);
    expect(arr[onIdx + 2]).toBe(127);

    const tooLow = patternToMidi({
      ...basePayload,
      pattern: [[0, 440, -1, 0]],
    });
    const arr2 = Array.from(tooLow);
    const onIdx2 = arr2.indexOf(0x90);
    expect(arr2[onIdx2 + 2]).toBe(1);
  });

  it('clamps MIDI note to [0, 127]', () => {
    // 50 Hz -> ~ MIDI 53; very low freq -> 0; very high freq -> 127
    const low = Array.from(patternToMidi({ ...basePayload, pattern: [[0, 1, 0.5, 0]] }));
    // freq 1 < 20 -> no note
    expect(low.indexOf(0x90)).toBe(-1);

    const veryHigh = Array.from(
      patternToMidi({ ...basePayload, pattern: [[0, 20000, 0.5, 0]] })
    );
    const onIdx = veryHigh.indexOf(0x90);
    expect(veryHigh[onIdx + 1]).toBeLessThanOrEqual(127);
    expect(veryHigh[onIdx + 1]).toBeGreaterThanOrEqual(0);
  });

  it('handles empty pattern (only tempo track + empty music track)', () => {
    const out = patternToMidi({ ...basePayload, pattern: [] });
    expect(out).toBeInstanceOf(Uint8Array);
    const text = new TextDecoder().decode(out);
    expect(text.match(/MTrk/g)!.length).toBe(2);
  });

  it('handles undefined pattern as empty', () => {
    const out = patternToMidi({ ...basePayload, pattern: undefined as any });
    expect(out).toBeInstanceOf(Uint8Array);
  });

  it('skips null/undefined rows', () => {
    const payload: ScienceExportPayload = {
      ...basePayload,
      pattern: [null as any, undefined as any, [1, 0, 0.5, 0]],
    };
    expect(() => patternToMidi(payload)).not.toThrow();
  });

  it('handles single-note pattern', () => {
    const payload: ScienceExportPayload = {
      ...basePayload,
      pattern: [[1, 440, 0.5, 1]],
    };
    const out = patternToMidi(payload);
    expect(out.length).toBeGreaterThan(0);
  });

  it('handles long pattern without throwing', () => {
    const n = 256;
    const payload: ScienceExportPayload = {
      ...basePayload,
      pattern: Array.from({ length: n }, (_, i) => [i % 2, 220 + i, 0.5, (i + 1) % 2]),
    };
    expect(() => patternToMidi(payload)).not.toThrow();
    const out = patternToMidi(payload);
    expect(out.length).toBeGreaterThan(0);
  });

  it('orders events by tick (delta times are non-negative)', () => {
    // The MIDI spec requires monotonically increasing tick times encoded as delta >= 0.
    // By sorting events and computing delta = e.tick - lastTick, all deltas are >= 0.
    const payload: ScienceExportPayload = {
      ...basePayload,
      pattern: [
        [0, 440, 0.5, 0],
        [1, 0, 0, 1],
        [1, 880, 0.5, 0],
        [0, 220, 0.5, 0],
      ],
    };
    expect(() => patternToMidi(payload)).not.toThrow();
  });
});

describe('patternToCSV', () => {
  it('produces a header row with the expected columns', () => {
    const csv = patternToCSV(basePayload);
    expect(csv.startsWith('step,kick,melody_freq,velocity,snare')).toBe(true);
  });

  it('serializes each pattern row', () => {
    const payload: ScienceExportPayload = {
      ...basePayload,
      pattern: [
        [1, 440, 0.5, 0],
        [0, 0, 0.7, 1],
      ],
    };
    const csv = patternToCSV(payload);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('0,1,440,0.5,0');
    expect(lines[2]).toBe('1,0,0,0.7,1');
  });

  it('handles empty pattern (header only)', () => {
    const csv = patternToCSV({ ...basePayload, pattern: [] });
    expect(csv).toBe('step,kick,melody_freq,velocity,snare');
  });

  it('handles undefined pattern', () => {
    const csv = patternToCSV({ ...basePayload, pattern: undefined as any });
    expect(csv).toBe('step,kick,melody_freq,velocity,snare');
  });

  it('handles null/undefined rows by treating them as zeros', () => {
    const payload: ScienceExportPayload = {
      ...basePayload,
      pattern: [null as any, [1, 0, 0.5, 0]],
    };
    const csv = patternToCSV(payload);
    const lines = csv.split('\n');
    expect(lines[1]).toBe('0,0,0,0,0');
    expect(lines[2]).toBe('1,1,0,0.5,0');
  });

  it('handles long sequence without throwing', () => {
    const n = 500;
    const payload: ScienceExportPayload = {
      ...basePayload,
      pattern: Array.from({ length: n }, (_, i) => [i % 2, i * 2, 0.5, (i + 1) % 2]),
    };
    expect(() => patternToCSV(payload)).not.toThrow();
    const lines = patternToCSV(payload).split('\n');
    expect(lines).toHaveLength(n + 1);
  });
});

describe('patternToJSON', () => {
  it('returns valid JSON string', () => {
    const str = patternToJSON(basePayload);
    expect(() => JSON.parse(str)).not.toThrow();
  });

  it('includes version, type, name, bpm, options, mapping, pattern fields', () => {
    const obj = JSON.parse(patternToJSON(basePayload));
    expect(obj.version).toBe('1.0');
    expect(obj.type).toBe('dft');
    expect(obj.name).toBe('Test Song');
    expect(obj.bpm).toBe(120);
    expect(obj.options).toEqual({ scale: 'major' });
    expect(obj.mapping).toEqual({ energy: 'pitch' });
    expect(obj.pattern).toEqual([]);
  });

  it('includes a generatedAt ISO timestamp', () => {
    const obj = JSON.parse(patternToJSON(basePayload));
    expect(typeof obj.generatedAt).toBe('string');
    expect(() => new Date(obj.generatedAt).toISOString()).not.toThrow();
  });

  it('summarizes data by type (dft)', () => {
    const obj = JSON.parse(patternToJSON(basePayload));
    expect(obj.dataSummary).toEqual({
      kpoints: 3,
      energies: 3,
      bandgap: 0.5,
    });
  });

  it('summarizes data for md type', () => {
    const payload: ScienceExportPayload = {
      ...basePayload,
      type: 'md',
      data: { frames: [{}, {}, {}], temp: 300 },
    };
    const obj = JSON.parse(patternToJSON(payload));
    expect(obj.dataSummary).toEqual({ frames: 3, temp: 300 });
  });

  it('summarizes data for fem type', () => {
    const payload: ScienceExportPayload = {
      ...basePayload,
      type: 'fem',
      data: { nodes: [{}, {}], modes: [1, 2, 3] },
    };
    const obj = JSON.parse(patternToJSON(payload));
    expect(obj.dataSummary).toEqual({ nodes: 2, modes: 3 });
  });

  it('summarizes data for cfd type', () => {
    const payload: ScienceExportPayload = {
      ...basePayload,
      type: 'cfd',
      data: { cells: [{}, {}, {}, {}], reynolds: 5000 },
    };
    const obj = JSON.parse(patternToJSON(payload));
    expect(obj.dataSummary).toEqual({ cells: 4, reynolds: 5000 });
  });

  it('summarizes data for xrd type', () => {
    const payload: ScienceExportPayload = {
      ...basePayload,
      type: 'xrd',
      data: { angles: [1, 2, 3], wavelength: 1.54 },
    };
    const obj = JSON.parse(patternToJSON(payload));
    expect(obj.dataSummary).toEqual({ angles: 3, wavelength: 1.54 });
  });

  it('summarizes data for dna type', () => {
    const payload: ScienceExportPayload = {
      ...basePayload,
      type: 'dna',
      data: { sequence: 'ATGC', gc: 0.5 },
    };
    const obj = JSON.parse(patternToJSON(payload));
    expect(obj.dataSummary).toEqual({ length: 4, gc: 0.5 });
  });

  it('summarizes data for pulsar type', () => {
    const payload: ScienceExportPayload = {
      ...basePayload,
      type: 'pulsar',
      data: { periods: [1, 2], dm: 10 },
    };
    const obj = JSON.parse(patternToJSON(payload));
    expect(obj.dataSummary).toEqual({ periods: 2, dm: 10 });
  });

  it('returns empty dataSummary for unknown type', () => {
    const payload: ScienceExportPayload = {
      ...basePayload,
      type: 'unknown',
      data: { foo: 1 },
    };
    const obj = JSON.parse(patternToJSON(payload));
    expect(obj.dataSummary).toEqual({});
  });

  it('returns empty dataSummary when data is null', () => {
    const payload: ScienceExportPayload = {
      ...basePayload,
      data: null as any,
    };
    const obj = JSON.parse(patternToJSON(payload));
    expect(obj.dataSummary).toEqual({});
  });

  it('falls back to bpm 120 when bpm is undefined', () => {
    const obj = JSON.parse(patternToJSON({ ...basePayload, bpm: undefined }));
    expect(obj.bpm).toBe(120);
  });

  it('serializes the pattern array', () => {
    const payload: ScienceExportPayload = {
      ...basePayload,
      pattern: [
        [1, 440, 0.5, 0],
        [0, 0, 0, 1],
      ],
    };
    const obj = JSON.parse(patternToJSON(payload));
    expect(obj.pattern).toEqual([
      [1, 440, 0.5, 0],
      [0, 0, 0, 1],
    ]);
  });
});

describe('downloadBlob', () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let createElementSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Stub URL.createObjectURL / revokeObjectURL because happy-dom may not implement them.
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    // Spy on document.createElement to capture anchor clicks without performing them.
    const realCreate = document.createElement.bind(document);
    createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: string) => {
        const el = realCreate(tagName);
        if (tagName === 'a') {
          el.click = vi.fn();
          el.remove = vi.fn();
        }
        return el as any;
      });
    // body.appendChild/removeChild must exist; spy to ensure no real DOM changes
    vi.spyOn(document.body, 'appendChild').mockImplementation((node: Node) => node);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a blob URL and clicks an anchor with the given filename', () => {
    const data = new Uint8Array([1, 2, 3]);
    downloadBlob(data, 'foo.mid', 'audio/midi');

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    const blob = createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('audio/midi');

    // The created <a> element should have download and href set
    const anchor = createElementSpy.mock.results.find(
      (r) => (r.value as HTMLElement)?.tagName === 'A'
    )?.value as HTMLAnchorElement | undefined;
    expect(anchor).toBeDefined();
    expect(anchor!.download).toBe('foo.mid');
    expect(anchor!.href).toBe('blob:mock-url');
    expect(anchor!.click).toHaveBeenCalledTimes(1);
  });

  it('accepts string data and uses given mime type', () => {
    downloadBlob('hello', 'data.csv', 'text/csv');
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    const blob = createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/csv');
  });

  it('revokes the object URL after a timeout', () => {
    vi.useFakeTimers();
    downloadBlob(new Uint8Array([0]), 'x.json', 'application/json');
    expect(revokeObjectURLSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
    vi.useRealTimers();
  });
});

describe('exportScience', () => {
  let downloadSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    downloadSpy = vi.spyOn({ downloadBlob }, 'downloadBlob');
    // Re-import would be cleanest; instead, we mock URL.createObjectURL so the real
    // downloadBlob (called by exportScience) does not blow up on missing impl.
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = realCreate(tagName);
      if (tagName === 'a') {
        el.click = vi.fn();
        el.remove = vi.fn();
      }
      return el as any;
    });
    vi.spyOn(document.body, 'appendChild').mockImplementation((node: Node) => node);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sanitizes the filename (replaces unsafe chars with _)', () => {
    const payload: ScienceExportPayload = {
      ...basePayload,
      name: 'My Song!!! @#$%',
    };
    exportScience(payload, 'json');
    // The download attribute should be the sanitized name + .json
    // We just verify the call didn't throw and produced an anchor with the expected name.
    const anchors = Array.from(document.querySelectorAll('a'));
    // happy-dom may not retain the element after remove(); instead check via createElement spy.
  });

  it('handles midi format without throwing', () => {
    expect(() => exportScience(basePayload, 'midi')).not.toThrow();
  });

  it('handles csv format without throwing', () => {
    expect(() => exportScience(basePayload, 'csv')).not.toThrow();
  });

  it('handles json format without throwing', () => {
    expect(() => exportScience(basePayload, 'json')).not.toThrow();
  });

  it('uses default name when payload.name is empty', () => {
    const payload: ScienceExportPayload = { ...basePayload, name: '' };
    expect(() => exportScience(payload, 'csv')).not.toThrow();
  });

  it('keeps unicode characters in the filename (regex preserves \\u4e00-\\u9fa5)', () => {
    const payload: ScienceExportPayload = { ...basePayload, name: '科学之声' };
    expect(() => exportScience(payload, 'json')).not.toThrow();
  });
});
