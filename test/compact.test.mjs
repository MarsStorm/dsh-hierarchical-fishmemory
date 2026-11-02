import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  applyCompaction,
  digestForMonth,
  entryTime,
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

test('entryTime 认得 date 与 at，认不出返回 0', () => {
  assert.equal(entryTime({ date: '2026-10-01' }), Date.parse('2026-10-01T00:00:00Z'));
  assert.equal(entryTime({ at: '2026-10-01T10:00:00Z' }), Date.parse('2026-10-01T10:00:00Z'));
  assert.equal(entryTime({}), 0);
});

test('monthKeyOf 按月分组', () => {
  assert.equal(monthKeyOf({ date: '2026-09-14' }), '2026-09');
  assert.equal(monthKeyOf({}), '');
});

test('只挑早于 cutoff 且没被压过的', () => {
  const entries = [
    entry('old', 60),
    entry('new', 3),
    entry('already', 60, { compacted: true }),
    { id: 'broken' },
  ];
  const picked = pickCompactionCandidates(entries, { now, olderThanDays: 45 });
  assert.deepEqual(picked.map((e) => e.id), ['old']);
});

test('摘要记下条数、类型与关键词', () => {
  const list = [
    entry('a', 60, { kind: 'win', keywords: ['压缩', '测试'] }),
    entry('b', 59, { kind: 'failure', keywords: ['压缩'] }),
  ];
  const digest = digestForMonth('2026-09', list);
  assert.equal(digest.id, 'd_202609_digest');
  assert.equal(digest.date, '2026-09-01');
  assert.equal(digest.compacted, true);
  assert.equal(digest.covers, 2);
  assert.match(digest.text, /共 2 件/);
  assert.match(digest.text, /干得不错 1/);
  assert.match(digest.text, /压缩/);
});

test('plan 把老条目移出、保留新条目', () => {
  const entries = [entry('old', 60), entry('new', 2)];
  const plan = planCompaction(entries, { now, olderThanDays: 45 });
  assert.equal(plan.movedCount, 1);
  assert.equal(plan.keep.length, 1);
  assert.equal(plan.keep[0].id, 'new');
  assert.equal(plan.groups.length, 1);
});

test('apply 后得到「新条目 + 摘要」，按时间排序', () => {
  const entries = [entry('old', 60), entry('new', 2)];
  const plan = planCompaction(entries, { now, olderThanDays: 45 });
  const merged = applyCompaction(plan);
  assert.equal(merged.length, 2);
  assert.ok(merged.some((e) => e.id === 'new'));
  assert.ok(merged.some((e) => e.compacted === true));
  assert.deepEqual(
    merged.map((e) => entryTime(e)).sort((a, b) => a - b),
    merged.map((e) => entryTime(e)),
  );
});

test('没有老条目时什么都不动', () => {
  const plan = planCompaction([entry('new', 1)], { now, olderThanDays: 45 });
  assert.equal(plan.movedCount, 0);
  assert.equal(applyCompaction(plan).length, 1);
});
