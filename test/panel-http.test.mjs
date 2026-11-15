// 面板接口的 HTTP 层 —— 2026-11-16 从 host 的大闭包里摘出来之后终于能测了。
//
// 这几条闸是靠一次审计加上的（跨站 text/plain 能打进来删日记），
// 之前只活在一个 5000 行的闭包里，一个测试都够不着。
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  isSameOrigin,
  logPanelReject,
  panelReply,
  readPanelBody,
  readPanelTextBody,
  setPanelLoggers,
} from '../src/host/panel-http.mjs';

const fakeRes = () => {
  const res = { statusCode: 0, headers: {}, body: '' };
  res.setHeader = (k, v) => {
    res.headers[k.toLowerCase()] = v;
  };
  res.end = (b) => {
    res.body = b;
  };
  return res;
};

/** 把一段字符串做成 async iterable，够 readPanelBody 用。
 *  空体**一个 chunk 都不发** —— 真实请求就是这样，别拿空 Buffer 冒充。 */
const bodyOf = (text) => {
  const buf = text === '' ? null : Buffer.from(text, 'utf8');
  return {
    async *[Symbol.asyncIterator]() {
      if (buf !== null) yield buf;
    },
  };
};

const reqWith = (headers = {}, body = '') => ({ headers, ...bodyOf(body) });

test('panelReply：状态、头、JSON 三件都对', () => {
  const res = fakeRes();
  panelReply(res, 201, { ok: true, n: 1 });
  assert.equal(res.statusCode, 201);
  assert.match(res.headers['content-type'], /application\/json/);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.deepEqual(JSON.parse(res.body), { ok: true, n: 1 });
});

test('isSameOrigin：有 sec-fetch-site 就以它为准', () => {
  assert.equal(isSameOrigin({ headers: { 'sec-fetch-site': 'same-origin' } }), true);
  assert.equal(isSameOrigin({ headers: { 'sec-fetch-site': 'cross-site' } }), false);
});

test('isSameOrigin：没有 sec-fetch-site 就看 Origin 的 host', () => {
  assert.equal(isSameOrigin({ headers: { origin: 'http://a:1', host: 'a:1' } }), true);
  assert.equal(isSameOrigin({ headers: { origin: 'http://a:1', host: 'b:2' } }), false);
  assert.equal(isSameOrigin({ headers: { origin: 'http://a:1' } }), false, '没有 host 就不放行');
  assert.equal(isSameOrigin({ headers: { origin: '不是个网址', host: 'a:1' } }), false);
});

test('isSameOrigin：两个都没有就放行（Electron renderer 是这种）', () => {
  assert.equal(isSameOrigin({ headers: {} }), true);
});

test('readPanelBody：不是 json 直接拒', async () => {
  await assert.rejects(
    () => readPanelBody(reqWith({ 'content-type': 'text/plain' }, '{"id":"x"}')),
    /只接受 application\/json/,
  );
});

test('readPanelBody：跨站直接拒', async () => {
  await assert.rejects(
    () =>
      readPanelBody(
        reqWith({ 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' }, '{"id":"x"}'),
      ),
    /跨站/,
  );
});

test('readPanelBody：正常解析，空体给空对象', async () => {
  const ok = reqWith({ 'content-type': 'application/json' }, '{"id":"d_1"}');
  assert.deepEqual(await readPanelBody(ok), { id: 'd_1' });
  assert.deepEqual(await readPanelBody(reqWith({ 'content-type': 'application/json' })), {});
});

test('readPanelBody：超过 8KB 拒 —— 这里只收 id', async () => {
  const big = JSON.stringify({ id: 'x'.repeat(9000) });
  await assert.rejects(
    () => readPanelBody(reqWith({ 'content-type': 'application/json' }, big)),
    /过大/,
  );
});

test('readPanelTextBody：默认收得下几 MB，超上限拒', async () => {
  const text = 'x'.repeat(1000);
  assert.equal(await readPanelTextBody(bodyOf(text)), text);
  await assert.rejects(() => readPanelTextBody(bodyOf('x'.repeat(50)), { limit: 10 }), /过大/);
});

test('logPanelReject：不注入就静默，注入就带上凭据', () => {
  const lines = [];
  logPanelReject('写请求', reqWith({ host: 'h', origin: 'o' }), '测试');
  assert.deepEqual(lines, [], '默认不往外喊');

  setPanelLoggers({ warn: (s) => lines.push(String(s)) });
  logPanelReject('写请求', reqWith({ host: 'h', origin: 'o' }), '测试');
  assert.equal(lines.length, 1);
  assert.match(lines[0], /host=h/);
  assert.match(lines[0], /origin=o/);
  setPanelLoggers({});
});
