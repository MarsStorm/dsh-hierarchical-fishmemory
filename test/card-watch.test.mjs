// 人设卡「在设置页被改」时该留哪几份旧版。
//
// 从前这条路一份都不留：`soul_update` 覆盖前会存快照，但设置页直接写
// settings 文档，绕过那个工具 —— 于是手改一次，旧文本就永远没了。
// 现在靠这里判断。判断错了就是白丢后悔药，所以单独测。
import test from 'node:test';
import assert from 'node:assert/strict';

import { planCardSnapshots } from '../src/soul/card-watch.mjs';

test('正文变了：留旧的', () => {
  const out = planCardSnapshots({ 未央的小鱼: '旧的一版' }, { 未央的小鱼: '新的一版' });
  assert.deepEqual(out, [{ name: '未央的小鱼', text: '旧的一版' }]);
});

test('一点没动：不留', () => {
  assert.deepEqual(planCardSnapshots({ a: '同样的字' }, { a: '同样的字' }), []);
});

test('卡被删了：也留旧的 —— 删掉的那一版同样没处找', () => {
  const out = planCardSnapshots({ a: '要被删掉的卡' }, {});
  assert.deepEqual(out, [{ name: 'a', text: '要被删掉的卡' }]);
});

test('新加的卡：不留（它没有"旧的"）', () => {
  assert.deepEqual(planCardSnapshots({}, { 新卡: '第一版' }), []);
});

test('旧文本是空串：不留 —— 存下来也只是个空文件', () => {
  assert.deepEqual(planCardSnapshots({ a: '' }, { a: '后来写的' }), []);
});

test('旧文本不是字符串：跳过，不炸', () => {
  assert.deepEqual(planCardSnapshots({ a: undefined, b: '有字' }, { b: '改了' }), [
    { name: 'b', text: '有字' },
  ]);
});

test('几张卡同时改：每张各留一份，顺序跟原来的键序一致', () => {
  const out = planCardSnapshots({ 甲: '甲旧', 乙: '乙旧' }, { 甲: '甲新', 乙: '乙新' });
  assert.deepEqual(out.map((x) => x.name), ['甲', '乙']);
});

test('cards 整个是 undefined：当成空，不炸', () => {
  assert.deepEqual(planCardSnapshots(undefined, undefined), []);
  assert.deepEqual(planCardSnapshots({ a: '有字' }, undefined), [{ name: 'a', text: '有字' }]);
});
