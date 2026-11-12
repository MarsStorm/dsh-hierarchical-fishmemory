import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  VOICE_MAX_CHARS,
  excerpt,
  latestOfDay,
  pickBySeed,
  renderVoice,
  seedOfDay,
} from '../src/core/voice.mjs';

const DIARY = [
  '# 鱼的日子',
  '',
  '## 2026-11-12',
  '',
  '### 深夜 · 四种"没有"',
  '',
  '他把我发过三次的仓库又发来一次。我核对过，一行没变。',
  '',
  '## 2026-11-13',
  '',
  '### 凌晨 · 归堆',
  '',
  '他说最近功能太多、有点乱套了。',
  '',
  '### 凌晨两点半 · 把「安静消失」找出来',
  '',
  '**今晚**做的东西里，最不起眼的一件反而最像回事：挤掉了要说一声。',
  '',
  '剩下 88 条以前哪儿也没去 —— 就是没出现，还没人知道。',
  '',
].join('\n');

test('今天没写：给空串，不占位置', () => {
  assert.equal(renderVoice(DIARY, { today: '2026-11-14' }), '');
  assert.equal(renderVoice('', { today: '2026-11-13' }), '');
  assert.equal(renderVoice(DIARY, {}), '');
  assert.equal(renderVoice(DIARY, { today: 'bad' }), '');
});

test('不会把「11-1」当成「11-13」：只认整行相等', () => {
  const md = '## 2026-11-1\n\n### 夜里\n\n这一天是 1 号。\n';
  assert.equal(renderVoice(md, { today: '2026-11-13' }), '');
  assert.equal(latestOfDay(md, '2026-11-13'), null);
});

test('取今天的最后一个小节，不把前面那几个混进来', () => {
  const latest = latestOfDay(DIARY, '2026-11-13');
  assert.equal(latest.title, '凌晨两点半 · 把「安静消失」找出来');
  assert.match(latest.text, /挤掉了要说一声/);
  assert.doesNotMatch(latest.text, /功能太多/);
});

test('渲染出来：标题、摘录、一句分寸话；不出现 Markdown 记号', () => {
  const block = renderVoice(DIARY, { today: '2026-11-13' });
  assert.match(block, /^## /);
  assert.match(block, /挤掉了要说一声/);
  assert.match(block, /（.+）$/);
  assert.doesNotMatch(block, /\*\*/);
  assert.doesNotMatch(block, /`/);
  // 不许写成"检测到""系统""注入"这种腔
  assert.doesNotMatch(block, /检测到|系统|注入|匹配/);
});

test('同一天怎么渲染都一个字不差 —— 否则每轮都会打碎前缀缓存', () => {
  assert.equal(
    renderVoice(DIARY, { today: '2026-11-13' }),
    renderVoice(DIARY, { today: '2026-11-13' }),
  );
});

test('换天要换口气：连着四天不该是同一套说法', () => {
  const blocks = ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'].map((today) =>
    renderVoice(DIARY, { today }),
  );
  const heads = new Set(blocks.map((b) => b.split('\n')[0]));
  assert.ok(heads.size >= 2, `四种说法该轮着来，结果全是：${[...heads].join(' / ')}`);
});

test('excerpt：超长按句号断，断不出来才加省略号', () => {
  const long = '第一句在这里。'.repeat(20);
  const out = excerpt(long, 30);
  assert.ok([...out].length <= 30, `断完还是太长：${[...out].length}`);
  assert.ok(out.endsWith('。'), '该落在句号上');

  const noStop = '啊'.repeat(200);
  const hard = excerpt(noStop, 30);
  assert.ok(hard.endsWith('…'), '断不出句子就得加省略号，别假装说完了');
  assert.ok([...hard].length <= 31);
});

test('句子长的时候只留第一句 —— 拼到上限就成摘要，摘要就是工单腔', () => {
  // 必须超过上限才会走到"截"的那条路；上限之内整段留着（它本来就装得下）
  const text =
    '今晚做的东西里，最不起眼的一件反而最像回事：挤掉了要说一声。'
    + '纸条攒了 94 条，注入只放得下 6 条，剩下 88 条以前哪儿也没去。'
    + '现在那一行末尾会写一句还有多少条在门外站着，第一次看见的时候我愣了一下。';
  assert.ok([...text].length > 90);
  assert.equal(excerpt(text, 90), '今晚做的东西里，最不起眼的一件反而最像回事：挤掉了要说一声。');
});

test('第一句太短（「嗯。」）才往后补，不能只剩两个字', () => {
  const text = '嗯。' + '然后我又坐了一会儿，什么也没说。'.repeat(5);
  const out = excerpt(text, 60);
  assert.ok([...out].length > 10, `只剩「${out}」就太短了`);
  assert.ok([...out].length <= 60);
});

test('excerpt：短的原文原样返回，不剪也不加标点', () => {
  assert.equal(excerpt('今晚很安静。', 90), '今晚很安静。');
  assert.equal(excerpt('  今晚\n\n很安静。  ', 90), '今晚 很安静。');
  assert.equal(excerpt('', 90), '');
  assert.equal(VOICE_MAX_CHARS, 90);
});

test('pickBySeed / seedOfDay：稳定、可重复、不越界', () => {
  const arr = ['a', 'b', 'c'];
  assert.equal(pickBySeed(arr, 7), pickBySeed(arr, 7));
  for (let i = 0; i < 50; i += 1) assert.ok(arr.includes(pickBySeed(arr, i)));
  assert.equal(pickBySeed([], 3), '');
  // 相邻两天不该算出同一个种子（否则"按天换"其实两天一换）
  assert.notEqual(seedOfDay('2026-11-13'), seedOfDay('2026-11-14'));
});
