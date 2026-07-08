import { state, completeLevel, recordAdaptive, updateLeaderboard, checkAchievements } from '../game-engine';
import { Store } from '../store';
import { LEVELS } from '../worlds';
import { scheduleToneAt, getAudioCtx, playCorrect, playWrong, getSharedTransport, stopSharedTransport } from '../audio';
import type { Transport, TransportEvent } from '../core/transport';
import { showStars, showEducationCard } from '../ui-render';
import { registerActions, registerInputs } from '../events';

/* ===== WORLD 8: GRAPH THEORY & HARMONY ===== */
export function renderWorld8(container: HTMLElement, lid: string) {
  if (lid === '8-1' || lid === '8-4') {
    renderW8Path(container);
  } else if (lid === '8-2' || lid === '8-5') {
    renderW8Matrix(container);
  } else if (lid === '8-3') {
    renderW8Dijkstra(container);
  } else if (lid === '8-B') {
    renderW8Boss(container);
  }
}
export const W8_NODES = [
  { id: 0, name: 'I', color: '#FF8C42' },
  { id: 1, name: 'IV', color: '#4ECDC4' },
  { id: 2, name: 'V', color: '#E8587A' },
  { id: 3, name: 'vi', color: '#7C6BFF' },
];
export const W8_EDGES = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [0, 2],
];
export const W8_ROOTS = [0, 5, 7, 9]; // I=C, IV=F, V=G, vi=A（小调）

/** 两个和弦根音之间的最短音程距离（半音数） */
export function w8IntervalDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 12;
  return Math.min(d, 12 - d);
}

/** 根据 W8_EDGES 生成以音程距离为权重的邻接矩阵 */
export function w8BuildIntervalWeights(): number[][] {
  const n = W8_NODES.length;
  const w = Array.from({ length: n }, () => Array(n).fill(0));
  W8_EDGES.forEach(([a, b]) => {
    const dist = w8IntervalDistance(W8_ROOTS[a], W8_ROOTS[b]);
    w[a][b] = dist;
    w[b][a] = dist;
  });
  return w;
}

