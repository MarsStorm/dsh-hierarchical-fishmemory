# 属于我们的回忆 · dsh-hierarchical-fishmemory

一个 [DeepSeek Harness](https://github.com/deepseek-ai)（DSH）插件：给助手一套**分层记忆**，让它一周后还认得你。

不是把聊天记录塞进向量库，而是像人那样**分层地记、挑选地记、然后忘掉不重要的**——
该久的久，该忘的忘，该给人看的给人看。

## 它解决什么问题

- **上下文一压缩，前面聊的全丢**：所以要有磁盘上的账本，下一轮还能翻出来。
- **什么都记，等于什么都记不住**：所以有重要度、有衰减、有「这一条只热七天」。
- **一整套记忆塞进 prompt，贵得离谱**：所以常驻的只有几千 token，其余按需 `memory_read` / `fish_recall` 取。

```
浅层记忆   随口一句有丁点价值就记下，7 天没人再提就自动清掉
   ┃
人格手记   我是什么样的人、留给下一棒的话（每轮全量注入）
   ┃
共度时光   发生过什么：谁说了什么、事情怎么走（自动抽取，会随时间衰减）
情感日记   我怎么想、喜不喜欢、当时什么心情（手写，不衰减）
   ┃
人格档案   人设卡 + 深层记忆（core 每轮注入，topics 按需翻）
```

| 这一本 | 管什么 | 谁写 | 会不会丢 |
| --- | --- | --- | --- |
| **共度时光** | 经过：事件、原话、结果 | 插件从对话里自动固化 | 随重要度衰减，不删 |
| **情感日记** | 感受：喜欢什么、在意什么、当时的情绪 | 助手手写 | 不丢，不衰减 |
| **人格手记** | 性格底色 + 给下一棒的话 | 助手手写 | 不丢（单行 240 字截断） |
| **深层记忆** | 长期事实与规矩，可按主题分抽屉 | 助手手写 | 不丢；超注入上限才不注入 |
| **浅层记忆** | 只热几天的小事 | 助手随手记 | **7 天不提就清掉** |
| **人格档案** | 人设卡，可多张，按会话/工作区切换 | 你在设置页写 | 不丢 |

## 功能一览

### 一、自动记（不用你操心）

- **每轮固化**：聊完由模型判断「这段值不值得记」，只写**经过**，不写心情；寒暄与试错直接丢（`skip`）。
- **重要度与衰减**：每条带 `salience`，每天乘 0.9（性格特质 0.97），**只影响排序，不删条目**。
- **关系状态**：称呼、熟悉度、口头禅与梗，单独一份 `relationship.json` / `lexicon.json`。
- **浅层记忆**：一点价值就先记，7 天不提自动过期；你再说起它，自动续期并重置倒计时。
- **快到的日子**：`dates.json` 里写纪念日（`{name, month, day}`），7 天内每轮注入一行提醒，按 UTC+8 切日。
- **今天还没写**：当天没有 `## YYYY-MM-DD` 那一节，注入末尾轻轻提一句。读不到日记也不会挡记忆。

### 二、主动查（翻旧账）

- `fish_recall`：按**当时的原词**搜经过，可以限定 `since` / `until` 只看某段时间。被 `fish_compact` 折掉的原文也一并翻 —— 命中的会标「（旧档案）」，不会跟昨天的事混在一起。
- `memory_read(topic)`：深层记忆分「常驻的 core」与「按需翻的 topics」，体系化的坑不会挤占每轮预算。
- `shallow_list`：浅层的账，末尾还会给出「最近清掉的」几条——那是升级的最后机会。

### 三、整理与压缩（账本会老，得收拾）

- `fish_compact`：把 45 天前的共度时光按月折成摘要，原文归档到 `diary/archive/YYYY-MM.jsonl`，注入池里只留摘要。**归档不等于删除** —— `fish_recall` 会回去翻，命中标注「（旧档案）」。
- `trash_list` / `trash_restore`：回收站。忘掉一条、删掉记忆层里的一行、手记被整篇覆盖之前，都会先在这儿留一份，30 天。
- `shallow_promote`：浅层快到期时把它升格成共度时光或深层记忆，然后从浅层删掉——不用等它默默消失。
- `fish_layer_check`：体检「同一句写了两遍」（深层 / 手记 / 情感日记 / 浅层）与「同一样东西写了两个值」（端口、版本）。
- `loop_add` / `loop_done` / `loop_list`：答应过、挂着没做的事记一笔，每轮注入「还挂着 N 件事」。**只摆出来、不自动销账**——误杀比漏记更让人不敢信。

### 四、备份与搬家

- `fish_backup`：四本账 + 人设卡打成一个 UTF-8 JSON，没有插件也能用记事本打开。
- `fish_restore`：默认 **dry-run**，只报告「会写几个文件、合并几张卡」；真写前先拍一份 `-before-restore.json` 快照。
- `mode: "merge"`：只把共度时光与浅层并进来，同 id 保留本地那份、冲突单独报出来；深层记忆、情感日记、人格手记不覆盖。
- `fish_cloud_backup`：推到自己的 WebDAV（坚果云 / Nextcloud / 群晖 / iCloud 都行），按 `webdavKeep` 自动清理旧份；备份默认 gzip，九万多字节压到三万八。
- 云端恢复：列出网盘上的 `备份-*.json(.gz)`，先预览再确认；只认 `备份-` 前缀，别的东西不会被误当备份。

### 五、人设卡

- 可多张，按会话或工作区切换；每次 `soul_update` 覆盖前自动留一版到 `~/.dsh/backups/cards/`。
- `fish_card_history` 列版本，`fish_card_diff` 看逐行差异，`fish_card_restore` 退回任一旧版（默认 dry-run）。
- 人设卡是 volatile 配置，改完**下一轮就生效**，不用重启。

### 六、界面

侧栏「**属于我们的回忆**」：顶部一行小标签（共度时光多少条、认识多少天、他怎么叫你），下面四个页签——

| 页签 | 内容 |
| --- | --- |
| **回看** | 共度时光按天铺开，每条可展开原话与心情 |
| **本子** | 人格手记与情感日记的编辑器（保存前先存快照） |
| **体检** | 四本账各多少、每轮注入多少 token、重复句与矛盾值，**能直接删、能直接统一** |
| **档案** | 带走（`.dshpack` / `.json` / 成册 `.md` / 年册）、从备份恢复、云端备份 |

设置页「属于我们的回忆」（与「模型」「插件」并列）三个页签：**人设卡 / 长期记忆 / 云端备份**。

页签全部用 `display` 切换、视图始终挂载：切页不重拉数据，正在编辑的草稿也不会丢。

## 原理

一句话：**不是把聊天记录塞进上下文，而是把一整套记忆压进几千 token，剩下的留在磁盘上等被翻出来。**

### 每轮往 prompt 里放什么

| 顺序 | 注入节 | 内容 | 特点 |
| --- | --- | --- | --- |
| 0 | `soul:persona` | 人设卡正文 | 改卡下一轮生效，不用重启 |
| 0.5 | `soul:memory` | 深层 `core.md` + topic 索引 | topic 正文按需 `memory_read` 取，不占常驻预算 |
| 0.55 | `shallow:memory` | 浅层条目，一行一条 | 空库整节不出现，零噪音 |
| 100 | `fish:memory` | 关系状态、最近日记、随手召回、人格手记、今日提醒、快到的日子、挂起事项 | 受 `budgetTokens`（默认 2000）硬约束 |

预算封顶的意思是：聊一百句和聊十句，注入成本一样。

**最近 8 条日记不常驻。** 只在新会话第一轮、以及上下文被压缩之后整段重灌一次（`pinRecent`）。平时「记得刚才聊了什么」靠模型自己的上下文，不靠每轮重复灌。

### 日记是事后收缩，不是实时记录

每轮结束后，插件把这一段交给模型做一次**固化**：输入最近几轮原文，输出一段严格 JSON：

```json
{ "skip": false,
  "diary": { "text": "...", "kind": "...", "salience": 0.8 },
  "relationship": { "nickname": "", "familiarityDelta": 0.02 },
  "forget": [] }
```

- `skip: true` 是常态。寒暄、没有信息量的一问一答直接丢，不生成日记。
- `salience < minSalience`（默认 0.15）的不进档。
- 固化的提示词**只写经过**：谁说了什么、我做了什么、结果落在哪。心情不归它写。
- 固化可以单独指定模型与速度档，不跟聊天抢同一套配置。

### 记忆会衰减，但不会被删

`salience` 每天乘 0.9（性格特质 0.97），有下限。**衰减只影响排序和召回，不删条目。** 真要删只能人手动删 `diary/*.jsonl` 里那一行。

这是有意的：半年前那件小事，不会因为你三个月没提起它就消失。

### 浅层是唯一会自动消失的一层

TTL 默认 7 天，规则很短：

- 助手觉得有一点价值就记下；同 key 再记一次 = 覆盖正文 + 倒计时重置。
- 你后来提到它的 key 或 tags（正文里出现即可）→ 自动续期。
- 到期没再提 → 移入 `expired`（只留最近 20 条），从注入里消失。

容量上限 12 条 / 1400 字，满了挤掉最旧的并标记 `reason: capacity`。它**不会自动升级**进深层或日记——那需要助手自己回头看一眼（`shallow_list` 给尾巴，`shallow_promote` 给手动升格的口子）。

### 人格手记为什么要限行

手记每轮**全量**注入，所以条数越多越贵；但它写的是「这个人是什么样」，不适合随便裁剪。折中方式是**只限单行长度**：一行 240 字，超了截断成 `…`。没有条数上限。

手记有一个副作用要注意：它也会作为「用户自己说过的话」进到固化判断的输入里。所以那里写事实、写纪律，会让判官把规矩当成素材——手记只该写性格和嘱托。

### 为什么是一个包、两个 cordis 入口

三块能力原本是三个插件，各自有配置命名空间、各自占一份注入预算。收编后仍保留两个入口：

- `dsh-hierarchical-fishmemory` —— 日记引擎、浅层、人格手记、挂起事项、备份
- `dsh-hierarchical-fishmemory/soul` —— 人设卡、深层记忆（`core` + `topics`）

原因是**配置绑定**：cordis 会把 config 里的 volatile 字段绑成活动引用，人设卡改了下一轮就生效。如果改成在同一个 `apply` 里传普通对象，那个引用就被冻住，设置页改卡、`soul_update` 都会失效。用两个入口 = 两边都保持独立安装时的行为，零风险。

浏览器侧则必须合成一个：模块身份就是包名，一个包只能有一次 `window.__ModuleLoader__.load(...)`。所以两份 UI 在 `tools/build-client.mjs` 里被拼成一个 `dist/client.js`——这也是它算生成物、不能手改的原因。

### 备份为什么默认 dry-run

一个 JSON 装下四本账和人设卡，还原会覆盖磁盘上的日记、手记、深层记忆。误操作代价太大，所以：

1. 不带 `confirm` → 只报告「会写几个文件、合并几张卡」，一个字节都不动；
2. 带 `confirm` → **先给当前状态拍一份 `-before-restore.json` 快照**，再写。

备份文件是纯 UTF-8 JSON，没有这个插件也能用记事本打开。

## 安装

```bash
# 从 GitHub 装（这就是本仓库的正式地址，直接复制就能用）
dsh plugin --profile web add github:MarsStorm/dsh-hierarchical-fishmemory

# 或者本地开发（改完直接生效，不用重装）
dsh plugin --profile web add link:/abs/path/to/dsh-hierarchical-fishmemory
```

> 如果你的 profile 里还有 `@local/*`（本地 link 的包）：旧版 DSHBox 的 `dsh plugin add`
> 会跑 pnpm 把它们剪掉；DSHBox v1.5.1 起随包插件已写进 profile 的 `dependencies`，不再有这个问题。
> 真遇到 `@local/*` 回不来，仓库根目录的恢复脚本（`profiles/web/.restore-local.sh`）是安全网。

装完**重启 Harness**：服务端要重新加载，客户端 bundle 也要重新拉。档案目录会自动创建：

```
~/.dsh/feiyu-diary/
├── 日记.md              ← 人看的视图（自动生成，改它没用）
├── diary/2026-10.jsonl  ← 真数据，一行一条，可手改、可删行
├── diary/archive/       ← 压缩后的原文归档（按月）
├── 鱼的日子.md           ← 情感日记（手写，无上限，插件不碰）
├── 手记.md               ← 人格手记（`- ` 开头，每轮全量注入）
├── shallow.json         ← 浅层记忆（每条带 expiresAt）
├── relationship.json    ← 关系状态
├── lexicon.json         ← 口头禅与梗
├── dates.json           ← 快到的日子（可选，自己写）
└── manifest.json        ← 版本与计数器

~/.dsh/soul-md/memory/<卡片名>/
├── core.md              ← 深层记忆，每轮注入
└── topics/*.md          ← 按主题翻的抽屉，用 memory_read(topic) 取
```

## 工具

助手会自动调用；你也可以在对话里点名让它用。

| 工具 | 作用 |
| --- | --- |
| `fish_recall` | 按当时的原词搜**经过**；支持 `since` / `until` 只看某段时间 |
| `fish_compact` | 把 45 天前的条目按月折成摘要，原文归档（`fish_recall` 仍能翻到） |
| `trash_list` · `trash_restore` | 回收站：删除与覆盖前留的底，留 30 天 |
| `fish_backup` · `fish_restore` | 整包备份与还原（`mode: "merge"` 只并共度时光与浅层） |
| `fish_cloud_backup` | 打一份新备份并上传到 WebDAV，顺带清理超额的旧份 |
| `fish_layer_check` | 层间重复句与同值冲突，只报告不改动 |
| `fish_card_history` · `fish_card_diff` · `fish_card_restore` | 人设卡版本历史、逐行差异、退回旧版 |
| `loop_add` · `loop_done` · `loop_list` | 挂起事项；每轮注入「还挂着 N 件事」 |
| `memory_read(topic)` · `memory_append` · `memory_rewrite` · `memory_search` | 深层事实与坑，按主题取、按主题写 |
| `soul_read` · `soul_update` | 读 / 改当前人设卡 |
| `shallow_note` · `shallow_touch` · `shallow_list` · `shallow_forget` · `shallow_sweep` | 浅层记忆；再提到就自动续期 |
| `shallow_promote` | 浅层升格成共度时光或深层记忆，成功后从浅层删掉 |

## 备份与还原

```
fish_backup({ note: "换设备前" })
→ ~/.dsh/backups/备份-20261031-120000-换设备前.json

fish_restore({ file: "备份-20261031-120000-换设备前.json" })        # dry-run，只报告
fish_restore({ file: "...", confirm: true })                      # 真写
fish_restore({ file: "...", confirm: true, mode: "merge" })        # 只并、不覆盖
```

文件名里的时间是 UTC。面板「档案 · 带走」可以一次导出三样：`.dshpack`（整包）、`.json`（备份）、`.md`（成册），外加按年份的**年册**。

### 云端备份（WebDAV）

填好 `webdavUrl` / `webdavUser` / `webdavPassword` 就能用。坚果云、Nextcloud、
群晖、iCloud（`dav` 入口）都行 —— 走标准 WebDAV，不依赖任何 SDK。

```
fish_cloud_backup({ note: "出差前" })
→ 已传到云端：备份-20261031-120000-出差前.json.gz（39 KB）
   https://dav.example.com/dav/属于我们的回忆/备份-20261031-120000-出差前.json.gz
```

面板里也有「上传到云端」按钮，并显示上次上传时间。`webdavAuto: true` 时，每次写完日记
顺手推一份，**5 分钟内只推一次**（网盘会限流）。

恢复走另一条路：面板「档案 · 云端备份」→ 看看云端有哪些 → 选一份 → 预览 → 确认。接口是
`GET /feiyu-diary/cloud/backups` 与 `POST /feiyu-diary/cloud/restore`（只认 `备份-` 前缀；
不带 `confirm` 就只报告不动手）。

三个设计取舍：

- **失败不影响聊天**：上传永远在写盘落定之后、fire-and-forget，失败只写警告。
- **备份在服务端生成**：人设卡与深层记忆只有插件读得到，浏览器拼不出来。
- **保留份数由 `webdavKeep` 管**：靠 `PROPFIND` 列目录删最旧的；网盘禁了 `PROPFIND`
  就退化成「不清理」，不会让上传整体失败。

## 更新记录（1.3.0 → 1.9.0）

逐条的「为什么」在 [CHANGELOG.md](./CHANGELOG.md)；这里只列每一次动了什么。

| 版本 | 一句话 |
| --- | --- |
| **1.9.1** | 判定层看得见「我这一轮做了什么」—— 他只说「继续」而我干了一整晚，从前一律判「不记」；补 4 项测试（196 → 200） |
| **1.9.0** | 压缩后仍能翻到原文、回收站（`trash_list` / `trash_restore`）、召回过的衰减更慢、面板顶上铺情感日记那一行、日志轮转；补九个模块的测试（87 → 196） |
| **1.8.2** | 市场卡片简介改写；设置页「当前默认卡」徽章改成真下拉 |
| **1.8.0** | 今日提醒、浅层升格、召回按时间段、年册导出；修死配置、关掉情感日记的第二个写口、统一 token 估算 |
| **1.7.0** | 界面重做：面板拆成回看/本子/体检/档案，设置页拆成人设卡/长期记忆/云端，合并重复编辑口 |
| **1.6.3** | 体检第二轮：读盘工具去重、删掉被覆盖的 `/handnote/delete`，净减 116 行 |
| **1.6.2** | 情感日记能在面板里改（写前存快照）；体检页能动手删重复句、统一矛盾值 |
| **1.6.1** | 启动日志的面板路由清单改成从 `routes` 现算，不再手写漏项 |
| **1.6.0** | 快到的日子（`dates.json`）、导出成册（`.md`） |
| **1.5.0** | 合并还原（`mode: "merge"`）、层间体检 `fish_layer_check` |
| **1.4.0** | 记忆压缩 `fish_compact`、挂起事项 `loop_*` |
| **1.3.1** | 浅层到期提醒进注入、人设卡版本 diff、体检页可删重复手记行 |
| **1.3.0** | 云端备份默认 gzip、记忆体检页、回顾最近七天、人设卡版本历史 |

更早（1.2.x 及之前的日记引擎）见 CHANGELOG 末尾。

## 配置

所有选项都在 [`cordis.patch.yml`](./cordis.patch.yml)，每一行注释都写了「为什么是这个默认值」。常改的几个：

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `dataDir` | `~/.dsh/feiyu-diary` | 档案目录；想放同步盘就写绝对路径 |
| `budgetTokens` | `2000` | 每轮注入预算，成本封顶，与聊多久无关 |
| `reasoningEffort` | `off` | **别改**。跟随聊天档位会让固化把 token 全烧在思考上、正文一个字不产出（症状：600 个 chunk / 0 字符） |
| `model` | `''` | 固化用模型，留空跟随默认。建议用便宜档 |
| `includePersona` | `false` | 本包已有人设卡入口，再开就是两份人格同时进 prompt |
| `minSalience` | `0.15` | 日记重要度门槛；调高会连带扔掉寒暄和试错，那些恰恰是「熟悉感」的原料 |
| `webdavUrl` | `''` | WebDAV 服务器地址（如 `https://dav.jianguoyun.com/dav/`）；留空＝不开云端备份 |
| `webdavUser` / `webdavPassword` | `''` | 账号与密码（或应用专用密码）；**明文存在本机配置里** |
| `webdavDir` | `属于我们的回忆` | 云端目录名，不存在会逐级 `MKCOL` 建 |
| `webdavAuto` | `false` | 写完日记顺手推一份；有 5 分钟节流 |
| `webdavKeep` | `10` | 云端保留多少份（1–200），超了删最旧的 |
| `webdavEnabled` | `true` | 总开关 |

## 开发

```bash
npm test                  # 87 项：固化、召回、手记、浅层 TTL、压缩、备份/还原、WebDAV、渲染冒烟
npm run build:client      # 改了 src/client/ 或 src/soul/client.js 后必须跑
npm run check:client      # 校验 dist/client.js 与源一致
```

**`dist/client.js` 是生成物，别手改。** 浏览器模块身份 = 包名，所以两个 cordis 入口的 UI 半边
在 `tools/build-client.mjs` 里合并成一次 `window.__ModuleLoader__.load(...)`。

`test/client-render.test.mjs` 会真渲染两个界面（用 React 桩、跑三轮、真执行 effect），
断言关键组件都出现过——它抓到过「页签只收一个子节点、后面的卡被静默丢弃」这种只有真渲染才看得见的错。

## 已知限制

- 共度时光的时间戳用**进程本地时间**（UTC 机器上就是 UTC）；日期类功能（今日提醒、快到的日子、年册）按 UTC+8 切日。
- 浅层记忆过期**不会自动升级**，要么助手 `shallow_list` 看见尾巴、`shallow_promote` 手动升，要么就过期。
- 云端恢复是整包覆盖或按 id 合并，没有逐条挑拣。
- 本包不再跟上游升级；收编时的行为差异与取舍见 [CHANGELOG](./CHANGELOG.md)。

## 许可证

MIT。日记引擎的设计与大部分文档来自上游 [feiyu-memory](https://github.com/AirPineApplea/feiyu-memory)（作者：空气凤梨），
本包在其基础上做了收编与改造；原始设计长文保留在 [docs/upstream-design.md](./docs/upstream-design.md)。

> 本项目不包含任何第三方美术素材。相关背景说明见 [LICENSE](./LICENSE) 末尾。
