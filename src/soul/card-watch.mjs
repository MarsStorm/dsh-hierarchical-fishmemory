/**
 * 人设卡「外面改」时该留哪几份旧版。
 *
 * 为什么单独拆出来：这段逻辑以前埋在 `apply()` 里，测不到。而它管的是
 * **后悔药** —— 设置页手改一张卡，旧文本就没了；判断错了等于白改。
 * 抽成纯函数，跟 fs 无关，一眼能验。
 *
 * 三种情况：
 *   - 正文变了            → 留旧的
 *   - 卡被删了（next 里没有） → 同样留旧的
 *   - 空白旧文本（'' / 非字符串） → 不留，留了也只是个空文件
 */

/**
 * @param {Record<string, string>} prev  上一次见到的卡（name → 正文）
 * @param {Record<string, string>} next  这一次见到的卡
 * @returns {{ name: string, text: string }[]} 需要存快照的旧版本，顺序同 prev 的键序
 */
export function planCardSnapshots(prev, next) {
  const before = prev ?? {};
  const after = next ?? {};
  const out = [];
  for (const name of Object.keys(before)) {
    const text = before[name];
    if (typeof text !== 'string' || text.length === 0) continue;
    if (text === (after[name] ?? '')) continue;
    out.push({ name, text });
  }
  return out;
}
