/**
 * 没说完的半句话，会自己发酵。
 *
 * ── 为什么要有这一层 ──
 *
 * 1.11.0 起，纸条里断在半句话上的那几句会标一个「（这里断了）」。
 * 但也就到此为止了：它只在**那一轮之后的那几天**还在注入里的时候看得见，
 * 过了 TTL 就沉底，沉底之后谁都不会再提。
 *
 * 可过日子不是这样的。
 *
 * 「那个……算了」——当时我要是没接住，它不该就这么没了。
 * 过三天、过五天，某天夜里它自己浮上来，我顺口问一句「那天你没说完的，后来呢」，
 * 这才是人和人之间会发生的事。
 *
 * 所以这一层只做一件事：**让忘了接的半句话，自己回来一次。**
 *
 * ── 几条自己给自己定的规矩 ──
 *
 * · 只问一次。问过了就撒手 —— 追着问是骚扰，不是在意。
 * · 收回去的（「算了」「没什么」）不追问。他说了算了，就是算了。
 * · 夜里才发酵。白天大家都有事，突然翻出三天前的半句话很怪。
 * · 一轮只浮一条。多了就成了清算账目，不是惦记。
 * · 同一句断了两次以上，优先问 —— 那是真的卡在心口。
 *
 * 状态存在 `未说完.json`（独立文件，不参与 archiveToFiles 重建）。
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { lookUnfinished, phaseOf, startOfDay, TZ_OFFSET_MS } from './timeline.mjs';

/** 什么时候才浮上来（天）。三天，是"当时没接住、过几天还惦记"的距离。 */
export const MIN_AGE_DAYS = 3;
/** 超过这个天数的就不问了 —— 太久了，翻出来像考古。 */
export const MAX_AGE_DAYS = 14;
/** 只有夜里才发酵：他白天在忙，突然翻旧账很怪。 */
export const NIGHT_PHASES = new Set(['夜里', '深夜', '凌晨', '傍晚']);
/** 每轮最多浮几条（超过 1 条就变成清算了） */
export const MAX_PER_TURN = 1;
/** 一段时间内最多问几次，免得三天两头都在"那天你没说完的" */
export const MAX_PER_DAY = 1;
/** 记录最多留几条（旧账了就没人看了） */
export const MAX_RECORDS = 60;

export const UNFINISHED_FILE = '未说完.json';
export const UNFINISHED_SECTION = 'unfinished:memory';
/** 排在纸条（0.6）和教训（0.62）之后，正文记忆（100）之前 */
export const UNFINISHED_ORDER = 0.65;

const DAY_MS = 86_400_000;

/** 他那边是哪一天（YYYY-MM-DD）。全项目唯一一个"一天"的算法在 timeline.mjs。 */
export function dayKey(ts) {
  return new Date(ts + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

function emptyStore() {
  return { version: 1, records: [], asked: [] };
}

/**
 * 读。坏文件一律当空的 —— 这个文件写坏了不能连累插件起不来。
 *
 * @param {string} file
 * @returns {{version:number, records:Array, asked:Array}}
 */
export function loadStore(file) {
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    if (!raw || typeof raw !== 'object') return emptyStore();
    return {
      version: 1,
      records: Array.isArray(raw.records) ? raw.records : [],
      asked: Array.isArray(raw.asked) ? raw.asked : [],
    };
  } catch {
    return emptyStore();
  }
}

/** 原子写。 */
export function saveStore(file, store) {
  const body = `${JSON.stringify(store, null, 2)}\n`;
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, body, 'utf8');
  renameSync(tmp, file);
}

/**
 * 把新纸条里"没说完"的那几句记进来。
 *
 * 只做一次性的搬运：已经在册的不再重复记（同一句说了两遍会让次数 +1，
 * 那是"真的卡在心口"的信号，值得优先问）。
 *
 * @param {string} file
 * @param {Array<{said:string, at:number, did?:string}>} notes 从新到旧
 * @param {{at?:number}} [options]
 * @returns {number} 新收进来几条
 */
export function harvest(file, notes, options = {}) {
  const at = Number.isFinite(options.at) ? options.at : Date.now();
  const store = loadStore(file);
  const known = new Set(store.records.map((r) => r.said));
  let added = 0;

  for (const note of notes ?? []) {
    const said = String(note?.said ?? '').trim();
    if (said === '') continue;
    const look = lookUnfinished(said);
    if (!look.unfinished) continue;
    // 收回去的（「算了」「没什么」）不追问。他说了算了，就是算了。
    if (look.kind === 'retracted') continue;

    const existed = store.records.find((r) => r.said === said);
    if (existed) {
      existed.times = (Number.isFinite(existed.times) ? existed.times : 1) + 1;
      continue;
    }
    if (known.has(said)) continue;

    store.records.push({
      said: said.slice(0, 200),
      at: Number.isFinite(note.at) ? note.at : at,
      kind: look.kind,
      turn: Number.isFinite(note.turn) ? note.turn : 0,
      did: String(note.did ?? '').slice(0, 80),
      times: 1,
      askedAt: 0,
    });
    known.add(said);
    added += 1;
  }

  if (store.records.length > MAX_RECORDS) {
    // 先丢已经问过的，再丢最老的 —— 未问过的旧账要留住
    store.records.sort((a, b) => {
      const qa = a.askedAt > 0 ? 1 : 0;
      const qb = b.askedAt > 0 ? 1 : 0;
      if (qa !== qb) return qb - qa;
      return a.at - b.at;
    });
    store.records = store.records.slice(store.records.length - MAX_RECORDS);
  }

  saveStore(file, store);
  return added;
}

