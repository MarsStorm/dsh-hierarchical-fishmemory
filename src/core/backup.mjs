/**
 * 备份 / 还原：把「我」整包打成一个可携带的 JSON。
 *
 * 2026-10-31 加。用户的原话是「生成一个备份文件，里面包含了你的人格和记忆，
 * 日记手记这些也包含在内，这样就可以把你完美带到另一个设备」。
 *
 * 设计原则：
 * 1. **纯数据、纯文本**。不打包二进制、不压缩，换台机器用 `less` 就能看。
 * 2. **一份文件说清全部**：人设卡 / 深层记忆（core + topics）/ 共度时光（jsonl）/
 *    情感日记 / 人格手记 / 浅层记忆 / 档案元数据。缺哪一样都不算「完整」。
 * 3. **不碰运行时**。这里只读磁盘、只写备份文件；还原是另一个显式动作，
 *    并且默认 dry-run —— 记忆这种东西，误覆盖比漏备份危险得多。
 *
 * 与 `.dshpack` 的区别：`.dshpack` 是 feiyu 引擎自己的档案导出，只含
 * diary/relationship/lexicon/persona；本模块是「跨设备搬家」的全量快照。
 */

import { readdirSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { DIARY_MD, FEELINGS_MD } from "./files.mjs";
import { HANDNOTE_FILE } from "./handnote.mjs";
import { SHALLOW_FILE } from "./shallow.mjs";

/** 备份文件的格式标签，写在 `backup.meta.format` 里。 */
export const BACKUP_FORMAT = "dsh-hierarchical-fishmemory/backup";
/** 格式版本。改结构就加一，还原时据此判断兼容性。 */
export const BACKUP_VERSION = 1;

const DAY_MS = 24 * 60 * 60 * 1000;

const readTextDefault = (file) => {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
};

const readJsonDefault = (file) => {
  const text = readTextDefault(file);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const pad = (n) => String(n).padStart(2, "0");

/** `备份-2026-10-31-1530.json` 这种文件名，按他的钟点？不 —— 用 UTC，和日志一致。 */
export function backupFileName(now = new Date()) {
  return `备份-${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}.json`;
}

/** `diary/` 下的 jsonl 文件名（排好序）。 */
export function listDiaryFiles(diaryDir, { readdir = readdirSync } = {}) {
  try {
    return readdir(join(diaryDir, "diary"))
      .filter((name) => name.toLowerCase().endsWith(".jsonl"))
      .sort();
  } catch {
    return [];
  }
}

/**
 * 收集一份完整备份。
 *
 * @param {object} options
 * @param {object} options.memoryLayout  soul 那边的 memory-layout 实例（只用 readLayeredScope / coreFile / topicFile）
 * @param {string[]} [options.scopes]    要备份的记忆 scope，通常 `[卡片名, "global"]`
 * @param {object} [options.cards]       人设卡 `{ 名字: markdown }`
 * @param {string|null} [options.active] 默认激活的卡片名
 * @param {string} [options.diaryDir]    共度时光的数据目录（`日记.md`、`手记.md`、`shallow.json` 都在这）
 * @param {string} [options.pluginVersion]
 * @param {Date} [options.now]
 * @param {Function} [options.readText]  可注入（测试用）
 */
export function collectBackup(options = {}) {
  const {
    memoryLayout,
    scopes = [],
    cards = {},
    active = null,
    diaryDir = "",
    pluginVersion = "",
    now = new Date(),
    readText = readTextDefault,
  } = options;

  const deep = {};
  const scopeList = [...new Set(scopes.filter((s) => typeof s === "string" && s))];
  for (const scope of scopeList) {
    const value = memoryLayout?.readLayeredScope
      ? memoryLayout.readLayeredScope(scope)
      : { exists: false, text: "", topics: [] };
    const topics = {};
    for (const topic of value.topics ?? []) {
      // readLayeredScope 的 topics 只带描述，不带正文 —— 正文单独读。
      const text = readText(topic.file);
      if (text !== null) topics[topic.key] = text;
    }
    deep[scope] = { core: value.text ?? "", topics };
  }

  const diaryJsonl = {};
  for (const name of listDiaryFiles(diaryDir)) {
    const text = readText(join(diaryDir, "diary", name));
    if (text !== null) diaryJsonl[name] = text;
  }

  const shallowRaw = diaryDir ? readJsonDefault(join(diaryDir, SHALLOW_FILE)) : null;

  return {
    meta: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: now.toISOString(),
      pluginVersion: String(pluginVersion ?? ""),
      // 只记来源路径的**末段**，换设备后路径必然不同，写全了反而误导
      source: {
        memoryScopes: scopeList,
        diaryDir: diaryDir ? basename(diaryDir) : "",
      },
      counts: null, // 下面填，保持字段顺序稳定
    },
    persona: {
      active: active ?? null,
      cards: { ...cards },
    },
    deep,
    diary: {
      jsonl: diaryJsonl,
      rendered: diaryDir ? readText(join(diaryDir, DIARY_MD)) ?? "" : "",
    },
    feelings: diaryDir ? readText(join(diaryDir, FEELINGS_MD)) ?? "" : "",
    handnote: diaryDir ? readText(join(diaryDir, HANDNOTE_FILE)) ?? "" : "",
    shallow: shallowRaw ?? { version: 1, entries: [], expired: [] },
    archive: {
      relationship: diaryDir ? readJsonDefault(join(diaryDir, "relationship.json")) : null,
      lexicon: diaryDir ? readJsonDefault(join(diaryDir, "lexicon.json")) : null,
      manifest: diaryDir ? readJsonDefault(join(diaryDir, "manifest.json")) : null,
    },
  };
}

/**
 * 收集器的注册表。
 *
 * 为什么要这个东西：备份要人设卡，而人设卡只在 soul 半边读得到；触发备份的
 * 却是 host 半边的面板路由。两个半边是同一个包的两个 cordis 入口，但**加载器
 * 给每个入口独立的模块实例** —— 模块级变量互相看不见（试过，注册表是空的）。
 * 所以挂在 `globalThis` 上：同一进程，谁先谁后都能拿到。
 */
const REGISTRY_KEY = Symbol.for("dsh.fishmemory.backupBuilders");

function builders() {
  const store = globalThis[REGISTRY_KEY];
  if (store instanceof Set) return store;
  const fresh = new Set();
  globalThis[REGISTRY_KEY] = fresh;
  return fresh;
}

/** @returns {() => void} 注销函数 */
export function registerBackupBuilder(build) {
  if (typeof build !== "function") throw new Error("registerBackupBuilder: 需要函数");
  const store = builders();
  store.add(build);
  return () => store.delete(build);
}

/** 跑第一个已注册的收集器；没有就抛。 */
export async function buildRegisteredBackup() {
  for (const build of builders()) return await build();
  throw new Error("备份能力未就绪：人设卡半边还没注册");
}

/**
 * 还原能力也走同一套「跨入口看不见模块变量」的注册表 —— 原因见上面。
 */
const RESTORERS_KEY = Symbol.for("dsh.fishmemory.restoreHandlers");

function restorers() {
  const store = globalThis[RESTORERS_KEY];
  if (store instanceof Set) return store;
  const fresh = new Set();
  globalThis[RESTORERS_KEY] = fresh;
  return fresh;
}

/** @returns {() => void} 注销函数 */
export function registerRestoreHandler(restore) {
  if (typeof restore !== "function") throw new Error("registerRestoreHandler: 需要函数");
  const store = restorers();
  store.add(restore);
  return () => store.delete(restore);
}

/** 面板上传备份时走这条路；没人注册就抛，让面板回 503。 */
export async function restoreViaRegistered({ text, confirm, sourceLabel, mode } = {}) {
  for (const restore of restorers()) return await restore({ text, confirm, sourceLabel, mode });
  throw new Error("还原能力未就绪：人设卡半边还没注册");
}

/** 给人和给面板看的一行摘要。 */
export function summarizeBackup(backup) {
  const entries = backup?.shallow?.entries ?? [];
  const now = Date.now();
  const live = entries.filter((entry) => {
    const ttl = Number.isFinite(entry?.ttlDays) ? entry.ttlDays : 7;
    const base = Number.isFinite(entry?.updated) ? entry.updated : entry?.created;
    return Number.isFinite(base) ? base + ttl * DAY_MS > now : true;
  }).length;
  return {
    cards: Object.keys(backup?.persona?.cards ?? {}).length,
    memoryScopes: Object.keys(backup?.deep ?? {}).length,
    topics: Object.values(backup?.deep ?? {}).reduce((n, scope) => n + Object.keys(scope?.topics ?? {}).length, 0),
    diaryFiles: Object.keys(backup?.diary?.jsonl ?? {}).length,
    diaryEntries: Object.values(backup?.diary?.jsonl ?? {}).reduce((n, text) => n + String(text ?? "").split(/\r?\n/).filter((line) => line.trim()).length, 0),
    feelingsChars: String(backup?.feelings ?? "").length,
    handnoteLines: String(backup?.handnote ?? "").split(/\r?\n/).filter((line) => /^\s*-\s+/.test(line)).length,
    shallowLive: live,
  };
}

/** 把备份对象写成文件，返回绝对路径。 */
export async function writeBackupFile(backup, dir, { fileName } = {}) {
  await mkdir(dir, { recursive: true });
  const file = join(dir, fileName ?? backupFileName());
  const text = `${JSON.stringify(backup, null, 2)}\n`;
  await writeFile(file, text, { mode: 0o600 });
  return { file, bytes: Buffer.byteLength(text, "utf8") };
}

/** 解析并做最小校验；不合法就抛错，别让半份数据进来。 */
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`备份文件不是合法 JSON：${error instanceof Error ? error.message : String(error)}`);
  }
  if (!data || typeof data !== "object") throw new Error("备份文件内容不是对象");
  if (data.meta?.format !== BACKUP_FORMAT) {
    throw new Error(`不是本插件的备份（meta.format=${String(data.meta?.format ?? "缺失")}）`);
  }
  if (!Number.isFinite(data.meta?.version) || data.meta.version > BACKUP_VERSION) {
    throw new Error(`备份格式版本 ${String(data.meta?.version)} 比本插件支持的 ${BACKUP_VERSION} 新，先升级插件`);
  }
  return data;
}

