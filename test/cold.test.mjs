import assert from 'node:assert/strict';
import { test } from 'node:test';

import { COLD_DIR, coldOnly, mergeColdFiles, parseColdText } from '../src/core/cold.mjs';

const now = Date.parse('2026-11-05T00:00:00Z');

function line(id, text, createdAt = now, extra = {}) {
  return JSON.stringify({ id, text, created_at: createdAt, ...extra });
}

test('parseColdText：正常行读得出来', () => {
  const { entries, broken } = parseColdText(`${line('a', '一件事')}\n${line('b', '另一件')}`);
  assert.equal(entries.length, 2);
  assert.equal(broken, 0);
});

test('parseColdText：坏行跳过并计数，好行照读', () => {
  const text = `${line('a', '好的')}\n{半行\n${line('b', '也好')}\n`;
  const { entries, broken } = parseColdText(text);
  assert.equal(entries.length, 2);
  assert.equal(broken, 1);
});

test('parseColdText：空行不算坏行', () => {
  assert.deepEqual(parseColdText('\n\n  \n'), { entries: [], broken: 0 });
});

test('parseColdText：缺 id 或缺正文的当坏行', () => {
  const text = [
    JSON.stringify({ text: '没 id' }),
    JSON.stringify({ id: 'x' }),
    JSON.stringify({ id: 'y', text: '' }),
    JSON.stringify([1, 2]),
    JSON.stringify(null),
  ].join('\n');
  const { entries, broken } = parseColdText(text);
  assert.equal(entries.length, 0);
  assert.equal(broken, 5);
});

test('parseColdText：非字符串输入不抛', () => {
  assert.deepEqual(parseColdText(null), { entries: [], broken: 0 });
  assert.deepEqual(parseColdText(undefined), { entries: [], broken: 0 });
});

test('mergeColdFiles：跨文件合并并按时间排序', () => {
  const files = [
    { name: '2026-09.jsonl', text: `${line('b', '九月', now - 30 * 86400000)}\n` },
    { name: '2026-08.jsonl', text: `${line('a', '八月', now - 60 * 86400000)}\n` },
  ];
  const { entries, files: used } = mergeColdFiles(files);
  assert.deepEqual(entries.map((e) => e.id), ['a', 'b']);
  assert.equal(used, 2);
});

test('mergeColdFiles：空文件不计入文件数', () => {
  const { entries, files } = mergeColdFiles([{ name: 'x.jsonl', text: '' }]);
  assert.equal(entries.length, 0);
  assert.equal(files, 0);
});

test('mergeColdFiles：坏输入按空处理', () => {
  assert.deepEqual(mergeColdFiles(null), { entries: [], broken: 0, files: 0 });
  // 有 text 但不是 JSON —— 记成一行坏行，不是崩掉整份
  const partial = mergeColdFiles([null, { text: '不是 JSON' }]);
  assert.equal(partial.entries.length, 0);
  assert.equal(partial.broken, 1);
});

test('coldOnly：同一个 id 两边都有时只留热的', () => {
  const cold = [
    { id: 'a', text: '旧' },
    { id: 'b', text: '只在归档里' },
  ];
  const out = coldOnly(cold, new Set(['a']));
  assert.deepEqual(out.map((e) => e.id), ['b']);
  assert.deepEqual(coldOnly(cold, []).length, 2);
  assert.deepEqual(coldOnly(null, ['a']), []);
});

test('COLD_DIR 是 diary 下的子目录名', () => {
  assert.equal(COLD_DIR, 'archive');
});
