/**
 * 小纸条 · 他说过的原话
 *
 * ─────────────────────────────────────────────────────────────
 * **为什么要有它**
 *
 * 共度时光那本日记是**过一遍模型**写出来的：把一整轮对话读进去，
 * 压成一段"发生了什么"。好处是干净，坏处是**原话会掉**。
 *
 * 他随口说的那句"其实那天我挺难受的"——固化的时候被压成了
 * "今天他提了聊这件事"，就没了。不是记错，是**转述**。
 *
 * 而他的原话恰恰是**最不该被转述的东西**：语气、停顿、那句忽然冒出来的
 * 话，压缩之后全没了。
 *
 * 所以这里另开一本：
 *   · 记的是**他自己打的字**，原样，最多两三百字
 *   · 附一行"我这一轮干了什么"，免得只看见一句没头没尾的话
 *   · 每轮都注入 —— 所以下一个我能听出他当时是怎么说的
 *
 * ─────────────────────────────────────────────────────────────
 * **存储：两个 markdown 文件，都不在 `archiveToFiles` 的写盘范围里**
 *
 *   纸条.md      活跃纸条（上限 200 行），面板「本子」里能翻能改
 *   纸条-旧档.md 溢出归档（只进不出），不注入
 *
 * 为什么用 markdown 而不是 json：他可能会自己打开改一行。跟手记一样 ——
 * 人能直接改的东西，才算真的属于他。
 *
 * 为什么不写进 `diary/*.jsonl`：那个目录每次写盘都会被整份覆盖，
 * 手写的追加条目**下一次写盘就没了**（手记.md 顶部注释里记着这个教训）。
 * 所以另起文件，不参与重建。
 *
 * ─────────────────────────────────────────────────────────────
 * **规矩**
 *
 *   · 每条最多：他说 200 字 + 我这轮 80 字
 *   · 注入：只给 30 天内的（可配），最多 8 条 / 800 字
 *   · 标 ★ 的纸条（他手动 pin 的）**永不过期、永不溢出**
 *   · 溢出（超过 200 行）不删 —— 挪进旧档，删了就是"永久没了"
 *
 * @module dsh-hierarchical-fishmemory/core/sticky
 */

import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { TZ_OFFSET_MS } from './timeline.mjs';

export const STICKY_FILE = '纸条.md';
export const STICKY_ARCHIVE_FILE = '纸条-旧档.md';
export const STICKY_SECTION = 'sticky:memory';
/** 晚于 shallow:memory(0.55)，早于 fish:memory(100)。 */
export const STICKY_ORDER = 0.6;

/** 活跃纸条行数上限（超出挪进旧档，不删）。 */
export const MAX_LINES = 200;
/** 单条"他说"的字数上限。 */
export const MAX_SAID_CHARS = 200;
/** 单条"我这轮"的字数上限。 */
export const MAX_DID_CHARS = 80;
/** 注入条数上限。 */
export const MAX_INJECT = 8;
/** 注入字符上限。 */
export const MAX_INJECT_CHARS = 800;
/** 默认保留天数（只影响注入，不影响文件里的内容）。 */
export const DEFAULT_TTL_DAYS = 30;

const FIELD_SEP = '｜'; // 全角竖线：正文里几乎不会有，出现概率比 '|' 低得多
const PIN_MARK = '★';

/** 一行纸条的形状：`- [★] 2026-11-09 00:53 ｜他说：… ｜我这轮：…` */
const LINE_RE = /^-\s*(★)?\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+｜他说：(.*?)(?:\s+｜我这轮：(.*))?\s*$/;

const now = () => Date.now();

