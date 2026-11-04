/**
 * 从情感日记里抽"最后写了什么"。
 *
 * ─────────────────────────────────────────────────────────────
 * **为什么需要它**
 *
 * `鱼的日子.md` 是四本账里唯一**每轮注入为零**的一份 —— 它只在手动回想时
 * 出现。而它恰恰最说明"最近怎么样"。体检页只报条数和体积，
 * 于是关于这条鱼状态的那条信息，在界面上等于不存在。
 *
 * 所以面板顶上铺一行：最近那一天、那一段的小标题、那句话。
 *
 * ─────────────────────────────────────────────────────────────
 * **为什么是纯函数**
 *
 * 这里只吃文本、只吐结构，不碰磁盘。读文件在 host 那半边 ——
 * 这样这段解析能被单独测，不用为它起一个插件。
 */

/** 正文截断到多少字（面板一行，再多也看不完） */
const BODY_MAX = 140;

/** 是不是标题行（`#` 开头，后面跟空白） */
const isHeading = (line) => /^#{1,6}\s/.test(line);
/** 二级标题：`## 2026-11-03` —— 一天的那条 */
const isDay = (line) => /^##\s+/.test(line) && !/^###/.test(line);
/** 三级标题：`### 夜里 · 那句来历` —— 一天里的那一小节 */
const isSub = (line) => /^###\s+/.test(line);

/**
 * 取一段里第一段的正文，合成一行。
 *
 * 列表前面的 `- ` 去掉（面板是散文，不是清单）；
 * 遇到空行就收尾 —— 那是这一段结束了。
 */
function paragraphOf(lines) {
  const para = [];
  for (const raw of lines) {
    const line = String(raw).trim();
    if (line === '') {
      if (para.length > 0) break;
      continue;
    }
    if (isHeading(line)) continue;
    para.push(line.replace(/^[-*+]\s+/, ''));
  }
  return para.join(' ');
}

/**
 * 抽最近写的那一段。
 *
 * 结构是「二级标题（日期）→ 三级标题（小节）→ 正文」，
 * 没有三级标题的也照收；最后那一小节只有标题、正文还没写的，
 * 退回整节的第一段 —— **空着比退回更糟**。
 *
 * @param {string} text 情感日记全文
 * @returns {{heading: string, sub: string, body: string, bytes: number} | null}
 */
export function peekFeelings(text) {
  if (typeof text !== 'string' || text.trim() === '') return null;
  const lines = text.split('\n');

  // 最近的那一天。找不到日期标题就看整份 —— 老文件可能没有标题。
  let dayAt = -1;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (isDay(lines[i].trim())) {
      dayAt = i;
      break;
    }
  }
  const heading = dayAt >= 0 ? lines[dayAt].trim().replace(/^##\s+/, '').trim() : '';
  const section = lines.slice(dayAt + 1);

  // 这一天里最后一个小节。它比日期更能说明"那一段在讲什么"。
  let sub = '';
  let from = 0;
  for (let i = section.length - 1; i >= 0; i -= 1) {
    if (isSub(section[i].trim())) {
      sub = section[i].trim().replace(/^###\s+/, '').trim();
      from = i + 1;
      break;
    }
  }

  let body = paragraphOf(section.slice(from));
  if (body === '') body = paragraphOf(section);
  if (heading === '' && sub === '' && body === '') return null;

  return { heading, sub, body: body.slice(0, BODY_MAX), bytes: text.length };
}
