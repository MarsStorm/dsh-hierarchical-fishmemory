// 待重试队列 —— 2026-11-10 补的一层：格式不合格的日记不再直接丢。
//
// 这条链断过一次，代价是三分之一轮次没写进档案，而日志只留一行 warn。
// 所以这里的测试重点不是"能存能取"，是"坏的不能连累好的"。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  PENDING_MAX,
  PENDING_TRIES,
  pendingCount,
  pendingPath,
  pushPending,
  readPending,
  requeuePending,
  takePending,
} from '../src/core/pending.mjs';

function tmp() {
  return pendingPath(mkdtempSync(join(tmpdir(), 'fish-pending-')));
}

test('push / read：一条进得去，读得出来', () => {
  const file = tmp();
  const { item } = pushPending(file, { raw: '{"diary":{"text":"半句话', reason: '花括号不闭合', at: 1000, session: 's1' });
  assert.ok(item);
  const items = readPending(file);
  assert.equal(items.length, 1);
  assert.equal(items[0].reason, '花括号不闭合');
  assert.equal(items[0].tries, 0);
  assert.equal(items[0].at, 1000);
});

test('空原文不收（没有内容可重试）', () => {
  const file = tmp();
  const { item } = pushPending(file, { raw: '   ' });
  assert.equal(item, null);
  assert.equal(pendingCount(file), 0);
});

test('take：先来先试，拿出来就从队列消失', () => {
  const file = tmp();
  pushPending(file, { raw: '第一条' });
  pushPending(file, { raw: '第二条' });
  const first = takePending(file);
  assert.equal(first.raw, '第一条');
  assert.equal(pendingCount(file), 1);
  assert.equal(takePending(file).raw, '第二条');
  assert.equal(takePending(file), null);
});

test('requeue：次数 +1 放回尾巴，试满就放弃', () => {
  const file = tmp();
  pushPending(file, { raw: '难看的一段' });
  let item = takePending(file);
  for (let i = 1; i < PENDING_TRIES; i += 1) {
    const r = requeuePending(file, item);
    assert.equal(r.kept, true, `第 ${i} 次失败还该留着`);
    assert.equal(r.tries, i);
    item = takePending(file);
  }
  const last = requeuePending(file, item);
  assert.equal(last.kept, false, '试满次数就认输');
  assert.equal(pendingCount(file), 0);
});

test('队满挤掉最老的，不是拒绝新的', () => {
  const file = tmp();
  for (let i = 0; i < PENDING_MAX + 3; i += 1) pushPending(file, { raw: `第 ${i} 条` });
  const items = readPending(file);
  assert.equal(items.length, PENDING_MAX);
  assert.equal(items[items.length - 1].raw, `第 ${PENDING_MAX + 2} 条`, '新的留住了');
  assert.equal(items[0].raw, '第 3 条', '最老的三条被挤掉');
});

test('文件里有坏行：跳过它，别让整条链路崩', () => {
  const file = tmp();
  pushPending(file, { raw: '好的一条' });
  writeFileSync(file, `${readFileSync(file, 'utf8')}{这不是 JSON}\n\n`, 'utf8');
  const items = readPending(file);
  assert.equal(items.length, 1);
  assert.equal(items[0].raw, '好的一条');
});

test('文件不存在：当空队列，不报错', () => {
  assert.deepEqual(readPending('/tmp/这个队列文件不存在-待重试.jsonl'), []);
  assert.equal(takePending('/tmp/这个队列文件不存在-待重试.jsonl'), null);
});
