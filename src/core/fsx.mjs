/**
 * 几个「读不到就当没有」的小工具。
 *
 * 原先 `backup.mjs` 和 `stats.mjs` 各抄了一份 `readTextDefault` /
 * `readJsonDefault`（连注释都一样），两边还各写了一个 `listDiaryFiles`，
 * 一个返回文件名、一个返回完整路径 —— 2026-11-03 体检时发现，收拢到这里。
 *
 * 这里只读不写；写入逻辑各模块自己管。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

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
