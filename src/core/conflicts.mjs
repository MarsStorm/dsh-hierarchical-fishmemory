/**
 * 层与层之间打架的两件事：**同一句写了两遍**，和**同一样东西写了两个值**。
 *
 * 为什么单独做这一层：四本账各有各的读写者，谁都不知道别人写了什么。
 * core 里写着「端口 3080」，浅层里记着「端口改到 3095」——两句话单看都对，
 * 一起进注入就是自相矛盾。同样的道理，「白饭」这种事写进 core 又抄进手记，
 * 每轮注入两遍，改了一份漏一份。
 *
 * 这里只**报告**，不改任何东西。删哪份、留哪份，得由写它的人判断。
 */

const BULLET = /^[-*+]\s+/;

/** 去掉列表符号、压空白、统一标点，用于"是不是同一句"的比较。 */
export function normalizeLine(line) {
  return String(line ?? '')
    .trim()
    .replace(BULLET, '')
    .replace(/[。；;，,、]+$/u, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * 找出同一句话出现在不止一层里的情况。
 *
 * 只比 ≥12 字的长句 —— 短句（「好」「记下了」）撞上很正常，报了是噪音。
 */
export function findDuplicates(layers, { minChars = 12 } = {}) {
  const seen = new Map();
  const hits = [];
  for (const layer of layers ?? []) {
    for (const raw of layer?.lines ?? []) {
      const text = normalizeLine(raw);
      if ([...text].length < minChars) continue;
      const prev = seen.get(text);
      if (prev === undefined) {
        seen.set(text, layer.name);
        continue;
      }
      hits.push({ text, first: prev, again: layer.name });
    }
  }
  return hits;
}

/** 一句话里能当"同一个主体"的锚：路径、版本号、端口这类带值的短标签。 */
const PAIRS = [
  { kind: 'port', re: /(端口|port)[^\d]{0,6}?(\d{2,5})/iu },
  { kind: 'version', re: /(?:版本|version|v)\s*(?:是|为|升到|:|：|=)?\s*v?(\d+\.\d+(?:\.\d+)?)/iu },
  { kind: 'path', re: /((?:~|\/)[\w./-]{3,})/u },
];

/**
 * 同一主体、不同取值。举例：
 *   core   端口 3080
 *   shallow 端口 3095      → 一条 port 冲突
 *
 * 只在**取值确实不同**时报。同一个值出现两次不算冲突（那是重复，上面管）。
 */
export function findValueConflicts(layers) {
  const facts = [];
  for (const layer of layers ?? []) {
    for (const raw of layer?.lines ?? []) {
      for (const { kind, re } of PAIRS) {
        const m = re.exec(String(raw ?? ''));
        if (!m) continue;
        const value = m[2] ?? m[1];
        facts.push({ kind, value: String(value), layer: layer.name, line: normalizeLine(raw) });
      }
    }
  }
  const out = [];
  const byKind = new Map();
  for (const fact of facts) {
    if (!byKind.has(fact.kind)) byKind.set(fact.kind, []);
    byKind.get(fact.kind).push(fact);
  }
  for (const [kind, list] of byKind) {
    if (kind === 'path') continue; // 路径不同是正常的，不报
    const values = [...new Set(list.map((f) => f.value))];
    if (values.length > 1) {
      out.push({ kind, values, lines: list.map((f) => ({ layer: f.layer, value: f.value, line: f.line })) });
    }
  }
  return out;
}

/** 一次算完，给工具和体检页用。 */
export function checkLayers({ core = '', topics = {}, handnote = '', shallow = [], feelings = '' } = {}) {
  const splitLines = (text) => String(text ?? '').split('\n');
  const layers = [
    { name: '深层 core', lines: splitLines(core) },
    { name: '人格手记', lines: splitLines(handnote) },
    { name: '情感日记', lines: splitLines(feelings) },
    { name: '浅层', lines: (shallow ?? []).map((e) => e?.text ?? '') },
  ];
  for (const [key, text] of Object.entries(topics ?? {})) {
    layers.push({ name: `深层 ${key}`, lines: splitLines(text) });
  }
  const duplicates = findDuplicates(layers);
  const conflicts = findValueConflicts(layers);
  return {
    checked: layers.reduce((n, l) => n + l.lines.filter((x) => normalizeLine(x) !== '').length, 0),
    duplicates,
    conflicts,
  };
}
