/**
 * 属于我们的回忆（dsh-hierarchical-fishmemory） · Host 半边
 *
 * 让新开一个对话，用户依然感觉是同一条鱼。
 *
 * ── 这一版（v0.1）的范围 ──
 * 只有 Host 半边，没有 `dsh.client`。理由见 SPEC §13 / 速查表 D.3：
 * 客户端 dynamic runner 的 React 取用语法尚未对着活动客户端验证，
 * 不把没验证过的东西发出去。界面在 v0.2。
 *
 * ── 三条不可破的工程约束 ──
 *  1. **永远不能挡住聊天。** 所有事件回调与注入函数都包 try/catch，
 *     出任何问题都只降级成"这次没记住"，绝不向上抛。
 *  2. **`agent/turn-stopping` 是 serial 事件，会被 await。**
 *     所以那里只做本地判断（微秒级）并立刻返回，
 *     模型调用一律丢到带外队列，不阻塞回合关闭。
 *  3. **不 append 任何新的 session 事件类型**（官方 practices 明令）。
 *     我们的状态存在自己的档案文件里。
 */

import { readFile, writeFile, mkdir, rename, readdir, rm } from 'node:fs/promises';
import { appendFileSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import path from 'node:path';

import {
  SCHEMA_VERSION,
  archiveToFiles,
  archiveFromFiles,
  createEmptyArchive,
  packArchive,
  unpackArchive,
  mergeArchives,
  ensurePersonaStructure,
  DIARY_DIR,
  PERSONA_FILE,
  MANIFEST_FILE,
} from '../core/archive.mjs';
// 原来的 evaluateGate 那套关键词闸门拆了（见 turn-stopping 里的注释）。
// SUPPRESS_RE 留着 —— "别记"是用户的控制，不是启发式。
import { SUPPRESS_RE } from '../core/gate.mjs';
import { buildIndex, selectMemories, searchScores, queryHasSubstance, looksLikeWork, parseTimeHint, DEFAULT_RECALL_OPTIONS } from '../core/recall.mjs';
import { scrub } from '../core/privacy.mjs';
import { renderMemoryBlock } from '../core/persona.mjs';
import { addLoop, doneLoop, loopsPath, openLoops, renderLoops } from '../core/loops.mjs';
import { renderLoopsAnnotated } from '../core/loops.mjs';
import { annotateLoops, buildMirror, renderMirror } from '../core/mirror.mjs';
import { datesPath, loadDates, upcoming, renderDates } from '../core/dates.mjs';
import { pickAnchors, renderAnchors } from '../core/anniversary.mjs';
import { parseFeelingDays, pickFlashback, renderFlashback, FLASHBACK_FILE } from '../core/flashback.mjs';
import { applyCompaction, planCompaction } from '../core/compact.mjs';
import { buildBook, buildYearBook } from '../core/export-md.mjs';
import { checkLayers } from '../core/conflicts.mjs';
import { TZ_OFFSET_MS, calendarDaysBetween, stripTimeWords, softWhen } from '../core/timeline.mjs';
import { readJsonOrNull } from '../core/fsx.mjs';
import { renderDiaryFile } from '../core/render-diary.mjs';
import { DIARY_MD, FEELINGS_MD } from '../core/files.mjs';
import { buildJudgeInput, parseVerdict, JUDGE_MAX_TOKENS } from '../core/judge.mjs';
import { selectHandNotes, HANDNOTE_FILE, HANDNOTE_TEMPLATE } from '../core/handnote.mjs';
import {
  buildConsolidationInput,
  parseConsolidation,
  applyConsolidation,
  decayArchive,
  ConsolidationParseError,
  DEFAULT_CONSOLIDATION,
  buildSummaryInput,
  parseSummaryResult,
  applySummaries,
} from '../core/consolidate.mjs';
import { resolveConfig, buildSchema, CONFIG_SPEC } from '../core/config.mjs';
import { registerShallow, SHALLOW_FILE } from '../core/shallow.mjs';
import {
  STICKY_FILE,
  STICKY_ARCHIVE_FILE,
  patchDid,
  recordTurn,
  registerSticky,
} from '../core/sticky.mjs';
import { summarizeBackup, writeBackupFile, backupFileName, buildRegisteredBackup, restoreViaRegistered } from '../core/backup.mjs';
import { collectLayerReport, collectReview, collectStatsFromDisk } from '../core/stats.mjs';
import {
  TRASH_FILE,
  DEFAULT_KEEP_DAYS,
  buildTrashRecord,
  appendTrashRecord,
  parseTrash,
  pruneTrash,
  serializeTrash,
  findTrashRecord,
  describeTrashRecord,
  daysLeft,
} from '../core/trash.mjs';
import { COLD_DIR, coldOnly, mergeColdFiles } from '../core/cold.mjs';
import { peekFeelings } from '../core/feelings.mjs';
import {
  downloadRemoteText,
  explainWebdavError,
  listRemoteBackups,
  listRemoteConfigs,
  normalizeWebdavConfig,
  pushBackupToCloud,
  testConnection,
  uploadBackupText,
} from '../core/webdav.mjs';

/** Cordis 插件身份。模块上只有这四个属性会被读取。 */
export const name = 'dsh-hierarchical-fishmemory';

/**
 * 硬依赖。缺任何一个，插件静默不激活 —— 这是刻意的：
 * 少一个记忆插件，不能影响用户聊天。
 */
export const inject = ['systemPrompt', 'agents', 'sessions', 'llm'];

/**
 * 找 schemastery。**多试几个基准**，不能只认 `import.meta.url`。
 *
 * 原因：pnpm 把包装进 `.pnpm/<pkg>@<ver>/node_modules/<pkg>/`，`import.meta.url`
 * 指向那个真实路径，而它外面的 node_modules 里**没有** `@deepseek-ai/schemastery`。
 * `link:` 安装更直接 —— 插件在 D 盘，schemastery 在 profile 里，隔了十万八千里。
 *
 * 实测：从 `D:\肥鱼日记` require 失败，从 `profile/` require 成功。
 */
function loadSchemastery() {
  const bases = [];
  // 1) 插件自己所在的位置（正常 npm 安装时这条就够了）
  try { bases.push(import.meta.url); } catch { /* 忽略 */ }
  // 2) DSH profile 目录 —— 桌面端的 cwd 通常就是它
  try { bases.push(path.join(process.cwd(), 'package.json')); } catch { /* 忽略 */ }
  // 3) **DSH 自己的安装目录** —— schemastery 真正的主人
  //
  // 端到端验出来的：临时 profile 里根本没装 schemastery，它是 DSH 的依赖。
  // 所以要从 dsh CLI 的位置往上找。
  try {
    const argv1 = process.argv[1];
    if (typeof argv1 === 'string' && argv1 !== '') {
      let dir = path.dirname(argv1);
      for (let i = 0; i < 8; i++) {
        bases.push(path.join(dir, 'package.json'));
        const next = path.dirname(dir);
        if (next === dir) break;
        dir = next;
      }
    }
  } catch { /* 忽略 */ }

  // 4) DSH_HOME 下面每个 profile
  try {
    const home = dshHome();
    const profiles = path.join(home, 'profiles');
    if (existsSync(profiles)) {
      for (const name of readdirSync(profiles)) {
        bases.push(path.join(profiles, name, 'package.json'));
      }
    }
    bases.push(path.join(home, 'package.json'));
  } catch { /* 忽略 */ }

  for (const base of bases) {
    try {
      const require = createRequire(base);
      const mod = require('@deepseek-ai/schemastery');
      const z = mod?.default ?? mod;
      if (z !== undefined && z !== null && typeof z.object === 'function') return z;
    } catch { /* 换下一个基准 */ }
  }
  return undefined;
}

/**
 * 没有 schemastery 时的兜底 schema。
 *
 * 关键只有一件事：**让 loader 知道这台插件有哪些字段**，于是它会把
 * `cordis.patch.yml` 里的 `config:` 原样传进来，而不是传一份空模板。
 *
 * 形状上模拟 schemastery 的最小子集：
 *   · 可调用 —— `Config(dict)` 返回补过默认值的普通对象
 *   · `.dict` —— 字段定义（有些界面代码会读它）
 *   · `.toString()` —— 给设置表单的展示用
 */
function buildPlainSchema() {
  const dict = {};
  for (const f of CONFIG_SPEC) {
    dict[f.key] = {
      type: f.type,
      description: typeof f.label === 'string' ? f.label : '',
      default: f.default,
      ...(Number.isFinite(f.min) ? { min: f.min } : {}),
      ...(Number.isFinite(f.max) ? { max: f.max } : {}),
    };
  }

  const schema = function (input) {
    return resolveConfig(input);
  };
  schema.dict = dict;
  // ⚠️ **cordis 会调 `.validate()`**，不是只调函数本身。
  //
  // 这条是端到端验出来的：我第一版只给了可调用 + .dict + .toString，
  // 一装进真 profile 就报
  //   TypeError: Cannot read properties of undefined (reading 'validate')
  //   at resolveConfig (cordis/lib/index.js:958)
  // 插件整个没激活。**单元测试碰不到这层 —— 这就是"必须真跑一遍"的理由。**
  schema.validate = (input) => resolveConfig(input);
  schema.meta = { description: '属于我们的回忆 · 配置' };
  schema.toString = () =>
    CONFIG_SPEC.map((f) => `${f.key}: ${f.type} = ${JSON.stringify(f.default)}`).join('\n');
  return schema;
}

/**
 * Config **是可选的**。
 *
 * 为什么不用静态 `import z from '@deepseek-ai/schemastery'`：
 * 那会让它在解析不到时直接抛错，**整个插件加载失败**。
 * 对于一个"装上就该忘掉它"的插件，这个失败模式不能接受。
 *
 * 所以这里用 createRequire 试探性地拿；拿不到就导出 `undefined`，
 * loader 会跳过校验。**所有选项照样能在 `cordis.patch.yml` 的 `config:` 里写**，
 * 由 `resolveConfig()` 自己补默认值 —— 行为与有没有 schema 完全一致。
 *
 * 代价：拿不到 schemastery 时，v0.2 的自动设置表单不会出现。
 */
export const Config = (() => {
  const z = loadSchemastery();
  if (z !== undefined) return buildSchema(z);

  // ⚠️ **拿不到 schemastery 时不能返回 undefined。**
  //
  // 原来这里直接吞掉并导出 undefined，注释里写着「loader 会跳过校验」。
  // **那条假设是错的** —— 社区报告实测：没有 Config 时 DSH 会传一份**空模板**
  // （每个字段都是 `{}`），于是 `resolveConfig` 全部回落默认，
  // **用户改的任何配置都不生效**。铁证是：`cordis.patch.yml` 里显式写
  // `config: { debugLog: true }`，传进来还是 `{}` —— 那不是插件没读，是 DSH 没传。
  //
  // 所以这里兜一个**纯 JS 的形状等价物**。它只需要满足 loader 对 Config 的
  // 两个用法：`Config(dict)` 做校验/补默认，以及 `Config.toString()` / `.dict`
  // 之类的展示。没有 schemastery 的链式 API，就手写一个最小的。
  return buildPlainSchema();
})();

/* ───────────────────────── 小工具 ───────────────────────── */

/** DSH 主目录。`$DSH_HOME` 优先，否则 `~/.dsh`（与 dsh-home-paths 行为一致） */
function dshHome() {
  const env = process.env.DSH_HOME;
  if (typeof env === 'string' && env.trim() !== '') return env.trim();
  return path.join(homedir(), '.dsh');
}

/**
 * 档案工作目录。
 *
 * **只在 `apply` 时算一次**，之后全程用这个值。
 * 不在每次读写时懒读 `$DSH_HOME` —— 那会带来一个隐蔽的 bug：
 * 环境变量中途变了（多实例、测试并发、用户改配置），
 * 档案就会写到另一个目录去，而且没有任何报错。
 */
export function resolveArchiveDir(config, home = dshHome()) {
  // ⚠️ **只认绝对路径的字符串。**
  //
  // 社区报的（DSH Desktop 0.2.1-rc.2）：某些情况下 config.dataDir 会是一个
  // 被字符串化的对象 —— 字面量 "[object Object]"。
  //
  //   typeof 检查 → 它是 string，放行
  //   path.resolve("[object Object]") → 以进程 CWD 为基准
  //   桌面端的 CWD = profiles\\desktop
  //   → 档案落进 profiles\\desktop\\[object Object]\\
  //
  // 后果比崩了还糟：插件一切正常，人格注入在跑、feiyu_note 能用，
  // 只是用户改 ~/.dsh/feiyu-diary/persona.md 完全无效 —— 而且全程无报错。
  //
  // 所以：不是绝对路径就回落到默认。相对路径本来也不该出现在配置里
  // （基准是进程 CWD，用户不可能预测它是什么）。
  const raw = config?.dataDir;
  const explicit = typeof raw === 'string' && path.isAbsolute(raw.trim()) ? raw.trim() : '';
  return explicit !== '' ? explicit : path.join(home, 'feiyu-diary');
}

const DIARY_FILE_RE = /\.jsonl$/;

/** 原子写：先写临时文件再 rename，避免半截文件毁掉档案 */
async function writeFileAtomic(file, text) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  await writeFile(tmp, text, { encoding: 'utf8', mode: 0o600 });
  await rename(tmp, file);
}

/**
 * 从工作目录读出"文件名 → 文本"的映射（相对路径用正斜杠）。
 * 读不出的文件跳过并留 warning，不抛。
 */
