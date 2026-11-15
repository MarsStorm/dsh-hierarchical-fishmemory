import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RETIRE_RE,
  countRetired,
  countScoped,
  isRetiredLine,
  parseRetire,
  renderRetiredNote,
  retireLine,
  retireMatch,
  splitRetired,
} from '../src/core/retire.mjs';

// 作废标记这条线，赌的是一件事：
// **旧的说法退场，但原文不能消失。**
// 所以每条测试都在问同一个问题 —— 它到底是"不见了"，还是"还找得回来"。

test('加标记：行尾追加，日期用给的时刻', () => {
  const at = Date.UTC(2026, 10, 11, 15, 0, 0);
  const out = retireLine('- 这个插件慢主要慢在候选太多', { at });
  assert.match(out, /^- 这个插件慢主要慢在候选太多 ⟪作废 2026-11-11⟫$/);
});

test('加标记：带理由时写成「后来」', () => {
  const at = Date.UTC(2026, 10, 11, 15, 0, 0);
  const out = retireLine('- 慢在候选太多', { at, by: '判据写错了' });
  assert.match(out, /⟪作废 2026-11-11 → 判据写错了⟫$/);
});

test('加标记是幂等的：不会盖两个章', () => {
  const at = Date.UTC(2026, 10, 11, 15, 0, 0);
  const once = retireLine('- 一句话', { at });
  const twice = retireLine(once, { at });
  assert.equal(twice, once);
  assert.equal((once.match(/⟪作废/g) ?? []).length, 1);
});

test('拆开：还算数的正文里一行都不剩，退场的原文仍在', () => {
  const at = Date.UTC(2026, 10, 11, 15, 0, 0);
  const text = ['# 标题', '- 旧说法', '- 新说法'].map((l, i) => (i === 1 ? retireLine(l, { at, by: '改成新说法' }) : l)).join('\n');
  const { live, retired } = splitRetired(text);
  assert.ok(!live.includes('旧说法'), '退场的那行不该留在注入里');
  assert.ok(live.includes('- 新说法'));
  assert.ok(live.includes('# 标题'), '别的行不能被连累');
  assert.equal(retired.length, 1);
  assert.equal(retired[0].text, '- 旧说法');
  assert.equal(retired[0].at, '2026-11-11');
  assert.equal(retired[0].by, '改成新说法');
});

test('拆开：空文本不炸', () => {
  assert.deepEqual(splitRetired(''), { live: '', retired: [], scoped: [] });
  assert.deepEqual(splitRetired(undefined), { live: '', retired: [], scoped: [] });
});

test('按一段话找到那一行', () => {
  const at = Date.UTC(2026, 10, 11, 15, 0, 0);
  const text = '- 端口是 8080\n- 端口后来改成 3100';
  const { text: out, hit } = retireMatch(text, { match: '8080', at, by: '改成 3100' });
  assert.equal(hit, 1);
  assert.ok(isRetiredLine(out.split('\n')[0]));
  assert.ok(!isRetiredLine(out.split('\n')[1]), '另一行不能被误伤');
});

test('命中多行就全盖，并且如实报数', () => {
  const at = Date.UTC(2026, 10, 11, 15, 0, 0);
  const text = '- webdav 超时\n- webdav 又超时\n- 别的事';
  const { hit } = retireMatch(text, { match: 'webdav', at });
  assert.equal(hit, 2);
});

test('已经作废的行不再重复命中', () => {
  const at = Date.UTC(2026, 10, 11, 15, 0, 0);
  const once = retireMatch('- 旧说法', { match: '旧说法', at });
  const again = retireMatch(once.text, { match: '旧说法', at });
  assert.equal(again.hit, 0, '第二次不该再改一遍');
});

test('match 是空的：什么都不动', () => {
  const { text, hit } = retireMatch('- 一句话', { match: '  ' });
  assert.equal(hit, 0);
  assert.equal(text, '- 一句话');
});

test('数数', () => {
  const at = Date.UTC(2026, 10, 11, 15, 0, 0);
  const text = [retireLine('- a', { at }), '- b', retireLine('- c', { at })].join('\n');
  assert.equal(countRetired(text), 2);
  assert.equal(countRetired('- b'), 0);
});

test('正则认不出「作废」两个字却没有日期的行', () => {
  assert.equal(RETIRE_RE.test('- 这行写着作废，但不是标记'), false);
});

test('退场条目的说明文字：把「后来」也说出来', () => {
  const note = renderRetiredNote([{ at: '2026-11-11', by: '改成 3100', text: '- 端口是 8080' }]);
  assert.match(note, /2026-11-11 作废/);
  assert.match(note, /后来：改成 3100/);
  assert.equal(renderRetiredNote([]), '');
});

// ── 2026-11-15（1.29.0）加：作废可以只针对一句话 ──
//
// 原来的作废是整行的：一个端口号写错了，就把写它时的整个处境一起作废掉。
// 现在可以给 cue —— 只在话题撞上那个词时这条才不算数。

test('带线索的作废：只盖一句话，不整行退场', () => {
  const line = '- 端口是 3080，改了会影响面板';
  const out = retireLine(line, { at: '2026-11-15', cue: '端口' });
  assert.match(out, /只在「端口」时/);
  assert.equal(isRetiredLine(out), true);
  // 整行退场的标记不该出现
  assert.doesNotMatch(out, /⟪作废 2026-11-15⟫/);
});

test('带线索的作废：平时还在注入里，撞上线索才退场', () => {
  const text = ['## 一节', '- 端口是 3080', '- 别的没事'].join('\n');
  const out = retireMatch(text, { match: '端口是 3080', at: '2026-11-15', cue: '端口' });
  assert.equal(out.hit, 1);

  const split = splitRetired(out.text);
  assert.match(split.live, /端口是 3080/, '平时它还在');
  assert.match(split.live, /只在提到「端口」时不算数/, '但得说清什么时候不算');
  assert.equal(split.scoped.length, 1);
  assert.equal(split.retired.length, 0, '不该整条退场');
  assert.equal(countScoped(out.text), 1);
  assert.equal(countRetired(out.text), 0);
});

test('不带线索的作废照旧整行退场', () => {
  const text = '- 端口是 3080';
  const out = retireMatch(text, { match: '端口是 3080', at: '2026-11-15' });
  assert.equal(countRetired(out.text), 1);
  assert.equal(countScoped(out.text), 0);
  assert.equal(splitRetired(out.text).live.trim(), '');
});

test('同一行再给一次线索也不会盖两层', () => {
  const once = retireLine('- 端口是 3080', { at: '2026-11-15', cue: '端口' });
  const twice = retireLine(once, { at: '2026-11-16', cue: '端口' });
  assert.equal(twice, once);
});

test('理由和线索可以并存', () => {
  const out = retireLine('- 端口是 3080', { at: '2026-11-15', cue: '端口', by: '改成自适应' });
  const parsed = parseRetire(out);
  assert.equal(parsed.cue, '端口');
  assert.equal(parsed.by, '改成自适应');
  assert.equal(parsed.scoped, true);
});
