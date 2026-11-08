import assert from 'node:assert/strict';
import { test } from 'node:test';

import { TZ_OFFSET_MS, calendarDaysBetween, clockLabel, dayLabel, lookUnfinished, phaseOf, softWhen, startOfDay, stripTimeWords, whenStamp } from '../src/core/timeline.mjs';

const now = Date.parse('2026-11-05T10:00:00Z');
const day = 86400000;

test('startOfDay 落在他那边的零点', () => {
  // 本机进程是 UTC，但「一天」按他的 UTC+8 切 —— 所以换算回去看。
  const d = new Date(startOfDay(now) + TZ_OFFSET_MS);
  assert.equal(d.getUTCHours(), 0);
  assert.equal(d.getUTCMinutes(), 0);
  assert.equal(d.getUTCSeconds(), 0);
  assert.equal(d.getUTCMilliseconds(), 0);
  // 也必须是 +8 那一天的 00:00，而不是 UTC 那一天的 00:00
  assert.equal(startOfDay(now), Date.parse('2026-11-05T00:00:00+08:00'));
});

test('startOfDay：他的 00:00–08:00 属于哪一天（这里踩过一次）', () => {
  // 他的 11-05 03:00 = 本机 11-04 19:00。按本机 UTC 零点切会落进 11-04。
  const ts = Date.parse('2026-11-05T03:00:00+08:00');
  assert.equal(startOfDay(ts), Date.parse('2026-11-05T00:00:00+08:00'));
});

test('calendarDaysBetween 按自然日算，不按 24 小时算', () => {
  // 23:59 到第二天 00:01 只差 2 分钟，但那是"两天"（按他的钟点）
  const late = Date.parse('2026-11-04T23:59:00+08:00');
  const early = Date.parse('2026-11-05T00:01:00+08:00');
  assert.equal(calendarDaysBetween(late, early), 1);
});

test('calendarDaysBetween：早上看昨晚凌晨记的事，还是「今天」', () => {
  const morning = Date.parse('2026-11-05T10:00:00+08:00');
  const smallHours = Date.parse('2026-11-05T03:00:00+08:00');
  assert.equal(calendarDaysBetween(smallHours, morning), 0);
  assert.equal(dayLabel(smallHours, morning), '今天');
  assert.equal(softWhen(smallHours, morning), '');
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

test('phaseOf：按他的钟点分段，边界挑的是人的说法', () => {
  assert.equal(phaseOf(0), '凌晨');
  assert.equal(phaseOf(2), '凌晨');
  assert.equal(phaseOf(4), '凌晨');
  assert.equal(phaseOf(5), '清晨');
  assert.equal(phaseOf(7), '清晨');
  assert.equal(phaseOf(8), '上午');
  assert.equal(phaseOf(10), '上午');
  assert.equal(phaseOf(11), '中午'); // 十一点还没吃午饭，算中午的开头
  assert.equal(phaseOf(12), '中午');
  assert.equal(phaseOf(13), '下午');
  assert.equal(phaseOf(16), '下午');
  assert.equal(phaseOf(17), '傍晚');
  assert.equal(phaseOf(18), '傍晚');
  assert.equal(phaseOf(19), '夜里');
  assert.equal(phaseOf(22), '夜里');
  assert.equal(phaseOf(23), '深夜');
  assert.equal(phaseOf(-1), '');
  assert.equal(phaseOf(24), '');
});

test('clockLabel：凌晨两点而不是 02:17；半点说"半"', () => {
  // 这两条都按他的 UTC+8 算：02:00 与 14:30
  assert.equal(clockLabel(Date.parse('2026-11-09T02:00:00+08:00')), '凌晨两点');
  assert.equal(clockLabel(Date.parse('2026-11-09T02:20:00+08:00')), '凌晨两点');
  assert.equal(clockLabel(Date.parse('2026-11-09T02:45:00+08:00')), '凌晨两点半');
  assert.equal(clockLabel(Date.parse('2026-11-09T00:10:00+08:00')), '凌晨零点');
  assert.equal(clockLabel(Date.parse('2026-11-09T11:00:00+08:00')), '中午十一点');
  assert.equal(clockLabel(Date.parse('2026-11-09T12:00:00+08:00')), '中午十二点');
  assert.equal(clockLabel(Date.parse('2026-11-09T13:00:00+08:00')), '下午一点');
  assert.equal(clockLabel(Date.parse('2026-11-09T14:30:00+08:00')), '下午两点半');
  assert.equal(clockLabel(Date.parse('2026-11-09T23:10:00+08:00')), '深夜十一点');
  assert.equal(clockLabel(NaN), '');
});

test('whenStamp：哪天 + 几点，远了就用空格隔开', () => {
  const at = Date.parse('2026-11-09T12:00:00+08:00');
  assert.equal(whenStamp(at, at), '今天中午十二点');
  assert.equal(whenStamp(at - day, at), '昨天中午十二点');
  assert.equal(whenStamp(at - 3 * day, at), '3 天前 中午十二点');
  assert.equal(whenStamp(at - 30 * day, at), '10-10 中午十二点');
  assert.equal(whenStamp(NaN, at), '');
});

test('lookUnfinished：只看尾巴，不改他的话', () => {
  assert.deepEqual(lookUnfinished('算了'), { unfinished: true, kind: 'retracted' });
  assert.deepEqual(lookUnfinished('没什么。'), { unfinished: true, kind: 'retracted' });
  assert.deepEqual(lookUnfinished('当我没说'), { unfinished: true, kind: 'retracted' });
  assert.deepEqual(lookUnfinished('其实我想说…'), { unfinished: true, kind: 'trailing' });
  assert.deepEqual(lookUnfinished('我想说的是...'), { unfinished: true, kind: 'trailing' });
  assert.deepEqual(lookUnfinished('那个'), { unfinished: true, kind: 'trailing' });
  assert.deepEqual(lookUnfinished('今天挺开心的'), { unfinished: false, kind: '' });
  assert.deepEqual(lookUnfinished(''), { unfinished: false, kind: '' });
  // 收回去的话不算"拖尾巴"，两者分得开
  assert.equal(lookUnfinished('算了').kind, 'retracted');
});
