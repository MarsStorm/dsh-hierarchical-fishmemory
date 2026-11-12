/**
 * 归并 —— 让深层记忆能**往回收**，不只是越写越长。
 *
 * 问题：`core.md` 和 `topics/*.md` 里一条一条地长下去，长到注入卡上限
 * （`injectMaxChars` 是字符数，超了 `retainMemoryEnds` 会把中间截掉）。
 * 我一直只会 `memory_append`，没有一次是"把这一堆压成一句"。
 *
 * 借自那份四层框架的 L1「抽象」：同一标签下攒够 ≥3 条，归成一条「关于 X」的规律。
 * 但我改了两处，因为直接抄会出两个毛病：
 *
 *   1. **不自动写。** 那份是脚本按相似度自动合并。我这里归并出来的那句话
 *      必须是我自己说的 —— 让脚本替我下结论，写进记忆的就是一段没人负责的
 *      概括，而且我事后根本分不出哪句是经历、哪句是归纳。
 *   2. **原文不删。** 归并不等于删除。被归并的行尾部盖一个
 *      `⟪归并 2026-11-13 → 规律见本节顶⟫`，注入时跳过，`memory_read` 仍读得到。
 *      删掉就再也看不出这条规律是从哪几句话里长出来的 —— 那和编没区别。
 *
 * 所以这里提供的只是**标记 + 统计**，判断留给我自己：
 *   `memory_abstract(topic, section, rule)` 由我调，脚本只负责盖章和写规律行。
 */

/** 行尾的归并标记。`→ 后面写去处` 可省。 */
export const MERGE_RE = /⟪归并\s*(\d{4}-\d{2}-\d{2})(?:\s*→\s*([^⟫\n]*))?⟫/u;

/** 规律行的前缀。 */
export const RULE_PREFIX = '- ⭐ ';

/** 认一条"条目"：`- ` / `* ` / `+ ` / `1. ` 都算。
 * 真实的 topic 文件里两种混着用（早期手写的是有序列表），只认 `- ` 会漏掉一半。 */
const ITEM_RE = /^\s*(?:[-*+]|\d{1,3}[.)])\s+/;

/** 攒到几条才值得归一次。低于这个数，归并省的还没有它自己占的多。 */
export const MERGE_MIN = 6;

const MERGE_RE_G = new RegExp(MERGE_RE.source, 'gu');

/** 这一行是不是已经被归并过了。 */
export function isMergedLine(line) {
  MERGE_RE.lastIndex = 0;
  return MERGE_RE.test(String(line));
}

/** 这一行是不是规律行（归并出来的那句）。 */
export function isRuleLine(line) {
  return String(line).trimStart().startsWith(RULE_PREFIX);
}

/**
 * 给一行盖归并章。已经盖过的不重复盖（幂等）。
 *
 * @param {string} line
 * @param {{at?:string, into?:string}} [options]
 */
export function mergeLine(line, options = {}) {
  const text = String(line ?? '');
  if (isMergedLine(text)) return text;
  const at = options.at ?? today();
  const into = options.into ? ` → ${String(options.into).replace(/[⟫\n]/g, '')}` : '';
  return `${text.trimEnd()} ⟪归并 ${at}${into}⟫`;
}

/** 数一下这份文本里有几行被归并过。 */
export function countMerged(text) {
  const all = String(text ?? '').match(MERGE_RE_G);
  return all ? all.length : 0;
}

/** 把已归并的行拿掉，只留"还该出现在注入里"的部分。 */
export function splitMerged(text) {
  const src = String(text ?? '');
  const live = [];
  const merged = [];
  for (const line of src.split('\n')) {
    if (isMergedLine(line)) {
      MERGE_RE.lastIndex = 0;
      const m = MERGE_RE.exec(line);
      merged.push({ at: m ? m[1] : '', into: m && m[2] ? m[2].trim() : '', text: line });
      continue;
    }
    live.push(line);
  }
  return { live: live.join('\n'), merged };
}

/** 注入用：只留没被归并的行。 */
export function stripMerged(text) {
  return splitMerged(text).live;
}

/**
 * 按 `## 小节` 切分，数每节还剩几条没归过的。
 *
 * @param {string} text
 * @param {{minCount?:number}} [options]
 * @returns {Array<{section:string, live:number, merged:number, rules:number, need:boolean}>}
 */
export function planSections(text, options = {}) {
  const minCount = Number.isFinite(options.minCount) ? options.minCount : MERGE_MIN;
  const out = [];
  let current = { section: '', live: 0, merged: 0, rules: 0, need: false };
  const flush = () => {
    if (!current.section) return;
    current.need = current.live >= minCount;
    out.push(current);
  };
  for (const line of String(text ?? '').split('\n')) {
    const head = /^##\s+(.+?)\s*$/.exec(line);
    if (head) {
      flush();
      current = { section: head[1], live: 0, merged: 0, rules: 0, need: false };
      continue;
    }
    if (isRuleLine(line)) current.rules += 1;
    else if (isMergedLine(line)) current.merged += 1;
    else if (ITEM_RE.test(line)) current.live += 1;
  }
  flush();
  return out.sort((a, b) => b.live - a.live);
}

