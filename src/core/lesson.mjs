/**
 * 教训 —— 我会重复踩的那些坑。
 *
 * ── 为什么单独做这一层 ──
 *
 * 记忆里早就有「失败」这一栏，但它记的是"我搞砸了什么、当时怎么处理的"，
 * 是一份**事件记录**，不是一份**警报**。
 *
 * 而 2026-11-10 那天我看清了一件事：
 *
 *   · 10-31「报告成功和真的成功是两件事」—— 配置写成 `- id:` 而不是 `- insert:`，
 *     载体只丢一行警告，网关根本没起，差点报平安的就是我。
 *   · 11-10「报缺陷没先验」—— 我顺口报了三条小毛病，他一句"都修了吧"，
 *     一核三条全站不住。
 *
 * 这两件事隔了十天，形状一模一样：**先把话放出去，再回头核**。
 * 可我一条都没把它们连起来 —— 因为没有地方连。
 *
 * 所以这一层只问一个问题：**这个坑，我是不是踩过第二次？**
 * 踩过第一次是偶然，第二次是性格。性格得写下来，每轮都看得见。
 *
 * ── 落在哪儿 ──
 *
 * 跟 `手记.md`、`纸条.md` 同一条教训：必须是不参与 `archiveToFiles` 的独立文件，
 * 否则下一次写盘就整份覆盖没了。
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { tokenize } from './keywords.mjs';

/** 文件名（档案目录下，和 纸条.md 同级） */
export const LESSON_FILE = '教训.md';
/** 注入节：排在纸条（0.6）之后、正文记忆（100）之前 */
export const LESSON_SECTION = 'lesson:memory';
export const LESSON_ORDER = 0.62;

/** 一句话说清一条教训，太长就没人读了 */
export const MAX_LESSON_CHARS = 160;
/** 重复到这个次数才算"性格"，才往每轮注入里放 */
export const REPEAT_TO_INJECT = 2;
/** 每轮最多放几条（多了就变成噪音，反而没人看） */
export const MAX_INJECT = 5;
/** 文件最多留几行 */
export const MAX_LINES = 120;

/** `- [3] 2026-11-11 ｜先验再报：报缺陷前先跑一遍证据` */
const LINE_RE = /^-\s*\[(\d+)\]\s*(\d{4}-\d{2}-\d{2})\s*｜(.*)$/;

/** 多像算"同一个坑"。0.5 是拿上面那两件事的写法调出来的。 */
const SIMILAR = 0.5;
/** token 太少不判（「慢一点」和「快一点」就差一个 token） */
const MIN_TOKENS = 4;

function tokenSet(text) {
  try {
    return new Set(tokenize(String(text ?? '')));
  } catch {
    return new Set();
  }
}

function dice(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared += 1;
  return (2 * shared) / (a.size + b.size);
}

function clip(text, max) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

/** 正文里的全角竖线会破坏行格式 */
function safe(text) {
  return clip(text, MAX_LESSON_CHARS).replace(/｜/g, '|');
}

/**
 * 今天（UTC+8）。跟全项目唯一的"一天"算法保持一致。
 */
