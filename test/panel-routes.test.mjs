// 面板路由表 —— 2026-11-16 从 host 的大闭包里搬出来之后，这张表第一次能被单独检查。
//
// 搬之前这里出过一个真实事故：手写过一次路由清单，漏掉了 `export-md`，
// 于是那个按钮在界面上点不动，日志里一个字都没有。现在的规矩是
// **清单从 routes 现算，不手写** —— 这条测试就是替这条规矩站岗。
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createPanelRoutes } from '../src/host/panel-routes.mjs';

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
