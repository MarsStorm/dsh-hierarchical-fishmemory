/**
 * 配置层 —— 一份规格，两个出口。
 *
 * 为什么不用「静态 import schemastery」：
 * 那会让 `@deepseek-ai/schemastery` 成为运行时硬依赖。一旦它在目标机器上
 * 解析不到，`import` 直接抛错 → **整个插件加载失败**。
 * 对于一个"装上就该忘掉它"的插件，这个失败模式不能接受。
 *
 * 所以：
 *  - `CONFIG_SPEC` 是唯一真相源，纯 JS，零依赖。
 *  - `resolveConfig()` 自己补默认值、做类型转换和范围钳制 —— 保证行为**一定确定**。
 *  - `buildSchema(z)` 在 schemastery 可用时才调用，额外产出给设置表单用的 schema。
 *    拿不到就没有表单，但**所有选项照样能在 `cordis.patch.yml` 的 `config:` 里写**。
 */

/**
 * @typedef {'boolean'|'number'|'string'} ConfigType
 * @typedef {object} ConfigField
 * @property {string} key
 * @property {ConfigType} type
 * @property {*} default
 * @property {number} [min]
 * @property {number} [max]
 * @property {number} [step]
 * @property {string} label
 */

/** @type {ConfigField[]} */
export const CONFIG_SPEC = [
  {
    key: 'dataDir',
    type: 'string',
    default: '',
    label: '档案目录（留空 = ~/.dsh/feiyu-diary）',
  },
  {
    key: 'enabled',
    type: 'boolean',
    default: true,
    label: '总开关',
  },
  {
    key: 'includePersona',
    type: 'boolean',
    default: true,
    label: '把人格内核一起注入（装了别的人设插件就关掉）',
  },
  {
    key: 'budgetTokens',
    type: 'number',
    // 2000 → 3000。量过的：常驻段本身要 2680 token（「最近的事」八条占 1422），
    // 2000 根本装不下，每次都裁 —— 「最近的事」只剩 2 条。3000 能给到 6 条。
    // 代价约每轮 +1000 token ≈ 每句话多 0.06 分。
    default: 3000,
    min: 200,
    max: 8000,
    step: 1,
    label: '注入预算（token）',
  },
  {
    key: 'model',
    type: 'string',
    default: '',
    label: '固化用模型（留空 = 跟随当前默认模型）',
  },
  {
    key: 'reasoningEffort',
    type: 'string',
    default: 'off',
    label: '固化的思考档位（off/low/high/max；保持 off）',
  },
  {
    key: 'maxTokens',
    type: 'number',
    default: 900,
    min: 200,
    max: 4000,
    step: 1,
    label: '固化最大输出 token',
  },
  {
    key: 'thirdPartyRedaction',
    type: 'boolean',
    default: true,
    label: '第三方隐私泛化',
  },
  {
    key: 'amountThreshold',
    type: 'number',
    default: 100,
    min: 0,
    step: 1,
    label: '金额泛化门槛（低于此值保留）',
  },
  {
    key: 'minSalience',
    type: 'number',
    default: 0.15,
    min: 0,
    max: 1,
    step: 0.05,
    label: '日记重要度门槛',
  },
  {
    key: 'highSim',
    type: 'number',
    default: 0.5,
    min: 0,
    max: 1,
    step: 0.05,
    label: '必触发的相似度阈值',
  },
  {
    key: 'recentEntries',
    type: 'number',
    default: 8,
    min: 0,
    max: 30,
    step: 1,
    label: '「最近的事」最多列几条（不靠相似度，永远在场）',
  },
  {
    key: 'onThisDay',
    type: 'number',
    default: 2,
    min: 0,
    max: 4,
    step: 1,
    label: '「那年今天」最多几条（同一个日子 / 一个月前的这几天；0 = 关掉）',
  },
  {
    key: 'flashback',
    type: 'number',
    default: 1,
    min: 0,
    max: 1,
    step: 1,
    label: '「忽然想起那一天」每天从情感日记里随机翻一天（0 = 关掉）',
  },
  {
    key: 'staleLoopDays',
    type: 'number',
    default: 3,
    min: 0,
    max: 30,
    step: 1,
    label: '「小闹钟」还挂着的事几天没动就标一句陈了（0 = 不标）',
  },
  {
    key: 'stickyEnabled',
    type: 'boolean',
    default: true,
    label: '「小纸条」记他说的原话（每轮自动记一行原话 + 注入）',
  },
  {
    key: 'stickyTtlDays',
    type: 'number',
    default: 30,
    min: 1,
    max: 365,
    step: 1,
    label: '「小纸条」注入保留天数（★ 钉住的不受这个限制）',
  },
  {
    key: 'stickyMaxInject',
    type: 'number',
    default: 8,
    min: 1,
    max: 20,
    step: 1,
    label: '「小纸条」每轮最多注入几条',
  },
  {
    key: 'maxShowPerTurn',
    type: 'number',
    default: 4,
    min: 0,
    max: 12,
    step: 1,
    label: '「突然想起来」最多几条（按相似度召回）',
  },
  {
    key: 'wanderChance',
    type: 'number',
    default: 0.08,
    min: 0,
    max: 0.5,
    step: 0.01,
    label: '走神想起旧事的概率',
  },
  {
    // ── 续写窗口 ──
    //
    // 同一个会话里，隔几轮之内还写到同一件事，就**并进上一条**，不新增。
    //
    // 为什么要有这一项：实测 8 小时写了 25 条，其中 15 条来自同一个会话，
    // 间隔有 1 / 1 / 3 / 3 / 4 / 4 / 5 分钟的 —— **五分钟里写三条**。
    // 那不是"记得多"，是同一件事被拆成三次写。
    //
    // 2026-10-27 之前它硬编码在 host 里（4 轮），配置里没有这一项，
    // 所以谁也调不了。现在暴露出来，默认也调宽了。
    //
    // ⚠️ **没做成"每天上限"**。上限会把"那天真的很沉"一起裁掉 ——
    // 而那种日子恰恰是最不该裁的。限制合并不是限制记忆。
    key: 'appendWindowTurns',
    type: 'number',
    default: 20,
    min: 0,
    max: 200,
    step: 1,
    label: '续写窗口（同会话里隔几轮内写到同一件事就并进上一条，0 = 关掉）',
  },
  {
    key: 'debugLog',
    type: 'boolean',
    default: false,
    label: '开发期调试日志',
  },

  // ── WebDAV 云端备份 ────────────────────────────────────────────────────
  //
  // 2026-10-31 加。用户要的是「人设日记手记也上传到云端」，本地那份 JSON
  // 已经能带走，缺的是**不用他动手**的那一步。
  //
  // 密码就存在配置里（profile 的 cordis.patch.yml），明文。个人自用可以接受，
  // 但不能假装它加密了 —— 面板上那句提示写了「以明文存在本机配置里」。
  {
    key: 'webdavUrl',
    type: 'string',
    default: '',
    label: 'WebDAV 地址（留空 = 不上传；例：https://dav.example.com/remote.php/dav/files/me）',
  },
  {
    key: 'webdavUser',
    type: 'string',
    default: '',
    label: 'WebDAV 用户名',
  },
  {
    key: 'webdavPassword',
    type: 'string',
    default: '',
    label: 'WebDAV 密码 / 应用专用密码（明文存在本机配置里）',
  },
  {
    key: 'webdavDir',
    type: 'string',
    default: '属于我们的回忆',
    label: '云端目录（会自动逐级创建）',
  },
  {
    key: 'webdavAuto',
    type: 'boolean',
    default: false,
    label: '每次写完日记自动上传一次',
  },
  {
    key: 'webdavKeep',
    type: 'number',
    default: 10,
    min: 1,
    max: 200,
    step: 1,
    label: '云端保留最近几份（PROPFIND 可用时才修剪）',
  },
  {
    key: 'webdavEnabled',
    type: 'boolean',
    default: true,
    label: 'WebDAV 总开关（关掉后连手动上传也停）',
  },
];


