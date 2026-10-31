import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_LINE_CHARS, parseHandNote, selectHandNotes } from '../src/core/handnote.mjs';

test('parseHandNote：只认 "- " 开头的行，代码围栏内不算', () => {
  const text = [
    '# 手记',
    '',
    '- 第一条记忆。',
    '```',
    '- 这是示例，不算。',
    '```',
    '普通段落不算。',
    '- 第二条记忆。',
  ].join('\n');
  assert.deepEqual(parseHandNote(text), ['第二条记忆。', '第一条记忆。']);
});

test('parseHandNote：纯符号占位行不算内容', () => {
  assert.deepEqual(parseHandNote('- \n- -\n- 有字'), ['有字']);
});

test('手记没有条数上限：15 条全量返回', () => {
  const text = Array.from({ length: 15 }, (_, i) => `- 第 ${i + 1} 条`).join('\n');
  assert.equal(parseHandNote(text).length, 15);
  assert.equal(selectHandNotes(text).length, 15);
  // 最新的在最上面
  assert.equal(selectHandNotes(text)[0], '第 15 条');
});

test('显式传 limit 时才截断', () => {
  const text = Array.from({ length: 15 }, (_, i) => `- 第 ${i + 1} 条`).join('\n');
  assert.equal(selectHandNotes(text, 5).length, 5);
  assert.equal(selectHandNotes(text, 0).length, 0);
});

test('单行超过 240 字会被截断并加省略号', () => {
  const long = '字'.repeat(MAX_LINE_CHARS + 20);
  const [line] = parseHandNote(`- ${long}`);
  assert.equal(line.length, MAX_LINE_CHARS + 1);
  assert.ok(line.endsWith('…'));
});
