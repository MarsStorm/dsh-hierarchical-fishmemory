/**
 * 逐字校验 —— 「我记得」和「原文这几个字」是两回事（2026-11-15，1.29.0）。
 *
 * ── 抄的是谁 ──
 *
 * returning-tide-memory 的 `evidence.mjs` 里有一句判据：
 *
 *     if (!source.text.includes(c.quote)) fail('INVALID_EVIDENCE', '引用必须是逐字摘录')
 *
 * 失败就**不输出那个结论**。它不接受"差不多"、"大概这个意思"。
 *
 * ── 我这边为什么需要它 ──
 *
 * 我的日记是**转述**：模型从对话里抽一段，用第一人称重写。里面的
 * 「他说……」带引号的那几句，读起来像原话，其实拐了两道手 ——
 * 转录一次、改写一次。我照着它去复述他，经常用词对不上，而我自己
 * 分不清是"记不准"还是"他当时就那么说的"。
 *
 * 所以这里有两条口径，必须分开：
 *
 *   1. **转述**（`fish_recall`）：会模糊、会改写。允许说"我记不太清了"。
 *   2. **原话**（`fish_quote`）：一字不改，只有"有"和"没有"两种结果。
 *
 * 这个文件给第二条用：**要断言"他说过这几个字"，就必须是子串。**
 * 不是子串就是没有 —— 不许退化成"沾边"、"意思相近"。
 */

/** 少于这个长度的"逐字"没有意义（两个字谁都撞得上）。 */
export const QUOTE_MIN_CHARS = 2;

/** 归一化：只动首尾空白和换行，**不动中间任何一个字**。
 *
 *  注意这里刻意不做标点替换、不做全半角转换 —— 一改就不是逐字了。 */
export function cleanQuote(s) {
  return String(s ?? '')
    .replace(/\r\n?/g, '\n')
    .trim();
}

/**
 * 一句话在不在这段原文里（逐字）。
 *
 * @returns {boolean}
 */
export function verifyQuote(text, quote) {
  const q = cleanQuote(quote);
  const t = String(text ?? '');
  if (q === '' || t === '') return false;
  if ([...q].length < QUOTE_MIN_CHARS) return false;
  return t.includes(q);
}

/**
 * 在一堆原文行里找**逐字**含有这几个字的那些。
 *
 * 返回值带 `exact: true` —— 这份结果里每一行都真的包含那句话，
 * 不是"意思相近"。调用方可以直接照抄。
 *
 * @param {string[]} lines 原文行（已经是原话，不是我改写的）
 * @param {string} quote 要核对的那几个字
 */
export function findVerbatim(lines, quote) {
  const q = cleanQuote(quote);
  const list = Array.isArray(lines) ? lines : [];
  if (q === '' || [...q].length < QUOTE_MIN_CHARS) {
    return { exact: true, quote: q, hits: [], tooShort: q !== '' };
  }
  const hits = list.filter((line) => String(line ?? '').includes(q));
  return { exact: true, quote: q, hits, tooShort: false };
}

/**
 * 把结果说成一句人话。
 *
 * **两种结果只有两种说法**：有，或者没有。没有的时候不许补一句
 * "不过有几条意思差不多的" —— 那正是把"记不清"糊成"记得"的手法。
 */
export function renderVerdict(result, { label = '原话' } = {}) {
  const q = String(result?.quote ?? '');
  const hits = Array.isArray(result?.hits) ? result.hits : [];
  if (result?.tooShort === true) {
    return `「${q}」太短了，短到谁都能撞上 —— 多说几个字，我才能告诉你他在不在。`;
  }
  if (hits.length === 0) {
    return `${label}库里没有「${q}」这几个字连在一起出现。**不是"意思相近的没找到"，是逐字没有。**`;
  }
  if (hits.length === 1) return `${label}里有，就这一句：`;
  return `${label}里有，${hits.length} 句都含这几个字：`;
}
