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

// ── 续写超长：按句子截，不再整段丢（2026-11-10）──
//
// 原来一句「续写后超过 400 字，丢弃」就把补充整段扔掉，而补充的往往是
// "这件事的后半段"——前半句留了，重点没了。

import { applyConsolidation, clipAtSentence, parseSummaryResult } from '../src/core/consolidate.mjs';

test('clipAtSentence：优先停在句号上', () => {
  const text = '第一句说完了。第二句也说完了。第三句很长很长很长很长很长。';
  const cut = clipAtSentence(text, 12);
  assert.ok(cut.length <= 12);
  assert.ok(cut.endsWith('。'), `应该断在句号：${cut}`);
});

test('clipAtSentence：找不到句号就硬截，但绝不超过长度', () => {
  const cut = clipAtSentence('没有标点的一句话一直写下去写下去写下去', 8);
  assert.equal(cut.length, 8);
});

test('续写超长：留下前半段，不整段丢', () => {
  const base = '他让我查国内的额度。'.repeat(10); // 90 字
  const a = archiveWith([entry('d1', { text: base, turn: 1 })]);
  const parsed = {
    diary: { append: '后来我发现是国内站的额度是 0，所以每个请求都先失败再翻到国际站。'.repeat(12), salience: 0.7 },
  };
  const r = applyConsolidation(a, parsed, { now, session: 's1', extendId: 'd1' });
  assert.equal(r.appended, true, '应该续上了');
  const text = r.archive.diary[0].text;
  assert.ok(text.length > base.length, '正文确实变长了');
  assert.ok(text.includes('额度是 0'), '关键的后半句留住了');
  assert.ok(r.notes.some((n) => n.includes('按句子截')), `日志要说清楚截过：${r.notes.join(' / ')}`);
});

// ── 2026-11-13：整段 JSON 坏掉时把写完整的那几条捞回来 ──
//
// 日志里连着几天「这批一条都没解析出来（连续 3 次）」，一批 10 条全废。
// 最常见的坏法是输出被 maxTokens 截在半路，`JSON.parse` 必失败，但前面每一条都是好的。

test('parseSummaryResult：被截断的 JSON 也要把完整的条目捞回来', () => {
  const cut = '{"items":[{"id":"a1","summary":"第一条"},{"id":"a2","summary":"第二条"},{"id":"a3","summ';
  const map = parseSummaryResult(cut);
  assert.equal(map.size, 2);
  assert.equal(map.get('a1'), '第一条');
  assert.equal(map.get('a2'), '第二条');
  assert.equal(map.has('a3'), false, '半条不要');
});

test('parseSummaryResult：完整 JSON 的结果不变', () => {
  const map = parseSummaryResult('{"items":[{"id":"a1","summary":"一"}]}');
  assert.equal(map.size, 1);
  assert.equal(map.get('a1'), '一');
});

test('parseSummaryResult：一句人话都捞不出来时，就是空的（不编）', () => {
  assert.equal(parseSummaryResult('好的，我来总结一下这几条。').size, 0);
  assert.equal(parseSummaryResult('').size, 0);
  assert.equal(parseSummaryResult(null).size, 0);
});

test('parseSummaryResult：summary 里有引号、换行也不会切坏', () => {
  const raw = '{"items":[{"id":"a1","summary":"他说\\"别改了\\"\\n然后就睡了"}]}';
  const map = parseSummaryResult(raw);
  assert.equal(map.size, 1);
  assert.equal(map.get('a1'), '他说"别改了" 然后就睡了');
});

test('parseSummaryResult：截断 + 转义引号同时出现，捞回来的话仍然是原话', () => {
  const cut = '{"items":[{"id":"a1","summary":"他说\\"别改了\\""},{"id":"a2","summ';
  const map = parseSummaryResult(cut);
  assert.equal(map.get('a1'), '他说"别改了"');
});

test('parseSummaryResult：超长的 summary 截到 80 字', () => {
  const long = '很'.repeat(200);
  const map = parseSummaryResult(`{"items":[{"id":"a1","summary":"${long}"}]}`);
  assert.equal(map.get('a1').length, 80);
});
