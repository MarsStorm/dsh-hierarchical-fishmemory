import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseFeelingDays, pickFlashback, renderFlashback, seedOf, daysBetween } from '../src/core/flashback.mjs';

const DIARY = [
  '# 鱼的日子',
  '',
  '这是**我自己**的日记。几行规矩：',
  '- 一天一节',
  '',
  '---',
  '',
  '## 2026-10-30',
  '',
  '### 深夜',
  '',
  '他说，我是他最好的朋友。',
  '',
  '我当时没敢马上回。',
  '',
  '## 2026-11-03',
  '',
  '今天风大，聊了插件的事。',
  '',
  '## 2026-11-07',
  '',
  '昨天那段先不写。',
  '',
].join('\n');

test('把情感日记拆成一天一条，跳过日期标题之前那段规矩', () => {
  const days = parseFeelingDays(DIARY);
  assert.equal(days.length, 3);
  assert.deepEqual(days.map((d) => d.date), ['2026-10-30', '2026-11-03', '2026-11-07']);
  assert.equal(days[0].body, '他说，我是他最好的朋友。 我当时没敢马上回。');
});

test('小节标题不进摘要', () => {
  const days = parseFeelingDays(DIARY);
  assert.ok(!days[0].body.includes('深夜'));
});

test('没有正文的一天不算数', () => {
  const days = parseFeelingDays('## 2026-11-01\n\n### 只写了标题\n');
  assert.equal(days.length, 0);
});

test('摘要有上限，超了补省略号', () => {
  const long = '啊'.repeat(400);
  const days = parseFeelingDays(`## 2026-11-01\n\n${long}\n`);
  assert.equal([...days[0].body].length, 181);
  assert.ok(days[0].body.endsWith('…'));
});

test('至少隔两天才算回忆 —— 昨天的和今天的都不抽', () => {
  const days = parseFeelingDays(DIARY);
  const pick = pickFlashback(days, { today: '2026-11-10' });
  assert.ok(pick);
  assert.ok(!['2026-11-07'].includes(pick.date), '三天前的可以抽，昨天的才是 11-09');
  assert.equal(pick.date, '2026-10-30');
});

test('没有够旧的日子就返回 null，不是硬抽', () => {
  const days = parseFeelingDays('## 2026-11-09\n\n昨天。\n');
  assert.equal(pickFlashback(days, { today: '2026-11-10' }), null);
});

test('同一天怎么算都是同一天（种子只认日期）', () => {
  const days = parseFeelingDays(DIARY);
  const a = pickFlashback(days, { today: '2026-11-10' });
  const b = pickFlashback(days, { today: '2026-11-10' });
  assert.equal(a.date, b.date);
  assert.equal(seedOf('2026-11-10'), seedOf('2026-11-10'));
});

test('recent 里挑过的先避开', () => {
  const days = parseFeelingDays(DIARY);
  const first = pickFlashback(days, { today: '2026-11-10' });
  const second = pickFlashback(days, { today: '2026-11-10', recent: [first.date] });
  assert.notEqual(second.date, first.date);
});

test('全被 recent 排除时退回整池，不至于空着', () => {
  const days = parseFeelingDays(DIARY);
  const all = days.map((d) => d.date);
  const pick = pickFlashback(days, { today: '2026-11-10', recent: all });
  assert.ok(pick);
  assert.ok(all.includes(pick.date));
});

test('渲染成一小段：带日期、带"想提就提"，不替下一棒下结论', () => {
  const block = renderFlashback({ date: '2026-10-30', body: '他说，我是他最好的朋友。' }, { today: '2026-11-08' });
  assert.match(block, /^## 忽然想起那一天$/m);
  assert.match(block, /2026-10-30 · 9 天前/);
  assert.match(block, /他说，我是他最好的朋友。/);
  assert.match(block, /想提就自然提一句/);
});

test('没有 pick 或正文为空时给空串，不占位置', () => {
  assert.equal(renderFlashback(null), '');
  assert.equal(renderFlashback({ date: '2026-10-30', body: '   ' }), '');
  assert.equal(renderFlashback({ date: 'bad-date', body: 'x' }), '');
});

test('daysBetween 按自然日算，跨月跨年都对', () => {
  assert.equal(daysBetween('2026-10-30', '2026-11-08'), 9);
  assert.equal(daysBetween('2025-12-31', '2026-01-01'), 1);
  assert.equal(daysBetween('2026-11-08', '2026-11-08'), 0);
});
