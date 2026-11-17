/**
 * 零碎记忆 —— 把三段小东西合成一段注入。
 *
 * 1.23.0 之前，小纸条(`sticky:memory`, 0.6)、教训(`lesson:memory`, 0.62)、
 * 未说完(`unfinished:memory`, 0.65) 是三段独立的注入。三段各自都有开关、
 * 各自的预算、各自的注册代码 —— 加起来就是"功能有点多、有点乱"。
 *
 * 合并的**不是内容**，是入口：
 *
 * · 内容照旧由各模块自己的渲染函数产出（`stickySectionText` /
 *   `lessonSectionText` / `unfinishedSectionText`），一个字都没搬走。
 * · 合并之后只有一段、一个总开关、一个总字数。设置页上原本 6 个开关
 *   变成 2 个（`fragmentsEnabled` + `fragmentsMaxChars`）。
 * · 旧的三个开关仍然认（`stickyEnabled` / `lessonEnabled` / `unfinishedEnabled`）——
 *   他已经设过的值不该因为我换了个抽屉就失效。只是不再摆到设置页上。
 *
 * 顺序是有讲究的：短的先占位、长的拿剩下的。
 * 教训最多 5 行、未说完一句话，它们要是被挤掉就白搭；
 * 小纸条是浮动的，被截掉一两条还能读。
 */

import { lessonSectionText } from './lesson.mjs';
import { stickySectionText } from './sticky.mjs';
import { unfinishedSectionText } from './unfinished.mjs';
import { safeConfig } from './safe.mjs';

/** 注入段名。改成三段合一的新名字，旧的三个名字不再注册。 */
export const FRAGMENTS_SECTION = 'fragments:memory';
/** 比 `fish:memory`(100) 早很多：零碎的先说，正文在后。 */
export const FRAGMENTS_ORDER = 0.6;
/** 整段默认上限（字）。三个部分共用这一个数。 */
export const FRAGMENTS_MAX_CHARS = 1400;
/** 小纸条最少留多少 —— 剩下的不够这个数，就别让它只剩半行。 */
export const STICKY_MIN_CHARS = 200;

function clampInt(value, min, max, fallback) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/**
 * 拼出「零碎记忆」这一段的正文。
 *
 * @param {object} input
 * @param {string} input.stickyFile
 * @param {string} input.lessonFile
 * @param {string} input.unfinishedFile
 * @param {object} [input.config] 合并后的配置（`fragmentsEnabled` / `fragmentsMaxChars` + 旧的三个开关）
 * @param {number} [input.at]
 * @param {(m:string)=>void} [input.log]
 * @returns {string}
 */
