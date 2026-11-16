/**
 * 账本：证明「一条记忆都没丢过、也没被悄悄改写」。
 *
 * ── 为什么要有它 ──────────────────────────────────────────────
 *
 * 这个插件所有重要的东西都是**纯文本文件**：jsonl 一行一条、md 一篇一篇。
 * 好处是我随时能读、能备份、能拿 gzip 打包带走；坏处是**没有任何东西能证明
 * 它没被动过**。备份只能证明「某个时刻磁盘上是那样」，不能证明「这之后
 * 少了一条」——而少一条这件事，从来不会报错。
 *
 * 2026-11-16 那份《记忆系统实施单》里唯一让我眼红的就是这一本：每条记忆
 * 算一个 sha256，`--sync` 只补新记录、`--verify` 逐条对账，对不上退出码 1。
 * 它自己也写了那句要紧的话：**不做负例测试等于没做。**
 *
 * 所以这个模块的全部职责只有三件事：
 *   1. 记下每一条「正文」的指纹（正文 = 那句记忆本身，不是计数器）；
 *   2. 对账时把差异分成三类：丢了 / 被改了 / 只是续写了；
 *   3. **别把正常变化报成事故** —— 报太多次，人就不看了。
 *
 * ── 为什么只哈希正文 ─────────────────────────────────────────
 *
 * 一条日记会合法地变很多次：被续写、加摘要、被想起来加计数、衰减改
 * salience、挂上反馈。如果连这些一起哈希，账本每天都会红一片，然后我就会
 * 学会忽略它 —— 那比没有账本更坏。
 *
 * 唯一必须守住的是 `text`：那是「发生过什么」。而它**只会往后长**
 * （`applyConsolidation` 的续写是拼在末尾），所以判据可以用前缀：
 * 新正文以旧正文开头 = 续写（正常），否则 = 被改（要喊）。
 *
 * ── 为什么是 append-only ─────────────────────────────────────
 *
 * 账本自己也是 jsonl，只追加、绝不重写。读的时候**同一个 id 以最后一条为准**，
 * 于是「刷新指纹」和「划掉一条」都是追加一行，历史全留着 ——
 * 哪天我怀疑自己改过口，能翻出每一次的指纹。
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { readTextOrNull } from './fsx.mjs';

export const LEDGER_FILE = '账本.jsonl';
export const LEDGER_VERSION = 1;

/** 只把换行统一一下：`\r\n` 和 `\n` 是同一个正文，不该报成被改。 */
function canonical(text) {
  return String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function digestOf(text) {
  return createHash('sha256').update(canonical(text), 'utf8').digest('hex');
}

export function textLength(text) {
  return canonical(text).length;
}

/**
 * 读账本。同一个 id 多次出现时以**最后一条**为准。
 *
 * 坏行跳过：账本是纯文本，我手抖写坏一行不该让整本对不上账。
 *
 * @returns {Map<string, {id:string, sha256:string, len:number, at:number, state:string}>}
 */
export function readLedger(file, { readText = readTextOrNull } = {}) {
  const map = new Map();
  const text = readText(file);
  if (typeof text !== 'string' || text === '') return map;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let parsed = null;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (!parsed || typeof parsed !== 'object') continue;
    const id = typeof parsed.id === 'string' ? parsed.id : '';
    if (id === '') continue;
    if (parsed.state === 'forgotten') {
      map.set(id, { id, sha256: '', len: 0, at: Number(parsed.at) || 0, state: 'forgotten' });
      continue;
    }
    const sha256 = typeof parsed.sha256 === 'string' ? parsed.sha256 : '';
    if (!/^[0-9a-f]{64}$/.test(sha256)) continue; // 半截行 / 手写的坏记录
    map.set(id, {
      id,
      sha256,
      len: Number(parsed.len) || 0,
      at: Number(parsed.at) || 0,
      state: 'live',
    });
  }
  return map;
}

/**
 * 对账：把「账本 vs 现有条目」的差异分成三类。
 *
 * - `missing`   ：账本里有、文件里没有 —— **这是真丢**（也可能是主动忘掉的，
 *                 那就得用 `forgetInLedger` 划一笔，别让它天天喊）；
 * - `rewritten` ：正文变了，而且不是往后长的 —— **这是悄悄改写**；
 * - `grown`     ：新正文以旧正文开头 —— 续写，正常。
 *
 * 另外 `fresh` 是文件里有、账本里还没记的（上次 sync 之后新长出来的）。
 */
