/**
 * 记忆体检 + 回顾：把四本账摊开看。
 *
 * 为什么要有这个模块：这个系统最怕的不是记不住，是「静默丢东西」——
 * 浅层满 12 条挤掉最旧的、手记单行超 240 字被截断、topic 摘要被切、
 * 深层记忆和人格手记写重了每轮注入两遍。这些都不会报错，只能靠人翻。
 *
 * 所以这里只做两件事：把数量与体积算清楚（collectStats），以及按时间
 * 把共度时光捞出来看（collectReview）。不写盘、不改数据。
 */

import { basename, join } from "node:path";
import { readdirSync } from "node:fs";
import { FEELINGS_MD } from "./files.mjs";
import { HANDNOTE_FILE, MAX_LINE_CHARS, parseHandNote } from "./handnote.mjs";
import { listDiaryPaths, readJsonOrNull, readTextOrNull } from "./fsx.mjs";
import { SHALLOW_FILE } from "./shallow.mjs";
import { STICKY_FILE } from "./sticky.mjs";
import { LESSON_FILE } from "./lesson.mjs";
import { findDuplicates, findValueConflicts } from "./conflicts.mjs";
import { estimateTokens } from "./tokenize.mjs";
import { pendingPath, readPending } from "./pending.mjs";

const DAY_MS = 24 * 60 * 60 * 1000;
const readTextDefault = readTextOrNull;
const readJsonDefault = readJsonOrNull;

// 估算只有一套：直接借 tokenize.mjs 那份（CJK 1 字/token、拉丁 3.5 字符/token），
// 否则体检页的数字和注入日志里的 token 数会对不上。

export function listDiaryFiles(diaryDir, options = {}) {
  return listDiaryPaths(diaryDir, options);
}

/** 一行一条 JSON，坏行跳过 —— 归档文件被手动改过也不能让整页挂掉。 */
export function parseDiaryLines(text) {
  const entries = [];
  for (const line of String(text ?? "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") entries.push(parsed);
    } catch {
      // 坏行忽略
    }
  }
  return entries;
}

/** 读全部日记条目（按时间升序）。 */
export function readDiaryEntries(diaryDir, { readText = readTextDefault } = {}) {
  const entries = [];
  for (const file of listDiaryFiles(diaryDir)) {
    const text = readText(file);
    if (!text) continue;
    for (const entry of parseDiaryLines(text)) {
      entries.push({ ...entry, _file: basename(file) });
    }
  }
  // 老条目没有 `at`，只有 `date`（YYYY-MM-DD）；两个都认。
  return entries.sort((a, b) =>
    String(a.at ?? a.date ?? "").localeCompare(String(b.at ?? b.date ?? "")),
  );
}

const dayKeyOf = (iso) => String(iso ?? "").slice(0, 10);
const entryTime = (entry) => String(entry?.at ?? entry?.date ?? "");

/**
 * 四本账体检。
 *
 * @returns {{
 *   generatedAt:string,
 *   memory:{scopes:{scope:string,coreChars:number,topics:{key:string,title:string,chars:number}[],totalChars:number}[],
 *           duplicateHints:{scope:string,line:string,reason:string}[]},
 *   diary:{files:number,entries:number,last7Days:number,oldest:string,newest:string},
 *   feelings:{chars:number,lines:number},
 *   handnote:{lines:number,chars:number,longest:number,truncated:number},
 *   shallow:{live:number,expiring:number,expired:number},
 *   estimate:{injectedTokens:number,note:string}
 * }}
 */
/**
 * 不依赖 soul 半边的版本：直接扫磁盘上的记忆目录。
 *
 * 为什么要两套：`collectStats` 用 memoryLayout（写得准，但要拿到 soul 的实例），
 * 而体检路由在 host 半边 —— 两个 cordis 入口的模块实例不共享，所以这里
 * 直接按目录结构读，够用且不跨半边。
 *
 * @param {{memoryRoot:string, diaryDir:string, readText?:Function, readdir?:Function}} options
 */
