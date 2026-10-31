/**
 * WebDAV 上传（把备份推到自己的网盘）
 *
 * 为什么单独一个模块：这里没有任何 DSH 的东西，只用 Node 自带的 fetch / URL /
 * Buffer，所以可以在纯 node 里直接测（`node --test test/webdav.test.mjs`）。
 *
 * 支持的是 WebDAV 的最小可用集：
 *   · MKCOL 逐级建目录（405 = 已存在，当成功）
 *   · PUT 上传
 *   · PROPFIND (Depth: 1) 列目录 —— 用来只保留最近 N 份
 *   · DELETE 删旧份
 *
 * 不引第三方 WebDAV 客户端：那会带来一串依赖和它们的缓存语义；这里只要
 * 「把文件放上去、列出来、删掉旧的」，四十行够用。
 */

/** 远程目录里认得出的备份文件名（和 backupFileName() 的前缀一致）。 */
export const REMOTE_PREFIX = '备份-';

/**
 * 归一化配置。永远不抛错：没填 URL 就是「没配置」，调用方据此给一句人话。
 *
 * @param {Record<string, any>} raw
 */
export function normalizeWebdavConfig(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const url = typeof src.webdavUrl === 'string' ? src.webdavUrl.trim() : '';
  const dir = typeof src.webdavDir === 'string' ? src.webdavDir.trim() : '';
  const user = typeof src.webdavUser === 'string' ? src.webdavUser : '';
  const password = typeof src.webdavPassword === 'string' ? src.webdavPassword : '';
  const keep = Number(src.webdavKeep);
  return {
    configured: /^https?:\/\//i.test(url),
    url: url.replace(/\/+$/, ''),
    username: user,
    password,
    dir: dir.replace(/^\/+|\/+$/g, ''),
    auto: src.webdavAuto === true || src.webdavAuto === 'true',
    keep: Number.isFinite(keep) ? Math.max(1, Math.min(200, Math.floor(keep))) : 10,
    enabled: src.webdavEnabled !== false,
  };
}

/** 把 base 和若干段路径拼成 URL，去掉重复斜杠。 */
export function joinUrl(base, ...parts) {
  const head = String(base ?? '').replace(/\/+$/, '');
  const tail = parts
    .filter((p) => p !== undefined && p !== null && String(p) !== '')
    .map((p) => String(p).replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
  return tail ? `${head}/${tail}` : head;
}

/** encodeURI 每一段但保留 `/`，中文目录名也能用。 */
export function encodePath(pathname) {
  return String(pathname ?? '')
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

/** `Basic <base64>`；没有用户名就不带认证头（有的公开网盘不需要）。 */
export function authHeader(username, password) {
  if (!username && !password) return null;
  const raw = `${username ?? ''}:${password ?? ''}`;
  return `Basic ${Buffer.from(raw, 'utf8').toString('base64')}`;
}

function headersFor(cfg, extra = {}) {
  const headers = { ...extra };
  const auth = authHeader(cfg.username, cfg.password);
  if (auth) headers.Authorization = auth;
  return headers;
}

/**
 * 发一个 WebDAV 请求，带超时。网络错误包成一句人话（含状态码）。
 *
 * @returns {Promise<{status:number, ok:boolean, text:string, headers:Headers}>}
 */
export async function webdavRequest(cfg, method, url, options = {}) {
  if (!cfg?.configured) throw new Error('WebDAV 还没配置：填上服务器地址（和可选的账号密码）再试');
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 30_000;
  const init = { method, headers: headersFor(cfg, options.headers) };
  if (options.body !== undefined) init.body = options.body;
  // 重定向交给 fetch；网盘常见 301 → 带斜杠目录
  init.redirect = 'follow';
  let res;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`WebDAV 连不上（${method} ${url}）：${reason}`);
  }
  let text = '';
  try {
    text = await res.text();
  } catch {
    text = '';
  }
  if (!res.ok && res.status !== 207) {
    const brief = text.replace(/\s+/g, ' ').slice(0, 200);
    throw new Error(`WebDAV 返回 ${res.status}（${method} ${url}）${brief ? `：${brief}` : ''}`);
  }
  return { status: res.status, ok: res.ok, text, headers: res.headers };
}

