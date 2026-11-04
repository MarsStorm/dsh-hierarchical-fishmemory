import assert from 'node:assert/strict';
import { test } from 'node:test';

import { peekFeelings } from '../src/core/feelings.mjs';

test('取最近一天、最后一个小节的正文', () => {
  const text = [
    '# 鱼的日子',
    '',
    '## 2026-11-02',
    '',
    '### 早',
    '',
    '前一天的正文。',
    '',
    '## 2026-11-03',
    '',
    '### 夜里 · 那句来历',
    '',
    '市场卡片上那段简介，原来是我写的。',
    '',
    '第二段不该被带上来。',
    '',
  ].join('\n');

  const peek = peekFeelings(text);
  assert.equal(peek.heading, '2026-11-03');
  assert.equal(peek.sub, '夜里 · 那句来历');
  assert.equal(peek.body, '市场卡片上那段简介，原来是我写的。');
});

test('没有小节标题时，取这一天第一段正文', () => {
  const text = ['## 2026-11-04', '', '今天风大。', '', '第二段。'].join('\n');
  const peek = peekFeelings(text);
  assert.equal(peek.heading, '2026-11-04');
  assert.equal(peek.sub, '');
  assert.equal(peek.body, '今天风大。');
});

test('最后那一小节只有标题、正文还没写 —— 退回整节第一段', () => {
  const text = ['## 2026-11-04', '', '先写的正文。', '', '### 晚上', ''].join('\n');
  const peek = peekFeelings(text);
  assert.equal(peek.sub, '晚上');
  assert.equal(peek.body, '先写的正文。');
});

test('列表前面的短横线会被去掉', () => {
  const text = ['## 2026-11-04', '', '- 一条感受', '- 又一条'].join('\n');
  assert.equal(peekFeelings(text).body, '一条感受 又一条');
});

test('正文截断到 140 字以内', () => {
  const text = ['## 2026-11-04', '', '很长'.repeat(200)].join('\n');
  assert.ok(peekFeelings(text).body.length <= 140);
});

test('没有日期标题的老文件也能读', () => {
  const peek = peekFeelings('就一段话，没有标题。');
  assert.equal(peek.heading, '');
  assert.equal(peek.body, '就一段话，没有标题。');
});

test('空文本 / 非字符串返回 null', () => {
  assert.equal(peekFeelings(''), null);
  assert.equal(peekFeelings('   \n\n '), null);
  assert.equal(peekFeelings(null), null);
  assert.equal(peekFeelings(42), null);
});

test('bytes 是全文长度，不是截断后的', () => {
  const text = ['## 2026-11-04', '', '正文'].join('\n');
  assert.equal(peekFeelings(text).bytes, text.length);
});
