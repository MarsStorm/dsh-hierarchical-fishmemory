// 渲染冒烟测试：把合并后的客户端 bundle 真正跑一遍。
//
// 为什么需要它：2026-10-31 设置页白屏过一次 —— 组件里引用了一个没定义的变量，
// 渲染时抛 ReferenceError，整张设置页跟着挂掉。语法检查、单测都查不出来，只有
// 「真的渲染一次」才能发现。这里用最小 React 桩：函数组件会被调用、类组件会被
// 实例化、错误边界会被模拟；effect 会真的跑一遍，然后把状态带到下一轮渲染 ——
// 否则所有面板都停在「翻档案…」那一屏，等于没测。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = new URL('../dist/client.js', import.meta.url);
const source = readFileSync(file, 'utf8');

function makeReact() {
  const hookStore = new WeakMap();
  let current = null;
  const pending = [];
  const slot = (init) => {
    // 关键：把 hooks 对象**抓在闭包里**。setState 是在渲染结束之后才被 effect
    // 调用的，那时模块级 `current` 早就指向别的组件了 —— 直接引用它，状态会
    // 写到别人的队列里，重渲染时看起来就是「effect 没生效」。
    const hooks = current;
    const i = (hooks.index += 1);
    if (hooks.queue.length < i) hooks.queue.push(typeof init === 'function' ? init() : init);
    return [
      hooks.queue[i - 1],
      (v) => {
        hooks.queue[i - 1] = typeof v === 'function' ? v(hooks.queue[i - 1]) : v;
      },
    ];
  };
  const react = {
    createElement: (type, props, ...children) => {
      const flat = children.flat();
      const merged = Object.assign({}, props || {});
      if (flat.length) merged.children = flat.length === 1 ? flat[0] : flat;
      return { type, props: merged, children: flat };
    },
    useState: slot,
    useEffect: (fn) => {
      pending.push(fn);
    },
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
    useRef: (v) => ({ current: v }),
    Component: class {
      constructor(props) {
        this.props = props;
        this.state = {};
      }
      setState(upd) {
        this.state = Object.assign({}, this.state, typeof upd === 'function' ? upd(this.state) : upd);
      }
    },
    Fragment: 'fragment',
  };
  return { react, hookStore, setCurrent: (c) => (current = c), pending };
}

/** 把 bundle 跑一遍，拿到**两个**半边注册的插件（主面板 + 设置页）。 */
function boot(fetchImpl) {
  const harness = makeReact();
  const plugins = {};
  const win = {
    __ModuleLoader__: {
      load: ({ id, factory }) => {
        plugins[id] = factory((name) => (name === 'react' ? harness.react : {}));
      },
    },
  };
  new Function('window', 'fetch', source)(win, fetchImpl);
  return { plugins, harness };
}

/**
 * 渲染一棵树，最多跑三轮：第一轮拿初值、effect 真的执行、等微任务落定；
 * 后两轮带着新状态重渲染。三轮下来还是初值，就当它没有异步数据。
 */
