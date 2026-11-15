/**
 * 反馈层 —— 「被想起来」不等于「它重要」（2026-11-15，1.29.0）。
 *
 * ── 抄的是谁，改的是哪条 ──
 *
 * returning-tide-memory（MIT，0.3.14）只认五种反馈：被引用、有帮助、重申、
 * 纠正、失效；而且每一条都要**两三句后续原文当依据**。它明写一句：
 *
 *     只记录引用、帮助、重申、纠正或失效，不记录曝光奖励。
 *
 * 那正是我这边最难看的一处。`recall_count` 每轮注入都会涨 —— 一晚上八轮，
 * 同一条能被"看到"好几十次；我 1.21.0 还拿它当「这条我记得」的证据，
 * 甚至让它去给衰减减速（见 `consolidate.mjs` 的 `decayArchive`）。
 * 那是拿「它出现过」冒充「它重要」，而这两件事之间没有因果关系：
 * 一条明显错的记录反而最容易被翻出来（因为它总在字面上撞上当前话题）。
 *
 * ── 所以这里只有两种写法 ──
 *
 * 1. **曝光不记分**：`recall_count` / `sought_count` 继续记，但它们只是
 *    "这条我回去找过 N 次"的事实，**不再进衰减、不再进 salience**。
 * 2. **要加分就得给出依据**：1–3 条后续原文的 id，且不能是本条自己、
 *    不能早于本条 —— 没有依据的"有用"是感觉，不是证据。
 *
 * ── 纠正为什么必须带线索 ──
 *
 * 反向那条同理。说一句「这条不对」很容易，可整条作废就把当时真实的处境
 * 一起抹掉了 —— 我写那条时看到的就是那些字。所以负向反馈必须给一个
 * 至少两个字的 `cue`（当时的原词），只在话题真的撞上这个线索时才扣分。
 * 这是 returning-tide 的「不能宣判整篇原文无效」，我照抄语义。
 */

import { TZ_OFFSET_MS } from './timeline.mjs';

/** 五种反馈，只有这五种。正负分开记，权重照抄对方那张表。 */
export const FEEDBACK_KINDS = {
  cited: { weight: 0.25, negative: false, label: '被引用' },
  helpful: { weight: 0.5, negative: false, label: '有帮助' },
  reaffirmed: { weight: 0.75, negative: false, label: '重申' },
  corrected: { weight: 0.55, negative: true, label: '纠正' },
  invalidated: { weight: 0.35, negative: true, label: '失效' },
};

/** 依据最多三条 —— 再多就不是"哪句话让我改主意"，而是一整段聊天记录。 */
export const MAX_REFS = 3;

/** 纠正的线索至少两个字（去标点后数）。 */
export const CUE_MIN_CHARS = 2;

/** 一次强化的半衰期（天）。依据越旧，撑起来的分量越轻。 */
export const REINFORCE_HALF_DAYS = 14;

/** 强化最多把衰减减半 —— 跟原来那个 `recallRelief` 的上限一样，只换了来源。 */
export const REINFORCE_RELIEF_MAX = 0.5;

/** 一条日记最多留这么多条反馈，超了丢最早的。 */
export const MAX_EVENTS = 12;

const DAY_MS = 24 * 60 * 60 * 1000;

