// 面板路由表 —— 2026-11-16 从 host 的大闭包里搬出来之后，这张表第一次能被单独检查。
//
// 搬之前这里出过一个真实事故：手写过一次路由清单，漏掉了 `export-md`，
// 于是那个按钮在界面上点不动，日志里一个字都没有。现在的规矩是
// **清单从 routes 现算，不手写** —— 这条测试就是替这条规矩站岗。
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createPanelRoutes, guardHandler } from '../src/host/panel-routes.mjs';

const deps = () => ({
  panelBase: '/feiyu-diary',
  pluginEntryId: 'dsh-hierarchical-fishmemory',
  log: () => {},
  warn: () => {},
  config: {},
  archiveDirectory: '/tmp/不存在',
  memoryRoot: '/tmp/不存在',
  panelReply: () => {},
  isSameOrigin: () => true,
  readPanelBody: async () => ({}),
  readPanelTextBody: async () => '',
  panelState: () => ({}),
  panelNotes: () => ({}),
  savePanelNote: async () => ({}),
  forgetEntry: async () => 0,
  pushTrash: () => {},
  cloudBackupOnce: async () => ({}),
  loadPromise: Promise.resolve(),
  drainPromise: Promise.resolve(),
  getWriteChain: () => Promise.resolve(),
  getArchive: () => ({ diary: [] }),
  getService: () => null,
  dshHome: () => '/tmp',
  cfgNow: () => ({}),
  configFileName: () => 'x.json',
  configBackupFormat: 'f',
  configBackupVersion: 1,
});

test('路由表：20 条，每条都带 kind / path / handler', () => {
  const routes = createPanelRoutes(deps());
  assert.equal(routes.length, 20);
  for (const r of routes) {
    assert.equal(r.kind, 'exact');
    assert.ok(String(r.path).startsWith('/feiyu-diary/'), r.path);
    assert.equal(typeof r.handler, 'function', r.path);
  }
});

test('路由表：路径不重复（重复注册会静默只生效一条）', () => {
  const paths = createPanelRoutes(deps()).map((r) => r.path);
  assert.equal(new Set(paths).size, paths.length);
});

test('路由表：export-md 在里面 —— 手写清单漏过它一次', () => {
  const paths = createPanelRoutes(deps()).map((r) => r.path);
  assert.ok(paths.includes('/feiyu-diary/export-md'));
});

test('路由表：base 换了，整张表跟着换', () => {
  const routes = createPanelRoutes({ ...deps(), panelBase: '/别的' });
  assert.ok(routes.every((r) => r.path.startsWith('/别的/')));
});

// ── 每条路由都真跑一遍 ────────────────────────────────────────────────
//
// 2026-11-16 一天里栽了两次同一类跟头：把七百多行搬出 host 之后，先漏了
// `memoryRoot`（装配期抛，连日志都没有，二十条路由一条不注册），后来又漏了
// `cloudState`（装配成功，只有 `/cloud` 那一行运行时抛 ReferenceError，
// webServer 兜底回 **400 + 零字节**，前端 `r.json()` 报
// 「Unexpected end of JSON input」—— 用户在设置页看到的是这句话）。
//
// 这一类错的特征：**代码看着完整，测试全绿，只有某一条路由在真实请求下才炸。**
// 所以这条测试不看静态结构，直接把 20 条 handler 都调一次，抓它们抛出的错，
// 断言里面没有「xxx is not defined」。
const NOOP = () => {};
const fakeRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    headersSent: false,
    writableEnded: false,
    replies: [],
    setHeader(k, v) {
      this.headers[k] = v;
    },
    end(body) {
      this.writableEnded = true;
      this.replies.push({ body });
    },
    destroy: NOOP,
  };
  return res;
};

test('每条路由都调一次：不许出现「xxx is not defined」', async () => {
  const warns = [];
  const base = deps();
  const routes = createPanelRoutes({
    ...base,
    warn: (...args) => warns.push(args.join(' ')),
    panelReply: (res, status, body) => {
      res.statusCode = status;
      res.replies.push({ status, body });
      res.writableEnded = true;
      return body;
    },
  });

  const requests = [
    { method: 'GET', url: '/feiyu-diary/x', headers: {} },
    { method: 'POST', url: '/feiyu-diary/x?confirm=1', headers: {} },
  ];
  for (const route of routes) {
    for (const req of requests) {
      const res = fakeRes();
      try {
        await route.handler(req, res);
      } catch (err) {
        // guardHandler 应该已经接住了；真漏到这里也算失败
        assert.fail(`${route.path} ${req.method} 直接抛了：${err && err.message}`);
      }
    }
  }
  const missing = warns.filter((w) => /is not defined/.test(w));
  assert.deepEqual(missing, [], `有路由引用了没声明也没传进来的变量：\n${missing.join('\n')}`);
});

// guardHandler：抛出去的错误必须变成一句能读的话，不能是空身子。
test('guardHandler：抛错时回 500 + 一句人话（不是空 400）', async () => {
  const warns = [];
  const res = fakeRes();
  const handler = guardHandler(async () => {
    throw new ReferenceError('cloudState is not defined');
  }, {
    path: '/feiyu-diary/cloud',
    warn: (...a) => warns.push(a.join(' ')),
    panelReply: (r, status, body) => {
      r.statusCode = status;
      r.replies.push({ status, body });
      r.writableEnded = true;
      return body;
    },
  });
  await handler({ method: 'GET', url: '/feiyu-diary/cloud', headers: {} }, res);
  assert.equal(res.replies.length, 1);
  assert.equal(res.replies[0].status, 500);
  assert.match(String(res.replies[0].body.error), /cloudState is not defined/);
  assert.equal(warns.length, 1);
  assert.match(warns[0], /面板接口 \/feiyu-diary\/cloud 出错/);
});

test('guardHandler：已经把响应写出去之后不再补一个', async () => {
  const res = fakeRes();
  res.headersSent = true;
  let destroyed = false;
  res.destroy = () => {
    destroyed = true;
  };
  const handler = guardHandler(async () => {
    res.headersSent = true;
    throw new Error('写到一半断了');
  }, {
    path: '/x',
    warn: () => {},
    panelReply: (r, status) => {
      r.replies.push({ status });
      return null;
    },
  });
  await handler({ method: 'GET', url: '/x', headers: {} }, res);
  assert.deepEqual(res.replies, []);
  assert.equal(destroyed, true);
});
