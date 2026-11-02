import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBook } from '../src/core/export-md.mjs';

const backup = {
  meta: { pluginVersion: '1.6.0' },
  persona: { active: '小鱼', cards: { 小鱼: '你是小鱼。' } },
  deep: { 小鱼: { core: '核心事实一条。', topics: [{ key: 'env-ops', text: '环境坑一条。' }] } },
  diary: { jsonl: [{ date: '2026-11-02', kind: 'win', text: '修好了。' }], rendered: '' },
  feelings: '今天有点高兴。',
  handnote: '- 傲娇是壳。',
  shallow: '- (剩 7 天) 随口一句',
};

test('册子有标题与人设卡', () => {
  const md = buildBook(backup, { now: new Date('2026-11-03T00:00:00Z') });
  assert.match(md, /# 属于我们的回忆/);
  assert.match(md, /## 人设卡/);
  assert.match(md, /你是小鱼。/);
});

test('四本账各就各位，空的不占位', () => {
  const md = buildBook(backup);
  assert.match(md, /## 深层记忆/);
  assert.match(md, /## 共度时光/);
  assert.match(md, /## 情感日记/);
  assert.match(md, /## 人格手记/);
  assert.match(md, /## 浅层记忆/);
  const only = buildBook({ meta: {} });
  assert.doesNotMatch(only, /## 情感日记/);
});

/* ── 年册 ── */

const yearBackup = {
  meta: { pluginVersion: '1.7.1' },
  diary: {
    jsonl: [
      { date: '2025-12-31', text: '去年的尾巴。' },
      { date: '2026-01-05', text: '一月的事。' },
      { date: '2026-01-20', text: '还是正月。' },
      { date: '2026-03-02', text: '开春了。' },
    ],
  },
  feelings: '## 2025-12-31\n\n去年那一节。\n\n## 2026-01-05\n\n今年第一节。\n',
};

test('年册只收这一年的条目，按月分组', async () => {
  const { buildYearBook } = await import('../src/core/export-md.mjs');
  const md = buildYearBook(yearBackup, { year: '2026' });
  assert.match(md, /# 属于我们的回忆 · 2026 年/);
  assert.match(md, /## 2026-01/);
  assert.match(md, /## 2026-03/);
  assert.doesNotMatch(md, /2025-12-31/);
  assert.match(md, /- \*\*01-05\*\* 一月的事。/);
  assert.equal((md.match(/^## 2026-0\d/gm) ?? []).length, 2);
});

test('年册的情感日记也只留这一年', async () => {
  const { buildYearBook } = await import('../src/core/export-md.mjs');
  const md = buildYearBook(yearBackup, { year: '2026' });
  assert.match(md, /### 2026-01-05/);
  assert.doesNotMatch(md, /去年那一节/);
});

test('空年份写一句「还没有条目」，不报错', async () => {
  const { buildYearBook } = await import('../src/core/export-md.mjs');
  const md = buildYearBook({ diary: { jsonl: [] }, feelings: '' }, { year: '2019' });
  assert.match(md, /2019 年/);
  assert.match(md, /这一年还没有条目/);
});
