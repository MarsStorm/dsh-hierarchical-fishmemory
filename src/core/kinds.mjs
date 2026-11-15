/**
 * 日记条目的 kind —— 七个字母串，一处定义。
 *
 * 2026-11-16 收拢：`compact.mjs` 里叫 `KIND_LABEL`，`render-diary.mjs` 里叫
 * `KINDS`，`consolidate.mjs` 里叫 `VALID_KINDS`（只列了五个，没有 note）。
 * 三份内容几乎一样，但**没有一份是"权威"的** —— 加一种 kind 时漏改哪一处，
 * 那一处就会把新条目渲染成「记一笔」或者干脆判成非法丢掉，
 * 而且哪一处出错取决于你在哪个界面看。
 */

/** kind → 人话。`note` 是 2026-10-27 之前那批（"我自己写的"），只读不产。 */
export const KIND_LABEL = {
  failure: '搞砸了',
  win: '干得不错',
  chat: '闲聊',
  disclosure: '他说了点自己的事',
  grievance: '他不高兴了',
  note: '我自己写的',
};

/** 能从对话里固化成条目的 kind（`note` 不在内：那个入口已经下线）。 */
export const LIVE_KINDS = new Set(['failure', 'win', 'chat', 'disclosure', 'grievance']);

/** 渲染时认不出来就用的那个词。 */
export const KIND_FALLBACK = '记一笔';

/**
 * @param {unknown} kind
 * @returns {string}
 */
export function kindLabel(kind) {
  return KIND_LABEL[String(kind ?? '')] ?? KIND_FALLBACK;
}
