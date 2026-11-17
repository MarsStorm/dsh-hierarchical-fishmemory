import assert from 'node:assert/strict';
import test from 'node:test';

import {
  QUOTE_MIN_CHARS,
  cleanQuote,
  findSpans,
  findVerbatim,
  locateQuote,
  renderSpans,
  renderVerdict,
  verifyQuote,
} from '../src/core/verbatim.mjs';

test('逐字：含就是含，不含就是不含', () => {
  assert.equal(verifyQuote('按你的想法来呗，这个设备能坚持很久', '按你的想法来呗'), true);
  assert.equal(verifyQuote('按你的想法来呗，这个设备能坚持很久', '按我想法来呗'), false);
  assert.equal(verifyQuote('按你的想法来呗', '想法来'), true);
});

test('改一个标点就不算逐字 —— 不许"差不多"', () => {
  assert.equal(verifyQuote('他说，行了别弄了。', '他说，行了别弄了'), true);
  assert.equal(verifyQuote('他说，行了别弄了。', '他说,行了别弄了'), false);
  // 全角半角也不算 —— 一改就不是原话
  assert.equal(verifyQuote('端口 3080', '端口3080'), false);
});

test('首尾空白和换行会清掉，中间的字一个都不动', () => {
  assert.equal(cleanQuote('  你好\n'), '你好');
  assert.equal(cleanQuote('你\n好'), '你\n好');
  assert.equal(verifyQuote('他说 你好', ' 你好 '), true);
});

test('少于两个字不算"逐字"，空串也不算', () => {
  assert.equal(verifyQuote('你好', '你'), false);
  assert.equal(verifyQuote('你好', ''), false);
  assert.equal(verifyQuote('', '你好'), false);
  assert.ok(QUOTE_MIN_CHARS >= 2);
});

test('在一堆原话里找逐字的那几句', () => {
  const lines = ['按你的想法来呗，这个设备能坚持很久', '那就试试吧', '行了别弄了'];
  const r = findVerbatim(lines, '这个设备');
  assert.equal(r.exact, true);
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0], '按你的想法来呗，这个设备能坚持很久');
});

test('找不到就是空数组，不退化成"意思相近"', () => {
  const lines = ['按你的想法来呗', '那就试试吧'];
  const r = findVerbatim(lines, '按我的想法');
  assert.deepEqual(r.hits, []);
});

test('太短的查询会明说太短，而不是报"没有"', () => {
  const r = findVerbatim(['你好'], '你');
  assert.equal(r.tooShort, true);
  assert.match(renderVerdict(r), /太短/);
});

test('「没有」就说没有，还得说清不是"意思相近的没找到"', () => {
  const text = renderVerdict({ quote: '量子纠缠', hits: [], tooShort: false });
  assert.match(text, /没有/);
  assert.match(text, /逐字没有/);
  // 这句说的是"不是意思相近的没找到，是逐字没有" —— 把两件事分开，
  // 免得他把"我没找到那几个字"读成"这件事没发生过"。
  assert.match(text, /不是.意思相近./);
});

test('有几句就说几句', () => {
  assert.match(renderVerdict({ quote: '你好', hits: ['a你好'], tooShort: false }), /就这一句/);
  assert.match(renderVerdict({ quote: '你好', hits: ['a你好', 'b你好'], tooShort: false }), /2 句/);
});

test('一句话都不许出现系统腔', () => {
  for (const v of [
    { quote: 'x', hits: [], tooShort: false },
    { quote: 'x', hits: ['x'], tooShort: false },
    { quote: 'x', hits: [], tooShort: true },
  ]) {
    const t = renderVerdict(v);
    assert.doesNotMatch(t, /系统|注入|检索|匹配项|未找到/);
  }
});

// ── 位置（2026-11-18，1.36.0）──
//
// 抄自 memory-brain 的 `derivation.py:141-147`：它校验的除了"含没含"，
// 还有"这个位置对不对"和"这句话是不是唯一的"。我只做行内定位，
// 因为我的原话一行就是一句，没有更细的粒度。

test('定位：给出起止，且端点自洽', () => {
  const line = '按你的想法来呗，这个设备能坚持很久';
  const span = locateQuote(line, '这个设备');
  assert.equal(span.start, 8); // 按(0)你(1)的(2)想(3)法(4)来(5)呗(6)，(7)这(8)
  assert.equal(span.end, 8 + 4);
  assert.equal(line.slice(span.start, span.end), '这个设备');
});

test('定位：没有就返回 null，不猜一个位置', () => {
  assert.equal(locateQuote('按你的想法来呗', '量子纠缠'), null);
  assert.equal(locateQuote('按你的想法来呗', '按'), null, '少于两个字不算');
  assert.equal(locateQuote('', '你好'), null);
});

test('同一行出现两次：有是确定的，位置不确定 —— 必须标出歧义', () => {
  const span = locateQuote('好的好的，那就这样', '好的');
  assert.ok(span, '还是找得到');
  assert.equal(span.ambiguous, true, '但要说清它出现了不止一次');
  // 只出现一次的不许乱标
  assert.equal(locateQuote('那就这样吧', '那就').ambiguous, false);
});

test('findSpans：每条命中都带位置，歧义条数单独数', () => {
  const r = findSpans(['那就这样吧', '那就试试吧', '行了别弄了'], '那就');
  assert.equal(r.hits.length, 2);
  assert.equal(r.ambiguous, 0, '每条都只出现一次');
  for (const h of r.hits) assert.equal(h.line.slice(h.start, h.end), '那就');

  // 同一行里出现两次的那一条，单独数进 ambiguous
  const dup = findSpans(['那就这样吧，那就', '那就试试吧'], '那就');
  assert.equal(dup.hits.length, 2);
  assert.equal(dup.ambiguous, 1);
});

test('findSpans：没有就空数组，不许编位置', () => {
  const r = findSpans(['按你的想法来呗'], '量子纠缠');
  assert.deepEqual(r.hits, []);
  assert.equal(r.ambiguous, 0);
});

test('位置话：有歧义时必须说出来，不能只报"有"', () => {
  const r = findSpans(['好的好的'], '好的');
  const t = renderSpans(r);
  assert.match(t, /不止一次/);
  assert.match(t, /说不准引的是哪一处/);
});

test('位置话：没有就说没有，不出现系统腔', () => {
  const t = renderSpans(findSpans(['你好'], '你好'));
  assert.doesNotMatch(t, /系统|注入|检索|匹配项|未找到/);
});
