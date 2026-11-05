<h1 align="center">🛰️ dsh-agy-worker</h1>

<p align="center">
  <b>把 Google Antigravity（agy CLI）当作 DeepSeek Harness 里的 Worker</b><br/>
  A fork of <a href="https://github.com/amlyczz/dsh-agy-link">dsh-agy-link</a> tuned for <a href="https://github.com/SQDR2/dsh-fusion">dsh-fusion</a> as the Sidekick
</p>

<p align="center">
  <a href="https://github.com/SQDR2/dsh-agy-worker/actions/workflows/ci.yml"><img src="https://github.com/SQDR2/dsh-agy-worker/actions/workflows/ci.yml/badge.svg" alt="CI"/></a>
  <img src="https://img.shields.io/badge/license-MIT-lightgrey" alt="MIT"/>
  <img src="https://img.shields.io/badge/node-%3E%3D24-green" alt="node"/>
</p>

<p align="center">
  <b>🌐 Language / 语言：</b>
  <a href="#中文">中文</a> ·
  <a href="#english">English</a> ·
  <a href="./docs/README.en.md">English (standalone)</a>
</p>

---

# 中文

## 这个仓库是什么

`dsh-agy-worker` 是 [`amlyczz/dsh-agy-link`](https://github.com/amlyczz/dsh-agy-link) 的一个 **fork**。上游插件负责把 Google Antigravity 的模型接进 DeepSeek Harness（DSH）——多账号池化、配额监控、浏览器登录、流式与思考映射，这些能力本 fork 全部保留。

本 fork 只做一件事：**让 agy 真正能当一个「被调用方驱动」的 Worker**，也就是让 [`dsh-fusion`](https://github.com/SQDR2/dsh-fusion) 能把 **agy（Gemini / Claude / GPT-OSS）选作 Sidekick**，并且这一轮委派真的能跑通、能交回结果，而不是卡在「工具表里有名字，却永远没有一次调用」。

> 上游的 `dsh-agy-link` 名字、npm 包与仓库都不变。本仓库是独立发布线，npm 包名 `dsh-agy-worker`，内部路由前缀 `/plugins/agy-worker/*`，数据目录 `~/.dsh/agy-worker`。

---

## 为什么需要这个 fork

Fusion 的 Sidekick 是一轮「由调用方驱动的工具循环」：DSH 在请求里公布 Worker 的工具面（`workerTools` 加 `fusion_*`），期望模型**调用**它们。而 agy 是一条自带 agent loop 的 provider 路线——它不会直接回一个 `bash` 调用，它只会把这一步以**自己的传输名**报回来。

要让这条链路成立，需要**三个条件同时成立**，上游当时缺了其中两个，且失败方式全是静默的：

| 条件 | 作用 | 缺失时的现象 | 本 fork |
| --- | --- | --- | --- |
| `mcpBridge: true` | agy 能**执行** DSH 工具 | 工具可达但执行不到 | 默认开启 |
| 调用方工具面里有 `agy_tool` | agy 的**回传通道** | 适配器没有可发的 tool-call 块 → 整轮退化成纯文本，宿主报 `WORKER_TOOLS_UNREACHABLE` | 记一条 `no-tool-transport` 警告，指明要改的是调用方 |
| `permissionMode: 'skip'` | 让 MCP 调用**被允许** | agy 在 print 模式下自动拒绝：`a tool required the "mcp" permission that headless mode cannot prompt for` | `/agy status` 直接报出来 |
| `/tools` 按调用方 scope 列举 | `fusion_*` 能被**看见** | 列表里根本没有 `fusion_*`，任何 allowlist 都救不回来 | 已修 |

最后一条是根因级的：`fusion_*` **不是**注册在全局，而是注册在 Agent 自己的 scope 上（`agent.ctx.tools.register`）。而 bridge 的 `/tools` 之前调用不带参数的 `svc.schemas()`，DSH 的语义是**省略 scope = 只返回全局层**。allowlist 又是在**列出之后**才过滤的，所以写什么名字都只会得到空列表。

---

## 本 fork 相对上游的改动

| 提交 | 内容 |
| --- | --- |
| `fix(mcp-bridge): scope /tools to the calling agent` | `/tools` 与 `/call` 一样解析 `X-DSH-Session` 得到调用方 agent，并调用 `schemas(agent)`。会话 key 两种形态（顶层 `session-<uuid>` 与子 agent 的裸 `<uuid>`）都按原值优先解析，仅在解析不到时补 `session-` 前缀重试一次 |
| `feat(host): enable the MCP bridge by default and report unreachable tool tables` | `mcpBridge` 默认 `true`（`mcpBridge: false` / `DSH_AGY_MCP_BRIDGE=0` 仍可关闭）；调用方天花板里没有 `agy_tool` 时不再静默降级，改为每个会话记一条可执行的 `no-tool-transport` 警告；`/agy status` 新增桥接开关、桥接工具集、`permissionMode` 提示 |
| `feat(client): move the Antigravity console to a left-sidebar panel` | 控制台从「设置 → 齿轮」迁到左侧边栏独立面板（`sidebar.panellist` + `main` 页），复用同一个 `AgySettingsSection` |
| `feat(client): place the sidebar entry directly below 自动化任务` | `sidebar.panellist` 的 `order` 由 `100` 调整为 `20`，入口默认落在「自动化任务」（`order: 10`）下方、「更多」上方 |

此外本 fork 完成了整体改名：npm 包名 `dsh-agy-worker`、内部 id `agy-worker`、路由 `/plugins/agy-worker/*`。旧数据目录 `~/.dsh/agy-link` 会在首次启动时**自动迁移**到 `~/.dsh/agy-worker`（覆盖运行期覆盖项、会话映射、媒体缓存与预热历史；若新目录已存在则不做任何覆盖）。账号池目录 `~/.dsh/agy-accounts` 不变，**已登录的账号无需重新登录**。

---

## 与 dsh-fusion 配合使用

### 1. 在 Fusion 里把 agy 选作 Sidekick

装好两个插件后，打开左侧边栏的 **Fusion** 入口，把 Sidekick 选成一个 Antigravity 模型（Gemini / Claude / GPT-OSS 均可），Lead 照常选你的前沿模型。

### 2. 确认 Worker 的工具天花板包含回传通道

`agy_tool` 是 agy 唯一的回传通道。当前 `dsh-fusion` 会用 `withRouteTransport()` 在检测到 `antigravity` 路线已注册时**自动**把它加进天花板；若你的版本还没有这个机制，需要手动写：

```yaml
- id: dsh-model-fusion
  config:
    workerTools:
      - bash
      - read
      - write
      - edit
      - glob
      - grep
      - job_output
      - job_kill
      - agy_tool        # ← 回传通道，缺了就只有纯文本
```

> 适配器不会伪造这个工具：宿主没注册 `agy_tool` 时硬发会被拒为 `unknown tool "agy_tool"`，所以它选择停止按工具切分 span，并在日志里留一条 `no-tool-transport` 警告。

### 3. `permissionMode` 必须是 `skip`

这是最容易漏的一条，且没有任何配置项能隐含它：agy 在 print 模式下会把 MCP 调用**自动拒绝**，除非它被允许自动批准。`accept-edits`、`auto`、`plan` 在 headless 下都不行（已对 `agy` 1.4.12 实测，均以 `a tool required the "mcp" permission that headless mode cannot prompt for` 中止回合）。

要么 `permissionMode: skip`，要么在 `settings.json` 的 `permissions.allow` 里加一条 `mcp(<target>)` 规则。

### 4. 收窄 bridge 白名单

白名单**宁可偏窄**：它同时是执行期闸门（不在名单里的 `/call` 返回 403），也是防止被提示注入的 agy 子进程越权访问的唯一约束。

```yaml
mcpBridge: true
mcpConfigScope: global
mcpToolAllowlist: "fusion_submit_result,fusion_read_state,fusion_read_evidence,bash,read,write,edit,glob,grep,job_output,job_kill"
```

> Windows 把 `bash` 换成 `pwsh`；改过 `workerTools` 就跟着改。`mcpConfigScope` 保持 `global`——agy 1.4+ 只读全局注册表，写成 `workspace` 是「配了但不起作用」的常见原因。

完整配置面、验证步骤与排障对照见 **[docs/MCP-BRIDGE-SETUP.md](./docs/MCP-BRIDGE-SETUP.md)**。该文档按「已验证」的配置面写成，先读它的前置条件一节。

---

## 安装

> 🚨 **前置：系统代理 / TUN 模式必须开启。** Google Antigravity 服务与 OAuth 需要直连 `oauth2.googleapis.com`、`cloudcode-pa.googleapis.com` 等。推荐开启 Clash / Surge / v2rayA / Sing-box 的 **TUN 虚拟网卡模式**；若终端未被接管，启动 DSH 前先导出：
>
> ```bash
> export HTTPS_PROXY=http://127.0.0.1:7890 HTTP_PROXY=http://127.0.0.1:7890 ALL_PROXY=socks5://127.0.0.1:7890
> ```
>
> 端口请换成你本地代理的实际端口。也可以在控制台卡片上点「🌐 代理」为**单个账号**配置独立出口。

| 前置项 | 验证方式 |
| --- | --- |
| **DeepSeek Harness (DSH)** | `dsh --version` |
| **Node.js ≥ 24** | `node --version` |
| **Google Antigravity `agy` CLI** | 按 [Google 官方文档](https://antigravity.google/docs/cli/install) 安装；`agy --version` 能输出版本号即可 |

```bash
# 方式 A（推荐）：从 npm 安装，包内含预构建产物，无需本地编译
dsh plugin --profile web add dsh-agy-worker

# 方式 B：从 GitHub 安装（pnpm 会执行 prepare 脚本自动构建）
dsh plugin --profile web add github:SQDR2/dsh-agy-worker

# 方式 C：本地已 clone 的目录
git clone https://github.com/SQDR2/dsh-agy-worker.git ~/github/dsh-agy-worker
cd ~/github/dsh-agy-worker && npm ci && npm run build && cd -
dsh plugin --profile web add ~/github/dsh-agy-worker

# 安装完成后启动 DSH Web GUI
dsh web
```

首次进入后：

```bash
# 检查插件、agy 版本、桥接状态与额度
/agy status

# 添加账号：点顶部 "AGY (n)" 徽标 → 「➕ 添加账号」，浏览器一键登录
# 或为主账号发起登录：
/agy auth

# 然后在 /model 选择器里挑一个 Antigravity 模型
```

> 💡 agy 尚未登录也能直接装插件——登录在 GUI 里完成，全程无需手动复制粘贴授权码。

---

## 全部功能

上游能力本 fork 完整保留。

| 能力 | 说明 |
| --- | --- |
| 👥 **多账号池化轮换** | 主账号 + 任意数量备用账号；429 或配额耗尽时自动平滑接力，对话不中断；额度到期早的账号优先接班 |
| 📊 **官方多 Bucket 配额监控** | 直连 `v1internal:retrieveUserQuotaSummary`，同时呈现 **5h 滚动额度**、**7 天周额度**与付费账号专属的 **Argon 独立周池**，含重置倒计时 |
| 🔑 **GUI 内浏览器免粘贴登录** | 点「➕ 添加账号」自动调起系统浏览器，本地回环监听捕获授权凭证，零复制粘贴 |
| 🔌 **原生模型路由** | 在 DSH 注册 `antigravity` 提供方，`/model` 里随心切换 Gemini / Claude / GPT-OSS / Argon |
| 🌊 **完整流式映射** | 文本、思考过程（thinking turn）与工具活动无损映射到 DSH 原生流协议 |
| 🃏 **原生工具卡片** | agy 执行的终端命令、文件修改渲染为 DSH 原生卡片；MCP 元工具（`call_mcp_tool` 等）会拆包为终端 / 搜索卡片 |
| 🔗 **会话上下文保真** | DSH 会话与 agy 原生会话绑定（`--conversation`），历史由 agy 管理，每轮只发增量 |
| ⚡ **原生上下文缓存计量** | 完整映射 Gemini 原生缓存协议（`cache_read_tokens`），适配 1M 上下文 |
| 🧠 **抖动安全鉴权** | 基于 agy 运行日志的 `keyringAuth` 传输证据区分「网络抖动」与「真登出」，抖动按可重试网络错误处理；粘性隔离需二次确认 |
| ⚡ **分模型族独立冷却** | Gemini / Claude / GPT-OSS / Argon 的速率限制独立计算，一族受限不影响其他族 |
| 🌐 **独立账号代理** | 每账号可绑独立 HTTP(S) / SOCKS 代理；未配置时自动探测系统代理 |
| 🚀 **副账号并发租约** | Windows 凭据槽支持同一副账号多会话共享租约并发，仅跨账号身份切换时串行 |
| 🎯 **DSH 目标与计划集成** | 长任务自动携带 DSH goal / plan 上下文，工具续跑不丢任务状态 |
| 🖼 **图片多模态** | 图片落盘本地媒体目录，经 `--add-dir` 安全授权给 agy |
| 🤝 **`agy_ask` 委派工具** | 允许任意 DSH 模型把单次任务委托给 Antigravity 模型 |
| 🎛 **左侧边栏控制台** | 侧边栏入口（默认在「自动化任务」下方）+ 顶部 `AGY (n)` 徽标，账号池、配额进度条与代理状态一处可见 |
| ⌨️ **`/agy` 命令族** | `status` / `pool` / `auth` / `models` / `mode` / `effort` / `workspace` / `goal` / `session` / `enable-account` / `disable-account` / `clear` / `doctor` / `help` |

<p align="center">
  <img src="./docs/assets/dashboard.png" alt="Antigravity 管理控制台 - 多账号池化与配额监控" width="460" />
  &nbsp;&nbsp;
  <img src="./docs/assets/model-picker.png" alt="DSH 模型选择器中的 Antigravity 模型列表" width="220" />
</p>
<p align="center">
  <img src="./docs/assets/token-usage.png" alt="原生上下文缓存与 Token 用量统计" width="340" />
  &nbsp;&nbsp;
  <img src="./docs/assets/context-metering.png" alt="1M 物理上下文负载精确计量" width="340" />
</p>

---

## 配置

| 键名 | 环境变量 | 默认值 | 作用说明 |
| --- | --- | --- | --- |
| `enabled` | `DSH_AGY_ENABLED` | `true` | 插件主开关 |
| `agyBin` | `DSH_AGY_BIN` | 自动探测 | 显式指定 `agy` 二进制路径 |
| `permissionMode` | `DSH_AGY_MODE` | `skip` | `skip`（无人值守执行）/ `plan` / `accept-edits`。**Fusion 场景必须 `skip`** |
| `mcpBridge` | `DSH_AGY_MCP_BRIDGE` | `true` | 是否把 DSH 工具经回环 MCP 桥暴露给 agy。关闭后 agy 调不到任何 DSH 工具 |
| `mcpToolAllowlist` | `DSH_AGY_MCP_TOOL_ALLOWLIST` | `''` | 逗号分隔放行名单，**空 = 全部放行**（内部工具除外）。匹配的是**原始 DSH 名**，不是 MCP 重写名 |
| `mcpConfigScope` | `DSH_AGY_MCP_CONFIG_SCOPE` | `global` | 写哪个 MCP 注册表。agy 1.4+ 只读 `global` |
| `mcpConfigPath` | `DSH_AGY_MCP_CONFIG_PATH` | `''` | 覆盖注册表文件绝对路径 |
| `defaultModel` | `DSH_AGY_DEFAULT_MODEL` | `(agy 默认)` | 默认模型 slug |
| `defaultEffort` | `DSH_AGY_DEFAULT_EFFORT` | `(模型默认)` | 思考预算：`low` / `medium` / `high` |
| `hiddenModels` | `DSH_AGY_HIDDEN_MODELS` | `[]` | `/model` 选择器的黑名单（新模型默认可见） |
| `timeoutMs` | `DSH_AGY_TIMEOUT_MS` | `600000` | 单轮活跃看门狗超时（毫秒） |
| `longToolIdleMinutes` | `DSH_AGY_LONG_TOOL_IDLE_MINUTES` | `240` | 存在未完成工具步骤时的空闲预算（分钟）；`0` = 不抬高，卡死工具按 `timeoutMs` 快速失败 |
| `workspaceRoot` | `DSH_AGY_WORKSPACE_ROOT` | 会话 cwd | agy 工作区根目录 |
| `suppressAgyAutoUpdate` | `DSH_AGY_SUPPRESS_AUTOUPDATE` | Windows `true`，其他 `false` | 每次 spawn 前刷新 agy 的更新检查时间戳，阻断 `--bg-updater` 子进程链（Windows 闪窗根因） |
| `autoWarmup` | `DSH_AGY_AUTO_WARMUP` | `false` | 7 天周配额自动预热（opt-in）。该路径直连 Google 内部端点，请自行评估风控风险 |
| `warmupModels` | `DSH_AGY_WARMUP_MODELS` | `gemini-3.8-flash,claude-sonnet-4-6` | 预热使用的模型列表，空 = 不预热 |

---

## 架构与工作原理

1. **短生命周期进程驱动**：每一轮对话启动一个独立官方 `agy -p --output-format stream-json` 进程，解析 NDJSON 事件流。
2. **工具镜像**：agy 在自己 loop 里执行的每一步以 `agy_tool` 之名回传，DSH 把它重放成原生卡片——这是「路线自带 loop」与「宿主工具循环」之间唯一的通道。
3. **回环 MCP 桥**：插件在本机起一个带 token 的 MCP server，把调用方 agent scope 可见的工具写进 agy 的全局注册表；`/tools` 与 `/call` 共用同一个 `callerFor()` 解析 `X-DSH-Session`。
4. **多账号沙箱**：备用账号在 `~/.dsh/agy-accounts/<id>` 下建独立 HOME。Windows 凭据实际存放在机器级 Credential Manager（`gemini:antigravity`），插件以「身份级引用计数租约」接管：同一授权多会话并行，仅身份切换串行。
5. **失败分类与自愈**：错误按 AUTH / NETWORK / RATE_LIMIT / ELIGIBILITY 分类；网络抖动借 agy 运行日志甄别为可重试，不误伤健康账号登录态。

---

## 排障

| 现象 | 原因 / 处理 |
| --- | --- |
| 工具表里有工具，但整轮零 `tool/call` | 调用方天花板没有 `agy_tool`；日志里有 `no-tool-transport` 警告 |
| 列表为空、或没有 `fusion_*` | 请求未携带/未解析到 `X-DSH-Session`；或 allowlist 写成了 MCP 重写名 |
| `a tool required the "mcp" permission …` | `permissionMode` 不是 `skip`，headless 下无法弹窗授权 |
| 配了但 agy 完全看不到 MCP server | `mcpConfigScope` 写成了 `workspace`（agy 1.4+ 只读全局） |
| `denied: not in allowlist` | 白名单写的是 MCP 名而非原始 DSH 名 |
| 升级后账号/覆盖项不见了 | 检查 `~/.dsh/agy-worker`；若同名目录已存在，旧 `~/.dsh/agy-link` 会被保留而不是覆盖 |

### Windows 开始对话时闪一下黑框

**这是 Windows 控制台分配机制，完全良性。** DSH 是 Electron GUI 进程，每轮需要启动 `agy.exe` 控制台子进程；Windows 11 下若默认终端是「Windows 终端」，它会拦截后台控制台句柄并闪窗。

1. 打开 **Windows 终端 → 设置 → 启动**（或 Windows「设置 → 系统 → 开发者选项」）→ **默认终端应用程序** 改为 **「Windows 控制台主机」**。
2. 保存后**完全退出并重启 DSH**。

`agy` 自己的 `--bg-updater` 子进程链也会闪窗（0.4.66 起已处理）：它在距上次更新检查满 15 分钟后自行派生子进程，父进程的 `windowsHide` 来不及生效。插件在每次 spawn 前刷新 agy 的 fast-path 时间戳，这条链就不会被创建。代价是该 agy home 不再自动检查更新，手动 `agy update` 不受影响；开关为 `suppressAgyAutoUpdate`。

---

## 上游、致谢与许可

- 上游仓库：[`amlyczz/dsh-agy-link`](https://github.com/amlyczz/dsh-agy-link) —— 本 fork 的全部基础能力来自这里，问题与改进请优先向上游反馈
- [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) — Antigravity 公开 OAuth 客户端与回环回调登录范式
- [opencode-antigravity-auth](https://github.com/NoeFabris/opencode-antigravity-auth) — opencode 平台的多账号实践
- [OmniRoute](https://github.com/diegosouzapw/OmniRoute) — Antigravity 端点分发与配额语义
- [pi-mono](https://github.com/badlogic/pi-mono) — Antigravity 轮换与桥接设计参考

⚠️ 本插件仅调用用户本地官方安装的未修改 `agy` CLI 进程，使用需遵循 Google Antigravity 服务条款。

MIT License.

---

# English

## What this repository is

`dsh-agy-worker` is a **fork** of [`amlyczz/dsh-agy-link`](https://github.com/amlyczz/dsh-agy-link). Upstream brings Google Antigravity models into DeepSeek Harness (DSH) — multi-account pooling, quota tracking, in-GUI OAuth, streaming and thinking mapping. This fork keeps all of it.

It changes one thing: **making agy usable as a caller-driven Worker**, so that [`dsh-fusion`](https://github.com/SQDR2/dsh-fusion) can pick **agy (Gemini / Claude / GPT-OSS) as its Sidekick** and have a delegation actually complete and report back — instead of stalling on "the tool is in the table, but it is never called".

> Upstream `dsh-agy-link` keeps its own name, npm package and repository. This is an independent line: npm package `dsh-agy-worker`, route prefix `/plugins/agy-worker/*`, state directory `~/.dsh/agy-worker`.

---

## Why the fork exists

Fusion's Sidekick is a caller-driven tool loop: DSH advertises the Worker's tool surface (`workerTools` plus `fusion_*`) and expects the model to **call** those tools. agy is a provider route with its own agent loop — it never returns a plain `bash` call; it reports that step back under **its own transport name**.

Three conditions must hold at once. Upstream was missing two of them, and both failed silently:

| Condition | Role | Symptom when missing | This fork |
| --- | --- | --- | --- |
| `mcpBridge: true` | agy can **execute** DSH tools | tools are advertised but unreachable | on by default |
| `agy_tool` in the caller's ceiling | agy's **return channel** | the adapter has no tool-call block to emit → the turn degrades to prose and the host reports `WORKER_TOOLS_UNREACHABLE` | logs a `no-tool-transport` warning naming the caller-side switch |
| `permissionMode: 'skip'` | lets an MCP call **through** | agy auto-denies: `a tool required the "mcp" permission that headless mode cannot prompt for` | `/agy status` names it |
| `/tools` listed for the caller's scope | `fusion_*` is **visible** | the catalog never contains `fusion_*`, and no allowlist value can compensate | fixed |

The last one is the root cause: `fusion_*` is **not** registered globally but on the Agent's own scope (`agent.ctx.tools.register`). The bridge's `/tools` called `svc.schemas()` without a scope, and DSH resolves an omitted scope to the **global layer only**. The allowlist filters *after* listing, so no allowlist value could ever bring them back.

---

## Changes against upstream

| Commit | What it does |
| --- | --- |
| `fix(mcp-bridge): scope /tools to the calling agent` | `/tools` resolves `X-DSH-Session` through the same `callerFor()` as `/call` and calls `schemas(agent)`. Both session-key shapes (top-level `session-<uuid>`, bare `<uuid>` for sub-agents) resolve as given first, retrying with the `session-` prefix only when that finds nothing |
| `feat(host): enable the MCP bridge by default and report unreachable tool tables` | `mcpBridge` defaults to `true` (`mcpBridge: false` / `DSH_AGY_MCP_BRIDGE=0` still opt out); a ceiling without `agy_tool` now logs one actionable `no-tool-transport` warning per session instead of degrading silently; `/agy status` reports bridge state, bridged tool set and the `permissionMode` requirement |
| `feat(client): move the Antigravity console to a left-sidebar panel` | The console moves from Settings → gear to a first-class left-sidebar panel (`sidebar.panellist` + `main` page), reusing the identical `AgySettingsSection` |
| `feat(client): place the sidebar entry directly below 自动化任务` | `sidebar.panellist` order drops from `100` to `20`, so the entry sits directly below DSH's 自动化任务 panel (`order: 10`) and above the 更多 / More launcher |

The fork also renames throughout: npm package `dsh-agy-worker`, internal id `agy-worker`, routes `/plugins/agy-worker/*`. The legacy state directory `~/.dsh/agy-link` is **migrated automatically** on first start (runtime overrides, session map, media cache, warmup history); an existing `agy-worker` directory is never overwritten. The account pool at `~/.dsh/agy-accounts` is untouched — **existing logins need no re-authentication**.

---

## Using it with dsh-fusion

1. **Pick agy as the Sidekick.** Open the **Fusion** entry in the left sidebar and choose an Antigravity model as Sidekick; keep a frontier model as Lead.
2. **Keep the return channel in the Worker's ceiling.** `agy_tool` is agy's only return channel. Current `dsh-fusion` adds it automatically via `withRouteTransport()` once the `antigravity` route is registered; on older versions add it by hand:

   ```yaml
   - id: dsh-model-fusion
     config:
       workerTools: [bash, read, write, edit, glob, grep, job_output, job_kill, agy_tool]
   ```

   The adapter never invents the tool — emitting `agy_tool` when the host never registered it would be rejected as `unknown tool "agy_tool"` — so it stops cutting spans on tool steps instead and logs `no-tool-transport`.

3. **Set `permissionMode: skip`.** No config flag implies this: in print mode agy auto-denies an MCP call unless it may auto-approve it. `accept-edits`, `auto` and `plan` all abort the turn (verified against agy 1.4.12). Alternatively add an `mcp(<target>)` rule under `permissions.allow`.

4. **Narrow the bridge allowlist.** It is both the execution gate (`/call` returns 403 outside the list) and the only constraint against a prompt-injected agy subprocess:

   ```yaml
   mcpBridge: true
   mcpConfigScope: global
   mcpToolAllowlist: "fusion_submit_result,fusion_read_state,fusion_read_evidence,bash,read,write,edit,glob,grep,job_output,job_kill"
   ```

   Use `pwsh` instead of `bash` on Windows. Keep `mcpConfigScope: global` — agy 1.4+ reads only the global registry, so `workspace` is a silent no-op.

Full configuration surface, verification steps and a troubleshooting matrix: **[docs/MCP-BRIDGE-SETUP.md](./docs/MCP-BRIDGE-SETUP.md)**.

---

## Install

> 🚨 **System proxy / TUN mode is required.** Antigravity services and OAuth need to reach `oauth2.googleapis.com`, `cloudcode-pa.googleapis.com`, etc. Prefer TUN mode in Clash / Surge / v2rayA / Sing-box; if your terminal does not inherit the proxy, export before starting DSH:
>
> ```bash
> export HTTPS_PROXY=http://127.0.0.1:7890 HTTP_PROXY=http://127.0.0.1:7890 ALL_PROXY=socks5://127.0.0.1:7890
> ```
>
> A per-account proxy can also be set from the account card (🌐 Proxy).

```bash
# Recommended: install from npm (ships prebuilt output, no local build)
dsh plugin --profile web add dsh-agy-worker

# Or from GitHub (pnpm runs the prepare script and builds for you)
dsh plugin --profile web add github:SQDR2/dsh-agy-worker

# Or from a local clone
git clone https://github.com/SQDR2/dsh-agy-worker.git ~/github/dsh-agy-worker
cd ~/github/dsh-agy-worker && npm ci && npm run build && cd -
dsh plugin --profile web add ~/github/dsh-agy-worker

dsh web
```

Then, in the composer:

```bash
/agy status            # plugin, agy version, bridge state, quotas
/agy auth              # sign in the primary account (or use the AGY badge → ➕ Add Account)
```

Finally pick an Antigravity model in `/model`.

---

## Features

- **Multi-account pool with rotation** — primary plus unlimited spares; smooth failover on 429 / quota exhaustion; quota-expiry-first scheduling
- **Official multi-bucket quotas** — 5h rolling, 7d weekly and the Argon weekly pool (paid Pro/Ultra), with reset countdowns
- **Zero-paste in-GUI OAuth** — loopback callback capture, no authorization codes to copy
- **Native model routing** — registers the `antigravity` provider; Gemini / Claude / GPT-OSS / Argon in `/model`
- **Lossless streaming** — text, thinking turns and tool activity mapped to DSH's native stream protocol
- **Native tool cards** — terminal runs and inline diffs render as DSH cards; MCP meta-tools are unwrapped into terminal / search cards
- **Session continuity** — DSH sessions bind to agy conversations (`--conversation`); only the delta is sent per turn
- **Native context caching metering** — `cache_read_tokens` mapped end to end, 1M-window aware
- **Jitter-safe auth** — keyring transport evidence separates proxy jitter from a real sign-out
- **Family-scoped cooldowns** — Gemini / Claude / GPT-OSS / Argon limits are independent
- **Per-account proxy** — dedicated HTTP(S) / SOCKS egress, or auto-detected system proxy
- **Parallel secondary leases** — concurrent sessions on one account share a lease; only identity switches serialize
- **Goal & plan integration** — long tasks carry DSH goal / plan context across tool continuations
- **Multimodal images** — staged to disk and passed to agy via `--add-dir`
- **`agy_ask` delegation** — any DSH model can delegate a single task to an Antigravity model
- **Sidebar console** — left-sidebar entry (below 自动化任务) plus the header `AGY (n)` badge
- **`/agy` commands** — `status`, `pool`, `auth`, `models`, `mode`, `effort`, `workspace`, `goal`, `session`, `enable-account`, `disable-account`, `clear`, `doctor`, `help`

---

## Configuration

| Key | Environment variable | Default | Description |
| --- | --- | --- | --- |
| `enabled` | `DSH_AGY_ENABLED` | `true` | Master switch |
| `agyBin` | `DSH_AGY_BIN` | auto-detected | Path to the `agy` binary |
| `permissionMode` | `DSH_AGY_MODE` | `skip` | `skip` / `plan` / `accept-edits`. **Must be `skip` for the Fusion scenario** |
| `mcpBridge` | `DSH_AGY_MCP_BRIDGE` | `true` | Expose DSH tools to agy over the loopback MCP bridge |
| `mcpToolAllowlist` | `DSH_AGY_MCP_TOOL_ALLOWLIST` | `''` | Comma-separated allowlist; empty = all non-internal. Matches the **original DSH name**, not the MCP-rewritten one |
| `mcpConfigScope` | `DSH_AGY_MCP_CONFIG_SCOPE` | `global` | Which MCP registry to publish into; agy 1.4+ reads `global` only |
| `mcpConfigPath` | `DSH_AGY_MCP_CONFIG_PATH` | `''` | Absolute override for the registry file |
| `defaultModel` | `DSH_AGY_DEFAULT_MODEL` | `(agy default)` | Default model slug |
| `defaultEffort` | `DSH_AGY_DEFAULT_EFFORT` | `(model default)` | `low` / `medium` / `high` |
| `hiddenModels` | `DSH_AGY_HIDDEN_MODELS` | `[]` | Deny-list for the `/model` picker |
| `timeoutMs` | `DSH_AGY_TIMEOUT_MS` | `600000` | Activity-watchdog timeout (ms) |
| `longToolIdleMinutes` | `DSH_AGY_LONG_TOOL_IDLE_MINUTES` | `240` | Idle budget while a tool step is ACTIVE (minutes); `0` keeps the normal budget |
| `workspaceRoot` | `DSH_AGY_WORKSPACE_ROOT` | session cwd | agy workspace root |
| `suppressAgyAutoUpdate` | `DSH_AGY_SUPPRESS_AUTOUPDATE` | `true` on Windows | Refreshes agy's update-check timestamp before every spawn |
| `autoWarmup` | `DSH_AGY_AUTO_WARMUP` | `false` | Opt-in 7-day quota warmup; talks to Google's internal endpoints |
| `warmupModels` | `DSH_AGY_WARMUP_MODELS` | `gemini-3.8-flash,claude-sonnet-4-6` | Warmup model list; empty disables warmup |

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Tools advertised, zero `tool/call` all turn | `agy_tool` missing from the caller's ceiling; look for a `no-tool-transport` warning |
| Empty catalog, or no `fusion_*` | `X-DSH-Session` not carried / not resolved, or the allowlist uses the MCP-rewritten name |
| `a tool required the "mcp" permission …` | `permissionMode` is not `skip` |
| agy never sees the MCP server | `mcpConfigScope` set to `workspace` (agy 1.4+ reads global only) |
| `denied: not in allowlist` | The allowlist holds the MCP name, not the original DSH name |
| Accounts / overrides gone after the upgrade | Check `~/.dsh/agy-worker`; when that directory already exists, `~/.dsh/agy-link` is kept rather than merged |

On Windows, a brief console flash when a turn starts comes from console allocation, not from this plugin: set **Settings → System → For developers → Default terminal application** to **Windows Console Host**, then fully restart DSH. agy's own `--bg-updater` chain (handled since 0.4.66 via the update-check timestamp refresh, switch `suppressAgyAutoUpdate`) is the other known source.

---

## Upstream, credits and license

- Upstream: [`amlyczz/dsh-agy-link`](https://github.com/amlyczz/dsh-agy-link) — every base capability comes from there; report general issues upstream first
- [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) — Antigravity OAuth client and loopback callback patterns
- [opencode-antigravity-auth](https://github.com/NoeFabris/opencode-antigravity-auth) — multi-account practice on opencode
- [OmniRoute](https://github.com/diegosouzapw/OmniRoute) — Antigravity endpoint dispatch and quota semantics
- [pi-mono](https://github.com/badlogic/pi-mono) — rotation and bridging reference

⚠️ This plugin only invokes the official, unmodified `agy` CLI installed locally. Use is subject to Google Antigravity's Terms of Service.

MIT License.
