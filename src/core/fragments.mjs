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

  // ① 教训（最多 5 行，且只放踩过两次以上的）
  if (c.lessonEnabled !== false && lessonFile) {
    const text = lessonSectionText(lessonFile, { limit: c.lessonLimit });
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
    const room = maxChars - used;
    if (room >= STICKY_MIN_CHARS) {
      const text = stickySectionText(stickyFile, {
        ttlDays: c.stickyTtlDays,
        maxInject: c.stickyMaxInject,
        maxChars: room,
        at,
      });
      if (text) parts.push(text);
    }
  }

  return parts.join('\n\n');
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
  const cfg = () => {
    try {
      return config() ?? {};
    } catch {
      return {};
    }
  };

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
