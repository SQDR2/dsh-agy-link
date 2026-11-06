# Releasing

[README](README.md) · [Architecture](docs/MCP-BRIDGE-SETUP.md)

维护者笔记，普通用户不需要看这一页。

`dsh-agy-worker` 由 GitHub Actions 的 `.github/workflows/publish.yml` 发布到 npm。

## 认证方式

本包走 **Trusted Publishing（OIDC）**：仓库里不存在任何长期有效的发布 token，workflow 用 GitHub Actions 签发的短期 OIDC 令牌向 npm 证明「这次发布确实来自 `SQDR2/dsh-agy-worker` 的 `publish.yml`」。发布产物附带 provenance attestation，可以指回构建它的那个 commit。

信任关系（2026-11-06 创建，`id: e35cb700-f2ae-4929-a15e-ebb2cc88b389`）：

| 字段 | 值 |
| --- | --- |
| Provider | GitHub Actions |
| Repository | `SQDR2/dsh-agy-worker` |
| Workflow | `publish.yml` |
| Environment name | 留空 |
| Permission | publish + stage publish |

查看当前配置：`npm trust list dsh-agy-worker`。

### 为什么这一步当初只能手工做

OIDC 信任关系按**包**授权，配置入口在包自己的设置页；一个新包名在首次发布之前没有这个页面。所以顺序不可颠倒：先用 granular token 手工发一次（创建包名），再建信任关系。

而建信任关系的命令需要交互式 2FA 挑战，账号只绑了安全密钥（WebAuthn）时命令行拿不到 6 位验证码——`npm trust` 在非 TTY 下直接 `EOTP` 失败。可行的做法是给它一个伪终端：

```sh
script -qec 'npm trust github dsh-agy-worker --file publish.yml --repo SQDR2/dsh-agy-worker --allow-publish --yes' /dev/null
```

有 TTY 时 npm 会打印一个网页授权链接，用安全密钥在浏览器里确认即可（`npm login --auth-type=web` 同理）。

> ⚠️ 新建的信任关系只有在**2 天内**完成首次成功发布才会转为 `Status: Valid`；过期未验证会作废，且不能编辑，只能删除重建。

本文记录一次性配置、每次发版的循环，以及失败时的排查表。

## 什么会触发发布

只有两种事件：

| 事件 | 结果 |
| --- | --- |
| 推送匹配 `v*` 的 tag | 安装 → check → build → test → publish |
| `workflow_dispatch` | 同上；`dry_run=true` 在发布前停下 |

**推 `main` 永远不会发布。** 合并、文档修正、版本号改动停留在 `main` 上时，只要没有 tag，npm 上就什么都不会变。

workflow 会跳过已存在于 registry 的版本，所以重跑同一个 tag 是安全的：它会重新构建、重新测试，然后直接退出，不碰 registry。

## 一次性配置

两步都已完成（本仓库已配好）。之所以写在这里，是因为有人 fork 后改名必须重做一遍，而且配置错了的表现非常像「workflow 坏了」，会浪费大量时间排查。

### 1. 启用 Actions

本仓库是 fork，GitHub 默认禁用 fork 的 Actions。不做这步，推 tag 会被**静默忽略**：不创建 run、不报错、Actions 页显示 `0 workflow runs`。

打开 **Actions** 页，接受「I understand my workflows, go ahead and enable them」提示即可。

> ⚠️ 副作用：`ci.yml` 也会开始跑，此后每次 push 到 `main` 和每个 PR 都会构建并测试。

### 2. 在 npm 上添加 Trusted Publisher

OIDC 发布是按**包**授权的，配置入口在包自己的 Settings 页；而一个从未发布过的包名是没有这个页面的。所以一个新包名的**第一次发布只能手工完成**：

1. 用一个粒度 token 手工发一次（Permissions: **Read and write**；Packages and scopes 选 **All packages**；勾选 **Bypass two-factor authentication**）。只在 scope 里给了 `@sqdr2` 的 token 发不了无 scope 的包，报错是 `E403 You may not perform that action with these credentials`。
   - 首发后 npm 会先回 `202`，并短暂把包内容显示为 `0.0.0-stage` 占位版本；真正的版本在几分钟内替换它。发布后立刻 `npm view` 得到 `E404` 属于正常现象，别当成失败。
   - 没勾 bypass 2FA 会被拒：`E403 Two-factor authentication ... is required to publish packages`。
   - 只授权了 `@sqdr2` scope 的 token **发不了无 scope 的包**，报错是 `E403 You may not perform that action with these credentials`。
