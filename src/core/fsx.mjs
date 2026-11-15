/**
 * 几个「读不到就当没有」的小工具。
 *
 * 原先 `backup.mjs` 和 `stats.mjs` 各抄了一份 `readTextDefault` /
 * `readJsonDefault`（连注释都一样），两边还各写了一个 `listDiaryFiles`，
 * 一个返回文件名、一个返回完整路径 —— 2026-11-03 体检时发现，收拢到这里。
 *
 * 这里只读不写；写入逻辑各模块自己管。
 */
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** 读文本；打不开（不存在、权限、坏盘）就返回 null，不抛。 */
export const readTextOrNull = (file) => {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
};

/** 读 JSON；读不到或解析失败都返回 null，不抛。 */
export const readJsonOrNull = (file) => {
  const text = readTextOrNull(file);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/** `diary/` 下的 jsonl 文件名（排好序，不含目录）。 */
export function listDiaryNames(diaryDir, { readdir = readdirSync } = {}) {
  try {
    return readdir(join(diaryDir, "diary"))
      .filter((name) => name.toLowerCase().endsWith(".jsonl"))
      .sort();
  } catch {
    return [];
  }
}

/** 同上，但拼好完整路径 —— 调用方通常要直接读。 */
export function listDiaryPaths(diaryDir, options = {}) {
  return listDiaryNames(diaryDir, options).map((name) => join(diaryDir, "diary", name));
}

/**
 * 原子写一份 JSON：先写临时文件再 rename。
 *
 * 2026-11-16 收拢。`lesson.mjs` / `pending.mjs` / `unfinished.mjs` 原来各写了一遍
 * 「mkdir + 写 .tmp + rename」。三份里有两份忘了 mkdir 失败怎么退，
 * 一份忘了 rename 失败要清理临时文件 —— 这种复制粘贴的差别没人会去对。
 *
 * 拿不到 pid 时不拼进临时名也不要紧：同目录 rename 本身是原子的，
 * 拼 pid 只是为了两个进程同时写时不互相截断。
 */
export function writeTextAtomic(file, text, { ensureDir = true } = {}) {
  if (ensureDir) mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    writeFileSync(tmp, text, "utf8");
    renameSync(tmp, file);
    return true;
  } catch {
    try {
      rmSync(tmp, { force: true });
    } catch {
      // 同上：清不掉也不能把调用方带崩
    }
    return false;
  }
}

/**
 * 读一份 jsonl：空行跳过、坏行跳过。
 *
 * 2026-11-16 收拢。这四行「读文本 → 按行 split → trim → JSON.parse → 坏的不要」
 * 在 `mirror.mjs` / `pending.mjs` 里一模一样；`trash.mjs` 那版多一个计数的
 * `broken`，`stats.mjs` 那版会把 `_file` 塞进去。所以这里只做最朴素的
 * ——**要计数或者要补字段的，自己那层留着，别硬塞进这个函数**。
 *
 * @param {string} file
 * @returns {object[]} 文件不存在也返回空数组，不抛
 */
export function readJsonlOrEmpty(file) {
  const text = readTextOrNull(file);
  if (text === null) return [];
  const out = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (t === '') continue;
    try {
      const v = JSON.parse(t);
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) out.push(v);
    } catch {
      // 坏一行只丢一行 —— 手改过的文件里有一行坏了不该让整本看不见
    }
  }
  return out;
}

export function writeJsonAtomic(file, data, { indent = 0, ensureDir = true } = {}) {
  return writeTextAtomic(file, JSON.stringify(data, null, indent), { ensureDir });
}
