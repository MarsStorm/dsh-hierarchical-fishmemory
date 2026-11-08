import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  MAX_LINES,
  MAX_SAID_CHARS,
  STICKY_ARCHIVE_FILE,
  STICKY_FILE,
  appendNote,
  appendNoteSync,
  archiveOverflow,
  archiveOverflowSync,
  isDuplicate,
  parseNotes,
  patchDid,
  readNotes,
  readNotesSync,
  recordTurn,
  renderNote,
  renderSection,
  setPinned,
  shouldNote,
  stamp,
  whenLabel,
} from '../src/core/sticky.mjs';

function tmp() {
  const dir = mkdtempSync(join(tmpdir(), 'fish-sticky-'));
  return {
    dir,
    file: join(dir, STICKY_FILE),
    archive: join(dir, STICKY_ARCHIVE_FILE),
  };
}

test('renderNote：行格式是「- 日期 时间 ｜他说：… ｜我这轮：…」', () => {
  const line = renderNote({ said: '其实那天我挺难受的', did: '帮他查了端口', at: Date.parse('2026-11-09T00:53:00+08:00') });
  assert.match(line, /^-\s*2026-11-09 00:53 ｜他说：其实那天我挺难受的 ｜我这轮：帮他查了端口$/);
});

test('renderNote：正压成一行，换行不能毁掉文件结构', () => {
  const line = renderNote({ said: '第一行\n第二行', did: '' });
  assert.equal(line.includes('\n'), false);
  assert.match(line, /^-\s*\d{4}-\d{2}-\d{2} \d{2}:\d{2} ｜他说：第一行 第二行$/);
});

test('renderNote：正文里的全角竖线换成半角，免得撑坏分隔', () => {
  const line = renderNote({ said: 'a｜b', did: 'c｜d' });
  assert.equal(line.split('｜').length, 3, `不该出现第四个分隔符：${line}`);
  const notes = parseNotes(line);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].said, 'a|b');
  assert.equal(notes[0].did, 'c|d');
});

test('renderNote：他说的话最多 200 字', () => {
  const long = '字'.repeat(500);
  const line = renderNote({ said: long });
  const notes = parseNotes(line);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].said.length, MAX_SAID_CHARS);
});

test('stamp：走 UTC+8，不走本机时区', () => {
  const { date, time } = stamp(Date.parse('2026-11-08T17:30:00Z'));
  assert.equal(date, '2026-11-09');
  assert.equal(time, '01:30');
});

test('parseNotes：认不出的行原样丢掉，不猜不修', () => {
  const text = [
    '- 2026-11-09 00:53 ｜他说：认得出的',
    '这是我自己手写的说明，不是纸条',
    '- 2026-11-08 22:10 ｜我说：字段写错了的',
  ].join('\n');
  const notes = parseNotes(text);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].said, '认得出的');
});

test('parseNotes：文件从上到下就是新 → 旧', () => {
  const text = [
    '- 2026-11-09 00:53 ｜他说：新的',
    '- 2026-11-08 22:10 ｜他说：旧的',
  ].join('\n');
  const notes = parseNotes(text);
  assert.equal(notes.length, 2);
  assert.equal(notes[0].said, '新的');
  assert.equal(notes[1].said, '旧的');
});

test('appendNoteSync：新的放最上面', async () => {
  const { file } = tmp();
  appendNoteSync(file, renderNote({ said: '第一条' }));
  appendNoteSync(file, renderNote({ said: '第二条' }));
  const notes = readNotesSync(file);
  assert.equal(notes.length, 2);
  assert.equal(notes[0].said, '第二条');
  assert.equal(notes[1].said, '第一条');
  // 异步版也是同一个方向
  await appendNote(file, renderNote({ said: '第三条' }));
  const again = await readNotes(file);
  assert.equal(again[0].said, '第三条');
});

test('appendNoteSync：文件不存在时自己建目录', () => {
  const { dir } = tmp();
  const nested = join(dir, 'deep', 'deeper', STICKY_FILE);
  appendNoteSync(nested, renderNote({ said: '深层也要能写' }));
  assert.equal(existsSync(nested), true);
  assert.equal(readNotesSync(nested).length, 1);
});

test('archiveOverflowSync：超限的最旧挪进旧档，不删', () => {
  const { file, archive } = tmp();
  for (let i = 0; i < 5; i += 1) {
    appendNoteSync(file, renderNote({ said: `第${i}条`, at: Date.now() + i * 1000 }));
  }
  const moved = archiveOverflowSync(file, archive, 3);
  assert.equal(moved, 2);
  const kept = readNotesSync(file);
  assert.equal(kept.length, 3);
  assert.equal(kept[0].said, '第4条');
  assert.ok(existsSync(archive));
  const archived = readFileSync(archive, 'utf8');
  assert.ok(archived.includes('第0条'));
  assert.ok(archived.includes('第1条'));
});