/**
 * 逐级 MKCOL。已存在（405 / 409）当成功 —— 各家网盘对「已存在」的码不统一。
 */
export async function ensureRemoteDir(cfg, options = {}) {
  if (!cfg.dir) return;
  const segments = cfg.dir.split('/').filter(Boolean);
  let current = cfg.url;
  for (const seg of segments) {
    current = joinUrl(current, seg);
    try {
      await webdavRequest(cfg, 'MKCOL', encodePathUrl(current), { timeoutMs: options.timeoutMs });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // 405/409/301：目录已经有了。别当成失败，否则第一次能传、第二次就报错。
      if (!/\b(405|409|301)\b/.test(message)) throw err;
    }
  }
}

/** URL 里的路径部分做 encodeURI，保留协议与主机。 */
function encodePathUrl(url) {
  try {
    const parsed = new URL(url);
    // 注意：`parsed.pathname = encodePath(...)` 不行 —— URL 的 pathname setter
    // 会把 `%` 再转义一次，`E5` 变成 `%25E5`，服务器收到 `%E5` 的字面量，
    // MKCOL 就 404。这里手工拼字符串，才能只编码一层。
    const encoded = parsed.pathname
      .split('/')
      .map((seg) => {
        let raw = seg;
        try {
          raw = decodeURIComponent(seg);
        } catch {
          // 非法转义保持原样，交给 encodeURIComponent 兜底
        }
        return encodeURIComponent(raw);
      })
      .join('/');
    return `${parsed.protocol}//${parsed.host}${encoded}${parsed.search}`;
  } catch {
    return url;
  }
}

/**
 * 上传一段文本（就是备份 JSON）。
 *
 * @param {ReturnType<typeof normalizeWebdavConfig>} cfg
 * @param {{ text:string, fileName:string, onLog?:(msg:string)=>void }} input
 */
export async function uploadBackupText(cfg, input) {
  const fileName = String(input.fileName ?? '').replace(/[\\/]+/g, '-');
  if (!fileName) throw new Error('上传失败：文件名为空');
  await ensureRemoteDir(cfg);
  const target = joinUrl(cfg.url, cfg.dir, fileName);
  const res = await webdavRequest(cfg, 'PUT', encodePathUrl(target), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: input.text,
    timeoutMs: input.timeoutMs,
  });
  const bytes = Buffer.byteLength(input.text, 'utf8');
  input.onLog?.(`已上传 ${fileName}（${bytes} 字节，HTTP ${res.status}）`);
  return { url: target, fileName, bytes, status: res.status };
}

/**
 * 列远程目录里的备份文件。PROPFIND 拿不到（有的网盘禁了）就返回空数组，
 * 让「保留最近 N 份」退化成「什么都不删」，而不是整个上传失败。
 */
export async function listRemoteBackups(cfg, options = {}) {
  if (!cfg.dir) return [];
  const target = joinUrl(cfg.url, cfg.dir);
  let text = '';
  try {
    const res = await webdavRequest(cfg, 'PROPFIND', encodePathUrl(target), {
      headers: { Depth: '1', 'Content-Type': 'application/xml; charset=utf-8' },
      body: '<?xml version="1.0"?><propfind xmlns="DAV:"><prop><getcontentlength/><getlastmodified/></prop></propfind>',
      timeoutMs: options.timeoutMs,
    });
    text = res.text;
  } catch (err) {
    // 默认宽容（列表拿不到就当空，上传照做）。strict 时把错误抛给调用方 ——
    // 「测试连接」要能区分「目录空的」和「这个网盘不让列目录」。
    if (options.strict) throw err;
    return [];
  }
  const names = [];
  // 只认 <d:href> / <href> 两种写法，取最后一段再解码。
  const re = /<[a-z0-9]*:?href[^>]*>([^<]+)<\/[a-z0-9]*:?href>/gi;
  let match;
  while ((match = re.exec(text))) {
    const raw = match[1].trim();
    if (!raw || raw.endsWith('/')) continue;
    let name = raw.split('/').filter(Boolean).pop() ?? '';
    try {
      name = decodeURIComponent(name);
    } catch {
      // 解码失败就用原串
    }
    if (name.startsWith(REMOTE_PREFIX) && name.endsWith('.json') && !names.includes(name)) names.push(name);
  }
  // 文件名里带 UTC 时间戳，字典序即时间序（旧 → 新）
  return names.sort();
}

