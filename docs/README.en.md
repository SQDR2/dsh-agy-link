# dsh-agy-worker — English

A **fork** of [`amlyczz/dsh-agy-link`](https://github.com/amlyczz/dsh-agy-link) that integrates Google Antigravity models into DeepSeek Harness (DSH) through the official, unmodified `agy` CLI, with one addition on top: **agy can be used as a caller-driven Worker**, so [`dsh-fusion`](https://github.com/SQDR2/dsh-fusion) can pick agy (Gemini / Claude / GPT-OSS) as its Sidekick and have the delegation actually finish.

The full Chinese documentation is in the [main README](../README.md#中文).

## Requirements

| Requirement | Verification |
| --- | --- |
| DSH | `dsh --version` |
| Node.js >= 24 | `node --version` |
| Google Antigravity CLI | `agy --version` |
| Google connectivity | proxy/VPN/TUN where required |

Where Google is not directly reachable, enable system proxy/TUN mode. If the terminal does not inherit proxy settings, export them before starting DSH:

```bash
export HTTPS_PROXY=http://127.0.0.1:7890 HTTP_PROXY=http://127.0.0.1:7890 ALL_PROXY=socks5://127.0.0.1:7890
```

Replace the port with the correct local proxy port. An HTTP(S) or SOCKS proxy can also be configured per account in the Antigravity panel.

## Install and quick start

```bash
# Recommended: install from npm (ships prebuilt output, no local build)
dsh plugin --profile web add dsh-agy-worker

# Or from GitHub (pnpm runs the prepare script and builds for you)
dsh plugin --profile web add github:SQDR2/dsh-agy-worker

# Or from a local clone
git clone https://github.com/SQDR2/dsh-agy-worker.git ~/github/dsh-agy-worker
cd ~/github/dsh-agy-worker && npm ci && npm run build && cd -
dsh plugin --profile web add ~/github/dsh-agy-worker

# Start DSH Web
dsh web
```

In DSH, click the `AGY (n)` badge and choose **Add Account** to complete Google login in the browser, or run `/agy auth` for primary-account login. Then choose an Antigravity model from `/model`. Use `/agy status` to check status, including the MCP bridge state.

## Using agy as dsh-fusion's Sidekick

Three conditions must hold at once; each one alone fails silently:

| Condition | Role | Symptom when missing |
| --- | --- | --- |
| `mcpBridge: true` (default) | agy can **execute** DSH tools | tools advertised but unreachable |
| `agy_tool` in the caller's tool ceiling (`workerTools`) | agy's **return channel** | the turn degrades to prose; the host reports `WORKER_TOOLS_UNREACHABLE`; a `no-tool-transport` warning is logged |
| `permissionMode: skip` | lets an MCP call **through** | agy auto-denies in print mode: `a tool required the "mcp" permission that headless mode cannot prompt for` |

Current `dsh-fusion` adds `agy_tool` automatically via `withRouteTransport()` once the `antigravity` route is registered. Narrow the bridge allowlist rather than widening it:

```yaml
mcpBridge: true
mcpConfigScope: global
mcpToolAllowlist: "fusion_submit_result,fusion_read_state,fusion_read_evidence,bash,read,write,edit,glob,grep,job_output,job_kill"
```

Use `pwsh` instead of `bash` on Windows. Keep `mcpConfigScope: global` — agy 1.4+ reads only the global registry. Full setup, verification steps and a troubleshooting matrix are in [MCP-BRIDGE-SETUP.md](./MCP-BRIDGE-SETUP.md) (Chinese).

## Changes against upstream

- `/tools` now resolves `X-DSH-Session` the same way `/call` does and lists tools for the calling agent's scope, so agent-scoped tools (`fusion_*`, registered via `agent.ctx.tools.register`) are bridgeable at all.
- `mcpBridge` is on by default, and a ceiling without `agy_tool` logs one actionable `no-tool-transport` warning instead of degrading silently.
- The Antigravity console moved from Settings to a left-sidebar panel, placed directly below the 自动化任务 panel.
- Renamed throughout: package `dsh-agy-worker`, internal id `agy-worker`, routes `/plugins/agy-worker/*`. The legacy state directory `~/.dsh/agy-link` migrates to `~/.dsh/agy-worker` automatically on first start; an existing `agy-worker` directory is never overwritten. The account pool at `~/.dsh/agy-accounts` is untouched.

## Features

- Account pool with isolated HOME environments and credentials, quota-expiry-first rotation.
- Sequential failover on HTTP 429 or quota exhaustion.
- Official 5h / 7d / Argon weekly quota monitoring with reset countdowns.
- Text, thinking, and tool-activity streaming into native DSH UI cards.
- DSH sessions bound to native `agy` conversations through `--conversation`.
- Gemini, Claude, and GPT-OSS models available through the `antigravity` provider.
- Native context caching (`cache_read_tokens`) metering across 1M windows.
- Multimodal images staged locally and authorized to `agy` through `--add-dir`.
- `agy_ask` for delegating a one-off task to an Antigravity model.

## Configuration

| Key | Environment variable | Default | Description |
| --- | --- | --- | --- |
| `enabled` | `DSH_AGY_ENABLED` | `true` | Plugin master switch |
| `agyBin` | `DSH_AGY_BIN` | auto-detected | Path to the `agy` executable |
| `permissionMode` | `DSH_AGY_MODE` | `skip` | `skip`, `plan`, or `accept-edits`. **Must be `skip` for the Fusion scenario** |
| `mcpBridge` | `DSH_AGY_MCP_BRIDGE` | `true` | Expose DSH tools to agy over the loopback MCP bridge |
| `mcpToolAllowlist` | `DSH_AGY_MCP_TOOL_ALLOWLIST` | empty (all) | Comma-separated allowlist; matches the original DSH name, not the MCP-rewritten one |
| `mcpConfigScope` | `DSH_AGY_MCP_CONFIG_SCOPE` | `global` | Which MCP registry to publish into; agy 1.4+ reads `global` only |
| `mcpConfigPath` | `DSH_AGY_MCP_CONFIG_PATH` | empty | Absolute override for the registry file |
| `defaultModel` | `DSH_AGY_DEFAULT_MODEL` | agy default | Default model slug |
| `defaultEffort` | `DSH_AGY_DEFAULT_EFFORT` | model default | `low`, `medium`, or `high` |
| `timeoutMs` | `DSH_AGY_TIMEOUT_MS` | `600000` | Activity watchdog timeout in ms |
| `longToolIdleMinutes` | `DSH_AGY_LONG_TOOL_IDLE_MINUTES` | `240` | Idle budget (minutes) while an agy tool step is still open; `0` = keep `timeoutMs` so a wedged tool fails fast |
| `workspaceRoot` | `DSH_AGY_WORKSPACE_ROOT` | session cwd | Workspace root |

## `/agy` commands

`status`, `pool`, `auth`, `models`, `mode`, `effort`, `workspace`, `goal`, `session`, `enable-account`, `disable-account`, `clear`, `doctor`, and `help`.

## Security and terms

The plugin invokes only the official, unmodified `agy` binary installed locally. Use it in accordance with Google Antigravity Terms of Service. Preserve commands, variables, model IDs, and paths literally when adapting this documentation.

## License

MIT License.
