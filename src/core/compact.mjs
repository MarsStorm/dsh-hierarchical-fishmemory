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
export const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_OLDER_THAN_DAYS = 45;

const KIND_LABEL = {
  failure: '搞砸了',
  win: '干得不错',
  chat: '闲聊',
  disclosure: '他说了点自己的事',
  grievance: '他不高兴了',
  note: '我自己写的',
};

export function entryTime(entry) {
  const raw = String(entry?.at ?? entry?.date ?? '');
  if (!raw) return 0;
  const iso = raw.length === 10 ? `${raw}T00:00:00Z` : raw;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

export function monthKeyOf(entry) {
  const t = entryTime(entry);
  if (!t) return '';
  return new Date(t).toISOString().slice(0, 7);
}

/** 选出该折的条目：早于 cutoff、且自己不是摘要。 */
export function pickCompactionCandidates(entries, options = {}) {
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const days = Number.isFinite(options.olderThanDays) ? options.olderThanDays : DEFAULT_OLDER_THAN_DAYS;
  const cutoff = now - days * DAY_MS;
  return (entries ?? []).filter((e) => {
    if (!e || e.compacted) return false;
    const t = entryTime(e);
    return t > 0 && t < cutoff;
  });
}

/** 一条摘要，压得比原始条目短，但别丢掉「几件事、什么事、有没有坏事」。 */
export function digestForMonth(monthKey, entries, options = {}) {
  const list = entries ?? [];
  const counts = new Map();
  const words = new Map();
  for (const e of list) {
    const kind = String(e?.kind ?? 'chat');
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
    for (const k of Array.isArray(e?.keywords) ? e.keywords : []) {
      const key = String(k).trim();
      if (key) words.set(key, (words.get(key) ?? 0) + 1);
    }
  }
  const kinds = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([kind, n]) => `${KIND_LABEL[kind] ?? kind} ${n}`)
    .join('、');
  const top = [...words.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, Number.isFinite(options.maxWords) ? options.maxWords : 5)
    .map(([w]) => w);
  const range = list
    .map((e) => String(e?.date ?? '').slice(8, 10))
    .filter(Boolean)
    .sort();
  const span = range.length ? `${range[0]}–${range[range.length - 1]} 日` : '';
  const head = `${monthKey} 共 ${list.length} 件${span ? `（${span}）` : ''}`;
  const detail = [kinds && `类型：${kinds}`, top.length ? `关键词：${top.join('、')}` : '']
    .filter(Boolean)
    .join('；');
  return {
    id: `d_${monthKey.replace('-', '')}_digest`,
    date: `${monthKey}-01`,
    text: `${head}${detail ? `。${detail}` : ''}。原文在 diary/archive/，要看细节去那儿找。`,
    tags: ['摘要'],
    kind: 'note',
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
  const keep = (entries ?? []).filter((e) => !movedIds.has(e?.id));
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
  return [...(plan?.keep ?? []), ...digests].sort((a, b) => entryTime(a) - entryTime(b));
}
