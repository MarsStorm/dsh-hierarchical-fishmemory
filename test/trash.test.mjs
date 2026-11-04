import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULT_KEEP_DAYS,
  appendTrashRecord,
  buildTrashRecord,
  daysLeft,
  describeTrashRecord,
  findTrashRecord,
  parseTrash,
  pruneTrash,
  serializeTrash,
} from '../src/core/trash.mjs';

const now = Date.parse('2026-11-05T00:00:00Z');
const day = 86400000;

test('buildTrashRecord：缺 label 时从正文推，推不出来就给个明确的话', () => {
  const withText = buildTrashRecord({ kind: 'diary', payload: { id: 'x', text: '  他说  端口  是  3080 ' }, at: now });
  assert.equal(withText.label, '他说 端口 是 3080');

  const empty = buildTrashRecord({ kind: 'diary', payload: { id: 'y', text: '' }, at: now });
  assert.equal(empty.label, '（没有正文）');
});

test('buildTrashRecord：kind 只认 diary / line，别的一律当 diary', () => {
  assert.equal(buildTrashRecord({ kind: 'line', at: now }).kind, 'line');
  assert.equal(buildTrashRecord({ kind: 'diary', at: now }).kind, 'diary');
  assert.equal(buildTrashRecord({ kind: 'nonsense', at: now }).kind, 'diary');
});

test('appendTrashRecord 处理空文本、无换行结尾两种情况', () => {
  const rec = buildTrashRecord({ kind: 'line', payload: { line: '一条' }, at: now });
  const fromEmpty = appendTrashRecord('', rec);
  assert.ok(fromEmpty.endsWith('\n'));
  assert.equal(parseTrash(fromEmpty).records.length, 1);

  const fromNoNewline = appendTrashRecord('{"old":1}', rec);
  assert.equal(parseTrash(fromNoNewline).records.length, 2);
});

test('parseTrash：坏行跳过并计数，按时间倒序', () => {
  const a = buildTrashRecord({ kind: 'line', payload: { line: '早' }, at: now - day });
  const b = buildTrashRecord({ kind: 'line', payload: { line: '晚' }, at: now });
  const text = `${JSON.stringify(a)}\n{这不是 JSON\n${JSON.stringify(b)}\n[1,2]\n\n`;
  const { records, broken } = parseTrash(text);
  assert.equal(broken, 2); // 一个坏 JSON，一个不是对象的数组
  assert.equal(records.length, 2);
  assert.equal(records[0].payload.line, '晚');
});

test('parseTrash 对空串与垃圾输入不抛', () => {
  assert.deepEqual(parseTrash(''), { records: [], broken: 0 });
  assert.deepEqual(parseTrash('   \n\n '), { records: [], broken: 0 });
  assert.equal(parseTrash(undefined).records.length, 0);
});

test('pruneTrash 只按天数剪，不按条数', () => {
  const records = [
    buildTrashRecord({ kind: 'line', payload: { line: '新' }, at: now - day }),
    buildTrashRecord({ kind: 'line', payload: { line: '旧' }, at: now - 40 * day }),
  ];
  const { records: kept, removed } = pruneTrash(records, { now, keepDays: DEFAULT_KEEP_DAYS });
  assert.equal(removed, 1);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].payload.line, '新');
});

test('pruneTrash 边界：正好卡在保留期上的算留着', () => {
  const exact = buildTrashRecord({ kind: 'line', payload: { line: '边界' }, at: now - 30 * day });
  assert.equal(pruneTrash([exact], { now, keepDays: 30 }).removed, 0);
  assert.equal(pruneTrash([exact], { now, keepDays: 29 }).removed, 1);
});

test('serializeTrash 与 parseTrash 来回一趟不丢东西', () => {
  const records = [
    buildTrashRecord({ kind: 'diary', payload: { id: 'd1', text: '整条' }, at: now }),
    buildTrashRecord({ kind: 'line', payload: { line: '一行' }, at: now + 1 }),
  ];
  const round = parseTrash(serializeTrash(records));
  assert.equal(round.records.length, 2);
  assert.equal(serializeTrash([]), '');
});

test('findTrashRecord：id 优先，其次 label，最后 payload 子串', () => {
  const byId = buildTrashRecord({ kind: 'diary', payload: { id: 'd1', text: '端口' }, label: '甲', at: now });
  const byLabel = buildTrashRecord({ kind: 'line', payload: { line: '乙' }, label: '端口那一行', at: now - 1 });
  const records = [byId, byLabel];

  assert.equal(findTrashRecord(records, '端口那一行')?.label, '端口那一行');
  // payload 里的子串也能捞到（人记得住内容，记不住随机 id）
  assert.equal(findTrashRecord([byId], '端口')?.payload.text, '端口');
  assert.equal(findTrashRecord(records, '完全不存在的东西'), undefined);
  assert.equal(findTrashRecord(records, '   '), undefined);

  // id 精确命中排在最前
  const realId = buildTrashRecord({ kind: 'line', payload: { line: 'x' }, label: '不含关键词', at: now - 2 });
  const decoy = buildTrashRecord({ kind: 'line', payload: { line: 'y' }, label: `标签里有 ${realId.id}`, at: now - 3 });
  assert.equal(findTrashRecord([decoy, realId], realId.id)?.id, realId.id);
});

test('describeTrashRecord 说人话，不吐时间戳', () => {
  const today = buildTrashRecord({ kind: 'diary', payload: { text: '今天删的' }, at: now - 1000 });
  assert.match(describeTrashRecord(today, now), /^今天 删了一条：/);

  const yesterday = buildTrashRecord({ kind: 'line', payload: { line: '行' }, at: now - day - 1000 });
  assert.match(describeTrashRecord(yesterday, now), /^昨天 删了一行：/);

  const week = buildTrashRecord({ kind: 'line', payload: { line: '行' }, at: now - 7 * day });
  assert.match(describeTrashRecord(week, now), /^7 天前 删了一行：/);
});

test('daysLeft 不会返回负数，也不会超过保留天数', () => {
  const fresh = buildTrashRecord({ kind: 'line', payload: { line: 'x' }, at: now });
  assert.equal(daysLeft(fresh, { now, keepDays: 30 }), 30);

  const old = buildTrashRecord({ kind: 'line', payload: { line: 'x' }, at: now - 100 * day });
  assert.equal(daysLeft(old, { now, keepDays: 30 }), 0);
});
