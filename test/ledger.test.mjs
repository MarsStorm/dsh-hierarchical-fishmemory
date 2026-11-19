// 账本 —— 2026-11-17 补的一层：证明「一条都没丢、也没被悄悄改写」。
//
// 写这份测试时最要紧的一条不是"能存能取"，是**负例**：
// 拷一份库、改一条、必须报错。只做正例等于没做 ——
// 账本最坏的样子不是没有，是天天报红，然后我学会不看它。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  LEDGER_FILE,
  digestOf,
  forgetInLedger,
  ledgerReport,
  readLedger,
  scanLedger,
  syncLedger,
} from '../src/core/ledger.mjs';

function tmpFile() {
  return join(mkdtempSync(join(tmpdir(), 'fish-ledger-')), LEDGER_FILE);
}

const ENTRY = (id, text) => ({ id, text, date: '2026-11-17', created_at: 1763312400000 });

test('账本：写进去的能读回来，同一 id 以最后一条为准', () => {
  const file = tmpFile();
  syncLedger(file, [ENTRY('a', '他说他不喜欢裙子')], { at: 1 });
  const ledger = readLedger(file);
  assert.equal(ledger.size, 1);
  assert.equal(ledger.get('a').sha256, digestOf('他说他不喜欢裙子'));
  assert.equal(ledger.get('a').len, 8);
});

test('账本：坏行跳过，不连累整本', () => {
  const file = tmpFile();
  syncLedger(file, [ENTRY('a', '正文甲')], { at: 1 });
  const raw = readFileSync(file, 'utf8');
  writeFileSync(file, `${raw}这不是 JSON\n{"id":"b","sha256":"半截"}\n`, 'utf8');
  const ledger = readLedger(file);
  assert.equal(ledger.size, 1, '坏行只该被跳过，不该把 a 也弄丢');
  assert.ok(ledger.has('a'));
});

test('账本：sync 只补新条目，不覆盖历史', () => {
  const file = tmpFile();
  const entries = [ENTRY('a', '正文甲'), ENTRY('b', '正文乙')];
  const first = syncLedger(file, entries, { at: 1 });
  assert.equal(first.added, 2);
  const before = readFileSync(file, 'utf8');
  const second = syncLedger(file, entries, { at: 2 });
  assert.equal(second.added, 0, '已经入账的不该重复追加');
  assert.equal(readFileSync(file, 'utf8'), before, '没有新东西就不该动文件');
  entries.push(ENTRY('c', '正文丙'));
  const third = syncLedger(file, entries, { at: 3 });
  assert.equal(third.added, 1);
  assert.equal(readLedger(file).size, 3);
});

test('账本：续写算正常，不算被改', () => {
  const file = tmpFile();
  const entries = [ENTRY('a', '他让我写个东西，我没问清语言就动手了。')];
  syncLedger(file, entries, { at: 1 });
  // 模拟 applyConsolidation 的续写：拼在末尾
  entries[0] = ENTRY('a', `${entries[0].text}\n\n后来才明白，那一轮白忙是我自己造成的。`);
  const report = ledgerReport({ file, entries, memoryCount: 1 });
  assert.equal(report.rewritten.length, 0, '往后长是续写，不是篡改');
  assert.equal(report.grown, 1);
  // 续写不是事故：它自己能对齐，所以不算「对不上」。
  // 只在文字里说一句「下次同步会对齐」，不把面板点红。
  assert.equal(report.ok, true, '续写不该报警');
  const synced = syncLedger(file, entries, { at: 2 });
  assert.equal(synced.refreshed, 1);
  assert.equal(ledgerReport({ file, entries, memoryCount: 1 }).ok, true, '同步之后就该对平了');
});

test('账本：负例 —— 正文被改，必须报出来', () => {
  const file = tmpFile();
  const entries = [ENTRY('a', '他不喜欢裙子')];
  syncLedger(file, entries, { at: 1 });
  entries[0] = ENTRY('a', '他喜欢裙子');
  const report = ledgerReport({ file, entries, memoryCount: 1 });
  assert.equal(report.ok, false);
  assert.equal(report.rewritten.length, 1);
  assert.equal(report.rewritten[0].id, 'a');
  assert.match(report.text, /被改 1 条/);
});

