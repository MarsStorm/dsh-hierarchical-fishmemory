/**
 * 相似内容复核：**像，但不要不等于同一个。**
 *
 * 2026-11-13（1.27.0）。偷自 Memory-Continuity 的 `similarity-review.ts`：
 *
 *   「Local review hints, never a semantic equality or merge decision.」
 *   「未选中不代表不同，分组不代表事实相同。」
 *
 * 它那边做的是并排给人看，我这边的用法更窄但更急：**自动计数和自动归并**。
 *
 * · 教训层（1.17.0）靠 Dice ≥ 0.5 判「同一个坑」，像就加一次数。
 * · 抽象层（1.24.0）把一节的 N 条压成一句规律。
 *
 * 两处都只看"像不像"，不看"对不对得上"。而最要命的地方恰恰在**差别**上：
 *
 *   「不要自动合并」和「要自动合并」—— 字面 92% 相同，意思相反。
 *   「上限 200 字」和「上限 400 字」—— 字面 95% 相同，数字差一倍。
 *
 * 这类东西一旦被抹平，事后**完全看不出来**：规律句里写着"要自动合并"，
 * 我下次照着做，而原始那两条安静地盖着 ⟪归并⟫ 躺在下面。
 *
 * 所以这里只做一件事：把「否定词 / 数字」对不上的地方数出来。
 * **不算相似度**，也不判哪个对 —— 那是调用方的事。
 */

/** 否定与禁止。一个句子里出现几次，和它的意思方向强相关。 */
const NEGATION_RE = /不|没|未|无|别|勿|莫|甭|\bnever\b|\bnot\b|\bno\b|\bnone\b|n't/giu;

/** 阿拉伯数字与常见小数。版本号也算 —— 1.26.0 和 1.25.3 是两个版本。 */
const NUMBER_RE = /\d+(?:\.\d+)*/g;

/** 时间点。只认 ISO 前缀，够用（日记日期就是这个形状）。 */
const DATE_RE = /\d{4}-\d{2}-\d{2}/g;

function marks(text, re) {
  return JSON.stringify(String(text ?? '').match(re)?.sort() ?? []);
}

/**
 * 两条内容在哪些「不能含糊」的地方对不上。
 *
 * 返回的每一项是一个**理由**，不是一个分数：
 *   `negation_difference` — 一条有否定词、另一条没有（或次数不同）
 *   `number_difference`   — 数字集合不同（版本号、上限、天数都算）
 *   `date_difference`     — 日子不同
 *
 * 「差不多」「不过」这种词里的「不」会两边同时出现或同时不出现，
 * 所以不会误报 —— 比的是**集合**，不是"有没有这个字"。
 *
 * @param {string} a
 * @param {string} b
 * @returns {string[]} 空的数组 = 没发现这类差别（**不等于一模一样**）
 */
export function diffMarks(a, b) {
  const out = [];
  if (marks(a, NEGATION_RE) !== marks(b, NEGATION_RE)) out.push('negation_difference');
  if (marks(a, NUMBER_RE) !== marks(b, NUMBER_RE)) out.push('number_difference');
  if (marks(a, DATE_RE) !== marks(b, DATE_RE)) out.push('date_difference');
  return out;
}

/** 把理由翻成一句人话，给注入/工具输出用。 */
export function describeMarks(marksList, { a = '', b = '' } = {}) {
  const label = {
    negation_difference: '一条有否定、一条没有',
    number_difference: '数字对不上',
    date_difference: '日子对不上',
  };
  const said = (marksList ?? []).map((m) => label[m] ?? m);
  if (said.length === 0) return '';
  const head = said.join('；');
  if (a === '' && b === '') return head;
  return `${head}（「${clip(a)}」vs「${clip(b)}」）`;
}

function clip(s, n = 24) {
  const str = String(s ?? '').replace(/\s+/g, ' ');
  const chars = [...str];
  return chars.length <= n ? str : `${chars.slice(0, n).join('')}…`;
}

/** 汉字二元组 + 英文数字词。只用来判"这两条像不像"，不进检索。 */
function grams(text) {
  const s = String(text ?? '')
    .normalize('NFKC')
    .toLowerCase();
  const out = new Set();
  for (const run of s.match(/\p{Script=Han}+|[\p{L}\p{N}_]+/gu) ?? []) {
    if (/^\p{Script=Han}+$/u.test(run)) {
      const chars = [...run];
      if (chars.length === 1) out.add(chars[0]);
      for (let i = 0; i < chars.length - 1; i += 1) out.add(chars[i] + chars[i + 1]);
    } else {
      out.add(run);
    }
  }
  return out;
}