function showErrorToast(msg: string): void {
  const el = document.getElementById('globalErrorToast');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => {
    el.style.display = 'none';
  }, 2600);
}
export function renderW8Path(container: HTMLElement) {
  state.w8 = { type: 'path', path: [], playing: false, transport: null as Transport | null, step: 0, bpm: 120 };
  container.innerHTML =
    '<div class="challenge-card"><div class="challenge-q">在 4 节点和弦图上选择一条合法路径。</div><div style="font-size:13px;color:var(--dim);margin:6px 0">节点：I、IV、V、vi；合法连接：I↔IV、IV↔V、V↔vi、vi↔I、I↔V</div><div id="w8PathNodes" style="display:flex;gap:6px;justify-content:center;margin:12px 0;flex-wrap:wrap"></div><div class="controls-bar"><button class="ctrl-btn" data-action="w8PathReset">⟲</button><button class="ctrl-btn play-btn" id="w8PlayBtn" data-action="w8PathPlay">▶</button><button class="verify-btn" data-action="w8PathVerify">验证</button></div><div class="result-msg" id="w8Result"></div><div class="stars-row" id="w8Stars"></div><button class="next-btn" id="w8Next" data-action="nextLevel">下一关 →</button></div>';
  w8PathRender();
}
export function w8PathRender() {
  const el = document.getElementById('w8PathNodes');
  if (!el) return;
  el.innerHTML =
    W8_NODES.map(
      (n) =>
        '<button class="ctrl-btn" style="background:' +
        n.color +
        ';color:#fff" data-action="w8PathClick" data-args=\'[' +
        n.id +
        ']\'>' +
        n.name +
        '</button>'
    ).join('') +
    '<div style="width:100%;text-align:center;margin-top:8px;font-size:18px;font-weight:800">路径：' +
    (state.w8.path.length ? state.w8.path.map((i: number) => W8_NODES[i].name).join(' → ') : '空') +
    '</div>';
}
export function w8PathClick(id: number) {
  if (
    state.w8.path.length === 0 ||
    W8_EDGES.some(
      (e) =>
        (e[0] === state.w8.path[state.w8.path.length - 1] && e[1] === id) ||
        (e[1] === state.w8.path[state.w8.path.length - 1] && e[0] === id)
    )
  ) {
    state.w8.path.push(id);
    w8PathRender();
  } else {
    showErrorToast('该节点与前一个不相连');
  }
}
export function w8PathReset() {
  state.w8.path = [];
  w8PathRender();
}
export function w8PathPlay() {
  if (state.w8.path.length < 2) return;
  stopSharedTransport();
  state.w8.playing = true;
  state.w8.step = 0;
  const freqs = [
    [261.63, 329.63, 392.0],
    [349.23, 392.0, 523.25],
    [392.0, 466.16, 587.33],
    [220.0, 261.63, 329.63],
  ];
  const transport = getSharedTransport(state.w8.bpm, 1);
  state.w8.transport = transport;
  let playedSteps = 0;
  const len = state.w8.path.length;
  transport.subscribe((event: TransportEvent) => {
    const s = event.step % len;
    const node = state.w8.path[s];
    freqs[node].forEach((f) => scheduleToneAt(f, 0.35, 'triangle', 0.2, event.time));
    playedSteps++;
    if (playedSteps >= len) transport.stop();
  });
  transport.start();
}
export function w8PathStop() {
  state.w8.playing = false;
  stopSharedTransport();
  state.w8.transport = null;
}
export function w8PathVerify() {
  const res = document.getElementById('w8Result')!;
  if (state.w8.path.length >= 3) {
    let ok = true;
    for (let i = 1; i < state.w8.path.length; i++) {
      const a = state.w8.path[i - 1],
        b = state.w8.path[i];
      if (!W8_EDGES.some((e) => (e[0] === a && e[1] === b) || (e[1] === a && e[0] === b))) {
        ok = false;
        break;
      }
    }
    if (ok) {
      playCorrect();
      res.className = 'result-msg correct';
      res.textContent = '✅ 合法和弦路径！';
      document.getElementById('w8Next')!.classList.add('show');
      state.combo++;
      let stars = 3 - state.hintLevel;
      if (stars < 1) stars = 1;
      completeLevel(8, state.currentLevel, stars);
      showStars('w8Stars', stars);
      (window as any).spawnConfetti();
      (window as any).spawnCorrectParticles();
      if (state.combo >= 3) (window as any).spawnComboParticles();
      showEducationCard(state.currentLevel);
      recordAdaptive(state.currentLevel, stars);
      updateLeaderboard(state.currentLevel, stars);
      checkAchievements();
      return;
    }
  }
  playWrong();
  state.combo = 0;
  res.className = 'result-msg wrong';
  res.textContent = '❌ 路径需要至少 3 个节点且每段都合法';
  recordAdaptive(state.currentLevel, 0);
}

/** Boss：覆盖 I、IV、V、vi 所有节点的合法和弦路径 */
export function renderW8Boss(container: HTMLElement) {
  state.w8 = { type: 'boss', path: [], playing: false, transport: null as Transport | null, step: 0, bpm: 120 };
  container.innerHTML =
    '<div class="challenge-card"><div class="challenge-q">Boss：设计一条经过所有 4 个和弦节点（I、IV、V、vi）的合法路径。</div><div style="font-size:13px;color:var(--dim);margin:6px 0">边权 = 根音音程距离（半音），越小越顺耳。</div><div id="w8BossEdges" style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin:8px 0"></div><div id="w8BossNodes" style="display:flex;gap:6px;justify-content:center;margin:12px 0;flex-wrap:wrap"></div><div class="controls-bar"><button class="ctrl-btn" data-action="w8BossReset">⟲</button><button class="ctrl-btn play-btn" id="w8PlayBtn" data-action="w8BossPlay">▶</button><button class="verify-btn" data-action="w8BossVerify">验证</button></div><div class="result-msg" id="w8Result"></div><div class="stars-row" id="w8Stars"></div><button class="next-btn" id="w8Next" data-action="nextLevel">下一关 →</button></div>';
  w8BossEdgesRender();
  w8BossRender();
}

export function w8BossEdgesRender() {
  const el = document.getElementById('w8BossEdges');
  if (!el) return;
  el.innerHTML = W8_EDGES.map(([a, b]) => {
    const dist = w8IntervalDistance(W8_ROOTS[a], W8_ROOTS[b]);
    return '<span style="font-size:12px;background:var(--card);padding:2px 6px;border-radius:6px;border:1px solid var(--dim)">' + W8_NODES[a].name + '↔' + W8_NODES[b].name + ' = ' + dist + '半音</span>';
  }).join('');
}

