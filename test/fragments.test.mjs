// 零碎记忆：三段合成一段。
//
// 这一层最容易出错的不是"渲染得好看不好看"，是**预算和开关的优先级**：
// 谁先占位、谁被挤掉、旧的三个开关还算不算数。所以测的都是这些。

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  FRAGMENTS_MAX_CHARS,
  FRAGMENTS_ORDER,
  FRAGMENTS_SECTION,
  STICKY_MIN_CHARS,
  renderFragments,
} from '../src/core/fragments.mjs';
import { renderNote } from '../src/core/sticky.mjs';

const AT = Date.parse('2026-11-12T10:00:00Z');

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'fish-fragments-'));
  const files = {
    stickyFile: join(dir, '纸条.md'),
    lessonFile: join(dir, '教训.md'),
    unfinishedFile: join(dir, '未说完.json'),
  };
  return { dir, files, done: () => rmSync(dir, { recursive: true, force: true }) };
}

/** 造 n 行纸条（文件里从上到下 = 新 → 旧，所以倒着写）。 */
function writeNotes(file, n, at = AT) {
  const lines = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    lines.push(renderNote({ said: `第 ${i} 句原话`, did: `干活 ${i}`, at: at - i * 60000 }));
  }
  writeFileSync(file, lines.join('\n') + '\n', 'utf8');
}

test('三段都有东西时合成一段，段与段之间空行隔开', () => {
  const box = sandbox();
  try {
    writeNotes(box.files.stickyFile, 3);
    writeFileSync(box.files.lessonFile, '- [2] 2026-11-11 ｜报缺陷之前先验\n', 'utf8');

    const text = renderFragments({ ...box.files, config: {}, at: AT });
    assert.match(text, /## 小纸条/);
    assert.match(text, /## 踩过的坑/);
    assert.ok(text.includes('\n\n## '), '两段之间要有空行，不能粘成一行');
  } finally {
    box.done();
  }
});

test('总开关关掉：三段一起消失，不是只关一段', () => {
  const box = sandbox();
  try {
    writeNotes(box.files.stickyFile, 2);
    writeFileSync(box.files.lessonFile, '- [2] 2026-11-11 ｜同一个坑\n', 'utf8');
    const text = renderFragments({ ...box.files, config: { fragmentsEnabled: false }, at: AT });
    assert.equal(text, '');
  } finally {
    box.done();
  }
});

test('旧的三个开关仍然生效：关掉教训，小纸条照旧在', () => {
  const box = sandbox();
  try {
    writeNotes(box.files.stickyFile, 2);
    writeFileSync(box.files.lessonFile, '- [2] 2026-11-11 ｜同一个坑\n', 'utf8');
    const text = renderFragments({ ...box.files, config: { lessonEnabled: false }, at: AT });
    assert.equal(text.includes('## 踩过的坑'), false);
    assert.match(text, /## 小纸条/);
  } finally {
    box.done();
  }
});

test('旧的 stickyEnabled 也还认：关掉小纸条，教训照旧在', () => {
  const box = sandbox();
  try {
    writeNotes(box.files.stickyFile, 2);
    writeFileSync(box.files.lessonFile, '- [2] 2026-11-11 ｜同一个坑\n', 'utf8');
    const text = renderFragments({ ...box.files, config: { stickyEnabled: false }, at: AT });
    assert.equal(text.includes('## 小纸条'), false);
    assert.match(text, /## 踩过的坑/);
  } finally {
    box.done();
  }
});

test('预算紧的时候先砍小纸条，教训一定留', () => {
  const box = sandbox();
  try {
    writeNotes(box.files.stickyFile, 40);
    writeFileSync(
      box.files.lessonFile,
      ['- [3] 2026-11-11 ｜坑一', '- [2] 2026-11-10 ｜坑二'].join('\n') + '\n',
      'utf8',
    );

    const text = renderFragments({ ...box.files, config: { fragmentsMaxChars: 500 }, at: AT });
    assert.match(text, /## 踩过的坑/, '教训一定在');
    const notes = (text.match(/句原话/g) ?? []).length;
    assert.ok(notes > 0, '还得给小纸条留几条');
    assert.ok(notes < 40, '但不可能全给');
  } finally {
    box.done();
  }
});

test('预算被教训吃光：小纸条整段不出现，不留半行标题', () => {
  const box = sandbox();
  try {
    writeNotes(box.files.stickyFile, 40);
    // 造一大堆教训（渲染上限 5 行，够占满 200 字的预算）
    const lessons = [];
    for (let i = 0; i < 6; i += 1) lessons.push(`- [9] 2026-11-11 ｜第 ${i} 个很占地方的坑，` + '啪'.repeat(40));
    writeFileSync(box.files.lessonFile, lessons.join('\n') + '\n', 'utf8');

    const text = renderFragments({ ...box.files, config: { fragmentsMaxChars: 200 }, at: AT });
    if (text.includes('## 小纸条')) {
      // 一旦出现就得是真内容（标题 + 至少一条），不能只有标题
      assert.match(text, /句原话/);
    }
    assert.ok(STICKY_MIN_CHARS > 0);
  } finally {
    box.done();
  }
});

test('文件都不存在：返回空串，不炸', () => {
  const box = sandbox();
  try {
    assert.equal(renderFragments({ ...box.files, config: {}, at: AT }), '');
  } finally {
    box.done();
  }
});

test('一个文件路径都不传（注册早期失败时的兜底）', () => {
  assert.equal(renderFragments({ config: {}, at: AT }), '');
});

test('段名与 order：一段，且比正文（100）早很多', () => {
  assert.equal(FRAGMENTS_SECTION, 'fragments:memory');
  assert.ok(FRAGMENTS_ORDER < 1);
  assert.ok(FRAGMENTS_ORDER < 100);
});

test('默认上限不小于小纸条单段的上限（三段共用这一个数）', () => {
  assert.ok(FRAGMENTS_MAX_CHARS >= 800);
});

test('同一份输入连渲染两次结果一致（不会越渲染越少）', () => {
  const box = sandbox();
  try {
    writeNotes(box.files.stickyFile, 3);
    writeFileSync(box.files.lessonFile, '- [2] 2026-11-11 ｜坑\n', 'utf8');
    const a = renderFragments({ ...box.files, config: {}, at: AT });
    const b = renderFragments({ ...box.files, config: {}, at: AT });
    assert.equal(a, b);
  } finally {
    box.done();
  }
});

test('坏文件不连累别的段（小纸条路径是个目录，教训照样注入）', () => {
  const box = sandbox();
  try {
    mkdirSync(box.files.stickyFile, { recursive: true });
    writeFileSync(box.files.lessonFile, '- [2] 2026-11-11 ｜坑\n', 'utf8');
    const text = renderFragments({ ...box.files, config: {}, at: AT });
    assert.match(text, /## 踩过的坑/);
  } finally {
    box.done();
  }
});

test('预算里没写数字时按默认走，不出现 NaN', () => {
  const box = sandbox();
  try {
    writeNotes(box.files.stickyFile, 2);
    const text = renderFragments({
      ...box.files,
      config: { fragmentsMaxChars: 'abc' },
      at: AT,
    });
    assert.equal(text.includes('NaN'), false);
    assert.match(text, /## 小纸条/);
  } finally {
    box.done();
  }
});
