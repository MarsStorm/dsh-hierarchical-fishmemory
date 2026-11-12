// 没说完的半句话会发酵 —— 2026-11-11 加的。
//
// 这一层最容易做坏的地方不是代码，是分寸：
// 追着问成了骚扰，每轮都提成了清算账目。所以测试重点在"什么时候不该说"。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  MAX_AGE_DAYS,
  MIN_AGE_DAYS,
  dayKey,
  harvest,
  loadStore,
  markAsked,
  pickRipe,
  renderSection,
  unfinishedPath,
} from '../src/core/unfinished.mjs';

// 2026-11-11 02:00 (UTC+8) —— 深夜
const NIGHT = Date.UTC(2026, 10, 10, 18, 0);
// 2026-11-11 14:00 (UTC+8) —— 下午
const DAY = Date.UTC(2026, 10, 11, 6, 0);
const DAY_MS = 86_400_000;

function tmpFile() {
  return unfinishedPath(mkdtempSync(join(tmpdir(), 'fish-unfinished-')));
}

test('收进来：只收真的断了的，收回去的不收', () => {
  const file = tmpFile();
  const added = harvest(
    file,
    [
      { said: '那个……', at: NIGHT - 5 * DAY_MS },
      { said: '算了，没什么', at: NIGHT - 5 * DAY_MS },
      { said: '今天天气不错', at: NIGHT - 5 * DAY_MS },
    ],
    { at: NIGHT },
  );
  assert.equal(added, 1, '「算了」不追问，完整的话不进册');
  const store = loadStore(file);
  assert.equal(store.records.length, 1);
  assert.equal(store.records[0].said, '那个……');
});

test('同一句重复收：次数 +1（真卡在心口的信号）', () => {
  const file = tmpFile();
  harvest(file, [{ said: '就是那个……', at: NIGHT - 5 * DAY_MS }], { at: NIGHT });
  harvest(file, [{ said: '就是那个……', at: NIGHT - 4 * DAY_MS }], { at: NIGHT });
  const store = loadStore(file);
  assert.equal(store.records.length, 1);
  assert.equal(store.records[0].times, 2);
});

test('夜里的第三天会浮上来', () => {
  const file = tmpFile();
  harvest(file, [{ said: '那个……', at: NIGHT - MIN_AGE_DAYS * DAY_MS }], { at: NIGHT });
  const item = pickRipe(loadStore(file), { at: NIGHT, phase: '深夜' });
  assert.ok(item !== null);
  assert.equal(item.said, '那个……');
  assert.equal(item.days, MIN_AGE_DAYS);
});

test('刚说完的不浮（当天就问很冒犯）', () => {
  const file = tmpFile();
  harvest(file, [{ said: '那个……', at: NIGHT }], { at: NIGHT });
  assert.equal(pickRipe(loadStore(file), { at: NIGHT, phase: '深夜' }), null);
});

test('太久的也不翻（超过 14 天像考古）', () => {
  const file = tmpFile();
  harvest(file, [{ said: '那个……', at: NIGHT - (MAX_AGE_DAYS + 1) * DAY_MS }], { at: NIGHT });
  assert.equal(pickRipe(loadStore(file), { at: NIGHT, phase: '深夜' }), null);
});

test('白天不浮：他突然翻旧账很怪', () => {
  const file = tmpFile();
  harvest(file, [{ said: '那个……', at: DAY - 5 * DAY_MS }], { at: DAY });
  assert.equal(pickRipe(loadStore(file), { at: DAY, phase: '下午' }), null);
  assert.equal(pickRipe(loadStore(file), { at: DAY, phase: '上午' }), null);
});

test('问过一次就不再问（追着问是骚扰）', () => {
  const file = tmpFile();
  harvest(file, [{ said: '那个……', at: NIGHT - 5 * DAY_MS }], { at: NIGHT });
  const item = pickRipe(loadStore(file), { at: NIGHT, phase: '深夜' });
  assert.ok(item);
  markAsked(file, item, { at: NIGHT });
  // 换一天夜里，也不该再浮
  assert.equal(
    pickRipe(loadStore(file), { at: NIGHT + DAY_MS, phase: '深夜' }),
    null,
  );
});

test('一天最多问一次', () => {
  const file = tmpFile();
  harvest(
    file,
    [
      { said: '那个……', at: NIGHT - 5 * DAY_MS },
      { said: '我就是想说……', at: NIGHT - 6 * DAY_MS },
    ],
    { at: NIGHT },
  );
  const first = pickRipe(loadStore(file), { at: NIGHT, phase: '深夜' });
  markAsked(file, first, { at: NIGHT });
  // 同一天稍晚一点，就算换了 phase 也不该再浮
  const later = pickRipe(loadStore(file), { at: NIGHT + 3600_000, phase: '凌晨' });
  assert.equal(later, null, '同一天只许问一次');
});

test('断了好几次的优先于只断一次的', () => {
  const file = tmpFile();
  harvest(
    file,
    [
      { said: '那个……', at: NIGHT - 4 * DAY_MS },
      { said: '就是那个……', at: NIGHT - 5 * DAY_MS },
    ],
    { at: NIGHT },
  );
  // 让「就是那个……」的 times 变成 2
  harvest(file, [{ said: '就是那个……', at: NIGHT - 3 * DAY_MS }], { at: NIGHT });
  const item = pickRipe(loadStore(file), { at: NIGHT, phase: '深夜' });
  assert.equal(item.said, '就是那个……', '断两次的那句更该问');
  assert.equal(item.times, 2);
});

test('渲染出来像我自己想起来的，不像系统提醒', () => {
  const text = renderSection(
    { said: '那个……', at: NIGHT - 3 * DAY_MS, days: 3, times: 1, did: '在帮他调插件' },
    { at: NIGHT },
  );
  assert.match(text, /忽然想起来一句/);
  assert.match(text, /「那个……」/);
  assert.match(text, /3 天前/);
  // 分寸话从 2026-11-13 起按天轮换，不再写死「后来呢」那一句
  assert.match(text, /（.+）$/, '末尾得有一句分寸话');
  assert.doesNotMatch(text, /检测到|未完成语句|系统/);
});

test('分寸话按天轮换：同一天不变，换天换口气', () => {
  const item = { said: '那个……', at: NIGHT - 3 * DAY_MS, days: 3, times: 1, did: '在帮他调插件' };
  const a = renderSection(item, { at: NIGHT });
  const b = renderSection(item, { at: NIGHT });
  assert.equal(a, b, '同一天必须同字面，否则每轮打碎前缀缓存');
  const seen = new Set(
    [0, 1, 2, 3].map((d) => renderSection(item, { at: NIGHT + d * DAY_MS }).split('\n').pop()),
  );
  assert.ok(seen.size >= 2, '连着四天不该是同一句');
});

test('空记录：new 一个空 store，不炸', () => {
  const store = loadStore('/tmp/这个文件不存在-未说完.json');
  assert.deepEqual(store.records, []);
  assert.equal(pickRipe(store, { at: NIGHT, phase: '深夜' }), null);
  assert.equal(renderSection(null), '');
});

test('dayKey 用他那边的一天，不是本机 UTC', () => {
  // 2026-11-10T18:00Z = 他那边 11-11 02:00
  assert.equal(dayKey(NIGHT), '2026-11-11');
});
