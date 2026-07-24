import { state, stopAllPlayback, checkAchievements } from './game-engine';
import { Store } from './store';
import { LEVELS, NOTE_NAMES } from './worlds';
import {
  getAudioCtx,
  scheduleToneAt,
  scheduleKickAt,
  scheduleSnareAt,
  getSharedTransport,
  stopSharedTransport,
} from './audio';
import type { Transport, TransportEvent } from './core/transport';
import { getDailySeed, dailyHash, lcmCalc, gcdCalc, euclideanRhythm, escapeHtml, arraysEqual } from './utils';
import { w5DegreeName } from './worlds/world5';
import { renderHome, showWhy } from './ui-render';
import { SCIENCE_SAMPLES } from './science';
import { registerActions, registerInputs } from './events';
import { addXp, XP_REWARDS, tryAwardStreakFreeze, consumeStreakFreeze, recordLearningProgress } from './progression';

export function getDailyChallenge() {
  const seed = getDailySeed();
  const types = [
    'lcm',
    'symmetry',
    'ratio',
    'crt',
    'permutation',
    'euclidean',
    'probability',
    'graph',
    'gcd',
    'fibonacci',
    'mod',
    'series',
    'science',
  ];
  const type = types[dailyHash(seed, types.length)];
  if (type === 'lcm') {
    const pairs = [
      [3, 4],
      [4, 5],
      [2, 7],
      [3, 5],
      [4, 7],
      [5, 6],
      [3, 8],
      [5, 8],
    ];
    const [a, b] = pairs[dailyHash(seed, pairs.length)];
    return { type: 'lcm', a, b, answer: lcmCalc(a, b), name: '最小公倍数' };
  }
  if (type === 'symmetry') {
    const roots = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const root = roots[dailyHash(seed, roots.length)];
    const chord = [root, (root + 4) % 12, (root + 8) % 12].sort((x, y) => x - y);
    return { type: 'symmetry', chord, answer: chord, name: '对称群' };
  }
  if (type === 'ratio') {
    const ratios = [
      { r: 3 / 2, name: '纯五度' },
      { r: 4 / 3, name: '纯四度' },
      { r: 5 / 4, name: '大三度' },
      { r: 7 / 4, name: '小七度' },
    ];
    const item = ratios[dailyHash(seed, ratios.length)];
    const target = Math.round(440 * item.r);
    return { type: 'ratio', ratio: item.r, target, answer: target, tolerance: 5, name: '频率比' };
  }
  if (type === 'crt') {
    const mods = [
      [3, 5],
      [4, 7],
      [5, 8],
      [3, 7],
      [5, 9],
      [4, 9],
    ];
    const [m1, m2] = mods[dailyHash(seed, mods.length)];
    const r1 = 1 + dailyHash(seed + 'a', m1 - 1),
      r2 = 1 + dailyHash(seed + 'b', m2 - 1);
    let x = 1;
    while (x <= m1 * m2) {
      if (x % m1 === r1 && x % m2 === r2) break;
      x++;
    }
    return { type: 'crt', m1, m2, r1, r2, answer: x, name: '中国剩余定理' };
  }
  if (type === 'permutation') {
    const motive = [0, 2, 4, 7];
    const shuffles = [motive.slice(), [2, 0, 7, 4], [4, 7, 0, 2], [7, 4, 2, 0]];
    const isValid = dailyHash(seed, 2) === 0;
    const row = isValid ? shuffles[dailyHash(seed + 'p', shuffles.length)] : [0, 2, 4, 5];
    return { type: 'permutation', motive, row, answer: isValid, name: '排列' };
  }
  if (type === 'euclidean') {
    const opts = [
      { k: 3, n: 8 },
      { k: 4, n: 12 },
      { k: 5, n: 16 },
      { k: 3, n: 16 },
    ];
    const item = opts[dailyHash(seed, opts.length)];
    return { type: 'euclidean', k: item.k, n: item.n, answer: euclideanRhythm(item.k, item.n), name: '欧几里得算法' };
  }
  if (type === 'probability') {
    const n = 20 + dailyHash(seed, 30);
    const p = 10 + dailyHash(seed + 'p', 80);
    const answer = Math.round((n * p) / 100);
    return { type: 'probability', n, p, answer, name: '概率' };
  }
  if (type === 'graph') {
    const edges = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [0, 2],
    ];
    const paths = [
      [0, 1, 2],
      [0, 2, 3],
      [1, 2, 3, 0],
      [0, 1, 3],
    ];
    const idx = dailyHash(seed, paths.length);
    const path = paths[idx];
    const valid = path.every(
      (v, i) =>
        i === 0 || edges.some((e) => (e[0] === path[i - 1] && e[1] === v) || (e[1] === path[i - 1] && e[0] === v))
    );
    return { type: 'graph', edges, path, answer: valid, name: '图论' };
  }
  if (type === 'gcd') {
    const pairs = [
      [12, 8],
      [18, 12],
      [24, 9],
      [35, 14],
      [48, 18],
      [100, 25],
      [56, 21],
      [72, 30],
    ];
    const [a, b] = pairs[dailyHash(seed, pairs.length)];
    return {
      type: 'gcd',
      a,
      b,
      answer: gcdCalc(a, b),
      name: '最大公约拍',
      desc: '两段循环分别为 ' + a + ' 拍和 ' + b + ' 拍，能共同划分成的最大小节长度是几拍？',
    };
  }
  if (type === 'fibonacci') {
    const start = 2 + dailyHash(seed, 5);
    const seq = [start, start + 1];
    for (let i = 0; i < 5; i++) seq.push(seq[seq.length - 1] + seq[seq.length - 2]);
    return {
      type: 'fibonacci',
      seq,
      answer: seq[seq.length - 1],
      name: '黄金节奏列',
      desc: '每个节奏块的长度等于前两个块之和，下一个块应占几拍？',
    };
  }
  if (type === 'mod') {
    const a = 10 + dailyHash(seed, 30),
      b = 2 + dailyHash(seed + 'm', 8);
    return {
      type: 'mod',
      a,
      b,
      answer: a % b,
      name: '音高级数取模',
      desc: '在 12 音循环圈里走了 ' + a + ' 个半音，每 ' + b + ' 个半音为一组，余多少？',
    };
  }
  if (type === 'series') {
    const start = 2 + dailyHash(seed, 8),
      diff = 2 + dailyHash(seed + 'd', 5);
    const seq = [];
    for (let i = 0; i < 5; i++) seq.push(start + i * diff);
    return {
      type: 'series',
      seq,
      diff,
      answer: seq[seq.length - 1] + diff,
      name: '等差音程列',
      desc: '每次音高上升 ' + diff + ' 个半音，下一项是多少？',
    };
  }
  if (type === 'science') {
    const keys = Object.keys(SCIENCE_SAMPLES);
    const answerIdx = dailyHash(seed, keys.length);
    const answer = keys[answerIdx];
    const all = keys.map((k) => ({ key: k, name: SCIENCE_SAMPLES[k as keyof typeof SCIENCE_SAMPLES].name }));
    const options = [all[answerIdx]];
    const pool = all.filter((_, i) => i !== answerIdx);
    while (options.length < 4 && pool.length) {
      const i = dailyHash(seed + options.length, pool.length);
      options.push(pool.splice(i, 1)[0]);
    }
    for (let i = options.length - 1; i > 0; i--) {
      const j = dailyHash(seed + 's' + i, i + 1);
      [options[i], options[j]] = [options[j], options[i]];
    }
    return { type: 'science', answer, options, name: '科学之声', sample: SCIENCE_SAMPLES[answer as keyof typeof SCIENCE_SAMPLES] };
  }
  return { type: 'lcm', a: 3, b: 4, answer: 12, name: '最小公倍数' };
}

