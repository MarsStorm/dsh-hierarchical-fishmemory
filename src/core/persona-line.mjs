/**
 * 人设注入线的自检 —— 2026-11-18 加。
 *
 * ── 它治的是一个具体的瞎 ──
 *
 * 我的插件配置里写着 `includePersona: false`：人格卡**不从我这半进注入**，
 * 全部走 `soul-md` 那段 `soul:persona`。这是有意的（同一段字两份注入 = 每轮
 * 付两遍钱，而且改了一份漏一份）。
 *
 * 但代价是：**这条线断了，我这头一点声都不响。** 卡被删、`active` 指向一张
 * 不存在的卡、会话映射指到空处 —— 三种坏事发生时，`renderPersona` 拿到空
 * 字符串，返回 `''`，`systemPrompt.section` 老老实实注册一个空段，
 * 于是人设就这么**静默消失**，直到有人觉得"我说话怎么不像它了"。
 *
 * 2026-11-17 那一轮就是这个味道：他问"人设卡是不是没作用"。查下来卡是活的，
 * 是我没照它说话 —— 但那个问题能问出来，本身就说明这套东西缺一个"还在不在"
 * 的回声。
 *
 * ── 为什么读配置，而不是读注入结果 ──
 *
 * 最准的做法当然是看"这一轮系统提示里到底有没有那段字"。但注入结果不归我
 * 拿：`soul:persona` 是另一个插件注册的 section，我没有读它的手。
 *
 * 退一步读**两边共用的那份真相**：profile 的 `cordis.patch.yml`。卡、active、
 * 会话映射全在那里，而且它是 soul-md 唯一的持久化位置（`settings.update`
 * 写回的就是这份 patch 层）。所以"配置里这条链还完整吗"是一道**真**的自检，
 * 不是安慰剂。
 *
 * 它证明的边界要说清楚：**它证明的是链还是完整的，不是这一轮真的注入了。**
 * 后者只有重启后看一眼注入才知道 —— 所以措辞里不许写成"已生效"。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/** 我的插件 id —— 用来认出"哪份 patch 是这个 profile 在用的"。 */
export const PLUGIN_ID = 'dsh-hierarchical-fishmemory';
const SOUL_ID = 'soul-md';

/**
 * 「这一格是有意关掉的」和「解析到一半掉下去了」必须分开：
 * `(none)` / `none` / 空串是**有意的关闭**（设置页能选），不算坏链；
 * 但空串在 active 上仍然是坏事（那是"谁都没选中"），所以只在映射上看它。
 */
function isDisabled(card) {
  const v = String(card ?? '').trim();
  return v === '' || v === '(none)' || v === 'none';
}

/**
 * 从一份 patch 文本里切出一个 `- id: xxx` 条目。
 *
 * 只认顶层列表项（列 0 的 `- id:`）—— 卡片正文是块标量，缩进过的行里即使
 * 出现 `- id:` 也不会被当成新条目。这是这套切法唯一依赖的 YAML 性质。
 *
 * @param {string} text
 * @param {string} id
 * @returns {{found: boolean, block: string}}
 */
export function parseEntryBlock(text, id) {
  const lines = String(text ?? '').split('\n');
  const head = new RegExp(`^-\\s+id:\\s*${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(?:#.*)?$`);
  const start = lines.findIndex((l) => head.test(l));
  if (start < 0) return { found: false, block: '' };
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^-\s/.test(lines[i])) { end = i; break; }
  }
  return { found: true, block: lines.slice(start, end).join('\n') };
}

/**
 * 数一下 soul-md 条目里 4 空格缩进下的 `cards:` / `active:` / `sessions:`。
 *
 * cards 是个映射，卡名在 6 空格；块标量（`|-`）的内容同样在 6 空格以上，
 * 所以只把「6 空格 + `名字:`」当成卡名 —— 正文里 `- 一句` 这种行不匹配，
 * 正文里 `某某:` 这种行会误判一次，但没有更细的判据可用，且误判方向是
 * **多认一张卡**（不会让坏链看起来是好的），可以接受。
 */