/** 压成一行：换行会毁掉整个文件结构。 */
function oneLine(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * 正文里的字段分隔符必须清掉 —— 否则一行会被切成两半。
 * 竖线在中文正文里偶尔出现（"A | B"），所以换成普通竖线。
 */
function safe(text) {
  return oneLine(text).split(FIELD_SEP).join('|');
}

/** 他那边（UTC+8）的日期与时刻。 */
export function stamp(at = now()) {
  const d = new Date(at + TZ_OFFSET_MS);
  return {
    date: d.toISOString().slice(0, 10),
    time: d.toISOString().slice(11, 16),
  };
}

/**
 * 造一行纸条。
 *
 * @param {object} input
 * @param {string} input.said 他说的原话
 * @param {string} [input.did] 我这一轮干了什么（一句话）
 * @param {boolean} [input.pinned]
 * @param {number} [input.at]
 * @returns {string}
 */
export function renderNote({ said, did = '', pinned = false, at = now() } = {}) {
  const { date, time } = stamp(at);
  const body = safe(said).slice(0, MAX_SAID_CHARS);
  const tail = safe(did).slice(0, MAX_DID_CHARS);
  const head = pinned ? `${PIN_MARK} ` : '';
  return `- ${head}${date} ${time} ${FIELD_SEP}他说：${body}${tail ? ` ${FIELD_SEP}我这轮：${tail}` : ''}`;
}

/**
 * 解析文件里的纸条（从新到旧）。
 *
 * 认不出来的行**原样丢掉**，不猜、不修 —— 这个文件人也能手改，
 * 坏行不该让整个插件炸掉。
 *
 * @param {string} text
 * @returns {Array<{index:number, pinned:boolean, date:string, time:string, said:string, did:string, at:number, raw:string}>}
 */
export function parseNotes(text) {
  const out = [];
  const lines = String(text ?? '').split('\n');
  for (const raw of lines) {
    const m = LINE_RE.exec(raw.trim());
    if (!m) continue;
    const [, pin, date, time, said, did] = m;
    const at = Date.parse(`${date}T${time}:00+08:00`);
    out.push({
      index: out.length,
      pinned: Boolean(pin),
      date,
      time,
      said: String(said ?? '').trim(),
      did: String(did ?? '').trim(),
      at: Number.isFinite(at) ? at : 0,
      raw: raw.trim(),
    });
  }
  // 文件里**从上到下就是最新 → 最旧**（跟面板里读到的顺序一致）。
  return out;
}

/** 读文件；读不到当空。 */
export async function readNotes(file) {
  try {
    return parseNotes(await readFile(file, 'utf8'));
  } catch {
    return [];
  }
}

/**
 * 同步版读文件；读不到当空。
 *
 * 为什么需要同步版：`agent/turn-stopping` 是 serial 事件、会被 await，
 * 里面绝不能有 await。读纸条文件就一个 readFileSync的事。
 *
 * @param {string} file
 * @returns {Array}
 */
export function readNotesSync(file) {
  try {
    return parseNotes(readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

/**
 * 追加一条纸条。
 *
 * 写盘用"读 → 插入 → 原子替换"，不用 appendFile：
 * appendFile 在文件不存在时不建目录、也不保证跟面板写回不打架。
 *
 * **新的放最上面** —— 文件从上到下 = 新 → 旧，跟面板读到的顺序一致，
 * 人打开就能看到最新那几条。
 *
 * @param {string} file
 * @param {string} line  已经渲染好的一行
 * @returns {Promise<{file:string, lines:number, overflow:number}>}
 */
export async function appendNote(file, line) {
  const body = String(line ?? '').trim();
  if (body === '') return { file, lines: 0, overflow: 0 };
  let prev = '';
  try {
    prev = await readFile(file, 'utf8');
  } catch {
    prev = '';
  }
  const rest = prev === '' ? '' : prev.replace(/^\n+/, '');
  const merged = rest === '' ? `${body}\n` : `${body}\n${rest}\n`;
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, merged, 'utf8');
  await rename(tmp, file);
  const count = merged.split('\n').filter((l) => l.trim() !== '').length;
  return { file, lines: count, overflow: Math.max(0, count - MAX_LINES) };
}

/**
 * 溢出处理：把超出行数的**最旧**纸条挪进旧档（不删）。
 *
 * 按**原始行**处理，不按解析结果 —— 人手改过的、认不出来的行也得留着，
 * 不能因为解析不了就被当成垃圾清掉。
 *
 * 标 ★ 的行受保护：他钉过的就钉着，永远不挪走。
 *
 * @returns {Promise<number>} 挪走多少行
 */
export async function archiveOverflow(file, archiveFile = null, limit = MAX_LINES) {
  let raw = '';
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    return 0;
  }
  const lines = raw.split('\n').filter((l) => l.trim() !== '');
  if (lines.length <= limit) return 0;

  const protectedLines = lines.filter((l) => l.trimStart().startsWith(`- ${PIN_MARK}`));
  const movableIdx = lines
    .map((l, i) => (l.trimStart().startsWith(`- ${PIN_MARK}`) ? -1 : i))
    .filter((i) => i >= 0);
  // 文件从上到下是 新 → 旧，所以 movableIdx 的**末尾**才是最旧的 ——
  // 保留前 keepMovable 条（最新的），把剩下的（最旧的）挪走。
  const keepMovable = Math.max(0, limit - protectedLines.length);
  const dropIdx = new Set(movableIdx.slice(keepMovable));
  const overflow = [...dropIdx].sort((a, b) => a - b).map((i) => lines[i]);
  if (overflow.length === 0) return 0;
  const keep = lines.filter((_, i) => !dropIdx.has(i)); // 保持原顺序

  const keepText = `${keep.join('\n')}\n`;
  const tmp = `${file}.tmp`;
  await mkdir(dirname(file), { recursive: true });
  await writeFile(tmp, keepText, 'utf8');
  await rename(tmp, file);
  if (archiveFile) {
    const header = `\n<!-- 溢出归档：${overflow.length} 条（被 ${limit} 条上限挤出来的） -->\n`;
    const body = `${header}${overflow.join('\n')}\n`;
    await mkdir(dirname(archiveFile), { recursive: true });
    await appendFile(archiveFile, body, 'utf8');
  }
  return overflow.length;
}

/** 一条有多新（天）。 */
export function ageDays(note, at = now()) {
  if (!Number.isFinite(note?.at) || note.at === 0) return 0;
  return (at - note.at) / 86_400_000;
}

/**
 * 渲染注入段。
 *
 * 规则：标 ★ 的永远给；其余只给 TTL 内的，从新到旧，最多 MAX_INJECT 条、
 * MAX_INJECT_CHARS 字。一条都没有时返回空串（不注入任何东西）。
 *
 * @param {Array} notes
 * @param {{ttlDays?:number, maxInject?:number, maxChars?:number}} [config]
 * @returns {string}
 */
export function renderSection(notes, config = {}) {
  const ttl = Math.max(1, Math.min(365, Math.floor(Number(config?.ttlDays) || DEFAULT_TTL_DAYS)));
  const maxInject = Math.max(1, Math.min(30, Math.floor(Number(config?.maxInject) || MAX_INJECT)));
  const maxChars = Math.max(200, Math.min(4000, Math.floor(Number(config?.maxChars) || MAX_INJECT_CHARS)));

  const fresh = (notes ?? []).filter((n) => n.pinned || ageDays(n) <= ttl);
  if (fresh.length === 0) return '';

  const lines = [`## 小纸条 · 他说过的原话（${ttl} 天内的都在这儿；★ 是他钉住的）`];
  let used = lines[0].length;
  let count = 0;
  for (const note of fresh) {
    if (count >= maxInject) break;
    const piece = `- ${note.pinned ? '★ ' : ''}「${note.said}」${note.did ? `（我：${note.did}）` : ''}`;
    if (used + piece.length + 1 > maxChars && count > 0) break;
    lines.push(piece);
    used += piece.length + 1;
    count += 1;
  }
  return lines.length > 1 ? lines.join('\n') : '';
}

/**
 * 哪些话不值得单独占一行纸条。
 *
 * 小纸条的价值在于**原话**——但不是每一句原话都值得占位置。
 * "继续""好""嗯"这类回话记下来，注入了也只是占地方。
 *
 * 只挡**纯应答**，不挡短句：三个字的"我也是"是要记的。
 */
const TRIVIAL = new Set([
  '继续', '好', '好嘞', '好的', '嗯', '嗯嗯', '哦', '哦哦', '知道了', '行', '行吧',
  'ok', 'okay', '好哒', '谢了', '谢谢', '辛苦了', '来吧', '对', '对的', '没错', '是',
  '在吗', '喂', '666', '哈哈哈', '嘿嘿',
]);

/**
 * @param {string} said
 * @returns {boolean} 要不要记
 */
export function shouldNote(said) {
  const text = String(said ?? '').trim();
  if (text === '') return false;
  if (text.length > MAX_SAID_CHARS * 3) return true; // 长句一律记，截断由渲染负责
  const bare = text.replace(/[。.!！?？,，~～\s]+$/u, '');
  if (TRIVIAL.has(bare.toLowerCase())) return false;
  return true;
}

/**
 * 同一句原话是不是刚记过。
 *
 * 他会说"继续"说十遍，也会把同一件事换个说法反复讲。
 * 重复的原话不该在注入里占三条位置。
 *
 * @param {Array} notes 已有的纸条（从新到旧）
 * @param {string} said
 * @param {number} window 往前看几条
 * @returns {boolean}
 */
export function isDuplicate(notes, said, window = 8) {
  const key = String(said ?? '').trim();
  if (key === '') return false;
  const list = Array.isArray(notes) ? notes.slice(0, Math.max(1, window)) : [];
  return list.some((n) => String(n?.said ?? '').trim() === key);
}

/**
 * 同步追加一条纸条。
 *
 * 为什么要有同步版：`agent/turn-stopping` 是 serial 事件、会被 await，
 * 里面绝不能有 await（那就等于把回合关在文件 IO 上）。
 * 所以每轮记纸条走同步写 —— 文件很小（几百行），一次读改写是毫秒级。
 *
 * @param {string} file
 * @param {string} line
 * @returns {{file:string, lines:number}}
 */
export function appendNoteSync(file, line) {
  const body = String(line ?? '').trim();
  if (body === '') return { file, lines: 0 };
  let prev = '';
  try {
    prev = readFileSync(file, 'utf8');
  } catch {
    prev = '';
  }
  const rest = prev === '' ? '' : prev.replace(/^\n+/, '');
  const merged = rest === '' ? `${body}\n` : `${body}\n${rest}\n`;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, merged, 'utf8');
  const count = merged.split('\n').filter((l) => l.trim() !== '').length;
  return { file, lines: count };
}

/** 同步版溢出处理：把最旧的挪进旧档，不删。 */
export function archiveOverflowSync(file, archiveFile = null, limit = MAX_LINES) {
  let raw = '';
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    return 0;
  }
  const lines = raw.split('\n').filter((l) => l.trim() !== '');
  if (lines.length <= limit) return 0;
  const isPinned = (l) => l.trimStart().startsWith(`- ${PIN_MARK}`);
  const protectedLines = lines.filter(isPinned);
  const movableIdx = lines.map((l, i) => (isPinned(l) ? -1 : i)).filter((i) => i >= 0);
  const keepMovable = Math.max(0, limit - protectedLines.length);
  const dropIdx = new Set(movableIdx.slice(keepMovable));
  if (dropIdx.size === 0) return 0;
  const overflow = [...dropIdx].sort((a, b) => a - b).map((i) => lines[i]);
  const keep = lines.filter((_, i) => !dropIdx.has(i));
  writeFileSync(file, `${keep.join('\n')}\n`, 'utf8');
  if (archiveFile) {
    mkdirSync(dirname(archiveFile), { recursive: true });
    appendFileSync(
      archiveFile,
      `\n<!-- 溢出归档：${overflow.length} 条（被 ${limit} 条上限挤出来的） -->\n${overflow.join('\n')}\n`,
      'utf8',
    );
  }
  return overflow.length;
}

