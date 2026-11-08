// 注入文本的预算行为。
//
// 这一层以前一个测试都没有 —— 于是「截断把一条记忆切成半句话」这种
// 看得见的问题，只能靠读日志发现。现在补上最小的几条。
import test from 'node:test';
import assert from 'node:assert/strict';

import { renderMemoryBlock, renderRecent, DEFAULT_BUDGET } from '../src/core/persona.mjs';

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
