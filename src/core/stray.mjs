/**
 * 孤儿半截文件 —— 原子写留下的垃圾。
 *
 * ── 为什么会有这种东西 ──────────────────────────────────────
 *
 * 所有落盘都走 `writeFileAtomic`：先写 `xxx.tmp-<pid>`，再 rename 上去。
 * 这是对的（半截文件毁不掉档案），但它有一个前提：**进程活得够久，能 rename。**
 * 进程被硬杀（OOM、DSHBox 重启、我手抖 `kill -9`）的那一刻，那个 tmp 就留在
 * 原地了，而且**没有任何东西会再想起它**。
 *
 * 2026-11-19 才发现：`日记.md.tmp-31810`（79910 字节）从 11 月 12 号躺到今天，
 * 一周没人清。它不是数据丢失，但它让"这个目录里有什么"变得不可信 ——
 * 我翻档案时会看见一个像是日记、其实是半截的东西。
 *
 * ── 判据 ────────────────────────────────────────────────
 *
 * 只删**同时满足**三条的：
 *   1. 名字形如 `<某个文件>.tmp-<pid>`；
 *   2. pid 不是当前进程（现在正在写的那个不能碰）；
 *   3. 修改时间已经过了 `minAgeMs`。
 *
 * 第三条不是洁癖：同一台机器上可能有第二个实例（备份/校验/临时起一个测试实例），
 * 它正写到一半的 tmp 跟孤儿长得一模一样。留一个时间窗，比猜 pid 活着没有可靠。
 */

import { readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

/** `writeFileAtomic` 用的后缀。改那边要一起改这里。 */
const TMP_RE = /\.tmp-(\d+)$/;

/** 默认多久算"肯定不是有人正在写"。 */
export const STRAY_MIN_AGE_MS = 10 * 60 * 1000;

/**
 * 扫一个目录（不递归）里的孤儿 tmp 文件。
 *
 * @param {string} dir
 * @param {{now?:number, minAgeMs?:number, selfPid?:number}} [options]
 * @returns {{removed:string[], kept:string[], bytes:number}} removed 是文件名
 */
export function sweepStrayTmpFiles(dir, options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const minAgeMs = Number.isFinite(options.minAgeMs) ? options.minAgeMs : STRAY_MIN_AGE_MS;
  const selfPid = Number.isFinite(options.selfPid) ? options.selfPid : process.pid;
  const removed = [];
  const kept = [];
  let bytes = 0;

  let names = [];
  try {
    names = readdirSync(dir);
  } catch {
    return { removed, kept, bytes };
  }

  for (const name of names) {
    const m = TMP_RE.exec(name);
    if (m === null) continue;
    const pid = Number(m[1]);
    if (pid === selfPid) continue; // 这就是我自己此刻正在写的那份
    const file = join(dir, name);
    let info = null;
    try {
      info = statSync(file);
    } catch {
      continue;
    }
    if (!info.isFile()) continue;
    if (now - info.mtimeMs < minAgeMs) {
      kept.push(name);
      continue;
    }
    try {
      unlinkSync(file);
      removed.push(name);
      bytes += info.size;
    } catch {
      kept.push(name);
    }
  }

  return { removed, kept, bytes };
}

/** 给日志用的一句话；没删着东西就返回空串。 */
export function describeSweep(result) {
  const removed = result?.removed ?? [];
  if (removed.length === 0) return '';
  const kb = Math.round((result.bytes ?? 0) / 1024);
  const names = removed.slice(0, 3).join('、') + (removed.length > 3 ? ` 等 ${removed.length} 个` : '');
  return `清掉 ${removed.length} 个孤儿半截文件（${names}，共 ${kb} KB）—— 是某次进程被硬杀留下的`;
}