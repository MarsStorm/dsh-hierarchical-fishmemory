/**
 * 镜子 + 小闹钟的测试。
 *
 * 这两块最容易出的毛病，跟体检页是一类：
 *   · 「看起来有内容，其实全是 0」—— 日期算错就整块空着，还不报错
 *   · 「跨时区掉一天」—— 本机 UTC，他 UTC+8，00:00–08:00 记的事最容易掉
 *   · 「账本长成待办清单」—— 闹钟只要多加一行，loop 就废了
 *
 * 所以测试盯三件事：跨日边界、坏数据不炸、只加后缀不加行。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { annotateLoops, buildMirror, dayKey, renderMirror, STALE_DAYS } from '../src/core/mirror.mjs';
import { renderLoopsAnnotated } from '../src/core/loops.mjs';

const DAY = 24 * 60 * 60 * 1000;
/** 他那边 2026-11-10 中午 = UTC 2026-11-10 04:00 */
const NOON_1110 = Date.parse('2026-11-10T04:00:00Z');

function makeDir() {
  const root = mkdtempSync(join(tmpdir(), 'fish-mirror-'));
  mkdirSync(join(root, 'diary'), { recursive: true });
  return root;
}

function writeSticky(dir, lines) {
  writeFileSync(join(dir, '纸条.md'), `${lines.join('\n')}\n`, 'utf8');
}

function noteLine(date, time, said, did = '') {
  return `- ${date} ${time} ｜他说：${said}${did ? ` ｜我这轮：${did}` : ''}`;
}

function writeDiary(dir, month, entries) {
  writeFileSync(join(dir, 'diary', `${month}.jsonl`), entries.map((e) => JSON.stringify(e)).join('\n'), 'utf8');
}

test('dayKey 按他那边（UTC+8）算，不是本机 UTC', () => {
  // 他那边 2026-11-10 早上七点 = UTC 2026-11-09 23:00 —— 本机还在「9 号」
  assert.equal(dayKey(Date.parse('2026-11-09T23:00:00Z')), '2026-11-10');
  // 他那边 2026-11-10 晚上十一点 = UTC 15:00 还是 10 号
  assert.equal(dayKey(Date.parse('2026-11-10T15:00:00Z')), '2026-11-10');
  // 他那边 2026-11-11 零点 = UTC 16:00 跳日
  assert.equal(dayKey(Date.parse('2026-11-10T16:00:00Z')), '2026-11-11');
});

test('跨日边界：他那边凌晨说的话，算今天，不掉进昨天', () => {
  const dir = makeDir();
  writeSticky(dir, [
    noteLine('2026-11-10', '00:30', '凌晨这句', '半夜还在弄'),
    noteLine('2026-11-09', '23:50', '昨晚那句', ''),
  ]);
  // 现在是他那边 11-10 中午
  const m = buildMirror({ dataDir: dir, now: NOON_1110 });
  assert.equal(m.date, '2026-11-10');
  assert.equal(m.notes.length, 1);
  assert.equal(m.notes[0].said, '凌晨这句');
});

test('跨月边界：一整月第一天也能读到那月的 jsonl（不是上个月）', () => {
  const dir = makeDir();
  const at = Date.parse('2026-12-01T04:00:00Z'); // 他那边 12-01 中午
  writeDiary(dir, '2026-12', [
    { text: '十二月的第一条', date: '2026-12-01', created_at: at - 3600 * 1000, kind: 'win' },
  ]);
  const m = buildMirror({ dataDir: dir, now: at });
  assert.equal(m.date, '2026-12-01');
  assert.equal(m.diary, 1);
});

test('坏行不让整块瞎掉：jsonl 坏行、纸条乱行都跳过', () => {
  const dir = makeDir();
  writeDiary(dir, '2026-11', [{ text: '好的一条', created_at: NOON_1110 - 1000, kind: 'win' }]);
  writeFileSync(
    join(dir, 'diary', '2026-11.jsonl'),
    `${JSON.stringify({ text: '好的一条', created_at: NOON_1110 - 1000, kind: 'win' })}\n{坏行\n\n`,
    'utf8',
  );
  writeSticky(dir, ['这不是纸条', noteLine('2026-11-10', '09:00', '他说的'), '- 乱码一行']);
  const m = buildMirror({ dataDir: dir, now: NOON_1110 });
  assert.equal(m.diary, 1);
  assert.equal(m.notes.length, 1);
  assert.equal(m.empty, false);
});