2. 在 **npmjs.com → 该包 → Settings → Trusted publishing** 添加：

   | 字段 | 值 |
   | --- | --- |
   | Provider | GitHub Actions |
   | Repository | `SQDR2/dsh-agy-worker` |
   | Workflow | `publish.yml` |
   | Environment name | 留空（workflow 里没有 `environment:`） |
   | Permission | allow npm publish |

   账号本身必须先配好 2FA。否则提交表单会被静默重定向到 `/settings/<user>/tfa`（要求录入安全密钥或认证器 App），什么都不会创建。账号级 2FA（安全密钥）已配置，这步不会再卡。
3. **2 天内**发一个版本。新信任配置只有在首次成功发布后才转为 `Status: Valid`；未验证的配置会过期，且过期后不能编辑，只能删除重建。

Trusted Publisher 验证通过后，建议在包的 **Settings → Publishing access** 打开「Require two-factor authentication and disallow tokens」，此后 token 完全无法发布，只有 workflow 能发。

npm CLI 建不了信任配置：`npm trust github` 需要交互式 2FA 凭据，而 API 会拒绝带 2FA-bypass 的 token（`Granular access tokens that bypass two-factor authentication may not perform this action`）。这一步在设计上只能走浏览器。

## 发一个版本

`package.json` 是版本号的唯一真相来源。tag 必须与它完全一致，否则 workflow 在第一道校验就停下。

```sh
# 1. 改 package.json 的 version（只改这里；package-lock.json 的两处 version 顺带同步）
# 2. 本地门禁 —— 注意必须用 Node >= 24
export PATH=~/.local/share/fnm/node-versions/v24.13.0/installation/bin:$PATH
node -v                 # 必须 >= v24.0.0
npm ci
npm run check           # tsc --noEmit
npm run build           # 必须先 build：MCP bridge E2E 测试要 spawn dist/bridge.mjs
npm test                # 预期 604 项全过
# 3. 更新 CHANGELOG.md（中英双语，仓库既有格式）
# 4. 提交
git add -A && git commit -m "chore(release): 0.6.0"
# 5. 打 tag 并同时推送
git tag v0.6.0 && git push origin main v0.6.0
```

随后 workflow 会执行 `npm ci` → `npm run check` → `npm run build` → `npm test` → `npm publish --access public`。发布产物带有 provenance attestation，`npm view` 能指回构建它的那个 commit。

### 两个容易忽略的点

- **`dist/` 不入库**（在 `.gitignore` 里），由 `prepare` / `prepack` 自动构建。所以本地不需要像 `dsh-fusion` 那样把构建产物一起提交；`npm publish` 时 `prepack` 会重新构建，workflow 里那次 `npm run build` 是为了让测试能 spawn `dist/bridge.mjs`。
- **本机默认 Node 是 22.23.2**，低于 `engines.node >= 24`。用 Node 22 跑全量测试会有一批 credential-slot 用例以 `cancelledByParent` 假失败；切到 Node 24 后 604/604 全过。

日常开发不要跑全量：用 `npm run test:fast`（按 git 改动精准执行，秒级），全量只在提 PR 或打 tag 前跑。

## 检查一次发布

```sh
npm view dsh-agy-worker version dist-tags
npm view dsh-agy-worker@0.6.0 dist.attestations   # 有值说明出自 CI
```

校验产物本身而不只是元数据：

```sh
npm install dsh-agy-worker
node -e "console.log(require('dsh-agy-worker/package.json').version)"
grep -n "name: 'dsh-agy-worker'" node_modules/dsh-agy-worker/cordis.patch.yml
```

插件 id 是 `agy-worker`，包名是 `dsh-agy-worker`，两者刻意不同：前者决定路由前缀 `/plugins/agy-worker/*` 与数据目录 `~/.dsh/agy-worker`，后者是 npm 上的名字。`cordis.patch.yml` 里的 `name` 必须与包名一致。

## 发布失败对照表

| 现象 | 原因 |
| --- | --- |
| 推了 tag，`0 workflow runs` | fork 没启用 Actions |
| `E403 You may not perform that action with these credentials` | token 只授权了 `@sqdr2` scope，发不了无 scope 包 |
| `E403 Two-factor authentication ... is required` | token 没勾 Bypass 2FA |
| 提交信任配置后跳到 `/settings/<user>/tfa` | 账号级 2FA 没配 |
| `404` / `ENEEDAUTH` from `npm publish` | 没有 Trusted Publisher，或它过期未验证 |
| `id-token` 相关报错 | workflow 缺 `permissions: id-token: write` |
| 信任配置报 environment 不匹配 | workflow 有 `environment:` 但表单 Environment name 留空（或反之） |
| `tag vX != package.json Y` | 版本号只改了一处 |
| 测试一批假失败 | 用了 Node 22，需要切 Node 24 |
