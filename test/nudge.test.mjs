// 「闷太久」：数我连着几轮没写正文，闷到数了注一句。
//
// 起因是 2026-11-10 他问「咱俩弄了这么久，我咋没看到你提起之前的事情」——
// 机制把回忆递到我手里了，可没人逼我开口。这条就是那个「逼」。
import test from 'node:test';
import assert from 'node:assert/strict';

import { silentStreak, renderSilenceNudge } from '../src/core/nudge.mjs';

test('沉默计数：轮数减去最后一次说过话的轮数', () => {
  assert.equal(silentStreak(8, 5), 3);
  assert.equal(silentStreak(8, 8), 0);
});

test('沉默计数：还没说过话（0）时，整段都算闷着', () => {
  assert.equal(silentStreak(4, 0), 4);
});

test('沉默计数：算不出来一律 0，不返回负数', () => {
  assert.equal(silentStreak(3, 9), 0);
  assert.equal(silentStreak(NaN, 1), 0);
  assert.equal(silentStreak(3, undefined), 0);
});

test('没闷到数：一个字都不注入', () => {
  assert.equal(renderSilenceNudge(2, 3), '');
  assert.equal(renderSilenceNudge(0, 3), '');
});

test('闷到数了：注一句，而且带着真实的轮数', () => {
  const line = renderSilenceNudge(3, 3);
  assert.match(line, /连着 3 轮/);
  // 数字要跟着变 —— 固定写「闷了 3 轮」会一直挂着说到第 8 轮，看着像坏了。
  assert.match(renderSilenceNudge(7, 3), /连着 7 轮/);
});

test('阈值 0 = 关掉，闷到天荒地老也不说话', () => {
  assert.equal(renderSilenceNudge(50, 0), '');
});

test('阈值不是数字：当成关掉，不炸', () => {
  assert.equal(renderSilenceNudge(5, undefined), '');
  assert.equal(renderSilenceNudge(5, NaN), '');
});