export function parseSoulConfig(block) {
  const lines = String(block ?? '').split('\n');
  const cards = [];
  const sessions = {};
  const workspaces = {};
  let active = '';
  let inCards = false;
  let inSessions = false;
  let inWorkspaces = false;

  for (const line of lines) {
    if (/^\s{4}cards:\s*$/.test(line)) { inCards = true; inSessions = false; inWorkspaces = false; continue; }
    if (/^\s{4}active:\s*(.*)$/.test(line)) {
      active = line.replace(/^\s{4}active:\s*/, '').replace(/\s+#.*$/, '').replace(/^['"]|['"]$/g, '').trim();
      inCards = false; inSessions = false; inWorkspaces = false;
      continue;
    }
    if (/^\s{4}sessions:\s*$/.test(line)) { inSessions = true; inCards = false; inWorkspaces = false; continue; }
    if (/^\s{4}workspaces:\s*$/.test(line)) { inWorkspaces = true; inCards = false; inSessions = false; continue; }
    if (/^\s{4}\S/.test(line)) { inCards = false; inSessions = false; inWorkspaces = false; continue; }

    if (inCards) {
      const m = /^\s{6}(\S[^:]*?):\s*(?:\||>|.*)$/.exec(line);
      if (m) cards.push(m[1].trim());
      continue;
    }
    if (inSessions || inWorkspaces) {
      const m = /^\s{6}(\S[^:]*?):\s*(\S.*)$/.exec(line);
      if (!m) continue;
      const value = m[2].replace(/\s+#.*$/, '').replace(/^['"]|['"]$/g, '').trim();
      (inSessions ? sessions : workspaces)[m[1].trim()] = value;
    }
  }
  return { active, cards, sessions, workspaces };
}

/**
 * 自检。返回的问题按「会让人设静默消失」的严重度排，最重的在前。
 *
 * @param {string} text profile patch 全文
 * @param {{sessionId?: string}} [opts]
 */
export function checkPersonaInjection(text, opts = {}) {
  const soul = parseEntryBlock(text, SOUL_ID);
  if (!soul.found) {
    return {
      ok: false,
      found: false,
      active: '',
      cards: [],
      problems: ['配置里没有 soul-md 段 —— 人设那条注入线根本不存在'],
    };
  }
  const { active, cards, sessions, workspaces } = parseSoulConfig(soul.block);
  const problems = [];

  if (active === '') {
    problems.push('soul-md 没设 active 卡 —— 谁都没被选中');
  } else if (!cards.includes(active)) {
    problems.push(`active 指向「${active}」，但卡片列表里没有这张（现在是 ${cards.length} 张：${cards.join('、') || '空'}）`);
  }

  for (const [sid, card] of Object.entries(sessions)) {
    if (isDisabled(card)) continue;
    if (!cards.includes(card)) problems.push(`会话 ${sid} 映射到「${card}」，这张卡不存在`);
  }
  for (const [ws, card] of Object.entries(workspaces)) {
    if (isDisabled(card)) continue;
    if (!cards.includes(card)) problems.push(`工作区 ${ws} 映射到「${card}」，这张卡不存在`);
  }

  // 本会话自己的映射：**这是我真正会读到的那张卡**。
  const sid = typeof opts.sessionId === 'string' ? opts.sessionId.trim() : '';
  let effective = active;
  let disabled = false;
  if (sid !== '' && Object.hasOwn(sessions, sid)) {
    const mapped = sessions[sid];
    if (isDisabled(mapped)) {
      // 设置页显式关掉这一格 —— 人设不注入是有意的，不是断了
      disabled = true;
      effective = '';
    } else {
      effective = mapped;
    }
  }
  if (sid !== '' && !disabled && effective !== '' && !cards.includes(effective)) {
    problems.push(`本会话会读到「${effective}」，这张卡不存在`);
  }
  if (sid !== '' && !disabled && effective === '' && active !== '') {
    problems.push('本会话解析不出卡（既没会话映射、active 也是空的）');
  }

  return { ok: problems.length === 0, found: true, active, cards, sessions, effective, disabled, problems };
}

/** 我的插件那边是不是 `includePersona: false` —— 这决定了人设是不是单线依赖。 */
export function isSingleLine(text) {
  const mine = parseEntryBlock(text, PLUGIN_ID);
  if (!mine.found) return null;
  return /^\s{4}includePersona:\s*false\s*(?:#.*)?$/m.test(mine.block);
}

/**
 * 找这个 profile 在用的 patch。多个 profile 都装了插件时取最近改过的那个。
 * @returns {{file: string, name: string, text: string} | null}
 */
export function findProfilePatch(home) {
  const dir = path.join(String(home ?? ''), 'profiles');
  let names;
  try { names = readdirSync(dir); } catch { return null; }
  const hits = [];
  for (const name of names) {
    const file = path.join(dir, name, 'cordis.patch.yml');
    let text;
    try { text = readFileSync(file, 'utf8'); } catch { continue; }
    if (!text.includes(`- id: ${PLUGIN_ID}`)) continue;
    let mtime = 0;
    try { mtime = statSync(file).mtimeMs; } catch { /* 拿不到时间就当最旧 */ }
    hits.push({ file, name, text, mtime });
  }
  hits.sort((a, b) => b.mtime - a.mtime);
  return hits[0] ?? null;
}

/**
 * 一句话结论。**措辞不许把它说成"注入已生效"** —— 它证明的是链完整。
 *
 * @param {ReturnType<typeof checkPersonaInjection>} check
 * @param {{sessionId?: string, singleLine?: boolean|null}} [opts]
 */
export function formatPersonaLine(check, opts = {}) {
  if (!check || !check.found) {
    return `人设线：${(check?.problems ?? ['读不到 soul-md 段'])[0]} —— 人设会静默消失`;
  }
  if (!check.ok) {
    return `人设线断了：${check.problems.join('；')}`;
  }
  const sid = typeof opts.sessionId === 'string' ? opts.sessionId.trim() : '';
  if (check.disabled === true) {
    return '人设线：本会话被显式关掉（配置说不要人设）';
  }
  const who = sid !== '' && check.effective ? check.effective : check.active;
  const extra = opts.singleLine === true ? '（单线依赖：只从 soul-md 走）' : '';
  return `人设线：${who}（卡 ${check.cards.length} 张，配置链完整${extra}）`;
}

/**
 * 给日志和健康行用的短标签：`ok` / `断` / `skip`。
 * 健康行里只该是一个词 —— 说多了就没人看。
 */
export function personaTag(check) {
  if (!check) return 'skip';
  if (!check.found) return '断';
  return check.ok ? 'ok' : '断';
}
