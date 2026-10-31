import test from 'node:test';
import assert from 'node:assert/strict';
import { enforceCapacity, pruneExpired, renderList, renderSection } from '../src/core/shallow.mjs';

const DAY = 86_400_000;
const entry = (over) => ({ id: `e${Math.random()}`, key: 'k', text: 't', tags: [], created: Date.now(), updated: Date.now(), hits: 1, ...over });
const store = (entries) => ({ version: 1, entries, expired: [] });

test('空库不产生注入噪音', () => {
  assert.equal(renderSection(store([]), {}), '');
});

test('有内容时渲染出标题与剩余天数', () => {
  const out = renderSection(store([entry({ text: '他喜欢白饭' })]), {});
  assert.match(out, /^## 浅层记忆 · 自动过期（7 天/);
  assert.match(out, /剩 7 天/);
  assert.match(out, /他喜欢白饭/);
});

test('超过 TTL 的条目过期并进 expired', () => {
  const s = store([entry({ text: '旧的', updated: Date.now() - 8 * DAY }), entry({ text: '新的' })]);
  const removed = pruneExpired(s, {});
  assert.equal(removed.length, 1);
  assert.equal(removed[0].text, '旧的');
  assert.equal(s.entries.length, 1);
  assert.equal(s.expired.length, 1);
  assert.ok(Number.isFinite(s.expired[0].expiredAt));
});

test('超量时挤掉最久没提到的并标 capacity', () => {
  const list = Array.from({ length: 15 }, (_, i) => entry({ id: `e${i}`, text: `第${i}条`, updated: Date.now() - i * 1000 }));
  const s = store(list);
  const removed = enforceCapacity(s, { maxEntries: 12 });
  assert.equal(removed.length, 3);
  assert.equal(s.entries.length, 12);
  assert.ok(s.expired.every((e) => e.reason === 'capacity'));
});

test('renderList 带 key，空库给出人话', () => {
  assert.equal(renderList(store([]), {}), '（浅层记忆是空的）');
  const out = renderList(store([entry({ key: '白饭', text: '他喜欢白饭' })]), {});
  assert.match(out, /\[key: 白饭\]/);
});
