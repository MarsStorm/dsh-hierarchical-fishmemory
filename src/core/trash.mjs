/**
 * 回收站 —— 删掉的东西先在这儿放三十天。
 *
 * ─────────────────────────────────────────────────────────────
 * **为什么要有它**
 *
 * 这个插件里所有的删除都是**直接删**：面板体检页那句「删掉重复的那一份」
 * 是整行移除，`forgetEntry` 是整条移除，手记保存是整篇覆盖。
 * 同一个项目里，情感日记每次保存前会先存一份到 `backups/feelings/`，
 * 人设卡覆盖前也会留一版历史 —— **只有最该有护栏的那几处没有**。
 *
 * 而人格手记是每轮全量注入的：删错一行，下一轮就换了个我；共度时光
 * 删错一条，那条**永久没了**（墓碑立上，重新加回来还会被判成"别人删的"）。
 *
 * **代价不对称的老规矩**：多留一条占几百字节，删错一条是永久。
 * 所以在"删"这个动作前面加一层缓冲，比在别处省事得多。
 *
 * ─────────────────────────────────────────────────────────────
 * **为什么不是"把文件备份一份"**
 *
 * 备整份文件最简单，但回收站的用处在于**能挑出一条恢复**。
 * 整份快照恢复的是"那一刻的全部"，而人多半只想把那行找回来。
 *
 * 所以这里记的是**删掉的那一条**本身：
 *   · 共度时光 → 整条 entry（能原样写回去，连 id 一起）
 *   · 文本行   → 那一行的原文 + 它原来在哪一层
 *
 * ─────────────────────────────────────────────────────────────
 * **为什么是 JSONL**
 *
 * 追加安全：写一半断电，只丢最后一行，前面的都还在。
 * 不改格式、不引依赖，跟 `diary/*.jsonl` 一个路子 —— 用记事本也能看。
 */

/** 回收站文件名（放在档案目录下） */
export const TRASH_FILE = '回收站.jsonl';

/** 默认保留天数。够长，长到"当时没发现、回头想找"也还在 */
export const DEFAULT_KEEP_DAYS = 30;


/**
 * 造一条回收站记录。
 *
 * **只做纯函数**：不碰磁盘、不看时间（时间可以由调用方传进来，测试好写）。
 *
 * @param {object} input
 * @param {'diary'|'line'} input.kind  删的是整条记忆，还是一行文本
 * @param {*} input.payload            kind='diary' 时是整条 entry；'line' 时是 {target, line}
 * @param {string} [input.label]       人看的一句话，列表里显示的就是它
 * @param {number} [input.at]
 * @param {string} [input.id]
 * @returns {object}
 */
export function buildTrashRecord(input = {}) {
  const at = Number.isFinite(input.at) ? Number(input.at) : Date.now();
  const kind = input.kind === 'line' ? 'line' : 'diary';
  const payload = input.payload ?? null;

  // label 缺省时从 payload 里现推一个 —— 列表里不该出现空行
  let label = typeof input.label === 'string' ? input.label.trim() : '';
  if (label === '') {
    const raw = kind === 'diary' ? payload?.text : payload?.line;
    // 折叠空白**并且去掉首尾** —— 正文常是带缩进的多行，不去的话
    // 列表里每条前面都空一格，看起来像排版坏了。
    label = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
  }
  if (label === '') label = '（没有正文）';

  return {
    id: typeof input.id === 'string' && input.id !== '' ? input.id : `t_${at}_${Math.random().toString(36).slice(2, 8)}`,
    at,
    kind,
    label,
    payload,
  };
}

/**
 * 把一条记录追加到回收站文本末尾，返回新文本。
 *
 * 纯字符串操作 —— 调用方自己决定什么时候写盘。
 *
 * @param {string} text 现有内容（可为空串）
 * @param {object} record
 * @returns {string}
 */
