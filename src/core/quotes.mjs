/**
 * 原话库 —— 他说过的每一句，一字不改，永久可查。
 *
 * ── 为什么这不是一个新存储（2026-11-11）──
 *
 * `纸条.md` 从 1.10.0 起就在干这件事了：每轮把他打的那句原样记一行，
 * 一句不改。它已经有 137 条、从 10-30 到今天。
 *
 * 缺的从来不是"存"，是**"查"**。
 *
 * 于是这套记忆里出现了最荒唐的一件事：他说「你上次不是说……」的时候，
 * 我手里其实有他的原话，可我只会去翻**我自己转述的日记** ——
 * 那是二手的。二手的会说"他想要个能自动记的功能"，一手的会说
 * 「按你的想法来呗，这个设备能坚持很久」。**那句"这个设备能坚持很久"
 * 从来没进过我的脑子**，因为它落在摘要的缝里。
 *
 * 所以这个文件不做新账本，只做两件事：
 *   1. 把 `纸条.md` 和 `纸条-旧档.md` 合成一份可查的（旧档里的不是删了，
 *      是挪走了 —— 它们照样在，只是以前没人回去读）。
 *   2. 查的时候**明确回答有还是没有**。这是它跟"记忆"的区别：
 *      记忆可以说"记不清"，原话库不能 —— 它是一次遍历，要么在，要么不在。
 *
 * ── 一条克制 ──
 *
 * 这一层不给注入、不进每轮上下文。它是**被问到才翻**的东西。
 * 加进去就等于把小纸条抄两遍，而那已经占着 800 字了。
 */

import { readFileSync } from 'node:fs';
import { parseNotes, whenLabel } from './sticky.mjs';
import { tokenize } from './keywords.mjs';

/** 一次最多回几条。多了不如让他自己说。 */
export const MAX_QUOTES = 6;
/** 回话总字数上限。 */
export const MAX_QUOTE_CHARS = 1600;
/** 命中判据：查询的二元组里至少这么多比例要在原话里出现。 */
export const MIN_RATIO = 0.34;

