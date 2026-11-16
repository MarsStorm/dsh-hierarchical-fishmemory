/**
 * 面板的数据接口 —— 20 条路由、七百多行。
 *
 * 2026-11-16 从 `host/index.mjs` 的 `apply` 里整块搬出来。搬的理由：
 * 这一段是所有功能都做完了之后一块一块贴上来的（导出、导入、各本子的读写、
 * 体检、修改时间线、云端配置），贴在记忆逻辑正中间，把「注入怎么拼」
 * 和「HTTP 怎么答」两件事搅在一个 5000 行的闭包里。
 *
 * 搬出来之后有一件事必须明说：**这里不持有状态，也不许持有。**
 * `archive` / `writeChain` 是 host 里会被重新赋值的变量，所以用
 * `getArchive()` / `getWriteChain()` 取当次的值，不能注册时抓一份
 * —— 抓一份就等于永远看着那份旧的（这个 bug 我在 `lastShownTurn` 上踩过）。
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { packArchive } from '../core/archive.mjs';
import {
  backupFileName,
  buildRegisteredBackup,
  restoreViaRegistered,
  summarizeBackup,
  writeBackupFile,
} from '../core/backup.mjs';
import { CONFIG_SPEC } from '../core/config.mjs';
import { errorText } from '../core/errors.mjs';
import { buildBook, buildYearBook } from '../core/export-md.mjs';
import { FEELINGS_MD } from '../core/files.mjs';
import { HANDNOTE_FILE } from '../core/handnote.mjs';
import { LESSON_FILE } from '../core/lesson.mjs';
import { LEDGER_FILE, ledgerReport } from '../core/ledger.mjs';
import {
  collectLayerReport,
  collectReview,
  collectStatsFromDisk,
  readDiaryEntries,
} from '../core/stats.mjs';
import { STICKY_FILE } from '../core/sticky.mjs';
import { TZ_OFFSET_MS } from '../core/timeline.mjs';
import {
  downloadRemoteText,
  explainWebdavError,
  listRemoteBackups,
  listRemoteConfigs,
  normalizeWebdavConfig,
  testConnection,
  uploadBackupText,
} from '../core/webdav.mjs';

/**
 * 给每条 handler 包一层：抛出去的错误要变成**一句能读的话**，不能变成空身子。
 *
 * 2026-11-16 的教训，一天里犯了两次。第一次是把这七百多行搬出 host 时漏传
 * `memoryRoot`，二十条路由一条都没注册（装配期抛，连日志都没有）。第二次是
 * 漏传 `cloudState`：装配成功，只有 `/cloud` 那一行在运行时抛 ReferenceError，
 * webServer 兜底回一个 **400 + 零字节**，前端 `r.json()` 于是报
 * 「Unexpected end of JSON input」—— 用户在界面上看到的是这句话，
 * 而不是「cloudState is not defined」。
 *
 * 一个没内容的错误比一句难听的错误坏得多：它把「我哪里漏了一个参数」
 * 伪装成「网络或服务端出了玄学问题」，于是没人会去查代码。
 */
export function guardHandler(handler, { path, warn, panelReply }) {
  return async function guardedHandler(req, res) {
    try {
      return await handler(req, res);
    } catch (err) {
      const message = errorText(err);
      try {
        warn(`面板接口 ${String(path)} 出错：${message}`);
      } catch {
        // 日志本身出错不该再抛一次
      }
      if (res.headersSent || res.writableEnded) {
        try {
          res.destroy?.();
        } catch {
          // 连不上就算了
        }
        return undefined;
      }
      return panelReply(res, 500, { ok: false, error: message });
    }
  };
}

/**
 * 造出整张路由表。要什么给什么，缺一个就在启动时报错 ——
 * 别做成"少给了就静默少一条路由"。
 *
 * @returns {Array<{kind:string, path:string, handler:Function}>}
 */
