// 静态自检：服务端代码里有没有「叫了一个名字，但它既没定义也没 import」。
//
// ── 为什么需要 ────────────────────────────────────────────
//
// 2026-11-19 的真事故：`src/host/index.mjs` 调了 `sweepStrayTmpFiles(...)`，却
// **忘了写 import**。`node --check` 只查语法、不查标识符，那一段又包在
// `try { … } catch {}` 里 —— ReferenceError 被空 catch 一口吞掉。结果
// 「每天自动清理孤儿文件」这一整版**从来没跑过**，日志里一个字都没有。
//
// 那是「报了没发生」的反面：**没发生，也没报。** 一样坏，而且更难发现。
//
// ── 为什么用 AST 而不是正则 ────────────────────────────────
//
// 我第一版是正则写的，报出 20 多个"漏 import"，全是解构赋值、参数默认值、
// 类的方法名 —— 一条都不是真 bug。一个报得太多的检查，比不检查更坏：我下次
// 就学会无视它了。所以拆掉重写成 AST 版，只报真的。
//
// 解析器用 acorn（DSH 运行时自带一份）。找不到会让测试**失败**而不是跳过 ——
// skip 掉等于这条检查永远走不到，那正是这插件吃过两次亏的地方。

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = new URL('..', import.meta.url).pathname;
// 只看纯服务端目录：client.js 里有 JSX 风格的对象、样式串、DOM 全局，
// 连 AST 也判断不出哪些是"该 import 的"，范围窄但我看得懂每一条。
const SERVER_DIRS = ['src/core', 'src/host'];

/** 找一个能用的 acorn。找不到返回 null（测试会因此失败，不跳过）。 */
async function loadAcorn() {
  const tried = [];
  for (const base of [import.meta.url, join(ROOT, 'package.json')]) {
    try {
      const req = createRequire(base);
      const path = req.resolve('acorn');
      tried.push(path);
      return await import(path);
    } catch { /* 继续找下一处 */ }
  }
  // DSH 运行时的依赖目录（本机实测在这儿）
  for (const guess of ['/opt/dshapp/runtime/node_modules/acorn/dist/acorn.js']) {
    if (existsSync(guess)) {
      tried.push(guess);
      try {
        return await import(guess);
      } catch { /* fallthrough */ }
    }
  }
  return { __tried: tried };
}

const acorn = await loadAcorn();

