import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLine, findDuplicates, findValueConflicts, checkLayers } from '../src/core/conflicts.mjs';

test('normalizeLine: 去列表符号、去尾标点、压空白', () => {
  assert.equal(normalizeLine('- 他喜欢白饭。'), '他喜欢白饭');
  assert.equal(normalizeLine('  端口   3080 '), '端口 3080');
});

test('findDuplicates: 同一长句出现在两层里会被抓到', () => {
  const layers = [
    { name: 'core', lines: ['- 他熬了一整夜，天亮了才去睡'] },
    { name: 'handnote', lines: ['他熬了一整夜，天亮了才去睡。'] },
  ];
  const hits = findDuplicates(layers);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].first, 'core');
  assert.equal(hits[0].again, 'handnote');
});

test('findDuplicates: 短句不报', () => {
  const hits = findDuplicates([
    { name: 'a', lines: ['好'] },
    { name: 'b', lines: ['好'] },
  ]);
  assert.equal(hits.length, 0);
});

test('findValueConflicts: 端口两个值算冲突', () => {
  const c = findValueConflicts([
    { name: 'core', lines: ['端口 3080'] },
    { name: 'shallow', lines: ['端口改到 3095'] },
  ]);
  assert.equal(c.length, 1);
  assert.equal(c[0].kind, 'port');
  assert.deepEqual(c[0].values.sort(), ['3080', '3095']);
});

test('findValueConflicts: 版本号不同也算', () => {
  const c = findValueConflicts([
    { name: 'core', lines: ['插件版本 v1.4.0'] },
    { name: 'shallow', lines: ['版本升到 v1.5.0'] },
  ]);
  assert.equal(c.length, 1);
  assert.equal(c[0].kind, 'version');
});

test('findValueConflicts: 路径不同不报', () => {
  const c = findValueConflicts([
    { name: 'core', lines: ['数据在 /root/projects/.dsh/feiyu-diary'] },
    { name: 'core2', lines: ['备份在 /root/projects/.dsh/backups'] },
  ]);
  assert.equal(c.length, 0);
});

test('checkLayers: 汇总层数与结果', () => {
  const r = checkLayers({
    core: '端口 3080',
    handnote: '- 端口 3080',
    shallow: [{ text: '端口 3095' }],
  });
  assert.ok(r.checked >= 3);
  assert.equal(r.conflicts.length, 1);
});