export function w8BossRender() {
  const el = document.getElementById('w8BossNodes');
  if (!el) return;
  el.innerHTML =
    W8_NODES.map(
      (n) =>
        '<button class="ctrl-btn" style="background:' +
        n.color +
        ';color:#fff" data-action="w8BossClick" data-args=\'[' +
        n.id +
        ']\'>' +
        n.name +
        '</button>'
    ).join('') +
    '<div style="width:100%;text-align:center;margin-top:8px;font-size:18px;font-weight:800">路径：' +
    (state.w8.path.length ? state.w8.path.map((i: number) => W8_NODES[i].name).join(' → ') : '空') +
    '</div>';
}

export function w8BossClick(id: number) {
  if (
    state.w8.path.length === 0 ||
    W8_EDGES.some(
      (e) =>
        (e[0] === state.w8.path[state.w8.path.length - 1] && e[1] === id) ||
        (e[1] === state.w8.path[state.w8.path.length - 1] && e[0] === id)
    )
  ) {
    state.w8.path.push(id);
    w8BossRender();
  } else {
    showErrorToast('该节点与前一个不相连');
  }
}

export function w8BossReset() {
  state.w8.path = [];
  w8BossRender();
}

export function w8BossPlay() {
  if (state.w8.path.length < 2) return;
  stopSharedTransport();
  state.w8.playing = true;
  state.w8.step = 0;
  const freqs = [
    [261.63, 329.63, 392.0],
    [349.23, 392.0, 523.25],
    [392.0, 466.16, 587.33],
    [220.0, 261.63, 329.63],
  ];
  const transport = getSharedTransport(state.w8.bpm, 1);
  state.w8.transport = transport;
  let playedSteps = 0;
  const len = state.w8.path.length;
  transport.subscribe((event: TransportEvent) => {
    const s = event.step % len;
    const node = state.w8.path[s];
    freqs[node].forEach((f) => scheduleToneAt(f, 0.35, 'triangle', 0.2, event.time));
    playedSteps++;
    if (playedSteps >= len) transport.stop();
  });
  transport.start();
}

export function w8BossStop() {
  state.w8.playing = false;
  stopSharedTransport();
  state.w8.transport = null;
}

export function w8BossVerify() {
  const res = document.getElementById('w8Result')!;
  const covered = new Set(state.w8.path);
  let legal = true;
  for (let i = 1; i < state.w8.path.length; i++) {
    const a = state.w8.path[i - 1], b = state.w8.path[i];
    if (!W8_EDGES.some((e) => (e[0] === a && e[1] === b) || (e[1] === a && e[0] === b))) {
      legal = false;
      break;
    }
  }
  if (legal && state.w8.path.length >= 4 && covered.size === W8_NODES.length) {
    if (state.w8.path.length === W8_NODES.length) {
      Store.state.w8BossCoveredAll = true;
      Store.save();
    }
    playCorrect();
    res.className = 'result-msg correct';
    res.textContent = '✅ 路径覆盖所有节点！';
    document.getElementById('w8Next')!.classList.add('show');
    state.combo++;
    let stars = 3 - state.hintLevel;
    if (stars < 1) stars = 1;
    completeLevel(8, state.currentLevel, stars);
    showStars('w8Stars', stars);
    (window as any).spawnConfetti();
    (window as any).spawnCorrectParticles();
    if (state.combo >= 3) (window as any).spawnComboParticles();
    showEducationCard(state.currentLevel);
    recordAdaptive(state.currentLevel, stars);
    updateLeaderboard(state.currentLevel, stars);
    checkAchievements();
  } else {
    playWrong();
    state.combo = 0;
    res.className = 'result-msg wrong';
    res.textContent = '❌ 需要一条合法的、覆盖 I/IV/V/vi 所有节点的路径';
    recordAdaptive(state.currentLevel, 0);
  }
}

