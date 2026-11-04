import assert from 'node:assert/strict';
import { test } from 'node:test';

import { scrub } from '../src/core/privacy.mjs';

test('密钥无条件拦下，且 blocked 置真', () => {
  const r = scrub('我的 key 是 sk-abcdefghijklmnopqrstuvwx 别外传');
  assert.equal(r.blocked, true);
  assert.ok(!r.text.includes('sk-abcdefghijklmnopqrstuvwx'), r.text);
});

test('blocked=false 时不误报', () => {
  const r = scrub('他今天心情不错');
  assert.equal(r.blocked, false);
  assert.equal(r.text, '他今天心情不错');
});

test('手机号被泛化', () => {
  const r = scrub('打我电话 13800138000');
  assert.ok(!r.text.includes('13800138000'), r.text);
  assert.ok(r.hits.length > 0);
});

test('邮箱被泛化', () => {
  const r = scrub('发到 someone@example.com');
  assert.ok(!r.text.includes('someone@example.com'), r.text);
});

test('小额不进泛化 —— 生活细节要留住', () => {
  const r = scrub('买了 3 块钱的包子');
  assert.ok(r.text.includes('3 块钱'), r.text);
});

test('大额被泛化', () => {
  const r = scrub('这个月花了 5000 元');
  assert.ok(!r.text.includes('5000'), r.text);
  assert.ok(r.text.includes('一笔钱'), r.text);
});

test('amountThreshold 可调', () => {
  const r = scrub('花了 500 元', { amountThreshold: 10000 });
  assert.ok(r.text.includes('500'), r.text);
});

test('thirdParty:false 关掉弱信号，但密钥照拦', () => {
  const weak = scrub('王总说 5000 元', { thirdParty: false, amounts: false });
  assert.ok(weak.text.includes('王总'));

  const secret = scrub('key 是 sk-abcdefghijklmnopqrstuvwx', { thirdParty: false });
  assert.equal(secret.blocked, true);
});

test('幂等：同一段洗两次，结果一样', () => {
  const once = scrub('手机 13800138000，花了 5000 元');
  const twice = scrub(once.text);
  assert.equal(twice.text, once.text);
});

test('对空串与非字符串不抛', () => {
  assert.deepEqual(scrub(''), { text: '', hits: [], blocked: false });
  assert.equal(scrub(null).text, '');
  assert.equal(scrub(undefined).text, '');
  assert.equal(scrub(42).text, '');
});

test('hits 里带类别与次数', () => {
  const r = scrub('13800138000 和 13900139000');
  const total = r.hits.reduce((s, h) => s + h.count, 0);
  assert.ok(total >= 2, JSON.stringify(r.hits));
});
