// 相似内容复核 —— 1.27.0 加的。
//
// 起因：我判「是不是同一个坑」「这几条能不能压成一句」，靠的都是字面相似度。
// 而最要命的地方恰恰不在相似上，在**差别**上：
//
//   「不要自动合并」/「要自动合并」—— 差一个字，意思相反。
//   「上限 200 字」/「上限 400 字」—— 差一倍。
//
// 这类差别一旦被抹平，事后完全看不出来。所以这里只做一件事：把它们数出来。
// 偷自 Memory-Continuity 的 `similarity-review.ts`（BSD-3-Clause）。
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { describeMarks, diffMarks, reviewPair, scanDifferences } from '../src/core/diffcheck.mjs';

test('否定词对不上：一条有、一条没有', () => {
  assert.deepEqual(diffMarks('不要自动合并记忆', '要自动合并记忆'), ['negation_difference']);
});

test('数字对不上：版本号也算', () => {
  assert.deepEqual(diffMarks('插件升到 1.26.0', '插件升到 1.25.3'), ['number_difference']);
});

test('两边都没有否定词：不算差别', () => {
  assert.deepEqual(diffMarks('先看日志再动代码', '先看日志，然后动代码'), []);
});

test('「差不多」「不过」这种不算否定差异 —— 比的是集合，不是有没有这个字', () => {
  // 两边各有一个「不」，集合相等 → 不报
  assert.deepEqual(diffMarks('差不多能用了', '差不多可以用'), []);
  // 一边多一个「不」才报
  assert.deepEqual(diffMarks('不过先别动', '先动'), ['negation_difference']);
});

test('reviewPair：改写的、同长度的算矛盾', () => {
  const r = reviewPair('不要自动合并记忆', '要自动合并记忆');
  assert.equal(r.conflict, true);
  assert.equal(r.kind, 'contradiction');
  assert.deepEqual(r.marks, ['negation_difference']);
});

test('reviewPair：明显加长的是补充，不是矛盾', () => {
  // 这一条是**用真实用例逼出来的**：同一个坑换个说法再记一次，
  // 多出来的半句里天然带「别」「没」这类词。要是照 diffMarks 一律挡，
  // 同一个坑就会被记成两条、次数永远到不了 2、**永远不会被注入**。
  // 那种"防御过度"比不防更坏 —— 因为它安静。
  const r = reviewPair(
    '报告成功和真的成功是两件事',
    '报告成功和真的成功是两件事，别急着报平安',
  );
  assert.equal(r.conflict, false);
  assert.equal(r.kind, 'elaboration');
  assert.deepEqual(r.marks, ['negation_difference'], '差别还是记下来的，只是不作为"矛盾"处理');
});

test('reviewPair：完全一样', () => {
  const r = reviewPair('先看日志再动代码', '先看日志再动代码');
  assert.equal(r.conflict, false);
  assert.equal(r.kind, 'same');
  assert.deepEqual(r.marks, []);
});

test('describeMarks：翻成人话，带上两条原文的片段', () => {
  const said = describeMarks(['number_difference'], { a: '上限 200 字', b: '上限 400 字' });
  assert.match(said, /数字对不上/);
  assert.match(said, /200/);
  assert.match(said, /400/);
  assert.equal(describeMarks([], {}), '');
});

test('scanDifferences：只报对不上的那些对', () => {
  const r = scanDifferences(['上限 200 字', '上限 400 字', '先看日志再动代码']);
  assert.equal(r.pairs.length, 1);
  assert.deepEqual(r.pairs[0].marks, ['number_difference']);
  assert.equal(r.complete, true);
});

test('scanDifferences：超出上限就老实说没查全', () => {
  // 不能一边少算一边假装算完了 —— 那是"看起来做了"。
  const many = Array.from({ length: 40 }, (_, i) => `第 ${i} 条`);
  const r = scanDifferences(many, { maxLines: 6 });
  assert.equal(r.complete, false, '只查了 6 条，就得说没查全');
});

test('scanDifferences：空输入不炸', () => {
  assert.deepEqual(scanDifferences([]), { pairs: [], examined: 0, complete: true });
  assert.deepEqual(scanDifferences(null), { pairs: [], examined: 0, complete: true });
});
