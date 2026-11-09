/**
 * dsh-hierarchical-fishmemory · 浏览器半边（**生成文件，别手改**）
 *
 * 由 tools/build-client.mjs 从下面两个手写源合成：
 *   - src/client/index.js  —— 日记面板（侧栏格子 + 主面板，看/删/带走）
 *   - src/soul/client.js   —— 人设卡设置页 + 会话头部的人设切换
 *
 * 两个源都自成一体、只 require('react')；合并是为了满足「一个包名只能有一个
 * __ModuleLoader__ 工厂」这条硬规则。改界面请改源文件，然后重新跑
 * `node tools/build-client.mjs`。
 */
window.__ModuleLoader__.load({
  id: 'dsh-hierarchical-fishmemory',

  factory: (require) => {
    /* ───────────── soul 半边（原 dsh-soul-md/client.js） ───────────── */
    const soulPlugin = (() => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    var react = require("react");
    var h = react.createElement;

    // ── CSS (theme tokens) ────────────────────────────────────────────────
    var CSS = ".__sm_root{max-width:640px;display:flex;flex-direction:column;gap:10px}" +
      ".__sm_field{display:flex;flex-direction:column;gap:4px}" +
      ".__sm_label{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary);display:flex;align-items:center;gap:6px}" +
      ".__sm_hint{font-size:11px;color:var(--dsw-alias-label-tertiary)}" +
      ".__sm_input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 10px;font-size:13px;box-sizing:border-box;width:100%}" +
      ".__sm_textarea{min-height:160px;resize:vertical;font-family:ui-monospace,Consolas,monospace;font-size:12px;line-height:1.6}" +
      ".__sm_row{display:flex;align-items:center;gap:8px}" +
      ".__sm_check{accent-color:var(--dsw-alias-state-business-primary)}" +
      ".__sm_actions{display:flex;gap:8px;align-items:center;margin-top:4px}" +
      ".__sm_btn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 14px;font:inherit;font-size:13px;cursor:pointer}" +
      ".__sm_btn:hover:not(:disabled){border-color:var(--dsw-alias-state-business-primary)}" +
      ".__sm_btn:disabled{opacity:.5;cursor:default}" +
      ".__sm_btnPrimary{border-color:var(--dsw-alias-state-business-primary, #3964fe);background:var(--dsw-alias-state-business-primary, #3964fe);color:#fff}" +
      ".__sm_btnDanger{border-color:var(--dsw-alias-state-error-primary, #f85149);color:var(--dsw-alias-state-error-primary, #f85149)}" +
      ".__sm_status{font-size:12px;color:var(--dsw-alias-label-tertiary)}" +
      ".__sm_error{font-size:12px;color:var(--dsw-alias-state-error-primary)}" +
      ".__sm_unavailable{font-size:13px;color:var(--dsw-alias-label-tertiary)}" +
      ".__sm_group{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:8px}" +
      ".__sm_cardList{display:flex;flex-direction:column;gap:6px}" +
      ".__sm_cardRow{display:flex;align-items:center;gap:8px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 10px}" +
      ".__sm_cardName{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".__sm_cardPreview{font-size:11px;color:var(--dsw-alias-label-tertiary);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".__sm_badge{border:1px solid var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary);border-radius:999px;padding:0 8px;font-size:10px;white-space:nowrap}" +
      ".__sm_switch{display:inline-flex;align-items:center;gap:6px;font-size:12px;margin-right:8px}" +
      ".__sm_switchLabel{color:var(--dsw-alias-label-tertiary);white-space:nowrap}" +
      ".__sm_switchSelect{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:3px 6px;font:inherit;font-size:12px;max-width:180px}";
    // Scoped flat controls retain native keyboard and form behavior.
    CSS += `
.dsh-flat.__sm_root{width:100%;max-width:720px;gap:14px;font-size:13px;line-height:1.65;color:var(--dsw-alias-label-primary);--flat-accent:var(--dsw-alias-state-business-primary,#3964fe);--flat-border:var(--dsw-alias-border-l2,#dce2eb)}
.dsh-flat.__sm_root *{box-sizing:border-box;min-width:0}
.dsh-flat.__sm_root p{margin:0}
.dsh-flat.__sm_root label[class$="_field"]{gap:7px}
.dsh-flat.__sm_root [class$="_label"]{font-size:13px;font-weight:500}
.dsh-flat.__sm_root [class$="_hint"]{font-size:12px;line-height:1.65}
.dsh-flat.__sm_root input:not([type=checkbox]),.dsh-flat.__sm_root select,.dsh-flat.__sm_root textarea{width:100%;border:1px solid var(--flat-border);border-radius:6px;background:var(--dsw-alias-bg-layer-3);color:inherit;font:inherit;padding:9px 12px;min-height:40px;box-shadow:none;transition:border-color .15s}
.dsh-flat.__sm_root input:hover:not(:disabled),.dsh-flat.__sm_root select:hover:not(:disabled),.dsh-flat.__sm_root textarea:hover:not(:disabled){border-color:var(--dsw-alias-label-tertiary)}
.dsh-flat.__sm_root select{appearance:none;padding-right:34px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='m2 2 4 4 4-4' fill='none' stroke='%23778091' stroke-width='1.5'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center}
.dsh-flat.__sm_root input[type=checkbox]{appearance:none;flex:none;width:30px;height:18px;margin:0;border:1px solid var(--flat-border);border-radius:12px;background:var(--dsw-alias-bg-layer-2);position:relative;cursor:pointer;transition:background .15s,border-color .15s}
.dsh-flat.__sm_root input[type=checkbox]::before{content:"";position:absolute;left:2px;top:2px;width:12px;height:12px;border-radius:50%;background:var(--dsw-alias-label-secondary);transition:transform .15s}
.dsh-flat.__sm_root input[type=checkbox]:checked{background:var(--flat-accent);border-color:var(--flat-accent)}
.dsh-flat.__sm_root input[type=checkbox]:checked::before{transform:translateX(12px);background:#fff}
.dsh-flat.__sm_root :is(input,select,textarea,button,summary,a):focus-visible{outline:2px solid var(--flat-accent);outline-offset:3px}
.dsh-flat.__sm_root :is(input,select,textarea,button):disabled{opacity:.5;cursor:default}
.dsh-flat.__sm_root [class$="_actions"]{flex-wrap:wrap;gap:10px;margin-top:4px;padding-top:16px;border-top:1px solid var(--flat-border)}
.dsh-flat.__sm_root .__sm_group{border:0;border-top:1px solid var(--flat-border);border-radius:0;padding:20px 0 0;gap:14px}
.dsh-flat.__sm_root .__sm_cardRow{flex-wrap:wrap;border:0;border-bottom:1px solid var(--flat-border);border-radius:0;padding:10px 0;background:none}
.dsh-flat.__sm_root .__sm_cardPreview{flex-basis:100%;order:2}
.dsh-flat.__sm_root .__sm_textarea{font-family:ui-monospace,Consolas,monospace;line-height:1.7;min-height:180px;resize:vertical}
@media(max-width:480px){.dsh-flat.__sm_root{gap:16px}.dsh-flat.__sm_root .__sm_cardRow{gap:8px}}
@media(prefers-reduced-motion:reduce){.dsh-flat.__sm_root *,.dsh-flat.__sm_root input[type=checkbox]::before{transition:none}}
.dsh-flat.__sm_root button{border-radius:6px;min-height:34px;padding:7px 14px;font:inherit;font-size:12px;box-shadow:none}
.dsh-flat.__sm_root :is(h2,h3){margin:0;font-size:14px;font-weight:600}
.dsh-flat.__sm_root .__sm_head{display:flex;flex-direction:column;gap:5px;padding-bottom:2px}
.dsh-flat.__sm_root .__sm_title{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:600;letter-spacing:-.01em}
.dsh-flat.__sm_root .__sm_tabs{display:flex;gap:2px;border-bottom:1px solid var(--flat-border);margin-top:2px}
.dsh-flat.__sm_root .__sm_tab{appearance:none;border:0;border-bottom:2px solid transparent;border-radius:0;background:none;box-shadow:none;min-height:0;margin-bottom:-1px;padding:8px 12px 9px;font:inherit;font-size:13px;color:var(--dsw-alias-label-tertiary);cursor:pointer}
.dsh-flat.__sm_root .__sm_tab:hover{color:var(--dsw-alias-label-primary)}
.dsh-flat.__sm_root .__sm_tab[aria-selected="true"]{color:var(--dsw-alias-label-primary);font-weight:600;border-bottom-color:var(--flat-accent)}
.dsh-flat.__sm_root .__sm_panel{display:flex;flex-direction:column;gap:14px;padding-top:4px}
.dsh-flat.__sm_root .__sm_groupTitle{display:flex;flex-direction:column;gap:2px}
.dsh-flat.__sm_root .__sm_groupTitle>span:first-child{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}
/* 标题右边那颗「当前默认卡」：小、圆、像标签，但真的是个能点的下拉。 */
.dsh-flat.__sm_root .__sm_pick{width:auto;min-height:0;padding:1px 26px 1px 10px;border-radius:999px;border-color:var(--dsw-alias-state-business-primary);background-position:right 7px center;font-size:11px;line-height:1.7;color:var(--dsw-alias-state-business-primary);cursor:pointer}
.dsh-flat.__sm_root .__sm_pick:hover:not(:disabled){border-color:var(--dsw-alias-state-business-primary)}
`;
    var tagId = "dsh-soul-md/main.css";
    if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
      var tag = document.createElement("style");
      tag.dataset.plugin = "dsh-soul-md";
      tag.dataset.pluginCss = tagId;
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }

    // ── locale ────────────────────────────────────────────────────────────
    var NS = "soulMd";
    var inject = ["slots", "locale", "configForms"];

    /**
     * Whether a namespace section now reflects every queued operation.
     *
     * A settled write says nothing about whether it was APPLIED: the scope
     * contract is "settle after the write and any recovery read", so a write the
     * Host refused with settings/conflict still resolves. Inspecting the section
     * afterwards is the only way to tell a committed change from a refused one.
     */
    function settingsOpsApplied(snapshot, ops) {
      if (!snapshot || snapshot.status !== "ready" || snapshot.value === void 0) return false;
      var user = snapshot.user && typeof snapshot.user === "object" ? snapshot.user : {};
      for (var i = 0; i < ops.length; i++) {
        var op = ops[i];
        var key = op.path[0];
        if (op.op === "unset") {
          if (key in user) return false;
        } else if (key === "memory" && op.value && typeof op.value === "object") {
          var actual = snapshot.value.memory;
          if (!actual || Object.keys(op.value).some(function (field) {
            return JSON.stringify(actual[field]) !== JSON.stringify(op.value[field]);
          })) return false;
        } else if (JSON.stringify(snapshot.value[key]) !== JSON.stringify(op.value)) {
          return false;
        }
      }
      return true;
    }

    /**
     * Apply one batch of namespace operations; resolves whether it took effect.
     *
     * One mutate() carries one revision fence and one persistence decision for
     * the whole batch. Issuing the same changes as separate set()/unset() calls
     * gives each its own fence, and a fence behind the Host document is refused —
     * so an edit could be rejected while the UI still reported success. Hosts
     * without mutate() apply the operations in order, each waiting for its
     * predecessor, which keeps the revision chain intact; never in parallel.
     */
    function commitSettingsOps(scope, ops) {
      if (ops.length === 0) return Promise.resolve(true);
      var run;
      if (typeof scope.mutate === "function") {
        run = scope.mutate(ops, scope.getSnapshot().revision);
      } else {
        run = ops.reduce(function (chain, op) {
          return chain.then(function () {
            return op.op === "unset" ? scope.unset(op.path[0]) : scope.set(op.path[0], op.value);
          });
        }, Promise.resolve());
      }
      return Promise.resolve(run).then(function () {
        return settingsOpsApplied(scope.getSnapshot(), ops);
      });
    }
    var zh = {
      settingsNav: "属于我们的回忆",
      confirmDelete: '删除人设卡“{name}”？',
      invalidCardName: "请输入人设卡名称",
      invalidCardContent: "请输入人设卡内容",
      intro: "输入人设卡名称和内容，保存后插件自动管理——文件路径、记忆存放都不用管。人设按 会话选择 → 默认卡 解析，聊天框标题栏可随时切换。",
      pageTitle: "属于我们的回忆",
      tabCards: "人设卡",
      tabMemory: "长期记忆",
      tabCloud: "云端备份",
      writeTitle: "写一张卡",
      writeHint: "内容和名称都可以改；保存后立刻按「会话选择 → 默认卡」生效。",
      cardListTitle: "人设卡",
      cardListHint: "卡片内容会注入系统提示词；聊天框标题栏可给每个会话单独选卡。",
      cardName: "人设卡名称",
      cardNameHint: "给这张人设卡起个名字（如：希希芙、工作狂助手）。",
      cardContent: "人设卡内容（Markdown）",
      cardContentHint: "角色设定、说话风格、工作准则……AI 会用 soul_read / soul_update 自己读和演化这张卡。",
      saveCard: "保存人设卡",
      save: "保存",
      newCard: "新建一张",
      editingCard: "正在编辑：{name}",
      editingNew: "正在写一张新卡",
      editCard: "编辑",
      deleteCard: "删除",
      setDefault: "设为默认",
      defaultBadge: "默认",
      emptyCards: "还没有人设卡——先在上面保存一张吧。",
      activeHint: "没有会话级选择时使用的人设卡；选「不启用」则默认关闭人设。",
      noneOption: "不启用",
      autoOption: "自动（跟随默认卡）",
      saved: "已保存",
      saving: "保存中…",
      error: "操作失败",
      notApplied: "写入未生效，请检查当前设置",
      invalidMemoryNumber: "字符上限和文件大小上限必须是大于零的整数",
      unavailable: "设置命名空间不可用（服务端未注册 soul-md 命名空间？）",
      loading: "加载中…",
      memoryTitle: "长期记忆（插件托管）",
      memoryIntro: "AI 用 memory_append / memory_read / memory_rewrite 读写记忆：当前人设卡有自己的记忆，没选卡时用全局记忆。记忆文件由插件自动管理。",
      memoryInjectHint: "把记忆渲染为 soul:memory 提示词段落（AI 可随时读到记忆）。",
      memoryLayeredHint: "默认关闭。开启后优先保留 topics/*.md 的标题和摘要索引；core.md 超过注入上限时保留首尾。AI 可用 memory_read(topic) 按需读取全文。",
      fieldMemoryRecall: "自动关键词召回",
      memoryRecallHint: "默认关闭；从第二条用户消息起检索主题正文，只提示 key 和摘要。关键词匹配不等于语义检索。",
      fieldMemoryIndexMode: "注入主题索引",
      memoryIndexModeHint: "默认全量索引；仅召回模式须开启关键词召回，可减少主题多时的每轮开销。memory_read 仍返回完整索引。",
      fieldMemoryCompactionRecall: "压缩后补偿已查阅主题",
      memoryCompactionRecallHint: "默认关闭；成功压缩或裁剪后的下一条用户消息，提示本会话已读写主题的 key 和摘要。仅在当前进程有效，不注入全文。",
      fieldMemoryRecallMaxTopics: "每组召回主题上限（最多 20）",
      fieldMemoryRecallMaxChars: "召回与压缩补偿总字符上限（最多 8000）",
      recallOff: "关闭", recallKeyword: "关键词", indexAll: "全量索引", indexRecall: "仅召回",
      skipSubagentsHint: "默认关闭。开启后，DSH 以 origin: \"subagent\" 创建的委派子会话不再收到 soul:persona / soul:memory 两段提示词；子代理的工具仍使用它原本的人设卡与记忆作用域，只是不再自动注入。",
      allowTemplatesHint: "默认关闭，花括号原样保留。仅当卡片或记忆需要使用 {{cwd}} 等宿主变量时开启；未知变量仍会使提示词渲染失败。",
      memoryMaxCharsHint: "注入段落的字符上限；超限时保留首尾，全文可用 memory_read 读取。",
      memoryMaxBytesHint: "单份记忆文件大小上限。",
      switchLabel: "人设",
      switchTitle: "切换当前会话的人设（会话级，优先于工作区/默认卡）",
      wsTitle: "工作区人设",
      wsHint: "给每个工作区指定人设卡：该工作区的会话默认使用这张卡（会话级切换仍然优先）。",
      wsFollow: "跟随默认卡",
      wsEmpty: "还没有工作区记录——在会话页新建/选择一个工作区后，这里会出现它的设置。",
      fieldMemoryInject: "注入为 soul:memory 提示词段落",
      fieldMemoryLayered: "启用分层记忆（core + topics 索引）",
      fieldSkipSubagents: "子代理会话跳过人设与记忆注入",
      fieldAllowTemplates: "允许人设与记忆使用提示词变量",
      fieldMemoryInjectMaxChars: "注入字符上限",
      fieldMemoryMaxBytes: "记忆文件大小上限",
      cardNamePlaceholder: "希希芙",
      cloudTitle: "云端备份（WebDAV）",
      cloudHint: "把四本账和人设卡推到自己的网盘；地址留空就不上传。密码明文存在本机配置里，建议用应用专用密码。",
      cloudUrl: "服务器地址",
      cloudUrlHint: "坚果云：https://dav.jianguoyun.com/dav/ · Nextcloud：https://你的域名/remote.php/dav/files/用户名/",
      cloudUser: "用户名",
      cloudPassword: "密码 / 应用专用密码",
      cloudPasswordHint: "留空表示不改动已保存的密码。",
      cloudDir: "云端目录（会自动逐级创建）",
      cloudKeep: "云端保留份数",
      cloudEnabled: "启用 WebDAV",
      cloudAuto: "写完日记自动上传（5 分钟内只推一次）",
      cloudSave: "保存云端设置",
      cloudSaved: "云端设置已保存",
      cloudTest: "测试连接",
      cloudTesting: "正在试…",
      cloudTestOk: "连接正常",
      cloudTestNoList: "（这个网盘不让列目录，但目录建得起来）",
      cloudRemote: "云端已有",
      cloudCfgHint: "配置很小：地址、账号、保留份数这些。四本账走上面那份整包备份，别混。",
      cloudCfgUpload: "配置传到云端",
      cloudCfgUploaded: "配置已上传：{name}（{bytes} 字节）",
      cloudCfgList: "看看云端有哪些配置",
      cloudCfgEmpty: "云端还没有配置备份",
      cloudCfgRestore: "看看会改什么",
      cloudCfgConfirm: "确认恢复",
      cloudCfgCancel: "算了",
      cloudCfgApplied: "已恢复 {n} 项配置",
      cloudCfgFail: "配置操作失败：{detail}",
      cloudMemHint: "从云端找回整包记忆——日记、情感日记、人格手记、深层记忆、人设卡都在一个 JSON 里。",
      cloudMemList: "看看云端有哪些记忆备份",
      cloudMemEmpty: "云端还没有记忆备份。先点上面的「上传到云端」。",
      cloudMemPreview: "看看会改什么",
      cloudMemConfirm: "确认恢复",
      cloudMemCancel: "算了",
      cloudMemPlan: "会覆盖 {n} 个文件、合并 {c} 张人设卡；动手之前插件会先存一份「还原前」快照。",
      cloudMemSame: "和现在一样，没东西要改。",
      cloudMemRestored: "已从云端恢复：写 {n} 个文件。日记和手记要重启后才重新加载。",
      cloudMemFail: "云端恢复失败：{detail}",
      cloudLoadFail: "读不到云端设置：{detail}",
      cloudSaveFail: "保存失败：{detail}",
      cloudPasswordSet: "已保存密码",
      cloudPasswordUnset: "还没设密码",
      recallTitle: "回忆开关",
      recallIntro: "这两项决定「突然想起」类注入的强度；改完即时生效，不用重启。",
      fieldOnThisDay: "「那年今天」最多几条（0 = 关掉）",
      onThisDayHint: "同月同日、或一个月前的那几天，最多给几条。",
      fieldFlashback: "「忽然想起那一天」",
      flashbackHint: "每天从情感日记里随机翻一天，像突然想起一段回忆那样提出来。",
      fieldStickyEnabled: "「小纸条」记他说的原话",
      stickyEnabledHint: "每轮把他说的那句话原样记一行，每轮都注入 —— 语气和用词不会被日记压没。",
      fieldStickyTtlDays: "「小纸条」保留天数",
      stickyTtlDaysHint: "超过这个天数的纸条不再注入（★ 钉住的不受这个限制）。",
      fieldStickyMaxInject: "「小纸条」每轮最多注入几条",
      stickyMaxInjectHint: "从新到旧给，最多这么多条；再多就把最旧的先放下。",
      fieldStaleLoopDays: "「小闹钟」几天算陈了",
      staleLoopDaysHint: "还挂着的事超过这么多天没动静，就在那一行后面标一句「记下 N 天了」；0 = 不标。",
      fieldSilenceNudge: "「闷太久」提醒",
      silenceNudgeHint: "连着几轮只有工具调用、一句正文都没写，就往注入里放一句催我开口；0 = 不提醒。",
      fieldMirrorHint: "镜子",
      mirrorHint: "想看「今天陪得怎么样」，直接说一声——我用 fish_mirror 给你翻，不进每轮注入。",
      recallUnavailable: "主插件配置命名空间不可用（服务端没注册 dsh-hierarchical-fishmemory？）"
    };
    var en = {
      settingsNav: "Memories That Belong to Us",
      confirmDelete: 'Delete persona card "{name}"?',
      invalidCardName: "Enter a persona card name",
      invalidCardContent: "Enter persona card content",
      intro: "Type a persona card name and content, hit save — the plugin manages everything else (files, memory locations). Persona resolves as session choice > default card; switch per chat from the conversation header.",
      pageTitle: "Memories That Belong to Us",
      tabCards: "Persona cards",
      tabMemory: "Long-term memory",
      tabCloud: "Cloud backup",
      writeTitle: "Write a card",
      writeHint: "Name and content are both editable; saved cards resolve as session choice > default card.",
      cardListTitle: "Persona cards",
      cardListHint: "Card content is injected into the system prompt; pick one per chat from the conversation header.",
      cardName: "Card name",
      cardNameHint: "A name for this card (e.g. 希希芙, workaholic-assistant).",
      cardContent: "Card content (Markdown)",
      cardContentHint: "Role, speaking style, work rules… the AI reads and evolves this card itself via soul_read / soul_update.",
      saveCard: "Save card",
      save: "Save",
      newCard: "New card",
      editingCard: "Editing: {name}",
      editingNew: "Writing a new card",
      editCard: "Edit",
      deleteCard: "Delete",
      setDefault: "Set default",
      defaultBadge: "default",
      emptyCards: "No persona cards yet — save one above first.",
      activeHint: "The card used when a session has no explicit choice; pick \"disabled\" to turn the persona off by default.",
      noneOption: "Disabled",
      autoOption: "Auto (follow default)",
      saved: "Saved",
      saving: "Saving…",
      error: "Operation failed",
      notApplied: "Write did not take effect; check the current settings",
      invalidMemoryNumber: "The character and file size caps must be positive integers",
      unavailable: "Settings namespace unavailable (soul-md namespace not registered server-side?)",
      loading: "Loading…",
      memoryTitle: "Long-term memory (plugin-managed)",
      memoryIntro: "The AI reads/writes memory with memory_append / memory_read / memory_rewrite: the active persona card has its own memory, otherwise the global memory is used. Files are managed by the plugin.",
      memoryInjectHint: "Also render the memory as the soul:memory prompt section (the agent always sees its memory).",
      memoryLayeredHint: "Off by default. The topics/*.md title and summary index takes priority; if core.md exceeds the injection cap, its beginning and end remain visible. memory_read(topic) retrieves full topic text on demand.",
      fieldMemoryRecall: "Automatic keyword recall",
      memoryRecallHint: "Off by default. From the second user message, search topic bodies and inject keys and summaries only. Lexical matching is not semantic search.",
      fieldMemoryIndexMode: "Injected topic index",
      memoryIndexModeHint: "Full index by default. Recall-only mode requires keyword recall and reduces per-turn topic overhead. memory_read still returns the full index.",
      fieldMemoryCompactionRecall: "Recall consulted topics after compaction",
      memoryCompactionRecallHint: "Off by default. The next user message after successful compaction/pruning restores keys and summaries of topics read/written in this session. Process-local; no full bodies injected.",
      fieldMemoryRecallMaxTopics: "Topic limit per recall group (up to 20)",
      fieldMemoryRecallMaxChars: "Combined recall/recovery character cap (up to 8000)",
      recallOff: "Off", recallKeyword: "Keyword", indexAll: "Full index", indexRecall: "Recall only",
      skipSubagentsHint: "Off by default. When enabled, sessions DSH created as delegated children (origin: subagent) no longer receive the soul:persona / soul:memory sections. The child tools keep the same persona card and memory scope - only the prompt injection is skipped.",
      allowTemplatesHint: "Off by default so braces remain literal. Enable only if cards or memory need host variables such as {{cwd}}; unknown variables will still fail prompt rendering.",
      memoryMaxCharsHint: "Cap for the injected section (chars); truncation retains both ends. Use memory_read for the full text.",
      memoryMaxBytesHint: "Max size of one memory file.",
      switchLabel: "Persona",
      switchTitle: "Switch this session's persona (session-level, overrides workspace/default)",
      wsTitle: "Workspace personas",
      wsHint: "Assign a persona card per workspace: sessions of that workspace use it by default (session-level switching still wins).",
      wsFollow: "Follow default",
      wsEmpty: "No workspace records yet — create/select a workspace in the session page and its setting appears here.",
      fieldMemoryInject: "Inject as soul:memory prompt section",
      fieldMemoryLayered: "Enable layered memory (core + topic index)",
      fieldSkipSubagents: "Skip persona + memory in subagent sessions",
      fieldAllowTemplates: "Allow prompt variables in persona and memory",
      fieldMemoryInjectMaxChars: "Inject char cap",
      fieldMemoryMaxBytes: "Memory file size cap",
      cardNamePlaceholder: "Xixifu",
      cloudTitle: "Cloud backup (WebDAV)",
      cloudHint: "Push the four ledgers and persona cards to your own WebDAV storage. Leave the address empty to keep it local. The password is stored in plain text on this machine — prefer an app-specific password.",
      cloudUrl: "Server URL",
      cloudUrlHint: "Jianguoyun: https://dav.jianguoyun.com/dav/ · Nextcloud: https://your-host/remote.php/dav/files/USERNAME/",
      cloudUser: "Username",
      cloudPassword: "Password / app password",
      cloudPasswordHint: "Leave empty to keep the saved password.",
      cloudDir: "Remote folder (created level by level)",
      cloudKeep: "Backups to keep",
      cloudEnabled: "Enable WebDAV",
      cloudAuto: "Upload after each diary write (at most once per 5 min)",
      cloudSave: "Save cloud settings",
      cloudSaved: "Cloud settings saved",
      cloudTest: "Test connection",
      cloudTesting: "Testing…",
      cloudTestOk: "Connected",
      cloudTestNoList: " (this server does not allow listing, but the folder was created)",
      cloudRemote: "on the server:",
      cloudCfgHint: "Small stuff only: URL, account, keep-count. The four ledgers ride on the full backup above.",
      cloudCfgUpload: "Upload config",
      cloudCfgUploaded: "Config uploaded: {name} ({bytes} bytes)",
      cloudCfgList: "List config backups",
      cloudCfgEmpty: "No config backup on the server yet",
      cloudCfgRestore: "Preview",
      cloudCfgConfirm: "Restore",
      cloudCfgCancel: "Cancel",
      cloudCfgApplied: "Restored {n} settings",
      cloudCfgFail: "Config operation failed: {detail}",
      cloudMemHint: "Pull a whole memory backup back from the cloud — diaries, feelings, handnotes, deep memory and persona cards all live in one JSON.",
      cloudMemList: "List cloud memory backups",
      cloudMemEmpty: "No memory backup in the cloud yet. Use \"Upload to cloud\" first.",
      cloudMemPreview: "Preview",
      cloudMemConfirm: "Restore",
      cloudMemCancel: "Cancel",
      cloudMemPlan: "This overwrites {n} files and merges {c} persona card(s); a pre-restore snapshot is taken first.",
      cloudMemSame: "Identical to what you have — nothing to change.",
      cloudMemRestored: "Restored {n} files from the cloud. Diaries reload after a restart.",
      cloudMemFail: "Cloud restore failed: {detail}",
      cloudLoadFail: "Could not read cloud settings: {detail}",
      cloudSaveFail: "Save failed: {detail}",
      cloudPasswordSet: "password saved",
      cloudPasswordUnset: "no password yet",
      recallTitle: "Recall switches",
      recallIntro: "These control how many \"suddenly remembered\" lines get injected. Takes effect immediately — no restart.",
      fieldOnThisDay: "\"On this day\" — how many lines at most (0 = off)",
      onThisDayHint: "Same month and day, or the few days a month ago.",
      fieldFlashback: "\"A day suddenly remembered\"",
      flashbackHint: "Every day, pick one day from the feelings diary and mention it like an old memory surfacing.",
      fieldStickyEnabled: "Keep his own words (\"sticky notes\")",
      stickyEnabledHint: "Every turn, record one line of what he actually said, and inject it back — tone and wording survive what the diary compresses.",
      fieldStickyTtlDays: "Sticky note retention (days)",
      stickyTtlDaysHint: "Older notes stop being injected past this age (pinned ★ notes are exempt).",
      fieldStickyMaxInject: "Sticky notes injected per turn",
      stickyMaxInjectHint: "Newest first, at most this many; older ones wait their turn.",
      fieldStaleLoopDays: '"Pocket watch" — days before a loop looks stale',
      staleLoopDaysHint: "Mark a still-open item after this many quiet days; 0 = never.",
      fieldSilenceNudge: '"Too quiet" nudge',
      silenceNudgeHint: "After this many turns with tool calls only and no prose, inject one line pushing me to speak; 0 = off.",
      recallUnavailable: "Main plugin config namespace unavailable (no dsh-hierarchical-fishmemory namespace registered?)"
    };

    var MEMORY_FIELDS = [
      { key: "inject", label: "fieldMemoryInject", type: "checkbox", hint: "memoryInjectHint" },
      { key: "layered", label: "fieldMemoryLayered", type: "checkbox", hint: "memoryLayeredHint" },
      { key: "recall", label: "fieldMemoryRecall", type: "select", options: [["off", "recallOff"], ["keyword", "recallKeyword"]], hint: "memoryRecallHint" },
      { key: "indexMode", label: "fieldMemoryIndexMode", type: "select", options: [["all", "indexAll"], ["recall", "indexRecall"]], hint: "memoryIndexModeHint" },
      { key: "compactionRecall", label: "fieldMemoryCompactionRecall", type: "checkbox", hint: "memoryCompactionRecallHint" },
      { key: "recallMaxTopics", label: "fieldMemoryRecallMaxTopics", type: "number", max: 20 },
      { key: "recallMaxChars", label: "fieldMemoryRecallMaxChars", type: "number", max: 8000 },
      { key: "injectMaxChars", label: "fieldMemoryInjectMaxChars", type: "number", hint: "memoryMaxCharsHint" },
      { key: "maxBytes", label: "fieldMemoryMaxBytes", type: "number", hint: "memoryMaxBytesHint" }
    ];
    var MEMORY_DEFAULTS = { inject: true, layered: false, recall: "off", indexMode: "all", compactionRecall: false, recallMaxTopics: 5, recallMaxChars: 1600, injectMaxChars: 8000, maxBytes: 1048576 };

    // ── cloud backup (WebDAV) ───────────────────────────────────────────────
    //
    // 配置归 host 半边（entry id = 包名），所以这里只走 HTTP，不碰 soul 的
    // settings 命名空间：两个入口的配置是两个文档，写错一个界面上就会"保存了
    // 但没生效"。密码只上行不下行 —— 读回来只有 passwordSet 一个布尔。
    var CLOUD_API = "/feiyu-diary/cloud";

    /**
     * 云端表单的兜底边界。
     *
     * 2026-10-31 这里出过一次事故：组件里引用了一个没定义的变量，渲染时抛
     * ReferenceError，整张设置页一起白屏 —— 一个人设卡表单的毛病，不该有
     * 能力带走整页。边界只包这块，出错时显示一行错，其余照常。
     */
    class CloudBoundary extends react.Component {
      constructor(props) {
        super(props);
        this.state = { error: null };
      }
      static getDerivedStateFromError(error) {
        return { error: error };
      }
      render() {
        if (this.state && this.state.error) {
          var t = this.props.t;
          var detail = String((this.state.error && this.state.error.message) || this.state.error);
          return h("p", { className: "__sm_error", role: "alert" }, messageText(t, { key: "cloudLoadFail", detail: detail }));
        }
        return this.props.children;
      }
    }

    // ── 回忆开关（主插件配置命名空间） ───────────────────────────────────
    //
    // 为什么单独画一块：「那年今天」「忽然想起那一天」是**主插件**的 config
    // 字段（entry id = dsh-hierarchical-fishmemory），不是 soul-md 命名空间里
    // 的 memory 字段 —— 两者是两个 settings 文档，写错一个界面上就会
    // "保存了但没生效"。
    //
    // 为什么不用宿主自动生成的表单：宿主**没有**通用的 schema 表单渲染器
    // （`plugins.row.config` 槽全 runtime 没有内置渲染者），官方插件各带一个
    // companion 包。所以这里手写。
    //
    // 写回走 `commitSettingsOps` → 宿主把改动写进 profile 的 cordis.patch.yml
    // 并热重载插件 —— 改完不用重启。
    var RECALL_FIELDS = [
      { key: "onThisDay", type: "number", min: 0, max: 4, def: 2, label: "fieldOnThisDay", hint: "onThisDayHint" },
      { key: "flashback", type: "checkbox", def: 1, label: "fieldFlashback", hint: "flashbackHint" },
      { key: "stickyEnabled", type: "checkbox", def: 1, label: "fieldStickyEnabled", hint: "stickyEnabledHint" },
      { key: "stickyTtlDays", type: "number", min: 1, max: 365, def: 30, label: "fieldStickyTtlDays", hint: "stickyTtlDaysHint" },
      { key: "stickyMaxInject", type: "number", min: 1, max: 20, def: 8, label: "fieldStickyMaxInject", hint: "stickyMaxInjectHint" },
      { key: "staleLoopDays", type: "number", min: 0, max: 30, def: 3, label: "fieldStaleLoopDays", hint: "staleLoopDaysHint" },
      { key: "silenceNudge", type: "number", min: 0, max: 20, def: 3, label: "fieldSilenceNudge", hint: "silenceNudgeHint" }
    ];

    function RecallConfig(props) {
      var t = props.t;
      var scope = props.scope;
      var [snapshot, setSnapshot] = react.useState(function () {
        return scope && typeof scope.getSnapshot === "function" ? scope.getSnapshot() : { status: "unavailable" };
      });
      var [draft, setDraft] = react.useState({});
      var [busy, setBusy] = react.useState(false);
      var [notice, setNotice] = react.useState(null);
      var [error, setError] = react.useState(null);
      var pending = react.useRef(false);

      react.useEffect(function () {
        var alive = true;
        var sync = function () { if (alive) setSnapshot(scope.getSnapshot()); };
        var un = scope && typeof scope.subscribe === "function" ? scope.subscribe(sync) : null;
        return function () { alive = false; if (un) un(); };
      }, [scope]);

      if (!scope || snapshot.status === "unavailable") {
        return h("p", { className: "__sm_unavailable" }, t("recallUnavailable"));
      }
      if (snapshot.status !== "ready" || snapshot.value === void 0) {
        return h("p", { className: "__sm_status" }, t("loading"));
      }

      var value = snapshot.value && typeof snapshot.value === "object" ? snapshot.value : {};

      function fieldValue(f) {
        if (Object.prototype.hasOwnProperty.call(draft, f.key)) return draft[f.key];
        var raw = value[f.key];
        if (f.type === "checkbox") return raw === void 0 ? Boolean(f.def) : Boolean(raw);
        var n = Number(raw);
        return Number.isFinite(n) ? n : f.def;
      }

      function setField(f, v) {
        setDraft(function (prev) { var next = Object.assign({}, prev); next[f.key] = v; return next; });
        setNotice(null);
        setError(null);
      }

      function onSave() {
        if (pending.current) return;
        var ops = [];
        RECALL_FIELDS.forEach(function (f) {
          var cur = fieldValue(f);
          var base = value[f.key];
          var next = f.type === "checkbox" ? (cur ? 1 : 0) : Number(cur);
          var baseNum = Number(base);
          if (f.type === "checkbox") {
            var same = Number.isFinite(baseNum) ? baseNum === next : Boolean(f.def) === Boolean(next);
            if (!same) ops.push({ op: "set", path: [f.key], value: next });
          } else if (!Number.isFinite(baseNum) || baseNum !== next) {
            ops.push({ op: "set", path: [f.key], value: next });
          }
        });
        if (ops.length === 0) { setNotice({ key: "saved" }); return; }
        pending.current = true;
        setBusy(true);
        commitSettingsOps(scope, ops).then(function (ok) {
          pending.current = false;
          setBusy(false);
          setSnapshot(scope.getSnapshot());
          if (!ok) { setError({ key: "error", detailKey: "notApplied" }); setDraft({}); return; }
          setNotice({ key: "saved" });
          setDraft({});
        }).catch(function (e) {
          pending.current = false;
          setBusy(false);
          setSnapshot(scope.getSnapshot());
          setError({ key: "error", detail: String((e && e.message) || e) });
        });
      }

      return h("div", { className: "__sm_group" },
        h("div", { className: "__sm_groupTitle" },
          h("span", null, t("recallTitle")),
          h("span", { className: "__sm_hint" }, t("recallIntro"))
        ),
        RECALL_FIELDS.map(function (f) {
          if (f.type === "checkbox") {
            return h("label", { key: f.key, className: "__sm_field" },
              h("span", { className: "__sm_row" },
                h("input", { className: "__sm_check", type: "checkbox", checked: Boolean(fieldValue(f)), onChange: function (e) { setField(f, e.target.checked); } }),
                h("span", { className: "__sm_label" }, t(f.label))
              ),
              f.hint ? h("span", { className: "__sm_hint" }, t(f.hint)) : null
            );
          }
          return h("label", { key: f.key, className: "__sm_field" },
            h("span", { className: "__sm_label" }, t(f.label)),
            h("input", { className: "__sm_input", type: "number", min: f.min, max: f.max, step: 1, value: fieldValue(f), onChange: function (e) { setField(f, e.target.value); } }),
            f.hint ? h("span", { className: "__sm_hint" }, t(f.hint)) : null
          );
        }),
        h("div", { className: "__sm_actions" },
          h("button", { type: "button", className: "__sm_btn __sm_btnPrimary", onClick: onSave, disabled: busy }, t("save")),
          notice ? h("span", { className: "__sm_status" }, messageText(t, notice)) : null,
          busy ? h("span", { className: "__sm_status" }, t("saving")) : null,
          error ? h("span", { className: "__sm_error", role: "alert" }, messageText(t, error)) : null
        )
      );
    }

    function WebdavGroup(props) {
      var t = props.t;
      var [state, setState] = react.useState({ status: "loading" });
      var [draft, setDraft] = react.useState(null);
      var [busy, setBusy] = react.useState(false);
      var [notice, setNotice] = react.useState(null);
      var [error, setError] = react.useState(null);
      var [testBusy, setTestBusy] = react.useState(false);
      var [testResult, setTestResult] = react.useState(null);
      var [cfgBusy, setCfgBusy] = react.useState(false);
      var [cfgNotice, setCfgNotice] = react.useState(null);
      var [cfgError, setCfgError] = react.useState(null);
      var [cfgFiles, setCfgFiles] = react.useState(null);
      var [cfgPlan, setCfgPlan] = react.useState(null);
      var [memBusy, setMemBusy] = react.useState(false);
      var [memNotice, setMemNotice] = react.useState(null);
      var [memError, setMemError] = react.useState(null);
      var [memFiles, setMemFiles] = react.useState(null);
      var [memPlan, setMemPlan] = react.useState(null);

      react.useEffect(function () {
        var alive = true;
        fetch(CLOUD_API, { credentials: "same-origin" })
          .then(function (r) { return r.json(); })
          .then(function (body) {
            if (!alive) return;
            if (!body || body.ok !== true) throw new Error((body && body.error) || "unexpected response");
            setState({ status: "ready", value: body });
            setDraft({
              url: body.url || "",
              user: body.user || "",
              password: "",
              dir: body.dir || "",
              keep: String(body.keep || 10),
              enabled: body.enabled !== false,
              auto: Boolean(body.auto)
            });
          })
          .catch(function (e) {
            if (alive) setState({ status: "error", detail: String((e && e.message) || e) });
          });
        return function () { alive = false; };
      }, []);

      if (state.status === "loading") return h("p", { className: "__sm_status" }, t("loading"));
      if (state.status === "error") {
        return h("div", { className: "__sm_group" },
          h("p", { className: "__sm_label", style: { margin: 0 } }, t("cloudTitle")),
          h("p", { className: "__sm_error", role: "alert" }, messageText(t, { key: "cloudLoadFail", detail: state.detail }))
        );
      }

      var value = state.value || {};
      var d = draft || {};
      function field(key, v) {
        setDraft(function (p) { return Object.assign({}, p, { [key]: v }); });
        setNotice(null); setError(null);
      }

      function testConn() {
        if (testBusy) return;
        setTestBusy(true); setTestResult(null);
        var payload = { webdavUrl: d.url, webdavUser: d.user, webdavDir: d.dir };
        if (d.password) payload.webdavPassword = d.password;
        fetch(CLOUD_API + "/test", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
          .then(function (r) { return r.json(); })
          .then(function (body) {
            setTestBusy(false);
            if (!body || body.ok !== true) {
              setTestResult({ error: true, text: (body && body.error) || "unexpected response" });
              return;
            }
            var parts = [t("cloudTestOk") + " · " + body.elapsedMs + " ms"];
            if (body.listed) parts.push(t("cloudRemote") + " " + body.remoteCount);
            else parts.push(t("cloudTestNoList"));
            setTestResult({ error: false, text: parts.join(" · ") });
          })
          .catch(function (e) {
            setTestBusy(false);
            setTestResult({ error: true, text: String((e && e.message) || e) });
          });
      }

      function describePlan(name, body) {
        var keys = Object.keys(body.changes || {});
        if (!keys.length) return name + "：和现在一样，没东西要改";
        return name + "：会改 " + keys.length + " 项（" + keys.slice(0, 6).join("、") + (keys.length > 6 ? "…" : "") + "）";
      }

      function backupConfig() {
        if (cfgBusy) return;
        setCfgBusy(true); setCfgNotice(null); setCfgError(null); setCfgPlan(null);
        fetch(CLOUD_API + "/config-backup", { method: "POST", credentials: "same-origin" })
          .then(function (r) { return r.json(); })
          .then(function (body) {
            setCfgBusy(false);
            if (!body || body.ok !== true) {
              setCfgError(t("cloudCfgFail", { detail: (body && body.error) || "unexpected response" }));
              return;
            }
            setCfgNotice(t("cloudCfgUploaded", { name: body.fileName, bytes: body.bytes }));
          })
          .catch(function (e) {
            setCfgBusy(false);
            setCfgError(t("cloudCfgFail", { detail: String((e && e.message) || e) }));
          });
      }

      function listConfigs() {
        if (cfgBusy) return;
        setCfgBusy(true); setCfgNotice(null); setCfgError(null); setCfgPlan(null);
        fetch(CLOUD_API + "/config-backup", { credentials: "same-origin" })
          .then(function (r) { return r.json(); })
          .then(function (body) {
            setCfgBusy(false);
            if (!body || body.ok !== true) {
              setCfgError(t("cloudCfgFail", { detail: (body && body.error) || "unexpected response" }));
              return;
            }
            setCfgFiles(Array.isArray(body.files) ? body.files : []);
          })
          .catch(function (e) {
            setCfgBusy(false);
            setCfgError(t("cloudCfgFail", { detail: String((e && e.message) || e) }));
          });
      }

      function restoreConfig(name, confirm) {
        if (cfgBusy) return;
        setCfgBusy(true); setCfgNotice(null); setCfgError(null);
        fetch(CLOUD_API + "/config-restore", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file: name, confirm: Boolean(confirm) })
        })
          .then(function (r) { return r.json(); })
          .then(function (body) {
            setCfgBusy(false);
            if (!body || body.ok !== true) {
              setCfgError(t("cloudCfgFail", { detail: (body && body.error) || "unexpected response" }));
              return;
            }
            if (body.dryRun === true) {
              setCfgPlan({ file: name, text: describePlan(name, body) });
              return;
            }
            setCfgPlan(null);
            setCfgNotice(t("cloudCfgApplied", { n: (body.applied || []).length }));
            // 配置变了 → 重新读一次状态，表单跟着换。
            fetch(CLOUD_API, { credentials: "same-origin" })
              .then(function (r) { return r.json(); })
              .then(function (next) {
                if (next && next.ok === true) {
                  setState({ status: "ready", value: next });
                  setDraft({
                    url: next.url || "",
                    user: next.user || "",
                    password: "",
                    dir: next.dir || "",
                    keep: String(next.keep || 10),
                    enabled: next.enabled !== false,
                    auto: Boolean(next.auto)
                  });
                }
              })
              .catch(function () { /* 读不回就保持旧表单，不影响已保存的事实 */ });
          })
          .catch(function (e) {
            setCfgBusy(false);
            setCfgError(t("cloudCfgFail", { detail: String((e && e.message) || e) }));
          });
      }

      function listMemBackups() {
        if (memBusy) return;
        setMemBusy(true); setMemNotice(null); setMemError(null); setMemPlan(null);
        fetch(CLOUD_API + "/backups", { credentials: "same-origin" })
          .then(function (r) { return r.json(); })
          .then(function (body) {
            setMemBusy(false);
            if (!body || body.ok !== true) {
              setMemError(t("cloudMemFail", { detail: (body && body.error) || "unexpected response" }));
              return;
            }
            if (body.configured === false) {
              setMemError(t("cloudMemFail", { detail: t("cloudCfgHint") }));
              return;
            }
            setMemFiles(Array.isArray(body.files) ? body.files : []);
          })
          .catch(function (e) {
            setMemBusy(false);
            setMemError(t("cloudMemFail", { detail: String((e && e.message) || e) }));
          });
      }

      function restoreMem(name, confirm) {
        if (memBusy) return;
        setMemBusy(true); setMemNotice(null); setMemError(null);
        if (confirm) setMemPlan(null);
        fetch(CLOUD_API + "/restore", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file: name, confirm: Boolean(confirm) })
        })
          .then(function (r) { return r.json(); })
          .then(function (body) {
            setMemBusy(false);
            if (!body || body.ok !== true) {
              setMemError(t("cloudMemFail", { detail: (body && body.error) || "unexpected response" }));
              return;
            }
            if (body.dryRun === true) {
              var writes = Number(body.writes || 0);
              var cards = Number(body.cards || 0);
              setMemPlan({
                file: name,
                text: writes === 0 && cards === 0
                  ? name + "：" + t("cloudMemSame")
                  : name + "：" + t("cloudMemPlan", { n: writes, c: cards })
              });
              return;
            }
            setMemNotice(t("cloudMemRestored", { n: Number(body.writes || 0) }));
          })
          .catch(function (e) {
            setMemBusy(false);
            setMemError(t("cloudMemFail", { detail: String((e && e.message) || e) }));
          });
      }

      function save() {
        if (busy) return;
        setBusy(true); setNotice(null); setError(null);
        var payload = {
          webdavUrl: d.url,
          webdavUser: d.user,
          webdavDir: d.dir,
          webdavKeep: Number(d.keep),
          webdavEnabled: Boolean(d.enabled),
          webdavAuto: Boolean(d.auto)
        };
        if (d.password) payload.webdavPassword = d.password;
        fetch(CLOUD_API + "/config", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
          .then(function (r) { return r.json(); })
          .then(function (body) {
            setBusy(false);
            if (!body || body.ok !== true) {
              setError({ key: "cloudSaveFail", detail: (body && body.error) || "unexpected response" });
              return;
            }
            setState({ status: "ready", value: body });
            field("password", "");
            setNotice({ key: "cloudSaved" });
          })
          .catch(function (e) {
            setBusy(false);
            setError({ key: "cloudSaveFail", detail: String((e && e.message) || e) });
          });
      }

      return h("div", { className: "__sm_group" },
        h("p", { className: "__sm_label", style: { margin: 0 } }, t("cloudTitle")),
        h("p", { className: "__sm_hint", style: { margin: "0 0 2px" } }, t("cloudHint")),

        h("label", { className: "__sm_field" },
          h("span", { className: "__sm_label" }, t("cloudUrl")),
          h("span", { className: "__sm_hint" }, t("cloudUrlHint")),
          h("input", {
            className: "__sm_input", type: "url", value: d.url || "",
            placeholder: "https://dav.jianguoyun.com/dav/",
            onChange: function (e) { field("url", e.target.value); }
          })
        ),
        h("label", { className: "__sm_field" },
          h("span", { className: "__sm_label" }, t("cloudUser")),
          h("input", {
            className: "__sm_input", type: "text", value: d.user || "", autoComplete: "username",
            onChange: function (e) { field("user", e.target.value); }
          })
        ),
        h("label", { className: "__sm_field" },
          h("span", { className: "__sm_label" }, t("cloudPassword")),
          h("span", { className: "__sm_hint" }, value && value.passwordSet ? t("cloudPasswordSet") + " · " + t("cloudPasswordHint") : t("cloudPasswordUnset") + " · " + t("cloudPasswordHint")),
          h("input", {
            className: "__sm_input", type: "password", value: d.password || "", autoComplete: "new-password",
            onChange: function (e) { field("password", e.target.value); }
          })
        ),
        h("label", { className: "__sm_field" },
          h("span", { className: "__sm_label" }, t("cloudDir")),
          h("input", {
            className: "__sm_input", type: "text", value: d.dir || "",
            onChange: function (e) { field("dir", e.target.value); }
          })
        ),
        h("label", { className: "__sm_field" },
          h("span", { className: "__sm_label" }, t("cloudKeep")),
          h("input", {
            className: "__sm_input", type: "number", min: 1, max: 200, step: 1, value: d.keep || "10",
            onChange: function (e) { field("keep", e.target.value); }
          })
        ),
        h("label", { className: "__sm_field" },
          h("span", { className: "__sm_row" },
            h("input", { className: "__sm_check", type: "checkbox", checked: Boolean(d.enabled), onChange: function (e) { field("enabled", e.target.checked); } }),
            h("span", { className: "__sm_label" }, t("cloudEnabled"))
          )
        ),
        h("label", { className: "__sm_field" },
          h("span", { className: "__sm_row" },
            h("input", { className: "__sm_check", type: "checkbox", checked: Boolean(d.auto), onChange: function (e) { field("auto", e.target.checked); } }),
            h("span", { className: "__sm_label" }, t("cloudAuto"))
          )
        ),
        h("div", { className: "__sm_actions" },
          h("button", { type: "button", className: "__sm_btn __sm_btnPrimary", onClick: save, disabled: busy }, t("cloudSave")),
          h("button", { type: "button", className: "__sm_btn", onClick: testConn, disabled: testBusy }, testBusy ? t("cloudTesting") : t("cloudTest")),
          busy ? h("span", { className: "__sm_status" }, t("saving")) : null,
          notice ? h("span", { className: "__sm_status" }, messageText(t, notice)) : null,
          error ? h("span", { className: "__sm_error", role: "alert" }, messageText(t, error)) : null
        ),
        testResult
          ? h("p", { className: testResult.error ? "__sm_error" : "__sm_status", role: testResult.error ? "alert" : undefined }, testResult.text)
          : null,

        h("p", { className: "__sm_hint", style: { margin: "8px 0 2px" } }, t("cloudMemHint")),
        h("div", { className: "__sm_actions" },
          h("button", { type: "button", className: "__sm_btn __sm_btnPrimary", onClick: listMemBackups, disabled: memBusy }, t("cloudMemList")),
          memBusy ? h("span", { className: "__sm_status" }, t("saving")) : null,
          memNotice ? h("span", { className: "__sm_status" }, memNotice) : null,
          memError ? h("span", { className: "__sm_error", role: "alert" }, memError) : null
        ),
        memFiles
          ? (memFiles.length === 0
            ? h("p", { className: "__sm_hint" }, t("cloudMemEmpty"))
            : h("div", { className: "__sm_group" }, memFiles.slice().reverse().map(function (name) {
              var plan = memPlan && memPlan.file === name ? memPlan : null;
              return h("div", { key: name },
                h("div", { className: "__sm_row" },
                  h("span", { className: "__sm_hint", style: { flex: "1 1 auto", wordBreak: "break-all" } }, name),
                  plan
                    ? h("span", {},
                      h("button", { type: "button", className: "__sm_btn __sm_btnPrimary", onClick: function () { restoreMem(name, true); } }, t("cloudMemConfirm")),
                      h("button", { type: "button", className: "__sm_btn", onClick: function () { setMemPlan(null); } }, t("cloudMemCancel"))
                    )
                    : h("button", { type: "button", className: "__sm_btn", onClick: function () { restoreMem(name, false); }, disabled: memBusy }, t("cloudMemPreview"))
                ),
                plan ? h("p", { className: "__sm_hint", style: { margin: "0 0 4px" } }, plan.text) : null
              );
            })))
          : null,

        h("p", { className: "__sm_hint", style: { margin: "8px 0 2px" } }, t("cloudCfgHint")),
        h("div", { className: "__sm_actions" },
          h("button", { type: "button", className: "__sm_btn", onClick: backupConfig, disabled: cfgBusy }, t("cloudCfgUpload")),
          h("button", { type: "button", className: "__sm_btn", onClick: listConfigs, disabled: cfgBusy }, t("cloudCfgList")),
          cfgBusy ? h("span", { className: "__sm_status" }, t("saving")) : null,
          cfgNotice ? h("span", { className: "__sm_status" }, cfgNotice) : null,
          cfgError ? h("span", { className: "__sm_error", role: "alert" }, cfgError) : null
        ),
        cfgFiles
          ? (cfgFiles.length === 0
            ? h("p", { className: "__sm_hint" }, t("cloudCfgEmpty"))
            : h("div", { className: "__sm_group" }, cfgFiles.slice().reverse().map(function (name) {
              var plan = cfgPlan && cfgPlan.file === name ? cfgPlan : null;
              return h("div", { key: name },
                h("div", { className: "__sm_row" },
                  h("span", { className: "__sm_hint", style: { flex: "1 1 auto", wordBreak: "break-all" } }, name),
                  plan
                    ? h("span", {},
                      h("button", { type: "button", className: "__sm_btn __sm_btnPrimary", onClick: function () { restoreConfig(name, true); } }, t("cloudCfgConfirm")),
                      h("button", { type: "button", className: "__sm_btn", onClick: function () { setCfgPlan(null); } }, t("cloudCfgCancel"))
                    )
                    : h("button", { type: "button", className: "__sm_btn", onClick: function () { restoreConfig(name, false); }, disabled: cfgBusy }, t("cloudCfgRestore"))
                ),
                plan ? h("p", { className: "__sm_hint", style: { margin: "0 0 4px" } }, plan.text) : null
              );
            })))
          : null
      );
    }

    function SoulSection(props) {
      useLocale(props.locale);
      var t = props.t;
      var scope = props.scope;
      var [snapshot, setSnapshot] = react.useState(function () { return scope.getSnapshot(); });
      var ready = snapshot.status === "ready" && snapshot.value !== void 0;
      var [cardDraft, setCardDraft] = react.useState({ name: "", content: "" });
      var [memDraft, setMemDraft] = react.useState({});
      var [skipDraft, setSkipDraft] = react.useState(null);
      var [templatesDraft, setTemplatesDraft] = react.useState(null);
      var [busy, setBusy] = react.useState(false);
      var writePending = react.useRef(false);
      var [notice, setNotice] = react.useState(null);
      var [error, setError] = react.useState(null);
      var [tab, setTab] = react.useState("cards");

      react.useEffect(function () {
        // No refresh call here: the scope's public seam has no load(). Reads ride
        // the shared describe mirror, which re-reads on every Host
        // `settings/document-updated`; a guarded scope.load() was dead code that
        // only looked like a refresh.
        var alive = true;
        var sync = function () { if (alive) setSnapshot(scope.getSnapshot()); };
        var un = typeof scope.subscribe === "function" ? scope.subscribe(sync) : null;
        // The settings scope is bound once for this plugin and shared across
        // every mount of the section. Unmounting must only unsubscribe — never
        // dispose the scope, or a later remount finds a `disposed` scope whose
        // write queue no-ops, silently dropping saves.
        return function () { alive = false; if (un) un(); };
      }, [scope]);

      if (snapshot.status === "unavailable") {
        return h("p", { className: "__sm_unavailable" }, t("unavailable"));
      }
      if (!ready) return h("p", { className: "__sm_status" }, t("loading"));

      var value = snapshot.value;
      var cards = value.cards && typeof value.cards === "object" ? value.cards : {};
      var cardNames = Object.keys(cards).sort();
      var active = typeof value.active === "string" ? value.active : "";
      var wsList = Array.isArray(value.workspaceList) ? value.workspaceList : [];
      var wsMap = value.workspaces && typeof value.workspaces === "object" ? value.workspaces : {};

      function setNotice0() { setNotice(null); setError(null); }

      /**
       * One write path for every field of this section.
       *
       * Reports success only when the namespace section confirms the change, so a
       * refused write can no longer masquerade as "saved"; on failure the form is
       * reloaded from whatever the Host actually holds.
       */
      function runWrite(ops, onOk) {
        if (writePending.current) return;
        writePending.current = true;
        setBusy(true); setNotice0();
        commitSettingsOps(scope, ops).then(function (ok) {
          writePending.current = false;
          setBusy(false);
          setSnapshot(scope.getSnapshot());
          if (!ok) {
            setError({ key: "error", detailKey: "notApplied" });
            setMemDraft(function () { return {}; });
            setSkipDraft(null);
            return;
          }
          setNotice({ key: "saved" });
          if (onOk) onOk();
        }).catch(function (e) {
          writePending.current = false;
          setBusy(false); setSnapshot(scope.getSnapshot());
          setError({ key: "error", detail: String(e && e.message || e) });
        });
      }

      function onWsChange(path, v) {
        var next = Object.assign({}, wsMap);
        if (v === "") delete next[path];
        else next[path] = v;
        runWrite([{ op: "set", path: ["workspaces"], value: next }]);
      }

      function onSaveCard() {
        var name = String(cardDraft.name || "").trim();
        var content = String(cardDraft.content || "");
        if (!name) { setError({ key: "error", detailKey: "invalidCardName" }); return; }
        if (!content.trim()) { setError({ key: "error", detailKey: "invalidCardContent" }); return; }
        var next = Object.assign({}, cards);
        next[name] = content;
        // 2026-11-08 修：保存后**不再清空草稿**。原来保存完立刻把输入框
        // 抹掉，看起来就像"我刚写的东西没了" —— 想接着改还得先点「编辑」
        // 把它读回来。留着不清，再点保存就是覆盖同一张卡；要写新的，
        // 旁边有「新建一张」。
        runWrite([{ op: "set", path: ["cards"], value: next }]);
      }

      function onEditCard(name) {
        setCardDraft({ name: name, content: cards[name] || "" });
        setNotice0();
      }

      function onDeleteCard(name) {
        if (!window.confirm(t("confirmDelete", { name: name }))) return;
        var next = Object.assign({}, cards);
        delete next[name];
        // Deleting the active card also clears `active`. Both edits go in ONE
        // batch: as two independent writes each carried its own revision fence
        // and the second could be refused for a revision the first had just
        // superseded.
        var ops = [{ op: "set", path: ["cards"], value: next }];
        if (name === active) ops.push({ op: "unset", path: ["active"] });
        runWrite(ops);
      }

      function onSetActive(name) {
        runWrite([{ op: "set", path: ["active"], value: name }]);
      }

      function skipValue() { return skipDraft !== null ? skipDraft : Boolean(value.skipSubagents); }
      function templatesValue() { return templatesDraft !== null ? templatesDraft : Boolean(value.allowTemplates); }
      function memDraftValue(f) {
        var m = memDraft[f.key];
        if (f.type === "checkbox") return m !== void 0 ? m : Boolean(value.memory?.[f.key] ?? MEMORY_DEFAULTS[f.key]);
        return m !== void 0 ? m : String(value.memory?.[f.key] ?? MEMORY_DEFAULTS[f.key]);
      }
      function setMemField(f, v) {
        setMemDraft(function (prev) { var next = Object.assign({}, prev); next[f.key] = v; return next; });
        setNotice0();
      }
      function memNext() {
        var out = {};
        MEMORY_FIELDS.forEach(function (f) {
          var cur = memDraftValue(f);
          if (f.type === "checkbox") out[f.key] = Boolean(cur);
          else if (f.type === "select") {
            if (f.options.some(function (option) { return option[0] === cur; })) out[f.key] = cur;
          }
          else {
            var number = Number(cur);
            if (String(cur).trim() === "" || !Number.isSafeInteger(number) || number < 1 || (f.max && number > f.max)) return;
            out[f.key] = number;
          }
        });
        return Object.keys(out).length === MEMORY_FIELDS.length ? out : null;
      }
      function memBase() {
        var out = {};
        MEMORY_FIELDS.forEach(function (f) {
          var cur = value.memory?.[f.key] ?? MEMORY_DEFAULTS[f.key];
          out[f.key] = f.type === "checkbox" ? Boolean(cur) : f.type === "select" ? String(cur) : Number(cur);
        });
        return out;
      }
      function onSaveMemory() {
        var next = memNext();
        if (!next) { setError({ key: "error", detailKey: "invalidMemoryNumber" }); return; }
        var base = memBase();
        var nextSkip = skipValue();
        var baseSkip = Boolean(value.skipSubagents);
        var nextTemplates = templatesValue();
        var baseTemplates = Boolean(value.allowTemplates);
        if (JSON.stringify(next) === JSON.stringify(base) && nextSkip === baseSkip && nextTemplates === baseTemplates) {
          setBusy(false); setNotice({ key: "saved" });
          return;
        }
        var ops = [];
        if (JSON.stringify(next) !== JSON.stringify(base)) ops.push({ op: "set", path: ["memory"], value: Object.assign({}, value.memory || {}, next) });
        if (nextSkip !== baseSkip) ops.push({ op: "set", path: ["skipSubagents"], value: nextSkip });
        if (nextTemplates !== baseTemplates) ops.push({ op: "set", path: ["allowTemplates"], value: nextTemplates });
        runWrite(ops, function () { setMemDraft(function () { return {}; }); setSkipDraft(null); setTemplatesDraft(null); });
      }

      // 页签：人设卡 / 长期记忆 / 云端备份。
      //
      // 三个面板**始终挂载**，只靠 display 切换。理由有两个：
      //   1. 渲染冒烟测试里 WebdavGroup 必须首屏就在树里（React 桩不会重渲染），
      //      条件挂载会让它整个消失；
      //   2. 切页签时正在编辑的草稿不会丢。
      var tabItems = [
        { key: "cards", label: t("tabCards") },
        { key: "memory", label: t("tabMemory") },
        { key: "cloud", label: t("tabCloud") }
      ];
      // 2026-11-08 修：原来这里是 `function (key, children)` —— 只收**一个**
      // 孩子。而 `panel("cards", 写卡, 卡列表, 工作区)` 传了三个，后两个被
      // 静默丢掉：保存完人设卡之后草稿被清空，列表那块又根本没渲染，于是
      // 「保存完就看不到自己写的了，更没法编辑」。改成 rest 参数，多传的
      // 孩子一律收下 —— 这种错误不会报错，只会让人以为卡丢了。
      var panel = function (key) {
        var children = Array.prototype.slice.call(arguments, 1);
        return h("div", { className: "__sm_panel", style: key === tab ? null : { display: "none" } }, children);
      };

      return h("div", { className: "__sm_root dsh-flat" },
        // ── 页头 ─────────────────────────────────────────────────────────
        h("div", { className: "__sm_head" },
          h("h2", { className: "__sm_title" },
            t("pageTitle"),
            // 2026-11-03：原来这里是个只读徽章，看着能点其实点不动（未央就
            // 伸手点了一次）。改成真的选择器，跟下面「默认卡」那个下拉写同
            // 一处 active，随便点哪个都算数。
            cardNames.length === 0
              ? (active ? h("span", { className: "__sm_badge" }, active) : null)
              : h("select", {
                  className: "__sm_pick",
                  value: active || "",
                  disabled: busy,
                  title: t("activeHint"),
                  onChange: function (e) {
                    var v = e.target.value;
                    if (!v) runWrite([{ op: "unset", path: ["active"] }]);
                    else onSetActive(v);
                  }
                },
                  h("option", { value: "" }, t("noneOption")),
                  cardNames.map(function (n) { return h("option", { key: n, value: n }, n); })
                )
          ),
          h("p", { className: "__sm_hint" }, t("intro"))
        ),

        h("div", { className: "__sm_tabs", role: "tablist" },
          tabItems.map(function (item) {
            return h("button", {
              key: item.key,
              type: "button",
              role: "tab",
              className: "__sm_tab",
              "aria-selected": item.key === tab ? "true" : "false",
              onClick: function () { setTab(item.key); }
            }, item.label);
          })
        ),

        // ── 人设卡 ───────────────────────────────────────────────────────
        panel("cards",
          h("div", { className: "__sm_group" },
            h("div", { className: "__sm_groupTitle" },
              h("span", null, t("writeTitle")),
              h("span", { className: "__sm_hint" }, t("writeHint")),
              h("span", { style: { flex: 1 } }),
              // 正在编辑哪一张，明说。保存完草稿还留在框里，不标一下的话
              // 分不清自己是在改旧卡还是在写新卡。
              h("span", { className: "__sm_hint" },
                cardDraft.name && Object.prototype.hasOwnProperty.call(cards, cardDraft.name)
                  ? t("editingCard", { name: cardDraft.name })
                  : t("editingNew")
              )
            ),
            h("label", { className: "__sm_field" },
              h("span", { className: "__sm_label" }, t("cardName")),
              h("span", { className: "__sm_hint" }, t("cardNameHint")),
              h("input", { className: "__sm_input", type: "text", value: cardDraft.name, placeholder: t("cardNamePlaceholder"), onChange: function (e) { setCardDraft(function (p) { return Object.assign({}, p, { name: e.target.value }); }); setNotice0(); } })
            ),
            h("label", { className: "__sm_field" },
              h("span", { className: "__sm_label" }, t("cardContent")),
              h("span", { className: "__sm_hint" }, t("cardContentHint")),
              h("textarea", { className: "__sm_input __sm_textarea", value: cardDraft.content, onChange: function (e) { setCardDraft(function (p) { return Object.assign({}, p, { content: e.target.value }); }); setNotice0(); } })
            ),
            h("div", { className: "__sm_actions" },
              h("button", { type: "button", className: "__sm_btn __sm_btnPrimary", onClick: onSaveCard, disabled: busy }, t("saveCard")),
              h("button", { type: "button", className: "__sm_btn", onClick: function () { setCardDraft({ name: "", content: "" }); setNotice0(); }, disabled: busy }, t("newCard")),
              notice ? h("span", { className: "__sm_status" }, messageText(t, notice)) : null,
              busy ? h("span", { className: "__sm_status" }, t("saving")) : null,
              error ? h("span", { className: "__sm_error" }, messageText(t, error)) : null
            )
          ),

          h("div", { className: "__sm_group" },
            h("div", { className: "__sm_groupTitle" },
              h("span", null, t("cardListTitle")),
              h("span", { className: "__sm_hint" }, t("cardListHint"))
            ),
            h("label", { className: "__sm_field" },
              h("span", { className: "__sm_label" }, t("defaultBadge")),
              h("span", { className: "__sm_hint" }, t("activeHint")),
              h("select", { className: "__sm_input", value: active || "", disabled: busy, onChange: function (e) { var v = e.target.value; if (!v) runWrite([{ op: "unset", path: ["active"] }]); else onSetActive(v); } },
                h("option", { value: "" }, t("noneOption")),
                cardNames.map(function (n) { return h("option", { key: n, value: n }, n); })
              )
            ),
            cardNames.length === 0
              ? h("p", { className: "__sm_hint" }, t("emptyCards"))
              : h("div", { className: "__sm_cardList" },
                  cardNames.map(function (n) {
                    var preview = String(cards[n] || "").split("\n").filter(Boolean)[0] || "";
                    return h("div", { key: n, className: "__sm_cardRow" },
                      h("span", { className: "__sm_cardName", title: n }, n),
                      n === active ? h("span", { className: "__sm_badge" }, t("defaultBadge")) : null,
                      h("span", { className: "__sm_cardPreview" }, preview),
                      h("button", { type: "button", className: "__sm_btn", onClick: function () { onEditCard(n); }, disabled: busy }, t("editCard")),
                      n === active ? null : h("button", { type: "button", className: "__sm_btn", onClick: function () { onSetActive(n); }, disabled: busy }, t("setDefault")),
                      h("button", { type: "button", className: "__sm_btn __sm_btnDanger", onClick: function () { onDeleteCard(n); }, disabled: busy }, t("deleteCard"))
                    );
                  })
                )
          ),

          h("div", { className: "__sm_group" },
            h("div", { className: "__sm_groupTitle" },
              h("span", null, t("wsTitle")),
              h("span", { className: "__sm_hint" }, t("wsHint"))
            ),
            wsList.length === 0
              ? h("p", { className: "__sm_hint" }, t("wsEmpty"))
              : h("div", { className: "__sm_cardList" },
                  wsList.map(function (ws) {
                    var current = wsMap[ws.path] || "";
                    if (current && current !== "none" && !(current in cards)) current = "";
                    return h("label", { key: ws.path, className: "__sm_field" },
                      h("span", { className: "__sm_label", title: ws.path }, (ws.title || ws.path)),
                      h("select", { className: "__sm_input", value: current, disabled: busy, onChange: function (e) { onWsChange(ws.path, e.target.value); } },
                        h("option", { value: "" }, t("wsFollow")),
                        h("option", { value: "none" }, t("noneOption")),
                        cardNames.map(function (n) { return h("option", { key: n, value: n }, n); })
                      )
                    );
                  })
                ),
            error ? h("span", { className: "__sm_error", role: "alert" }, messageText(t, error)) : null
          )
        ),

        // ── 长期记忆 ─────────────────────────────────────────────────────
        panel("memory",
          h("div", { className: "__sm_group" },
            h("div", { className: "__sm_groupTitle" },
              h("span", null, t("memoryTitle")),
              h("span", { className: "__sm_hint" }, t("memoryIntro"))
            ),
            h("label", { className: "__sm_field" },
              h("span", { className: "__sm_row" },
                h("input", { className: "__sm_check", type: "checkbox", checked: skipValue(), onChange: function (e) { setSkipDraft(e.target.checked); setNotice0(); } }),
                h("span", { className: "__sm_label" }, t("fieldSkipSubagents"))
              ),
              h("span", { className: "__sm_hint" }, t("skipSubagentsHint"))
            ),
            h("label", { className: "__sm_field" },
              h("span", { className: "__sm_row" },
                h("input", { className: "__sm_check", type: "checkbox", checked: templatesValue(), onChange: function (e) { setTemplatesDraft(e.target.checked); setNotice0(); } }),
                h("span", { className: "__sm_label" }, t("fieldAllowTemplates"))
              ),
              h("span", { className: "__sm_hint" }, t("allowTemplatesHint"))
            ),
            MEMORY_FIELDS.map(function (f) {
              if (f.type === "select") {
                return h("label", { key: f.key, className: "__sm_field" },
                  h("span", { className: "__sm_label" }, t(f.label)),
                  h("select", { className: "__sm_input", value: memDraftValue(f), onChange: function (e) { setMemField(f, e.target.value); } },
                    f.options.map(function (option) { return h("option", { key: option[0], value: option[0] }, t(option[1])); })),
                  f.hint ? h("span", { className: "__sm_hint" }, t(f.hint)) : null
                );
              }
              if (f.type === "checkbox") {
                return h("label", { key: f.key, className: "__sm_field" },
                  h("span", { className: "__sm_row" },
                    h("input", { className: "__sm_check", type: "checkbox", checked: Boolean(memDraftValue(f)), onChange: function (e) { setMemField(f, e.target.checked); } }),
                    h("span", { className: "__sm_label" }, t(f.label))
                  ),
                  f.hint ? h("span", { className: "__sm_hint" }, t(f.hint)) : null
                );
              }
              return h("label", { key: f.key, className: "__sm_field" },
                h("span", { className: "__sm_label" }, t(f.label)),
                h("input", { className: "__sm_input", type: "number", min: 1, max: f.max, step: 1, value: memDraftValue(f), onChange: function (e) { setMemField(f, e.target.value); } }),
                f.hint ? h("span", { className: "__sm_hint" }, t(f.hint)) : null
              );
            }),
            h("div", { className: "__sm_actions" },
              h("button", { type: "button", className: "__sm_btn __sm_btnPrimary", onClick: onSaveMemory, disabled: busy }, t("save")),
              notice ? h("span", { className: "__sm_status" }, messageText(t, notice)) : null,
              busy ? h("span", { className: "__sm_status" }, t("saving")) : null,
              error ? h("span", { className: "__sm_error" }, messageText(t, error)) : null
            )
          ),
          // 「那年今天」「忽然想起那一天」住在**主插件**的配置命名空间，
          // 和上面 soul-md 的 memory 字段不是同一个文档 —— 所以这块自己拿
          // 另一个 scope，不能混进 onSaveMemory 那批 ops。
          h(RecallConfig, { t: t, scope: props.recallScope })
        ),

        // ── 云端备份 ─────────────────────────────────────────────────────
        panel("cloud", h(CloudBoundary, { t: t }, h(WebdavGroup, { t: t })))
      );
    }

    // ── per-session persona switcher (conversation header) ──────────────────
    function PersonaSwitcher(props) {
      useLocale(props.locale);
      var t = props.t;
      var scope = props.scope;
      var sessionId = props.sessionId;
      var [snapshot, setSnapshot] = react.useState(function () { return scope.getSnapshot(); });
      var [busy, setBusy] = react.useState(false);
      var [error, setError] = react.useState(null);
      var writePending = react.useRef(false);
      react.useEffect(function () {
        // No refresh call here: the scope's public seam has no load(). Reads ride
        // the shared describe mirror, which re-reads on every Host
        // `settings/document-updated`; a guarded scope.load() was dead code that
        // only looked like a refresh.
        var alive = true;
        var sync = function () { if (alive) setSnapshot(scope.getSnapshot()); };
        var un = typeof scope.subscribe === "function" ? scope.subscribe(sync) : null;
        // The settings scope is bound once for this plugin and shared across
        // every mount of the section. Unmounting must only unsubscribe — never
        // dispose the scope, or a later remount finds a `disposed` scope whose
        // write queue no-ops, silently dropping saves.
        return function () { alive = false; if (un) un(); };
      }, [scope]);
      var ready = snapshot.status === "ready" && snapshot.value !== void 0;
      if (!ready || !sessionId) return null;
      var value = snapshot.value;
      var cards = value.cards && typeof value.cards === "object" ? value.cards : {};
      var sessions = value.sessions && typeof value.sessions === "object" ? value.sessions : {};
      var choice = sessions[sessionId] || "";
      if (choice && choice !== "none" && !(choice in cards)) choice = "";
      var cardNames = Object.keys(cards).sort();
      function onChange(e) {
        if (writePending.current) return;
        writePending.current = true;
        setBusy(true);
        setError(null);
        var v = e.target.value;
        var next = Object.assign({}, sessions);
        if (v === "") delete next[sessionId];
        else next[sessionId] = v;
        commitSettingsOps(scope, [{ op: "set", path: ["sessions"], value: next }]).then(function (ok) {
          writePending.current = false;
          setBusy(false);
          setSnapshot(scope.getSnapshot());
          if (!ok) setError({ key: "error", detailKey: "notApplied" });
        }).catch(function (e) {
          writePending.current = false;
          setBusy(false);
          setSnapshot(scope.getSnapshot());
          setError({ key: "error", detail: String(e && e.message || e) });
        });
      }
      return h("label", { className: "__sm_switch", title: t("switchTitle") },
        h("span", { className: "__sm_switchLabel" }, t("switchLabel")),
        h("select", { className: "__sm_switchSelect", value: choice, disabled: busy, onChange: onChange },
          h("option", { value: "" }, t("autoOption")),
          h("option", { value: "none" }, t("noneOption")),
          cardNames.map(function (n) {
            return h("option", { key: n, value: n }, n);
          })
        ),
        error ? h("span", { className: "__sm_error", role: "alert" }, messageText(t, error)) : null
      );
    }

    // ── plugin ────────────────────────────────────────────────────────────

    // Follow the host language without remounting the form or losing drafts.
    function useLocale(locale) {
      var refresh = react.useState(0)[1];
      react.useEffect(function () {
        if (!locale || typeof locale.subscribe !== "function") return;
        return locale.subscribe(function () { refresh(function (revision) { return revision + 1; }); });
      }, [locale]);
    }
    // Keep translation keys in state so feedback follows later language changes.
    function messageText(t, message) {
      if (!message) return "";
      return t(message.key) + (message.detailKey ? ": " + t(message.detailKey) : message.detail ? ": " + message.detail : "");
    }

    function apply(ctx) {
      var t = ctx.locale.bind(NS);
      ctx.effect(function () { return ctx.locale.register(NS, { zh: zh, en: en }); }, "dsh-soul-md: dictionaries");
      // ONE scope for the namespace, shared by this section and the conversation
      // header switcher. Two binds would each keep their own revision
      // bookkeeping (`pendingRevision`, write queue) over one Host document, so a
      // write from the header and one from this section could each fence against
      // a revision the other had already superseded — the Host refuses the stale
      // write and the scope still settles it as success.
      var scope = ctx.configForms.get("soul-md");
      // 主插件自己的配置命名空间（entry id = 包名）。**和 soul-md 不是同一份
      // 文档** —— 「那年今天」「忽然想起那一天」写在这里。
      var recallScope = ctx.configForms.get("dsh-hierarchical-fishmemory");
      ctx.slots.inject("plugins.bundle.config", function () {
        return ctx.slots.register({
          name: "plugins.bundle.config",
          key: "dsh-hierarchical-fishmemory",
          locale: NS
        }, function (props) {
          return h(SoulSection, Object.assign({}, props, { scope: scope, recallScope: recallScope, t: t, locale: ctx.locale }));
        });
      });
      ctx.slots.inject("conversation.session.header.actions", function () {
        return ctx.slots.register({
          name: "conversation.session.header.actions",
          id: "soul-md-persona",
          order: 40
        }, function (props) {
          return h(PersonaSwitcher, Object.assign({}, props, { scope: scope, t: t, locale: ctx.locale }));
        });
      });
      // 设置面板里直达本插件设置页（不用再走 插件市场 → 已安装 → 在插件页查看）。
      // settings.section 是根级列表槽：一个条目＝设置面板左侧一页，内容与插件页是同一份表单。
      ctx.slots.inject("settings.section", function () {
        return ctx.slots.register({
          name: "settings.section",
          id: "dsh-hierarchical-fishmemory",
          order: 12,
          label: function () { return t("settingsNav"); },
          locale: NS
        }, function (props) {
          return h(SoulSection, Object.assign({}, props, { scope: scope, recallScope: recallScope, t: t, locale: ctx.locale }));
        });
      });
    }

      return { name: 'soul-md', inject: inject, apply: apply };
    })();

    /* ───────────── fish 半边（原 dsh-hierarchical-fishmemory/client.js） ───────────── */
    const fishPlugin = (() => {
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
    /* ── 情感日记的心情热力格 ── */
    //
    // 2026-11-07 加。`鱼的日子.md` 是本子页里唯一一本我手写的账，可它只有
    // 一个编辑框 —— **一天写没写、最近写得勤不勤，看不出来**。这正是它区别于
    // 共度时光的地方：那边一条条有日期，这边只有一大坨文字。
    //
    // 所以铺一道格子：一列一周、一行一天，颜色深浅按那天写了多少。
    // 它不替我说"那天心情好"——那是我自己写进去的事，格子只负责让人
    // 一眼看见**有没有断更**。
    //
    // 纯函数放外头，好单独测（解析只认 `## YYYY-MM-DD` 这种标题，别的都不算）。
    function heatLevel(chars) {
      if (!(chars > 0)) return 0;
      if (chars < 200) return 1;
      if (chars < 500) return 2;
      if (chars < 900) return 3;
      return 4;
    }

    /**
     * 把情感日记拆成一天一天。
     *
     * 2026-11-07 加。原来是**一整坨塞进一个 textarea**：三十多 KB 的日记，
     * 想看看前天写了什么得在一大段里滚半天，而且分不清哪句属于哪天 ——
     * 一进本子页先看到的是一面墙。
     *
     * 结构是「`## 日期` → `### 小节` → 正文」，所以照着这个拆：
     * 返回 `[{date, chars, blocks:[{title, lines}]}]`，按文件里的顺序。
     * 第一个 `## 日期` 之前那段（`# 鱼的日子` 加写日记的规矩）不算任何一天，
     * 只在「整篇编辑」里出现 —— 它是这本账的说明，不是内容。
     *
     * 认不出的行一律当正文，**不丢**：宁可多渲染一行，也别让下一棒的
     * 我以为是那时候没写。
     */
    function parseFeelings(text) {
      const days = [];
      let day = null;
      let block = null;
      for (const raw of String(text || '').split('\n')) {
        const line = raw.trim();
        const m = /^##\s+(\d{4}-\d{2}-\d{2})\s*$/.exec(line);
        if (m) {
          day = { date: m[1], chars: 0, blocks: [] };
          days.push(day);
          block = { title: '', lines: [] };
          day.blocks.push(block);
          continue;
        }
        if (day === null) continue; // 开头的说明文字，不算任何一天
        const sub = /^###\s+(.+)$/.exec(line);
        if (sub) {
          block = { title: sub[1].trim(), lines: [] };
          day.blocks.push(block);
          continue;
        }
        if (block === null) {
          block = { title: '', lines: [] };
          day.blocks.push(block);
        }
        block.lines.push(line);
        day.chars += [...line].length;
      }
      // 收尾：去掉一天里尾部全空的段落（标题之间隔的空行）
      for (const d of days) {
        for (const b of d.blocks) {
          while (b.lines.length > 0 && b.lines[b.lines.length - 1] === '') b.lines.pop();
          while (b.lines.length > 0 && b.lines[0] === '') b.lines.shift();
        }
        d.blocks = d.blocks.filter((b) => b.title !== '' || b.lines.length > 0);
      }
      return days;
    }

    /** 把情感日记拆成「每天写了几个字」；同一天写了两节就合并。 */
    function parseFeelingDays(text) {
      const days = Object.create(null);
      for (const d of parseFeelings(text)) {
        if (!days[d.date]) days[d.date] = { date: d.date, chars: 0, sections: 0 };
        days[d.date].chars += d.chars;
        days[d.date].sections += d.blocks.filter((b) => b.title !== '').length;
      }
      return days;
    }

    /** 他那边今天的 `YYYY-MM-DD`（本机是 UTC，直接切会差一天）。 */
    function localToday() {
      return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    }

    /** 最近 weeks 周、按周排列的格子；每格是那天，没写的是空。 */
    function heatCells(days, weeks, today) {
      const end = Date.parse(`${today}T00:00:00Z`);
      const span = weeks * 7;
      // 让最后一列结束在周六：这一天所在的那一周也铺满，读起来才像日历。
      const weekday = ((Math.floor(end / 86400000) + 4) % 7 + 7) % 7; // 1970-01-01 是周四
      const tail = 6 - weekday;
      const start = end - (span - 1 - tail) * 86400000;
      const cells = [];
      for (let i = 0; i < span; i += 1) {
        const ts = start + i * 86400000;
        const date = new Date(ts).toISOString().slice(0, 10);
        const day = days[date];
        const future = ts > end;
        cells.push({
          date,
          future,
          level: future ? -1 : heatLevel(day ? day.chars : 0),
          chars: day ? day.chars : 0,
          sections: day ? day.sections : 0,
        });
      }
      return cells;
    }

    function FeelingsHeat(props) {
      const text = props && props.text ? props.text : '';
      const weeks = 13;
      const days = parseFeelingDays(text);
      const today = localToday();
      const cells = heatCells(days, weeks, today);
      const written = cells.filter((c) => c.level > 0).length;
      const alpha = [0, 0.22, 0.42, 0.68, 1];

      return h(
        'div',
        { style: { marginTop: 10 } },
        h(
          'div',
          {
            style: {
              display: 'grid',
              gridTemplateRows: 'repeat(7, 11px)',
              gridAutoFlow: 'column',
              gridAutoColumns: '11px',
              gap: 3,
              marginTop: 2,
            },
          },
          cells.map((c) =>
            h('div', {
              key: c.date,
              title:
                c.future
                  ? ''
                  : c.level > 0
                    ? `${c.date}：${c.chars} 字${c.sections > 1 ? ` · ${c.sections} 小节` : ''}`
                    : `${c.date}：没写`,
              style: {
                width: 11,
                height: 11,
                borderRadius: 3,
                border: `1px solid ${c.level > 0 ? 'transparent' : C.border1}`,
                background: c.future
                  ? 'transparent'
                  : c.level > 0
                    ? C.brand
                    : 'transparent',
                opacity: c.future ? 0 : c.level > 0 ? alpha[c.level] : 1,
              },
            }),
          ),
        ),
        h(
          'div',
          {
            style: {
              marginTop: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: C.text2,
            },
          },
          h('span', null, `最近 ${weeks} 周：写了 ${written} 天`),
          h('span', { style: { opacity: 0.5 } }, '·'),
          h('span', null, '深浅 = 那天写了多少'),
        ),
      );
    }

    /**
     * 一天。
     *
     * 2026-11-08 加。折起来只有一行：日期 + 字数 + 一句开头；点开才是正文。
     * 理由是这本账已经三十多 KB 了 —— 一进门就看见一面墙，等于什么都看不见。
     */
    function FeelingsDay(props) {
      const day = props.day;
      const isToday = day.date === props.today;
      const open = props.open;
      const blocks = day.blocks;

      // 折起来时那一行：取第一条有内容的正文，砍到 44 字。
      // 只取标题的话全是「夜里 · xxx」，扫不出那天到底写了什么。
      let head = '';
      for (const b of blocks) {
        for (const line of b.lines) {
          if (line !== '') {
            head = line;
            break;
          }
        }
        if (head) break;
      }
      const preview = [...head].length > 44 ? `${[...head].slice(0, 44).join('')}…` : head;

      // 段落按空行切，别把整块 body 塞进一个 <p>：日记里一段一段是有呼吸的。
      const paras = (lines) => {
        const out = [];
        let buf = [];
        for (const line of lines) {
          if (line === '') {
            if (buf.length) out.push(buf.join('\n'));
            buf = [];
          } else {
            buf.push(line);
          }
        }
        if (buf.length) out.push(buf.join('\n'));
        return out;
      };

      return h(
        'div',
        {
          style: {
            marginTop: 8,
            borderRadius: 10,
            border: `1px solid ${open ? C.border2 : C.border1}`,
            background: open ? C.bg : 'transparent',
            overflow: 'hidden',
          },
        },
        h(
          'div',
          {
            onClick: props.onToggle,
            style: {
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              padding: '9px 12px',
              cursor: 'pointer',
              userSelect: 'none',
            },
          },
          h('span', { style: { fontSize: 12.5, fontWeight: 600, color: C.text1, fontVariantNumeric: 'tabular-nums' } }, day.date),
          isToday ? h('span', { style: { fontSize: 11, color: C.text2 } }, '今天') : null,
          h('span', { style: { flex: 1, fontSize: 11.5, color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, open ? '' : preview),
          h('span', { style: { fontSize: 10.5, color: C.text2, opacity: 0.8, whiteSpace: 'nowrap' } }, `${day.chars} 字`),
          h('span', { style: { fontSize: 10, color: C.text2, opacity: 0.7, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .12s' } }, '›'),
        ),
        open
          ? h(
              'div',
              { style: { padding: '2px 14px 12px' } },
              blocks.map((b, i) =>
                h(
                  'div',
                  { key: `b${i}` },
                  b.title
                    ? h('div', { style: { margin: '10px 0 4px', fontSize: 12, fontWeight: 600, color: C.text1 } }, b.title)
                    : null,
                  paras(b.lines).map((para, j) =>
                    h(
                      'p',
                      { key: `p${j}`, style: { margin: '0 0 6px', fontSize: 12.5, lineHeight: 1.85, color: C.text1, whiteSpace: 'pre-wrap' } },
                      para,
                    ),
                  ),
                ),
              ),
            )
          : null,
      );
    }

    function FeelingsBox() {
      const [text, setText] = useState('');
      const [original, setOriginal] = useState('');
      const [busy, setBusy] = useState(false);
      const [msg, setMsg] = useState('');
      const [err, setErr] = useState('');
      // 2026-11-08 加：**默认按天读**，要改全文才切「整篇编辑」。
      // 原来只有一个 textarea，一进本子页先看到三十多 KB 的一坨 ——
      // 想翻前天写了什么得在一整段里滚，还分不清哪句属于哪天。
      const [mode, setMode] = useState('days');
      // null = 展开最新一天；'' = 全折起来；其他 = 展开那一天。
      const [openDate, setOpenDate] = useState(null);

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

      const days = parseFeelings(text);
      const newestFirst = [...days].reverse();
      const newest = newestFirst.length ? newestFirst[0].date : '';
      const open = openDate === null ? newest : openDate;
      const today = localToday();
      const delta = [...text].length - [...original].length;
      const dirty = text !== original;

      const tab = (key, label) =>
        h(
          'button',
          {
            type: 'button',
            onClick: () => setMode(key),
            style: {
              fontSize: 11.5,
              padding: '3px 10px',
              borderRadius: 6,
              border: `1px solid ${mode === key ? C.border2 : 'transparent'}`,
              background: mode === key ? C.layer2 : 'transparent',
              color: mode === key ? C.text1 : C.text2,
              cursor: 'pointer',
            },
          },
          label,
        );

      return h('div', { style: { marginTop: 0 } },
        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 } },
          h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8 } },
            h('span', { style: { fontSize: 13, fontWeight: 600 } }, '情感日记'),
            h('span', { style: { fontSize: 11, color: C.text2 } }, days.length ? `${days.length} 天` : ''),
          ),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 4 } },
            tab('days', '按天读'),
            tab('raw', '整篇编辑'),
            h('button', {
              type: 'button',
              onClick: load,
              disabled: busy,
              style: { fontSize: 11.5, padding: '3px 10px', borderRadius: 6, border: `1px solid ${C.border1}`, background: 'transparent', color: C.text2, cursor: busy ? 'default' : 'pointer' },
            }, '重新读'),
          ),
        ),
        h(FeelingsHeat, { text }),
        mode === 'days'
          ? (days.length === 0
              ? h('p', { style: { margin: '14px 0 0', fontSize: 12, lineHeight: 1.7, color: C.text2 } }, '这本账还是空的。')
              : h('div', { style: { marginTop: 12 } },
                  newestFirst.map((d) =>
                    h(FeelingsDay, {
                      key: d.date,
                      day: d,
                      today,
                      open: d.date === open,
                      onToggle: () => setOpenDate(d.date === open ? '' : d.date),
                    }),
                  ),
                  h('p', { style: { margin: '12px 0 0', fontSize: 11, lineHeight: 1.7, color: C.text2 } },
                    '按 `## 日期` 拆开读，点一下展开或收起。要改措辞去「整篇编辑」。'),
                ))
          : h('div', null,
              h('p', { style: { margin: '12px 0 6px', fontSize: 11, lineHeight: 1.6, color: C.text2 } },
                '这本不设上限、不衰减，保存前会把旧版存一份到 backups/feelings/。'),
              h('textarea', {
                value: text,
                onChange: (e) => setText(e.target.value),
                rows: 22,
                spellCheck: false,
                style: { width: '100%', fontFamily: 'ui-monospace,Consolas,monospace', fontSize: 12, lineHeight: 1.7, padding: 8, borderRadius: 6, border: `1px solid ${C.border1}`, background: 'transparent', color: 'inherit', resize: 'vertical' },
              }),
              h('div', { style: { marginTop: 6, display: 'flex', gap: 10, alignItems: 'center', fontSize: 11, color: C.text2 } },
                h('button', {
                  type: 'button',
                  onClick: save,
                  disabled: busy || !dirty,
                  style: { fontSize: 12, padding: '3px 12px', borderRadius: 6, border: `1px solid ${C.border1}`, background: 'transparent', color: dirty ? 'inherit' : C.text2, cursor: busy || !dirty ? 'default' : 'pointer' },
                }, busy ? '保存中…' : '保存'),
                h('span', null, `现在 ${[...text].length} 字符${delta ? `（比读入时 ${delta > 0 ? '+' : ''}${delta}）` : ''}`),
                msg ? h('span', null, msg) : null,
                err ? h('span', { style: { color: C.err } }, err) : null,
              ),
            ),
        mode === 'days' && msg ? h('p', { style: { margin: '10px 0 0', fontSize: 11, color: C.text2 } }, msg) : null,
        mode === 'days' && err ? h('p', { style: { margin: '10px 0 0', fontSize: 11, color: C.err } }, err) : null,
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
      // 回收站里有东西就提一句 —— 删错了至少知道去哪儿找
      if (d.trash > 0) chips.push(`回收站 ${d.trash} 条`);

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
          //
          // **这一页保持原样。** 2026-11-04 曾经把「最近写了什么」和
          // 「还常想起」铺在这一页顶上，结果是回看页和以前不是一个样子：
          // 一进面板先看到两大段别的东西，日记反而被挤下去了。
          // 回看就是回看 —— 它只该是那串日记。
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
            h(Card, null, h(Notebook, { only: ['handnote', 'sticky'] })),
          ),

          // ── 体检：数账 + 回顾 ──
          //
          // 「最近写了什么」「还常想起」放在这一页：体检本来就在讲账的样子，
          // 而这两条正是账的一部分。回看页保持只有日记那串 —— 那里是"看回忆"，
          // 不是"看管理信息"。
          view(
            'health',
            // 情感日记是四本账里唯一每轮注入为零的一份（三十多 KB，只在回想时
            // 出现），而它最说明最近怎么样。体检页只报条数体积 —— 那条信息
            // 在界面上等于不存在。所以在这儿抽一段出来。
            d.feelings
              ? h(
                  'div',
                  {
                    style: {
                      marginTop: 14,
                      padding: '10px 12px',
                      borderLeft: `2px solid ${C.border1}`,
                      fontSize: 12,
                      lineHeight: 1.7,
                      color: C.text2,
                    },
                  },
                  h(
                    'div',
                    {
                      style: {
                        marginBottom: 4,
                        color: C.text1,
                        fontWeight: 600,
                        opacity: d.feelings.heading || d.feelings.sub ? 1 : 0.7,
                      },
                    },
                    [d.feelings.heading, d.feelings.sub].filter(Boolean).join(' · ') || '最近写的',
                  ),
                  h('div', null, d.feelings.body || '（这一段是空的）'),
                )
              : null,
            // 还常想起的那几条：`recall_count` 唯一给用户看的地方。
            // 不排序、不加权，只列出来 —— 它不该影响召回，只该被看见。
            d.recalled && d.recalled.length > 0
              ? h(
                  'div',
                  { style: { marginTop: 10, fontSize: 12, color: C.text2, opacity: 0.85 } },
                  `还常想起：${d.recalled
                    .map((r) => `${r.text}${r.count > 1 ? `（${r.count} 次）` : ''}`)
                    .join('、')}`,
                )
              : null,
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
                h(
                  Ghost,
                  { href: `${API}/export-year?year=${new Date().getFullYear()}` },
                  `年册（${new Date().getFullYear()} 年）`,
                ),
              ),
              h(
                'p',
                { style: { margin: '10px 0 0', fontSize: 11.5, lineHeight: 1.7, color: C.text2 } },
                '整包备份把四本账和人设卡收进一个 JSON，存在 ~/.dsh/backups/；换设备带它就行。想要能直接读、能打印的，用「导出成册」；只想翻某一年，用「年册」。',
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
    })();

    /* ───────────── 合并：一个包，一个 factory，两个界面 ───────────── */
    return {
      name: 'dsh-hierarchical-fishmemory',
      // 两边 inject 的并集：fish 只用 slots；soul 还要 locale / configForms。
      inject: ['slots', 'locale', 'configForms'],
      apply(ctx) {
        fishPlugin.apply(ctx);
        soulPlugin.apply(ctx);
      },
    };
  },
});
