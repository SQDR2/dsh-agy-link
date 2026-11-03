import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveConfig } from '../src/common/config.ts'

for (const permissionMode of ['plan', 'accept-edits', 'skip'] as const) {
  test(`runtime selection ${permissionMode} overrides a configured entry mode`, () => {
    const entry = { permissionMode: permissionMode === 'plan' ? 'accept-edits' : 'plan' }
    assert.equal(resolveConfig(entry, {}, { permissionMode }).permissionMode, permissionMode)
    assert.equal(resolveConfig(entry, { DSH_AGY_MODE: 'plan' }, { permissionMode }).permissionMode, 'plan')
  })
}
test('runtime configurable fields override entries; entries supply missing fields', () => {
  const cfg = resolveConfig({ defaultModel: 'entry-model', defaultEffort: 'low', askTool: true }, {}, { defaultModel: 'chosen-model', askTool: false })
  assert.equal(cfg.defaultModel, 'chosen-model')
  assert.equal(cfg.defaultEffort, 'low')
  assert.equal(cfg.askTool, false)
})

test('boolean env vars are case-insensitive and accept yes/on/off', () => {
  assert.equal(resolveConfig({}, { DSH_AGY_MCP_BRIDGE: 'TRUE' }, {}).mcpBridge, true)
  assert.equal(resolveConfig({}, { DSH_AGY_MCP_BRIDGE: 'Yes' }, {}).mcpBridge, true)
  assert.equal(resolveConfig({}, { DSH_AGY_MCP_BRIDGE: 'on' }, {}).mcpBridge, true)
  assert.equal(resolveConfig({}, { DSH_AGY_MCP_BRIDGE: 'OFF' }, {}).mcpBridge, false)
  assert.equal(resolveConfig({}, { DSH_AGY_MCP_BRIDGE: 'No' }, {}).mcpBridge, false)
  assert.equal(resolveConfig({}, { DSH_AGY_MCP_BRIDGE: 'garbage' }, {}).mcpBridge, true, 'unknown falls back to base default (on since the bridge default flipped)')
})

test('longToolIdleMinutes is configurable, accepts 0 (disable) and reads the env override', () => {
  assert.equal(resolveConfig({}, {}, {}).longToolIdleMinutes, 240)
  assert.equal(resolveConfig({ longToolIdleMinutes: 30 }, {}, {}).longToolIdleMinutes, 30)
  assert.equal(resolveConfig({}, {}, { longToolIdleMinutes: 0 }).longToolIdleMinutes, 0)
  assert.equal(resolveConfig({}, { DSH_AGY_LONG_TOOL_IDLE_MINUTES: '45' }, {}).longToolIdleMinutes, 45)
  assert.equal(resolveConfig({}, { DSH_AGY_LONG_TOOL_IDLE_MINUTES: '0' }, {}).longToolIdleMinutes, 0)
})

test('hiddenModels accepts string arrays, drops junk, and env wins as a comma list', () => {
  // Overrides layer: array of ids; blank, duplicate and non-string entries are dropped.
  const fromOverrides = resolveConfig({}, {}, { hiddenModels: ['gemini-3.7-flash', '  ', 'gemini-3.7-flash', 42, 'claude-sonnet-4-6'] })
  assert.deepEqual(fromOverrides.hiddenModels, ['gemini-3.7-flash', 'claude-sonnet-4-6'])
  // Non-array values fall through to the default deny-list (empty = show all).
  assert.deepEqual(resolveConfig({ hiddenModels: 'gemini-3.7-flash' }, {}, {}).hiddenModels, [])
  // Entry config supplies the list when no override exists.
  assert.deepEqual(resolveConfig({ hiddenModels: ['entry-model'] }, {}, {}).hiddenModels, ['entry-model'])
  // Env wins last, comma-separated.
  const fromEnv = resolveConfig({ hiddenModels: ['entry-model'] }, { DSH_AGY_HIDDEN_MODELS: ' env-model , second, ,' }, {})
  assert.deepEqual(fromEnv.hiddenModels, ['env-model', 'second'])
})

// A caller-driven route (Fusion's Worker) advertises its tools and expects the
// model to call them; agy dispatches every one of those through its MCP client.
// With the bridge off those tools are advertised but unreachable, which the
// host reports as WORKER_TOOLS_UNREACHABLE — an empty tool log with no hint
// that one config switch explains it. Default it on, keep the opt-out.
test('the MCP bridge is enabled by default and can still be turned off explicitly', () => {
  assert.equal(resolveConfig({}, {}, {}).mcpBridge, true, 'default is on')
  assert.equal(resolveConfig({ mcpBridge: false }, {}, {}).mcpBridge, false, 'entry config opts out')
  assert.equal(resolveConfig({}, {}, { mcpBridge: false }).mcpBridge, false, 'runtime override opts out')
  assert.equal(resolveConfig({}, { DSH_AGY_MCP_BRIDGE: '0' }, {}).mcpBridge, false, 'env opts out')
  assert.equal(resolveConfig({ mcpBridge: false }, { DSH_AGY_MCP_BRIDGE: '1' }, {}).mcpBridge, true, 'env wins last')
})