export function collectStatsFromDisk(options = {}) {
  const { memoryRoot, diaryDir, readText = readTextDefault, readdir = readdirSync } = options;
  const scopes = [];
  let scopeNames = [];
  try {
    scopeNames = readdir(memoryRoot, { withFileTypes: true })
      .filter((item) => item.isDirectory())
      .map((item) => item.name)
      .sort();
  } catch {
    scopeNames = [];
  }
  for (const scope of scopeNames) {
    const dir = join(memoryRoot, scope);
    const core = String(readText(join(dir, "core.md")) ?? readText(join(memoryRoot, `${scope}.md`)) ?? "");
    let topics = [];
    try {
      topics = readdir(join(dir, "topics"))
        .filter((name) => name.endsWith(".md"))
        .sort()
        .map((name) => {
          const key = name.replace(/\.md$/, "");
          const text = String(readText(join(dir, "topics", name)) ?? "");
          return { key, title: key, chars: text.length, tokens: estimateTokens(text) };
        });
    } catch {
      topics = [];
    }
    if (!core && !topics.length) continue;
    const coreChars = core.length;
    scopes.push({
      scope,
      coreChars,
      coreTokens: estimateTokens(core),
      topics,
      totalChars: coreChars + topics.reduce((sum, topic) => sum + topic.chars, 0),
    });
  }

  const layoutShim = {
    readLayeredScope(scope) {
      const found = scopes.find((item) => item.scope === scope);
      if (!found) return { exists: false, text: "" };
      const dir = join(memoryRoot, scope);
      const text = String(readText(join(dir, "core.md")) ?? readText(join(memoryRoot, `${scope}.md`)) ?? "");
      return {
        exists: true,
        text,
        topics: found.topics.map((topic) => ({ ...topic, file: join(dir, "topics", `${topic.key}.md`) })),
      };
    },
  };

  return collectStats({
    memoryLayout: layoutShim,
    scopes: scopes.map((item) => item.scope),
    diaryDir,
    readText,
  });
}

