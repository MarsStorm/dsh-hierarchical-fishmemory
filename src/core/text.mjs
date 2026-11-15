/**
 * 文本小工具 —— 只收被抄过三遍以上的。
 *
 * 2026-11-16 收拢：`clip` 这个"截到 N 字加省略号"在 sticky / mirror / lesson /
 * diffcheck 里各写了一遍。四份里有两份用 `s.slice()`（按 UTF-16 单元切，
 * 碰上 emoji 会把代理对劈成半个字符），两份用 `[...s]`（按码点切）。
 * 同一个功能两种切法，差别只在你截的是不是一句带表情的话 ——
 * 那就是那种"平时都对、偶尔出一个方块"的 bug。
 *
 * 现在统一按**码点**切。
 */

/**
 * 截到 `max` 个字符，超了补省略号（省略号算在 max 里）。
 *
 * @param {unknown} text
 * @param {number} max
 * @param {{collapse?:boolean}} [options] collapse=true 时先把换行/连续空白压成单个空格
 */
export function clip(text, max, { collapse = false } = {}) {
  let s = String(text ?? '');
  if (collapse) s = s.replace(/\s+/g, ' ').trim();
  const chars = [...s];
  if (chars.length <= max) return s;
  return `${chars.slice(0, Math.max(0, max - 1)).join('')}…`;
}
