import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildIndex,
  looksLikeWork,
  parseTimeHint,
  queryHasSubstance,
  searchChars,
  searchScores,
  searchWithChars,
  selectMemories,
  softmaxPick,
} from '../src/core/recall.mjs';

const now = Date.parse('2026-11-05T00:00:00Z');
const day = 86400000;

function entry(id, text, extra = {}) {
  return { id, text, kind: 'chat', salience: 0.8, created_at: now - 2 * day, ...extra };
}

const entries = [
  entry('d1', '他让我把端口改成 3080'),
  entry('d2', '赛博朋克那晚我们聊到三点'),
  entry('d3', '他生日是十一月二日'),
];

test('buildIndex：空列表建出 N=0 的索引', () => {
  const idx = buildIndex([]);
  assert.equal(idx.N, 0);
  assert.equal(idx.postings.size, 0);
});

// 2026-11-13 改：从「有 summary 就只看 summary」改成「两边都收」。
//
// 原来那版是空转的：summary 一直被归一化白名单吃掉，磁盘上一条都没有，
// 这个分支半年没被真跑过。1.25.1 修好之后 115 条全有摘要，后果立刻显出来 ——
// 索引从几百字正文缩成 80 字摘要，能搜到的词少了一大半。
test('buildIndex：summary 和正文都进索引，不是二选一', () => {
  const withSummary = [
    { id: 'a', text: '正文里没有的词', summary: '端口 3080', salience: 0.8, created_at: now },
  ];
  const idx = buildIndex(withSummary);
  assert.ok(searchScores(idx, '端口').get('a') > 0, '摘要里的词能搜到');
  assert.ok(searchScores(idx, '正文').get('a') > 0, '正文里的词也能搜到');
});

test('buildIndex：没有 summary 时退回正文', () => {
  const idx = buildIndex(entries);
  assert.ok(searchScores(idx, '端口').get('d1') > 0);
});

test('searchScores：没命中的条目不出现在结果里', () => {
  const idx = buildIndex(entries);
  const hits = searchScores(idx, '赛博朋克');
  assert.ok(hits.has('d2'));
  assert.equal(hits.has('d1'), false);
});

test('searchScores：分数落在 0~1 之间', () => {
  const idx = buildIndex(entries);
  for (const [, v] of searchScores(idx, '端口 3080 赛博朋克 生日')) {
    assert.ok(v >= 0 && v <= 1, `分数越界：${v}`);
  }
});

test('searchScores：空查询 / 空索引不抛', () => {
  assert.equal(searchScores(buildIndex([]), '端口').size, 0);
  assert.equal(searchScores(buildIndex(entries), '').size, 0);
  assert.equal(searchScores(buildIndex(entries), '，。！').size, 0);
});

test('queryHasSubstance：寒暄不算有内容', () => {
  for (const s of ['嗯', '哦', '好', '在吗', '哈哈哈', '。。', '']) {
    assert.equal(queryHasSubstance(s), false, `「${s}」不该被当成有内容`);
  }
  assert.equal(queryHasSubstance('你还记得赛博朋克那晚吗'), true);
  assert.equal(queryHasSubstance(null), false);
  assert.equal(queryHasSubstance({}), false);
});

test('looksLikeWork：认形状，不认话题', () => {
  const work = [
    '看下 src/host/index.mjs:269',
    'npm test 挂了',
    '报错 EACCES',
    'v1.8.2 那版',
    '调 buildIndex() 的时候',
    '/tmp/foo 不存在',
  ];
  for (const s of work) assert.equal(looksLikeWork(s), true, `「${s}」该判成干活`);

  const chat = ['你还记得那天吗', '今天好累', '我喜欢你陪我聊天'];
  for (const s of chat) assert.equal(looksLikeWork(s), false, `「${s}」不该判成干活`);

  assert.equal(looksLikeWork(''), false);
  assert.equal(looksLikeWork(null), false);
});

test('parseTimeHint：认得出「昨天」「今天」，认不出返回 null', () => {
  const today = parseTimeHint('今天干了什么', now);
  assert.ok(today !== null);
  assert.equal(today.label, '今天');

  const yesterday = parseTimeHint('昨天那个事', now);
  assert.ok(yesterday !== null);
  assert.ok(yesterday.from < today.from);
  assert.ok(yesterday.to < today.to);

  assert.equal(parseTimeHint('赛博朋克让你想到什么', now), null);
  assert.equal(parseTimeHint('', now), null);
  assert.equal(parseTimeHint(null, now), null);
});

test('parseTimeHint：「上个月」给出一个窗口，不是单个点', () => {
  const hint = parseTimeHint('上个月说的那个', now);
  assert.ok(hint !== null);
  assert.ok(hint.to > hint.from);
});

test('selectMemories：强匹配的会被挑出来', () => {
  const idx = buildIndex(entries);
  const state = { lastShownTurn: new Map() };
  const { chosen } = selectMemories(entries, idx, '赛博朋克', state, 1, {
    now,
    rng: () => 0.99,
    wanderChance: 0,
    minSalience: 0,
  });
  assert.ok(chosen.some((c) => c.entry.id === 'd2'));
});

