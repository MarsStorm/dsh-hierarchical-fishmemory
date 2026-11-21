import assert from 'node:assert/strict';
import { test } from 'node:test';

import { trimTranscript, TRANSCRIPT_MAX_TURNS, TRANSCRIPT_MAX_TOKENS } from '../src/core/transcript.mjs';

const long = (n) => '啊'.repeat(n);

test('按条数裁：留最新的，丢最早那条', () => {
  const list = Array.from({ length: 45 }, (_, i) => ({ role: 'user', text: `第 ${i} 句` }));
  trimTranscript(list);
  assert.equal(list.length, TRANSCRIPT_MAX_TURNS);
  assert.equal(list[0].text, '第 5 句', '最早的 5 条该丢掉');
  assert.equal(list.at(-1).text, '第 44 句', '最新那条必须还在');
});

test('按 token 裁：几条特别长的消息会把最早的短对话挤出去', () => {
  // 每条 2500 汉字 ≈ 2500 token，三条就超 6000
  const list = [
    { role: 'user', text: long(2500) },
    { role: 'assistant', text: long(2500) },
    { role: 'user', text: long(2500) },
  ];
  trimTranscript(list);
  assert.equal(list.length, 2, '三条 2500 token 装不进 6000，要丢一条');
  assert.ok(
    list.every((m) => m.text.length === 2500),
    '留下的必须是完整消息 —— 这里不切消息内部（切了等于篡改他说过的话）',
  );
});

test('条数没超时，短对话一条都不动', () => {
  const list = Array.from({ length: 5 }, (_, i) => ({ role: 'user', text: `第 ${i} 句` }));
  trimTranscript(list);
  assert.equal(list.length, 5);
});

test('只剩一条超长消息时也留着 —— 全丢光比超一点更糟', () => {
  const list = [{ role: 'user', text: long(TRANSCRIPT_MAX_TOKENS * 3) }];
  trimTranscript(list);
  assert.equal(list.length, 1);
});

test('非数组原样返回，不抛', () => {
  assert.equal(trimTranscript(null), null);
  assert.equal(trimTranscript(undefined), undefined);
});

test('maxTurns / maxTokens 可以单独覆盖', () => {
  const list = Array.from({ length: 10 }, (_, i) => ({ role: 'user', text: `第 ${i} 句` }));
  trimTranscript(list, { maxTurns: 3 });
  assert.deepEqual(list.map((m) => m.text), ['第 7 句', '第 8 句', '第 9 句']);

  const big = [{ role: 'user', text: long(500) }, { role: 'user', text: long(500) }];
  trimTranscript(big, { maxTokens: 600 });
  assert.equal(big.length, 1);
});
