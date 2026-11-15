import assert from 'node:assert/strict';
import test from 'node:test';

import {
  QUOTE_MIN_CHARS,
  cleanQuote,
  findVerbatim,
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
