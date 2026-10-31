import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  applyRestore,
  backupFileName,
  collectBackup,
  listDiaryFiles,
  parseBackup,
  planRestore,
  summarizeBackup,
} from "../src/core/backup.mjs";

const tempDir = () => mkdtempSync(join(tmpdir(), "fish-backup-"));

/** 读不到就返回 null —— 和模块内部默认读法一致。 */
const readOr = (file) => {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
};

/** 造一个假的 memory-layout：只实现备份会用到的三个方法。 */
function stubLayout(root) {
  const scopeDir = (scope) => join(root, scope);
  return {
    coreFile: (scope) => join(scopeDir(scope), "core.md"),
    topicFile: (scope, key) => join(scopeDir(scope), "topics", `${key}.md`),
    readLayeredScope: (scope) => ({
      exists: true,
      text: `core of ${scope}`,
      source: "layered",
      file: join(scopeDir(scope), "core.md"),
      topics: [{ key: "env-ops", title: "环境运维", summary: "x", file: join(scopeDir(scope), "topics", "env-ops.md") }],
      index: "",
      inheritedLegacy: false,
    }),
  };
}

function seedDiary() {
  const dir = tempDir();
  mkdirSync(join(dir, "diary"), { recursive: true });
  writeFileSync(join(dir, "diary", "2026-10.jsonl"), '{"id":"a","text":"第一件事"}\n{"id":"b","text":"第二件事"}\n');
  writeFileSync(join(dir, "鱼的日子.md"), "# 鱼的日子\n\n## 我在意和喜欢的\n\n- 白饭\n");
  writeFileSync(join(dir, "手记.md"), "# 手记\n\n- 傲娇是壳\n- 记不清就说记不清\n");
  writeFileSync(join(dir, "shallow.json"), JSON.stringify({ version: 1, entries: [{ key: "白饭", text: "爱吃白饭", created: Date.now(), updated: Date.now() }], expired: [] }));
  writeFileSync(join(dir, "relationship.json"), JSON.stringify({ familiarity: 0.19 }));
  writeFileSync(join(dir, "lexicon.json"), JSON.stringify({ items: [] }));
  writeFileSync(join(dir, "manifest.json"), JSON.stringify({ diary_count: 2 }));
  writeFileSync(join(dir, "日记.md"), "（人看的窗口）\n");
  return dir;
}

test("backupFileName 是 UTC 时间戳命名", () => {
  const name = backupFileName(new Date(Date.UTC(2026, 9, 31, 7, 5, 9)));
  assert.equal(name, "备份-20261031-070509.json");
});

test("collectBackup 收齐四本账 + 人设卡", () => {
  const root = tempDir();
  const diaryDir = seedDiary();
  const layout = stubLayout(root);
  const backup = collectBackup({
    memoryLayout: layout,
    scopes: ["默认人设", "global"],
    cards: { 默认人设: "你是某个助手" },
    active: "默认人设",
    diaryDir,
    pluginVersion: "5.0.0",
    readText: (file) => (file.endsWith("env-ops.md") ? "环境运维正文" : readOr(file)),
  });

  assert.equal(backup.meta.format, BACKUP_FORMAT);
  assert.equal(backup.meta.version, BACKUP_VERSION);
  assert.equal(backup.meta.pluginVersion, "5.0.0");
  assert.deepEqual(backup.meta.source.memoryScopes, ["默认人设", "global"]);
  assert.equal(backup.persona.active, "默认人设");
  assert.equal(backup.persona.cards["默认人设"], "你是某个助手");
  assert.equal(backup.deep["默认人设"].core, "core of 默认人设");
  assert.equal(backup.deep["默认人设"].topics["env-ops"], "环境运维正文");
  assert.deepEqual(Object.keys(backup.diary.jsonl), ["2026-10.jsonl"]);
  assert.match(backup.feelings, /白饭/);
  assert.equal(backup.handnote.split("\n").filter((l) => /^- /.test(l)).length, 2);
  assert.equal(backup.shallow.entries[0].key, "白饭");
  assert.equal(backup.archive.relationship.familiarity, 0.19);
});

test("collectBackup 对缺目录不炸", () => {
  const backup = collectBackup({ memoryLayout: stubLayout(tempDir()), scopes: ["x"], diaryDir: join(tempDir(), "nope") });
  assert.equal(backup.deep.x.core, "core of x");
  assert.deepEqual(backup.diary.jsonl, {});
  assert.equal(backup.feelings, "");
  assert.deepEqual(backup.shallow.entries, []);
});

test("summarizeBackup 数得清", () => {
  const diaryDir = seedDiary();
  const root = tempDir();
  mkdirSync(join(root, "a", "topics"), { recursive: true });
  writeFileSync(join(root, "a", "topics", "env-ops.md"), "主题正文\n");
  const backup = collectBackup({ memoryLayout: stubLayout(root), scopes: ["a"], diaryDir, readText: readOr });
  const counts = summarizeBackup(backup);
  assert.equal(counts.cards, 0);
  assert.equal(counts.memoryScopes, 1);
  assert.equal(counts.topics, 1);
  assert.equal(counts.diaryFiles, 1);
  assert.equal(counts.diaryEntries, 2);
  assert.equal(counts.shallowLive, 1);
  assert.equal(counts.handnoteLines, 2);
});

test("parseBackup 只认自家格式与旧版本", () => {
  const good = JSON.stringify({ meta: { format: BACKUP_FORMAT, version: BACKUP_VERSION } });
  assert.equal(parseBackup(good).meta.version, BACKUP_VERSION);

  assert.throws(() => parseBackup("{"), /不是合法 JSON/);
  assert.throws(() => parseBackup(JSON.stringify({ meta: {} })), /不是本插件的备份/);
  assert.throws(() => parseBackup(JSON.stringify({ meta: { format: BACKUP_FORMAT, version: BACKUP_VERSION + 1 } })), /比本插件支持的/);
});

test("planRestore 只算不写，applyRestore 才落盘", async () => {
  const root = tempDir();
  const diaryDir = seedDiary();
  const layout = stubLayout(root);
  const backup = collectBackup({
    memoryLayout: layout,
    scopes: ["默认人设"],
    cards: { 默认人设: "卡" },
    active: "默认人设",
    diaryDir,
    readText: (file) => (file.endsWith("env-ops.md") ? "主题正文" : readOr(file)),
  });

  const target = tempDir();
  const targetLayout = stubLayout(target);
  const plan = planRestore(backup, { memoryLayout: targetLayout, diaryDir: target });

  const kinds = plan.writes.map((w) => w.kind).sort();
  assert.deepEqual(kinds, ["diary", "feelings", "handnote", "memory-core", "memory-topic", "relationship", "shallow", "lexicon"].sort());
  assert.equal(plan.cards["默认人设"], "卡");
  // 还没写：目标目录仍空
  assert.deepEqual(listDiaryFiles(target), []);

  const written = await applyRestore(plan);
  assert.equal(written.length, plan.writes.length);
  assert.equal(readFileSync(targetLayout.coreFile("默认人设"), "utf8"), "core of 默认人设");
  assert.equal(readFileSync(targetLayout.topicFile("默认人设", "env-ops"), "utf8"), "主题正文");
  assert.deepEqual(listDiaryFiles(target), ["2026-10.jsonl"]);
  assert.match(readFileSync(join(target, "鱼的日子.md"), "utf8"), /白饭/);
  assert.equal(JSON.parse(readFileSync(join(target, "shallow.json"), "utf8")).entries[0].key, "白饭");
});
