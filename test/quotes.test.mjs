// 原话库。
//
// 这一层跟别的不一样：它不能模糊。记忆可以说"记不清"，原话库只能说
// "有"或者"没有" —— 它是一次确定的遍历。所以下面大半测试都在守那条线：
// 别把「没有」说成「记不清」，也别为了"显得记得"把沾边的算命中。

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readQuotes, renderQuotes, searchQuotes, sourceMark } from '../src/core/quotes.mjs';

function fixture(lines) {
  const dir = mkdtempSync(join(tmpdir(), 'fish-quotes-'));
  const file = join(dir, '纸条.md');
  writeFileSync(file, lines.join('\n'), 'utf8');
  return { dir, file };
}

const L = (date, time, said, did = '') =>
  `- ${date} ${time} ｜他说：${said}${did ? ` ｜我这轮：${did}` : ''}`;

test('读：解析原话与「我这轮」', () => {
  const { file } = fixture([L('2026-11-09', '23:10', '按你的想法来呗，这个设备能坚持很久', '做了小纸条')]);
  const quotes = readQuotes({ file });
  assert.equal(quotes.length, 1);
  assert.equal(quotes[0].said, '按你的想法来呗，这个设备能坚持很久');
  assert.equal(quotes[0].did, '做了小纸条');
  assert.equal(quotes[0].date, '2026-11-09');
  assert.ok(quotes[0].at > 0);
});

test('读：活跃文件与旧档合起来，按时间从旧到新', () => {
  const { dir, file } = fixture([L('2026-11-10', '10:00', '新的那句')]);
  const archiveFile = join(dir, '纸条-旧档.md');
  writeFileSync(archiveFile, [L('2026-10-30', '09:00', '旧的那句')].join('\n'), 'utf8');
  const quotes = readQuotes({ file, archiveFile });
  assert.deepEqual(quotes.map((q) => q.said), ['旧的那句', '新的那句']);
});

test('读：两边都有同一行时只算一次', () => {
  const line = L('2026-11-10', '10:00', '同一句');
  const { dir, file } = fixture([line]);
  const archiveFile = join(dir, '纸条-旧档.md');
  writeFileSync(archiveFile, line, 'utf8');
  assert.equal(readQuotes({ file, archiveFile }).length, 1);
});

test('读：文件不存在当空，不炸', () => {
  assert.deepEqual(readQuotes({ file: '/nonexistent/x.md' }), []);
  assert.deepEqual(readQuotes(), []);
});

test('查：整句包含算命中', () => {
  const { file } = fixture([L('2026-11-09', '23:10', '按你的想法来呗，这个设备能坚持很久')]);
  const r = searchQuotes(readQuotes({ file }), '设备能坚持');
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].exact, true);
});

test('查：只有一半的二元组对上也算 —— 他换个说法我也找得到', () => {
  const { file } = fixture([L('2026-11-09', '23:10', '这个设备能坚持很久')]);
  const r = searchQuotes(readQuotes({ file }), '设备坚持');
  assert.equal(r.hits.length, 1, '「设备」和「坚持」两个词都在，该命中');
  assert.equal(r.hits[0].exact, false);
});

test('查：字不对就是没有（不许「好像有」）', () => {
  const { file } = fixture([L('2026-11-09', '23:10', '这个设备能坚持很久')]);
  const r = searchQuotes(readQuotes({ file }), '量子计算机');
  assert.equal(r.hits.length, 0);
});

test('查：单字查询走子串兜底', () => {
  const { file } = fixture([L('2026-11-09', '23:10', '他让我看园子')]);
  const r = searchQuotes(readQuotes({ file }), '园');
  assert.equal(r.hits.length, 1);
});

test('查：日期范围能收窄', () => {
  const { file } = fixture([
    L('2026-11-01', '10:00', '同一件事 早'),
    L('2026-11-09', '10:00', '同一件事 晚'),
  ]);
  const quotes = readQuotes({ file });
  assert.equal(searchQuotes(quotes, '同一件事').hits.length, 2);
  const r = searchQuotes(quotes, '同一件事', { since: '2026-11-05' });
  assert.equal(r.hits.length, 1);
  assert.match(r.hits[0].said, /晚$/);
});

