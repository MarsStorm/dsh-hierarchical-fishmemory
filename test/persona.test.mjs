// 注入文本的预算行为。
//
// 这一层以前一个测试都没有 —— 于是「截断把一条记忆切成半句话」这种
// 看得见的问题，只能靠读日志发现。现在补上最小的几条。
import test from 'node:test';
import assert from 'node:assert/strict';

import { renderMemoryBlock, renderRecent, renderRecalled, recallTone, DEFAULT_BUDGET } from '../src/core/persona.mjs';

const TZ = 8 * 3600 * 1000;
/** 构造某天的某个钟点（按他的时区） */
function at(dateStr, hh, mm = 0) {
  return Date.parse(`${dateStr}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+08:00`);
}

function entry(id, created_at, text) {
  return { id, created_at, text, kind: 'diary' };
}

test('最近的事：日期后面带钟点', () => {
  const now = at('2026-11-09', 2, 30);
  const recent = [entry('a', at('2026-11-09', 1, 30), '他把插件升到 1.11.0')];
  const text = renderRecent(recent, [], now);
  assert.equal(text, '- 今天凌晨一点半：他把插件升到 1.11.0');
});

test('预算装不下时整条丢，不从句子中间切', () => {
  // 8 条，每条都够长；预算只够几条 —— 关键断言：留下来的行必须是完整的。
  const now = at('2026-11-09', 2, 30);
  const recent = Array.from({ length: 8 }, (_, i) =>
    entry(
      `e${i}`,
      at('2026-11-09', 1, 0) - i * 60_000,
      `第 ${i} 条：他在凌晨两点还在问记忆插件的事，说到一半忽然问我要不要加个功能`,
    ),
  );
  const rendered = renderMemoryBlock({ recent, budget: 400, now });

  // 这一栏没有标题（2026-10-27 去掉了），所以只能靠行首的日期前缀认。

  const lines = rendered.text.split('\n').filter((l) => l.startsWith('- 今天') || l.startsWith('- 昨天'));
  assert.ok(lines.length > 0, '至少要留下一条，不然这条测试没验证到东西');
  for (const line of lines) {
    assert.ok(!line.includes('……'), `被切开的一行：${line}`);
    assert.ok(line.endsWith('功能'), `行尾不完整：${line}`);
  }
  assert.ok(rendered.trimmed.includes('recent'), '截断要走 trimmed，不是 dropped');
  assert.ok(!rendered.dropped.includes('recent'), '截断过就不该同时又报"整段丢了"');
});

test('预算够的时候一条都不少，也不报截断', () => {
  const now = at('2026-11-09', 2, 30);
  const recent = [entry('a', at('2026-11-09', 1, 30), '他说「按你的想法来呗」')];
  const rendered = renderMemoryBlock({ recent, budget: DEFAULT_BUDGET, now });
  assert.equal(rendered.trimmed.length, 0);
  assert.equal(rendered.dropped.length, 0);
  assert.ok(rendered.text.includes('按你的想法来呗'));
});

// ── 「最近的事」按天铺开（2026-11-10）──
//
// 原来 slice(-8)：一晚上聊 20 轮，那 8 条全是同一夜，前几天一条进不来。
// 于是"最近"变成了"上一场对话"。

import { pickRecent } from '../src/core/persona.mjs';

test('pickRecent：一晚上聊很多轮，也不会把前几天挤没', () => {
  const now = at('2026-11-10', 23, 0);
  const events = [];
  // 11-10 那晚 20 条
  for (let i = 0; i < 20; i += 1) {
    events.push(entry(`n${i}`, now - i * 60_000, `今晚第 ${i} 件事`));
  }
  // 前面四天，每天 2 条
  for (let d = 1; d <= 4; d += 1) {
    for (let k = 0; k < 2; k += 1) {
      events.push(entry(`d${d}_${k}`, now - d * 86_400_000 - k * 3600_000, `第 ${d} 天的事 ${k}`));
    }
  }
  events.sort((a, b) => a.created_at - b.created_at);

  const picked = pickRecent(events, 8);
  assert.equal(picked.length, 8);

  const days = new Set(picked.map((e) => new Date(e.created_at + TZ).toISOString().slice(0, 10)));
  assert.ok(days.size >= 4, `应该铺到好几天：${[...days].join(',')}`);

  const tonight = picked.filter((e) => e.id.startsWith('n')).length;
  assert.equal(tonight, 2, '同一晚最多留 2 条');
});

test('pickRecent：全都发生在一天，就照旧填满', () => {
  const now = at('2026-11-10', 23, 0);
  const events = Array.from({ length: 20 }, (_, i) =>
    entry(`n${i}`, now - i * 60_000, `今晚第 ${i} 件事`),
  ).sort((a, b) => a.created_at - b.created_at);
  const picked = pickRecent(events, 8);
  assert.equal(picked.length, 8, '凑不满时要按新旧补回来');
  assert.equal(picked[picked.length - 1].id, 'n0', '最新的必须在里面');
});

test('pickRecent：条数不够就原样返回', () => {
  const now = at('2026-11-10', 23, 0);
  const events = [entry('a', now - 1000, '一'), entry('b', now, '二')];
  assert.equal(pickRecent(events, 8).length, 2);
});

// ── 记不清这一档（2026-11-11）──
//
// 真实的反面不是"不够像人"，是"记得不承认"。
// 所以注入里的旧事不能全都一个口气：词真对上了的可以笃定，
// 走神摸出来的那句得自己松口。

test('说法：强匹配说得笃定', () => {
  const now = at('2026-11-11', 23, 0);
  const recalled = [{ entry: entry('a', now - 2 * 86400000, '他说想学着做饭'), why: '强匹配' }];
  const text = renderRecalled(recalled, now);
  assert.match(text, /前两天/);
  assert.ok(!text.includes('好像'), '有依据的那条不该写成好像');
});

test('说法：中等相似要留个余地', () => {
  const now = at('2026-11-11', 23, 0);
  const recalled = [{ entry: entry('a', now - 2 * 86400000, '他说想学着做饭'), why: '想起来一点' }];
  const text = renderRecalled(recalled, now);
  assert.match(text, /好像是前两天/);
});

test('说法：走神想起的那条明说是"忽然想起"', () => {
  const now = at('2026-11-11', 23, 0);
  const recalled = [{ entry: entry('a', now - 2 * 86400000, '他说想学着做饭'), why: '走神想起来的' }];
  const text = renderRecalled(recalled, now);
  assert.match(text, /忽然想起前两天的一件事/);
});

test('说法：没给 why 的（老调用方）按"好像"处理', () => {
  const now = at('2026-11-11', 23, 0);
  const text = renderRecalled([{ entry: entry('a', now - 86400000, '一件事') }], now);
  assert.match(text, /好像是前两天/);
});

test('recallTone：复合的 why 以"走神"为先', () => {
  assert.equal(recallTone('未解决 + 走神想起来的'), 'wander');
  assert.equal(recallTone('未解决 + 强匹配'), 'sure');
  assert.equal(recallTone('想起来一点'), 'faint');
  assert.equal(recallTone(undefined), 'faint');
});
