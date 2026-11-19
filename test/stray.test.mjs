// 孤儿半截文件 —— 原子写留下的垃圾。
//
// 写这份测试的重点全在**不能删错**：删掉一份正写到一半的 tmp 是数据事故，
// 漏删一个孤儿只是脏。所以每条判据都要有负例。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readdirSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { STRAY_MIN_AGE_MS, describeSweep, sweepStrayTmpFiles } from '../src/core/stray.mjs';

const NOW = Date.parse('2026-11-19T12:00:00Z');
const OLD = (NOW - 60 * 60 * 1000) / 1000; // 一小时前
const FRESH = (NOW - 1000) / 1000; // 一秒前

function makeDir() {
  return mkdtempSync(join(tmpdir(), 'fish-stray-'));
}

/** 写一个文件并把它 mtime 设成指定秒数。 */
function touch(dir, name, text, seconds) {
  const file = join(dir, name);
  writeFileSync(file, text);
  utimesSync(file, seconds, seconds);
  return file;
}

test('孤儿：老的、别的进程留下的，删掉', () => {
  const dir = makeDir();
  touch(dir, '日记.md.tmp-31810', 'x'.repeat(2048), OLD);
  const swept = sweepStrayTmpFiles(dir, { now: NOW, selfPid: 999 });
  assert.deepEqual(swept.removed, ['日记.md.tmp-31810']);
  assert.equal(swept.kept.length, 0);
  assert.equal(swept.bytes, 2048);
  assert.deepEqual(readdirSync(dir), []);
});

test('孤儿：自己这个 pid 的，一个都不许碰', () => {
  const dir = makeDir();
  touch(dir, '日记.md.tmp-999', '正在写', OLD); // 老，但 pid 是我
  const swept = sweepStrayTmpFiles(dir, { now: NOW, selfPid: 999 });
  assert.equal(swept.removed.length, 0);
  assert.deepEqual(readdirSync(dir), ['日记.md.tmp-999']);
});

test('孤儿：刚出现的先留着 —— 可能是另一个实例正写到一半', () => {
  const dir = makeDir();
  touch(dir, '日记.md.tmp-4242', 'half', FRESH);
  const swept = sweepStrayTmpFiles(dir, { now: NOW, selfPid: 999 });
  assert.equal(swept.removed.length, 0);
  assert.deepEqual(swept.kept, ['日记.md.tmp-4242']);
});

test('孤儿：时间窗本身也是负例 —— 把 minAgeMs 调到 0 才会删新鲜的', () => {
  const dir = makeDir();
  touch(dir, '日记.md.tmp-4242', 'half', FRESH);
  const swept = sweepStrayTmpFiles(dir, { now: NOW, selfPid: 999, minAgeMs: 0 });
  assert.deepEqual(swept.removed, ['日记.md.tmp-4242'], '证明上面那条真的是被时间窗挡住的，不是别的原因');
});

test('孤儿：普通文件、别的后缀，一概不动', () => {
  const dir = makeDir();
  touch(dir, '日记.md', '真档案', OLD);
  touch(dir, '纸条.md', '真档案', OLD);
  touch(dir, '日记.md.tmp', '没有 pid 后缀', OLD);
  touch(dir, '日记.md.bak-20261117', '备份', OLD);
  const swept = sweepStrayTmpFiles(dir, { now: NOW, selfPid: 999 });
  assert.equal(swept.removed.length, 0);
  assert.equal(readdirSync(dir).length, 4);
});

test('孤儿：目录不存在就安静返回，不抛', () => {
  const swept = sweepStrayTmpFiles(join(tmpdir(), '根本没有这个目录-fish-stray'), { now: NOW });
  assert.deepEqual(swept, { removed: [], kept: [], bytes: 0 });
});

test('孤儿：默认时间窗是 10 分钟', () => {
  assert.equal(STRAY_MIN_AGE_MS, 10 * 60 * 1000);
});

test('孤儿：没删着东西就不吭声（日志里不该天天有一行"清了 0 个"）', () => {
  assert.equal(describeSweep({ removed: [], kept: [], bytes: 0 }), '');
  assert.equal(describeSweep(undefined), '');
});

test('孤儿：删掉的时候说清是什么、多大', () => {
  const line = describeSweep({ removed: ['日记.md.tmp-31810'], kept: [], bytes: 79910 });
  assert.match(line, /清掉 1 个孤儿半截文件/);
  assert.match(line, /日记\.md\.tmp-31810/);
  assert.match(line, /78 KB/);
  assert.match(line, /进程被硬杀/);
});

test('孤儿：一次删多个，只报前三个名字', () => {
  const line = describeSweep({
    removed: ['a.tmp-1', 'b.tmp-2', 'c.tmp-3', 'd.tmp-4'],
    kept: [],
    bytes: 4096,
  });
  assert.match(line, /清掉 4 个/);
  assert.match(line, /等 4 个/);
  assert.ok(!line.includes('d.tmp-4'), '第四个名字不该列出来');
});