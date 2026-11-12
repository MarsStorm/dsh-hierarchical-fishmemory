// 周结：七天压成一份，一天一行。
//
// 守两件事：① 周的范围按**他那边**的日历算（本机 UTC，他的 00:00–08:00 会掉进前一天）
// ② 空白的天要标出来 —— 那一周连着四天没记，本身就是那四天发生了什么。

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMaterial,
  dayKey,
  feelingsOfWeek,
  groupByDay,
  previousWeekKey,
  renderWeekly,
  weekKey,
  weekRange,
  weekSpan,
  weeklyPath,
} from '../src/core/weekly.mjs';

test('dayKey：按他那边算，UTC 深夜算作第二天', () => {
  // 2026-11-12T17:30Z = 他那边 11-13 01:30
  assert.equal(dayKey(Date.parse('2026-11-12T17:30:00Z')), '2026-11-13');
  // 2026-11-12T15:30Z = 他那边 11-12 23:30
  assert.equal(dayKey(Date.parse('2026-11-12T15:30:00Z')), '2026-11-12');
});

test('weekRange：2026-11-13 属于 W46，周一到周日七天', () => {
  const key = weekKey(Date.parse('2026-11-13T02:00:00Z'));
  assert.equal(key, '2026-W46');
  const r = weekRange(key);
  assert.equal(r.start, '2026-11-09');
  assert.equal(r.end, '2026-11-15');
  assert.deepEqual(r.days, [
    '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15',
  ]);
});

test('weekKey：跨年那一周不会算错', () => {
  // 2027-01-01 是他那边的周五，属于 2026-W53
  assert.equal(weekKey(Date.parse('2026-12-31T16:00:00Z')), '2026-W53');
  // 2026-01-01 是周四，属于 2026-W01
  assert.equal(weekKey(Date.parse('2026-01-01T04:00:00Z')), '2026-W01');
});

test('previousWeekKey：上一周', () => {
  assert.equal(previousWeekKey(Date.parse('2026-11-13T02:00:00Z')), '2026-W45');
});

test('weekSpan：从他那边周一 00:00 到周日结束', () => {
  const span = weekSpan('2026-W46');
  assert.equal(dayKey(span.from), '2026-11-09');
  assert.equal(dayKey(span.to), '2026-11-15');
});

test('weekRange：认不出的写法返回 null，不猜', () => {
  assert.equal(weekRange('上周'), null);
  assert.equal(weekRange('2026-W99'), null);
  assert.equal(weekRange(''), null);
});

test('groupByDay：只收那一周的，一天最多摊 3 条，挑分量大的', () => {
  const entries = [
    { text: '周一早上', created_at: Date.parse('2026-11-09T01:00:00Z'), salience: 1 },
    { text: '周一中午', created_at: Date.parse('2026-11-09T05:00:00Z'), salience: 5 },
    { text: '周一下午', created_at: Date.parse('2026-11-09T09:00:00Z'), salience: 9 },
    { text: '周一晚上', created_at: Date.parse('2026-11-09T13:00:00Z'), salience: 3 },
    { text: '上周的事', created_at: Date.parse('2026-11-08T05:00:00Z'), salience: 9 },
  ];
  const days = groupByDay(entries, '2026-W46');
  const monday = days.find((d) => d.day === '2026-11-09');
  assert.equal(monday.count, 4, '一共 4 条');
  assert.equal(monday.entries.length, 3, '只摊 3 条');
  assert.deepEqual(monday.entries.map((e) => e.text), ['周一中午', '周一下午', '周一晚上'], '按分量挑，再按时间排');
  assert.equal(days.some((d) => d.day === '2026-11-08'), false, '上周的不进来');
});

test('groupByDay：摊出来的顺序仍然按时间，早晚读起来才对', () => {
  const entries = [
    { text: '晚', created_at: Date.parse('2026-11-10T14:00:00Z'), salience: 1 },
    { text: '早', created_at: Date.parse('2026-11-10T01:00:00Z'), salience: 9 },
  ];
  const day = groupByDay(entries, '2026-W46').find((d) => d.day === '2026-11-10');
  assert.deepEqual(day.entries.map((e) => e.text), ['早', '晚']);
});

test('feelingsOfWeek：只挑那一周的小标题', () => {
  const md = [
    '# 鱼的日子',
    '## 2026-11-08',
    '### 深夜 · 上周的事',
    '## 2026-11-11',
    '### 深夜 · 把两本账分开',
    '### 凌晨 · 又一条',
    '## 2026-11-20',
    '### 深夜 · 下周的事',
  ].join('\n');
  const got = feelingsOfWeek(md, '2026-W46');
  assert.deepEqual(got.map((f) => f.title), ['深夜 · 把两本账分开', '凌晨 · 又一条']);
});

test('buildMaterial：空白的天要标出来，别装作什么都没发生', () => {
  const days = groupByDay([{ text: '只记了一条', created_at: Date.parse('2026-11-10T05:00:00Z') }], '2026-W46');
  const md = buildMaterial({ key: '2026-W46', days, feelings: [{ day: '2026-11-12', title: '深夜 · 一句' }] });
  assert.match(md, /2026-11-09：（这一天什么都没记下来）/);
  assert.match(md, /2026-11-10（1 条）/);
  assert.match(md, /只记了一条/);
  assert.match(md, /✎ 我那天写的：深夜 · 一句/);
  assert.match(md, /再传回 content/);
});

test('buildMaterial：没摊出来的条数要说清楚，别让人以为全在这儿了', () => {
  const entries = [1, 2, 3, 4, 5].map((i) => ({ text: `第${i}条`, created_at: Date.parse(`2026-11-10T0${i}:00:00Z`) }));
  const days = groupByDay(entries, '2026-W46', { perDay: 2 });
  const md = buildMaterial({ key: '2026-W46', days });
  assert.match(md, /还有 3 条没摊出来/);
});

test('renderWeekly：一天一行，缺的天数如实写在末尾', () => {
  const md = renderWeekly({
    key: '2026-W46',
    summary: '这一周在把记忆往回收。',
    lines: [
      { day: '2026-11-09', text: '他问我要不要装插件。' },
      { day: '2026-11-13', text: '归并做完了。' },
    ],
  });
  assert.match(md, /^# 周结 2026-11-09 ~ 2026-11-15/);
  assert.match(md, /> 这一周在把记忆往回收。/);
  assert.match(md, /- \*\*2026-11-09\*\* 他问我要不要装插件。/);
  assert.match(md, /- \*\*2026-11-13\*\* 归并做完了。/);
  assert.match(md, /（这一周有 5 天没写。）/);
  // 行序按日期，不按我传进来的顺序
  assert.ok(md.indexOf('2026-11-09') < md.indexOf('2026-11-13'));
});

test('renderWeekly：不在那一周里的日期不写进去（防止串周）', () => {
  const md = renderWeekly({ key: '2026-W46', lines: [{ day: '2026-11-20', text: '下周的' }] });
  assert.equal(md.includes('下周的'), false);
});

test('renderWeekly：周写错直接报错，不生成空文件', () => {
  assert.throws(() => renderWeekly({ key: '上周' }), /不认识的周/);
});

test('weeklyPath：一周一个文件', () => {
  assert.equal(weeklyPath('/root/projects/.dsh/feiyu-diary/', '2026-W46'), '/root/projects/.dsh/feiyu-diary/周结/2026-W46.md');
});
