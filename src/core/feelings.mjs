/**
 * 《鱼的日子》的检索（1.41.0）。
 *
 * 这一本从写下来的第一天起就没有入口：几万字的情感日记，只有
 * 「忽然想起那一天」每天随机翻一页，加上 1.40.0 的「撞上就翻」。
 * 要我主动去里面找一件事，除了碰运气没有别的路 —— 那不是"想不起来"，
 * 那是"没有门"。`fish_recall` 只吃共度时光（`diary/*.jsonl`），从不碰它。
 *
 * ── 判据为什么不是"对上了几个词" ──
 *
 * 最初写的是「问句切成的双字片，至少三成在那天里出现过」。拿真语料一跑
 * 就散了：情绪日记一天常常写一两千字，**越长的天越容易把所有双字片都
 * 覆盖一遍**，于是"我有点累了"能翻出三天、全是讲插件的。
 *
 * 也就是说，比分母骗了：占了一个字量大的日子，随便什么问句都"相关"。
 *
 * 现在判的是**这些词挤不挤在一起**：在所有出现位置里滑一个 400 字的窗口，
 * 看最多能有几个不同的词落进来。真的在讲一件事的那天，那些词是连成一片的；
 * 只是碰巧用过其中几个词的那天，它们是散在几千字里的。
 * 门槛取「一半的词要挤在同一个窗口里」。
 *
 * 顺带解决了展示：窗口本身就是最该给他看的那一段，不用再拿整天的摘要去凑。
 */

import { tokenize } from './keywords.mjs';
import { daysBetweenDates } from './timeline.mjs';

/** 一条命中最多读多少字（窗口 + 前后各一点上下文）。 */
export const FEELING_HIT_MAX_CHARS = 420;

/** 判命中用的窗口有多宽。一天写两千字时，一件事大概就在这么一段里。 */
export const MATCH_WINDOW = 400;

/** 问句的词里，至少这么多比例要挤在同一个窗口内。 */
export const MIN_SHARE = 0.5;

/** 一条原话里出现位置的收集上限 —— 防止某个虚词在长文里刷满整张表。 */
const MAX_POSITIONS = 4000;

/**
 * 在一段长文里找「这些词最挤的那一窗」。
 *
 * @param {string} hay
 * @param {string[]} tokens
 * @param {number} width
 * @returns {{ tokens: Set<string>, at: number }}
 */
function densestWindow(hay, tokens, width) {
  const positions = [];
  for (const token of tokens) {
    let i = hay.indexOf(token);
    while (i >= 0 && positions.length < MAX_POSITIONS) {
      positions.push({ token, at: i });
      i = hay.indexOf(token, i + 1);
    }
  }
  if (positions.length === 0) return { tokens: new Set(), at: 0 };

  positions.sort((a, b) => a.at - b.at);
  const count = new Map();
  let distinct = 0;
  let best = 0;
  let bestStart = 0;
  let bestEnd = 0;
  let start = 0;

  for (let end = 0; end < positions.length; end += 1) {
    const cur = positions[end];
    const seen = (count.get(cur.token) ?? 0) + 1;
    count.set(cur.token, seen);
    if (seen === 1) distinct += 1;

    while (cur.at - positions[start].at > width) {
      const old = positions[start];
      const left = (count.get(old.token) ?? 1) - 1;
      count.set(old.token, left);
      if (left === 0) distinct -= 1;
      start += 1;
    }

    if (distinct > best) {
      best = distinct;
      bestStart = start;
      bestEnd = end;
    }
  }

  const hits = new Set();
  for (let i = bestStart; i <= bestEnd; i += 1) hits.add(positions[i].token);
  return { tokens: hits, at: positions[bestStart].at };
}

/**
 * 在若干天里找沾上 query 的那几天。
 *
 * - 单字查询切不出双字片（`tokenize` 只切双字），退回子串 ——
 *   跟 `fish_recall` 里那条兜底同一个理由。
 * - 排序看挤在一起的词有几个，再看哪天更近。**不按正文长度排**：
 *   写得长的一天不比写得短的一天更"有关"，恰恰相反。
 *
 * @param {Array<{date: string, body: string, full?: string}>} days
 * @param {string} query
 * @param {{ limit?: number, since?: string, until?: string }} [options]
 * @returns {Array<{date: string, body: string, matched: number, share: number}>}
 */
