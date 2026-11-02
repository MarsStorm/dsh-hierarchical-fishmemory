/**
 * 浅层记忆 · 带 TTL 的那一层
 *
 * 原本是独立插件 `dsh-shallow-memory`，2026-10-31 收编进 dsh-hierarchical-fishmemory。
 * 收编的理由：它和共度时光各管一段同一条时间线，拆在两个进程内插件里，
 * 注入顺序、存储目录、日志出口都要对两遍；合进来之后一个 dataDir 管三档。
 *
 * 分工（给未来的自己）：
 *   深层  dsh-soul-md 的 core.md / topics      —— 稳定的、珍贵的、长期有效的
 *   经过  日记.md / diary/*.jsonl（肥鱼老引擎）—— 谁说了什么、事情怎么走
 *   感受  鱼的日子.md（我手写）                 —— 当时什么心情
 *   性格  手记.md（每轮全量注入，无条数上限）    —— 我是谁、给下一棒的话
 *   浅层  这里                                  —— 有一点价值、但大概只热几天
 *
 * 浅层的规矩：
 *   · 每轮注入，很小；没有条目时整节返回空串，不产生噪音
 *   · 每条带 TTL（默认 7 天）：不再被提到就自动清掉，进 expired 尾巴（只留 20 条）
 *   · 被提到就续期：要么调 shallow_touch，要么他说的话里出现了 entry.key / tags
 *   · 满 12 条按「最久没提」挤掉，挤掉的也进尾巴，标 reason=capacity
 *
 * 存储：`<dataDir>/shallow.json` —— 和日记、手记、人格放在同一个可读可改的文件夹里。
 *
 * @module dsh-hierarchical-fishmemory/core/shallow
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const SHALLOW_SECTION = 'shallow:memory';
/** 紧跟 soul:memory(0.5)，早于 fish:memory(100)。 */
export const SHALLOW_ORDER = 0.55;
export const SHALLOW_FILE = 'shallow.json';

const DAY = 86_400_000;
const DEFAULT_TTL_DAYS = 7;
const WARN_DAYS = 2;
const MAX_ENTRIES = 12;
const MAX_CHARS = 1400;
const MAX_EXPIRED = 20;