export function renderW8Matrix(container: HTMLElement) {
  state.w8 = {
    type: 'matrix',
    matrix: [
      [0, 1, 1, 0],
      [1, 0, 1, 0],
      [1, 1, 0, 1],
      [0, 0, 1, 0],
    ],
    progression: [],
    playing: false,
    transport: null as Transport | null,
    step: 0,
    bpm: 120,
  };
  container.innerHTML =
    '<div class="challenge-card"><div class="challenge-q">切换邻接矩阵的边，生成和弦进行。</div><div id="w8Matrix" style="margin:12px 0"></div><div class="controls-bar"><button class="ctrl-btn" data-action="w8MatrixReset">⟲</button><button class="ctrl-btn play-btn" id="w8PlayBtn" data-action="w8MatrixPlay">▶</button><button class="ctrl-btn" data-action="w8MatrixGen">生成进行</button><button class="verify-btn" data-action="w8MatrixVerify">验证</button></div><div id="w8MatrixProg" style="font-size:18px;font-weight:800;text-align:center;margin:8px 0"></div><div class="result-msg" id="w8Result"></div><div class="stars-row" id="w8Stars"></div><button class="next-btn" id="w8Next" data-action="nextLevel">下一关 →</button></div>';
  w8MatrixRender();
  w8MatrixGen();
}
export function w8MatrixRender() {
  const el = document.getElementById('w8Matrix');
  if (!el) return;
  let html =
    '<table style="margin:0 auto;border-collapse:separate;border-spacing:4px"><tr><td></td>' +
    W8_NODES.map((n) => '<td style="font-size:12px;font-weight:700;text-align:center">' + n.name + '</td>').join('') +
    '</tr>';
  for (let i = 0; i < 4; i++) {
    html += '<tr><td style="font-size:12px;font-weight:700">' + W8_NODES[i].name + '</td>';
    for (let j = 0; j < 4; j++) {
      html +=
        '<td class="seq-cell ' +
        (state.w8.matrix[i][j] ? 'active-a' : '') +
        '" style="width:36px;height:36px;cursor:pointer" data-action="w8MatrixToggle" data-args=\'[' +
        i +
        ',' +
        j +
        ']\'>' +
        (state.w8.matrix[i][j] ? '1' : '0') +
        '</td>';
    }
    html += '</tr>';
  }
  html += '</table>';
  el.innerHTML = html;
}
export function w8MatrixToggle(i: number, j: number) {
  state.w8.matrix[i][j] = state.w8.matrix[i][j] ? 0 : 1;
  if (i !== j) state.w8.matrix[j][i] = state.w8.matrix[i][j];
  w8MatrixRender();
  w8MatrixGen();
}
export function w8MatrixReset() {
  state.w8.matrix = [
    [0, 1, 1, 0],
    [1, 0, 1, 0],
    [1, 1, 0, 1],
    [0, 0, 1, 0],
  ];
  w8MatrixRender();
  w8MatrixGen();
}
export function w8MatrixGen() {
  let cur = 0;
  const prog = [cur];
  for (let i = 0; i < 7; i++) {
    const opts = [];
    for (let j = 0; j < 4; j++) if (state.w8.matrix[cur][j]) opts.push(j);
    if (opts.length === 0) break;
    cur = opts[Math.floor(Math.random() * opts.length)];
    prog.push(cur);
  }
  state.w8.progression = prog;
  const el = document.getElementById('w8MatrixProg');
  if (el) el.textContent = prog.map((i) => W8_NODES[i].name).join(' → ');
}
export function w8MatrixPlay() {
  if (state.w8.progression.length === 0) w8MatrixGen();
  stopSharedTransport();
  state.w8.playing = true;
  state.w8.step = 0;
  const freqs = [
    [261.63, 329.63, 392.0],
    [349.23, 392.0, 523.25],
    [392.0, 466.16, 587.33],
    [220.0, 261.63, 329.63],
  ];
  const transport = getSharedTransport(state.w8.bpm, 1);
  state.w8.transport = transport;
  let playedSteps = 0;
  const len = state.w8.progression.length;
  transport.subscribe((event: TransportEvent) => {
    const s = event.step % len;
    const node = state.w8.progression[s];
    freqs[node].forEach((f) => scheduleToneAt(f, 0.35, 'triangle', 0.2, event.time));
    playedSteps++;
    if (playedSteps >= len) transport.stop();
  });
  transport.start();
}
export function w8MatrixStop() {
  state.w8.playing = false;
  stopSharedTransport();
  state.w8.transport = null;
}
export function w8MatrixVerify() {
  const edgeCount = state.w8.matrix.reduce((s: number, r: number[]) => s + r.reduce((a: number, v: number) => a + v, 0), 0);
  const res = document.getElementById('w8Result')!;
  if (edgeCount >= 4 && state.w8.progression.length >= 4) {
    playCorrect();
    res.className = 'result-msg correct';
    res.textContent = '✅ 邻接矩阵有效，和弦进行已生成！';
    document.getElementById('w8Next')!.classList.add('show');
    state.combo++;
    let stars = 3 - state.hintLevel;
    if (stars < 1) stars = 1;
    completeLevel(8, state.currentLevel, stars);
    showStars('w8Stars', stars);
    (window as any).spawnConfetti();
    (window as any).spawnCorrectParticles();
    if (state.combo >= 3) (window as any).spawnComboParticles();
    showEducationCard(state.currentLevel);
    recordAdaptive(state.currentLevel, stars);
    updateLeaderboard(state.currentLevel, stars);
    checkAchievements();
  } else {
    playWrong();
    state.combo = 0;
    res.className = 'result-msg wrong';
    res.textContent = '❌ 矩阵边数太少或无法生成进行，添加一些连接';
    recordAdaptive(state.currentLevel, 0);
  }
}