export function renderFragments({
  stickyFile,
  lessonFile,
  unfinishedFile,
  config = {},
  at = Date.now(),
  log = () => {},
} = {}) {
  const c = config ?? {};
  if (c.fragmentsEnabled === false) return '';

  const maxChars = clampInt(c.fragmentsMaxChars, 200, 4000, FRAGMENTS_MAX_CHARS);
  const parts = [];

  // ── 先把「边界话」的位置扣出来，再往里填内容（2026-11-18 加，1.36.0）──
  //
  // 抄的是 memory-brain 的 `retrieval.py:371`：
  //
  //     reserve = estimate_tokens(_CONFLICT_LINE) + 1 if 有存疑 and 预算够 else 0
  //     evidence_budget = token_budget - reserve
  //
  // 它在打包证据**之前**就把那一行不确定提示的预算扣下来 ——
  // 否则证据一多，最先被挤掉的恰恰是"这些材料不一定对"这句话。
  //
  // 我原来反着来：先填纸条，剩下的缝里才塞那句"没说完的能接着问一句"。
  // 结果就是纸条一多，那句分寸话先消失 —— 而它比任何一条纸条都不该被挤掉。
  //
  // 扣多少：只扣**一行**（大约 24 字）。不是给所有尾巴都留座，
  // 是给"最后一句话"留座。留多了就变成用预算养姿态。
  const TAIL_RESERVE = 24;
  const budget = Math.max(0, maxChars - TAIL_RESERVE);

  // ① 教训（最多 5 行，且只放踩过两次以上的）
  if (c.lessonEnabled !== false && lessonFile) {
    // 教训先扣掉尾巴那一行要留的位（TAIL_RESERVE），再拿它自己那份。
    // 它原来没有字数上限，"三部分共用总字数"只是句说法（见 lesson.mjs 注释）。
    const text = lessonSectionText(lessonFile, { limit: c.lessonLimit, maxChars: budget });
    if (text) parts.push(text);
  }

  // ② 没说完的那句（一次最多一条，浮上来就算问过了）
  if (c.unfinishedEnabled !== false && unfinishedFile) {
    const text = unfinishedSectionText(unfinishedFile, {
      at,
      limit: Number.isFinite(c.unfinishedPerTurn) ? c.unfinishedPerTurn : undefined,
      log,
    });
    if (text) parts.push(text);
  }

  // ③ 小纸条（拿剩下的预算；不够留就整段不出现）
  if (c.stickyEnabled !== false && stickyFile) {
    const used = parts.reduce((sum, p) => sum + p.length + 2, 0);
    const room = budget - used;
    if (room >= STICKY_MIN_CHARS) {
      const text = stickySectionText(stickyFile, {
        ttlDays: c.stickyTtlDays,
        maxInject: c.stickyMaxInject,
        maxChars: room,
        at,
      });
      if (text) parts.push(text);
    } else {
      // ── 整段被预算挤掉了，得说一声（1.27.0）──
      //
      // 1.23.0 起，`fragmentsMaxChars` 不够时纸条是**安静消失**的：
      // 我那一轮读到的注入里一条纸条都没有，而我不知道是因为"没有纸条"
      // 还是因为"没地方放"。两种都是"没有"，但一种要改预算，一种不用。
      // 先看看是不是真有内容会被丢 —— 空的就别冤枉预算了。
      const wouldHave = stickySectionText(stickyFile, {
        ttlDays: c.stickyTtlDays,
        maxInject: c.stickyMaxInject,
        maxChars: 4000,
        at,
      });
      if (wouldHave) {
        parts.push(`（纸条这一段这次没地方放（只剩 ${Math.max(0, room)} 字）—— 用 sticky_list 看。）`);
        log(`零碎记忆：纸条整段被预算挤掉（剩 ${Math.max(0, room)} 字 < ${STICKY_MIN_CHARS}）`);
      }
    }
  }

  // ── 出口再量一次总长（2026-11-18，1.36.0）──
  //
  // 上面每一段都收了 `maxChars`，但段与段之间那两个空行、以及各段自己
  // 内部额外拼的提示行（"还有 N 条没挤进来""没说完的能接着问一句"）
  // 都不是谁单独算得清的。**总字数只有一个地方可以量准：出口。**
  //
  // 超了就先丢最贵的那段（小纸条）—— 它是三段里唯一"少一条也还好"的。
  // 丢完还不够就把纸条截短，截到"至少还留一条"为止；连一条都放不下，
  // 整段撤掉并说一声（1.27.0 立的规矩：挤掉了要说）。
  let text = parts.join('\n\n');
  if (text.length > maxChars && parts.length > 0) {
    const stickyIdx = parts.findIndex((p) => p.startsWith('## 小纸条'));
    const lessonIdx = parts.findIndex((p) => p.startsWith('## 踩过的坑'));

    // 第一刀：把纸条按"剩下的位置"重装。上一轮它拿到的是 `budget`
    // （= maxChars − 24），但教训和"没说完"最后装了多少只有这里知道。
    if (stickyIdx >= 0) {
      const others = parts.filter((_, i) => i !== stickyIdx);
      const othersText = others.join('\n\n');
      const gap = others.length > 0 ? 2 : 0;
      const room = maxChars - othersText.length - gap;
      if (room >= STICKY_MIN_CHARS) {
        const kept = stickySectionText(stickyFile, {
          ttlDays: c.stickyTtlDays,
          maxInject: c.stickyMaxInject,
          maxChars: room,
          at,
        });
        if (kept && kept.length <= room) parts.splice(stickyIdx, 1, kept);
        else parts.splice(stickyIdx, 1);
      } else {
        parts.splice(stickyIdx, 1);
      }
      text = parts.join('\n\n');
    }

    // 第二刀：撤了纸条还是超，就只剩教训那一段太长这一种可能。
    // 它的 `maxChars` 上一轮给的是 `budget`，现在按真实剩下的位置重装。
    if (text.length > maxChars) {
      const li = parts.findIndex((p) => p.startsWith('## 踩过的坑'));
      if (li >= 0) {
        const others = parts.filter((_, i) => i !== li);
        const othersText = others.join('\n\n');
        const room = maxChars - othersText.length - (others.length > 0 ? 2 : 0);
        const smaller = room > 0 ? lessonSectionText(lessonFile, { limit: c.lessonLimit, maxChars: room }) : '';
        if (smaller) parts.splice(li, 1, smaller);
        else parts.splice(li, 1);
        text = parts.join('\n\n');
      }
    }
    if (text.length > maxChars) {
      // 兜底：连教训都放不下，就只剩"没说完"那一段 —— 它是三样里最短、
      // 也最不能整段丢的（一次最多一条）。到这里还超，说明句子本身就长，
      // 硬截会截出半句话，宁可留一句日志。
      log(`零碎记忆：出口仍然超预算 ${text.length} > ${maxChars}（教训与纸条已让位）`);
    }
  }
  return text;
}

/**
 * 注册那一段。
 *
 * 每轮现算：小纸条每轮重读文件（面板里改过下一轮就生效），
 * 「未说完」每轮重挑（谁浮上来由时间决定）。所以这里不能缓存。
 *
 * @param {any} ctx
 * @param {object} options
 * @param {string} options.stickyFile
 * @param {string} options.lessonFile
 * @param {string} options.unfinishedFile
 * @param {()=>object} [options.config]
 * @param {(m:string)=>void} [options.log]
 */
export function registerFragments(
  ctx,
  { stickyFile, lessonFile, unfinishedFile, config = () => ({}), log = () => {} } = {},
) {
  const cfg = () => safeConfig(config);

  ctx.effect(
    () =>
      ctx.systemPrompt.section({
        name: FRAGMENTS_SECTION,
        order: FRAGMENTS_ORDER,
        text: () =>
          renderFragments({
            stickyFile,
            lessonFile,
            unfinishedFile,
            config: cfg(),
            at: Date.now(),
            log,
          }),
        interpolate: false,
      }),
    'fish: fragments section',
  );
}
