// 会过时的状态事实 —— 只标注，不删不隐藏。
//
// 这份测试要守的只有一条：**不许错标。**
// 错标会让一行真事看起来像过期的（我读到就会跳过它），
// 漏标只是没帮上忙。所以负例比正例多。
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  STALE_DEFAULT_DAYS,
  annotateStale,
  hasStaleMark,
  staleDays,
  stripStaleMark,
} from '../src/core/staleness.mjs';

const NOW = Date.parse('2026-11-19T12:00:00Z');

test('时效：标记本身认得出，天数默认 30', () => {
  assert.equal(STALE_DEFAULT_DAYS, 30);
  assert.equal(hasStaleMark('- 磁盘剩 3.7G ⟪时效⟫'), true);
  assert.equal(hasStaleMark('- 磁盘剩 3.7G'), false);
  assert.equal(staleDays('- a ⟪时效⟫'), 30);
});

test('时效：天数可以自己写，d / 天 / 纯数字都认', () => {
  assert.equal(staleDays('- a ⟪时效 7d⟫'), 7);
  assert.equal(staleDays('- a ⟪时效 7天⟫'), 7);
  assert.equal(staleDays('- a ⟪时效 7⟫'), 7);
  assert.equal(staleDays('- a ⟪时效 0d⟫'), 30, '0 天没意义，退回默认');
  assert.equal(staleDays('- a'), 0, '没标记就是 0，不是默认值');
});

test('时效：标记会从正文里去掉，不留符号在注入里', () => {
  assert.equal(stripStaleMark('- 磁盘剩 3.7G ⟪时效⟫'), '- 磁盘剩 3.7G');
  assert.equal(stripStaleMark('- 磁盘剩 3.7G ⟪时效 7d⟫'), '- 磁盘剩 3.7G');
  assert.equal(stripStaleMark('- 普通行'), '- 普通行');
});

test('时效：到期的那行加一句年龄，原文一个字不动', () => {
  const src = '## 2026-10-20 — 环境\n- 磁盘剩 3.7G ⟪时效⟫';
  const { text, stale } = annotateStale(src, { now: NOW });
  assert.match(text, /- 磁盘剩 3\.7G（记于 10-20，已经 30 天/);
  assert.match(text, /状态类的数可能变了，别当现在的用/);
  assert.equal(stale.length, 1);
  assert.equal(stale[0].days, 30);
  assert.equal(stale[0].limit, 30);
  assert.ok(!text.includes('⟪'), '符号不能留在注入里');
});

test('时效：没到期的只去掉符号，不加话', () => {
  const src = '## 2026-11-18 — 新\n- 刚测的 ⟪时效⟫';
  const { text, stale } = annotateStale(src, { now: NOW });
  assert.equal(text, '## 2026-11-18 — 新\n- 刚测的');
  assert.equal(stale.length, 0);
});

test('时效：自定 7 天的，7 天就算到期', () => {
  const src = '## 2026-11-12 — 端口\n- 这边的端口是 3080 ⟪时效 7d⟫';
  const { text, stale } = annotateStale(src, { now: NOW });
  assert.match(text, /已经 7 天/);
  assert.equal(stale[0].limit, 7);
});

test('时效：负例 —— 上面没有日期头就不标（宁可漏标，不可错标）', () => {
  const src = '- 磁盘剩 3.7G ⟪时效⟫';
  const { text, stale } = annotateStale(src, { now: NOW });
  assert.equal(text, '- 磁盘剩 3.7G', '符号去掉，但不加任何年龄');
  assert.equal(stale.length, 0);
});

test('时效：负例 —— 没有标记的普通行，一个都不碰', () => {
  const src = '## 2020-01-01 — 很久以前\n- 他喜欢下雨天\n- 我叫未央的小鱼';
  const { text, stale } = annotateStale(src, { now: NOW });
  assert.equal(text, src, '日期再老也不能替我改没标记的行');
  assert.equal(stale.length, 0);
});

test('时效：日期头只认行首的 ##，三级标题不算', () => {
  const src = '### 2026-10-20\n- 磁盘剩 3.7G ⟪时效⟫';
  const { stale } = annotateStale(src, { now: NOW });
  assert.equal(stale.length, 0, '### 不是日期头，算不出年龄');
});

test('时效：一行一个标记，多行各算各的', () => {
  const src = [
    '## 2026-10-20 — 环境',
    '- 磁盘剩 3.7G ⟪时效⟫',
    '- 普通一句',
    '## 2026-11-18 — 新',
    '- 版本号 1.38.0 ⟪时效 3d⟫',
  ].join('\n');
  const { text, stale } = annotateStale(src, { now: NOW });
  assert.equal(stale.length, 1, '只有 10-20 那行够老');
  assert.equal(stale[0].text, '- 磁盘剩 3.7G');
  assert.match(text, /- 普通一句\n/);
  assert.match(text, /- 版本号 1\.38\.0$/m, '11-18 那行只有 1 天，不标');
});

test('时效：空文本 / 一个标记都没有，原样返回', () => {
  assert.deepEqual(annotateStale('', { now: NOW }), { text: '', stale: [] });
  assert.deepEqual(annotateStale('- a\n- b', { now: NOW }), { text: '- a\n- b', stale: [] });
});

test('时效：日期头认到行就要往上看 —— 跨过空行与正文', () => {
  const src = '## 2026-10-20 — 环境\n\n- 磁盘剩 3.7G ⟪时效⟫\n';
  const { stale } = annotateStale(src, { now: NOW });
  assert.equal(stale.length, 1, '中间隔着空行也得认得出上面的日期');
});