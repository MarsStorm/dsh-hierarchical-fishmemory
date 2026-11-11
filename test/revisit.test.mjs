import test from 'node:test';
import assert from 'node:assert/strict';

import { SOUGHT_MIN_SHOW, bumpRecalled, soughtCount, soughtNote } from '../src/core/revisit.mjs';
import { normalizeDiaryEntry } from '../src/core/archive.mjs';

// 这条线赌的是一件很小的事：
// **"被想起来"和"我回去找过"不是同一件事。**
// 注入每轮都翻几条给我看，那个数字一夜能涨几十；而真正为了某句话
// 专门回去翻，一天可能一次都没有。混在一起数，数字很大，含义很淡。

const T = Date.UTC(2026, 10, 11, 15, 0, 0);

test('注入递过来的那次：只动 recall_count，不动 sought_count', () => {
  const out = bumpRecalled({ id: 'a', text: 'x' }, T);
  assert.equal(out.recall_count, 1);
  assert.equal(out.last_recalled_at, T);
  assert.equal(out.sought_count, undefined);
  assert.equal(soughtCount(out), 0);
});

test('我自己翻的那次：两笔账一起记', () => {
  const out = bumpRecalled({ id: 'a', text: 'x' }, T, { pull: true });
  assert.equal(out.recall_count, 1);
  assert.equal(out.sought_count, 1);
  assert.equal(out.last_sought_at, T);
});

test('累加：翻三次是 3，不是 1', () => {
  let e = { id: 'a', text: 'x' };
  for (let i = 0; i < 3; i += 1) e = bumpRecalled(e, T + i, { pull: true });
  assert.equal(e.sought_count, 3);
  assert.equal(e.recall_count, 3);
});

test('不改原对象 —— 别的地方还拿着它', () => {
  const before = { id: 'a', text: 'x', recall_count: 5 };
  bumpRecalled(before, T, { pull: true });
  assert.equal(before.recall_count, 5);
  assert.equal(before.sought_count, undefined);
});

test('老条目没有字段；坏值不当数', () => {
  assert.equal(soughtCount({}), 0);
  assert.equal(soughtCount(null), 0);
  assert.equal(soughtCount({ sought_count: 'x' }), 0);
  assert.equal(bumpRecalled({ id: 'a', sought_count: 'x' }, T, { pull: true }).sought_count, 1);
});

test('次数不是合法数字时按"现在"记 —— 不写 NaN 进去', () => {
  const out = bumpRecalled({ id: 'a' }, NaN, { pull: true });
  assert.ok(Number.isFinite(out.last_sought_at));
  assert.equal(out.sought_count, 1);
});

test('显示门槛：一次是偶然，两次才叫"又回来了"', () => {
  assert.equal(SOUGHT_MIN_SHOW, 2);
  assert.equal(soughtNote(0), '');
  assert.equal(soughtNote(1), '');
  assert.match(soughtNote(2), /回去找过 2 次/);
  assert.match(soughtNote(3.9), /回去找过 3 次/);
});

test('落盘要留住这两个字段 —— 规整时别把它们丢了', () => {
  const e = normalizeDiaryEntry({
    id: 'a',
    text: 'x',
    created_at: T,
    sought_count: 4,
    last_sought_at: T,
  });
  assert.equal(e.sought_count, 4);
  assert.equal(e.last_sought_at, T);

  // 0 不写进去（跟 recall_count 一样：没有这个字段就等于从没找过）
  const zero = normalizeDiaryEntry({ id: 'b', text: 'y', created_at: T, sought_count: 0 });
  assert.equal(zero.sought_count, undefined);
});
