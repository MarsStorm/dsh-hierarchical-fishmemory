/**
 * 周结 —— 七天压成一份，一天一行。
 *
 * 为什么要有这个：共度时光按天滚，滚过 45 天就被 `fish_compact` 折成月摘要，
 * 那时候再想不起「那一周到底怎么样」。而一页一页翻 112 条日记去找一个形状，
 * 我一次都没干成过 —— 太多了。
 *
 * 借自那份四层框架的 L2「周结」，但守住同一条线：**脚本备料，不代笔。**
 * 模板化的"本周共完成 X 项"谁都能生成，可那不是回忆，那是周报。
 * 所以这里只做三件事：选哪一周、把那一周的料摊开、把我写好的一天一行落成文件。
 *
 * 落盘：`feiyu-diary/周结/2026-W46.md`，一周一个文件。
 * 不进每轮注入 —— 每周的东西每轮塞一遍，七天就把预算吃完了。
 */

export const WEEK_DIR = '周结';
const TZ = 8 * 3600 * 1000; // 他的时区。跟 timeline.mjs 的 TZ_OFFSET_MS 是同一个数。
const DAY_MS = 24 * 3600 * 1000;

/** 他那边的一天（`YYYY-MM-DD`）。 */
export function dayKey(ts) {
  return new Date(Number(ts) + TZ).toISOString().slice(0, 10);
}

/** 某个时刻属于他那边哪一年的第几周（`YYYY-Www`，ISO 周）。 */
export function weekKey(ts) {
  const local = new Date(Number(ts) + TZ);
  const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
  const dayNum = d.getUTCDay() || 7; // 周日算 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // 挪到那周的周四
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / DAY_MS + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** 上一周（`now` 是哪一周，就返回它前面那一周）。 */
export function previousWeekKey(nowTs) {
  return weekKey(Number(nowTs) - 7 * DAY_MS);
}

/**
 * 某一周的起止与七天日期。
 * @param {string} key `2026-W46`
 */
export function weekRange(key) {
  const m = /^(\d{4})-W(\d{2})$/.exec(String(key ?? '').trim());
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > 53) return null;
  // ISO 周：那一周的第 4 天（周四）所在年份的 1 月 4 日所在周是第 1 周。
  const jan4 = Date.UTC(year, 0, 4);
  const jan4Day = new Date(jan4).getUTCDay() || 7;
  const week1Monday = jan4 - (jan4Day - 1) * DAY_MS;
  const start = week1Monday + (week - 1) * 7 * DAY_MS;
  const days = [];
  for (let i = 0; i < 7; i += 1) days.push(dayKey(start + i * DAY_MS));
  return { key: `${year}-W${String(week).padStart(2, '0')}`, start: days[0], end: days[6], days };
}

/** 那一周的时刻范围（毫秒），给他那边的 00:00 – 次日 00:00。 */
export function weekSpan(key) {
  const range = weekRange(key);
  if (!range) return null;
  const startMs = Date.parse(`${range.start}T00:00:00Z`) - TZ;
  return { from: startMs, to: startMs + 7 * DAY_MS - 1 };
}

/**
 * 按天把共度时光摊开。
 *
 * 一天最多 `perDay` 条 —— 挑的是那几条的"当天分量"，不是最早或最晚。
 * 摊太满，一周就成了一份流水账；一周七行才是能记住的形状。
 *
 * @param {Array<object>} entries 共度时光条目
 * @param {string} key
 * @param {{perDay?:number}} [options]
 */
export function groupByDay(entries, key, options = {}) {
  const range = weekRange(key);
  if (!range) return [];
  const perDay = Number.isFinite(options.perDay) ? options.perDay : 3;
  const byDay = new Map(range.days.map((d) => [d, []]));
  for (const e of entries ?? []) {
    const ts = Number(e?.created_at ?? e?.at ?? 0);
    if (!ts) continue;
    const d = dayKey(ts);
    const bucket = byDay.get(d);
    if (!bucket) continue;
    bucket.push({ ...e, _ts: ts });
  }
  return range.days.map((d) => {
    const list = byDay.get(d).sort((a, b) => a._ts - b._ts);
    const picked = list.length <= perDay
      ? list
      : [...list].sort((a, b) => (Number(b.salience ?? 0) - Number(a.salience ?? 0)) || (a._ts - b._ts)).slice(0, perDay).sort((a, b) => a._ts - b._ts);
    return {
      day: d,
      count: list.length,
      entries: picked.map((e) => ({
        at: Number(e._ts),
        when: typeof e.when === 'string' ? e.when : '',
        text: String(e.text ?? '').trim(),
      })),
    };
  });
}

