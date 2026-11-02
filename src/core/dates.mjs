// 快到的日子：生日、纪念日这类按「月-日」重复的日子。
//
// 为什么要单独一个文件：core.md 里写着「我没有定时能力」，但日子是能算的。
// 每次注入加一行「今天/还有 N 天」，一天最多变一次，不会每轮打碎前缀缓存。
//
// 时区：他那边是 UTC+8，本机进程是 UTC。**所有「今天」都按 +8 算**，
// 否则凌晨那几个小时会差一天 —— 这个坑我踩过四次，不能再踩。

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const DATES_FILE = 'dates.json';
const DAY_MS = 24 * 60 * 60 * 1000;
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;

export function datesPath(dataDir) {
  return join(dataDir, DATES_FILE);
}

/** 读 dates.json；坏了就当没有，不能挡住记忆。 */
export function loadDates(file) {
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    const list = Array.isArray(raw) ? raw : raw?.entries;
    if (!Array.isArray(list)) return [];
    return list.filter((e) => e && typeof e.name === 'string' && Number.isInteger(e.month) && Number.isInteger(e.day));
  } catch {
    return [];
  }
}

/** 他那边今天的「日序号」（自 1970-01-01 起的天数）。 */
export function localDayNumber(now = new Date()) {
  return Math.floor((now.getTime() + TZ_OFFSET_MS) / DAY_MS);
}

/** 距离下一个「月-日」还有几天；今天就是 0。 */
export function daysUntil(entry, now = new Date()) {
  const today = localDayNumber(now);
  const shifted = new Date(now.getTime() + TZ_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const at = (y) => Math.floor(Date.UTC(y, entry.month - 1, entry.day) / DAY_MS);
  let target = at(year);
  if (target < today) target = at(year + 1);
  return target - today;
}

/** 挑出 withinDays 天内的日子，按远近排序。 */
export function upcoming(entries, { now = new Date(), withinDays = 7 } = {}) {
  return entries
    .map((entry) => ({ ...entry, days: daysUntil(entry, now) }))
    .filter((entry) => entry.days >= 0 && entry.days <= withinDays)
    .sort((a, b) => a.days - b.days);
}

const pad = (n) => String(n).padStart(2, '0');

/** 渲染成一行一行的提醒；没有就不返回（空串，不占位）。 */
export function renderDates(items) {
  if (!items.length) return '';
  const lines = items.map((item) => {
    const when = item.days === 0 ? '就是今天' : item.days === 1 ? '明天' : `还有 ${item.days} 天`;
    return `- ${item.emoji ? item.emoji + ' ' : ''}${item.name}：${when}（${pad(item.month)}-${pad(item.day)}）`;
  });
  return ['## 快到的日子', ...lines, '- 别忘了当面说一声——我不能自己开口。'].join('\n');
}