export function appendTrashRecord(text, record) {
  const body = String(text ?? '');
  const line = JSON.stringify(record);
  if (body === '') return `${line}\n`;
  return body.endsWith('\n') ? `${body}${line}\n` : `${body}\n${line}\n`;
}

/**
 * 读回收站。**坏行跳过，绝不抛错** —— 回收站坏了不该挡住聊天，
 * 这是这个项目从头到尾的规矩（SPEC §10）。
 *
 * @param {string} text
 * @returns {{records: object[], broken: number}}
 */
export function parseTrash(text) {
  const records = [];
  let broken = 0;
  const body = String(text ?? '');
  if (body.trim() === '') return { records, broken };
  for (const line of body.split('\n')) {
    const t = line.trim();
    if (t === '') continue;
    try {
      const rec = JSON.parse(t);
      if (rec === null || typeof rec !== 'object' || Array.isArray(rec)) {
        broken += 1;
        continue;
      }
      records.push(rec);
    } catch {
      broken += 1;
    }
  }
  records.sort((a, b) => (Number(b?.at) || 0) - (Number(a?.at) || 0));
  return { records, broken };
}

/**
 * 按天数剪枝。**只按时间，不按条数** —— 条数上限会让一次批量删除
 * 把更早的、还没看过的那些挤掉。
 *
 * @param {object[]} records
 * @param {{now?: number, keepDays?: number}} [options]
 * @returns {{records: object[], removed: number}}
 */
export function pruneTrash(records, options = {}) {
  const now = Number.isFinite(options.now) ? Number(options.now) : Date.now();
  const keepDays = Number.isFinite(options.keepDays) ? Number(options.keepDays) : DEFAULT_KEEP_DAYS;
  const cutoff = now - Math.max(0, keepDays) * 86400000;
  const list = Array.isArray(records) ? records : [];
  const kept = list.filter((r) => (Number(r?.at) || 0) >= cutoff);
  return { records: kept, removed: list.length - kept.length };
}

/** 把记录列表写回文本（剪枝之后用它落盘） */
export function serializeTrash(records) {
  const list = Array.isArray(records) ? records : [];
  if (list.length === 0) return '';
  return list.map((r) => JSON.stringify(r)).join('\n') + '\n';
}

/**
 * 找一条记录：先按 id，再按 label 里的片段。
 *
 * 宽松是故意的 —— 人多半记得住"那句话里有『端口』"，记不住 32 位的 id。
 *
 * @param {object[]} records
 * @param {string} needle
 * @returns {object|undefined}
 */
export function findTrashRecord(records, needle) {
  const key = String(needle ?? '').trim();
  if (key === '') return undefined;
  const list = Array.isArray(records) ? records : [];
  return (
    list.find((r) => r?.id === key) ||
    list.find((r) => String(r?.label ?? '').includes(key)) ||
    list.find((r) => JSON.stringify(r?.payload ?? {}).includes(key))
  );
}

/**
 * 列表用的一句话摘要。
 *
 * @param {object} record
 * @param {number} [now]
 * @returns {string}
 */
export function describeTrashRecord(record, now = Date.now()) {
  const at = Number(record?.at) || 0;
  const days = at > 0 ? Math.floor((now - at) / 86400000) : -1;
  const when = days <= 0 ? '今天' : days === 1 ? '昨天' : `${days} 天前`;
  const kind = record?.kind === 'line' ? '删了一行' : '删了一条';
  return `${when} ${kind}：${String(record?.label ?? '').slice(0, 60)}`;
}

/** 剩余多少天会被清掉（给界面用；列表里提醒一句"这条快到期了"） */
export function daysLeft(record, options = {}) {
  const now = Number.isFinite(options.now) ? Number(options.now) : Date.now();
  const keepDays = Number.isFinite(options.keepDays) ? Number(options.keepDays) : DEFAULT_KEEP_DAYS;
  const at = Number(record?.at) || 0;
  if (at <= 0) return keepDays;
  return Math.max(0, keepDays - Math.floor((now - at) / 86400000));
}
