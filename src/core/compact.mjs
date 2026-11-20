/**
 * 共度时光的「压缩」：把很久以前的条目折成月度摘要。
 *
 * 2026-11-02 加。问题很具体：条目只增不减，三个月后召回池里大半是老事，
 * 噪声越来越大。这里按**月**折叠：原文归档到 diary/archive/，注入池里只留
 * 一条摘要（几条、都涉及什么、有没有搞砸的）。
 *
 * 为什么不用模型来写摘要：要花钱、要等、还可能编。规则摘要难看但不会说谎，
 * 真要细看，原文还在 archive 里。
 */
import { DIGEST_KIND, KIND_LABEL } from './kinds.mjs';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_OLDER_THAN_DAYS = 45;

/**
 * 条目落在哪个月的依据（毫秒）。
 *
 * 2026-11-17 改名：原来也叫 `entryTime`，但语义和 `timeline.entryTime`
 * **不一样** —— 这里只关心"哪个月"，所以 `date` 字段一律补 UTC 零点；
 * 那个函数关心"什么时候"，补的是他那边的中午。同一个名字两种尺子，
 * 迟早有人把一处当另一处用。名字分开，脚就不会踩错。
 */
export function entryStamp(entry) {
  const raw = String(entry?.at ?? entry?.date ?? '');
  if (!raw) return 0;
  const iso = raw.length === 10 ? `${raw}T00:00:00Z` : raw;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

export function monthKeyOf(entry) {
  const t = entryStamp(entry);
  if (!t) return '';
  return new Date(t).toISOString().slice(0, 7);
}

/**
 * 选出该折的条目：整个月都早于 cutoff、且自己不是摘要、且该月还没折过。
 *
 * 两条都是 1.39.0 补的，各自对应一个真实会发生的坏结果：
 *
 * ① **整月对齐。** 以前按"45 天前的那个毫秒"切，而分组是按月 ——
 *    cutoff 落在 10 月 5 号时，10 月 1–5 号被折进摘要、6–31 号留在档案里，
 *    同一个十月在档案里出现两次，摘要上的「共 N 件」也不是整月数。
 *    现在只折**当月还没开始**的月份：要么整月折，要么整月不动。
 * ② **该月折过就不再折。** 摘要 id 是固定的 `d_<年月>_digest`。同一个月折两次
 *    会生成两条同 id 的条目，而召回索引、`lastShownTurn`、`applySummaries`
 *    全按 id 建 Map —— 两条同 id 会互相覆盖。
 */
export function pickCompactionCandidates(entries, options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const days = Number.isFinite(options.olderThanDays) ? options.olderThanDays : DEFAULT_OLDER_THAN_DAYS;
  const cutoff = now - days * DAY_MS;
  const cutoffMonth = new Date(cutoff).toISOString().slice(0, 7);
  const covered = new Set();
  for (const e of entries ?? []) {
    if (e && e.compacted) {
      const m = monthKeyOf(e);
      if (m) covered.add(m);
    }
  }
  return (entries ?? []).filter((e) => {
    if (!e || e.compacted) return false;
    const t = entryStamp(e);
    if (!(t > 0)) return false;
    const m = monthKeyOf(e);
    if (!m) return false;
    if (m >= cutoffMonth) return false;
    if (covered.has(m)) return false;
    return true;
  });
}

/** 一条摘要，压得比原始条目短，但别丢掉「几件事、什么事、有没有坏事」。 */
export function digestForMonth(monthKey, entries, options = {}) {
  const list = entries ?? [];
  const counts = new Map();
  for (const e of list) {
    const kind = String(e?.kind ?? 'chat');
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const kinds = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([kind, n]) => `${KIND_LABEL[kind] ?? kind} ${n}`)
    .join('、');
  // 这里原来统计 `e.keywords` —— 而那个字段 2026-10-27 就没人写了，
  // 于是每份摘要的「关键词：」都是空的。现在换成"那阵子的几句话"：
  // 摘要得有点真内容，召回才搜得中它，否则一条摘要只剩"共 N 件"。
  const highlights = [...list]
    .sort((a, b) => (Number(b?.salience) || 0) - (Number(a?.salience) || 0))
    .map((e) => String(e?.summary || e?.text || '').trim().replace(/\s+/g, ' ').slice(0, 42))
    .filter(Boolean)
    .slice(0, 3);
  const range = list
    .map((e) => String(e?.date ?? '').slice(8, 10))
    .filter(Boolean)
    .sort();
  const span = range.length ? `${range[0]}–${range[range.length - 1]} 日` : '';
  const head = `${monthKey} 共 ${list.length} 件${span ? `（${span}）` : ''}`;
  const detail = [
    kinds && `类型：${kinds}`,
    highlights.length ? `那阵子：${highlights.join(' / ')}` : '',
  ].filter(Boolean).join('；');
  return {
    id: `d_${monthKey.replace('-', '')}_digest`,
    date: `${monthKey}-01`,
    text: `${head}${detail ? `。${detail}` : ''}。原文在 diary/archive/，要看细节去那儿找。`,
    tags: ['摘要'],
    kind: DIGEST_KIND,
    salience: 0.35,
    compacted: true,
    covers: list.length,
    created_at: Date.now(),
  };
}

/** 纯计算：分组 + 生成摘要 + 给出保留列表。不碰磁盘。 */
export function planCompaction(entries, options = {}) {
  const candidates = pickCompactionCandidates(entries, options);
  const groups = new Map();
  for (const e of candidates) {
    const key = monthKeyOf(e);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  // 单条也照折：留着它除了占一行没有别的意义。
  const digests = [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, list]) => ({ monthKey: key, digest: digestForMonth(key, list), entries: list }));
  const movedIds = new Set(candidates.map((e) => e?.id).filter(Boolean));
  // 按**对象**记谁被移走，不按 id。以前是无 id 的条目会被 `filter(Boolean)`
  // 从 movedIds 里丢掉，于是它既算进了摘要、又原样留在 keep 里（`movedCount` 还少算一条）。
  const movedSet = new Set(candidates);
  const keep = (entries ?? []).filter((e) => !movedSet.has(e));
  return {
    cutoff: (Number.isFinite(options.now) ? options.now : Date.now()) -
      (Number.isFinite(options.olderThanDays) ? options.olderThanDays : DEFAULT_OLDER_THAN_DAYS) * DAY_MS,
    groups: digests,
    movedCount: movedIds.size,
    keep,
  };
}

/** 按 plan 组出「归档后」的条目数组：保留的 + 每条月度摘要。 */
export function applyCompaction(plan) {
  const digests = (plan?.groups ?? []).map((g) => g.digest);
  return [...(plan?.keep ?? []), ...digests].sort((a, b) => entryStamp(a) - entryStamp(b));
}