export let dailyState: any = { playing: false, type: 'lcm', answer: null, transport: null as Transport | null, autoStopTimer: null as ReturnType<typeof setTimeout> | null };
export function startDailyChallenge() {
  stopAllPlayback();
  const d = getDailyChallenge();
  dailyState = {
    playing: false,
    type: d.type,
    answer: d.answer,
    data: d,
    selected: [],
    euclidCells: Array(d.n || 16).fill(0),
  };
  document.getElementById('dailyDate')!.textContent = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  document.getElementById('dailyFeedback')!.textContent = '';
  renderDailyModal();
  const modal = document.getElementById('dailyModal')!;
  modal.style.display = 'flex';
  setTimeout(function () {
    modal.style.opacity = '1';
  }, 10);
}
export function renderDailyModal() {
  const d = dailyState.data;
  const body = document.getElementById('dailyBody');
  if (!body) return;
  if (d.type === 'lcm') {
    body.innerHTML =
      '<div style="font-size:16px;font-weight:700;margin-bottom:8px">题目：两个轨道的拍数分别为 <span style="color:var(--trackA)">' +
      d.a +
      '</span> 和 <span style="color:var(--trackB)">' +
      d.b +
      '</span></div><div style="font-size:14px;color:var(--dim);margin-bottom:16px">播放节奏，找出它们何时对齐（LCM）。</div><div style="display:flex;justify-content:center;gap:12px;margin-bottom:16px"><button class="w1-play" id="dailyPlayBtn" data-action="toggleDailyPlay">▶ 播放</button><button class="w1-stop" data-action="stopDailyPlay">⏹ 停止</button></div><div class="w1-answer-row"><input type="number" class="w1-input" id="dailyInput" placeholder="输入LCM"><button class="w1-verify" data-action="checkDailyAnswer">验证</button></div>';
  } else if (d.type === 'symmetry') {
    body.innerHTML =
      '<div style="font-size:16px;font-weight:700;margin-bottom:8px">题目：在 12 音圆环上选出等距的 3 个音符（大三和弦）</div><div class="w2-ring" id="dailyRing" style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:12px 0"></div><div style="text-align:center"><button class="verify-btn" data-action="checkDailyAnswer">验证</button></div>';
    renderDailyRing();
  } else if (d.type === 'ratio') {
    body.innerHTML =
      '<div style="font-size:16px;font-weight:700;margin-bottom:8px">题目：把 B 调到 ' +
      d.name +
      ' 频率（目标约 ' +
      d.target +
      'Hz）</div><div style="text-align:center;margin:12px 0;font-size:28px;font-weight:900;color:var(--w3)" id="dailyRatioVal">1.000</div><div style="font-size:14px;font-weight:700;text-align:center;margin-bottom:8px">A=440Hz</div><input type="range" id="dailyRatioSlider" min="200" max="1000" value="440" style="width:100%;margin:8px 0" data-input="dailyRatioChange"><div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;color:var(--dim)"><span>200Hz</span><span id="dailyBval">B=440Hz</span><span>1000Hz</span></div><div style="text-align:center;margin-top:10px"><button class="ctrl-btn play-btn" data-action="dailyRatioPlay">▶ 试听</button><button class="verify-btn" data-action="checkDailyAnswer">验证</button></div>';
    dailyRatioChange(440);
  } else if (d.type === 'crt') {
    body.innerHTML =
      '<div style="font-size:16px;font-weight:700;margin-bottom:8px">题目：求最小正整数 x</div><div style="font-size:15px;font-weight:700;text-align:center;margin:12px 0">x ≡ ' +
      d.r1 +
      ' (mod ' +
      d.m1 +
      ')<br>x ≡ ' +
      d.r2 +
      ' (mod ' +
      d.m2 +
      ')</div><div style="display:flex;gap:8px;justify-content:center;margin-bottom:12px"><input type="number" class="w1-input" id="dailyCrtInput" placeholder="输入x" style="width:140px"><button class="w1-verify" data-action="checkDailyAnswer">验证</button></div>';
  } else if (d.type === 'permutation') {
    body.innerHTML =
      '<div style="font-size:16px;font-weight:700;margin-bottom:8px">题目：当前排列是否由原动机排列而来？</div><div style="font-size:13px;font-weight:700;color:var(--dim);margin-bottom:6px">原动机</div><div class="perm-row" style="margin-bottom:12px">' +
      d.motif
        .map((v: number) => '<div class="perm-cell" style="cursor:default;background:#f0ece6">' + w5DegreeName(v) + '</div>')
        .join('') +
      '</div><div style="font-size:13px;font-weight:700;color:var(--dim);margin-bottom:6px">当前排列</div><div class="perm-row" style="margin-bottom:12px">' +
      d.row
        .map((v: number) => '<div class="perm-cell" style="cursor:default;background:#f0ece6">' + w5DegreeName(v) + '</div>')
        .join('') +
      '</div><div style="display:flex;gap:10px;justify-content:center"><button class="verify-btn" data-action="dailyPermAnswer" data-args=\'[true]\'>是</button><button class="verify-btn" style="background:var(--trackB)" data-action="dailyPermAnswer" data-args=\'[false]\'>否</button></div>';
  } else if (d.type === 'euclidean') {
    body.innerHTML =
      '<div style="font-size:16px;font-weight:700;margin-bottom:8px">题目：生成 E(' +
      d.k +
      ',' +
      d.n +
      ') 节奏</div><div id="dailyEuclidGrid" style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap;margin:12px 0"></div><div style="display:flex;gap:10px;justify-content:center"><button class="ctrl-btn" data-action="dailyEuclidApply">📏 欧几里得</button><button class="verify-btn" data-action="checkDailyAnswer">验证</button></div>';
    renderDailyEuclidGrid();
  } else if (d.type === 'probability') {
    body.innerHTML =
      '<div style="font-size:16px;font-weight:700;margin-bottom:8px">题目：n=' +
      d.n +
      ' 次伯努利试验，每次命中概率 ' +
      d.p +
      '%</div><div style="font-size:14px;color:var(--dim);margin-bottom:12px">期望命中多少次？（四舍五入）</div><div style="display:flex;gap:8px;justify-content:center;margin-bottom:12px"><input type="number" class="w1-input" id="dailyProbInput" placeholder="期望值" style="width:120px"><button class="w1-verify" data-action="checkDailyAnswer">验证</button></div>';
  } else if (d.type === 'graph') {
    const names = ['I', 'IV', 'V', 'vi'];
    body.innerHTML =
      '<div style="font-size:16px;font-weight:700;margin-bottom:8px">题目：给定和弦图，判断路径是否合法</div><div style="font-size:14px;color:var(--dim);margin-bottom:8px">合法连接：I↔IV、IV↔V、V↔vi、vi↔I、I↔V</div><div style="font-size:18px;font-weight:800;text-align:center;margin:12px 0">' +
      d.path.map((i: number) => names[i]).join(' → ') +
      '</div><div style="display:flex;gap:10px;justify-content:center"><button class="verify-btn" data-action="dailyGraphAnswer" data-args=\'[true]\'>合法</button><button class="verify-btn" style="background:var(--trackB)" data-action="dailyGraphAnswer" data-args=\'[false]\'>不合法</button></div>';
  } else if (d.type === 'gcd') {
    body.innerHTML =
      '<div style="font-size:16px;font-weight:700;margin-bottom:8px">题目：' +
      d.desc +
      '</div><div style="font-size:14px;color:var(--dim);margin-bottom:12px">等价于求 GCD(' +
      d.a +
      ',' +
      d.b +
      ')，即两循环共同的最大小节拍数。</div><div style="display:flex;gap:8px;justify-content:center;margin-bottom:12px"><input type="number" class="w1-input" id="dailyInput" placeholder="输入最大公约拍" style="width:140px"><button class="w1-verify" data-action="checkDailyAnswer">验证</button></div><div style="text-align:center"><button class="ctrl-btn play-btn" data-action="dailyMathPlay" data-args=\'["gcd"]\'>▶ 试听两循环</button></div>';
  } else if (d.type === 'fibonacci') {
    body.innerHTML =
      '<div style="font-size:16px;font-weight:700;margin-bottom:8px">题目：' +
      d.desc +
      '</div><div style="font-size:18px;font-weight:800;text-align:center;margin:12px 0">' +
      d.seq.join(' , ') +
      ' , ?</div><div style="font-size:14px;color:var(--dim);margin-bottom:12px">每个数代表一个节奏块的拍数。</div><div style="display:flex;gap:8px;justify-content:center;margin-bottom:12px"><input type="number" class="w1-input" id="dailyInput" placeholder="下一项" style="width:120px"><button class="w1-verify" data-action="checkDailyAnswer">验证</button></div><div style="text-align:center"><button class="ctrl-btn play-btn" data-action="dailyMathPlay" data-args=\'["fibonacci"]\'>▶ 试听节奏列</button></div>';
  } else if (d.type === 'mod') {
    body.innerHTML =
      '<div style="font-size:16px;font-weight:700;margin-bottom:8px">题目：' +
      d.desc +
      '</div><div style="font-size:14px;color:var(--dim);margin-bottom:12px">等价于求 ' +
      d.a +
      ' mod ' +
      d.b +
      '。</div><div style="display:flex;gap:8px;justify-content:center;margin-bottom:12px"><input type="number" class="w1-input" id="dailyInput" placeholder="输入余数" style="width:120px"><button class="w1-verify" data-action="checkDailyAnswer">验证</button></div><div style="text-align:center"><button class="ctrl-btn play-btn" data-action="dailyMathPlay" data-args=\'["mod"]\'>▶ 试听音高</button></div>';
  } else if (d.type === 'series') {
    body.innerHTML =
      '<div style="font-size:16px;font-weight:700;margin-bottom:8px">题目：' +
      d.desc +
      '</div><div style="font-size:18px;font-weight:800;text-align:center;margin:12px 0">' +
      d.seq.join(' , ') +
      ' , ?</div><div style="font-size:14px;color:var(--dim);margin-bottom:12px">每次上升 ' +
      d.diff +
      ' 个半音。</div><div style="display:flex;gap:8px;justify-content:center;margin-bottom:12px"><input type="number" class="w1-input" id="dailyInput" placeholder="下一项" style="width:120px"><button class="w1-verify" data-action="checkDailyAnswer">验证</button></div><div style="text-align:center"><button class="ctrl-btn play-btn" data-action="dailyMathPlay" data-args=\'["series"]\'>▶ 试听音程</button></div>';
  } else if (d.type === 'science') {
    body.innerHTML =
      '<div style="font-size:16px;font-weight:700;margin-bottom:8px">题目：这段音乐来自哪类科学数据？</div><div style="text-align:center;margin:12px 0"><button class="ctrl-btn play-btn" id="dailySciencePlayBtn" data-action="dailySciencePlay">▶ 试听</button></div><div id="dailyScienceOptions" style="display:flex;flex-direction:column;gap:10px;">' +
      d.options
        .map(
          (o: any) =>
            '<button class="verify-btn" style="background:var(--dim)" data-action="dailyScienceAnswer" data-args=\'["' +
            o.key +
            '"]\'>' +
            o.name +
            '</button>'
        )
        .join('') +
      '</div>';
  }
}
export function renderDailyRing() {
  const el = document.getElementById('dailyRing');
  if (!el) return;
  el.innerHTML = '';
  for (let i = 0; i < 12; i++) {
    const on = dailyState.selected.includes(i);
    const d = document.createElement('div');
    d.className = 'seq-cell ' + (on ? 'active-a' : '');
    d.style.width = '44px';
    d.style.height = '44px';
    d.style.fontSize = '12px';
    d.textContent = NOTE_NAMES[i];
    d.onclick = function () {
      dailyRingToggle(i);
    };
    el.appendChild(d);
  }
}
export function dailyRingToggle(i: number) {
  const idx = dailyState.selected.indexOf(i);
  if (idx >= 0) dailyState.selected.splice(idx, 1);
  else if (dailyState.selected.length < 4) dailyState.selected.push(i);
  renderDailyRing();
}
export function dailyRatioChange(v: string | number | Event) {
  const val = v instanceof Event ? (v.target as HTMLInputElement).value : v;
  dailyState.ratioB = parseInt(String(val));
  const ratio = dailyState.ratioB / 440;
  document.getElementById('dailyBval')!.textContent = 'B=' + dailyState.ratioB + 'Hz';
  const el = document.getElementById('dailyRatioVal');
  if (el) el.textContent = ratio.toFixed(3);
}
export function dailyRatioPlay() {
  const ctx = getAudioCtx();
  const t = ctx.currentTime + 0.02;
  scheduleToneAt(440, 0.6, 'sine', 0.25, t);
  scheduleToneAt(dailyState.ratioB || 440, 0.6, 'sine', 0.25, t + 0.01);
}
export function renderDailyEuclidGrid() {
  const el = document.getElementById('dailyEuclidGrid');
  if (!el) return;
  el.innerHTML = dailyState.euclidCells
    .map(
      (c: number, i: number) =>
        '<div class="seq-cell ' +
        (c ? 'active-a' : '') +
        '" style="width:32px;height:40px" data-action="dailyEuclidToggle" data-args=\'[' + i + ']\'>' +
        (i + 1) +
        '</div>'
    )
    .join('');
}
export function dailyEuclidToggle(e: Event, ...args: unknown[]) {
  const i = args[0] as number;
  dailyState.euclidCells[i] = dailyState.euclidCells[i] ? 0 : 1;
  renderDailyEuclidGrid();
}
export function dailyEuclidApply() {
  dailyState.euclidCells = euclideanRhythm(dailyState.data.k, dailyState.data.n);
  renderDailyEuclidGrid();
}
export function closeDailyModal() {
  stopDailyPlay();
  document.getElementById('dailyModal')!.style.display = 'none';
}
export function toggleDailyPlay() {
  if (dailyState.playing) {
    stopDailyPlay();
    return;
  }
  stopSharedTransport();
  dailyState.playing = true;
  const btn = document.getElementById('dailyPlayBtn');
  if (btn) btn.textContent = '⏸ 暂停';
  const a = dailyState.data.a,
    b = dailyState.data.b,
    lcm = dailyState.data.answer;
  const transport = getSharedTransport(100, 1);
  dailyState.transport = transport;
  transport.subscribe((event: TransportEvent) => {
    const s = event.step % lcm;
    const t = event.time;
    if (s % a === 0 && s % b === 0) {
      scheduleKickAt(t);
      scheduleSnareAt(t);
      scheduleToneAt(660, 0.2, 'sine', 0.3, t);
    } else if (s % a === 0) {
      scheduleKickAt(t);
    } else if (s % b === 0) {
      scheduleSnareAt(t);
    }
  });
  transport.start();
}
export function stopDailyPlay() {
  dailyState.playing = false;
  stopSharedTransport();
  dailyState.transport = null;
  if (dailyState.autoStopTimer) {
    clearTimeout(dailyState.autoStopTimer);
    dailyState.autoStopTimer = null;
  }
  const btn = document.getElementById('dailyPlayBtn');
  if (btn) btn.textContent = '▶ 播放';
}
export function dailyMathPlay(e: Event, ...args: unknown[]) {
  const kind = args[0] as string;
  const d = dailyState.data;
  const ctx = getAudioCtx();
  const now = ctx.currentTime + 0.05;
  if (kind === 'gcd' && d.type === 'gcd') {
    stopSharedTransport();
    const transport = getSharedTransport(120, 1);
    dailyState.transport = transport;
    const a = d.a,
      b = d.b,
      lcm = d.answer;
    transport.subscribe((event: TransportEvent) => {
      const s = event.step % lcm;
      const t = event.time;
      if (s % a === 0 && s % b === 0) {
        scheduleKickAt(t);
        scheduleSnareAt(t);
        scheduleToneAt(660, 0.15, 'sine', 0.25, t);
      } else if (s % a === 0) {
        scheduleToneAt(440, 0.15, 'square', 0.15, t);
      } else if (s % b === 0) {
        scheduleToneAt(554, 0.15, 'square', 0.15, t);
      }
    });
    transport.start();
    if (dailyState.autoStopTimer) clearTimeout(dailyState.autoStopTimer);
    dailyState.autoStopTimer = setTimeout(
      () => {
        stopDailyPlay();
      },
      (lcm / 2 + 0.1) * 1000
    );
  } else if (kind === 'fibonacci' && d.type === 'fibonacci') {
    let t = now;
    const base = 261.63;
    for (const v of d.seq) {
      scheduleToneAt(base * Math.pow(2, d.seq.indexOf(v) / 12), v * 0.15, 'triangle', 0.2, t);
      t += v * 0.15 + 0.05;
    }
  } else if (kind === 'mod' && d.type === 'mod') {
    scheduleToneAt(440, 0.3, 'sine', 0.25, now);
    scheduleToneAt(440 * Math.pow(2, d.answer / 12), 0.4, 'sine', 0.3, now + 0.35);
  } else if (kind === 'series' && d.type === 'series') {
    let t = now;
    for (let i = 0; i < d.seq.length; i++) {
      scheduleToneAt(440 * Math.pow(2, d.seq[i] / 12), 0.25, 'sine', 0.2, t);
      t += 0.35;
    }
  }
}
export function checkDailyAnswer() {
  const d = dailyState.data;
  let correct = false;
  if (d.type === 'lcm') {
    correct = parseInt((document.getElementById('dailyInput') as HTMLInputElement).value, 10) === d.answer;
  } else if (d.type === 'symmetry') {
    const sel = dailyState.selected.slice().sort((x: number, y: number) => x - y);
    const ans = d.answer.slice().sort((x: number, y: number) => x - y);
    if (sel.length !== 3) {
      showDailyFeedback('请选择 3 个音符', false);
      return;
    }
    correct = arraysEqual(sel, ans);
  } else if (d.type === 'ratio') {
    correct = Math.abs((dailyState.ratioB || 440) - d.answer) <= d.tolerance;
  } else if (d.type === 'crt') {
    correct = parseInt((document.getElementById('dailyCrtInput') as HTMLInputElement).value, 10) === d.answer;
  } else if (d.type === 'euclidean') {
    correct = arraysEqual(dailyState.euclidCells, euclideanRhythm(d.k, d.n));
  } else if (d.type === 'probability') {
    correct = parseInt((document.getElementById('dailyProbInput') as HTMLInputElement).value, 10) === d.answer;
  } else if (d.type === 'gcd' || d.type === 'fibonacci' || d.type === 'mod' || d.type === 'series') {
    correct = parseInt((document.getElementById('dailyInput') as HTMLInputElement).value, 10) === d.answer;
  }
  if (correct) {
    dailyChallengeSuccess();
  } else {
    showDailyFeedback('答案不对，再想想', false);
  }
}
export function dailyPermAnswer(e: Event, ...args: unknown[]) {
  const v = args[0] as boolean;
  if (v === dailyState.data.answer) {
    dailyChallengeSuccess();
  } else {
    showDailyFeedback('判断有误，再想想', false);
  }
}
export function dailyGraphAnswer(e: Event, ...args: unknown[]) {
  const v = args[0] as boolean;
  if (v === dailyState.data.answer) {
    dailyChallengeSuccess();
  } else {
    showDailyFeedback('判断有误，再想想', false);
  }
}
export function dailySciencePlay() {
  const ctx = getAudioCtx();
  const now = ctx.currentTime + 0.05;
  const sample = dailyState.data.sample;
  if (!sample) {
    const freqs = [440, 554, 659, 880];
    freqs.forEach((f, i) => scheduleToneAt(f, 0.3, 'sine', 0.25, now + i * 0.3));
    return;
  }
  // 从样本中提取第一个数值数组并映射为旋律
  function firstNumericArray(obj: any): number[] | null {
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (Array.isArray(v) && v.length && typeof v[0] === 'number') return v;
      if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
        for (const vk of Object.keys(v[0])) {
          const arr = v.map((x: any) => x[vk]).filter((x: any) => typeof x === 'number');
          if (arr.length) return arr;
        }
      }
    }
    return null;
  }
  let arr = firstNumericArray(sample);
  if (!arr || arr.length === 0) {
    // DNA 等字符串序列映射为音高
    const seq = sample.sequence;
    if (typeof seq === 'string' && seq.length) {
      const map: any = { A: 261.63, T: 329.63, G: 392.0, C: 493.88 };
      arr = seq
        .slice(0, 16)
        .split('')
        .map((c: string) => map[c] || 440);
    }
  }
  if (!arr || arr.length === 0) {
    const freqs = [440, 554, 659, 880];
    freqs.forEach((f, i) => scheduleToneAt(f, 0.3, 'sine', 0.25, now + i * 0.3));
    return;
  }
  const vals = arr.slice(0, 16);
  const min = Math.min(...vals),
    max = Math.max(...vals);
  const range = max - min || 1;
  vals.forEach((v, i) => {
    const f = 220 + (660 * (v - min)) / range;
    scheduleToneAt(f, 0.25, 'sine', 0.2, now + i * 0.18);
  });
}
export function dailyScienceAnswer(e: Event, ...args: unknown[]) {
  const key = args[0] as string;
  if (key === dailyState.data.answer) {
    dailyChallengeSuccess();
  } else {
    showDailyFeedback('判断有误，再想想', false);
  }
}
export function showDailyFeedback(msg: string, success: boolean) {
  const fb = document.getElementById('dailyFeedback')!;
  fb.innerHTML =
    '<span style="color:' +
    (success ? 'var(--success)' : 'var(--error)') +
    '">' +
    (success ? '✅ ' : '❌ ') +
    msg +
    '</span>';
}
export function dailyChallengeSuccess() {
  showDailyFeedback('正确！🎉', true);
  const key = 'daily_' + getDailySeed();
  const today = new Date().toISOString().slice(0, 10);
  const wasDone = (Store.state.achievements || []).includes(key);
  if (!wasDone) {
    Store.state.achievements.push(key);
    updateDailyStreak();
    if (!Store.state.dailyTypesCompleted.includes(dailyState.type)) {
      Store.state.dailyTypesCompleted.push(dailyState.type);
    }
    const weekKey = getWeekKey();
    Store.state.dailyWeekCounts[weekKey] = (Store.state.dailyWeekCounts[weekKey] || 0) + 1;
    Store.save();
    renderHome();
    updateDailyBanner();
    // XP 奖励：完成每日挑战 +30 XP；并检测连胜护盾奖励（每 7 天）
    try {
      addXp(XP_REWARDS.dailyComplete, '每日挑战');
      tryAwardStreakFreeze();
      recordLearningProgress(1);
    } catch (e) {
      /* progression 失败不影响主流程 */
    }
  }
  (window as any).spawnConfetti();
  checkAchievements();
}
export function updateDailyStreak() {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (Store.state.dailyLastDate === yesterday) {
    Store.state.dailyStreak++;
  } else if (Store.state.dailyLastDate !== today) {
    // 断签：尝试用连胜护盾保护原连胜
    const prevStreak = Store.state.dailyStreak || 0;
    if (prevStreak > 0 && consumeStreakFreeze()) {
      // 护盾生效，延续连胜并 +1
      Store.state.dailyStreak = prevStreak + 1;
    } else {
      Store.state.dailyStreak = 1;
    }
  }
  Store.state.dailyLastDate = today;
}
export function getWeekKey() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay() + 1);
  return d.toISOString().slice(0, 10);
}
export function showDailyWhy() {
  const d = dailyState.data;
  const map = {
    lcm: '1-1',
    symmetry: '2-1',
    ratio: '3-1',
    crt: '4-1',
    permutation: '5-1',
    euclidean: '6-1',
    probability: '7-1',
    graph: '8-1',
    gcd: '1-1',
    fibonacci: '6-1',
    mod: '4-1',
    series: '1-1',
    science: '1-1',
  };
  showWhy(map[d.type as keyof typeof map] || '1-1');
}
export function updateDailyBanner() {
  const d = getDailyChallenge();
  const key = 'daily_' + getDailySeed();
  const done = (Store.state.achievements || []).includes(key);
  const el = document.getElementById('dailyChallengeBanner');
  const sub = document.getElementById('dailySub');
  if (sub) {
    sub.textContent = '今日挑战：' + (d.name || d.type);
  }
  if (el) {
    const streak = Store.state.dailyStreak || 0;
    const streakText = streak > 0 ? ' 🔥 ' + streak + ' 天' : '';
    if (done) {
      el.classList.add('done');
      document.getElementById('dailyStatus')!.textContent = '已完成' + streakText;
    } else {
      el.classList.remove('done');
      document.getElementById('dailyStatus')!.textContent = '开始挑战' + streakText;
    }
  }
}
/* ===== EXPOSE GLOBALS ===== */
registerActions({
  toggleDailyPlay,
  stopDailyPlay,
  checkDailyAnswer,
  dailyRatioPlay,
  dailyPermAnswer,
  dailyEuclidApply,
  dailyGraphAnswer,
  dailyMathPlay,
  dailySciencePlay,
  dailyScienceAnswer,
  dailyEuclidToggle,
});
registerInputs({ dailyRatioChange });
// Keep window exposure for backwards compat
Object.assign(window as any, {
  checkDailyAnswer: checkDailyAnswer,
  closeDailyModal: closeDailyModal,
  dailyChallengeSuccess: dailyChallengeSuccess,
  dailyEuclidApply: dailyEuclidApply,
  dailyEuclidToggle: dailyEuclidToggle,
  dailyGraphAnswer: dailyGraphAnswer,
  dailyMathPlay: dailyMathPlay,
  dailyPermAnswer: dailyPermAnswer,
  dailyRatioChange: dailyRatioChange,
  dailyRatioPlay: dailyRatioPlay,
  dailyRingToggle: dailyRingToggle,
  dailyScienceAnswer: dailyScienceAnswer,
  dailySciencePlay: dailySciencePlay,
  getDailyChallenge: getDailyChallenge,
  getWeekKey: getWeekKey,
  renderDailyEuclidGrid: renderDailyEuclidGrid,
  renderDailyModal: renderDailyModal,
  renderDailyRing: renderDailyRing,
  showDailyFeedback: showDailyFeedback,
  showDailyWhy: showDailyWhy,
  startDailyChallenge: startDailyChallenge,
  stopDailyPlay: stopDailyPlay,
  toggleDailyPlay: toggleDailyPlay,
  updateDailyBanner: updateDailyBanner,
  updateDailyStreak: updateDailyStreak,
});
