import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createEmptyArchive, normalizeDiaryEntry } from '../src/core/archive.mjs';
import { DEFAULT_CONSOLIDATION, decayArchive } from '../src/core/consolidate.mjs';

const day = 86400000;
const now = Date.parse('2026-11-05T00:00:00Z');

function archiveWith(diary, extra = {}) {
  const a = createEmptyArchive(now);
  a.manifest.last_decay_at = now - 10 * day;
  a.manifest.updated_at = now - 10 * day;
  a.diary = diary;
  return { ...a, ...extra };
}

function entry(id, extra = {}) {
  return { id, date: '2026-10-26', text: `${id} 的正文`, kind: 'chat', salience: 0.8, created_at: now - 10 * day, ...extra };
}

test('decayArchive：不足一天不动', () => {
  const a = createEmptyArchive(now);
  a.manifest.last_decay_at = now - 3600 * 1000;
  a.diary = [entry('d1')];
  const { days, changed } = decayArchive(a, { now });
  assert.equal(days, 0);
  assert.equal(changed, false);
});

test('decayArchive：十天按 0.9^10 衰减', () => {
  const { archive } = decayArchive(archiveWith([entry('d1')]), { now });
  const expected = 0.8 * Math.pow(0.9, 10);
  assert.ok(Math.abs(archive.diary[0].salience - expected) < 1e-9);
});

test('decayArchive：不会掉到地板以下', () => {
  const a = archiveWith([entry('d1', { salience: 0.2 })]);
  a.manifest.last_decay_at = now - 365 * day;
  const { archive } = decayArchive(a, { now });
  assert.equal(archive.diary[0].salience, DEFAULT_CONSOLIDATION.salienceFloor);
});

test('decayArchive：被想起来过的条目衰减更慢', () => {
  const never = entry('never');
  const once = entry('once', { recall_count: 1 });
  const many = entry('many', { recall_count: 10 });
  const { archive } = decayArchive(archiveWith([never, once, many]), { now });

  const byId = new Map(archive.diary.map((e) => [e.id, e.salience]));
  assert.ok(byId.get('many') > byId.get('once'), '召回十次的该比一次的高');
  assert.ok(byId.get('once') > byId.get('never'), '召回过的该比没召回的高');
});

test('decayArchive：缓冲最多减半，不会完全不衰减', () => {
  const huge = entry('huge', { recall_count: 100000 });
  const { archive } = decayArchive(archiveWith([huge]), { now });
  // 半衰：0.9^(10*0.5) = 0.9^5
  const floorBound = 0.8 * Math.pow(0.9, 5);
  assert.ok(archive.diary[0].salience <= floorBound + 1e-9);
  assert.ok(archive.diary[0].salience < 0.8, '还是得衰减一点');
});

test('decayArchive：recall_count 是脏值时当没召回', () => {
  const bad = entry('bad', { recall_count: '不是数字' });
  const good = entry('good');
  const { archive } = decayArchive(archiveWith([bad, good]), { now });
  assert.equal(archive.diary[0].salience, archive.diary[1].salience);
});

test('decayArchive：词条按同一个系数衰减', () => {
  const a = archiveWith([]);
  a.lexicon = { items: [{ term: '小鱼', salience: 0.8 }] };
  const { archive } = decayArchive(a, { now });
  const expected = 0.8 * Math.pow(0.9, 10);
  assert.ok(Math.abs(archive.lexicon.items[0].salience - expected) < 1e-9);
});

test('decayArchive：偏好衰减得比事件慢', () => {
  const a = archiveWith([entry('d1')]);
  a.relationship = { ...a.relationship, traits: [{ key: 'k', value: 'v', salience: 0.8 }] };
  const { archive } = decayArchive(a, { now });
  assert.ok(archive.relationship.traits[0].salience > archive.diary[0].salience);
});

test('decayArchive：落盘后 last_decay_at 前进，同一天再跑不会二次衰减', () => {
  const first = decayArchive(archiveWith([entry('d1')]), { now });
  const second = decayArchive(first.archive, { now });
  assert.equal(second.days, 0);
  assert.equal(second.changed, false);
  assert.equal(second.archive.diary[0].salience, first.archive.diary[0].salience);
});

test('normalizeDiaryEntry：recall_count 只收正整数，老条目读出来没有这个字段', () => {
  const fresh = normalizeDiaryEntry({ id: 'a', text: 'x', created_at: now });
  assert.equal('recall_count' in fresh, false);
  assert.equal('last_recalled_at' in fresh, false);

  const counted = normalizeDiaryEntry({ id: 'b', text: 'x', created_at: now, recall_count: 3.7, last_recalled_at: now });
  assert.equal(counted.recall_count, 3);
  assert.equal(counted.last_recalled_at, now);

  const zero = normalizeDiaryEntry({ id: 'c', text: 'x', created_at: now, recall_count: 0 });
  assert.equal('recall_count' in zero, false);

  const negative = normalizeDiaryEntry({ id: 'd', text: 'x', created_at: now, recall_count: -5 });
  assert.equal('recall_count' in negative, false);
});

test('normalizeDiaryEntry：未知 kind 退化成 chat', () => {
  assert.equal(normalizeDiaryEntry({ id: 'a', text: 'x', kind: '新类型' }).kind, 'chat');
  assert.equal(normalizeDiaryEntry({ id: 'a', text: 'x', kind: 'win' }).kind, 'win');
});