test('账本：负例 —— 少了一条，必须报出来', () => {
  const file = tmpFile();
  const entries = [ENTRY('a', '正文甲'), ENTRY('b', '正文乙')];
  syncLedger(file, entries, { at: 1 });
  const report = ledgerReport({ file, entries: [entries[0]], memoryCount: 1 });
  assert.equal(report.ok, false);
  assert.equal(report.missing.length, 1);
  assert.equal(report.missing[0].id, 'b');
  assert.match(report.text, /丢了 1 条/);
});

test('账本：sync 不会替丢失的条目消失', () => {
  const file = tmpFile();
  const entries = [ENTRY('a', '正文甲'), ENTRY('b', '正文乙')];
  syncLedger(file, entries, { at: 1 });
  const r = syncLedger(file, [entries[0]], { at: 2 });
  assert.equal(r.missing, 1, 'sync 该老实说「还有一条我找不着」');
  assert.equal(readLedger(file).size, 2, '账本里那一行不能被删掉');
});

test('账本：故意忘掉的能划掉，划掉之后不再喊失踪', () => {
  const file = tmpFile();
  const entries = [ENTRY('a', '正文甲'), ENTRY('b', '正文乙')];
  syncLedger(file, entries, { at: 1 });
  assert.equal(forgetInLedger(file, ['b'], { at: 2 }), 1);
  const report = ledgerReport({ file, entries: [entries[0]], memoryCount: 1 });
  assert.equal(report.ok, true, '自己决定忘掉的，账本不该天天报丧');
  assert.equal(report.forgotten, 1);
  assert.match(report.text, /故意忘掉/);
});

test('账本：注入用的条数和磁盘对不上，也要报', () => {
  const file = tmpFile();
  const entries = [ENTRY('a', '正文甲'), ENTRY('b', '正文乙')];
  syncLedger(file, entries, { at: 1 });
  const report = ledgerReport({ file, entries, memoryCount: 3 });
  assert.equal(report.ok, false);
  assert.equal(report.agree, false);
  assert.match(report.text, /对不上/);
});

test('账本：换行符不同不算篡改', () => {
  const file = tmpFile();
  syncLedger(file, [ENTRY('a', '第一行\n第二行')], { at: 1 });
  const report = ledgerReport({
    file,
    entries: [ENTRY('a', '第一行\r\n第二行')],
    memoryCount: 1,
  });
  assert.equal(report.rewritten.length, 0);
  assert.equal(report.grown, 0, '原文一字没变，只是换行符——不该算续写也不该算改');
});

test('账本：文件不存在时是空账，不抛', () => {
  const ledger = readLedger(join(tmpdir(), '根本没有这个文件.jsonl'));
  assert.equal(ledger.size, 0);
  const scan = scanLedger(ledger, [ENTRY('a', '正文甲')]);
  assert.deepEqual(scan.fresh, ['a']);
  assert.equal(scan.missing.length, 0);
});

test('账本：只有"新长出"不算注意 —— 否则这行永远是注意', () => {
  // 2026-11-19 修的那条。新日记天天有，而 sync 只在我手动调的时候才跑，
  // 所以只要 fresh 进 ok 判据，健康那行就**永远**是「账本=注意」。
  // 实测连续三天全是注意，一行有用的话都没有 —— 那就是"报太多教人无视它"。
  const file = tmpFile();
  syncLedger(file, [ENTRY('a', '正文甲')], { at: 1 });
  const entries = [ENTRY('a', '正文甲'), ENTRY('b', '今天新写的')];
  const report = ledgerReport({ file, entries, memoryCount: 2 });
  assert.equal(report.fresh, 1);
  assert.equal(report.ok, true, '新长出不是事故，是这本账还没跟上');
  assert.match(report.text, /新长出 1 条还没入账/, '但话还是要说');
});

test('账本：新长出之外真有事故，照样是注意', () => {
  // 负例：放宽以后不能把真事故也放过去。丢了 + 新长出 同时发生 → 仍是注意。
  const file = tmpFile();
  syncLedger(file, [ENTRY('a', '正文甲'), ENTRY('b', '正文乙')], { at: 1 });
  const entries = [ENTRY('a', '正文甲'), ENTRY('c', '今天新写的')];
  const report = ledgerReport({ file, entries, memoryCount: 2 });
  assert.equal(report.ok, false, '少了的那条必须还报');
  assert.equal(report.missing.length, 1);
  assert.equal(report.fresh, 1);
});
