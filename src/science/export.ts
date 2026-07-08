/**
 * 科学之声 - 标准化导出模块
 * 支持 MIDI (SMF)、JSON、CSV 三种格式导出
 */

export interface ScienceExportPayload {
  type: string;
  name: string;
  data: any;
  pattern: number[][];
  options: any;
  mapping: any;
  bpm?: number;
}

function freqToMidi(freq: number): number {
  return Math.max(0, Math.min(127, Math.round(69 + 12 * Math.log2(freq / 440))));
}

function vlv(n: number): number[] {
  // Variable Length Quantity encoding for MIDI delta times
  const bytes: number[] = [];
  let value = n;
  do {
    bytes.unshift((value & 0x7f) | (bytes.length ? 0x80 : 0));
    value >>= 7;
  } while (value > 0);
  return bytes.length ? bytes : [0];
}

function writeString(s: string): number[] {
  return Array.from(s).map((c) => c.charCodeAt(0));
}

function u16be(n: number): number[] {
  return [(n >> 8) & 0xff, n & 0xff];
}

function u24be(n: number): number[] {
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function u32be(n: number): number[] {
  return [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function chunk(name: string, data: number[]): number[] {
  return [...writeString(name), ...u32be(data.length), ...data];
}

function midiEvent(delta: number, bytes: number[]): number[] {
  return [...vlv(delta), ...bytes];
}

/**
 * 将科学之声生成的 pattern 转换为标准 MIDI 文件 (SMF Type 1)
 * pattern[i] = [kick, melodyFreq, velocity, snare]
 */
export function patternToMidi(payload: ScienceExportPayload): Uint8Array {
  const bpm = payload.bpm || 120;
  const tpq = 480; // ticks per quarter note
  const stepTicks = tpq / 4; // 16 分音符
  const pattern = payload.pattern || [];

  // 计算每个音符的结束时间：同一 step 内所有音符同时开始，下一 step 结束
  const events: { tick: number; bytes: number[] }[] = [];

  pattern.forEach((row, step) => {
    const tick = step * stepTicks;
    if (!row) return;
    const [kick, freq, vel, snare] = row;
    const velocity = Math.max(1, Math.min(127, Math.round((vel || 0.5) * 127)));

    if (kick) {
      events.push({ tick, bytes: [0x99, 36, 100] });
      events.push({ tick: tick + stepTicks, bytes: [0x89, 36, 0] });
    }
    if (snare) {
      events.push({ tick, bytes: [0x99, 38, 100] });
      events.push({ tick: tick + stepTicks, bytes: [0x89, 38, 0] });
    }
    if (freq && freq > 20) {
      const note = freqToMidi(freq);
      events.push({ tick, bytes: [0x90, note, velocity] });
      events.push({ tick: tick + stepTicks, bytes: [0x80, note, 0] });
    }
  });

  // 按时间排序
  events.sort((a, b) => a.tick - b.tick);

  // Tempo track (track 0)
  const tempo = Math.round(60_000_000 / bpm);
  const tempoTrackData: number[] = [
    ...midiEvent(0, [0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08]), // 4/4 time signature
    ...midiEvent(0, [0xff, 0x51, 0x03, ...u24be(tempo)]), // tempo
    ...midiEvent(0, [0xff, 0x03, ...writeString('Science-Music')]), // track name
    ...midiEvent(0, [0xff, 0x2f, 0x00]), // end of track
  ];

  // Music track (track 1)
  const musicTrackData: number[] = [...midiEvent(0, [0xff, 0x03, ...writeString(payload.name || 'Science Track')])];
  let lastTick = 0;
  events.forEach((e) => {
    const delta = e.tick - lastTick;
    musicTrackData.push(...midiEvent(delta, e.bytes));
    lastTick = e.tick;
  });
  musicTrackData.push(...midiEvent(0, [0xff, 0x2f, 0x00]));

  const header = chunk('MThd', [
    ...u16be(1), // Type 1
    ...u16be(2), // 2 tracks
    ...u16be(tpq),
  ]);
  const track0 = chunk('MTrk', tempoTrackData);
  const track1 = chunk('MTrk', musicTrackData);

  return new Uint8Array([...header, ...track0, ...track1]);
}

export function patternToCSV(payload: ScienceExportPayload): string {
  const lines: string[] = ['step,kick,melody_freq,velocity,snare'];
  (payload.pattern || []).forEach((row, i) => {
    const [kick, freq, vel, snare] = row || [0, 0, 0, 0];
    lines.push([i, kick ? 1 : 0, freq || 0, vel || 0, snare ? 1 : 0].join(','));
  });
  return lines.join('\n');
}

export function patternToJSON(payload: ScienceExportPayload): string {
  return JSON.stringify(
    {
      version: '1.0',
      type: payload.type,
      name: payload.name,
      generatedAt: new Date().toISOString(),
      bpm: payload.bpm || 120,
      options: payload.options,
      mapping: payload.mapping,
      dataSummary: summarizeData(payload.data, payload.type),
      pattern: payload.pattern,
    },
    null,
    2
  );
}

function summarizeData(data: any, type: string): any {
  if (!data) return {};
  if (type === 'dft') return { kpoints: data.kpoints?.length, energies: data.energies?.length, bandgap: data.bandgap };
  if (type === 'md') return { frames: data.frames?.length, temp: data.temp };
  if (type === 'fem') return { nodes: data.nodes?.length, modes: data.modes?.length };
  if (type === 'cfd') return { cells: data.cells?.length, reynolds: data.reynolds };
  if (type === 'xrd') return { angles: data.angles?.length, wavelength: data.wavelength };
  if (type === 'dna') return { length: data.sequence?.length, gc: data.gc };
  if (type === 'pulsar') return { periods: data.periods?.length, dm: data.dm };
  return {};
}

export function downloadBlob(data: Uint8Array | string, fileName: string, mimeType: string) {
  const blob = new Blob([data as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 100);
}

export function exportScience(payload: ScienceExportPayload, format: 'midi' | 'json' | 'csv') {
  const safeName = (payload.name || 'science-music').replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
  if (format === 'midi') {
    const midi = patternToMidi(payload);
    downloadBlob(midi, safeName + '.mid', 'audio/midi');
  } else if (format === 'csv') {
    downloadBlob(patternToCSV(payload), safeName + '.csv', 'text/csv');
  } else if (format === 'json') {
    downloadBlob(patternToJSON(payload), safeName + '.json', 'application/json');
  }
}
