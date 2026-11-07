/**
 * 「那年今天」—— 从日记里捞回同一个日子、以及一个月前的这几天。
 *
 * ─────────────────────────────────────────────────────────────
 * **为什么单独一个文件**
 *
 * 「最近的事」回答的是「我们上次在干什么」，它是连续的、按时间排的。
 * 但人脑子里还有另一种记忆：**同一个日子**。去年的今天在干嘛，
 * 一个月前的这几天是不是也在为同一件事发愁。
 *
 * 档案里一直躺着这些日期，可是没有任何一处会主动拿出来 ——
 * 只有我自己想起来去翻。翻不到就等于没有。
 *
 * **两层**（2026-11-07 定）：
 *   1. 同月同日（往年）：`11-07` 对 `2025-11-07`，叫「一年前的这天」。
 *      逐月是不会重上的 —— 上个月的今天是 `10-07`，月日并不相同。
 *   2. 退一档：「一个月前的这几天」（28–35 天前）。这一层才让它在
 *      只认识两个月的时候就有东西可捞；两边的日子差不多，说的往往
 *      也是同一类事。
 *
 * **做成纯函数**：只吃条目、只吐结构，不碰磁盘、不碰时钟（`now` 从外面传）。
 * 这样能单独测，也不会因为读不到文件挡住记忆。
 *
 * **时区**：跟 timeline.mjs 一个尺子 —— 他的 00:00 是 UTC+8 的 00:00。
 * 条目里本来就有 `date`（写入时按他的钟点切的），所以直接比字符串，
 * 绝不再算一遍「今天」。这个坑我踩过四次。
 * ─────────────────────────────────────────────────────────────
 */

/** 正文截断长度：注入里一行，再长就变成复述。 */
const TEXT_MAX = 110;

/** 「一个月前」的窗口（天）。28 天起算，35 天封顶。 */
const LAST_MONTH_MIN = 28;
const LAST_MONTH_MAX = 35;

const DAY_MS = 24 * 60 * 60 * 1000;

/** 他那边某一天的 `YYYY-MM-DD`。 */
export function localDate(ts) {
  return new Date(ts + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 两个 `YYYY-MM-DD` 相差几个自然日（later − earlier）。 */
function daysBetween(earlier, later) {
  return Math.round((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / DAY_MS);
}

/** 把正文压成一行：取第一段、去掉列表符号、裁到 TEXT_MAX。 */
function oneLine(text) {
  const first = String(text ?? '')
    .split(/\n\s*\n/)[0]
    .split('\n')
    .map((line) => line.trim().replace(/^[-*+]\s+/, ''))
    .filter((line) => line !== '')
    .join(' ');
  const chars = [...first];
  return chars.length > TEXT_MAX ? `${chars.slice(0, TEXT_MAX).join('')}…` : first;
}

/** 「一年前的这天」「三年前的这天」；不到一年就退回天数。 */
export function whenLabel(earlierDate, today) {
  const days = daysBetween(earlierDate, today);
  const [ey, em, ed] = earlierDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  let months = (ty - ey) * 12 + (tm - em);
  if (td < ed) months -= 1;
  if (months >= 12) return `${Math.floor(months / 12)} 年前的这天`;
  if (months >= 1) return `${months} 个月前的这天`;
  return days > 0 ? `${days} 天前的这天` : '那天';
}

/** 收条目：判断那一栏已下线，不从别处绕回来；压成一行；按日期去重。 */
function collect(entries, today) {
  const seen = new Set();
  const out = [];
  if (!Array.isArray(entries)) return out;
  for (const entry of entries) {
    if (entry === null || typeof entry !== 'object') continue;
    if (entry.kind === 'note') continue;
    const date = typeof entry.date === 'string' ? entry.date.slice(0, 10) : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (date >= today) continue;
    const text = oneLine(entry.text);
    if (text === '') continue;
    const key = `${date}|${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ date, text, days: daysBetween(date, today) });
  }
  return out;
}

/**
 * 挑锚点：同月同日 + 一个月前这几天。
 *
 * @param {Array<{date?: string, text?: string, kind?: string}>} entries
 * @param {{ now?: number, today?: string, max?: number, maxPerBucket?: number }} [options]
 * @returns {{onThisDay: Array<{date: string, text: string, label: string}>, lastMonth: Array<{date: string, text: string, label: string}>}}
 */
export function pickAnchors(entries, options = {}) {
  const today = options.today ?? localDate(options.now ?? Date.now());
  const maxPerBucket = Number.isFinite(options.maxPerBucket) ? options.maxPerBucket : 1;
  const md = today.slice(5);
  const all = collect(entries, today);

  const onThisDay = all
    .filter((item) => item.date.slice(5) === md && item.days >= 300)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, Math.max(0, maxPerBucket))
    .map((item) => ({ date: item.date, text: item.text, label: whenLabel(item.date, today) }));

  const lastMonth = all
    .filter((item) => item.days >= LAST_MONTH_MIN && item.days <= LAST_MONTH_MAX)
    .sort((a, b) => a.days - b.days)
    .slice(0, Math.max(0, maxPerBucket))
    // 两条挨着的时候光写「一个月前的这几天」会一模一样，看不懂是哪天 ——
    // 带上月日，读起来才像"那天我在干嘛"。
    .map((item) => ({ date: item.date, text: item.text, label: `一个月前的这天（${item.date.slice(5)}）` }));

  return { onThisDay, lastMonth };
}

/**
 * 渲染成注入里的一小段；没有就返回空串（不占位置）。
 *
 * 措辞故意留白：**不替下一棒的我下结论**，只把那天的话放回去。
 * ——「那时候的我是这么想的」比「这件事说明……」有用得多。
 *
 * 同一段里最多 2 行：这一栏是「顺手想起」，不该跟「最近的事」抢地方。
 */
export function renderAnchors(anchors, options = {}) {
  const onThisDay = Array.isArray(anchors?.onThisDay) ? anchors.onThisDay : [];
  const lastMonth = Array.isArray(anchors?.lastMonth) ? anchors.lastMonth : [];
  const max = Number.isFinite(options.max) ? options.max : 2;
  const lines = [...onThisDay, ...(onThisDay.length > 0 ? [] : lastMonth)]
    .slice(0, Math.max(0, max))
    .map((item) => `- ${item.label}：${item.text}`);
  if (lines.length === 0) return '';
  return ['## 那年今天', ...lines].join('\n');
}
