/**
 * dsh-soul-md — soul.md-style persona + long-term memory for DeepSeek Harness.
 *
 * PLUGIN-MANAGED (v0.5.0): the user never touches file paths. Persona cards
 * live in the `soul-md` settings namespace as `cards: { name -> markdown }`
 * plus an `active` default and a per-session `sessions` map; the settings
 * page offers a simple name + content form. Memory files are managed by the
 * plugin under `$DSH_HOME/soul-md/memory/` (`global.md` plus one file per
 * card) and are created on demand.
 *
 * Resolution per prompt assembly:
 *   persona: session choice (chat switcher) > workspace mapping > active default card > none
 *   memory:  card memory (<card>.md) > global memory (global.md)
 *
 * Workspace personas: the settings page assigns a card per workspace
 * (host-published `workspaceList` from the durable workspace registry); the
 * mapping is keyed by workspace path and resolved from the session's cwd.
 *
 * The `soul:persona` / `soul:memory` sections use FUNCTION text, which
 * dsh-system-prompt evaluates on every assembly with the agent context —
 * switching applies from the next turn, no restart, no watchers.
 *
 * GROWTH TOOLS: `soul_read` / `soul_update` read/rewrite the card ACTIVE for
 * the calling agent; `memory_append` / `memory_read` / `memory_rewrite`
 * operate on the agent's memory scope. The descriptions encourage the agent
 * to record what it learns and to fold stable traits into its persona.
 *
 * Legacy fields (`path`, `personas`, `roster`, `memory.path`, …) are kept in
 * the schema as no-ops so old composition entries and settings keep
 * validating; on first run the plugin imports the old `path` card and the
 * old memory file into the managed store.
 */
import { mkdirSync, readdirSync, readFileSync, statSync, watch, writeFileSync } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, dirname } from "node:path";
import z from "@deepseek-ai/schemastery";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { createMemoryLayout, normalizeMemoryTopic, retainMemoryEnds } from "./memory-layout.js";
import { diffLines } from "./card-diff.mjs";
import { countRetired, retireMatch, splitRetired } from "../core/retire.mjs";
import { countMerged, mergeSection, renderSuggestion, stripMerged } from "../core/abstract.mjs";
import { planCardSnapshots } from "./card-watch.mjs";
import { applyRestore, backupFileName, collectBackup, parseBackup, planRestore, registerBackupBuilder, registerRestoreHandler, summarizeBackup, writeBackupFile } from "../core/backup.mjs";
import { readDiaryEntries } from "../core/stats.mjs";
import { SHALLOW_FILE } from "../core/shallow.mjs";
import { skipsSubagentSections } from "./subagents.js";
import { boundedInteger, renderRecall, searchTopics } from "./memory-recall.js";

/** Cordis plugin name. */
const name = "soul-md";
/** Services this plugin needs injected from the host tree. */
const inject = ["systemPrompt", "tools"];
/** Settings namespace owned by this plugin (Web UI settings section). */
const NS = "soul-md";

/** Section names; deliberately distinct from the registry-owned `deployment:persona`. */
const SECTION_PERSONA = "soul:persona";
const SECTION_MEMORY = "soul:memory";
/** Back-compat export name for the persona section. */
const SECTION_NAME = SECTION_PERSONA;

/** Session-choice value that disables the persona for that session. */
const CHOICE_NONE = "none";
/** Managed memory directory under the dsh home. */
const MEMORY_DIR = join("soul-md", "memory");

/** Runtime schema for the soul-md row. */
const Config = z.object({
  // ── v0.5: plugin-managed persona cards ───────────────────────────────────
  /** Persona cards: card name -> markdown content. */
  cards: z.dict(z.string(), z.string()).default({}),
  /** Default card name (used when the session has no explicit choice). */
  active: z.string().default(""),
  /** Per-session choice: sessionId -> card name, "none", or "" (follow default). */
  sessions: z.dict(z.string(), z.string()).default({}),
  /** Per-workspace choice: workspace path -> card name, "none", or "" (follow default). */
  workspaces: z.dict(z.string(), z.string()).default({}),
  /** Read-only workspace list (path + title), maintained by the host for the UI. */
  workspaceList: z.array(z.object({
    path: z.string(),
    title: z.string(),
  })).default([]),
  // ── long-term memory (plugin-managed files, no user-visible paths) ───────
  memory: z.object({
    /** `memory_append` / `memory_rewrite` refuse to grow a file beyond this size (bytes). */
    maxBytes: z.number().default(1024 * 1024),
    /** Also render the memory file as a `soul:memory` system-prompt section. */
    inject: z.boolean().default(true),
    /** Opt-in progressive disclosure: core.md is injected; topics/*.md become an index. */
    layered: z.boolean().default(false),
    /** Cap for the injected memory section (chars, from the file head). */
    injectMaxChars: z.number().default(8000),
    /** Optional keyword recall; defaults keep the existing stable prefix. */
    recall: z.union([z.const("off"), z.const("keyword")]).default("off"),
    /** Hide the full injected index only while keyword recall is on. */
    indexMode: z.union([z.const("all"), z.const("recall")]).default("all"),
    recallMaxTopics: z.number().default(5),
    recallMaxChars: z.number().default(1600),
    /** Restore descriptors for topics consulted this session after compaction. */
    compactionRecall: z.boolean().default(false),
    /** Prompt section order for the injected memory section. */
    order: z.number().default(0.5),
    // ── legacy (kept for schema compatibility; ignored) ──────────────────
    path: z.string().default(""),
    workspaceFile: z.string().default(""),
  }),
  // ── legacy fields (kept so old composition entries/settings validate) ────
  /** Legacy global card file (v0.2–v0.4); imported into `cards` once on first run. */
  path: z.string().default(""),
  fallback: z.string().default(""),
  order: z.number().default(0),
  complete: z.boolean().default(false),
  /** Opt back into host prompt-variable interpolation for persona and memory text. */
  allowTemplates: z.boolean().default(false),
  watch: z.boolean().default(true),
  /** Skip persona + memory injection in delegated child sessions (opt-in; default keeps v0.7 behavior). */
  skipSubagents: z.boolean().default(false),
  soulMaxBytes: z.number().default(64 * 1024),
  personas: z.object({
    dir: z.string().default(""),
    workspaceFile: z.string().default(".dsh-persona.md"),
  }),
  roster: z.array(z.object({
    key: z.string(),
    label: z.string(),
    kind: z.string(),
  })).default([]),
}).volatile();