export function renderW8Dijkstra(container: HTMLElement) {
  state.w8 = {
    type: 'dijkstra',
    start: 0,
    end: 3,
    path: [],
    weights: w8BuildIntervalWeights(),
    playing: false,
    transport: null as Transport | null,
    step: 0,
    bpm: 120,
  };
  container.innerHTML =
    '<div class="challenge-card"><div class="challenge-q">Dijkstra 最短路径：选择起点和终点，生成旋律。</div><div style="display:flex;gap:8px;justify-content:center;margin:10px 0"><div><label style="font-size:13px;font-weight:700">起点</label><select id="w8Start" data-input="w8DijkstraUpdate">' +
    W8_NODES.map((n, i) => '<option value="' + i + '">' + n.name + '</option>').join('') +
    '</select></div><div><label style="font-size:13px;font-weight:700">终点</label><select id="w8End" data-input="w8DijkstraUpdate">' +
    W8_NODES.map(
      (n, i) => '<option value="' + i + '"' + (i === 3 ? ' selected' : '') + '>' + n.name + '</option>'
    ).join('') +
    '</select></div></div><div class="controls-bar"><button class="ctrl-btn play-btn" id="w8PlayBtn" data-action="w8DijkstraPlay">▶</button><button class="ctrl-btn" data-action="w8DijkstraRun">计算路径</button><button class="verify-btn" data-action="w8DijkstraVerify">验证</button></div><div id="w8DijkstraPath" style="font-size:18px;font-weight:800;text-align:center;margin:8px 0"></div><div class="result-msg" id="w8Result"></div><div class="stars-row" id="w8Stars"></div><button class="next-btn" id="w8Next" data-action="nextLevel">下一关 →</button></div>';
  w8DijkstraRun();
}
export function w8DijkstraUpdate() {
  state.w8.start = parseInt((document.getElementById('w8Start') as HTMLInputElement).value);
  state.w8.end = parseInt((document.getElementById('w8End') as HTMLInputElement).value);
  w8DijkstraRun();
}
export function w8DijkstraRun() {
  const n = 4,
    dist = Array(n).fill(Infinity),
    prev = Array(n).fill(-1),
    vis = Array(n).fill(false);
  dist[state.w8.start] = 0;
  for (let i = 0; i < n; i++) {
    let u = -1;
    for (let j = 0; j < n; j++) if (!vis[j] && (u === -1 || dist[j] < dist[u])) u = j;
    if (dist[u] === Infinity) break;
    vis[u] = true;
    for (let v = 0; v < n; v++) {
      const w = state.w8.weights[u][v];
      if (w > 0 && dist[u] + w < dist[v]) {
        dist[v] = dist[u] + w;
        prev[v] = u;
      }
    }
    const path = [];
    let cur = state.w8.end;
    if (dist[cur] === Infinity) {
      state.w8.path = [];
    } else {
      while (cur !== -1) {
        path.unshift(cur);
        cur = prev[cur];
      }
    }
    state.w8.path = path;
    const el = document.getElementById('w8DijkstraPath');
    if (el)
      el.textContent = path.length
        ? path.map((i) => W8_NODES[i].name).join(' → ') + ' （距离 ' + dist[state.w8.end] + '）'
        : '无路径';
  }
}
export function w8DijkstraPlay() {
  if (state.w8.path.length === 0) w8DijkstraRun();
  stopSharedTransport();
  state.w8.playing = true;
  state.w8.step = 0;
  const freqs = [261.63, 293.66, 329.63, 349.23];
  const transport = getSharedTransport(state.w8.bpm, 1);
  state.w8.transport = transport;
  let playedSteps = 0;
  const len = state.w8.path.length;
  transport.subscribe((event: TransportEvent) => {
    const s = event.step % len;
    const node = state.w8.path[s];
    scheduleToneAt(freqs[node], 0.35, 'triangle', 0.35, event.time);
    playedSteps++;
    if (playedSteps >= len) transport.stop();
  });
  transport.start();
}
export function w8DijkstraStop() {
  state.w8.playing = false;
  stopSharedTransport();
  state.w8.transport = null;
}
export function w8Stop() {
  state.w8.playing = false;
  stopSharedTransport();
  state.w8.transport = null;
}
export function w8DijkstraVerify() {
  if (state.w8.path.length === 0) w8DijkstraRun();
  const res = document.getElementById('w8Result')!;
  if (
    state.w8.path.length >= 2 &&
    state.w8.path[0] === state.w8.start &&
    state.w8.path[state.w8.path.length - 1] === state.w8.end
  ) {
    playCorrect();
    res.className = 'result-msg correct';
    res.textContent = '✅ 最短路径旋律已生成！';
    document.getElementById('w8Next')!.classList.add('show');
    state.combo++;
    let stars = 3 - state.hintLevel;
    if (stars < 1) stars = 1;
    completeLevel(8, state.currentLevel, stars);
    showStars('w8Stars', stars);
    (window as any).spawnConfetti();
    (window as any).spawnCorrectParticles();
    if (state.combo >= 3) (window as any).spawnComboParticles();
    showEducationCard(state.currentLevel);
    recordAdaptive(state.currentLevel, stars);
    updateLeaderboard(state.currentLevel, stars);
    checkAchievements();
  } else {
    playWrong();
    state.combo = 0;
    res.className = 'result-msg wrong';
    res.textContent = '❌ 未找到有效路径，检查权重和连接';
    recordAdaptive(state.currentLevel, 0);
  }
}
/* ===== EXPOSE GLOBALS ===== */
// hand off click + input handlers to the delegation layer. grid toggles carry
// their coords via data-args; the dijkstra selects just need a re-render.
registerActions({
  w8PathReset,
  w8PathPlay,
  w8PathVerify,
  w8PathClick: (_e, id) => w8PathClick(id as number),
  w8BossReset,
  w8BossPlay,
  w8BossVerify,
  w8BossClick: (_e, id) => w8BossClick(id as number),
  w8MatrixReset,
  w8MatrixPlay,
  w8MatrixGen,
  w8MatrixVerify,
  w8MatrixToggle: (_e, i, j) => w8MatrixToggle(i as number, j as number),
  w8DijkstraPlay,
  w8DijkstraRun,
  w8DijkstraVerify,
});
registerInputs({
  w8DijkstraUpdate,
});
Object.assign(window as any, {
  renderW8Boss: renderW8Boss,
  renderW8Dijkstra: renderW8Dijkstra,
  renderW8Matrix: renderW8Matrix,
  renderW8Path: renderW8Path,
  renderWorld8: renderWorld8,
  w8BossClick: w8BossClick,
  w8BossEdgesRender: w8BossEdgesRender,
  w8BossPlay: w8BossPlay,
  w8BossRender: w8BossRender,
  w8BossReset: w8BossReset,
  w8BossStop: w8BossStop,
  w8BossVerify: w8BossVerify,
  w8BuildIntervalWeights: w8BuildIntervalWeights,
  w8DijkstraPlay: w8DijkstraPlay,
  w8DijkstraRun: w8DijkstraRun,
  w8DijkstraStop: w8DijkstraStop,
  w8DijkstraUpdate: w8DijkstraUpdate,
  w8DijkstraVerify: w8DijkstraVerify,
  w8IntervalDistance: w8IntervalDistance,
  w8MatrixGen: w8MatrixGen,
  w8MatrixPlay: w8MatrixPlay,
  w8MatrixRender: w8MatrixRender,
  w8MatrixReset: w8MatrixReset,
  w8MatrixStop: w8MatrixStop,
  w8MatrixToggle: w8MatrixToggle,
  w8MatrixVerify: w8MatrixVerify,
  w8PathClick: w8PathClick,
  w8PathPlay: w8PathPlay,
  w8PathRender: w8PathRender,
  w8PathReset: w8PathReset,
  w8PathStop: w8PathStop,
  w8PathVerify: w8PathVerify,
  w8Stop: w8Stop,
});