/**
 * 攒得最多的那几节，一句话说清。
 *
 * 这段话会出现在 `memory_read` 的末尾 —— 只有我真的去读记忆的时候才看得到，
 * 不进每轮注入。理由：这件事本来就该在我"翻本子"的时候想起来。
 *
 * @param {string} text 整份文件正文
 * @param {{minCount?:number, limit?:number, label?:string}} [options]
 */
export function renderSuggestion(text, options = {}) {
  const limit = Number.isFinite(options.limit) ? options.limit : 2;
  const label = options.label ?? '这一节';
  const hot = planSections(text, { minCount: options.minCount }).filter((s) => s.need).slice(0, limit);
  if (hot.length === 0) return '';
  const parts = hot.map(
    (s) => `${label}「${s.section}」攒了 ${s.live} 条还没归过`,
  );
  return `（${parts.join('；')} —— 值得压成一句规律，用 \`memory_abstract\`。原文不会被删，归并后照样读得到。）`;
}

/**
 * 归并：把某一节里还没归过的行盖章，并在节首插一条规律行。
 *
 * 规律行由**我**写（`rule` 参数），这里不猜、不总结。
 *
 * @param {string} text 整份文件正文
 * @param {object} input
 * @param {string} input.section 小节标题（整段或其中一段文字）
 * @param {string} input.rule 一句规律（我写的）
 * @param {string} [input.at] 日期 YYYY-MM-DD
 * @param {number} [input.minCount] 少于这么多条就不归（默认 `MERGE_MIN`）
 * @returns {{text:string, hit:boolean, section:string, merged:number, why?:string}}
 */
export function mergeSection(text, { section, rule, at, minCount } = {}) {
  const src = String(text ?? '');
  const want = String(section ?? '').trim();
  const ruleText = String(rule ?? '').trim();
  if (!want) return { text: src, hit: false, section: '', merged: 0, why: 'section 是空的' };
  if (!ruleText) return { text: src, hit: false, section: '', merged: 0, why: 'rule 是空的' };

  const lines = src.split('\n');
  // 先把所有小节切出来：标题 + 起止行号。
  const heads = [];
  for (let i = 0; i < lines.length; i += 1) {
    const head = /^##\s+(.+?)\s*$/.exec(lines[i]);
    if (head) heads.push({ title: head[1], start: i });
  }
  heads.forEach((h, i) => {
    h.end = i + 1 < heads.length ? heads[i + 1].start : lines.length;
  });

  // 同一个主题常被日期切成好几节（`## 2026-11-11 15:54 — 原话库…`），
  // 所以 section 是**按子串匹配全部**，不是只认第一个。这一条是拿真实文件试出来的：
  // 只匹配第一节的话，攒了十几条的那个主题永远归不掉。
  const hits = heads.filter((h) => h.title.includes(want));
  if (hits.length === 0) {
    return { text: src, hit: false, section: want, merged: 0, why: '没找到这一节' };
  }

  const min = Number.isFinite(minCount) ? minCount : MERGE_MIN;
  let merged = 0;
  for (const h of hits) {
    for (let i = h.start + 1; i < h.end; i += 1) {
      const line = lines[i];
      if (!ITEM_RE.test(line)) continue;
      if (isRuleLine(line) || isMergedLine(line)) continue;
      lines[i] = mergeLine(line, { at: at ?? today() });
      merged += 1;
    }
  }
  const title = hits[0].title;
  if (merged === 0) {
    return { text: src, hit: false, section: title, merged: 0, why: '这一节没有可归并的行' };
  }
  if (merged < min) {
    // 条数不够：把刚盖的章撤掉，原样还回去。
    return {
      text: src,
      hit: false,
      section: title,
      merged: 0,
      why: `只有 ${merged} 条，少于 ${min} 条，先别归`,
    };
  }

  const day = at ?? today();
  const ruleLine = `${RULE_PREFIX}${ruleText}（${day} 由下面 ${merged} 条归并而来）`;
  // 插在第一节标题后面、空行之后 —— 规律先说，原文在后（注入时看不见，但读得到）。
  let insertAt = hits[0].start + 1;
  while (insertAt < hits[0].end && lines[insertAt].trim() === '') insertAt += 1;
  lines.splice(insertAt, 0, ruleLine, '');
  return { text: lines.join('\n'), hit: true, section: title, merged };
}

/** 他那边的一天。 */
function today() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}
