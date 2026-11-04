import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { listDiaryNames, listDiaryPaths, readJsonOrNull, readTextOrNull } from '../src/core/fsx.mjs';
import { SUPPRESS_RE } from '../src/core/gate.mjs';
import { renderDiaryFile, renderDiaryMarkdown } from '../src/core/render-diary.mjs';

const now = Date.parse('2026-11-05T00:00:00Z');

function tmp() {
  return mkdtempSync(join(tmpdir(), 'fish-fsx-'));
}

/* ── fsx ── */

test('readTextOrNull：读不到返回 null，不抛', () => {
  assert.equal(readTextOrNull(join(tmp(), '不存在.txt')), null);
  const dir = tmp();
  const file = join(dir, 'a.txt');
  writeFileSync(file, '内容');
  assert.equal(readTextOrNull(file), '内容');
});

test('readJsonOrNull：坏 JSON 也返回 null', () => {
  const dir = tmp();
  const file = join(dir, 'a.json');
  writeFileSync(file, '{不是 JSON');
  assert.equal(readJsonOrNull(file), null);
  writeFileSync(file, '{"ok":true}');
  assert.deepEqual(readJsonOrNull(file), { ok: true });
});

test('listDiaryNames：只认 .jsonl，排好序，目录不在就空数组', () => {
  const dir = tmp();
  assert.deepEqual(listDiaryNames(dir), []);

  mkdirSync(join(dir, 'diary'), { recursive: true });
  writeFileSync(join(dir, 'diary', '2026-11.jsonl'), '');
  writeFileSync(join(dir, 'diary', '2026-10.jsonl'), '');
  writeFileSync(join(dir, 'diary', 'manifest.json'), '{}');

  assert.deepEqual(listDiaryNames(dir), ['2026-10.jsonl', '2026-11.jsonl']);
  assert.deepEqual(listDiaryPaths(dir), [
    join(dir, 'diary', '2026-10.jsonl'),
    join(dir, 'diary', '2026-11.jsonl'),
  ]);
});

/* ── gate ── */

test('SUPPRESS_RE 认得出「别记」这一类说法', () => {
  for (const s of ['这个别记', '不要记这个', '别存了', '不用记', '忘掉这个', '删除记忆']) {
    assert.ok(SUPPRESS_RE.test(s), `「${s}」该被认出来`);
  }
});

test('SUPPRESS_RE 不误伤普通的话', () => {
  for (const s of ['记得吃饭', '我记性不好', '这个值得记下来']) {
    assert.equal(SUPPRESS_RE.test(s), false, `「${s}」不该被当成别记`);
  }
});

/* ── render-diary ── */

const archive = {
  manifest: { created_at: now - 5 * 86400000 },
  relationship: { nickname: '小鱼', traits: [{ key: 'k', value: '喜欢聊天', salience: 0.9 }] },
  lexicon: { items: [] },
  diary: [
    {
      id: 'd1',
      date: '2026-11-03',
      text: '他让我写个东西',
      kind: 'chat',
      salience: 0.8,
      created_at: now - 2 * 86400000,
    },
  ],
};

test('renderDiaryMarkdown：开头是标题，并且明说改了也没用', () => {
  const md = renderDiaryMarkdown(archive, { now });
  assert.ok(md.startsWith('# 共度时光'));
  assert.match(md, /改它没用/);
  assert.match(md, /jsonl/);
});

test('renderDiaryMarkdown：条数与昵称进了正文', () => {
  const md = renderDiaryMarkdown(archive, { now });
  assert.match(md, /记了 \*\*1\*\* 条/);
  assert.match(md, /小鱼/);
});

test('renderDiaryMarkdown：空档案不抛，照样出标题', () => {
  const md = renderDiaryMarkdown({}, { now });
  assert.ok(md.includes('# 共度时光'));
  assert.match(md, /记了 \*\*0\*\* 条/);
});

test('renderDiaryFile：末尾正好一个换行', () => {
  const text = renderDiaryFile(archive, { now });
  assert.ok(text.endsWith('\n'));
  assert.ok(!text.endsWith('\n\n'));
});
