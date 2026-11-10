/**
 * Offline wiring tests for the Slothy model picker.
 *
 * The browser half is loaded through a fake module loader and applied to fake
 * Cordis services, so we can assert what it registers without a browser:
 * the appearance settings page, the composer seat and its priority per mode.
 * No React rendering happens here.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const clientSource = readFileSync(join(root, 'lib', 'client.js'), 'utf8')
const STORAGE_KEY = 'dsh-slothy-model-picker:appearance:v1'

/** Load `lib/client.js` with a fake loader and return its plugin object. */
function loadClientPlugin(storedAppearance) {
  const store = { [STORAGE_KEY]: JSON.stringify(storedAppearance) }
  const localStorage = {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value) },
  }
  const React = {
    createElement: () => null,
    Fragment: Symbol('Fragment'),
    useState: () => [undefined, () => {}],
    useEffect: () => {},
    useLayoutEffect: () => {},
    useMemo: (factory) => factory(),
    useCallback: (fn) => fn,
    useRef: () => ({ current: null }),
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  }
  const reactDom = { createPortal: (node) => node }
  const requireShim = (id) => {
    if (id === 'react') return React
    if (id === 'react-dom') return reactDom
    throw new Error('unexpected require: ' + id)
  }
  let factory = null
  const windowShim = { __ModuleLoader__: { load: (entry) => { factory = entry.factory } } }
  new Function('window', 'localStorage', 'require', clientSource)(windowShim, localStorage, requireShim)
  assert.equal(typeof factory, 'function', 'client module registers a factory')
  return factory(requireShim)
}

/** Apply the client plugin to fake services and return the registration log. */
function applyClient(mode) {
  const plugin = loadClientPlugin({ mode })
  const records = []
  const slots = {
    inject: (_key, callback) => callback(),
    register: (options) => { records.push({ slot: options.name, options }); return () => {} },
  }
  const directory = {
    store: { subscribe: () => () => {}, getSnapshot: () => ({ status: 'ready', current: null, pending: null, error: null, groups: [], failures: [] }) },
    load: () => Promise.resolve(),
    select: () => Promise.resolve({ ok: true }),
  }
  const models = { directoryFor: () => directory }
  const scope = { get: (name) => (name === 'slots' ? slots : name === 'modelDirectories' ? models : undefined) }
  const ctx = {
    get: (name) => (name === 'locale'
      ? { register: () => () => {}, bind: () => (key) => key }
      : name === 'slots' ? slots : undefined),
    effect: (callback) => callback(),
    inject: (_deps, callback) => callback(scope),
  }
  plugin.apply(ctx)
  return records
}

test('registers the appearance settings section', () => {
  const records = applyClient('default')
  const settings = records.find((record) => record.slot === 'settings.section')
  assert.ok(settings, 'settings.section registration exists')
  assert.equal(settings.options.id, 'slothy-picker')
  assert.equal(settings.options.order, 35)
  assert.equal(typeof settings.options.label, 'function')
  assert.equal(settings.options.label(), 'settings.nav')
})

test('default mode registers the composer seat at priority -1', () => {
  const records = applyClient('default')
  const seat = records.find((record) => record.slot === 'conversation.input.model')
  assert.ok(seat, 'composer seat registration exists')
  assert.equal(seat.options.priority, -1)
  assert.equal(seat.options.locale, 'slothyModelPicker')
})

test('custom mode raises the composer seat priority to -1000', () => {
  const records = applyClient('custom')
  const seat = records.find((record) => record.slot === 'conversation.input.model')
  assert.ok(seat)
  assert.equal(seat.options.priority, -1000)
})

test('the seat inject face resolves the shared model directory', () => {
  const records = applyClient('default')
  const seat = records.find((record) => record.slot === 'conversation.input.model')
  const face = seat.options.inject('test-session')
  assert.equal(face.available, true)
  assert.equal(typeof face.load, 'function')
  assert.equal(typeof face.select, 'function')
  assert.ok(face.directory, 'directory store is exposed')
})

test('host half exports apply', async () => {
  const host = await import('../lib/index.js')
  assert.equal(typeof host.apply, 'function')
})

test('package layout matches the health-check expectations', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  assert.equal(manifest.main, 'lib/index.js')
  assert.equal(manifest.exports['.'], './lib/index.js')
  assert.equal(manifest.exports['./client'], './lib/client.js')
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml')
  assert.ok(manifest.files.includes('lib/index.js'))
  assert.ok(manifest.files.includes('lib/client.js'))
})
