/**
 * 冷档案 —— 被 `fish_compact` 折掉的原文。
 *
 * ─────────────────────────────────────────────────────────────
 * **这个文件要解决的是一个漏洞，不是加一个功能**
 *
 * `fish_compact` 把 45 天前的条目折成月度摘要，原文**搬进**
 * `diary/archive/YYYY-MM.jsonl`。但是：
 *
 *   · 加载路径 `readArchiveDir` 只遍历 `diary/*.jsonl`，不递归子目录
 *   · `fish_recall` 只读 `archive.diary`
 *
 * 也就是说，全仓库除 compact 自己写之外**没有任何读者**。
 * 于是"压缩"实际上等于**永久删除** —— 摘要还在，但那件事的原文
 * （原话、当时的语气、具体到名字的细节）再也搜不到了。
 *
 * 压缩功能一直是这样，只是没人回去翻过那些条目。
 *
 * ─────────────────────────────────────────────────────────────
 * **这里只做解析，不碰磁盘**
 *
 * 读文件、判断 mtime 缓存都在 host 那半边（那要 `fs`）。
 * 这一半是纯函数：给一段 JSONL 文本，还一堆条目。坏行跳过 ——
 * 归档是追加写的，断电可能留半行。
 */

/** 归档子目录名（相对 `diary/`） */
export const COLD_DIR = 'archive';

/**
 * 解析归档文件内容。
 *
 * 只收**能用的**条目：有 id、有正文。空行跳过，坏行跳过并计数 ——
 * 一个坏行不该让整份归档读不出来。
 *
 * @param {string} text
 * @returns {{entries: object[], broken: number}}
 */
export function parseColdText(text) {
  const entries = [];
  let broken = 0;
  const body = String(text ?? '');
  if (body.trim() === '') return { entries, broken };
  for (const line of body.split('\n')) {
    const t = line.trim();
    if (t === '') continue;
    let entry;
    try {
      entry = JSON.parse(t);
    } catch {
      broken += 1;
      continue;
    }
    if (
      entry === null ||
      typeof entry !== 'object' ||
      Array.isArray(entry) ||
      typeof entry.id !== 'string' ||
      entry.id === '' ||
      typeof entry.text !== 'string' ||
      entry.text === ''
    ) {
      broken += 1;
      continue;
    }
    entries.push(entry);
  }
  return { entries, broken };
}

/**
 * 把多个归档文件的内容合成一份，按时间排序。
 *
 * @param {Array<{name: string, text: string}>} files
 * @returns {{entries: object[], broken: number, files: number}}
 */
export function mergeColdFiles(files) {
  const list = Array.isArray(files) ? files : [];
  const entries = [];
  let broken = 0;
  let used = 0;
  for (const f of list) {
    if (!f || typeof f.text !== 'string') continue;
    const parsed = parseColdText(f.text);
    broken += parsed.broken;
    if (parsed.entries.length > 0) used += 1;
    entries.push(...parsed.entries);
  }
  entries.sort((a, b) => (Number(a.created_at) || 0) - (Number(b.created_at) || 0));
  return { entries, broken, files: used };
}

/**
 * 从热条目里剔除那些**已经回到** `archive.diary` 的（比如恢复过一条）。
 *
 * 同一个 id 两边都有时该认热的 —— 热的那份是活的，可能续写过。
 *
 * @param {object[]} cold
 * @param {Iterable<string>} hotIds
 * @returns {object[]}
 */
export function coldOnly(cold, hotIds) {
  // 认 Map 也认 Set/数组：host 那边手里是 id → 条目的 Map，
  // 直接 `new Set(map)` 出来的是 [key, value] 对，会静默变成"一条也没热过"。
  const seen =
    hotIds instanceof Map
      ? new Set(hotIds.keys())
      : hotIds instanceof Set
        ? hotIds
        : new Set(hotIds ?? []);
  return (Array.isArray(cold) ? cold : []).filter((e) => e && !seen.has(e.id));
}
