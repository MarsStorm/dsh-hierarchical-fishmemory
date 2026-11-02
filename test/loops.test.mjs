import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { addLoop, doneLoop, loopsPath, openLoops, renderLoops } from '../src/core/loops.mjs';

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'fish-loops-'));
  return { dir, file: loopsPath(dir), done: () => rmSync(dir, { recursive: true, force: true }) };
}

test('空账本不渲染', () => {
  assert.equal(renderLoops([]), '');
});

test('记一件、读回来', () => {
  const box = sandbox();
  try {
    const { item, created } = addLoop(box.file, '给插件加记忆压缩');
    assert.equal(created, true);
    assert.ok(item.id);
    const open = openLoops(box.file);
    assert.equal(open.length, 1);
    assert.equal(open[0].text, '给插件加记忆压缩');
  } finally {
    box.done();
  }
});

test('同一句话记两次不重复', () => {
  const box = sandbox();
  try {
    addLoop(box.file, '同一件事');
    const again = addLoop(box.file, '同一件事');
    assert.equal(again.created, false);
    assert.equal(openLoops(box.file).length, 1);
  } finally {
    box.done();
  }
});

test('销账后不再出现', () => {
  const box = sandbox();
  try {
    addLoop(box.file, '写完 README');
    const result = doneLoop(box.file, 'README');
    assert.equal(result.done, true);
    assert.equal(openLoops(box.file).length, 0);
    const second = doneLoop(box.file, 'README');
    assert.equal(second.done, false);
  } finally {
    box.done();
  }
});

test('渲染带上条数、条数和尾行提示', () => {
  const box = sandbox();
  try {
    addLoop(box.file, '甲');
    addLoop(box.file, '乙');
    const text = renderLoops(openLoops(box.file));
    assert.match(text, /## 还挂着的事（2 件）/);
    assert.match(text, /- 甲/);
    assert.match(text, /- 乙/);
    assert.match(text, /loop_done/);
  } finally {
    box.done();
  }
});

test('超过 limit 时截断并提示还有几件', () => {
  const box = sandbox();
  try {
    for (let i = 0; i < 5; i += 1) addLoop(box.file, `第 ${i} 件`);
    const text = renderLoops(openLoops(box.file), { limit: 2 });
    assert.match(text, /还有 3 件/);
  } finally {
    box.done();
  }
});

test('坏 JSON 退化为空账本', () => {
  const box = sandbox();
  try {
    addLoop(box.file, '占位');
    assert.ok(readFileSync(box.file, 'utf8').length > 0);
    writeFileSync(box.file, '{oops');
    assert.deepEqual(openLoops(box.file), []);
  } finally {
    box.done();
  }
});
