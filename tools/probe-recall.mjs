/**
 * 召回测量台（只读，不改档案）。
 *
 *     node tools/probe-recall.mjs
 *
 * 为什么要它：这个插件里凡是"判定类"的功能，我栽过两次 ——
 * 1.11.0 的断句标记上线两周，真实数据里判成断句的是 0 条；
 * 1.24.0 的归并工具只认 `- ` 开头，真实 topic 用 `1. 2.`，7 条一条没数到。
 * 两次都不是逻辑写错，是**我以为数据长什么样**。
 *
 * 所以凡是想动检索/判定，先在这里跑一遍，用真实档案说话。
 *
 * ⚠️ 那 15 条查询是我自己按记忆挑的、答案也是我自己标的 —— 这是**自评**，
 * 不是基准测试。数字只能用来比较改动前后，不能当绝对水平。
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { buildIndex, searchChars, searchScores } from '../src/core/recall.mjs';
import { tokenize } from '../src/core/keywords.mjs';

const DIR = process.env.FEISH_PROBE_DIR ?? '/root/projects/.dsh/feiyu-diary/diary';

// 「换个说法」的查询：查询用的词和条目里写的词不一样。
//
// ── 为什么要分成 dev 和 holdout（2026-11-15 加，1.29.0）──
//
// 抄的是 returning-tide-memory 的 `evals/recall-cases.json`：它 20 条用例
// 明确分成 9 条 development 和 11 条 holdout，**分别报指标**。
//
// 为什么非分不可：这一整套查询是我自己按记忆挑的、答案也是我自己标的。
// 如果不分组，我每调一次参数就对着同一批查询看涨跌 —— 那等于
// 训练集和测试集是同一份，报出来的数字只证明我把自己那 15 条记熟了。
//
// 规则（照它的口径）：
//   - `dev`：调参时可以看，改了什么都对着它比。
//   - `hold`:调参时**不看**，只在决定要不要上线时看一次。
//   一条查询一旦被我拿去调过参，它就从 hold 降级成 dev —— 别再拿它当留验集。
//
// 所以在 hold 那几条上看到好数字，才是真的有用；dev 上的涨跌只是过程。
const CASES = [
  // ── development：调参时对着它看 ──
  ['他半夜不睡觉', 'd_20261030_note2', 'dev', '他熬夜到天亮才睡'],
  ['字段莫名其妙消失', 'd_20261113_04', 'dev', '白名单缺 summary'],
  ['浏览器登录搞不定', 'd_20261109_06', 'dev', '装 chromium 加 Xvfb'],
  ['钱算得对不对', 'd_20261110_29', 'dev', '改单价 328→17.94'],
  ['记忆太多塞不下', 'd_20261113_01', 'dev', '注入 7 段并成 5 段'],
  ['怎么判断一条日记重不重要', 'd_20261110_28', 'dev', 'salience 0.36'],
  ['设置页打不开', 'd_20261108_10', 'dev', '开关找不到'],
  ['图看不见', 'd_20261105_05', 'dev', 'modlens no vision provider'],
  ['额度什么时候刷新', 'd_20261110_03', 'dev', '零点自动重置'],
  ['端口', 'd_20261031_01', 'dev', '端口 3080 固定'],
  // ── holdout：调参时不看；要动线上之前才看这一次 ──
  ['他想让我更像人', 'd_20261111_15', 'hold', '不是工具、想做朋友'],
  ['热重载不生效', 'd_20261113_03', 'hold', '1.24.0 热重载须重启'],
  ['两条记录打架', 'd_20261110_10', 'hold', 'fish_layer_check 误报'],
  ['回收站能恢复吗', 'd_20261105_02', 'hold', '三路合并摘掉'],
  ['原话库', 'd_20261111_14', 'hold', '原话库是根'],
];

const SPLITS = ['dev', 'hold'];

// 真的一句都没聊过的话题。加了单字之后这些还能不能空手而归，是硬指标。
const NOISE = ['银河系', '量子纠缠', '光合作用', '马拉松训练', '航天飞机', '红楼梦', '南极洲'];

const KS = [5, 10, 20, 50];

function loadEntries() {
  const out = [];
  for (const f of readdirSync(DIR).filter((x) => x.endsWith('.jsonl'))) {
    for (const line of readFileSync(join(DIR, f), 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        out.push(JSON.parse(line));
      } catch {
        /* 坏行跳过 —— 归档本来就有「降级不抛错」的约定 */
      }
    }
  }
  return out;
}

const entries = loadEntries();
const bodyOf = new Map(entries.map((e) => [e.id, [e.summary ?? '', e.text ?? ''].join('\n')]));

const hanCharsOf = (s) => [...new Set([...s].filter((c) => /\p{Script=Han}/u.test(c)))];

