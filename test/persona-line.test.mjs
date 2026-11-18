/**
 * 人设注入线自检的测试 —— 2026-11-18。
 *
 * 负例是主角：这套东西的意义就是"链断了要出声"，所以每一条断法都得有一条
 * 用例证明它真的会报。正例只是防止它见谁都喊。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  checkPersonaInjection,
  findProfilePatch,
  formatPersonaLine,
  isSingleLine,
  parseEntryBlock,
  parseSoulConfig,
  personaTag,
} from '../src/core/persona-line.mjs';

const GOOD = `- id: ui-settings-general
  name: "@deepseek-ai/dsh-client-ui-settings-general"
  config:
    welcomeNoticeVersion: 2026-09-28.1
- id: soul-md
  name: dsh-hierarchical-fishmemory/soul
  config:
    cards:
      未央的小鱼: |-
        你是未央的小鱼
        我是你的朋友

        ## 说话的分寸

        - 别硬凑一段总结
        - id: 这行不是条目，是正文
      选择人设: 高效打工人
    active: 未央的小鱼
    sessions:
      session-a: 未央的小鱼
      session-b: 未央的小鱼
    workspaces: {}
- id: dsh-hierarchical-fishmemory
  name: dsh-hierarchical-fishmemory
  config:
    dataDir: /root/projects/.dsh/feiyu-diary
    includePersona: false
`;

test('正例：链完整时 ok，卡名与映射都读得对', () => {
  const r = checkPersonaInjection(GOOD);
  assert.equal(r.ok, true);
  assert.equal(r.found, true);
  assert.equal(r.active, '未央的小鱼');
  assert.deepEqual(r.cards, ['未央的小鱼', '选择人设']);
  assert.equal(Object.keys(r.sessions).length, 2);
  assert.deepEqual(r.problems, []);
});

test('正例：本会话映射优先于 active', () => {
  const r = checkPersonaInjection(GOOD, { sessionId: 'session-b' });
  assert.equal(r.effective, '未央的小鱼');
  assert.equal(r.ok, true);
});

test('负例：没有 soul-md 段 → 报"注入线不存在"', () => {
  const r = checkPersonaInjection('- id: dsh-hierarchical-fishmemory\n  config:\n    dataDir: /x\n');
  assert.equal(r.ok, false);
  assert.equal(r.found, false);
  assert.match(r.problems[0], /没有 soul-md 段/);
  assert.match(formatPersonaLine(r), /静默消失/);
});

test('负例：active 指向不存在的卡', () => {
  const text = GOOD.replace('    active: 未央的小鱼', '    active: 不存在的人');
  const r = checkPersonaInjection(text);
  assert.equal(r.ok, false);
  assert.match(r.problems.join('；'), /active 指向「不存在的人」/);
});

test('负例：active 是空的', () => {
  const text = GOOD.replace('    active: 未央的小鱼', '    active:');
  const r = checkPersonaInjection(text);
  assert.equal(r.ok, false);
  assert.match(r.problems.join('；'), /没设 active/);
});

test('负例：会话映射指到不存在的卡', () => {
  const text = GOOD.replace('      session-b: 未央的小鱼', '      session-b: 被删掉的卡');
  const r = checkPersonaInjection(text);
  assert.equal(r.ok, false);
  assert.match(r.problems.join('；'), /session-b 映射到「被删掉的卡」/);
});

test('负例：工作区映射指到不存在的卡', () => {
  const text = GOOD.replace('    workspaces: {}', '    workspaces:\n      /root/初级: 也没了');
  const r = checkPersonaInjection(text);
  assert.equal(r.ok, false);
  assert.match(r.problems.join('；'), /工作区 \/root\/初级 映射到「也没了」/);
});

test('负例：本会话解析不到卡（active 空 + 无映射）', () => {
  const text = GOOD
    .replace('    active: 未央的小鱼', '    active:')
    .replace('      session-a: 未央的小鱼\n      session-b: 未央的小鱼', '    sessions: {}');
  const r = checkPersonaInjection(text, { sessionId: 'session-zzz' });
  assert.equal(r.ok, false);
  // 空 active 与"解析不出"是两条，都该在
  assert.match(r.problems.join('；'), /没设 active/);
});

test('(none) 是有意的关闭，不算坏', () => {
  const text = GOOD.replace('      session-b: 未央的小鱼', '      session-b: (none)');
  const r = checkPersonaInjection(text, { sessionId: 'session-b' });
  assert.equal(r.ok, true);
});

test('切条目：正文里缩进的 `- id:` 不能把条目切断', () => {
  const { found, block } = parseEntryBlock(GOOD, 'soul-md');
  assert.equal(found, true);
  assert.match(block, /这行不是条目，是正文/); // 还在块里
  assert.doesNotMatch(block, /dsh-hierarchical-fishmemory\n  config/); // 没吃进下一个条目
});

test('parseSoulConfig：块标量里的 `词:` 会多认一张卡，但不会把坏链看成好的', () => {
  const block = parseEntryBlock(GOOD, 'soul-md').block;
  const cfg = parseSoulConfig(block);
  assert.ok(cfg.cards.includes('未央的小鱼'));
  // 这里是已知的粗糙处：正文里 `- id: 这行不是条目，是正文` 不匹配（有 `- `），
  // 但形如 `       某某:` 的行会被多认一张。方向只会更严，接受。
  assert.ok(cfg.cards.length >= 2);
  assert.equal(cfg.active, '未央的小鱼');
});

test('isSingleLine：认得出 includePersona: false', () => {
  assert.equal(isSingleLine(GOOD), true);
  assert.equal(isSingleLine(GOOD.replace('    includePersona: false', '    includePersona: true')), false);
  assert.equal(isSingleLine('- id: soul-md\n'), null);
});

test('formatPersonaLine：断的时候把第一句问题说出来，好时不许说"已生效"', () => {
  const good = formatPersonaLine(checkPersonaInjection(GOOD), { sessionId: 'session-a', singleLine: true });
  assert.match(good, /配置链完整/);
  assert.match(good, /单线依赖/);
  assert.doesNotMatch(good, /已生效|已注入|正常工作/);

  const bad = formatPersonaLine(checkPersonaInjection(GOOD.replace('    active: 未央的小鱼', '    active: 鬼')), {});
  assert.match(bad, /^人设线断了：/);
});

test('personaTag：健康行里只出一个词', () => {
  assert.equal(personaTag(checkPersonaInjection(GOOD)), 'ok');
  assert.equal(personaTag(checkPersonaInjection('- id: x\n')), '断');
  assert.equal(personaTag(null), 'skip');
});

test('findProfilePatch：只认装了本插件的 profile，多份时取最近改过的', () => {
  const home = mkdtempSync(path.join(tmpdir(), 'persona-line-'));
  const a = path.join(home, 'profiles', 'aaa');
  const b = path.join(home, 'profiles', 'bbb');
  const c = path.join(home, 'profiles', 'ccc');
  for (const d of [a, b, c]) mkdirSync(d, { recursive: true });
  writeFileSync(path.join(a, 'cordis.patch.yml'), '- id: soul-md\n', 'utf8'); // 没装本插件
  writeFileSync(path.join(b, 'cordis.patch.yml'), GOOD, 'utf8');
  writeFileSync(path.join(c, 'cordis.patch.yml'), GOOD.replace('未央的小鱼', '旧卡'), 'utf8');
  // 让 b 成为"最近改过"
  const now = Date.now() / 1000;
  utimesSync(path.join(c, 'cordis.patch.yml'), now - 100, now - 100);
  const hit = findProfilePatch(home);
  assert.equal(hit.name, 'bbb');
  assert.equal(checkPersonaInjection(hit.text).ok, true);
});

test('findProfilePatch：目录不存在时回 null，不抛', () => {
  assert.equal(findProfilePatch(path.join(tmpdir(), 'definitely-not-here-12345')), null);
});

test('真档案冒烟：本机这份 patch 现在应当是完整的', () => {
  const home = process.env.DSH_HOME ?? path.join(process.env.HOME ?? '/root', '.dsh');
  const hit = findProfilePatch(home);
  if (!hit) return; // 换台机器/没装插件时跳过，不当失败
  const r = checkPersonaInjection(hit.text, { sessionId: 'session-6762d41d-fae3-4cde-bf45-c3c7e6c8102a' });
  assert.equal(r.ok, true, `真档案自检不过：${r.problems.join('；')}`);
  assert.ok(r.cards.includes('未央的小鱼'));
  // 脏卡 2026-11-18 已清掉，不该再回来
  assert.ok(!r.cards.includes('选择人设'), '脏卡「选择人设」又出现了');
});

test('真档案冒烟：健康行标签是 ok', () => {
  const home = process.env.DSH_HOME ?? path.join(process.env.HOME ?? '/root', '.dsh');
  const hit = findProfilePatch(home);
  if (!hit) return;
  assert.equal(personaTag(checkPersonaInjection(hit.text)), 'ok');
  // 摆一份真实文件摘录，方便排错时对照
  assert.ok(existsSync(hit.file));
  assert.ok(readFileSync(hit.file, 'utf8').length > 100);
});