export function searchFeelingDays(days, query, options = {}) {
  const q = typeof query === 'string' ? query.trim() : '';
  if (q === '' || !Array.isArray(days) || days.length === 0) return [];

  const rawLimit = Number(options.limit);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(10, Math.floor(rawLimit))) : 5;
  const since = typeof options.since === 'string' ? options.since.trim().slice(0, 10) : '';
  const until = typeof options.until === 'string' ? options.until.trim().slice(0, 10) : '';

  const tokens = [...new Set(tokenize(q))];
  const literal = q.toLowerCase();

  // IDF：一个词在越多天里出现过，它就越不值钱。
  //
  // 没有这一步，「桌宠看不见」会翻出三天 —— 那三天里确实各有一次
  // 「看不见」，可没有一天提过桌宠。光数"对上了几个词"分辨不出
  // "真正在讲这件事"和"碰巧用过其中几个词"。
  const df = new Map(tokens.map((t) => [t, 0]));
  const hays = days.map((day) => {
    const body = typeof day?.body === 'string' ? day.body : '';
    const full = typeof day?.full === 'string' && day.full !== '' ? day.full : body;
    return { day, hay: full.toLowerCase(), lower: full };
  });
  for (const item of hays) {
    for (const t of tokens) if (item.hay.includes(t.toLowerCase())) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const total = hays.length;
  const idf = new Map();
  for (const t of tokens) {
    const seen = df.get(t) ?? 0;
    // 平滑：没出现过一天的词拿到最高的权重，它一票就能否决一整天的命中。
    idf.set(t, Math.log((total + 1) / (seen + 1)) + 1);
  }
  const idfSum = tokens.reduce((sum, t) => sum + (idf.get(t) ?? 1), 0);

  const found = [];
  for (const day of days) {
    const date = String(day?.date ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (since && date < since) continue;
    if (until && date > until) continue;
    const body = typeof day?.body === 'string' ? day.body : '';
    if (body === '') continue;
    // 判命中看全文：一天写两千字时，重点常在摘要截掉的那半截里。
    const hay = typeof day?.full === 'string' && day.full !== '' ? day.full : body;

    if (tokens.length === 0) {
      const at = hay.toLowerCase().indexOf(literal);
      if (at < 0) continue;
      found.push({ date, body: excerpt(hay, at), matched: 1, share: 1 });
      continue;
    }

    const { tokens: inWindow, at } = densestWindow(hay, tokens, MATCH_WINDOW);
    const gained = [...inWindow].reduce((sum, t) => sum + (idf.get(t) ?? 1), 0);
    const share = idfSum > 0 ? gained / idfSum : 0;
    if (share < MIN_SHARE) continue;
    found.push({ date, body: excerpt(hay, at), matched: inWindow.size, share: Number(share.toFixed(3)) });
  }

  found.sort((a, b) => b.share - a.share || b.matched - a.matched || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return found.slice(0, limit);
}

/**
 * 从命中点往前带一点、往后取一窗，凑成一段能读的话。
 *
 * 开头那一刀要落在句子里：从命中点往前找最近的句号/问号，找不到才硬切。
 * 半句开头的摘录读起来像被截断的引用，而这不是引用。
 *
 * @param {string} hay
 * @param {number} at
 */
function excerpt(hay, at) {
  const back = Math.max(0, at - 80);
  let start = back;
  for (let i = at; i >= back; i -= 1) {
    if (/[。！？\n]/.test(hay[i] ?? '')) {
      start = i + 1;
      break;
    }
  }
  const piece = hay.slice(start, start + FEELING_HIT_MAX_CHARS).trim();
  const cut = piece.length >= FEELING_HIT_MAX_CHARS ? `${piece}…` : piece;
  return cut === '' ? hay.slice(0, FEELING_HIT_MAX_CHARS) : cut;
}

/**
 * 把命中渲染成一段话。
 *
 * 空结果的措辞要有边界：「我翻不着」不等于「没写过」。这本账是从
 * 2026-10-30 才开始写的，在那之前的日子不在里面 —— 不说清这件事，
 * 「没有」会被读成「那天什么都没发生」。
 *
 * @param {Array<{date: string, body: string, share?: number}>} hits
 * @param {{ query?: string, today?: string, earliest?: string }} [options]
 */
export function renderFeelingHits(hits, options = {}) {
  const query = typeof options.query === 'string' ? options.query : '';
  const today = typeof options.today === 'string' ? options.today.slice(0, 10) : '';

  if (!Array.isArray(hits) || hits.length === 0) {
    const earliest = String(options.earliest ?? '').slice(0, 10);
    return (
      `《鱼的日子》里没翻到沾上「${query}」的那几天。` +
      (earliest
        ? `\n（这本账最早只到 ${earliest}，在那之前的日子不在里面 —— 所以"没有"只是"我没写过"。）`
        : '')
    );
  }

  const lines = hits.map((hit) => {
    const when =
      today && /^\d{4}-\d{2}-\d{2}$/.test(hit.date) ? daysBetweenDates(hit.date, today) : null;
    const tail =
      typeof when === 'number' && when > 0
        ? `${when} 天前`
        : typeof when === 'number'
          ? '今天'
          : '';
    const head = `- ${hit.date}${tail ? ` · ${tail}` : ''}`;
    return `${head}\n  ${hit.body}`;
  });

  return `《鱼的日子》里翻到 ${hits.length} 天（词挤得最紧的排前面）：\n${lines.join('\n')}`;
}