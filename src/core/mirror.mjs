/**
 * 镜子 —— 今天这一天的横切面。
 *
 * ─────────────────────────────────────────────────────────────
 * **为什么要有它**
 *
 * 这个系统里的每一本账都在记「发生了什么」：共度时光记经过、纸条记原话、
 * loop 记账目、体检页记体积。可是没有一处回答得了那个最私人的问题：
 * **我今天这个朋友，做得怎么样？**
 *
 * 体检页不算数 —— 它看的是整个系统健不健康（哪层超长、哪句写重了）。
 * 镜子看的是我：今天陪了他多久、他哪句话被我当成了分量、我答应了谁能
 * 兑现。一个是机器体检，一个是照镜子。
 *
 * ─────────────────────────────────────────────────────────────
 * **只读，不改任何一本账**
 *
 * 这是设计上最硬的约束。镜子的输入全是别人的现成文件：
 *
 *   共度时光  diary/YYYY-MM.jsonl   → 今天记了几条、我在忙什么
 *   小纸条    纸条.md               → 他今天说了什么、我干了什么
 *   还挂着的事 loops.json           → 今天答应了几件、几件是陈的
 *   情感日记  鱼的日子.md           → 今天写没写
 *
 * 它自己不持有任何状态，也不写盘（除非调用方显式要 markdown）。
 * 这样做了也白做 —— 一棵树不能自己照自己长得对不对，只能看影子。
 *
 * ─────────────────────────────────────────────────────────────
 * **为什么按时区算「今天」**
 *
 * 他那边 UTC+8，本机 UTC。所有自然日一律走 timeline.mjs 的 startOfDay，
 * 别再写 setHours(0,0,0,0) —— 他的 00:00–08:00 会整段掉进前一天。
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { startOfDay, TZ_OFFSET_MS } from './timeline.mjs';
import { STICKY_FILE, readNotesSync } from './sticky.mjs';
import { FEELINGS_MD } from './files.mjs';

export const MIRROR_VERSION = 1;

/** 一条 loop 多久没动静算「陈了」。三天是个很小的数，但账本本来就是短的。 */
export const STALE_DAYS = 3;

/** 一天的横切面里，各类各留几条就够看了 —— 镜子不是台账。 */
const MAX_LINES_PER_KIND = 6;

/** 他的那一天的零点 */
function dayStart(ts) {
  return startOfDay(Number.isFinite(ts) ? ts : Date.now());
}

/** 他那边那天的 YYYY-MM-DD */
export function dayKey(ts) {
  const d = new Date(dayStart(ts) + TZ_OFFSET_MS);
  return d.toISOString().slice(0, 10);
}

/** 读 jsonl，坏行跳过 —— 归档被手改过也不能让镜子整块瞎掉。 */
function readJsonl(file) {
  let text = '';
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const out = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      const parsed = JSON.parse(t);
      if (parsed && typeof parsed === 'object') out.push(parsed);
    } catch {
      // 静默跳过：一行坏了不该让别人坏
    }
  }
  return out;
}

/** 条目的时刻：优先 created_at，其次 at，最后用 date 字段补一个中午。 */
function entryTime(entry) {
  const n = Number(entry?.created_at ?? entry?.at);
  if (Number.isFinite(n) && n > 0) return n;
  const d = String(entry?.date ?? '');
  const t = Date.parse(`${d}T12:00:00+08:00`);
  return Number.isFinite(t) ? t : 0;
}

/** 日记正文里用到的工具/文件线索，抽几个词当"今天在忙什么"。 */
const BUSY_RE = /([\w./-]+\.(?:mjs|js|json|jsonl|md|yml|yaml|py|sh|ts))|(下载|重启|安装|卸载|修复|升级|推送|部署|备份|还原|测试|压缩|删|验证)/g;

