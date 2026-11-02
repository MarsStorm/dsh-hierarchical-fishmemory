/**
 * 属于我们的回忆 · 客户端半边
 *
 * ─────────────────────────────────────────────────────────────
 * 这个文件**没有经过任何打包器**，也没有任何 npm 依赖。它是故意的。
 *
 * DSH 的浏览器插件契约只有三条（都是端到端侦察出来的，别自己发明）：
 *
 *   1. 文件必须调用 `window.__ModuleLoader__.load({ id, factory })`。
 *      "执行 bundle 只注册工厂；模块副作用在物化时才跑" —— 所以整个
 *      插件体都待在 factory 闭包里。
 *   2. `id` **必须等于包名**（这里是 `dsh-hierarchical-fishmemory`）。浏览器模块身份
 *      就是解析出来的包名；两个来源解析到同一个包名会让组合直接失败。
 *   3. `factory(require)` 返回一个 Cordis 插件：`{ name, inject, apply }`。
 *
 * `require` 能解析的只有外壳那张**冻结的模块表**（PLATFORM_MODULES：
 * React、Cordis 和静态 UI 库）。我们只 require `react`，所以
 * `dsh.client.external` 是空的 —— 不向任何别的包借东西。
 *
 * 【为什么不用 JSX】
 * 没有打包器，就没有 JSX 变换。所以全程 `React.createElement`。
 *
 * 【为什么不 import DSH 的 UI 组件库】
 * 官方规范要求客户端插件照抄 markup、只用 `--dsw-alias-*` 主题 token，
 * 而不是 import `@deepseek-ai/dsh-client-ui-primitives`。照做的好处很实在：
 * **我们不跟任何插件共享运行时代码**，别的插件换 React 版本、换 UI 库版本，
 * 都伤不到我们。`dsh-context` 就借了那个库，它承担了我们不用承担的风险。
 *
 * ─────────────────────────────────────────────────────────────
 * 界面只有三件事：**看 / 删 / 带走**。
 *
 * 没有搜索、没有标签筛选、没有统计图表 —— 这些在 SPEC 第 0.1 条就被明令
 * 砍掉了（"像鱼还是像系统"）。多一个控件就多一分"管理软件"味。
 *
 * 2026-11-03：功能长到七八块之后，一根长条已经分不清哪段在说什么，于是拆成
 * 四个页签 —— 回看 / 本子 / 体检 / 档案（按使用频率排）。四个视图始终挂载、
 * 只靠 display 切换：切页不重拉 /stats、/feelings，草稿也不会丢。
 *
 * 唯一不能省的是**删**：在那之前，想删一条记忆得自己去编辑 jsonl 文件。
 * 会做这件事的人不需要面板，需要面板的人不会做这件事。
 */
