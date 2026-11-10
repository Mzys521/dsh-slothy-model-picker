/**
 * Slothy model picker — Client half of the bundle.
 *
 * Renders the composer's `conversation.input.model` seat with the extracted
 * Slothy component: a trigger showing the current model and reasoning effort, a
 * provider-grouped model list, and a reasoning-effort slider. Data comes from
 * the shipped model-selection service (`ctx.modelDirectories`), whose per-session
 * directory store is the same one the built-in `/model` popup and seat use, so a
 * switch made here is what the rest of the GUI shows next.
 *
 * The seat is registered at priority -1: a `single` slot renders its lowest
 * priority, so this registration shadows the shipped occupant without removing
 * it, and disabling/removing this bundle restores the shipped picker.
 *
 * Slothy 模型选择器的 Client 半侧：复用内置 model-selection 的 `ctx.modelDirectories`
 * 会话目录，以 priority -1 遮蔽内置模型位（单槽取最低优先级渲染），停用本插件即恢复。
 */
window.__ModuleLoader__.load({
  id: 'dsh-slothy-model-picker',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const Fragment = React.Fragment
    const { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } = React

    let createPortal = null
    try {
      const reactDom = require('react-dom')
      if (reactDom && typeof reactDom.createPortal === 'function') createPortal = reactDom.createPortal
    } catch (error) {
      createPortal = null
    }

    const NS = 'slothyModelPicker'
    /** Lower priority renders in a `single` slot; the shipped seat registers at 0. */
    const SEAT_PRIORITY = -1
    /** Custom appearance mode takes the strongest seat precedence available. */
    const SEAT_PRIORITY_CUSTOM = -1000
    const EMPTY_STATE = { status: 'loading', current: null, pending: null, error: null, retainedEffort: undefined, groups: [], failures: [] }

    /** `model` namespace: visible labels only; ids never reach this dictionary. */
    const en = {
      'trigger.fallback': 'Select model',
      'trigger.loading': 'Loading models…',
      'trigger.aria': 'LLM model · {model}',
      'trigger.ariaEffort': 'LLM model · {model} · {effort}',
      'menu.label': 'Model settings',
      'menu.select': 'Select a model',
      'menu.effort': 'Thinking effort',
      'menu.model': 'Model',
      'menu.restore': 'Restore default effort',
      'status.loading': 'Loading models…',
      'empty.models': 'No models available',
      'empty.efforts': 'This model has no reasoning effort levels',
      'error.load': 'The model catalog failed to load: {message}',
      'error.select': 'Changing the model failed: {message}',
      'error.sessionInUse': 'Another DSH instance is writing this session; quit other running instances and retry.',
      'warning.group': '{name}: {message}',
      'action.retry': 'Retry',
      'effort.providerDefault': 'Provider default',
      'provider.account': 'DeepSeek account',
      'settings.nav': 'Appearance',
      'settings.title': 'Slothy model picker',
      'settings.hint': 'Customize the model picker background and colors. Default mode follows the DSH theme; custom mode overrides it with the highest priority.',
      'settings.mode': 'Mode',
      'settings.default': 'Default',
      'settings.custom': 'Custom',
      'settings.customHint': 'Custom values are applied inline and win over the DSH theme and skins. Clear a value to fall back to the theme color.',
      'settings.image': 'Background image',
      'settings.imagePlaceholder': 'https://… or data:image/…',
      'settings.surface': 'Background color',
      'settings.accent': 'Accent color',
      'settings.track': 'Track color',
      'settings.thumb': 'Thumb color',
      'settings.ink': 'Text color',
      'settings.maxColor': 'Max effort color',
      'settings.followTheme': 'Theme',
      'settings.clear': 'Clear',
      'settings.preview': 'Preview',
      'settings.preview.caption': 'Select a model',
      'settings.preview.model': 'DeepSeek V4',
      'settings.preview.effort': 'High',
      'settings.reset': 'Reset to default',
    }
    const zh = {
      'trigger.fallback': '请选择模型',
      'trigger.loading': '正在加载模型…',
      'trigger.aria': 'LLM 模型 · {model}',
      'trigger.ariaEffort': 'LLM 模型 · {model} · {effort}',
      'menu.label': '模型设置',
      'menu.select': '选择模型',
      'menu.effort': '思考强度',
      'menu.model': '模型',
      'menu.restore': '恢复默认档位',
      'status.loading': '正在加载模型…',
      'empty.models': '暂无可用模型',
      'empty.efforts': '该模型没有可选的思考强度',
      'error.load': '模型目录加载失败：{message}',
      'error.select': '切换模型失败：{message}',
      'error.sessionInUse': '另一个 DSH 实例正在写入本会话，请退出其他实例后重试。',
      'warning.group': '{name}：{message}',
      'action.retry': '重试',
      'effort.providerDefault': '服务商默认',
      'provider.account': 'DeepSeek 账号',
      'settings.nav': '外观',
      'settings.title': 'Slothy 模型选择器',
      'settings.hint': '自定义模型选择器的背景与配色。默认模式跟随 DSH 主题；自定义模式以内联样式覆盖，优先级最高。',
      'settings.mode': '模式',
      'settings.default': '默认',
      'settings.custom': '自定义',
      'settings.customHint': '自定义值以内联样式生效，优先于 DSH 主题与皮肤；清空某项即回退到主题色。',
      'settings.image': '背景图',
      'settings.imagePlaceholder': 'https://… 或 data:image/…',
      'settings.surface': '背景色',
      'settings.accent': '强调色',
      'settings.track': '轨道色',
      'settings.thumb': '滑钮色',
      'settings.ink': '文字色',
      'settings.maxColor': '最高档位色',
      'settings.followTheme': '主题',
      'settings.clear': '清除',
      'settings.preview': '预览',
      'settings.preview.caption': '选择模型',
      'settings.preview.model': 'DeepSeek V4',
      'settings.preview.effort': '高',
      'settings.reset': '恢复默认',
    }

    /** Browser-language fallback used only when the seat's bound translator is absent. */
    function fallbackDict() {
      try {
        return /^zh/i.test(String((typeof navigator !== 'undefined' && navigator.language) || '')) ? zh : en
      } catch (error) {
        return en
      }
    }

    function interpolate(template, params) {
      return String(template).replace(/\{(\w+)\}/g, (match, key) =>
        params && Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match)
    }

    function makeTranslate(t) {
      const table = fallbackDict()
      return (key, params) => {
        let text
        if (typeof t === 'function') {
          text = t(key, params)
          // A translator without our namespace would echo the key back.
          if (typeof text !== 'string' || text === key) text = table[key] !== undefined ? table[key] : key
        } else {
          text = table[key] !== undefined ? table[key] : key
        }
        return interpolate(text, params)
      }
    }

    /**
     * Appearance settings: one browser-local store shared by the composer seat
     * and the settings page. Custom values ride on inline CSS custom properties,
     * which outrank theme/skin declarations (highest cascade priority); default
     * mode leaves the current DSH theme untouched.
     */
    const APPEARANCE_KEY = 'dsh-slothy-model-picker:appearance:v1'
    const APPEARANCE_DEFAULT = Object.freeze({ mode: 'default', surface: '', image: '', accent: '', track: '', thumb: '', ink: '', maxColor: '' })
    const appearanceListeners = new Set()
    let appearanceState = null

    function appearanceStorage() {
      try {
        return typeof localStorage === 'undefined' ? null : localStorage
      } catch (error) {
        return null
      }
    }

    function normalizeAppearance(raw) {
      const source = raw && typeof raw === 'object' ? raw : {}
      const field = (key) => typeof source[key] === 'string' ? source[key].trim() : ''
      return {
        mode: source.mode === 'custom' ? 'custom' : 'default',
        surface: field('surface'),
        image: field('image'),
        accent: field('accent'),
        track: field('track'),
        thumb: field('thumb'),
        ink: field('ink'),
        maxColor: field('maxColor'),
      }
    }

    function getAppearance() {
      if (appearanceState !== null) return appearanceState
      let parsed = null
      try {
        const store = appearanceStorage()
        const raw = store ? store.getItem(APPEARANCE_KEY) : null
        if (raw) parsed = JSON.parse(raw)
      } catch (error) {
        parsed = null
      }
      appearanceState = normalizeAppearance(parsed)
      return appearanceState
    }

    function setAppearance(patch) {
      const current = getAppearance()
      const next = normalizeAppearance(Object.assign({}, current, patch))
      appearanceState = next
      try {
        const store = appearanceStorage()
        if (store) store.setItem(APPEARANCE_KEY, JSON.stringify(next))
      } catch (error) {
        // Private mode or quota: keep the in-memory value for this page.
      }
      appearanceListeners.forEach((listener) => {
        try {
          listener(next)
        } catch (error) {
          // One failing subscriber must not block the others.
        }
      })
    }

    function resetAppearance() {
      setAppearance(APPEARANCE_DEFAULT)
    }

    function subscribeAppearance(listener) {
      appearanceListeners.add(listener)
      return () => { appearanceListeners.delete(listener) }
    }

    function currentSeatPriority() {
      return getAppearance().mode === 'custom' ? SEAT_PRIORITY_CUSTOM : SEAT_PRIORITY
    }

    function appearanceVars(appearance) {
      if (!appearance || appearance.mode !== 'custom') return null
      const style = {}
      if (appearance.accent) style['--smp-accent'] = appearance.accent
      if (appearance.track) style['--smp-track'] = appearance.track
      if (appearance.thumb) style['--smp-thumb'] = appearance.thumb
      if (appearance.ink) style['--smp-ink'] = appearance.ink
      if (appearance.surface) style['--smp-surface'] = appearance.surface
      if (appearance.maxColor) style['--smp-max-color'] = appearance.maxColor
      return Object.keys(style).length === 0 ? null : style
    }

    function appearanceBackground(appearance) {
      if (!appearance || appearance.mode !== 'custom' || appearance.image === '') return null
      return {
        backgroundImage: 'url(' + JSON.stringify(appearance.image) + ')',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
    }

    /** Deterministic spark shape: sparks trail backwards inside the track and never leave it. */
    const PARTICLES = Array.from({ length: 16 }, (_, index) => {
      const lane = (index % 7) - 3
      const drift = 8 + (index % 6) * 7
      return {
        key: index,
        style: {
          '--smp-p-x': (-drift) + 'px',
          '--smp-p-y': (lane * 3) + 'px',
          '--smp-p-delay': (index * 0.075).toFixed(3) + 's',
          '--smp-p-size': (2 + (index % 3)) + 'px',
        },
      }
    })

    /** One burst layer around the slider thumb. */
    function ParticleField() {
      return h('span', { className: 'smp-particles', 'aria-hidden': true },
        PARTICLES.map((particle) => h('span', { key: particle.key, className: 'smp-particle', style: particle.style })))
    }

    function icon(paths, props) {
      return h('svg', Object.assign({ viewBox: '0 0 24 24', 'aria-hidden': true, focusable: 'false' }, props || {}), paths)
    }
    const ChevronDown = () => icon(h('path', { d: 'm6 9 6 6 6-6', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6 }), { className: 'smp-chevron' })
    const ChevronRight = () => icon(h('path', { d: 'm9 6 6 6-6 6', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6 }), { className: 'smp-chevron smp-chevron-inline' })
    const Check = () => icon(h('path', { d: 'm5 12 5 5L20 6', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }), { className: 'smp-check' })
    const Reset = () => icon(h(Fragment, null,
      h('path', { d: 'M4 4v6h6M20 20v-6h-6', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6 }),
      h('path', { d: 'M5 10a8 8 0 0 1 14-4M19 14a8 8 0 0 1-14 4', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6 })), { className: 'smp-icon' })
    const ModelGlyph = () => icon(h(Fragment, null,
      h('path', { d: 'M4 7h9M4 12h6M4 17h9', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' }),
      h('circle', { cx: 17, cy: 15.5, r: 3.2, fill: 'none', stroke: 'currentColor', strokeWidth: 1.7 })), { className: 'smp-trigger-icon' })

    function providerName(group, tr) {
      return group.id === 'deepseek-account' ? tr('provider.account') : (group.name || group.id)
    }

    /** Shipped display order: account, official, then catalog order. */
    function orderGroups(groups) {
      const rank = (id) => id === 'deepseek-account' ? 0 : id === 'deepseek-official' ? 1 : 2
      return groups.slice().sort((left, right) => rank(left.id) - rank(right.id))
    }

    function findChoice(groups, selection) {
      if (!selection) return null
      for (let index = 0; index < groups.length; index += 1) {
        const group = groups[index]
        const models = group.models || []
        for (let position = 0; position < models.length; position += 1) {
          const model = models[position]
          if (group.id === selection.provider && model.id === selection.model) return { group, model }
        }
      }
      return null
    }

    function effortsOf(choice) {
      const reasoning = choice && choice.model ? choice.model.reasoning : undefined
      return reasoning && reasoning.efforts ? reasoning.efforts : []
    }

    function defaultEffortOf(choice) {
      const reasoning = choice && choice.model ? choice.model.reasoning : undefined
      return reasoning ? reasoning.defaultEffort : undefined
    }

    /**
     * One composer model seat.
     *
     * Props: the owner share (`locked`), the session-injected face
     * (`available`, `directory`, `load`, `select`) and the namespace-bound
     * translator (`t`) requested by the `locale` registration option.
     */
    function ModelPickerSeat(props) {
      const locked = props.locked === true
      const available = props.available === true && !!props.directory
      const directory = props.directory
      const load = props.load
      const select = props.select
      const tr = useMemo(() => makeTranslate(props.t), [props.t])
      const appearance = useSyncExternalStore(subscribeAppearance, getAppearance, getAppearance)
      const customVars = appearanceVars(appearance)
      const customBackground = appearanceBackground(appearance)

      const subscribe = useCallback((notify) => {
        if (!directory) return () => {}
        return directory.subscribe(notify)
      }, [directory])
      const getSnapshot = useCallback(() => (directory ? directory.getSnapshot() : EMPTY_STATE), [directory])
      const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

      const [open, setOpen] = useState(false)
      const [pane, setPane] = useState('models')
      const [paneChoice, setPaneChoice] = useState(null)
      const [dragIndex, setDragIndex] = useState(null)
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState(null)
      const [position, setPosition] = useState(null)
      const dragRef = useRef(null)
      const dragRaf = useRef(null)
      const settledRef = useRef(false)
      const rootRef = useRef(null)
      const triggerRef = useRef(null)
      const popupRef = useRef(null)

      useEffect(() => () => { if (dragRaf.current !== null) cancelAnimationFrame(dragRaf.current) }, [])

      const groups = useMemo(() => orderGroups(state.groups || []), [state.groups])
      const failures = state.failures || []
      const currentChoice = useMemo(() => findChoice(groups, state.current), [groups, state.current])
      const effortChoice = paneChoice || currentChoice
      const levels = effortsOf(effortChoice)
      const defaultEffort = defaultEffortOf(effortChoice)
      const isCurrentTarget = !!effortChoice && !!state.current
        && state.current.provider === effortChoice.group.id
        && state.current.model === effortChoice.model.id
      const activeEffortId = isCurrentTarget ? (state.current.reasoningEffort || defaultEffort) : defaultEffort
      const activeIndex = Math.max(0, levels.findIndex((level) => level.id === activeEffortId))
      const shownIndex = dragIndex === null ? activeIndex : Math.max(0, Math.min(dragIndex, Math.max(0, levels.length - 1)))
      const levelPosition = (100 * shownIndex) / Math.max(1, levels.length - 1) + '%'
      const effortName = levels.length
        ? (levels[shownIndex] && levels[shownIndex].name) || state.retainedEffort || tr('effort.providerDefault')
        : (state.retainedEffort || tr('effort.providerDefault'))

      const currentLevels = effortsOf(currentChoice)
      const currentEffortId = state.current && currentChoice && state.current.provider === currentChoice.group.id
        && state.current.model === currentChoice.model.id
        ? (state.current.reasoningEffort || defaultEffortOf(currentChoice))
        : defaultEffortOf(currentChoice)
      const triggerEffort = currentLevels.length
        ? (currentLevels.find((level) => level.id === currentEffortId) || {}).name || state.retainedEffort || tr('effort.providerDefault')
        : undefined
      const currentEffortIndex = currentLevels.findIndex((level) => level.id === currentEffortId)
      const maxEffortActive = currentLevels.length > 1 && currentEffortIndex === currentLevels.length - 1
      const modelLabel = currentChoice
        ? currentChoice.model.name
        : (groups.length === 0 && (state.status === 'loading' || state.status === 'idle') ? tr('trigger.loading') : tr('trigger.fallback'))
      const ariaLabel = triggerEffort === undefined
        ? tr('trigger.aria', { model: modelLabel })
        : tr('trigger.ariaEffort', { model: modelLabel, effort: triggerEffort })
      const pending = state.pending || null
      const disabled = busy || pending !== null

      // Release the settle lock once the store catches up with the chosen level,
      // or after a fail-safe delay, so the thumb slides smoothly instead of snapping.
      useEffect(() => {
        if (dragIndex === null || !settledRef.current) return
        if (dragIndex === activeIndex && pending === null) {
          settledRef.current = false
          setDragIndex(null)
          return
        }
        const timer = setTimeout(() => {
          settledRef.current = false
          setDragIndex(null)
        }, 1200)
        return () => clearTimeout(timer)
      }, [dragIndex, activeIndex, pending])

      const place = useCallback(() => {
        const trigger = triggerRef.current
        if (!trigger) return
        const rect = trigger.getBoundingClientRect()
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight
        const width = Math.max(260, Math.min(340, viewportWidth - 24))
        const right = Math.max(12, Math.min(viewportWidth - rect.right, viewportWidth - width - 12))
        const bottom = Math.max(12, viewportHeight - rect.top + 8)
        const maxHeight = Math.max(180, Math.min(440, rect.top - 24))
        setPosition({ right, bottom, width, maxHeight })
      }, [])

      useLayoutEffect(() => {
        if (!open) { setPosition(null); return }
        place()
        window.addEventListener('resize', place)
        window.addEventListener('scroll', place, true)
        return () => {
          window.removeEventListener('resize', place)
          window.removeEventListener('scroll', place, true)
        }
      }, [open, pane, place])

      useLayoutEffect(() => {
        if (!open) return
        const popup = popupRef.current
        if (!popup) return
        const target = popup.querySelector('button:not([disabled]), input:not([disabled])')
        if (target && typeof target.focus === 'function') target.focus()
      }, [open, pane])

      useEffect(() => {
        if (!open) return
        const onPointerDown = (event) => {
          const target = event.target
          if (!(target instanceof Node)) return
          if (rootRef.current && rootRef.current.contains(target)) return
          if (popupRef.current && popupRef.current.contains(target)) return
          setPaneChoice(null)
          setDragIndex(null)
          setOpen(false)
        }
        const onKeyDown = (event) => {
          if (event.key !== 'Escape') return
          event.preventDefault()
          event.stopPropagation()
          setPaneChoice(null)
          setDragIndex(null)
          setOpen(false)
          if (triggerRef.current && typeof triggerRef.current.focus === 'function') triggerRef.current.focus()
        }
        document.addEventListener('pointerdown', onPointerDown)
        document.addEventListener('keydown', onKeyDown, true)
        return () => {
          document.removeEventListener('pointerdown', onPointerDown)
          document.removeEventListener('keydown', onKeyDown, true)
        }
      }, [open])

      const reload = useCallback(() => {
        setError(null)
        if (typeof load === 'function') load()
      }, [load])

      const selectWith = useCallback((selection) => {
        if (typeof select !== 'function') return Promise.resolve(true)
        setError(null)
        setBusy(true)
        let outcome
        try {
          outcome = select(selection)
        } catch (failure) {
          setBusy(false)
          setError(tr('error.select', { message: failure && failure.message ? failure.message : String(failure) }))
          return Promise.resolve(false)
        }
        return Promise.resolve(outcome).then((result) => {
          setBusy(false)
          if (result === undefined || result === null || result.ok === true) return true
          const failure = result.error || {}
          if (failure.code === 'session/writer-held') {
            setError(tr('error.sessionInUse'))
          } else {
            setError(tr('error.select', { message: (failure.code ? failure.code + ': ' : '') + (failure.message || String(failure)) }))
          }
          return false
        }).catch((failure) => {
          setBusy(false)
          setError(tr('error.select', { message: failure && failure.message ? failure.message : String(failure) }))
          return false
        })
      }, [select, tr])

      const close = useCallback((restoreFocus) => {
        setPaneChoice(null)
        setDragIndex(null)
        setOpen(false)
        if (restoreFocus && triggerRef.current && typeof triggerRef.current.focus === 'function') triggerRef.current.focus()
      }, [])

      const show = useCallback((nextPane) => {
        setError(null)
        setDragIndex(null)
        setPaneChoice(null)
        setPane(nextPane)
        setOpen(true)
        reload()
      }, [reload])

      const toggle = () => {
        if (open) { close(true); return }
        const hasLevels = currentChoice !== null && effortsOf(currentChoice).length > 0
        show(hasLevels ? 'effort' : 'models')
      }

      const chooseModel = (group, model) => {
        setPaneChoice({ group, model })
        const hasLevels = effortsOf({ model }).length > 0
        const sameAsCurrent = state.current !== null
          && state.current.provider === group.id
          && state.current.model === model.id
        if (sameAsCurrent) {
          if (hasLevels) setPane('effort')
          else close(true)
          return
        }
        const selection = { provider: group.id, model: model.id }
        const defaultEffort = defaultEffortOf({ model })
        if (defaultEffort !== undefined) selection.reasoningEffort = defaultEffort
        const applying = selectWith(selection)
        if (hasLevels) {
          setPane('effort')
          return
        }
        void applying.then((ok) => { if (ok) close(true) })
      }

      const chooseEffort = (level) => {
        const target = effortChoice
        if (!target || !level) return Promise.resolve(false)
        const selection = { provider: target.group.id, model: target.model.id }
        if (level.id !== undefined) selection.reasoningEffort = level.id
        return selectWith(selection)
      }

      const restoreDefault = () => {
        const target = effortChoice
        if (!target) return
        // Omitting reasoningEffort is the provider default; keep it explicit
        // only when the adapter advertises one.
        const selection = { provider: target.group.id, model: target.model.id }
        if (defaultEffort !== undefined) selection.reasoningEffort = defaultEffort
        void selectWith(selection)
      }

      if (!available) return null

      const failureRows = failures.map((failure) => h('div', { className: 'smp-warning', key: 'failure-' + failure.id },
        h('span', null, tr('warning.group', { name: failure.id === 'deepseek-account' ? tr('provider.account') : (failure.name || failure.id), message: failure.message }))))

      const storeErrorRow = state.error !== null
        ? h('div', { className: 'smp-error' },
          h('span', null, tr('error.load', { message: state.error })),
          h('button', { type: 'button', className: 'smp-retry', onClick: reload }, tr('action.retry')))
        : null
      const localErrorRow = error !== null
        ? h('div', { className: 'smp-error' }, h('span', null, error))
        : null

      const modelsPane = h(Fragment, null,
        h('p', { className: 'smp-caption' }, tr('menu.select')),
        groups.length === 0 && (state.status === 'loading' || state.status === 'idle')
          ? h('div', { className: 'smp-status' }, tr('status.loading'))
          : null,
        storeErrorRow,
        localErrorRow,
        failureRows,
        groups.map((group) => h(Fragment, { key: group.id },
          h('p', { className: 'smp-provider' }, providerName(group, tr)),
          (group.models || []).map((model) => {
            const selected = state.current !== null && state.current.provider === group.id && state.current.model === model.id
            const isPending = pending !== null && pending.provider === group.id && pending.model === model.id
            return h('button', {
              type: 'button',
              key: model.id,
              className: 'smp-row',
              'aria-pressed': selected,
              disabled,
              title: model.name,
              onClick: () => chooseModel(group, model),
            },
            h('span', { className: 'smp-row-label' }, model.name),
            isPending ? h('span', { className: 'smp-spinner' }) : (selected ? h(Check) : null))
          }))),
        groups.length === 0 && state.status === 'ready' ? h('div', { className: 'smp-status' }, tr('empty.models')) : null)

      /**
       * Commit the drag/keys' final position. The thumb is locked at the
       * released level while the selection settles, so it never snaps back to
       * the old level first; it transitions smoothly once the store confirms
       * (or slides back on failure).
       */
      const commitDrag = () => {
        if (dragRaf.current !== null) {
          cancelAnimationFrame(dragRaf.current)
          dragRaf.current = null
        }
        const index = dragRef.current
        dragRef.current = null
        if (index === null || index === activeIndex) {
          setDragIndex(null)
          return
        }
        const level = levels[index]
        if (!level) {
          setDragIndex(null)
          return
        }
        setDragIndex(index)
        settledRef.current = false
        chooseEffort(level).then((ok) => {
          if (ok) settledRef.current = true
          else setDragIndex(null)
        })
      }

      /** Coalesce input events into one render per animation frame while dragging. */
      const dragTo = (next) => {
        settledRef.current = false
        dragRef.current = next
        if (dragRaf.current === null) {
          dragRaf.current = requestAnimationFrame(() => {
            dragRaf.current = null
            setDragIndex(dragRef.current)
          })
        }
      }

      const isMaxLevel = levels.length > 1 && shownIndex === levels.length - 1
      const slider = levels.length > 0
        ? h('div', {
          className: 'smp-slider' + (isMaxLevel ? ' smp-slider-max' : '') + (dragIndex !== null ? ' smp-slider-dragging' : ''),
          style: { '--smp-level': levelPosition },
        },
        h('span', { className: 'smp-slider-visual', 'aria-hidden': true },
          h('span', { className: 'smp-slider-fill' }),
          h('span', { className: 'smp-slider-marks' }, levels.map((level) => h('span', { key: level.id }))),
          h('span', { className: 'smp-slider-thumb' }),
          isMaxLevel ? h(ParticleField) : null),
        h('input', {
          className: 'smp-slider-range',
          type: 'range',
          min: 0,
          max: Math.max(0, levels.length - 1),
          step: 1,
          value: shownIndex,
          disabled,
          'aria-label': tr('menu.effort'),
          'aria-valuetext': effortName,
          onInput: (event) => dragTo(Number(event.currentTarget.value)),
          onPointerUp: commitDrag,
          onKeyUp: commitDrag,
          onBlur: commitDrag,
        }))
        : h('div', { className: 'smp-status' }, tr('empty.efforts'))

      const effortPane = effortChoice === null
        ? h('div', { className: 'smp-status' }, tr('empty.models'))
        : h(Fragment, null,
          h('div', { className: 'smp-effort-header' },
            h('button', { type: 'button', className: 'smp-effort-model' + (isMaxLevel ? ' smp-effort-model-max' : ''), onClick: () => setPane('models'), title: tr('menu.model') },
              h('strong', { className: isMaxLevel ? 'smp-effort-name-max' : undefined }, effortName),
              h('span', null, effortChoice.model.name, h(ChevronRight))),
            h('button', {
              type: 'button',
              className: 'smp-effort-reset',
              title: tr('menu.restore'),
              'aria-label': tr('menu.restore'),
              disabled: disabled || levels.length === 0,
              onClick: restoreDefault,
            }, h(Reset))),
          storeErrorRow,
          localErrorRow,
          slider)

      const popupBody = pane === 'effort' ? effortPane : modelsPane
      const popupStyle = createPortal
        ? {
          position: 'fixed',
          right: (position ? position.right : 12) + 'px',
          bottom: (position ? position.bottom : 12) + 'px',
          width: (position ? position.width : 320) + 'px',
          maxHeight: (position ? position.maxHeight : 360) + 'px',
        }
        : { position: 'absolute', right: 0, bottom: 'calc(100% + 12px)', width: 'min(340px, 88vw)', maxHeight: 'min(440px, 58dvh)' }

      const popup = open
        ? h('div', {
          ref: popupRef,
          className: 'smp-popup',
          role: 'group',
          'aria-label': tr('menu.label'),
          'aria-busy': disabled,
          style: Object.assign({}, popupStyle, customVars || {}, customBackground || {}),
        }, popupBody)
        : null

      const popupNode = popup === null ? null : (createPortal ? createPortal(popup, document.body) : popup)

      return h('div', { ref: rootRef, className: 'smp-root', style: customVars || undefined, onKeyDown: (event) => { if (event.key === 'Escape' && open) { event.stopPropagation() } } },
        h('style', null, PICKER_CSS),
        h('button', {
          ref: triggerRef,
          type: 'button',
          className: 'smp-trigger',
          'aria-haspopup': 'menu',
          'aria-expanded': open,
          'aria-label': ariaLabel,
          title: ariaLabel,
          'aria-busy': disabled,
          disabled: locked,
          onClick: toggle,
        },
        h(ModelGlyph),
        h('span', { className: 'smp-trigger-name' }, modelLabel),
        triggerEffort !== undefined ? h('span', { className: 'smp-trigger-effort' + (maxEffortActive ? ' smp-trigger-effort-max' : '') }, triggerEffort) : null,
        disabled ? h('span', { className: 'smp-spinner' }) : h(ChevronDown)),
        popupNode)
    }

    /** Color rows of the appearance page; an empty value falls back to the theme. */
    const APPEARANCE_FIELDS = [
      { key: 'surface', label: 'settings.surface', fallback: '#1f2320' },
      { key: 'accent', label: 'settings.accent', fallback: '#4d6bfe' },
      { key: 'track', label: 'settings.track', fallback: '#e8eaec' },
      { key: 'thumb', label: 'settings.thumb', fallback: '#ffffff' },
      { key: 'ink', label: 'settings.ink', fallback: '#1f2320' },
      { key: 'maxColor', label: 'settings.maxColor', fallback: '#ffb300' },
    ]

    /**
     * Settings page: default mode leaves the DSH theme untouched (current
     * appearance); custom mode applies inline overrides and raises the seat to
     * the strongest registration priority.
     */
    function AppearanceSettings(props) {
      const tr = useMemo(() => makeTranslate(props.t), [props.t])
      const appearance = useSyncExternalStore(subscribeAppearance, getAppearance, getAppearance)
      const custom = appearance.mode === 'custom'
      const vars = appearanceVars(appearance) || {}
      const background = appearanceBackground(appearance) || {}
      const update = (patch) => setAppearance(patch)

      const previewSlider = h('div', { className: 'smp-slider smp-slider-max', style: { '--smp-level': '100%' } },
        h('span', { className: 'smp-slider-visual' },
          h('span', { className: 'smp-slider-fill' }),
          h('span', { className: 'smp-slider-marks' }, [0, 1, 2].map((index) => h('span', { key: index }))),
          h('span', { className: 'smp-slider-thumb' }),
          h(ParticleField)))

      const preview = h('div', { className: 'smp-set-preview' },
        h('div', { className: 'smp-set-preview-trigger' },
          h('button', { type: 'button', className: 'smp-trigger', disabled: true },
            h(ModelGlyph),
            h('span', { className: 'smp-trigger-name' }, tr('settings.preview.model')),
            h('span', { className: 'smp-trigger-effort smp-trigger-effort-max' }, tr('settings.preview.effort')))),
        h('div', { className: 'smp-popup smp-set-preview-surface', style: Object.assign({}, vars, background) },
          h('p', { className: 'smp-caption' }, tr('settings.preview.caption')),
          h('p', { className: 'smp-provider' }, 'DeepSeek'),
          h('div', { className: 'smp-row smp-set-preview-row', 'aria-pressed': true },
            h('span', { className: 'smp-row-label' }, tr('settings.preview.model')),
            h(Check)),
          h('div', { className: 'smp-effort-header' },
            h('div', { className: 'smp-effort-model smp-effort-model-max' },
              h('strong', { className: 'smp-effort-name-max' }, tr('settings.preview.effort')),
              h('span', null, tr('settings.preview.model')))),
          previewSlider))

      const fields = custom
        ? h(Fragment, null,
          h('div', { className: 'smp-set-field' },
            h('span', { className: 'smp-set-label' }, tr('settings.image')),
            h('input', {
              className: 'smp-set-input',
              type: 'text',
              value: appearance.image,
              placeholder: tr('settings.imagePlaceholder'),
              onChange: (event) => update({ image: event.currentTarget.value }),
            })),
          APPEARANCE_FIELDS.map((field) => h('div', { className: 'smp-set-field', key: field.key },
            h('span', { className: 'smp-set-label' }, tr(field.label)),
            h('div', { className: 'smp-set-color' },
              h('input', {
                className: 'smp-set-swatch',
                type: 'color',
                value: appearance[field.key] || field.fallback,
                'aria-label': tr(field.label),
                onChange: (event) => update({ [field.key]: event.currentTarget.value }),
              }),
              h('span', { className: 'smp-set-value' }, appearance[field.key] || tr('settings.followTheme')),
              appearance[field.key]
                ? h('button', {
                  className: 'smp-set-clear',
                  type: 'button',
                  title: tr('settings.clear'),
                  'aria-label': tr('settings.clear'),
                  onClick: () => update({ [field.key]: '' }),
                }, '×')
                : null))))
        : null

      return h('div', { className: 'smp-set' },
        h('style', null, PICKER_CSS + '\n' + SETTINGS_CSS),
        h('h2', { className: 'smp-set-title' }, tr('settings.title')),
        h('p', { className: 'smp-set-hint' }, tr('settings.hint')),
        h('div', { className: 'smp-set-mode' },
          h('span', { className: 'smp-set-label' }, tr('settings.mode')),
          h('div', { className: 'smp-set-seg' },
            h('button', {
              type: 'button',
              className: 'smp-set-seg-button',
              'aria-pressed': appearance.mode === 'default',
              onClick: () => update({ mode: 'default' }),
            }, tr('settings.default')),
            h('button', {
              type: 'button',
              className: 'smp-set-seg-button',
              'aria-pressed': custom,
              onClick: () => update({ mode: 'custom' }),
            }, tr('settings.custom')))),
        custom ? h('p', { className: 'smp-set-hint' }, tr('settings.customHint')) : null,
        fields,
        h('div', { className: 'smp-set-preview-wrap' },
          h('span', { className: 'smp-set-label' }, tr('settings.preview')),
          preview),
        h('div', { className: 'smp-set-actions' },
          h('button', { type: 'button', className: 'smp-set-action', onClick: resetAppearance }, tr('settings.reset'))))
    }

    /** Styles use host theme aliases; brand color only marks the current effort. */
    const PICKER_CSS = [
      '.smp-root{position:relative;display:inline-flex;align-items:center;min-width:0;font:inherit}',
      '.smp-trigger{display:flex;align-items:center;gap:4px;height:28px;max-width:min(280px,34cqw);padding:0 6px 0 8px;border:0;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-secondary,#6b7280);font:inherit;font-size:13px;line-height:20px;cursor:pointer;outline:none;min-width:0}',
      '.smp-trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));color:var(--dsw-alias-label-primary,#1f2320)}',
      '.smp-trigger:focus-visible{box-shadow:0 0 0 2px var(--smp-accent,var(--dsw-alias-brand-primary,#4d6bfe))}',
      '.smp-trigger:disabled{color:var(--dsw-alias-label-dimmed,#9aa0a6);cursor:default}',
      '.smp-trigger-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:var(--dsh-composer-model-text-display,block)}',
      '.smp-trigger-effort{flex:none;max-width:7em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-caption,#8a8f88);display:var(--dsh-composer-model-text-display,block)}',
      '.smp-trigger-icon{display:var(--dsh-composer-model-icon-display,none);flex:none;width:16px;height:16px}',
      '.smp-chevron{flex:none;width:15px;height:15px;color:var(--dsw-alias-label-caption,#8a8f88)}',
      '.smp-chevron-inline{display:inline;width:12px;height:12px;vertical-align:middle;margin-inline-start:2px}',
      '.smp-icon{width:15px;height:15px;flex:none}',
      '.smp-check{flex:none;width:15px;height:15px;color:var(--smp-accent,var(--dsw-alias-brand-primary,#4d6bfe))}',
      '.smp-popup{position:fixed;z-index:1100;box-sizing:border-box;display:flex;flex-direction:column;overflow:auto;padding:6px;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));border-radius:var(--dsw-radius-md,12px);background:var(--smp-surface,var(--dsw-alias-bg-overlay,#fff));color:var(--smp-ink,var(--dsw-alias-label-primary,#1f2320));box-shadow:var(--dsw-elevation-prominent,0 12px 32px rgba(0,0,0,.18));font-size:13px;line-height:20px}',
      '.smp-caption{margin:0;padding:4px 8px;color:var(--dsw-alias-label-secondary,#6b7280);font-size:12px;line-height:18px}',
      '.smp-provider{margin:4px 0 0;padding:4px 8px;color:var(--dsw-alias-label-secondary,#6b7280);font-size:12px;line-height:18px;font-weight:600}',
      '.smp-row{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;padding:7px 8px;border:0;border-radius:var(--dsw-radius-sm,8px);background:transparent;color:inherit;font:inherit;text-align:start;overflow-wrap:anywhere;cursor:pointer}',
      '.smp-row:hover:not(:disabled),.smp-row:focus-visible:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}',
      '.smp-row[aria-pressed="true"]{background:var(--dsw-alias-interactive-bg-active,rgba(0,0,0,.09))}',
      '.smp-row:disabled{opacity:.55;cursor:default}',
      '.smp-row-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.smp-status,.smp-error,.smp-warning{margin:4px 0;padding:6px 8px;border-radius:var(--dsw-radius-sm,8px);font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#6b7280)}',
      '.smp-error{color:var(--dsw-alias-state-error-primary,#d33)}',
      '.smp-warning{color:var(--dsw-alias-state-warn-primary,#a66a00)}',
      '.smp-retry{margin-inline-start:8px;padding:2px 8px;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.16));border-radius:6px;background:transparent;color:inherit;font:inherit;font-size:12px;cursor:pointer}',
      '.smp-spinner{flex:none;width:12px;height:12px;border-radius:50%;border:2px solid var(--dsw-alias-border-l2,rgba(0,0,0,.2));border-top-color:var(--smp-accent,var(--dsw-alias-brand-primary,#4d6bfe));animation:smp-spin .8s linear infinite}',
      '@keyframes smp-spin{to{transform:rotate(360deg)}}',
      '.smp-effort-header{display:grid;grid-template-columns:26px minmax(0,1fr) 26px;align-items:start;gap:6px;color:var(--dsw-alias-label-secondary,#6b7280)}',
      '.smp-effort-model{grid-column:2;display:grid;justify-items:center;gap:2px;padding:6px 4px;border:0;border-radius:var(--dsw-radius-sm,8px);background:var(--dsw-alias-bg-layer-2,#f1f2f4);color:inherit;font:inherit;text-align:center;overflow-wrap:anywhere;cursor:pointer}',
      '.smp-effort-model strong{color:var(--smp-accent,var(--dsw-alias-brand-primary,#4d6bfe));font-weight:600}',
      '.smp-effort-model span{font-size:12px;display:inline-flex;align-items:center;gap:2px;min-width:0}',
      '.smp-effort-reset{grid-column:3;display:grid;place-items:center;height:28px;border:0;border-radius:var(--dsw-radius-sm,8px);background:transparent;color:inherit;cursor:pointer}',
      '.smp-effort-reset:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}',
      '.smp-effort-reset:disabled{opacity:.45;cursor:default}',
      '.smp-slider{position:relative;height:32px;margin:18px 8px 10px;border-radius:999px;background:var(--smp-track,var(--dsw-alias-bg-layer-2,#e8eaec));box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l1,rgba(0,0,0,.08)),inset 0 2px 6px rgba(0,0,0,.10);overflow:hidden;contain:paint}',
      '.smp-slider-visual{position:absolute;inset:0 16px;pointer-events:none}',
      '.smp-slider-fill{position:absolute;z-index:1;inset:0 auto 0 -16px;width:calc(16px + var(--smp-level));border-radius:999px;overflow:hidden;background:var(--smp-accent,var(--dsw-alias-brand-primary,#4d6bfe));transition:width .22s ease-out}',
      '.smp-slider-dragging .smp-slider-fill,.smp-slider-dragging .smp-slider-thumb{transition-duration:.12s}',
      '.smp-slider-fill::after{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(105deg,transparent 25%,rgba(255,255,255,.55) 48%,transparent 72%);background-size:220% 100%;opacity:0;pointer-events:none;mix-blend-mode:screen}',
      '.smp-slider-max .smp-slider-fill{width:calc(32px + var(--smp-level));background:linear-gradient(100deg,var(--smp-accent,var(--dsw-alias-brand-primary,#4d6bfe)),var(--smp-max-color,#ffb300),var(--smp-accent,var(--dsw-alias-brand-primary,#4d6bfe)));background-size:220% 100%;animation:smp-flow 2.4s linear infinite;box-shadow:inset 0 0 0 1px rgba(255,255,255,.22),inset 0 0 12px -4px var(--smp-max-color,#ffb300)}',
      '.smp-slider-max .smp-slider-fill::after{opacity:1;animation:smp-sheen 1.5s linear infinite}',
      '.smp-slider-marks{position:absolute;inset:0 -3px;display:flex;align-items:center;justify-content:space-between;z-index:2}',
      '.smp-slider-marks>span{width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-bg-overlay,#fff);opacity:.85}',
      '.smp-slider-thumb{position:absolute;z-index:3;top:50%;left:var(--smp-level);box-sizing:border-box;width:28px;height:28px;transform:translate(-50%,-50%);border-radius:50%;border:3px solid var(--smp-accent,var(--dsw-alias-brand-primary,#4d6bfe));background:var(--smp-thumb,var(--dsw-alias-bg-overlay,#fff));box-shadow:0 2px 8px rgba(0,0,0,.28);transition:left .22s ease-out,box-shadow .25s ease}',
      '.smp-slider-thumb::before{content:"";position:absolute;inset:-5px;border-radius:50%;background:var(--smp-max-color,#ffb300);opacity:0;transform:scale(.7);transition:opacity .25s ease,transform .25s ease}',
      '.smp-slider-max .smp-slider-thumb{border-color:var(--smp-max-color,#ffb300);box-shadow:0 0 12px -2px var(--smp-max-color,#ffb300),0 2px 8px rgba(0,0,0,.28)}',
      '.smp-slider-max .smp-slider-thumb::before{opacity:.3;transform:scale(1);animation:smp-pulse 1.8s ease-in-out infinite}',
      '.smp-particles{position:absolute;top:50%;left:var(--smp-level);width:0;height:0;pointer-events:none;z-index:2}',
      '.smp-particle{position:absolute;left:0;top:0;width:var(--smp-p-size,3px);height:var(--smp-p-size,3px);margin:calc(var(--smp-p-size,3px) / -2);border-radius:50%;background:var(--smp-max-color,#ffb300);box-shadow:0 0 6px var(--smp-max-color,#ffb300);opacity:0;animation:smp-particle 1.15s ease-out infinite;animation-delay:var(--smp-p-delay,0s)}',
      '.smp-slider-range{position:absolute;inset:0;width:100%;height:100%;margin:0;appearance:none;opacity:0;cursor:pointer;z-index:4}',
      '.smp-slider-range::-webkit-slider-thumb{appearance:none;width:28px;height:28px}',
      '.smp-slider-range::-moz-range-thumb{width:28px;height:28px}',
      '.smp-slider:has(.smp-slider-range:focus-visible){outline:2px solid var(--smp-accent,var(--dsw-alias-brand-primary,#4d6bfe));outline-offset:4px}',
      '.smp-trigger-effort-max,.smp-effort-model-max strong{font-weight:600;color:var(--smp-max-color,var(--smp-accent,var(--dsw-alias-brand-primary,#4d6bfe)))}',
      '@keyframes smp-sheen{from{background-position:220% 0}to{background-position:-120% 0}}',
      '@keyframes smp-flow{from{background-position:0 0}to{background-position:220% 0}}',
      '@keyframes smp-pulse{0%,100%{transform:scale(1);opacity:.22}50%{transform:scale(1.4);opacity:.34}}',
      '@keyframes smp-particle{0%{opacity:0;transform:translate(0,0) scale(.4)}12%{opacity:1}55%{opacity:.85}100%{opacity:0;transform:translate(var(--smp-p-x,0),var(--smp-p-y,0)) scale(.15)}}',
      '@media (prefers-reduced-motion: reduce){.smp-slider-fill,.smp-slider-thumb{transition:none}.smp-slider-fill::after{animation:none;opacity:0}.smp-slider-max .smp-slider-fill{animation:none}.smp-slider-max .smp-slider-thumb::before{animation:none}.smp-particle{display:none}.smp-spinner{animation:none}}',
    ].join('\n')

    /** Settings-page styles: host tokens only, plus a static preview surface. */
    const SETTINGS_CSS = [
      '.smp-set{display:flex;flex-direction:column;gap:12px;padding:8px 4px 24px;max-width:640px;color:var(--dsw-alias-label-primary,#1f2320);font-size:13px;line-height:20px}',
      '.smp-set-title{margin:0;font-size:16px;line-height:24px;font-weight:600}',
      '.smp-set-hint{margin:0;color:var(--dsw-alias-label-secondary,#6b7280);font-size:12px;line-height:18px}',
      '.smp-set-mode{display:flex;align-items:center;gap:12px;flex-wrap:wrap}',
      '.smp-set-label{min-width:72px;color:var(--dsw-alias-label-secondary,#6b7280);font-size:12px}',
      '.smp-set-seg{display:inline-flex;gap:2px;padding:2px;border-radius:8px;background:var(--dsw-alias-bg-layer-2,#f1f2f4)}',
      '.smp-set-seg-button{padding:4px 12px;border:0;border-radius:6px;background:transparent;color:inherit;font:inherit;font-size:12px;cursor:pointer}',
      '.smp-set-seg-button[aria-pressed="true"]{background:var(--dsw-alias-bg-overlay,#fff);box-shadow:0 1px 2px rgba(0,0,0,.12)}',
      '.smp-set-field{display:flex;align-items:center;gap:12px;flex-wrap:wrap}',
      '.smp-set-input{flex:1 1 280px;min-width:0;padding:6px 8px;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.16));border-radius:6px;background:var(--dsw-alias-bg-base,transparent);color:inherit;font:inherit;font-size:12px}',
      '.smp-set-color{display:inline-flex;align-items:center;gap:8px}',
      '.smp-set-swatch{width:32px;height:24px;padding:0;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.16));border-radius:6px;background:transparent;cursor:pointer}',
      '.smp-set-value{color:var(--dsw-alias-label-secondary,#6b7280);font-size:12px}',
      '.smp-set-clear{width:20px;height:20px;border:0;border-radius:50%;background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));color:inherit;cursor:pointer;line-height:1;font-size:12px}',
      '.smp-set-preview-wrap{display:flex;flex-direction:column;gap:8px}',
      '.smp-set-preview{display:flex;flex-direction:column;gap:12px;padding:12px;border:1px dashed var(--dsw-alias-border-l2,rgba(0,0,0,.16));border-radius:12px;background:var(--dsw-alias-bg-base,transparent)}',
      '.smp-set-preview-trigger{display:flex;justify-content:center}',
      '.smp-popup.smp-set-preview-surface{position:static;width:min(100%,360px);max-height:none;margin:0 auto}',
      '.smp-set-preview-row{width:100%;text-align:start}',
      '.smp-set-actions{display:flex;gap:8px}',
      '.smp-set-action{padding:6px 12px;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.16));border-radius:8px;background:transparent;color:inherit;font:inherit;font-size:12px;cursor:pointer}',
      '.smp-set-action:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}',
    ].join('\n')

    /**
     * Mount the seat and its dictionaries. The shared directory service is a
     * client service of the shipped model-selection package, so the seat only
     * registers once `modelDirectories` exists; otherwise the shipped picker
     * stays in place.
     * @param ctx - restricted client plugin context.
     */
    function apply(ctx) {
      const locale = ctx.get('locale')
      const t = locale && typeof locale.bind === 'function' ? locale.bind(NS) : makeTranslate(undefined)
      if (locale && typeof locale.register === 'function') {
        ctx.effect(() => locale.register(NS, { en, zh }), 'slothy-model-picker: dictionaries')
      }

      // Appearance page: independent of the model service, so it still opens when
      // the seat itself cannot register.
      const pluginSlots = ctx.get('slots')
      if (pluginSlots && typeof pluginSlots.inject === 'function') {
        ctx.effect(() => pluginSlots.inject('settings.section', () => pluginSlots.register({
          name: 'settings.section',
          id: 'slothy-picker',
          order: 35,
          label: () => t('settings.nav'),
          inject: () => ({ t }),
        }, AppearanceSettings)), 'slothy-model-picker: appearance settings')
      }

      const mount = (scope) => {
        const slots = scope.get('slots')
        const models = scope.get('modelDirectories')
        if (!slots || typeof slots.inject !== 'function' || !models || typeof models.directoryFor !== 'function') {
          console.warn('[slothy-model-picker] model selection service unavailable; keeping the shipped model control')
          return
        }
        return slots.inject('conversation.input.model', () => {
          let record = null
          const register = () => {
            const priority = currentSeatPriority()
            if (record !== null) {
              if (record.priority === priority) return
              record.dispose()
              record = null
            }
            record = {
              priority,
              dispose: slots.register({
                name: 'conversation.input.model',
                priority,
                locale: NS,
                inject: (sessionId) => {
                  try {
                    const directory = models.directoryFor(sessionId)
                    return {
                      available: true,
                      directory: directory.store,
                      load: () => {
                        try {
                          const opening = directory.load()
                          if (opening && typeof opening.catch === 'function') opening.catch(() => {})
                        } catch (error) {
                          // The directory publishes its own load failure on the store.
                        }
                      },
                      select: (selection) => directory.select(selection),
                    }
                  } catch (error) {
                    return { available: false }
                  }
                },
              }, ModelPickerSeat),
            }
          }
          register()
          const unsubscribe = subscribeAppearance(() => {
            if (record === null) return
            if (record.priority !== currentSeatPriority()) register()
          })
          return () => {
            unsubscribe()
            if (record !== null) {
              record.dispose()
              record = null
            }
          }
        })
      }

      if (typeof ctx.inject === 'function') {
        ctx.effect(() => ctx.inject(['modelDirectories'], mount), 'slothy-model-picker: composer model seat')
      } else {
        ctx.effect(() => mount(ctx), 'slothy-model-picker: composer model seat')
      }
    }

    return { inject: ['slots', 'locale'], apply }
  },
})