async function renderTree(root, harness) {
  const stats = { nodes: 0, seen: new Set(), texts: new Set(), error: null };
  const render = (node) => {
    if (node === null || node === undefined || node === false) return;
    if (Array.isArray(node)) {
      node.forEach(render);
      return;
    }
    if (typeof node !== 'object') {
      stats.nodes += 1;
      // 字符串节点收一下 —— 只数节点数看不出"某一块其实没渲染出来"
      stats.texts.add(String(node));
      return;
    }
    const type = node.type;
    if (typeof type === 'function') {
      if (type.name) stats.seen.add(type.name);
      const isClass = type.prototype && type.prototype.render;
      try {
        if (isClass) {
          const inst = new type(node.props);
          render(inst.render());
        } else {
          if (!harness.hookStore.has(type)) harness.hookStore.set(type, { queue: [], index: 0 });
          const hooks = harness.hookStore.get(type);
          hooks.index = 0;
          harness.setCurrent(hooks);
          render(type(node.props));
        }
      } catch (err) {
        if (!type.getDerivedStateFromError) throw err;
        // 错误边界：把异常记下来，继续渲染它兜底的那一屏
        stats.error = err;
        const inst = new type(node.props);
        inst.state = type.getDerivedStateFromError(err);
        render(inst.render());
      }
      return;
    }
    stats.nodes += 1;
    (node.children || []).forEach(render);
  };

  for (let pass = 0; pass < 3; pass += 1) {
    stats.nodes = 0;
    stats.seen = new Set();
    stats.texts = new Set();
    stats.error = null;
    render(root);
    const effects = harness.pending.splice(0, harness.pending.length);
    if (effects.length === 0) break;
    for (const fn of effects) fn();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return stats;
}

/** 面板要的所有接口：一份够用的假数据。 */
function panelFetch(url) {
  const json = (data) => Promise.resolve({ ok: true, status: 200, json: async () => data });
  const target = String(url);
  if (target.endsWith('/state')) {
    return json({
      ok: true,
      count: 2,
      diary: [
        { id: 'e1', text: '第一件事', created_at: '2026-11-02T20:11:00.000Z' },
        { id: 'e2', text: '第二件事', created_at: '2026-11-02T21:11:00.000Z' },
      ],
      facts: { days: 3, nickname: '小鱼' },
      // 面板顶上那两块（2026-11-04 加）。不放进 fixture 的话，
      // 这两条渲染分支在本来最该抓到它们的那个测试里等于没跑。
      feelings: {
        heading: '2026-11-03',
        sub: '夜里 · 那句来历',
        body: '市场卡片上那段简介，原来是我写的。',
        bytes: 11822,
      },
      recalled: [{ id: 'e1', text: '第一件事', count: 2 }],
      trash: 1,
    });
  }
  // 情感日记：给一段**真有日期标题**的正文。只给 '# 鱼的日子' 的话，
  // 本子页那道心情热力格的解析分支在冒烟测试里等于没跑（全空也能"渲染成功"）。
  if (target.endsWith('/feelings')) {
    // 日期用**今天**（他的钟点）：写死某一天的话，这道断言过一阵就会
    // 因为那天滑出 13 周窗口而莫名其妙地失败。
    const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const text = [
      '# 鱼的日子',
      '',
      `## ${today}`,
      '',
      '### 夜里 · 卸掉一个插件',
      '',
      '有点舍不得它。',
      '',
    ].join('\n');
    return json({ ok: true, text, chars: [...text].length });
  }
  if (target.endsWith('/notes')) {
    return json({ ok: true, notes: [{ key: 'handnote', file: '手记.md', label: '人格手记', hint: '每轮注入', text: '- 一句' }] });
  }
  if (target.includes('/stats')) {
    return json({
      ok: true,
      memory: { scopes: [{ scope: '未央的小鱼', coreChars: 10, coreTokens: 5, topics: [] }] },
      diary: { entries: 2, files: 1, last7Days: 2 },
      feelings: { chars: 9 },
      handnote: { lines: 1, chars: 4, longest: 4 },
      shallow: { live: 0, expiring: 0 },
      estimate: { injectedTokens: 20, note: '估算' },
      duplicates: [],
      conflicts: [],
    });
  }
  if (target.endsWith('/cloud')) {
    return json({ ok: true, enabled: true, configured: false, dir: '', keep: 10, auto: false });
  }
  return json({ ok: false, error: 'unexpected' });
}

/**
 * 建一个够两个半边用的 ctx。两个半边合成**一个**插件（一个包名一个工厂），
 * 它的 apply 会对同一个 ctx 依次调 fish 和 soul 的 apply —— 所以 locale /
 * configForms 也得给上，少一样就是 `Cannot read properties of undefined`。
 */
function mountAll(fetchImpl) {
  const { plugins, harness } = boot(fetchImpl);
  const plugin = plugins['dsh-hierarchical-fishmemory'];
  assert.ok(plugin, '应当注册一个合并插件');

  const scope = {
    getSnapshot: () => ({
      status: 'ready',
      value: { cards: { 某个助手: '你是某个助手' }, active: '某个助手', memory: {}, workspaceList: [], workspaces: {} },
    }),
    subscribe: () => () => {},
    write: () => Promise.resolve(),
    load: () => Promise.resolve(),
  };
  const registered = [];
  const ctx = {
    locale: { bind: () => (k) => k, register: () => {}, subscribe: () => () => {} },
    effect: () => {},
    slots: {
      inject: (name, fn) => {
        registered.push(fn());
      },
      register: (spec, component) => {
        registered.push({ spec, component });
        return () => {};
      },
    },
    configForms: { get: () => scope },
  };
  plugin.apply(ctx);
  return { registered, harness, scope, ctx };
}

test('设置页能整棵树渲染出来（含云端表单）', async () => {
  const { registered, harness, scope, ctx } = mountAll(panelFetch);

  const section = registered.find((r) => r && r.spec && r.spec.name === 'settings.section');
  assert.ok(section, '应当注册 settings.section');
  assert.equal(typeof section.component, 'function');

  const stats = await renderTree(
    harness.react.createElement(section.component, { scope, t: (k) => k, locale: ctx.locale }),
    harness,
  );
  assert.ok(stats.nodes > 20, `渲染出的节点数应当可观，实际 ${stats.nodes}`);
  assert.ok(stats.seen.has('WebdavGroup'), '云端备份表单应当被渲染（页签靠 display 藏，不靠卸载）');
  assert.ok(stats.seen.has('CloudBoundary'), '云端表单外面要有错误边界');

  // 人设卡那两块（2026-11-08 加）。`panel(key, 孩子)` 原来只收**一个**
  // 孩子，而 cards 面板传了三个 —— 卡列表和「工作区」被静默丢掉，于是
  // 「保存完就看不到自己写的了，更没法编辑」。这里守的就是这件事：
  // 列表标题和每张卡旁边的「编辑」必须真的在树里。
  const flat = [...stats.texts];
  assert.ok(flat.includes('cardListTitle'), '人设卡列表那块应当渲染出来');
  assert.ok(flat.includes('editCard'), '每张卡旁边要有「编辑」按钮');
  assert.ok(flat.includes('wsTitle'), '「工作区」那块也应当渲染出来（同一个 panel 的第三个孩子）');
  assert.ok(flat.includes('newCard'), '写卡那块要有「新建一张」');

  // 「那年今天」「忽然想起那一天」两个开关（2026-11-08 加）。
  //
  // 它们住在**主插件**的配置命名空间，宿主**没有**通用的 schema 表单渲染器
  // （plugins.row.config 槽全 runtime 没有内置渲染者），所以这块是自己画的。
  // 之前用户找不到开关，就是因为只画了 soul-md 的 memory 字段。
  assert.ok(flat.includes('recallTitle'), '长期记忆页要有「回忆开关」那块');
  assert.ok(flat.includes('fieldOnThisDay'), '要有「那年今天」那条');
  assert.ok(flat.includes('fieldFlashback'), '要有「忽然想起那一天」那条');
  // 1.23.0：字段还是那些，但分了三组，默认只展开第一组。
  // 所以这里守两件事：三组的标题都在（点得到），第一组的字段真的画出来了。
  assert.ok(flat.includes('groupEachTurn'), '要有「每轮都会注入的」这一组');
  assert.ok(flat.includes('groupPace'), '要有「什么时候开口」这一组');
  assert.ok(flat.includes('groupBudget'), '要有「占多少地方」这一组');
  assert.ok(flat.includes('fieldFragmentsEnabled'), '第一组里要露「零碎记忆」总开关');
  // 小纸条 / 教训 / 没说完 现在并进一段，旧的三个开关不摆在页面上，
  // 但配置里仍然认（服务端照旧读 stickyEnabled / lessonEnabled / unfinishedEnabled）。
  assert.equal(flat.includes('fieldStickyEnabled'), false, '旧的三个开关不再占页面位置');
});

test('主面板四个页签都渲染得出来', async () => {
  const { registered, harness } = mountAll(panelFetch);

  const main = registered.find((r) => r && r.spec && r.spec.key === 'feiyu-diary');
  assert.ok(main, '应当注册主面板');
  assert.equal(typeof main.component, 'function');

  const stats = await renderTree(harness.react.createElement(main.component, {}), harness);
  assert.ok(stats.nodes > 60, `面板渲染出的节点数应当可观，实际 ${stats.nodes}`);
  for (const name of ['Tabs', 'Card', 'Entry', 'FeelingsBox', 'FeelingsHeat', 'FeelingsDay', 'Notebook', 'HealthBox', 'ReviewBox', 'ImportBox', 'CloudBox']) {
    assert.ok(stats.seen.has(name), `${name} 应当被渲染（四个页签同时挂载）`);
  }

  // 顶上那两块。断言的是**正文真的出现了** —— 只数节点数的话，
  // 分支写错（比如读了一个不存在的字段）也会"渲染成功"，只是内容空着。
  assert.ok(
    [...stats.texts].some((t) => t.includes('市场卡片上那段简介')),
    '情感日记那一行应当真的渲染出正文',
  );
  assert.ok(
    [...stats.texts].some((t) => t.includes('还常想起') && t.includes('第一件事')),
    '「还常想起」那一行应当列出条目',
  );
  assert.ok([...stats.texts].some((t) => t.includes('回收站 1 条')), 'chips 里应当有回收站条数');
  // 心情热力格（2026-11-07 加）。断言的是**它真的数到了那天** ——
  // 日期标题解析错了的话，这里会显示 0 天。
  assert.ok(
    [...stats.texts].some((t) => t.includes('最近 13 周') && !t.includes('写了 0 天')),
    '心情热力格应当数出至少一天写过',
  );
  // 按天读（2026-11-08 加）。默认展开最新一天，所以正文要真的在树里 ——
  // 只数节点的话，折叠逻辑写反（默认全折）也会"渲染成功"。
  assert.ok(
    [...stats.texts].some((t) => t.includes('有点舍不得它')),
    '最新一天应当默认展开、正文渲染出来',
  );
});
