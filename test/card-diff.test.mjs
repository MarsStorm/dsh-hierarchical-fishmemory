import test from 'node:test';
import assert from 'node:assert/strict';
import { diffLines } from '../src/soul/card-diff.mjs';

test('相同文本没有差异', () => {
  const r = diffLines('a\nb\nc', 'a\nb\nc');
  assert.equal(r.total, 0);
  assert.deepEqual(r.lines, []);
});

test('只改一行时，- 是旧的、+ 是新的', () => {
  const r = diffLines('傲娇\n体贴', '傲娇\n温柔');
  assert.deepEqual(r.lines, ['- 体贴', '+ 温柔']);
  assert.equal(r.total, 2);
});

test('快照多一段时全是 + 行', () => {
  const r = diffLines('傲娇\n体贴', '傲娇\n体贴\n活泼');
  assert.deepEqual(r.lines, ['+ 活泼']);
});

test('当前多一段时全是 - 行', () => {
  const r = diffLines('傲娇\n爱记仇', '傲娇');
  assert.deepEqual(r.lines, ['- 爱记仇']);
});

test('limit 只截输出，total 仍是完整行数', () => {
  const r = diffLines('a\nb\nc\nd', 'w\nx\ny\nz', 2);
  assert.equal(r.lines.length, 2);
  assert.ok(r.total > 2);
});

test('空串与有内容也能比', () => {
  assert.deepEqual(diffLines('', 'x').lines, ['+ x']);
  assert.deepEqual(diffLines('x', '').lines, ['- x']);
});