export function today(now = Date.now()) {
  const d = new Date(now + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

/**
 * 从文件文本解析。认不出的行丢掉 —— 这个文件是我手写的，允许我写注释。
 *
 * @param {string} text
 * @returns {Array<{count:number, date:string, text:string}>} 从新到旧
 */
export function parseLessons(text) {
  const out = [];
  for (const line of String(text ?? '').split('\n')) {
    const m = LINE_RE.exec(line.trim());
    if (!m) continue;
    const count = Number.parseInt(m[1], 10);
    const body = m[3].trim();
    if (!Number.isFinite(count) || body === '') continue;
    out.push({ count, date: m[2], text: body });
  }
  return out;
}

/**
 * 读文件。读不到当空 —— 这个文件不存在是常态（还没踩够）。
 *
 * @param {string} file
 */
export function readLessons(file) {
  try {
    return parseLessons(readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

/**
 * 渲染回文件。顺序：踩得多的在上，次数相同看日期新的在上。
 *
 * @param {Array<{count:number,date:string,text:string}>} lessons
 */
export function renderLessons(lessons) {
  const sorted = [...(lessons ?? [])].sort(
    (a, b) => b.count - a.count || String(b.date).localeCompare(String(a.date)),
  );
  return `${sorted.slice(0, MAX_LINES).map((l) => `- [${l.count}] ${l.date} ｜${l.text}`).join('\n')}\n`;
}

/**
 * 找出跟这条最像的旧教训。
 *
 * @param {Array} lessons
 * @param {string} text
 * @returns {{index:number, score:number}|null}
 */
export function findSimilar(lessons, text) {
  const mine = tokenSet(text);
  if (mine.size < MIN_TOKENS) return null;
  let best = null;
  for (let i = 0; i < (lessons ?? []).length; i += 1) {
    const theirs = tokenSet(lessons[i]?.text);
    if (theirs.size < MIN_TOKENS) continue;
    const score = dice(mine, theirs);
    if (score >= SIMILAR && (best === null || score > best.score)) best = { index: i, score };
  }
  return best;
}

/**
 * 记一条。像的就加一次数，不像的才新起一条。
 *
 * "像"是这个文件的核心 —— 它不是在收集错误，是在**数同一个错犯了几次**。
 *
 * @param {string} file
 * @param {{text:string, at?:number}} input
 * @returns {{kind:'bumped'|'added'|'none', count:number, text:string, lessons:Array}}
 */
export function addLesson(file, input = {}) {
  const body = safe(input?.text);
  if (body === '') return { kind: 'none', count: 0, text: '', lessons: [] };

  const at = Number.isFinite(input?.at) ? input.at : Date.now();
  const date = today(at);
  const lessons = readLessons(file);

  const hit = findSimilar(lessons, body);
  let kind = 'added';
  let count = 1;
  if (hit !== null) {
    kind = 'bumped';
    const prev = lessons[hit.index];
    count = (Number.isFinite(prev.count) ? prev.count : 1) + 1;
    // 正文更新成这次的说法 —— 同一条教训，今天的措辞通常更准
    lessons[hit.index] = { count, date, text: body };
  } else {
    lessons.push({ count, date, text: body });
  }

  const sorted = [...lessons].sort(
    (a, b) => b.count - a.count || String(b.date).localeCompare(String(a.date)),
  );
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, renderLessons(sorted), 'utf8');
  renameSync(tmp, file);

  return { kind, count, text: body, lessons: sorted };
}

/**
 * 每轮注入的那一段。**只放踩过两次以上的。**
 *
 * 第一次踩是个意外，写进档案就够了；
 * 同一个坑踩第二次，那是我这个人的毛病，得每次开口前都看见。
 *
 * @param {Array} lessons
 * @param {{limit?:number, minCount?:number}} [options]
 * @returns {string} 没到门槛就返回空串（整节不出现，零噪音）
 */
export function renderSection(lessons, options = {}) {
  const limit = Number.isFinite(options.limit) ? options.limit : MAX_INJECT;
  const minCount = Number.isFinite(options.minCount) ? options.minCount : REPEAT_TO_INJECT;
  const hit = (lessons ?? [])
    .filter((l) => Number.isFinite(l.count) && l.count >= minCount)
    .sort((a, b) => b.count - a.count || String(b.date).localeCompare(String(a.date)))
    .slice(0, limit);
  if (hit.length === 0) return '';
  const lines = hit.map((l) => `- 这个坑踩过 ${l.count} 次：${l.text}`);
  return [
    '## 踩过的坑（重复犯的，先看一眼再动手）',
    '',
    ...lines,
    '',
    '（不是提醒你别犯错 —— 是提醒你，这一类你上次就已经犯过了。）',
  ].join('\n');
}

/**
 * 教训那一段的正文。1.23.0 起默认由 `fragments.mjs` 调它。
 *
 * @param {string} file
 * @param {{enabled?:boolean, limit?:number, minCount?:number}} [options]
 */
export function lessonSectionText(file, options = {}) {
  if (options?.enabled === false) return '';
  try {
    return renderSection(readLessons(file), options);
  } catch {
    return '';
  }
}

/**
 * 注册：注入段 + 两个工具。
 *
 * - `lesson_note`  我亲手记一笔（犯错时自己写）
 * - `lesson_list`  看全部，包括只踩过一次的
 *
 * @param {any} ctx
 * @param {{file:string, log?:(m:string)=>void, enabled?:()=>boolean}} options
 */
export function registerLesson(ctx, { file, log = () => {}, enabled, section = true } = {}) {
  const on = () => (typeof enabled === 'function' ? enabled() !== false : true);

  // 1.23.0 起默认不自己注册段：三段零碎合成 `fragments:memory`，见 fragments.mjs。
  if (section) {
    ctx.effect(
      () =>
        ctx.systemPrompt.section({
          name: LESSON_SECTION,
          order: LESSON_ORDER,
          // 每轮重读：这次刚记下的，下一轮就该看见
          text: () => lessonSectionText(file, { enabled: on() }),
          interpolate: false,
        }),
      'fish: lesson section',
    );
  }

  ctx.inject(['tools'], (scope) =>
    scope.effect(() =>
      scope.tools.register({
        name: 'lesson_note',
        description:
          '记一条自己踩过的坑。同一个坑再记一次会自动加次数；踩过两次以上的会每轮注入提醒自己。犯错、返工、说错话之后用它。',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            text: { type: 'string', description: '一句话说清这个坑（不超过 160 字）。' },
          },
          required: ['text'],
        },
        output: {
          schema: {
            type: 'object',
            properties: {
              kind: { type: 'string' },
              count: { type: 'number' },
              text: { type: 'string' },
            },
          },
          // 返回的必须是内容块数组，不是字符串 —— 给字符串的话
          // 宿主的传输层会把它当成消息 content 直接塞进去，
          // 下一句就是 `content.some is not a function`。
          render: (_args, value) => [
            {
              type: 'text',
              text:
                value?.kind === 'bumped'
                  ? `这个坑记到第 ${value.count} 次了：${value.text}`
                  : `新记下一个坑：${value?.text ?? ''}（再来一次就会被每轮提醒）`,
            },
          ],
        },
        presentCall: (args) => ({
          card: 'generic',
          title: '记一条教训',
          kind: 'other',
          rawInput: args,
        }),
        async execute(args) {
          const r = addLesson(file, { text: args?.text });
          if (r.kind === 'none') throw new Error('lesson_note: `text` 不能是空的。');
          log(`教训 +1（第 ${r.count} 次）：${r.text.slice(0, 24)}`);
          return { kind: r.kind, count: r.count, text: r.text };
        },
      }),
    ),
  );

  ctx.inject(['tools'], (scope) =>
    scope.effect(() =>
      scope.tools.register({
        name: 'lesson_list',
        description: '看看记过哪些坑、各踩了几次。只读。',
        parameters: { type: 'object', properties: {} },
        output: {
          schema: { type: 'object', properties: { lessons: { type: 'array' } } },
          render: (_args, value) => [
            {
              type: 'text',
              text:
                (value?.lessons ?? []).length === 0
                  ? '还没记过什么坑。'
                  : value.lessons.map((l) => `×${l.count} ${l.text}`).join('\n'),
            },
          ],
        },
        presentCall: () => ({ card: 'generic', title: '踩过的坑', kind: 'other', rawInput: {} }),
        async execute() {
          return { lessons: readLessons(file) };
        },
      }),
    ),
  );
}
