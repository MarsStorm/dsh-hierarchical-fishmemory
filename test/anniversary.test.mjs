import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localDate, whenLabel, pickAnchors, renderAnchors } from '../src/core/anniversary.mjs';

// 他的钟点 UTC+8：11-07 23:30 北京时间 = 11-07T15:30Z
const now = Date.parse('2026-11-07T15:30:00Z');

test('localDate 按 UTC+8 切日：他的 03:00 属于当天，不是前一天', () => {
  assert.equal(localDate(Date.parse('2026-11-06T19:00:00Z')), '2026-11-07');
  assert.equal(localDate(Date.parse('2026-11-06T15:59:00Z')), '2026-11-06');
});

test('whenLabel：满一年说年，满一个月说月', () => {
  assert.equal(whenLabel('2025-11-07', '2026-11-07'), '1 年前的这天');
  assert.equal(whenLabel('2025-09-07', '2026-11-07'), '1 年前的这天');
  assert.equal(whenLabel('2026-10-07', '2026-11-07'), '1 个月前的这天');
  assert.equal(whenLabel('2026-11-05', '2026-11-07'), '2 天前的这天');
});

test('同月同日的往年条目被挑出来，近的在前', () => {
  const entries = [
    { date: '2024-11-07', text: '前年的今天' },
    { date: '2025-11-07', text: '去年的今天在装插件' },
    { date: '2026-11-06', text: '昨天的事，不该被挑' },
  ];
  const got = pickAnchors(entries, { now });
  assert.equal(got.onThisDay.length, 1); // 默认每档只给 1 条
  assert.equal(got.onThisDay[0].date, '2025-11-07');
  assert.equal(got.onThisDay[0].label, '1 年前的这天');
});

test('满一年的同月同日才算；两个月前的不算「一年前」', () => {
  const entries = [{ date: '2026-09-07', text: '两个月前的同一天' }];
  assert.deepEqual(pickAnchors(entries, { now }).onThisDay, []);
});

test('没有同月同日时，退到「一个月前的这几天」（28–35 天窗口）', () => {
  const entries = [
    { date: '2026-10-03', text: '35 天前，刚好在窗口边上' },
    { date: '2026-10-01', text: '37 天前，太远' },
  ];
  const got = pickAnchors(entries, { now });
  assert.deepEqual(got.onThisDay, []);
  assert.equal(got.lastMonth.length, 1);
  assert.equal(got.lastMonth[0].date, '2026-10-03');
  assert.equal(got.lastMonth[0].label, '一个月前的这天（10-03）');
});

test('今天/未来写的条目一律不挑', () => {
  const entries = [
    { date: '2026-11-07', text: '刚才写的' },
    { date: '2026-11-09', text: '未来的' },
  ];
  const got = pickAnchors(entries, { now });
  assert.deepEqual(got.onThisDay, []);
  assert.deepEqual(got.lastMonth, []);
});

test('判断（note）那一栏不从这儿绕回来', () => {
  const entries = [{ date: '2026-10-04', text: '规矩：先看日志', kind: 'note' }];
  assert.deepEqual(pickAnchors(entries, { now }).lastMonth, []);
});

test('正文压成一行并截断，不搬整段', () => {
  const entries = [{ date: '2026-10-04', text: '第一行\n- 列表项\n\n第二段不该出现' }];
  const got = pickAnchors(entries, { now });
  assert.equal(got.lastMonth[0].text, '第一行 列表项');

  const long = '一'.repeat(300);
  const cut = pickAnchors([{ date: '2026-10-04', text: long }], { now });
  assert.equal([...cut.lastMonth[0].text].length, 111); // 110 + …
  assert.ok(cut.lastMonth[0].text.endsWith('…'));
});

test('有「一年前」时不再重复给「一个月前」', () => {
  const entries = [
    { date: '2025-11-07', text: '去年的今天' },
    { date: '2026-10-04', text: '一个月前' },
  ];
  const text = renderAnchors(pickAnchors(entries, { now }));
  assert.match(text, /^## 那年今天/);
  assert.match(text, /1 年前的这天：去年的今天/);
  assert.doesNotMatch(text, /一个月前/);
});

test('什么都没有就返回空串，不占位置', () => {
  assert.equal(renderAnchors(pickAnchors([{ date: '2026-11-06', text: '昨天' }], { now })), '');
  assert.equal(renderAnchors({}), '');
});
