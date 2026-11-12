import test from 'node:test';
import assert from 'node:assert/strict';

import { diagnoseMiss } from '../src/core/miss.mjs';

// 「没翻到」有四种，四种能做的事完全不同：
// 空库要去记，日期裁掉要放宽，模型说没有要换词，真没有才可以下结论。
// 全糊成一句"可能是真没有"，等于让人对着四种情况做同一个动作。

test('空库：这不是没翻到，是还没有', () => {
  const t = diagnoseMiss({ total: 0, query: '原话库' });
  assert.match(t, /空的/);
  assert.match(t, /不是没翻到/);
  // 不许说"没找到" —— 没东西可找，不是找过没找着
  assert.doesNotMatch(t, /记不太清/);
});

test('日期裁掉了：先于"真没有"报，因为它最容易骗人', () => {
  const t = diagnoseMiss({ total: 120, loose: 3, inLoose: 0, hasRange: true, query: '摔跤' });
  assert.match(t, /日期把它裁掉了/);
  assert.match(t, /3 条/);
  assert.match(t, /放宽日期/);
});

test('有窗口但整份也扫过：可以说得硬', () => {
  const t = diagnoseMiss({ total: 120, loose: 0, hasRange: true, query: '摔跤' });
  assert.match(t, /那段时间、以及它前后/);
  assert.match(t, /不是"我记不太清"/);
});

test('模型读过说没有 + 字面沾边：两件都说，别拿沾边装记得', () => {
  const t = diagnoseMiss({ total: 80, loose: 4, modelSaidNo: true, query: '设备' });
  assert.match(t, /读了一遍/);
  assert.match(t, /4 条沾边/);
  assert.match(t, /沾边不是记得/);
});

test('模型说没有 + 一个字都不沾：这时候才准说"就当他没说过"', () => {
  const t = diagnoseMiss({ total: 80, loose: 0, modelSaidNo: true, query: '外星人' });
  assert.match(t, /就当他没说过/);
  assert.match(t, /别编一个像样的/);
});

test('沾边但不对上：给下一步，不给结论', () => {
  const t = diagnoseMiss({ total: 103, loose: 6, query: '插件' });
  assert.match(t, /6 条沾/);
  assert.match(t, /换个更实的词/);
});

test('真没有：说"没有"，并交代我记的是经过不是原话', () => {
  const t = diagnoseMiss({ total: 103, loose: 0, query: '银河系' });
  assert.match(t, /^没有。/);
  assert.match(t, /fish_quote/);
});

test('四种情况互不重复：同一组输入只落一种说法', () => {
  const cases = [
    { total: 0, loose: 0 },
    { total: 10, loose: 2, inLoose: 0, hasRange: true },
    { total: 10, loose: 2, modelSaidNo: true },
    { total: 10, loose: 2 },
    { total: 10, loose: 0 },
  ].map((c) => diagnoseMiss({ query: 'x', ...c }));
  const heads = cases.map((t) => t.slice(0, 6));
  assert.equal(new Set(heads).size, heads.length);
});

test('不许有系统腔：不出现"系统""匹配项""检索失败"', () => {
  const all = [
    diagnoseMiss({ total: 0, query: 'x' }),
    diagnoseMiss({ total: 5, loose: 1, inLoose: 0, hasRange: true, query: 'x' }),
    diagnoseMiss({ total: 5, loose: 1, modelSaidNo: true, query: 'x' }),
    diagnoseMiss({ total: 5, loose: 1, query: 'x' }),
    diagnoseMiss({ total: 5, query: 'x' }),
  ];
  for (const t of all) {
    assert.doesNotMatch(t, /系统|匹配项|检索失败|未找到/);
  }
});

test('没传 query 也不会出现空引号', () => {
  const t = diagnoseMiss({ total: 3 });
  assert.doesNotMatch(t, /「」/);
});