/**
 * 补写「我这轮」字段。
 *
 * 为什么需要：`agent/turn-stopping` 有时比回复落盘早，那一刻拿不到
 * 「我这轮干了什么」。等 assistant 消息真的到了，再回头补上。
 *
 * 只补**第一条**（最新那条），并且只补空的 —— 不覆盖已经写好的。
 *
 * @param {string} file
 * @param {string} did
 * @returns {boolean} 是否补上了
 */
export function patchDid(file, did, said = '') {
  const tail = String(did ?? '').trim().replace(/\s+/g, ' ').slice(0, MAX_DID_CHARS);
  if (tail === '') return false;
  let raw = '';
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    return false;
  }
  const want = String(said ?? '').trim();
  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const m = LINE_RE.exec(lines[i].trim());
    if (!m) continue;
    if (m[5]) continue; // 已经有「我这轮」了
    if (want !== '' && String(m[4] ?? '').trim() !== want) continue;
    lines[i] = `${lines[i].trimEnd()} ${FIELD_SEP}我这轮：${tail.split(FIELD_SEP).join('|')}`;
    writeFileSync(file, `${lines.join('\n').replace(/\n+$/, '')}\n`, 'utf8');
    return true;
  }
  return false;
}

/**
 * 一轮结束时的「记一张纸条」动作（同步、可测）。
 *
 * 把 host 那边"该不该记 / 记什么 / 溢出怎么办"整条链收在这里 ——
 * host 只负责把这一轮的原话和注解递过来。这样这条链能单独测，
 * 而 `agent/turn-stopping` 里只留一行调用（那是个 serial 事件，
 * 每一毫秒都在拖回合）。
 *
 * @param {object} input
 * @param {string} input.file
 * @param {string|null} [input.archiveFile]
 * @param {string} input.said 他说的原话
 * @param {string} [input.did] 我这一轮干了什么
 * @param {boolean} [input.enabled]
 * @param {number} [input.at]
 * @param {number} [input.limit]
 * @returns {{written:boolean, reason:string, line?:string, overflow?:number}}
 */