export function collectStats(options = {}) {
  const { memoryLayout, scopes = [], diaryDir, readText = readTextDefault } = options;

  const memoryScopes = [];
  let injectedText = "";
  for (const scope of scopes) {
    let info = null;
    try {
      info = memoryLayout?.readLayeredScope?.(scope) ?? null;
    } catch {
      info = null;
    }
    if (!info || !info.exists) continue;
    const coreText = String(info.text ?? "");
    injectedText += `${coreText}\n`;
    const coreChars = coreText.length;
    const topics = (info.topics ?? []).map((topic) => {
      let text = "";
      try {
        text = String(readText(topic.file) ?? "");
      } catch {
        text = "";
      }
      return { key: topic.key, title: topic.title ?? topic.key, chars: text.length, tokens: estimateTokens(text) };
    });
    memoryScopes.push({
      scope,
      coreChars,
      coreTokens: estimateTokens(coreText),
      topics,
      totalChars: coreChars + topics.reduce((sum, t) => sum + t.chars, 0),
    });
  }

  const entries = readDiaryEntries(diaryDir, { readText });
  const now = Date.now();
  const last7 = entries.filter((entry) => {
    const raw = entryTime(entry);
    // 只有日期的条目按当天 00:00 UTC 算，免得整天都算不到「最近七天」。
    const at = Date.parse(raw.length === 10 ? `${raw}T00:00:00Z` : raw);
    return Number.isFinite(at) && now - at <= 7 * DAY_MS;
  }).length;

  const feelingsText = String(readText(join(diaryDir, FEELINGS_MD)) ?? "");
  const handnoteText = String(readText(join(diaryDir, HANDNOTE_FILE)) ?? "");
  const handnoteLines = parseHandNote(handnoteText);

  const shallow = readJsonDefault(join(diaryDir, SHALLOW_FILE)) ?? {};
  const live = Array.isArray(shallow.entries) ? shallow.entries : [];
  const expiring = live.filter((entry) => {
    const ttl = Number(entry.ttlDays) > 0 ? Number(entry.ttlDays) : 7;
    const age = (now - Number(entry.updated ?? 0)) / DAY_MS;
    return ttl - age <= 2;
  }).length;

  // 重复提示：手记里那句如果整句出现在 core 里，就是每轮注入两遍。
  const duplicateHints = [];
  for (const item of memoryScopes) {
    let core = "";
    try {
      core = String(memoryLayout?.readLayeredScope?.(item.scope)?.text ?? "");
    } catch {
      core = "";
    }
    for (const line of handnoteLines) {
      const needle = String(line).trim();
      if (needle.length >= 12 && core.includes(needle)) {
        duplicateHints.push({ scope: item.scope, line: needle, reason: "这句在深层记忆里已经有了" });
      }
    }
  }

  // 注入的那一坨：各 scope 的 core + 人格手记全文。用同一套估算算它。
  injectedText += handnoteText;

  return {
    generatedAt: new Date().toISOString(),
    memory: { scopes: memoryScopes, duplicateHints },
    diary: {
      files: listDiaryFiles(diaryDir).length,
      entries: entries.length,
      last7Days: last7,
      oldest: entryTime(entries[0]),
      newest: entryTime(entries.at(-1)),
    },
    feelings: { chars: feelingsText.length, lines: feelingsText.split("\n").length },
    handnote: {
      lines: handnoteLines.length,
      chars: handnoteText.length,
      longest: handnoteLines.reduce((max, line) => Math.max(max, String(line).length), 0),
      truncated: handnoteLines.filter((line) => String(line).length >= MAX_LINE_CHARS).length,
    },
    shallow: {
      live: live.length,
      expiring,
      expired: Array.isArray(shallow.expired) ? shallow.expired.length : 0,
    },
    estimate: {
      injectedTokens: estimateTokens(injectedText),
      note: "与注入预算同一套估算（CJK 1 字/token），含核心记忆与人格手记（不含共度时光的按需注入）",
    },
  };
}

/**
 * 回顾：把共度时光按天分组，给出「最近 N 天」和「X 天前的今天」。
 *
 * @param {{days?:number, lookback?:number}} options
 */
export function collectReview(options = {}) {
  const { diaryDir, days = 7, lookback = 7, readText = readTextDefault } = options;
  const entries = readDiaryEntries(diaryDir, { readText });
  const byDay = new Map();
  for (const entry of entries) {
    const key = dayKeyOf(entryTime(entry));
    if (!key) continue;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(entry);
  }

  const today = dayKeyOf(new Date().toISOString());
  const recent = [];
  for (let i = 0; i < days; i += 1) {
    const key = dayKeyOf(new Date(Date.now() - i * DAY_MS).toISOString());
    const list = byDay.get(key) ?? [];
    if (list.length) recent.push({ date: key, entries: list });
  }

  const lookbackKey = dayKeyOf(new Date(Date.now() - lookback * DAY_MS).toISOString());
  const sameDayLastTime = { date: lookbackKey, entries: byDay.get(lookbackKey) ?? [] };

  return {
    generatedAt: new Date().toISOString(),
    today,
    total: entries.length,
    recent,
    lookback: sameDayLastTime,
  };
}

/**
 * 层间体检的「可操作版」：跟 checkLayers 算的是同一件事，但每条都带上
 * 这一层对应的**文件目标**（`core:<scope>` / `topic:<scope>:<key>` /
 * `handnote` / `feelings`），好让面板上的按钮知道该改哪个文件。
 *
 * 只读不写。写盘的活儿在 host 的 `/layer/value` 路由里。
 */