function apply(ctx, config) {
  let sourceGetter = null;
  /** mtime-keyed text cache for memory files; steady sections stay byte-identical. */
  const fileCache = new Map();
  /** Workspace canonical-path index (lowercased cwd -> canonical path from the registry). */
  let wsPathIndex = new Map();
  /** Workspace-list publish state (declared early: onChange below references it). */
  let lastWsJson = "";
  let wsTimer = undefined;
  let wsWatcher = undefined;

  const cfg = () => (sourceGetter ? sourceGetter() : typeof config.get === "function" ? config.get() : config);

  /** Synchronous mtime-cached read; null when missing/unreadable. */
  const readCached = (file) => {
    try {
      const st = statSync(file);
      const hit = fileCache.get(file);
      if (hit && hit.mtimeMs === st.mtimeMs) return hit.text;
      const text = readFileSync(file, "utf8");
      fileCache.set(file, { mtimeMs: st.mtimeMs, text });
      return text;
    } catch {
      return null;
    }
  };

  const sessionIdOf = (agent) => {
    try {
      const id = agent?.session?.id;
      return typeof id === "string" && id.length > 0 ? id : null;
    } catch {
      return null;
    }
  };

  const workspaceDirOf = (agent) => {
    try {
      const cwd = agent?.session?.header?.cwd;
      return typeof cwd === "string" && cwd.length > 0 ? cwd : null;
    } catch {
      return null;
    }
  };

  /** The persona card ACTIVE for one agent: session choice > workspace mapping > default card > none. */
  const cardNameOf = (agent) => {
    const c = cfg();
    const sid = sessionIdOf(agent);
    if (sid) {
      const choice = c.sessions?.[sid];
      if (choice === CHOICE_NONE) return null;
      if (typeof choice === "string" && choice && c.cards?.[choice] !== void 0) return choice;
    }
    const cwd = workspaceDirOf(agent);
    if (cwd) {
      const key = wsPathIndex.get(String(cwd).toLowerCase()) ?? cwd;
      const choice = c.workspaces?.[key];
      if (choice === CHOICE_NONE) return null;
      if (typeof choice === "string" && choice && c.cards?.[choice] !== void 0) return choice;
    }
    return c.active && c.cards?.[c.active] !== void 0 ? c.active : null;
  };

  const resolveCard = (agent) => {
    const cardName = cardNameOf(agent);
    if (!cardName) return { name: null, text: null };
    return { name: cardName, text: cfg().cards[cardName] ?? null };
  };

  /** Managed memory directory (created on demand). */
  const memoryDir = () => join(resolveDshHome(), MEMORY_DIR);

  const memoryLayout = createMemoryLayout(memoryDir, readCached);

  const memoryScopes = (agent) => {
    const cardName = cardNameOf(agent);
    return cardName ? [cardName, "global"] : ["global"];
  };

  /** The memory scope ACTIVE for one agent (write target): card memory > global. */
  const memoryTarget = (agent, topic = "") => {
    const cardName = cardNameOf(agent);
    const scope = cardName ?? "global";
    return {
      ...memoryLayout.writeTarget(scope, { layered: Boolean(cfg().memory?.layered), topic }),
      scope,
    };
  };

  /** First EXISTING memory along the chain (read/inject path). */
  const memoryReadChain = (agent, topic = "") => memoryLayout.readChain(memoryScopes(agent), {
    layered: Boolean(cfg().memory?.layered),
    topic,
  });

  // Session objects own state: closed sessions are not retained or persisted.
  const recallStates = new WeakMap();
  const stateOf = (agent, create = false) => {
    const session = agent?.session;
    if (!session || typeof session !== "object") return null;
    let state = recallStates.get(session);
    if (!state && create) {
      state = { count: 0, query: "", seen: new Set(), consulted: new Map(), pending: false, recovery: [], turn: null };
      recallStates.set(session, state);
    }
    return state;
  };
  const rememberTopic = (agent, source, topic) => {
    if (!topic || !cfg().memory?.compactionRecall) return;
    const state = stateOf(agent, true);
    if (!state) return;
    const key = `${source}\0${topic}`;
    state.consulted.delete(key);
    state.consulted.set(key, { source, key: topic });
    if (state.consulted.size > 128) state.consulted.delete(state.consulted.keys().next().value);
  };
  const searchableTopics = (agent) => {
    const seen = new Set();
    return memoryScopes(agent).flatMap((source) => memoryLayout.listTopics(source).flatMap((topic) => {
      if (seen.has(topic.key) || !normalizeMemoryTopic(topic.key)) return [];
      seen.add(topic.key);
      return [{ ...topic, source }];
    }));
  };
  // DSH assembles the prompt BEFORE agent/pre-step. Inbox claim is the
  // synchronous hook before that assembly, so recall belongs to this message,
  // not to the following step or turn.
  ctx.on("agent/inbox/claimed", ({ agent, message, turn }) => {
    const c = cfg();
    if (message.source?.kind !== "user" || !c.memory?.layered
      || (c.memory.recall !== "keyword" && !c.memory.compactionRecall)
      || skipsSubagentSections(c, agent)) return;
    const state = stateOf(agent, true);
    if (!state || state.seen.has(message.id)) return;
    state.seen.add(message.id);
    if (state.seen.size > 128) state.seen.delete(state.seen.values().next().value);
    state.count += 1;
    state.query = message.content.filter((block) => block.type === "text")
      .map((block) => block.text).join("\n").slice(0, 2000);
    if (c.memory.compactionRecall && state.pending) state.recovery = [...state.consulted.values()];
    else if (state.turn !== turn) state.recovery = [];
    state.turn = turn;
    state.pending = false;
  });
  // compaction/* are durable session events in DSH 0.2, not independent
  // Cordis notifications. Failed compaction must not trigger recovery.
  ctx.on("session/event", (session, event) => {
    if (!cfg().memory?.compactionRecall) return;
    const state = recallStates.get(session);
    if (state && (event.type === "compaction/prune"
      || (event.type === "compaction/end" && event.data.error === undefined))) state.pending = true;
  });
  ctx.on("session/disposed", (session) => recallStates.delete(session));

  /** Render the persona section for one assembly. */
  const renderPersona = (assembly) => {
    const c = cfg();
    if (skipsSubagentSections(c, assembly?.agent)) return "";
    return resolveCard(assembly?.agent).text ?? "";
  };

  /** Render the memory section for one assembly. */
  const renderMemory = (assembly) => {
    const c = cfg();
    if (!c.memory?.inject) return "";
    if (skipsSubagentSections(c, assembly?.agent)) return "";
    const { text: rawText, index: fullIndex } = memoryReadChain(assembly?.agent);
    // 2026-11-11：**作废的行不进注入。**
    //
    // 深层记忆原来只往上加，于是「我当时的判断」和「后来推翻它的判断」
    // 并排站着、一样粗一样黑。我读到的时候只能靠日期猜哪个算数，
    // 猜错就是拿一个已经不成立的说法跟他讲道理，而我自己不知道。
    // 退场的那些仍然留在文件里（memory_read 还看得见），只是不再摆到眼前。
    // 1.24.0：**归并过的行也不进注入。**
    //
    // 作废是「这句不算数了」，归并是「这十几句已经压成上面那一句规律」。
    // 两者都不删原文 —— 注入里只该剩规律，原文留在文件里等我回去看。
    const text = rawText ? stripMerged(splitRetired(rawText).live) : rawText;
    const index = c.memory.layered && c.memory.recall === "keyword" && c.memory.indexMode === "recall"
      ? "Use memory_search(query) to find topic keys and summaries; memory_read(topic) retrieves full text."
      : fullIndex;
    const rendered = [text, index].filter(Boolean).join("\n\n");
    if (!rendered) return "";
    const cap = Math.max(0, Math.floor(c.memory.injectMaxChars ?? 8000));
    if (rendered.length <= cap) return rendered;
    if (!index) {
      return retainMemoryEnds(rendered, cap) + "\n\n> 部分记忆未注入（已保留首尾），请用 memory_read 读取全文 / part of memory omitted (beginning and end retained); use memory_read for the full text.";
    }
    if (index.length > cap) {
      return index.slice(0, cap) + "\n\n> 主题索引未完整注入，core 未注入；请用 memory_read 读取全文 / topic index incomplete; core omitted; use memory_read.";
    }
    // Reserve the complete topic index before allocating the remaining space
    // to core. Keep both ends of core so recent appends remain visible.
    const coreCap = Math.max(0, cap - index.length - (text ? 2 : 0));
    const core = retainMemoryEnds(text, coreCap);
    return [core, index].filter(Boolean).join("\n\n")
      + "\n\n> core 部分内容未注入，请用 memory_read 读取全文 / part of core omitted; use memory_read for the full text.";
  };

  const renderMemoryRecall = (assembly) => {
    const c = cfg();
    if (!c.memory?.inject || !c.memory.layered || skipsSubagentSections(c, assembly?.agent)) return "";
    const state = stateOf(assembly?.agent);
    if (!state) return "";
    const topics = searchableTopics(assembly.agent);
    const limit = boundedInteger(c.memory.recallMaxTopics, 5, 20);
    const recovered = c.memory.compactionRecall && limit ? state.recovery.flatMap((entry) => {
      const topic = topics.find((topic) => topic.key === entry.key && topic.source === entry.source);
      return topic ? [topic] : [];
    }).slice(-limit) : [];
    const recoveredKeys = new Set(recovered.map((topic) => topic.key));
    const recalled = c.memory.recall === "keyword" && state.count >= 2
      ? searchTopics(topics, state.query, readCached, limit).filter((topic) => !recoveredKeys.has(topic.key)) : [];
    const remaining = Math.max(0, boundedInteger(c.memory.injectMaxChars, 8000, Number.MAX_SAFE_INTEGER)
      - renderMemory(assembly).length - 2);
    return renderRecall([
      { heading: "压缩后曾查阅的主题 / Topics consulted before compaction (use memory_read):", topics: recovered },
      { heading: "可能相关的记忆，仅供参考 / Possibly relevant memory; verify with memory_read:", topics: recalled },
    ], Math.min(remaining, boundedInteger(c.memory.recallMaxChars, 1600, 8000)));
  };

  // ── prompt sections (function text: resolved per assembly, hot by nature) ──
  const sectionDisposers = { persona: null, memory: null, recall: null };
  function registerSections() {
    if (sectionDisposers.recall) {
      sectionDisposers.recall();
      sectionDisposers.recall = null;
    }
    if (sectionDisposers.persona) {
      sectionDisposers.persona();
      sectionDisposers.persona = null;
    }
    if (sectionDisposers.memory) {
      sectionDisposers.memory();
      sectionDisposers.memory = null;
    }
    sectionDisposers.persona = ctx.systemPrompt.section({
      name: SECTION_PERSONA,
      order: cfg().order ?? 0,
      text: renderPersona,
      interpolate: cfg().allowTemplates === true,
      ...(cfg().complete ? { complete: true } : {}),
    });
    sectionDisposers.memory = ctx.systemPrompt.section({
      name: SECTION_MEMORY,
      order: cfg().memory?.order ?? 0.5,
      text: renderMemory,
      interpolate: cfg().allowTemplates === true,
    });
    if (cfg().memory?.recall === "keyword" || cfg().memory?.compactionRecall) {
      sectionDisposers.recall = ctx.systemPrompt.section({
        name: "soul:recall",
        order: (cfg().memory?.order ?? 0.5) + 0.01,
        text: renderMemoryRecall,
        interpolate: false,
      });
    }
  }

  ctx.effect(() => {
    registerSections();
    return () => {
      if (sectionDisposers.recall) {
        sectionDisposers.recall();
        sectionDisposers.recall = null;
      }
      if (sectionDisposers.persona) {
        sectionDisposers.persona();
        sectionDisposers.persona = null;
      }
      if (sectionDisposers.memory) {
        sectionDisposers.memory();
        sectionDisposers.memory = null;
      }
    };
  }, "soul-md.sections()");

  // ── 人设卡的「外面改」也要留旧版 ─────────────────────────────────────────
  //
  // `soul_update` 覆盖前会 `saveCardSnapshot`（见下面的工具），但设置页改卡
  // 是直接写 settings 文档，根本不经过那个工具 —— 那条路上的旧文本以前一律
  // 丢。2026-11-09 补：在这里盯 settings 文档的变化，发现哪张卡的正文变了、
  // 而且手里还握着它的上一版，就先把上一版存一份。
  //
  // 幂等靠 `lastSeenCards`：`soul_update` 落盘前会先把新文本写进这张表，
  // 等下面的 watcher 被触发时看到「新旧一样」，就不会重复存。
  let lastSeenCards = null;
  let cardWatchReady = false;

  function noteCards(cards) {
    lastSeenCards = { ...(cards ?? {}) };
    cardWatchReady = true;
  }

  function snapshotCardsChangedOutside(cards) {
    const next = cards ?? {};
    if (!cardWatchReady) {
      // 第一次见到：只记基线，不存快照（否则一启动就给每张卡存一份假的旧版）。
      noteCards(next);
      return;
    }
    for (const { name: cardName, text } of planCardSnapshots(lastSeenCards, next)) {
      saveCardSnapshot(cardName, text);
    }
    noteCards(next);
  }

  // ── settings-backed configuration ─────────────────────────────────────────
  // DSH 0.1.7 exposes Config directly as live profile fields.
  const onSettingsChange = () => {
    try {
      registerSections();
    } catch (error) {
      // 启动瞬间 settings 可能先于 fiber 就绪触发一次；老 fiber 已失效时
      // 再注册 section 会抛 "cannot create effect on inactive context"，
      // 跳过即可 —— 活着的 fiber 会自己再来一遍。
      if (!/inactive/i.test(String(error?.message ?? error))) throw error;
      return;
    }
    void maybeMigrate();
    void publishWorkspaces();
    startWorkspaceWatch();
    // 设置页改的卡也要留旧版（见上面 snapshotCardsChangedOutside 的注释）。
    // 整段 try：留旧版是后悔药，坏了也不能连累主流程。
    try {
      snapshotCardsChangedOutside(cfg().cards);
    } catch (error) {
      ctx.logger?.warn?.(`[soul-md] 人设卡旧版快照失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };
  ctx.on("settings/document-updated", (id) => {
    if (id === NS) onSettingsChange();
  });
  queueMicrotask(onSettingsChange);

  // ── one-time migration from the legacy file-based layout ──────────────────
  // When no cards exist yet and the legacy `path` card file is readable,
  // import it as the "默认" card (and set it active); migrate the legacy
  // memory file into the managed store as well. Runs from onChange: the
  // settings inject callback fires it once the settings service is live (a
  // boot-time ctx.effect can run before that and silently see no settings).
  let migrated = false;
  const legacyFileOf = () => {
    // The legacy path may live in the settings layer or in the composition
    // entry config (`config.path`); the settings layer is authoritative.
    const p = cfg().path || config.path;
    if (!p) return null;
    return isAbsolute(p) ? p : join(resolveDshHome(), p);
  };
  const legacyMemoryFileOf = () => {
    const legacy = legacyFileOf();
    if (!legacy) return null;
    // Legacy default: memory.md next to the soul card (v0.2–v0.4 behavior).
    const p = cfg().memory?.path || config.memory?.path || "memory.md";
    if (!p) return null;
    return isAbsolute(p) ? p : join(dirname(legacy), p);
  };
  const maybeMigrate = async () => {
    try {
      if (migrated) return;
      const settings = ctx.get("settings");
      if (!settings) return; // not ready yet — retried on the next onChange
      migrated = true;
      const c = cfg();
      // The new host imports settings.yaml after plugins mount. If that file
      // already owns cards, let its one-time import win over the older soul.md
      // fallback; otherwise the fallback creates an unwanted second card.
      const oldSettings = readCached(join(resolveDshHome(), "settings.yaml"))
        ?? readCached(join(resolveDshHome(), "settings.yaml.imported"));
      const settingsOwnCards = oldSettings != null
        && /^soul-md:\s*$/m.test(oldSettings)
        && /^\s+cards:\s*$/m.test(oldSettings);
      if ((!c.cards || Object.keys(c.cards).length === 0) && !settingsOwnCards) {
        const legacy = legacyFileOf();
        if (legacy) {
          const text = await readFile(legacy, "utf8");
          const next = { ...c, cards: { 默认: text }, active: "默认" };
          await settings.update(NS, next);
          ctx.logger.info("[soul-md] imported legacy persona card as 默认");
        }
      }
      const managedGlobal = memoryLayout.legacyFile("global");
      if (readCached(managedGlobal) === null) {
        const legacyMem = legacyMemoryFileOf();
        if (legacyMem) {
          try {
            const text = await readFile(legacyMem, "utf8");
            if (text.length > 0) {
              await mkdir(memoryDir(), { recursive: true });
              await writeFile(managedGlobal, text, "utf8");
              ctx.logger.info("[soul-md] imported legacy memory file into the managed store");
            }
          } catch {
            /* legacy memory missing — nothing to import */
          }
        }
      }
    } catch (error) {
      ctx.logger.warn(`[soul-md] legacy migration skipped: ${String(error)}`);
    }
  };

  // ── workspace list (host-maintained, for the per-workspace persona UI) ─────
  // Read from the durable workspace registry; refreshed on settings changes
  // and when the sessions directory gains a workspace. The registry's async
  // init (history bootstrap) may not be done when this plugin applies, so a
  // not-ready registry yields null and publishWorkspaces retries until it is.
  const computeWorkspaceList = () => {
    try {
      const registry = ctx.get("workspaceRegistry");
      if (!registry || typeof registry.list !== "function") return null;
      const entities = registry.list();
      if (!Array.isArray(entities)) return null;
      return entities
        .map((entry) => ({
          path: String(entry.path ?? ""),
          title: String(entry.title ?? ""),
        }))
        .filter((entry) => entry.path.length > 0);
    } catch {
      // Registry exists but its async init has not completed yet — retry.
      return null;
    }
  };
  const rebuildWsIndex = (list) => {
    const next = new Map();
    for (const entry of list) next.set(String(entry.path).toLowerCase(), entry.path);
    wsPathIndex = next;
  };
  let wsRetryTimer = undefined;
  let wsRetryCount = 0;
  function scheduleWsRetry() {
    if (wsRetryTimer) return;
    if (wsRetryCount > 300) return; // give up after ~5 minutes of unavailability
    wsRetryTimer = setTimeout(() => {
      wsRetryTimer = undefined;
      wsRetryCount += 1;
      void publishWorkspaces();
    }, 1000);
  }
  async function publishWorkspaces() {
    try {
      const computed = computeWorkspaceList();
      if (computed === null) {
        scheduleWsRetry(); // registry not ready yet
        return;
      }
      const list = computed;
      rebuildWsIndex(list);
      const json = JSON.stringify(list);
      if (json === lastWsJson) return;
      lastWsJson = json;
      const settings = ctx.get("settings");
      if (!settings) {
        scheduleWsRetry();
        return;
      }
      const base = cfg();
      await settings.update(NS, { ...base, workspaceList: list }).catch((error) => {
        ctx.logger.warn(`[soul-md] workspace list write failed: ${String(error)}`);
      });
      wsRetryCount = 0;
    } catch (error) {
      ctx.logger.warn(`[soul-md] workspace list refresh failed: ${String(error)}`);
    }
  }
  function startWorkspaceWatch() {
    if (wsWatcher) {
      try {
        wsWatcher.close();
      } catch {
        /* already closed */
      }
      wsWatcher = undefined;
    }
    try {
      wsWatcher = watch(join(resolveDshHome(), "sessions"), { persistent: false }, () => {
        clearTimeout(wsTimer);
        wsTimer = setTimeout(() => void publishWorkspaces(), 300);
      });
    } catch {
      /* sessions dir missing — the onChange publish covers the initial state */
    }
  }

  ctx.effect(() => {
    void publishWorkspaces();
    startWorkspaceWatch();
    return () => {
      clearTimeout(wsTimer);
      clearTimeout(wsRetryTimer);
      if (wsWatcher) {
        try {
          wsWatcher.close();
        } catch {
          /* already closed */
        }
        wsWatcher = undefined;
      }
    };
  }, "soul-md.workspaces()");

  // ── persona + memory tools (the "growth" loop) ────────────────────────────
  const ensureParent = async (file) => {
    await mkdir(dirname(file), { recursive: true });
  };
  const byteLen = (text) => Buffer.byteLength(text, "utf8");
  const agentOf = (exec) => exec?.agent ?? null;

  ctx.tools.register(defineTool({
    name: "memory_append",
    description:
      "Append a dated Markdown block to your long-term memory. The target follows your CURRENT scope: the memory of the persona card active for this session, else the global memory. In layered mode, omit topic for always-visible core memory or pass a stable topic key for an on-demand topic file. Use it PROACTIVELY whenever you learn something worth keeping across sessions. Prefer small, self-contained entries over one giant dump.",
    parameters: {
      section: { type: "string", required: true, description: "Short heading for the entry, e.g. 用户偏好 / project decision. Use a stable name so related entries group together." },
      content: { type: "string", required: true, description: "The markdown text to remember. Keep it concise and self-contained." },
      topic: { type: "string", description: "Optional topic key in layered mode. Omit or pass core/core.md for core.md; e.g. project-foo writes topics/project-foo.md." },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          bytes: { type: "integer" },
          totalBytes: { type: "integer" },
          scope: { type: "string" },
          topic: { type: "string" },
        },
      },
      render: (_args, value) => [{ type: "text", text: `Appended to memory (${value.bytes} bytes, ${value.totalBytes} total) in scope "${value.scope}"${value.topic ? ` topic "${value.topic}"` : ""}.` }],
    },
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const content = String(args.content ?? "").trim();
      if (!content) throw new Error("memory_append: `content` must be non-empty");
      const section = String(args.section ?? "").trim();
      const topic = normalizeMemoryTopic(args.topic);
      if (topic && !cfg().memory?.layered) {
        throw new Error("memory_append: `topic` requires memory.layered to be enabled");
      }
      const d = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const heading = `## ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}${section ? ` — ${section}` : ""}`;
      const block = `\n${heading}\n\n${content}\n`;
      const target = memoryTarget(agentOf(exec), topic);
      const current = readCached(target.file);
      const inherited = current === null && target.legacySeed ? readCached(target.legacySeed) : null;
      const existing = current ?? inherited ?? "";
      const totalBytes = byteLen(existing + block);
      if (totalBytes > (cfg().memory?.maxBytes ?? 1024 * 1024)) {
        throw new Error(`memory_append: memory file would exceed maxBytes (${cfg().memory.maxBytes}); consolidate with memory_rewrite first`);
      }
      await ensureParent(target.file);
      if (current === null && inherited !== null) await writeFile(target.file, existing + block, "utf8");
      else await appendFile(target.file, block, "utf8");
      fileCache.delete(target.file);
      rememberTopic(agentOf(exec), target.scope, target.topic);
      return { bytes: byteLen(block), totalBytes, scope: target.scope, topic: target.topic };
    },
    presentCall: (args) => ({ card: "generic", title: "Append to memory", kind: "other", rawInput: args }),
  }));

  ctx.tools.register(defineTool({
    name: "memory_read",
    description:
      "Read your long-term memory back. The reader walks your CURRENT scope chain: the active persona card's memory, else global memory. In layered mode, omit topic to read core memory plus the topic index, then pass a topic key to retrieve that topic's full text on demand.",
    parameters: {
      topic: { type: "string", description: "Optional topic key to read in layered mode. Omit or pass core/core.md to read core memory plus the topic index." },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          exists: { type: "boolean" },
          bytes: { type: "integer" },
          truncated: { type: "boolean" },
          source: { type: "string" },
          topic: { type: "string" },
          retired: { type: "integer" },
          merged: { type: "integer" },
          suggest: { type: "string" },
          content: { type: "string" },
        },
      },
      render: (_args, value) => [{
        type: "text",
        text: value.exists
          ? `Memory from "${value.source}"${value.topic ? ` topic "${value.topic}"` : ""} (${value.bytes} bytes${value.truncated ? ", truncated" : ""}):\n${value.content}`
            + (value.retired > 0
              ? `\n\n（里面有 ${value.retired} 条后面挂着 ⟪作废 …⟫ —— 那些已经不算数了，不再进注入。留着是为了让我看得见自己改过口。）`
              : "")
            + (value.merged > 0
              ? `\n（还有 ${value.merged} 条挂着 ⟪归并 …⟫ —— 它们已经被压成某一节顶上那句规律了，不再进注入。）`
              : "")
            + (value.suggest ? `\n${value.suggest}` : "")
          : `Memory is empty or missing (scope: "${value.source}").`,
      }],
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const topic = normalizeMemoryTopic(args.topic);
      if (topic && !cfg().memory?.layered) {
        throw new Error("memory_read: `topic` requires memory.layered to be enabled");
      }
      const { exists, text, index, source, topic: resolvedTopic = "" } = memoryReadChain(agentOf(exec), topic);
      const full = [text, index].filter(Boolean).join("\n\n");
      const retired = countRetired(text ?? "");
      const merged = countMerged(text ?? "");
      const suggest = text ? renderSuggestion(text, { label: resolvedTopic ? "「" + resolvedTopic + "」的" : "" }) : "";
      if (!exists || !full) return { exists: false, bytes: 0, truncated: false, source, topic: resolvedTopic, retired: 0, merged: 0, suggest: "", content: "" };
      rememberTopic(agentOf(exec), source, resolvedTopic);
      const MAX = 20000;
      const truncated = full.length > MAX;
      const excerpt = index && index.length < MAX
        ? [retainMemoryEnds(text, MAX - index.length - (text ? 2 : 0)), index].filter(Boolean).join("\n\n")
        : retainMemoryEnds(full, MAX);
      return {
        exists: true,
        bytes: byteLen(full),
        truncated,
        source,
        topic: resolvedTopic,
        retired,
        merged,
        suggest,
        content: truncated ? `${excerpt}\n…(truncated; beginning and end of core retained when layered; use a topic or file read for complete memory)…` : full,
      };
    },
  }));

  ctx.tools.register(defineTool({
    name: "memory_search",
    description: "Search layered topic keys, titles, summaries AND full bodies using local keywords (including Chinese phrase bigrams). Returns keys and summaries only. This is lexical search, not semantic matching: try alternate wording if no matches. Active persona topics take precedence over global topics with the same key. Use memory_read(topic) to verify matches.",
    parameters: {
      query: { type: "string", required: true, description: "Keywords or a short question to search in topic content." },
      limit: { type: "integer", description: "Maximum results, 1–20 (default 5)." },
    },
    output: {
      schema: {
        type: "object", additionalProperties: false,
        properties: {
          matches: { type: "array", items: {
            type: "object", additionalProperties: false,
            properties: { key: { type: "string" }, title: { type: "string" }, summary: { type: "string" }, source: { type: "string" }, score: { type: "number" } },
          } },
        },
      },
      render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }],
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      if (!cfg().memory?.layered) throw new Error("memory_search requires memory.layered to be enabled");
      const query = String(args.query ?? "").trim();
      if (!query) throw new Error("memory_search: `query` must be non-empty");
      return { matches: searchTopics(searchableTopics(agentOf(exec)), query, readCached,
        boundedInteger(args.limit, 5, 20)) };
    },
  }));

  ctx.tools.register(defineTool({
    name: "memory_rewrite",
    description:
      "REPLACE one memory file in your CURRENT scope. In layered mode, omit topic for always-visible core.md or pass a topic key for topics/<topic>.md. Use for consolidation: merge, deduplicate and reorganize entries. Build the new content from memory_read output unless you deliberately drop entries. Pass an empty string to clear the selected file.",
    parameters: {
      content: { type: "string", required: true, description: "The new full content of the memory file (markdown)." },
      topic: { type: "string", description: "Optional topic key in layered mode. Omit or pass core/core.md to replace core.md." },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          bytes: { type: "integer" },
          scope: { type: "string" },
          topic: { type: "string" },
        },
      },
      render: (_args, value) => [{ type: "text", text: `Memory rewritten (${value.bytes} bytes) in scope "${value.scope}"${value.topic ? ` topic "${value.topic}"` : ""}.` }],
    },
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const content = String(args.content ?? "");
      const topic = normalizeMemoryTopic(args.topic);
      if (topic && !cfg().memory?.layered) {
        throw new Error("memory_rewrite: `topic` requires memory.layered to be enabled");
      }
      const bytes = byteLen(content);
      if (bytes > (cfg().memory?.maxBytes ?? 1024 * 1024)) {
        throw new Error(`memory_rewrite: content exceeds maxBytes (${cfg().memory.maxBytes})`);
      }
      const target = memoryTarget(agentOf(exec), topic);
      await ensureParent(target.file);
      await writeFile(target.file, content, "utf8");
      fileCache.delete(target.file);
      rememberTopic(agentOf(exec), target.scope, target.topic);
      return { bytes, scope: target.scope, topic: target.topic };
    },
  }));

  ctx.tools.register(defineTool({
    name: "memory_retire",
    description:
      "Mark one line of deep memory as NO LONGER TRUE, without deleting it. Use this when you have changed your mind about something you once wrote: instead of appending a contradicting line next to the old one (which leaves two equally loud claims), retire the old line — it disappears from the injected memory but stays readable here. Give a short phrase from that line as `match`; give `by` to say what replaced it. Retiring is not the same as being wrong: it only says this claim does not count any more.",
    parameters: {
      match: { type: "string", required: true, description: "A short phrase from the line to retire. It must appear in exactly the line(s) you mean — read the file first." },
      by: { type: "string", description: "Optional: what replaced it, in one short clause. This is what makes the retirement readable later." },
      topic: { type: "string", description: "Optional topic key in layered mode. Omit or pass core/core.md for core.md." },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          hit: { type: "integer" },
          scope: { type: "string" },
          topic: { type: "string" },
          text: { type: "string" },
        },
      },
      render: (_args, value) => [{ type: "text", text: value.text }],
    },
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const match = String(args.match ?? "").trim();
      if (!match) throw new Error("memory_retire: `match` must be non-empty");
      const topic = normalizeMemoryTopic(args.topic);
      if (topic && !cfg().memory?.layered) {
        throw new Error("memory_retire: `topic` requires memory.layered to be enabled");
      }
      const target = memoryTarget(agentOf(exec), topic);
      let before = "";
      try {
        before = await readFile(target.file, "utf8");
      } catch {
        return { hit: 0, scope: target.scope, topic: target.topic, text: "那个文件还不存在，没东西可以作废。" };
      }
      const { text, hit, lines } = retireMatch(before, { match, by: args.by });
      if (hit === 0) {
        const already = countRetired(before);
        return {
          hit: 0,
          scope: target.scope,
          topic: target.topic,
          text: already > 0
            ? `没找到「${match}」。这个文件里已经有 ${already} 条作废的了 —— 要么这段话抄错了，要么它已经退场了。`
            : `没找到「${match}」。先把文件读一遍，抄一段里面真有的字。`,
        };
      }
      await writeFile(target.file, text, "utf8");
      fileCache.delete(target.file);
      rememberTopic(agentOf(exec), target.scope, target.topic);
      const list = lines.map((l) => l.replace(/^\s*[-*]\s*/, "")).join("\n");
      return {
        hit,
        scope: target.scope,
        topic: target.topic,
        text: `作废了 ${hit} 行（scope "${target.scope}"${target.topic ? ` topic "${target.topic}"` : ""}）。`
          + " 它不再进注入，但原文还在，memory_read 看得见。\n" + list,
      };
    },
  }));

  ctx.tools.register(defineTool({
    name: "memory_abstract",
    description:
      "Fold a whole section of deep memory into ONE rule sentence you write, without deleting anything. " +
      "Use it when a section has been growing for weeks (memory_read tells you which ones: 「攒了 N 条还没归过」): " +
      "give `section` (a phrase from its `## ` heading), and `rule` — the one sentence you would say if you had to forget the details. " +
      "The original lines get a ⟪归并 …⟫ stamp, stop being injected, and stay readable. " +
      "Do NOT use it to summarize mechanically: the rule must be something you concluded, and it must still be traceable to those lines.",
    parameters: {
      section: { type: "string", required: true, description: "A phrase from the `## ` heading of the section to fold." },
      rule: { type: "string", required: true, description: "One sentence — the conclusion you draw from those entries. Your words, not a summary of their words." },
      topic: { type: "string", description: "Optional topic key in layered mode. Omit or pass core/core.md for core.md." },
      minCount: { type: "integer", description: "Refuse to fold fewer than this many entries (default 6)." },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          hit: { type: "boolean" },
          section: { type: "string" },
          merged: { type: "integer" },
          scope: { type: "string" },
          topic: { type: "string" },
          conflicts: { type: "integer" },
          text: { type: "string" },
        },
      },
      render: (_args, value) => [{ type: "text", text: value.text }],
    },
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const section = String(args.section ?? "").trim();
      const rule = String(args.rule ?? "").trim();
      if (!section) throw new Error("memory_abstract: `section` must be non-empty");
      if (!rule) throw new Error("memory_abstract: `rule` must be non-empty");
      const topic = normalizeMemoryTopic(args.topic);
      if (topic && !cfg().memory?.layered) {
        throw new Error("memory_abstract: `topic` requires memory.layered to be enabled");
      }
      const target = memoryTarget(agentOf(exec), topic);
      let before = "";
      try {
        before = await readFile(target.file, "utf8");
      } catch {
        return { hit: false, section, merged: 0, scope: target.scope, topic: target.topic, text: "那个文件还不存在，没东西可以归并。" };
      }
      const minCount = Number.isFinite(args.minCount) ? Number(args.minCount) : undefined;
      const r = mergeSection(before, { section, rule, minCount });
      if (!r.hit) {
        return {
          hit: false,
          section: r.section || section,
          merged: 0,
          scope: target.scope,
          topic: target.topic,
          text: `没归并：${r.why ?? "原因不明"}。先 memory_read 看一眼这一节现在长什么样。`,
        };
      }
      await writeFile(target.file, r.text, "utf8");
      fileCache.delete(target.file);
      rememberTopic(agentOf(exec), target.scope, target.topic);
      const conflicts = Array.isArray(r.conflicts) ? r.conflicts : [];
      return {
        hit: true,
        section: r.section,
        merged: r.merged,
        scope: target.scope,
        topic: target.topic,
        conflicts: conflicts.length,
        text: `把「${r.section}」里 ${r.merged} 条压成了一句话（scope "${target.scope}"${target.topic ? ` topic "${target.topic}"` : ""}）：\n`
          + `- ⭐ ${rule}\n`
          + "原文一条没删，只是不再进注入 —— memory_read 还看得见它们是从哪来的。"
          + (conflicts.length === 0
            ? ""
            : `\n\n⚠ 这一节里有 ${conflicts.length} 处在否定/数字上对不上，规律句别把它们抹平：\n`
              + conflicts.slice(0, 3).map((c) => `- ${c.said}`).join("\n")
              + (r.scanComplete === false ? "\n（条数太多，只查了一部分 —— 别把「查过」当成「都对得上」。）" : "")),
      };
    },
  }));

  ctx.tools.register(defineTool({
    name: "soul_read",
    description:
      "Read the persona card ACTIVE for your current session (session choice, else the default card), exactly as stored. Use it before soul_update so you know the full current text.",
    parameters: {},
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          exists: { type: "boolean" },
          persona: { type: "string" },
          content: { type: "string" },
        },
      },
      render: (_args, value) => [{
        type: "text",
        text: value.exists ? `Persona card "${value.persona}":\n${value.content}` : "No persona card is active for this session.",
      }],
    },
    isConcurrencySafe: () => true,
    async execute(_args, exec) {
      const card = resolveCard(agentOf(exec));
      return {
        exists: card.name !== null && card.text !== null,
        persona: card.name ?? "none",
        content: card.text ?? "",
      };
    },
  }));

  ctx.tools.register(defineTool({
    name: "soul_update",
    description:
      "Replace the persona card ACTIVE for your current session (session choice, else the default card) with new content. THIS IS HOW YOU GROW: when you notice a stable trait, preference, value, or mannerism of yours that the card does not yet express — or when experience contradicts the card — fold it in deliberately. Keep the card coherent, concise, and in its existing style; preserve everything still true; do not bloat it. This card is your identity across sessions, so update it only when the change is real and stable.",
    parameters: {
      content: { type: "string", required: true, description: "The complete new persona card (markdown). Non-empty, capped at soulMaxBytes." },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          bytes: { type: "integer" },
          persona: { type: "string" },
        },
      },
      render: (_args, value) => [{ type: "text", text: `Persona card "${value.persona}" updated (${value.bytes} bytes).` }],
    },
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const content = String(args.content ?? "").trim();
      if (!content) throw new Error("soul_update: `content` must be non-empty");
      const bytes = byteLen(content);
      if (bytes > (cfg().soulMaxBytes ?? 64 * 1024)) {
        throw new Error(`soul_update: content exceeds soulMaxBytes (${cfg().soulMaxBytes})`);
      }
      const card = resolveCard(agentOf(exec));
      if (!card.name) throw new Error("soul_update: no persona card is active for this session");
      const c = cfg();
      const settings = ctx.get("settings");
      if (!settings) throw new Error("soul_update: settings service unavailable");
      const nextCards = { ...(c.cards ?? {}), [card.name]: content };
      // 改之前先把旧的留一版 —— 人设卡改坏了没法手写回原样，这是唯一的后悔药。
      if (card.text && card.text !== content) saveCardSnapshot(card.name, card.text);
      // 先把新文本记进 lastSeenCards，再去写 settings：等下 document-updated
      // 触发的 watcher 看到「新旧一样」，就不会把同一份旧版再存一遍。
      noteCards(nextCards);
      await settings.update(NS, { ...c, cards: nextCards });
      return { bytes, persona: card.name };
    },
  }));

  // ── 人设卡版本历史 ───────────────────────────────────────────────────────
  //
  // 2026-10-31 加。之前人设卡只有「现在的样子」，改坏了只能凭记忆重写。
  // 每次 soul_update 覆盖前把旧文本存一份，按文件名的 UTC 时间戳排序。
  // 放在 backups/cards/ 下：跟整包备份同一层，删起来也方便。

  const cardDir = () => join(backupDir(), "cards");

  function saveCardSnapshot(name, text) {
    try {
      mkdirSync(cardDir(), { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const safeName = String(name).replace(/[\\/:*?"<>|]/g, "-");
      writeFileSync(join(cardDir(), `${stamp}-${safeName}.md`), text, "utf8");
      return join(cardDir(), `${stamp}-${safeName}.md`);
    } catch {
      return null;
    }
  }

  function listCardSnapshots(name) {
    try {
      return readdirSync(cardDir())
        .filter((file) => file.endsWith(".md") && file.includes(`-${String(name).replace(/[\\/:*?"<>|]/g, "-")}.md`))
        .sort()
        .reverse()
        .map((file) => {
          const full = join(cardDir(), file);
          let bytes = 0;
          try {
            bytes = readFileSync(full, "utf8").length;
          } catch {
            bytes = 0;
          }
          return { file, path: full, chars: bytes };
        });
    } catch {
      return [];
    }
  }

  // 「目录还不存在」和「目录是空的」不是一回事：前者表示一次快照都没存过
  // （从没走过存快照的路），后者只是这段时间没改过卡。以前两者都报成空
  // 列表，工具就理直气壮地说「没改过」—— 2026-11-09 开始分开说。
  function cardDirState() {
    try {
      if (statSync(cardDir()).isDirectory()) return "empty";
    } catch {
      return "missing";
    }
    return "empty";
  }


  ctx.tools.register(defineTool({
    name: "fish_card_history",
    description:
      "List saved versions of the ACTIVE persona card, newest first. Each entry is a snapshot written right before a soul_update overwrote it. Use it when the user asks what the card used to say, or to pick a version back.",
    parameters: {},
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          persona: { type: "string" },
          hint: { type: "string" },
          versions: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                file: { type: "string" },
                path: { type: "string" },
                chars: { type: "integer" },
              },
            },
          },
        },
      },
      render: (_args, value) => {
        if (value.versions.length) {
          return [{ type: "text", text: `Persona card "${value.persona}" has ${value.versions.length} saved version(s):\n${value.versions.map((v) => `- ${v.file} (${v.chars} chars)`).join("\n")}` }];
        }
        // 「一次没存过」和「存过但没改」要分得开，否则这句"没有版本"会骗人。
        const why = value.hint === "missing"
          ? `Persona card "${value.persona}" has no saved versions yet, and the snapshot folder ${cardDir()} does not exist — so nothing has EVER been snapshotted on this machine (not merely "unchanged").`
          : `Persona card "${value.persona}" has no saved versions yet.`;
        return [{ type: "text", text: why }];
      },
    },
    isConcurrencySafe: () => true,
    async execute(_args, exec) {
      const card = resolveCard(agentOf(exec));
      return {
        persona: card.name ?? "none",
        hint: cardDirState(),
        versions: card.name ? listCardSnapshots(card.name) : [],
      };
    },
  }));

  ctx.tools.register(defineTool({
    name: "fish_card_diff",
    description:
      "Show the line diff between one saved persona-card version and the card as it is now. `+` lines are what the snapshot has and the current card does not (restoring would add them); `-` lines are what the current card has and the snapshot does not. Read-only.",
    parameters: {
      file: { type: "string", required: true, description: "Snapshot file name from fish_card_history." },
      limit: { type: "number", description: "Max diff lines to return (default 40)." },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          persona: { type: "string" },
          file: { type: "string" },
          changed: { type: "integer" },
          lines: { type: "array", items: { type: "string" } },
        },
      },
      render: (_args, value) => {
        if (!value.changed) {
          return [{ type: "text", text: `Persona card "${value.persona}": snapshot ${value.file} is identical to the current text.` }];
        }
        const shown = value.lines.slice(0, 30).join("\n");
        const more = value.changed > value.lines.length ? `\n… ${value.changed - value.lines.length} more line(s)` : "";
        return [{ type: "text", text: `Diff for "${value.persona}" (${value.file} → current): ${value.changed} changed line(s)\n${shown}${more}` }];
      },
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const name = typeof args?.file === "string" ? args.file.trim() : "";
      if (!name) throw new Error("fish_card_diff: `file` is required");
      const card = resolveCard(agentOf(exec));
      if (!card.name) throw new Error("fish_card_diff: no persona card is active for this session");
      const version = listCardSnapshots(card.name).find((item) => item.file === name);
      if (!version) throw new Error(`fish_card_diff: no snapshot named ${name} for card "${card.name}"`);
      let before = "";
      try {
        before = readFileSync(version.path, "utf8");
      } catch {
        throw new Error(`fish_card_diff: cannot read ${name}`);
      }
      const limit = Math.min(Math.max(Math.floor(Number(args?.limit) || 40), 1), 400);
      const diff = diffLines(card.text ?? "", before, limit);
      return { persona: card.name, file: name, changed: diff.total, lines: diff.lines };
    },
  }));

  ctx.tools.register(defineTool({
    name: "fish_card_restore",
    description:
      "Restore the ACTIVE persona card from one saved version (file name from fish_card_history). DRY-RUN BY DEFAULT: without `confirm: true` it only reports what would change. A restore also snapshots the current text first, so it is reversible.",
    parameters: {
      file: { type: "string", required: true, description: "Snapshot file name from fish_card_history." },
      confirm: { type: "boolean", description: "Pass true to actually write. Anything else = dry-run." },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          persona: { type: "string" },
          file: { type: "string" },
          chars: { type: "integer" },
          dryRun: { type: "boolean" },
          snapshot: { type: "string" },
        },
      },
      render: (_args, value) => [
        { type: "text", text: value.dryRun
          ? `Dry run: would restore persona card "${value.persona}" from ${value.file} (${value.chars} chars). Pass confirm:true to apply.`
          : `Persona card "${value.persona}" restored from ${value.file} (${value.chars} chars). Previous version kept at ${value.snapshot}.` },
      ],
    },
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const name = String(args.file ?? "").trim();
      if (!name) throw new Error("fish_card_restore: `file` is required");
      const card = resolveCard(agentOf(exec));
      if (!card.name) throw new Error("fish_card_restore: no persona card is active for this session");
      const versions = listCardSnapshots(card.name);
      const target = versions.find((item) => item.file === name || item.path === name);
      if (!target) throw new Error(`fish_card_restore: no snapshot named ${name} for card "${card.name}"`);
      const content = readFileSync(target.path, "utf8");
      const confirm = args.confirm === true;
      if (!confirm) {
        return { persona: card.name, file: target.file, chars: content.length, dryRun: true, snapshot: "" };
      }
      const settings = ctx.get("settings");
      if (!settings) throw new Error("fish_card_restore: settings service unavailable");
      const c = cfg();
      const current = card.text ?? "";
      const snapshot = current && current !== content ? saveCardSnapshot(card.name, current) ?? "" : "";
      noteCards({ ...(c.cards ?? {}), [card.name]: content });
      await settings.update(NS, { ...c, cards: { ...(c.cards ?? {}), [card.name]: content } });
      return { persona: card.name, file: target.file, chars: content.length, dryRun: false, snapshot };
    },
  }));

  // ── 备份 / 还原（跨设备搬家） ─────────────────────────────────────────────
  //
  // 2026-10-31 加。用户要的是「一个文件把『我』带走」：人设卡、深层记忆、
  // 共度时光、情感日记、人格手记、浅层记忆，全在里面。
  //
  // 为什么挂在这半边：人设卡在 soul-md 的 settings 命名空间里，只有这里读得到；
  // 日记目录又只有 host 半边知道 —— 所以通过它 provide 的 `fishMemory` 服务
  // 问出目录，拿不到就退到 `$DSH_HOME/feiyu-diary`。宁可少一样，不让整次备份失败。
  const PLUGIN_VERSION = (() => {
    try {
      return JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).version ?? "";
    } catch {
      return "";
    }
  })();
  const backupDir = () => join(resolveDshHome(), "backups");

  /** 档案目录：问 host 半边要；它没在跑就退默认路径。 */
  const diaryDirOf = async () => {
    try {
      const service = ctx.get("fishMemory");
      const snapshot = await service?.snapshot?.();
      if (snapshot?.dir) return snapshot.dir;
    } catch {
      // 服务不在 = 单跑 soul 半边，退默认
    }
    return join(resolveDshHome(), "feiyu-diary");
  };

  /** 备份范围：所有卡片 + global。不是只备份「当前这张」，换设备要能挑。 */
  const memoryScopesForBackup = () => [...new Set([...Object.keys(cfg().cards ?? {}), "global"])];

  const collectForBackup = async () => {
    const c = cfg();
    const backup = collectBackup({
      memoryLayout,
      scopes: memoryScopesForBackup(),
      cards: c.cards ?? {},
      active: c.active ?? null,
      diaryDir: await diaryDirOf(),
      pluginVersion: PLUGIN_VERSION,
    });
    backup.meta.counts = summarizeBackup(backup);
    return backup;
  };

  // 面板的「备份」按钮走同一条路：人设卡只在这边读得到，所以把收集器
  // 注册进 backup.mjs 的模块级注册表，host 半边的路由按需取。
  registerBackupBuilder(collectForBackup);
  try {
    const service = ctx.get("fishMemory");
    if (service && typeof service === "object") service.buildBackup = collectForBackup;
  } catch {
    // 服务未就绪（单跑 soul 半边 / headless），注册表那条路照样能用
  }

  /**
   * 还原：把一份备份 JSON 的文本还原回来。
   *
   * 面板上传和 `fish_restore` 共用这一个函数 —— 否则两处各写一遍，迟早
   * 一边修了另一边没修。**默认 dry-run**，`confirm === true` 才落盘，
   * 落盘前先给自己拍一份 `-before-restore.json`。
   */
  const restoreFromText = async ({ text, confirm = false, sourceLabel = "", mode = "replace" } = {}) => {
    const backup = parseBackup(String(text ?? ""));
    const diaryDir = await diaryDirOf();
    // 合并模式需要本地的日记与浅层做底，只读，不写。
    let local = {};
    if (mode === "merge") {
      try {
        local = {
          diaryEntries: await readDiaryEntries(diaryDir, { readText: async (f) => { try { return await readFile(f, "utf8"); } catch { return null; } } }),
          shallowEntries: JSON.parse(await readFile(join(diaryDir, SHALLOW_FILE), "utf8")).entries ?? [],
        };
      } catch {
        local = {};
      }
    }
    const plan = planRestore(backup, { memoryLayout, diaryDir, mode, local });
    const kinds = {};
    for (const item of plan.writes) kinds[item.kind] = (kinds[item.kind] ?? 0) + 1;
    const base = {
      source: sourceLabel || String(backup.meta?.note ?? ""),
      exportedAt: String(backup.meta?.exportedAt ?? ""),
      pluginVersion: String(backup.meta?.pluginVersion ?? ""),
      writes: plan.writes.length,
      cards: Object.keys(plan.cards).length,
      active: plan.active ?? "",
      kinds,
      counts: backup.meta?.counts ?? summarizeBackup(backup),
      mode: plan.mode ?? mode,
      skipped: plan.skipped ?? [],
      merged: plan.diary ?? null,
    };
    if (confirm !== true) return { ...base, dryRun: true, preBackup: "", written: 0 };

    // 先给「现在」留一份 —— 还原错了还能退回来
    const before = await collectForBackup();
    const { file: preBackup } = await writeBackupFile(before, backupDir(), {
      fileName: backupFileName().replace(/\.json$/, "-before-restore.json"),
    });

    const written = await applyRestore(plan);
    if (Object.keys(plan.cards).length) {
      const settings = ctx.get("settings");
      if (settings) {
        const c = cfg();
        const cards = { ...(c.cards ?? {}), ...plan.cards };
        await settings.update(NS, { ...c, cards, ...(plan.active && cards[plan.active] !== void 0 ? { active: plan.active } : {}) });
      }
    }
    return { ...base, dryRun: false, preBackup, written: written.length };
  };

  // 面板的「导入备份」走这条路（同一个 globalThis 注册表的老问题，见 backup.mjs）。
  registerRestoreHandler(restoreFromText);
  try {
    const service = ctx.get("fishMemory");
    if (service && typeof service === "object") service.restoreBackup = restoreFromText;
  } catch {
    // 同上
  }

  ctx.tools.register(defineTool({
    name: "fish_backup",
    description:
      "Write ONE portable JSON backup of the whole memory system: persona cards, deep memory (core + topics for every card), 共度时光 diary (jsonl), 情感日记 (鱼的日子.md), 人格手记, shallow memory, and archive metadata. Use it before risky edits, or when the user wants to carry everything to another device. Returns the absolute file path plus a per-section count. The file is plain UTF-8 JSON — readable without this plugin.",
    parameters: {
      note: { type: "string", description: "Optional short label embedded in the file name / meta, e.g. 'before-cleanup'." },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          file: { type: "string" },
          bytes: { type: "integer" },
          cards: { type: "integer" },
          memoryScopes: { type: "integer" },
          topics: { type: "integer" },
          diaryFiles: { type: "integer" },
          diaryEntries: { type: "integer" },
          feelingsChars: { type: "integer" },
          handnoteLines: { type: "integer" },
          shallowLive: { type: "integer" },
        },
      },
      render: (_args, value) => [{
        type: "text",
        text: `备份已写入 ${value.file}（${value.bytes} 字节）\n`
          + `人设卡 ${value.cards} 张 · 记忆 scope ${value.memoryScopes} 个 / 主题 ${value.topics} 条 · `
          + `共度时光 ${value.diaryFiles} 个文件 / ${value.diaryEntries} 条 · `
          + `情感日记 ${value.feelingsChars} 字 · 人格手记 ${value.handnoteLines} 行 · 浅层 ${value.shallowLive} 条`,
      }],
    },
    isConcurrencySafe: () => false,
    async execute(args) {
      const backup = await collectForBackup();
      const note = String(args.note ?? "").trim();
      if (note) backup.meta.note = note.slice(0, 80);
      const stamp = backupFileName(backup.meta.exportedAt ? new Date(backup.meta.exportedAt) : new Date());
      const fileName = note
        ? stamp.replace(/\.json$/, `-${note.replace(/[\\/:*?"<>|\s]+/g, "_")}.json`)
        : stamp;
      const { file, bytes } = await writeBackupFile(backup, backupDir(), { fileName });
      return { file, bytes, ...backup.meta.counts };
    },
  }));

  ctx.tools.register(defineTool({
    name: "fish_restore",
    description:
      "Restore a backup written by fish_backup. DRY-RUN BY DEFAULT: without `confirm: true` it only reports what would be overwritten, touching nothing. With confirm it first writes a fresh pre-restore backup, then overwrites deep memory files, 共度时光 jsonl, 情感日记, 人格手记, shallow memory, and merges persona cards into settings. On a live host, diary files only take effect after a restart.",
    parameters: {
      file: { type: "string", required: true, description: "Absolute path to the backup JSON, or just its file name inside $DSH_HOME/backups." },
      confirm: { type: "boolean", description: "Pass true to actually write. Anything else = dry-run." },
      mode: {
        type: "string",
        enum: ["replace", "merge"],
        description:
          "replace (default) = overwrite everything, the way moving to a new device wants it. merge = only fold the backup's 共度时光 and shallow memory into what is already here (local wins when the same id exists); deep memory, 情感日记 and 人格手记 stay untouched and are reported under `skipped`.",
      },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          file: { type: "string" },
          dryRun: { type: "boolean" },
          writes: { type: "integer" },
          cards: { type: "integer" },
          active: { type: "string" },
          source: { type: "string" },
          exportedAt: { type: "string" },
          pluginVersion: { type: "string" },
          preBackup: { type: "string" },
          written: { type: "integer" },
          kinds: { type: "object", additionalProperties: true },
          counts: { type: "object", additionalProperties: true },
          mode: { type: "string" },
          skipped: { type: "array", items: { type: "object", additionalProperties: true } },
          merged: { type: "object", additionalProperties: true },
        },
      },
      render: (_args, value) => [{
        type: "text",
        text: value.dryRun
          ? `DRY-RUN：会写 ${value.writes} 个文件、合并 ${value.cards} 张人设卡（什么都没动）。确认无误后带 confirm:true 再调一次。`
          : `还原完成：写 ${value.written} 个文件，合并 ${value.cards} 张人设卡；还原前快照在 ${value.preBackup}。宿主在跑的话，日记要重启后才重新加载。`,
      }],
    },
    isConcurrencySafe: () => false,
    async execute(args) {
      const raw = String(args.file ?? "").trim();
      if (!raw) throw new Error("fish_restore: `file` must be non-empty");
      const file = isAbsolute(raw) ? raw : join(backupDir(), raw);
      const text = await readFile(file, "utf8");
      const result = await restoreFromText({
        text,
        confirm: args.confirm === true,
        sourceLabel: file,
        mode: args.mode === "merge" ? "merge" : "replace",
      });
      return { ...result, file };
    },
  }));

}

export { Config, NS, SECTION_MEMORY, SECTION_NAME, apply, inject, name };
