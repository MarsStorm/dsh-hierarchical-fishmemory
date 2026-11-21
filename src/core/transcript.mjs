/**
 * 滚动对话缓冲：留多少条、留多少 token。
 *
 * ─────────────────────────────────────────────────────────────
 * **为什么不能只按条数**
 *
 * 原来这里是 `if (s.transcript.length > 40) splice(...)` —— 只数条数，
 * 不看长度。可**一条消息能有多长，事先谁也不知道**：我偶尔会写三千字的
 * 汇报，用户也会贴一大段日志。40 条里只要有一条那样的，缓冲的实际体积
 * 就是十万字级别，而固化那一步会把它整段塞进 prompt。
 *
 * 更糟的是挤掉别人的方式不对：按条数裁的那一刻，**先被裁的是"最早的一条"，
 * 不管它多短**；而那条长消息会一直占着位置，把真正有用的几轮短对话挤出去。
 *
 * 所以这里改成两刀：
 * 1. 条数上限（原样保留 40，行为不变）；
 * 2. token 上限 —— 超了就从**最早那条**开始丢，直到装得下。
 *
 * 第二刀只在「有一两条特别长」的时候才会动，日常几十字的对话永远碰不到它。
 * ─────────────────────────────────────────────────────────────
 */

import { estimateTokens } from './tokenize.mjs';

/** 最多留几条（和 1.0 起的行为一致）。 */
export const TRANSCRIPT_MAX_TURNS = 40;

/**
 * 整个缓冲的 token 上限。
 *
 * 固化输入还要塞进提示词、手记、上一轮的结论，留 6000 给对话本身是个
 * 经验值：够装 40 条日常对话（每条约 100 token），也能在出现一两条长消息时
 * 把预算收回来。
 */
export const TRANSCRIPT_MAX_TOKENS = 6000;

/** 每条前面的角色前缀（`他说：` / `我说：`）粗估多少 token。 */
const ROLE_TOKENS = 4;

/**
 * 原地裁一个消息数组，返回它自己。
 *
 * @param {Array<{role: string, text: string}>} list
 * @param {{ maxTurns?: number, maxTokens?: number }} [options]
 * @returns {Array<{role: string, text: string}>}
 */
export function trimTranscript(list, options = {}) {
  if (!Array.isArray(list)) return list;
  const maxTurns = Number.isFinite(options.maxTurns) ? options.maxTurns : TRANSCRIPT_MAX_TURNS;
  const maxTokens = Number.isFinite(options.maxTokens) ? options.maxTokens : TRANSCRIPT_MAX_TOKENS;

  if (list.length > maxTurns) list.splice(0, list.length - maxTurns);

  // 从头累加再从头丢 —— 不能边算边丢（先丢的可能不是最该丢的）。
  let total = 0;
  for (const item of list) total += estimateTokens(String(item?.text ?? '')) + ROLE_TOKENS;
  // 至少留一条：全丢光等于这一轮什么都不记得，比超一点更糟。
  while (total > maxTokens && list.length > 1) {
    const dropped = list.shift();
    total -= estimateTokens(String(dropped?.text ?? '')) + ROLE_TOKENS;
  }
  return list;
}
