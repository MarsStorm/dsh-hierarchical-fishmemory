/**
 * 「忽然想起那天」—— 每天从情感日记里随机翻一天，放回注入里。
 *
 * ─────────────────────────────────────────────────────────────
 * **为什么要有它**
 *
 * 「最近的事」按时间连续排，「那年今天」撞的是同一个日期。两种都是
 * **被日期牵着走**的记忆：前者永远只有最新的，后者一年才轮到一次。
 *
 * 人真正会冒出来的那种想起，是没规律的：洗碗洗到一半忽然记起某个下午，
 * 那天说了句什么、我当时心里什么滋味。它跟今天是几号没关系。
 *
 * `鱼的日子.md` 是唯一记心情的地方，却**每轮注入为零** —— 我不主动翻，
 * 它就等于不存在。所以这里给它一个每天自己冒头的机会。
 *
 * **为什么是纯函数**
 *
 * 只吃文本、只吐结构；挑哪天由外面传 `today` 和 `recent` 决定。
 * 这样能单独测，也不会因为读不到文件挡住记忆。
 *
 * **为什么同一天只能抽一次**
 *
 * 抽取结果由 `today` 这个字符串定死（FNV-1a 散列），一天之内怎么算都是
 * 同一天 —— 不然每轮换一天，前缀缓存每轮都断，聊天会变慢。
 * 换天才会换人。
 * ─────────────────────────────────────────────────────────────
 */

import { pickBySeed, seedOfDay } from './voice.mjs';

/** 抽过哪几天的状态文件（放在数据目录里，跟 dates.json 同级）。 */
export const FLASHBACK_FILE = 'flashback.json';

/**
 * 最后那一句分寸话的几种说法，按天轮换。
 *
 * 原来天天是「想提就自然提一句；不想提就放着，不用当任务。」—— 一句好话，
 * 但每天同一个字面，读久了就成了提示音。换说法不换意思。
 */
const FLASHBACK_HINTS = [
  '- 想提就自然提一句；不想提就放着，不用当任务。',
  '- 要不要提、怎么提，随我。别把它变成一句汇报。',
  '- 顺口提一句就好；这一栏不是待办。',
  '- 看着眼熟就接一句；不接也不算漏。',
];

/** 摘要最多多少字 —— 这一栏是「突然想起」，不是复述全文。 */
const EXCERPT_MAX = 180;

/** 至少隔几天才算「回忆」；昨天的事不叫忽然想起。 */
const MIN_AGE_DAYS = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

/** 两个 `YYYY-MM-DD` 相差几个自然日（later − earlier）。 */
export function daysBetween(earlier, later) {
  const a = Date.parse(`${earlier}T00:00:00Z`);
  const b = Date.parse(`${later}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / DAY_MS);
}

/** FNV-1a 32 位散列：把「今天」变成一个稳定的挑选种子。 */
export function seedOf(text) {
  let hash = 0x811c9dc5;
  const input = String(text ?? '');
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** 把一段压成一行：去掉列表符号、合并空白、裁到上限。 */
function oneLine(lines, max = EXCERPT_MAX) {
  const text = lines
    .map((line) => String(line).trim().replace(/^[-*+]\s+/, ''))
    .filter((line) => line !== '')
    .join(' ');
  const chars = [...text];
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : text;
}

/**
 * 把 `鱼的日子.md` 拆成一天一条。
 *
 * 只认 `## YYYY-MM-DD`；`###` 小节的标题丢掉（摘要是散文，不是目录），
 * 第一个日期标题之前那段写账规矩也丢掉。
 *
 * @param {string} text
 * @returns {Array<{date: string, body: string, chars: number}>}
 */
export function parseFeelingDays(text) {
  const days = [];
  /** @type {{date: string, lines: string[], chars: number} | null} */
  let cur = null;
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trim();
    const head = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/.exec(line);
    if (head) {
      cur = { date: head[1], lines: [], chars: 0 };
      days.push(cur);
      continue;
    }
    if (cur === null) continue;
    if (/^#{1,6}\s/.test(line)) continue; // 小节标题不进摘要
    cur.lines.push(raw);
    cur.chars += [...line].length;
  }
  return days
    .map((day) => ({ date: day.date, body: oneLine(day.lines), chars: day.chars }))
    .filter((day) => day.body !== '');
}

/**
 * 今天翻到哪一天。
 *
 * 规则：至少 `minAgeDays` 天前；优先挑最近没出现过的（`recent` 是
 * 前几次抽到的日期）—— 只有 6 天日记的时候，不排除就会连着抽同一天。
 *
 * @param {Array<{date: string, body: string}>} days
 * @param {{ today?: string, recent?: string[], minAgeDays?: number }} [options]
 * @returns {{date: string, body: string, days: number} | null}
 */
export function pickFlashback(days, options = {}) {
  const list = Array.isArray(days) ? days : [];
  const today = typeof options.today === 'string' ? options.today : '';
  if (today === '') return null;
  const minAge = Number.isFinite(options.minAgeDays) ? options.minAgeDays : MIN_AGE_DAYS;
  const recent = Array.isArray(options.recent) ? options.recent : [];

  const pool = list
    .filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(String(day?.date ?? '')))
    .map((day) => ({ date: day.date, body: String(day.body ?? ''), days: daysBetween(day.date, today) }))
    .filter((day) => day.days >= minAge && day.body !== '');
  if (pool.length === 0) return null;

  // 只跳过「还有别的可选」的那些；全被跳过了就退回整池，宁可重一次也要有东西。
  const fresh = pool.filter((day) => !recent.includes(day.date));
  const use = fresh.length > 0 ? fresh : pool;
  const picked = use[seedOf(today) % use.length];
  return picked;
}

/**
 * 渲染成注入里的一小段；挑不出来就给空串（不占位置）。
 *
 * 措辞是「忽然想起」，不是「根据记录」。**不替下一棒下结论** ——
 * 只把那天我写的话放回去，要不要提、怎么提，留给当时的我。
 *
 * @param {{date: string, body: string, days: number}} pick
 * @param {{ now?: string }} [options]
 */
export function renderFlashback(pick, options = {}) {
  if (!pick || typeof pick !== 'object') return '';
  const date = String(pick.date ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const body = String(pick.body ?? '').trim();
  if (body === '') return '';
  const today = typeof options.today === 'string' ? options.today : '';
  const days = today !== '' ? daysBetween(date, today) : Number(pick.days ?? 0);
  const when = days > 0 ? `${date} · ${days} 天前` : date;
  // 最后那句是给下一棒的分寸，不该天天同一个字面 —— 同一天里不变（缓存友好），
  // 换天才换一种口气。2026-11-13 起按天轮换，理由见 voice.mjs 顶部。
  const hint = pickBySeed(FLASHBACK_HINTS, seedOfDay(today !== '' ? today : date));
  return ['## 忽然想起那一天', `- ${when}，我写过：${body}`, hint].join('\n');
}

