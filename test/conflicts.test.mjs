import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLine, findDuplicates, findValueConflicts } from '../src/core/conflicts.mjs';

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

test('findValueConflicts: 同一个端口写着两个值算冲突', () => {
  const c = findValueConflicts([
    { name: 'core', lines: ['默认端口 3080'] },
    { name: 'shallow', lines: ['默认端口改成 3095'] },
  ]);
  assert.equal(c.length, 1);
  assert.equal(c[0].kind, 'port');
  assert.equal(c[0].subject, '默认');
  assert.deepEqual(c[0].values.sort(), ['3080', '3095']);
});

test('findValueConflicts: 不同东西的端口不是冲突', () => {
  // 2026-11-17 在真实档案上抓到的假冲突：SSH 端口 2026、临时实例 3099、
  // 备份端口 48888 三条被算成"端口打架"。不同东西的取值当然不同。
  const c = findValueConflicts([
    { name: 'env-ops', lines: ['SSH 端口 2026', '临时实例端口 3099', '备份端口 48888'] },
  ]);
  assert.equal(c.length, 0);
});

test('findValueConflicts: 没主语的不报（宁可不报，也别报一堆假的）', () => {
  const c = findValueConflicts([
    { name: 'core', lines: ['端口 3080'] },
    { name: 'shallow', lines: ['端口 3095'] },
  ]);
  assert.equal(c.length, 0);
});

test('findValueConflicts: 同一个东西的版本写着两个值算冲突', () => {
  const c = findValueConflicts([
    { name: 'core', lines: ['插件版本 v1.4.0'] },
    { name: 'shallow', lines: ['插件版本升到 v1.5.0'] },
  ]);
  assert.equal(c.length, 1);
  assert.equal(c[0].kind, 'version');
  assert.equal(c[0].subject, '插件');
});

test('findValueConflicts: 不同东西的版本不是冲突', () => {
  const c = findValueConflicts([
    { name: 'env-ops', lines: ['插件版本 1.9.9', 'DSHBox v1.5.4（versionCode 13）'] },
  ]);
  assert.equal(c.length, 0);
});

test('findValueConflicts: 路径不同不报', () => {
  const c = findValueConflicts([
    { name: 'core', lines: ['数据在 /root/projects/.dsh/feiyu-diary'] },
    { name: 'core2', lines: ['备份在 /root/projects/.dsh/backups'] },
  ]);
  assert.equal(c.length, 0);
});

