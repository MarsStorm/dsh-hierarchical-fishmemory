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
