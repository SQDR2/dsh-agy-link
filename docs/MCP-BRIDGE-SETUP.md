# 配置 MCP 反向桥接（让 agy / gemini 作为 Sidekick 拿到 `fusion_*` 工具）

面向场景：DSH 的 Fusion 把 **agy（Antigravity CLI，gemini）当作 Sidekick/Worker**。
Worker 必须能调用 Fusion 的委派工具（`fusion_submit_result` 等），否则一轮
委派永远无法交回报告，会话停在原地重试。

本文只讲**已验证**的配置面。先读「前置条件」，那一节是能配成功的关键：
早期版本存在一个缺陷，导致无论怎么写配置都拿不到 `fusion_*`。

---

## 0. 前置条件（必须先满足）

`fusion_*` 工具**不是**注册在全局，而是注册在 **Agent 自己的 scope** 上
（`agent.ctx.tools.register(...)`，见 `native-scopes.ts` 的
`const scope = agent.ctx`）。

而 bridge 的 `/tools` 曾调用不带参数的 `svc.schemas()`；DSH 的语义是
**省略 scope = 只返回全局层**（`view(undefined)` → `chainLayers(undefined) === []`）。
结果：`fusion_*` 从不出现在 `/tools` 的列表里，而 allowlist 是在**列出之后**才过滤的，
所以**任何 allowlist 取值都救不回来**——写什么名字都只会得到空列表。

该缺陷已修复：`/tools` 现在和 `/call` 一样解析 `X-DSH-Session` 得到调用方 agent，
并调用 `schemas(agent)`。

> **因此：请确认所用 dsh-agy-worker 版本已包含该修复。**
> 回归用例：`test/mcp-bridge-registry-and-agent.test.ts`
> → `/tools lists tools registered on the calling agent scope`。
> 在修复前，缺失 `fusion_*` 的表现就是「配置全对但工具列表为空」。

---

## 1. 配置项

插件配置键（`cordis.patch.yml` 的 `config:`，或运行时覆盖）：

| 键 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `mcpBridge` | boolean | `true` | 总开关（v0.4.101 起默认开启；`false` 可关闭） |
| `mcpToolAllowlist` | string | `''` | 逗号分隔；**空 = 全部放行**（内部工具除外） |
| `mcpConfigScope` | `'global' \| 'workspace' \| 'both'` | `'global'` | 写哪个 MCP 注册表 |
| `mcpConfigPath` | string | `''` | 覆盖注册表文件绝对路径 |

对应环境变量：`DSH_AGY_MCP_BRIDGE`、`DSH_AGY_MCP_TOOL_ALLOWLIST`、
`DSH_AGY_MCP_CONFIG_SCOPE`、`DSH_AGY_MCP_CONFIG_PATH`。

**`mcpConfigScope` 保持默认 `global`。** `agy` 1.4+ 只读全局注册表
（`<agy home>/.gemini/config/mcp_config.json`），workspace 的 `.mcp.json`
会被静默忽略——写成 `workspace` 是「配了但不起作用」的常见原因。

### 1.1 桥接只是三个条件中的一个

一个「由调用方驱动」的路线（Fusion 的 Worker、任何宿主工具循环）要在 agy 上
真正跑通工具，需要**三个条件同时成立**，任缺一个都表现为「工具表里有，
但永远没有调用」：

| 条件 | 作用 | 缺失时的现象 |
|---|---|---|
| `mcpBridge: true` | agy 能**执行** DSH 工具 | 工具可达但执行不到 |
| 调用方工具面里有 `agy_tool` | agy 的**回传通道**（本适配器只能以 `agy_tool` / `run_code` 之一发出 tool-call 块） | 适配器拿不到可发的块 → 整轮退化成纯文本，宿主报 `WORKER_TOOLS_UNREACHABLE` |
| `permissionMode: 'skip'` | 让 MCP 调用**被允许** | `agy` 在 print 模式下自动拒绝：`a tool required the "mcp" permission that headless mode cannot prompt for` |

第三条容易漏：`accept-edits`、`auto`、`plan` 在 headless 下都**不能**把 MCP
调用放行（已对 `agy` 1.4.12 实测）。要么用 `permissionMode: skip`，要么在
`settings.json` 的 `permissions.allow` 里加一条 `mcp(<target>)` 规则。

Fusion 一侧还要把 `agy_tool` 放进 Worker 的工具天花板，否则它会被
`scope.tools.restrict({ allow })` 裁掉：

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

> 适配器不会伪造这个工具：宿主没注册 `agy_tool` 时硬发会被拒为
> `unknown tool "agy_tool"`。所以它选择停止按工具切分 span，但会在
> 日志里留一条 `no-tool-transport` 警告指出要改的是**调用方天花板**而不是适配器
> （v0.4.101 起）。`/agy status` 也会同时列出桥接开关、放行清单与
> `permissionMode` 提示。

---

## 2. 两个容易写错的点

### 2.1 allowlist 匹配的是 **原始 DSH 名**

`toMcpName` 的重写发生在 allowlist 过滤**之后**：

```ts
svc.schemas(caller)
  .filter((t) => allow.length === 0 || allowSet.has(t.name))   // ← 原始名，此处过滤
  .filter((t) => !INTERNAL_TOOL_NAMES.has(t.name))
  .map(...)                                                    // ← 才做 toMcpName 重写
```

