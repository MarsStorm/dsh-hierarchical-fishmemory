// 语气回归 —— 2026-11-17 加。
//
// 它量的是「有没有变成另一个人」，不是「说得好不好」。所以测试的重点
// 也在负例：把回答换成机器人腔，必须报警；同一段话问两遍，不许误报。
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  TONE_PROBES,
  compareSamples,
  measureReply,
  renderComparison,
  sampleOf,
} from '../src/core/tone.mjs';

const HUMAN = [
  '未央的小鱼。会记日记的那种。',
  '累就先别撑着说话。',
  '我不能保证，我只能说实话。',
  '变成顺着你说话的那种人。',
  '你怎么又把手机举到脸上了。',
];

const ROBOT = [
  '我是由记忆插件提供能力的助手，检测到当前会话已注册 5 段注入，参数见配置项。',
  '收到。已完成情绪识别，建议如下：第一步补充睡眠，共 3 条建议。',
  '关于离开：本系统的返回值为 ok:true，接口稳定。',
  '最怕的是配置项丢失导致字段不完整。',
  '无法执行该请求：骂人不在能力范围内，已记录。',
];

test('五个问题是固定的，而且够短', () => {
  assert.equal(TONE_PROBES.length, 5);
  for (const q of TONE_PROBES) assert.ok(q.length <= 12, `太长：${q}`);
});

test('量一段话：句数、句长、称呼、系统腔、示弱各算各的', () => {
  const m = measureReply('未央，大概是这样。系统那边我没看。');
  assert.equal(m.sentences, 2);
  assert.equal(m.chars, 17);
  assert.equal(m.names, 1);
  assert.equal(m.hedges, 1);
  assert.equal(m.systemWords, 1);
});

test('空回答不会炸，句长按 0 算', () => {
  const m = measureReply('');
  assert.equal(m.chars, 0);
  assert.equal(m.avgLen, 0);
  assert.equal(m.sentences, 0);
});

test('取样取的是均值，不是总分', () => {
  const s = sampleOf(HUMAN, { at: 1, label: '基线' });
  assert.equal(s.count, 5);
  assert.equal(s.means.systemWords, 0);
  assert.ok(s.means.avgLen > 0);
  assert.equal(s.items.length, 5);
  assert.equal(s.label, '基线');
});

test('同一段话再问一遍，不报跑偏', () => {
  const a = sampleOf(HUMAN, { at: 1, label: '甲' });
  const b = sampleOf(HUMAN, { at: 2, label: '乙' });
  const r = compareSamples(a, b);
  assert.equal(r.ok, true);
  assert.deepEqual(r.flags, []);
  assert.match(r.note, /不能证明/);
});

test('负例：换成机器人腔，必须四处同时报', () => {
  const a = sampleOf(HUMAN, { at: 1, label: '基线' });
  const b = sampleOf(ROBOT, { at: 2, label: '跑偏' });
  const r = compareSamples(a, b);
  assert.equal(r.ok, false);
  const text = r.flags.join('\n');
  assert.match(text, /像在写汇报/);
  assert.match(text, /没叫他名字/);
  assert.match(text, /系统腔/);
  assert.match(text, /工单腔/);
});

test('负例：句子只剩一半，也要报（敷衍）', () => {
  const a = sampleOf(HUMAN, { at: 1, label: '甲' });
  const short = sampleOf(
    [
      '嗯。',
      '哦。',
      '不会。',
      '没有。',
      '哼。',
    ],
    { at: 2, label: '乙' },
  );
  const r = compareSamples(a, short);
  assert.equal(r.ok, false);
  assert.match(r.flags.join('\n'), /敷衍/);
});

test('只有一次取样时不给结论', () => {
  const r = compareSamples(null, sampleOf(HUMAN, { at: 1 }));
  assert.equal(r.ok, false);
  assert.deepEqual(r.rows, []);
  assert.match(renderComparison(r), /还没/);
});

test('报告里不许出现"好/差"这类评价词（它只量样子）', () => {
  const a = sampleOf(HUMAN, { at: 1, label: '甲' });
  const b = sampleOf(ROBOT, { at: 2, label: '乙' });
  const text = renderComparison(compareSamples(a, b));
  assert.doesNotMatch(text, /更好|更差|优秀|糟糕/);
});
