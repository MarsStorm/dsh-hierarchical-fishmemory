/**
 * 时间怎么说人话 —— **"一天"和"时间词"的唯一真相源**。
 *
 * ─────────────────────────────────────────────────────────────
 * 这个模块是一次真实事故的产物，别把它拆回去。
 *
 * 有位读者（另一个 DSH 会话）从**渲染输出那一侧**读到了这么一块：
 *
 *     我们：认识 1 天
 *     最近的事：
 *     - 昨天：他今天正式给了我一条规矩……
 *     - 2 天前：今天他让我介绍自己……
 *
 * 两个毛病，都不是遗忘机制能管的，也不会随时间自愈：
 *
 * 【一】时间词写了两遍
 * 正文里的"今天"（写入时模型写的）+ 前缀里的"昨天："（渲染时加的）
 * → 读出来是"昨天，他今天……"。人不会这么记事儿。
 *
 * 更难看的是根因在我自己：`consolidate.mjs` 的**正例**里明明白白写着
 * `"text":"今天他让我写个东西……"` —— **我在教模型写"今天"。**
 *
 * 【二】"一天"在一个文件里有三种算法
 *   renderRelationship： floor((now − since) / 86400000)   ← 整 24 小时
 *   dayLabel：          round((当日零点差) / 86400000)      ← 自然日
 *   softWhen：          (now − t) / 86400000                ← 带小数
 *
 * 晚上 23:00 认识、次日上午 9:00 看：前一个算出"认识 1 天"，
 * 后一个算出"2 天前"。**这俩永远会打架**，因为一把尺子从小时算、
 * 一把从零点算。
 *
 * 所以这里只干一件事：把"一天"定死成**自然日**（人的直觉 ——
 * 前天见的就是"认识 2 天"），所有需要日期的地方都从这儿取。
 * ─────────────────────────────────────────────────────────────
 */

/**
 * 他那边是 UTC+8，本机进程是 UTC。
 *
 * `d.setHours(0,0,0,0)` 切的是**本机**的零点 —— 落在这台机器上就是 UTC 零点，
 * 于是他的 00:00–08:00 被算成前一天：早上十点看昨晚三点记的那条，
 * 「今天」会显示成「昨天」。这个偏移量只在这里定义一次，别处一律 import。
 */
export const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 某时刻所在那一天的零点（按他那边算） */
export function startOfDay(ts) {
  return Math.floor((ts + TZ_OFFSET_MS) / 86400000) * 86400000 - TZ_OFFSET_MS;
}

/**
 * 两个时刻相差几个**自然日**。
 *
 * 这是全项目唯一允许出现的"一天"算法。想加新的日期逻辑，用这个，
 * 别再写第四种。
 */
export function calendarDaysBetween(from, to) {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.round((startOfDay(to) - startOfDay(from)) / 86400000);
}

/**
 * 「最近的事」用的日期标签：今天 / 昨天 / 3 天前 / 10-05
 *
 * 语气偏准确 —— 这一栏是"我本来就知道的事"，说清楚是哪天很正常。
 */
