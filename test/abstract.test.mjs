// 归并：让深层记忆能往回收。
//
// 守两件事：① 归并出来的那句必须是我写的（脚本不猜）；
// ② 原文一条都不能少 —— 只是不再进注入。
//
// 反例最容易出的地方：归并完把原文删了，于是"这条规律是从哪来的"永远查不到。

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MERGE_MIN,
  countMerged,
  isMergedLine,
  isRuleLine,
  mergeLine,
  mergeSection,
  planSections,
  renderSuggestion,
  splitMerged,
  stripMerged,
} from '../src/core/abstract.mjs';

const DOC = `
# 记忆系统

## 目录与文件

- 插件在 /root/projects/.dsh/plugins/dsh-hierarchical-fishmemory
- 深层在 soul-md/memory/<scope>/
- 档案在 feiyu-diary/

## 坑：会静默失败的那些

- 报告成功不等于真的成功（2026-11-09）
- 说「档案里没有」之前先 grep（2026-11-11）
- 工具 render 返回字符串会炸（2026-11-11）
- 时间用本机 UTC 会错一天（2026-11-05）
- 半句话收进册子漏了 import（2026-11-12）
- 冷档案不在 archive.diary 里（2026-11-11）
- 重载注释会被抹掉（2026-11-11）

## 短节

- 只有一条
`.trim();

test('盖章幂等：同一行盖两次还是一个章', () => {
  const once = mergeLine('- 某条记忆', { at: '2026-11-13' });
  const twice = mergeLine(once, { at: '2026-11-14' });
  assert.equal(twice, once);
  assert.match(once, /⟪归并 2026-11-13⟫/);
});

test('能认出被归并的行、以及规律行', () => {
  assert.equal(isMergedLine('- x ⟪归并 2026-11-13⟫'), true);
  assert.equal(isMergedLine('- x'), false);
  assert.equal(isRuleLine('- ⭐ 规律在这里'), true);
  assert.equal(isRuleLine('- 普通一条'), false);
});

test('splitMerged：把归并过的挑出来，其余原样留着', () => {
  const text = ['- a', '- b ⟪归并 2026-11-13⟫', '- c'].join('\n');
  const { live, merged } = splitMerged(text);
  assert.equal(live, ['- a', '- c'].join('\n'));
  assert.equal(merged.length, 1);
  assert.equal(merged[0].at, '2026-11-13');
  assert.equal(countMerged(text), 1);
  assert.equal(stripMerged(text), live);
});

test('planSections：数得清每节几条、哪一节该归了', () => {
  const plan = planSections(DOC);
  const byName = Object.fromEntries(plan.map((s) => [s.section, s]));
  assert.equal(byName['目录与文件'].live, 3);
  assert.equal(byName['坑：会静默失败的那些'].live, 7);
  assert.equal(byName['坑：会静默失败的那些'].need, true);
  assert.equal(byName['短节'].need, false, '一条的节不该被催');
  // 排在前面的是攒得最多的
  assert.equal(plan[0].section, '坑：会静默失败的那些');
});

test('renderSuggestion：说的是人话，不是系统腔', () => {
  const text = renderSuggestion(DOC);
  assert.match(text, /坑：会静默失败的那些/);
  assert.match(text, /7 条/);
  assert.match(text, /memory_abstract/);
  for (const bad of ['系统', '匹配项', '检索失败', '未找到', '阈值']) {
    assert.equal(text.includes(bad), false, `不该出现「${bad}」`);
  }
});

test('renderSuggestion：攒不够就一个字都不说', () => {
  const quiet = '## 一节\n\n- 一条\n- 两条\n';
  assert.equal(renderSuggestion(quiet), '');
});

test('mergeSection：原文一条不少，只是挂上章；规律行插在节首', () => {
  const r = mergeSection(DOC, { section: '坑', rule: '报缺陷之前先验，别凭印象', at: '2026-11-13' });
  assert.equal(r.hit, true);
  assert.equal(r.merged, 7);
  assert.equal(r.section, '坑：会静默失败的那些');

  // 规律行在这一节里，排在原文前面
  const lines = r.text.split('\n');
  const ruleIdx = lines.findIndex((l) => isRuleLine(l));
  const firstMergedIdx = lines.findIndex((l) => isMergedLine(l));
  assert.ok(ruleIdx > 0);
  assert.ok(ruleIdx < firstMergedIdx, '规律先说，原文在后');
  assert.match(lines[ruleIdx], /报缺陷之前先验，别凭印象/);
  assert.match(lines[ruleIdx], /由下面 7 条归并而来/);

  // 原文全在，只是带了章
  assert.equal(countMerged(r.text), 7);
  for (const keep of ['报告成功不等于真的成功', '先 grep', 'render 返回字符串', 'UTC 会错一天', 'import', 'archive.diary', '重载注释']) {
    assert.ok(r.text.includes(keep), `原文不该丢：「${keep}」`);
  }
});

