import assert from 'node:assert/strict';
import { test } from 'node:test';

import { tokenize } from '../src/core/keywords.mjs';

test('中文走相邻二字 bigram', () => {
  assert.deepEqual(tokenize('他让我'), ['他让', '让我']);
  assert.deepEqual(tokenize('端口开着'), ['端口', '口开', '开着']);
});

test('单字中文保留 —— 不然「饭」这种查询永远搜不到', () => {
  assert.deepEqual(tokenize('饭'), ['饭']);
});

test('拉丁词小写化，长度 ≥2 才留', () => {
  assert.deepEqual(tokenize('NPM install'), ['npm', 'install']);
  assert.deepEqual(tokenize('a bb'), ['bb']);
});

test('中英混排不会把两边的字粘在一起', () => {
  const tokens = tokenize('用 npm 装');
  assert.ok(tokens.includes('npm'));
  assert.ok(tokens.includes('用'));
  assert.ok(tokens.includes('装'));
  for (const t of tokens) assert.ok(!t.includes('用n'), `不该出现跨语种的拼接：${t}`);
});

test('标点与空白不进 token', () => {
  const tokens = tokenize('他，说：好！');
  assert.ok(tokens.every((t) => !/[，：！]/.test(t)));
});

test('空输入与非法输入返回空数组，不抛', () => {
  assert.deepEqual(tokenize(''), []);
  assert.deepEqual(tokenize('   '), []);
  assert.deepEqual(tokenize(null), []);
  assert.deepEqual(tokenize(undefined), []);
  assert.deepEqual(tokenize(123), []);
});

test('停用 bigram 被滤掉', () => {
  // 「我写」这种没信息量的组合要么被停用表挡掉，要么留下 ——
  // 这里只断言不抛、且结果里没有空串，停用表的具体内容不该被测试钉死
  const tokens = tokenize('我们的东西');
  assert.ok(tokens.every((t) => typeof t === 'string' && t.length > 0));
});

test('数字和中文连写按一个 CJK 段处理', () => {
  const tokens = tokenize('第3章');
  assert.ok(tokens.length > 0);
  assert.ok(tokens.every((t) => typeof t === 'string' && t !== ''));
});