export function recordTurn({ file, archiveFile = null, said, did = '', enabled = true, at = now(), limit = MAX_LINES } = {}) {
  if (!enabled) return { written: false, reason: '关掉了' };
  const text = String(said ?? '').trim();
  if (!shouldNote(text)) return { written: false, reason: '纯应答，不占位置' };
  let notes = [];
  try {
    notes = readNotesSync(file);
  } catch {
    notes = [];
  }
  if (isDuplicate(notes, text)) return { written: false, reason: '刚记过同一句' };
  const line = renderNote({ said: text, did, at });
  appendNoteSync(file, line);
  const overflow = archiveOverflowSync(file, archiveFile, limit);
  return { written: true, reason: '记下了', line, overflow };
}

/**
 * 完整清单（给 sticky_list 用）。
 *
 * @param {Array} notes
 * @returns {string}
 */
export function renderList(notes) {
  if (!notes || notes.length === 0) return '（小纸条是空的）';
  return notes
    .map((n) => `${n.pinned ? '★ ' : ''}[${n.date} ${n.time}] 「${n.said}」${n.did ? `（我：${n.did}）` : ''}`)
    .join('\n');
}

/**
 * 钉住 / 取消钉住某一条。
 *
 * ★ 的纸条永不过期、永不溢出 —— 他钉住的东西就该一直在。
 *
 * 按**行内序号**（文件里的第几条，从 0 起）定位，用 raw 文本回写，
 * 认不出来的行原样留着。
 *
 * @param {string} file
 * @param {number} index
 * @param {boolean} pinned
 * @returns {Promise<{ok:boolean, index:number, pinned:boolean}>}
 */