test('mergeSection：别的节不受影响', () => {
  const r = mergeSection(DOC, { section: '坑', rule: '一句规律', at: '2026-11-13' });
  const part = r.text.split('## 目录与文件')[1].split('## ')[0];
  assert.equal(countMerged(part), 0);
});

test('mergeSection：条数不够就拒绝，文件一个字不动', () => {
  const r = mergeSection(DOC, { section: '短节', rule: '一句规律', at: '2026-11-13' });
  assert.equal(r.hit, false);
  assert.equal(r.merged, 0);
  assert.equal(r.text, DOC, '拒绝的时候必须原样返回');
  assert.match(r.why, /少于/);
});

test('mergeSection：归过一次之后，再归就没什么可归了', () => {
  const first = mergeSection(DOC, { section: '坑', rule: '一句规律', at: '2026-11-13' });
  const second = mergeSection(first.text, { section: '坑', rule: '另一句规律', at: '2026-11-14' });
  assert.equal(second.hit, false);
  assert.equal(second.text, first.text);
});

test('mergeSection：找不到那一节会说清楚，不猜', () => {
  const r = mergeSection(DOC, { section: '不存在的一节', rule: 'x' });
  assert.equal(r.hit, false);
  assert.match(r.why, /没找到/);
});

test('mergeSection：section / rule 空着直接拒绝', () => {
  assert.equal(mergeSection(DOC, { section: '', rule: 'x' }).hit, false);
  assert.equal(mergeSection(DOC, { section: '坑', rule: '  ' }).hit, false);
});

test('注入过滤：规律行留着，被归并的原文不出现', () => {
  const r = mergeSection(DOC, { section: '坑', rule: '报缺陷之前先验', at: '2026-11-13' });
  const injected = stripMerged(r.text);
  assert.match(injected, /⭐ 报缺陷之前先验/);
  assert.equal(injected.includes('报告成功不等于真的成功'), false);
  // 别的节照旧
  assert.match(injected, /插件在 \/root/);
});

test('归并和作废能叠在一条行上：作废章在前，归并章在后', () => {
  const line = '- 旧说法 ⟪作废 2026-11-11 → 改成新的⟫';
  const merged = mergeLine(line, { at: '2026-11-13' });
  assert.match(merged, /⟪作废 2026-11-11 → 改成新的⟫ ⟪归并 2026-11-13⟫$/);
  assert.equal(isMergedLine(merged), true);
});

test('默认门槛是 6 条 —— 低于这个数归并省的还没有它占的多', () => {
  assert.equal(MERGE_MIN, 6);
});

test('整份真实结构的空文件：不炸，也不催', () => {
  const r = mergeSection('', { section: '坑', rule: 'x' });
  assert.equal(r.hit, false);
  assert.deepEqual(planSections(''), []);
  assert.equal(renderSuggestion(''), '');
});

test('有序列表也算条目：真实 topic 里 1. 2. 是常态，只认 - 会漏掉一半', () => {
  const doc = ['## 坑', '', '1. 第一条', '2. 第二条', '3. 第三条', '- 第四条', '- 第五条', '- 第六条'].join('\n');
  const plan = planSections(doc);
  assert.equal(plan[0].live, 6);
  const r = mergeSection(doc, { section: '坑', rule: '一句规律', at: '2026-11-13' });
  assert.equal(r.hit, true);
  assert.equal(r.merged, 6);
  assert.equal(countMerged(r.text), 6);
});

test('同一主题被日期切成好几节：全部归掉，规律只写一条', () => {
  const doc = [
    '## 2026-11-10 — 原话库',
    '',
    '- a1', '- a2', '- a3', '- a4',
    '## 2026-11-11 — 原话库',
    '',
    '- b1', '- b2', '- b3',
    '## 别的东西',
    '',
    '- c1', '- c2', '- c3', '- c4', '- c5', '- c6',
  ].join('\n');
  const r = mergeSection(doc, { section: '原话库', rule: '查询要能说"没有"', at: '2026-11-13' });
  assert.equal(r.hit, true);
  assert.equal(r.merged, 7, '两节加起来 7 条 —— 单看哪一节都不够 6 条');
  assert.equal((r.text.match(/⭐/g) ?? []).length, 1, '规律只写一条');
  // 别的主题一条都没被碰
  assert.equal(r.text.includes('- c1'), true);
  assert.equal(isMergedLine('- c1'), false);
});

test('跨节归并时，规律行落在第一节的开头', () => {
  const doc = ['## 2026-11-10 — 主题', '', '- a1', '- a2', '- a3', '- a4', '- a5', '- a6', '## 2026-11-11 — 主题', '', '- b1'].join('\n');
  const r = mergeSection(doc, { section: '主题', rule: '规矩', at: '2026-11-13' });
  const lines = r.text.split('\n');
  assert.equal(lines[0], '## 2026-11-10 — 主题');
  assert.ok(isRuleLine(lines[2]), '紧跟标题与空行之后');
});
