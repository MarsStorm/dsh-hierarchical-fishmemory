// 把四本账导出成一册 Markdown。
//
// 为什么要有这个：整包备份是 JSON —— 救的是「搬家时数据别丢」，不是「给人读」。
// 哪天想打印、想贴给谁看、想在没有本机的设备上翻，JSON 都帮不上忙。
// 这里只做渲染，不碰存储，输入就是 collectBackup() 产出的那个对象。

const pad = (n) => String(n).padStart(2, '0');

function stamp(iso) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function section(title, body) {
  const text = String(body ?? '').trim();
  if (!text) return '';
  return `## ${title}\n\n${text}\n`;
}

function cardsSection(persona) {
  const cards = persona?.cards ?? {};
  const active = persona?.active ?? '';
  const names = Object.keys(cards);
  if (!names.length) return '';
  const parts = names.map((name) => {
    const mark = name === active ? '（当前）' : '';
    return `### 人设卡 · ${name}${mark}\n\n${String(cards[name] ?? '').trim()}\n`;
  });
  return `## 人设卡\n\n${parts.join('\n')}`;
}

function memorySection(deep) {
  const scopes = deep ?? {};
  const names = Object.keys(scopes);
  if (!names.length) return '';
  const parts = [];
  for (const scope of names) {
    const item = scopes[scope] ?? {};
    const core = String(item.core ?? '').trim();
    if (core) parts.push(`### ${scope} · core\n\n${core}\n`);
    // topics 是 { key: 正文 } 的对象（readLayeredScope 只给描述，正文单独读）；
    // 也接受 [{ key, text }] 这种形态，方便调用方直接传。
    const topics = Array.isArray(item.topics)
      ? item.topics.map((t) => [t?.key, t?.text])
      : Object.entries(item.topics ?? {});
    for (const [key, text] of topics) {
      const body = String(text ?? '').trim();
      if (body) parts.push(`### ${scope} · topic：${key}\n\n${body}\n`);
    }
  }
  if (!parts.length) return '';
  return `## 深层记忆\n\n${parts.join('\n')}`;
}

function parseJsonl(files) {
  const out = [];
  // 真实备份里是 { 文件名: 整段 jsonl 文本 }；也接受已经是对象数组的形态
  if (Array.isArray(files)) {
    return files.filter((item) => item && typeof item === 'object');
  }
  for (const text of Object.values(files ?? {})) {
    for (const line of String(text ?? '').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const item = JSON.parse(trimmed);
        if (item && typeof item === 'object') out.push(item);
      } catch {
        // 坏行跳过：一册能读的东西，不该被一行垃圾毁掉
      }
    }
  }
  return out;
}

function diarySection(diary) {
  const entries = parseJsonl(diary?.jsonl);
  if (entries.length) {
    const sorted = entries.slice().sort((a, b) => String(a?.at ?? a?.date ?? '').localeCompare(String(b?.at ?? b?.date ?? '')));
    const lines = sorted.map((e) => {
      const when = String(e?.date ?? e?.at ?? '').slice(0, 10);
      const kind = e?.kind ? `（${e.kind}）` : '';
      return `- **${when}**${kind} ${String(e?.text ?? '').trim()}`;
    });
    return `## 共度时光\n\n${lines.join('\n')}\n`;
  }
  const rendered = String(diary?.rendered ?? '').trim();
  return rendered ? `## 共度时光\n\n${rendered}\n` : '';
}


function shallowSection(shallow) {
  // 备份里是 { version, entries: [...] }；也接受已经是现成文本的形态
  if (typeof shallow === 'string') return section('浅层记忆', shallow);
  const entries = Array.isArray(shallow?.entries) ? shallow.entries : [];
  if (!entries.length) return '';
  const lines = entries.map((e) => {
    const key = e?.key ? `[${e.key}] ` : '';
    return `- ${key}${String(e?.text ?? '').trim()}`;
  });
  return `## 浅层记忆\n\n${lines.join('\n')}\n`;
}

/**
 * @param {object} backup collectBackup() 的结果（persona / deep / diary / feelings / handnote / shallow / meta）
 * @param {object} [opts] { now }
 * @returns {string} 一整册 Markdown
 */
export function buildBook(backup, { now = new Date() } = {}) {
  const meta = backup?.meta ?? {};
  const head = [
    '# 属于我们的回忆',
    '',
    `> 导出于 ${stamp(now.toISOString())} · 插件 ${meta.pluginVersion || '未知版本'}`,
    '> 这本册子是从四本账里誊出来的，改它不会影响记忆本身。',
    '',
  ].join('\n');

  const body = [
    cardsSection(backup?.persona),
    memorySection(backup?.deep),
    diarySection(backup?.diary),
    section('情感日记', backup?.feelings),
    section('人格手记', backup?.handnote),
    shallowSection(backup?.shallow),
  ]
    .filter(Boolean)
    .join('\n');

  return `${head}\n${body}\n`;
}

/* ───────────────────────── 年册 ───────────────────────── */

/** 从备份里捞出某一年的共度时光（按 date/at 的前四位判年）。 */
function entriesOfYear(entries, year) {
  return entries.filter((e) => String(e?.date ?? e?.at ?? '').slice(0, 4) === year);
}

/** 把情感日记按 `## YYYY-MM-DD` 切成节，只留这一年。 */
function feelingsOfYear(text, year) {
  const body = String(text ?? '');
  const lines = body.split('\n');
  const sections = [];
  let current = null;
  for (const line of lines) {
    const m = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/.exec(line);
    if (m) {
      if (current) sections.push(current);
      current = m[1].startsWith(year) ? { day: m[1], lines: [] } : null;
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) sections.push(current);
  return sections
    .map((s) => `### ${s.day}\n\n${s.lines.join('\n').trim()}`)
    .filter((s) => s.trim() !== `###`);
}

/**
 * 一年的册子：共度时光按月聚起来，情感日记按天排。
 * @param {object} backup collectBackup() 的结果
 * @param {{year?:string|number}} [opts]
 */
export function buildYearBook(backup, { year } = {}) {
  const y = String(year || new Date().getUTCFullYear());
  const entries = entriesOfYear(parseJsonl(backup?.diary?.jsonl), y).sort((a, b) =>
    String(a?.date ?? a?.at ?? '').localeCompare(String(b?.date ?? b?.at ?? '')),
  );

  const byMonth = new Map();
  for (const e of entries) {
    const day = String(e?.date ?? e?.at ?? '').slice(0, 10);
    const month = day.slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month).push({ day, text: String(e?.text ?? '').trim(), kind: e?.kind });
  }

  const months = [...byMonth.keys()].sort().map((month) => {
    const items = byMonth.get(month).map((e) => {
      const kind = e.kind ? `（${e.kind}）` : '';
      return `- **${e.day.slice(5)}**${kind} ${e.text}`;
    });
    return `## ${month}\n\n${items.join('\n')}`;
  });

  const feelings = feelingsOfYear(backup?.feelings, y);

  const head = [
    `# 属于我们的回忆 · ${y} 年`,
    '',
    `> 这一年记下 ${entries.length} 条共度时光、${feelings.length} 天情感日记。`,
    '> 从四本账里誊出来的，改它不会影响记忆本身。',
    '',
  ].join('\n');

  const parts = [];
  if (months.length) parts.push(months.join('\n\n'));
  else parts.push('## 共度时光\n\n（这一年还没有条目）');
  if (feelings.length) parts.push(`## 情感日记\n\n${feelings.join('\n\n')}`);

  return `${head}\n${parts.join('\n\n')}\n`;
}
