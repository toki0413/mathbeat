import { describe, it, expect, beforeEach } from 'vitest';
import {
  CONCEPT_NODES,
  CONCEPT_EDGES,
  renderConceptMap,
  getConceptConnections,
  type ConceptNode,
  type ConceptEdge,
} from './concept-map';

describe('concept-map - 数据完整性', () => {
  it('CONCEPT_NODES 包含 8 个节点', () => {
    expect(CONCEPT_NODES).toHaveLength(8);
  });

  it('CONCEPT_EDGES 包含 10 条边', () => {
    expect(CONCEPT_EDGES).toHaveLength(10);
  });

  it('每个节点字段完整：id/name/emoji/x/y/color/desc', () => {
    for (const node of CONCEPT_NODES) {
      expect(typeof node.id).toBe('string');
      expect(node.id.length).toBeGreaterThan(0);
      expect(typeof node.name).toBe('string');
      expect(node.name.length).toBeGreaterThan(0);
      expect(typeof node.emoji).toBe('string');
      expect(typeof node.x).toBe('number');
      expect(typeof node.y).toBe('number');
      expect(typeof node.color).toBe('string');
      expect(node.color.startsWith('#')).toBe(true);
      expect(typeof node.desc).toBe('string');
      expect(node.desc.length).toBeGreaterThan(0);
    }
  });

  it('节点 id 唯一', () => {
    const ids = CONCEPT_NODES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('每条边的 from/to 都指向已存在的节点', () => {
    const ids = new Set(CONCEPT_NODES.map((n) => n.id));
    for (const edge of CONCEPT_EDGES) {
      expect(ids.has(edge.from)).toBe(true);
      expect(ids.has(edge.to)).toBe(true);
      expect(edge.from).not.toBe(edge.to);
      expect(typeof edge.label).toBe('string');
      expect(edge.label.length).toBeGreaterThan(0);
      expect(edge.strength).toBeGreaterThanOrEqual(1);
      expect(edge.strength).toBeLessThanOrEqual(3);
    }
  });
});

describe('concept-map - renderConceptMap', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('渲染概念图不抛错', () => {
    expect(() => renderConceptMap(container)).not.toThrow();
  });

  it('渲染后容器包含一个 svg 元素', () => {
    renderConceptMap(container);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 520 520');
  });

  it('渲染的边数量等于 CONCEPT_EDGES.length（每条边一个 path + 一个 text）', () => {
    renderConceptMap(container);
    const paths = container.querySelectorAll('svg > path');
    expect(paths.length).toBe(CONCEPT_EDGES.length);
  });

  it('渲染的节点数量等于 CONCEPT_NODES.length（每个节点一个 g 包含 circle）', () => {
    renderConceptMap(container);
    const groups = container.querySelectorAll('svg > g');
    // 第一个 g 是 defs？实际 defs 用 createElementNS 但 tag 是 'defs'。
    // 这里只数 g 元素，应等于节点数
    expect(groups.length).toBe(CONCEPT_NODES.length);
  });

  it('每个节点 g 中包含 circle、emoji text 和 name text', () => {
    renderConceptMap(container);
    const groups = container.querySelectorAll('svg > g');
    groups.forEach((g) => {
      const circle = g.querySelector('circle');
      const texts = g.querySelectorAll('text');
      expect(circle).not.toBeNull();
      expect(texts.length).toBeGreaterThanOrEqual(2); // emoji + name
    });
  });

  it('未传 onNodeClick 时节点 cursor 为 default', () => {
    renderConceptMap(container);
    const g = container.querySelector('svg > g') as SVGGElement;
    expect((g.style.cursor as string) || '').toBe('default');
  });

  it('传入 onNodeClick 时节点 cursor 为 pointer', () => {
    renderConceptMap(container, () => {});
    const g = container.querySelector('svg > g') as SVGGElement;
    expect((g.style.cursor as string) || '').toBe('pointer');
  });

  it('点击节点触发 onNodeClick 回调并传入节点 id', () => {
    const clicked: string[] = [];
    renderConceptMap(container, (id) => clicked.push(id));
    const groups = container.querySelectorAll('svg > g');
    // 点击前 3 个节点
    for (let i = 0; i < 3; i++) {
      (groups[i] as SVGGElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    expect(clicked).toHaveLength(3);
    // 点击的应该是前 3 个节点对应的 id
    expect(CONCEPT_NODES.map((n) => n.id).slice(0, 3)).toEqual(expect.arrayContaining(clicked));
  });

  it('renderConceptMap 在已渲染的容器上重复调用不会抛错且会清空旧内容', () => {
    renderConceptMap(container);
    const svgCount1 = container.querySelectorAll('svg').length;
    expect(svgCount1).toBe(1);
    // 再渲染一次，应当先清空 innerHTML，再插入新 svg
    expect(() => renderConceptMap(container)).not.toThrow();
    const svgCount2 = container.querySelectorAll('svg').length;
    expect(svgCount2).toBe(1);
  });
});

describe('concept-map - getConceptConnections', () => {
  it('存在的节点 id 返回 {node, edges} 结构', () => {
    const result = getConceptConnections('lcm');
    expect(result).not.toBeNull();
    expect(result?.node.id).toBe('lcm');
    expect(Array.isArray(result?.edges)).toBe(true);
    expect((result?.edges.length || 0)).toBeGreaterThan(0);
  });

  it('返回的 edges 都与该节点相关（from 或 to 等于该 id）', () => {
    const result = getConceptConnections('lcm');
    expect(result).not.toBeNull();
    for (const e of result!.edges) {
      expect(e.from === 'lcm' || e.to === 'lcm').toBe(true);
    }
  });

  it('不存在的节点 id 返回 null', () => {
    expect(getConceptConnections('non-existent-id')).toBeNull();
  });

  it('每个节点的连接数与 CONCEPT_EDGES 中相关边数一致', () => {
    for (const node of CONCEPT_NODES) {
      const result = getConceptConnections(node.id);
      const expected = CONCEPT_EDGES.filter((e) => e.from === node.id || e.to === node.id);
      expect(result?.edges).toHaveLength(expected.length);
    }
  });

  it('返回的对象不修改原始数据', () => {
    const result = getConceptConnections('lcm');
    // 修改返回的数组不应影响原始 CONCEPT_EDGES
    result!.edges.push({ from: 'fake', to: 'fake', label: 'fake', strength: 1 });
    const stillOriginal = CONCEPT_EDGES.filter((e) => e.from === 'fake' || e.to === 'fake');
    expect(stillOriginal).toHaveLength(0);
  });
});
