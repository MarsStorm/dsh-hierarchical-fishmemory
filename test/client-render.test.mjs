// 渲染冒烟测试：把合并后的客户端 bundle 真正跑一遍。
//
// 为什么需要它：2026-10-31 设置页白屏过一次 —— 组件里引用了一个没定义的变量，
// 渲染时抛 ReferenceError，整张设置页跟着挂掉。语法检查、单测都查不出来，只有
// 「真的渲染一次」才能发现。这里用最小 React 桩：函数组件会被调用、类组件会被
// 实例化、错误边界会被模拟。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = new URL('../dist/client.js', import.meta.url);

function makeReact() {
  const hookStore = new WeakMap();
  let current = null;
  const slot = (init) => {
    const i = current.index += 1;
    if (current.queue.length < i) current.queue.push(typeof init === 'function' ? init() : init);
    return [current.queue[i - 1], (v) => { current.queue[i - 1] = typeof v === 'function' ? v(current.queue[i - 1]) : v; }];
  };
  const react = {
    createElement: (type, props, ...children) => {
      const flat = children.flat();
      const merged = Object.assign({}, props || {});
      if (flat.length) merged.children = flat.length === 1 ? flat[0] : flat;
      return { type, props: merged, children: flat };
    },
    useState: slot,
    useEffect: () => {},
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
    useRef: (v) => ({ current: v }),
    Component: class {
      constructor(props) { this.props = props; this.state = {}; }
      setState(upd) { this.state = Object.assign({}, this.state, typeof upd === 'function' ? upd(this.state) : upd); }
    },
    Fragment: 'fragment',
  };
  return { react, hookStore, setCurrent: (c) => { current = c; } };
}

test('合并后的设置页能把整棵树渲染出来（含云端表单）', () => {
  const { react, hookStore, setCurrent } = makeReact();
  let plugin = null;
  const win = { __ModuleLoader__: { load: ({ factory }) => { plugin = factory((name) => (name === 'react' ? react : {})); } } };
  new Function('window', 'fetch', readFileSync(file, 'utf8'))(win, async () => ({
    json: async () => ({ ok: true, enabled: true, configured: false, url: '', user: '', passwordSet: false, dir: '', keep: 10, auto: false }),
  }));

  const scope = {
    getSnapshot: () => ({ status: 'ready', value: { cards: { 某个助手: '你是某个助手' }, active: '某个助手', memory: {}, workspaceList: [], workspaces: {} } }),
    subscribe: () => () => {},
    write: () => Promise.resolve(),
    load: () => Promise.resolve(),
  };
  const registered = [];
  const ctx = {
    locale: { bind: () => (k) => k, register: () => {}, subscribe: () => () => {} },
    effect: () => {},
    slots: {
      inject: (name, fn) => { registered.push(fn()); },
      register: (spec, component) => { registered.push({ spec, component }); return () => {}; },
    },
    configForms: { get: () => scope },
  };
  plugin.apply(ctx);

  const section = registered.find((r) => r && r.spec && r.spec.name === 'settings.section');
  assert.ok(section, '应当注册 settings.section');
  assert.equal(typeof section.component, 'function');

  let nodes = 0;
  const seen = new Set();
  const render = (node) => {
    if (node === null || node === undefined || node === false) return;
    if (Array.isArray(node)) { node.forEach(render); return; }
    if (typeof node !== 'object') { nodes += 1; return; }
    const type = node.type;
    if (typeof type === 'function') {
      if (type.name) seen.add(type.name);
      const isClass = type.prototype && type.prototype.render;
      if (isClass) {
        const inst = new type(node.props);
        try {
          render(inst.render());
        } catch (err) {
          if (!type.getDerivedStateFromError) throw err;
          inst.state = type.getDerivedStateFromError(err);
          render(inst.render());
        }
        return;
      }
      if (!hookStore.has(type)) hookStore.set(type, { queue: [], index: 0 });
      const hooks = hookStore.get(type);
      hooks.index = 0;
      setCurrent(hooks);
      render(type(node.props));
      return;
    }
    nodes += 1;
    (node.children || []).forEach(render);
  };

  render(react.createElement(section.component, { scope, t: (k) => k, locale: ctx.locale }));
  assert.ok(nodes > 20, `渲染出的节点数应当可观，实际 ${nodes}`);
  assert.ok(seen.has('WebdavGroup'), '云端备份表单应当被渲染');
});
