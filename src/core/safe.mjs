/**
 * 「配置读不出来就当没有」。
 *
 * 2026-11-16 收拢：`fragments.mjs` 和 `sticky.mjs` 里各写了一遍
 *
 *     const cfg = () => { try { return config() ?? {} } catch { return {} } };
 *
 * 两处一模一样。这种包一层的写法本身没错 —— 配置回调是宿主给的，
 * 它抛异常的时候注入段应该退化成"这一段不出现"，而不是让整轮注入炸掉。
 * 错的是**有两份**：哪天有人只给其中一处改成 catch 后打日志，
 * 另一处就还是静默吞。
 */

/**
 * 安全地取配置。
 * @param {() => object} read
 * @returns {object} 读失败、返回空值、返回非对象 —— 一律给空对象
 */
export function safeConfig(read) {
  try {
    const value = typeof read === 'function' ? read() : read;
    if (!value || typeof value !== 'object') return {};
    return value;
  } catch {
    return {};
  }
}
