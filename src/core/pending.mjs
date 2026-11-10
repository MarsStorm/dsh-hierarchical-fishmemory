/**
 * 「这次没写成，下次再试」—— 待重试队列。
 *
 * ── 为什么要有这个文件 ──
 *
 * 2026-11-10 查日志发现的：`收到第一个 chunk` 出现 76 次，
 * `日记字段不完整，丢弃` 出现 26 次。也就是说**三分之一的轮次，
 * 模型明明写出来了，却因为格式差一点被整条扔掉**。
 *
 * 原来那句注释写得很干脆：「解析失败就丢弃，绝不把半成品写进档案」。
 * 这个方向没错 —— 半个条目比没有条目更坏。但它只做了前半句。
 *
 * 丢掉的是**模型那一轮好不容易读出来的东西**，而且丢掉之后再没有人知道
 * 它存在过：日志里一行 warn，档案里一个字没有。越是复杂、越过瘾的那一轮，
 * 越容易写歪格式，于是丢掉的恰好是最值得记的那些。
 *
 * 所以现在改成：**这次不收，先存着**。下一轮挑一条出来，让模型把那段话
 * 重新整理成合法 JSON 再收。不收就多留几天，试满三次才认输。
 *
 * ── 为什么是独立文件，不是塞进档案 ──
 *
 * 跟 `手记.md`／`纸条.md` 同一条教训：`archiveToFiles()` 每次写盘会把
 * `diary/*.jsonl` 整份重建，任何写进去的东西都会被覆盖掉。
 * 只有**它不认的文件**才活得下来。
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** 文件名（放在档案目录下，和 shallow.json 同级） */
export const PENDING_FILE = '待重试.jsonl';

/** 队列最多留几条。再多就是积压了 —— 说明模型一直在写歪，该看提示词了。 */
export const PENDING_MAX = 20;

/** 一条最多试几次。三次还整理不出来，就不是"差一点"的问题了。 */
export const PENDING_TRIES = 3;

/** 原文最多留多长（够重写出一个正常条目就够，别把整个上下文搬进队列） */
export const PENDING_RAW_MAX = 8000;

function safeParse(line) {
  try {
    const v = JSON.parse(line);
    if (!v || typeof v !== 'object') return null;
    if (typeof v.raw !== 'string' || v.raw.trim() === '') return null;
    return v;
  } catch {
    return null;
  }
}

/**
 * 读队列。坏行直接跳过 —— 这个文件写坏了，不能连累整个插件起不来。
 *
 * @param {string} file
 * @returns {Array<{id:string,raw:string,reason:string,at:number,session:string,tries:number}>}
 */
export function readPending(file) {
  let text = '';
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const out = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    const v = safeParse(trimmed);
    if (v) out.push(v);
  }
  return out;
}

function writeAll(file, items) {
  const body = items.map((v) => JSON.stringify(v)).join('\n');
  const tmp = `${file}.tmp`;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(tmp, body === '' ? '' : `${body}\n`, 'utf8');
  renameSync(tmp, file);
}

/**
 * 收进去一条。**满了就挤掉最老的**，不是拒绝新的 ——
 * 新的那条刚出炉、还热着，更值得留。
 *
 * @param {string} file
 * @param {{raw:string, reason?:string, at?:number, session?:string}} input
 * @returns {{item: object, dropped: number}}
 */
export function pushPending(file, input = {}) {
  const raw = String(input.raw ?? '').slice(0, PENDING_RAW_MAX);
  if (raw.trim() === '') return { item: null, dropped: 0 };

  const at = Number.isFinite(input.at) ? input.at : Date.now();
  const items = readPending(file);
  const item = {
    id: `p_${at.toString(36)}_${(items.length + 1).toString(36)}`,
    at,
    reason: String(input.reason ?? '').slice(0, 200),
    session: String(input.session ?? ''),
    tries: 0,
    raw,
  };
  items.push(item);

  let dropped = 0;
  while (items.length > PENDING_MAX) {
    items.shift();
    dropped += 1;
  }
  // 大文件就一次写整份；正常只有几行，无所谓
  try {
    if (!existsSync(dirname(file))) mkdirSync(dirname(file), { recursive: true });
    writeAll(file, items);
  } catch {
    // 写不进去就退回追加 —— 至少别把这条彻底丢了
    try {
      appendFileSync(file, `${JSON.stringify(item)}\n`, 'utf8');
    } catch {
      return { item: null, dropped };
    }
  }
  return { item, dropped };
}

/**
 * 拿出最老的一条来试（先来先试，免得新的一直插队把旧的饿死）。
 *
 * @param {string} file
 * @returns {object|null} 拿出来的那条（已经从队列里删掉）
 */
export function takePending(file) {
  const items = readPending(file);
  if (items.length === 0) return null;
  const [first, ...rest] = items;
  writeAll(file, rest);
  return first;
}

/**
 * 试失败了放回去，次数 +1；超次数就不放了。
 *
 * 放回**尾巴**而不是原位置：它已经失败过，让别的先试。
 *
 * @param {string} file
 * @param {object} item
 * @returns {{kept: boolean, tries: number}}
 */
export function requeuePending(file, item) {
  const tries = (Number.isFinite(item?.tries) ? item.tries : 0) + 1;
  if (tries >= PENDING_TRIES) return { kept: false, tries };
  const items = readPending(file);
  items.push({ ...item, tries });
  while (items.length > PENDING_MAX) items.shift();
  writeAll(file, items);
  return { kept: true, tries };
}

/** 队列里现在有几条（给日志/面板用）。 */
export function pendingCount(file) {
  return readPending(file).length;
}

/** 路径小工具：档案目录下的固定文件名。 */
export function pendingPath(diaryDir) {
  return join(diaryDir, PENDING_FILE);
}
