import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildIndex,
  looksLikeWork,
  parseTimeHint,
  queryHasSubstance,
  searchScores,
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

test('buildIndex：有 summary 就用 summary 建索引', () => {
  const withSummary = [
    { id: 'a', text: '正文里没有的词', summary: '端口 3080', salience: 0.8, created_at: now },
  ];
  const idx = buildIndex(withSummary);
  assert.ok(searchScores(idx, '端口').get('a') > 0);
  assert.equal(searchScores(idx, '正文').size, 0);
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