function readMaybe(file) {
  try {
    return parseNotes(readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

/**
 * 把所有原话读成一份。旧的在前（跟时间同向，方便算"最早哪天"）。
 *
 * 去重按「时刻 + 原话」：旧档和活跃文件理论上不重叠，但溢出那一刻
 * 可能两边都有同一行，算两次会让"这是第 2 次说"跟着错。
 *
 * @param {{file?: string, archiveFile?: string}} paths
 * @returns {Array<{said:string, did:string, at:number, date:string, time:string, pinned:boolean, source:'active'|'archive'}>}
 */
export function readQuotes({ file, archiveFile } = {}) {
  const active = file ? readMaybe(file).map((n) => ({ ...n, source: 'active' })) : [];
  const archived = archiveFile ? readMaybe(archiveFile).map((n) => ({ ...n, source: 'archive' })) : [];

  const seen = new Set();
  const out = [];
  for (const note of [...active, ...archived]) {
    const said = String(note.said ?? '').trim();
    if (said === '') continue;
    const key = `${note.at}\0${said}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      said,
      did: String(note.did ?? '').trim(),
      at: note.at,
      date: note.date,
      time: note.time,
      pinned: Boolean(note.pinned),
      source: note.source,
    });
  }
  // 新的在后 —— 调用方要用 `.slice(-n)` 取最近几条时顺序才是对的。
  out.sort((a, b) => a.at - b.at);
  return out;
}

/** 最早那一天（他的钟点），给"库有多大"用。 */
function firstDay(quotes) {
  const days = quotes.map((n) => String(n.date ?? '')).filter(Boolean).sort();
  return days[0] ?? '';
}

/**
 * 在一堆原话里找。
 *
 * 为什么是二元组重合度而不是语义：原话是用来**核对字面**的
 * （"他到底怎么说的"），不是用来回忆意思的。意思那一层归 `fish_recall`。
 * 所以这里认死理：字不对就是没有 —— 宁可让人再说一遍，也别用一条
 * 沾边的原话去替他"回忆"。
 *
 * @param {Array} quotes
 * @param {string} query
 * @param {{limit?:number, since?:string, until?:string}} [opts]
 * @returns {{hits:Array, scanned:number, total:number}}
 */
export function searchQuotes(quotes, query, opts = {}) {
  const list = Array.isArray(quotes) ? quotes : [];
  const limit = Math.max(1, Math.min(MAX_QUOTES, Math.floor(Number(opts.limit) || MAX_QUOTES)));
  const q = String(query ?? '').trim();
  const since = String(opts.since ?? '').trim().slice(0, 10);
  const until = String(opts.until ?? '').trim().slice(0, 10);

  const pool = list.filter((n) => {
    if (!since && !until) return true;
    const day = String(n.date ?? '').slice(0, 10);
    if (!day) return false;
    if (since && day < since) return false;
    if (until && day > until) return false;
    return true;
  });

  const first = firstDay(list);
  if (q === '') return { hits: [], scanned: pool.length, total: list.length, first };

  const tokens = [...new Set(tokenize(q))];
  const literal = q.toLowerCase();
  const hits = [];
  for (const note of pool) {
    const said = note.said;
    const lower = said.toLowerCase();
    const exact = lower.includes(literal);
    // 单字查询出不了二元组（tokenize 只切双字），只能靠子串 ——
    // 跟 fish_recall 里那条兜底同一个理由。
    const ratio = tokens.length === 0
      ? (exact ? 1 : 0)
      : tokens.filter((t) => said.includes(t)).length / tokens.length;
    if (!exact && ratio < MIN_RATIO) continue;
    hits.push({ ...note, exact, ratio: Number(ratio.toFixed(2)) });
  }

  // 精确包含 > 重合度高 > 更新。三档都只是排序，不改变"命中了"这个判断。
  hits.sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1;
    if (b.ratio !== a.ratio) return b.ratio - a.ratio;
    return b.at - a.at;
  });

  return { hits: hits.slice(0, limit), scanned: pool.length, total: list.length, first };
}

/**
 * 把结果写成一段话。
 *
 * **"没有"必须说成"没有"。** 这不是语气问题：原话库是一次确定的遍历，
 * 跟"我想不起来"不是同一种状态。混着说，等于把仅剩的那点确定性也泡软了。
 *
 * @param {{hits:Array, scanned:number, total:number}} result
 * @param {{query?:string, at?:number}} [opts]
 */
export function renderQuotes(result, opts = {}) {
  const { hits = [], scanned = 0, total = 0, first = '' } = result ?? {};
  const at = Number.isFinite(opts.at) ? opts.at : Date.now();
  const query = String(opts.query ?? '').trim();

  if (total === 0) return '原话库里还一条都没有 —— 小纸条是后来才开始记的，之前的话没存下。';

  if (hits.length === 0) {
    // 「没有」必须说成「没有」，但**边界要一起说出来** —— 否则那点确定性
    // 就成了新的谎：查不到 ≠ 他没说过。这个库其实有四个洞：
    //   ① 纯应答（"继续""好""嗯"）不存；
    //   ② 紧挨着的同一句（往前 8 条内）不重复存；
    //   ③ 这一轮的话要等这一轮结束才落笔，此刻查不到；
    //   ④ 库开张之前的话根本没记。
    const since = first ? `早于 ${first} 的话当初没记。` : '';
    return `没有。${scanned} 条原话里没有跟「${query}」对得上的 —— 不是"我记不太清"，是档案里没有这几个字。`
      + '（但查不到不等于他没说过：纯应答"继续""好"这种不存；紧挨着的同一句不重复存；'
      + `这一轮的话要等这一轮结束才落笔。${since}）`;
  }

  const lines = [
    `他的原话里找到 ${hits.length} 条（库里一共 ${total} 条有内容的原话${first ? `，最早到 ${first}` : ''}）：`,
  ];
  let used = lines[0].length;
  let count = 0;
  for (const hit of hits) {
    const when = whenLabel(hit, at) || hit.date || '';
    const head = `- ${when ? `${when} · ` : ''}`;
    const said = hit.said.length > 200 ? `${hit.said.slice(0, 200)}…` : hit.said;
    const did = hit.did ? `（我：${hit.did}）` : '';
    const piece = `${head}「${said}」${did}`;
    if (used + piece.length + 1 > MAX_QUOTE_CHARS && count > 0) break;
    lines.push(piece);
    used += piece.length + 1;
    count += 1;
  }
  return lines.join('\n');
}
