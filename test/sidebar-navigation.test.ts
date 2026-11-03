import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const source = fs.readFileSync(new URL('../dist/client.js', import.meta.url), 'utf8')

function loadClient(react: Record<string, unknown> = {}): { apply: (ctx: unknown) => void; inject: string[] } {
  let loaded: { factory: (require: (id: string) => unknown) => unknown } | undefined
  vm.runInNewContext(source, {
    window: { __ModuleLoader__: { load(value: typeof loaded) { loaded = value } } },
    globalThis: {},
    setInterval: () => 0,
    clearInterval: () => {},
  }, { filename: 'client.js' })
  assert.ok(loaded)
  return loaded.factory((id) => {
    if (id === 'react') return { createElement(type: unknown, props: unknown, ...children: unknown[]) { return { type, props, children } }, useState(initial: unknown) { return [initial, () => {}] }, useEffect() {}, useRef() { return { current: false } }, ...react }
    if (id === 'react-dom') return {}
    throw new Error(`unexpected browser dependency: ${id}`)
  }) as { apply: (ctx: unknown) => void; inject: string[] }
}

test('sidebar contracts: registers sidebar.panellist and main, with NO settings.section entry', () => {
  const registeredSlots: Array<{ name: string; options: Record<string, unknown>; component: any }> = []
  const injectedSlots: string[] = []

  const plugin = loadClient()

  let activeLocale = 'zh'
  const locale = {
    addLanguage() { return () => {} },
    register() { return () => {} },
    bind(namespace: string) {
      return (key: string) => {
        if (key === 'section.label') return 'Antigravity'
        return `${namespace}.${key}`
      }
    },
    subscribe() { return () => {} },
    setLocale(lang: string) { activeLocale = lang },
  }

  const ctx = {
    locale,
    effect(callback: () => void) { callback() },
    slots: {
      inject(name: string, callback: () => void) {
        injectedSlots.push(name)
        callback()
      },
      register(options: Record<string, unknown>, component: any) {
        registeredSlots.push({ name: (options.name as string) ?? '', options, component })
        return () => {}
      },
    },
  }

  plugin.apply(ctx)

  // 1. Settings navigation entry MUST NOT exist (moved out of Settings)
  assert.equal(injectedSlots.includes('settings.section'), false, 'settings.section slot must NOT be injected')
  assert.equal(registeredSlots.some(s => s.name === 'settings.section'), false, 'settings.section must NOT be registered')

  // 2. sidebar.panellist MUST be registered directly below 自动化任务 and above 更多 (order 20)
  const sidebarSlot = registeredSlots.find(s => s.name === 'sidebar.panellist')
  assert.ok(sidebarSlot, 'sidebar.panellist slot must be registered')
  assert.equal(sidebarSlot.options.id, 'agy-link', 'sidebar entry id must be "agy-link"')
  assert.equal(typeof sidebarSlot.options.order, 'number')
  assert.ok((sidebarSlot.options.order as number) > 10, 'sidebar panel order must be placed below 自动化任务 (order > 10)')
  assert.ok((sidebarSlot.options.order as number) < 100, 'sidebar panel order must be less than 100')
  assert.equal(sidebarSlot.options.order, 20, 'order 20 places entry directly below 自动化任务 and above 更多')
  assert.equal(sidebarSlot.options.locale, 'agy-link')

  const labelFn = sidebarSlot.options.label as () => string
  assert.equal(typeof labelFn, 'function')
  assert.equal(labelFn(), 'Antigravity')

  // Sidebar icon renders SVG glyph
  assert.equal(typeof sidebarSlot.component, 'function')
  const icon16 = sidebarSlot.component({ size: 16 }) as { type: string; props?: { width?: number; height?: number } }
  assert.equal(icon16.type, 'svg')
  assert.equal(icon16.props?.width, 16)
  assert.equal(icon16.props?.height, 16)

  const icon18 = sidebarSlot.component({ size: 18 }) as { type: string; props?: { width?: number; height?: number } }
  assert.equal(icon18.type, 'svg')
  assert.equal(icon18.props?.width, 18)
  assert.equal(icon18.props?.height, 18)

  // 3. main slot MUST be registered with key 'agy-link'
  const mainSlot = registeredSlots.find(s => s.name === 'main')
  assert.ok(mainSlot, 'main slot must be registered')
  assert.equal(mainSlot.options.key, 'agy-link', 'main slot key must match sidebar entry id "agy-link"')
  assert.equal(mainSlot.options.locale, 'agy-link')
  assert.equal(typeof mainSlot.component, 'function')

  // 4. Existing controls & plugins configuration slots are fully preserved
  const headerAction = registeredSlots.find(s => s.name === 'conversation.session.header.actions')
  assert.ok(headerAction, 'conversation.session.header.actions must be preserved')

  const bundleConfig = registeredSlots.find(s => s.name === 'plugins.bundle.config')
  assert.ok(bundleConfig, 'plugins.bundle.config must be preserved')
  assert.equal(bundleConfig.options.key, 'dsh-agy-link')

  const rowConfig = registeredSlots.find(s => s.name === 'plugins.row.config')
  assert.ok(rowConfig, 'plugins.row.config must be preserved')
  assert.equal(rowConfig.options.key, 'dsh-agy-link#agy-link')
})
