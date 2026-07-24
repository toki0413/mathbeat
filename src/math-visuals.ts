/**
 * 可视化即证明
 * 每个世界对应一个可交互的数学可视化，
 * 帮助玩家通过视觉建立对抽象结构的直觉。
 */

export interface VisualConfig {
  title: string;
  render(container: HTMLElement): void;
}

function clear(el: HTMLElement) {
  el.innerHTML = '';
}

function svg(ns: string, attrs: Record<string, string | number> = {}): SVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', ns);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
  return el;
}

function createSlider(
  min: number,
  max: number,
  value: number,
  label: string,
  onChange: (v: number) => void
): HTMLInputElement {
  const wrap = document.createElement('div');
  wrap.style.margin = '6px 0';
  wrap.style.display = 'flex';
  wrap.style.alignItems = 'center';
  wrap.style.gap = '8px';
  wrap.style.fontSize = '12px';
  wrap.style.color = '#555';
  const lbl = document.createElement('label');
  lbl.textContent = label;
  lbl.style.minWidth = '60px';
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.value = String(value);
  input.style.flex = '1';
  input.addEventListener('input', () => onChange(Number(input.value)));
  const val = document.createElement('span');
  val.style.minWidth = '28px';
  val.textContent = String(value);
  input.addEventListener('input', () => (val.textContent = input.value));
  wrap.appendChild(lbl);
  wrap.appendChild(input);
  wrap.appendChild(val);
  // 把 slider 插入到 container 是调用方负责，这里返回 input 和 wrap
  (input as any)._wrap = wrap;
  return input;
}

// 模块级 RAF 跟踪：记录每个使用 requestAnimationFrame 的可视化的取消回调。
const rafControllers = new Map<string, () => void>();

/**
 * 停止所有由数学可视化启动的 requestAnimationFrame 循环。
 * 供 main.ts 在切屏/卸载时调用，避免 RAF 永久运行导致内存泄漏。
 */
export function stopAllMathVisuals(): void {
  rafControllers.forEach((cancel) => cancel());
  rafControllers.clear();
}

