/**
 * 把抛出来的东西变成一句能看的话。
 *
 * `err instanceof Error ? err.message : String(err)` 这一行原来在
 * `host/index.mjs` 里抄了 56 遍、`archive.mjs` 3 遍、`webdav.mjs` 3 遍。
 * 抄得多不要紧，要紧的是**每抄一次就可能有一处写成 `err.message`**
 * —— 那样 `throw '字符串'` 的时候就拿到 `undefined`，面板上显示一个空错误。
 *
 * 所以只留这一份。用之前先问：抛出来的是不是一定 Error？不是的话用它。
 */
export function errorText(err) {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err === undefined || err === null) return '未知错误';
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