/** Dice 系数，0~1。 */
export function similarity(a, b) {
  const left = grams(a);
  const right = grams(b);
  if (left.size === 0 || right.size === 0) return 0;
  let common = 0;
  for (const g of left) if (right.has(g)) common += 1;
  return (2 * common) / (left.size + right.size);
}

/**
 * 一组内容里，哪些两两之间对不上。
 *
 * 只用来**提示**，不用来判重。有上限：`maxPairs` 对、`maxLines` 条，
 * 超了就在 `complete` 里明说 —— 静默少算是最坏的一种"看起来做了"。
 *
 * @param {string[]} texts
 * @param {{maxPairs?: number, maxLines?: number}} [options]
 * @returns {{pairs: Array<{a:number, b:number, marks:string[]}>, examined:number, complete:boolean}}
 */
export function scanDifferences(texts, options = {}) {
  const maxPairs = Math.max(1, Math.min(500, Number(options.maxPairs) || 60));
  const maxLines = Math.max(2, Math.min(200, Number(options.maxLines) || 24));
  // **差别只在"像的东西"之间才有意义。**
  // 「上限 200 字」和「先看日志再动代码」也有数字差别 —— 但没人会想合并它们，
  // 报出来只是噪音，噪音多了我就开始不看这一栏了。所以先过一道相似度。
  const minSimilarity = Number.isFinite(options.minSimilarity) ? options.minSimilarity : 0.35;
  const list = (Array.isArray(texts) ? texts : []).map((t) => String(t ?? ''));
  const used = list.slice(0, maxLines);
  const pairs = [];
  let examined = 0;
  let complete = list.length <= maxLines;
  outer: for (let i = 0; i < used.length; i += 1) {
    for (let j = i + 1; j < used.length; j += 1) {
      if (pairs.length >= maxPairs) {
        complete = false;
        break outer;
      }
      if (similarity(used[i], used[j]) < minSimilarity) continue;
      examined += 1;
      const hit = diffMarks(used[i], used[j]);
      if (hit.length > 0) pairs.push({ a: i, b: j, marks: hit });
    }
  }
  return { pairs, examined, complete };
}

/**
 * 这一对能不能当成「同一件事的两种说法」。
 *
 * `diffMarks` 只说"哪里不一样"，但**不一样有两种**：
 *
 *   矛盾 —— 「不要自动合并」/「要自动合并」（差一个字，意思相反）
 *   补充 —— 「报告成功≠真的成功」/「报告成功≠真的成功，别急着报平安」（多了一整句）
 *
 * 补充里天然会多出否定词（"别急着"），照 `diffMarks` 一律挡，就会把
 * 同一个坑记成两条、次数永远到不了 2、**永远不会被注入**——
 * 那是"防御过度"，比不防更坏，因为它安静。
 *
 * 所以加一条：**矛盾是改写，补充是加长。** 长得明显多出来的那句，
 * 算补充。这条判据不完美（长句里加一句否定也会被当补充放过），
 * 但它错的那一侧是"少挡"，而不是"把机制弄哑"。
 *
 * @param {string} a
 * @param {string} b
 * @param {{maxGrowth?: number}} [options]
 * @returns {{marks: string[], growth: number, conflict: boolean, kind: 'same'|'elaboration'|'contradiction'}}
 */
export function reviewPair(a, b, options = {}) {
  const maxGrowth = Number.isFinite(options.maxGrowth) ? options.maxGrowth : 1.35;
  const marksList = diffMarks(a, b);
  const lenA = Math.max(1, [...String(a ?? '')].length);
  const lenB = Math.max(1, [...String(b ?? '')].length);
  const growth = Math.max(lenA, lenB) / Math.min(lenA, lenB);
  if (marksList.length === 0) return { marks: [], growth, conflict: false, kind: 'same' };
  if (growth > maxGrowth) return { marks: marksList, growth, conflict: false, kind: 'elaboration' };
  return { marks: marksList, growth, conflict: true, kind: 'contradiction' };
}