test('archiveOverflowSync：★ 钉住的受保护，再挤也不挪走', () => {
  const { file, archive } = tmp();
  appendNoteSync(file, renderNote({ said: '钉住的', pinned: true }));
  for (let i = 0; i < 5; i += 1) {
    appendNoteSync(file, renderNote({ said: `第${i}条` }));
  }
  archiveOverflowSync(file, archive, 2);
  const kept = readNotesSync(file);
  assert.ok(kept.some((n) => n.pinned && n.said === '钉住的'), '★ 的那条不该被挪走');
});

test('archiveOverflow：异步版跟同步版一个结果', async () => {
  const { file, archive } = tmp();
  for (let i = 0; i < 4; i += 1) await appendNote(file, renderNote({ said: `第${i}条` }));
  const moved = await archiveOverflow(file, archive, 2);
  assert.equal(moved, 2);
  assert.equal((await readNotes(file)).length, 2);
});

test('shouldNote：纯应答不记，有分量的话一句都记', () => {
  for (const raw of ['继续', '好', '嗯', 'ok', '知道了', '哈哈哈', '666', '行吧']) {
    assert.equal(shouldNote(raw), false, `「${raw}」不该单独占一行`);
  }
  for (const raw of ['其实那天我挺难受的', '我也是', '你记着点']) {
    assert.equal(shouldNote(raw), true, `「${raw}」该记`);
  }
  assert.equal(shouldNote(''), false);
  assert.equal(shouldNote('   '), false);
});

test('isDuplicate：同一句原话往前 8 条里不重复记', () => {
  const notes = parseNotes(
    ['- 2026-11-09 00:53 ｜他说：一样的话', '- 2026-11-08 00:53 ｜他说：别的'].join('\n'),
  );
  assert.equal(isDuplicate(notes, '一样的话'), true);
  assert.equal(isDuplicate(notes, '没说过的话'), false);
});

test('patchDid：给先记下的那条补上「我这轮」', () => {
  const { file } = tmp();
  appendNoteSync(file, renderNote({ said: '帮我看看这个', did: '' }));
  assert.equal(patchDid(file, '查了端口 3080', '帮我看看这个'), true);
  const notes = readNotesSync(file);
  assert.equal(notes[0].did, '查了端口 3080');
  // 已经补过的不再补
  assert.equal(patchDid(file, '别的', '帮我看看这个'), false);
});

test('patchDid：只补空的那条，不覆盖已经写好的', () => {
  const { file } = tmp();
  appendNoteSync(file, renderNote({ said: '有注解的', did: '原来的' }));
  appendNoteSync(file, renderNote({ said: '没注解的', did: '' }));
  patchDid(file, '新注解');
  const notes = readNotesSync(file);
  assert.equal(notes.find((n) => n.said === '有注解的').did, '原来的');
  assert.equal(notes.find((n) => n.said === '没注解的').did, '新注解');
});

test('setPinned：钉住 / 取消钉住能来回', async () => {
  const { file } = tmp();
  appendNoteSync(file, renderNote({ said: '要一直记着' }));
  const r1 = await setPinned(file, 0, true);
  assert.equal(r1.ok, true);
  assert.equal(readNotesSync(file)[0].pinned, true);
  const r2 = await setPinned(file, 0, false);
  assert.equal(r2.ok, true);
  assert.equal(readNotesSync(file)[0].pinned, false);
});

test('renderSection：★ 永不过期，其余只给 TTL 内的', () => {
  const old = Date.now() - 40 * 86400000;
  const notes = parseNotes(
    [
      `- ★ 2026-01-01 00:00 ｜said:钉住的`.replace('said:', '他说：'),
      `- 2026-01-01 00:00 ｜said:很旧的`.replace('said:', '他说：'),
      `- 2026-11-09 00:00 ｜said:新的`.replace('said:', '他说：'),
    ].join('\n'),
  );
  // 把 at 手动调旧，模拟过期
  notes[0].at = old;
  notes[1].at = old;
  notes[2].at = Date.now();
  const out = renderSection(notes, { ttlDays: 30 });
  assert.ok(out.includes('钉住的'), '★ 的过期了也该在');
  assert.equal(out.includes('很旧的'), false);
  assert.ok(out.includes('新的'));
});

test('renderSection：一条都没有时返回空串，不注入任何东西', () => {
  assert.equal(renderSection([], { ttlDays: 30 }), '');
  assert.equal(renderSection(readNotesSync('/tmp/这个文件不存在-纸条.md'), {}), '');
});

test('renderSection：最多 maxInject 条', () => {
  const notes = [];
  for (let i = 0; i < 20; i += 1) {
    notes.push({ pinned: false, date: '2026-11-09', time: '00:00', said: `第${i}条`, did: '', at: Date.now(), index: i, raw: '' });
  }
  const out = renderSection(notes, { ttlDays: 30, maxInject: 3 });
  const lines = out.split('\n').filter((l) => l.startsWith('- '));
  assert.equal(lines.length, 3);
});

test('MAX_LINES 是活跃纸条的行数上限', () => {
  assert.equal(MAX_LINES, 200);
});

// ── recordTurn：host 每轮只调这一行，所以这条链要自己站得住 ──

