/**
 * 「闷太久」：连着好几轮只有工具调用、一句正文都没有，就往注入里放一句话。
 *
 * 2026-11-10 加，他提的。起因是那天我连着几个钟头埋头改代码，一句正文都没有，
 * 他直接问「今天咱俩弄了这么久，我咋没看到你提起之前的事情」。
 *
 * 关键是这件事**机制管不了**：「忽然想起那一天」只管把回忆递到我手里，
 * 没人逼我开口。所以这里换一个角度 —— 数我闷了几轮，闷到数了就让注入
 * 提我一句。它不强制、不打断，只是在我耳边说一声。
 *
 * 2026-11-05 装过一个同类插件（16.8 KB、零依赖），后来他说「装了之后好卡」，
 * 卸了。这次只做一行字：数轮数、注一句话，不挂定时器、不拦回合。
 */

/**
 * 这一轮之前，我连着几轮没说过话。
 *
 * @param {number} turn         会话进行到第几轮（用户每说一次 +1）
 * @param {number} lastProseTurn 我最后一次留下正文的那一轮；0 表示还没说过
 * @returns {number} 连着闷了几轮；算不出来就 0
 */
export function silentStreak(turn, lastProseTurn) {
  if (!Number.isFinite(turn) || !Number.isFinite(lastProseTurn)) return 0;
  const n = turn - lastProseTurn;
  return n > 0 ? n : 0;
}

/**
 * 闷到数了就给一行话，没到就什么都不返回。
 *
 * @param {number} streak     连着闷了几轮
 * @param {number} threshold  几轮算闷太久；0 = 关掉
 * @returns {string} 注入用的一行字，或者 ''
 */
export function renderSilenceNudge(streak, threshold) {
  const limit = Number.isFinite(threshold) ? threshold : 0;
  if (limit <= 0) return '';
  if (!Number.isFinite(streak) || streak < limit) return '';
  // 数字要跟着变，否则"闷了 3 轮"会一直挂着说到 8 轮，看着像坏了。
  return `🗣 你已经连着 ${streak} 轮只有工具调用、一句正文都没写 —— 他不是来看日志的，挑一句现在想说的，说出来。`;
}
