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

## 它从哪来

2026-10-31 收编自三个插件，行为不变、代码合一：

- [feiyu-memory](https://github.com/AirPineApplea/feiyu-memory) 4.0.2 —— 日记引擎（固化、召回、衰减、面板）
- `dsh-shallow-memory` —— 带 TTL 的浅层记忆
- `dsh-soul-md` 0.10.3 —— 人设卡与分层深层记忆

现在只剩一个包、一个数据目录、一份注入预算。

## 安装

```bash
# 从 GitHub 装
dsh plugin --profile web add github:<你的用户名>/dsh-hierarchical-fishmemory

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

## 工具

助手会自动调用；你也可以在对话里点名让它用：

| 工具 | 作用 |
| --- | --- |
| `fish_recall` | 按当时的原词搜**经过**（"上次那个报错"） |
| `memory_read(topic)` · `memory_append` · `memory_rewrite` · `memory_search` | 深层事实与坑，按主题取、按主题写 |
| `shallow_note` · `shallow_touch` · `shallow_list` · `shallow_forget` · `shallow_sweep` | 浅层记忆；再提到就自动续期 |
| `soul_read` · `soul_update` | 读 / 改当前人设卡 |
| `fish_backup` · `fish_restore` | 整包备份与还原 |

## 面板

侧栏「**属于我们的回忆**」，设置页里也有同名入口（与「模型」「插件」并列）：

- 共度时光、情感日记、人格手记的读写与预览
- 人设卡编辑（多张，按会话或工作区切换）
- **整包备份（.json）**：四本账 + 人设卡打成一个文件，带去另一台设备就能接着聊
- **导入备份（.json）**：先预览「会覆盖几个文件、合并几张卡」，确认才写；写前自动存一份
  `-before-restore.json` 快照

## 备份与还原

```
fish_backup({ note: "换设备前" })
→ ~/.dsh/backups/备份-20261031-120000-换设备前.json

fish_restore({ file: "备份-20261031-120000-换设备前.json" })        # dry-run，只报告
fish_restore({ file: "...", confirm: true })                      # 真写
```

备份是**纯 UTF-8 JSON**，没有插件也能用记事本打开看。文件名里的时间是 UTC。

## 开发

```bash
npm test                  # 16 项：手记解析、浅层 TTL、备份/还原
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
