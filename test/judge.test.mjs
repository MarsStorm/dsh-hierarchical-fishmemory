import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildJudgeInput, parseVerdict, WORK_NOTE_MAX } from '../src/core/judge.mjs';

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

// ── 2026-11-04：判断要看得见"我这一轮做了什么" ──
//
// 那一晚他说了「继续」「弄吧」，我干了五个功能、修了一个 bug，四次判断
// 四次判「不记」—— 因为它只看得见那两个字。活干得越多越不容易被记住。
test('buildJudgeInput：这一轮的产出进 system，不进 user', () => {
  const input = buildJudgeInput({
    lastUserText: '继续',
    workNote: '弄完了——五项全部落地，版本 1.9.0，测试从 87 涨到 196。',
  });
  assert.equal(input.user, '继续');
  assert.match(input.system, /这一轮我做了什么/);
  assert.match(input.system, /1\.9\.0/);
  assert.ok(!input.user.includes('1.9.0'));
});

test('buildJudgeInput：没有产出就不加那一段，别凭空多一段空话', () => {
  const input = buildJudgeInput({ lastUserText: '继续' });
  assert.equal(input.system.includes('这一轮我做了什么'), false);
});

test('buildJudgeInput：产出摘要截到 WORK_NOTE_MAX，别把整篇回复塞进去', () => {
  const input = buildJudgeInput({ lastUserText: 'x', workNote: '啊'.repeat(1000) });
  const head = input.system.slice(input.system.indexOf('这一轮我做了什么'));
  assert.ok(head.length <= WORK_NOTE_MAX + 40, `实际 ${head.length} 字`);
});

test('JUDGE_SYSTEM：写明了「他只说继续但我干了活也要记」', () => {
  const { system } = buildJudgeInput({ lastUserText: 'x' });
  assert.match(system, /继续/);
  assert.match(system, /要记的不是那句话，是那件事/);
});