/**
 * 还原计划：只算出「哪个文件写什么」，不动磁盘。
 *
 * 这是还原的安全边界 —— 调用方可以先 dry-run 打印，再决定要不要落盘。
 */
export function planRestore(backup, { memoryLayout, diaryDir, mode = "replace", local = {} } = {}) {
  const merge = mode === "merge";
  const writes = [];
  const skipped = [];
  const deep = backup?.deep ?? {};
  for (const [scope, value] of Object.entries(deep)) {
    if (merge) {
      skipped.push({ kind: "memory-core", scope, reason: "合并模式下深层记忆以本地为准" });
      continue;
    }
    if (memoryLayout) {
      writes.push({ kind: "memory-core", scope, file: memoryLayout.coreFile(scope), content: String(value?.core ?? "") });
      for (const [topic, text] of Object.entries(value?.topics ?? {})) {
        writes.push({ kind: "memory-topic", scope, topic, file: memoryLayout.topicFile(scope, topic), content: String(text ?? "") });
      }
    }
  }
  let diaryReport = null;
  if (merge) {
    const incoming = [];
    for (const text of Object.values(backup?.diary?.jsonl ?? {})) {
      for (const line of String(text ?? "").split("\n")) {
        const t = line.trim();
        if (t === "") continue;
        try { incoming.push(JSON.parse(t)); } catch { /* 坏行忽略 */ }
      }
    }
    const result = mergeDiaryEntries(local?.diaryEntries ?? [], incoming);
    diaryReport = { added: result.added.length, conflicts: result.conflicts.length };
    const byMonth = new Map();
    for (const entry of result.merged) {
      const key = String(entry?.id ?? "").slice(2, 8) || "unknown";
      const name = `${key.slice(0, 4)}-${key.slice(4, 6)}.jsonl`;
      if (!byMonth.has(name)) byMonth.set(name, []);
      byMonth.get(name).push(entry);
    }
    for (const [name, entries] of byMonth) {
      const content = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
      writes.push({ kind: "diary", file: join(diaryDir, "diary", name), content });
    }
  } else {
    for (const [name, text] of Object.entries(backup?.diary?.jsonl ?? {})) {
      writes.push({ kind: "diary", file: join(diaryDir, "diary", name), content: String(text ?? "") });
    }
  }
  if (!merge && typeof backup?.feelings === "string" && backup.feelings !== "") {
    writes.push({ kind: "feelings", file: join(diaryDir, FEELINGS_MD), content: backup.feelings });
  }
  if (merge) skipped.push({ kind: "feelings", reason: "合并模式下情感日记以本地为准" });
  if (!merge && typeof backup?.handnote === "string" && backup.handnote !== "") {
    writes.push({ kind: "handnote", file: join(diaryDir, HANDNOTE_FILE), content: backup.handnote });
  }
  if (merge) skipped.push({ kind: "handnote", reason: "合并模式下人格手记以本地为准" });
  if (backup?.shallow && Array.isArray(backup.shallow.entries)) {
    const entries = merge
      ? mergeShallowEntries(local?.shallowEntries ?? [], backup.shallow.entries)
      : backup.shallow.entries;
    writes.push({ kind: "shallow", file: join(diaryDir, SHALLOW_FILE), content: `${JSON.stringify({ ...backup.shallow, entries }, null, 2)}\n` });
  }
  if (backup?.archive?.relationship) {
    writes.push({ kind: "relationship", file: join(diaryDir, "relationship.json"), content: `${JSON.stringify(backup.archive.relationship, null, 2)}\n` });
  }
  if (backup?.archive?.lexicon) {
    writes.push({ kind: "lexicon", file: join(diaryDir, "lexicon.json"), content: `${JSON.stringify(backup.archive.lexicon, null, 2)}\n` });
  }
  return {
    writes,
    cards: { ...(backup?.persona?.cards ?? {}) },
    active: backup?.persona?.active ?? null,
    mode,
    skipped,
    diary: diaryReport,
  };
}

