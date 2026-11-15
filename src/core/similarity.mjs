/**
 * 「这两句话有多像」—— 全项目只有这一份实现。
 *
 * 2026-11-16 收拢。原来 `sticky.mjs`（判断他这句话说过没有）和
 * `lesson.mjs`（判断两个坑是不是同一个）里各抄了一份 `tokenSet` + `dice`，
 * 连注释都一样。两份一旦调参不同，同一句话在纸条里算「重复」、
 * 在教训里算「新坑」，没人会想到去查两处。
 *
 * 注意这里**不是** `diffcheck.mjs` 的 `similarity`，两个用途不同：
 *
 * - 这里：走 `tokenize`（中文二元组 + 英文词），看**词**重不重合。
 *   阈值 0.5~0.55，是拿真实纸条和真实教训调出来的。
 * - `diffcheck.similarity`：走汉字二元组 + 英文整词（NFKC + 小写），
 *   用来给「这两条是不是在说同一件事」排序，阈值 0.35。
 *
 * 不合并成一个的原因：换实现就是换判据，那些阈值全部要重调 ——
 * 这件事不能顺手做，得单独量。
 */

import { tokenize } from './keywords.mjs';

/** 一句话切成 token 集合。切不动就当空集（空集跟谁都算"不像"）。 */
export function tokenSet(text) {
  try {
    return new Set(tokenize(String(text ?? '')));
  } catch {
    return new Set();
  }
}

/** Dice 系数，0~1。两个空集算 0，不算是"完全一样"。 */
export function dice(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  return (2 * shared) / (a.size + b.size);
}

/** 两段文本的相似度（一步到位，省得每个调用方自己先切再算）。 */
export function similarText(a, b) {
  return dice(tokenSet(a), tokenSet(b));
}
