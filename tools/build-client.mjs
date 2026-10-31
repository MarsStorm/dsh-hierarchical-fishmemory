/**
 * 把两个手写浏览器 bundle 合成一个（2026-10-31 收编 dsh-soul-md 时加的）。
 *
 * 为什么必须合：DSH 的浏览器模块身份**就是包名**，同一个包名只能有一个
 * `window.__ModuleLoader__.load({ id: 'dsh-hierarchical-fishmemory' })`。原来的
 * `dsh-soul-md` 自己注册了一次 `id: "dsh-soul-md"`，摘掉包以后那次注册
 * 就没人认领了；不改 id 直接拼进来，两个来源解析到同一个包名会让组合失败。
 *
 * 做法（不引入打包器，沿用「手写 bundle」的规矩）：
 *   1. 两个源文件都还保持原样，各自能被单独读懂；
 *   2. 本脚本把两个 factory 的函数体抠出来，各塞进一个 IIFE，得到两个
 *      `{ name, inject, apply }` 插件对象；
 *   3. 外层工厂返回一个合并插件，`inject` 取两边并集，`apply` 里依次调
 *      两边的 apply —— 同一个 ctx，所以两边的 ctx.slots / ctx.locale /
 *      ctx.configForms 都照旧可用。
 *
 * 跑：node tools/build-client.mjs [--check]
 *   --check 只比对，不写盘；有差异时退出码 1。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FISH = join(root, 'src', 'client', 'index.js');
const SOUL = join(root, 'src', 'soul', 'client.js');
const OUT = join(root, 'dist', 'client.js');

/** 从 `factory: (require) => {` 之后切到 `marker` 之前，返回函数体。 */
function sliceBody(source, file, marker) {
  const start = source.indexOf('factory: (require) => {');
  if (start < 0) throw new Error(`${file}: 找不到 factory 起点`);
  const bodyStart = start + 'factory: (require) => {'.length;
  const end = source.indexOf(marker, bodyStart);
  if (end < 0) throw new Error(`${file}: 找不到结尾标记 ${JSON.stringify(marker)}`);
  return source.slice(bodyStart, end).replace(/^\n/, '').replace(/\s+$/, '\n');
}

const fishSrc = readFileSync(FISH, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
const soulSrc = readFileSync(SOUL, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');

const fishBody = sliceBody(
  fishSrc,
  FISH,
  "\n    return { name: 'dsh-hierarchical-fishmemory', inject: ['slots'], apply };",
);
// fish 的 return 语句是身体的最后一行，抠出来自己拼
const fishReturn = "return { name: 'dsh-hierarchical-fishmemory', inject: ['slots'], apply };";

const soulBody = sliceBody(
  soulSrc,
  SOUL,
  '\n    exports.apply = apply;\n    exports.inject = inject;\n    return module.exports;',
);

const out = `/**
 * dsh-hierarchical-fishmemory · 浏览器半边（**生成文件，别手改**）
 *
 * 由 tools/build-client.mjs 从下面两个手写源合成：
 *   - src/client/index.js  —— 日记面板（侧栏格子 + 主面板，看/删/带走）
 *   - src/soul/client.js   —— 人设卡设置页 + 会话头部的人设切换
 *
 * 两个源都自成一体、只 require('react')；合并是为了满足「一个包名只能有一个
 * __ModuleLoader__ 工厂」这条硬规则。改界面请改源文件，然后重新跑
 * \`node tools/build-client.mjs\`。
 */
window.__ModuleLoader__.load({
  id: 'dsh-hierarchical-fishmemory',

  factory: (require) => {
    /* ───────────── soul 半边（原 dsh-soul-md/client.js） ───────────── */
    const soulPlugin = (() => {
${soulBody}
      return { name: 'soul-md', inject: inject, apply: apply };
    })();

    /* ───────────── fish 半边（原 dsh-hierarchical-fishmemory/client.js） ───────────── */
    const fishPlugin = (() => {
${fishBody}
      ${fishReturn}
    })();

    /* ───────────── 合并：一个包，一个 factory，两个界面 ───────────── */
    return {
      name: 'dsh-hierarchical-fishmemory',
      // 两边 inject 的并集：fish 只用 slots；soul 还要 locale / configForms。
      inject: ['slots', 'locale', 'configForms'],
      apply(ctx) {
        fishPlugin.apply(ctx);
        soulPlugin.apply(ctx);
      },
    };
  },
});
`;

const check = process.argv.includes('--check');
const prev = existsSync(OUT) ? readFileSync(OUT, 'utf8') : null;
if (check) {
  if (prev === out) {
    console.log('dist/client.js 与源文件一致');
    process.exit(0);
  }
  console.error('dist/client.js 与源文件不一致，跑 node tools/build-client.mjs 重新生成');
  process.exit(1);
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, out);
console.log(`已生成 ${OUT}（${out.length} 字节）`);
