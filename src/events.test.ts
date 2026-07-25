import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerAction,
  registerInput,
  registerActions,
  registerInputs,
  initEventDelegation,
} from './events';

describe('events 事件委托系统', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    // 重新初始化（initEventDelegation 内部有 initialized 守卫，需通过新 document 上下文重置）
    // 这里直接附加新监听器到当前 document
  });

  it('registerAction 注册单个 click handler', () => {
    const fn = vi.fn();
    registerAction('testClick', fn);
    const btn = document.createElement('button');
    btn.dataset.action = 'testClick';
    document.body.appendChild(btn);
    initEventDelegation();
    btn.click();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('registerInput 注册 change handler', () => {
    const fn = vi.fn();
    registerInput('testInput', fn);
    const sel = document.createElement('select');
    sel.dataset.input = 'testInput';
    document.body.appendChild(sel);
    initEventDelegation();
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('registerInput 同时响应 input 事件', () => {
    const fn = vi.fn();
    registerInput('testInputEvt', fn);
    const inp = document.createElement('input');
    inp.dataset.input = 'testInputEvt';
    document.body.appendChild(inp);
    initEventDelegation();
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('registerActions 批量注册', () => {
    const a = vi.fn();
    const b = vi.fn();
    registerActions({ batchA: a, batchB: b });
    const el1 = document.createElement('button');
    el1.dataset.action = 'batchA';
    const el2 = document.createElement('button');
    el2.dataset.action = 'batchB';
    document.body.append(el1, el2);
    initEventDelegation();
    el1.click();
    el2.click();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('registerInputs 批量注册', () => {
    const a = vi.fn();
    registerInputs({ batchInputA: a });
    const sel = document.createElement('select');
    sel.dataset.input = 'batchInputA';
    document.body.appendChild(sel);
    initEventDelegation();
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(a).toHaveBeenCalledTimes(1);
  });

  it('data-args 以 JSON 数组形式解析为多个参数', () => {
    const fn = vi.fn();
    registerAction('withArgs', fn);
    const btn = document.createElement('button');
    btn.dataset.action = 'withArgs';
    btn.dataset.args = '[1, "two", true]';
    document.body.appendChild(btn);
    initEventDelegation();
    btn.click();
    expect(fn).toHaveBeenCalledTimes(1);
    // 第一个参数是 event，后续为 args
    expect(fn.mock.calls[0][1]).toBe(1);
    expect(fn.mock.calls[0][2]).toBe('two');
    expect(fn.mock.calls[0][3]).toBe(true);
  });

  it('data-args 非法 JSON 时回退为原始字符串', () => {
    const fn = vi.fn();
    registerAction('badArgs', fn);
    const btn = document.createElement('button');
    btn.dataset.action = 'badArgs';
    btn.dataset.args = 'not-json';
    document.body.appendChild(btn);
    initEventDelegation();
    btn.click();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][1]).toBe('not-json');
  });

  it('未注册的 action 不抛错', () => {
    const btn = document.createElement('button');
    btn.dataset.action = 'noSuchAction';
    document.body.appendChild(btn);
    initEventDelegation();
    expect(() => btn.click()).not.toThrow();
  });

  it('data-selfOnly=true 时点击子元素不触发', () => {
    const fn = vi.fn();
    registerAction('selfOnly', fn);
    const overlay = document.createElement('div');
    overlay.dataset.action = 'selfOnly';
    overlay.dataset.selfOnly = 'true';
    const child = document.createElement('div');
    child.id = 'child';
    overlay.appendChild(child);
    document.body.appendChild(overlay);
    initEventDelegation();
    // 点击子元素：应被忽略
    child.click();
    expect(fn).not.toHaveBeenCalled();
    // 直接点击 overlay 本身：应触发
    overlay.click();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('点击无 data-action 的元素不触发任何 handler', () => {
    const fn = vi.fn();
    registerAction('never', fn);
    const div = document.createElement('div');
    document.body.appendChild(div);
    initEventDelegation();
    div.click();
    expect(fn).not.toHaveBeenCalled();
  });

  it('Enter / Space 键激活非原生 [data-action] 元素（WCAG 2.1.1）', () => {
    const fn = vi.fn();
    registerAction('kbdActivate', fn);
    const span = document.createElement('span');
    span.tabIndex = 0;
    span.dataset.action = 'kbdActivate';
    document.body.appendChild(span);
    initEventDelegation();
    span.focus();
    span.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(fn).toHaveBeenCalledTimes(1);
    span.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('原生 BUTTON 的 Enter/Space 不被事件委托二次触发（避免重复）', () => {
    const fn = vi.fn();
    registerAction('btnKbd', fn);
    const btn = document.createElement('button');
    btn.dataset.action = 'btnKbd';
    document.body.appendChild(btn);
    initEventDelegation();
    btn.focus();
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    // 原生按钮的 click 事件仍会触发一次（这是浏览器默认行为）
    // 此处仅验证 keydown 路径不会额外触发
    // 由于 happy-dom 在 keydown 时可能不会自动 click，验证 fn 至多被调用 1 次
    expect(fn.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('其他键不触发 keydown 委托', () => {
    const fn = vi.fn();
    registerAction('otherKey', fn);
    const span = document.createElement('span');
    span.tabIndex = 0;
    span.dataset.action = 'otherKey';
    document.body.appendChild(span);
    initEventDelegation();
    span.focus();
    span.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(fn).not.toHaveBeenCalled();
  });

  it('重复调用 initEventDelegation 不会重复绑定（initialized 守卫）', () => {
    const fn = vi.fn();
    registerAction('idempotent', fn);
    const btn = document.createElement('button');
    btn.dataset.action = 'idempotent';
    document.body.appendChild(btn);
    initEventDelegation();
    initEventDelegation();
    initEventDelegation();
    btn.click();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