/** 把 AST 里所有"自由出现"的标识符收集起来，扣掉定义与全局。 */
function collectReferenceProblems(src, filename) {
  if (!acorn || acorn.__tried) {
    throw new Error(
      `找不到 acorn，这条自检没法跑（试过：${(acorn?.__tried ?? []).join(', ') || '无'}）。` +
      `请装：npm i -D acorn`,
    );
  }
  const ast = acorn.parse(src, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    locations: false,
  });

  // 定义了哪些名字：import、函数/类/变量声明、参数、catch 绑定、解构。
  const defined = new Set();
  const declarePattern = (node) => {
    if (!node) return;
    switch (node.type) {
      case 'Identifier': defined.add(node.name); break;
      case 'ObjectPattern':
        for (const p of node.properties) {
          if (p.type === 'RestElement') declarePattern(p.argument);
          else declarePattern(p.value);
        }
        break;
      case 'ArrayPattern': for (const el of node.elements) declarePattern(el); break;
      case 'RestElement': declarePattern(node.argument); break;
      case 'AssignmentPattern': declarePattern(node.left); break;
      default: break;
    }
  };
  const declareFunction = (node) => {
    if (node.id) defined.add(node.id.name);
    for (const p of node.params) declarePattern(p);
  };

  // 遍历：只走"会被执行到"的结构，跳过字符串/注释（AST 里本来也没有）。
  const walk = (node, parent, key) => {
    if (!node || typeof node.type !== 'string') return;
    switch (node.type) {
      case 'ImportDeclaration':
        for (const s of node.specifiers) defined.add(s.local.name);
        return;
      case 'FunctionDeclaration': declareFunction(node); break;
      case 'FunctionExpression':
      case 'ArrowFunctionExpression': declareFunction(node); break;
      case 'ClassDeclaration':
      case 'ClassExpression': if (node.id) defined.add(node.id.name); break;
      case 'VariableDeclarator': declarePattern(node.id); break;
      case 'CatchClause': declarePattern(node.param); break;
      case 'MetaProperty': return; // import.meta / new.target
      case 'LabeledStatement': return; // label 不是变量
      case 'BreakStatement':
      case 'ContinueStatement': return;
      case 'Property':
        // `{ key: value }` 的 key 在非 computed 时是名字不是引用
        walk(node.value, node, 'value');
        if (node.computed) walk(node.key, node, 'key');
        return;
      case 'MemberExpression':
        walk(node.object, node, 'object');
        if (node.computed) walk(node.property, node, 'property');
        return;
      case 'Identifier': {
        // 到此处的 Identifier 是"引用"。排除：属性名的位置已在上面的 case 挡掉，
        // 还有 import/export 的说明符（也在上面 return 掉了）。
        if (parent) {
          if (parent.type === 'ExportSpecifier' || parent.type === 'ImportSpecifier') return;
          if ((parent.type === 'Property' && key === 'key' && !parent.computed)) return;
          if ((parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition') && key === 'key') return;
        }
        defined.add(`#use:${node.name}`); // 先记下"用到了"，最后统一比对
        return;
      }
      default: break;
    }
    for (const k of Object.keys(node)) {
      if (k === 'type' || k === 'start' || k === 'end') continue;
      const v = node[k];
      if (Array.isArray(v)) v.forEach((child) => walk(child, node, k));
      else if (v && typeof v.type === 'string') walk(v, node, k);
    }
  };
  walk(ast, null, null);

  const used = new Set();
  for (const n of defined) if (n.startsWith('#use:')) used.add(n.slice(5));
  for (const n of defined) if (!n.startsWith('#use:')) used.delete(n);
  return [...used].sort();
}

// 语言自带与宿主全局：它们不需要 import。
const GLOBALS = new Set([
  'Array', 'ArrayBuffer', 'BigInt', 'Boolean', 'DataView', 'Date', 'Error', 'EvalError',
  'Function', 'Infinity', 'Intl', 'JSON', 'Map', 'Math', 'NaN', 'Number', 'Object',
  'Promise', 'Proxy', 'RangeError', 'ReferenceError', 'Reflect', 'RegExp', 'Set', 'String',
  'Symbol', 'SyntaxError', 'TypeError', 'URIError', 'URL', 'URLSearchParams', 'WeakMap',
  'WeakSet', 'Uint8Array', 'Uint16Array', 'Uint32Array', 'Int8Array', 'Int32Array',
  'Float32Array', 'Float64Array', 'BigInt64Array', 'TextDecoder', 'TextEncoder',
  'AbortController', 'AbortSignal', 'Buffer', 'console', 'process', 'globalThis',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate',
  'queueMicrotask', 'structuredClone', 'fetch', 'undefined', 'arguments',
  // URI 三兄弟和它们的解码版是语言全局，不在 Object.keys(globalThis) 里数得出来，
  // 但不需要 import。漏了它们会让这条检查报出三条假话。
  'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI',
  'escape', 'unescape', 'isFinite', 'isNaN', 'parseFloat', 'parseInt',
  'PerformanceObserver', 'queueMicrotask', 'crypto',
]);

test('自检：acorn 必须能加载（否则这条检查是假绿）', () => {
  assert.ok(acorn && !acorn.__tried,
    `这条自检需要 acorn。试过：${(acorn?.__tried ?? []).join(', ') || '无'}`);
});

test('自检：没有「叫了一个名字但它既没定义也没 import」的', () => {
  const broken = [];
  for (const dir of SERVER_DIRS) {
    for (const name of readdirSync(join(ROOT, dir))) {
      if (!name.endsWith('.mjs')) continue;
      const file = join(ROOT, dir, name);
      const free = collectReferenceProblems(readFileSync(file, 'utf8'), file)
        .filter((n) => !GLOBALS.has(n));
      if (free.length > 0) broken.push(`${relative(ROOT, file)}: ${free.join(', ')}`);
    }
  }
  assert.deepEqual(broken, [],
    `这些名字既没定义也没 import —— 运行时会抛 ReferenceError，而空 catch 会把它吞掉：\n${broken.join('\n')}`);
});

test('自检：负例 —— 真漏 import 必须抓出来（否则上面那条是空转）', () => {
  // 就是 2026-11-19 那次真事故的形状
  const fake = `
    import { real } from './x.mjs';
    export function run() {
      try { return sweepStrayTmpFiles('/tmp'); } catch (err) { }
    }
  `;
  const free = collectReferenceProblems(fake, 'fake.mjs');
  assert.ok(free.includes('sweepStrayTmpFiles'), '漏掉的函数名必须抓到');
  assert.ok(!free.includes('real'), 'import 过的不该误报');
  assert.ok(!free.includes('err'), 'catch 绑定的不该误报');
});

test('自检：负例 —— 解构 / 参数默认值 / 方法名不许误报', () => {
  const fake = `
    import { a } from './y.mjs';
    export class Foo {
      constructor(x = 1) { this.x = x; }
      render(items) { return items.filter((it) => it.n > 0).map((it) => it.n); }
    }
    export function pick({ name, value }, list = []) {
      const [first, ...rest] = list;
      const { entries: e } = { entries: [] };
      for (const one of rest) name.length;
      let i = 0;
      while (i < 3) i += 1;
      const f = (u) => u + first.n + e.length + value;
      return f({ n: 1 });
    }
  `;
  const free = collectReferenceProblems(fake, 'fake.mjs').filter((n) => !GLOBALS.has(n));
  assert.deepEqual(free, [], '这些全是合法写法，一个都不该报');
});

test('自检：负例 —— 字符串与注释里的词不算引用', () => {
  const fake = `
    import { a } from './z.mjs';
    // sweepStrayTmpFiles 只在注释里
    const p = '../core/timeline.mjs';
    const q = "weekly(";
    a(p + q);
  `;
  const free = collectReferenceProblems(fake, 'fake.mjs').filter((n) => !GLOBALS.has(n));
  assert.deepEqual(free, []);
});

test('自检：负例 —— 对象字面量的 key 不许当成引用', () => {
  const fake = `
    const o = { name: 1, 'quoted-key': 2, [Symbol.iterator]: null };
    export default o;
  `;
  const free = collectReferenceProblems(fake, 'fake.mjs').filter((n) => !GLOBALS.has(n));
  assert.deepEqual(free, [], '`name:` 是键名，不是变量');
});