test('档案不存在时不抛错，只是空镜子', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fish-mirror-empty-'));
  const m = buildMirror({ dataDir: dir, now: NOON_1110 });
  assert.equal(m.empty, true);
  assert.equal(m.chats, 0);
  assert.deepEqual(m.notes, []);
  const text = renderMirror(m);
  assert.match(text, /今天还没留下什么痕迹/);
});

test('只读：镜子跑完一个文件都不改', () => {
  const dir = makeDir();
  writeSticky(dir, [noteLine('2026-11-10', '09:00', '原话')]);
  writeDiary(dir, '2026-11', [{ text: '一段经过', created_at: NOON_1110 - 1000, kind: 'win' }]);
  const before = {
    sticky: readFileSync(join(dir, '纸条.md'), 'utf8'),
    diary: readFileSync(join(dir, 'diary', '2026-11.jsonl'), 'utf8'),
  };
  buildMirror({ dataDir: dir, now: NOON_1110 });
  renderMirror(buildMirror({ dataDir: dir, now: NOON_1110 }));
  assert.equal(readFileSync(join(dir, '纸条.md'), 'utf8'), before.sticky);
  assert.equal(readFileSync(join(dir, 'diary', '2026-11.jsonl'), 'utf8'), before.diary);
});

test('小闹钟：陈了的标一句，新记的一个字都不加', () => {
  const now = NOON_1110;
  const fresh = { id: 'a', text: '今天刚记的', createdAt: now - 60 * 60 * 1000 };
  const stale = { id: 'b', text: '三天前记的', createdAt: now - STALE_DAYS * DAY };
  const [a, b] = annotateLoops([fresh, stale], now);
  assert.equal(a.suffix, '');
  assert.equal(b.suffix.includes(`${STALE_DAYS} 天`), true);
  assert.match(b.suffix, /还挂着/);
});

test('小闹钟只加后缀，行数一条都不多', () => {
  const now = NOON_1110;
  const items = [
    { id: 'a', text: '新事', createdAt: now - 1000 },
    { id: 'b', text: '旧事', createdAt: now - 10 * DAY },
  ];
  const text = renderLoopsAnnotated(items, { annotate: (x) => annotateLoops([x], now)[0] });
  const bullet = text.split('\n').filter((l) => l.startsWith('- ') && !l.includes('loop_done'));
  assert.equal(bullet.length, 2, '两件事就两行，不多不少');
  assert.match(bullet[1], /旧事（记下 10 天了，还挂着）/);
  assert.equal(bullet[0], '- 新事');
});

test('小闹钟：没有 annotate 就退化成原来那版', () => {
  const text = renderLoopsAnnotated([{ text: '一件' }], {});
  assert.equal(text, renderLoopsPlain([{ text: '一件' }]));
});

function renderLoopsPlain(items) {
  const head = `## 还挂着的事（${items.length} 件）`;
  const lines = items.map((x) => `- ${x.text}`);
  return [head, ...lines, '- 办完了用 loop_done 销掉，别让它一直挂着。'].join('\n');
}

test('镜子说她今天写了没有：认三种小标题写法', () => {
  const cases = [
    ['## 2026-11-10\n\n今天挺好', true],
    ['## 11-10\n\n今天挺好', true],
    ['## 11 月 10 日\n\n今天挺好', true],
    ['## 2026-11-09\n\n昨天挺好', false],
  ];
  for (const [body, want] of cases) {
    const dir = makeDir();
    writeSticky(dir, [noteLine('2026-11-10', '09:00', '有内容才不是空镜子')]);
    writeFileSync(join(dir, '鱼的日子.md'), `${body}\n`, 'utf8');
    const m = buildMirror({ dataDir: dir, now: NOON_1110 });
    assert.equal(m.feelingsToday, want, body);
  }
});

test('renderMirror 有内容时给出四块结构', () => {
  const dir = makeDir();
  writeSticky(dir, [noteLine('2026-11-10', '09:00', '有原话', '我干了一件事')]);
  writeDiary(dir, '2026-11', [
    { text: '修了 mirror.mjs，跑了 npm test', created_at: NOON_1110 - 1000, kind: 'win' },
  ]);
  const text = renderMirror(
    buildMirror({
      dataDir: dir,
      now: NOON_1110,
      loops: [{ id: 'x', text: '一件陈事', createdAt: NOON_1110 - 5 * DAY }],
    }),
  );
  assert.match(text, /## 2026-11-10 · 镜子里/);
  assert.match(text, /他今天说的/);
  assert.match(text, /「有原话」/);
  assert.match(text, /我忙在/);
  assert.match(text, /mirror\.mjs/);
  assert.match(text, /陈了的/);
  assert.match(text, /一件陈事（5 天没动）/);
});
