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

test('快过期的条目在注入节末尾多一行提醒', async () => {
  const { renderSection } = await import('../src/core/shallow.mjs');
  const now = Date.now();
  const store = {
    entries: [
      { id: 'a', key: '快到期', text: '这条只剩一天了，内容也够长够长够长够长够长够长', tags: [], created: now - 6 * 86400000, updated: now - 6 * 86400000, hits: 2 },
      { id: 'b', key: '还早', text: '这条还早', tags: [], created: now, updated: now, hits: 1 },
    ],
  };
  const text = renderSection(store, { ttlDays: 7, warnDays: 2 });
  assert.match(text, /条浅层今天到期/);
  assert.match(text, /看着有分量/);
});

test('没有快过期的条目就不加提醒行', async () => {
  const { renderSection } = await import('../src/core/shallow.mjs');
  const now = Date.now();
  const store = { entries: [{ id: 'c', key: '新', text: '刚记的', tags: [], created: now, updated: now, hits: 1 }] };
  const text = renderSection(store, { ttlDays: 7, warnDays: 2 });
  assert.doesNotMatch(text, /今天到期/);
});

/* ── 到期前升格 ── */

async function withShallow(promote, run) {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { registerShallow } = await import('../src/core/shallow.mjs');
  const dir = await mkdtemp(join(tmpdir(), 'shallow-'));
  const tools = new Map();
  const scope = {
    effect: (fn) => fn(),
    tools: { register: (tool) => { tools.set(tool.name, tool); return () => {}; } },
  };
  const ctx = {
    effect: (fn) => fn(),
    systemPrompt: { section: () => {} },
    on: () => {},
    inject: (_deps, fn) => fn(scope),
  };
  const storeFile = join(dir, 'shallow.json');
  registerShallow(ctx, { file: storeFile, promote });
  try {
    return await run(tools, dir, storeFile);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('升格：交给宿主落地，成功后从浅层删掉', async () => {
  const calls = [];
  await withShallow(async (payload) => { calls.push(payload); return { written: 'diary/2026-11.jsonl' }; }, async (tools, dir, storeFile) => {
    await tools.get('shallow_note').execute({ text: '他说过想学做饭', key: '做饭' });
    const out = await tools.get('shallow_promote').execute({ key: '做饭' });
    assert.equal(out.ok, true);
    assert.equal(out.to, 'diary');
    assert.equal(out.count, 0);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].text, '他说过想学做饭');
    // 文件里也真的没了，不只是返回值说没了
    const { readFile } = await import('node:fs/promises');
    const store = JSON.parse(await readFile(storeFile, 'utf8'));
    assert.equal(store.entries.length, 0);
  });
});

test('升格：key 找不到时说清楚，不改动浅层', async () => {
  await withShallow(async () => ({ written: 'x' }), async (tools) => {
    await tools.get('shallow_note').execute({ text: '留着不动', key: '在的' });
    await assert.rejects(() => tools.get('shallow_promote').execute({ key: '不在的' }), /浅层里没有/);
  });
});

test('升格：to 只认 diary / memory', async () => {
  await withShallow(async () => ({ written: 'x' }), async (tools) => {
    await tools.get('shallow_note').execute({ text: '一句话', key: 'k' });
    await assert.rejects(() => tools.get('shallow_promote').execute({ key: 'k', to: 'trash' }), /diary 或 memory/);
  });
});