export function createPanelRoutes(deps) {
  const {
    panelBase,
    pluginEntryId,
    log,
    warn,
    config,
    archiveDirectory,
    memoryRoot,
    panelReply,
    isSameOrigin,
    readPanelBody,
    readPanelTextBody,
    panelState,
    panelNotes,
    savePanelNote,
    forgetEntry,
    pushTrash,
    cloudBackupOnce,
    cloudState,
    loadPromise,
    drainPromise,
    getWriteChain,
    getArchive,
    getService,
    dshHome,
    cfgNow,
    configFileName,
    configBackupFormat,
    configBackupVersion,
  } = deps;

  const routes = [
  {
    kind: 'exact',
    path: `${panelBase}/state`,
    handler: async (req, res) => {
      if (req.method !== 'GET') return panelReply(res, 405, { ok: false, error: 'method' });
      await loadPromise;
      return panelReply(res, 200, panelState());
    },
  },
  {
    kind: 'exact',
    path: `${panelBase}/forget`,
    handler: async (req, res) => {
      if (req.method !== 'POST') return panelReply(res, 405, { ok: false, error: 'method' });
      try {
        const body = await readPanelBody(req);
        const removed = await forgetEntry(body?.id);
        return panelReply(res, 200, { ok: true, removed, count: getArchive().diary.length });
      } catch (err) {
        return panelReply(res, 400, {
          ok: false,
          error: errorText(err),
        });
      }
    },
  },
  {
    kind: 'exact',
    path: `${panelBase}/notes`,
    handler: async (req, res) => {
      if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
      if (req.method === 'GET') return panelReply(res, 200, { ok: true, notes: panelNotes() });
      if (req.method === 'POST') {
        try {
          const saved = await savePanelNote(await readPanelBody(req));
          return panelReply(res, 200, { ok: true, saved });
        } catch (err) {
          return panelReply(res, 400, {
            ok: false,
            error: errorText(err),
          });
        }
      }
      return panelReply(res, 405, { ok: false, error: 'method' });
    },
  },
  {
    kind: 'exact',
    path: `${panelBase}/export`,
    handler: async (req, res) => {
      if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
      if (req.method !== 'GET') return panelReply(res, 405, { ok: false, error: 'method' });
      try {
        // 等到挂起的写盘落定，导出的是**磁盘上那份**档案
        await loadPromise;
        await drainPromise;
        await getWriteChain();
        const bytes = packArchive(getArchive());
        const name = `feiyu-diary-${new Date().toISOString().slice(0, 10)}.dshpack`;
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
        res.setHeader('Cache-Control', 'no-store');
        res.end(Buffer.from(bytes));
      } catch (err) {
        return panelReply(res, 500, {
          ok: false,
          error: errorText(err),
        });
      }
    },
  },
  {
    // 全量备份：四本账 + 人设卡打包成一个 JSON。
    // 为什么在这里而不是 host 自己拼：人设卡只有 soul 半边读得到，
    // 所以真正的收集动作由它挂到 `fishMemory` 服务上的 `buildBackup` 做。
    kind: 'exact',
    path: `${panelBase}/backup`,
    handler: async (req, res) => {
      if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
      if (req.method !== 'GET') return panelReply(res, 405, { ok: false, error: 'method' });
      try {
        // 等挂起的写盘落定，备份的是磁盘上那份
        await loadPromise;
        await drainPromise;
        await getWriteChain();
        const build = getService('fishMemory')?.buildBackup;
        const backup = typeof build === 'function' ? await build() : await buildRegisteredBackup();
        backup.meta.counts = summarizeBackup(backup);
        const { file, bytes } = await writeBackupFile(backup, path.join(dshHome(), 'backups'), { fileName: backupFileName() });
        const display = `属于我们的回忆-${path.basename(file).replace(/^备份-/, '备份')}`;
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="fishmemory-backup.json"; filename*=UTF-8''${encodeURIComponent(display)}`,
        );
        res.setHeader('Cache-Control', 'no-store');
        res.end(readFileSync(file));
        log(`全量备份已生成：${file}（${bytes} 字节）`);
      } catch (err) {
        return panelReply(res, 500, {
          ok: false,
          error: errorText(err),
        });
      }
    },
  },
  {
    // 导入备份：前端把整份 JSON 当请求体发上来。
    //
    // `?confirm=1` 才真写；不带就只算一遍给人看（dry-run）。真正的还原
    // 动作在 soul 半边 —— 人设卡只有它读得到；本路由只负责收文件、
    // 转手、回一句话。
    kind: 'exact',
    path: `${panelBase}/restore`,
    handler: async (req, res) => {
      if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
      if (req.method !== 'POST') return panelReply(res, 405, { ok: false, error: 'method' });
      const confirm = /[?&]confirm=(?:1|true|yes)\b/i.test(String(req.url ?? ''));
      try {
        const text = await readPanelTextBody(req);
        if (!text.trim()) return panelReply(res, 400, { ok: false, error: '请求体是空的：没收到备份文件' });
        await loadPromise;
        await drainPromise;
        await getWriteChain();
        const restore = getService('fishMemory')?.restoreBackup;
        const result = typeof restore === 'function'
          ? await restore({ text, confirm, sourceLabel: '面板上传' })
          : await restoreViaRegistered({ text, confirm, sourceLabel: '面板上传' });
        log(`备份导入${confirm ? '已落盘' : '（dry-run）'}：${result.writes} 个文件、${result.cards} 张人设卡`);
        return panelReply(res, 200, { ok: true, ...result });
      } catch (err) {
        return panelReply(res, 400, {
          ok: false,
          error: errorText(err),
        });
      }
    },
  },
  {
    // 把四本账导出成一册 Markdown：给人读、能打印，不是给机器搬家用。
    //
    // 复用 buildRegisteredBackup()：它已经在另一个半边把备份对象组好了，
    // 这里只换一种渲染方式，不重读磁盘。
    kind: 'exact',
    path: `${panelBase}/export-md`,
    handler: async (req, res) => {
      if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
      if (req.method !== 'GET') return panelReply(res, 405, { ok: false, error: '只支持 GET' });
      try {
        const build = getService('fishMemory')?.buildBackup;
        const backup = typeof build === 'function' ? await build() : await buildRegisteredBackup();
        const text = buildBook(backup);
        const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        res.writeHead(200, {
          'content-type': 'text/markdown; charset=utf-8',
          'content-disposition': `attachment; filename="archive-${stamp}.md"; filename*=UTF-8''${encodeURIComponent(`属于我们的回忆-${stamp}.md`)}`,
          'cache-control': 'no-store',
        });
        res.end(text);
        log(`导出 Markdown：${text.length} 字节`);
      } catch (err) {
        return panelReply(res, 500, {
          ok: false,
          error: errorText(err),
        });
      }
    },
  },
  {
    // 年册：一年的共度时光按月排，情感日记按天排。
    //
    // 2026-11-03 加。整册 export-md 是一整本，翻到去年要滚很久；
    // 年册是「那一年」，更适合打印、或者发给谁看。
    kind: 'exact',
    path: `${panelBase}/export-year`,
    handler: async (req, res) => {
      if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
      if (req.method !== 'GET') return panelReply(res, 405, { ok: false, error: '只支持 GET' });
      try {
        const url = new URL(req.url ?? '', 'http://127.0.0.1');
        // 默认今年按他的钟点（UTC+8）算，跨年那几天不会串。
        const year =
          (url.searchParams.get('year') ?? '').trim() ||
          String(new Date(Date.now() + TZ_OFFSET_MS).getUTCFullYear());
        if (!/^\d{4}$/.test(year)) {
          return panelReply(res, 400, { ok: false, error: 'year 要四位年份，比如 2026' });
        }
        const build = getService('fishMemory')?.buildBackup;
        const backup = typeof build === 'function' ? await build() : await buildRegisteredBackup();
        const text = buildYearBook(backup, { year });
        res.writeHead(200, {
          'content-type': 'text/markdown; charset=utf-8',
          'content-disposition': `attachment; filename="year-${year}.md"; filename*=UTF-8''${encodeURIComponent(`属于我们的回忆-${year}.md`)}`,
          'cache-control': 'no-store',
        });
        res.end(text);
        log(`导出年册 ${year}：${text.length} 字节`);
      } catch (err) {
        return panelReply(res, 500, {
          ok: false,
          error: errorText(err),
        });
      }
    },
  },
  {
    // 情感日记：面板里能读能改。
    //
    // 为什么走服务端：文件在 $DSH_HOME 下，浏览器碰不到；更要紧的是
    // 写之前要自动存一份旧版 —— 这是整套记忆里唯一不会被别的进程
    // 重写的一本账，覆盖了就真没了。
    kind: 'exact',
    path: `${panelBase}/feelings`,
    handler: async (req, res) => {
      if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
      const file = path.join(archiveDirectory, FEELINGS_MD);
      if (req.method === 'GET') {
        let text = '';
        try {
          text = readFileSync(file, 'utf8');
        } catch {
          text = '';
        }
        return panelReply(res, 200, {
          ok: true,
          text,
          chars: [...text].length,
          lines: text ? text.split('\n').length : 0,
        });
      }
      if (req.method !== 'POST') return panelReply(res, 405, { ok: false, error: '只支持 GET / POST' });
      try {
        const body = JSON.parse((await readPanelTextBody(req, { limit: 1024 * 1024 })) || '{}');
        const text = String(body.text ?? '');
        if (!text.trim()) return panelReply(res, 400, { ok: false, error: '内容不能为空（要整篇删掉就自己去删文件）' });
        let previous = '';
        try {
          previous = readFileSync(file, 'utf8');
        } catch {
          previous = '';
        }
        if (previous === text) return panelReply(res, 200, { ok: true, unchanged: true, chars: [...text].length });
        let snapshot = '';
        if (previous) {
          const dir = path.join(dshHome(), 'backups', 'feelings');
          mkdirSync(dir, { recursive: true });
          snapshot = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}.md`);
          writeFileSync(snapshot, previous);
        }
        writeFileSync(file, text.endsWith('\n') ? text : `${text}\n`);
        log(`情感日记已保存（${[...text].length} 字符）`);
        return panelReply(res, 200, { ok: true, chars: [...text].length, snapshot });
      } catch (err) {
        return panelReply(res, 400, { ok: false, error: errorText(err) });
      }
    },
  },
  {
    // 体检页「以这条为准」：把某一层里旧的值统一成新的值。
    //
    // 只替换「出现了这个值」的行，整行不动别的字；找不到就报错，
    // 不做模糊匹配 —— 记忆文件里改错一个字，代价比漏改大。
    kind: 'exact',
    path: `${panelBase}/layer/value`,
    handler: async (req, res) => {
      if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
      if (req.method !== 'POST') return panelReply(res, 405, { ok: false, error: '只支持 POST' });
      try {
        const body = JSON.parse((await readPanelTextBody(req, { limit: 64 * 1024 })) || '{}');
        const target = String(body.target ?? '');
        const memoryRoot = path.join(dshHome(), 'soul-md', 'memory');
        let file = '';
        if (target.startsWith('core:')) {
          file = path.join(memoryRoot, target.slice(5), 'core.md');
        } else if (target.startsWith('topic:')) {
          const rest = target.slice(6);
          const idx = rest.indexOf(':');
          if (idx > 0) file = path.join(memoryRoot, rest.slice(0, idx), 'topics', `${rest.slice(idx + 1)}.md`);
        } else if (target === 'handnote') {
          file = path.join(archiveDirectory, HANDNOTE_FILE);
        } else if (target === 'sticky') {
          file = path.join(archiveDirectory, STICKY_FILE);
        } else if (target === 'lesson') {
          file = path.join(archiveDirectory, LESSON_FILE);
        } else if (target === 'feelings') {
          file = path.join(archiveDirectory, FEELINGS_MD);
        }
        if (!file) return panelReply(res, 400, { ok: false, error: '不认识这一层（浅层请在面板里改）' });
        const from = String(body.from ?? '').trim();
        const to = String(body.to ?? '').trim();
        if (!from || !to) return panelReply(res, 400, { ok: false, error: '缺 from / to' });
        if (!existsSync(file)) return panelReply(res, 404, { ok: false, error: '这一层的文件不存在' });
        const lines = readFileSync(file, 'utf8').split('\n');
        let changed = 0;
        const next = lines.map((line) => {
          if (!line.includes(from)) return line;
          changed += 1;
          return line.split(from).join(to);
        });
        if (changed === 0) return panelReply(res, 404, { ok: false, error: `这一层里找不到 ${from}` });
        writeFileSync(file, next.join('\n'));
        log(`层间冲突统一成 ${to}（${changed} 行，${target}）`);
        return panelReply(res, 200, { ok: true, changed, target });
      } catch (err) {
        return panelReply(res, 400, { ok: false, error: errorText(err) });
      }
    },
  },
  {
    // 体检页「删掉重复的那一份」：不管重复落在哪一层都能删。
    //
    // 按 target 认文件（`core:<scope>` / `topic:<scope>:<key>` /
    // `handnote` / `feelings`）。只做「整行精确匹配」，不做模糊删除。
    // 2026-11-03：原先只认手记的 `/handnote/delete` 已删，功能被这条覆盖。
    kind: 'exact',
    path: `${panelBase}/layer/remove`,
    handler: async (req, res) => {
      if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
      if (req.method !== 'POST') return panelReply(res, 405, { ok: false, error: '只支持 POST' });
      try {
        const body = JSON.parse((await readPanelTextBody(req, { limit: 64 * 1024 })) || '{}');
        const target = String(body.target ?? '');
        const memoryRoot = path.join(dshHome(), 'soul-md', 'memory');
        let file = '';
        if (target.startsWith('core:')) {
          file = path.join(memoryRoot, target.slice(5), 'core.md');
        } else if (target.startsWith('topic:')) {
          const rest = target.slice(6);
          const idx = rest.indexOf(':');
          if (idx > 0) file = path.join(memoryRoot, rest.slice(0, idx), 'topics', `${rest.slice(idx + 1)}.md`);
        } else if (target === 'handnote') {
          file = path.join(archiveDirectory, HANDNOTE_FILE);
        } else if (target === 'sticky') {
          file = path.join(archiveDirectory, STICKY_FILE);
        } else if (target === 'lesson') {
          file = path.join(archiveDirectory, LESSON_FILE);
        } else if (target === 'feelings') {
          file = path.join(archiveDirectory, FEELINGS_MD);
        }
        if (!file) return panelReply(res, 400, { ok: false, error: '不认识这一层（浅层请用 shallow_forget）' });
        const wanted = String(body.line ?? '').trim().replace(/^[-*+]\s+/, '');
        if (!wanted) return panelReply(res, 400, { ok: false, error: '没给要删的那一行（line）' });
        if (!existsSync(file)) return panelReply(res, 404, { ok: false, error: '这一层的文件不存在' });
        const keep = [];
        let removed = 0;
        for (const line of readFileSync(file, 'utf8').split('\n')) {
          if (line.trim().replace(/^[-*+]\s+/, '').trim() === wanted) {
            removed += 1;
            continue;
          }
          keep.push(line);
        }
        if (!removed) return panelReply(res, 404, { ok: false, error: '这一层里找不到那一行' });
        // 删前留底：这里删的是"重复的那一份"，但判重复的是人 ——
        // 判错了就是整行没了，而这一层多半只有一两行。
        pushTrash({
          kind: 'line',
          payload: { target, line: wanted, file: path.basename(file) },
          label: `${target}：${wanted.slice(0, 60)}`,
        });
        writeFileSync(file, keep.join('\n'));
        log(`删掉重复的一行（${target}），共 ${removed} 行`);
        return panelReply(res, 200, { ok: true, removed, target });
      } catch (err) {
        return panelReply(res, 400, { ok: false, error: errorText(err) });
      }
    },
  },
  {
    // 记忆体检：四本账条数、体积、注入估算、重复提示。
    //
    // 只读不写。走磁盘扫描而不是 memoryLayout —— 两个 cordis 入口的模块
    // 实例不共享，host 这边拿不到 soul 的 layout 实例。
    kind: 'exact',
    path: `${panelBase}/stats`,
    handler: async (req, res) => {
      if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
      if (req.method !== 'GET') return panelReply(res, 405, { ok: false, error: '只支持 GET' });
      try {
        const memoryRoot = path.join(dshHome(), 'soul-md', 'memory');
        const diaryDir = path.join(dshHome(), 'feiyu-diary');
        const stats = collectStatsFromDisk({ memoryRoot, diaryDir });
        const layers = collectLayerReport({ memoryRoot, diaryDir });
        // 对账：账本 vs 磁盘 vs **注入真正用的那份**。
        //
        // 第三个数只有面板才知道：注入读的是内存里的 archive，磁盘读的是
        // 日志文件，两边平时一样，但「持久化失败」这种事不会报错 ——
        // 于是我会看到一个数、他看到另一个数，谁都没错，就是不一样。
        // 2026-11-16 那两份设计文档里都管这叫「一个事实源」，我这里是三条线。
        let recon = null;
        try {
          let memoryCount = null;
          try {
            const live = getArchive();
            memoryCount = Array.isArray(live?.diary) ? live.diary.length : null;
          } catch {
            memoryCount = null;
          }
          recon = ledgerReport({
            file: path.join(diaryDir, LEDGER_FILE),
            entries: readDiaryEntries(diaryDir),
            memoryCount,
          });
        } catch (err) {
          recon = { ok: false, text: `对账失败：${errorText(err)}`, line: '账本=?', missing: [], rewritten: [] };
        }
        return panelReply(res, 200, { ok: true, ...stats, ...layers, recon });
      } catch (err) {
        return panelReply(res, 500, {
          ok: false,
          error: errorText(err),
        });
      }
    },
  },
  {
    // 回顾：共度时光按天分组，最近 N 天 +「X 天前的今天」。
    kind: 'exact',
    path: `${panelBase}/review`,
    handler: async (req, res) => {
      if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
      if (req.method !== 'GET') return panelReply(res, 405, { ok: false, error: '只支持 GET' });
      try {
        const params = new URL(String(req.url ?? ''), 'http://localhost').searchParams;
        const days = Math.min(Math.max(Number(params.get('days')) || 7, 1), 60);
        const lookback = Math.min(Math.max(Number(params.get('lookback')) || 7, 1), 365);
        const diaryDir = path.join(dshHome(), 'feiyu-diary');
        const review = collectReview({ diaryDir, days, lookback });
        return panelReply(res, 200, { ok: true, ...review });
      } catch (err) {
        return panelReply(res, 500, {
          ok: false,
          error: errorText(err),
        });
      }
    },
  },
  {
    // 云端备份（WebDAV）：POST = 立刻生成一份新备份并上传；GET = 看状态。
    //
    // 为什么不用前端上传文件：备份必须用**磁盘上那份**现在的内容，
    // 不能在浏览器里拼 —— 人设卡与深层记忆只有服务端读得到。
    kind: 'exact',
    path: `${panelBase}/cloud`,
    handler: async (req, res) => {
      if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
      const wd = normalizeWebdavConfig(cfgNow());
      if (req.method === 'GET') {
        let remote = null;
        if (/[?&]list=1\b/.test(String(req.url ?? '')) && wd.configured && wd.enabled) {
          try {
            remote = await listRemoteBackups(wd);
          } catch (err) {
            remote = { error: errorText(err) };
          }
        }
        return panelReply(res, 200, {
          ok: true,
          enabled: wd.enabled,
          configured: wd.configured,
          dir: wd.dir,
          auto: wd.auto,
          keep: wd.keep,
          username: wd.username,
          url: wd.url,
          user: wd.username,
          passwordSet: wd.password !== '',
          lastAt: cloudState.lastAt,
          lastFile: cloudState.lastFile,
          lastBytes: cloudState.lastBytes,
          lastRemoved: cloudState.lastRemoved,
          lastReason: cloudState.lastReason,
          lastError: cloudState.lastError,
          remote: Array.isArray(remote) ? remote : remote,
        });
      }
      if (req.method !== 'POST') return panelReply(res, 405, { ok: false, error: 'method' });
      try {
        await loadPromise;
        const result = await cloudBackupOnce({ reason: 'panel' });
        return panelReply(res, 200, { ok: true, ...result });
      } catch (err) {
        return panelReply(res, 400, {
          ok: false,
          error: errorText(err),
        });
      }
    },
  },
  {
    // 测 WebDAV 连不连得上：POST 试一次「建目录 + 列目录」，不上传、不改数据。
    //
    // 接受表单里的**草稿**（url/user/password/dir），所以能在保存之前先试；
    // 密码留空表示沿用已保存的那个（界面上从不回显密码）。
    kind: 'exact',
    path: `${panelBase}/cloud/test`,
    handler: async (req, res) => {
      if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
      if (req.method !== 'POST') return panelReply(res, 405, { ok: false, error: 'method' });
      try {
        const text = await readPanelTextBody(req, { limit: 64 * 1024 });
        const patch = JSON.parse(text || '{}');
        const raw = { ...cfgNow() };
        const take = (key, max) => {
          if (patch[key] === undefined) return;
          raw[key] = String(patch[key] ?? '').trim().slice(0, max);
        };
        take('webdavUrl', 512);
        take('webdavUser', 256);
        take('webdavDir', 200);
        if (patch.webdavPassword) raw.webdavPassword = String(patch.webdavPassword).slice(0, 512);
        const wd = normalizeWebdavConfig(raw);
        const result = await testConnection(wd);
        log(`云端连接测试通过：${result.url}（${result.elapsedMs} ms${result.listed ? `，云端 ${result.remoteCount} 份备份` : ''}）`);
        return panelReply(res, 200, { ...result, dirWritable: true });
      } catch (err) {
        const message = explainWebdavError(err);
        warn(`云端连接测试失败：${message}`);
        return panelReply(res, 400, { ok: false, error: message });
      }
    },
  },
  {
      // 配置备份：GET 列出云端有哪些 `配置-*.json`；POST 把当前配置传上去。
      //
      // 为什么只装配置：四本账有 fish_backup / /cloud 那条路，这里只解决
      // 「换设备不用重填一遍 WebDAV 账号、保留份数、预算」这种小麻烦。
      kind: 'exact',
      path: `${panelBase}/cloud/config-backup`,
      handler: async (req, res) => {
        if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
        const wd = normalizeWebdavConfig(cfgNow());
        if (req.method === 'GET') {
          if (!wd.configured) return panelReply(res, 200, { ok: true, configured: false, files: [] });
          try {
            const files = await listRemoteConfigs(wd);
            return panelReply(res, 200, { ok: true, configured: true, files });
          } catch (err) {
            return panelReply(res, 400, { ok: false, error: explainWebdavError(err) });
          }
        }
        if (req.method !== 'POST') return panelReply(res, 405, { ok: false, error: 'method' });
        try {
          if (!wd.configured) throw new Error('WebDAV 还没配置：先把服务器地址、账号、密码填上');
          const payload = {
            format: configBackupFormat,
            version: configBackupVersion,
            exportedAt: new Date().toISOString(),
            entryId: pluginEntryId,
            config: { ...cfgNow() },
          };
          const fileName = configFileName();
          const text = `${JSON.stringify(payload, null, 2)}\n`;
          const uploaded = await uploadBackupText(wd, { text, fileName });
          log(`配置已传到云端：${uploaded.fileName}（${uploaded.bytes} 字节）`);
          return panelReply(res, 200, { ok: true, ...uploaded });
        } catch (err) {
          const message = explainWebdavError(err);
          warn(`配置上传失败：${message}`);
          return panelReply(res, 400, { ok: false, error: message });
        }
      },
    },
    {
      // 从云端恢复配置：默认 dry-run，只报「哪几项会变」；confirm 才写回 settings。
      kind: 'exact',
      path: `${panelBase}/cloud/config-restore`,
      handler: async (req, res) => {
        if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
        if (req.method !== 'POST') return panelReply(res, 405, { ok: false, error: 'method' });
        try {
          const text = await readPanelTextBody(req, { limit: 256 * 1024 });
          const body = JSON.parse(text || '{}');
          const fileName = String(body.file ?? '').split(/[\\/]/).pop() ?? '';
          if (!fileName.startsWith('配置-')) throw new Error('请选一个 `配置-…json` 文件');
          const wd = normalizeWebdavConfig(cfgNow());
          if (!wd.configured) throw new Error('WebDAV 还没配置，恢复不了');
          const got = await downloadRemoteText(wd, fileName);
          let payload;
          try {
            payload = JSON.parse(got.text);
          } catch {
            throw new Error('这份文件不是 JSON，可能不是配置备份');
          }
          if (payload?.format !== configBackupFormat) throw new Error('这份文件不是本插件的配置备份');
          const raw = payload?.config && typeof payload.config === 'object' ? payload.config : {};
          const known = CONFIG_SPEC.map((item) => item.key);
          const picked = {};
          for (const key of known) {
            if (raw[key] !== undefined) picked[key] = raw[key];
          }
          const current = cfgNow();
          const changes = {};
          for (const [key, value] of Object.entries(picked)) {
            if (key === 'webdavPassword') {
              if (String(value ?? '') !== String(current[key] ?? '')) changes[key] = ['（已保存的密码）', '（备份里的密码）'];
              continue;
            }
            const before = current[key];
            if (JSON.stringify(before) !== JSON.stringify(value)) {
              changes[key] = [before, value];
            }
          }
          const result = {
            ok: true,
            file: fileName,
            exportedAt: payload.exportedAt ?? '',
            keys: Object.keys(picked).length,
            changes,
            passwordIncluded: typeof picked.webdavPassword === 'string' && picked.webdavPassword !== '',
          };
          if (body.confirm !== true) return panelReply(res, 200, { ...result, dryRun: true, applied: [] });
          const settings = getService('settings');
          if (!settings || typeof settings.update !== 'function') throw new Error('设置服务不可用，恢复不了');
          const next = { ...current, ...picked };
          await settings.update(pluginEntryId, next);
          const wd2 = normalizeWebdavConfig(cfgNow());
          log(`配置已从云端恢复：${fileName}（${Object.keys(picked).length} 项）`);
          return panelReply(res, 200, {
            ...result,
            dryRun: false,
            applied: Object.keys(picked),
            configured: wd2.configured,
            dir: wd2.dir,
            keep: wd2.keep,
          });
        } catch (err) {
          const message = explainWebdavError(err);
          warn(`配置恢复失败：${message}`);
          return panelReply(res, 400, { ok: false, error: message });
        }
      },
    },
  {
    // 云端记忆备份：GET = 列云端 备份-*.json；POST = 从云端拉一份回来还原。
    //
    // 和本地「导入备份」只差上游：这里从 WebDAV 下载整包 JSON，之后的
    // dry-run / confirm / 还原前快照全都走同一条 restoreFromText，不另开一套。
    kind: 'exact',
    path: `${panelBase}/cloud/backups`,
    handler: async (req, res) => {
      if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
      if (req.method !== 'GET') return panelReply(res, 405, { ok: false, error: 'method' });
      const wd = normalizeWebdavConfig(cfgNow());
      if (!wd.configured) return panelReply(res, 200, { ok: true, configured: false, files: [] });
      try {
        const files = await listRemoteBackups(wd);
        return panelReply(res, 200, { ok: true, configured: true, dir: wd.dir, files });
      } catch (err) {
        return panelReply(res, 400, { ok: false, error: explainWebdavError(err) });
      }
    },
  },
  {
    kind: 'exact',
    path: `${panelBase}/cloud/restore`,
    handler: async (req, res) => {
      if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
      if (req.method !== 'POST') return panelReply(res, 405, { ok: false, error: 'method' });
      const confirm = /[?&]confirm=(?:1|true|yes)\b/i.test(String(req.url ?? ''));
      try {
        const text = await readPanelTextBody(req, { limit: 256 * 1024 });
        const body = JSON.parse(text || '{}');
        const fileName = String(body.file ?? '').split(/[\\/]/).pop() ?? '';
        if (!/^备份-.+\.json$/.test(fileName)) throw new Error('请选一个 `备份-…json` 文件');
        const wd = normalizeWebdavConfig(cfgNow());
        if (!wd.configured) throw new Error('WebDAV 还没配置，恢复不了');
        const got = await downloadRemoteText(wd, fileName);
        await loadPromise;
        await drainPromise;
        await getWriteChain();
        const restore = getService('fishMemory')?.restoreBackup;
        const mode = String(got.mode ?? '').toLowerCase() === 'merge' ? 'merge' : 'replace';
      const input = { text: got.text, confirm, sourceLabel: `云端 ${fileName}`, mode };
        const result = typeof restore === 'function'
          ? await restore(input)
          : await restoreViaRegistered(input);
        log(`云端备份${confirm ? '已还原' : '（dry-run）'}：${fileName} · ${result.writes} 个文件、${result.cards} 张人设卡`);
        return panelReply(res, 200, { ok: true, file: fileName, ...result });
      } catch (err) {
        return panelReply(res, 400, { ok: false, error: explainWebdavError(err) });
      }
    },
  },
  {
    // 云端备份的配置写入：POST = 把表单内容写回 profile patch 里的本 entry。
    //
    // 为什么走服务端：配置是 cordis 的 settings 文档，写它要走
    // `settings.update(entryId, …)`（带 revision 与重载）；前端直接改
    // yaml 会踩缩进与转义，还会在下次装插件时被覆盖。
    kind: 'exact',
    path: `${panelBase}/cloud/config`,
    handler: async (req, res) => {
      if (!isSameOrigin(req)) return panelReply(res, 403, { ok: false, error: '跨站请求不予处理' });
      if (req.method !== 'POST') return panelReply(res, 405, { ok: false, error: 'method' });
      try {
        const text = await readPanelTextBody(req, { limit: 64 * 1024 });
        const patch = JSON.parse(text || '{}');
        const next = { ...cfgNow() };
        const putString = (key, max) => {
          if (patch[key] === undefined) return;
          next[key] = String(patch[key] ?? '').trim().slice(0, max);
        };
        putString('webdavUrl', 512);
        putString('webdavUser', 256);
        putString('webdavDir', 200);
        if (patch.webdavPassword !== undefined) {
          // 空串 = 显式清空；前端不传这个键就保留原密码。
          next.webdavPassword = String(patch.webdavPassword ?? '').slice(0, 512);
        }
        if (patch.webdavAuto !== undefined) next.webdavAuto = Boolean(patch.webdavAuto);
        if (patch.webdavEnabled !== undefined) next.webdavEnabled = Boolean(patch.webdavEnabled);
        if (patch.webdavKeep !== undefined) {
          const keep = Number(patch.webdavKeep);
          next.webdavKeep = Number.isFinite(keep) ? Math.min(200, Math.max(1, Math.round(keep))) : 10;
        }
        const settings = getService('settings');
        if (!settings || typeof settings.update !== 'function') {
          throw new Error('设置服务不可用，改不了配置：可以直接改 profile 的 cordis.patch.yml');
        }
        await settings.update(pluginEntryId, next);
        const wd = normalizeWebdavConfig(cfgNow());
        log(`云端配置已保存：${wd.configured ? '已填地址' : '地址为空'}${wd.enabled ? '' : '（总开关关着）'}`);
        return panelReply(res, 200, {
          ok: true,
          enabled: wd.enabled,
          configured: wd.configured,
          url: wd.url,
          user: wd.username,
          passwordSet: wd.password !== '',
          dir: wd.dir,
          auto: wd.auto,
          keep: wd.keep,
        });
      } catch (err) {
        return panelReply(res, 400, {
          ok: false,
          error: errorText(err),
        });
      }
    },
  },
  ];
  // 每一条都包上 guardHandler：抛出去也不许出现「400 + 零字节」。
  return routes.map((route) => ({
    ...route,
    handler: guardHandler(route.handler, { path: route.path, warn, panelReply }),
  }));
}
