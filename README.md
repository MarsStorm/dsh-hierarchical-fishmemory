# 属于我们的回忆 · dsh-hierarchical-fishmemory

一个 [DeepSeek Harness](https://github.com/deepseek-ai)（DSH）插件：给助手一套**分层记忆**，让它在一周后还认得你。

不是把聊天记录塞进向量库，而是像人那样**分层地记、挑选地记、然后忘掉不重要的**——
该久的久，该忘的忘，该给人看的给人看。

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

## 最近更新

- **1.3.0**：云端备份默认 gzip（`备份-….json.gz`，九万多字节压到三万八）；面板加「记忆体检」与「回顾最近七天」；人设卡每次改动自动留一版，新增 `fish_card_history` / `fish_card_restore`。

**1.2.x（2026-10-31）—— 云端备份与搬家**

- **WebDAV 云端备份**：把整份备份推到自己的网盘（坚果云 / Nextcloud / 群晖 / iCloud 都行），按保留份数自动清理旧份；有面板按钮、`fish_cloud_backup` 工具和可选的自动上传。
- **测试连接**：保存配置之前就能用草稿试一次「建目录 + 列目录」，401 / 403 / 404 / 域名解析失败 / 超时都翻成人话。
- **从云端恢复**：列出网盘上的 `备份-*.json`，先预览「会覆盖几个文件、合并几张卡」，确认后才拉下来还原。
- **设置页入口**：设置 → 属于我们的回忆，里面有人设卡、记忆选项和完整的云端配置表单（密码只上行不下行）。
- **修复**：一个未定义变量导致整张设置页白屏；云端表单现在套了错误边界，它自己的毛病不再拖垮整页。
- **体检**：删掉 4 个从未被调用的导出、去掉从未生效过的 `offPeakHours` / `deferToOffPeak`，文件名常量收拢到一处。

更早的版本与逐条改动见 [CHANGELOG.md](./CHANGELOG.md)。

## 原理

一句话：**不是把聊天记录塞进上下文，而是把一整套记忆压进几千 token，剩下的留在磁盘上等被翻出来。**

### 每轮往 prompt 里放什么

| 顺序 | 注入节 | 内容 | 特点 |
| --- | --- | --- | --- |
| 0 | `soul:persona` | 人设卡正文 | 改卡下一轮生效，不用重启 |
| 0.5 | `soul:memory` | 深层 `core.md` + topic 索引 | topic 正文按需 `memory_read` 取，不占常驻预算 |
| 0.55 | `shallow:memory` | 浅层条目，一行一条 | 空库整节不出现，零噪音 |
| 100 | `fish:memory` | 关系状态、最近日记、随手召回、人格手记 | 受 `budgetTokens`（默认 2000）硬约束 |

预算封顶的意思是：聊一百句和聊十句，注入成本一样。

**最近 8 条日记不常驻。** 只在新会话第一轮、以及上下文被压缩之后整段重灌一次（`pinRecent`）。平时"记得刚才聊了什么"靠模型自己的上下文，不靠每轮重复灌。

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

容量上限 12 条 / 1400 字，满了挤掉最旧的并标记 `reason: capacity`。**它不会自动升级**进深层或日记——那需要助手自己回头看一眼，`shallow_list` 会给出"最近清掉"的尾巴。

### 人格手记为什么要限行

手记每轮**全量**注入，所以条数越多越贵；但它写的是"这个人是什么样"，不适合随便裁剪。折中方式是**只限单行长度**：一行 240 字，超了截断成 `…`。没有条数上限。

手记有一个副作用要注意：它也会作为"用户自己说过的话"进到固化判断的输入里。所以那里写事实、写纪律，会让判官把规矩当成素材——手记只该写性格和嘱托。

### 为什么是一个包、两个 cordis 入口

三块能力原本是三个插件，各自有配置命名空间、各自占一份注入预算。收编后仍保留两个入口：

- `dsh-hierarchical-fishmemory` —— 日记引擎、浅层、人格手记、备份
- `dsh-hierarchical-fishmemory/soul` —— 人设卡、深层记忆（`core` + `topics`）

原因是**配置绑定**：cordis 会把 config 里的 volatile 字段绑成活动引用，人设卡改了下一轮就生效。如果改成在同一个 `apply` 里传普通对象，那个引用就被冻住，设置页改卡、`soul_update` 都会失效。用两个入口 = 两边都保持独立安装时的行为，零风险。

浏览器侧则必须合成一个：模块身份就是包名，一个包只能有一次 `window.__ModuleLoader__.load(...)`。所以两份 UI 在 `tools/build-client.mjs` 里被拼成一个 `dist/client.js`——这也是它算生成物、不能手改的原因。

### 备份为什么默认 dry-run

一个 JSON 装下四本账和人设卡，还原会覆盖磁盘上的日记、手记、深层记忆。误操作代价太大，所以：

1. 不带 `confirm` → 只报告"会写几个文件、合并几张卡"，一个字节都不动；
2. 带 `confirm` → **先给当前状态拍一份 `-before-restore.json` 快照**，再写。

备份文件是纯 UTF-8 JSON，没有这个插件也能用记事本打开。

## 它从哪来

2026-10-31 收编自三个插件，行为不变、代码合一：

- [feiyu-memory](https://github.com/AirPineApplea/feiyu-memory) 4.0.2 —— 日记引擎（固化、召回、衰减、面板）
- [dsh-shallow-memory](https://github.com/MarsStorm/dsh-shallow-memory) —— 带 TTL 的浅层记忆
- `dsh-soul-md` 0.10.3 —— 人设卡与分层深层记忆

现在只剩一个包、一个数据目录、一份注入预算。

## 安装

```bash
# 从 GitHub 装（这就是本仓库的正式地址，直接复制就能用）
dsh plugin --profile web add github:MarsStorm/dsh-hierarchical-fishmemory

# 或者本地开发（改完直接生效，不用重装）
dsh plugin --profile web add link:/abs/path/to/dsh-hierarchical-fishmemory
```

> ⚠️ 如果你的 profile 里还有 `@local/*`（本地 link 的包），`dsh plugin add` 会跑 pnpm
> 把它们剪掉；装完记得跑你自己那份 `.restore-local.sh`（如果有）。

装完**重启 Harness**：服务端要重新加载，客户端 bundle 也要重新拉。档案目录会自动创建：

```
~/.dsh/feiyu-diary/
├── 日记.md              ← 人看的视图（自动生成，改它没用）
├── diary/2026-10.jsonl  ← 真数据，一行一条，可手改、可删行
├── 鱼的日子.md           ← 情感日记（手写，无上限，插件不碰）
├── 手记.md               ← 人格手记（`- ` 开头，每轮全量注入）
├── shallow.json         ← 浅层记忆（每条带 expiresAt）
├── relationship.json    ← 关系状态
├── lexicon.json         ← 口头禅与梗
└── manifest.json        ← 版本与计数器

~/.dsh/soul-md/memory/<卡片名>/
├── core.md              ← 深层记忆，每轮注入
└── topics/*.md          ← 按主题翻的抽屉，用 memory_read(topic) 取
```

## 配置

所有选项都在 [`cordis.patch.yml`](./cordis.patch.yml)，每一行注释都写了"为什么是这个默认值"。常改的几个：

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `dataDir` | `~/.dsh/feiyu-diary` | 档案目录；想放同步盘就写绝对路径 |
| `budgetTokens` | `2000` | 每轮注入预算，成本封顶，与聊多久无关 |
| `reasoningEffort` | `off` | **别改**。跟随聊天档位会让固化把 token 全烧在思考上、正文一个字不产出（症状：600 个 chunk / 0 字符） |
| `model` | `''` | 固化用模型，留空跟随默认。建议用便宜档 |
| `includePersona` | `false` | 本包已有人设卡入口，再开就是两份人格同时进 prompt |
| `minSalience` | `0.15` | 日记重要度门槛；调高会连带扔掉寒暄和试错，那些恰恰是"熟悉感"的原料 |
| `webdavUrl` | `''` | WebDAV 服务器地址（如 `https://dav.jianguoyun.com/dav/`）；留空＝不开云端备份 |
| `webdavUser` / `webdavPassword` | `''` | 账号与密码（或应用专用密码）；**明文存在本机配置里** |
| `webdavDir` | `属于我们的回忆` | 云端目录名，不存在会逐级 `MKCOL` 建 |
| `webdavAuto` | `false` | 写完日记顺手推一份；有 5 分钟节流 |
| `webdavKeep` | `10` | 云端保留多少份（1–200），超了删最旧的 |
| `webdavEnabled` | `true` | 总开关 |

## 工具

助手会自动调用；你也可以在对话里点名让它用：

| 工具 | 作用 |
| --- | --- |
| `fish_recall` | 按当时的原词搜**经过**（"上次那个报错"） |
| `memory_read(topic)` · `memory_append` · `memory_rewrite` · `memory_search` | 深层事实与坑，按主题取、按主题写 |
| `shallow_note` · `shallow_touch` · `shallow_list` · `shallow_forget` · `shallow_sweep` | 浅层记忆；再提到就自动续期 |
| `soul_read` · `soul_update` | 读 / 改当前人设卡 |
| `fish_backup` · `fish_restore` | 整包备份与还原 |
| `fish_cloud_backup` | 打一份新备份并上传到 WebDAV，顺带清理超额的旧份 |
| `fish_card_history` | 列出当前人设卡保存过的版本（每次改动前自动留一份） |
| `fish_card_restore` | 从某一版还原人设卡；默认 dry-run，确认后写回，还原前再留一份 |

## 面板

侧栏「**属于我们的回忆**」，设置页里也有同名入口（与「模型」「插件」并列）：

- 共度时光、情感日记、人格手记的读写与预览
- 人设卡编辑（多张，按会话或工作区切换）
- **整包备份（.json）**：四本账 + 人设卡打成一个文件，带去另一台设备就能接着聊
- **导入备份（.json）**：先预览「会覆盖几个文件、合并几张卡」，确认才写；写前自动存一份
  `-before-restore.json` 快照
- **上传到云端**：把同一份备份推到 WebDAV，面板上能看到上次上传时间与失败原因
- **从云端恢复**：列出网盘上的 `备份-*.json`，先预览「会覆盖几个文件、合并几张卡」，
  确认后才下载并还原（同样先存 `-before-restore.json`）

## 备份与还原

```
fish_backup({ note: "换设备前" })
→ ~/.dsh/backups/备份-20261031-120000-换设备前.json

fish_restore({ file: "备份-20261031-120000-换设备前.json" })        # dry-run，只报告
fish_restore({ file: "...", confirm: true })                      # 真写
```

备份是**纯 UTF-8 JSON**，没有插件也能用记事本打开看。文件名里的时间是 UTC。

### 云端备份（WebDAV）

填好 `webdavUrl` / `webdavUser` / `webdavPassword` 就能用。坚果云、Nextcloud、
群晖、iCloud（`dav` 入口）都行 —— 走标准 WebDAV，不依赖任何 SDK。

```
fish_cloud_backup({ note: "出差前" })
→ 已传到云端：备份-20261031-120000-出差前.json（83 KB）
   https://dav.example.com/dav/属于我们的回忆/备份-20261031-120000-出差前.json
```

面板里也有「上传到云端」按钮，并显示上次上传时间。`webdavAuto: true` 时，每次写完日记
顺手推一份，**5 分钟内只推一次**（网盘会限流）。

恢复走另一条路：面板「看看云端有哪些记忆备份」→ 选一份 → 预览 → 确认。接口是
`GET /feiyu-diary/cloud/backups` 与 `POST /feiyu-diary/cloud/restore`（只认 `备份-` 前缀；
不带 `confirm` 就只报告不动手）。

三个设计取舍：

- **失败不影响聊天**：上传永远在写盘落定之后、fire-and-forget，失败只写警告。
- **备份在服务端生成**：人设卡与深层记忆只有插件读得到，浏览器拼不出来。
- **保留份数由 `webdavKeep` 管**：靠 `PROPFIND` 列目录删最旧的；网盘禁了 `PROPFIND`
  就退化成"不清理"，不会让上传整体失败。

## 开发

```bash
npm test                  # 25 项：手记解析、浅层 TTL、备份/还原、WebDAV
npm run build:client      # 改了 src/client/ 或 src/soul/client.js 后必须跑
npm run check:client      # 校验 dist/client.js 与源一致
```

**`dist/client.js` 是生成物，别手改。** 浏览器模块身份 = 包名，所以两个 cordis 入口的 UI 半边
在 `tools/build-client.mjs` 里合并成一次 `window.__ModuleLoader__.load(...)`。

## 已知限制

- 日记窗口的时间戳用**进程本地时间**（UTC 机器上就是 UTC），没有时区配置项。
- 浅层记忆过期**不会自动升级**进深层或日记，靠助手隔几天 `shallow_list` 看一眼尾巴。
- 本包不再跟上游升级；收编时的行为差异与取舍见 [CHANGELOG](./CHANGELOG.md)。

## 许可证

MIT。日记引擎的设计与大部分文档来自上游 [feiyu-memory](https://github.com/AirPineApplea/feiyu-memory)（作者：空气凤梨），
本包在其基础上做了收编与改造；原始设计长文保留在 [docs/upstream-design.md](./docs/upstream-design.md)。

> 本项目不包含任何第三方美术素材。相关背景说明见 [LICENSE](./LICENSE) 末尾。
