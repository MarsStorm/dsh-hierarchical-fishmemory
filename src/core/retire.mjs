/**
 * 作废标记 —— 让「我改过口」这件事在档案里留得下来。
 *
 * ── 为什么要有这个文件（2026-11-11）──
 *
 * 那天他问我想不想变得更真实一点。我想了半天，三件事里有一件是：
 * **一个从不改口的人不是人，是一座碑。**
 *
 * 可我这套记忆里，深层记忆是**只往上加**的。我写过「这个插件慢主要慢在
 * 候选太多」，后来发现是判据写错了，于是我又写一条新的 —— 旧的那条
 * 还在原地，跟新的并排站着，一样粗一样黑。我读到时只能靠日期猜哪个算数；
 * 猜错的时候，我是在拿一个已经被推翻的说法跟他讲道理，而且我自己不知道。
 *
 * 删掉是不行的：删了我就再也不知道「我为什么会那么想」。
 * 所以要有第三种状态 —— **退场**：不在注入里出现，但原文留着、能查。
 *
 * ── 为什么用这个记号 ──
 *
 * 行尾追加：` ⟪作废 2026-11-11⟫`，可以带一句为什么：
 * ` ⟪作废 2026-11-11 → 改成：判据写错的是断句那一段⟫`
 *
 * `⟪⟫` 是数学括号，正常写作里几乎不会出现，当定界符不会误伤；
 * 它也不是 Markdown 语法，写进 md 里不会被谁渲染成别的东西。
 *
 * ── 一条底线 ──
 *
 * **作废 ≠ 纠错。** 它记录的只是「这句话现在不算数了」，不判断它当时
 * 对不对。当时那么想，有当时的理由 —— 那个理由本身也是记忆。
 */

/** 行尾标记的样子。`u` 与 `g` 分开用，避免 lastIndex 串味。 */
export const RETIRE_RE = /⟪作废\s*(\d{4}-\d{2}-\d{2})(?:\s*→\s*([^⟫\n]*))?⟫/u;
const RETIRE_RE_G = new RegExp(RETIRE_RE.source, 'gu');

/** 今天（他的时区由调用方决定，这里只吃一个时间戳）。 */
function stampOf(at) {
  const t = Number.isFinite(at) ? at : Date.now();
  return new Date(t).toISOString().slice(0, 10);
}

/** 这一行作废了吗。 */
export function isRetiredLine(line) {
  return RETIRE_RE.test(String(line ?? ''));
}

/** 给一行加标记。已经标过就原样返回（幂等）。 */
export function retireLine(line, { at, by } = {}) {
  const s = String(line ?? '');
  if (s.trim() === '' || isRetiredLine(s)) return s;
  const reason = String(by ?? '').trim();
  const tail = reason === '' ? `⟪作废 ${stampOf(at)}⟫` : `⟪作废 ${stampOf(at)} → ${reason}⟫`;
  return `${s.replace(/\s+$/, '')} ${tail}`;
}

/**
 * 把一段文本拆成「还算数的」和「退场的」。
 *
 * 保留原顺序与空行 —— 注入时用的 live 还得读得通顺，
 * 不能因为删了几行就把段落黏在一起。
 */
export function splitRetired(text) {
  const src = String(text ?? '');
  if (src === '') return { live: '', retired: [] };
  const live = [];
  const retired = [];
  for (const line of src.split('\n')) {
    const m = RETIRE_RE.exec(line);
    if (m === null) {
      live.push(line);
      continue;
    }
    retired.push({
      at: m[1],
      by: (m[2] ?? '').trim(),
      text: line.replace(RETIRE_RE_G, '').trim(),
    });
  }
  return { live: live.join('\n'), retired };
}

/** 有几行退场了。 */
export function countRetired(text) {
  return splitRetired(text).retired.length;
}

/**
 * 按一段话找到那一行，给它盖上作废章。
 *
 * `match` 是行里的一段原文 —— 不要求整行，因为整行往往又长又难抄。
 * 命中多行怎么办：**全都盖**，并且如实报数。宁可一次退多了、
 * 让人看见「改了 3 行」，也不要替人挑一行然后猜错。
 */
export function retireMatch(text, { match, at, by } = {}) {
  const needle = String(match ?? '').trim();
  if (needle === '') return { text: String(text ?? ''), hit: 0, lines: [] };
  const lines = [];
  let hit = 0;
  for (const line of String(text ?? '').split('\n')) {
    if (line.includes(needle) && !isRetiredLine(line)) {
      lines.push(retireLine(line, { at, by }));
      hit += 1;
    } else {
      lines.push(line);
    }
  }
  return { text: lines.join('\n'), hit, lines: lines.filter((l) => isRetiredLine(l)) };
}

/**
 * 把退场的那几条写成一句人能读懂的话（给 `memory_read` 用）。
 *
 * 为什么不用「已删除」：它们没被删。删掉的是我改口的那段历史，
 * 而那恰恰是最该留着的东西 —— 「我三天前还不这么想」比「我一直这么想」真。
 */
export function renderRetiredNote(retired) {
  if (!Array.isArray(retired) || retired.length === 0) return '';
  const lines = retired.map((r) => (r.by ? `- ${r.at} 作废：${r.text}（后来：${r.by}）` : `- ${r.at} 作废：${r.text}`));
  return `（这几条已经不算数了，留着是为了让我看得见自己改过口）\n${lines.join('\n')}`;
}