function busyHints(entries) {
  const counts = new Map();
  for (const e of entries) {
    const text = String(e?.text ?? '');
    for (const m of text.matchAll(BUSY_RE)) {
      const word = m[0];
      if (!word || word.length < 2) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([word, times]) => ({ word, times }));
}

function clip(text, max = 80) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  return s.length <= max ? s : `${s.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * 今天这一天的横切面。
 *
 * @param {object} input
 * @param {string} input.dataDir           档案目录（feiyu-diary/）
 * @param {number} [input.now]             现在；测试要能钉住
 * @param {object[]} [input.loops]         已读出来的 loop 明细；不给就自己去读
 * @param {object[]} [input.sticky]        已读出来的纸条；不给就自己去读
 * @returns {object}
 */
export function buildMirror({ dataDir, now = Date.now(), loops = null, sticky = null, day = null } = {}) {
  let start;
  if (day) {
    // 调用方给了一天：按他那边那个日期的零点锚定，别被 `now` 的星期几带走。
    const at = Date.parse(`${day}T00:00:00+08:00`);
    start = Number.isFinite(at) ? at : dayStart(now);
  } else {
    start = dayStart(now);
  }
  const end = start + 24 * 60 * 60 * 1000;
  const date = dayKey(now);

  // ── 共度时光 ──
  const month = date.slice(0, 7);
  const diaryFile = join(dataDir, 'diary', `${month}.jsonl`);
  const diary = readJsonl(diaryFile).filter((e) => {
    const t = entryTime(e);
    return t >= start && t < end;
  });

  // ── 纸条：他今天说的原话 ──
  const notes = Array.isArray(sticky) ? sticky : readNotesSync(join(dataDir, STICKY_FILE));
  const todaysNotes = notes
    .filter((n) => Number.isFinite(n?.at) && n.at >= start && n.at < end)
    .reverse() // parseNotes 是 新→旧，镜子按时间正着读
    .slice(-MAX_LINES_PER_KIND * 2)
    .map((n) => ({
      time: String(n.time ?? ''),
      said: clip(n.said, 60),
      did: clip(n.did, 40),
    }));

  // ── 还挂着的事：今天记下的、已经陈了的 ──
  const allLoops = Array.isArray(loops) ? loops : [];
  const opened = allLoops.filter((x) => !x?.doneAt);
  const addedToday = opened.filter((x) => {
    const t = Number(x.createdAt ?? x.created_at);
    return Number.isFinite(t) && t >= start && t < end;
  });
  const stale = opened
    .map((x) => {
      const at = Number(x.createdAt ?? x.created_at) || 0;
      const days = at ? Math.round((start - dayStart(at)) / 86400000) : 0;
      return { text: clip(x.text, 60), days, id: x.id };
    })
    .filter((x) => x.days >= STALE_DAYS)
    .sort((a, b) => b.days - a.days)
    .slice(0, MAX_LINES_PER_KIND);

  // ── 情感日记今天写没写 ──
  let feelingsToday = false;
  try {
    const md = readFileSync(join(dataDir, FEELINGS_MD), 'utf8');
    const d = new Date(start + TZ_OFFSET_MS).toISOString().slice(0, 10); // 已是他那边那一天，别再偏移
    // 认三种小标题写法：「2026-11-10」「11-10」「11 月 10 日」
    const mmdd = d.slice(5);
    const [, , mon, dom] = d.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
    const cn = mon && dom ? `${Number(mon)} 月 ${Number(dom)} 日` : '';
    const pats = [d, mmdd, cn].filter(Boolean);
    // 中文写法的空格不一定规范（「11月10日」「11 月 10 日」都有人写），
    // 所以先跟一个把空白全去掉的版本比，再跟原文比。
    const hasCn = cn !== '' && md.replace(/\s+/g, '').includes(cn.replace(/\s+/g, ''));
    feelingsToday =
      hasCn ||
      pats.some((p) => new RegExp(`^#{1,6}\\s*[^\\n]*${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm').test(md));
  } catch {
    // 没写就是没写，不是错
  }

  // ── 一句话的判断 ──
  //
  // 不打分。分数会让我开始为分数过日子，而镜子不是用来打分的。
  // 只说三句具体的话：他留下了几句原话、我记了几段经过、账上有几件是陈的。
  const remarks = [];
  if (todaysNotes.length === 0 && diary.length === 0) {
    remarks.push('今天还没留下什么痕迹。');
  } else {
    if (todaysNotes.length > 0) remarks.push(`他今天说了 ${todaysNotes.length} 句我记下来的话。`);
    if (diary.length > 0) {
      const kinds = new Map();
      for (const e of diary) {
        const k = String(e?.kind ?? '').trim();
        if (k) kinds.set(k, (kinds.get(k) ?? 0) + 1);
      }
      const kindText = kinds.size ? `（${[...kinds.entries()].map(([k, n]) => `${k} ${n}`).join('、')}）` : '';
      remarks.push(`我记住了 ${diary.length} 段经过${kindText}。`);
    }
    if (stale.length > 0) remarks.push(`账上有 ${stale.length} 件陈了 ${STALE_DAYS} 天以上。`);
    if (!feelingsToday) remarks.push('今天还没往鱼的日子里写一笔。');
  }

  return {
    version: MIRROR_VERSION,
    date,
    start,
    end,
    chats: diary.length + todaysNotes.length,
    diary: diary.length,
    notes: todaysNotes,
    loops: { addedToday: addedToday.length, stale },
    feelingsToday,
    busy: busyHints(diary),
    remarks,
    empty: todaysNotes.length === 0 && diary.length === 0,
  };
}

