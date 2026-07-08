import { state } from './game-engine';
import {
  getAudioCtx,
  playSample,
  scheduleHihatAt,
  scheduleToneAt,
  getSharedTransport,
  stopSharedTransport,
} from './audio';
import type { Transport, TransportEvent } from './core/transport';
import { NOTE_FREQS } from './worlds';
import { w5DegreeName } from './worlds/world5';
import { registerActions } from './events';

const FM_LENGTH = 16;

export function fmInit() {
  state.free = {
    playing: false,
    bpm: 120,
    transport: null as Transport | null,
    step: 0,
    scale: [0, 2, 4, 5, 7, 9, 11],
    tracks: [
      { name: '鼓', type: 'kick', color: 'active-a', cells: Array(FM_LENGTH).fill(0) },
      { name: '军鼓', type: 'snare', color: 'active-b', cells: Array(FM_LENGTH).fill(0) },
      { name: '踩镲', type: 'hihat', color: 'active-c', cells: Array(FM_LENGTH).fill(0) },
      {
        name: '旋律',
        type: 'melody',
        color: 'chords',
        cells: Array(FM_LENGTH).fill(0),
        pitches: [0, 2, 4, 5, 7, 9, 11, 0, 2, 4, 5, 7, 9, 11, 0, 2],
      },
    ],
  };
  const bpmEl = document.getElementById('fmBpm');
  if (bpmEl) bpmEl.textContent = state.free.bpm;
  fmRenderTracks();
}

export function fmRenderTracks() {
  const el = document.getElementById('freeTracks');
  if (!el || !state.free) return;
  el.innerHTML = state.free.tracks
    .map(
      (t: any, ti: number) =>
        '<div class="free-track"><div class="free-track-label">' +
        t.name +
        '</div><div class="free-cells">' +
        t.cells
          .map(
            (c: number, i: number) =>
              '<div class="free-cell ' +
              (c ? 'on ' + t.color : '') +
              '" data-action="fmToggleCell" data-args=\'[' +
              ti +
              ',' +
              i +
              ']\'>' +
              (t.pitches ? w5DegreeName(t.pitches[i]) : '') +
              '</div>'
          )
          .join('') +
        '</div></div>'
    )
    .join('');
}

export function fmToggleCell(e: Event, ...args: unknown[]) {
  if (!state.free) return;
  const ti = args[0] as number;
  const i = args[1] as number;
  state.free.tracks[ti].cells[i] = state.free.tracks[ti].cells[i] ? 0 : 1;
  fmRenderTracks();
}

export function fmPlay() {
  if (!state.free) return;
  stopSharedTransport();
  state.free.playing = true;
  state.free.step = 0;
  const transport = getSharedTransport(state.free.bpm, 4);
  state.free.transport = transport;
  transport.subscribe((event: TransportEvent) => {
    const s = event.step % FM_LENGTH;
    const t = event.time;
    state.free.tracks.forEach((track: any) => {
      if (track.cells[s]) {
        if (track.type === 'kick') playSample('kick', t, 0.5);
        else if (track.type === 'snare') playSample('snare', t, 0.4);
        else if (track.type === 'hihat') scheduleHihatAt(t);
        else {
          const p = track.pitches[s];
          const idx = (state.free.scale[p % 7] + 12 * Math.floor(p / 7)) % 12;
          scheduleToneAt(NOTE_FREQS[idx], 0.22, 'triangle', 0.3, t);
        }
      }
    });
  });
  transport.start();
}

export function fmStop() {
  if (!state.free) return;
  state.free.playing = false;
  stopSharedTransport();
  state.free.transport = null;
}

export function fmTogglePlay() {
  if (!state.free) return;
  const btn = document.getElementById('fmPlayBtn');
  if (state.free.playing) {
    fmStop();
    if (btn) btn.textContent = '▶';
  } else {
    fmPlay();
    if (btn) btn.textContent = '⏸';
  }
}

export function fmReset() {
  fmStop();
  if (!state.free) return;
  state.free.tracks.forEach((t: any) => t.cells.fill(0));
  fmRenderTracks();
  const btn = document.getElementById('fmPlayBtn');
  if (btn) btn.textContent = '▶';
}

export function fmChangeBpm(d: number) {
  if (!state.free) return;
  state.free.bpm = Math.max(60, Math.min(240, state.free.bpm + d));
  const bpmEl = document.getElementById('fmBpm');
  if (bpmEl) bpmEl.textContent = state.free.bpm;
  if (state.free.transport) {
    state.free.transport.setBpm(state.free.bpm);
  }
}
/* ===== EXPOSE GLOBALS ===== */
registerActions({ fmToggleCell });
// Keep window exposure for backwards compat
Object.assign(window as any, {
  fmChangeBpm: fmChangeBpm,
  fmInit: fmInit,
  fmPlay: fmPlay,
  fmRenderTracks: fmRenderTracks,
  fmReset: fmReset,
  fmStop: fmStop,
  fmToggleCell: fmToggleCell,
  fmTogglePlay: fmTogglePlay,
});
