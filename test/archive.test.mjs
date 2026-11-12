// 档案归一的边界：哪些字段能活着被写回磁盘。
//
// 这个文件之所以存在，是因为我在 1.25.1 才反应过来一件事：
// `normalizeDiaryEntry` 是**白名单**——它不认识的字段一律丢掉，而且一声不吭。
// 于是「补总结」算出来的摘要在内存里好好的，`persist()` 出门就没了，
// 磁盘上 114 条一条 `summary` 都没有，而日志每次都报「+10 条」。
//
// 加字段的人记得来这里加一行。

import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeDiaryEntry } from '../src/core/archive.mjs';

test('normalizeDiaryEntry：summary 要活着走出归一化', () => {
  const e = normalizeDiaryEntry({ id: 'd1', text: '正文', summary: '一句话摘要', created_at: 1 });
  assert.equal(e.summary, '一句话摘要');
});

test('normalizeDiaryEntry：summary 去掉换行、截到 80 字', () => {
  const e = normalizeDiaryEntry({ id: 'd1', text: '正文', summary: '一\n句\t话' + '很'.repeat(200) });
  assert.equal(e.summary.includes('\n'), false);
  assert.equal(e.summary.length, 80);
});

test('normalizeDiaryEntry：没有 summary 就不写这个字段（老档案照旧读）', () => {
  const e = normalizeDiaryEntry({ id: 'd1', text: '正文' });
  assert.equal('summary' in e, false);
  const empty = normalizeDiaryEntry({ id: 'd2', text: '正文', summary: '   ' });
  assert.equal('summary' in empty, false);
});

test('normalizeDiaryEntry：sought_count 也照样活着（1.21.0 那次的同一个坑）', () => {
  const e = normalizeDiaryEntry({ id: 'd1', text: '正文', sought_count: 3, last_sought_at: 123 });
  assert.equal(e.sought_count, 3);
  assert.equal(e.last_sought_at, 123);
});