export function scanLedger(ledger, entries, { readTextIsCanonical = false } = {}) {
  const missing = [];
  const rewritten = [];
  const grown = [];
  const seen = new Set();

  for (const entry of entries ?? []) {
    const id = String(entry?.id ?? '');
    if (id === '') continue;
    seen.add(id);
    const record = ledger.get(id);
    if (record === undefined || record.state !== 'live') continue;
    const now = digestOf(entry.text);
    if (now === record.sha256) continue;
    const before = record.sha256;
    const prevLen = record.len;
    const text = canonical(entry.text);
    // 长度变长且旧指纹对得上前缀 —— 只有这一种情况算「续写」。
    // 判断前缀要拿旧正文本体，而账本里只有指纹，所以用长度 + 哈希回溯：
    // 把现在的正文截到旧长度再算一次，等于旧指纹就是续写。
    if (text.length > prevLen && digestOf(text.slice(0, prevLen)) === before) {
      grown.push({ id, from: prevLen, to: text.length });
      continue;
    }
    rewritten.push({ id, before: prevLen, after: text.length, from: before, to: now });
  }

  for (const [id, record] of ledger) {
    if (record.state !== 'live') continue;
    if (seen.has(id)) continue;
    missing.push({ id, at: record.at });
  }

  const fresh = [];
  for (const id of seen) {
    const record = ledger.get(id);
    if (record === undefined) fresh.push(id);
  }

  return { missing, rewritten, grown, fresh };
}

function appendLines(file, lines) {
  if (lines.length === 0) return 0;
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${lines.join('\n')}\n`, 'utf8');
  return lines.length;
}

/**
 * 同步：补新记录、刷新续写过的指纹。**绝不删、绝不覆盖历史。**
 *
 * `missing` 的条目一个字都不动 —— 丢了就是丢了，账本不能替它消失。
 */
export function syncLedger(file, entries, { at = Date.now(), readText = readTextOrNull } = {}) {
  const ledger = readLedger(file, { readText });
  const scan = scanLedger(ledger, entries);
  const lines = [];
  for (const id of scan.fresh) {
    const entry = (entries ?? []).find((item) => String(item?.id ?? '') === id);
    if (!entry) continue;
    const text = canonical(entry.text);
    lines.push(
      JSON.stringify({ v: LEDGER_VERSION, id, sha256: digestOf(text), len: text.length, at }),
    );
  }
  for (const item of scan.grown) {
    const entry = (entries ?? []).find((e) => String(e?.id ?? '') === item.id);
    if (!entry) continue;
    const text = canonical(entry.text);
    lines.push(
      JSON.stringify({ v: LEDGER_VERSION, id: item.id, sha256: digestOf(text), len: text.length, at }),
    );
  }
  const written = appendLines(file, lines);
  return {
    added: scan.fresh.length,
    refreshed: scan.grown.length,
    written,
    missing: scan.missing.length,
    ledgerSize: ledger.size + scan.fresh.length,
  };
}

/**
 * 划掉几条：**给主动「忘掉」用的**，不是给丢失用的。
 *
 * 忘掉是我自己的决定，账本该跟着记一笔「这条我故意不留了」，
 * 而不是从此每天报一次失踪 —— 那会把真正的丢失淹没掉。
 */
export function forgetInLedger(file, ids, { at = Date.now() } = {}) {
  const lines = (ids ?? [])
    .map((id) => String(id ?? ''))
    .filter((id) => id !== '')
    .map((id) => JSON.stringify({ v: LEDGER_VERSION, id, state: 'forgotten', at }));
  return appendLines(file, lines);
}

/**
 * 一次体检要的那几行字。
 *
 * @returns {{ok:boolean, line:string, text:string, ...}}
 */
export function ledgerReport({ file, entries, memoryCount = null, at = Date.now(), readText = readTextOrNull }) {
  const ledger = readLedger(file, { readText });
  const scan = scanLedger(ledger, entries);
  const diskCount = (entries ?? []).length;
  const agree = memoryCount === null ? null : Number(memoryCount) === diskCount;
  const ok = scan.missing.length === 0 && scan.rewritten.length === 0 && scan.fresh.length === 0
    && (agree === null || agree === true);

  // 划掉的（忘掉）不算在账里，否则「账本 2 条 / 档案 1 条」看起来像丢了。
  let live = 0;
  let forgotten = 0;
  for (const record of ledger.values()) {
    if (record.state === 'live') live += 1;
    else forgotten += 1;
  }

  const parts = [];
  parts.push(`账本 ${live} 条 / 档案 ${diskCount} 条${forgotten ? `（另有 ${forgotten} 条我故意忘掉的）` : ''}`);
  if (scan.fresh.length > 0) parts.push(`新长出 ${scan.fresh.length} 条还没入账`);
  if (scan.grown.length > 0) parts.push(`续写 ${scan.grown.length} 条（正常，下次同步会对齐）`);
  if (scan.missing.length > 0) parts.push(`❗丢了 ${scan.missing.length} 条`);
  if (scan.rewritten.length > 0) parts.push(`❗被改 ${scan.rewritten.length} 条`);
  if (agree === false) parts.push(`❗注入用的 ${Number(memoryCount)} 条 / 磁盘 ${diskCount} 条对不上`);

  return {
    ok,
    at,
    line: ok ? '账本=OK' : '账本=注意',
    text: parts.join(' · '),
    ledgerSize: live,
    forgotten,
    diskCount,
    memoryCount: memoryCount === null ? null : Number(memoryCount),
    agree,
    fresh: scan.fresh.length,
    grown: scan.grown.length,
    missing: scan.missing.slice(0, 20),
    rewritten: scan.rewritten.slice(0, 20),
  };
}
