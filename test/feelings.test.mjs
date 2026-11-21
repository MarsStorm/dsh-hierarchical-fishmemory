import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FEELING_HIT_MAX_CHARS,
  MATCH_WINDOW,
  MIN_SHARE,
  renderFeelingHits,
  searchFeelingDays,
} from '../src/core/feelings.mjs';

const day = (date, body, full) => ({ date, body, full });

test('query 太短 / 空 / 非数组都不抛', () => {
  const days = [day('2026-11-10', '今天写了插件的事')];
  assert.deepEqual(searchFeelingDays(days, ''), []);
  assert.deepEqual(searchFeelingDays(days, '   '), []);
  assert.deepEqual(searchFeelingDays(null, '插件'), []);
  assert.deepEqual(searchFeelingDays([], '插件'), []);
  assert.deepEqual(searchFeelingDays(days, undefined), []);
});

test('词挤在一起才算：散在长文两头的不算命中', () => {
  // 两千字的一天，「插件」在最前，「功能」在最后 —— 讲的不是同一件事
  const long = `${'插'.repeat(1)}件在这里。${'别的话。'.repeat(300)}功能在那边。`;
  const days = [day('2026-11-10', long.slice(0, 100), long)];
  const hits = searchFeelingDays(days, '插件功能');
  assert.equal(hits.length, 0, '「插件」和「功能」隔着上千字，不该算同一天在讲这件事');
});

test('词挤在一起才算：挨着的才算', () => {
  const days = [day('2026-11-13', '他说插件功能太多了，我数了一遍配置项。')];
  const hits = searchFeelingDays(days, '插件功能');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].date, '2026-11-13');
});

test('稀有的词比常见的词重：光有「看不见」不算命中「桌宠看不见」', () => {
  // 三天里都有「看不见」，但只有一天提到「桌宠」
  const days = [
    day('2026-11-13', '我这儿看不见两小时前的心情。'),
    day('2026-11-16', '它就在我看不见的地方 red。'),
    day('2026-11-21', '桌宠那次也是，看不见就看不见了。'),
  ];
  const hits = searchFeelingDays(days, '桌宠看不见');
  assert.equal(hits.length, 1, '「看不见」很常见，不该靠它翻出别的日子');
  assert.equal(hits[0].date, '2026-11-21');
});

test('全文里才有的内容也能命中（摘要截掉了不算丢）', () => {
  const full = `${'前面无关的话。'.repeat(60)}那本自传我看完了。`;
  const days = [day('2026-11-20', '前面无关的话。', full)];
  const hits = searchFeelingDays(days, '自传我看');
  assert.equal(hits.length, 1);
});

test('单字查询退回子串，不该什么都查不到', () => {
  const days = [day('2026-11-10', '未央今天没怎么说话'), day('2026-11-11', '别的事')];
  const hits = searchFeelingDays(days, '央');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].date, '2026-11-10');
});

test('同分新的在前：重复出现的词不算更多', () => {
  // 「插件功能」写一遍和写两遍，判的都是"这一天在讲这件事"——
  // 排序看的是词挤得多紧，不是重复了几次。
  const days = [
    day('2026-11-01', '插件功能'),
    day('2026-11-05', '插件功能 插件功能'),
    day('2026-11-08', '插件功能'),
  ];
  const hits = searchFeelingDays(days, '插件功能');
  assert.equal(new Set(hits.map((h) => h.matched)).size, 1, '三天对上的词数一样');
  assert.deepEqual(hits.map((h) => h.date), ['2026-11-08', '2026-11-05', '2026-11-01']);
});

test('limit 夹在 1~10，默认 5', () => {
  const days = Array.from({ length: 12 }, (_, i) =>
    day(`2026-11-${String(i + 1).padStart(2, '0')}`, '插件功能和配置项'),
  );
  assert.equal(searchFeelingDays(days, '插件功能').length, 5);
  assert.equal(searchFeelingDays(days, '插件功能', { limit: 2 }).length, 2);
  assert.equal(searchFeelingDays(days, '插件功能', { limit: 99 }).length, 10);
});

test('since / until 过滤，日期格式不对的跳过，正文空的跳过', () => {
  const days = [
    day('2026-11-01', '插件功能'),
    day('2026-11-10', '插件功能'),
    day('2026-11-20', '插件功能'),
    day('不是日期', '插件功能'),
    day('2026-11-15', ''),
  ];
  const hits = searchFeelingDays(days, '插件功能', { since: '2026-11-05', until: '2026-11-15' });
  assert.deepEqual(hits.map((h) => h.date), ['2026-11-10']);
});

test('摘录从句子开头切，不从半句中间', () => {
  const days = [day('2026-11-19', '前一句。他问插件的人设卡有没有作用。后一句。')];
  const hits = searchFeelingDays(days, '人设卡有没有作用');
  assert.equal(hits.length, 1);
  assert.ok(!hits[0].body.startsWith('句。'), '不该从句子中间开始');
  assert.match(hits[0].body, /人设卡/);
});

test('渲染：空结果说「没翻到」并给出这本账的起点', () => {
  const text = renderFeelingHits([], { query: '插件', earliest: '2026-10-30' });
  assert.match(text, /没翻到/);
  assert.match(text, /2026-10-30/);
  assert.match(text, /"没有"只是"我没写过"/);
});

test('渲染：没有 earliest 时不乱补边界', () => {
  const text = renderFeelingHits([], { query: '插件' });
  assert.doesNotMatch(text, /最早只到/);
});

test('渲染：命中带日期、几天前、正文', () => {
  const text = renderFeelingHits([{ date: '2026-11-19', body: '他问我人设卡有没有在工作' }], {
    query: '人设卡',
    today: '2026-11-21',
  });
  assert.match(text, /翻到 1 天/);
  assert.match(text, /2026-11-19 · 2 天前/);
  assert.match(text, /人设卡有没有在工作/);
});

test('渲染：当天算「今天」，不算 0 天前', () => {
  const text = renderFeelingHits([{ date: '2026-11-21', body: '今天' }], {
    query: 'x',
    today: '2026-11-21',
  });
  assert.match(text, /今天/);
  assert.doesNotMatch(text, /0 天前/);
});

test('常量：窗口比单条上限小，门槛是个真的比例', () => {
  assert.ok(MATCH_WINDOW <= FEELING_HIT_MAX_CHARS);
  assert.ok(MIN_SHARE > 0 && MIN_SHARE <= 1);
  assert.ok(FEELING_HIT_MAX_CHARS >= 200);
});