export function collectLayerReport(options = {}) {
  const { memoryRoot, diaryDir, readText = readTextDefault, readdir = readdirSync } = options;
  const layers = [];
  const push = (name, target, text) => {
    const lines = String(text ?? '').split("\n").filter((l) => l.trim() !== "");
    if (lines.length) layers.push({ name, target, lines });
  };
  let scopeNames = [];
  try {
    scopeNames = readdir(memoryRoot, { withFileTypes: true })
      .filter((item) => item.isDirectory())
      .map((item) => item.name)
      .sort();
  } catch {
    scopeNames = [];
  }
  for (const scope of scopeNames) {
    const dir = join(memoryRoot, scope);
    push(`深层 ${scope}`, `core:${scope}`, readText(join(dir, "core.md")));
    let names = [];
    try {
      names = readdir(join(dir, "topics")).filter((name) => name.endsWith(".md")).sort();
    } catch {
      names = [];
    }
    for (const name of names) {
      const key = name.replace(/\.md$/, "");
      push(`深层 ${scope}/${key}`, `topic:${scope}:${key}`, readText(join(dir, "topics", name)));
    }
  }
  push("人格手记", "handnote", readText(join(diaryDir, HANDNOTE_FILE)));
  push("小纸条", "sticky", readText(join(diaryDir, STICKY_FILE)));
  push("教训", "lesson", readText(join(diaryDir, LESSON_FILE)));
  // 待重试队列：**积压了要看得见**。
  //
  // 2026-11-10 加。这队列是"暂时没写进去"的东西，正常应该一条两条就清掉；
  // 要是攒到十几条，说明模型一直在把 JSON 写歪 —— 那是提示词的问题，
  // 得有人看见才知道。放在体检页上，比埋在日志第 2043 行强。
  try {
    const waiting = readPending(pendingPath(diaryDir));
    if (waiting.length > 0) {
      push(
        `待重试（${waiting.length} 条）`,
        "pending",
        waiting.map((w) => `- ${w.reason || "格式不合格"}（试过 ${w.tries ?? 0} 次）`).join("\n"),
      );
    }
  } catch {
    /* 队列坏了不影响体检 */
  }
  push("情感日记", "feelings", readText(join(diaryDir, FEELINGS_MD)));
  try {
    const store = JSON.parse(String(readText(join(diaryDir, SHALLOW_FILE)) ?? "{}") || "{}");
    for (const entry of store.entries ?? []) {
      push(`浅层 ${entry?.key ?? ""}`.trim(), `shallow:${entry?.key ?? ""}`, entry?.text ?? "");
    }
  } catch {
    /* 浅层读不出来就不参与体检 */
  }
  const targetOf = (name) => layers.find((l) => l.name === name)?.target ?? "";
  const duplicates = findDuplicates(layers).map((d) => ({
    ...d,
    firstTarget: targetOf(d.first),
    againTarget: targetOf(d.again),
  }));
  // 冲突只报「同一个文件里自己跟自己打架」的 —— 比如 core.md 一处写端口
  // 3080、另一处写 3095。不同文件各写各的版本号（插件 v1.6.0、DSH v1.5.1）
  // 是正常现象，一律报出来只会变成噪音，那就没人看了。
  const conflicts = findValueConflicts(layers)
    .map((c) => ({
      ...c,
      lines: c.lines.map((line) => ({ ...line, target: targetOf(line.layer) })),
    }))
    .map((c) => {
      const byTarget = new Map();
      for (const line of c.lines) {
        if (!byTarget.has(line.target)) byTarget.set(line.target, []);
        byTarget.get(line.target).push(line);
      }
      const real = [...byTarget.entries()].filter(
        ([, list]) => new Set(list.map((l) => l.value)).size > 1,
      );
      if (!real.length) return null;
      return { ...c, lines: real.flatMap(([, list]) => list) };
    })
    .filter(Boolean);
  return { duplicates, conflicts };
}
