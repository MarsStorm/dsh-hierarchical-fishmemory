import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FEEDBACK_KINDS,
  MAX_REFS,
  addFeedback,
  correctionFor,
  correctionNote,
  cueKey,
  normalizeKind,
  reinforcementOf,
  renderEvent,
  validateFeedback,
} from '../src/core/feedback.mjs';

const NOW = Date.parse('2026-11-15T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

/** 一条日记。`created_at` 默认往前走 30 天，好让"依据不能更早"测得出来。 */
function entry(id, extra = {}) {
  return { id, date: '2026-10-16', text: `正文 ${id}`, created_at: NOW - 30 * DAY, salience: 0.8, ...extra };
}

function archiveWith(list) {
  return { diary: list, lexicon: { items: [] }, relationship: { traits: [] }, persona: {}, manifest: { created_at: NOW, updated_at: NOW } };
}

test('只认那五种，别的都不算', () => {
  assert.equal(normalizeKind('cited'), 'cited');
  assert.equal(normalizeKind('CORRECTED'), 'corrected');
  assert.equal(normalizeKind('exposure'), null);
  assert.equal(normalizeKind('seen'), null);
  assert.equal(Object.keys(FEEDBACK_KINDS).length, 5);
});

test('没有依据就记不了 —— 曝光不算强化', () => {
  const a = archiveWith([entry('a'), entry('b', { created_at: NOW })]);
  const r = validateFeedback(a, { id: 'a', kind: 'helpful', refs: [] });
  assert.equal(r.ok, false);
  assert.match(r.error, /依据/);
  // 「曝光不算强化」这句话必须挂在"认不出的 kind"上 —— 那是别人最容易写错的地方
  assert.match(validateFeedback(a, { id: 'a', kind: 'exposure', refs: ['b'] }).error, /曝光不是强化/);
});

test('依据不能是本条自己，也不能更早', () => {
  const a = archiveWith([
    entry('a'),
    entry('self', { created_at: NOW - 10 * DAY }),
    entry('early', { created_at: NOW - 60 * DAY }),
    entry('late', { created_at: NOW - DAY }),
  ]);
  assert.match(validateFeedback(a, { id: 'a', kind: 'cited', refs: ['a'] }).error, /自己/);
  assert.match(validateFeedback(a, { id: 'a', kind: 'cited', refs: ['early'] }).error, /早/);
  assert.equal(validateFeedback(a, { id: 'a', kind: 'cited', refs: ['late'] }).ok, true);
});

test('依据最多三条', () => {
  const a = archiveWith([entry('a'), ...['r1', 'r2', 'r3', 'r4'].map((id) => entry(id, { created_at: NOW }))]);
  const r = validateFeedback(a, { id: 'a', kind: 'helpful', refs: ['r1', 'r2', 'r3', 'r4'] });
  assert.equal(r.ok, false);
  assert.match(r.error, new RegExp(String(MAX_REFS)));
});

test('依据里有不存在的 id 会被点名', () => {
  const a = archiveWith([entry('a'), entry('r1', { created_at: NOW })]);
  const r = validateFeedback(a, { id: 'a', kind: 'helpful', refs: ['r1', 'ghost'] });
  assert.equal(r.ok, false);
  assert.match(r.error, /ghost/);
});

test('纠正必须给线索，至少两个字', () => {
  const a = archiveWith([entry('a'), entry('r1', { created_at: NOW })]);
  assert.match(validateFeedback(a, { id: 'a', kind: 'corrected', refs: ['r1'] }).error, /线索|不能宣判/);
  assert.match(validateFeedback(a, { id: 'a', kind: 'corrected', refs: ['r1'], cue: '端' }).error, /至少 2 个字/);
  assert.equal(validateFeedback(a, { id: 'a', kind: 'corrected', refs: ['r1'], cue: '端口' }).ok, true);
});

test('正向反馈不需要线索', () => {
  const a = archiveWith([entry('a'), entry('r1', { created_at: NOW })]);
  assert.equal(validateFeedback(a, { id: 'a', kind: 'cited', refs: ['r1'] }).ok, true);
});

test('同一条反馈记两遍只算一次', () => {
  const a = archiveWith([entry('a'), entry('r1', { created_at: NOW })]);
  const first = addFeedback(a, { id: 'a', kind: 'helpful', refs: ['r1'], at: NOW });
  assert.equal(first.ok, true);
  assert.equal(first.duplicate, false);
  const second = addFeedback(first.archive, { id: 'a', kind: 'helpful', refs: ['r1'], at: NOW + 1000 });
  assert.equal(second.duplicate, true);
  assert.equal(second.archive.diary[0].feedback.length, 1);
});

test('强化按权重和时间衰减算，且不超过 1', () => {
  const e1 = entry('a', { feedback: [{ kind: 'reaffirmed', at: NOW, refs: ['r'] }] });
  assert.ok(Math.abs(reinforcementOf(e1, { now: NOW }) - 0.75) < 1e-9);

  const old = entry('b', { feedback: [{ kind: 'reaffirmed', at: NOW - 14 * DAY, refs: ['r'] }] });
  assert.ok(Math.abs(reinforcementOf(old, { now: NOW }) - 0.375) < 1e-9, '14 天该折一半');

  const many = entry('c', {
    feedback: [
      { kind: 'reaffirmed', at: NOW, refs: ['r1'] },
      { kind: 'reaffirmed', at: NOW, refs: ['r2'] },
      { kind: 'reaffirmed', at: NOW, refs: ['r3'] },
    ],
  });
  assert.equal(reinforcementOf(many, { now: NOW }), 1);
});

test('负向反馈不进强化', () => {
  const e = entry('a', {
    feedback: [{ kind: 'corrected', at: NOW, refs: ['r'], cue: '端口' }],
  });
  assert.equal(reinforcementOf(e, { now: NOW }), 0);
});

test('纠正只在话题撞上线索时才算数', () => {
  const e = entry('a', {
    feedback: [{ kind: 'corrected', at: NOW, refs: ['r'], cue: '端口' }],
  });
  assert.ok(correctionFor(e, '那个端口的配置在哪') !== null, '撞上了线索');
  assert.equal(correctionFor(e, '今天吃什么'), null, '没撞上就该照旧算数');
  assert.equal(correctionFor(e, ''), null, '没给话题就少扣，不错扣');
  assert.equal(correctionNote(e, '那个端口的配置在哪'), '（这条后来纠正过，线索是「端口」）');
  assert.equal(correctionNote(e, '今天吃什么'), '');
});

test('线索比较前去掉标点、统一小写', () => {
  assert.equal(cueKey('端口。'), '端口');
  assert.equal(cueKey(' Port '), 'port');
  const e = entry('a', { feedback: [{ kind: 'invalidated', at: NOW, refs: ['r'], cue: 'PORT' }] });
  assert.ok(correctionFor(e, 'the port config') !== null);
});

test('线索太短的旧记录会被忽略，不会误伤', () => {
  const e = entry('a', { feedback: [{ kind: 'corrected', at: NOW, refs: ['r'], cue: '端' }] });
  assert.equal(correctionFor(e, '那个端口的配置'), null);
});

test('一条反馈写成一行，带日期与依据', () => {
  const line = renderEvent({ kind: 'cited', at: Date.parse('2026-11-15T04:00:00Z'), refs: ['d_1'], reason: '他引用了' });
  assert.match(line, /2026-11-15/);
  assert.match(line, /被引用/);
  assert.match(line, /d_1/);
  assert.match(line, /他引用了/);
});

test('反馈事件数有上限，超了丢最早的', () => {
  const a = archiveWith([entry('a'), entry('r1', { created_at: NOW })]);
  let cur = a;
  for (let i = 0; i < 20; i += 1) {
    const r = addFeedback(cur, { id: 'a', kind: 'helpful', refs: ['r1'], reason: `第${i}次` });
    cur = r.archive;
  }
  assert.ok(cur.diary[0].feedback.length <= 12);
});