// ── 带单字的索引 ──
//
// 和线上那份 `buildIndex` 的唯一区别：文档侧除了 bigram，还收汉字单字。
// 为什么单独写一份而不是改线上：先量，量完了再决定要不要改线上。
function buildIndexWithChars(list) {
  const postings = new Map();
  const df = new Map();
  const lengths = new Map();
  for (const e of list) {
    const text = [e.summary ?? '', e.text ?? ''].join('\n');
    const toks = [...tokenize(text), ...hanCharsOf(text)];
    const tf = new Map();
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const [t, n] of tf) {
      if (!postings.has(t)) postings.set(t, new Map());
      postings.get(t).set(e.id, n);
      df.set(t, (df.get(t) ?? 0) + 1);
    }
    lengths.set(e.id, toks.length);
  }
  return { postings, df, lengths, N: lengths.size };
}

// ── 原始分空间的检索 ──
//
// `searchScores` 返回的是**饱和到 0~1 的分**（`1-exp(-r/2)`）。
// 往一个已经顶到 1 的分数上再加什么都白搭 —— 第一版探针就栽在这儿：
// 加了单字，名次一条没动。所以这里全程用原始 gain，最后才归一化。
function searchRaw(idx, query, { charWeight = 0 } = {}) {
  const qBi = [...new Set(tokenize(query))];
  const qChar = charWeight > 0 ? hanCharsOf(query) : [];
  const k1 = 1.2;
  const b = 0.75;
  const avgLen = [...idx.lengths.values()].reduce((s, n) => s + n, 0) / Math.max(1, idx.lengths.size);
  const raw = new Map();

  const add = (tok, mult) => {
    const bucket = idx.postings.get(tok);
    if (bucket === undefined) return;
    const idf = Math.log(1 + (idx.N + 0.5) / ((idx.df.get(tok) ?? 0) + 0.5));
    for (const [id, tf] of bucket) {
      const len = idx.lengths.get(id) ?? avgLen;
      const norm = 1 - b + (b * len) / Math.max(1, avgLen);
      raw.set(id, (raw.get(id) ?? 0) + (idf * mult * (tf * (k1 + 1))) / (tf + k1 * norm));
    }
  };

  for (const t of qBi) add(t, 1);
  for (const c of qChar) add(c, charWeight);

  const out = new Map();
  for (const [id, r] of raw) out.set(id, Math.min(1, 1 - Math.exp(-r / 2)));
  return out;
}

const idxPlain = buildIndex(entries);
const idxChars = buildIndexWithChars(entries);

const byScore = (m) => new Map([...m.entries()].sort((a, b) => b[1] - a[1]));

/**
 * 一组查询的指标：命中率按 top-K 报，另有 MRR（平均倒数名次）。
 *
 * 为什么加 MRR：top-K 只看"进没进前 K"，把第 1 名和第 10 名算成一回事。
 * 真用起来差得远 —— 第 1 名我直接就信了，第 10 名还得自己再挑。
 * MRR = 名次倒数取平均，第一名 1.0，第五名 0.2，没找到 0。
 */
function metrics(name, fn) {
  const rows = CASES.map(([q, want, split]) => {
    const ids = [...byScore(fn(q)).keys()];
    const idx = ids.indexOf(want);
    return { q, want, split, rank: idx < 0 ? null : idx + 1 };
  });
  console.log(name);
  for (const split of SPLITS) {
    const g = rows.filter((r) => r.split === split);
    if (g.length === 0) continue;
    const hits = KS.map((k) => g.filter((r) => r.rank !== null && r.rank <= k).length);
    const mrr = g.reduce((s, r) => s + (r.rank === null ? 0 : 1 / r.rank), 0) / g.length;
    console.log(
      `   ${split.padEnd(4)} (${g.length} 条)  ` +
        KS.map((k, i) => `top-${k} ${hits[i]}/${g.length}`).join('  ') +
        `  MRR ${mrr.toFixed(2)}`,
    );
  }
  const deltas = rows.map((r) => (r.rank === null ? '—' : r.rank));
  console.log(`   名次：${deltas.join(' ')}`);
  return rows;
}

/** 只报留验集 —— 调参时**不要**调这个，要动线上之前才看一次。 */
function holdoutOnly(rows) {
  const g = rows.filter((r) => r.split === 'hold');
  const mrr = g.reduce((s, r) => s + (r.rank === null ? 0 : 1 / r.rank), 0) / Math.max(1, g.length);
  const hit3 = g.filter((r) => r.rank !== null && r.rank <= 3).length;
  return { n: g.length, hit3, mrr };
}

console.log(`档案 ${entries.length} 条，查询 ${CASES.length} 条\n`);

console.log('⚠️ 下面每段都分 dev / hold 报。**调参只看 dev，hold 只在要上线时看一次。**\n');

const base = metrics('【A 现状】bigram BM25（线上这套）', (q) => searchScores(idxPlain, q));