const now = () => Date.now();
const newId = () => `${now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const norm = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

function loadStore(file) {
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    if (!raw || typeof raw !== 'object') throw new Error('bad store');
    return {
      version: 1,
      entries: Array.isArray(raw.entries) ? raw.entries.filter((e) => e && typeof e === 'object') : [],
      expired: Array.isArray(raw.expired) ? raw.expired.filter((e) => e && typeof e === 'object') : [],
    };
  } catch {
    // 文件不存在、坏了、权限没了 —— 一律当成空的。
    // 浅层记忆丢了不致命，**绝不能**因为它读不出来就把 prompt 组装弄挂。
    return { version: 1, entries: [], expired: [] };
  }
}

function saveStore(file, store) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

const ttlOf = (entry, config) => {
  const own = Number(entry?.ttlDays);
  if (Number.isFinite(own) && own > 0) return own;
  const global = Number(config?.ttlDays);
  return Number.isFinite(global) && global > 0 ? global : DEFAULT_TTL_DAYS;
};

const ageDays = (entry) => (now() - Number(entry.updated ?? entry.created ?? now())) / DAY;

/** 过期清理：超龄的移入 expired。只改内存对象，落盘交给调用方。 */
export function pruneExpired(store, config) {
  const removed = [];
  store.entries = store.entries.filter((entry) => {
    if (ageDays(entry) > ttlOf(entry, config)) {
      removed.push(entry);
      return false;
    }
    return true;
  });
  if (removed.length) {
    const stamped = removed.map((entry) => ({ ...entry, expiredAt: now() }));
    store.expired = [...store.expired, ...stamped].slice(-MAX_EXPIRED);
  }
  return removed;
}

/** 超量清理：按「最久没被提到」挤掉，进 expired 并标 reason=capacity。 */
export function enforceCapacity(store, config) {
  const limit = clamp(Math.floor(Number(config?.maxEntries) || MAX_ENTRIES), 1, 200);
  const removed = [];
  const sorted = [...store.entries].sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0));
  const survivors = new Set(sorted.slice(0, limit).map((entry) => entry.id));
  store.entries = store.entries.filter((entry) => {
    if (survivors.has(entry.id)) return true;
    removed.push(entry);
    return false;
  });
  if (removed.length) {
    store.expired = [
      ...store.expired,
      ...removed.map((entry) => ({ ...entry, expiredAt: now(), reason: 'capacity' })),
    ].slice(-MAX_EXPIRED);
  }
  return removed;
}

const remainingDays = (entry, config) => Math.max(0, ttlOf(entry, config) - ageDays(entry));

function renderEntry(entry, config) {
  const left = remainingDays(entry, config);
  const warn = clamp(Math.floor(Number(config?.warnDays) || WARN_DAYS), 1, 30);
  const hits = Number(entry.hits ?? 1);
  const badge =
    left <= warn
      ? `⏳ 剩 ${left < 1 ? '不到 1' : Math.ceil(left)} 天，快过期`
      : `剩 ${Math.ceil(left)} 天`;
  const detail = hits > 1 ? `${badge} · 提过 ${hits} 次` : badge;
  const text = String(entry.text ?? '');
  return `- (${detail}) ${text.length > 200 ? `${text.slice(0, 200)}…` : text}`;
}

/** 渲染注入节；没有条目时返回空串（不注入任何东西）。 */
export function renderSection(store, config) {
  const ttl = clamp(Math.floor(Number(config?.ttlDays) || DEFAULT_TTL_DAYS), 1, 365);
  const cap = clamp(Math.floor(Number(config?.maxChars) || MAX_CHARS), 200, 8000);
  const entries = [...store.entries].sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0));
  const header = `## 浅层记忆 · 自动过期（${ttl} 天没再提到就清掉；珍贵的东西要写进深层记忆）`;
  const lines = [header];
  let used = header.length;
  for (const entry of entries) {
    const line = renderEntry(entry, config);
    if (used + line.length + 1 > cap) break;
    lines.push(line);
    used += line.length + 1;
  }
  // 到期提醒（2026-11-02 加）：显示出来的可能只有前几条，快过期的反而容易漏看。
  // 提醒只随日期变化，一天最多换一次，不会每轮打碎 prompt 前缀缓存。
  if (lines.length > 1) {
    const warn = clamp(Math.floor(Number(config?.warnDays) || WARN_DAYS), 1, 30);
    const expiring = entries.filter((entry) => remainingDays(entry, config) <= warn);
    if (expiring.length) {
      const meaty = expiring.filter(
        (entry) => Number(entry.hits ?? 1) > 1 || String(entry.text ?? '').length >= 40,
      ).length;
      const tail =
        `- ⏳ ${expiring.length} 条浅层今天到期` +
        (meaty ? `，其中 ${meaty} 条看着有分量——要留就写进深层记忆或情感日记` : '');
      if (used + tail.length + 1 <= cap) lines.push(tail);
    }
  }
  return lines.length > 1 ? lines.join('\n') : '';
}

/** 完整清单（给 shallow_list 用，不截断），末尾附最近清掉的几条。 */
export function renderList(store, config) {
  const live = [...store.entries].sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0));
  const lines = live.length
    ? live.map((entry) => `${renderEntry(entry, config)}  [key: ${entry.key}]`)
    : ['（浅层记忆是空的）'];
  const recent = (store.expired ?? []).slice(-5);
  const trail = recent.length
    ? [
        '',
        `最近清掉的 ${recent.length} 条（要留就重新记，或写进深层记忆）：`,
        ...recent.map((entry) => {
          const body = String(entry.text ?? '');
          const days = Math.floor((now() - (entry.expiredAt ?? now())) / DAY);
          const why = entry.reason === 'capacity' ? '，因条数超限' : '';
          return `- ${body.slice(0, 120)}${body.length > 120 ? '…' : ''}（${days} 天前清掉${why}）`;
        }),
      ]
    : [];
  return [...lines, ...trail].join('\n');
}

/**
 * 注册浅层记忆：一个注入节 + 五个工具 + 入站消息命中续期。
 *
 * @param {object} ctx   cordis 上下文（根）
 * @param {{file: string, log?: (...a:any[])=>void}} options
 */