test('查：精确包含排在部分重合前面', () => {
  const { file } = fixture([
    L('2026-11-01', '10:00', '设备能 坚持 很久 吧'),
    L('2026-11-09', '10:00', '这个设备能坚持很久'),
  ]);
  const r = searchQuotes(readQuotes({ file }), '设备能坚持很久');
  assert.equal(r.hits[0].said, '这个设备能坚持很久', '整句对上的那条该排第一');
});

test('说：没有就是没有，而且要把库里最早的日期一起说出来', () => {
  const { file } = fixture([L('2026-11-09', '10:00', '一句话')]);
  const r = searchQuotes(readQuotes({ file }), '量子计算机');
  const text = renderQuotes(r, { query: '量子计算机' });
  assert.match(text, /^没有。/);
  assert.match(text, /2026-11-09/, '要说清这库从哪天开始记 —— 不然「没有」会被读成「他从来没说过」');
  assert.match(text, /查不到不等于他没说过/, '四个洞都要认：纯应答不存、重复不存、本轮未落笔、开张之前没有');
  assert.match(text, /档案里没有这几个字/, '要说成"档案里没有"，不是"我记不清"');
  assert.ok(!/好像|大概是/.test(text), '原话库不该出现模糊词 —— 它是一次确定的遍历');
});

test('说：找到了就照抄，带上「我这轮」', () => {
  const { file } = fixture([L('2026-11-09', '23:10', '按你的想法来呗', '做了小纸条')]);
  const r = searchQuotes(readQuotes({ file }), '按你的想法');
  const text = renderQuotes(r, { query: '按你的想法' });
  assert.match(text, /「按你的想法来呗」/);
  assert.match(text, /（我：做了小纸条）/);
});

test('说：库里一条都没有时明说', () => {
  const text = renderQuotes({ hits: [], scanned: 0, total: 0, first: '' }, { query: 'x' });
  assert.match(text, /一条都没有/);
});


// ── 「（旧档）」标记（2026-11-21，1.41.0）──
//
// 旧档从 11-15 起就在被读了，但 `source` 字段没有渲染方用过 ——
// 所以查得到、看不出。查得到的和已从注入里消失的，读起来一模一样。
// 标记不是装饰：它决定「他说过」这句话该有多重。

test('sourceMark：旧档标，活跃不标，别的形状不标', () => {
  assert.equal(sourceMark({ source: 'archive' }), '（旧档）');
  assert.equal(sourceMark({ source: 'active' }), '');
  assert.equal(sourceMark({}), '');
  assert.equal(sourceMark(null), '');
});

test('渲染：旧档条目带标记，活跃条目不带', () => {
  const text = renderQuotes(
    {
      hits: [
        { said: '旧的那句', source: 'archive', at: 1, date: '2026-10-31', time: '深夜' },
        { said: '新的那句', source: 'active', at: 2, date: '2026-11-20', time: '中午' },
      ],
      scanned: 2,
      total: 2,
      first: '2026-10-31',
    },
    { query: '那句', at: 2 },
  );
  assert.match(text, /旧的那句」/);
  assert.match(text, /旧的那句」（旧档）/);
  assert.match(text, /新的那句」\n|新的那句」（我/);
  assert.doesNotMatch(text, /新的那句」（旧档）/);
});

test('渲染：命中里有旧档才补那句说明，没有就不补', () => {
  const base = { scanned: 1, total: 1, first: '2026-11-01' };
  const withArch = renderQuotes(
    { ...base, hits: [{ said: '旧', source: 'archive', at: 1, date: '2026-10-31', time: '深夜' }] },
    { query: '旧', at: 2 },
  );
  assert.match(withArch, /已经从每轮注入里挪走了/);

  const without = renderQuotes(
    { ...base, hits: [{ said: '新', source: 'active', at: 1, date: '2026-11-01', time: '中午' }] },
    { query: '新', at: 2 },
  );
  assert.doesNotMatch(without, /已经从每轮注入里挪走了/);
});
