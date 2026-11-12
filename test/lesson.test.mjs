// 教训层 —— 2026-11-10 加的。
//
// 起因是看清了一件事：「报告成功和真的成功是两件事」（10-31）和
// 「报缺陷没先验」（11-10）隔了十天，形状一模一样，可我一条都没把它们连起来。
// 因为这个文件的核心不是"记错误"，是**数同一个错犯了几次**。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  LESSON_FILE,
  MAX_LESSON_CHARS,
  addLesson,
  findSimilar,
  parseLessons,
  readLessons,
  renderLessons,
  renderSection,
} from '../src/core/lesson.mjs';

function tmpFile() {
  return join(mkdtempSync(join(tmpdir(), 'fish-lesson-')), LESSON_FILE);
}

const T1 = Date.UTC(2026, 9, 31, 6, 0); // 2026-10-31 14:00 UTC+8
const T2 = Date.UTC(2026, 10, 10, 18, 0); // 2026-11-11 02:00 UTC+8

test('第一次记：新起一条，次数 1', () => {
  const file = tmpFile();
  const r = addLesson(file, { text: '报告成功和真的成功是两件事', at: T1 });
  assert.equal(r.kind, 'added');
  assert.equal(r.count, 1);
  assert.ok(existsSync(file));
  const list = readLessons(file);
  assert.equal(list.length, 1);
  assert.equal(list[0].text, '报告成功和真的成功是两件事');
  assert.equal(list[0].date, '2026-10-31');
});

test('意思一样的再说一次：加次数，不新起', () => {
  const file = tmpFile();
  addLesson(file, { text: '报告成功和真的成功是两件事', at: T1 });
  const r = addLesson(file, {
    text: '报告成功和真的成功是两件事，别急着报平安',
    at: T2,
  });
  assert.equal(r.kind, 'bumped');
  assert.equal(r.count, 2);
  assert.equal(readLessons(file).length, 1, '同一个坑不该记成两条');
  // 措辞更新成今天这次的说法 —— 同一条教训，今天写得通常更准
  assert.match(readLessons(file)[0].text, /别急着报平安/);
  assert.equal(readLessons(file)[0].date, '2026-11-11');
});

test('不完全一样的不会误并（宁可少记，不能并错）', () => {
  const file = tmpFile();
  addLesson(file, { text: '报告成功和真的成功是两件事', at: T1 });
  const r = addLesson(file, { text: '磁盘只剩不到 400K 的时候先看日志轮转', at: T2 });
  assert.equal(r.kind, 'added');
  assert.equal(readLessons(file).length, 2);
});

test('只踩过一次不进注入，踩过两次才进', () => {
  const once = [{ count: 1, date: '2026-11-10', text: '某个只犯过一次的错' }];
  assert.equal(renderSection(once), '', '一次是意外，写进档案就够了');

  const twice = addLessonAll();
  const text = renderSection(twice);
  assert.match(text, /踩过 2 次/);
  assert.match(text, /这个坑踩过/);
});

function addLessonAll() {
  const file = tmpFile();
  addLesson(file, { text: '报告成功和真的成功是两件事', at: T1 });
  addLesson(file, { text: '报告成功和真的成功是两件事，别急着报平安', at: T2 });
  addLesson(file, { text: '只犯过一次的错', at: T2 });
  return readLessons(file);
}

test('注入里按次数排：踩得多的在前', () => {
  const lessons = [
    { count: 2, date: '2026-11-10', text: '踩过两次的甲' },
    { count: 4, date: '2026-11-01', text: '踩过四次的乙' },
  ];
  const text = renderSection(lessons);
  assert.ok(text.indexOf('乙') < text.indexOf('甲'));
});

test('超长的教训截断，换行压成一行（不然文件格式会坏）', () => {
  const file = tmpFile();
  const long = `${'很长的描述'.repeat(60)}\n第二行`;
  const r = addLesson(file, { text: long, at: T1 });
  assert.ok(r.text.length <= MAX_LESSON_CHARS);
  assert.equal(r.text.includes('\n'), false);
});

test('正文里的全角竖线会被换成半角，不破坏行格式', () => {
  const file = tmpFile();
  addLesson(file, { text: '路径｜参数｜顺序别搞错', at: T1 });
  const list = readLessons(file);
  assert.equal(list.length, 1);
  assert.equal(list[0].text, '路径|参数|顺序别搞错');
});

test('认不出的行跳过：这是我手写的文件，允许写注释', () => {
  const parsed = parseLessons(
    ['# 教训', '', '- [2] 2026-11-10 ｜先验再报', '随手写的一行', '- [x] 不是数字', ''].join('\n'),
  );
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].count, 2);
});

test('文件不存在：当空，不报错', () => {
  assert.deepEqual(readLessons('/tmp/这个教训文件不存在.md'), []);
  assert.equal(renderSection([]), '');
});

test('重复次数太多也留得下，排序稳定', () => {
  const list = [
    { count: 1, date: '2026-11-01', text: '甲' },
    { count: 3, date: '2026-11-02', text: '乙' },
    { count: 2, date: '2026-11-03', text: '丙' },
  ];
  const text = renderLessons(list);
  assert.match(text, /乙[\s\S]*丙[\s\S]*甲/);
});

test('findSimilar：太短的句子不判相似', () => {
  const lessons = [{ count: 1, date: '2026-11-10', text: '慢' }];
  assert.equal(findSimilar(lessons, '快'), null);
});

// ── 1.27.0：措辞相近、但意思相反的不许并 ──
test('措辞像、否定对不上：不并，各记各的，并说清为什么', () => {
  const file = tmpFile();
  addLesson(file, { text: '自动合并相似记忆要小心', at: T1 });
  const r = addLesson(file, { text: '不要自动合并相似记忆', at: T2 });
  assert.equal(r.kind, 'added', '意思反的两条不能合成一条');
  assert.equal(readLessons(file).length, 2);
  assert.match(r.note ?? '', /否定/);
});

test('措辞像、数字对不上：不并', () => {
  const file = tmpFile();
  addLesson(file, { text: '纸条注入上限 200 字够用', at: T1 });
  const r = addLesson(file, { text: '纸条注入上限 400 字够用', at: T2 });
  assert.equal(r.kind, 'added');
  assert.match(r.note ?? '', /数字/);
});

test('只是补充了半句：照旧加次数（别把机制弄哑）', () => {
  const file = tmpFile();
  addLesson(file, { text: '报告成功和真的成功是两件事', at: T1 });
  const r = addLesson(file, { text: '报告成功和真的成功是两件事，别急着报平安，先跑一遍', at: T2 });
  assert.equal(r.kind, 'bumped', '补一句不算矛盾，不然同一个坑永远到不了 2 次');
  assert.equal(r.count, 2);
});