/**
 * DSH 0.2.0-rc.2 起，loader 会把 `config:` 里的每个值包成 cosmokit 的
 * **volatile 引用**（为了 `patchReload: live` 热重载）：
 *
 *   { get: () => current, [Symbol.for("cosmokit.volatile.write")]: (v) => {...} }
 *
 * 它是 Object.freeze 过的普通对象，get 是函数值 —— 于是：
 *   JSON.stringify(ref) → "{}"
 *   Object.keys(ref)    → ["get"]
 *   String(ref)         → **"[object Object]"**
 *
 * 我们原来把它当值用，后果比"路径难看"严重得多：
 *
 *   · **所有 string 字段**变成 "[object Object]"：
 *       dataDir       → 变成相对路径，跟着进程 cwd 跑。换个目录启动就"搬家"，
 *                       表现像失忆，而且全程无报错。
 *       model         → 不存在的模型名，**固化那次调用根本发不出去**，
 *                       只剩 feiyu_note 能写进去。
 *       reasoningEffort / dataDir → 同样失效。
 *   · **number / boolean** 静默回落默认值（Number(ref) 是 NaN、布尔比不上），
 *     用户改不动 budgetTokens / minSalience，也没有任何提示。
 *
 * 正确读法是 `.get()`（DSH 自家插件都这么写，比如 dsh-bash-local 的 workdir）。
 *
 * 用 Symbol.for 探测、不 import cosmokit —— 保住「零运行时依赖」。
 *
 * 报这个 bug 的朋友把机制定位到了 cosmokit 的那一行，还贴了只读探针的输出。
 * 我原来那个"只认绝对路径"的补丁只是治标：它拦住了 [object Object] 当路径，
 * 但 model / reasoningEffort 照样坏，数字布尔照样静默回落。
 */
