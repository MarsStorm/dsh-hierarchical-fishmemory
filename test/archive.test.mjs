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

// ── 2026-11-15（1.29.0）加：feedback 也必须活着走白名单 ──
//
// 同一个坑第三次了（summary 一次、sought_count 一次）。区别在于：
// 前两次丢的是"显示用的东西"，这次丢的是"依据"——
// 依据没了，衰减就会把有证据的条目和没证据的一视同仁地压下去。

test('normalizeDiaryEntry：feedback 要活着走出归一化', () => {
  const e = normalizeDiaryEntry({
    id: 'd1',
    text: '正文',
    feedback: [{ kind: 'reaffirmed', at: 1000, refs: ['d2'], reason: '他又说了一遍' }],
  });
  assert.equal(Array.isArray(e.feedback), true);
  assert.equal(e.feedback.length, 1);
  assert.equal(e.feedback[0].kind, 'reaffirmed');
  assert.deepEqual(e.feedback[0].refs, ['d2']);
});

test('normalizeDiaryEntry：feedback 里认不出的种类直接丢掉', () => {
  const e = normalizeDiaryEntry({
    id: 'd1',
    text: '正文',
    feedback: [
      { kind: 'exposure', at: 1, refs: ['x'] },
      { kind: 'helpful', at: 2, refs: ['y'] },
      '不是对象',
    ],
  });
  assert.equal(e.feedback.length, 1);
  assert.equal(e.feedback[0].kind, 'helpful');
});

test('normalizeDiaryEntry：feedback 的字段都被截住，坏 refs 不进来', () => {
  const e = normalizeDiaryEntry({
    id: 'd1',
    text: '正文',
    feedback: [{ kind: 'corrected', at: 'x', refs: ['a', 'b', 'c', 'd', 3], cue: '端'.repeat(50), reason: '理'.repeat(200) }],
  });
  const f = e.feedback[0];
  assert.equal(f.refs.length, 3, '依据最多三条');
  assert.ok(f.refs.every((r) => typeof r === 'string'));
  assert.ok(f.cue.length <= 20);
  assert.ok(f.reason.length <= 80);
  assert.equal(typeof f.at, 'number');
});

test('normalizeDiaryEntry：一条反馈都没有就别写这个字段', () => {
  assert.equal('feedback' in normalizeDiaryEntry({ id: 'd1', text: '正文', feedback: [] }), false);
  assert.equal('feedback' in normalizeDiaryEntry({ id: 'd2', text: '正文' }), false);
  assert.equal('feedback' in normalizeDiaryEntry({ id: 'd3', text: '正文', feedback: 'x' }), false);
});