export const MATH_VISUALS: Record<number, VisualConfig> = {
  1: {
    title: 'LCM 可视化：两条节奏轨道何时重合',
    render(container) {
      clear(container);
      const w = 360,
        h = 150;
      const svgEl = svg('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}` });
      const gA = svg('g'),
        gB = svg('g'),
        gLCM = svg('g');
      svgEl.append(gA, gB, gLCM);
      const info = document.createElement('div');
      info.style.fontSize = '13px';
      info.style.color = '#444';
      info.style.textAlign = 'center';
      info.style.marginTop = '4px';
      container.appendChild(svgEl);
      container.appendChild(info);

      let a = 2,
        b = 3;
      function draw() {
        gA.innerHTML = '';
        gB.innerHTML = '';
        gLCM.innerHTML = '';
        const steps = 24;
        const cyA = 40,
          cyB = 90,
          r = 10,
          gap = 14;
        const startX = 20;
        // 轨道 A
        for (let i = 0; i <= steps; i++) {
          const x = startX + i * gap;
          const c = svg('circle', {
            cx: x,
            cy: cyA,
            r,
            fill: i % a === 0 ? '#FF8C42' : '#fff',
            stroke: '#FF8C42',
            'stroke-width': 2,
          });
          gA.appendChild(c);
          if (i % a === 0) {
            const t = svg('text', { x, y: cyA + 4, 'text-anchor': 'middle', fill: '#fff', 'font-size': 10 });
            t.textContent = 'A';
            gA.appendChild(t);
          }
        }
        // 轨道 B
        for (let i = 0; i <= steps; i++) {
          const x = startX + i * gap;
          const c = svg('circle', {
            cx: x,
            cy: cyB,
            r,
            fill: i % b === 0 ? '#FFB347' : '#fff',
            stroke: '#FFB347',
            'stroke-width': 2,
          });
          gB.appendChild(c);
          if (i % b === 0) {
            const t = svg('text', { x, y: cyB + 4, 'text-anchor': 'middle', fill: '#fff', 'font-size': 10 });
            t.textContent = 'B';
            gB.appendChild(t);
          }
        }
        // LCM 高亮
        const lcm = (a * b) / gcd(a, b);
        for (let i = 0; i <= steps; i++) {
          if (i % lcm === 0 && i > 0) {
            const x = startX + i * gap;
            const line = svg('line', {
              x1: x,
              y1: cyA + 12,
              x2: x,
              y2: cyB - 12,
              stroke: '#7BC67E',
              'stroke-width': 2,
              'stroke-dasharray': '4 2',
            });
            gLCM.appendChild(line);
            const tx = svg('text', { x, y: cyB + 28, 'text-anchor': 'middle', fill: '#7BC67E', 'font-size': 11 });
            tx.textContent = `LCM=${i}`;
            gLCM.appendChild(tx);
          }
        }
        info.textContent = `A 周期=${a}，B 周期=${b}，GCD=${gcd(a, b)}，LCM=${lcm}`;
      }
      function gcd(x: number, y: number): number {
        return y === 0 ? x : gcd(y, x % y);
      }

      const sA = createSlider(2, 7, a, 'A周期', (v) => {
        a = v;
        draw();
      });
      const sB = createSlider(2, 7, b, 'B周期', (v) => {
        b = v;
        draw();
      });
      container.appendChild((sA as any)._wrap);
      container.appendChild((sB as any)._wrap);
      draw();
    },
  },
  2: {
    title: '对称群：正十二边形的旋转与倒影',
    render(container) {
      clear(container);
      const w = 200,
        h = 200,
        cx = 100,
        cy = 100,
        r = 70;
      const wrap = document.createElement('div');
      wrap.style.display = 'flex';
      wrap.style.flexDirection = 'column';
      wrap.style.alignItems = 'center';
      const svgEl = svg('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}` });
      const gPoly = svg('g');
      const gNotes = svg('g');
      svgEl.appendChild(gPoly);
      svgEl.appendChild(gNotes);
      wrap.appendChild(svgEl);

      let rotation = 0;
      let reflected = false;
      const selected = new Set([0, 4, 7]); // C-E-G

      function draw() {
        gPoly.innerHTML = '';
        gNotes.innerHTML = '';
        const pts: string[] = [];
        for (let i = 0; i < 12; i++) {
          const ang = ((i * 30 - 90) * Math.PI) / 180;
          const x = cx + r * Math.cos(ang);
          const y = cy + r * Math.sin(ang);
          pts.push(`${x},${y}`);
          const dot = svg('circle', { cx: x, cy: y, r: 5, fill: '#ddd', stroke: '#E8587A', 'stroke-width': 1 });
          gPoly.appendChild(dot);
          const lbl = svg('text', { x, y: y - 10, 'text-anchor': 'middle', fill: '#888', 'font-size': 9 });
          lbl.textContent = String(i);
          gPoly.appendChild(lbl);
        }
        const polygon = svg('polygon', { points: pts.join(' '), fill: 'none', stroke: '#E8587A', 'stroke-width': 2 });
        gPoly.appendChild(polygon);

        // 绘制选中音符（应用变换）
        selected.forEach((idx) => {
          let i = idx;
          if (reflected) i = (12 - i) % 12;
          i = (i + rotation) % 12;
          const ang = ((i * 30 - 90) * Math.PI) / 180;
          const x = cx + r * Math.cos(ang);
          const y = cy + r * Math.sin(ang);
          const note = svg('circle', { cx: x, cy: y, r: 9, fill: '#E8587A' });
          gNotes.appendChild(note);
        });
      }

      const btnRow = document.createElement('div');
      btnRow.style.display = 'flex';
      btnRow.style.gap = '8px';
      btnRow.style.marginTop = '6px';
      const rotBtn = document.createElement('button');
      rotBtn.textContent = '旋转 +1';
      rotBtn.className = 'btn secondary';
      rotBtn.onclick = () => {
        rotation = (rotation + 1) % 12;
        draw();
      };
      const refBtn = document.createElement('button');
      refBtn.textContent = '倒影';
      refBtn.className = 'btn secondary';
      refBtn.onclick = () => {
        reflected = !reflected;
        draw();
      };
      btnRow.appendChild(rotBtn);
      btnRow.appendChild(refBtn);
      wrap.appendChild(btnRow);
      container.appendChild(wrap);
      draw();
    },
  },
  3: {
    title: '频率比：波形叠加与拍频',
    render(container) {
      clear(container);
      const canvas = document.createElement('canvas');
      canvas.width = 360;
      canvas.height = 120;
      container.appendChild(canvas);
      const ctx = canvas.getContext('2d')!;
      let freqA = 440,
        freqB = 660;
      let phase = 0;
      let rafId: number | null = null;
      let running = true;
      // 重新渲染时先取消上一次未停止的 RAF，避免多条循环并存
      rafControllers.get('visual-3')?.();
      rafControllers.set('visual-3', () => {
        running = false;
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      });

      function draw() {
        if (!running) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#7C6BFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x < canvas.width; x++) {
          const t = x / 60 + phase;
          const yA = 30 + 20 * Math.sin(((2 * Math.PI * freqA) / 440) * t);
          const yB = 70 + 20 * Math.sin(((2 * Math.PI * freqB) / 440) * t);
          if (x === 0) {
            ctx.moveTo(x, yA);
          } else {
            ctx.lineTo(x, yA);
          }
        }
        ctx.stroke();
        ctx.strokeStyle = '#A78BFA';
        ctx.beginPath();
        for (let x = 0; x < canvas.width; x++) {
          const t = x / 60 + phase;
          const yB = 70 + 20 * Math.sin(((2 * Math.PI * freqB) / 440) * t);
          if (x === 0) {
            ctx.moveTo(x, yB);
          } else {
            ctx.lineTo(x, yB);
          }
        }
        ctx.stroke();
        // 拍频叠加
        ctx.strokeStyle = '#FF8C42';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x < canvas.width; x++) {
          const t = x / 60 + phase;
          const sum = Math.sin(((2 * Math.PI * freqA) / 440) * t) + Math.sin(((2 * Math.PI * freqB) / 440) * t);
          const y = 105 + 10 * sum;
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
        phase += 0.05;
        rafId = requestAnimationFrame(draw);
      }

      const info = document.createElement('div');
      info.style.fontSize = '12px';
      info.style.color = '#555';
      info.style.marginTop = '4px';
      info.style.textAlign = 'center';
      container.appendChild(info);
      const updateInfo = () => {
        const ratio = freqB / freqA;
        info.textContent = `A=${freqA}Hz, B=${freqB}Hz, 比≈${ratio.toFixed(3)}`;
      };
      const sA = createSlider(220, 880, freqA, 'A频率', (v) => {
        freqA = v;
        updateInfo();
      });
      const sB = createSlider(330, 1320, freqB, 'B频率', (v) => {
        freqB = v;
        updateInfo();
      });
      container.appendChild((sA as any)._wrap);
      container.appendChild((sB as any)._wrap);
      updateInfo();
      draw();
    },
  },
  4: {
    title: 'CRT：双环对齐',
    render(container) {
      clear(container);
      const w = 220,
        h = 220;
      const svgEl = svg('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}` });
      const g = svg('g');
      svgEl.appendChild(g);
      container.appendChild(svgEl);
      let a = 3,
        b = 5,
        step = 0;

      function draw() {
        g.innerHTML = '';
        const cxA = 110,
          cyA = 110,
          rA = 70,
          rB = 50;
        // 外环 a
        const ringA = svg('circle', { cx: cxA, cy: cyA, r: rA, fill: 'none', stroke: '#4ECDC4', 'stroke-width': 3 });
        g.appendChild(ringA);
        // 内环 b
        const ringB = svg('circle', { cx: cxA, cy: cyA, r: rB, fill: 'none', stroke: '#88D8C0', 'stroke-width': 3 });
        g.appendChild(ringB);
        // 刻度
        for (let i = 0; i < a; i++) {
          const ang = (((i / a) * 360 - 90) * Math.PI) / 180;
          const x = cxA + rA * Math.cos(ang);
          const y = cyA + rA * Math.sin(ang);
          const c = svg('circle', {
            cx: x,
            cy: y,
            r: 6,
            fill: i === step % a ? '#4ECDC4' : '#fff',
            stroke: '#4ECDC4',
            'stroke-width': 2,
          });
          g.appendChild(c);
        }
        for (let i = 0; i < b; i++) {
          const ang = (((i / b) * 360 - 90) * Math.PI) / 180;
          const x = cxA + rB * Math.cos(ang);
          const y = cyA + rB * Math.sin(ang);
          const c = svg('circle', {
            cx: x,
            cy: y,
            r: 5,
            fill: i === step % b ? '#88D8C0' : '#fff',
            stroke: '#88D8C0',
            'stroke-width': 2,
          });
          g.appendChild(c);
        }
        // 对齐指示
        const aligned = step % a === 0 && step % b === 0;
        if (aligned && step > 0) {
          const txt = svg('text', { x: cxA, y: cyA + 95, 'text-anchor': 'middle', fill: '#7BC67E', 'font-size': 12 });
          txt.textContent = `第 ${step} 步对齐 (LCM)`;
          g.appendChild(txt);
        }
      }

      const btn = document.createElement('button');
      btn.textContent = '下一步';
      btn.className = 'btn secondary';
      btn.style.marginTop = '6px';
      btn.onclick = () => {
        step++;
        draw();
      };
      container.appendChild(btn);
      draw();
    },
  },
  5: {
    title: '排列：动机变奏',
    render(container) {
      clear(container);
      const notes = [0, 2, 4, 7];
      const names = ['C', 'D', 'E', 'G'];
      const wrap = document.createElement('div');
      wrap.style.display = 'flex';
      wrap.style.flexDirection = 'column';
      wrap.style.alignItems = 'center';
      wrap.style.gap = '8px';
      let current = [...notes];

      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.gap = '6px';
      row.style.marginTop = '6px';
      wrap.appendChild(row);

      function renderRow() {
        row.innerHTML = '';
        current.forEach((n, i) => {
          const box = document.createElement('div');
          box.textContent = names[notes.indexOf(n)];
          box.style.width = '36px';
          box.style.height = '36px';
          box.style.background = '#FFD166';
          box.style.borderRadius = '6px';
          box.style.display = 'flex';
          box.style.alignItems = 'center';
          box.style.justifyContent = 'center';
          box.style.fontSize = '14px';
          box.style.fontWeight = 'bold';
          box.style.cursor = 'pointer';
          box.dataset.index = String(i);
          box.onclick = () => {
            if ((window as any)._selectedIndex === undefined) {
              (window as any)._selectedIndex = i;
              box.style.outline = '2px solid #333';
            } else {
              const j = (window as any)._selectedIndex;
              [current[i], current[j]] = [current[j], current[i]];
              (window as any)._selectedIndex = undefined;
              renderRow();
            }
          };
          row.appendChild(box);
        });
      }

      const btnRow = document.createElement('div');
      btnRow.style.display = 'flex';
      btnRow.style.gap = '6px';
      const retro = document.createElement('button');
      retro.textContent = '逆行';
      retro.className = 'btn secondary';
      retro.onclick = () => {
        current.reverse();
        renderRow();
      };
      const invert = document.createElement('button');
      invert.textContent = '倒影';
      invert.className = 'btn secondary';
      invert.onclick = () => {
        current = current.map((n) => 7 - n).reverse();
        renderRow();
      };
      const reset = document.createElement('button');
      reset.textContent = '重置';
      reset.className = 'btn secondary';
      reset.onclick = () => {
        current = [...notes];
        renderRow();
      };
      btnRow.appendChild(retro);
      btnRow.appendChild(invert);
      btnRow.appendChild(reset);
      wrap.appendChild(btnRow);
      container.appendChild(wrap);
      renderRow();
    },
  },
  6: {
    title: '递归：欧几里得节奏树',
    render(container) {
      clear(container);
      const info = document.createElement('div');
      info.style.fontSize = '12px';
      info.style.color = '#555';
      info.style.marginBottom = '6px';
      info.textContent = 'E(3,8): 把 3 个脉冲均匀放进 8 步';
      container.appendChild(info);
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.gap = '4px';
      row.style.justifyContent = 'center';
      container.appendChild(row);

      let k = 3,
        n = 8;
      function euclidean(kVal: number, nVal: number): number[] {
        const res = new Array(nVal).fill(0);
        let idx = 0;
        for (let i = 0; i < kVal; i++) {
          res[idx] = 1;
          idx += nVal / kVal;
        }
        // 用更标准的 Bresenham 算法
        const pattern: number[] = [];
        for (let i = 0; i < nVal; i++) pattern.push(0);
        let err = 0;
        for (let i = 0; i < nVal; i++) {
          err += kVal;
          if (err >= nVal) {
            pattern[i] = 1;
            err -= nVal;
          }
        }
        return pattern;
      }

      function render() {
        row.innerHTML = '';
        const pattern = euclidean(k, n);
        pattern.forEach((v, i) => {
          const cell = document.createElement('div');
          cell.style.width = '28px';
          cell.style.height = '28px';
          cell.style.background = v ? '#7BC67E' : '#e0e0e0';
          cell.style.borderRadius = '4px';
          cell.style.display = 'flex';
          cell.style.alignItems = 'center';
          cell.style.justifyContent = 'center';
          cell.style.fontSize = '12px';
          cell.style.color = v ? '#fff' : '#999';
          cell.textContent = v ? '●' : String(i + 1);
          row.appendChild(cell);
        });
        info.textContent = `E(${k},${n}): 把 ${k} 个脉冲均匀放进 ${n} 步`;
      }

      const sK = createSlider(1, 7, k, '脉冲数', (v) => {
        k = v;
        render();
      });
      const sN = createSlider(2, 16, n, '总步数', (v) => {
        n = v;
        render();
      });
      container.appendChild((sK as any)._wrap);
      container.appendChild((sN as any)._wrap);
      render();
    },
  },
  7: {
    title: '概率：马尔可夫转移矩阵',
    render(container) {
      clear(container);
      const states = ['C', 'D', 'E'];
      let matrix = [
        [0.5, 0.3, 0.2],
        [0.2, 0.5, 0.3],
        [0.3, 0.2, 0.5],
      ];
      const wrap = document.createElement('div');
      wrap.style.display = 'flex';
      wrap.style.flexDirection = 'column';
      wrap.style.alignItems = 'center';
      const svgEl = svg('svg', { width: 260, height: 180, viewBox: '0 0 260 180' });
      wrap.appendChild(svgEl);
      container.appendChild(wrap);

      function draw() {
        svgEl.innerHTML = '';
        const pos = [
          [60, 40],
          [200, 40],
          [130, 140],
        ];
        states.forEach((s, i) => {
          const [x, y] = pos[i];
          const c = svg('circle', { cx: x, cy: y, r: 22, fill: '#9B5DE5' });
          const t = svg('text', { x, y: y + 5, 'text-anchor': 'middle', fill: '#fff', 'font-size': 14 });
          t.textContent = s;
          svgEl.appendChild(c);
          svgEl.appendChild(t);
        });
        // 边
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            if (matrix[i][j] > 0.05) {
              const [x1, y1] = pos[i];
              const [x2, y2] = pos[j];
              const line = svg('line', {
                x1,
                y1,
                x2,
                y2,
                stroke: '#C77DFF',
                'stroke-width': Math.max(1, matrix[i][j] * 6),
                opacity: 0.7,
              });
              svgEl.insertBefore(line, svgEl.firstChild);
            }
          }
        }
      }

      const note = document.createElement('div');
      note.style.fontSize = '12px';
      note.style.color = '#666';
      note.style.marginTop = '6px';
      note.textContent = '边粗细 = 转移概率';
      wrap.appendChild(note);
      draw();
    },
  },
  8: {
    title: '图论：和弦进行路径',
    render(container) {
      clear(container);
      const nodes = [
        { id: 'I', x: 60, y: 50 },
        { id: 'IV', x: 180, y: 50 },
        { id: 'V', x: 180, y: 130 },
        { id: 'vi', x: 60, y: 130 },
      ];
      const edges = [
        ['I', 'IV'],
        ['IV', 'V'],
        ['V', 'vi'],
        ['vi', 'I'],
        ['I', 'V'],
        ['IV', 'vi'],
      ];
      const w = 240,
        h = 180;
      const svgEl = svg('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}` });
      container.appendChild(svgEl);

      edges.forEach(([a, b]) => {
        const n1 = nodes.find((n) => n.id === a)!;
        const n2 = nodes.find((n) => n.id === b)!;
        const line = svg('line', { x1: n1.x, y1: n1.y, x2: n2.x, y2: n2.y, stroke: '#ccc', 'stroke-width': 2 });
        svgEl.appendChild(line);
      });
      nodes.forEach((n) => {
        const c = svg('circle', { cx: n.x, cy: n.y, r: 18, fill: '#4ECDC4' });
        const t = svg('text', { x: n.x, y: n.y + 5, 'text-anchor': 'middle', fill: '#fff', 'font-size': 12 });
        t.textContent = n.id;
        svgEl.appendChild(c);
        svgEl.appendChild(t);
      });

      const info = document.createElement('div');
      info.style.fontSize = '12px';
      info.style.color = '#555';
      info.style.marginTop = '6px';
      info.textContent = '节点=和弦，边=可进行的连接。选择一条路径即创作一段和弦进行。';
      container.appendChild(info);
    },
  },
};
