import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  applyCompaction,
  digestForMonth,
  entryStamp,
  monthKeyOf,
  pickCompactionCandidates,
  planCompaction,
} from '../src/core/compact.mjs';

const now = Date.parse('2026-11-02T00:00:00Z');
const day = 86400000;

function entry(id, daysAgo, extra = {}) {
  return {
    id,
    date: new Date(now - daysAgo * day).toISOString().slice(0, 10),
    text: `${id} 的正文`,
    kind: 'chat',
    salience: 0.8,
    keywords: ['插件'],
    ...extra,
  };
}

test('entryStamp 认得 date 与 at，认不出返回 0', () => {
  assert.equal(entryStamp({ date: '2026-10-01' }), Date.parse('2026-10-01T00:00:00Z'));
  assert.equal(entryStamp({ at: '2026-10-01T10:00:00Z' }), Date.parse('2026-10-01T10:00:00Z'));
  assert.equal(entryStamp({}), 0);
});

test('monthKeyOf 按月分组', () => {
  assert.equal(monthKeyOf({ date: '2026-09-14' }), '2026-09');
  assert.equal(monthKeyOf({}), '');
});

test('只挑早于 cutoff 且没被压过的', () => {
  // 60 天的条目落在 2026-09 —— 跟 cutoff（2026-09-18）同一个月，按整月对齐
  // 是**不折**的。所以这里用 90 天（2026-08），那才是"整个月都过去了"。
  const entries = [
    entry('old', 90),
    entry('new', 3),
    // 已折的这条要放在**另一个月**（2026-07）。放在同一个月会把整月都划走，
    // 那就变成"该月折过就不再折"那条用例在管的事了。
    entry('already', 120, { compacted: true }),
    { id: 'broken' },
  ];
  const picked = pickCompactionCandidates(entries, { now, olderThanDays: 45 });
  assert.deepEqual(picked.map((e) => e.id), ['old']);
});

test('cutoff 落在月中时，那个月整月不动', () => {
  // cutoff = 2026-09-18。九月一整个月都不该被切成"折了一半"的样子：
  // 9-03 的、9-20 的、9-30 的，要么全折要么全不折 —— 现在是全不折。
  const entries = [
    entry('earlySep', 60), // 2026-09-03
    entry('lateSep', 33), // 2026-09-30
    entry('aug', 90), // 2026-08-04
  ];
  const picked = pickCompactionCandidates(entries, { now, olderThanDays: 45 });
  assert.deepEqual(picked.map((e) => e.id), ['aug']);
});

test('该月已经折过就不再折第二次', () => {
  // 摘要 id 是固定的 `d_<年月>_digest`。同一个八月折两次会出现在两条同 id 的条目，
  // 而索引、lastShownTurn 都按 id 建 Map —— 会互相覆盖。
  const entries = [
    entry('augA', 90),
    entry('augB', 88),
    { id: 'd_202608_digest', date: '2026-08-01', kind: 'digest', compacted: true, text: '那阵子：' },
  ];
  const picked = pickCompactionCandidates(entries, { now, olderThanDays: 45 });
  assert.deepEqual(picked.map((e) => e.id), []);
});

test('摘要记下条数、类型与那阵子的几句话', () => {
  const list = [
    entry('a', 60, { kind: 'win' }),
    entry('b', 59, { kind: 'failure' }),
  ];
  const digest = digestForMonth('2026-09', list);
  assert.equal(digest.id, 'd_202609_digest');
  assert.equal(digest.date, '2026-09-01');
  assert.equal(digest.compacted, true);
  assert.equal(digest.covers, 2);
  assert.match(digest.text, /共 2 件/);
  assert.match(digest.text, /干得不错 1/);
  // 以前这里断言关键词 —— 而 `keywords` 从 2026-10-27 起没人写，
  // 那等于在断言一个永远空的东西。现在摘要带的是几条真正文摘要。
  assert.match(digest.text, /那阵子：/);
  assert.match(digest.text, /的正文/);
  assert.ok(!/关键词/.test(digest.text), '关键词那一段应该已经没有了');
});

test('摘要的 kind 是 digest —— 压缩不等于删除', () => {
  const digest = digestForMonth('2026-09', [entry('a', 60)]);
  // `note` 会被注入整段滤掉。摘要要是 `note`，压缩就等于把那一个月删了。
  assert.equal(digest.kind, 'digest');
});

test('plan 把老条目移出、保留新条目', () => {
  const entries = [entry('old', 90), entry('new', 2)];
  const plan = planCompaction(entries, { now, olderThanDays: 45 });
  assert.equal(plan.movedCount, 1);
  assert.equal(plan.keep.length, 1);
  assert.equal(plan.keep[0].id, 'new');
  assert.equal(plan.groups.length, 1);
});

test('apply 后得到「新条目 + 摘要」，按时间排序', () => {
  const entries = [entry('old', 90), entry('new', 2)];
  const plan = planCompaction(entries, { now, olderThanDays: 45 });
  const merged = applyCompaction(plan);
  assert.equal(merged.length, 2);
  assert.ok(merged.some((e) => e.id === 'new'));
  assert.ok(merged.some((e) => e.compacted === true));
  assert.deepEqual(
    merged.map((e) => entryStamp(e)).sort((a, b) => a - b),
    merged.map((e) => entryStamp(e)),
  );
});

test('没有老条目时什么都不动', () => {
  const plan = planCompaction([entry('new', 1)], { now, olderThanDays: 45 });
  assert.equal(plan.movedCount, 0);
  assert.equal(applyCompaction(plan).length, 1);
});
