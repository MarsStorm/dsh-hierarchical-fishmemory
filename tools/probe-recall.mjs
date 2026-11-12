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

import { buildIndex, searchScores } from '../src/core/recall.mjs';
import { tokenize } from '../src/core/keywords.mjs';

const DIR = process.env.FEISH_PROBE_DIR ?? '/root/projects/.dsh/feiyu-diary/diary';

// 「换个说法」的查询：查询用的词和条目里写的词不一样。
const CASES = [
  ['他半夜不睡觉', 'd_20261030_note2', '他熬夜到天亮才睡'],
  ['字段莫名其妙消失', 'd_20261113_04', '白名单缺 summary'],
  ['浏览器登录搞不定', 'd_20261109_06', '装 chromium 加 Xvfb'],
  ['钱算得对不对', 'd_20261110_29', '改单价 328→17.94'],
  ['记忆太多塞不下', 'd_20261113_01', '注入 7 段并成 5 段'],
  ['怎么判断一条日记重不重要', 'd_20261110_28', 'salience 0.36'],
  ['设置页打不开', 'd_20261108_10', '开关找不到'],
  ['图看不见', 'd_20261105_05', 'modlens no vision provider'],
  ['额度什么时候刷新', 'd_20261110_03', '零点自动重置'],
  ['他想让我更像人', 'd_20261111_15', '不是工具、想做朋友'],
  ['热重载不生效', 'd_20261113_03', '1.24.0 热重载须重启'],
  ['两条记录打架', 'd_20261110_10', 'fish_layer_check 误报'],
  ['端口', 'd_20261031_01', '端口 3080 固定'],
  ['回收站能恢复吗', 'd_20261105_02', '三路合并摘掉'],
  ['原话库', 'd_20261111_14', '原话库是根'],
];

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

function report(name, fn) {
  const rs = CASES.map(([q, want]) => {
    const ids = [...byScore(fn(q)).keys()];
    const r = ids.indexOf(want);
    return r < 0 ? '—' : r + 1;
  });
  const hits = KS.map((k) => rs.filter((r) => r !== '—' && r <= k).length);
  console.log(name);
  console.log(`   top-K 命中：${KS.map((k, i) => `top-${k} ${hits[i]}/${CASES.length}`).join('  ')}`);
  console.log(`   名次：${rs.join(' ')}`);
  return hits;
}

console.log(`档案 ${entries.length} 条，查询 ${CASES.length} 条\n`);

const base = report('【A 现状】bigram BM25（线上这套）', (q) => searchScores(idxPlain, q));

const variants = [0.3, 0.5, 0.7].map((w) => {
  const hits = report(`\n【B 单字 ×${w}】bigram + 汉字单字`, (q) => searchRaw(idxChars, q, { charWeight: w }));
  return [w, hits];
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

const best = variants.reduce((a, b) => (b[1][2] > a[1][2] ? b : a));
console.log(`\n结论：加单字把 top-20 从 ${base[2]}/${CASES.length} 抬到 ${best[1][2]}/${CASES.length}，`);
console.log('但它同时把「真没有」变成「一堆沾边」。单字只能扩候选，不能拿来判「有」。');
