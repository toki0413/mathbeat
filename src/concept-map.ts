/**
 * 概念互联图谱
 * 展示 MathBeat 八个数学概念之间的联系，
 * 让玩家理解数学不是孤立的知识点，而是一个有机网络。
 */

export interface ConceptNode {
  id: string;
  name: string;
  emoji: string;
  x: number;
  y: number;
  color: string;
  desc: string;
}

export interface ConceptEdge {
  from: string;
  to: string;
  label: string;
  strength: number; // 1-3
}

export const CONCEPT_NODES: ConceptNode[] = [
  {
    id: 'lcm',
    name: 'LCM / GCD',
    emoji: '🥁',
    x: 260,
    y: 90,
    color: '#FF8C42',
    desc: '最小公倍数与最大公约数：复节奏的数学基础',
  },
  {
    id: 'permutation',
    name: '排列',
    emoji: '🎯',
    x: 380,
    y: 140,
    color: '#FFD166',
    desc: '音符重排、逆行、倒影与循环移位',
  },
  {
    id: 'symmetry',
    name: '对称群',
    emoji: '🎵',
    x: 430,
    y: 260,
    color: '#E8587A',
    desc: '旋转与倒影：和声与旋律的群论描述',
  },
  { id: 'ratio', name: '频率比', emoji: '🌊', x: 380, y: 380, color: '#7C6BFF', desc: '整数频率比塑造协和音程' },
  {
    id: 'graph',
    name: '图论',
    emoji: '🕸️',
    x: 260,
    y: 430,
    color: '#4ECDC4',
    desc: '和弦作为节点，连接作为边，路径即进行',
  },
  {
    id: 'recursion',
    name: '递归',
    emoji: '🔨',
    x: 140,
    y: 380,
    color: '#7BC67E',
    desc: '欧几里得算法与斐波那契的自相似',
  },
  { id: 'crt', name: 'CRT', emoji: '🔄', x: 90, y: 260, color: '#4ECDC4', desc: '中国剩余定理：多周期对齐的密码' },
  {
    id: 'probability',
    name: '概率',
    emoji: '🎲',
    x: 140,
    y: 140,
    color: '#9B5DE5',
    desc: '伯努利试验与马尔可夫链驱动不确定音乐',
  },
];

export const CONCEPT_EDGES: ConceptEdge[] = [
  { from: 'lcm', to: 'crt', label: '周期对齐', strength: 3 },
  { from: 'lcm', to: 'recursion', label: '欧几里得算法', strength: 2 },
  { from: 'symmetry', to: 'permutation', label: '群作用', strength: 3 },
  { from: 'ratio', to: 'graph', label: '音程距离', strength: 2 },
  { from: 'crt', to: 'probability', label: '模运算+随机', strength: 1 },
  { from: 'permutation', to: 'recursion', label: '递归生成序列', strength: 2 },
  { from: 'probability', to: 'graph', label: '随机游走', strength: 2 },
  { from: 'recursion', to: 'graph', label: '分形网络', strength: 1 },
  { from: 'ratio', to: 'symmetry', label: '协和=对称', strength: 2 },
  { from: 'lcm', to: 'permutation', label: '节奏置换', strength: 1 },
];