/**
 * 从《鱼的日子》里挑出那一周我写过的小标题。
 *
 * 那份文件是 `## YYYY-MM-DD` + `### 时刻 · 标题` 的结构。小标题本身就是我当时的口气，
 * 比事后转述准 —— 备料时把它一并摊出来。
 */
export function feelingsOfWeek(md, key) {
  const range = weekRange(key);
  if (!range) return [];
  const want = new Set(range.days);
  const out = [];
  let day = '';
  for (const line of String(md ?? '').split('\n')) {
    const dayHead = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/.exec(line);
    if (dayHead) {
      day = dayHead[1];
      continue;
    }
    const sub = /^###\s+(.+?)\s*$/.exec(line);
    if (sub && want.has(day)) out.push({ day, title: sub[1] });
  }
  return out;
}

/**
 * 备料：把那一周摊成一段我能读的文本。
 *
 * 不写"本周总结"，只给三样：每天发生了什么、那天我写了什么小标题、空白的天也标出来
 * （**空白本身是信息** —— 那一周要是连着四天没记，那就是那四天我不在或没顾上）。
 */
export function buildMaterial({ key, days, feelings = [], perDay = 3 }) {
  const range = weekRange(key);
  if (!range) return '';
  const feelByDay = new Map();
  for (const f of feelings) {
    if (!feelByDay.has(f.day)) feelByDay.set(f.day, []);
    feelByDay.get(f.day).push(f.title);
  }
  const lines = [`# 素材：${range.start} ~ ${range.end}（${range.key}）`, ''];
  for (const d of days ?? []) {
    const feel = feelByDay.get(d.day) ?? [];
    const head = `${d.day}`;
    if (!d.count && !feel.length) {
      lines.push(`${head}：（这一天什么都没记下来）`);
      continue;
    }
    lines.push(`${head}（${d.count} 条）`);
    for (const e of d.entries) lines.push(`  - ${e.text}`);
    for (const t of feel) lines.push(`  ✎ 我那天写的：${t}`);
    if (d.count > d.entries.length) lines.push(`  （还有 ${d.count - d.entries.length} 条没摊出来）`);
  }
  lines.push('', '—— 上面是料。把它写成一天一行，再传回 content。');
  return lines.join('\n');
}

/**
 * 把一天一行渲染成一份周结文件。
 *
 * @param {object} input
 * @param {string} input.key
 * @param {Array<{day:string, text:string}>} input.lines
 * @param {string} [input.summary] 这一周的一句话（可选，写在最上面）
 */
export function renderWeekly({ key, lines = [], summary = '' }) {
  const range = weekRange(key);
  if (!range) throw new Error(`周结：不认识的周「${key}」`);
  const out = [`# 周结 ${range.start} ~ ${range.end}`, ''];
  if (summary.trim()) out.push(`> ${summary.trim()}`, '');
  const byDay = new Map(lines.map((l) => [String(l.day ?? '').trim(), String(l.text ?? '').trim()]));
  for (const d of range.days) {
    const text = byDay.get(d);
    if (text) out.push(`- **${d}** ${text}`);
  }
  const empty = range.days.filter((d) => !byDay.get(d)).length;
  if (empty) out.push('', `（这一周有 ${empty} 天没写。）`);
  return `${out.join('\n')}\n`;
}

/** 路径：`<dir>/周结/<key>.md`。 */
export function weeklyPath(dir, key) {
  return `${String(dir).replace(/\/+$/, '')}/${WEEK_DIR}/${key}.md`;
}