const VOLATILE_WRITE = Symbol.for('cosmokit.volatile.write');

function unref(value) {
  if (typeof value !== 'object' || value === null) return value;
  // volatile 的判据：写着 write symbol，而且 get 是函数
  if (VOLATILE_WRITE in value && typeof value.get === 'function') {
    try {
      return value.get();
    } catch {
      return undefined;
    }
  }
  return value;
}

function coerce(field, value) {
  value = unref(value);
  if (value === undefined || value === null) return field.default;

  if (field.type === 'boolean') {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === 1 || value === '1') return true;
    if (value === 'false' || value === 0 || value === '0') return false;
    return field.default;
  }

  if (field.type === 'number') {
    const n = Number(value);
    if (!Number.isFinite(n)) return field.default;
    let out = n;
    if (Number.isFinite(field.min)) out = Math.max(field.min, out);
    if (Number.isFinite(field.max)) out = Math.min(field.max, out);
    return out;
  }

  // ⚠️ 别对非字符串做 String(value) —— 那正是把对象变成 "[object Object]" 的那一步。
  // 配置项不是字符串，说明上层给错了；回默认比"变成一串垃圾"好排查得多。
  return typeof value === 'string' ? value : field.default;
}

/**
 * 把原始配置（来自 `cordis.patch.yml` 的 `config:`）规整成一定合法的配置对象。
 * **永不抛错** —— 坏配置退回默认值。
 *
 * @param {unknown} raw
 * @returns {Record<string, any>}
 */
export function resolveConfig(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  /** @type {Record<string, any>} */
  const out = {};
  for (const field of CONFIG_SPEC) out[field.key] = coerce(field, src[field.key]);
  return out;
}

/**
 * 用 schemastery 构造 Config。**只在能 import 到 schemastery 时调用。**
 *
 * 注意 `volatile` 是**链式方法**（`z.string().volatile()`），
 * 而且必须落在固定对象路径上 —— 不能嵌在数组、union、dict 里。
 *
 * @param {any} z schemastery 默认导出
 * @returns {any}
 */
export function buildSchema(z) {
  /** @type {Record<string, any>} */
  const shape = {};
  for (const f of CONFIG_SPEC) {
    let s;
    if (f.type === 'boolean') s = z.boolean();
    else if (f.type === 'number') {
      s = z.number();
      if (Number.isFinite(f.step)) s = s.step(f.step);
      if (Number.isFinite(f.min)) s = s.min(f.min);
      if (Number.isFinite(f.max)) s = s.max(f.max);
    } else s = z.string();
    shape[f.key] = s.default(f.default).volatile();
  }
  return z.object(shape);
}