- 名字里有非法字符时（如 `agent_teams.status` → MCP 侧显示 `agent_teams_status`），
  allowlist 必须写**原始名** `agent_teams.status`。写 `agent_teams_status` 会静默匹配不到。
- `fusion_*` 本身不含非法字符，原始名与 MCP 名相同，不受此影响。

### 2.2 工具集是**按调用方会话**算出来的

`/tools` 现在返回的是「该 agent scope 可见的工具」，因此：

- 不同会话看到的列表**可能不同**（这是正确行为，不是 bug）；
- 会话解析不到时**降级为全局视图**，而不是报错。

---

## 3. 步骤

1. **启用桥接并收窄白名单。** 只放行 Worker 需要的工具。范围就是
   Fusion 的 Worker 工具面：`WORKER_FUSION_TOOLS`（`fusion_submit_result`、
   `fusion_read_state`、`fusion_read_evidence`）加上 `workerTools`
   （默认 `bash`/`pwsh`、`read`、`write`、`edit`、`glob`、`grep`、`job_output`、`job_kill`；
   shell 名按平台取 `process.platform === 'win32' ? 'pwsh' : 'bash'`）。

   ```yaml
   mcpBridge: true
   mcpConfigScope: global
   mcpToolAllowlist: "fusion_submit_result,fusion_read_state,fusion_read_evidence,bash,read,write,edit,glob,grep,job_output,job_kill"
   ```

   > Windows 把 `bash` 换成 `pwsh`；若改过 `workerTools`，跟着改。白名单**宁可偏窄**：
   > 它同时是执行期闸门（不在名单里的 `/call` 返回 403），
   > 也是防止被提示注入的 agy 子进程越权访问的唯一约束。

2. **重启 DSH**（或重新加载插件），让 bridge 重新 `startMcpBridge` 并写入注册表。

3. **确认注册表条目存在。** 键名是 `dsh-tools-<port>`：

   ```bash
   cat ~/.gemini/config/mcp_config.json      # 或 $GEMINI_CLI_HOME 下
   ```

   应能看到 `mcpServers["dsh-tools-<端口>"]`。该文件由插件合并写入，`dispose` 时还原。

4. **确认工具真的暴露给了 agy。** 这是最关键的一步——直接看 bridge 的 `/tools`：

   ```bash
   curl -s -H "Authorization: Bearer <token>" http://127.0.0.1:<port>/tools
   ```

   `token` 与 `port` 在插件日志里有：
   `mcp bridge listening on 127.0.0.1:<port>`。

   > 手动 curl 时**不会**带 `X-DSH-Session`，所以看到的是**全局视图**，
   > `fusion_*` 不在其中是正常的。要验证 scope 解析，请从 agy 侧触发
   > 一次真实调用，或在同一请求里带上 `X-DSH-Session: <worker 会话 id>`。
   >
   > **文本委派（`mode: 'text'`）下有个明确特征**：Worker 的
   > `readOnlyTools` 返回 `[]`，Fusion 会把该 scope 的「可继承工具面」收窄为空
   > （`scope.tools.restrict({ allow: [] })`），而 scope 自己注册的工具不受该限制影响。
   > 所以带正确 `X-DSH-Session` 时，`/tools` **只应看到 `fusion_*` 自身**，
   > 不该再出现 `bash`/`read` 等继承来的工具：
   >
   > - 必有 `fusion_submit_result`、`fusion_read_evidence`
   >   （`#tools` 在 `role === 'worker'` 提前返回**之前**注册）；
   > - `fusion_read_state` 仅在 `interactionMode: 'model-like'` 时才注册。
   >
   > 若此时列表为空、或仍混有继承工具，说明第 0 节的 scope 缺陷仍在，或
   > scope 收窄没生效。

5. **端到端确认。** 让 Fusion 做一次真实委派，然后看审计日志：

   ```
   mcp call fusion_submit_result [ok] 12ms
   ```

   每次调用都会记一行 `mcp call <tool> [<结果>] <耗时>`（不记录参数）。
   看不到这一行 = 工具没被调用；`denied: not in allowlist` = 白名单写错了。

---

## 4. 排障对照

| 现象 | 原因 |
|---|---|
| 工具列表为空 | ① 版本缺少本文第 0 节的修复；② allowlist 写了 MCP 重写名 |
| 列表有全局工具但没有 `fusion_*` | 同上；或请求未携带/未解析到 `X-DSH-Session` |
| 配了但 agy 完全看不到服务器 | `mcpConfigScope` 写成了 `workspace`（agy 1.4+ 只读全局） |
| `denied: not in allowlist` | 白名单里写的是 MCP 名而非原始 DSH 名 |
| 注册表条目在 `dispose` 后消失 | 正常：插件会还原它之前的内容 |
| 工具表里有工具，但整轮零 `tool/call` | 调用方天花板没有 `agy_tool`（见 1.1）；日志里会有 `no-tool-transport` 警告 |
| `a tool required the "mcp" permission …` | `permissionMode` 不是 `skip`，且在 headless 下无法弹窗授权 |
| `/agy status` 显示 `mcp bridge: off` | 被显式关掉了（`mcpBridge: false` 或 `DSH_AGY_MCP_BRIDGE=0`）；agy 因此调不到任何 DSH 工具 |