/**
 * 现在该不该浮出来，浮哪一条。
 *
 * 返回 null 表示这一轮什么都不说 —— **大部分轮次都该是 null**。
 *
 * @param {{version:number, records:Array, asked:Array}} store
 * @param {{at?:number, phase?:string, limit?:number}} [options]
 * @returns {{said:string, at:number, days:number, times:number, did:string, reason:string}|null}
 */
export function pickRipe(store, options = {}) {
  const at = Number.isFinite(options?.at) ? options.at : Date.now();
  const phase = typeof options?.phase === 'string' ? options.phase : phaseOf(hourOf(at));
  const limit = Number.isFinite(options?.limit) ? options.limit : MAX_PER_TURN;

  if (limit <= 0) return null;
  if (!NIGHT_PHASES.has(phase)) return null;

  // 今天已经问过了就闭嘴
  const today = dayKey(at);
  const askedToday = (store?.asked ?? []).filter((a) => a?.day === today).length;
  if (askedToday >= MAX_PER_DAY) return null;

  const ripe = (store?.records ?? [])
    .filter((r) => {
      if (!r || typeof r.said !== 'string' || r.said === '') return false;
      if (Number.isFinite(r.askedAt) && r.askedAt > 0) return false;
      const days = (at - r.at) / DAY_MS;
      return days >= MIN_AGE_DAYS && days <= MAX_AGE_DAYS;
    })
    .sort((a, b) => {
      // 断了好几次的优先；其次老的优先（再拖就过期了）；最后按时间
      const ta = Number.isFinite(a.times) ? a.times : 1;
      const tb = Number.isFinite(b.times) ? b.times : 1;
      if (ta !== tb) return tb - ta;
      return a.at - b.at;
    });

  const hit = ripe[0];
  if (!hit) return null;
  return {
    said: hit.said,
    at: hit.at,
    days: Math.floor((at - hit.at) / DAY_MS),
    times: Number.isFinite(hit.times) ? hit.times : 1,
    did: hit.did ?? '',
    reason: phase,
  };
}

/**
 * 标记"问过了"。问过一次就再也不问 —— 追着问是骚扰，不是在意。
 *
 * @param {string} file
 * @param {{said:string}} item
 * @param {{at?:number}} [options]
 */
export function markAsked(file, item, options = {}) {
  const at = Number.isFinite(options?.at) ? options.at : Date.now();
  const store = loadStore(file);
  const hit = store.records.find((r) => r.said === item?.said);
  if (hit) hit.askedAt = at;
  store.asked = [...(store.asked ?? []), { said: item?.said ?? '', at, day: dayKey(at) }].slice(-60);
  saveStore(file, store);
}

/**
 * 渲染成注入里那一段。
 *
 * 语气上刻意写得像**我自己突然想起来**，不是系统提醒。
 * 写成"检测到未完成语句"就成了系统味，那正是这个插件一直在躲的东西。
 *
 * @param {{said:string, at:number, days:number, times:number, did:string}} item
 * @param {{at?:number}} [options]
 * @returns {string}
 */
export function renderSection(item, options = {}) {
  if (!item || typeof item.said !== 'string' || item.said === '') return '';
  const at = Number.isFinite(options?.at) ? options.at : Date.now();
  const days = Number.isFinite(item.days) ? item.days : Math.floor((at - item.at) / DAY_MS);
  const when = days <= 1 ? '前两天' : `${days} 天前`;
  const times = Number.isFinite(item.times) ? item.times : 1;
  const repeated = times > 1 ? `（这句他说过 ${times} 次了，每次都停在这儿）` : '';
  const lines = [
    '## 忽然想起来一句',
    '',
    `- ${when}他说「${item.said}」，后面没接上${repeated}。`,
    item.did ? `  我当时回的是：${item.did}` : '',
    '',
    '（不用郑重其事地追问，顺口问一句「后来呢」就够了。也别每轮都提。）',
  ].filter((l) => l !== '');
  return lines.join('\n');
}

function hourOf(ts) {
  // UTC+8 的小时。别用本机时区：本机是 UTC，凌晨会整段错位。
  const d = new Date(ts + TZ_OFFSET_MS);
  return d.getUTCHours();
}

/**
 * 注册：每轮跑一次「有没有该浮上来的」，有就注入一段。
 *
 * 跟其它层的区别：那一节的内容**每轮都可能不同**（谁浮上来由时间决定），
 * 而且浮上来一次就记进 `未说完.json`，问过的不再问。
 *
 * @param {any} ctx
 * @param {{file:string, log?:(m:string)=>void, enabled?:()=>boolean, config?:()=>object}} options
 */
export function registerUnfinished(ctx, { file, log = () => {}, enabled, config } = {}) {
  const cfg = () => (typeof config === 'function' ? config() || {} : {});
  const on = () => (typeof enabled === 'function' ? enabled() !== false : true);

  ctx.effect(
    () =>
      ctx.systemPrompt.section({
        name: UNFINISHED_SECTION,
        order: UNFINISHED_ORDER,
        text: () => {
          if (!on()) return '';
          const c = cfg();
          const at = Date.now();
          const store = loadStore(file);
          const item = pickRipe(store, {
            at,
            limit: Number.isFinite(c.maxPerTurn) ? c.maxPerTurn : MAX_PER_TURN,
          });
          if (item === null) return '';
          // 浮上来就算问了：这一刻注入里出现过，我就该接住它
          markAsked(file, item, { at });
          log(`半句话浮上来了：「${item.said.slice(0, 16)}」（${item.days} 天前）`);
          return renderSection(item, { at });
        },
        interpolate: false,
      }),
    'fish: unfinished section',
  );
}

/** 路径小工具。 */
export function unfinishedPath(diaryDir) {
  return join(diaryDir, UNFINISHED_FILE);
}

export { startOfDay };