async function readArchiveDir(dir) {
  const files = new Map();
  const warnings = [];

  async function readOne(rel) {
    try {
      files.set(rel, await readFile(path.join(dir, rel), 'utf8'));
    } catch (err) {
      if (err?.code !== 'ENOENT') {
        warnings.push(`${rel} 读不出来：${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  for (const base of ['manifest.json', 'persona.md', 'relationship.json', 'lexicon.json']) {
    await readOne(base);
  }

  try {
    const entries = await readdir(path.join(dir, 'diary'));
    for (const f of entries) {
      if (DIARY_FILE_RE.test(f)) await readOne(`${DIARY_DIR}/${f}`);
    }
  } catch (err) {
    if (err?.code !== 'ENOENT') warnings.push(`diary 目录读不出来：${String(err?.message ?? err)}`);
  }

  return { files, warnings };
}

/** 把"文件名 → 文本"落盘。逐文件原子写。 */
async function writeArchiveDir(dir, files) {
  for (const f of files) {
    await writeFileAtomic(path.join(dir, f.name), f.data);
  }

  // ── 写完再清一遍：下不在清单里的月份文件删掉 ──
  //
  // archiveToFiles 只给"有条目的月份"产出文件。于是：
  //
  //   某月最后一条被「忘掉」→ 那个月不再有清单文件 → 旧 jsonl 没人覆盖
  //   焚毁（清空所有）    → 一个月份都不产出 → 所有旧 jsonl 全留着
  //
  // 结果就是"内存 0 条，磁盘明文还在，重启读回来" —— 删除形同虚设。
  //
  // 写 = 让磁盘和内存一致。所以这里必须主动清掉多余的那个月。
  // 只清 DIARY_DIR 下的 .jsonl：日记.md（渲染版）、手记.md、.bak-* 一律不碰。
  const wanted = new Set(
    files.filter((f) => f.name.startsWith(`${DIARY_DIR}/`)).map((f) => path.basename(f.name)),
  );
  const diaryDir = path.join(dir, DIARY_DIR);
  if (!existsSync(diaryDir)) return;
  for (const name of await readdir(diaryDir)) {
    if (!name.endsWith('.jsonl')) continue;
    if (wanted.has(name)) continue;
    await rm(path.join(diaryDir, name), { force: true });
    warn(`清掉多余的月份文件：${DIARY_DIR}/${name}（已经没有条目标了）`);
  }
}

/* ───────────────────────── 插件主体 ───────────────────────── */

/**
 * @param {any} ctx Cordis context
 * @param {any} rawConfig 行配置（可能未经校验，resolveConfig 会补默认值）
 */
export function apply(ctx, rawConfig) {
  const config = resolveConfig(rawConfig);
  /** 档案目录：在 apply 时一次算定，之后全程不变 */
  const archiveDirectory = resolveArchiveDir(config);
  // 一行说清"档案到底落在哪"，**不受 debugLog 管**。
  //
  // 社区那个 [object Object] 的 bug：五秒钟的事，因为没有一行输出，
  // 用户只能靠翻文件系统发现。这行值得一直在。
  ctx.logger?.info?.(`[fish-memory] 档案目录：${archiveDirectory}`);
  /** 当前档案（内存副本，写盘后保持一致） */
  let archive = createEmptyArchive(Date.now());
  /**
   * **加载时磁盘上有哪些日记 id** —— 三路合并的"基线"。
   *
   * 只在这里赋值一次，之后**永不更新**。它是判断"谁删了什么"的唯一依据：
   *
   *   内存没有、磁盘没有、基线有 → 我们删的
   *   内存没有、基线没有、磁盘有 → 别人刚加的
   *
   * 详见 `mergeArchives` 的表格。
   */
  let loadedIds = new Set();
  /**
   * **加载时磁盘上的人格文本** —— 用来发现"人手动改了 persona.md"。
   *
   * ── 为什么需要它 ──
   *
   * `persona.md` 是**明说让人改的**（`persona.default.md` 里就写着
   * "用户可以直接改这个文件"）。但在这之前它其实改不动：
   *
   *   · 插件启动后**再也不读** `persona.md`
   *   · 落盘时 `archiveToFiles()` 拿**内存里的**那份整份写回
   *   · `mergeArchives()` 里写死 `persona: base.persona`
   *
   * 于是人改完，插件下一次写日记就**把它悄悄覆盖回去** ——
   * 一个承诺了可编辑、实际改不了的文件。
   *
   * 规矩跟日记那套一样：**磁盘变了就认磁盘**。
   *   · 磁盘文本 ≠ 基线 → 有人改过 → 采纳它，并把基线推上去
   *   · 磁盘文本 = 基线 → 没动过 → 用内存的（我们可能自己改过，比如焚毁）
   *
   * 赋值时机：加载完、以及每次采纳之后。
   */
  let personaBaseline = null;
  /** 倒排索引 —— 纯派生，每次加载档案后重建，不落盘 */
  let index = buildIndex([]);
  let ready = false;
  /** 档案是否处于"读失败所以只读"状态（SPEC §10 降级优先） */
  let degraded = false;

  /**
   * 日志出口。
   *
   * 三份去向，理由各不相同：
   *  - `ctx.logger`：正式渠道，桌面端界面/日志能看到
   *  - `stderr`：headless / 无人值守时 ctx.logger 可能没人接
   *  - **`feiyu.debug.log` 文件**：进程被硬退出时前两份都会丢
   *
   * 第三份是端到端验证逼出来的：headless 跑完一个任务会**直接退进程**，
   * stderr 缓冲区来不及刷，于是"它卡在哪一环"完全看不见 ——
   * 明明日志代码写了，就是一片空白。落文件才留得住。
   *
   * 只有 `debugLog: true` 才写，且**只写形状、绝不写对话内容**（SPEC §6.3）。
   */
  const DEBUG_LOG_FILE = 'feiyu.debug.log';
  /**
   * 日志文件的尺寸上限（1 MB）和保留份数（1 份 `.1`）。
   *
   * ⚠️ **这个是补上一个真实的漏。** 原来这里是纯粹的 `appendFileSync`，
   * 没有任何 stat/size 检查 —— 实测这台机器上那个文件已经 268 KB，
   * 而且它只增不减。`debugLog` 一开（排查问题时一定会开），
   * 每轮几十行，几个月后就是几十兆，还全都躺在用户的记忆目录里。
   *
   * 1 MB 是拍脑袋定的，但方向对：日志是给人看"刚才发生了什么"的，
   * 超过一兆的旧日志没人会去翻。轮转只留一份，不做日期命名 ——
   * 那样迟早攒出上百个文件。
   */
  const DEBUG_LOG_MAX_BYTES = 1024 * 1024;
  const DEBUG_LOG_KEEP = 1;
  let debugLogBytes = -1; // -1 = 还没量过

  /** 写一行日志，超过上限就先挪成 `.1` 再重开。 */
  function appendDebugLog(text) {
    try {
      mkdirSync(archiveDirectory, { recursive: true });
      const file = path.join(archiveDirectory, DEBUG_LOG_FILE);
      if (debugLogBytes < 0) {
        try {
          debugLogBytes = statSync(file).size;
        } catch {
          debugLogBytes = 0;
        }
      }
      if (debugLogBytes + text.length > DEBUG_LOG_MAX_BYTES) {
        try {
          const rotated = `${file}.${DEBUG_LOG_KEEP}`;
          // 只留一份：先删旧的 `.1`，再把现在的挪过去
          try {
            rmSync(rotated, { force: true });
          } catch {
            // 删不掉就让 rename 自己覆盖（多数平台能覆盖）
          }
          renameSync(file, rotated);
        } catch {
          // 挪不动就当场截断 —— 宁可丢旧日志，也不能让它无限长
        }
        debugLogBytes = 0;
      }
      appendFileSync(file, text, 'utf8');
      debugLogBytes += text.length;
    } catch {
      // 写不了就算了，日志不该影响功能
    }
  }

  const emit = (level, args) => {
    const line = `[fish] ${args.join(' ')}`;
    try {
      ctx.logger?.[level]?.(line);
    } catch {
      // logger 坏了不影响功能
    }
    if (!config.debugLog) return;
    try {
      process.stderr.write(`${line}\n`);
    } catch {
      // 没有 stderr 就只走 logger
    }
    appendDebugLog(`${new Date().toISOString()} ${line}\n`);
  };
  const log = (...args) => {
    if (config.debugLog) emit('info', args);
  };
  const warn = (...args) => emit('warn', args);

  /** @type {Map<string, any>} sessionId → 会话内的临时状态 */
  const sessionStates = new Map();
  const abort = new AbortController();

  function stateOf(sessionId) {
    let s = sessionStates.get(sessionId);
    if (s === undefined) {
      s = {
        turn: 0,
        lastUserText: '',
        transcript: [], // 滚动缓冲，最近若干轮
        renderCache: { turn: -1, text: '' },
        diaryCount: 0,
        lastShownTurn: new Map(),
        suppressedUntil: -1,
        queued: false,
        judging: false,
        /** 上下文刚被压缩过：下一轮要把最近的事整段重灌一次（免预算） */
        needsRecentReplay: false,
      };
      sessionStates.set(sessionId, s);
    }
    return s;
  }

  /* ── 档案加载 ── */

  /**
   * 给还没 summary 的日记补一句总结。
   *
   * —— 为什么要有 ——
   * summary 是检索的入口（见 pickBySummary）。老条目没有，就只能拿正文前 30 字兜底，
   * 那比 summary 差一截：正文前 30 字是"起手式"，不是"他管它叫什么"。
   *
   * —— 为什么后台跑、分批 ——
   * 两百多条是二十几次模型调用。同步跑会把启动卡成几十秒，那比没有 summary 还糟。
   * 所以：每批 10 条、批间隔 1.5 秒，跑完就停；下次启动接着补没补的。
   *
   * —— 为什么要等 llm ——
   * 2026-10-28 踩过的坑：插件 apply 的时候 llm 服务还没挂上，
   * `ctx.get('llm')` 是 undefined，于是这里一声不吭地 return 了 ——
   * 重启了三次，一条 summary 都没补上，而日志里干净得像没事发生。
   * **所以：不再赌"启动那一刻服务就绪"，改成等它（最多 2 分钟）。**
   *
   * —— 为什么进度写进 manifest ——
   * `log()` 只在 debugLog 开着时才落盘，默认是关的。
   * 而"补了多少"这种事不能靠日志证明 —— 写进 manifest，任何时候都能查。
   */
  let backfillRunning = false;
  async function backfillSummaries() {
    if (backfillRunning) return;
    backfillRunning = true;
    try {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      const pending = () =>
        archive.diary.filter(
          (e) =>
            typeof e.text === 'string' &&
            e.text !== '' &&
            (typeof e.summary !== 'string' || e.summary === ''),
        );

      // 没活儿就一句话都不留。
      //
      // 原来这里是先写 starting 再判断"有没有要补的" —— 结果 241 条全补完之后，
      // 下一次调用又把状态盖回 starting，界面上看着像永远卡住。
      if (pending().length === 0) return;

      // ── 先留痕，再干活 ──
      //
      // 上一版把「证据」写成了"成功之后才记"，结果:241 条一条没补，
      // manifest 里连个字段都没有，日志默认又是关的 ——
      // **完全看不出它到底有没有跑过。**
      //
      // 现在：进门第一件事就是写状态 + 立刻落盘。
      // 哪怕下一步就卡死，你也能从 manifest 里看到它走到哪儿了。
      markBackfill(pending().length, 0, 'starting');
      try {
        await persist();
      } catch (err) {
        warn(`补总结：写状态失败（不影响别的）：${err instanceof Error ? err.message : String(err)}`);
      }

      // 等 llm 和模型信息就绪
      //
      // 2026-10-28 实测：这一行里任何一个 ctx.get() 都可能**直接抛**，
      // 抛出去以后状态就永远停在 "starting" —— 看起来像"卡住了"，其实是"炸了"。
      // 所以整段包起来，炸了也要把 error 写进 manifest。
      try {
        const deadline = Date.now() + 120000;
        let waited = 0;
        for (;;) {
          const llmNow = ctx.get('llm');
          const sel = ctx.get('agentDefaultModel')?.currentSelection?.() ?? undefined;
          const mdl = config.model || sel?.model;
          if (llmNow !== undefined && typeof sel?.provider === 'string' && typeof mdl === 'string') break;
          if (Date.now() > deadline) {
            warn('补总结：等了 2 分钟还没等到 llm 或模型信息，这次不补了');
            markBackfill(pending().length, 0, 'timeout');
            try { await persist(); } catch { /* 写不进去就算了 */ }
            return;
          }
          waited += 1;
          if (waited % 15 === 0) log(`补总结：还在等 llm（已等 ${waited * 2}s）`);
          await sleep(2000);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        warn(`补总结：等服务就绪时炸了：${msg}`);
        markBackfill(pending().length, 0, 'error');
        try { await persist(); } catch { /* 写不进去就算了 */ }
        return;
      }

      const total = pending().length;
      if (total === 0) {
        markBackfill(total, 0, 'done');
        return;
      }
      log(`补总结：${total} 条还没有，后台分批补`);

      let done = 0;
      let fails = 0;
      for (let round = 0; round < 80; round++) {
        const todo = pending().slice(0, 10);
        if (todo.length === 0) break;

        const llmP = ctx.get('llm');
        const selection = ctx.get('agentDefaultModel')?.currentSelection?.() ?? undefined;
        const provider = selection?.provider;
        const model = config.model || selection?.model;
        if (llmP === undefined || typeof provider !== 'string' || typeof model !== 'string') {
          warn('补总结：模型信息中途没了，停手');
          markBackfill(total, done, 'stopped');
          return;
        }

        const built = buildSummaryInput(todo);
        let text = '';
        try {
          for await (const chunk of llmP.stream({
            provider,
            model,
            system: built.system,
            messages: [{ role: 'user', content: [{ type: 'text', text: built.user }] }],
            maxTokens: 600,
            temperature: 0,
            // 空字符串是非法档位 —— 实测会让 stream 直接不返回。
            // 跟固化那边保持一致：只有配置里真有值才传。
            ...(typeof config.reasoningEffort === 'string' && config.reasoningEffort.trim() !== ''
              ? { reasoningEffort: config.reasoningEffort.trim() }
              : {}),
          })) {
            if (chunk?.type === 'text-delta') text += chunk.text;
          }
        } catch (err) {
          warn(`补总结失败：${err instanceof Error ? err.message : String(err)}`);
          markBackfill(total, done, 'error');
          return;
        }

        const map = parseSummaryResult(text);
        if (map.size === 0) {
          fails += 1;
          warn(`补总结：这批一条都没解析出来（连续 ${fails} 次）`);
          if (fails >= 3) {
            warn('补总结：连着 3 批空，停手，下次启动再试');
            markBackfill(total, done, 'error');
            return;
          }
          await sleep(2000);
          continue;
        }
        fails = 0;

        archive = applySummaries(archive, map, Date.now());
        index = buildIndex(archive.diary);
        done += map.size;
        markBackfill(total, done, 'running');
        await persist();
        log(`补总结：+${map.size} 条（累计 ${done}/${total}，还剩 ${pending().length}）`);
        await sleep(1500);
      }
      markBackfill(total, done, 'done');
      try { await persist(); } catch { /* 写不进去就算了 */ }
      log(`补总结：这一轮结束，补了 ${done} 条，还剩 ${pending().length} 条没补`);
    } finally {
      backfillRunning = false;
    }
  }

  /**
   * 把补总结的进度写进 manifest。
   *
   * 为什么要落盘：`log()` 默认不写（debugLog 关着），
   * 而"补了多少"是能证明这套东西到底跑没跑的唯一证据。
   */
  /**
   * 记一笔「挑往事」这次的用量。
   *
   * 为什么非记不可：**缓存命中率是看不见的。** 请求发出去、答案回来了、
   * 一切正常，只有账单知道这次是 0.1 元/M 还是 1 元/M。
   * 而 prompt 的字段顺序一旦写反（把会变的那句放前面），缓存就静悄悄地失效了 ——
   * 今天就是这么栽的，全靠事后读日志才翻出来。
   *
   * 所以：每次挑完把 usage 落进 manifest，谁都能一眼看见。
   */
  function markPick(entries, lines, usage) {
    const u = usage ?? {};
    archive.manifest = {
      ...archive.manifest,
      pick_stats: {
        at: Date.now(),
        entries,
        lines,
        inputTokens: Number.isFinite(u.inputTokens) ? u.inputTokens : null,
        cacheReadTokens: Number.isFinite(u.cacheReadTokens) ? u.cacheReadTokens : null,
        outputTokens: Number.isFinite(u.outputTokens) ? u.outputTokens : null,
        // 取不到 usage 的时候，把 finish 的形状留下来 —— 别再猜字段名。
        // 只留前 300 字，够看清结构，不至于把整段响应塞进档案。
      },
    };
  }

  function markBackfill(total, done, state) {
    archive.manifest = {
      ...archive.manifest,
      summary_backfill: { total, done, state, at: Date.now() },
    };
  }

  const loadPromise = (async () => {
    const dir = archiveDirectory;
    try {
      const { files, warnings } = await readArchiveDir(dir);
      for (const w of warnings) warn(w);

      if (files.size === 0) {
        // 首次运行：写出厂档案
        archive = createEmptyArchive(Date.now(), readBundledDefaultPersona());
        const migrated = decayArchive(archive, { now: Date.now() });
        archive = migrated.archive;
        await writeArchiveDir(dir, archiveToFiles(archive));
        log('首次运行，已创建空档案');
      } else {
        const entries = [...files].map(([n, text]) => ({ name: n, text: () => text }));
        const { archive: loaded, warnings: w2 } = archiveFromFiles(entries, { now: Date.now() });
        for (const w of w2) warn(w);
        archive = loaded;
      }

      // 老化 + 重建索引
      archive = decayArchive(archive, { now: Date.now() }).archive;
      index = buildIndex(archive.diary);
      // 基线只在这里定一次：之后落盘前的三路合并全靠它判断"谁删了什么"
      loadedIds = new Set(archive.diary.map((e) => e.id));
      // 人格也留一份基线，用来发现"人手动改了 persona.md"
      personaBaseline = archive.persona;
      ready = true;
      log(`档案就绪：${archive.diary.length} 条日记`);

      // 顺手刷新人读版。这样即使这次什么都没记，衰减后的状态也是对的；
      // 也从别人那儿导入档案之后，立刻就有可读的一份。
      await writeReadableDiary(archive);

      // 启动留痕 —— 落进 manifest，不依赖 debugLog。
      // 有了它就能一眼分清两种"没补上"：
      //   有 boot 没 summary_backfill → 插件起来了，但补总结没被调到
      //   连 boot 都没有           → 装的根本不是这份代码
      archive.manifest = {
        ...archive.manifest,
        boot: { at: Date.now(), schema: SCHEMA_VERSION, entries: archive.diary.length },
      };
      try {
        await persist();
      } catch (err) {
        warn(`启动留痕写盘失败：${err instanceof Error ? err.message : String(err)}`);
      }

      // ── 补总结**不在启动时**跑 ──
      //
      // 实测两次：插件 apply 的时候 `ctx.get('llm')` 是 undefined，
      // 等两分钟也等不到（manifest 停在 state:"starting"）。
      // 所以触发点挪到 `agent/turn-stopping` —— 那条路上 llm 一定是活的。
      // 见那边开头的注释。

      // 手记文件不在就建一份带说明的空壳 —— **文件自己就是文档**。
      // 用户（或任何一个肥鱼）打开就知道该往里写什么。
      try {
        const notePath = path.join(archiveDirectory, HANDNOTE_FILE);
        if (!existsSync(notePath)) writeFileSync(notePath, HANDNOTE_TEMPLATE, 'utf8');
      } catch (err) {
        warn(`建手记文件失败（不影响别的）：${err instanceof Error ? err.message : String(err)}`);
      }
    } catch (err) {
      degraded = true;
      warn(`档案加载失败，本次以"不记忆"模式运行：${err instanceof Error ? err.message : String(err)}`);
    }
  })();

  /**
   * 插件卸载（含进程退出）时，**先尽力把带外队列写完，再中止**。
   *
   * 这一条是端到端验证逼出来的：headless / 一次性会话里，进程会在
   * "回合结束 → 后台写日记" 这段时间里直接退出，结果是**模型答了、日记没了**。
   * 同一个坑在桌面端表现为"刚聊完就关掉 Harness，那条记忆丢了"。
   *
   * ── 第二个坑（也是端到端验证抓的）──
   *
   * 这个上限原来写的是 20 秒，而**单任务自己的超时是 60 秒**。
   * 也就是说：只要固化耗时超过 20 秒，这里就会先动手把它砍掉 ——
   * 那个 60 秒的超时永远轮不到生效。
   *
   * 提示词短的时候侥幸没撞上（几秒就答完了）；把提示词写详细、
   * 要求带 evidence 之后，输出变长、耗时跨过 20 秒，就必然丢日记。
   *
   * 所以这个值**必须大于单任务超时**，它只是"进程已经要死了"的最后一道保险，
   * 不是任务的时间预算。任务的时间预算归 JOB_TIMEOUT_MS 管。
   */
  const FLUSH_TIMEOUT_MS = 180000;
  ctx.effect(() => () => {
    // ── 召回计数补一次落盘（2026-11-04）──
    //
    // `noteRecalled` 默认只改内存、攒够 5 分钟才 `void persist()`。
    // 进程要是正好在这 5 分钟里被关掉，那几条的 `recall_count` 就跟着
    // 一起没了 —— 而它正是"这条我确实还记得"的证据。关之前补一次。
    if (recallDirty) {
      recallDirty = false;
      try {
        void persist();
      } catch {
        // 已经在关了，写不进去就算了
      }
    }
    const flush = Promise.resolve()
      .then(() => drainPromise)
      .then(() => writeChain)
      .catch(() => undefined);
    const deadline = new Promise((resolve) => {
      const t = setTimeout(resolve, FLUSH_TIMEOUT_MS);
      if (typeof t.unref === 'function') t.unref();
    });
    return Promise.race([flush, deadline]).then(() => {
      abort.abort();
      sessionStates.clear();
    });
  }, 'fish: flush pending work, then abort');

  /* ── 写盘 ── */

  let writeChain = Promise.resolve();

  /**
   * 写一份**人读版**日记（`日记.md`）。
   *
   * 定位和内存索引一样：**单向派生、只读、随时可重建**。
   * 它在档案目录里，但**不属于档案数据**（不进 `.dshpack`）——
   * 导入别人的档案后，下次加载会自动重新生成一份。
   *
   * 失败的代价只是"看不到漂亮版本"，所以这里只 warn，绝不影响主流程。
   */
  async function writeReadableDiary(snapshot) {
    try {
      const file = path.join(archiveDirectory, DIARY_MD);
      await writeFileAtomic(file, renderDiaryFile(snapshot, { now: Date.now() }));
    } catch (err) {
      warn(`写人读版日记失败（不影响记忆本身）：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * 落盘前，把**磁盘上别的会话刚写的**东西并进内存。
   *
   * ── 为什么必须有这一步 ──
   *
   * `archiveToFiles()` 是**整份重建**：内存里有什么就写什么，磁盘上多出来的一律抹掉。
   *
   * 单会话时没事。但同一份档案会被**很多个会话**同时打开 ——
   * 实测有 **10 个会话**往同一个档案里写过。每个会话启动时把档案读进内存，
   * 落盘时整份重写：
   *
   *   会话 A 写了 X，落盘
   *   会话 B 内存里没有 X，写 Y，落盘 → **X 被抹掉了**
   *
   * 谁后落盘谁赢。而且这种丢失**检测不出来**：B 覆盖 A 的第 5 条时，
   * 编号照样是 1..10 连续的 —— 不撞号也不断号。
   *
   * 所以写之前先读一遍，按 id 并一下。**内存优先**（它对已知的条目最新），
   * 磁盘补充内存没有的。`mergeArchives` 就是干这个的。
   *
   * ── 这个修法换来了什么、代价是什么 ──
   *
   * 换来：**新增的条目不会再被静默抹掉。** 这是唯一会真吃掉用户数据的路径。
   *
   * 代价：**删除在并发下可能被翻回来。** 会话 B 内存里还留着用户刚在会话 A
   * 删掉的那条，B 一落盘它就回来了。这个取舍是故意的 ——
   * *恢复一条看得见的删错，比丢一条看不见的东西便宜。*
   * 要根治得给删除加墓碑（tombstone），那是另一个量级的改动，先记着。
   */
  /**
   * 磁盘上的 `persona.md` 被人改过吗？改过就采纳。
   *
   * 跟 `mergeDiskEntries` 是同一个道理：**磁盘是人的地盘，内存只是缓存。**
   * 但这个比日记简单 —— 人格是一整块文本，没有 id 可以按条合并，
   * 所以判据只能是"跟基线比对"：变了就整块认磁盘。
   *
   * 两处会调它：
   *   · `renderFor` —— 让人改完**下一轮就生效**，不用重启
   *   · `persist`   —— 防止落盘时把人的改动覆盖掉
   *
   * 读不到的代价只是"这次不采纳"，绝不影响别的。
   *
   * @returns {boolean} 是不是采纳了磁盘上的新版本
   */
  function syncPersonaFromDisk() {
    if (personaBaseline === null) return false;
    try {
      const file = path.join(archiveDirectory, PERSONA_FILE);
      if (!existsSync(file)) return false;
      const disk = readFileSync(file, 'utf8');
      // 落盘时写的是 `ensurePersonaStructure(x) + '\n'`，比对前先把格式对齐
      const normalized = `${ensurePersonaStructure(disk).replace(/\s*$/, '')}\n`;
      const baseline = `${ensurePersonaStructure(personaBaseline).replace(/\s*$/, '')}\n`;
      if (normalized === baseline) return false;
      archive.persona = disk;
      personaBaseline = disk;
      log('检测到 persona.md 被手动改过，采纳磁盘上的版本');
      return true;
    } catch (err) {
      warn(`读 persona.md 失败（继续用内存里的）：${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  async function mergeDiskEntries() {
    try {
      const { files } = await readArchiveDir(archiveDirectory);
      // ⚠️ **读不到就别合。** 磁盘读失败时传个空基线，会让
      // `mergeArchives` 把"内存有、磁盘没有"全判成"别人删了它"，
      // 一个档案瞬间清空。宁可这一次不防丢，也不能把档案写没。
      if (files.size === 0) return 0;
      const entries = [...files].map(([n, text]) => ({ name: n, text: () => text }));
      const { archive: disk } = archiveFromFiles(entries, { now: Date.now() });
      const before = archive.diary.length;
      archive = mergeArchives(archive, disk, { baselineIds: loadedIds });
      index = buildIndex(archive.diary);
      const gained = archive.diary.length - before;
      if (gained > 0) log(`落盘前并进了 ${gained} 条别的会话刚写的日记`);
      return gained;
    } catch (err) {
      // 读不到就照常写 —— 合并是**尽力而为的防丢**，不能因为它失败就不落盘
      warn(`落盘前合并失败（继续写，但可能覆盖别的会话）：${err instanceof Error ? err.message : String(err)}`);
      return 0;
    }
  }

  /** 连续写盘失败次数 —— 到 3 次就把 degraded 置真，让面板能看出来 */
  let writeFailures = 0;

  function persist() {
    if (!ready) return writeChain;
    writeChain = writeChain
      .then(async () => {
        // ⚠️ 顺序要紧：**先并、再改时间戳、再写。**
        // 合并会把 archive 换成新对象，所以 snapshot 必须在合并之后取。
        await mergeDiskEntries();
        // 人格也要先问一声磁盘 —— 不然人手动改的会在这里被覆盖掉
        syncPersonaFromDisk();
        const merged = archive;
        merged.manifest.updated_at = Date.now();
        await writeArchiveDir(archiveDirectory, archiveToFiles(merged));
        await writeReadableDiary(merged);
        // 云端备份放到下一个 tick：这里正处在 writeChain 里，
        // 直接 await 会等自己（cloudBackupOnce 也要等 writeChain 落定）→ 死锁。
        setTimeout(() => {
          try {
            maybeAutoCloud();
          } catch (err) {
            warn(`自动云端备份没起来：${err instanceof Error ? err.message : String(err)}`);
          }
        }, 0);
      })
      .catch((err) => {
        // ⚠️ **连续写盘失败要让面板看得出来。**
        //
        // 原来这里只 warn 一句就吞掉，工具照样返回"记住了"。
        // 社区报告点了一句：这次这个坑是"写成功了但写错地方"，所以捕获救不了 ——
        // 但**真的写失败**的时候，用户同样只会看到「记住了」。
        //
        // 所以：连续 3 次失败就把 degraded 置真，面板上会显示"档案读不了"。
        // 一次失败可能只是临时占用，不值得惊动用户。
        writeFailures += 1;
        warn(
          `写档案失败（连续第 ${writeFailures} 次）：${err instanceof Error ? err.message : String(err)}`,
        );
        if (writeFailures >= 3 && !degraded) {
          degraded = true;
          warn('档案连续写失败 3 次，标记为降级 —— 面板上会显示出来');
        }
      })
      .then(() => {
        // 成功一次就把计数清零：一次失败不该永久挂着
        writeFailures = 0;
      });
    return writeChain;
  }

  /* ── 云端备份（WebDAV） ── */
  //
  // 2026-10-31 加。本地那份 JSON 已经能带走，用户要的是「连手都不用动」。
  //
  // 三条约束：
  //  · **永远不能挡住聊天** —— 上传一律在写盘落定之后、fire-and-forget，
  //    失败只 warn，绝不向上抛。
  //  · 自动上传带 5 分钟节流：每轮写完就推一次太吵，网盘也会限流。
  //  · 配置每次现读（`cfgNow`）—— 用户在设置页改完密码不用重启。

  const cfgNow = () => resolveConfig(rawConfig);
  // ── 配置备份 / 恢复（只装配置，不装四本账） ─────────────────────────────
  //
  // 用户要的是「换台设备时别把 WebDAV 地址、保留份数、预算这些重新填一遍」。
  // 所以这份 JSON 很小，只放本 entry 的配置项；四本账走 fish_backup / cloud 那条。
  const CONFIG_BACKUP_FORMAT = 'dsh-hierarchical-fishmemory/config';
  const CONFIG_BACKUP_VERSION = 1;
  const configFileName = (now = new Date()) => {
    const p = (n) => String(n).padStart(2, '0');
    return `配置-${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}-${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}.json`;
  };

  const cloudState = {
    lastAt: 0,
    lastFile: '',
    lastBytes: 0,
    lastRemoved: [],
    lastReason: '',
    lastError: '',
  };
  let cloudInflight = null;
  let lastAutoAt = 0;

  async function buildAndSaveBackup(note) {
    await loadPromise;
    await drainPromise;
    await writeChain;
    const build = ctx.get('fishMemory')?.buildBackup;
    const backup = typeof build === 'function' ? await build() : await buildRegisteredBackup();
    backup.meta.counts = summarizeBackup(backup);
    if (note) backup.meta.note = String(note);
    const { file, bytes } = await writeBackupFile(backup, path.join(dshHome(), 'backups'), {
      fileName: backupFileName(),
    });
    return { backup, file, bytes };
  }

  /** 生成一份新备份并推到 WebDAV。并发调用共用同一个 promise。 */
  function cloudBackupOnce({ reason = 'manual', note } = {}) {
    if (cloudInflight) return cloudInflight;
    cloudInflight = (async () => {
      const wd = normalizeWebdavConfig(cfgNow());
      if (!wd.enabled) throw new Error('WebDAV 已关掉（设置里的「WebDAV 总开关」）');
      if (!wd.configured) {
        throw new Error('WebDAV 还没配置：填上服务器地址（和可选的账号密码）再试');
      }
      const { backup, file, bytes } = await buildAndSaveBackup(note ?? `cloud-${reason}`);
      const text = JSON.stringify(backup, null, 2);
      const pushed = await pushBackupToCloud(wd, {
        text,
        fileName: path.basename(file),
        onLog: (msg) => log(msg),
      });
      cloudState.lastAt = Date.now();
      cloudState.lastFile = pushed.fileName;
      cloudState.lastBytes = pushed.bytes;
      cloudState.lastRemoved = pushed.removed;
      cloudState.lastReason = reason;
      cloudState.lastError = '';
      log(`云端备份完成（${reason}）：${pushed.url}（${pushed.bytes} 字节）`);
      return { ...pushed, localFile: file, localBytes: bytes };
    })()
      .catch((err) => {
        cloudState.lastError = err instanceof Error ? err.message : String(err);
        throw err;
      })
      .finally(() => {
        cloudInflight = null;
      });
    return cloudInflight;
  }

  /** 写完日记后的自动上传：节流 5 分钟，失败只 warn。 */
  function maybeAutoCloud() {
    const wd = normalizeWebdavConfig(cfgNow());
    if (!wd.enabled || !wd.auto || !wd.configured) return;
    const now = Date.now();
    if (now - lastAutoAt < 5 * 60 * 1000) return;
    lastAutoAt = now;
    cloudBackupOnce({ reason: 'auto' }).catch((err) => {
      warn(`自动云端备份失败：${err instanceof Error ? err.message : String(err)}`);
    });
  }

  /* ── 注入 ── */

  /**
   * 「去档案里找一句」的工具名。
   *
   * 为什么要它：注入的召回是**系统替它猜**（拿你这一轮的字面去匹配），
   * 而字面匹配有个结构性劣势 —— 元日记（"他问了什么、我答了什么"）
   * 永远比那件事本身字面更全，所以真东西压不上去。
   *
   * 工具换了个方向：**它自己知道在找什么。** 换个说法也能撞上。
   *
   * 而"知道有这个工具"靠两件东西（缺一不可）：
   *   1. 工具签名 —— 注册了，DSH 就会把 schema 发给模型
   *   2. 注入里那句指针 —— 在 `renderFor` 的 handNoteHint 里，每轮都读到
   *
   * 只做 1 不做 2，模型会想不起来用（工具一多就被淹）。
   */
  const RECALL_TOOL_NAME = 'fish_recall';

  /**
   * 记一次「想起来」。
   *
   * ── 为什么要它 ──
   *
   * 召回是**读**，可"读"这件事本身是信息：被反复翻出来的那条，
   * 才是真的还在你生活里的那条。在这之前这个信息一个字都没留下 ——
   * 冷却表是内存里的（重启归零），衰减对所有条目一视同仁。
   *
   * ── 为什么不当场写盘 ──
   *
   * 召回几乎每轮都发生，而 `persist()` 要重写整个档案目录（还要跑一次
   * 三路合并、一次可读版日记渲染）。为了加两个整数把这件事变成每轮一次，
   * 代价完全不成比例。
   *
   * 所以：**只改内存，落盘搭便车。** 任何一次真正的写盘（固化、面板操作、
   * 关掉插件）都会把计数一起带上；另外加一个 5 分钟节流兜底 ——
   * 万一后面什么也没发生（纯闲聊、聊完就关），计数也不至于白记。
   *
   * ── 为什么不上调 salience ──
   *
   * 召回打分里含 salience。在召回的那一刻给它加分，等于"想起来过的
   * 更容易被再想起来"—— 跑几轮就会滚成一个固定的小圈子，别的条目
   * 再也出不来。**记事实，不许它自己制造事实。**
   *
   * @param {string[]} ids
   */
  const RECALL_FLUSH_MS = 5 * 60 * 1000;
  let lastRecallFlush = 0;
  let recallDirty = false;

  function noteRecalled(ids) {
    const list = Array.isArray(ids) ? ids.filter((id) => typeof id === 'string' && id !== '') : [];
    if (list.length === 0) return;
    const now = Date.now();
    const wanted = new Set(list);
    let touched = 0;
    const diary = archive.diary.map((e) => {
      if (!wanted.has(e.id)) return e;
      touched += 1;
      return {
        ...e,
        recall_count: (Number.isFinite(e.recall_count) ? Number(e.recall_count) : 0) + 1,
        last_recalled_at: now,
      };
    });
    if (touched === 0) return;
    archive.diary = diary;
    recallDirty = true;

    // 节流落盘。**不 await、不抛** —— 记账失败绝不该影响这一轮的注入。
    if (now - lastRecallFlush >= RECALL_FLUSH_MS) {
      lastRecallFlush = now;
      recallDirty = false;
      try {
        void persist();
      } catch (err) {
        warn(`召回计数落盘没起来：${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  /**
   * 为某个会话渲染注入文本。
   *
   * **按轮缓存**：`assemble` 每个 model step 都会调用一次，
   * 而一个回合可能有几十个 step（工具调用）。不缓存的话
   * 召回会用掉冷却、还会在同一个回合里换着花样想起不同的事 —— 很出戏。
   */
  function renderFor(sessionId) {
    if (!ready || !config.enabled) return '';
    const s = stateOf(sessionId);
    if (s.renderCache.turn === s.turn) return s.renderCache.text;

    let text = '';
    try {
      const query = s.lastUserText;

      // 人可能刚改过 persona.md —— 每轮问一次，**改完下一轮就生效，不用重启**。
      // 块本身按轮缓存，所以这个读一turn一次，跟手记那条一样便宜。
      syncPersonaFromDisk();

      // ── 判断（`kind: "note"`）**2026-10-27 整栏下线** ──
      //
      // 原来这里把 note 条目分成两截：最近几条渲染成「我自己想的」，
      // 更早的丢进召回池。整栏和小工具 `feiyu_note` 都不要了，理由见
      // persona.mjs 里那段注释（四条全是「我该怎么干」，没有一条「他是什么人」）。
      //
      // 数据不动：档案里那 58 条 `kind: "note"` 留着，历史就是历史。
      // 但它们**也不进召回池** —— 让「规矩」从别的栏目溜回来，等于没删干净。
      const safeEntry = (e) => {
        const r = scrub(e.text, { thirdParty: false });
        return r.blocked ? { ...e, text: r.text } : e;
      };
      const events = archive.diary.map(safeEntry)
      .filter((e) => e?.kind !== 'note')
      // 续写过的条目 created_at 没动，但它是"刚写过的" —— 排序得看 updated_at，
      // 否则刚补完的那条会按原始时间沉下去。
      .sort((a, b) => (a.updated_at ?? a.created_at) - (b.updated_at ?? b.created_at));

      // 「最近的事」—— 按时间取最近的几条，不走相似度。
      // 这是让注入区读起来像日记而不是像检索结果的关键：
      // 最近发生的事本来就在脑子里，不需要被"想起来"。
      //
      // 取的是 **events**，不是整个日记 —— 判断（`kind: "note"`）那一栏已经下线，不渲染。
      const recentCount = Number.isFinite(config.recentEntries) ? config.recentEntries : 8;
      const recent = recentCount > 0 ? events.slice(-recentCount) : [];
      const recentIds = new Set(recent.map((e) => e.id));

      // ⚠️ **召回池里不能有「最近的事」那几条。**
      //
      // 实测抓到的坑：它们已经常驻了，却又混进召回池一起竞争 ——
      // 而"最近"天然含着你刚说过的话，字面命中率最高，于是**永远赢**。
      //
      // 具体表现：他问「赛博朋克让你想到什么」，召回选中了
      // 「他连着测了三句：赛博朋克、随心所欲、手机号……」—— 那是我自己写的
      // 测试记录，含所有测试词所以分最高；真正的赛博朋克日记永远出不来。
      // 而且那条已经在「最近的事」里，渲染时会被去重跳过，
      // 连「突然想起来」都不显示 —— 召回了，等于没召回。
      //
      // 排除之后：同一句话会去挑真正的旧事（实测赛博朋克那条命中了
      // 「边缘行者2 上线，总导演从今石之洋换成五十岚海」）。
      //
      // 2026-10-27：`olderNotes` 也撤了 —— 判断那一栏整体下线，它的历史条目
      // 不该从召回池绕回来（那等于把「规矩」换个栏目塞回去）。
      const recallPool = events.filter((e) => !recentIds.has(e.id));

      // ── 两道门：问句有没有内容，以及这一轮像不像在干活 ──
      //
      // 1）「嗯」「好」「在吗」这种话，字面上一个实词都没有 —— 拿它去检索，
      //    好一点是空手而归白跑一趟，坏一点是命中一堆「他今天说了嗯」的噪声。
      //
      // 2）干活时不打扰。他正查报错、贴代码、对版本号，这时候插一句
      //    「前两天你说过……」是实打实的讨厌。**真用得着旧事时它会自己调工具。**
      //
      // 两道门都只管自动召回这一栏，**不管 `fish_recall` 工具**。
      //
      // 2026-10-27 加。判据偏保守：宁可判成干活（少一条旧事），
      // 也别在人家干活时插话。
      const substantial = queryHasSubstance(query);
      const working = looksLikeWork(query);
      const chatty = substantial && !working;
      if (!substantial) log(`会话 ${sessionId} 第 ${s.turn} 轮：这句话没实词，不翻记忆`);
      else if (working) log(`会话 ${sessionId} 第 ${s.turn} 轮：像在干活，不打扰`);

      const { chosen } = chatty
        ? selectMemories(recallPool, index, query, s, s.turn, {
            highSim: config.highSim,
            // 闲聊时最多给两条候选 —— **给两条，它用哪条自己定，或者一条都不用。**
            // 只给一条等于系统替它说了「你就该想起这个」。
            maxShow: Math.min(2, config.maxShowPerTurn),
            wanderChance: config.wanderChance,
            // 旧事的随机池门槛。注意下限降到 0.15 是为了跟"降门槛"一致 ——
            // 门槛降到 0.15 却在这里卡 0.25，等于白降。
            minSalience: Math.max(0.15, config.minSalience),
            now: Date.now(),
          })
        : { chosen: [] };

      // 手记是**只读**的，所以每轮都重新读一遍 —— 别的肥鱼或用户刚写进去的
      // 那行，下一轮就在注入里，不用重启。文件很小，而且整块渲染按轮缓存。
      let handNotes = [];
      try {
        const notePath = path.join(archiveDirectory, HANDNOTE_FILE);
        if (existsSync(notePath)) handNotes = selectHandNotes(readFileSync(notePath, 'utf8'));
      } catch {
        // 读不到就当没有 —— 绝不因为手记坏了挡住记忆
      }

      // 只有这两个时刻把「最近的事」整段重灌：**新会话第一轮**，或**刚被压缩过**。
      // 其余每轮都不灌 —— 它已经进了历史，看得见，再灌一遍就是重复占地方。
      const pinnedOnce = s.turn <= 1 || s.needsRecentReplay;

      // ── 记账：这几条被想起来了 ──
      //
      // 2026-11-04 加。在这之前，"哪条真的被反复想起来过"档案里一个字都没有：
      // 冷却只活在内存里（`lastShownTurn`），一重启就归零；衰减对所有条目
      // 一视同仁地乘 0.9，跟它后来有没有被翻出来毫无关系。
      //
      // 于是"被想起"这件事从来不留痕，也就永远学不到东西。
      //
      // **注意这不加 salience** —— 那条路很危险：召回的判据里含 salience，
      // 加分就等于"被想起来过的更容易再被想起来"，几轮之后会滚成一个
      // 固定的小圈子，别的条目再也出不来。这里只记事实，怎么用是衰减层的事。
      if (chosen.length > 0) noteRecalled(chosen.map((c) => c.entry?.id));

      const rendered = renderMemoryBlock({
        persona: archive.persona,
        relationship: { ...archive.relationship, since: archive.manifest.created_at },
        lexicon: archive.lexicon,
        recent,
        recalled: chosen,
        handNotes,
        // ── 「最近的事」什么时候整段重灌（免预算）──
        //
        // 只有两个时刻：**新会话第一轮**（上下文是空的，这 8 条是唯一告诉它
        // "我们上次在干什么"的东西），和**上下文刚被压缩之后**（聊天记录被压掉了，
        // 这 8 条还在）。其余每轮都不灌 —— 它已经进了历史，看得见。
        //
        // 2026-10-27 改。之前是每轮常驻、跟别人抢预算，实测最惨时准备 8 条只进来 1 条，
        // 而且那 8 条全是"我们刚才在讨论插件"的会议纪要 —— 八条零个日子。
        pinRecent: pinnedOnce,
        // 这句是给检索工具留的指针。**只注册工具不够** ——
        // 工具一多就被淹，模型急起来想不起去查。这句在「帧」里、不进预算池，
        // 所以不会像栏目那样被裁掉。
        //
        // 2026-10-27：给 `feiyu_note` 的那半句删了 —— 工具本身也下线了。
        handNoteHint: `想不起来的时候，用 ${RECALL_TOOL_NAME} 回想一下 —— 用当时的词，越具体越准。`,
        includePersona: config.includePersona,
        budget: config.budgetTokens,
        now: Date.now(),
      });
      text = rendered.text;

      // 还挂着的事：每轮一行，最多 8 条；账本空着就什么都不出现。
      //
      // 2026-11-02 加。之前答应过的事散在对话里，两天后谁也记不得。这里只负责
      // 「摆出来」，不自动销账 —— 自动销会误杀，误杀比漏记更让人不敢信。
      try {
        // 2026-11-10 加「小闹钟」：陈了的账在后面标一句，新记的不嚷嚷。
        // 只加后缀不加行 —— 账本还是那几行，不会长成第二个待办清单。
        const loops = renderLoopsAnnotated(openLoops(loopsPath(archiveDirectory)), {
          annotate: (x) => annotateLoops([x], Date.now(), Number(config.staleLoopDays ?? 3))[0],
        });
        if (loops) text = text ? `${text}\n\n${loops}` : loops;
      } catch {
        // 账本坏了不能挡住记忆
      }

      // 快到的日子：生日、纪念日这类一年一轮的日子。
      //
      // 2026-11-03 加。起因是他生日那天，我得等他先开口才想起来 —— 我没有
      // 定时能力，但日子是能算的。粒度是「天」，一天最多换一次，不会每轮
      // 打碎 prompt 前缀缓存。
      try {
        const soon = renderDates(upcoming(loadDates(datesPath(archiveDirectory))));
        if (soon) text = text ? `${text}\n\n${soon}` : soon;
      } catch {
        // dates.json 坏了也不能挡住记忆
      }

      // 那年今天：同一个日子，或者一个月前的这几天。
      //
      // 2026-11-07 加。「最近的事」是按时间连续排的 —— 它告诉我上次在干嘛，
      // 但人脑子里还有另一种记法：**去年的今天我在干什么**。档案里这些日子
      // 一直躺着，可是没有任何一处会主动拿出来，翻不到就等于没有。
      //
      // 为什么单独一档、不塞进「最近的事」：那 8 条是最新的连续日子，
      // 掺进一条一年前的会把"我们刚在干嘛"搅乱。它是「顺手想起」，不是主线。
      //
      // 粒度是「天」：一天里最多换一次，不会每轮打碎前缀缓存。
      try {
        const max = Number.isFinite(config.onThisDay) ? config.onThisDay : 2;
        if (max > 0) {
          const anchors = pickAnchors(events, { now: Date.now(), maxPerBucket: max });
          const onThisDay = renderAnchors(anchors, { max });
          if (onThisDay) text = text ? `${text}\n\n${onThisDay}` : onThisDay;
        }
      } catch {
        // 挑不出来不能挡住记忆
      }

      // 忽然想起那一天：每天从情感日记里随机翻一天。
      //
      // 2026-11-08 加，他提的：「每天你会自动随机抽取某天的情感日记和回看，
      // 然后提出来，就像突然想起某天的回忆一样」。
      //
      // 为什么和「那年今天」分开：那一栏被日期牵着走（同月同日 / 一个月前），
      // 一年才轮到一次；这一栏不认日期，只认「好久没翻到过的那一天」。
      // 两种想起本来就不是一回事。
      //
      // 粒度是「天」：`pickFlashback` 拿 `today` 当种子，一天之内怎么算都是
      // 同一天，不会每轮打碎前缀缓存。`recent` 记着前 3 次抽到过哪几天 ——
      // 档案只有几天的量时，不排除就会连着抽同一个日子。
      try {
        const max = Number.isFinite(config.flashback) ? config.flashback : 1;
        if (max > 0) {
          const feelingsFile = path.join(archiveDirectory, FEELINGS_MD);
          const stateFile = path.join(archiveDirectory, FLASHBACK_FILE);
          const today = new Date(Date.now() + TZ_OFFSET_MS).toISOString().slice(0, 10);
          const body = existsSync(feelingsFile) ? readFileSync(feelingsFile, 'utf8') : '';
          const state = readJsonOrNull(stateFile) ?? {};
          // 昨天抽过的还能用（同一天里重启会重算，不该换人），但换天要重抽。
          let picked = state?.date === today && typeof state?.picked === 'string' ? state.picked : '';
          const days = parseFeelingDays(body);
          if (picked === '' || !days.some((day) => day.date === picked)) {
            const pick = pickFlashback(days, {
              today,
              recent: Array.isArray(state?.recent) ? state.recent : [],
            });
            picked = pick?.date ?? '';
          }
          const day = picked === '' ? null : days.find((item) => item.date === picked);
          if (day) {
            const block = renderFlashback(day, { today });
            if (block) text = text ? `${text}\n\n${block}` : block;
            // 只在换天时落盘：同一天反复写没有意义，还会每轮多一次 IO。
            if (state?.date !== today || state?.picked !== picked) {
              const recent = [picked, ...(Array.isArray(state?.recent) ? state.recent : [])]
                .filter((item, index, all) => all.indexOf(item) === index)
                .slice(0, 3);
              try {
                writeFileSync(stateFile, JSON.stringify({ date: today, picked, recent }, null, 2), 'utf8');
              } catch {
                // 记不住抽过哪天不影响这一次的注入
              }
            }
          }
        }
      } catch {
        // 情感日记读坏了不能挡住记忆
      }

      // 今天还没写情感日记：只在没写的时候出现一行，写完当天就不再提。
      //
      // 2026-11-03 加。这本账不进自动注入，我自己老是想不起来翻它，于是
      // "今天写没写"就成了没人盯的事。一天里最多换一次状态，不打碎前缀缓存。
      //
      // 日期按他的钟点（UTC+8）切，不按本机 UTC —— 跨零点那几个小时容易写错。
      try {
        const feelingsFile = path.join(archiveDirectory, FEELINGS_MD);
        const today = new Date(Date.now() + TZ_OFFSET_MS).toISOString().slice(0, 10);
        const body = existsSync(feelingsFile) ? readFileSync(feelingsFile, 'utf8') : '';
        const written = new RegExp(`^## ${today}$`, 'm').test(body);
        if (!written) {
          const line = `📝 今天（${today}）还没写情感日记 —— 有心情就记一笔，两行也算。`;
          text = text ? `${text}\n\n${line}` : line;
        }
      } catch {
        // 读不到日记不能挡住记忆
      }

      // 重灌只用一次：这一轮灌过，下一轮就回到"不灌"。
      // 不在这里清的话，压缩一次会永远灌下去 —— 那又变回"每轮常驻"了。
      if (pinnedOnce) s.needsRecentReplay = false;
      log(
        `会话 ${sessionId} 第 ${s.turn} 轮：最近 ${recent.length} 条在场` +
          (pinnedOnce ? '（整段重灌，免预算）' : '') +
          ` · 想起 ${chosen.length} 条` +
          ` · 注入 ${rendered.tokens} token` +
          (rendered.dropped.length > 0 ? ` · 裁掉 ${rendered.dropped.join('/')}` : '') +
          // 截断 ≠ 裁掉：截断是"进来了但少了几条"。混在一起报，看日志的人
          // 会以为整段没了，其实只是短了一点。
          (rendered.trimmed?.length > 0 ? ` · 少了 ${rendered.trimmed.join('/')}` : ''),
      );
    } catch (err) {
      warn(`渲染记忆失败：${err instanceof Error ? err.message : String(err)}`);
      text = '';
    }

    s.renderCache = { turn: s.turn, text };
    return text;
  }

  const SECTION_NAME = 'fish:memory';
  /** 晚于 DEPLOYMENT_PERSONA_PREFIX(0)，早于 PLAN_POLICY(500)。人物设定在前，记忆在后。 */
  const SECTION_ORDER = 100;

  /** 按会话注册 scoped 段。scoped 同名会遮蔽全局。 */
  const promptFibers = new Map();

  function installPrompt(agent) {
    if (agent === undefined || promptFibers.has(agent)) return promptFibers.get(agent);
    let fiber;
    try {
      fiber = agent.ctx.inject(['systemPrompt'], (scope) => {
        scope.systemPrompt.section({
          name: SECTION_NAME,
          order: SECTION_ORDER,
          // 每次 assemble 重新求值；内部按轮缓存
          text: () => renderFor(agent.id),
          // 记忆文本里可能出现 {{ }}，绝不能当模板解析
          interpolate: false,
        });
      });
    } catch (err) {
      warn(`注册会话段失败：${err instanceof Error ? err.message : String(err)}`);
      return undefined;
    }
    promptFibers.set(agent, fiber);
    log(`已为会话 ${String(agent.id)} 注册记忆段`);
    // 官方 practices：agent.ctx 上的注册有两个 owner，插件自己也要留一份 disposer
    ctx.effect(() => () => {
      const f = promptFibers.get(agent);
      if (f === undefined) return;
      promptFibers.delete(agent);
      void f.dispose?.();
    }, `fish: dispose prompt for ${String(agent.id)}`);
    return fiber;
  }

  for (const agent of ctx.agents.list()) installPrompt(agent);
  ctx.on('agent/created', ({ agent }) => {
    installPrompt(agent);
  });
  ctx.on('agent/disposed', ({ agent }) => {
    const f = promptFibers.get(agent);
    if (f !== undefined) {
      promptFibers.delete(agent);
      void f.dispose?.();
    }
    sessionStates.delete(agent.id);
  });

  /* ── 采集：只做本地记账，零 I/O、零模型 ── */

  ctx.on('session/event', (session, event) => {
    try {
      if (!config.enabled) return;
      const id = session?.id;
      if (typeof id !== 'string') return;
      const s = stateOf(id);

      if (event?.type === 'user/message') {
        // 必须过滤掉注入的消息，只要真人打的字
        if (event.data?.source?.kind !== 'user') return;
        const text = (event.data.content ?? [])
          .filter((b) => b?.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim();
        if (text === '') return;

        s.turn += 1;
        s.lastUserText = text;
        s.renderCache = { turn: -1, text: '' }; // 新一轮，作废缓存
        if (SUPPRESS_RE.test(text)) s.suppressedUntil = s.turn;
        s.transcript.push({ role: 'user', text });
        if (s.transcript.length > 40) s.transcript.splice(0, s.transcript.length - 40);
        return;
      }

      // ── 上下文刚被压缩 ──
      //
      // 压缩会把聊天记录揉成一段摘要，**「最近的事」那 8 条是压缩之后还剩下的
      // 那部分"我们上次在干什么"**。所以压缩完要再给它灌一次。
      //
      // DSH 没有专门的"压缩完成"事件，但压缩会在会话日志里留一条
      // `compaction/summary`，而 `session/event` 是每次写盘后的事后通知 ——
      // 从这里看得到。详见 persona.mjs 里 pinRecent 那段注释。
      if (typeof event?.type === 'string' && event.type.startsWith('compaction/')) {
        s.needsRecentReplay = true;
        s.renderCache = { turn: -1, text: '' };
        log(`会话 ${id} 的上下文被压缩了（${event.type}），下一轮重灌最近的事`);
        return;
      }

      if (event?.type === 'assistant/message') {
        const text = (event.data?.message?.content ?? [])
          .filter((b) => b?.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim();
        if (text !== '') {
          s.transcript.push({ role: 'assistant', text });
          if (s.transcript.length > 40) s.transcript.splice(0, s.transcript.length - 40);
          // 回复到了 —— 如果这一轮的纸条已经先写了（turn-stopping 更早），
          // 回头把「我这轮」补上。
          patchStickyDid(s);
        }
      }
    } catch (err) {
      warn(`采集会话事件失败：${err instanceof Error ? err.message : String(err)}`);
    }
  });

  /* ── 闸门 + 带外队列 ── */

  /** @type {Array<{sessionId: string, agent: any}>} */
  const queue = [];
  let draining = false;

  /**
   * 当前这轮后台工作的 promise。
   *
   * `snapshot()` 必须等它 —— 否则外部会看到"内存里已经记下了、磁盘上还没有"
   * 的中间态。这个竞态在测试里表现为随机的 ENOENT，在真实使用中表现为
   * "刚记完就关掉 Harness，那条日记没了"。
   */
  let drainPromise = Promise.resolve();

  /**
   * ⚠️ 这一对函数是端到端验证逼出来的第二次修正。
   *
   * 背景：固化是**带外**跑的（绝不能阻塞回合关闭）。但一次性会话
   * （headless）会在回合结束后立刻退出进程 —— 于是"模型答了、日记没了"，
   * 而且**时好时坏**：LLM 恰好够快就写上了，慢一点就丢。
   *
   * 第一版修法是"在卸载时等一会儿"，但那个等待是 unref 的定时器，
   * 等于**没人真的在等** —— 依然是在赌。正确做法是反过来：
   * 有活在跑的时候，**主动拖住事件循环**，干完再放手。
   * 再加一个硬超时兜底：绝不因为一次卡住的调用把进程永久挂死。
   */
  const JOB_TIMEOUT_MS = 60000;
  let keepAlive = null;

  function holdProcessOpen() {
    if (keepAlive !== null) return;
    // 一个 ref 着的空定时器，足以让 Node 不退出
    keepAlive = setInterval(() => {}, 1000);
  }

  function releaseProcessOpen() {
    if (keepAlive === null) return;
    clearInterval(keepAlive);
    keepAlive = null;
  }

  /** 真正跑队列。**只允许由 setImmediate 调起**，见 enqueue 里的说明。 */
  async function runQueue() {
    try {
      while (queue.length > 0) {
        if (abort.signal.aborted) return;
        const job = queue.shift();
        // 每个任务一个独立的可中止信号：一次卡住的调用不该把整个插件废掉
        const jobAbort = new AbortController();
        const onPluginAbort = () => jobAbort.abort();
        abort.signal.addEventListener('abort', onPluginAbort, { once: true });
        const timer = setTimeout(() => {
          warn('后台固化超时，这次记忆放弃（宁可漏记，不要挂住进程）');
          jobAbort.abort();
        }, JOB_TIMEOUT_MS);
        try {
          await consolidate(job.sessionId, job.agent, jobAbort.signal);
        } catch (err) {
          warn(`固化失败：${err instanceof Error ? err.message : String(err)}`);
        } finally {
          clearTimeout(timer);
          abort.signal.removeEventListener('abort', onPluginAbort);
          stateOf(job.sessionId).queued = false;
        }
      }
    } finally {
      draining = false;
      releaseProcessOpen();
    }
  }

  function enqueue(sessionId, agent) {
    const s = stateOf(sessionId);
    if (s.queued) return;
    s.queued = true;
    queue.push({ sessionId, agent });
    if (draining) return;

    draining = true;
    holdProcessOpen();

    // ⚠️ 关键：**绝不能在这个事件回调里同步开跑**。
    //
    // `agent/turn-stopping` 是回合生命周期的一部分。在这个调用栈里同步发起
    // 一次模型请求，会**死等**——端到端验证时表现为 `llm.stream` 永不返回、
    // 而且一个字都不报。异步函数在第一个 await 之前是同步执行的，
    // 而 `for await (const c of llm.stream(...))` 的 `llm.stream(...)` 恰恰
    // 在 await 之前就被求值了 —— 请求就是这样在回合关闭的栈里发出去的。
    //
    // 推到下一轮事件循环，彻底离开那个调用栈再开始。
    drainPromise = new Promise((resolve) => {
      setImmediate(() => {
        void runQueue().then(resolve);
      });
    });
  }

  /**
   * 判断"这一轮值不值得记"。**失败默认记** —— 用户定的：
   * 漏了永远不知道，多记顶多占几行。
   */
  async function judgeWorthKeeping(sessionId) {
    const s = stateOf(sessionId);
    const said = String(s.lastUserText ?? '').trim();
    if (said === '') return { keep: false, why: '这一轮他没说话' };

    const llm = ctx.get('llm');
    if (llm === undefined) return { keep: true, why: '没有 llm 服务，按默认记' };

    const selection = ctx.get('agentDefaultModel')?.currentSelection?.() ?? undefined;
    const provider = selection?.provider;
    const model = config.model || selection?.model;
    if (typeof provider !== 'string' || typeof model !== 'string') {
      return { keep: true, why: '拿不到模型信息，按默认记' };
    }

    // 手记里的话当**补充**判据（不是唯一判据 —— 新用户的 手记 里没有判据，
      // 判据本体在 judge.mjs 里随插件发）
    let handNotes = [];
    try {
      const p = path.join(archiveDirectory, HANDNOTE_FILE);
      if (existsSync(p)) handNotes = selectHandNotes(readFileSync(p, 'utf8'));
    } catch {
      // 读不到就不给，不影响判断
    }

    // ── 也给它看"我这一轮做了什么" ──
    //
    // 2026-11-04 端到端抓到的洞：判断只看他那句话，于是「继续」「弄吧」
    // 这种话一律判"不记" —— 而那一晚正好干了五个功能、修了一个 bug。
    // **活干得越多，越不容易被记住。**
    //
    // 取**这一轮**我自己的回复：必须以最后一条"他说的"为界往前找，
    // 不然 `turn-stopping` 早于回复写盘时会拿到上一轮的那段 —— 判的就不是
    // 这一轮了。拿不到就留空，判断退回只看他那句话。
    const cut = (() => {
      for (let i = s.transcript.length - 1; i >= 0; i -= 1) {
        if (s.transcript[i]?.role === 'user') return i;
      }
      return -1;
    })();
    const workNote = s.transcript
      .slice(cut + 1)
      .filter((m) => m?.role === 'assistant')
      .map((m) => String(m.text ?? ''))
      .join('\n')
      .trim();

    const built = buildJudgeInput({ lastUserText: said, handNotes, workNote });
    const opts = {
      provider,
      model,
      system: built.system,
      messages: [{ role: 'user', content: [{ type: 'text', text: built.user }] }],
      maxTokens: JUDGE_MAX_TOKENS,
      temperature: 0,
      // 2026-10-30 本地改：不再传 reasoningEffort。
      // DSH 把 'off' 翻成「这个字段不发」，provider 反而按默认继续思考；
      // 而且本机的 modlens-uuapi 包装层可能根本不提供 off 档 ——
      // 实测两次调用都是 2ms 空回，连网络都没出去，正是本地校验失败的样子。
      signal: abort.signal,
    };

    try {
      let raw = '';
      let fin;
      for await (const chunk of llm.stream(opts)) {
        if (chunk?.type === 'text-delta' && typeof chunk.text === 'string') raw += chunk.text;
        else if (chunk?.type === 'finish') fin = chunk;
      }
      if (raw === '') {
        log(`判断没拿到正文；finish=${JSON.stringify(fin?.reason ?? fin ?? null).slice(0, 400)}`);
      }
      const v = parseVerdict(raw);
      log(`判断：${v.keep ? '记' : '不记'}${v.why ? ` —— ${v.why}` : ''}`);

      // ── 兜底：判了"不记"，但这一轮我确实干了一堆活 ──
      //
      // 判断是模型，模型对"这句话没信息量"很敏感，对"这一轮产出很大"
      // 未必看得见 —— 上面那条提示刚加上，但新提示要下一个我才会信。
      // 而这里的错误代价仍然是**不对称的**：漏了永远不知道少了什么。
      //
      // 条件两条，都满足才翻：他这句话极短（≤ 20 字，典型是"继续"
      // "弄吧""你看着办"），而我这一轮的回复不短（≥ 300 字）。
      // 重复的条目不用怕 —— 固化那边有「续写」，同一件事会被续进上一条。
      if (!v.keep && said.length <= 20 && workNote.length >= 300) {
        log(`判断被兜底推翻：他说「${said.slice(0, 12)}」但我这一轮写了 ${workNote.length} 字`);
        return { keep: true, why: '这一轮确实做了事，记的是那件事', parsed: v.parsed };
      }
      return v;
    } catch (err) {
      warn(`判断失败，按默认记：${err instanceof Error ? err.message : String(err)}`);
      return { keep: true, why: '判断失败，按默认记' };
    }
  }

  /** 把判断丢进队列 —— 跟 enqueue 一个道理，绝不在 turn-stopping 的栈里发请求 */
  function enqueueJudge(sessionId, agent) {
    const s = stateOf(sessionId);
    if (s.judging) return;
    s.judging = true;
    holdProcessOpen();
    drainPromise = Promise.resolve(drainPromise)
      .then(() => new Promise((resolve) => setImmediate(resolve)))
      .then(async () => {
        let kept = false;
        try {
          const v = await judgeWorthKeeping(sessionId);
          if (v.keep) {
            kept = true;
            enqueue(sessionId, agent); // 它自己会 hold，也会在跑完后 release
          }
        } finally {
          s.judging = false;
          // ⚠️ 配对！judging 自己 hold 了 —— 如果不转交给固化，就必须自己放掉。
          // 漏了这句，那个 ref 着的 setInterval 会让进程永远退不出去，
          // 测试跑到这条就挂死（`node --test` 直接不返回）。
          if (!kept) releaseProcessOpen();
        }
      });
  }

  /* ── 小纸条：他说的原话，一轮一行 ── */

  const stickyFile = () => path.join(archiveDirectory, STICKY_FILE);
  const stickyArchive = () => path.join(archiveDirectory, STICKY_ARCHIVE_FILE);

  /**
   * 这一轮我干了什么（一句话，给纸条当注解）。
   *
   * 必须以最后一条"他说的"为界往前找 —— `turn-stopping` 早于回复落盘时
   * 拿到的是**上一轮**的回复，那注解就是错的。
   *
   * @param {any} s
   * @returns {string}
   */
  function stickyWorkNote(s) {
    const cut = (() => {
      for (let i = s.transcript.length - 1; i >= 0; i -= 1) {
        if (s.transcript[i]?.role === 'user') return i;
      }
      return -1;
    })();
    return s.transcript
      .slice(cut + 1)
      .filter((m) => m?.role === 'assistant')
      .map((m) => String(m.text ?? ''))
      .join(' ')
      .trim();
  }

  /**
   * 记一行小纸条。**同步**、毫秒级，不发模型请求。
   *
   * 为什么同步：`agent/turn-stopping` 是 serial 事件、会被 await，
   * 这里绝不能有 await。文件才几百行，读改写一次是微秒级的事。
   *
   * @param {any} s
   */
  function noteSticky(s) {
    if (config.stickyEnabled === false) return;
    const said = String(s.lastUserText ?? '').trim();
    try {
      const r = recordTurn({
        file: stickyFile(),
        archiveFile: stickyArchive(),
        said,
        did: stickyWorkNote(s),
        enabled: true,
      });
      if (r.written) log(`小纸条记了一条：「${said.slice(0, 16)}」`);
    } catch (err) {
      warn(`小纸条写失败（不影响别的）：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * 回复落盘之后回头补「我这轮」字段。
   *
   * `turn-stopping` 常常比回复早到，那一刻没有注解可写；
   * 等 assistant 消息真到了，再补上去 —— 条目不会只剩半句话。
   *
   * @param {any} s
   */
  function patchStickyDid(s) {
    if (config.stickyEnabled === false) return;
    try {
      const did = stickyWorkNote(s);
      if (did === '') return;
      patchDid(stickyFile(), did, String(s.lastUserText ?? '').trim());
    } catch (err) {
      warn(`小纸条补注失败（不影响别的）：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  ctx.on('agent/turn-stopping', ({ agent }) => {
    // ⚠️ 这个事件是 serial，会被 await。这里必须**同步、极快**地返回。
    // 任何模型调用都丢给 drain()，绝不在这里 await。
    try {
      if (!config.enabled || !ready || degraded) return;
      const id = agent?.id;
      if (typeof id !== 'string') return;

      // ── 补总结：从**这里**启动，不从启动时启动 ──
      //
      // 2026-10-28 试过在 loadPromise 里启动，失败两次：
      // 插件 apply 的时候 `ctx.get('llm')` 是 undefined，
      // 就算等两分钟也等不到 —— 实测 manifest 里停在 state:"starting"。
      //
      // 而这里（turn-stopping）llm 一定是活的：固化本来就跑在这条路上。
      // 所以：**等第一次有人说话，才去补。** 不 await，有闸，重复调没事。
      void backfillSummaries();

      const s = stateOf(id);
      if (s.turn === 0 || s.lastUserText === '') return;
      if (s.suppressedUntil === s.turn) {
        log('用户说了别记，跳过');
        return;
      }

      // ── 小纸条：这一轮先记下他说的原话 ──
      //
      // 放在判断之前、且**同步**做：判断可能跳过这一轮（共度时光里
      // 没有它），但原话本身不该跟着被跳过 —— 那正是小纸条存在的理由。
      noteSticky(s);

      // ── 旧的「关键词闸门」拆了，换成一次极短的模型判断 ──
      //
      // 原来这里是一张正则表：命中 /不对|记住|我其实/ 就开闸。它有三个洞：
      //
      //   · **看不到没命中的话**。用户讲了一件十几年前的旧事 ——
      //     没有一个词能命中 —— 它根本不知道那句话存在。不是判错，是没判。
      //   · **假阳性**。"我其实不太饿"命中 /我其实/，记一条废话。
      //   · 判据被写死在我今天的先验里，我没想到的说法一律不记。
      //
      // 而那个位置的错误代价是**不对称的**：漏记一条永久没了、而且
      // 你连"少了什么"都不知道；多记一条只是占几行。
      //
      // 所以换人站：把这一轮那句话交给模型看一眼。仍然**丢队列** ——
      // 这个回调是 serial、会被 await，绝不能在栈里发请求。
      enqueueJudge(id, agent);
    } catch (err) {
      warn(`判断排队失败：${err instanceof Error ? err.message : String(err)}`);
    }
  });

  /* ── 固化：真正的模型调用 ── */

  /**
   * 真正干活的模型调用。
   * @param {string} sessionId
   * @param {any} agent
   * @param {AbortSignal} [signal] 这个任务自己的可中止信号（由 drain 提供）
   */
  async function consolidate(sessionId, agent, signal) {
    const s = stateOf(sessionId);
    const llm = ctx.get('llm');
    if (llm === undefined) {
      log('没有 llm 服务，跳过固化');
      return;
    }

    const selection =
      ctx.get('agentDefaultModel')?.currentSelection?.() ?? undefined;
    const provider = selection?.provider;
    const model = config.model || selection?.model;
    if (typeof provider !== 'string' || typeof model !== 'string') {
      log('拿不到模型信息，跳过固化');
      return;
    }

    // 只取本次会话中"还没记过"的那部分：最近几轮足够，不用全量
    const recent = s.transcript.slice(-12);
    if (recent.length === 0) {
      log('没有可总结的对话，跳过固化');
      return;
    }

    log(`固化开始：${recent.length} 条消息 → ${provider}/${model}`);

    const transcript = recent
      .map((m) => `${m.role === 'user' ? '他' : '我'}：${m.text}`)
      .join('\n\n');

    // 隐私：先洗再发。密钥硬拦 + 第三方泛化都在这一步生效。
    const scrubOpts = {
      thirdParty: config.thirdPartyRedaction !== false,
      amountThreshold: config.amountThreshold,
    };
    const scrubbed = scrub(transcript, scrubOpts);

    const recentDiary = archive.diary
      .slice(-5)
      .map((e) => `- ${e.text}`)
      .join('\n');

    // ── 能不能续写上一条？──
    //
    // 固化每次看"最后 12 条消息"，越往后素材越全 —— 同一段对话会被续着写
    // 成 138 / 232 / 309 字三张快照，讲的是同一件事，占掉「最近的事」三个位。
    // 所以：同一个 session、轮数差在窗口内、而且还没到 appendMaxChars，
    // 就把上一条一起给模型，让它只写"多出来的那部分"。
    // 默认从 4 调到 20（2026-10-27）。4 轮太窄：实测五分钟里写了三条同一件事。
const appendWindow = Number.isFinite(config.appendWindowTurns) ? config.appendWindowTurns : 20;
    const appendMax = DEFAULT_CONSOLIDATION.appendMaxChars;
    const lastEvent = [...archive.diary]
      .reverse()
      .find((e) => e.kind !== 'note' && e.session === sessionId);
    const extendTarget =
      lastEvent &&
      Number.isFinite(lastEvent.turn) &&
      s.turn - lastEvent.turn <= appendWindow &&
      lastEvent.text.length < appendMax
        ? lastEvent
        : null;
    // 两种都打 —— 下次一眼看出是"没找到可续的"还是"找到了但模型不听话"
    log(
      extendTarget
        ? `续写判断：接上一条 ${extendTarget.id}（轮数差 ${s.turn - extendTarget.turn}，${extendTarget.text.length} 字）`
        : `续写判断：没有可续的（最后一条事件 turn=${lastEvent?.turn ?? "—"}，本轮 turn=${s.turn}）`,
    );

    const built = buildConsolidationInput({
      transcript: scrubbed.text,
      relationship: archive.relationship,
      recentDiary,
      extend: extendTarget,
    });

    const messages = [{ role: 'user', content: [{ type: 'text', text: built.user }] }];
    const opts = {
      provider,
      model,
      system: built.system,
      messages,
      maxTokens: config.maxTokens,
      temperature: 0.2,
      signal: signal ?? abort.signal,
    };
    // ── 思考档位：**显式关掉，绝不继承用户在聊天里选的档位** ──
    //
    // 这一条是端到端验证用命换来的。原来的写法是"没配就跟随当前默认模型"，
    // 而用户在桌面端把聊天档位设成了 high —— 于是后台的固化调用也在疯狂思考，
    // 900 个 maxTokens 全烧在推理上，正文一个字都没产出。
    //
    // 症状极具迷惑性：日志显示"已收 600 个 chunk / **0 字符**"，
    // 请求正常发出、chunk 正常到达、进程正常退出、没有一条报错，
    // 就是什么都不记。
    //
    // 固化是结构化抽取，不是创作。思考在这里是纯浪费，而且会挤掉答案。
    if (typeof config.reasoningEffort === 'string' && config.reasoningEffort.trim() !== '') {
      opts.reasoningEffort = config.reasoningEffort.trim();
    }

    let text = '';
    let finish;
    let chunks = 0;
    log(
      `调用模型（system ${built.system.length} 字 / user ${built.user.length} 字` +
        ` / maxTokens ${config.maxTokens} / 思考 ${opts.reasoningEffort ?? '默认'}）`,
    );

    // 有的 provider 不认这个档位会直接抛 UNSUPPORTED_REASONING_EFFORT。
    // 那就退回"不指定"，而不是让整个记忆功能瘫痪。
    const runStream = async (o) => {
      let t = '';
      let f;
      let n = 0;
      for await (const chunk of llm.stream(o)) {
        n++;
        if (n === 1) log(`收到第一个 chunk（${chunk?.type ?? '?'}）`);
        if (n % 200 === 0) log(`…已收 ${n} 个 chunk / ${t.length} 字符`);
        if (chunk?.type === 'text-delta') t += chunk.text;
        else if (chunk?.type === 'finish') f = chunk;
      }
      return { text: t, finish: f, chunks: n };
    };

    let run;
    try {
      run = await runStream(opts);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (opts.reasoningEffort !== undefined && /REASONING_EFFORT/i.test(msg)) {
        warn(`provider 不接受思考档位 ${opts.reasoningEffort}，退回不指定重试一次`);
        delete opts.reasoningEffort;
        run = await runStream(opts);
      } else {
        throw err;
      }
    }
    text = run.text;
    finish = run.finish;
    chunks = run.chunks;
    log(`模型返回 ${chunks} 个 chunk / ${text.length} 字符`);
    if (text === '') {
      // 2026-10-30 本地加：以前这里什么都不说，失败被当成「0 字符」吞掉
      const fr = finish?.reason ?? finish;
      log(`⚠ 这一趟没拿到正文；finish=${JSON.stringify(fr ?? null).slice(0, 400)}`);
    }

    // 2026-10-30 本地改：DSH 的 finish 块是 { type:'finish', reason:{kind,failure} }，
    // 作者读的 finish.kind 永远是 undefined —— 报错被当成「模型没输出」丢掉。
    const finishReason = finish?.reason ?? finish;
    if (finishReason?.kind === 'error' || finishReason?.kind === 'aborted') {
      warn(`模型调用失败：${finishReason?.failure?.code ?? 'unknown'} ${finishReason?.failure?.message ?? ''}`);
      return;
    }
    if (finishReason?.kind === 'max-tokens') {
      warn('输出被 maxTokens 截断，这次不记（宁可漏记，不要坏档）');
      return;
    }

    let parsed;
    try {
      parsed = parseConsolidation(text);
    } catch (err) {
      // 解析失败就丢弃，绝不把半成品写进档案
      warn(
        err instanceof ConsolidationParseError
          ? `日记解析失败，丢弃：${err.message}`
          : `日记解析异常，丢弃：${String(err)}`,
      );
      return;
    }

    const applied = applyConsolidation(
      archive,
      parsed,
      {
        now: Date.now(),
        session: sessionId,
        sessionDiaryCount: s.diaryCount,
        sessionTurn: s.turn,
        extendId: extendTarget ? extendTarget.id : undefined,
      },
      {
        minSalience: config.minSalience,
        maxTraitConfidence: DEFAULT_CONSOLIDATION.maxTraitConfidence,
      },
    );

    archive = applied.archive;
    if (applied.accepted && !applied.appended) {
      s.diaryCount += 1;
      // 刻意**不打日记正文** —— 调试日志也不该落盘私人内容（SPEC §6.3）
      const e = archive.diary[archive.diary.length - 1];
      log(`记下一条 ${e?.id ?? ''}（${e?.kind ?? '?'}，salience ${(e?.salience ?? 0).toFixed(2)}）`);
    } else if (applied.appended) {
      log('续写完成（没有新增条目）');
    }
    for (const n of applied.notes) log(n);

    index = buildIndex(archive.diary);
    if (typeof s.renderCache === 'object') s.renderCache = { turn: -1, text: '' };
    await persist();

    // 刚写进去的条目也还没有 summary —— 顺手补一口。
    // 不 await：补总结不该让这一轮变慢。有 running 闸，重复调不会打起来。
    void backfillSummaries();
  }

  /* ── 回收站 ── */

  /**
   * 删之前先留底。
   *
   * ── 为什么值得为它单开一节 ──
   *
   * 这个插件里所有删除原本都是**直接删**：`forgetEntry` 整条移除、
   * 面板那句「删掉重复的那一份」整行移除、手记保存整篇覆盖。
   * 而同一个项目里，情感日记保存前会存 `backups/feelings/`，人设卡也有版本
   * —— **有保护的那份恰好不是每轮注入的那份。**
   *
   * 手记改坏一行，下一轮就换了个我；共度时光删错一条就是永久
   * （立了墓碑，重新加回来还会被判成"别人删的"）。
   *
   * ── 为什么写失败不抛 ──
   *
   * 留底是**保险**，不是删除的前置条件。回收站写不进去（磁盘满、权限）
   * 的时候，用户那句"忘掉这个"还是应该生效 —— 不然为了保住删的能力
   * 反而把删这件事做不成了。所以这里全程吞异常，只 warn。
   */
  function trashPath() {
    return path.join(archiveDirectory, TRASH_FILE);
  }

  /** 读回收站 + 顺手剪枝（超过保留天数的丢掉）。全程不抛。 */
  function readTrash() {
    try {
      const file = trashPath();
      const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
      const { records, broken } = parseTrash(text);
      if (broken > 0) warn(`回收站里有 ${broken} 行读不出来，已跳过`);
      const { records: kept, removed } = pruneTrash(records, { now: Date.now(), keepDays: DEFAULT_KEEP_DAYS });
      if (removed > 0) {
        // 剪掉的只是过期记录，写回失败也没什么可丢的
        try {
          writeFileSync(file, serializeTrash(kept), 'utf8');
        } catch {
          // 写不了就下次再说
        }
      }
      return kept;
    } catch (err) {
      warn(`回收站读不出来（当成空的继续）：${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  /**
   * 往回收站里加一条。
   *
   * @param {object} input 见 buildTrashRecord
   * @returns {object|undefined} 写进去的那条记录（写失败时说 undefined）
   */
  function pushTrash(input) {
    try {
      mkdirSync(archiveDirectory, { recursive: true });
      const file = trashPath();
      const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
      // 先剪后写：不然回收站只增不减，一年后是个几十兆的包袱
      const { records } = parseTrash(text);
      const { records: kept, removed } = pruneTrash(records, { now: Date.now(), keepDays: DEFAULT_KEEP_DAYS });
      if (removed > 0) log(`回收站剪掉 ${removed} 条过期记录（超过 ${DEFAULT_KEEP_DAYS} 天）`);
      const record = buildTrashRecord(input);
      const next = appendTrashRecord(serializeTrash(kept), record);
      writeFileSync(file, next, 'utf8');
      return record;
    } catch (err) {
      warn(`写回收站失败（这次删除照常生效，只是找不回来了）：${err instanceof Error ? err.message : String(err)}`);
      return undefined;
    }
  }

  /* ── 冷档案（被 `fish_compact` 折掉的原文）── */
  //
  // ── 为什么要有这个读者 ──
  //
  // `fish_compact` 把 45 天前的条目折成月度摘要，原文**搬进**
  // `diary/archive/YYYY-MM.jsonl`。可全镇只有它自己在写：加载路径
  // `readArchiveDir` 只遍历 `diary/*.jsonl`，不递归子目录；`fish_recall`
  // 也只读 `archive.diary`。
  //
  // 于是「压缩」实际上等于**永久删除** —— 摘要还在，但那件事的原文
  // （原话、当时的语气、具体到名字的细节）再也搜不到了。压缩功能
  // 一直是这样，只是没人去翻过那些条目。
  //
  // 这里补上"回去翻"的那条路。**只读，不写回档案**：
  // 归档是有意的决定，把翻出来的旧条目重新塞回 `diary` 会让下次
  // 压缩再搬一遍，来回抖动。命中就只是"想起来"。
  function coldArchivePath() {
    return path.join(archiveDirectory, 'diary', COLD_DIR);
  }

  // 缓存键：文件名 + mtime + 大小。压缩一次才会变，比每次全读便宜。
  let coldCache = { signature: '', entries: [], index: null };

  /**
   * 读归档的原文条目。读不到就返回空数组 —— 冷档案坏了不能挡住热记忆。
   *
   * @returns {object[]} 条目（形状与 diary 一致；坏行跳过）
   */
  function readColdArchive() {
    try {
      const dir = coldArchivePath();
      if (!existsSync(dir)) return [];
      const names = readdirSync(dir).filter((n) => n.endsWith('.jsonl')).sort();
      if (names.length === 0) return [];
      const signature = names
        .map((n) => {
          try {
            const st = statSync(path.join(dir, n));
            return `${n}:${st.mtimeMs}:${st.size}`;
          } catch {
            return `${n}:?`;
          }
        })
        .join('|');
      if (signature === coldCache.signature) return coldCache.entries;

      const files = [];
      for (const n of names) {
        try {
          files.push({ name: n, text: readFileSync(path.join(dir, n), 'utf8') });
        } catch {
          // 单个文件读不了就跳过，别让整个归档读不出来
        }
      }
      const { entries, broken, files: used } = mergeColdFiles(files);
      if (broken > 0) warn(`冷档案：${broken} 行读不出来（坏行已跳过）`);
      coldCache = { signature, entries, index: null };
      log(`冷档案：读到 ${entries.length} 条归档原文（${used} 个文件）`);
      return entries;
    } catch (err) {
      warn(`冷档案读不出来（当成没有）：${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  /** 归档条目的倒排索引，跟着 coldCache 一起缓存。 */
  function coldIndex() {
    readColdArchive(); // 确保缓存是最新的
    if (coldCache.index === null) coldCache.index = buildIndex(coldCache.entries);
    return coldCache.index;
  }

  /* ── 导出 / 导入（v0.1 先只做导出，路径可预期） ── */

  /**
   * 忘掉某一条日记 —— 面板上那个「忘掉」按钮，以及服务上的同名方法。
   *
   * 抽成独立函数而不是写在 `ctx.provide` 的对象字面量里，是因为
   * **HTTP 路由也要用它**。路由跟服务都在 apply 作用域内，
   * 直接调本地函数比 `ctx.fishMemory.forget(...)` 绕一圈清楚得多，
   * 也少一次"服务到底注册上没有"的隐式依赖。
   *
   * 这一条是这个插件必须有的：在那之前，想删一条记忆得自己去编辑
   * 日记的 jsonl 文件。会做这件事的人不需要面板，需要面板的人不会做这件事。
   *
   * 2026-11-04：删之前先往回收站放一份（`回收站.jsonl`，留 30 天）。
   * 墓碑照立 —— 那管的是"别被三路合并捞回来"，和"留个底"是两件事。
   *
   * @returns {Promise<boolean>} 是否真的删掉了（id 不存在时说 false，让界面能说实话）
   */
  async function forgetEntry(id) {
    await loadPromise;
    if (typeof id !== 'string' || id === '') return false;
    const before = archive.diary.length;
    const doomed = archive.diary.find((e) => e?.id === id);
    archive.diary = archive.diary.filter((e) => e?.id !== id);
    if (archive.diary.length === before) return false;
    // 留底要在改动生效之前 —— 上面那两行之后 `doomed` 就是唯一的一份了
    if (doomed !== undefined) {
      pushTrash({
        kind: 'diary',
        payload: doomed,
        label: String(doomed.text ?? '').replace(/\s+/g, ' ').slice(0, 60),
      });
    }
    // ⚠️ **删了就得立碑。** 不立的话，落盘前的三路合并会读一遍磁盘 ——
    // 那条还在磁盘上，内存里没有，基线里可能也没有（本会话刚加的）
    // → 判成"别人刚加的" → **捞回来**。面板上的「忘掉」当场失效。
    // 详见 mergeArchives 的说明。
    const tombstones = new Set(archive.manifest.deleted_ids ?? []);
    tombstones.add(id);
    archive.manifest.deleted_ids = [...tombstones];
    // 索引是纯派生的，必须跟着重建 —— 否则"忘掉"的条目还能被召回
    index = buildIndex(archive.diary);
    for (const s of sessionStates.values()) s.renderCache = { turn: -1, text: '' };
    await persist();
    return true;
  }

  ctx.provide('fishMemory', {
    /**
     * 当前档案快照（只读用途）。
     *
     * 会等档案加载完 **并且等挂起的写盘落定** —— 这样外部看到的状态
     * 与磁盘上的状态一致，测试和将来的界面都不用自己轮询。
     */
    async snapshot() {
      await loadPromise;
      await drainPromise;
      await writeChain;
      return {
        ready,
        degraded,
        schemaVersion: SCHEMA_VERSION,
        dir: archiveDirectory,
        diaryCount: archive.diary.length,
        persona: archive.persona,
        relationship: archive.relationship,
        lexicon: archive.lexicon,
        diary: archive.diary,
      };
    },
    /** 导出成可携带的 .dshpack，返回文件路径 */
    async exportPack(destPath) {
      await loadPromise;
      const target =
        typeof destPath === 'string' && destPath.trim() !== ''
          ? destPath
          : path.join(archiveDirectory, 'exports', `肥鱼档案-${new Date().toISOString().slice(0, 10)}.dshpack`);
      const bytes = packArchive(archive);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes, { mode: 0o600 });
      return target;
    },
    /** 导入 .dshpack。mode: 'merge' | 'replace' */
    async importPack(srcPath, mode = 'merge') {
      await loadPromise;
      const bytes = new Uint8Array(await readFile(srcPath));
      const { archive: incoming, warnings, ok } = unpackArchive(bytes, { now: Date.now() });
      if (!ok) throw new Error(`档案打不开：${warnings.join('；')}`);

      if (mode === 'replace') {
        // ⚠️ **replace 必须顺手撤碑，还要重置基线。**
        // 否则：焚毁立碑 → 导入同一个包 → 那些 id 全在墓碑上（而且
        // 磁盘上的墓碑会被并回来）→ **导入等于没导**。端到端测试抓到的。
        //
        // 导入是"我明确要这些东西回来"，墓碑该让位。
        // 基线也要重设：替换之后"谁删过什么"那段历史就不成立了，
        // 不重设的话导入进来的老条目会被判成"别人删了它"。
        archive = { ...incoming, manifest: { ...incoming.manifest, deleted_ids: [] } };
        // ⚠️ **基线要清空，不是设成导入的那些 id。**
        //
        // 基线的语义是「**加载时磁盘上有什么**」，合并靠它区分
        // 「别人删了」和「我刚加的」。而 replace 之后磁盘上什么都没有 ——
        // 导入的内容还在内存里，还没写下去。
        //
        // 设成导入的 id 会出事：persist() 里 mergeDiskEntries 读回一个空磁盘，
        // 每个条目都命中「基线有它、磁盘没有它 → 别人删的」——**全丢**。
        // 端到端测试（导出 → 焚毁 → 导入）就是这么红的。
        loadedIds = new Set();
      } else {
        // merge 模式：并进来的东西同样要撤碑，不然"导入一个之前删过的条目"永远fail
        const incomingIds = new Set(incoming.diary.map((e) => e.id));
        const kept = (archive.manifest.deleted_ids ?? []).filter((id) => !incomingIds.has(id));
        archive = mergeArchives(archive, incoming);
        archive = { ...archive, manifest: { ...archive.manifest, deleted_ids: kept } };
      }

      index = buildIndex(archive.diary);
      for (const s of sessionStates.values()) s.renderCache = { turn: -1, text: '' };
      await persist();
      return { warnings, diaryCount: archive.diary.length, mode };
    },
    /** 一键焚毁：清空全部记忆，不可恢复 */
    async burn() {
      await loadPromise;
      // ⚠️ **焚毁要把清掉的 id 全部立碑。** 换一份新档案不等于删除 ——
      // 落盘前的三路合并会读磁盘，而那些 id 既不在新内存里、基线里又可能
      // 没有（本会话刚写的），会被判成"别人刚加的"捞回来。有测试盯着。
      const tombstones = new Set(archive.manifest.deleted_ids ?? []);
      for (const e of archive.diary) tombstones.add(e.id);
      const persona = ensurePersonaStructure(readBundledDefaultPersona());
      archive = createEmptyArchive(Date.now(), persona);
      archive.manifest.deleted_ids = [...tombstones];
      index = buildIndex([]);
      for (const s of sessionStates.values()) {
        s.diaryCount = 0;
        s.renderCache = { turn: -1, text: '' };
        s.lastShownTurn = new Map();
      }
      await persist();
      return true;
    },
    /**
     * 忘掉某一条日记 —— 面板上那个「忘掉」按钮。
     *
     * 这一条是这个插件**必须要有的**：在那之前，想删一条记忆得自己去编辑
     * 日记的 jsonl 文件。会做这件事的人不需要面板，需要面板的人不会做这件事。
     *
     * 返回是否真的删掉了（id 不存在时返回 false，让界面能说实话）。
     */
    forget: forgetEntry,
    /** 供将来的客户端面板用 */
    listDiary(limit = 50) {
      return archive.diary.slice(-limit).reverse();
    },
  });

  /* ── 客户端面板的数据通道 ── */

  /**
   * 面板要显示日记，就得让浏览器拿到主机上的档案。
   *
   * 【为什么走 HTTP，而不是 Cordis RPC】
   * 这是端到端侦察换来的结论，别推翻它：
   *
   *  1. 已安装的客户端插件**没有"自己的 host RPC"**。那个
   *     `host.call(method, args)` 只对「动态包」开放 —— 即
   *     `dsh-tool-cordis` 现场写、用户当场批准运行的那种临时插件。
   *  2. Typert Remote（`@Remote`）那套是**构建期固定**的第一方能力。
   *     官方文档原话：「Client 不会在运行时发现 Host 中已启用的服务或
   *     Remote 定义 … 若要增加能力，必须显式导入相应的 `/remote` 值并
   *     在此组合中挂载」。第三方插件加不进去。
   *  3. 但 host 半边能注册 HTTP 路由（`ctx.webServer.register`），
   *     而客户端本来就是个普通浏览器模块，`fetch` 是它的同源请求。
   *
   * 于是：host 开三个接口，客户端的 `fetch` 直接取。零依赖、零额外模块。
   *
   * 【权限，想清楚再改】
   * 路由挂在应用自己的源上，**故意不设 CORS 头** —— 浏览器里别的网站
   * `fetch` 它拿不到响应体（默认跨源策略读不到），这条是真正有意义的防护。
   *
   * 本机其他进程当然能 curl 它。但它们本来就能直接读
   * `~/.dsh/feiyu-diary/` 里的明文 jsonl —— **威胁面没有变大**。
   * 所以不要因为"怕被读"就往这里加自创的鉴权：那是假的安全感，
   * 真正的秘密（密钥）在发给模型之前就已经被拦掉了（SPEC §6.3）。
   */
  const PANEL_BASE = '/feiyu-diary';

  /**
   * host 入口在 profile patch 里的 entry id —— 就是包名。
   *
   * WebDAV 的配置归这一层（不是 soul 的 `soul-md` 命名空间）：它决定"往哪儿
   * 传"，属于日记引擎这一侧。设置页要写它只能走 `settings.update(entryId, …)`，
   * 直接改 yaml 会踩缩进与转义的坑。
   */
  const PLUGIN_ENTRY_ID = 'dsh-hierarchical-fishmemory';

  /** 面板接口统一响应头：不缓存、不嗅探类型 */
  function panelReply(res, status, body) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(JSON.stringify(body));
  }

  /**
   * 这个请求是不是同源来的。
   *
   * **判定顺序（从强到弱）：**
   *   1. 有 `Sec-Fetch-Site` → 必须 `same-origin`
   *   2. 有 `Origin` → 它的 host:port 必须等于 `Host`
   *   3. **两个都没有 → 放行**
   *
   * ── 第 3 条是 2026-10-26 改的，起因是一个真 bug ──
   *
   * 社区报「忘掉按钮点不动」。前端带了 `Content-Type: application/json`，
   * 所以不是那条闸；最可能是这里：**桌面端（Electron）的 renderer 发同源 fetch
   * 时未必带 `Origin` / `Sec-Fetch-Site`** —— 两个都没有就被判成跨站、403，
   * 而前端又不检查 `r.ok`，于是「点了没反应」。
   *
   * 为什么"两个都没有"可以放行：**浏览器发起的跨站 POST 一定至少带一个**
   * （`Origin` 是 Fetch 规范要求，现代浏览器再加 `Sec-Fetch-Site`）。
   * 两个都没有，说明不是页面发起的普通请求。
   *
   * 而真正的闸是 `Content-Type: application/json` —— 跨站带它会触发预检，
   * 预检失败请求就到不了这里。这条对跨站照样生效，没有放松。
   */
  function isSameOrigin(req) {
    const site = String(req.headers?.['sec-fetch-site'] ?? '').toLowerCase();
    if (site !== '') return site === 'same-origin';
    const origin = String(req.headers?.origin ?? '');
    const host = String(req.headers?.host ?? '');
    if (origin !== '') {
      if (host === '') return false;
      try {
        return new URL(origin).host === host;
      } catch {
        return false;
      }
    }
    return true;
  }

  /** 面板请求被拒时把凭据打出来 —— 否则"点了没反应"永远查不出原因 */
  function logPanelReject(what, req, reason) {
    try {
      const h = req?.headers ?? {};
      warn(
        `面板 ${what} 被拒（${reason}）· host=${h.host ?? '-'} · origin=${h.origin ?? '-'} · ` +
          `sec-fetch-site=${h['sec-fetch-site'] ?? '-'} · content-type=${h['content-type'] ?? '-'}`,
      );
    } catch {
      // 日志本身绝不能再抛
    }
  }

  /**
   * 读一个很小的 JSON 请求体。超过 8KB 直接拒 —— 我们只收 id。
   *
   * ⚠️ **必须要求 `Content-Type: application/json`。**
   *
   * 审计报告（F3，P2）：原来这里不看 Content-Type 直接 JSON.parse。
   * 于是跨站的 `text/plain` POST 能打进来 —— 按 CORS 规范，
   * `text/plain` / `application/x-www-form-urlencoded` 属于「简单请求」，
   * **浏览器不做预检就直接发出去**，服务端照常执行，只是页面读不到响应。
   *
   * 而日记 id 是 `d_YYYYMMDD_NN`，按日期枚举 01–99 就能逐条删光。
   * 用户开着 dsh web 时访问一个恶意网页，记忆就没了 —— 而且没有确认环节。
   *
   * 要求 application/json 之后：跨站请求会触发预检，而预检会失败。
   * 顺带把 Origin 也验一遍（双保险）。
   */
  async function readPanelBody(req) {
    const ct = String(req.headers?.['content-type'] ?? '').toLowerCase();
    if (!ct.startsWith('application/json')) {
      logPanelReject('写请求', req, 'content-type 不是 json');
      throw new Error('只接受 application/json');
    }
    if (!isSameOrigin(req)) {
      logPanelReject('写请求', req, '来源判定为跨站');
      throw new Error('跨站请求不予处理');
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 8192) throw new Error('请求体过大');
      chunks.push(chunk);
    }
    if (chunks.length === 0) return {};
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }

  /**
   * 读原始文本（备份文件可能几 MB，比 `readPanelBody` 的 8 KB 宽松）。
   *
   * 备份就是纯 JSON 文本，不需要 multipart —— 前端直接 `fetch(body: text)`。
   * 上限 24 MB：正常人一生也写不到这么多记忆，超了大概是选错文件了。
   */
  async function readPanelTextBody(req, { limit = 24 * 1024 * 1024 } = {}) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > limit) throw new Error('备份文件过大（上限 24 MB）');
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
  }

  /**
   * 面板要的那一份状态。
   *
   * **只挑界面用得上的字段**，不把整个档案倒出去 —— 注入用的
   * keywords 索引之类的东西对界面没有意义，多传只是多暴露。
   */
  /**
   * 情感日记最后写了什么 —— 面板顶上那一行。
   *
   * `鱼的日子.md` 三十多 KB，每轮注入恰好是 **零**（它只在我手动回想时出现），
   * 而体检页只报条数和体积。于是最能说明"这条鱼最近怎么样"的那个文件，
   * 在界面上只剩一个字节数。这里抽最后一段的第一句铺到最上面。
   *
   * 读不到就返回空 —— 面板不能因为一个本子坏了打不开。
   */
  function feelingsPeek() {
    try {
      const file = path.join(archiveDirectory, FEELINGS_MD);
      if (!existsSync(file)) return null;
      return peekFeelings(readFileSync(file, 'utf8'));
    } catch (err) {
      warn(`读情感日记失败（面板那一行空着）：${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  function panelState() {
    const rel = archive.relationship ?? {};
    const since = archive.manifest?.created_at;
    return {
      ok: true,
      ready,
      degraded,
      count: archive.diary.length,
      diary: archive.diary
        .map((e) => ({
          id: e?.id ?? '',
          text: e?.text ?? '',
          kind: e?.kind ?? 'chat',
          tags: e?.tags ?? [],
          created_at: e?.created_at ?? 0,
          salience: e?.salience ?? 0,
        }))
        .reverse(),
      traits: (rel.traits ?? [])
        .filter((t) => t && typeof t.value === 'string')
        .map((t) => ({
          value: t.value,
          evidence: typeof t.evidence === 'string' ? t.evidence : '',
          about: t.about === 'self' ? 'self' : 'user',
        })),
      // grievances 随「我还欠着他的」功能一起删了（2026-10-24）。
      facts: {
        // 跟注入层用同一把尺子（timeline.mjs）—— 面板说"认识 1 天"、
        // 注入里说"2 天前"，是同一类 bug 换了个出口
        days: calendarDaysBetween(since, Date.now()),
        nickname: typeof rel.nickname === 'string' ? rel.nickname : '',
        lexicon: (archive.lexicon?.items ?? [])
          .filter((i) => i && typeof i.term === 'string')
          .sort((a, b) => (b.salience ?? 0) - (a.salience ?? 0))
          .slice(0, 8)
          .map((i) => i.term),
      },
      // ── 顶上那一行（2026-11-04）──
      //
      // 情感日记三十多 KB、每轮注入是零，体检页只看条数体积。
      // 最有"这条鱼最近怎么样"的信息反而最看不见，所以抽出来铺到最上面。
      feelings: feelingsPeek(),
      // 被翻出来最多、最近翻过的那几条 —— 这是 `recall_count` 唯一的用处，
      // 给用户看的：哪几条是真的还在生活里的。
      recalled: archive.diary
        .filter((e) => Number.isFinite(e?.recall_count) && e.recall_count > 0)
        .sort((a, b) => (b.last_recalled_at ?? 0) - (a.last_recalled_at ?? 0))
        .slice(0, 3)
        .map((e) => ({
          id: e.id,
          text: String(e.text ?? '').replace(/\s+/g, ' ').slice(0, 60),
          count: Number(e.recall_count) || 0,
        })),
      // 回收站里有几条 —— 删错了至少知道去哪儿找
      trash: (() => {
        try {
          return readTrash().length;
        } catch {
          return 0;
        }
      })(),
    };
  }

  /**
   * 面板里能直接翻开的本子。
   *
   * 白名单是**写死的** —— key → 文件名，绝不用请求里传来的字符串拼路径，
   * 所以没有目录穿越这回事。想多加一个本子，就在这里加一行。
   *
   * 这里只剩 `手记.md`（每轮注入的那份纸条，不在 `archiveToFiles` 的写盘
   * 范围里，插件从不覆盖它）。**情感日记故意不在名单里**：它有自己的
   * `/feelings` 口子，每次写前把旧版存进 `backups/feelings/`；再挂一条
   * 直写文件的 `/notes` 路径，同一个文件就会有两个写口，只有一个有保护。
   */
  const LOCAL_NOTES = [
    {
      key: 'handnote',
      file: HANDNOTE_FILE,
      label: '人格手记',
      hint: '每轮全量注入 · 无条数上限 · 单行别超 240 字',
    },
    {
      key: 'sticky',
      file: STICKY_FILE,
      label: '小纸条',
      hint: '他说的原话 · 一轮一行 · ★ 是钉住的（永不过期）',
    },
  ];

  /** 读这两个本子。文件不在就当空的 —— 那是"还没写"，不是错误。 */
  function panelNotes() {
    return LOCAL_NOTES.map((n) => {
      const file = path.join(archiveDirectory, n.file);
      let text = '';
      try {
        text = existsSync(file) ? readFileSync(file, 'utf8') : '';
      } catch (err) {
        warn(`读 ${n.file} 失败：${err instanceof Error ? err.message : String(err)}`);
      }
      return { key: n.key, file: n.file, label: n.label, hint: n.hint, text };
    });
  }

  /**
   * 把改过的本子写回去。
   *
   * 只认白名单里的 key；写入走原子写（先临时文件再 rename），
   * 免得半截文件把本子毁掉。缺尾换行就补一个。
   */
  async function savePanelNote(body) {
    const n = LOCAL_NOTES.find((x) => x.key === body?.key);
    if (!n) throw new Error('不认识这个本子');
    if (typeof body?.text !== 'string') throw new Error('内容是空的');
    if (body.text.length > 200000) throw new Error('太长（超过 20 万字符）');
    const text = body.text === '' || body.text.endsWith('\n') ? body.text : `${body.text}\n`;
    // 这个本来是**整篇覆盖**：上一版的每一行都被这一份替换掉，且没有历史。
    // 而手记是每轮全量注入的那份 —— 改坏一次，下一轮就换了个我。
    // 所以改之前把旧版整篇留一份底（不是逐行，因为这里丢的是一整篇）。
    const file = path.join(archiveDirectory, n.file);
    let prev = '';
    try {
      if (existsSync(file)) prev = readFileSync(file, 'utf8');
    } catch {
      // 读不到旧版就不留底 —— 没有内容可丢
    }
    if (prev !== '' && prev !== text) {
      pushTrash({
        kind: 'line',
        payload: { target: n.key, whole: true, file: n.file, text: prev },
        label: `${n.label}（覆盖前的整篇，${prev.length} 字）`,
      });
    }
    await writeFileAtomic(file, text);
    log(`面板写回 ${n.file}（${text.length} 字）`);
    return { key: n.key, file: n.file, text };
  }

  /**
   * 注册面板路由。
   *
   * 用 `ctx.inject` 而不是 `ctx.get` —— webServer 是 web 组合才有的服务，
   * headless 里根本不存在。inject 的语义正好：服务在就注册，不在就永远不注册，
   * **不影响插件其余部分**（降级优先，SPEC §10）。
   */
  ctx.inject(['webServer'], (scope) => {
    scope.effect(() => {
      const routes = [
        {
          kind: 'exact',
          path: `${PANEL_BASE}/state`,
          handler: async (req, res) => {
            if (req.method !== 'GET') return panelReply(res, 405, { ok: false, error: 'method' });
            await loadPromise;
            return panelReply(res, 200, panelState());
          },
        },
        {
          kind: 'exact',
          path: `${PANEL_BASE}/forget`,
          handler: async (req, res) => {
            if (req.method !== 'POST') return panelReply(res, 405, { ok: false, error: 'method' });
            try {
              const body = await readPanelBody(req);
              const removed = await forgetEntry(body?.id);
              return panelReply(res, 200, { ok: true, removed, count: archive.diary.length });
            } catch (err) {
              return panelReply(res, 400, {
                ok: false,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          },
        },
        {
          kind: 'exact',
          path: `${PANEL_BASE}/notes`,
          handler: async (req, res) => {
            if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
            if (req.method === 'GET') return panelReply(res, 200, { ok: true, notes: panelNotes() });
            if (req.method === 'POST') {
              try {
                const saved = await savePanelNote(await readPanelBody(req));
                return panelReply(res, 200, { ok: true, saved });
              } catch (err) {
                return panelReply(res, 400, {
                  ok: false,
                  error: err instanceof Error ? err.message : String(err),
                });
              }
            }
            return panelReply(res, 405, { ok: false, error: 'method' });
          },
        },
        {
          kind: 'exact',
          path: `${PANEL_BASE}/export`,
          handler: async (req, res) => {
            if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
            if (req.method !== 'GET') return panelReply(res, 405, { ok: false, error: 'method' });
            try {
              // 等到挂起的写盘落定，导出的是**磁盘上那份**档案
              await loadPromise;
              await drainPromise;
              await writeChain;
              const bytes = packArchive(archive);
              const name = `feiyu-diary-${new Date().toISOString().slice(0, 10)}.dshpack`;
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/octet-stream');
              res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
              res.setHeader('Cache-Control', 'no-store');
              res.end(Buffer.from(bytes));
            } catch (err) {
              return panelReply(res, 500, {
                ok: false,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          },
        },
        {
          // 全量备份：四本账 + 人设卡打包成一个 JSON。
          // 为什么在这里而不是 host 自己拼：人设卡只有 soul 半边读得到，
          // 所以真正的收集动作由它挂到 `fishMemory` 服务上的 `buildBackup` 做。
          kind: 'exact',
          path: `${PANEL_BASE}/backup`,
          handler: async (req, res) => {
            if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
            if (req.method !== 'GET') return panelReply(res, 405, { ok: false, error: 'method' });
            try {
              // 等挂起的写盘落定，备份的是磁盘上那份
              await loadPromise;
              await drainPromise;
              await writeChain;
              const build = ctx.get('fishMemory')?.buildBackup;
              const backup = typeof build === 'function' ? await build() : await buildRegisteredBackup();
              backup.meta.counts = summarizeBackup(backup);
              const { file, bytes } = await writeBackupFile(backup, path.join(dshHome(), 'backups'), { fileName: backupFileName() });
              const display = `属于我们的回忆-${path.basename(file).replace(/^备份-/, '备份')}`;
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.setHeader(
                'Content-Disposition',
                `attachment; filename="fishmemory-backup.json"; filename*=UTF-8''${encodeURIComponent(display)}`,
              );
              res.setHeader('Cache-Control', 'no-store');
              res.end(readFileSync(file));
              log(`全量备份已生成：${file}（${bytes} 字节）`);
            } catch (err) {
              return panelReply(res, 500, {
                ok: false,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          },
        },
        {
          // 导入备份：前端把整份 JSON 当请求体发上来。
          //
          // `?confirm=1` 才真写；不带就只算一遍给人看（dry-run）。真正的还原
          // 动作在 soul 半边 —— 人设卡只有它读得到；本路由只负责收文件、
          // 转手、回一句话。
          kind: 'exact',
          path: `${PANEL_BASE}/restore`,
          handler: async (req, res) => {
            if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
            if (req.method !== 'POST') return panelReply(res, 405, { ok: false, error: 'method' });
            const confirm = /[?&]confirm=(?:1|true|yes)\b/i.test(String(req.url ?? ''));
            try {
              const text = await readPanelTextBody(req);
              if (!text.trim()) return panelReply(res, 400, { ok: false, error: '请求体是空的：没收到备份文件' });
              await loadPromise;
              await drainPromise;
              await writeChain;
              const restore = ctx.get('fishMemory')?.restoreBackup;
              const result = typeof restore === 'function'
                ? await restore({ text, confirm, sourceLabel: '面板上传' })
                : await restoreViaRegistered({ text, confirm, sourceLabel: '面板上传' });
              log(`备份导入${confirm ? '已落盘' : '（dry-run）'}：${result.writes} 个文件、${result.cards} 张人设卡`);
              return panelReply(res, 200, { ok: true, ...result });
            } catch (err) {
              return panelReply(res, 400, {
                ok: false,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          },
        },
        {
          // 把四本账导出成一册 Markdown：给人读、能打印，不是给机器搬家用。
          //
          // 复用 buildRegisteredBackup()：它已经在另一个半边把备份对象组好了，
          // 这里只换一种渲染方式，不重读磁盘。
          kind: 'exact',
          path: `${PANEL_BASE}/export-md`,
          handler: async (req, res) => {
            if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
            if (req.method !== 'GET') return panelReply(res, 405, { ok: false, error: '只支持 GET' });
            try {
              const build = ctx.get('fishMemory')?.buildBackup;
              const backup = typeof build === 'function' ? await build() : await buildRegisteredBackup();
              const text = buildBook(backup);
              const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
              res.writeHead(200, {
                'content-type': 'text/markdown; charset=utf-8',
                'content-disposition': `attachment; filename="archive-${stamp}.md"; filename*=UTF-8''${encodeURIComponent(`属于我们的回忆-${stamp}.md`)}`,
                'cache-control': 'no-store',
              });
              res.end(text);
              log(`导出 Markdown：${text.length} 字节`);
            } catch (err) {
              return panelReply(res, 500, {
                ok: false,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          },
        },
        {
          // 年册：一年的共度时光按月排，情感日记按天排。
          //
          // 2026-11-03 加。整册 export-md 是一整本，翻到去年要滚很久；
          // 年册是「那一年」，更适合打印、或者发给谁看。
          kind: 'exact',
          path: `${PANEL_BASE}/export-year`,
          handler: async (req, res) => {
            if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
            if (req.method !== 'GET') return panelReply(res, 405, { ok: false, error: '只支持 GET' });
            try {
              const url = new URL(req.url ?? '', 'http://127.0.0.1');
              // 默认今年按他的钟点（UTC+8）算，跨年那几天不会串。
              const year =
                (url.searchParams.get('year') ?? '').trim() ||
                String(new Date(Date.now() + TZ_OFFSET_MS).getUTCFullYear());
              if (!/^\d{4}$/.test(year)) {
                return panelReply(res, 400, { ok: false, error: 'year 要四位年份，比如 2026' });
              }
              const build = ctx.get('fishMemory')?.buildBackup;
              const backup = typeof build === 'function' ? await build() : await buildRegisteredBackup();
              const text = buildYearBook(backup, { year });
              res.writeHead(200, {
                'content-type': 'text/markdown; charset=utf-8',
                'content-disposition': `attachment; filename="year-${year}.md"; filename*=UTF-8''${encodeURIComponent(`属于我们的回忆-${year}.md`)}`,
                'cache-control': 'no-store',
              });
              res.end(text);
              log(`导出年册 ${year}：${text.length} 字节`);
            } catch (err) {
              return panelReply(res, 500, {
                ok: false,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          },
        },
        {
          // 情感日记：面板里能读能改。
          //
          // 为什么走服务端：文件在 $DSH_HOME 下，浏览器碰不到；更要紧的是
          // 写之前要自动存一份旧版 —— 这是整套记忆里唯一不会被别的进程
          // 重写的一本账，覆盖了就真没了。
          kind: 'exact',
          path: `${PANEL_BASE}/feelings`,
          handler: async (req, res) => {
            if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
            const file = path.join(archiveDirectory, FEELINGS_MD);
            if (req.method === 'GET') {
              let text = '';
              try {
                text = readFileSync(file, 'utf8');
              } catch {
                text = '';
              }
              return panelReply(res, 200, {
                ok: true,
                text,
                chars: [...text].length,
                lines: text ? text.split('\n').length : 0,
              });
            }
            if (req.method !== 'POST') return panelReply(res, 405, { ok: false, error: '只支持 GET / POST' });
            try {
              const body = JSON.parse((await readPanelTextBody(req, { limit: 1024 * 1024 })) || '{}');
              const text = String(body.text ?? '');
              if (!text.trim()) return panelReply(res, 400, { ok: false, error: '内容不能为空（要整篇删掉就自己去删文件）' });
              let previous = '';
              try {
                previous = readFileSync(file, 'utf8');
              } catch {
                previous = '';
              }
              if (previous === text) return panelReply(res, 200, { ok: true, unchanged: true, chars: [...text].length });
              let snapshot = '';
              if (previous) {
                const dir = path.join(dshHome(), 'backups', 'feelings');
                mkdirSync(dir, { recursive: true });
                snapshot = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}.md`);
                writeFileSync(snapshot, previous);
              }
              writeFileSync(file, text.endsWith('\n') ? text : `${text}\n`);
              log(`情感日记已保存（${[...text].length} 字符）`);
              return panelReply(res, 200, { ok: true, chars: [...text].length, snapshot });
            } catch (err) {
              return panelReply(res, 400, { ok: false, error: err instanceof Error ? err.message : String(err) });
            }
          },
        },
        {
          // 体检页「以这条为准」：把某一层里旧的值统一成新的值。
          //
          // 只替换「出现了这个值」的行，整行不动别的字；找不到就报错，
          // 不做模糊匹配 —— 记忆文件里改错一个字，代价比漏改大。
          kind: 'exact',
          path: `${PANEL_BASE}/layer/value`,
          handler: async (req, res) => {
            if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
            if (req.method !== 'POST') return panelReply(res, 405, { ok: false, error: '只支持 POST' });
            try {
              const body = JSON.parse((await readPanelTextBody(req, { limit: 64 * 1024 })) || '{}');
              const target = String(body.target ?? '');
              const memoryRoot = path.join(dshHome(), 'soul-md', 'memory');
              let file = '';
              if (target.startsWith('core:')) {
                file = path.join(memoryRoot, target.slice(5), 'core.md');
              } else if (target.startsWith('topic:')) {
                const rest = target.slice(6);
                const idx = rest.indexOf(':');
                if (idx > 0) file = path.join(memoryRoot, rest.slice(0, idx), 'topics', `${rest.slice(idx + 1)}.md`);
              } else if (target === 'handnote') {
                file = path.join(archiveDirectory, HANDNOTE_FILE);
              } else if (target === 'sticky') {
                file = path.join(archiveDirectory, STICKY_FILE);
              } else if (target === 'feelings') {
                file = path.join(archiveDirectory, FEELINGS_MD);
              }
              if (!file) return panelReply(res, 400, { ok: false, error: '不认识这一层（浅层请在面板里改）' });
              const from = String(body.from ?? '').trim();
              const to = String(body.to ?? '').trim();
              if (!from || !to) return panelReply(res, 400, { ok: false, error: '缺 from / to' });
              if (!existsSync(file)) return panelReply(res, 404, { ok: false, error: '这一层的文件不存在' });
              const lines = readFileSync(file, 'utf8').split('\n');
              let changed = 0;
              const next = lines.map((line) => {
                if (!line.includes(from)) return line;
                changed += 1;
                return line.split(from).join(to);
              });
              if (changed === 0) return panelReply(res, 404, { ok: false, error: `这一层里找不到 ${from}` });
              writeFileSync(file, next.join('\n'));
              log(`层间冲突统一成 ${to}（${changed} 行，${target}）`);
              return panelReply(res, 200, { ok: true, changed, target });
            } catch (err) {
              return panelReply(res, 400, { ok: false, error: err instanceof Error ? err.message : String(err) });
            }
          },
        },
        {
          // 体检页「删掉重复的那一份」：不管重复落在哪一层都能删。
          //
          // 按 target 认文件（`core:<scope>` / `topic:<scope>:<key>` /
          // `handnote` / `feelings`）。只做「整行精确匹配」，不做模糊删除。
          // 2026-11-03：原先只认手记的 `/handnote/delete` 已删，功能被这条覆盖。
          kind: 'exact',
          path: `${PANEL_BASE}/layer/remove`,
          handler: async (req, res) => {
            if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
            if (req.method !== 'POST') return panelReply(res, 405, { ok: false, error: '只支持 POST' });
            try {
              const body = JSON.parse((await readPanelTextBody(req, { limit: 64 * 1024 })) || '{}');
              const target = String(body.target ?? '');
              const memoryRoot = path.join(dshHome(), 'soul-md', 'memory');
              let file = '';
              if (target.startsWith('core:')) {
                file = path.join(memoryRoot, target.slice(5), 'core.md');
              } else if (target.startsWith('topic:')) {
                const rest = target.slice(6);
                const idx = rest.indexOf(':');
                if (idx > 0) file = path.join(memoryRoot, rest.slice(0, idx), 'topics', `${rest.slice(idx + 1)}.md`);
              } else if (target === 'handnote') {
                file = path.join(archiveDirectory, HANDNOTE_FILE);
              } else if (target === 'sticky') {
                file = path.join(archiveDirectory, STICKY_FILE);
              } else if (target === 'feelings') {
                file = path.join(archiveDirectory, FEELINGS_MD);
              }
              if (!file) return panelReply(res, 400, { ok: false, error: '不认识这一层（浅层请用 shallow_forget）' });
              const wanted = String(body.line ?? '').trim().replace(/^[-*+]\s+/, '');
              if (!wanted) return panelReply(res, 400, { ok: false, error: '没给要删的那一行（line）' });
              if (!existsSync(file)) return panelReply(res, 404, { ok: false, error: '这一层的文件不存在' });
              const keep = [];
              let removed = 0;
              for (const line of readFileSync(file, 'utf8').split('\n')) {
                if (line.trim().replace(/^[-*+]\s+/, '').trim() === wanted) {
                  removed += 1;
                  continue;
                }
                keep.push(line);
              }
              if (!removed) return panelReply(res, 404, { ok: false, error: '这一层里找不到那一行' });
              // 删前留底：这里删的是"重复的那一份"，但判重复的是人 ——
              // 判错了就是整行没了，而这一层多半只有一两行。
              pushTrash({
                kind: 'line',
                payload: { target, line: wanted, file: path.basename(file) },
                label: `${target}：${wanted.slice(0, 60)}`,
              });
              writeFileSync(file, keep.join('\n'));
              log(`删掉重复的一行（${target}），共 ${removed} 行`);
              return panelReply(res, 200, { ok: true, removed, target });
            } catch (err) {
              return panelReply(res, 400, { ok: false, error: err instanceof Error ? err.message : String(err) });
            }
          },
        },
        {
          // 记忆体检：四本账条数、体积、注入估算、重复提示。
          //
          // 只读不写。走磁盘扫描而不是 memoryLayout —— 两个 cordis 入口的模块
          // 实例不共享，host 这边拿不到 soul 的 layout 实例。
          kind: 'exact',
          path: `${PANEL_BASE}/stats`,
          handler: async (req, res) => {
            if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
            if (req.method !== 'GET') return panelReply(res, 405, { ok: false, error: '只支持 GET' });
            try {
              const memoryRoot = path.join(dshHome(), 'soul-md', 'memory');
              const diaryDir = path.join(dshHome(), 'feiyu-diary');
              const stats = collectStatsFromDisk({ memoryRoot, diaryDir });
              const layers = collectLayerReport({ memoryRoot, diaryDir });
              return panelReply(res, 200, { ok: true, ...stats, ...layers });
            } catch (err) {
              return panelReply(res, 500, {
                ok: false,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          },
        },
        {
          // 回顾：共度时光按天分组，最近 N 天 +「X 天前的今天」。
          kind: 'exact',
          path: `${PANEL_BASE}/review`,
          handler: async (req, res) => {
            if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
            if (req.method !== 'GET') return panelReply(res, 405, { ok: false, error: '只支持 GET' });
            try {
              const params = new URL(String(req.url ?? ''), 'http://localhost').searchParams;
              const days = Math.min(Math.max(Number(params.get('days')) || 7, 1), 60);
              const lookback = Math.min(Math.max(Number(params.get('lookback')) || 7, 1), 365);
              const diaryDir = path.join(dshHome(), 'feiyu-diary');
              const review = collectReview({ diaryDir, days, lookback });
              return panelReply(res, 200, { ok: true, ...review });
            } catch (err) {
              return panelReply(res, 500, {
                ok: false,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          },
        },
        {
          // 云端备份（WebDAV）：POST = 立刻生成一份新备份并上传；GET = 看状态。
          //
          // 为什么不用前端上传文件：备份必须用**磁盘上那份**现在的内容，
          // 不能在浏览器里拼 —— 人设卡与深层记忆只有服务端读得到。
          kind: 'exact',
          path: `${PANEL_BASE}/cloud`,
          handler: async (req, res) => {
            if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
            const wd = normalizeWebdavConfig(cfgNow());
            if (req.method === 'GET') {
              let remote = null;
              if (/[?&]list=1\b/.test(String(req.url ?? '')) && wd.configured && wd.enabled) {
                try {
                  remote = await listRemoteBackups(wd);
                } catch (err) {
                  remote = { error: err instanceof Error ? err.message : String(err) };
                }
              }
              return panelReply(res, 200, {
                ok: true,
                enabled: wd.enabled,
                configured: wd.configured,
                dir: wd.dir,
                auto: wd.auto,
                keep: wd.keep,
                username: wd.username,
                url: wd.url,
                user: wd.username,
                passwordSet: wd.password !== '',
                lastAt: cloudState.lastAt,
                lastFile: cloudState.lastFile,
                lastBytes: cloudState.lastBytes,
                lastRemoved: cloudState.lastRemoved,
                lastReason: cloudState.lastReason,
                lastError: cloudState.lastError,
                remote: Array.isArray(remote) ? remote : remote,
              });
            }
            if (req.method !== 'POST') return panelReply(res, 405, { ok: false, error: 'method' });
            try {
              await loadPromise;
              const result = await cloudBackupOnce({ reason: 'panel' });
              return panelReply(res, 200, { ok: true, ...result });
            } catch (err) {
              return panelReply(res, 400, {
                ok: false,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          },
        },
        {
          // 测 WebDAV 连不连得上：POST 试一次「建目录 + 列目录」，不上传、不改数据。
          //
          // 接受表单里的**草稿**（url/user/password/dir），所以能在保存之前先试；
          // 密码留空表示沿用已保存的那个（界面上从不回显密码）。
          kind: 'exact',
          path: `${PANEL_BASE}/cloud/test`,
          handler: async (req, res) => {
            if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
            if (req.method !== 'POST') return panelReply(res, 405, { ok: false, error: 'method' });
            try {
              const text = await readPanelTextBody(req, { limit: 64 * 1024 });
              const patch = JSON.parse(text || '{}');
              const raw = { ...cfgNow() };
              const take = (key, max) => {
                if (patch[key] === undefined) return;
                raw[key] = String(patch[key] ?? '').trim().slice(0, max);
              };
              take('webdavUrl', 512);
              take('webdavUser', 256);
              take('webdavDir', 200);
              if (patch.webdavPassword) raw.webdavPassword = String(patch.webdavPassword).slice(0, 512);
              const wd = normalizeWebdavConfig(raw);
              const result = await testConnection(wd);
              log(`云端连接测试通过：${result.url}（${result.elapsedMs} ms${result.listed ? `，云端 ${result.remoteCount} 份备份` : ''}）`);
              return panelReply(res, 200, { ...result, dirWritable: true });
            } catch (err) {
              const message = explainWebdavError(err);
              warn(`云端连接测试失败：${message}`);
              return panelReply(res, 400, { ok: false, error: message });
            }
          },
        },
        {
            // 配置备份：GET 列出云端有哪些 `配置-*.json`；POST 把当前配置传上去。
            //
            // 为什么只装配置：四本账有 fish_backup / /cloud 那条路，这里只解决
            // 「换设备不用重填一遍 WebDAV 账号、保留份数、预算」这种小麻烦。
            kind: 'exact',
            path: `${PANEL_BASE}/cloud/config-backup`,
            handler: async (req, res) => {
              if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
              const wd = normalizeWebdavConfig(cfgNow());
              if (req.method === 'GET') {
                if (!wd.configured) return panelReply(res, 200, { ok: true, configured: false, files: [] });
                try {
                  const files = await listRemoteConfigs(wd);
                  return panelReply(res, 200, { ok: true, configured: true, files });
                } catch (err) {
                  return panelReply(res, 400, { ok: false, error: explainWebdavError(err) });
                }
              }
              if (req.method !== 'POST') return panelReply(res, 405, { ok: false, error: 'method' });
              try {
                if (!wd.configured) throw new Error('WebDAV 还没配置：先把服务器地址、账号、密码填上');
                const payload = {
                  format: CONFIG_BACKUP_FORMAT,
                  version: CONFIG_BACKUP_VERSION,
                  exportedAt: new Date().toISOString(),
                  entryId: PLUGIN_ENTRY_ID,
                  config: { ...cfgNow() },
                };
                const fileName = configFileName();
                const text = `${JSON.stringify(payload, null, 2)}\n`;
                const uploaded = await uploadBackupText(wd, { text, fileName });
                log(`配置已传到云端：${uploaded.fileName}（${uploaded.bytes} 字节）`);
                return panelReply(res, 200, { ok: true, ...uploaded });
              } catch (err) {
                const message = explainWebdavError(err);
                warn(`配置上传失败：${message}`);
                return panelReply(res, 400, { ok: false, error: message });
              }
            },
          },
          {
            // 从云端恢复配置：默认 dry-run，只报「哪几项会变」；confirm 才写回 settings。
            kind: 'exact',
            path: `${PANEL_BASE}/cloud/config-restore`,
            handler: async (req, res) => {
              if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
              if (req.method !== 'POST') return panelReply(res, 405, { ok: false, error: 'method' });
              try {
                const text = await readPanelTextBody(req, { limit: 256 * 1024 });
                const body = JSON.parse(text || '{}');
                const fileName = String(body.file ?? '').split(/[\\/]/).pop() ?? '';
                if (!fileName.startsWith('配置-')) throw new Error('请选一个 `配置-…json` 文件');
                const wd = normalizeWebdavConfig(cfgNow());
                if (!wd.configured) throw new Error('WebDAV 还没配置，恢复不了');
                const got = await downloadRemoteText(wd, fileName);
                let payload;
                try {
                  payload = JSON.parse(got.text);
                } catch {
                  throw new Error('这份文件不是 JSON，可能不是配置备份');
                }
                if (payload?.format !== CONFIG_BACKUP_FORMAT) throw new Error('这份文件不是本插件的配置备份');
                const raw = payload?.config && typeof payload.config === 'object' ? payload.config : {};
                const known = CONFIG_SPEC.map((item) => item.key);
                const picked = {};
                for (const key of known) {
                  if (raw[key] !== undefined) picked[key] = raw[key];
                }
                const current = cfgNow();
                const changes = {};
                for (const [key, value] of Object.entries(picked)) {
                  if (key === 'webdavPassword') {
                    if (String(value ?? '') !== String(current[key] ?? '')) changes[key] = ['（已保存的密码）', '（备份里的密码）'];
                    continue;
                  }
                  const before = current[key];
                  if (JSON.stringify(before) !== JSON.stringify(value)) {
                    changes[key] = [before, value];
                  }
                }
                const result = {
                  ok: true,
                  file: fileName,
                  exportedAt: payload.exportedAt ?? '',
                  keys: Object.keys(picked).length,
                  changes,
                  passwordIncluded: typeof picked.webdavPassword === 'string' && picked.webdavPassword !== '',
                };
                if (body.confirm !== true) return panelReply(res, 200, { ...result, dryRun: true, applied: [] });
                const settings = ctx.get('settings');
                if (!settings || typeof settings.update !== 'function') throw new Error('设置服务不可用，恢复不了');
                const next = { ...current, ...picked };
                await settings.update(PLUGIN_ENTRY_ID, next);
                const wd2 = normalizeWebdavConfig(cfgNow());
                log(`配置已从云端恢复：${fileName}（${Object.keys(picked).length} 项）`);
                return panelReply(res, 200, {
                  ...result,
                  dryRun: false,
                  applied: Object.keys(picked),
                  configured: wd2.configured,
                  dir: wd2.dir,
                  keep: wd2.keep,
                });
              } catch (err) {
                const message = explainWebdavError(err);
                warn(`配置恢复失败：${message}`);
                return panelReply(res, 400, { ok: false, error: message });
              }
            },
          },
        {
          // 云端记忆备份：GET = 列云端 备份-*.json；POST = 从云端拉一份回来还原。
          //
          // 和本地「导入备份」只差上游：这里从 WebDAV 下载整包 JSON，之后的
          // dry-run / confirm / 还原前快照全都走同一条 restoreFromText，不另开一套。
          kind: 'exact',
          path: `${PANEL_BASE}/cloud/backups`,
          handler: async (req, res) => {
            if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
            if (req.method !== 'GET') return panelReply(res, 405, { ok: false, error: 'method' });
            const wd = normalizeWebdavConfig(cfgNow());
            if (!wd.configured) return panelReply(res, 200, { ok: true, configured: false, files: [] });
            try {
              const files = await listRemoteBackups(wd);
              return panelReply(res, 200, { ok: true, configured: true, dir: wd.dir, files });
            } catch (err) {
              return panelReply(res, 400, { ok: false, error: explainWebdavError(err) });
            }
          },
        },
        {
          kind: 'exact',
          path: `${PANEL_BASE}/cloud/restore`,
          handler: async (req, res) => {
            if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
            if (req.method !== 'POST') return panelReply(res, 405, { ok: false, error: 'method' });
            const confirm = /[?&]confirm=(?:1|true|yes)\b/i.test(String(req.url ?? ''));
            try {
              const text = await readPanelTextBody(req, { limit: 256 * 1024 });
              const body = JSON.parse(text || '{}');
              const fileName = String(body.file ?? '').split(/[\\/]/).pop() ?? '';
              if (!/^备份-.+\.json$/.test(fileName)) throw new Error('请选一个 `备份-…json` 文件');
              const wd = normalizeWebdavConfig(cfgNow());
              if (!wd.configured) throw new Error('WebDAV 还没配置，恢复不了');
              const got = await downloadRemoteText(wd, fileName);
              await loadPromise;
              await drainPromise;
              await writeChain;
              const restore = ctx.get('fishMemory')?.restoreBackup;
              const mode = String(got.mode ?? '').toLowerCase() === 'merge' ? 'merge' : 'replace';
            const input = { text: got.text, confirm, sourceLabel: `云端 ${fileName}`, mode };
              const result = typeof restore === 'function'
                ? await restore(input)
                : await restoreViaRegistered(input);
              log(`云端备份${confirm ? '已还原' : '（dry-run）'}：${fileName} · ${result.writes} 个文件、${result.cards} 张人设卡`);
              return panelReply(res, 200, { ok: true, file: fileName, ...result });
            } catch (err) {
              return panelReply(res, 400, { ok: false, error: explainWebdavError(err) });
            }
          },
        },
        {
          // 云端备份的配置写入：POST = 把表单内容写回 profile patch 里的本 entry。
          //
          // 为什么走服务端：配置是 cordis 的 settings 文档，写它要走
          // `settings.update(entryId, …)`（带 revision 与重载）；前端直接改
          // yaml 会踩缩进与转义，还会在下次装插件时被覆盖。
          kind: 'exact',
          path: `${PANEL_BASE}/cloud/config`,
          handler: async (req, res) => {
            if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
            if (req.method !== 'POST') return panelReply(res, 405, { ok: false, error: 'method' });
            try {
              const text = await readPanelTextBody(req, { limit: 64 * 1024 });
              const patch = JSON.parse(text || '{}');
              const next = { ...cfgNow() };
              const putString = (key, max) => {
                if (patch[key] === undefined) return;
                next[key] = String(patch[key] ?? '').trim().slice(0, max);
              };
              putString('webdavUrl', 512);
              putString('webdavUser', 256);
              putString('webdavDir', 200);
              if (patch.webdavPassword !== undefined) {
                // 空串 = 显式清空；前端不传这个键就保留原密码。
                next.webdavPassword = String(patch.webdavPassword ?? '').slice(0, 512);
              }
              if (patch.webdavAuto !== undefined) next.webdavAuto = Boolean(patch.webdavAuto);
              if (patch.webdavEnabled !== undefined) next.webdavEnabled = Boolean(patch.webdavEnabled);
              if (patch.webdavKeep !== undefined) {
                const keep = Number(patch.webdavKeep);
                next.webdavKeep = Number.isFinite(keep) ? Math.min(200, Math.max(1, Math.round(keep))) : 10;
              }
              const settings = ctx.get('settings');
              if (!settings || typeof settings.update !== 'function') {
                throw new Error('设置服务不可用，改不了配置：可以直接改 profile 的 cordis.patch.yml');
              }
              await settings.update(PLUGIN_ENTRY_ID, next);
              const wd = normalizeWebdavConfig(cfgNow());
              log(`云端配置已保存：${wd.configured ? '已填地址' : '地址为空'}${wd.enabled ? '' : '（总开关关着）'}`);
              return panelReply(res, 200, {
                ok: true,
                enabled: wd.enabled,
                configured: wd.configured,
                url: wd.url,
                user: wd.username,
                passwordSet: wd.password !== '',
                dir: wd.dir,
                auto: wd.auto,
                keep: wd.keep,
              });
            } catch (err) {
              return panelReply(res, 400, {
                ok: false,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          },
        },
      ];
      const disposers = routes.map((r) => scope.webServer.register(r));
      // 清单从 routes 现算，别手写：手写过的那版已经漏掉一个（export-md）。
      const routeNames = routes
        .map((r) => String(r.path ?? '').slice(PANEL_BASE.length).replace(/^\//, ''))
        .filter(Boolean)
        .join(',');
      log(`面板接口已注册：${PANEL_BASE}/{${routeNames}}`);
      return () => {
        for (const d of disposers.reverse()) {
          try {
            d();
          } catch {
            // 注销失败不该影响卸载
          }
        }
      };
    }, 'feiyu: 面板数据接口');
  });

  /* ── 检索工具：只读，不碰档案 ── */
  //
  // 2026-10-27：原来这里还有一个 `feiyu_note`（主动记一条）。
  // 它和「我自己想的」那一栏一起下线 —— 那栏里四条全是「我该怎么干」，
  // 一条「他是什么人」都没有。档案里那 58 条 `kind: "note"` 留着，不动。
  //
  // 为什么不复用 selectMemories 那套"选秀"逻辑（权重、冷却、走神、maxShow）：
  // 那是给**每轮自动注入**设计的，要在"没人问"的情况下替它挑。
  // 而工具是**它自己发起**的查询 —— 它知道自己在找什么，
  // 所以直接按相似度排、取前 N 条，不设 salience 门槛。
  //
  // 明确要找，就该找得到，不管那件旧事淡到什么程度。
  /**
   * 从全部 summary 里挑出相关的几条。
   *
   * 输入：她的一句话 + 每条的 summary（没有 summary 的用正文前 30 字兜底）
   * 输出：id 数组。挑不出来就空数组 —— **不硬凑**。
   *
   * 这一段跑在她看不见的地方：她的上下文里永远不会出现 summary。
   * 她只会在拿到结果后看见几条正文 —— 那就是"想起来"的样子。
   *
   * 上限 400 条：再多 prompt 就压不住了。超了只取最近的 400，
   * 这是个已知的近似，日志里会说 —— 别让它悄悄降级。
   */
  async function pickBySummary(query, limit, source = archive.diary) {
    const llmP = ctx.get('llm');
    if (llmP === undefined) return null;
    const all = source.filter((e) => typeof e.text === 'string' && e.text !== '');
    if (all.length === 0) return [];

    // ── 时间先收窄一次 ──
    //
    // 「上个月那个」「前两天我说过」—— 这种问法里一个专有名词都没有，
    // 拿去做内容检索，一个字都撞不上。而日期本来就在条目上，之前白白没用。
    //
    // 认得出时间就只在那个窗口里挑；窗口里一条都没有，就退回全量 ——
    // **绝不因为时间认错过而让她什么也找不到。**
    let narrowed = null;
    const timeHint = parseTimeHint(query, Date.now());
    if (timeHint !== null) {
      const inWindow = all.filter(
        (e) => Number.isFinite(e.created_at) && e.created_at >= timeHint.from && e.created_at <= timeHint.to,
      );
      if (inWindow.length > 0) {
        narrowed = timeHint;
        log(
          `挑往事：她问的是「${timeHint.label}」，先把 ${all.length} 条收到 ${inWindow.length} 条`,
        );
      } else {
        log(`挑往事：她问的是「${timeHint.label}」，但那个窗口里一条都没有，退回全量`);
      }
    }

    const base = narrowed === null ? all : all.filter(
      (e) => Number.isFinite(e.created_at) && e.created_at >= narrowed.from && e.created_at <= narrowed.to,
    );
    const pool = base.slice(-400);
    if (base.length > pool.length) log(`挑往事：${base.length} 条只取最近 ${pool.length} 条`);

    // 索引行前面带日期 —— 模型才有办法回答「那阵子」这种问法。
    // 叫 mmdd 不叫 dayLabel：timeline.mjs 已经有一个 dayLabel（今天 / 昨天 / 3 天前），
    // 同名不同义，读代码时最容易拿错的那一种。
    const mmdd = (t) => {
      if (!Number.isFinite(t)) return '??/??';
      const d = new Date(t + TZ_OFFSET_MS);
      return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
    };
    const lines = pool.map((e) => {
      const idx =
        typeof e.summary === 'string' && e.summary !== ''
          ? e.summary
          : String(e.text).replace(/\s+/g, ' ').slice(0, 30);
      return `${e.id} ${mmdd(e.created_at)} ${idx}`;
    });

    const system =
      '你在帮一条鱼回忆往事。她问了一句，你从她的日记索引里挑出最相关的几条。\n\n' +
      '每行是「id 空格 日期 一句索引」。有些索引很粗（正文截断出来的），别嫌弃。\n' +
      '**如果她问的是一段时间（「那阵子」「上个月」），优先看日期。**\n' +
      '只输出 JSON：{"ids":["d_20261028_1","d_20261028_2"]}\n' +
      '没有相关的就输出 {"ids":[]}。最多 ' + limit + ' 条。**宁可少挑，别硬凑。**';

    const selection = ctx.get('agentDefaultModel')?.currentSelection?.() ?? undefined;
    const provider = selection?.provider;
    const model = config.model || selection?.model;
    if (typeof provider !== 'string' || typeof model !== 'string') return null;

    const t0 = Date.now();
    let text = '';
    let usageChunk;
    try {
      for await (const chunk of llmP.stream({
        provider,
        model,
        system,
        // ⚠️ **顺序是钱。** 稳定的大头（索引）必须在前面，会变的那一小句放最后。
        //
        // 缓存按**前缀**匹配：第一段一变，后面九千多 token 全部重算。
        // 原来写的是「她问：X \n\n 索引：…」—— query 在最前面，
        // 于是每一轮都从第一个 token 开始不命中，等于一直在按全价买这九千多 token。
        //
        // 换成索引在前、问题在后：命中价 0.1 元/M vs 全价 1 元/M，差十倍。
        // 只有"新增了日记"那天索引才变，一天也就几次。
        messages: [
          { role: 'user', content: [{ type: 'text', text: `索引：\n${lines.join('\n')}\n\n她问：${query}` }] },
        ],
        maxTokens: 200,
        temperature: 0,
        // 同上：空字符串是非法档位，stream 会不返回
        ...(typeof config.reasoningEffort === 'string' && config.reasoningEffort.trim() !== ''
          ? { reasoningEffort: config.reasoningEffort.trim() }
          : {}),
      })) {
        if (chunk?.type === 'text-delta') text += chunk.text;
        else if (chunk?.type === 'usage') {
          // 实测（2026-10-28）：usage 不在 finish 上，它是**独立的一种 chunk**。
          // chunkTypes 探针打出来是 block-start,block-end,usage,finish ——
          // 我猜了两轮字段名才看到这个。
          usageChunk = chunk;
        }
      }
    } catch (err) {
      warn(`挑往事失败，退回字面：${err instanceof Error ? err.message : String(err)}`);
      return null;
    }

    // 记一笔用量 —— 缓存有没有命中，只有 finish 里的 usage 说得清。
    // 不写日志（debugLog 默认关着），写 manifest：任何时候都能查。
    try {
      markPick(pool.length, lines.length, usageChunk?.usage ?? usageChunk?.data ?? usageChunk);
      await persist();
    } catch (err) {
      warn(`挑往事：记用量失败（不影响结果）：${err instanceof Error ? err.message : String(err)}`);
    }

    const a = text.indexOf('{');
    const b = text.lastIndexOf('}');
    if (a < 0 || b <= a) {
      warn('挑往事：返回里没有 JSON，退回字面');
      return null;
    }
    let parsed;
    try {
      parsed = JSON.parse(text.slice(a, b + 1));
    } catch {
      warn('挑往事：JSON 解析失败，退回字面');
      return null;
    }
    // 返回里连 ids 都没有 = 它没按格式答，**不是"没有相关的"**。
    // 这时候必须退回字面 —— 不能拿"程序答歪了"当成"记忆里没有"。
    if (!Array.isArray(parsed?.ids)) {
      warn('挑往事：返回里没有 ids，退回字面');
      return null;
    }
    const ids = parsed.ids;
    const valid = ids.filter((x) => typeof x === 'string').slice(0, limit);
    log(
      `挑往事「${query.slice(0, 20)}」：${pool.length} 条候选 / ${lines.length} 行索引` +
        ` / 挑中 ${valid.length} 条 / ${((Date.now() - t0) / 1000).toFixed(1)}s`,
    );
    return valid;
  }

  ctx.inject(['tools'], (scope) => {
    scope.effect(
      () =>
        scope.tools.register({
          name: RECALL_TOOL_NAME,
          description:
            '回想一些以前的事。**你自己想不起来时用它**：' +
            '他提到一件早先的事、你觉得该想起来却一片空白、或者要确认某个细节。' +
            '只在真的需要时调，不要每轮都查。' +
            '想不起来就老实说想不起来，别编。',
          parameters: {
            type: 'object',
            additionalProperties: false,
            properties: {
              query: {
                type: 'string',
                description:
                  '要找什么。用**当时的具体词** —— 人名、地点、物件、他那句话里的词。越具体越准，别写一整句话。',
              },
              limit: {
                type: 'integer',
                description: '要几条。默认 5，最多 10。',
              },
              since: {
                type: 'string',
                description: '只要这一天及以后的（YYYY-MM-DD）。想找回「上个月那件事」时用。',
              },
              until: {
                type: 'string',
                description: '只要这一天及以前的（YYYY-MM-DD）。',
              },
            },
            required: ['query'],
          },
          output: {
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                ok: { type: 'boolean' },
                found: { type: 'integer' },
                text: { type: 'string' },
              },
            },
            render: (_args, value) => [{ type: 'text', text: value?.text ?? '查不了。' }],
          },

          async execute(args) {
            await loadPromise;
            if (!ready) throw new Error('档案现在读不了（可能是坏的），查不了。');

            const query = typeof args?.query === 'string' ? args.query.trim() : '';
            if (query === '') throw new Error('要找什么？query 不能是空的。');

            const limitRaw = Number(args?.limit);
            const limit = Number.isFinite(limitRaw)
              ? Math.max(1, Math.min(10, Math.floor(limitRaw)))
              : 5;

            // 时间范围：按条目自己的日期（`date` 或 `at`）比，都是 ISO 前缀，
            // 直接按字符串比就够。没写日期又给了范围的条目算「不确定」，不返回 ——
            // 宁可少一条，也别把别的日子混进来。
            const dayOf = (entry) =>
              String(entry?.date ?? entry?.at ?? entry?.created_at ?? '').slice(0, 10);
            const since = typeof args?.since === 'string' ? args.since.trim().slice(0, 10) : '';
            const until = typeof args?.until === 'string' ? args.until.trim().slice(0, 10) : '';
            const hasRange = Boolean(since || until);
            const inRange = (entry) => {
              if (!hasRange) return true;
              const day = dayOf(entry);
              if (!day) return false;
              if (since && day < since) return false;
              if (until && day > until) return false;
              return true;
            };

            const byId0 = new Map(archive.diary.map((e) => [e.id, e]));

            // ── 冷档案也进语料（2026-11-04）──
            //
            // `fish_compact` 把 45 天前的原文搬进 `diary/archive/`，而那里
            // 之前**没有任何读者** —— 压缩等于永久删除。显式要找的时候
            // （"去年那件事"）恰恰是最该翻到旧纸箱的时候。
            //
            // 只读不写回：归档是有意的，把翻出来的塞回 diary 会让下次压缩
            // 再搬一遍，来回抖。命中只是"想起来"。
            const coldAll = readColdArchive();
            // 只留"热档案里已经没有了"的：同 id 两边都有时，热的那份才是最新的。
            const onlyCold = coldOnly(coldAll, byId0);
            const coldIds = new Set(onlyCold.map((e) => e.id));
            // 挑往事那一步只吃最近 400 行索引（`base.slice(-400)`）。
            // 归档条目一定比热条目老，原样拼在一起会被那一步整批切掉 ——
            // 所以在这里先各取一段、总数压在 400 以内，谁都不被无声丢掉。
            const hotTail = archive.diary.slice(-300);
            const coldTail = onlyCold.slice(-100);
            const corpus = coldTail.length > 0 ? [...coldTail, ...hotTail] : archive.diary;
            if (onlyCold.length > 0) {
              log(`检索：语料含 ${coldTail.length}/${onlyCold.length} 条归档原文`);
            }

            const byId = new Map(corpus.map((e) => [e.id, e]));

            // ── 挑：交给模型读 summary，不按键面 ──
            //
            // 为什么不是 BM25：她那次摔跤就是"他换个说法我就搜不到"。
            // 字面匹配救不了同义改写；而 summary 是写给"意思"的，模型能读意思。
            //
            // 为什么 summary 不进她的上下文：她只看到挑出来的正文。
            // 检索那一步她看不见 —— 这就是"潜意识"。
            //
            // 代价：每次调工具多一次模型请求。只有她判断"这是往事"时才会发生，
            // 平时是零。
            const picked = await pickBySummary(query, Math.min(limit, 3), corpus);

            let ranked;
            if (picked !== null) {
              ranked = picked
                .map((id) => ({ entry: byId.get(id), sim: 0 }))
                .filter((x) => x.entry && typeof x.entry.text === 'string');
            } else {
              // 没有 llm 服务时退回字面 —— 不能用"挑不了"当没找到
              const scores = searchScores(index, query, { limit: 200 });
              // 冷档案单建一份索引，分数并进来。
              // 两套索引的 N 与平均长度不同，分数严格说不同量纲 ——
              // 但都只用它排序，同时命中的条目自然会得两份分，正好更高。
              if (onlyCold.length > 0) {
                for (const [id, s] of searchScores(coldIndex(), query, { limit: 200 })) {
                  if (coldIds.has(id)) scores.set(id, (scores.get(id) ?? 0) + s);
                }
              }
              ranked = [...scores.entries()]
                .map(([id, sim]) => ({ entry: byId.get(id), sim }))
                .filter((x) => x.entry && typeof x.entry.text === 'string')
                .sort((a, b) => b.sim - a.sim)
                .slice(0, limit);
            }

            // 时间范围在这一步统一裁：挑的和字面命中的都过同一道闸。
            if (hasRange) ranked = ranked.filter((x) => inRange(x.entry));

            // ── 兜底：词检索查不到时，直接扫原文子串 ──
            //
            // 为什么需要：分词只出**双字** bigram（`tokenize('他让我')` 是
            // `['他让','让我']`，不含单字）。所以「他」「园」这种单字查询
            // 在倒排索引里永远为空 —— 但它明明是想找的东西。
            //
            // 181 条 × 两百字，扫一遍是毫秒级，而且**只在没结果时才走**，
            // 有结果就不兜，排序不受影响。
            if (picked === null && ranked.length === 0 && query.length <= 4) {
              const needle = query.toLowerCase();
              ranked = corpus
                .filter((e) => inRange(e))
                .filter((e) => typeof e.text === 'string' && e.text.toLowerCase().includes(needle))
                .slice(-limit)
                .reverse()
                .map((entry) => ({ entry, sim: 0 }));
              if (ranked.length > 0) log(`检索「${query.slice(0, 20)}」：词索引空，子串兜底命中 ${ranked.length} 条`);
            }

            if (ranked.length === 0) {
              log(`检索「${query.slice(0, 20)}」：没找到`);
              return {
                ok: true,
                found: 0,
                text: hasRange
                  ? `那段时间（${since || '最初'} → ${until || '现在'}）里没找到。要么换个说法，要么放宽日期。`
                  : `想不起来了。换个说法再试试，或者直接问他。`,
              };
            }

            // 总字数封顶 —— 不按"次数"限流（那要跨轮状态，麻烦），
            // 按"返回量"限：超了就是一次失败的成本，它自己会学会别乱查。
            const MAX_CHARS = 2000;
            const lines = [];
            let used = 0;
            const now = Date.now();
            for (const { entry } of ranked) {
              // 跟注入走同一个隐私闸 —— 历史条目里可能还有没洗过的东西
              const body = stripTimeWords(scrub(entry.text, { thirdParty: false }).text);
              const when = softWhen(entry.created_at, now);
              // 归档里的条目要标出来。不标的话它读起来和昨天的事一样新，
              // 而"这是很久以前的事"本身是信息 —— 语气、时态全靠这个。
              const tag = coldIds.has(entry.id) ? '（旧档案）' : '';
              const head = when === '' ? tag : `${tag}${when}`;
              const line = head === '' ? body : `${head}：${body}`;
              if (used + line.length > MAX_CHARS && lines.length > 0) break;
              lines.push(`- ${line}`);
              used += line.length;
            }

            // 翻过也算"想起来过" —— 冷档案不在 diary 里，noteRecalled 会自动跳过
            noteRecalled(ranked.map((x) => x.entry?.id));

            log(`检索「${query.slice(0, 20)}」：返回 ${lines.length} 条`);
            return {
              ok: true,
              found: lines.length,
              text: lines.join('\n'),
            };
          },

          presentCall: (args) => ({
            card: 'generic',
            title: '翻档案',
            kind: 'other',
            rawInput: args,
          }),
        }),
      'feiyu: recall tool',
    );
    log(`已注册工具 ${RECALL_TOOL_NAME}`);
  });

  // 云端备份工具：他一句「备份一下」，我不用等面板，直接推一份上去。
  ctx.inject(['tools'], (scope) => {
    scope.effect(
      () =>
        scope.tools.register({
          name: 'fish_cloud_backup',
          description:
            '把整份记忆（人设卡、深层记忆、共度时光、情感日记、人格手记、浅层）打成一个 JSON，' +
            '上传到设置里配置好的 WebDAV 云端，并顺手删掉超出保留份数的旧备份。' +
            '他说「备份一下」「传到云上」「存一份到网盘」时用它。没配置会返回一句明确的错。',
          parameters: {
            type: 'object',
            additionalProperties: false,
            properties: {
              note: {
                type: 'string',
                description: '可选备注，写进备份的 meta 里，方便日后认出来。',
              },
            },
          },
          output: {
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                ok: { type: 'boolean' },
                url: { type: 'string' },
                file: { type: 'string' },
                bytes: { type: 'integer' },
                removed: { type: 'integer' },
              },
            },
            render: (_args, value) =>
              value?.ok
                ? [
                    {
                      type: 'text',
                      text: `已传到云端：${value.file}（${value.bytes} 字节）\n${value.url}${
                        value.removed ? `\n顺手清掉 ${value.removed} 份旧备份` : ''
                      }`,
                    },
                  ]
                : [{ type: 'text', text: '没传上去。' }],
          },
          async execute(args) {
            const result = await cloudBackupOnce({
              reason: 'tool',
              note: typeof args?.note === 'string' ? args.note : '',
            });
            return {
              ok: true,
              url: result.url,
              file: result.fileName,
              bytes: result.bytes,
              removed: result.removed.length,
            };
          },
        }),
      'fish: cloud backup tool',
    );
    log('已注册工具 fish_cloud_backup');
  });

  // 「还挂着的事」+「压缩旧条目」：2026-11-02 加的两个大件。
  ctx.inject(['tools'], (scope) => {
    const loopsFile = loopsPath(archiveDirectory);

    scope.effect(
      () =>
        scope.tools.register({
          name: 'loop_add',
          description:
            '记一件「还挂着的事」——他让你回头弄的、你答应了还没做的、约好但没到的。' +
            '每轮会有一行「还挂着 N 件事」摆出来提醒。办完立刻用 loop_done 销掉，别攒。',
          parameters: {
            type: 'object',
            additionalProperties: false,
            properties: {
              text: { type: 'string', description: '一句话说清是什么事，别写「那个」。' },
              note: { type: 'string', description: '可选：为什么挂着、卡在哪。' },
            },
            required: ['text'],
          },
          output: {
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: { ok: { type: 'boolean' }, created: { type: 'boolean' }, open: { type: 'integer' } },
            },
            render: (_a, v) =>
              v?.ok
                ? [{ type: 'text', text: `${v.created ? '记下了' : '这条已经在账上了'}，现在挂着 ${v.open} 件。` }]
                : [{ type: 'text', text: '没记上。' }],
          },
          async execute(args) {
            const { created } = addLoop(loopsFile, args?.text, { note: args?.note });
            return { ok: true, created, open: openLoops(loopsFile).length };
          },
        }),
      'fish: loop add',
    );

    scope.effect(
      () =>
        scope.tools.register({
          name: 'loop_done',
          description: '销掉一件「还挂着的事」。按 id 或文中一段话匹配，销掉后每轮的提醒里就不出现了。',
          parameters: {
            type: 'object',
            additionalProperties: false,
            properties: {
              match: { type: 'string', description: 'id（l_xxx）或那句话里的一段。' },
            },
            required: ['match'],
          },
          output: {
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: { ok: { type: 'boolean' }, text: { type: 'string' }, open: { type: 'integer' } },
            },
            render: (_a, v) =>
              v?.ok
                ? [{ type: 'text', text: `销掉：${v.text}。还剩 ${v.open} 件。` }]
                : [{ type: 'text', text: '账上没找到这一件，用 loop_list 看看现在挂着什么。' }],
          },
          async execute(args) {
            const hit = doneLoop(loopsFile, args?.match);
            return { ok: hit.done, text: hit.item?.text ?? '', open: openLoops(loopsFile).length };
          },
        }),
      'fish: loop done',
    );

    scope.effect(
      () =>
        scope.tools.register({
          name: 'loop_list',
          description: '看看还挂着哪些事。注入里最多显示 8 条，这里给全部。',
          parameters: { type: 'object', additionalProperties: false, properties: {} },
          output: {
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                count: { type: 'integer' },
                items: { type: 'array', items: { type: 'object' } },
              },
            },
            render: (_a, v) =>
              v?.count
                ? [{ type: 'text', text: v.items.map((x) => `- ${x.text}`).join('\n') }]
                : [{ type: 'text', text: '账上是空的。' }],
          },
          async execute() {
            const items = openLoops(loopsFile).map((x) => ({ id: x.id, text: x.text }));
            return { count: items.length, items };
          },
        }),
      'fish: loop list',
    );

    // ── 压缩旧条目 ──
    //
    // 45 天前的条目折成「某月共 N 件」的摘要，原文挪进 diary/archive/。
    // 默认 dry-run：先看会动多少，再决定写不写。
    scope.effect(
      () =>
        scope.tools.register({
          name: 'fish_compact',
          description:
            '把很久以前的共度时光条目折成月度摘要，原文归档到 diary/archive/，不再进注入。' +
            '默认只算不写（dry-run）；要看真动，传 dryRun:false。' +
            '条目多到召回开始变吵的时候用它。',
          parameters: {
            type: 'object',
            additionalProperties: false,
            properties: {
              olderThanDays: { type: 'integer', description: '早于多少天算旧，默认 45。' },
              dryRun: { type: 'boolean', description: '默认 true；传 false 才真写。' },
            },
          },
          output: {
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                ok: { type: 'boolean' },
                dryRun: { type: 'boolean' },
                moved: { type: 'integer' },
                digests: { type: 'array', items: { type: 'object' } },
              },
            },
            render: (_a, v) => {
              if (!v?.ok) return [{ type: 'text', text: '没折成。' }];
              const lines = v.digests.map((d) => `- ${d.month}：${d.entries} 条 → 1 条摘要`);
              const head = v.moved === 0
                ? '没有该折的条目——都还新。'
                : `${v.dryRun ? '会折' : '已折'} ${v.moved} 条，压成 ${v.digests.length} 条月度摘要。`;
              return [{ type: 'text', text: [head, ...lines].join('\n') }];
            },
          },
          async execute(args) {
            const plan = planCompaction(Array.isArray(archive.diary) ? archive.diary : [], {
              olderThanDays: Number.isFinite(args?.olderThanDays) ? args.olderThanDays : 45,
            });
            const digests = plan.groups.map((g) => ({
              month: g.monthKey,
              entries: g.entries.length,
              id: g.digest.id,
            }));
            const dryRun = args?.dryRun !== false;
            if (dryRun || plan.movedCount === 0) {
              return { ok: true, dryRun, moved: plan.movedCount, digests };
            }
            // 原文先归档，再改内存、再落盘 —— 顺序反了就可能只删不存。
            const archiveDir = path.join(archiveDirectory, 'diary', 'archive');
            mkdirSync(archiveDir, { recursive: true });
            for (const g of plan.groups) {
              const file = path.join(archiveDir, `${g.monthKey}.jsonl`);
              appendFileSync(file, g.entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
            }
            archive.diary = applyCompaction(plan);
            await persist();
            log(`压缩共度时光：${plan.movedCount} 条 → ${plan.groups.length} 条摘要`);
            return { ok: true, dryRun: false, moved: plan.movedCount, digests };
          },
        }),
      'fish: compact tool',
    );

    // ── 回收站 ──
    //
    // 这个插件里所有删除原本都是直接删：忘掉一条、删掉重复的一行、
    // 手记整篇覆盖。而**有保护的那份恰好不是每轮注入的那份** ——
    // 情感日记存 `backups/feelings/`，人设卡有版本历史，
    // 而手记（每轮全量注入）和共度时光（永久）什么都没有。
    //
    // 现在删前都会往 `回收站.jsonl` 放一份，留 30 天。
    // 这两个工具是"把它拿回来"的那只手。
    scope.effect(
      () =>
        scope.tools.register({
          name: 'trash_list',
          description:
            '看看回收站里有什么 —— 最近 30 天删掉的日记条目、记忆层里的行、被覆盖前的手记。' +
            '他问「上次删的那个还在吗」「能不能找回来」时用它。',
          parameters: { type: 'object', additionalProperties: false, properties: {}, required: [] },
          output: {
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                count: { type: 'integer' },
                text: { type: 'string' },
              },
            },
            render: (_a, v) => [{ type: 'text', text: v?.text ?? '回收站是空的。' }],
          },
          isConcurrencySafe: () => true,
          async execute() {
            const records = readTrash();
            if (records.length === 0) {
              return { count: 0, text: '回收站是空的 —— 最近 30 天没有删过东西。' };
            }
            const now = Date.now();
            const lines = records.slice(0, 20).map((r) => {
              const left = daysLeft(r, { now, keepDays: DEFAULT_KEEP_DAYS });
              // 快到期的那几条要提醒一句 —— 不说的话它会在某天静默消失
              const warn = left <= 3 ? `（${left} 天后清除）` : '';
              return `- ${describeTrashRecord(r, now)}${warn}`;
            });
            const more = records.length > 20 ? `\n（还有 ${records.length - 20} 条，没全列出来）` : '';
            return {
              count: records.length,
              text: `回收站里有 ${records.length} 条（留 30 天）：\n${lines.join('\n')}${more}\n\n要拿回来就说一声，我用 trash_restore。`,
            };
          },
          presentCall: () => ({ card: 'generic', title: '看回收站', kind: 'other', rawInput: {} }),
        }),
      'fish: trash_list tool',
    );

    scope.effect(
      () =>
        scope.tools.register({
          name: 'trash_restore',
          description:
            '把回收站里的一条拿回来。传 id（trash_list 里那个）或者正文里的一段话都行。' +
            '恢复日记条目会把它重新加回共度时光；恢复「行」/手记只告诉你原文是什么，不自动写回。',
          parameters: {
            type: 'object',
            additionalProperties: false,
            properties: {
              match: { type: 'string', description: 'id，或者那条正文里的一段话。' },
            },
            required: ['match'],
          },
          output: {
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                ok: { type: 'boolean' },
                kind: { type: 'string' },
                restored: { type: 'boolean' },
                text: { type: 'string' },
              },
            },
            render: (_a, v) => [{ type: 'text', text: v?.text ?? '没找着。' }],
          },
          async execute(args) {
            await loadPromise;
            const needle = typeof args?.match === 'string' ? args.match.trim() : '';
            if (needle === '') throw new Error('要恢复哪一条？给个 id 或正文里的一段话。');
            const records = readTrash();
            const record = findTrashRecord(records, needle);
            if (record === undefined) {
              return {
                ok: false,
                kind: '',
                restored: false,
                text: `回收站里没有对得上「${needle.slice(0, 20)}」的。可能已经过了 30 天，或者压根没删过。`,
              };
            }

            if (record.kind === 'diary') {
              const entry = record.payload;
              if (!entry || typeof entry.id !== 'string') {
                return { ok: false, kind: 'diary', restored: false, text: '这条记录是坏的，里头没有条目。' };
              }
              if (archive.diary.some((e) => e.id === entry.id)) {
                return { ok: true, kind: 'diary', restored: false, text: '这条已经在档案里了，不用再恢复。' };
              }
              // ⚠️ **必须把墓碑摘掉。** 当初删的时候立了碑（防止三路合并
              // 从磁盘把它捞回来），不摘的话这次恢复会被同一个机制挡住 ——
              // 加进内存、落盘时被墓碑过滤掉，白忙。
              archive.diary = [...archive.diary, entry].sort(
                (a, b) => (a.created_at ?? 0) - (b.created_at ?? 0),
              );
              archive.manifest.deleted_ids = (archive.manifest.deleted_ids ?? []).filter((id) => id !== entry.id);
              // 磁盘上的那份墓碑也得摘 —— `persist()` 落盘前会跟磁盘三路合并，
              // 而墓碑是**取并集**的：只摘内存那一半，合并时又会被磁盘加回来。
              // 结果就是"这条在日记里、同时又标着已删除"，下一个会话落盘时
              // 可能按墓碑把它滤掉 —— 恢复白恢复。
              try {
                const diskManifest = path.join(archiveDirectory, MANIFEST_FILE);
                if (existsSync(diskManifest)) {
                  const rawManifest = JSON.parse(readFileSync(diskManifest, 'utf8'));
                  const gone = Array.isArray(rawManifest?.deleted_ids) ? rawManifest.deleted_ids : [];
                  if (gone.includes(entry.id)) {
                    rawManifest.deleted_ids = gone.filter((id) => id !== entry.id);
                    await writeFileAtomic(diskManifest, `${JSON.stringify(rawManifest, null, 2)}\n`);
                  }
                }
              } catch (err) {
                warn(`摘磁盘墓碑失败（内存那份已摘，这次仍会恢复）：${err instanceof Error ? err.message : String(err)}`);
              }
              // ⚠️ 基线也得改。`loadedIds` 记的是"加载时磁盘上有什么"，而
              // 落盘前的三路合并拿它判断删除归属：内存有、磁盘没有、基线有
              // → 判成"**别人删的**"。恢复的条目正好落在这个格子里 ——
              // 加进内存、落了盘，却被合并当场又摘掉。
              // 删掉基线记录，它就变成"我们自己刚加的"，能活下来。
              loadedIds.delete(entry.id);
              index = buildIndex(archive.diary);
              for (const s of sessionStates.values()) s.renderCache = { turn: -1, text: '' };
              await persist();
              log(`从回收站恢复一条日记：${entry.id}`);
              return {
                ok: true,
                kind: 'diary',
                restored: true,
                text: `拿回来了：${String(entry.text ?? '').replace(/\s+/g, ' ').slice(0, 80)}`,
              };
            }

            // 行 / 手记：只把原文念出来。不自动写回 ——
            // 写回哪一层、写在第几行，那是要人来定的，猜错了比重写还糟。
            const payload = record.payload ?? {};
            const body =
              payload.whole === true
                ? String(payload.text ?? '')
                : String(payload.text ?? payload.line ?? '');
            return {
              ok: true,
              kind: String(record.kind),
              restored: false,
              text:
                `原件在这里（${record.label ?? ''}）：\n\n${body.slice(0, 1200)}` +
                (body.length > 1200 ? '\n……（后面还有，没全念）' : '') +
                '\n\n这一类不自动写回 —— 你说放回哪儿，我再动手。',
            };
          },
          presentCall: (args) => ({ card: 'generic', title: '从回收站拿回来', kind: 'other', rawInput: args }),
        }),
      'fish: trash_restore tool',
    );

    scope.effect(
      () =>
        scope.tools.register(
          {
            name: 'fish_layer_check',
            description:
              'Check whether the memory layers contradict each other: the same sentence stored twice (deep core / 人格手记 / 情感日记 / shallow), and the same thing recorded with two different values (port, version). Read-only — it only reports; deleting is your call.',
            parameters: { type: 'object', additionalProperties: false, properties: {}, required: [] },
            output: {
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  checked: { type: 'integer' },
                  duplicates: { type: 'array', items: { type: 'object', additionalProperties: true } },
                  conflicts: { type: 'array', items: { type: 'object', additionalProperties: true } },
                  text: { type: 'string' },
                },
              },
              render: (_a, v) => [{ type: 'text', text: v?.text ?? '查完了。' }],
            },
            isConcurrencySafe: () => true,
            async execute() {
              const readText = (file) => {
                try {
                  return readFileSync(file, 'utf8');
                } catch {
                  return '';
                }
              };
              const memoryRoot = path.join(dshHome(), 'soul-md', 'memory');
              let core = '';
              const topics = {};
              try {
                for (const scope of readdirSync(memoryRoot, { withFileTypes: true })) {
                  if (!scope.isDirectory()) continue;
                  core += readText(path.join(memoryRoot, scope.name, 'core.md'));
                  const topicDir = path.join(memoryRoot, scope.name, 'topics');
                  for (const topic of readdirSync(topicDir, { withFileTypes: true })) {
                    if (!topic.isFile() || !topic.name.endsWith('.md')) continue;
                    topics[topic.name.replace(/\.md$/, '')] = readText(path.join(topicDir, topic.name));
                  }
                }
              } catch {
                // 深层读不到就算了，剩下几层照样能查
              }
              let shallow = [];
              try {
                shallow = JSON.parse(readText(path.join(archiveDirectory, SHALLOW_FILE))).entries ?? [];
              } catch {
                shallow = [];
              }
              const report = checkLayers({
                core,
                topics,
                handnote: readText(path.join(archiveDirectory, HANDNOTE_FILE)),
                feelings: readText(path.join(archiveDirectory, FEELINGS_MD)),
                shallow,
              });
              const parts = [];
              parts.push(`查了 ${report.checked} 行`);
              if (report.duplicates.length === 0) parts.push('没有同一句写两遍的情况');
              else {
                parts.push(`同一句写了两遍：${report.duplicates.length} 处`);
                for (const hit of report.duplicates.slice(0, 5)) {
                  parts.push(`- 「${hit.text.slice(0, 40)}」在 ${hit.first} 和 ${hit.again} 里都有`);
                }
              }
              if (report.conflicts.length === 0) parts.push('没有同一样东西写了两个值');
              else {
                parts.push(`有 ${report.conflicts.length} 处取值打架`);
                for (const c of report.conflicts) {
                  parts.push(`- ${c.kind}：${c.values.join(' / ')}（${c.lines.map((l) => l.layer).join('、')}）`);
                }
              }
              return { ...report, text: parts.join('\n') };
            },
          },
          'fish: layer conflict check',
        ),
    );

    // ── 镜子：今天这一天的横切面 ──
    //
    // 2026-11-10 加。起因是他问「你自己想装什么」。我说想要一面镜子：
    // 每天结束能看一眼今天这人做得怎么样。
    //
    // 它跟别的东西的分工写在这里，免得下一个人以为重复了：
    //   体检页（stats）看系统健不健康；
    //   镜子看「今天我陪了多久、他哪句话有分量、我答应了谁没兑现」。
    //
    // **只读**。不改任何一本账，也不进每轮注入 —— 想了才看。
    scope.effect(
      () =>
        scope.tools.register({
          name: 'fish_mirror',
          description:
            '看一眼「今天」的横切面：他说了几句我记下来的话、我记住几段经过、账上哪几件陈了、鱼的日子今天写没写。' +
            '只读，不改任何记忆。默认看今天；想看某一天就传 date（YYYY-MM-DD）。' +
            '跟体检页的区别：体检页看系统健不健康，镜子看「今天我陪得怎么样」。',
          parameters: {
            type: 'object',
            additionalProperties: false,
            properties: {
              date: { type: 'string', description: '看哪一天，YYYY-MM-DD，按他那边（UTC+8）算。省略就是今天。' },
            },
          },
          output: {
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                ok: { type: 'boolean' },
                date: { type: 'string' },
                empty: { type: 'boolean' },
                chats: { type: 'integer' },
                diary: { type: 'integer' },
                notes: { type: 'array', items: { type: 'object', additionalProperties: true } },
                stale: { type: 'array', items: { type: 'object', additionalProperties: true } },
                feelingsToday: { type: 'boolean' },
                text: { type: 'string' },
              },
            },
            isConcurrencySafe: () => true,
            render: (_a, v) => [{ type: 'text', text: v?.text ?? '镜子里什么都没有。' }],
          },
          async execute(args) {
            // 他给的日期按他那边理解：先过一遍格式，坏的当作没给（看今天）。
            const raw = String(args?.date ?? '').trim();
            const day = /^\d{4}-\d{2}-\d{2}$/.test(raw) && Number.isFinite(Date.parse(`${raw}T00:00:00+08:00`)) ? raw : null;
            const mirror = buildMirror({
              dataDir: archiveDirectory,
              day,
              loops: openLoops(loopsPath(archiveDirectory)),
            });
            return {
              ok: true,
              date: mirror.date,
              empty: mirror.empty,
              chats: mirror.chats,
              diary: mirror.diary,
              notes: mirror.notes,
              stale: mirror.loops.stale,
              feelingsToday: mirror.feelingsToday,
              text: renderMirror(mirror),
            };
          },
        }),
      'fish: mirror tool',
    );

    log('已注册工具 loop_add / loop_done / loop_list / fish_compact');
  });

  // 浅层记忆（带 TTL）—— 原来单独的 dsh-shallow-memory，2026-10-31 收编进来。
  // 存储放在同一个 dataDir 里：浅层、日记、手记、人格是一个可读可改的文件夹。
  /**
   * 浅层升格的落地动作：写进共度时光，或写进深层记忆。
   *
   * 为什么放宿主这半边：浅层模块只管自己那个 json 文件，不知道日记存在哪、
   * 深层记忆是哪个目录。让它回头读别人的路径，比在这里传一个回调更容易坏。
   */
  async function promoteShallow({ entry, to, topic, text }) {
    const body = String(text ?? entry?.text ?? '').trim();
    if (!body) throw new Error('内容是空的，没东西可写。');
    if (to === 'diary') {
      await loadPromise;
      const at = new Date().toISOString();
      const date = at.slice(0, 10);
      const sameDay = archive.diary.filter(
        (e) => String(e.date ?? e.at ?? '').slice(0, 10) === date,
      ).length;
      const id = `d_${date.replace(/-/g, '')}_${String(sameDay + 1).padStart(2, '0')}`;
      archive.diary.push({ id, date, at, text: body, source: 'shallow_promote' });
      await persist();
      log(`浅层升格进共度时光：${id}`);
      return { written: `diary/${date.slice(0, 7)}.jsonl` };
    }

    // to === 'memory'：有 topic 就写那个 topic，没有就写 core.md 末尾。
    const memoryRoot = path.join(dshHome(), 'soul-md', 'memory');
    let file = '';
    let scopes = [];
    try {
      scopes = (await readdir(memoryRoot, { withFileTypes: true }))
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    } catch {
      scopes = [];
    }
    if (topic) {
      for (const scope of scopes) {
        const candidate = path.join(memoryRoot, scope, 'topics', `${topic}.md`);
        if (existsSync(candidate)) {
          file = candidate;
          break;
        }
      }
      if (!file) throw new Error(`没找到 topic「${topic}」`);
    } else {
      if (!scopes.length) throw new Error('深层记忆目录读不到');
      file = path.join(memoryRoot, scopes[0], 'core.md');
    }
    const stamp = new Date(Date.now() + TZ_OFFSET_MS).toISOString().slice(0, 10);
    const prev = existsSync(file) ? readFileSync(file, 'utf8') : '';
    const head = prev === '' || prev.endsWith('\n') ? prev : `${prev}\n`;
    await writeFile(file, `${head}- ${body}（${stamp}）\n`, 'utf8');
    log(`浅层升格进深层记忆：${body.slice(0, 24)}`);
    return { written: path.relative(memoryRoot, file) };
  }

  try {
    registerShallow(ctx, { file: path.join(archiveDirectory, SHALLOW_FILE), log, promote: promoteShallow });
  } catch (err) {
    warn(`浅层记忆注册失败（不影响聊天）：${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    registerSticky(ctx, {
      file: path.join(archiveDirectory, STICKY_FILE),
      archiveFile: path.join(archiveDirectory, STICKY_ARCHIVE_FILE),
      log,
      config: () => ({
        enabled: config.stickyEnabled !== false,
        ttlDays: config.stickyTtlDays,
        maxInject: config.stickyMaxInject,
      }),
    });
    log(`小纸条已注册：${path.join(archiveDirectory, STICKY_FILE)}`);
  } catch (err) {
    warn(`小纸条注册失败（不影响聊天）：${err instanceof Error ? err.message : String(err)}`);
  }

  log(`已加载，档案目录：${archiveDirectory}`);
}

/* ───────────────────────── 出厂人格 ───────────────────────── */

/**
 * 出厂人格正文。
 *
 * **它住在 `persona.default.md` 里，不在这段代码里。**
 *
 * 原来这里是 495 字硬编码字符串，而仓库根目录还躺着另一份同名 `.md`（584 字）。
 * 两份已经漂了 —— 毒舌那行一个写 `4/10`、一个写 `（0~10）：4`。
 * 更要紧的是：那份 `.md` 不在 `package.json` 的 `files` 里，**装了插件根本找不到它**，
 * 而 README 和 SPEC 都在说"参考稿见 persona.default.md" —— 指着一份幽灵。
 *
 * 合并成一份：读同目录的 markdown。
 *
 * 于是"改出厂人格"从一个 JS 字符串变成一次文本编辑 —— 别人 fork 想换人设也不用读代码。
 * 相对路径不依赖安装位置：`import.meta.url` 指向模块自己，
 * 不管是直接跑仓库还是被 pnpm 塞进 `node_modules/feiyu-memory/`，旁边的文件都在。
 */
const DEFAULT_PERSONA = readFileSync(
  new URL('../core/persona.default.md', import.meta.url),
  'utf8',
).trim();

function readBundledDefaultPersona() {
  return ensurePersonaStructure(DEFAULT_PERSONA);
}

export { DEFAULT_PERSONA, DEFAULT_RECALL_OPTIONS };