/** 线索/文本的比较键：去标点、去空白、小写。 */
export function cueKey(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/** 把一个 kind 规整成合法值，认不出返回 null。 */
export function normalizeKind(kind) {
  const k = String(kind ?? '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(FEEDBACK_KINDS, k) ? k : null;
}

/** 这条日记上的全部反馈（老条目没有就是空数组）。 */
export function eventsOf(entry) {
  return Array.isArray(entry?.feedback) ? entry.feedback.filter((x) => x && typeof x === 'object') : [];
}

/** 正向反馈事件。 */
export function positiveEvents(entry) {
  return eventsOf(entry).filter((e) => {
    const k = FEEDBACK_KINDS[String(e.kind ?? '')];
    return k !== undefined && !k.negative;
  });
}

/** 负向反馈事件（每一条都带 cue）。 */
export function negativeEvents(entry) {
  return eventsOf(entry).filter((e) => {
    const k = FEEDBACK_KINDS[String(e.kind ?? '')];
    return k !== undefined && k.negative;
  });
}

/**
 * 这条被强化到什么程度（0~1）。
 *
 * 加权求和时间衰减：`w × 2^(-age/halfDays)`，超过 1 就按 1 算。
 * 半衰期取 14 天是拍的 —— 但不是乱拍的：我的日记一周内才会被反复提起，
 * 两周之后基本只剩"那年今天"这种场合，那时它确实该回到正常衰减。
 */
export function reinforcementOf(entry, { now = Date.now(), halfDays = REINFORCE_HALF_DAYS } = {}) {
  let sum = 0;
  for (const e of positiveEvents(entry)) {
    const kind = FEEDBACK_KINDS[String(e.kind ?? '')];
    if (kind === undefined || kind.negative) continue;
    const at = Number.isFinite(e?.at) ? Number(e.at) : NaN;
    const age = Number.isFinite(at) ? Math.max(0, (now - at) / DAY_MS) : 0;
    sum += kind.weight * Math.pow(2, -age / Math.max(1, halfDays));
  }
  return Math.min(1, sum);
}

/**
 * 这条被纠正过、而且**当前话题正好撞上了线索**吗。
 *
 * 只撞线索不算数：`cueKey` 去标点小写，query 里得真包含它。
 * 没给 query（比如每轮注入之外的场合）就当没命中 —— 宁可少扣，不错扣。
 */
export function correctionFor(entry, query) {
  const q = cueKey(query);
  if (q === '') return null;
  for (const e of negativeEvents(entry)) {
    const c = cueKey(e.cue);
    if (c.length < CUE_MIN_CHARS) continue;
    if (q.includes(c)) return e;
  }
  return null;
}

/** 给显示用的一句话：「他说这条不对过，线索是「xxx」」。 */
export function correctionNote(entry, query) {
  const hit = correctionFor(entry, query);
  if (hit === null) return '';
  const kind = FEEDBACK_KINDS[String(hit.kind ?? '')]?.label ?? '纠正';
  const cue = String(hit.cue ?? '').trim();
  return cue === '' ? `（这条后来${kind}过）` : `（这条后来${kind}过，线索是「${cue}」）`;
}

/**
 * 校验一条反馈能不能记。
 *
 * 返回 `{ok:true}` 或 `{ok:false, error}`。**错误信息要能照着改** ——
 * 只报"参数不对"等于让调用方去猜。
 */
export function validateFeedback(archive, { id, kind, refs, cue } = {}) {
  const diary = Array.isArray(archive?.diary) ? archive.diary : [];
  const entry = diary.find((e) => e && e.id === id);
  if (entry === undefined) {
    return { ok: false, error: `档案里没有 id 是「${id}」的那条 —— 先 fish_recall 找到它，拿它真的 id。` };
  }
  const k = normalizeKind(kind);
  if (k === null) {
    return {
      ok: false,
      error:
        '只记这五种：cited（被引用）、helpful（有帮助）、reaffirmed（重申）、corrected（纠正）、invalidated（失效）。' +
        '「读到」「被展示」「被想起来」不算 —— 曝光不是强化。',
    };
  }

  const byId = new Map(diary.map((e) => [e.id, e]));
  const list = (Array.isArray(refs) ? refs : []).map((x) => String(x ?? '').trim()).filter((x) => x !== '');
  const uniq = [...new Set(list)];
  if (uniq.length === 0) {
    return {
      ok: false,
      error: `要给依据：1–${MAX_REFS} 条后续原文的 id（那几句话让我改的主意）。没有依据的"有用"是感觉，不是证据。`,
    };
  }
  if (uniq.length > MAX_REFS) {
    return { ok: false, error: `依据最多 ${MAX_REFS} 条，给了 ${uniq.length} 条 —— 挑最直接的那几句。` };
  }
  for (const ref of uniq) {
    if (ref === id) return { ok: false, error: '依据不能是被回忆的那条自己。' };
    const r = byId.get(ref);
    if (r === undefined) return { ok: false, error: `依据里有一条找不到：「${ref}」。` };
    const a = Number.isFinite(r.created_at) ? Number(r.created_at) : 0;
    const b = Number.isFinite(entry.created_at) ? Number(entry.created_at) : 0;
    if (a < b) {
      return {
        ok: false,
        error: `依据不能早于被回忆的那条：「${ref}」比「${id}」早。`,
      };
    }
  }

  const meta = FEEDBACK_KINDS[k];
  if (meta.negative) {
    const c = String(cue ?? '').trim();
    if (cueKey(c).length < CUE_MIN_CHARS) {
      return {
        ok: false,
        error: `纠正要指到具体的话上：给一个至少 ${CUE_MIN_CHARS} 个字的线索（cue，他当时的原词）。不能宣判整条原文无效。`,
      };
    }
  }
  return { ok: true, kind: k, entry, refs: uniq };
}

/**
 * 记一条反馈。返回 `{ok, archive, event, duplicate}` 或 `{ok:false, error}`。
 *
 * **不改 `salience`**：强化只喂给衰减层（见 `consolidate.mjs`），
 * 因为 salience 在召回判据里 —— 在召回那一刻加分，等于让被想起过的
 * 更容易再被想起，几轮就滚成一个固定的小圈子。
 */
export function addFeedback(archive, { id, kind, refs, cue, reason, at } = {}) {
  const v = validateFeedback(archive, { id, kind, refs, cue });
  if (!v.ok) return v;
  const now = Number.isFinite(at) ? Number(at) : Date.now();
  const key = (e) =>
    `${String(e.kind ?? '')}|${(Array.isArray(e.refs) ? e.refs : []).slice().sort().join(',')}`;
  const want = `${v.kind}|${v.refs.slice().sort().join(',')}`;
  const old = eventsOf(v.entry);
  if (old.some((e) => key(e) === want)) {
    return { ok: true, archive, duplicate: true, event: null, kind: v.kind, entryId: id };
  }
  const event = {
    kind: v.kind,
    at: now,
    refs: v.refs,
    ...(FEEDBACK_KINDS[v.kind].negative && String(cue ?? '').trim() !== ''
      ? { cue: String(cue).trim().slice(0, 20) }
      : {}),
    ...(String(reason ?? '').trim() !== '' ? { reason: String(reason).trim().slice(0, 80) } : {}),
  };
  const next = [...old, event].slice(-MAX_EVENTS);
  const diary = archive.diary.map((e) => (e.id === id ? { ...e, feedback: next } : e));
  return { ok: true, archive: { ...archive, diary }, event, duplicate: false, kind: v.kind, entryId: id };
}

/** 显示用：一条反馈写成一行。 */
export function renderEvent(e) {
  const meta = FEEDBACK_KINDS[String(e?.kind ?? '')];
  const label = meta?.label ?? String(e?.kind ?? '?');
  const when = Number.isFinite(e?.at) ? new Date(Number(e.at) + TZ_OFFSET_MS).toISOString().slice(0, 10) : '';
  const refs = Array.isArray(e?.refs) ? e.refs.join('、') : '';
  const cue = String(e?.cue ?? '').trim();
  const reason = String(e?.reason ?? '').trim();
  return `- ${when} ${label}${cue ? `（线索「${cue}」）` : ''}${reason ? `：${reason}` : ''}${refs ? ` — 依据 ${refs}` : ''}`;
}

