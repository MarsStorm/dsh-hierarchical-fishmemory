import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildJudgeInput, parseVerdict } from '../src/core/judge.mjs';

test('parseVerdict：认 yes / 是 / 记 / 要', () => {
  for (const raw of ['yes', '是', '记', '要', '是，值得记', '记：他在学驾驶']) {
    const v = parseVerdict(raw);
    assert.equal(v.keep, true, `「${raw}」该判成记`);
  }
});

test('parseVerdict：认 no / 不要 / 别记 / 不', () => {
  for (const raw of ['no', '不要', '别记', '不', 'no，是寒暄']) {
    const v = parseVerdict(raw);
    assert.equal(v.keep, false, `「${raw}」该判成不记`);
  }
});

test('parseVerdict：空回答默认记 —— 宁可多记', () => {
  const v = parseVerdict('');
  assert.equal(v.keep, true);
  assert.equal(v.parsed, false);
  assert.equal(parseVerdict(null).keep, true);
  assert.equal(parseVerdict(undefined).keep, true);
});

test('parseVerdict：认不出格式时也默认记，但 parsed=false', () => {
  const v = parseVerdict('这段话看不出结论，好像可以留一下');
  assert.equal(v.keep, true);
  assert.equal(v.parsed, false);
});

test('parseVerdict：明显否定但没有标准开头，也不当 yes', () => {
  const v = parseVerdict('no, nothing here');
  assert.equal(v.keep, false);
});

test('parseVerdict：理由截断到 40 字以内', () => {
  const long = `是${'很长的理由'.repeat(30)}`;
  assert.ok(parseVerdict(long).why.length <= 40);
});

test('parseVerdict：只看第一行', () => {
  const v = parseVerdict('no\n第二行写了 yes');
  assert.equal(v.keep, false);
});

test('buildJudgeInput：只给他这一句，不给整段对话', () => {
  const input = buildJudgeInput({ lastUserText: '  他今天去考驾照了  ' });
  assert.equal(input.user, '他今天去考驾照了');
  assert.ok(typeof input.system === 'string' && input.system.length > 0);
});

test('buildJudgeInput：手记作为补充判据进 system，不进 user', () => {
  const withNotes = buildJudgeInput({ lastUserText: 'x', handNotes: ['别记工作上的事', '  '] });
  assert.match(withNotes.system, /别记工作上的事/);
  assert.ok(!withNotes.user.includes('别记工作上的事'));

  const without = buildJudgeInput({ lastUserText: 'x', handNotes: [] });
  assert.equal(without.system.includes('补充：这个用户自己说过的话'), false);
});

test('buildJudgeInput：空输入不抛', () => {
  const input = buildJudgeInput();
  assert.equal(input.user, '');
  assert.ok(input.system.length > 0);
});
