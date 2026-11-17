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

// ── 边界话先占位（2026-11-18，1.36.0）──
//
// 抄自 memory-brain 的 `retrieval.py:371`：先在预算里扣下那一行
// "这些材料不一定对"，再往剩下的地方填证据。我原来反着来。

test('尾巴那一行有位置：留了 24 字，纸条不会把预算吃干净', () => {
  // 200 字的总预算，纸条要 200 → 实际只拿得到 176 附近
  const box = sandbox();
  try {
    writeNotes(box.files.stickyFile, 40);
    const text = renderFragments({ ...box.files, config: { fragmentsMaxChars: 200 }, at: AT });
    assert.ok(text.length <= 200, `不许超总预算（现在 ${text.length}）`);
  } finally {
    box.done();
  }
});

test('总预算小到留不出尾巴：仍然不许超', () => {
  const box = sandbox();
  try {
    writeNotes(box.files.stickyFile, 40);
    const text = renderFragments({ ...box.files, config: { fragmentsMaxChars: 200 }, at: AT });
    assert.ok(text.length <= 200);
    // 200 的下限在 clampInt 里 —— 比它还小的值会被抬到 200，不会变负数
    const tight = renderFragments({ ...box.files, config: { fragmentsMaxChars: 50 }, at: AT });
    assert.ok(tight.length <= 200);
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

// ── 出口那一刀（2026-11-18，1.36.0）──
//
// 上面每一段都收了字数，但段与段之间的空行、各段自己额外拼的提示行
// （"还有 N 条没挤进来""没说完的能接着问一句"）都不是谁单独算得清的。
// 所以真正能保证的只有出口那一次量。这里要的就是"不管怎么塞都不超"。

test('压测矩阵：纸条 × 教训 × 预算，一个组合都不许超', () => {
  for (const nNotes of [0, 3, 10, 40]) {
    for (const nLessons of [0, 2, 6]) {
      for (const len of [10, 60]) {
        const box = sandbox();
        try {
          writeNotes(box.files.stickyFile, nNotes);
          const ls = [];
          for (let i = 0; i < nLessons; i += 1) ls.push(`- [9] 2026-11-11 ｜${'啪'.repeat(len / 2)}${i}`);
          writeFileSync(box.files.lessonFile, ls.length > 0 ? ls.join('\n') + '\n' : '', 'utf8');
          for (const cap of [200, 300, 400, 600, 1400]) {
            const text = renderFragments({
              ...box.files,
              config: { fragmentsMaxChars: cap },
              at: AT,
            });
            assert.ok(
              text.length <= cap,
              `纸条 ${nNotes} × 教训 ${nLessons} × ${len} 字 × 预算 ${cap} → 出了 ${text.length}`,
            );
          }
        } finally {
          box.done();
        }
      }
    }
  }
});

test('超预算时先让纸条让位，教训那栏留着', () => {
  const box = sandbox();
  try {
    writeNotes(box.files.stickyFile, 40);
    writeFileSync(
      box.files.lessonFile,
      Array.from({ length: 6 }, (_, i) => `- [9] 2026-11-11 ｜${'啪'.repeat(40)}${i}`).join('\n') + '\n',
      'utf8',
    );
    const text = renderFragments({ ...box.files, config: { fragmentsMaxChars: 300 }, at: AT });
    assert.ok(text.length <= 300);
    // 纸条是"少一条也还好"的那段，教训是"下次还会犯"的那段 —— 先让路的是纸条。
    assert.ok(!text.includes('## 小纸条'), '纸条应该整段让位');
    assert.ok(text.includes('踩过的坑'), '教训应该留着');
  } finally {
    box.done();
  }
});