export async function setPinned(file, index, pinned) {
  let raw = '';
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    return { ok: false, index, pinned };
  }
  const lines = raw.split('\n');
  const notes = parseNotes(raw);
  const target = notes[index];
  if (!target) return { ok: false, index, pinned };
  const rawIdx = lines.findIndex((l) => l.trim() === target.raw);
  if (rawIdx < 0) return { ok: false, index, pinned };
  const line = lines[rawIdx];
  const stripped = line.trimStart().startsWith(`- ${PIN_MARK}`)
    ? line.trimStart().slice(`- ${PIN_MARK}`.length).trimStart()
    : line.trimStart().replace(/^-\s*/, '');
  lines[rawIdx] = pinned ? `- ${PIN_MARK} ${stripped}` : `- ${stripped}`;
  const tmp = `${file}.tmp`;
  await mkdir(dirname(file), { recursive: true });
  await writeFile(tmp, `${lines.join('\n').replace(/\n+$/, '')}\n`, 'utf8');
  await rename(tmp, file);
  return { ok: true, index, pinned };
}

/**
 * 注册「小纸条」这一层：注入段 + 三个工具。
 *
 * · `sticky_note` —— 手动补一条（原话 + 我这轮干了什么）
 * · `sticky_list` —— 看现在挂着哪些
 * · `sticky_pin`  —— 钉住 / 取消钉住某一条
 *
 * @param {object} ctx
 * @param {object} opts
 * @param {string} opts.file 纸条文件路径
 * @param {string} opts.archiveFile 溢出归档路径
 * @param {(msg:string)=>void} opts.log
 * @param {()=>object} opts.config 取当前配置（ttlDays / maxInject）
 */
