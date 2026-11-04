import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeDiaryEntries, mergeShallowEntries, planRestore } from '../src/core/backup.mjs';
import { mergeArchives } from '../src/core/archive.mjs';

const entry = (id, text) => ({ id, date: '2026-11-01', text, kind: 'chat', salience: 0.5 });

/** `mergeArchives` 要完整档案（关系、词表都在），这里补最小外壳 */
const shell = (diary, deleted = []) => ({
  manifest: { created_at: 1, updated_at: 1, diary_count: diary.length, deleted_ids: deleted },
  persona: '',
  relationship: { familiarity: 0, nickname: '', traits: [] },
  lexicon: { items: [] },
  diary,
});

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

// ── 三路合并里"我们删的 / 别人删的"这条线（2026-11-04 补）──
//
// 这段是端到端跑出来的：从回收站恢复一条刚被忘掉的日记，工具报告成功、
// 内存里也在，可下一次落盘就没了。原因就在下面这两条断言之间 ——
// 恢复的条目**正好落在"内存有、磁盘没有、基线有"那一格**，而那一格的
// 判定是"别人删的，丢掉"。
test('mergeArchives: 基线里有、磁盘没有 → 判成别人删的，丢掉', () => {
  const keep = { id: 'a', text: '还在', created_at: 1 };
  const restored = { id: 'b', text: '刚恢复的', created_at: 2 };
  const r = mergeArchives(shell([keep, restored]), shell([keep]), { baselineIds: new Set(['a', 'b']) });
  assert.deepEqual(r.diary.map((e) => e.id), ['a']);
});

test('mergeArchives: 把 id 从基线里摘掉，同一条就能活下来', () => {
  const keep = { id: 'a', text: '还在', created_at: 1 };
  const restored = { id: 'b', text: '刚恢复的', created_at: 2 };
  // 恢复时 `loadedIds.delete(id)` —— 于是它变成"我们自己刚加的"
  const r = mergeArchives(shell([keep, restored]), shell([keep]), { baselineIds: new Set(['a']) });
  assert.deepEqual(r.diary.map((e) => e.id), ['a', 'b']);
});

test('mergeArchives: 墓碑摘掉之后，磁盘上那份也不会再被滤', () => {
  const r = mergeArchives(shell([{ id: 'b', text: '恢复的', created_at: 2 }]), shell([]), { baselineIds: new Set() });
  assert.deepEqual(r.diary.map((e) => e.id), ['b']);
  assert.deepEqual(r.manifest.deleted_ids, []);
});
