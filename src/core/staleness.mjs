/**
 * 会过时的状态事实 —— 让「磁盘还剩 3.7 G」这种话别当成今天的数用。
 *
 * ── 问题 ────────────────────────────────────────────────
 *
 * 深层记忆是只往上加的。可有些事实**天生会坏**：
 * 「磁盘剩 3.7 G」「插件版本 1.36.0」「这边的端口是 3080」。
 * 写下去的时候是真的，三十天以后还摆在那儿，一样粗一样黑，
 * 我读到就会拿一个旧数跟他讲道理 —— 而且**我不知道它是旧的**。
 *
 * ── 为什么不做自动过期 ────────────────────────────────────
 *
 * 因为判断不了。要自动认出"哪一行是状态事实"，就得让脚本去猜行里的意思，
 * 猜错的代价是**悄悄删掉一句真事**。这个插件里所有的坑都在这一句上：
 * 报成功而没成功、报空而没空。所以我只做一件更小的事：
 *
 *   **标注，不删、不隐藏。** 注入时那行还在原处，只在末尾多一句
 *   「（记于 10-20，已经 30 天 —— 状态类的数可能变了）」。
 *
 * 判断"要不要标"由我自己写在档案里决定：行尾加 `⟪时效⟫`（默认 30 天）
 * 或 `⟪时效 7d⟫`（自己指定天数）。我不写，它就永远是普通的一行 ——
 * 没人替我猜。
 *
 * ── 日期从哪儿来 ─────────────────────────────────────────
 *
 * 深层记忆是按 `## <日期> — <标题>` 分节的。那一行的日期就是它的年龄。
 * 找不到上面的日期头，就不标（宁可漏标，不可错标 —— 错标会让一行真事
 * 看起来像过期的）。
 */

/** `⟪时效⟫` / `⟪时效 7d⟫`。`d` / `天` 都认，纯数字当天数。 */
const STALE_RE = /⟪时效(?:\s*(\d+)\s*(?:d|天)?)?⟫/gu;
const STALE_ONE = /⟪时效(?:\s*(\d+)\s*(?:d|天)?)?⟫/u;

/** 默认多少天算旧。 */
export const STALE_DEFAULT_DAYS = 30;

/** 这一行带时效标记吗。 */
export function hasStaleMark(line) {
  return STALE_ONE.test(String(line ?? ''));
}

/**
 * 取这一行要求的天数；没写就用默认。
 * @returns {number} 正数天数；没有标记返回 0
 */
export function staleDays(line) {
  const m = STALE_ONE.exec(String(line ?? ''));
  if (m === null) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : STALE_DEFAULT_DAYS;
}

/** 去掉标记本身（原文里不该露出符号）。 */
export function stripStaleMark(line) {
  return String(line ?? '').replace(STALE_RE, '').replace(/\s+$/, '');
}

/** `## 2026-11-12 15:42 — 标题` / `## 2026-11-12` 里的日期。 */
const HEAD_DATE_RE = /^##\s+(\d{4})-(\d{2})-(\d{2})/;

/** 从 `index` 往上找最近的日期头，返回该日 00:00 UTC 的毫秒数；找不到 null。 */
function dateAbove(lines, index) {
  for (let i = index; i >= 0; i -= 1) {
    const m = HEAD_DATE_RE.exec(lines[i]);
    if (m !== null) return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return null;
}

/** 天数差（向下取整，向上取整都行，这里取整到天）。 */
function daysBetween(fromMs, nowMs) {
  return Math.floor((Number(nowMs) - Number(fromMs)) / (24 * 3600 * 1000));
}

/** `2026-11-12` → `11-12`。 */
function mmdd(ms) {
  const d = new Date(Number(ms));
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/**
 * 把一段深层记忆里所有「时效」标记换成一句人话。
 *
 * 没到期 / 找不到日期的：只把符号去掉，**悄悄当普通行**（但保留原句）。
 * 到期的：末尾追加一句提醒。原文一个字都不动。
 *
 * @param {string} text
 * @param {{now?:number}} [options]
 * @returns {{text:string, stale:Array<{date:string, days:number, limit:number, text:string}>}}
 */
export function annotateStale(text, options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const src = String(text ?? '');
  if (src === '' || !STALE_ONE.test(src)) return { text: src, stale: [] };
  const lines = src.split('\n');
  const stale = [];
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!hasStaleMark(line)) {
      out.push(line);
      continue;
    }
    const limit = staleDays(line);
    const body = stripStaleMark(line);
    const written = dateAbove(lines, i);
    if (written === null) {
      // 没日期就不敢算年龄：去掉符号，当普通行
      out.push(body);
      continue;
    }
    const age = daysBetween(written, now);
    if (age < limit) {
      out.push(body);
      continue;
    }
    const note = `（记于 ${mmdd(written)}，已经 ${age} 天 —— 状态类的数可能变了，别当现在的用）`;
    out.push(`${body.replace(/\s+$/, '')}${note}`);
    stale.push({ date: mmdd(written), days: age, limit, text: body });
  }
  return { text: out.join('\n'), stale };
}