export function registerSticky(ctx, { file, archiveFile = null, log = () => {}, config = () => ({}) }) {
  const cfg = () => {
    try {
      return config() ?? {};
    } catch {
      return {};
    }
  };

  // ── 注入段 ──
  ctx.effect(() =>
    ctx.systemPrompt.section({
      name: STICKY_SECTION,
      order: STICKY_ORDER,
      // 每轮重新读文件 —— 他刚在面板里改过，下一轮就该生效。
      text: () => {
        try {
          if (cfg().enabled === false) return '';
          const raw = readFileSyncSafe(file);
          if (raw === null) return '';
          return renderSection(parseNotes(raw), cfg());
        } catch {
          return '';
        }
      },
      interpolate: false,
    }),
  );

  // ── 工具 ──
  ctx.inject(['tools'], (scope) => {
    scope.effect(
      () =>
        scope.tools.register({
          name: 'sticky_note',
          description:
            '记一条「小纸条」：他自己说的**原话**，加上你这一轮干了什么（一句话）。' +
            '小纸条每轮都注入给你 —— 用来记住他当时的语气和用词，' +
            '那些东西被日记压成"发生了什么"之后就没了。' +
            '别把转述写进来，要原话；也别每轮都记，只记真正有分量的一句。',
          parameters: {
            type: 'object',
            additionalProperties: false,
            properties: {
              said: { type: 'string', description: '他说的原话（照抄，别改写）。' },
              did: { type: 'string', description: '你这一轮干了什么，一句话。' },
            },
            required: ['said'],
          },
          output: {
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                ok: { type: 'boolean' },
                line: { type: 'string' },
                count: { type: 'integer' },
              },
            },
            render: (_args, value) => [
              { type: 'text', text: value?.ok ? `Noted: ${value?.line}` : 'Failed to note.' },
            ],
          },
          async execute(args) {
            const said = String(args?.said ?? '').trim();
            if (said === '') throw new Error('sticky_note: `said` 不能是空的。');
            const did = String(args?.did ?? '').trim();
            const line = renderNote({ said, did });
            await appendNote(file, line);
            const overflow = await archiveOverflow(file, archiveFile, MAX_LINES);
            const notes = await readNotes(file);
            log(`小纸条记了一条（${notes.length} 条${overflow ? `，溢出 ${overflow} 条进旧档` : ''}）`);
            return { ok: true, line, count: notes.length };
          },
          presentCall: (args) => ({ card: 'generic', title: '记一条小纸条', kind: 'other', rawInput: args }),
        }),
      'fish: sticky note tool',
    );

    scope.effect(
      () =>
        scope.tools.register({
          name: 'sticky_list',
          description:
            '看现在挂着哪些小纸条（他说的原话）。' +
            '想确认"他当时到底怎么说的"、或者要钉住某一条时用它。',
          parameters: { type: 'object', additionalProperties: false, properties: {} },
          output: {
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                count: { type: 'integer' },
                text: { type: 'string' },
              },
            },
            render: (_args, value) => [{ type: 'text', text: value?.text ?? '' }],
          },
          async execute() {
            const notes = await readNotes(file);
            return { count: notes.length, text: renderList(notes) };
          },
          presentCall: () => ({ card: 'generic', title: '小纸条清单', kind: 'other', rawInput: {} }),
        }),
      'fish: sticky list tool',
    );

    scope.effect(
      () =>
        scope.tools.register({
          name: 'sticky_pin',
          description:
            '钉住 / 取消钉住一条小纸条。钉住的那条**永不过期、永不被溢出挤走**。' +
            '他明确说过"这句要一直记着"之类的话时才钉。',
          parameters: {
            type: 'object',
            additionalProperties: false,
            properties: {
              index: { type: 'integer', description: '第几条（0 起，用 sticky_list 看编号）。' },
              pinned: { type: 'boolean', description: 'true = 钉住，false = 取消钉住。' },
            },
            required: ['index'],
          },
          output: {
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                ok: { type: 'boolean' },
                index: { type: 'integer' },
                pinned: { type: 'boolean' },
              },
            },
            render: (_args, value) => [
              {
                type: 'text',
                text: value?.ok
                  ? `Pinned #${value?.index} = ${value?.pinned}`
                  : `Failed to pin #${value?.index}.`,
              },
            ],
          },
          async execute(args) {
            const index = Number(args?.index);
            if (!Number.isFinite(index) || index < 0) throw new Error('sticky_pin: `index` 要是非负整数。');
            const pinned = args?.pinned !== false;
            const result = await setPinned(file, Math.floor(index), pinned);
            if (!result.ok) throw new Error(`sticky_pin: 没有第 ${index} 条。`);
            log(`小纸条 #${index} ${pinned ? '钉住' : '取消钉住'}`);
            return result;
          },
          presentCall: (args) => ({ card: 'generic', title: '钉住小纸条', kind: 'other', rawInput: args }),
        }),
      'fish: sticky pin tool',
    );
  });
}

/** 同步读文件；读不到当空串。 */
function readFileSyncSafe(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}
