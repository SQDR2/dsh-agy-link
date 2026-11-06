# Agent Guidelines for dsh-agy-worker

## 🚨 Release & Publishing Rules (Strictly Enforced)

1. **No Automatic Publishing (禁止自动发布)**
   - **NEVER** publish to npm (`npm publish`) or create GitHub Releases (`gh release create` / git tags triggering release CI) automatically.
   - All release actions **MUST** receive explicit user confirmation and permission beforehand.

2. **Standard Workflow Before Release Request**
   - Implement changes and ensure local code quality gates pass:
     - `pnpm run check` (TypeScript typecheck)
     - `pnpm run build` (Bundle and compilation)
     - `pnpm test` (100% test suite passing)
   - Update `CHANGELOG.md` and bump `package.json` version accordingly.
   - Present a clear summary of changes, test results, and status to the user.
   - **STOP and wait for the user's explicit command** (e.g. "发布", "可以发布", "release") before creating any release or publishing package.

3. **How a Release Ships (发版通道)**
   - Once the user has explicitly approved, the release itself goes through `.github/workflows/publish.yml`: push a `v*` tag that matches `package.json`, and CI publishes via npm Trusted Publishing (OIDC, no token). Pushing to `main` never publishes.
   - Do not run `npm publish` by hand except for the **very first** publish of a brand-new package name (npm requires the name to exist before a Trusted Publisher can be configured). Full maintainer notes: `RELEASING.md`.

---

## ⚡ 两级双环测试原则（对齐 academic-agent）

> ⚠️ **严禁在日常编码与 TDD 循环中直接运行全量测试套件**！系统累计 604 项用例，全量运行耗时较长会严重打断开发心流。日常开发必须遵循两级双环测试：

1. **内环（TDD 极速环，0.3 ~ 2 秒，日常开发必用）**：
   - 自动基于 Git 变更精准执行关联测试：`pnpm run test:fast`
   - 指定模块关键字秒级直跑：`pnpm run test:fast <name>`（例如 `pnpm run test:fast models` 仅需 0.5s，`pnpm run test:fast reasoning` 仅需 0.4s）
   - 单文件直跑：`node --experimental-transform-types --test test/xxx.test.ts`
2. **外环（全量回归门禁，仅提 PR 或发版打 Tag 前）**：
   - 全量回归测试：`pnpm test`（确保 604 项用例 100% 全部通过）

---

## 🛠️ Project Architecture & Constraints

- **Engine & Bridge**: `dsh-agy-worker` bridges Google Antigravity (`agy` CLI) into DeepSeek Harness (DSH).
- **Tool Mirroring**: Tools executed by agy are mirrored as native DSH tool cards via `agy_tool` dispatched inside `run_code`.
- **Idle Activity Watchdog**: Timeout management uses an activity-based idle watchdog (`refreshWatchdog`), rearming on stdout/stderr data, with a generous print-mode budget passed to the agy CLI.
- **Protocol Fidelity**: Maintain lossless JSON chunks (no undefined properties), accurate reasoning annotations, and resilient event mapping across multi-turn continuations.

---

## 🔀 与上游的关系（维护者必读）

本仓库是 `amlyczz/dsh-agy-link` 的 fork，独立发布线：包名 `dsh-agy-worker`、内部 id `agy-worker`、路由 `/plugins/agy-worker/*`、数据目录 `~/.dsh/agy-worker`（旧的 `~/.dsh/agy-link` 首次启动自动迁移）。

- `upstream` remote 指向上游，`origin` 指向本 fork（`SQDR2/dsh-agy-worker`）。
- 本 fork 的实质增量是「由调用方驱动的 Worker」这条契约：`/tools` 按调用方 agent scope 列举、`mcpBridge` 默认开启、`agy_tool` 作为回传通道、`permissionMode` 必须 `skip`。详见 `docs/MCP-BRIDGE-SETUP.md`。
- 同步上游改动时注意：上游的 `agy-link` 命名、路由与数据目录**不要**带回来，改名必须保持全量一致。

---

## 🔁 Fork PR CI

GitHub 默认对 **outside collaborator / first-time contributor** 的 fork PR 暂停 workflow，状态为 `action_required`，界面上看起来像 “no checks / UNSTABLE”，其实只是在等人点批准。

处理新 PR 时：

1. 打开 PR → Checks（或 Actions 列表）→ **Approve and run**。
2. 或 CLI：`gh run list --event pull_request` 找到 `action_required` 的 run，然后  
   `gh api -X POST repos/SQDR2/dsh-agy-worker/actions/runs/<id>/approve`。
3. 批准后 CI 会跑 `check` + `build` + `test`；全部 `success` 才是可合并信号。

此策略只能在仓库 Settings → Actions → General 里调整，没有公开 API 可关。CI 不读 secrets（`permissions: contents: read`），批准即代表允许在 GitHub-hosted runner 上执行该 PR 的未信任代码。
