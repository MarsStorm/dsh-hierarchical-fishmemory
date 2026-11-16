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
.dsh-flat.__sm_root .__sm_fieldGroup{display:flex;flex-direction:column;gap:6px;border-top:1px solid var(--dsw-alias-separator-primary);padding-top:8px}
.dsh-flat.__sm_root .__sm_fieldGroup:first-of-type{border-top:0;padding-top:0}
.dsh-flat.__sm_root .__sm_groupHead{display:flex;align-items:baseline;gap:6px;cursor:pointer;user-select:none;outline:none}
.dsh-flat.__sm_root .__sm_groupHead:hover .__sm_label{color:var(--dsw-alias-label-primary)}
.dsh-flat.__sm_root .__sm_groupHead:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px;border-radius:4px}
.dsh-flat.__sm_root .__sm_caret{font-size:11px;opacity:.7;width:12px;flex-shrink:0}
.dsh-flat.__sm_root .__sm_fieldBody{display:flex;flex-direction:column;gap:6px;padding-left:18px}
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
      fieldVoiceEnabled: "「今天我自己写的」",
      voiceEnabledHint: "把今天《鱼的日子》最后一段放进注入（几十个字），说话的时候带着今天的调子，而不是每次从零开始。",
      flashbackHint: "每天从情感日记里随机翻一天，像突然想起一段回忆那样提出来。",
      fieldFragmentsEnabled: "「零碎记忆」整段（小纸条 + 教训 + 没说完）",
      fragmentsEnabledHint: "三段小东西合成一段注入：他说的原话、我重复踩的坑、当时没接住的半句话。关掉就是三段一起不注入，记录照旧。",
      fieldFragmentsMaxChars: "「零碎记忆」整段最多多少字",
      fragmentsMaxCharsHint: "三段共用这一个数。教训和「没说完」先占位，小纸条拿剩下的 —— 它们要是被挤掉就白搭。",
      groupEachTurn: "每轮都会注入的",
      groupEachTurnHint: "这几项决定每轮开头你眼前有没有东西",
      groupPace: "什么时候开口",
      groupPaceHint: "闷太久、事情放陈了，这些是阈值",
      groupBudget: "占多少地方",
      groupBudgetHint: "注入是有成本的，觉得挤就往小调",
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
      fieldVoiceEnabled: "\"What I wrote today\"",
      voiceEnabledHint: "Put the last entry of today's feelings diary into the prompt (a few dozen characters), so I speak with today's tone instead of starting from zero.",
      flashbackHint: "Every day, pick one day from the feelings diary and mention it like an old memory surfacing.",
      fieldFragmentsEnabled: "\"Fragments\" block (notes + lessons + unfinished)",
      fragmentsEnabledHint: "Three small things injected as one block: his own words, the mistakes I keep repeating, and half-sentences I never caught. Turning it off stops the injection; the records stay.",
      fieldFragmentsMaxChars: "Fragment block size limit (characters)",
      fragmentsMaxCharsHint: "One budget for all three. Lessons and unfinished lines take their room first; sticky notes get what's left.",
      groupEachTurn: "Injected every turn",
      groupEachTurnHint: "Whether anything reaches me at the start of each turn",
      groupPace: "When to speak up",
      groupPaceHint: "Thresholds for silence and stale items",
      groupBudget: "How much room",
      groupBudgetHint: "Injection costs tokens; lower this if it feels crowded",
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
    // 设置页上的字段（1.23.0 重排）。
    //
    // 原来这里是十个平铺的开关 —— 小纸条三个、教训一个、没说完两个、
    // 那年今天两个、节奏两个，看起来像一堆零件。现在三段零碎合成一段
    // （`fragmentsEnabled` + `fragmentsMaxChars`），旧的三个开关不再摆出来，
    // 但**照样生效**：他设过的值不该因为我换了个抽屉就失效。
    var RECALL_FIELDS = [
      { key: "fragmentsEnabled", type: "checkbox", def: 1, label: "fieldFragmentsEnabled", hint: "fragmentsEnabledHint" },
      { key: "onThisDay", type: "number", min: 0, max: 4, def: 2, label: "fieldOnThisDay", hint: "onThisDayHint" },
      { key: "flashback", type: "checkbox", def: 1, label: "fieldFlashback", hint: "flashbackHint" },
      { key: "voiceEnabled", type: "checkbox", def: 1, label: "fieldVoiceEnabled", hint: "voiceEnabledHint" },
      { key: "silenceNudge", type: "number", min: 0, max: 20, def: 3, label: "fieldSilenceNudge", hint: "silenceNudgeHint" },
      { key: "staleLoopDays", type: "number", min: 0, max: 30, def: 3, label: "fieldStaleLoopDays", hint: "staleLoopDaysHint" },
      { key: "fragmentsMaxChars", type: "number", min: 200, max: 4000, def: 1400, label: "fieldFragmentsMaxChars", hint: "fragmentsMaxCharsHint" }
    ];

    // 分三组：常用的默认展开，另外两组折起来。字段本身一个没少，
    // 变的是「一眼能看到几个」。
    var RECALL_GROUPS = [
      { key: "each", label: "groupEachTurn", hint: "groupEachTurnHint", open: true, keys: ["fragmentsEnabled", "onThisDay", "flashback", "voiceEnabled"] },
      { key: "pace", label: "groupPace", hint: "groupPaceHint", open: false, keys: ["silenceNudge", "staleLoopDays"] },
      { key: "budget", label: "groupBudget", hint: "groupBudgetHint", open: false, keys: ["fragmentsMaxChars"] }
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
      // 哪几组是展开的。默认只展开第一组 —— 其余的折起来，想改再点。
      var [openGroups, setOpenGroups] = react.useState(function () {
        var init = {};
        RECALL_GROUPS.forEach(function (g) { init[g.key] = Boolean(g.open); });
        return init;
      });
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
        RECALL_GROUPS.map(function (g) {
          var isOpen = Boolean(openGroups[g.key]);
          return h("div", { key: g.key, className: "__sm_fieldGroup" },
            h("div", {
              className: "__sm_groupHead",
              role: "button",
              tabIndex: 0,
              "aria-expanded": isOpen ? "true" : "false",
              onClick: function () {
                setOpenGroups(function (prev) {
                  var next = Object.assign({}, prev);
                  next[g.key] = !prev[g.key];
                  return next;
                });
              },
              onKeyDown: function (e) {
                if (e && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault && e.preventDefault();
                  setOpenGroups(function (prev) {
                    var next = Object.assign({}, prev);
                    next[g.key] = !prev[g.key];
                    return next;
                  });
                }
              }
            },
              h("span", { className: "__sm_caret" }, isOpen ? "▾" : "▸"),
              h("span", { className: "__sm_label" }, t(g.label)),
              h("span", { className: "__sm_hint" }, t(g.hint))
            ),
            isOpen
              ? h("div", { className: "__sm_fieldBody" },
                  RECALL_FIELDS.filter(function (f) { return g.keys.indexOf(f.key) !== -1; }).map(function (f) {
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
                  })
                )
              : null
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

    /* ───────────────────────── 样式 ───────────────────────── */
    //
    // 一份，一次，挂到 head 上。全部颜色走 token：
    // `--dsw-alias-*` 的 requiresLightAndDark 都是 true，写死颜色就会翻车。
    // 每个 token 都带了一个兜底值 —— 宿主换 token 名字时最多是"配色朴素了"，
    // 不会变成白底白字。
    //
    // `color-mix()` 那几行是加分的：不支持它的 WebView 会把整条声明丢掉，
    // 落在它前面那条普通声明上。**顺序不能反**。
    const CSS = `
.feiyu-root{
  --fs-bg:var(--dsw-alias-bg-base,#fff);
  --fs-l1:var(--dsw-alias-bg-layer-1,#fafafa);
  --fs-l2:var(--dsw-alias-bg-layer-2,#f2f3f5);
  --fs-l3:var(--dsw-alias-bg-layer-3,#e9eaec);
  --fs-soft:var(--dsw-alias-bg-layer-2,#f2f3f5);
  --fs-line:var(--dsw-alias-border-l1,rgba(0,0,0,.09));
  --fs-line2:var(--dsw-alias-border-l2,rgba(0,0,0,.18));
  --fs-t1:var(--dsw-alias-label-primary,#14161a);
  --fs-t2:var(--dsw-alias-label-secondary,#5c6370);
  --fs-t3:var(--dsw-alias-label-tertiary,#8b929e);
  --fs-brand:var(--dsw-alias-brand-primary,#4d6bfe);
  --fs-err:var(--dsw-alias-state-error-primary,#e5484d);
  --fs-radius:15px;
  --fs-ease:cubic-bezier(.22,.61,.36,1);
  height:100%;overflow-y:auto;overflow-x:hidden;
  background:var(--fs-bg);color:var(--fs-t1);
  font-feature-settings:"tnum" 1;
  -webkit-font-smoothing:antialiased;
}
.feiyu-root *{box-sizing:border-box}
.feiyu-root .fs-shell{max-width:768px;margin:0 auto;padding:0 22px 80px}

/* ── 头部 ── */
.feiyu-root .fs-hero{position:relative;padding:34px 0 6px}
.feiyu-root .fs-hero:before{content:"";position:absolute;left:-30px;right:-30px;top:-70px;height:230px;
  background:linear-gradient(180deg,var(--fs-l2),transparent);opacity:.6;pointer-events:none;
  -webkit-mask-image:radial-gradient(70% 100% at 22% 0%,#000,transparent 72%);
  mask-image:radial-gradient(70% 100% at 22% 0%,#000,transparent 72%)}
.feiyu-root .fs-brand{position:relative;display:flex;align-items:center;gap:14px}
.feiyu-root .fs-orb{flex:none;width:46px;height:46px;border-radius:15px;display:grid;place-items:center;
  color:#fff;background:linear-gradient(150deg,var(--fs-brand),var(--fs-brand));
  box-shadow:0 10px 24px -12px var(--fs-brand)}
.feiyu-root .fs-orb svg{opacity:.96}
.feiyu-root .fs-brandText{min-width:0}
.feiyu-root .fs-title{margin:0;font-size:20px;line-height:1.25;font-weight:650;letter-spacing:-.02em}
.feiyu-root .fs-sub{margin:4px 0 0;font-size:12.5px;line-height:1.6;color:var(--fs-t2)}

/* ── 数 ── */
.feiyu-root .fs-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:9px;margin-top:18px}
.feiyu-root .fs-metric{padding:11px 13px;border-radius:13px;border:1px solid var(--fs-line);
  background:linear-gradient(180deg,var(--fs-l1),var(--fs-bg))}
.feiyu-root .fs-metric b{display:block;font-size:19px;line-height:1.25;font-weight:650;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.feiyu-root .fs-metric span{display:block;margin-top:2px;font-size:11.5px;color:var(--fs-t2)}

/* ── 小标签 ── */
.feiyu-root .fs-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.feiyu-root .fs-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:999px;
  border:1px solid var(--fs-line);background:var(--fs-l1);font-size:11.5px;line-height:1.7;color:var(--fs-t2);white-space:nowrap}
.feiyu-root .fs-chip--warn{color:var(--fs-err);border-color:var(--fs-err);background:transparent}

/* ── 页签：吸顶、药丸、模糊底 ── */
.feiyu-root .fs-tabs{position:sticky;top:0;z-index:6;display:flex;gap:4px;
  margin:22px -22px 0;padding:10px 22px;
  background:var(--fs-bg);border-bottom:1px solid var(--fs-line);
  -webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}
.feiyu-root .fs-tab{appearance:none;border:0;background:none;font:inherit;font-size:13px;line-height:1;
  color:var(--fs-t2);padding:9px 15px;border-radius:999px;cursor:pointer;
  transition:background .18s var(--fs-ease),color .18s var(--fs-ease)}
.feiyu-root .fs-tab:hover{color:var(--fs-t1);background:var(--fs-l2)}
.feiyu-root .fs-tab[aria-selected="true"]{color:var(--fs-t1);font-weight:600;background:var(--fs-l2);
  box-shadow:inset 0 0 0 1px var(--fs-line)}

/* ── 卡片 ── */
.feiyu-root .fs-card{margin-top:14px;padding:16px 18px;border-radius:var(--fs-radius);
  border:1px solid var(--fs-line);background:var(--fs-l1)}
.feiyu-root .fs-card--plain{background:transparent}
.feiyu-root .fs-cardHead{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.feiyu-root .fs-cardTitle{font-size:13.5px;font-weight:650;letter-spacing:-.005em;color:var(--fs-t1)}
.feiyu-root .fs-cardHint{margin:0 0 12px;font-size:11.5px;line-height:1.75;color:var(--fs-t2)}
.feiyu-root .fs-grow{flex:1}

/* ── 一天一段的日记 ── */
.feiyu-root .fs-day{display:flex;align-items:center;gap:9px;margin-top:26px}
.feiyu-root .fs-dayName{font-size:12.5px;font-weight:650;letter-spacing:.01em;color:var(--fs-t1)}
.feiyu-root .fs-dayCount{font-size:11px;color:var(--fs-t3);font-variant-numeric:tabular-nums}
.feiyu-root .fs-day:after{content:"";flex:1;height:1px;
  background:linear-gradient(90deg,var(--fs-line),transparent)}
.feiyu-root .fs-rail{position:relative;margin-top:10px;padding-left:18px}
.feiyu-root .fs-rail:before{content:"";position:absolute;left:3px;top:8px;bottom:8px;width:1px;
  background:linear-gradient(180deg,var(--fs-line),var(--fs-line),transparent)}
.feiyu-root .fs-entry{position:relative;margin-bottom:8px;padding:12px 14px 10px;border-radius:12px;
  border:1px solid var(--fs-line);background:var(--fs-bg);
  transition:border-color .18s var(--fs-ease),box-shadow .18s var(--fs-ease),transform .18s var(--fs-ease)}
.feiyu-root .fs-entry:hover{border-color:var(--fs-line2);transform:translateY(-1px);
  box-shadow:0 12px 26px -22px rgba(0,0,0,.55)}
.feiyu-root .fs-entry:before{content:"";position:absolute;left:-18px;top:17px;width:7px;height:7px;border-radius:50%;
  background:var(--fs-bg);border:1.5px solid var(--fs-line2);transition:border-color .18s var(--fs-ease)}
.feiyu-root .fs-entry:hover:before{border-color:var(--fs-brand)}
.feiyu-root .fs-entryMeta{display:flex;align-items:center;gap:8px;margin-bottom:5px;font-size:11px;color:var(--fs-t3)}
.feiyu-root .fs-clock{font-variant-numeric:tabular-nums;letter-spacing:.02em}
.feiyu-root .fs-entryText{margin:0;font-size:13px;line-height:1.8;color:var(--fs-t1);word-break:break-word}
.feiyu-root .fs-entryFoot{display:flex;justify-content:flex-end;align-items:center;gap:12px;margin-top:6px;min-height:18px}
.feiyu-root .fs-entryFoot .fs-link{opacity:.55;transition:opacity .18s var(--fs-ease)}
.feiyu-root .fs-entry:hover .fs-entryFoot .fs-link,.feiyu-root .fs-entryFoot .fs-link:focus-visible{opacity:.95}
.feiyu-root .fs-confirm{display:inline-flex;align-items:center;gap:10px;font-size:12px;color:var(--fs-t2)}

/* ── 按钮 / 链接 ── */
.feiyu-root .fs-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border-radius:10px;
  border:1px solid var(--fs-line);background:var(--fs-bg);color:var(--fs-t1);font:inherit;font-size:12.5px;
  line-height:1.5;text-decoration:none;cursor:pointer;
  transition:background .16s var(--fs-ease),border-color .16s var(--fs-ease),transform .1s var(--fs-ease)}
.feiyu-root .fs-btn:hover:not(:disabled){background:var(--fs-l2);border-color:var(--fs-line2)}
.feiyu-root .fs-btn:active:not(:disabled){transform:scale(.985)}
.feiyu-root .fs-btn:disabled{opacity:.5;cursor:default}
.feiyu-root .fs-btn--sm{padding:4px 10px;font-size:11.5px;border-radius:8px}
.feiyu-root .fs-btn--primary{background:var(--fs-brand);border-color:transparent;color:#fff}
.feiyu-root .fs-btn--primary:hover:not(:disabled){background:var(--fs-brand);border-color:transparent;filter:brightness(1.07)}
.feiyu-root .fs-link{appearance:none;border:0;background:none;padding:0;margin:0;font:inherit;font-size:12px;
  color:var(--fs-t2);cursor:pointer;text-decoration:underline;text-underline-offset:3px;
  text-decoration-color:var(--fs-line2)}
.feiyu-root .fs-link:hover{color:var(--fs-t1)}
.feiyu-root .fs-link--brand{color:var(--fs-brand);text-decoration-color:transparent}
.feiyu-root .fs-link--brand:hover{color:var(--fs-brand);text-decoration-color:currentColor}
.feiyu-root .fs-link--danger{color:var(--fs-err);text-decoration-color:transparent}
.feiyu-root .fs-link--danger:hover{color:var(--fs-err);text-decoration-color:currentColor}

/* ── 空 / 载入 / 报错 ── */
.feiyu-root .fs-empty{margin:16px 0 0;padding:34px 18px;border-radius:var(--fs-radius);
  border:1px dashed var(--fs-line2);text-align:center;color:var(--fs-t2)}
.feiyu-root .fs-empty svg{opacity:.4;margin-bottom:8px}
.feiyu-root .fs-empty p{margin:0;font-size:12.5px;line-height:1.8}
.feiyu-root .fs-skel{margin-top:26px}
.feiyu-root .fs-skelRow{height:64px;margin-bottom:8px;border-radius:12px;
  background:linear-gradient(90deg,var(--fs-l1),var(--fs-l2),var(--fs-l1));
  background-size:200% 100%;animation:fs-shimmer 1.4s linear infinite}
@keyframes fs-shimmer{from{background-position:160% 0}to{background-position:-60% 0}}
.feiyu-root .fs-banner{margin:12px 0 0;padding:9px 12px;border-radius:10px;font-size:12px;line-height:1.7;
  border:1px solid var(--fs-err);color:var(--fs-err);background:transparent}
.feiyu-root .fs-banner--ok{border-color:var(--fs-line2);color:var(--fs-t2)}

/* ── 体检：小节 + 键值行 ── */
.feiyu-root .fs-stack{display:flex;flex-direction:column;gap:14px}
.feiyu-root .fs-sectionHead{display:flex;align-items:center;gap:10px;margin-bottom:2px}
.feiyu-root .fs-sectionTitle{font-size:13px;font-weight:650}
.feiyu-root .fs-subHead{margin:12px 0 4px;font-size:11.5px;font-weight:600;color:var(--fs-t2);
  letter-spacing:.02em;text-transform:none}
.feiyu-root .fs-kv{display:flex;justify-content:space-between;gap:14px;padding:5px 0;font-size:12px;
  border-bottom:1px dashed transparent}
.feiyu-root .fs-kv+.fs-kv{border-top:1px solid var(--fs-line)}
.feiyu-root .fs-kvK{color:var(--fs-t2)}
.feiyu-root .fs-kvV{font-variant-numeric:tabular-nums;text-align:right}
.feiyu-root .fs-warn{margin-top:10px;padding:10px 12px;border-radius:10px;border:1px solid var(--fs-line2);
  background:var(--fs-bg);font-size:12px;line-height:1.75}
.feiyu-root .fs-warn b{font-weight:600}
.feiyu-root .fs-warnRow{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;padding:3px 0;color:var(--fs-t2)}
.feiyu-root .fs-warnRow span{color:var(--fs-t1)}
.feiyu-root .fs-note{margin:6px 0 0;font-size:11.5px;line-height:1.75;color:var(--fs-t2)}
.feiyu-root .fs-note--tiny{font-size:11px;opacity:.9}

/* ── 本子 ── */
.feiyu-root .fs-book+.fs-book{margin-top:18px;padding-top:18px;border-top:1px solid var(--fs-line)}
.feiyu-root .fs-bookHead{display:flex;align-items:baseline;gap:8px;margin-bottom:8px}
.feiyu-root .fs-bookTitle{font-size:13px;font-weight:650}
.feiyu-root .fs-bookHint{font-size:11px;color:var(--fs-t2)}
.feiyu-root .fs-pre{margin:10px 0 0;padding:12px 14px;border-radius:10px;background:var(--fs-bg);
  border:1px solid var(--fs-line);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  font-size:12px;line-height:1.8;color:var(--fs-t1);white-space:pre-wrap;word-break:break-word;
  max-height:340px;overflow:auto}
.feiyu-root .fs-editor{width:100%;min-height:220px;padding:12px 14px;border-radius:10px;
  border:1px solid var(--fs-line2);background:var(--fs-bg);color:var(--fs-t1);
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.8;
  resize:vertical;outline:none;transition:border-color .16s var(--fs-ease),box-shadow .16s var(--fs-ease)}
.feiyu-root .fs-editor:focus{border-color:var(--fs-brand);box-shadow:0 0 0 3px rgba(77,107,254,.14)}
.feiyu-root .fs-actions{display:flex;align-items:center;gap:12px;margin-top:8px;flex-wrap:wrap;font-size:11.5px;color:var(--fs-t2)}

/* ── 情感日记：热力格 + 天卡片 ── */
.feiyu-root .fs-heat{display:grid;grid-template-rows:repeat(7,11px);grid-auto-flow:column;
  grid-auto-columns:11px;gap:3px;margin-top:12px}
.feiyu-root .fs-cell{width:11px;height:11px;border-radius:3px;border:1px solid var(--fs-line);
  transition:transform .12s var(--fs-ease)}
.feiyu-root .fs-cell:hover{transform:scale(1.25)}
.feiyu-root .fs-heatFoot{display:flex;align-items:center;gap:6px;margin-top:8px;font-size:11px;color:var(--fs-t2)}
.feiyu-root .fs-days{margin-top:12px}
.feiyu-root .fs-dayCard{margin-top:8px;border-radius:12px;border:1px solid var(--fs-line);
  background:transparent;overflow:hidden;transition:border-color .16s var(--fs-ease)}
.feiyu-root .fs-dayCard--open{background:var(--fs-bg);border-color:var(--fs-line2)}
.feiyu-root .fs-dayHead{display:flex;align-items:baseline;gap:8px;padding:9px 12px;cursor:pointer;
  user-select:none}
.feiyu-root .fs-dayHead:hover{background:var(--fs-l2)}
.feiyu-root .fs-dayDate{font-size:12.5px;font-weight:600;font-variant-numeric:tabular-nums}
.feiyu-root .fs-dayPreview{flex:1;min-width:0;font-size:11.5px;color:var(--fs-t2);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.feiyu-root .fs-dayChars{font-size:10.5px;color:var(--fs-t3);white-space:nowrap}
.feiyu-root .fs-caret{font-size:10px;color:var(--fs-t3);width:10px;text-align:center;
  transition:transform .16s var(--fs-ease)}
.feiyu-root .fs-dayBody{padding:2px 14px 14px}
.feiyu-root .fs-blockTitle{margin:12px 0 4px;font-size:12px;font-weight:600;color:var(--fs-t1)}
.feiyu-root .fs-para{margin:0 0 7px;font-size:12.5px;line-height:1.9;color:var(--fs-t1);white-space:pre-wrap}
.feiyu-root .fs-seg{display:inline-flex;padding:2px;gap:2px;border-radius:9px;border:1px solid var(--fs-line);
  background:var(--fs-l1)}
.feiyu-root .fs-segBtn{appearance:none;border:0;background:none;font:inherit;font-size:11.5px;
  color:var(--fs-t2);padding:4px 10px;border-radius:7px;cursor:pointer;
  transition:background .16s var(--fs-ease),color .16s var(--fs-ease)}
.feiyu-root .fs-segBtn[aria-selected="true"]{background:var(--fs-l3);color:var(--fs-t1);font-weight:600}

/* ── 档案：块 ── */
.feiyu-root .fs-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:9px}
.feiyu-root .fs-tile{display:flex;flex-direction:column;gap:3px;padding:13px 14px;border-radius:12px;
  border:1px solid var(--fs-line);background:var(--fs-bg);color:inherit;text-decoration:none;
  transition:border-color .16s var(--fs-ease),transform .16s var(--fs-ease),box-shadow .16s var(--fs-ease)}
.feiyu-root .fs-tile:hover{border-color:var(--fs-line2);transform:translateY(-1px);
  box-shadow:0 12px 26px -22px rgba(0,0,0,.55)}
.feiyu-root .fs-tileTitle{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600}
.feiyu-root .fs-tileDesc{font-size:11px;line-height:1.6;color:var(--fs-t2)}

@media(max-width:520px){
  .feiyu-root .fs-shell{padding:0 16px 72px}
  .feiyu-root .fs-tabs{margin-left:-16px;margin-right:-16px;padding-left:16px;padding-right:16px}
  .feiyu-root .fs-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}
  .feiyu-root .fs-tiles{grid-template-columns:1fr}
}
@media(prefers-reduced-motion:reduce){
  .feiyu-root *{transition:none!important;animation:none!important}
}
`;

    (function injectCss() {
      if (typeof document === 'undefined') return;
      const id = 'dsh-hierarchical-fishmemory/panel.css';
      if (document.querySelector(`style[data-plugin-css="${id}"]`) !== null) return;
      const tag = document.createElement('style');
      tag.dataset.plugin = 'dsh-hierarchical-fishmemory';
      tag.dataset.pluginCss = id;
      tag.textContent = CSS;
      document.head.appendChild(tag);
    })();

    /**
     * 主题 token。2026-11-16 之后界面主要靠 CSS 类，这里只留给少数
     * 必须在 JS 里算颜色的地方（热力格深浅、报错色）。
     */
    const C = {
      border1: 'var(--dsw-alias-border-l1)',
      border2: 'var(--dsw-alias-border-l2)',
      text1: 'var(--dsw-alias-label-primary)',
      text2: 'var(--dsw-alias-label-secondary)',
      err: 'var(--dsw-alias-state-error-primary)',
      brand: 'var(--dsw-alias-brand-primary)',
    };

    /* ───────────────────────── 图标 ───────────────────────── */

    /**
     * 侧栏图标。owner 会传 `{ size, active }` ——
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

    /** 界面里那些小图形。统一 1.5 描边、圆角端点，跟侧栏那只鱼同一个手。 */
    const GLYPHS = {
      fish: [
        ['ellipse', { cx: 13.4, cy: 12, rx: 7.4, ry: 5 }],
        ['path', { d: 'M6.4 12 L1.8 8.6 L1.8 15.4 Z' }],
        ['circle', { cx: 17.6, cy: 10.8, r: 1, fill: 'currentColor', stroke: 'none' }],
      ],
      book: [
        ['path', { d: 'M4 5.5h6.5A2.5 2.5 0 0 1 13 8v11a2 2 0 0 0-2-2H4z' }],
        ['path', { d: 'M20 5.5h-6.5A2.5 2.5 0 0 0 11 8v11a2 2 0 0 1 2-2h7z' }],
      ],
      pulse: [
        ['path', { d: 'M3 12.5h4l2.5-6 4 12 2.5-6H21' }],
      ],
      box: [
        ['path', { d: 'M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4z' }],
        ['path', { d: 'M3.5 7.5 12 11.5l8.5-4M12 11.5v9' }],
      ],
      cloud: [
        ['path', { d: 'M7 18.5a4 4 0 0 1-.4-8A5.6 5.6 0 0 1 17.2 9a3.9 3.9 0 0 1 .3 9.5z' }],
      ],
      arrow: [
        ['path', { d: 'M7 12h9.5M13 8l4 4-4 4' }],
      ],
      spark: [
        ['path', { d: 'M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4M6 6l2.6 2.6M15.4 15.4 18 18M18 6l-2.6 2.6M8.6 15.4 6 18' }],
      ],
    };

    function Glyph(props) {
      const name = String(props.name || 'fish');
      const size = typeof props.size === 'number' ? props.size : 16;
      const parts = GLYPHS[name] || GLYPHS.fish;
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          style: { display: 'block', flex: 'none' },
        },
        parts.map((part, i) => h(part[0], Object.assign({ key: `p${i}` }, part[1]))),
      );
    }

    /* ───────────────────────── 小组件 ───────────────────────── */

    /** 空状态。一整块虚线的安静地方，比一句小字像"这里本来有东西"。 */
    function Empty(props) {
      return h(
        'div',
        { className: 'fs-empty' },
        props.icon === false ? null : h(Glyph, { name: props.icon || 'fish', size: 26 }),
        h('p', null, props.text),
      );
    }

    /** 卡片外壳：一层底、一条边、一段自己的标题。 */
    function Card(props) {
      const plain = Boolean(props.plain);
      return h(
        'div',
        { className: plain ? 'fs-card fs-card--plain' : 'fs-card', style: props.style },
        props.title
          ? h(
              'div',
              { className: 'fs-cardHead' },
              h('span', { className: 'fs-cardTitle' }, props.title),
              h('span', { className: 'fs-grow' }),
              props.aside || null,
            )
          : null,
        props.hint ? h('p', { className: 'fs-cardHint' }, props.hint) : null,
        props.children,
      );
    }

    /** 小圆角标签：摆「回收站 3 条」「档案只读」这种短状态。 */
    function Chip(props) {
      return h(
        'span',
        { className: props.warn ? 'fs-chip fs-chip--warn' : 'fs-chip' },
        props.children,
      );
    }

    /**
     * 页签。
     *
     * 四个视图**始终挂载**，只靠 display 切换。两个理由：
     *   1. 切来切去不该重拉一次 /stats、/feelings —— 那是好几趟往返；
     *   2. 渲染冒烟测试里那些块必须首屏就在树里。
     */
    function Tabs(props) {
      return h(
        'div',
        { role: 'tablist', className: 'fs-tabs' },
        props.tabs.map((tab) =>
          h(
            'button',
            {
              key: tab.key,
              type: 'button',
              role: 'tab',
              'aria-selected': props.value === tab.key,
              className: 'fs-tab',
              onClick: () => props.onChange(tab.key),
            },
            tab.label,
          ),
        ),
      );
    }

    /** 描边按钮/链接：导出、导入、上传都同一个样子。 */
    function Ghost(props) {
      const cls = `fs-btn${props.primary ? ' fs-btn--primary' : ''}`;
      if (props.href) {
        return h(
          'a',
          { href: props.href, download: '', className: cls, style: props.style },
          props.icon ? h(Glyph, { name: props.icon }) : null,
          props.children,
        );
      }
      return h(
        'button',
        {
          type: 'button',
          disabled: props.disabled,
          onClick: props.onClick,
          className: cls,
          style: props.style,
        },
        props.icon ? h(Glyph, { name: props.icon }) : null,
        props.children,
      );
    }

    /** 段落小标题：体检页里「深层 · xx」「档案」用。 */
    function SubHead(props) {
      return h('div', { className: 'fs-subHead' }, props.children);
    }

    /** 一行「标签 —— 值」。 */
    function KV(props) {
      return h(
        'div',
        { className: 'fs-kv' },
        h('span', { className: 'fs-kvK' }, props.label),
        h('span', { className: 'fs-kvV' }, String(props.value)),
      );
    }

    /* ───────────────────────── 一条日记 ───────────────────────── */

    function clockOf(ts) {
      if (!Number.isFinite(ts)) return '';
      const d = new Date(ts);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    function Entry(props) {
      const e = props.entry;
      const [confirming, setConfirming] = useState(false);

      return h(
        'article',
        { className: 'fs-entry' },
        h('div', { className: 'fs-entryMeta' }, h('span', { className: 'fs-clock' }, clockOf(e.created_at))),
        h('p', { className: 'fs-entryText' }, e.text),
        h(
          'div',
          { className: 'fs-entryFoot' },
          confirming
            ? h(
                'span',
                { className: 'fs-confirm' },
                h('span', null, '确定忘掉？'),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'fs-link fs-link--danger',
                    onClick: () => props.onForget(e.id),
                  },
                  '忘掉',
                ),
                h(
                  'button',
                  { type: 'button', className: 'fs-link', onClick: () => setConfirming(false) },
                  '算了',
                ),
              )
            : h(
                'button',
                {
                  type: 'button',
                  className: 'fs-link',
                  title: '从档案里删掉这一条',
                  disabled: Boolean(props.busy),
                  onClick: () => setConfirming(true),
                },
                props.busy ? '正在忘…' : '忘掉',
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
     * 这两个文件都在档案目录里，插件从不覆盖它们，所以这里只做两件事：
     * **看** 和 **存**。走 host 的同源接口 `${API}/notes`。
     */
    function Notebook(props) {
      const only = (props && props.only) || null;
      const [notes, setNotes] = useState(null);
      const [error, setError] = useState('');
      const [editing, setEditing] = useState('');
      const [draft, setDraft] = useState('');
      const [saving, setSaving] = useState('');

      useEffect(() => {
        let alive = true;
        fetch(`${API}/notes`, { credentials: 'same-origin' })
          .then((r) => r.json())
          .then((data) => {
            if (!alive) return;
            if (data && data.ok) setNotes(data.notes || []);
            else setError((data && data.error) || '读不到本子');
          })
          .catch((err) => {
            if (alive) setError(String((err && err.message) || err));
          });
        return () => {
          alive = false;
        };
      }, []);

      function save(key) {
        setSaving(key);
        setError('');
        fetch(`${API}/notes`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, text: draft }),
        })
          .then((r) => r.json().then((body) => ({ ok: r.ok, body })))
          .then(({ ok, body }) => {
            if (!ok || !body.ok) throw new Error(body.error || '没存上');
            setNotes((prev) => (prev || []).map((n) => (n.key === key ? Object.assign({}, n, { text: draft }) : n)));
            setEditing('');
            setSaving('');
          })
          .catch((err) => {
            setSaving('');
            setError(String((err && err.message) || err));
          });
      }

      let body;
      const shown = notes === null ? null : only ? notes.filter((n) => only.indexOf(n.key) !== -1) : notes;
      if (shown === null) {
        body = h('p', { className: 'fs-note' }, '翻本子…');
      } else if (shown.length === 0) {
        body = h(Empty, { icon: 'book', text: '没有可翻的本子。' });
      } else {
        body = shown.map((n) =>
          h(
            'div',
            { key: n.key, className: 'fs-book' },
            h(
              'div',
              { className: 'fs-bookHead' },
              h('span', { className: 'fs-bookTitle' }, n.label),
              h('span', { className: 'fs-bookHint' }, n.hint),
              h('span', { className: 'fs-grow' }),
              editing === n.key
                ? null
                : h(
                    'button',
                    {
                      type: 'button',
                      className: 'fs-link fs-link--brand',
                      onClick: () => {
                        setEditing(n.key);
                        setDraft(n.text || '');
                      },
                    },
                    '改',
                  ),
            ),
            editing === n.key
              ? h(
                  'div',
                  null,
                  h('textarea', {
                    className: 'fs-editor',
                    value: draft,
                    spellCheck: false,
                    onChange: (ev) => setDraft(ev.target.value),
                  }),
                  h(
                    'div',
                    { className: 'fs-actions' },
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'fs-btn fs-btn--sm fs-btn--primary',
                        disabled: saving === n.key,
                        onClick: () => save(n.key),
                      },
                      saving === n.key ? '存…' : '存下来',
                    ),
                    h(
                      'button',
                      { type: 'button', className: 'fs-btn fs-btn--sm', onClick: () => setEditing('') },
                      '算了',
                    ),
                  ),
                )
              : h('pre', { className: 'fs-pre' }, n.text ? n.text : '（还是空的）'),
          ),
        );
      }

      return h(
        'div',
        null,
        error !== ''
          ? h('p', { className: 'fs-banner' }, error)
          : null,
        body,
      );
    }

    /* ───────────────────────── 情感日记 ───────────────────────── */

    function heatLevel(chars) {
      if (!(chars > 0)) return 0;
      if (chars < 200) return 1;
      if (chars < 500) return 2;
      if (chars < 900) return 3;
      return 4;
    }

    /**
     * 把情感日记拆成一天一天：`## 日期` → `### 小节` → 正文。
     * 第一个 `## 日期` 之前那段是这本账的说明，不算任何一天。
     * 认不出的行一律当正文，**不丢**。
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
        if (day === null) continue;
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
      for (const d of days) {
        for (const b of d.blocks) {
          while (b.lines.length > 0 && b.lines[b.lines.length - 1] === '') b.lines.pop();
          while (b.lines.length > 0 && b.lines[0] === '') b.lines.shift();
        }
        d.blocks = d.blocks.filter((b) => b.title !== '' || b.lines.length > 0);
      }
      return days;
    }

    /** 每天写了几个字；同一天写了两节就合并。 */
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
      const alpha = [0, 0.24, 0.45, 0.7, 1];

      return h(
        'div',
        null,
        h(
          'div',
          { className: 'fs-heat' },
          cells.map((c) =>
            h('div', {
              key: c.date,
              className: 'fs-cell',
              title: c.future
                ? ''
                : c.level > 0
                  ? `${c.date}：${c.chars} 字${c.sections > 1 ? ` · ${c.sections} 小节` : ''}`
                  : `${c.date}：没写`,
              style: {
                border: c.level > 0 ? '1px solid transparent' : `1px solid ${C.border1}`,
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
          { className: 'fs-heatFoot' },
          h('span', null, `最近 ${weeks} 周：写了 ${written} 天`),
          h('span', { style: { opacity: 0.5 } }, '·'),
          h('span', null, '深浅 = 那天写了多少'),
        ),
      );
    }

    /**
     * 一天。折起来只有一行：日期 + 字数 + 一句开头；点开才是正文。
     * 这本账已经三十多 KB，一进门就看见一面墙，等于什么都看不见。
     */
    function FeelingsDay(props) {
      const day = props.day;
      const isToday = day.date === props.today;
      const open = props.open;
      const blocks = day.blocks;

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
        { className: open ? 'fs-dayCard fs-dayCard--open' : 'fs-dayCard' },
        h(
          'div',
          { className: 'fs-dayHead', onClick: props.onToggle },
          h('span', { className: 'fs-dayDate' }, day.date),
          isToday ? h('span', { className: 'fs-dayChars' }, '今天') : null,
          h('span', { className: 'fs-dayPreview' }, open ? '' : preview),
          h('span', { className: 'fs-dayChars' }, `${day.chars} 字`),
          h(
            'span',
            {
              className: 'fs-caret',
              style: { transform: open ? 'rotate(90deg)' : 'none' },
            },
            '›',
          ),
        ),
        open
          ? h(
              'div',
              { className: 'fs-dayBody' },
              blocks.map((b, i) =>
                h(
                  'div',
                  { key: `b${i}` },
                  b.title ? h('div', { className: 'fs-blockTitle' }, b.title) : null,
                  paras(b.lines).map((para, j) => h('p', { key: `p${j}`, className: 'fs-para' }, para)),
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

      const seg = (key, label) =>
        h(
          'button',
          {
            type: 'button',
            className: 'fs-segBtn',
            'aria-selected': mode === key,
            onClick: () => setMode(key),
          },
          label,
        );

      return h(
        'div',
        null,
        h(
          'div',
          { className: 'fs-cardHead' },
          h('span', { className: 'fs-cardTitle' }, '情感日记'),
          days.length ? h('span', { className: 'fs-cardHint', style: { margin: 0 } }, `${days.length} 天`) : null,
          h('span', { className: 'fs-grow' }),
          h('div', { className: 'fs-seg' }, seg('days', '按天读'), seg('raw', '整篇编辑')),
          h(
            'button',
            {
              type: 'button',
              className: 'fs-btn fs-btn--sm',
              onClick: load,
              disabled: busy,
            },
            '重新读',
          ),
        ),
        h(FeelingsHeat, { text }),
        mode === 'days'
          ? days.length === 0
            ? h('p', { className: 'fs-note' }, '这本账还是空的。')
            : h(
                'div',
                { className: 'fs-days' },
                newestFirst.map((d) =>
                  h(FeelingsDay, {
                    key: d.date,
                    day: d,
                    today,
                    open: d.date === open,
                    onToggle: () => setOpenDate(d.date === open ? '' : d.date),
                  }),
                ),
                h(
                  'p',
                  { className: 'fs-note fs-note--tiny' },
                  '按 `## 日期` 拆开读，点一下展开或收起。要改措辞去「整篇编辑」。',
                ),
              )
          : h(
              'div',
              null,
              h(
                'p',
                { className: 'fs-note' },
                '这本不设上限、不衰减，保存前会把旧版存一份到 backups/feelings/。',
              ),
              h('textarea', {
                className: 'fs-editor',
                value: text,
                onChange: (e) => setText(e.target.value),
                rows: 22,
                spellCheck: false,
                style: { marginTop: 10, minHeight: 360 },
              }),
              h(
                'div',
                { className: 'fs-actions' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'fs-btn fs-btn--sm fs-btn--primary',
                    onClick: save,
                    disabled: busy || !dirty,
                  },
                  busy ? '保存中…' : '保存',
                ),
                h(
                  'span',
                  null,
                  `现在 ${[...text].length} 字符${delta ? `（比读入时 ${delta > 0 ? '+' : ''}${delta}）` : ''}`,
                ),
                msg ? h('span', null, msg) : null,
                err ? h('span', { style: { color: C.err } }, err) : null,
              ),
            ),
        mode === 'days' && msg ? h('p', { className: 'fs-note' }, msg) : null,
        mode === 'days' && err ? h('p', { className: 'fs-note', style: { color: C.err } }, err) : null,
      );
    }

    /* ───────────────────────── 记忆体检 ───────────────────────── */

    function HealthBox() {
      const [state, setState] = useState(null);
      const [error, setError] = useState('');
      const [busy, setBusy] = useState(false);
      const [noteMsg, setNoteMsg] = useState('');

      // 重复句不再只能删手记那一份 —— 哪层都能删。服务端按 target 找文件，
      // 仍然只认整行精确匹配。
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

      // 冲突不再只是报警，可以一句话统一成某个值。只改「出现过那个值」的行。
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
          setNoteMsg(changed ? `统一成「${value}」，改了 ${changed} 行` : '没有要改的行（浅层请手动改）');
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

      useEffect(() => {
        read();
      }, []);

      if (!state && !error) {
        return h('p', { className: 'fs-note' }, '正在数账…');
      }
      if (error) {
        return h('p', { className: 'fs-note', style: { color: C.err } }, `体检读不到：${error}`);
      }

      const d = state;
      const metric = (value, label) =>
        h(
          'div',
          { className: 'fs-metric', key: label },
          h('b', null, String(value)),
          h('span', null, label),
        );

      return h(
        'div',
        { className: 'fs-stack' },
        h(
          'div',
          { className: 'fs-sectionHead' },
          h('span', { className: 'fs-sectionTitle' }, '记忆体检'),
          h('span', { className: 'fs-grow' }),
          h(
            'button',
            {
              type: 'button',
              className: 'fs-btn fs-btn--sm',
              onClick: read,
              disabled: busy,
            },
            busy ? '数着…' : '重数',
          ),
        ),
        h(
          'div',
          { className: 'fs-metrics', style: { marginTop: 0 } },
          metric(d.diary.entries, '共度时光 · 条'),
          metric(d.estimate.injectedTokens, '每轮注入 · token'),
          metric(d.feelings.chars, '情感日记 · 字'),
          metric(d.handnote.chars, '人格手记 · 字'),
        ),

        d.memory.scopes.map((scope) =>
          h(
            'div',
            { key: scope.scope },
            h(SubHead, null, `深层 · ${scope.scope}`),
            h(KV, { label: 'core', value: `${scope.coreChars} 字（约 ${scope.coreTokens} token）` }),
            h(KV, {
              label: 'topics',
              value: `${scope.topics.length} 条 / ${scope.topics.reduce((sum, t) => sum + t.chars, 0)} 字`,
            }),
          ),
        ),

        h(
          'div',
          null,
          h(SubHead, null, '档案'),
          h(KV, {
            label: '共度时光',
            value: `${d.diary.entries} 条 / ${d.diary.files} 个文件（近 7 天 ${d.diary.last7Days} 条）`,
          }),
          h(KV, { label: '情感日记', value: `${d.feelings.chars} 字` }),
          h(KV, {
            label: '人格手记',
            value: `${d.handnote.lines} 条 / ${d.handnote.chars} 字，最长 ${d.handnote.longest} 字`,
          }),
          d.handnote.truncated ? h(KV, { label: '⚠ 被截断的行', value: `${d.handnote.truncated} 条` }) : null,
          h(KV, { label: '浅层', value: `${d.shallow.live} 条（快到期 ${d.shallow.expiring}）` }),
          h(KV, { label: '每轮注入估计', value: `约 ${d.estimate.injectedTokens} token` }),
        ),

        // 对账：账本 / 磁盘 / 注入真正用的那份，三个数。
        // 「一致」不值得喜庆，「对不上」必须刺眼 —— 这是唯一能证明
        // 记忆没在这一来一回里少一条的东西。
        d.recon
          ? d.recon.ok
            ? h(KV, { key: 'recon', label: '账本', value: d.recon.text })
            : h(
                'div',
                { className: 'fs-warn', key: 'recon' },
                h('b', null, '⚠ 对账没对平'),
                h('div', { className: 'fs-note fs-note--tiny' }, d.recon.text),
              )
          : null,

        d.duplicates && d.duplicates.length
          ? h(
              'div',
              { className: 'fs-warn' },
              h('b', null, `⚠ 有 ${d.duplicates.length} 句写了两遍`),
              ...d.duplicates.slice(0, 4).map((item, i) =>
                h(
                  'div',
                  { key: `d${i}`, className: 'fs-warnRow' },
                  h('span', null, `· ${item.text.slice(0, 36)}`),
                  item.againTarget
                    ? h(
                        'button',
                        {
                          type: 'button',
                          className: 'fs-btn fs-btn--sm',
                          onClick: () => removeLine(item.againTarget, item.text),
                        },
                        `删掉${item.again}那份`,
                      )
                    : null,
                  item.firstTarget && item.firstTarget !== item.againTarget
                    ? h(
                        'button',
                        {
                          type: 'button',
                          className: 'fs-btn fs-btn--sm',
                          onClick: () => removeLine(item.firstTarget, item.text),
                        },
                        `删掉${item.first}那份`,
                      )
                    : null,
                ),
              ),
            )
          : null,

        d.conflicts && d.conflicts.length
          ? h(
              'div',
              { className: 'fs-warn' },
              h('b', null, `⚠ 有 ${d.conflicts.length} 样东西被写出了不同的值`),
              ...d.conflicts.map((conflict, ci) =>
                h(
                  'div',
                  { key: `c${ci}`, style: { marginTop: 8 } },
                  h(
                    'div',
                    { className: 'fs-note fs-note--tiny' },
                    `${conflict.kind}：${conflict.values.join(' / ')}`,
                  ),
                  ...conflict.lines.map((line, li) =>
                    h(
                      'div',
                      { key: `c${ci}l${li}`, className: 'fs-warnRow' },
                      h('span', { style: { opacity: 0.7 } }, `${line.layer}:`),
                      h('span', null, line.line.slice(0, 46)),
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'fs-btn fs-btn--sm',
                          onClick: () => unifyValue(conflict, line.value),
                        },
                        `都以「${line.value}」为准`,
                      ),
                    ),
                  ),
                ),
              ),
            )
          : null,

        noteMsg ? h('p', { className: 'fs-note' }, noteMsg) : null,
        h('p', { className: 'fs-note fs-note--tiny' }, d.estimate.note),
      );
    }

    /* ── 回顾 ── */
    //
    // 之前想看「上周都在干什么」只能靠搜关键词，时间线是断的。
    // 这里按天把共度时光铺开，另外单拎「7 天前的今天」。
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

      useEffect(() => {
        if (open && !state) read();
      }, [open]);

      const line = (entry, key) =>
        h(
          'div',
          { key, className: 'fs-entryText', style: { fontSize: 12, padding: '3px 0' } },
          h('span', { className: 'fs-clock', style: { marginRight: 7, color: C.text2 } }, String(entry.at || '').slice(11, 16)),
          String(entry.text || '').slice(0, 160),
        );

      if (!open) {
        return h(
          'button',
          { type: 'button', className: 'fs-btn fs-btn--sm', onClick: () => setOpen(true) },
          '回顾一下最近七天',
        );
      }

      if (error) return h('p', { className: 'fs-note', style: { color: C.err } }, `回顾读不到：${error}`);
      if (!state) return h('p', { className: 'fs-note' }, '翻着…');

      const back = state.lookback;
      return h(
        'div',
        null,
        back.entries.length
          ? h(
              'div',
              null,
              h(SubHead, null, `${back.date}（七天前的今天）`),
              ...back.entries.slice(0, 4).map((entry, i) => line(entry, `b${i}`)),
            )
          : h('p', { className: 'fs-note' }, `${back.date} 那天没有记录。`),
        ...state.recent.map((day) =>
          h(
            'div',
            { key: day.date },
            h(SubHead, null, `${day.date} · ${day.entries.length} 条`),
            ...day.entries.slice(0, 3).map((entry, i) => line(entry, `${day.date}-${i}`)),
          ),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'fs-btn fs-btn--sm',
            style: { marginTop: 10 },
            onClick: () => {
              setOpen(false);
              setState(null);
            },
          },
          '收起',
        ),
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
            className: 'fs-btn',
            onClick: () => picker.current && picker.current.click(),
          },
          h(Glyph, { name: 'box' }),
          '导入备份（.json）',
        ),
        name ? h('p', { className: 'fs-note' }, `选中的文件：${name}`) : null,
        phase === 'preview' && report
          ? h(
              'div',
              { className: 'fs-warn' },
              h(
                'p',
                { style: { margin: 0, fontSize: 12, lineHeight: 1.75 } },
                `这份备份会覆盖 ${report.writes} 个文件、合并 ${report.cards} 张人设卡。`,
              ),
              h(
                'p',
                { className: 'fs-note' },
                `${describe(report) || '（备份里没有可识别的条目）'}${
                  report.exportedAt ? ` · 备份于 ${String(report.exportedAt).slice(0, 16).replace('T', ' ')}` : ''
                }`,
              ),
              h(
                'p',
                { className: 'fs-note', style: { color: C.err } },
                '还原会覆盖现在的日记、手记和深层记忆；动手之前插件会先自动存一份「还原前」快照。',
              ),
              h(
                'div',
                { className: 'fs-actions' },
                h(
                  'button',
                  { type: 'button', className: 'fs-btn fs-btn--sm', style: { borderColor: C.err, color: C.err }, onClick: write },
                  '确认还原',
                ),
                h('button', { type: 'button', className: 'fs-btn fs-btn--sm', onClick: reset }, '算了'),
              ),
            )
          : null,
        phase === 'writing' ? h('p', { className: 'fs-note' }, '正在写入…') : null,
        phase === 'done' && report
          ? h(
              'div',
              { className: 'fs-warn' },
              h(
                'p',
                { style: { margin: 0, fontSize: 12, lineHeight: 1.75 } },
                `还原完成：写了 ${report.written} 个文件、合并 ${report.cards} 张人设卡。`,
              ),
              report.preBackup
                ? h('p', { className: 'fs-note' }, `还原前的快照：${report.preBackup}`)
                : null,
              h('p', { className: 'fs-note' }, '日记和手记要重启后才重新加载；人设卡下一轮就生效。'),
              h(
                'div',
                { className: 'fs-actions' },
                h('button', { type: 'button', className: 'fs-btn fs-btn--sm', onClick: reset }, '知道了'),
              ),
            )
          : null,
        phase === 'error'
          ? h(
              'div',
              { style: { marginTop: 8 } },
              h('p', { className: 'fs-banner', style: { marginTop: 0 } }, `没导入成功：${error}`),
              h(
                'button',
                { type: 'button', className: 'fs-btn fs-btn--sm', style: { marginTop: 8 }, onClick: reset },
                '重选一份',
              ),
            )
          : null,
      );
    }

    /* ───────────────────────── 云端备份（WebDAV） ───────────────────────── */

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

      const when = state && state.lastAt ? new Date(state.lastAt).toLocaleString() : '';

      return h(
        'div',
        null,
        h(
          'p',
          { className: 'fs-note', style: { margin: 0 } },
          !state
            ? '云端备份：读不到状态。'
            : !state.enabled
              ? '云端备份已关掉（设置里的「WebDAV 总开关」）。'
              : !state.configured
                ? '云端备份还没接上：去插件设置里填 WebDAV 地址（服务器、账号、密码）。'
                : `云端备份：${state.dir} · 保留 ${state.keep} 份${state.auto ? ' · 写日记后自动上传' : ''}`,
        ),
        when ? h('p', { className: 'fs-note' }, `上次上传：${when}（${state.lastFile}）`) : null,
        state && state.lastError
          ? h('p', { className: 'fs-note', style: { color: C.err } }, `上次失败：${state.lastError}`)
          : null,
        state && state.configured && state.enabled
          ? h(
              'button',
              {
                type: 'button',
                className: 'fs-btn',
                style: { marginTop: 10 },
                onClick: push,
                disabled: busy,
              },
              h(Glyph, { name: 'cloud' }),
              busy ? '正在上传…' : '上传到云端',
            )
          : null,
        done
          ? h(
              'p',
              { className: 'fs-note', style: { color: C.brand } },
              `已上传：${done.fileName || done.file}（${done.bytes} 字节）${
                done.removed && done.removed.length ? `，清掉 ${done.removed.length} 份旧的` : ''
              }`,
            )
          : null,
        error ? h('p', { className: 'fs-note', style: { color: C.err } }, `没传上去：${error}`) : null,
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

    /** 把日记按「今天 / 昨天 / 3 天前 / 10-05」分段。 */
    function groupByDay(diary) {
      const groups = [];
      for (const entry of diary) {
        const label = dayLabel(entry.created_at);
        const last = groups[groups.length - 1];
        if (last && last.label === label) last.items.push(entry);
        else groups.push({ label, items: [entry] });
      }
      return groups;
    }

    function Skeleton() {
      return h(
        'div',
        { className: 'fs-skel' },
        h('div', { className: 'fs-skelRow' }),
        h('div', { className: 'fs-skelRow' }),
        h('div', { className: 'fs-skelRow' }),
      );
    }

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

      const shell = (...children) => h('div', { className: 'feiyu-root' }, h('div', { className: 'fs-shell' }, children));

      if (phase === 'loading') return shell(h(Skeleton), h('p', { className: 'fs-note' }, '翻档案…'));
      if (phase === 'error') {
        return shell(
          h(
            'div',
            { className: 'fs-empty', style: { marginTop: 40 } },
            h(Glyph, { name: 'spark', size: 26 }),
            h('p', null, `读不到档案：${error}`),
            h(
              'button',
              {
                type: 'button',
                className: 'fs-btn fs-btn--sm',
                style: { marginTop: 12 },
                onClick: () => setTick((n) => n + 1),
              },
              '再试一次',
            ),
          ),
        );
      }

      const d = state || {};
      const facts = d.facts || {};
      const diary = d.diary || [];
      const groups = groupByDay(diary);

      // 状态小标签：数量进上面的数字块，这里只留"要留神"的那些。
      const chips = [];
      if (facts.nickname) chips.push({ text: `他管我叫「${facts.nickname}」` });
      if (d.degraded) chips.push({ text: '档案只读', warn: true });
      if (d.trash > 0) chips.push({ text: `回收站 ${d.trash} 条` });

      const view = (key, ...children) =>
        h('div', { style: { display: tab === key ? 'block' : 'none' } }, children);

      return shell(
        // ── 头部 ──
        h(
          'header',
          { className: 'fs-hero' },
          h(
            'div',
            { className: 'fs-brand' },
            h('span', { className: 'fs-orb' }, h(Glyph, { name: 'fish', size: 25 })),
            h(
              'div',
              { className: 'fs-brandText' },
              h('h2', { className: 'fs-title' }, '属于我们的回忆'),
              h('p', { className: 'fs-sub' }, '他随口说的、我记下来的 —— 都在这里。'),
            ),
          ),
          h(
            'div',
            { className: 'fs-metrics' },
            h(
              'div',
              { className: 'fs-metric' },
              h('b', null, String(d.count || 0)),
              h('span', null, '共度时光 · 条'),
            ),
            facts.days > 0
              ? h(
                  'div',
                  { className: 'fs-metric' },
                  h('b', null, String(facts.days)),
                  h('span', null, '认识 · 天'),
                )
              : null,
          ),
          chips.length
            ? h(
                'div',
                { className: 'fs-chips' },
                chips.map((chip, i) => h(Chip, { key: i, warn: chip.warn }, chip.text)),
              )
            : null,
        ),

        // ── 出错横幅 ──
        //
        // 之前「忘掉」失败是**完全静默**的：服务端回 400/403，前端把 JSON
        // 当成功、刷新一遍、什么都没变 —— 用户只看到「点不动」。
        error !== '' ? h('p', { className: 'fs-banner' }, error) : null,

        h(Tabs, { tabs: TABS, value: tab, onChange: setTab }),

        // ── 回看：共度时光 ──
        //
        // **这一页只该是那串日记。** 2026-11-04 曾经把「最近写了什么」和
        // 「还常想起」铺在这一页顶上，结果是回看页和以前不是一个样子。
        view(
          'timeline',
          diary.length === 0
            ? h(Empty, { text: '还没有日记。多聊几句，我就会有东西可记。' })
            : groups.map((group) =>
                h(
                  'section',
                  { key: group.label },
                  h(
                    'div',
                    { className: 'fs-day' },
                    h('span', { className: 'fs-dayName' }, group.label),
                    h('span', { className: 'fs-dayCount' }, `${group.items.length} 条`),
                  ),
                  h(
                    'div',
                    { className: 'fs-rail' },
                    group.items.map((e) =>
                      h(Entry, { key: e.id, entry: e, onForget: forget, busy: busy === e.id }),
                    ),
                  ),
                ),
              ),
        ),

        // ── 本子：情感日记 + 人格手记 ──
        view(
          'books',
          h(Card, { plain: true }, h(FeelingsBox)),
          h(Card, { plain: true }, h(Notebook, { only: ['handnote', 'sticky', 'lesson'] })),
        ),

        // ── 体检：数账 + 回顾 ──
        view(
          'health',
          // 情感日记是四本账里唯一每轮注入为零的一份，而它最说明最近怎么样。
          d.feelings
            ? h(
                'div',
                { className: 'fs-card', style: { marginTop: 14 } },
                h(
                  'div',
                  { className: 'fs-cardHead' },
                  h(
                    'span',
                    { className: 'fs-cardTitle' },
                    [d.feelings.heading, d.feelings.sub].filter(Boolean).join(' · ') || '最近写的',
                  ),
                  h('span', { className: 'fs-grow' }),
                  h('span', { className: 'fs-cardHint', style: { margin: 0 } }, '今日一句'),
                ),
                h(
                  'p',
                  { className: 'fs-para', style: { margin: 0, color: C.text2, fontSize: 12.5 } },
                  d.feelings.body || '（这一段是空的）',
                ),
              )
            : null,
          // 还常想起的那几条：`recall_count` 唯一给用户看的地方。
          // 不排序、不加权，只列出来 —— 它不该影响召回，只该被看见。
          d.recalled && d.recalled.length > 0
            ? h(
                'p',
                { className: 'fs-note' },
                `还常想起：${d.recalled
                  .map((r) => `${r.text}${r.count > 1 ? `（${r.count} 次）` : ''}`)
                  .join('、')}`,
              )
            : null,
          // 我主动回去找过的那几条。跟上面不是同一笔账。
          d.revisited && d.revisited.length > 0
            ? h(
                'p',
                { className: 'fs-note fs-note--tiny' },
                `我回去找过：${d.revisited
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
              { className: 'fs-tiles' },
              h(
                'a',
                { className: 'fs-tile', href: `${API}/export`, download: '' },
                h('span', { className: 'fs-tileTitle' }, h(Glyph, { name: 'box' }), '导出档案'),
                h('span', { className: 'fs-tileDesc' }, '.dshpack · 换设备带它'),
              ),
              h(
                'a',
                { className: 'fs-tile', href: `${API}/backup`, download: '' },
                h('span', { className: 'fs-tileTitle' }, h(Glyph, { name: 'fish' }), '整包备份'),
                h('span', { className: 'fs-tileDesc' }, '.json · 存在 ~/.dsh/backups/'),
              ),
              h(
                'a',
                { className: 'fs-tile', href: `${API}/export-md`, download: '' },
                h('span', { className: 'fs-tileTitle' }, h(Glyph, { name: 'book' }), '导出成册'),
                h('span', { className: 'fs-tileDesc' }, '.md · 能直接读、能打印'),
              ),
              h(
                'a',
                {
                  className: 'fs-tile',
                  href: `${API}/export-year?year=${new Date().getFullYear()}`,
                  download: '',
                },
                h('span', { className: 'fs-tileTitle' }, h(Glyph, { name: 'arrow' }), `年册 ${new Date().getFullYear()}`),
                h('span', { className: 'fs-tileDesc' }, '.md · 只翻这一年'),
              ),
            ),
            h(
              'p',
              { className: 'fs-note fs-note--tiny' },
              '整包备份把四本账和人设卡收进一个 JSON；想要能直接读、能打印的，用「导出成册」。',
            ),
          ),
          h(Card, { title: '从备份恢复' }, h(ImportBox)),
          h(Card, { title: '云端备份（WebDAV）' }, h(CloudBox)),
        ),
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
