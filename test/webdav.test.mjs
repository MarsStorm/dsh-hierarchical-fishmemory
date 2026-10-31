/**
 * WebDAV 云端备份的测试。
 *
 * 不起真网盘：本地起一个只认这么几个动词的假 WebDAV 服务。
 * 要验的其实不是「HTTP 能不能通」，而是四件容易写错的事：
 *
 *   · 中文目录名要 encodePath，否则 MKCOL 404
 *   · 目录已存在（405/409）必须当成功，否则第二次上传才开始报错
 *   · PROPFIND 的 href 要解码回中文，且只认 `备份-*.json`
 *   · 修剪按「旧 → 新」删最旧的，且删不掉不能让上传失败
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import {
  authHeader,
  encodePath,
  ensureRemoteDir,
  joinUrl,
  listRemoteBackups,
  listRemoteConfigs,
  downloadRemoteText,
  normalizeWebdavConfig,
  pruneRemoteBackups,
  pushBackupToCloud,
  uploadBackupText,
  testConnection,
  explainWebdavError,
} from '../src/core/webdav.mjs';

/** 一个够用的假 WebDAV：内存里存目录和文件。 */
function startFakeServer() {
  const dirs = new Set(['/dav']);
  const files = new Map();
  const seen = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      seen.push(`${req.method} ${pathname}`);
      if (req.method === 'MKCOL') {
        if (dirs.has(pathname)) {
          res.writeHead(405);
          return res.end();
        }
        dirs.add(pathname);
        res.writeHead(201);
        return res.end();
      }
      if (req.method === 'PUT') {
        files.set(pathname, body);
        res.writeHead(201);
        return res.end();
      }
      if (req.method === 'PROPFIND') {
        const prefix = pathname.endsWith('/') ? pathname : `${pathname}/`;
        const children = [...files.keys()].filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'));
        const xml = `<?xml version="1.0" encoding="utf-8"?><d:multistatus xmlns:d="DAV:">${children
          .map(
            (p) =>
              `<d:response><d:href>/dav/${encodeURIComponent(p.slice(prefix.length)).replace(/%2F/g, '/')}</d:href></d:response>`,
          )
          .join('')}</d:multistatus>`;
        res.writeHead(207, { 'Content-Type': 'application/xml; charset=utf-8' });
        return res.end(xml);
      }
      if (req.method === 'GET') {
        if (!files.has(pathname)) {
          res.writeHead(404);
          return res.end();
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(files.get(pathname));
      }
      if (req.method === 'DELETE') {
        files.delete(pathname);
        res.writeHead(204);
        return res.end();
      }
      res.writeHead(405);
      res.end();
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}/dav`,
        files,
        dirs,
        seen,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

test('normalizeWebdavConfig：没填地址就算没配置，其它字段不抛错', () => {
  const empty = normalizeWebdavConfig({});
  assert.equal(empty.configured, false);
  assert.equal(empty.enabled, true);
  assert.equal(empty.auto, false);
  assert.equal(empty.dir, '');
  assert.equal(empty.keep, 10);

  const full = normalizeWebdavConfig({
    webdavUrl: '  https://dav.example.com/remote.php/dav/files/me/  ',
    webdavDir: '/属于我们的回忆/',
    webdavUser: 'me',
    webdavPassword: 'pw',
    webdavAuto: true,
    webdavKeep: 999,
    webdavEnabled: false,
  });
  assert.equal(full.configured, true);
  assert.equal(full.url, 'https://dav.example.com/remote.php/dav/files/me');
  assert.equal(full.dir, '属于我们的回忆');
  assert.equal(full.keep, 200);
  assert.equal(full.enabled, false);
  assert.equal(full.auto, true);
});

test('keep 下限是 1，坏值回落 10', () => {
  assert.equal(normalizeWebdavConfig({ webdavKeep: 0 }).keep, 1);
  assert.equal(normalizeWebdavConfig({ webdavKeep: -5 }).keep, 1);
  assert.equal(normalizeWebdavConfig({ webdavKeep: 'nope' }).keep, 10);
});

test('joinUrl / encodePath / authHeader', () => {
  assert.equal(joinUrl('https://a/b/', '/c/', 'd'), 'https://a/b/c/d');
  assert.equal(joinUrl('https://a'), 'https://a');
  assert.equal(encodePath('/属于 我们的回忆/备份-1.json'), '/%E5%B1%9E%E4%BA%8E%20%E6%88%91%E4%BB%AC%E7%9A%84%E5%9B%9E%E5%BF%86/%E5%A4%87%E4%BB%BD-1.json');
  assert.equal(authHeader('', ''), null);
  assert.equal(authHeader('me', 'pw'), `Basic ${Buffer.from('me:pw').toString('base64')}`);
});

test('ensureRemoteDir：中文目录逐级建；已存在（405）当成功', async () => {
  const fake = await startFakeServer();
  try {
    const cfg = normalizeWebdavConfig({
      webdavUrl: fake.url,
      webdavDir: '属于我们的回忆/子目录',
    });
    await ensureRemoteDir(cfg);
    assert.ok(fake.dirs.has('/dav/属于我们的回忆'));
    assert.ok(fake.dirs.has('/dav/属于我们的回忆/子目录'));
    // 第二次不能抛 —— 网盘对「已存在」回的码不统一
    await ensureRemoteDir(cfg);
    assert.equal(fake.seen.filter((line) => line.startsWith('MKCOL')).length, 4);
  } finally {
    await fake.close();
  }
});

test('uploadBackupText：PUT 到目录下，返回字节数', async () => {
  const fake = await startFakeServer();
  try {
    const cfg = normalizeWebdavConfig({ webdavUrl: fake.url, webdavDir: '属于我们的回忆' });
    const text = JSON.stringify({ hello: '世界' });
    const result = await uploadBackupText(cfg, { text, fileName: '备份-20261031-120000.json' });
    assert.equal(result.status, 201);
    assert.equal(result.bytes, Buffer.byteLength(text, 'utf8'));
    assert.equal(fake.files.get('/dav/属于我们的回忆/备份-20261031-120000.json'), text);
    assert.ok(result.url.endsWith('/属于我们的回忆/备份-20261031-120000.json'));
  } finally {
    await fake.close();
  }
});

test('listRemoteBackups：解析中文名，只认 备份-*.json 并按时间排序', async () => {
  const fake = await startFakeServer();
  try {
    const cfg = normalizeWebdavConfig({ webdavUrl: fake.url, webdavDir: '属于我们的回忆' });
    fake.dirs.add('/dav/属于我们的回忆');
    fake.files.set('/dav/属于我们的回忆/备份-20261031-120000.json', '{}');
    fake.files.set('/dav/属于我们的回忆/备份-20261031-130000.json', '{}');
    fake.files.set('/dav/属于我们的回忆/别的文件.json', '{}');
    fake.files.set('/dav/属于我们的回忆/说明.md', '#');
    const names = await listRemoteBackups(cfg);
    assert.deepEqual(names, ['备份-20261031-120000.json', '备份-20261031-130000.json']);
  } finally {
    await fake.close();
  }
});

test('pruneRemoteBackups：超出 keep 时删最旧的', async () => {
  const fake = await startFakeServer();
  try {
    const cfg = normalizeWebdavConfig({ webdavUrl: fake.url, webdavDir: '属于我们的回忆', webdavKeep: 2 });
    fake.dirs.add('/dav/属于我们的回忆');
    for (const stamp of ['100000', '110000', '120000', '130000']) {
      fake.files.set(`/dav/属于我们的回忆/备份-20261031-${stamp}.json`, '{}');
    }
    const result = await pruneRemoteBackups(cfg);
    assert.deepEqual(result.removed, ['备份-20261031-100000.json', '备份-20261031-110000.json']);
    assert.equal(fake.files.size, 2);
  } finally {
    await fake.close();
  }
});

test('pushBackupToCloud：没配置直接给一句人话', async () => {
  await assert.rejects(
    () => pushBackupToCloud(normalizeWebdavConfig({}), { text: '{}', fileName: '备份-a.json' }),
    /还没配置/,
  );
});

test('pushBackupToCloud：上传 + 修剪一条龙', async () => {
  const fake = await startFakeServer();
  try {
    const cfg = normalizeWebdavConfig({
      webdavUrl: fake.url,
      webdavDir: '属于我们的回忆',
      webdavKeep: 1,
    });
    await uploadBackupText(cfg, {
      text: '{"n":1}',
      fileName: '备份-20261031-100000.json',
    });
    const result = await pushBackupToCloud(cfg, {
      text: '{"n":2}',
      fileName: '备份-20261031-110000.json',
    });
    assert.equal(result.fileName, '备份-20261031-110000.json');
    assert.deepEqual(result.removed, ['备份-20261031-100000.json']);
    assert.deepEqual([...fake.files.keys()].sort(), ['/dav/属于我们的回忆/备份-20261031-110000.json']);
  } finally {
    await fake.close();
  }
});

test('testConnection：建目录 + 列目录，返回用时和份数', async () => {
  const fake = await startFakeServer();
  try {
    fake.files.set('/dav/属于我们的回忆/备份-20261031-101500.json', '{}');
    const cfg = normalizeWebdavConfig({ webdavUrl: fake.url, webdavDir: '属于我们的回忆' });
    const result = await testConnection(cfg);
    assert.equal(result.ok, true);
    assert.equal(result.dir, '属于我们的回忆');
    assert.equal(result.remoteCount, 1);
    assert.equal(result.listed, true);
    assert.ok(fake.dirs.has('/dav/属于我们的回忆'));
    assert.ok(result.elapsedMs >= 0);
  } finally {
    await fake.close();
  }
});

test('testConnection：没填地址直接给一句人话，不发请求', async () => {
  await assert.rejects(() => testConnection(normalizeWebdavConfig({})), /WebDAV 地址/);
});

test('testConnection：网盘禁了 PROPFIND 也算连上（listed:false）', async () => {
  const seen = [];
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    seen.push(req.method);
    if (req.method === 'MKCOL') return res.writeHead(405).end();
    if (req.method === 'PROPFIND') return res.writeHead(403).end();
    res.writeHead(405).end();
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address();
  try {
    const cfg = normalizeWebdavConfig({ webdavUrl: `http://127.0.0.1:${port}/dav`, webdavDir: '回忆' });
    const result = await testConnection(cfg);
    assert.equal(result.ok, true);
    assert.equal(result.listed, false);
    assert.deepEqual(seen, ['MKCOL', 'PROPFIND']);
  } finally {
    await new Promise((done) => server.close(done));
  }
});

