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

/**
 * 不参与比较的行：markdown 表格的分隔行、代码围栏、纯符号。
 *
 * 2026-11-17 加。真实档案里 `| --- | --- |` 出现了十几次，全被当成"同一句写了
 * 两遍"报出来 —— 一个报得太多的检查，等于没有检查。
 */
const NOISE_LINE = /^\s*(?:\|?[\s:|-]*-{3,}[\s:|-]*\|?|```.*|~~~.*)$/u;

function isNoiseLine(raw) {
  const text = String(raw ?? '').trim();
  if (text === '') return true;
  if (NOISE_LINE.test(text)) return true;
  return !/[\p{L}\p{N}]/u.test(text);
}

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
      if (isNoiseLine(raw)) continue;
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

/**
 * 一句话里能当"同一个主体"的锚：版本号、端口这类带值的短标签。
 *
 * **主语是必填的**（2026-11-17 改）。原来不要主语，于是 env-ops 里
 * 「GitHub SSH 端口 2026」「临时实例 端口 3099」「备份 端口 48888」
 * 被算成"端口打架"，版本号那边更糟：插件 1.9.9、DSHBox 1.5.4、node 4.1
 * 全被塞进同一条"version 打架"里。**不同东西的取值当然不同。**
 *
 * 现在按「主语 + 类别」分组：主语不同就各算各的。代价是单纯一句
 * 「端口 3080」（没有主语）不再参与比较 —— 宁可不报，也不要报一堆
 * 让人学会无视的假冲突。
 */
const PAIRS = [
  {
    kind: 'port',
    re: /([\p{Script=Han}]{2,8}|[A-Za-z][\w-]{1,15})\s*(?:的)?\s*(?:端口|port)[^\d]{0,6}?(\d{2,5})/iu,
    subject: 1,
    value: 2,
  },
  {
    kind: 'version',
    re: /([\p{Script=Han}]{2,10}|[A-Za-z][\w.-]{1,20})\s*(?:的)?\s*(?:版本号|版本|version)[^\d]{0,8}?v?(\d+\.\d+(?:\.\d+)*)/iu,
    subject: 1,
    value: 2,
  },
  { kind: 'path', re: /((?:~|\/)[\w./-]{3,})/u, subject: 0, value: 1 },
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
      if (isNoiseLine(raw)) continue;
      const flat = normalizeLine(raw);
      for (const { kind, re, subject, value } of PAIRS) {
        const m = re.exec(String(raw ?? ''));
        if (!m) continue;
        // 没主语的不参与比较：那正是"端口 2026 vs 3099"这类假冲突的来源。
        const who = String(m[subject] ?? '').trim().toLowerCase();
        if (kind !== 'path' && who === '') continue;
        facts.push({ kind, who, value: String(m[value]), layer: layer.name, line: flat });
      }
    }
  }
  const out = [];
  const byKey = new Map();
  for (const fact of facts) {
    const key = `${fact.kind}::${fact.who}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(fact);
  }
  for (const [key, list] of byKey) {
    const kind = list[0].kind;
    if (kind === 'path') continue; // 路径不同是正常的，不报
    const values = [...new Set(list.map((f) => f.value))];
    if (values.length > 1) {
      out.push({
        kind,
        subject: list[0].who,
        values,
        lines: list.map((f) => ({ layer: f.layer, value: f.value, line: f.line })),
      });
    }
  }
  return out;
}

/**
 * 层间体检只剩一份拼装逻辑：`stats.collectLayerReport`。
 *
 * 2026-11-17 删掉这里原来的 `checkLayers`。它和 `collectLayerReport` 算的是
 * 同一件事，但拼的层不一样（它不认 sticky/lesson/pending）、对冲突的过滤也
 * 不一样（它把"不同文件各写各的版本号"这种正常现象也报出来）。结果是同一个
 * 档案，面板说"没打架"、`fish_layer_check` 说"有 3 处打架" —— 两个都是我，
 * 谁对？这种问题不该靠读者猜。
 *
 * 这个文件现在只留两样纯函数：认重复、认取值打架。拼层是调用方的事。
 */
