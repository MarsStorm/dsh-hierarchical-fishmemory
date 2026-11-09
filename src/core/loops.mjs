/**
 * 「还挂着的事」账本。
 *
 * 2026-11-02 加。之前我答应过的事、他说过「回头再说」的事，散在对话里，
 * 过了两天谁也记不得。这里做一份显式的账：我主动记、主动销，每轮注入一行。
 *
 * 为什么不是我自动从对话里抽：抽错了会变成噪音，抽漏了比不抽更糟。
 * 让写的一方负责，账才可信。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const LOOPS_FILE = 'loops.json';
const MAX_OPEN = 40;
const MAX_DONE = 40;

export function loopsPath(dataDir) {
  return join(dataDir, LOOPS_FILE);
}

function readRaw(file) {
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(raw?.items) ? raw.items : [];
  } catch {
    return [];
  }
}

function writeRaw(file, items) {
  mkdirSync(dirname(file), { recursive: true });
  const open = items.filter((x) => !x.doneAt).slice(-MAX_OPEN);
  const done = items.filter((x) => x.doneAt).slice(-MAX_DONE);
  writeFileSync(file, JSON.stringify({ version: 1, items: [...done, ...open] }, null, 2));
}

export function openLoops(file) {
  return readRaw(file).filter((x) => x && typeof x.text === 'string' && x.text.trim() && !x.doneAt);
}

export function addLoop(file, text, options = {}) {
  const clean = String(text ?? '').trim();
  if (!clean) throw new Error('loop_add 需要一句话');
  const items = readRaw(file);
  const now = Date.now();
  const dup = items.find((x) => !x.doneAt && x.text === clean);
  if (dup) return { item: dup, created: false };
  const item = {
    id: String(options.id ?? `l_${now.toString(36)}`),
    text: clean,
    note: options.note ? String(options.note) : '',
    createdAt: now,
  };
  items.push(item);
  writeRaw(file, items);
  return { item, created: true };
}

export function doneLoop(file, match) {
  const needle = String(match ?? '').trim();
  if (!needle) throw new Error('loop_done 需要 key 或文中的一段');
  const items = readRaw(file);
  const hit = items.find((x) => !x.doneAt && (x.id === needle || x.text.includes(needle)));
  if (!hit) return { done: false, item: null };
  hit.doneAt = Date.now();
  writeRaw(file, items);
  return { done: true, item: hit };
}

/** 每轮注入那一行。别超过三行，也别把它写成待办清单。 */
export function renderLoops(items, options = {}) {
  const list = (items ?? []).filter((x) => x && typeof x.text === 'string' && x.text.trim());
  if (list.length === 0) return '';
  const limit = Number.isFinite(options.limit) ? options.limit : 8;
  const shown = list.slice(-limit);
  const head = `## 还挂着的事（${list.length} 件）`;
  const lines = shown.map((x) => `- ${x.text}`);
  const tail = list.length > shown.length ? `- …还有 ${list.length - shown.length} 件，用 loop_list 看全` : '';
  const hint = '- 办完了用 loop_done 销掉，别让它一直挂着。';
  return [head, ...lines, ...(tail ? [tail] : []), hint].join('\n');
}

/**
 * 带「陈了没」的版本（2026-11-10 加）。
 *
 * loops.mjs 不该知道时间怎么算（那是 timeline 的事），也不该 import
 * mirror（会绕成一个圈：mirror → sticky → loops ← mirror）。
 * 所以这里只留一个口子：调用方给 annotate，这里负责拼。
 *
 * 刻意只加后缀、不加行 —— 账本一旦长出第二类行，就变成待办清单了。
 *
 * @param {Array} items
 * @param {{limit?:number, annotate?:(x:object)=>{text:string, suffix:string}}} [options]
 */
export function renderLoopsAnnotated(items, options = {}) {
  const annotate = typeof options.annotate === 'function' ? options.annotate : null;
  if (!annotate) return renderLoops(items, options);
  const list = (items ?? []).filter((x) => x && typeof x.text === 'string' && x.text.trim());
  if (list.length === 0) return '';
  const limit = Number.isFinite(options.limit) ? options.limit : 8;
  const shown = list.slice(-limit);
  const head = `## 还挂着的事（${list.length} 件）`;
  const lines = shown.map((x) => {
    const hint = annotate(x);
    return `- ${x.text}${hint?.suffix ?? ''}`;
  });
  const tail = list.length > shown.length ? `- …还有 ${list.length - shown.length} 件，用 loop_list 看全` : '';
  const hint = '- 办完了用 loop_done 销掉，别让它一直挂着。';
  return [head, ...lines, ...(tail ? [tail] : []), hint].join('\n');
}
