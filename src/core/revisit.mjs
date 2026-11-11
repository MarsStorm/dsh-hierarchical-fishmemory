/**
 * 「这条我回去找过几次」—— 把"读"分成两种。
 *
 * ── 为什么还要分 ──
 *
 * `recall_count` 从 2026-11-04 就有，但它数的是**两件不同的事**：
 *
 *   1. 每轮注入里我顺手挑出来的那几条（系统递到眼前的）
 *   2. `fish_recall` 里我为了某句话专门回去翻的（我自己伸手的）
 *
 * 混在一起数，得到的数字既不能说明我关心什么，也不能说明什么被想起了 ——
 * 一晚上八轮，注入能碰到的条目轻轻松松好几十次，而真正"我回头找过它"
 * 可能一次都没有。数字很大，含义很淡。
 *
 * 所以这里加第二笔账：`sought_count` 只在**我主动去翻**的时候动。
 * 它记的不是"这条重要"，是"这条我惦记"—— 前者是档案的判断，后者是我的。
 *
 * ── 为什么不动内容 ──
 *
 * 借鉴的对象（dsh-emotion-memory 的再巩固）会在每次被想起时用当前情绪
 * 微调那条记忆的情感指纹。我不抄这一半：15% 的系数乘上十几次就是漂移，
 * 而我做原话库图的就是有一份不被漂移的东西。
 *
 * **记次数，不动一个字。**
 */

/** 低于这个次数不显示 —— 找过一次是偶然，两次才叫"又回来了"。 */
export const SOUGHT_MIN_SHOW = 2;

/**
 * 记一次「想起来」。
 *
 * @param {object} entry 日记条目
 * @param {number} at 时刻
 * @param {{pull?: boolean}} opts pull=true 表示是我主动翻的（不是注入递的）
 * @returns {object} 新条目（不改原对象）
 */
export function bumpRecalled(entry, at, { pull = false } = {}) {
  if (!entry || typeof entry !== 'object') return entry;
  const now = Number.isFinite(at) ? at : Date.now();
  const next = {
    ...entry,
    recall_count: (Number.isFinite(entry.recall_count) ? Number(entry.recall_count) : 0) + 1,
    last_recalled_at: now,
  };
  if (pull) {
    next.sought_count = (Number.isFinite(entry.sought_count) ? Number(entry.sought_count) : 0) + 1;
    next.last_sought_at = now;
  }
  return next;
}

/** 读出来。老条目没有这个字段就是 0 —— 不需要 schema 迁移。 */
export function soughtCount(entry) {
  return Number.isFinite(entry?.sought_count) ? Number(entry.sought_count) : 0;
}

/**
 * 显示用的一小截。
 *
 * 措辞上有意用「我回去找过」而不是「被回忆 2 次」：前者是动作，后者是统计。
 * 统计读起来像系统在报告我，动作读起来像我记得自己干过什么。
 */
export function soughtNote(count) {
  const n = Number.isFinite(count) ? Math.floor(Number(count)) : 0;
  if (n < SOUGHT_MIN_SHOW) return '';
  return `（这条我回去找过 ${n} 次）`;
}