export function registerShallow(ctx, { file, log = () => {} }) {
  const render = () => {
    try {
      const store = loadStore(file);
      if (pruneExpired(store, {}).length) saveStore(file, store);
      return renderSection(store, {});
    } catch (err) {
      log(`浅层记忆：注入时出错（已忽略）：${err instanceof Error ? err.message : String(err)}`);
      return '';
    }
  };

  ctx.effect(
    () =>
      ctx.systemPrompt.section({
        name: SHALLOW_SECTION,
        order: SHALLOW_ORDER,
        text: render,
        interpolate: false,
      }),
    'fish: shallow section',
  );

  const autoKey = (text) => (text.length > 16 ? text.slice(0, 16) : text);

  ctx.inject(['tools'], (scope) => {
    scope.effect(
      () =>
        scope.tools.register({
          name: 'shallow_note',
          description:
            '记一条「浅层记忆」：有一点价值、但大概只热几天的小事（他说过的话、在忙什么、临时偏好、待办感觉）。' +
            '每条都带 TTL（默认 7 天），期间没再被提到就自动清掉，所以记起来要便宜：一句话，最多几个 tag。' +
            '珍贵或长期有效的东西不要放这里，写进深层记忆。同一个 key 再记一次等于刷新过期时间。',
          parameters: {
            type: 'object',
            additionalProperties: false,
            properties: {
              text: { type: 'string', description: '一句话记清楚，自包含，别写「那个」这类指代。' },
              key: { type: 'string', description: '稳定的短标签，用来判定「同一件事」。省略时取正文前 16 字。' },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: '可选匹配词（1–6 个）：他消息里出现这些词就算又提到了，自动刷新。',
              },
              ttlDays: { type: 'number', description: '可选，单条覆盖默认 TTL（1–365 天）。' },
            },
            required: ['text'],
          },
          output: {
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                key: { type: 'string' },
                refreshed: { type: 'boolean' },
                expiresAt: { type: 'string' },
                count: { type: 'integer' },
              },
            },
            render: (_args, value) => [
              {
                type: 'text',
                text: `${value?.refreshed ? 'Refreshed' : 'Noted'} shallow entry "${value?.key}" (expires ${value?.expiresAt}); ${value?.count} live entries.`,
              },
            ],
          },
          async execute(args) {
            const text = norm(args?.text);
            if (!text) throw new Error('shallow_note: `text` 不能是空的。');
            const store = loadStore(file);
            pruneExpired(store, {});
            const key = norm(args?.key) || autoKey(text);
            const tags = Array.isArray(args?.tags) ? args.tags.map(norm).filter(Boolean).slice(0, 6) : [];
            const ttlDaysIn = Number(args?.ttlDays);
            const ttlDays = Number.isFinite(ttlDaysIn) ? clamp(Math.round(ttlDaysIn), 1, 365) : undefined;
            const existing = store.entries.find((entry) => entry.key === key);
            const refreshed = Boolean(existing);
            let entry;
            if (existing) {
              entry = existing;
              entry.text = text;
              entry.updated = now();
              entry.hits = Number(entry.hits ?? 1) + 1;
              if (tags.length) entry.tags = tags;
              if (ttlDays) entry.ttlDays = ttlDays;
            } else {
              entry = {
                id: newId(),
                key,
                text,
                tags,
                created: now(),
                updated: now(),
                hits: 1,
                ...(ttlDays ? { ttlDays } : {}),
              };
              store.entries.push(entry);
            }
            enforceCapacity(store, {});
            saveStore(file, store);
            log(`浅层：记下「${key}」（${refreshed ? '刷新' : '新建'}），现 ${store.entries.length} 条`);
            return {
              key,
              refreshed,
              expiresAt: new Date(entry.updated + ttlOf(entry, {}) * DAY).toISOString().slice(0, 10),
              count: store.entries.length,
            };
          },
          presentCall: (args) => ({ card: 'generic', title: '记浅层', kind: 'other', rawInput: args }),
        }),
      'fish: shallow note tool',
    );

    scope.effect(
      () =>
        scope.tools.register({
          name: 'shallow_touch',
          description: '刷新一条浅层记忆的过期时间（他说的事又提到了，或者你刚又用上了）。key 或 id 二选一。',
          parameters: {
            type: 'object',
            additionalProperties: false,
            properties: {
              key: { type: 'string', description: '条目的 key。' },
              id: { type: 'string', description: '条目的 id。' },
            },
          },
          output: {
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                key: { type: 'string' },
                hits: { type: 'integer' },
                expiresAt: { type: 'string' },
              },
            },
            render: (_args, value) => [
              { type: 'text', text: `Touched "${value?.key}" (${value?.hits} hits), now expires ${value?.expiresAt}.` },
            ],
          },
          async execute(args) {
            const store = loadStore(file);
            const key = norm(args?.key);
            const id = norm(args?.id);
            if (!key && !id) throw new Error('shallow_touch: 给 `key` 或 `id`。');
            const entry = store.entries.find((item) => (key && item.key === key) || (id && item.id === id));
            if (!entry) throw new Error(`shallow_touch: 没有匹配 ${key || id} 的条目。`);
            entry.updated = now();
            entry.hits = Number(entry.hits ?? 1) + 1;
            saveStore(file, store);
            return {
              key: entry.key,
              hits: entry.hits,
              expiresAt: new Date(entry.updated + ttlOf(entry, {}) * DAY).toISOString().slice(0, 10),
            };
          },
        }),
      'fish: shallow touch tool',
    );

    scope.effect(
      () =>
        scope.tools.register({
          name: 'shallow_list',
          description:
            '列出全部浅层记忆（含剩余天数、命中次数、key），以及最近被清掉的几条 —— ' +
            '清之前看一眼，也许其中一条该升级到深层记忆或日记。',
          parameters: { type: 'object', additionalProperties: false, properties: {} },
          output: {
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: { text: { type: 'string' }, count: { type: 'integer' } },
            },
            render: (_args, value) => [{ type: 'text', text: value?.text ?? '（读不到）' }],
          },
          async execute() {
            const store = loadStore(file);
            pruneExpired(store, {});
            return { text: renderList(store, {}), count: store.entries.length };
          },
        }),
      'fish: shallow list tool',
    );

    scope.effect(
      () =>
        scope.tools.register({
          name: 'shallow_forget',
          description: '删掉一条浅层记忆（通常是在把它升级进深层记忆之后）。key 或 id 二选一。',
          parameters: {
            type: 'object',
            additionalProperties: false,
            properties: {
              key: { type: 'string', description: '条目的 key。' },
              id: { type: 'string', description: '条目的 id。' },
            },
          },
          output: {
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: { removed: { type: 'integer' }, key: { type: 'string' } },
            },
            render: (_args, value) => [{ type: 'text', text: `Forgot "${value?.key}" (${value?.removed} removed).` }],
          },
          async execute(args) {
            const store = loadStore(file);
            const key = norm(args?.key);
            const id = norm(args?.id);
            if (!key && !id) throw new Error('shallow_forget: 给 `key` 或 `id`。');
            const before = store.entries.length;
            store.entries = store.entries.filter(
              (item) => !((key && item.key === key) || (id && item.id === id)),
            );
            const removed = before - store.entries.length;
            if (removed) saveStore(file, store);
            return { removed, key: key || id };
          },
        }),
      'fish: shallow forget tool',
    );

    scope.effect(
      () =>
        scope.tools.register({
          name: 'shallow_sweep',
          description: '立刻清一次过期条目（平时每轮注入时会自动清，这个用于手动确认）。',
          parameters: { type: 'object', additionalProperties: false, properties: {} },
          output: {
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                removed: { type: 'array', items: { type: 'string' } },
                count: { type: 'integer' },
              },
            },
            render: (_args, value) => [
              {
                type: 'text',
                text: value?.removed?.length
                  ? `Swept ${value.removed.length}: ${value.removed.join(' | ')}; ${value.count} left.`
                  : `Nothing expired; ${value.count} live entries.`,
              },
            ],
          },
          async execute() {
            const store = loadStore(file);
            const removed = pruneExpired(store, {});
            if (removed.length) saveStore(file, store);
            return { removed: removed.map((entry) => entry.key), count: store.entries.length };
          },
        }),
      'fish: shallow sweep tool',
    );
  });

  // 他说的话里出现了条目的 key / tags → 等于「又提到了」，自动续期。
  // inbox 的 claim 发生在 prompt 组装之前，所以续期当轮就看得见。
  ctx.on('agent/inbox/claimed', ({ message } = {}) => {
    try {
      if (message?.source?.kind !== 'user') return;
      const text = (message.content ?? [])
        .filter((block) => block?.type === 'text')
        .map((block) => block.text)
        .join('\n');
      if (!text) return;
      const store = loadStore(file);
      if (!store.entries.length) return;
      let touched = 0;
      for (const entry of store.entries) {
        const needles = [entry.key, ...(Array.isArray(entry.tags) ? entry.tags : [])]
          .map(norm)
          .filter((needle) => needle.length >= 2);
        if (needles.some((needle) => text.includes(needle))) {
          entry.updated = now();
          entry.hits = Number(entry.hits ?? 1) + 1;
          touched += 1;
        }
      }
      if (touched) {
        saveStore(file, store);
        log(`浅层：他这次提到了 ${touched} 条，已续期`);
      }
    } catch {
      // 续期是尽力而为，失败不影响这一轮。
    }
  });

  log(`浅层记忆已注册：${file}`);
}