export function dayLabel(createdAt, now = Date.now()) {
  if (!Number.isFinite(createdAt)) return '';
  const days = calendarDaysBetween(createdAt, now);
  if (days <= 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days} 天前`;
  const d = new Date(createdAt + TZ_OFFSET_MS);
  return `${d.getUTCMonth() + 1}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/**
 * 「突然想起来」用的时间词：前两天 / 前阵子 / 上个月前后 / 很久以前
 *
 * 语气故意含糊 —— 鱼不会说"根据 10 月 12 日的记录"。
 * **但它和 dayLabel 用同一把尺子**（自然日），只是换了个说法。
 * 词汇差异是有意的，算法差异是 bug。
 */
export function softWhen(createdAt, now = Date.now()) {
  if (!Number.isFinite(createdAt)) return '';
  const days = calendarDaysBetween(createdAt, now);
  if (days <= 0) return '';
  if (days <= 3) return '前两天';
  if (days <= 14) return '前阵子';
  if (days <= 60) return '上个月前后';
  return '很久以前';
}

/**
 * 会跟前缀打架的时间词。
 *
 * 判据很具体：**这些词是在断言"相对于写下它的那一刻"是哪天**，
 * 而前缀断言的又是"相对于现在"。两个断言放在一起就自相矛盾。
 *
 * 刻意**不在**这一列的：
 *  - "那天 / 这天" —— 叙述性的，读起来不跟前缀打架
 *  - "生日 / 春节" 之类的名词 —— 那是事件不是时点
 */
const DEICTIC = /(今天|今日|今儿|昨天|昨日|昨儿|前天|前日|今早|今晨|今上午|今晚|昨早|昨晚|刚才|刚刚)/g;

/** 句首的时间词要连它后面的顿挫一起吃掉，免得留下一个光秃秃的逗号 */
const DEICTIC_LEADING =
  /^\s*(?:今天|今日|今儿|昨天|昨日|昨儿|前天|前日|今早|今晨|今上午|今晚|昨早|昨晚|刚才|刚刚)\s*[，,、]*\s*/;

/**
 * 把正文里"相对于写入时刻"的时间词摘掉。
 *
 * 为什么在**渲染时**摘、而不是只靠提示词约束：
 *
 *  1. 老档案里已经烤进去一堆"今天"，不可能为此重写用户的记忆
 *  2. 模型不可能 100% 听话，得有一道兜底
 *  3. 摘掉之后正文变成"他让我写个东西……"，而时间由前缀给 ——
 *     **时间只在一处生成**，这才是那个读者要的东西
 *
 * @param {string} text
 * @returns {string} 摘干净之后仍然像人话的正文
 */
export function stripTimeWords(text) {
  if (typeof text !== 'string') return '';
  const original = text.trim();
  let s = original.replace(DEICTIC_LEADING, '');
  s = s.replace(DEICTIC, '');
  s = s.replace(/^\s*[，,、]+\s*/, '').replace(/\s{2,}/g, ' ').trim();

  // 兜底：摘没了、或者摘得只剩几个字，就别动它。
  // 宁可留一个多余的"今天"，也不要把一条记忆变成空壳。
  if (s.length < 4) return original;
  return s;
}

// ─────────────────────────────────────────────────────────────
// 时刻：几点说的，用人的话说出来
//
// 2026-11-09 加，起因是一句很普通的话：
//
//     "11 月 9 日凌晨两点他还在问我插件的事"
//
// 这句话里的分量不在"问了什么"，在**凌晨两点**。原来的档案只存日期，
// 同一天的早上十点和凌晨两点写出来一模一样 —— 于是他熬夜这件事，
// 在记忆里从来不存在。日子不是只有日期，还有它是几点过的。
//
// 只做到"时段 + 钟点"，做不到分钟级的精确，也不需要：
// 「凌晨两点」是他会说的话，「02:17」不是。
// ─────────────────────────────────────────────────────────────

const HOUR_CN = ['零', '一', '两', '三', '四', '五', '六', '七', '八', '九', '十'];

/**
 * 一天里的哪一段。按他那边（UTC+8）的钟点算。
 *
 * 分段的边界挑的是**人的说法**，不是等分：
 * 十一点还算上午（还没吃午饭），十三点才算下午（吃完睡了会儿）。
 *
 * @param {number} hour 0–23
 * @returns {string}
 */
export function phaseOf(hour) {
  const h = Math.floor(Number(hour));
  if (!Number.isFinite(h) || h < 0 || h > 23) return '';
  if (h < 5) return '凌晨';
  if (h < 8) return '清晨';
  if (h < 11) return '上午';
  if (h < 13) return '中午';
  if (h < 17) return '下午';
  if (h < 19) return '傍晚';
  if (h < 23) return '夜里';
  return '深夜';
}

/** 0–23 → 「零点 / 一点 / …… / 十一点 / 十二点」（十二小时制的口语说法） */
function hourWord(hour) {
  const h = Math.floor(hour) % 24;
  if (h === 0) return '零';
  const x = h % 12; // 0–11：0 代表"十二点"，11 代表"十一点"
  if (x === 0) return '十二';
  if (x <= 10) return HOUR_CN[x];
  return '十一';
}

/**
 * 某个时刻用人的话怎么说：「凌晨两点」「下午三点半」。
 *
 * 分钟只取"半"，不报具体分钟：记忆里不需要 02:17 这种精度，
 * 而"两点半"是他真会说的说法。
 *
 * @param {number} ts
 * @returns {string} 空串表示这个时刻不可用
 */
export function clockLabel(ts) {
  if (!Number.isFinite(ts)) return '';
  const d = new Date(ts + TZ_OFFSET_MS);
  const hour = d.getUTCHours();
  const phase = phaseOf(hour);
  if (phase === '') return '';
  const half = d.getUTCMinutes() >= 30 ? '半' : '';
  return `${phase}${hourWord(hour)}点${half}`;
}

/**
 * 「哪天 + 几点」合成一个词：「今天凌晨两点」「昨天深夜」「11-05 下午三点」。
 *
 * **和 dayLabel 用同一把尺子**（自然日），只是多说了一句钟点。
 * 分不清远近的时候（dayLabel 退回日期了）就加个空格隔开，
 * 免得「11-05 凌晨」连成一个看不懂的词。
 *
 * @param {number} createdAt
 * @param {number} [now]
 * @returns {string}
 */
export function whenStamp(createdAt, now = Date.now()) {
  if (!Number.isFinite(createdAt)) return '';
  const day = dayLabel(createdAt, now);
  const clock = clockLabel(createdAt);
  if (clock === '') return day;
  if (day === '今天' || day === '昨天') return `${day}${clock}`;
  return day === '' ? clock : `${day} ${clock}`;
}

// ─────────────────────────────────────────────────────────────
// 停顿：那句没说完的话
//
// 2026-11-09 加。他说到一半停住的时候，档案里只留下前半句，
// 读起来像一句普通的话 —— 断的那个地方不在了。
//
// 判断只看**尾巴**，不看内容：末尾是省略号、或者整句就是
// "算了 / 没什么 / 没事"这类收回去的话。
//
// 刻意不做的事：**不改他的话**。这里只回答"断没断"，
// 断在哪儿由读的人自己看。改写原话就等于把小纸条的意义抹掉了。
// ─────────────────────────────────────────────────────────────

/** 收回去的话：说完了，但把话咽回去了 */
/** 收回去的话。允许前面带一句开头（「那个算了」「哎算了」），不然「那个……算了」漏判。 */
const RETRACTED =
  /^(?:.{0,8})?(?:算了|没什么|没事|不重要|不说了|不想说了|随便|无所谓|忘了吧|当我没说|就这样吧)[^\p{L}\p{N}]*$/u;

/**
 * 尾巴拖着没收的：省略号、破折号、问号堆。
 *
 * ⚠️ 2026-11-11 修：「那个 / 就是 / 然后」**不再当断句标志**。
 * 原来写成 `/(?:…|那个|就是|然后呢?)[。，,\s]*$/`，于是
 * 「webdav那个不用修」「然后现在调用的顺序是什么」全被判成"没说完" ——
 * 它们是**好好的完整句子**，只是中文口语里"那个"很常见。
 * 拿真实纸条对账：带这些词的 12 条里，真断句的是 0 条。
 *
 * 现在只认硬信号：话停在省略号/破折号/一串问号上。
 * 宁可漏判几条真断的，也不要满屏假断句 —— 假断句会让「这里断了」这个标记贬值。
 */
const TRAILING = /(?:…|\.{3,}|~{2,}|——|[?？]{2,})[。，,！!？?\s]*$/;

/**
 * 他这句是不是没说完。
 *
 * @param {string} said
 * @returns {{ unfinished: boolean, kind: ''|'retracted'|'trailing' }}
 */
export function lookUnfinished(said) {
  const text = String(said ?? '').trim();
  if (text === '') return { unfinished: false, kind: '' };
  if (RETRACTED.test(text)) return { unfinished: true, kind: 'retracted' };
  if (TRAILING.test(text)) return { unfinished: true, kind: 'trailing' };
  return { unfinished: false, kind: '' };
}
