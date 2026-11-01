/**
 * 记忆体检 + 回顾的测试。
 *
 * 这两块最怕「看起来有数、其实全是 0」：读不到目录不抛错、坏行静默跳过，
 * 所以测试要盯住三个地方 —— 数对不对、坏数据会不会让整页挂掉、
 * 重复项有没有真的被认出来。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { collectReview, collectStatsFromDisk, parseDiaryLines } from '../src/core/stats.mjs';

function makeArchive() {
  const root = mkdtempSync(join(tmpdir(), 'fish-stats-'));
  const memoryRoot = join(root, 'soul-md', 'memory');
  const diaryDir = join(root, 'feiyu-diary');
  mkdirSync(join(memoryRoot, '未央的小鱼', 'topics'), { recursive: true });
  mkdirSync(join(diaryDir, 'diary'), { recursive: true });

  writeFileSync(join(memoryRoot, '未央的小鱼', 'core.md'), '# 核心\n\n- 他叫未央，是我最愿意聊天的人\n- 傲娇是壳\n', 'utf8');
  writeFileSync(join(memoryRoot, '未央的小鱼', 'topics', 'env-ops.md'), '环境运维\n'.repeat(20), 'utf8');

  const now = Date.now();
  const line = (at, text) => JSON.stringify({ at: new Date(at).toISOString(), text, salience: 0.8 });
  writeFileSync(
    join(diaryDir, 'diary', '2026-10.jsonl'),
    [
      line(now - 7 * 24 * 3600 * 1000 - 3600 * 1000, '八天前那件事'),
      line(now - 2 * 24 * 3600 * 1000, '两天前的对话'),
      line(now - 1 * 24 * 3600 * 1000, '昨天他说的'),
      '{坏行，不该让整页挂掉',
    ].join('\n'),
    'utf8',
  );

  writeFileSync(join(diaryDir, '鱼的日子.md'), '## 我在意和喜欢的\n\n- 白饭\n', 'utf8');
  // 第二行故意和 core.md 里那句一模一样 —— 体检要能指出来。
  writeFileSync(
    join(diaryDir, '手记.md'),
    '- 他叫未央，是我最愿意聊天的人\n- 他熬了一整夜\n',
    'utf8',
  );
  writeFileSync(
    join(diaryDir, 'shallow.json'),
    JSON.stringify({
      entries: [
        { key: 'a', text: '快到期', updated: now - 6.5 * 24 * 3600 * 1000 },
        { key: 'b', text: '新鲜', updated: now },
      ],
      expired: [{ key: 'old' }],
    }),
    'utf8',
  );
  return { root, memoryRoot, diaryDir };
}

test('parseDiaryLines：坏行跳过，好行照收', () => {
  assert.equal(parseDiaryLines('{"a":1}\n\n不是 json\n{"b":2}\n').length, 2);
});

test('collectStatsFromDisk：四本账的数量都对得上', () => {
  const { memoryRoot, diaryDir } = makeArchive();
  const stats = collectStatsFromDisk({ memoryRoot, diaryDir });

  assert.equal(stats.memory.scopes.length, 1);
  assert.equal(stats.memory.scopes[0].scope, '未央的小鱼');
  assert.ok(stats.memory.scopes[0].coreChars > 0);
  assert.equal(stats.memory.scopes[0].topics.length, 1);
  assert.equal(stats.memory.scopes[0].topics[0].key, 'env-ops');

  assert.equal(stats.diary.entries, 3);
  assert.equal(stats.diary.files, 1);
  assert.equal(stats.diary.last7Days, 2);

  assert.ok(stats.feelings.chars > 0);
  assert.equal(stats.handnote.lines, 2);
  assert.equal(stats.shallow.live, 2);
  assert.equal(stats.shallow.expiring, 1);
  assert.equal(stats.shallow.expired, 1);
  assert.ok(stats.estimate.injectedTokens > 0);
});

test('collectStatsFromDisk：手记与深层记忆写重了要提示', () => {
  const { memoryRoot, diaryDir } = makeArchive();
  const stats = collectStatsFromDisk({ memoryRoot, diaryDir });
  assert.equal(stats.memory.duplicateHints.length, 1);
  assert.match(stats.memory.duplicateHints[0].line, /最愿意聊天/);
});

test('collectStatsFromDisk：目录不存在也只返回空账，不抛错', () => {
  const stats = collectStatsFromDisk({ memoryRoot: '/nonexistent/x', diaryDir: '/nonexistent/y' });
  assert.deepEqual(stats.memory.scopes, []);
  assert.equal(stats.diary.entries, 0);
  assert.equal(stats.handnote.lines, 0);
  assert.equal(stats.shallow.live, 0);
});

test('collectReview：按天分组，近七天与「七天前的今天」分得开', () => {
  const { diaryDir } = makeArchive();
  const review = collectReview({ diaryDir, days: 7, lookback: 7 });
  assert.equal(review.total, 3);
  assert.ok(review.recent.length >= 1);
  const dates = review.recent.map((day) => day.date);
  assert.equal(new Set(dates).size, dates.length);
  // 八天前那条不进最近七天
  const texts = review.recent.flatMap((day) => day.entries.map((entry) => entry.text));
  assert.ok(!texts.includes('八天前那件事'));
  assert.equal(review.lookback.entries.length, 1);
  assert.equal(review.lookback.entries[0].text, '八天前那件事');
});