export function renderConceptMap(container: HTMLElement, onNodeClick?: (id: string) => void) {
  container.innerHTML = '';
  const w = 520,
    h = 520;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.style.fontFamily = 'Arial, sans-serif';
  svg.style.overflow = 'visible';

  // 柔和背景装饰
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bg.setAttribute('cx', '260');
  bg.setAttribute('cy', '260');
  bg.setAttribute('r', '220');
  bg.setAttribute('fill', 'rgba(0,0,0,0.02)');
  svg.appendChild(bg);

  // 节点阴影滤镜
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML =
    '<filter id="cmShadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="rgba(0,0,0,0.18)"/></filter>';
  svg.appendChild(defs);

  const edgeEls: { path: SVGPathElement; text: SVGTextElement; from: string; to: string }[] = [];
  const nodeEls: Record<string, { group: SVGGElement; circle: SVGCircleElement; label: SVGTextElement }> = {};

  // 边：使用二次贝塞尔曲线，避免直线重叠
  CONCEPT_EDGES.forEach((edge, idx) => {
    const n1 = CONCEPT_NODES.find((n) => n.id === edge.from)!;
    const n2 = CONCEPT_NODES.find((n) => n.id === edge.to)!;
    const mx = (n1.x + n2.x) / 2;
    const my = (n1.y + n2.y) / 2;
    const dx = n2.x - n1.x;
    const dy = n2.y - n1.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    // 相邻边交替弯曲方向，减少视觉拥挤
    const dir = idx % 2 === 0 ? 1 : -1;
    const offset = 18 * dir;
    const cx = mx + (-dy / len) * offset;
    const cy = my + (dx / len) * offset;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M${n1.x},${n1.y} Q${cx},${cy} ${n2.x},${n2.y}`);
    path.setAttribute('stroke', '#d0d0d0');
    path.setAttribute('stroke-width', String(edge.strength + 1));
    path.dataset.width = String(edge.strength + 1);
    path.setAttribute('stroke-dasharray', edge.strength === 1 ? '5 4' : 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('fill', 'none');
    path.style.transition = 'stroke 0.2s, stroke-width 0.2s, opacity 0.2s';
    svg.appendChild(path);

    // 标签放在贝塞尔曲线中点
    const tx = (n1.x + 2 * cx + n2.x) / 4;
    const ty = (n1.y + 2 * cy + n2.y) / 4;
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', String(tx));
    text.setAttribute('y', String(ty - 6));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', '#777');
    text.setAttribute('font-size', '14');
    text.setAttribute('font-weight', 'bold');
    text.setAttribute('font-family', 'Arial, sans-serif');
    text.setAttribute('paint-order', 'stroke');
    text.setAttribute('stroke', '#fff');
    text.setAttribute('stroke-width', '3');
    text.setAttribute('stroke-linejoin', 'round');
    text.setAttribute('style', 'pointer-events:none');
    text.style.transition = 'fill 0.2s, opacity 0.2s';
    text.textContent = edge.label;
    svg.appendChild(text);

    edgeEls.push({ path, text, from: edge.from, to: edge.to });
  });

  // 节点
  CONCEPT_NODES.forEach((node) => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.style.cursor = onNodeClick ? 'pointer' : 'default';
    g.style.transition = 'transform 0.2s ease';
    g.style.transformBox = 'fill-box';
    g.style.transformOrigin = 'center';

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', String(node.x));
    circle.setAttribute('cy', String(node.y));
    circle.setAttribute('r', '42');
    circle.setAttribute('fill', node.color);
    circle.setAttribute('stroke', '#fff');
    circle.setAttribute('stroke-width', '4');
    circle.setAttribute('filter', 'url(#cmShadow)');
    circle.style.transition = 'r 0.2s, stroke-width 0.2s';

    const emoji = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    emoji.setAttribute('x', String(node.x));
    emoji.setAttribute('y', String(node.y - 2));
    emoji.setAttribute('text-anchor', 'middle');
    emoji.setAttribute('font-size', '22');
    emoji.setAttribute('font-family', 'Arial, sans-serif');
    emoji.setAttribute('style', 'pointer-events:none');
    emoji.textContent = node.emoji;

    const name = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    name.setAttribute('x', String(node.x));
    name.setAttribute('y', String(node.y + 22));
    name.setAttribute('text-anchor', 'middle');
    name.setAttribute('fill', '#fff');
    name.setAttribute('font-size', '16');
    name.setAttribute('font-weight', 'bold');
    name.setAttribute('font-family', 'Arial, sans-serif');
    name.setAttribute('paint-order', 'stroke');
    name.setAttribute('stroke', 'rgba(0,0,0,0.3)');
    name.setAttribute('stroke-width', '2');
    name.setAttribute('stroke-linejoin', 'round');
    name.setAttribute('style', 'pointer-events:none');
    name.textContent = node.name;

    g.appendChild(circle);
    g.appendChild(emoji);
    g.appendChild(name);
    svg.appendChild(g);

    nodeEls[node.id] = { group: g, circle, label: name };

    if (onNodeClick) {
      g.addEventListener('click', () => onNodeClick(node.id));
    }

    // 悬停高亮关联边与相邻节点
    g.addEventListener('mouseenter', () => {
      g.style.transform = 'scale(1.08)';
      circle.setAttribute('stroke-width', '6');
      const related = new Set<string>();
      edgeEls.forEach((e) => {
        const active = e.from === node.id || e.to === node.id;
        if (active) {
          e.path.setAttribute('stroke', node.color);
          e.path.setAttribute('stroke-width', '4');
          e.path.setAttribute('opacity', '1');
          e.text.setAttribute('fill', node.color);
          e.text.setAttribute('opacity', '1');
          related.add(e.from === node.id ? e.to : e.from);
        } else {
          e.path.setAttribute('opacity', '0.2');
          e.text.setAttribute('opacity', '0.3');
        }
      });
      related.forEach((id) => {
        const n = nodeEls[id];
        if (n) n.group.style.transform = 'scale(1.05)';
      });
    });

    g.addEventListener('mouseleave', () => {
      g.style.transform = 'scale(1)';
      circle.setAttribute('stroke-width', '4');
      edgeEls.forEach((e) => {
        e.path.setAttribute('stroke', '#d0d0d0');
        e.path.setAttribute('stroke-width', String(e.path.dataset.width || '2'));
        e.path.setAttribute('opacity', '1');
        e.text.setAttribute('fill', '#777');
        e.text.setAttribute('opacity', '1');
      });
      Object.values(nodeEls).forEach((n) => {
        n.group.style.transform = 'scale(1)';
      });
    });
  });

  container.appendChild(svg);
}

export function getConceptConnections(id: string): { node: ConceptNode; edges: ConceptEdge[] } | null {
  const node = CONCEPT_NODES.find((n) => n.id === id);
  if (!node) return null;
  const edges = CONCEPT_EDGES.filter((e) => e.from === id || e.to === id);
  return { node, edges };
}
