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
 * 这句话在这一行原文里的**位置**，不是一个"有/没有"。
 *
 * ── 抄的是 memory-brain 的 `derivation.py:141-147` ──
 *
 * 它存引用时存的不是「引用了什么」，是 `{message_id, start, end}` 三元组，
 * 校验三件事：
 *
 *     if start < 0:                          raise 'quote_absent'
 *     if text.find(quote, start + 1) >= 0:   raise 'quote_ambiguous'
 *     if quote != text[start:end]:            raise 'quote_span_mismatch'
 *
 * 中间那条是我原来没有的：**引用必须唯一**。同一句话在原话里出现两次，
 * "他这么说过"就还是确定的，但"他说的是哪一次"就不确定了 ——
 * 而这两件事在我这边一直被混成一件。
 *
 * ── 为什么只做"行内"，不做"整段跨度" ──
 *
 * 它的引用能指回 `message_id + offset`，因为它把用户消息按 800 字切块存了。
 * 我的 `纸条.md` 是**一行一句原话**：每行本身就是原话的最小单位，
 * 没有"一句话里再切一段"的余地。所以这里只在本行内定位 ——
 * 能给出 `start/end`，就不能说谎；给不出 message_id，就不假装给得出。
 *
 * @param {string} line 一行原话
 * @param {string} quote 要找的那几个字
 * @returns {{start:number, end:number, text:string, ambiguous:boolean} | null}
 */
export function locateQuote(line, quote) {
  const q = cleanQuote(quote);
  const text = String(line ?? '');
  if (q === '' || text === '' || [...q].length < QUOTE_MIN_CHARS) return null;
  const start = text.indexOf(q);
  if (start < 0) return null;
  // 同一行里第二次出现 —— 引用的位置不确定，但"有"是确定的。
  const ambiguous = text.indexOf(q, start + 1) >= 0;
  return { start, end: start + [...q].length, text, ambiguous };
}

/**
 * 在一堆原文行里找，并且**每条命中都带上它的位置**。
 *
 * `findVerbatim` 回答的是"在不在"；这个回答的是"在哪、唯一不唯一"。
 * 判据比它严一档：命中的行里只要有一处是 `ambiguous`，那一条就不能
 * 当作可靠引用 —— 它可能引的是同一句话的另一处。
 *
 * @param {string[]} lines
 * @param {string} quote
 */
export function findSpans(lines, quote) {
  const q = cleanQuote(quote);
  const list = Array.isArray(lines) ? lines : [];
  if (q === '' || [...q].length < QUOTE_MIN_CHARS) {
    return { exact: true, quote: q, hits: [], ambiguous: 0, tooShort: q !== '' };
  }
  const hits = [];
  for (let i = 0; i < list.length; i++) {
    const line = String(list[i] ?? '');
    const start = line.indexOf(q);
    if (start < 0) continue;
    const ambiguous = line.indexOf(q, start + 1) >= 0;
    hits.push({ line, index: i, start, end: start + [...q].length, ambiguous });
  }
  return {
    exact: true,
    quote: q,
    hits,
    // 有几条落点是"这一行里出现过不止一次"的位置。
    ambiguous: hits.filter((h) => h.ambiguous).length,
    tooShort: false,
  };
}

/** 位置话。有歧义的时候必须说出来，不能只报"有"。 */
export function renderSpans(result, { label = '原话' } = {}) {
  const spans = Array.isArray(result?.hits) ? result.hits : [];
  if (result?.tooShort === true) return `「${String(result.quote ?? '')}」太短，短到谁都能撞上。`;
  if (spans.length === 0) {
    return `${label}里没有这几个字连在一起出现。\n（"没有"只是逐字没有 —— 他说过意思相近的话，这条查不出来；换几个字再找。）`;
  }
  const ambiguous = Number(result?.ambiguous ?? 0);
  const tail = ambiguous > 0
    ? `\n（其中 ${ambiguous} 条在原话里出现了不止一次 —— 能说"他说过"，说不准引的是哪一处，要引用就多带几个字。）`
    : '';
  return `${label}里有 ${spans.length} 处：` + tail;
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
