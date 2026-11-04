import assert from 'node:assert/strict';
import { test } from 'node:test';

import { calendarDaysBetween, dayLabel, softWhen, startOfDay, stripTimeWords } from '../src/core/timeline.mjs';

const now = Date.parse('2026-11-05T10:00:00Z');
const day = 86400000;

test('startOfDay 落在本地零点', () => {
  const d = new Date(startOfDay(now));
  assert.equal(d.getHours(), 0);
  assert.equal(d.getMinutes(), 0);
  assert.equal(d.getSeconds(), 0);
  assert.equal(d.getMilliseconds(), 0);
});

test('calendarDaysBetween 按自然日算，不按 24 小时算', () => {
  // 23:59 到第二天 00:01 只差 2 分钟，但那是"两天"
  const late = new Date(2026, 10, 4, 23, 59, 0).getTime();
  const early = new Date(2026, 10, 5, 0, 1, 0).getTime();
  assert.equal(calendarDaysBetween(late, early), 1);
});

test('calendarDaysBetween 对方向与非法输入的处理', () => {
  assert.equal(calendarDaysBetween(now - 3 * day, now), 3);
  assert.equal(calendarDaysBetween(now, now - 3 * day), -3);
  assert.equal(calendarDaysBetween(now, now), 0);
  assert.equal(calendarDaysBetween(NaN, now), 0);
  assert.equal(calendarDaysBetween(now, undefined), 0);
});

test('dayLabel：今天 / 昨天 / N 天前 / 月-日', () => {
  const start = startOfDay(now);
  assert.equal(dayLabel(start, now), '今天');
  assert.equal(dayLabel(start - day, now), '昨天');
  assert.equal(dayLabel(start - 3 * day, now), '3 天前');
  assert.equal(dayLabel(start - 6 * day, now), '6 天前');
  // 7 天及以上换成日期
  assert.match(dayLabel(start - 10 * day, now), /^\d{1,2}-\d{2}$/);
  assert.equal(dayLabel(NaN, now), '');
});

test('softWhen 语气含糊，但不跨过自然日的边界', () => {
  const start = startOfDay(now);
  assert.equal(softWhen(start, now), ''); // 今天不说什么"前两天"
  assert.equal(softWhen(start - day, now), '前两天');
  assert.equal(softWhen(start - 3 * day, now), '前两天');
  assert.equal(softWhen(start - 4 * day, now), '前阵子');
  assert.equal(softWhen(start - 14 * day, now), '前阵子');
  assert.equal(softWhen(start - 15 * day, now), '上个月前后');
  assert.equal(softWhen(start - 60 * day, now), '上个月前后');
  assert.equal(softWhen(start - 61 * day, now), '很久以前');
  assert.equal(softWhen(NaN, now), '');
});

test('stripTimeWords 摘掉句首的指示时间词', () => {
  assert.equal(stripTimeWords('今天他让我写个东西'), '他让我写个东西');
  assert.equal(stripTimeWords('昨天，我们讨论过这个'), '我们讨论过这个');
});

test('stripTimeWords 摘掉句中的指示时间词', () => {
  const out = stripTimeWords('他刚才说了那句，我记住了');
  assert.ok(!out.includes('刚才'), out);
  assert.ok(out.includes('我记住了'));
});

test('stripTimeWords 不会把一条记忆摘成空壳', () => {
  // 摘完只剩几个字时退回原文 —— 宁可留一个多余的"今天"
  const short = '今天好';
  assert.equal(stripTimeWords(short), short);
});

test('stripTimeWords 对非字符串返回空串', () => {
  assert.equal(stripTimeWords(null), '');
  assert.equal(stripTimeWords(undefined), '');
  assert.equal(stripTimeWords(42), '');
});

test('stripTimeWords 不动不含时间词的正文', () => {
  const text = '他把端口改成了 3080';
  assert.equal(stripTimeWords(text), text);
});