test('recordTurn：一句话 + 一句我这轮，落成一行', () => {
  const { file, archive } = tmp();
  const r = recordTurn({
    file,
    archiveFile: archive,
    said: '其实那天我挺难受的',
    did: '陪他聊到三点',
    at: Date.parse('2026-11-09T01:20:00+08:00'),
  });
  assert.equal(r.written, true);
  const notes = readNotesSync(file);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].said, '其实那天我挺难受的');
  assert.equal(notes[0].did, '陪他聊到三点');
});

test('recordTurn：纯应答不写文件', () => {
  const { file, archive } = tmp();
  const r = recordTurn({ file, archiveFile: archive, said: '继续' });
  assert.equal(r.written, false);
  assert.equal(existsSync(file), false);
});

test('recordTurn：关掉就一条都不写', () => {
  const { file, archive } = tmp();
  const r = recordTurn({ file, archiveFile: archive, said: '这是一句有分量的话', enabled: false });
  assert.equal(r.written, false);
  assert.equal(existsSync(file), false);
});

test('recordTurn：同一句话连说两遍只留一条', () => {
  const { file, archive } = tmp();
  const said = '你是我最好的朋友';
  recordTurn({ file, archiveFile: archive, said });
  const second = recordTurn({ file, archiveFile: archive, said });
  assert.equal(second.written, false);
  assert.equal(readNotesSync(file).length, 1);
});

test('recordTurn：超限时顺手把最旧的挪进旧档', () => {
  const { file, archive } = tmp();
  for (let i = 0; i < 4; i += 1) {
    recordTurn({ file, archiveFile: archive, said: `第 ${i} 句话`, limit: 3 });
  }
  assert.equal(readNotesSync(file).length, 3);
  assert.ok(existsSync(archive));
  assert.equal(readNotesSync(archive).length, 1);
});

test('whenLabel：今天 / 昨天 / N 天前，太旧的退回日期', () => {
  const at = Date.parse('2026-11-09T12:00:00+08:00');
  // 30 天内带上钟点（「今天中午十二点」），因为"几点说的"是这条的分量之一
  assert.equal(whenLabel({ at }, at), '今天中午十二点');
  assert.equal(whenLabel({ at: at - 86400000 }, at), '昨天中午十二点');
  assert.equal(whenLabel({ at: at - 3 * 86400000 }, at), '3 天前 中午十二点');
  assert.equal(whenLabel({ at: at - 60 * 86400000, date: '2026-09-10' }, at), '2026-09-10');
});

test('renderSection：每条前面带「什么时候说的」', () => {
  const at = Date.parse('2026-11-09T12:00:00+08:00');
  const notes = [
    { pinned: false, date: '2026-11-09', time: '02:00', said: '那是真的', did: '', at: at - 10 * 3600000, index: 0, raw: '' },
  ];
  const out = renderSection(notes, { ttlDays: 30, at });
  assert.ok(out.includes('今天凌晨两点 · 「那是真的」'), out);
});

test('renderSection：断在这儿的那句要标出来，但不改他的字', () => {
  const at = Date.parse('2026-11-09T12:00:00+08:00');
  const notes = [
    { pinned: false, date: '2026-11-09', time: '02:00', said: '其实我想说…', did: '', at: at - 3600000, index: 0, raw: '' },
    { pinned: false, date: '2026-11-09', time: '01:00', said: '算了', did: '', at: at - 7200000, index: 1, raw: '' },
    { pinned: false, date: '2026-11-08', time: '20:00', said: '今天挺开心的', did: '陪他聊了会儿', at: at - 16 * 3600000, index: 2, raw: '' },
  ];
  const out = renderSection(notes, { ttlDays: 30, at });
  // 原话一个字都没动，标记加在引号外面
  assert.ok(out.includes('「其实我想说…」（这里断了）'), out);
  assert.ok(out.includes('「算了」（这句收回去了）'), out);
  assert.ok(!out.includes('「今天挺开心的」（这里断了）'), out);
  assert.ok(!out.includes('「今天挺开心的」（这句收回去了）'), out);
  // 有断句才多说这一行
  assert.ok(out.includes('没说完的那几句'), out);
});

test('renderSection：没有断句就不多花那一行', () => {
  const at = Date.parse('2026-11-09T12:00:00+08:00');
  const notes = [
    { pinned: false, date: '2026-11-09', time: '02:00', said: '今天挺开心的', did: '', at: at - 3600000, index: 0, raw: '' },
  ];
  const out = renderSection(notes, { ttlDays: 30, at });
  assert.ok(!out.includes('没说完的那几句'), out);
});

test('recordTurn 原样存下带省略号的话（标记只在渲染时加）', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sticky-pause-'));
  const file = join(dir, STICKY_FILE);
  recordTurn({ file, archiveFile: join(dir, STICKY_ARCHIVE_FILE), said: '其实我想说…', did: '' });
  const raw = readFileSync(file, 'utf8');
  assert.ok(raw.includes('他说：其实我想说…'), raw);
  assert.ok(!raw.includes('这里断了'), '文件里不该有渲染用的标记');
});
