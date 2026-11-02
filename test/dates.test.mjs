import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadDates, daysUntil, upcoming, renderDates, localDayNumber } from '../src/core/dates.mjs';

// 他的钟点：UTC+8。这里造的 now 一律按 UTC 写，好对得上。
const at = (iso) => new Date(iso);

test('今天就是 0 天', () => {
  assert.equal(daysUntil({ month: 11, day: 2 }, at('2026-11-01T16:30:00Z')), 0);
});

test('已过就顺延到明年', () => {
  assert.equal(daysUntil({ month: 11, day: 2 }, at('2026-11-02T17:00:00Z')), 364);
});

test('upcoming 只留 7 天内并排序', () => {
  const list = [
    { name: '远', month: 12, day: 25 },
    { name: '近', month: 11, day: 4 },
    { name: '今天', month: 11, day: 2 },
  ];
  const got = upcoming(list, { now: at('2026-11-01T16:30:00Z'), withinDays: 7 });
  assert.deepEqual(got.map((x) => x.name), ['今天', '近']);
});

test('renderDates 空列表返回空串，有条目就带标题与尾行', () => {
  assert.equal(renderDates([]), '');
  const text = renderDates([{ name: '未央的生日', month: 11, day: 2, days: 0, emoji: '🎂' }]);
  assert.match(text, /## 快到的日子/);
  assert.match(text, /未央的生日：就是今天/);
  assert.match(text, /我不能自己开口/);
});

test('loadDates 容忍坏文件与裸数组', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dates-'));
  const bad = join(dir, 'bad.json');
  writeFileSync(bad, '{ 不是 json');
  assert.deepEqual(loadDates(bad), []);

  const good = join(dir, 'good.json');
  writeFileSync(good, JSON.stringify([{ name: 'A', month: 1, day: 1 }]));
  assert.equal(loadDates(good).length, 1);
});

test('localDayNumber 按 UTC+8 切日', () => {
  // UTC 11-01 15:59 在他那边还是 11-01 23:59；16:00 就跨到 11-02 了
  assert.equal(localDayNumber(at('2026-11-01T15:59:00Z')) + 1, localDayNumber(at('2026-11-01T16:00:00Z')));
});