test('selectMemories：冷却期内不再重复露出同一条', () => {
  const idx = buildIndex(entries);
  const state = { lastShownTurn: new Map([['d2', 1]]) };
  const { chosen } = selectMemories(entries, idx, '赛博朋克', state, 3, {
    now,
    rng: () => 0.99,
    wanderChance: 0,
    minSalience: 0,
    cooldownTurns: 20,
  });
  assert.equal(chosen.some((c) => c.entry.id === 'd2'), false);
});

test('selectMemories：露出的条目会写回 lastShownTurn', () => {
  const idx = buildIndex(entries);
  const state = { lastShownTurn: new Map() };
  const { chosen } = selectMemories(entries, idx, '赛博朋克', state, 7, {
    now,
    rng: () => 0.99,
    wanderChance: 0,
    minSalience: 0,
  });
  for (const c of chosen) assert.equal(state.lastShownTurn.get(c.entry.id), 7);
});

test('selectMemories：没匹配上时默认什么都不提', () => {
  const idx = buildIndex(entries);
  const state = { lastShownTurn: new Map() };
  const { chosen } = selectMemories(entries, idx, '量子色动力学', state, 1, {
    now,
    rng: () => 0.99,
    wanderChance: 0,
  });
  assert.equal(chosen.length, 0);
});

test('selectMemories：走神概率为 1 时必定想起一条', () => {
  const idx = buildIndex(entries);
  const state = { lastShownTurn: new Map() };
  const { chosen } = selectMemories(entries, idx, '量子色动力学', state, 1, {
    now,
    rng: () => 0.0, // 小于任何正的概率
    wanderChance: 1,
    minSalience: 0,
  });
  assert.equal(chosen.length, 1);
});

test('selectMemories：未解决的失败记忆会被加一点权', () => {
  const base = [entry('f1', '那次装插件失败了', { kind: 'failure', resolved: false })];
  const idx = buildIndex(base);
  const state = { lastShownTurn: new Map() };
  const { chosen } = selectMemories(base, idx, '装插件', state, 1, {
    now,
    rng: () => 0.99,
    wanderChance: 0,
    minSalience: 0,
  });
  assert.ok(chosen.length > 0);
  assert.match(chosen[0].why, /未解决/);
});

test('softmaxPick：温度极低时基本取最高分', () => {
  const items = [{ score: 10 }, { score: 1 }, { score: 0.5 }];
  for (let i = 0; i < 20; i += 1) {
    assert.equal(softmaxPick(items, 0.01, Math.random)?.score, 10);
  }
});

test('softmaxPick：空列表返回 undefined', () => {
  assert.equal(softmaxPick([], 0.15, Math.random), undefined);
});

// ── 单字层（1.26.0）──
//
// bigram 要求两个字紧挨着才命中，于是「半夜」搜不到「熬夜」。
// 单字能补上这段，代价是把「真没有」变成「一堆沾边」。
// 下面这组测试守的就是那条线：**能扩候选，不能判「有」。**

test('buildIndex：单字单独一份倒排，不混进 bigram 那份', () => {
  const idx = buildIndex([{ id: 'a', text: '他熬夜到天亮才睡', salience: 0.5, created_at: now }]);
  assert.ok(idx.charPostings.get('夜'), '「夜」在单字倒排里');
  assert.equal(idx.postings.get('夜'), undefined, 'bigram 那份里不该有单字');
});

test('searchChars：「半夜」能找到「熬夜」，bigram 找不到', () => {
  const entries2 = [
    { id: 'a', text: '他熬夜到天亮才睡', salience: 0.5, created_at: now },
    { id: 'b', text: '端口固定 3080', salience: 0.5, created_at: now },
  ];
  const idx = buildIndex(entries2);
  assert.equal(searchScores(idx, '他半夜不睡觉').size, 0, 'bigram 一个都撞不上');
  const chars = searchChars(idx, '他半夜不睡觉');
  assert.ok(chars.get('a') > 0, '单字能撞上「夜」「睡」');
});

test('searchChars：问根本不存在的事，分数也压得很低', () => {
  const idx = buildIndex(entries);
  const chars = searchChars(idx, '量子纠缠');
  for (const [, sim] of chars) assert.ok(sim <= 0.25, '单字分不该顶到「值得提一句」那条线');
});

test('searchWithChars：只有单字撞上的标 weak', () => {
  const idx = buildIndex([
    { id: 'a', text: '他熬夜到天亮才睡', salience: 0.5, created_at: now },
  ]);
  const got = searchWithChars(idx, '他半夜不睡觉');
  assert.equal(got.get('a').weak, true);
  assert.ok(got.get('a').sim < 0.25, '封顶必须在 midSim 之下，否则单字能自己触发一次"忽然想起来"');
});

test('searchWithChars：bigram 撞上的不算 weak', () => {
  const idx = buildIndex([{ id: 'a', text: '端口 3080 固定', salience: 0.5, created_at: now }]);
  const got = searchWithChars(idx, '端口');
  assert.equal(got.get('a').weak, false);
  assert.ok(got.get('a').sim > 0.15);
});
