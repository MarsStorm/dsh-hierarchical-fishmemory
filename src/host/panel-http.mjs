/**
 * 面板接口的 HTTP 层 —— 只处理"请求进来、怎么答"。
 *
 * 2026-11-16 从 `host/index.mjs` 摘出来。摘的理由不是"文件太长"，
 * 是这五件事跟记忆一点关系都没有：不读档案、不写档案、不碰模型，
 * 只认 header 和 body。它们放在一个 5000 行的闭包里，
 * 等于每次想改一句响应头都要在记忆逻辑中间翻。
 *
 * 摘出来之后它们**没有闭包依赖**了 —— 唯一的外部调用是日志，
 * 用 `setPanelLoggers()` 注入（默认什么都不做，测试里不用假装有个 ctx）。
 */

/** 日志注入点。host 启动时调一次；不调就是静默。 */
let loggers = { warn: () => {} };

export function setPanelLoggers(next = {}) {
  loggers = { warn: typeof next.warn === 'function' ? next.warn : () => {} };
}

/** 面板接口统一响应头：不缓存、不嗅探类型 */
export function panelReply(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
}

/**
 * 这个请求是不是同源来的。
 *
 * **判定顺序（从强到弱）：**
 *   1. 有 `Sec-Fetch-Site` → 必须 `same-origin`
 *   2. 有 `Origin` → 它的 host:port 必须等于 `Host`
 *   3. **两个都没有 → 放行**
 *
 * ── 第 3 条是 2026-10-26 改的，起因是一个真 bug ──
 *
 * 社区报「忘掉按钮点不动」。前端带了 `Content-Type: application/json`，
 * 所以不是那条闸；最可能是这里：**桌面端（Electron）的 renderer 发同源 fetch
 * 时未必带 `Origin` / `Sec-Fetch-Site`** —— 两个都没有就被判成跨站、403，
 * 而前端又不检查 `r.ok`，于是「点了没反应」。
 *
 * 为什么"两个都没有"可以放行：**浏览器发起的跨站 POST 一定至少带一个**
 * （`Origin` 是 Fetch 规范要求，现代浏览器再加 `Sec-Fetch-Site`）。
 * 两个都没有，说明不是页面发起的普通请求。
 *
 * 而真正的闸是 `Content-Type: application/json` —— 跨站带它会触发预检，
 * 预检失败请求就到不了这里。这条对跨站照样生效，没有放松。
 */
export function isSameOrigin(req) {
  const site = String(req.headers?.['sec-fetch-site'] ?? '').toLowerCase();
  if (site !== '') return site === 'same-origin';
  const origin = String(req.headers?.origin ?? '');
  const host = String(req.headers?.host ?? '');
  if (origin !== '') {
    if (host === '') return false;
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  return true;
}

/** 面板请求被拒时把凭据打出来 —— 否则"点了没反应"永远查不出原因 */
export function logPanelReject(what, req, reason) {
  try {
    const h = req?.headers ?? {};
    loggers.warn(
      `面板 ${what} 被拒（${reason}）· host=${h.host ?? '-'} · origin=${h.origin ?? '-'} · ` +
        `sec-fetch-site=${h['sec-fetch-site'] ?? '-'} · content-type=${h['content-type'] ?? '-'}`,
    );
  } catch {
    // 日志本身绝不能再抛
  }
}

/**
 * 读一个很小的 JSON 请求体。超过 8KB 直接拒 —— 我们只收 id。
 *
 * ⚠️ **必须要求 `Content-Type: application/json`。**
 *
 * 审计报告（F3，P2）：原来这里不看 Content-Type 直接 JSON.parse。
 * 于是跨站的 `text/plain` POST 能打进来 —— 按 CORS 规范，
 * `text/plain` / `application/x-www-form-urlencoded` 属于「简单请求」，
 * **浏览器不做预检就直接发出去**，服务端照常执行，只是页面读不到响应。
 *
 * 而日记 id 是 `d_YYYYMMDD_NN`，按日期枚举 01–99 就能逐条删光。
 * 用户开着 dsh web 时访问一个恶意网页，记忆就没了 —— 而且没有确认环节。
 *
 * 要求 application/json 之后：跨站请求会触发预检，而预检会失败。
 * 顺带把 Origin 也验一遍（双保险）。
 */
export async function readPanelBody(req) {
  const ct = String(req.headers?.['content-type'] ?? '').toLowerCase();
  if (!ct.startsWith('application/json')) {
    logPanelReject('写请求', req, 'content-type 不是 json');
    throw new Error('只接受 application/json');
  }
  if (!isSameOrigin(req)) {
    logPanelReject('写请求', req, '来源判定为跨站');
    throw new Error('跨站请求不予处理');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8192) throw new Error('请求体过大');
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/**
 * 读原始文本（备份文件可能几 MB，比 `readPanelBody` 的 8 KB 宽松）。
 *
 * 备份就是纯 JSON 文本，不需要 multipart —— 前端直接 `fetch(body: text)`。
 * 上限 24 MB：正常人一生也写不到这么多记忆，超了大概是选错文件了。
 */
export async function readPanelTextBody(req, { limit = 24 * 1024 * 1024 } = {}) {
  // 这两道以前只有 `readPanelBody` 有，这份"宽松版"一条都没有 ——
  // 它是专门给备份/还原用的，也就是**能整份覆盖记忆的那个入口**。
  const type = String(req.headers?.['content-type'] ?? '');
  if (type !== '' && !/^(application\/json|text\/plain)\b/i.test(type)) {
    throw new Error('只接受 application/json 或 text/plain');
  }
  if (!isSameOrigin(req)) {
    logPanelReject('备份上传', req, '来源判定为跨站');
    throw new Error('跨站请求不予处理');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      // 文案以前写死「24 MB」，可调用方有 64 KB / 1 MB / 256 KB 几档，
      // 报出来的数跟实际拦他的数对不上。
      const human = limit >= 1024 * 1024
        ? `${Math.round(limit / 1024 / 1024)} MB`
        : `${Math.round(limit / 1024)} KB`;
      throw new Error(`请求体过大（上限 ${human}）`);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}