/**
 * 按 id 合并两组日记：**本地优先**。
 *
 * 整包覆盖是"换设备搬家"；合并是"两台机器各写一半，想拼起来"。
 * 同 id 但正文不同时保留本地那份 —— 本地是我手上正在用的，先别动它；
 * 备份里那份还留在备份文件里，真要比对再手动看。
 */
export function mergeDiaryEntries(localEntries, incomingEntries) {
  const byId = new Map();
  for (const e of localEntries ?? []) {
    if (e?.id) byId.set(String(e.id), e);
  }
  const added = [];
  const conflicts = [];
  for (const e of incomingEntries ?? []) {
    if (!e?.id) continue;
    const id = String(e.id);
    const cur = byId.get(id);
    if (cur === undefined) {
      byId.set(id, e);
      added.push(e);
      continue;
    }
    if (String(cur.text ?? "") !== String(e.text ?? "")) conflicts.push({ id, kept: "local" });
  }
  const merged = [...byId.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return { merged, added, conflicts };
}

/** 浅层按 key 合并，同 key 保留 updated 更新的那份、hits 取大。 */
export function mergeShallowEntries(localEntries, incomingEntries) {
  const byKey = new Map();
  const put = (e) => {
    if (!e?.key) return;
    const cur = byKey.get(e.key);
    if (cur === undefined) { byKey.set(e.key, e); return; }
    const newer = (e.updated ?? 0) > (cur.updated ?? 0) ? e : cur;
    byKey.set(e.key, { ...newer, hits: Math.max(cur.hits ?? 0, e.hits ?? 0) });
  };
  for (const e of localEntries ?? []) put(e);
  for (const e of incomingEntries ?? []) put(e);
  return [...byKey.values()];
}

/** 执行还原（不做 dry-run 判断，由调用方决定）。 */
export async function applyRestore(plan, { writeFileImpl = writeFile, mkdirImpl = mkdir } = {}) {
  const written = [];
  for (const item of plan.writes ?? []) {
    if (typeof item.content !== "string") continue;
    await mkdirImpl(dirname(item.file), { recursive: true });
    await writeFileImpl(item.file, item.content, { mode: 0o600 });
    written.push({ kind: item.kind, file: item.file, bytes: Buffer.byteLength(item.content, "utf8") });
  }
  return written;
}