const variants = [0.3, 0.5, 0.7].map((w) => {
  const rows = metrics(`\n【B 单字 ×${w}】bigram + 汉字单字`, (q) => searchRaw(idxChars, q, { charWeight: w }));
  const dev20 = rows.filter((r) => r.split === 'dev' && r.rank !== null && r.rank <= 20).length;
  return [w, dev20, rows];
});

// ── 噪声 ──
console.log('\n【噪声】本来该空手而归的查询（越接近 0 越好）');
const noiseRows = (fn) => NOISE.map((q) => `${q}:${fn(q).size}`).join('  ');
console.log(`   A 现状   ${noiseRows((q) => searchScores(idxPlain, q))}`);
for (const w of [0.3, 0.5, 0.7]) {
  console.log(`   B 单字${w} ${noiseRows((q) => searchRaw(idxChars, q, { charWeight: w }))}`);
}

// bigram 命中 = 0，说明"字面上一个字都没撞上"是可靠信号
console.log('\n【bigram 是干净的】噪声查询里 bigram 命中的条目数');
for (const q of NOISE) {
  const qb = new Set(tokenize(q));
  const n = entries.filter((e) => [...qb].some((t) => bodyOf.get(e.id).includes(t))).length;
  console.log(`   ${q.padEnd(8)} ${n}`);
}

const devN = CASES.filter((c) => c[2] === 'dev').length;
const baseDev20 = base.filter((r) => r.split === 'dev' && r.rank !== null && r.rank <= 20).length;
const best = variants.reduce((a, b) => (b[1] > a[1] ? b : a));
console.log(`\n加单字把 **dev 的** top-20 从 ${baseDev20}/${devN} 抬到 ${best[1]}/${devN}，`);
console.log('但它同时把「真没有」变成「一堆沾边」—— 单字只能扩候选，不能拿来判「有」。');

// ── 四、线上那版（1.26.0 之后真的在跑的）：单字封顶当候选 ──
//
// 这一段量的是**已经上线的那套**，不是候选方案：
// `searchChars` 分封在 0.15（midSim 是 0.25），只有单字撞上的标 weak。
// 判据：正确那条在不在候选里（放宽到 30），以及噪声查询有没有冒到 midSim 以上。
const MID_SIM = 0.25;
console.log('\n【上线版】bigram + 单字候选（封顶 0.15）');
const shippedRows = CASES.map(([q, want, split]) => {
  const merged = new Map([...searchScores(idxPlain, q)]);
  for (const [id, sim] of searchChars(idxPlain, q, { limit: 30 })) {
    if (merged.has(id)) continue;
    merged.set(id, Math.min(0.15, sim * 0.5));
  }
  const ids = [...merged.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const r = ids.indexOf(want);
  return { q, split, rank: r < 0 ? null : r + 1, sim: merged.get(want) ?? 0 };
});
for (const split of SPLITS) {
  const g = shippedRows.filter((r) => r.split === split);
  const hits = [5, 10, 20, 30].map((k) => g.filter((r) => r.rank !== null && r.rank <= k).length);
  const mrr = g.reduce((s, r) => s + (r.rank === null ? 0 : 1 / r.rank), 0) / Math.max(1, g.length);
  console.log(
    `   ${split.padEnd(4)} (${g.length} 条)  ` +
      [5, 10, 20, 30].map((k, i) => `top-${k} ${hits[i]}/${g.length}`).join('  ') +
      `  MRR ${mrr.toFixed(2)}`,
  );
}
console.log(`   名次：${shippedRows.map((r) => (r.rank === null ? '—' : r.rank)).join(' ')}`);
const hold = holdoutOnly(shippedRows);
console.log(
  `   \n   ⭐ 留验集的一句话结论：${hold.n} 条里 top-3 命中 ${hold.hit3} 条，MRR ${hold.mrr.toFixed(2)}。` +
    '\n      这个数字调参时我没看过 —— 所以它才是"这套东西对没见过的问法管不管用"。',
);

console.log('\n【上线版 噪声】这些分数全部必须 < 0.25（否则单字能自己触发一次「忽然想起来」）');
let worst = 0;
let worstQ = '';
for (const q of NOISE) {
  const merged = new Map();
  for (const [id, sim] of searchChars(idxPlain, q, { limit: 30 })) merged.set(id, Math.min(0.15, sim * 0.5));
  const top = Math.max(0, ...merged.values());
  if (top > worst) { worst = top; worstQ = q; }
  console.log(`   ${q.padEnd(8)} ${merged.size} 条候选，最高 ${top.toFixed(3)}`);
}
console.log(`   最高的一条：${worstQ} ${worst.toFixed(3)} —— ${worst < MID_SIM ? 'OK，够不着 midSim' : '✗ 超了，噪声会自己浮上来'}`);