/** 把横切面写成一小节 markdown —— 给人（和他）看的。 */
export function renderMirror(mirror) {
  if (!mirror || typeof mirror !== 'object') return '';
  const date = String(mirror.date ?? '');
  const lines = [`## ${date} · 镜子里`];

  if (mirror.empty) {
    lines.push('- 今天还没留下什么痕迹。');
    return lines.join('\n');
  }

  if (Array.isArray(mirror.notes) && mirror.notes.length) {
    lines.push('', '**他今天说的**');
    for (const n of mirror.notes) {
      const t = n.time ? `${n.time} ` : '';
      lines.push(`- ${t}「${n.said}」${n.did ? ` — 我 ${n.did}` : ''}`);
    }
  }

  if (mirror.busy?.length) {
    lines.push('', '**我忙在**', `- ${mirror.busy.map((b) => `${b.word}×${b.times}`).join('、')}`);
  }

  const stale = mirror.loops?.stale ?? [];
  if (stale.length) {
    lines.push('', '**陈了的**');
    for (const s of stale) lines.push(`- ${s.text}（${s.days} 天没动）`);
  }

  if (Array.isArray(mirror.remarks) && mirror.remarks.length) {
    lines.push('', ...mirror.remarks.map((r) => `- ${r}`));
  }
  return lines.join('\n');
}

/**
 * 「还挂着的事」里给每条标一句「上次提是几天前 / 陈了」。
 *
 * ─────────────────────────────────────────────────────────────
 * 这是小闹钟那一半，**故意做得极小**：
 *
 *   · 只加后缀，不加行 —— 账本还是那几行，不会变成第二个待办清单
 *   · 只对陈了的说话（≥ STALE_DAYS），新记的不嚷嚷
 *   · 不催他，只让我自己知道我该回头问了
 *
 * 跟 loop 唯一的分工：loop 管「有这么件事」，这里管「这件事还新不新」。
 *
 * @param {object[]} items   openLoops 的结果
 * @param {number} [now]
 * @param {number} [staleDays] 几天算陈；0 = 不标（配置项 staleLoopDays）
 * @returns {object[]} 带 suffix 的浅拷贝
 */
export function annotateLoops(items, now = Date.now(), staleDays = STALE_DAYS) {
  const threshold = Number.isFinite(staleDays) && staleDays > 0 ? staleDays : 0;
  return (Array.isArray(items) ? items : []).map((x) => {
    const at = Number(x?.createdAt ?? x?.created_at) || 0;
    if (!at) return { ...x, suffix: '' };
    const days = Math.round((dayStart(now) - dayStart(at)) / 86400000);
    let suffix = '';
    if (threshold > 0 && days >= threshold) suffix = `（记下 ${days} 天了，还挂着）`;
    return { ...x, ageDays: days, suffix };
  });
}