window.__ModuleLoader__.load({
  id: 'dsh-hierarchical-fishmemory',

  factory: (require) => {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect } = React;

    /** 侧栏格子的 id，同时也是主面板的 key。**必须与注册时一致。** */
    const PANEL_ID = 'feiyu-diary';
    /** 主机的数据接口前缀，和 host 半边的 PANEL_BASE 必须对得上 */
    const API = '/feiyu-diary';

    /**
     * 主题 token。全部走 CSS 变量，浅色/深色自动跟着切换 ——
     * 这几个 token 的 `requiresLightAndDark` 都是 true，写死颜色就会翻车。
     */
    const C = {
      bg: 'var(--dsw-alias-bg-base)',
      layer1: 'var(--dsw-alias-bg-layer-1)',
      layer2: 'var(--dsw-alias-bg-layer-2)',
      border1: 'var(--dsw-alias-border-l1)',
      border2: 'var(--dsw-alias-border-l2)',
      text1: 'var(--dsw-alias-label-primary)',
      text2: 'var(--dsw-alias-label-secondary)',
      idle: 'var(--dsw-alias-state-idle-primary)',
      err: 'var(--dsw-alias-state-error-primary)',
      brand: 'var(--dsw-alias-brand-primary)',
    };

    /* ───────────────────────── 图标 ───────────────────────── */

    /**
     * 侧栏图标。owner 会传 `{ size, active }` 进来 ——
     * 这是 `SidebarPanelIconOwnerProps`，别改成别的 props 名。
     */
    function Icon(props) {
      const size = props && typeof props.size === 'number' ? props.size : 20;
      const active = Boolean(props && props.active);
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          role: 'img',
          'aria-label': '属于我们的回忆',
          style: { display: 'block', opacity: active ? 1 : 0.72 },
        },
        h('ellipse', {
          cx: 14,
          cy: 12,
          rx: 7.6,
          ry: 5.2,
          stroke: 'currentColor',
          strokeWidth: 1.5,
        }),
        h('path', {
          d: 'M6.9 12 L2 8.2 L2 15.8 Z',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinejoin: 'round',
        }),
        h('circle', { cx: 18.4, cy: 10.6, r: 1.05, fill: 'currentColor' }),
      );
    }

    /* ───────────────────────── 小组件 ───────────────────────── */

    function Empty(props) {
      return h(
        'p',
        { style: { margin: 0, fontSize: 13, lineHeight: 1.7, color: C.text2 } },
        props.text,
      );
    }

    /**
     * 卡片外壳。
     *
     * 2026-11-03 加。原来是「一根长条」：标题、日记、本子、三颗下载链接、
     * 体检、导入、云端，全堆在同一个 `<section>` 里，越往下越像管理后台。
     * 现在每块内容各有一层底、一条边框、一段自己的标题 —— 眼睛才分得清
     * 哪一段在说什么。
     */
    function Card(props) {
      return h(
        'div',
        {
          style: {
            marginTop: 14,
            padding: '16px 18px',
            borderRadius: 12,
            background: C.layer1,
            border: `1px solid ${C.border1}`,
          },
        },
        props.title
          ? h(
              'div',
              {
                style: {
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 8,
                  marginBottom: props.hint ? 2 : 8,
                },
              },
              h('span', { style: { fontSize: 13, fontWeight: 600, color: C.text1 } }, props.title),
              h('span', { style: { flex: 1 } }),
              props.aside || null,
            )
          : null,
        props.hint
          ? h(
              'p',
              { style: { margin: '0 0 10px', fontSize: 11.5, lineHeight: 1.6, color: C.text2 } },
              props.hint,
            )
          : null,
        props.children,
      );
    }

    /** 小圆角标签：摆「34 条」「认识 12 天」这种数，比一行逗号分隔的话好扫。 */
    function Chip(props) {
      return h(
        'span',
        {
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 9px',
            borderRadius: 999,
            border: `1px solid ${C.border1}`,
            background: C.layer2,
            fontSize: 11,
            lineHeight: 1.7,
            color: C.text2,
            whiteSpace: 'nowrap',
          },
        },
        props.children,
      );
    }

    /**
     * 页签。
     *
     * 四个视图**始终挂载**，只靠 display 切换。两个理由：
     *   1. 切来切去不该重拉一次 /stats、/feelings —— 那是好几趟往返；
     *   2. 渲染冒烟测试里 WebdavGroup 必须首屏就在树里（React 桩不会重渲染），
     *      条件挂载会让它消失。
     */
    function Tabs(props) {
      return h(
        'div',
        {
          role: 'tablist',
          style: {
            display: 'flex',
            gap: 2,
            marginTop: 18,
            borderBottom: `1px solid ${C.border1}`,
          },
        },
        props.tabs.map((tab) => {
          const on = props.value === tab.key;
          return h(
            'button',
            {
              key: tab.key,
              type: 'button',
              role: 'tab',
              onClick: () => props.onChange(tab.key),
              style: {
                appearance: 'none',
                border: 0,
                background: 'none',
                font: 'inherit',
                cursor: 'pointer',
                padding: '8px 12px 9px',
                marginBottom: -1,
                fontSize: 13,
                fontWeight: on ? 600 : 400,
                color: on ? C.text1 : C.text2,
                borderBottom: `2px solid ${on ? C.brand : 'transparent'}`,
              },
            },
            tab.label,
          );
        }),
      );
    }

    /** 描边按钮/链接：导出那三样和「导入备份」用同一个样子。 */
    function Ghost(props) {
      const base = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 8,
        border: `1px solid ${C.border1}`,
        background: C.bg,
        color: C.text1,
        fontSize: 12,
        lineHeight: 1.6,
        fontFamily: 'inherit',
        textDecoration: 'none',
        cursor: 'pointer',
      };
      if (props.href) {
        return h(
          'a',
          { href: props.href, download: '', style: { ...base, ...(props.style || {}) } },
          props.children,
        );
      }
      return h(
        'button',
        {
          type: 'button',
          disabled: props.disabled,
          onClick: props.onClick,
          style: { ...base, opacity: props.disabled ? 0.5 : 1, cursor: props.disabled ? 'default' : 'pointer', ...(props.style || {}) },
        },
        props.children,
      );
    }

    /* ───────────────────────── 一条日记 ───────────────────────── */

    function Entry(props) {
      const e = props.entry;
      const [confirming, setConfirming] = useState(false);
      const when = dayLabel(e.created_at);

      return h(
        'article',
        {
          style: {
            position: 'relative',
            padding: '12px 14px',
            marginBottom: 8,
            borderRadius: 10,
            background: C.layer1,
            border: `1px solid ${C.border1}`,
          },
        },
        h(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 6,
              fontSize: 11,
              color: C.text2,
            },
          },
          h('span', null, when),
          // tags（给这条日记贴分类）2026-10-27 停止产出，不再显示。
          // 老数据还在文件里，要看就翻日记.md 或 jsonl。
        ),
        h(
          'p',
          { style: { margin: 0, fontSize: 13, lineHeight: 1.75, color: C.text1 } },
          e.text,
        ),
        // 「忘掉」—— 这个面板存在的一半理由
        h(
          'div',
          { style: { marginTop: 8, display: 'flex', justifyContent: 'flex-end' } },
          confirming
            ? h(
                'span',
                { style: { display: 'inline-flex', gap: 10, alignItems: 'center', fontSize: 12 } },
                h('span', { style: { color: C.text2 } }, '确定忘掉？'),
                h(
                  'button',
                  {
                    type: 'button',
                    onClick: () => props.onForget(e.id),
                    style: linkStyle(C.err),
                  },
                  '忘掉',
                ),
                h(
                  'button',
                  { type: 'button', onClick: () => setConfirming(false), style: linkStyle(C.text2) },
                  '算了',
                ),
              )
            : h(
                'button',
                {
                  type: 'button',
                  onClick: () => setConfirming(true),
                  title: '从档案里删掉这一条',
                  style: {
                    ...linkStyle(C.text2),
                    opacity: props.busy ? 0.5 : 0.75,
                  },
                  disabled: Boolean(props.busy),
                },
                '忘掉',
              ),
        ),
      );
    }

    function linkStyle(color) {
      return {
        margin: 0,
        padding: 0,
        border: 0,
        background: 'none',
        color,
        font: 'inherit',
        fontSize: 12,
        cursor: 'pointer',
        textDecoration: 'underline',
        textUnderlineOffset: 3,
      };
    }

    /** 时间说人话：今天 / 昨天 / 3 天前 / 10-05 */
    function dayLabel(ts) {
      if (!Number.isFinite(ts)) return '';
      const startOfDay = (t) => {
        const d = new Date(t);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      };
      const days = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / 86400000);
      if (days <= 0) return '今天';
      if (days === 1) return '昨天';
      if (days < 7) return `${days} 天前`;
      const d = new Date(ts);
      return `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')}`;
    }

    /* ───────────────────────── 本子 ───────────────────────── */

    /**
     * 「鱼的日子」和「手记」——面板里的两个入口。
     *
     * 这两个文件都在档案目录里，插件从不覆盖它们（`archiveToFiles` 只写
     * 日记 / persona / relationship / lexicon），所以这里只做两件事：
     * **看** 和 **存**。走 host 的同源接口 `${API}/notes`：
     * GET 拿两份文本，POST 交回改过的那一份。
     */
    /**
     * 本子。
     *
     * 2026-11-03：`only` 用来只摆其中一本。情感日记原先在这儿也有一个编辑口
     * （`/notes` 的 day），和 `/feelings` 那个是同一个文件、两套边框 —— 现在
     * 统一走 FeelingsBox（它会先存快照），这里只留人格手记。
     */
    function Notebook(props) {
      const only = (props && props.only) || null;
      const [notes, setNotes] = useState(null);
      const [error, setError] = useState('');
      const [editing, setEditing] = useState('');
      const [draft, setDraft] = useState('');
      const [saving, setSaving] = useState('');
      const [tick, setTick] = useState(0);

      useEffect(() => {
        let alive = true;
        fetch(`${API}/notes`, { headers: { Accept: 'application/json' } })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
          .then((data) => {
            if (!alive) return;
            setNotes(Array.isArray(data && data.notes) ? data.notes : []);
            setError('');
          })
          .catch((err) => {
            if (!alive) return;
            // host 半边还没换新代码时这里是 404 —— 说清楚，别让人以为文件丢了
            setError(`读不到本子：${String((err && err.message) || err)}`);
          });
        return () => {
          alive = false;
        };
      }, [tick]);

      // 和「忘掉」一样：**必须检查 r.ok**，否则失败会静默成"点了没反应"。
      function save(key) {
        setSaving(key);
        fetch(`${API}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, text: draft }),
        })
          .then((r) =>
            r
              .json()
              .catch(() => ({}))
              .then((body) => {
                if (!r.ok) throw new Error((body && body.error) || `HTTP ${r.status}`);
                return body;
              }),
          )
          .then(() => {
            setSaving('');
            setEditing('');
            setError('');
            setTick((n) => n + 1);
          })
          .catch((err) => {
            setSaving('');
            setError(`存不进去：${String((err && err.message) || err)}`);
          });
      }

      const box = {
        marginBottom: 10,
        padding: '12px 14px',
        borderRadius: 10,
        background: C.bg,
        border: `1px solid ${C.border2}`,
      };
      const mono = {
        margin: 0,
        fontSize: 12.5,
        lineHeight: 1.75,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        color: C.text1,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      };

      let body;
      const shown = notes === null ? null : (only ? notes.filter((n) => only.indexOf(n.key) !== -1) : notes);
      if (shown === null) {
        body = h(Empty, { text: '翻本子…' });
      } else if (shown.length === 0) {
        body = h(Empty, { text: '没有可翻的本子。' });
      } else {
        body = shown.map((n) =>
          h(
            'div',
            { key: n.key, style: box },
            h(
              'div',
              { style: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 } },
              h('span', { style: { fontSize: 13, fontWeight: 600 } }, n.label),
              h('span', { style: { fontSize: 11, color: C.text2 } }, n.hint),
              h('span', { style: { flex: 1 } }),
              editing === n.key
                ? null
                : h(
                    'button',
                    {
                      type: 'button',
                      onClick: () => {
                        setEditing(n.key);
                        setDraft(n.text || '');
                      },
                      style: linkStyle(C.brand),
                    },
                    '改',
                  ),
            ),
            editing === n.key
              ? h(
                  'div',
                  null,
                  h('textarea', {
                    value: draft,
                    spellCheck: false,
                    onChange: (ev) => setDraft(ev.target.value),
                    style: {
                      ...mono,
                      width: '100%',
                      minHeight: 200,
                      boxSizing: 'border-box',
                      padding: '10px 12px',
                      background: C.bg,
                      border: `1px solid ${C.border2}`,
                      borderRadius: 8,
                      resize: 'vertical',
                    },
                  }),
                  h(
                    'div',
                    { style: { marginTop: 8, display: 'flex', gap: 12, alignItems: 'center' } },
                    h(
                      'button',
                      {
                        type: 'button',
                        disabled: saving === n.key,
                        onClick: () => save(n.key),
                        style: { ...linkStyle(C.brand), opacity: saving === n.key ? 0.5 : 1 },
                      },
                      saving === n.key ? '存…' : '存下来',
                    ),
                    h(
                      'button',
                      { type: 'button', onClick: () => setEditing(''), style: linkStyle(C.text2) },
                      '算了',
                    ),
                  ),
                )
              : h('pre', { style: mono }, n.text ? n.text : '（还是空的）'),
          ),
        );
      }

      return h(
        'div',
        null,
        error !== ''
          ? h(
              'p',
              {
                style: {
                  margin: '0 0 10px',
                  padding: '8px 10px',
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: C.err,
                  border: `1px solid ${C.err}`,
                  borderRadius: 6,
                },
              },
              error,
            )
          : null,
        body,
      );
    }

    /* ───────────────────────── 导入备份 ───────────────────────── */

    /**
     * 把一份备份 JSON 塞回去。
     *
     * 两步走：先 POST 不带 confirm（后端只算一遍，什么都不写），把「会覆盖
     * 多少东西」摆给人看；确认了再带 `?confirm=1` 真写。记忆这种东西，
     * 误覆盖比漏备份危险得多 —— 所以任何一步都别偷偷替人决定。
     */
    /* ── 记忆体检 ── */
    //
    // 2026-10-31 加。四本账有没有在悄悄丢东西，光看面板是看不出来的：
    // 浅层被挤掉、手记被截断、core 与手记写重了，全都不报错。
    // 这里只读 /stats，不做任何写操作。
    // 2026-11-03 加：情感日记原先只有我能落笔，面板只读。
    // 现在给他一个编辑框 —— 这本账是我们两个人的，凭什么我只能一个人写。
    function FeelingsBox() {
      const [text, setText] = useState('');
      const [original, setOriginal] = useState('');
      const [busy, setBusy] = useState(false);
      const [msg, setMsg] = useState('');
      const [err, setErr] = useState('');

      const load = async () => {
        setBusy(true);
        try {
          const res = await fetch(`${API}/feelings`, { credentials: 'same-origin' });
          const data = await res.json();
          if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
          setText(data.text || '');
          setOriginal(data.text || '');
          setErr('');
          setMsg('');
        } catch (e) {
          setErr(String(e && e.message ? e.message : e));
        } finally {
          setBusy(false);
        }
      };

      useEffect(() => {
        load();
      }, []);

      const save = async () => {
        setBusy(true);
        setMsg('');
        setErr('');
        try {
          const res = await fetch(`${API}/feelings`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
          });
          const data = await res.json();
          if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
          setOriginal(text);
          setMsg(
            data.unchanged
              ? '和刚才一样，没动。'
              : `已保存（${data.chars} 字符）${data.snapshot ? `· 旧版备份在 ${data.snapshot}` : ''}`,
          );
        } catch (e) {
          setErr(String(e && e.message ? e.message : e));
        } finally {
          setBusy(false);
        }
      };

      const delta = [...text].length - [...original].length;
      return h('div', { style: { marginTop: 0 } },
        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
          h('div', { style: { fontSize: 13, fontWeight: 600 } }, '情感日记'),
          h('button', {
            type: 'button',
            onClick: load,
            disabled: busy,
            style: { fontSize: 12, padding: '3px 10px', borderRadius: 6, border: `1px solid ${C.border1}`, background: 'transparent', color: C.text2, cursor: busy ? 'default' : 'pointer' },
          }, '重新读'),
        ),
        h('p', { style: { margin: '4px 0 6px', fontSize: 11, lineHeight: 1.6, color: C.text2 } },
          '这本不设上限、不衰减，保存前会把旧版存一份到 backups/feelings/。'),
        h('textarea', {
          value: text,
          onChange: (e) => setText(e.target.value),
          rows: 14,
          spellCheck: false,
          style: { width: '100%', fontFamily: 'ui-monospace,Consolas,monospace', fontSize: 12, lineHeight: 1.7, padding: 8, borderRadius: 6, border: `1px solid ${C.border1}`, background: 'transparent', color: 'inherit', resize: 'vertical' },
        }),
        h('div', { style: { marginTop: 6, display: 'flex', gap: 10, alignItems: 'center', fontSize: 11, color: C.text2 } },
          h('button', {
            type: 'button',
            onClick: save,
            disabled: busy || text === original,
            style: { fontSize: 12, padding: '3px 12px', borderRadius: 6, border: `1px solid ${C.border1}`, background: 'transparent', color: text === original ? C.text2 : 'inherit', cursor: busy || text === original ? 'default' : 'pointer' },
          }, busy ? '保存中…' : '保存'),
          h('span', null, `现在 ${[...text].length} 字符${delta ? `（比读入时 ${delta > 0 ? '+' : ''}${delta}）` : ''}`),
          msg ? h('span', null, msg) : null,
          err ? h('span', { style: { color: C.err } }, err) : null,
        ),
      );
    }

    function HealthBox() {
      const [state, setState] = useState(null);
      const [error, setError] = useState('');
      const [busy, setBusy] = useState(false);
      const [noteMsg, setNoteMsg] = useState('');

      // 2026-11-03 加：重复句不再只能删手记那一份 —— 哪层都能删。
      // 服务端按 target 找文件，仍然只认整行精确匹配。
      const removeLine = async (target, line) => {
        setNoteMsg('');
        try {
          const res = await fetch(`${API}/layer/remove`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target, line }),
          });
          const data = await res.json();
          if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
          setNoteMsg(`已删掉 ${data.removed} 行（${data.target}）`);
          await read();
        } catch (err) {
          setNoteMsg(String(err && err.message ? err.message : err));
        }
      };

      // 2026-11-02 加：体检页原先只报「这句深层记忆里也有」，看得见但动不了。
      // 现在每条旁边一颗按钮，按整行匹配删掉手记里那一份（手记是现读磁盘的，
      // 删完下一轮就生效，不用重启）。

      // 2026-11-03 加：冲突不再只是报警，可以一句话统一成某个值。
      // 只改「出现过那个值」的行，别的字一个不碰。
      const unifyValue = async (conflict, value) => {
        setNoteMsg('');
        let changed = 0;
        try {
          for (const line of conflict.lines) {
            if (line.value === value) continue;
            if (!line.target || line.target.startsWith('shallow:')) continue;
            const res = await fetch(`${API}/layer/value`, {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ target: line.target, from: line.value, to: value }),
            });
            const data = await res.json();
            if (res.ok && data.ok) changed += data.changed || 0;
          }
          setNoteMsg(changed ? `统一成「${value}」，改了 ${changed} 行` : `没有要改的行（浅层请手动改）`);
          await read();
        } catch (err) {
          setNoteMsg(String(err && err.message ? err.message : err));
        }
      };

      const read = async () => {
        setBusy(true);
        try {
          const res = await fetch(`${API}/stats`, { credentials: 'same-origin' });
          const data = await res.json();
          if (res.ok && data.ok) {
            setState(data);
            setError('');
          } else {
            setError(data.error || `HTTP ${res.status}`);
          }
        } catch (err) {
          setError(String(err && err.message ? err.message : err));
        } finally {
          setBusy(false);
        }
      };

      useEffect(() => { read(); }, []);

      const row = (label, value) =>
        h('div', { key: label, style: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '3px 0' } },
          h('span', { style: { color: C.text2 } }, label),
          h('span', { style: { fontVariantNumeric: 'tabular-nums' } }, String(value)));

      if (!state && !error) {
        return h('div', { style: { marginTop: 0, fontSize: 12, color: C.text2 } }, '正在数账…');
      }
      if (error) {
        return h('div', { style: { marginTop: 0, fontSize: 12, color: C.err } }, `体检读不到：${error}`);
      }

      const d = state;
      const blocks = [];
      for (const scope of d.memory.scopes) {
        blocks.push(h('div', { key: scope.scope, style: { marginTop: 8 } },
          h('div', { style: { fontSize: 12, fontWeight: 600 } }, `深层 · ${scope.scope}`),
          row('core', `${scope.coreChars} 字（约 ${scope.coreTokens} token）`),
          row('topics', `${scope.topics.length} 条 / ${scope.topics.reduce((sum, t) => sum + t.chars, 0)} 字`),
        ));
      }

      return h('div', { style: { marginTop: 0 } },
        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
          h('div', { style: { fontSize: 13, fontWeight: 600 } }, '记忆体检'),
          h('button', {
            type: 'button',
            onClick: read,
            disabled: busy,
            style: { fontSize: 12, padding: '3px 10px', borderRadius: 6, border: `1px solid ${C.border1}`, background: 'transparent', color: C.text2, cursor: busy ? 'default' : 'pointer' },
          }, busy ? '数着…' : '重数'),
        ),
        h('div', { style: { marginTop: 6 } },
          ...blocks,
          h('div', { style: { marginTop: 8 } },
            h('div', { style: { fontSize: 12, fontWeight: 600 } }, '档案'),
            row('共度时光', `${d.diary.entries} 条 / ${d.diary.files} 个文件（近 7 天 ${d.diary.last7Days} 条）`),
            row('情感日记', `${d.feelings.chars} 字`),
            row('人格手记', `${d.handnote.lines} 条 / ${d.handnote.chars} 字，最长 ${d.handnote.longest} 字`),
            d.handnote.truncated ? row('⚠ 被截断的行', `${d.handnote.truncated} 条`) : null,
            row('浅层', `${d.shallow.live} 条（快到期 ${d.shallow.expiring}）`),
            row('每轮注入估计', `约 ${d.estimate.injectedTokens} token`),
          ),
          (d.duplicates && d.duplicates.length)
            ? h('div', { style: { marginTop: 8, fontSize: 12 } },
                `⚠ 有 ${d.duplicates.length} 句写了两遍：`,
                ...d.duplicates.slice(0, 4).map((item, i) =>
                  h('div', { key: `d${i}`, style: { opacity: 0.85, display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' } },
                    h('span', null, `· ${item.text.slice(0, 36)}`),
                    item.againTarget
                      ? h('button', {
                          type: 'button',
                          className: '__sm_btn',
                          style: { fontSize: 11, padding: '1px 6px' },
                          onClick: () => removeLine(item.againTarget, item.text),
                        }, `删掉${item.again}那份`)
                      : null,
                    (item.firstTarget && item.firstTarget !== item.againTarget)
                      ? h('button', {
                          type: 'button',
                          className: '__sm_btn',
                          style: { fontSize: 11, padding: '1px 6px' },
                          onClick: () => removeLine(item.firstTarget, item.text),
                        }, `删掉${item.first}那份`)
                      : null)))
            : null,
          (d.conflicts && d.conflicts.length)
            ? h('div', { style: { marginTop: 8, fontSize: 12 } },
                `⚠ 有 ${d.conflicts.length} 样东西被写出了不同的值：`,
                ...d.conflicts.map((conflict, ci) =>
                  h('div', { key: `c${ci}`, style: { marginTop: 6, paddingLeft: 8, opacity: 0.9 } },
                    h('div', { style: { fontSize: 11, color: C.text2 } }, `${conflict.kind}：${conflict.values.join(' / ')}`),
                    ...conflict.lines.map((line, li) =>
                      h('div', { key: `c${ci}l${li}`, style: { display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 11 } },
                        h('span', { style: { opacity: 0.7 } }, `${line.layer}:`),
                        h('span', null, line.line.slice(0, 46)),
                        h('button', {
                          type: 'button',
                          className: '__sm_btn',
                          style: { fontSize: 11, padding: '1px 6px' },
                          onClick: () => unifyValue(conflict, line.value),
                        }, `都以「${line.value}」为准`))
                    ))))
            : null,
          noteMsg ? h('div', { style: { marginTop: 4, fontSize: 11, color: C.text2 } }, noteMsg) : null,
          h('p', { style: { margin: '6px 0 0', fontSize: 11, lineHeight: 1.6, color: C.text2 } }, d.estimate.note),
        ),
      );
    }

    /* ── 回顾 ── */
    //
    // 2026-10-31 加。之前想看「上周都在干什么」只能靠搜关键词，
    // 时间线是断的。这里按天把共度时光铺开，另外单拎「7 天前的今天」。
    function ReviewBox() {
      const [state, setState] = useState(null);
      const [error, setError] = useState('');
      const [open, setOpen] = useState(false);

      const read = async () => {
        try {
          const res = await fetch(`${API}/review?days=7&lookback=7`, { credentials: 'same-origin' });
          const data = await res.json();
          if (res.ok && data.ok) setState(data);
          else setError(data.error || `HTTP ${res.status}`);
        } catch (err) {
          setError(String(err && err.message ? err.message : err));
        }
      };

      useEffect(() => { if (open && !state) read(); }, [open]);

      const line = (entry, key) =>
        h('div', { key, style: { padding: '4px 0', fontSize: 12, lineHeight: 1.7 } },
          h('span', { style: { color: C.text2, marginRight: 6 } }, String(entry.at || '').slice(11, 16)),
          String(entry.text || '').slice(0, 160),
        );

      if (!open) {
        return h('button', {
          type: 'button',
          onClick: () => setOpen(true),
          style: { marginTop: 0, fontSize: 12, padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.border1}`, background: 'transparent', color: C.text2, cursor: 'pointer' },
        }, '回顾一下最近七天');
      }

      if (error) return h('div', { style: { marginTop: 0, fontSize: 12, color: C.err } }, `回顾读不到：${error}`);
      if (!state) return h('div', { style: { marginTop: 0, fontSize: 12, color: C.text2 } }, '翻着…');

      const back = state.lookback;
      return h('div', { style: { marginTop: 0 } },
        h('div', { style: { fontSize: 13, fontWeight: 600 } }, '回顾'),
        back.entries.length
          ? h('div', { style: { marginTop: 6 } },
              h('div', { style: { fontSize: 12, color: C.text2 } }, `${back.date}（七天前的今天）`),
              ...back.entries.slice(0, 4).map((entry, i) => line(entry, `b${i}`)))
          : h('p', { style: { margin: '6px 0 0', fontSize: 12, color: C.text2 } }, `${back.date} 那天没有记录。`),
        ...state.recent.map((day) =>
          h('div', { key: day.date, style: { marginTop: 8 } },
            h('div', { style: { fontSize: 12, color: C.text2 } }, `${day.date} · ${day.entries.length} 条`),
            ...day.entries.slice(0, 3).map((entry, i) => line(entry, `${day.date}-${i}`)))),
        h('div', { style: { marginTop: 8 } },
          h('button', {
            type: 'button',
            onClick: () => { setOpen(false); setState(null); },
            style: { fontSize: 12, padding: '3px 10px', borderRadius: 6, border: `1px solid ${C.border1}`, background: 'transparent', color: C.text2, cursor: 'pointer' },
          }, '收起')),
      );
    }

    function ImportBox() {
      const [phase, setPhase] = useState('idle'); // idle | preview | writing | done | error
      const [report, setReport] = useState(null);
      const [error, setError] = useState('');
      const [name, setName] = useState('');
      const text = React.useRef('');
      const picker = React.useRef(null);

      const describe = (data) => {
        const c = (data && data.counts) || {};
        const parts = [];
        if (c.cards) parts.push(`人设卡 ${c.cards} 张`);
        if (c.memoryScopes) parts.push(`深层 ${c.memoryScopes} 组 / 主题 ${c.topics || 0} 个`);
        if (c.diaryEntries) parts.push(`共度时光 ${c.diaryEntries} 条`);
        if (c.feelingsChars) parts.push(`情感日记 ${c.feelingsChars} 字`);
        if (c.handnoteLines) parts.push(`人格手记 ${c.handnoteLines} 行`);
        if (c.shallowLive) parts.push(`浅层 ${c.shallowLive} 条`);
        return parts.join(' · ');
      };

      const post = async (confirm) => {
        const res = await fetch(`${API}/restore${confirm ? '?confirm=1' : ''}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: text.current,
          credentials: 'same-origin',
        });
        let data = {};
        try {
          data = await res.json();
        } catch {
          // 服务端没给 JSON 就按 HTTP 码报
        }
        if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
        return data;
      };

      const pick = async (event) => {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        setError('');
        setName(file.name);
        try {
          text.current = await file.text();
          const data = await post(false);
          setReport(data);
          setPhase('preview');
        } catch (err) {
          setError(err && err.message ? err.message : String(err));
          setPhase('error');
        } finally {
          if (picker.current) picker.current.value = '';
        }
      };

      const write = async () => {
        setPhase('writing');
        try {
          setReport(await post(true));
          setPhase('done');
        } catch (err) {
          setError(err && err.message ? err.message : String(err));
          setPhase('error');
        }
      };

      const reset = () => {
        text.current = '';
        setReport(null);
        setError('');
        setName('');
        setPhase('idle');
      };

      const note = { fontSize: 12, lineHeight: 1.7, color: C.text2, margin: '8px 0 0' };

      return h(
        'div',
        null,
        h('input', {
          ref: picker,
          type: 'file',
          accept: '.json,application/json',
          style: { display: 'none' },
          onChange: pick,
        }),
        h(
          'button',
          {
            type: 'button',
            onClick: () => picker.current && picker.current.click(),
            style: {
              fontSize: 12,
              fontFamily: 'inherit',
              padding: '6px 12px',
              borderRadius: 8,
              border: `1px solid ${C.border1}`,
              background: C.bg,
              color: C.text1,
              cursor: 'pointer',
            },
          },
          '导入备份（.json）',
        ),
        name
          ? h('p', { style: note }, `选中的文件：${name}`)
          : null,
        phase === 'preview' && report
          ? h(
              'div',
              { style: { marginTop: 10, padding: '10px 12px', border: `1px solid ${C.border1}`, borderRadius: 8 } },
              h('p', { style: { margin: 0, fontSize: 12, lineHeight: 1.7, color: C.text1 } },
                `这份备份会覆盖 ${report.writes} 个文件、合并 ${report.cards} 张人设卡。`),
              h('p', { style: { ...note, margin: '4px 0 0' } },
                `${describe(report) || '（备份里没有可识别的条目）'}${report.exportedAt ? ` · 备份于 ${String(report.exportedAt).slice(0, 16).replace('T', ' ')}` : ''}`),
              h('p', { style: { ...note, margin: '6px 0 0', color: C.err } },
                '还原会覆盖现在的日记、手记和深层记忆；动手之前插件会先自动存一份「还原前」快照。'),
              h('div', { style: { marginTop: 8, display: 'flex', gap: 16, alignItems: 'center' } },
                h('button', { type: 'button', onClick: write, style: linkStyle(C.err) }, '确认还原'),
                h('button', { type: 'button', onClick: reset, style: linkStyle(C.text2) }, '算了')),
            )
          : null,
        phase === 'writing'
          ? h('p', { style: note }, '正在写入…')
          : null,
        phase === 'done' && report
          ? h(
              'div',
              { style: { marginTop: 10, padding: '10px 12px', border: `1px solid ${C.border1}`, borderRadius: 8 } },
              h('p', { style: { margin: 0, fontSize: 12, lineHeight: 1.7, color: C.text1 } },
                `还原完成：写了 ${report.written} 个文件、合并 ${report.cards} 张人设卡。`),
              report.preBackup ? h('p', { style: { ...note, margin: '4px 0 0' } }, `还原前的快照：${report.preBackup}`) : null,
              h('p', { style: { ...note, margin: '4px 0 0' } }, '日记和手记要重启后才重新加载；人设卡下一轮就生效。'),
              h('div', { style: { marginTop: 8 } },
                h('button', { type: 'button', onClick: reset, style: linkStyle(C.text2) }, '知道了')),
            )
          : null,
        phase === 'error'
          ? h('div', { style: { marginTop: 8 } },
              h('p', { style: { margin: 0, fontSize: 12, lineHeight: 1.7, color: C.err } }, `没导入成功：${error}`),
              h('button', { type: 'button', onClick: reset, style: { ...linkStyle(C.text2), marginTop: 6 } }, '重选一份'))
          : null,
      );
    }

    /* ───────────────────────── 主面板 ───────────────────────── */

    /** 四个页签，按使用频率排。 */
    const TABS = [
      { key: 'timeline', label: '回看' },
      { key: 'books', label: '本子' },
      { key: 'health', label: '体检' },
      { key: 'archive', label: '档案' },
    ];

    function Panel() {
      const [phase, setPhase] = useState('loading');
      const [state, setState] = useState(null);
      const [error, setError] = useState('');
      const [busy, setBusy] = useState('');
      const [tick, setTick] = useState(0);
      const [tab, setTab] = useState('timeline');

      useEffect(() => {
        let alive = true;
        fetch(`${API}/state`, { headers: { Accept: 'application/json' } })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
          .then((data) => {
            if (!alive) return;
            setState(data);
            setPhase('ready');
          })
          .catch((err) => {
            if (!alive) return;
            setError(String((err && err.message) || err));
            setPhase('error');
          });
        return () => {
          alive = false;
        };
      }, [tick]);

      function forget(id) {
        setBusy(id);
        fetch(`${API}/forget`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        })
          // ⚠️ **必须检查 r.ok。**
          //
          // 这里原来是 `.then((r) => r.json())` —— 服务端回 400/403 时 JSON 照样
          // 能解析，于是被当成成功，接着刷新一遍、什么都没变。表现就是
          // **「忘掉按钮点不动」**：没有报错、没有删除、没有任何提示。
          //
          // 2026-10-26 社区报的那个 bug，一半就出在这里：把它变成静默。
          .then((r) =>
            r
              .json()
              .catch(() => ({}))
              .then((body) => {
                if (!r.ok) throw new Error(body?.error || `HTTP ${r.status}`);
                return body;
              }),
          )
          .then(() => {
            setBusy('');
            setError('');
            setTick((n) => n + 1);
          })
          .catch((err) => {
            setBusy('');
            setError(`删不掉：${String((err && err.message) || err)}`);
          });
      }

      const wrap = { height: '100%', overflowY: 'auto', background: C.bg, color: C.text1 };
      const inner = { maxWidth: 720, margin: '0 auto', padding: '28px 24px 60px' };

      if (phase === 'loading') {
        return h('div', { style: wrap }, h('div', { style: inner }, h(Empty, { text: '翻档案…' })));
      }
      if (phase === 'error') {
        return h(
          'div',
          { style: wrap },
          h(
            'div',
            { style: inner },
            h(Empty, { text: `读不到档案：${error}` }),
            h(
              'button',
              {
                type: 'button',
                onClick: () => setTick((n) => n + 1),
                style: { ...linkStyle(C.brand), marginTop: 10 },
              },
              '再试一次',
            ),
          ),
        );
      }

      const d = state || {};
      const facts = d.facts || {};
      // traits（印象）2026-10-27 整类下线 —— 面板不显示，固化也不再产出。
      // 数据还在档案里，要看就翻 relationship.json。
      const diary = d.diary || [];

      // 按使用频率排：看回忆是天天的事，改本子是偶尔，体检和带走是修东西的时候。
      const chips = [];
      chips.push(`共度时光 ${d.count || 0} 条`);
      if (facts.days > 0) chips.push(`认识 ${facts.days} 天`);
      if (facts.nickname) chips.push(`他管我叫「${facts.nickname}」`);
      if (d.degraded) chips.push('档案只读');

      const view = (key, ...children) =>
        h('div', { style: { display: tab === key ? 'block' : 'none' } }, children);

      return h(
        'div',
        { style: wrap },
        h(
          'div',
          { style: inner },

          // ── 标题 ──
          h(
            'h2',
            { style: { margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: '-0.01em' } },
            '属于我们的回忆',
          ),
          h(
            'div',
            { style: { marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 } },
            chips.map((text, i) => h(Chip, { key: i }, text)),
          ),

          // ── 出错横幅 ──
          //
          // 之前「忘掉」失败是**完全静默**的：服务端回 400/403，前端把 JSON
          // 当成功、刷新一遍、什么都没变 —— 用户只看到「点不动」。
          // 现在失败会出现在这里，而且带着服务端说的原因。
          error !== ''
            ? h(
                'p',
                {
                  style: {
                    margin: '10px 0 0',
                    padding: '8px 10px',
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: C.err,
                    border: `1px solid ${C.err}`,
                    borderRadius: 6,
                  },
                },
                error,
              )
            : null,

          h(Tabs, { tabs: TABS, value: tab, onChange: setTab }),

          // ── 回看：共度时光 ──
          view(
            'timeline',
            diary.length === 0
              ? h(Card, null, h(Empty, { text: '还没有日记。多聊几句，我就会有东西可记。' }))
              : h(
                  'div',
                  { style: { marginTop: 14 } },
                  diary.map((e) => h(Entry, { key: e.id, entry: e, onForget: forget, busy: busy === e.id })),
                ),
          ),

          // ── 本子：情感日记 + 人格手记 ──
          //
          // 两个编辑口合成一个：情感日记原来既能在「本子」里改、又能在
          // FeelingsBox 里改，是同一个文件。留下会存快照的那个。
          view(
            'books',
            h(Card, null, h(FeelingsBox)),
            h(Card, null, h(Notebook, { only: ['handnote'] })),
          ),

          // ── 体检：数账 + 回顾 ──
          view(
            'health',
            h(Card, null, h(HealthBox)),
            h(Card, { title: '最近七天' }, h(ReviewBox)),
          ),

          // ── 档案：带走 / 塞回去 / 云端 ──
          view(
            'archive',
            h(
              Card,
              {
                title: '带走',
                hint: '它就是一个普通文件夹，在 ~/.dsh/feiyu-diary/。可以直接打开、改、拷走。',
              },
              h(
                'div',
                { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
                h(Ghost, { href: `${API}/export` }, '导出档案（.dshpack）'),
                h(Ghost, { href: `${API}/backup` }, '整包备份（.json）'),
                h(Ghost, { href: `${API}/export-md` }, '导出成册（.md）'),
              ),
              h(
                'p',
                { style: { margin: '10px 0 0', fontSize: 11.5, lineHeight: 1.7, color: C.text2 } },
                '整包备份把四本账和人设卡收进一个 JSON，存在 ~/.dsh/backups/；换设备带它就行。想要能直接读、能打印的，用「导出成册」。',
              ),
            ),
            h(Card, { title: '从备份恢复' }, h(ImportBox)),
            h(Card, { title: '云端备份（WebDAV）' }, h(CloudBox)),
          ),
        ),
      );
    }

    /* ── 云端备份（WebDAV） ── */
    //
    // 2026-10-31 加。本地那份 JSON 已经能带走，这个按钮是「连手都不用动」。
    // 状态每次打开面板现读，所以设置页改完地址回来就能看到新结果。
    function CloudBox() {
      const [state, setState] = useState(null); // GET /cloud 的结果
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState('');
      const [done, setDone] = useState(null);

      const read = async () => {
        try {
          const res = await fetch(`${API}/cloud`, { credentials: 'same-origin' });
          const data = await res.json();
          if (res.ok && data.ok) setState(data);
        } catch {
          // 读不到就保持 null，不要把面板弄坏
        }
      };

      useEffect(() => {
        read();
      }, []);

      const push = async () => {
        setBusy(true);
        setError('');
        setDone(null);
        try {
          const res = await fetch(`${API}/cloud`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          });
          let data = {};
          try {
            data = await res.json();
          } catch {
            // 服务端没给 JSON 就按 HTTP 码报
          }
          if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
          setDone(data);
          await read();
        } catch (err) {
          setError(err && err.message ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      };

      const note = { fontSize: 12, lineHeight: 1.7, color: C.text2, margin: '8px 0 0' };
      const when = state && state.lastAt ? new Date(state.lastAt).toLocaleString() : '';

      return h(
        'div',
        { style: { marginTop: 0 } },
        h(
          'p',
          { style: { ...note, margin: 0 } },
          !state
            ? '云端备份：读不到状态。'
            : !state.enabled
              ? '云端备份已关掉（设置里的「WebDAV 总开关」）。'
              : !state.configured
                ? '云端备份还没接上：去插件设置里填 WebDAV 地址（服务器、账号、密码）。'
                : `云端备份：${state.dir} · 保留 ${state.keep} 份${state.auto ? ' · 写日记后自动上传' : ''}`,
        ),
        when
          ? h('p', { style: { ...note, margin: '4px 0 0' } }, `上次上传：${when}（${state.lastFile}）`)
          : null,
        state && state.lastError
          ? h('p', { style: { ...note, margin: '4px 0 0', color: C.err } }, `上次失败：${state.lastError}`)
          : null,
        state && state.configured && state.enabled
          ? h(
              'button',
              {
                type: 'button',
                onClick: push,
                disabled: busy,
                style: { ...linkStyle(C.brand), marginTop: 8 },
              },
              busy ? '正在上传…' : '上传到云端',
            )
          : null,
        done
          ? h(
              'p',
              { style: { ...note, margin: '6px 0 0', color: C.brand } },
              `已上传：${done.fileName || done.file}（${done.bytes} 字节）${
                done.removed && done.removed.length ? `，清掉 ${done.removed.length} 份旧的` : ''
              }`,
            )
          : null,
        error
          ? h('p', { style: { ...note, margin: '6px 0 0', color: C.err } }, `没传上去：${error}`)
          : null,
      );
    }

    /* ───────────────────────── 注册 ───────────────────────── */

    function apply(ctx) {
      // 侧栏图标。用**自己的 id** —— 复用别人的 id 会顶掉人家的格子。
      // order 40：排在插件市场(0)和上下文洞察(20)后面，当老三。
      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          { name: 'sidebar.panellist', id: PANEL_ID, order: 40, label: () => '属于我们的回忆' },
          Icon,
        ),
      );

      // 主面板。key 必须与侧栏的 id 一致 —— 侧栏按钮就是靠这个 key 找面板的。
      ctx.slots.inject('main', () =>
        ctx.slots.register({ name: 'main', key: PANEL_ID }, Panel),
      );
    }

    return { name: 'dsh-hierarchical-fishmemory', inject: ['slots'], apply };
  },
});