test('explainWebdavError：401/403/404/域名解析都给中文提示', () => {
  assert.match(explainWebdavError(new Error('WebDAV 返回 401（PROPFIND http://x）')), /应用专用密码/);
  assert.match(explainWebdavError(new Error('WebDAV 返回 403（MKCOL http://x）')), /没权限/);
  assert.match(explainWebdavError(new Error('WebDAV 返回 404（MKCOL http://x）')), /地址路径不对/);
  assert.match(explainWebdavError(new Error('fetch failed ENOTFOUND')), /域名解析/);
  assert.equal(explainWebdavError(new Error('别的错')), '别的错');
});


test('listRemoteConfigs：只认 `配置-*.json`，和记忆备份分得开', async () => {
  const fake = await startFakeServer();
  try {
    const cfg = normalizeWebdavConfig({ webdavUrl: fake.url, webdavDir: '属于我们的回忆' });
    await uploadBackupText(cfg, { text: '{"a":1}', fileName: '备份-20261031-120000.json' });
    await uploadBackupText(cfg, { text: '{"format":"x"}', fileName: '配置-20261031-120500.json' });
    const configs = await listRemoteConfigs(cfg);
    const backups = await listRemoteBackups(cfg);
    assert.deepEqual(configs, ['配置-20261031-120500.json']);
    assert.deepEqual(backups, ['备份-20261031-120000.json']);
  } finally {
    await fake.close();
  }
});

test('downloadRemoteText：取回正文，文件名里的分隔符会被压平', async () => {
  const fake = await startFakeServer();
  try {
    const cfg = normalizeWebdavConfig({ webdavUrl: fake.url, webdavDir: '属于我们的回忆' });
    await uploadBackupText(cfg, { text: '{"hello":"世界"}', fileName: '配置-20261031-120500.json' });
    const got = await downloadRemoteText(cfg, '配置-20261031-120500.json');
    assert.equal(got.text, '{"hello":"世界"}');
    assert.equal(got.fileName, '配置-20261031-120500.json');
    assert.equal(got.status, 200);
  } finally {
    await fake.close();
  }
});
