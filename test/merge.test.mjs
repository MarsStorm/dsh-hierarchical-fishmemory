import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeDiaryEntries, mergeShallowEntries, planRestore } from '../src/core/backup.mjs';

const entry = (id, text) => ({ id, date: '2026-11-01', text, kind: 'chat', salience: 0.5 });

test('merge: 新 id 补进来，同 id 保留本地', () => {
  const local = [entry('d_20261101_01', '本地这句')];
  const incoming = [entry('d_20261101_01', '云端那句'), entry('d_20261101_02', '云端新的一条')];
  const r = mergeDiaryEntries(local, incoming);
  assert.equal(r.merged.length, 2);
  assert.equal(r.added.length, 1);
  assert.equal(r.added[0].id, 'd_20261101_02');
  assert.equal(r.conflicts.length, 1);
  assert.equal(r.conflicts[0].kept, 'local');
  assert.equal(r.merged.find((e) => e.id === 'd_20261101_01').text, '本地这句');
});

test('merge: 相同内容不算冲突', () => {
  const r = mergeDiaryEntries([entry('a', '同一句')], [entry('a', '同一句')]);
  assert.equal(r.conflicts.length, 0);
  assert.equal(r.merged.length, 1);
});

test('merge: 合并结果按 id 排序', () => {
  const r = mergeDiaryEntries([entry('d_20261101_02', 'x')], [entry('d_20261101_01', 'y')]);
  assert.deepEqual(r.merged.map((e) => e.id), ['d_20261101_01', 'd_20261101_02']);
});

test('merge: 浅层按 key 合并，取新的那份、hits 取大', () => {
  const local = [{ key: 'k1', text: '旧', updated: 1, hits: 3 }];
  const incoming = [{ key: 'k1', text: '新', updated: 9, hits: 1 }, { key: 'k2', text: '另一条', updated: 5, hits: 1 }];
  const merged = mergeShallowEntries(local, incoming);
  assert.equal(merged.length, 2);
  const k1 = merged.find((e) => e.key === 'k1');
  assert.equal(k1.text, '新');
  assert.equal(k1.hits, 3);
});

test('planRestore merge: 深层/情感日记/人格手记进 skipped，日记只并增量', () => {
  const backup = {
    meta: { version: 1 },
    deep: { s: { core: 'BACKUP-CORE', topics: {} } },
    diary: { jsonl: { '2026-11.jsonl': JSON.stringify(entry('d_20261101_02', '云端新增')) + '\n' } },
    feelings: 'BACKUP-FEELINGS',
    handnote: '- BACKUP-NOTE',
    shallow: { entries: [] },
    persona: { cards: {}, active: null },
  };
  const plan = planRestore(backup, {
    diaryDir: '/tmp/dd',
    mode: 'merge',
    local: { diaryEntries: [entry('d_20261101_01', '本地')], shallowEntries: [] },
  });
  const kinds = plan.writes.map((w) => w.kind);
  assert.ok(!kinds.includes('memory-core'));
  assert.ok(!kinds.includes('feelings'));
  assert.ok(!kinds.includes('handnote'));
  assert.equal(plan.diary.added, 1);
  const diary = plan.writes.find((w) => w.kind === 'diary');
  assert.match(diary.content, /本地/);
  assert.match(diary.content, /云端新增/);
  assert.ok(plan.skipped.some((s) => s.kind === 'memory-core'));
});