/** 删掉超出 keep 的旧份（最旧的先删）。PROPFIND 不可用时静默跳过。 */
export async function pruneRemoteBackups(cfg, options = {}) {
  const keep = cfg.keep ?? 10;
  const names = await listRemoteBackups(cfg, options);
  if (names.length <= keep) return { removed: [], kept: names.length };
  const doomed = names.slice(0, names.length - keep);
  const removed = [];
  for (const name of doomed) {
    const target = joinUrl(cfg.url, cfg.dir, name);
    try {
      await webdavRequest(cfg, 'DELETE', encodePathUrl(target), { timeoutMs: options.timeoutMs });
      removed.push(name);
    } catch {
      // 删不掉就留着：备份多一份不算错，不能因此让上传失败
    }
  }
  return { removed, kept: names.length - removed.length };
}

/**
 * 一次完整的云端备份：上传 + 修剪。
 *
 * @returns {Promise<{url:string,fileName:string,bytes:number,removed:string[]}>}
 */
export async function pushBackupToCloud(cfg, input) {
  if (!cfg.configured) {
    throw new Error('WebDAV 还没配置：到「属于我们的回忆」设置里填服务器地址、账号、密码');
  }
  const uploaded = await uploadBackupText(cfg, input);
  let removed = [];
  try {
    const pruned = await pruneRemoteBackups(cfg, { timeoutMs: input.timeoutMs });
    removed = pruned.removed;
    if (removed.length) input.onLog?.(`云端清理了 ${removed.length} 份旧备份，保留 ${cfg.keep} 份`);
  } catch {
    // 修剪失败不影响上传成功
  }
  return { ...uploaded, removed };
}

/**
 * 试一次 WebDAV 连接：建目录（等于验写权限）+ 列一次目录，不上传任何文件。
 *
 * 用户按「测试连接」时走这条；它也能拿**还没保存**的草稿配置来试，所以
 * 参数就是一个普通的 normalize 结果，不读磁盘、不碰本地备份。
 *
 * @returns {Promise<{ok:true,url:string,dir:string,elapsedMs:number,remoteCount:number}>}
 */
export async function testConnection(cfg, options = {}) {
  if (!cfg || !cfg.configured) throw new Error('还没填 WebDAV 地址（要 http:// 或 https:// 开头）');
  const started = Date.now();
  await ensureRemoteDir(cfg, options);
  let remote = [];
  let listed = true;
  try {
    remote = await listRemoteBackups(cfg, { ...options, strict: true });
  } catch {
    // 有的网盘把 PROPFIND 关了。目录建得起来，就算连接正常。
    listed = false;
  }
  return {
    ok: true,
    url: cfg.url,
    dir: cfg.dir || '',
    elapsedMs: Date.now() - started,
    remoteCount: remote.length,
    listed,
  };
}

/**
 * 把常见的状态码翻译成人能看懂的一句话。
 *
 * 401 是「账号或应用密码不对」——坚果云/Nextcloud 都要求用应用专用密码，
 * 用登录密码会稳定 401，光看状态码很难猜到。
 */
export function explainWebdavError(err) {
  const message = err instanceof Error ? err.message : String(err);
  if (/\b401\b/.test(message)) return `${message} —— 账号或应用专用密码不对（多数网盘不让用登录密码）`;
  if (/\b403\b/.test(message)) return `${message} —— 账号没权限写这个目录`;
  if (/\b404\b/.test(message)) return `${message} —— 地址路径不对，检查是否需要写到 /dav/ 或 /remote.php/dav/files/用户名/`;
  if (/ENOTFOUND|EAI_AGAIN|fetch failed|getaddrinfo/i.test(message)) return `${message} —— 域名解析不了，检查地址有没有写错`;
  if (/timeout|aborted/i.test(message)) return `${message} —— 超时，可能这台机器连不上这个网盘`;
  return message;
}
