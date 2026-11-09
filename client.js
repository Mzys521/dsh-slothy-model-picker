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
      const rootRef = useRef(null)
      const triggerRef = useRef(null)
      const popupRef = useRef(null)

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
      const modelLabel = currentChoice
        ? currentChoice.model.name
        : (groups.length === 0 && (state.status === 'loading' || state.status === 'idle') ? tr('trigger.loading') : tr('trigger.fallback'))
      const ariaLabel = triggerEffort === undefined
        ? tr('trigger.aria', { model: modelLabel })
        : tr('trigger.ariaEffort', { model: modelLabel, effort: triggerEffort })
      const pending = state.pending || null
      const disabled = busy || pending !== null

      const place = useCallback(() => {
        const trigger = triggerRef.current
        if (!trigger) return
        const rect = trigger.getBoundingClientRect()
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight
        const width = Math.max(220, Math.min(300, viewportWidth - 24))
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
        if (!target || !level) return
        const selection = { provider: target.group.id, model: target.model.id }
        if (level.id !== undefined) selection.reasoningEffort = level.id
        void selectWith(selection)
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

      /** Commit the drag/keys' final position so a fast drag sends one selection, not one per step. */
      const commitDrag = () => {
        const index = dragRef.current
        dragRef.current = null
        setDragIndex(null)
        if (index === null || index === activeIndex) return
        const level = levels[index]
        if (level) chooseEffort(level)
      }

      const slider = levels.length > 0
        ? h('div', {
          className: 'smp-slider' + (levels.length > 1 && shownIndex === levels.length - 1 ? ' smp-slider-max' : ''),
          style: { '--smp-level': levelPosition },
        },
        h('span', { className: 'smp-slider-visual', 'aria-hidden': true },
          h('span', { className: 'smp-slider-fill' }),
          h('span', { className: 'smp-slider-marks' }, levels.map((level) => h('span', { key: level.id }))),
          h('span', { className: 'smp-slider-thumb' })),
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
          onInput: (event) => {
            const next = Number(event.currentTarget.value)
            dragRef.current = next
            setDragIndex(next)
          },
          onPointerUp: commitDrag,
          onKeyUp: commitDrag,
          onBlur: commitDrag,
        }))
        : h('div', { className: 'smp-status' }, tr('empty.efforts'))

      const effortPane = effortChoice === null
        ? h('div', { className: 'smp-status' }, tr('empty.models'))
        : h(Fragment, null,
          h('div', { className: 'smp-effort-header' },
            h('button', { type: 'button', className: 'smp-effort-model', onClick: () => setPane('models'), title: tr('menu.model') },
              h('strong', null, effortName),
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
          width: (position ? position.width : 280) + 'px',
          maxHeight: (position ? position.maxHeight : 360) + 'px',
        }
        : { position: 'absolute', right: 0, bottom: 'calc(100% + 12px)', width: 'min(300px, 84vw)', maxHeight: 'min(440px, 58dvh)' }

      const popup = open
        ? h('div', {
          ref: popupRef,
          className: 'smp-popup',
          role: 'group',
          'aria-label': tr('menu.label'),
          'aria-busy': disabled,
          style: popupStyle,
        }, popupBody)
        : null

      const popupNode = popup === null ? null : (createPortal ? createPortal(popup, document.body) : popup)

      return h('div', { ref: rootRef, className: 'smp-root', onKeyDown: (event) => { if (event.key === 'Escape' && open) { event.stopPropagation() } } },
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
        triggerEffort !== undefined ? h('span', { className: 'smp-trigger-effort' }, triggerEffort) : null,
        disabled ? h('span', { className: 'smp-spinner' }) : h(ChevronDown)),
        popupNode)
    }

    /** Styles use host theme aliases; brand color only marks the current effort. */
    const PICKER_CSS = [
      '.smp-root{position:relative;display:inline-flex;align-items:center;min-width:0;font:inherit}',
      '.smp-trigger{display:flex;align-items:center;gap:4px;height:28px;max-width:min(280px,34cqw);padding:0 6px 0 8px;border:0;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-secondary,#6b7280);font:inherit;font-size:13px;line-height:20px;cursor:pointer;outline:none;min-width:0}',
      '.smp-trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));color:var(--dsw-alias-label-primary,#1f2320)}',
      '.smp-trigger:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-brand-primary,#4d6bfe)}',
      '.smp-trigger:disabled{color:var(--dsw-alias-label-dimmed,#9aa0a6);cursor:default}',
      '.smp-trigger-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:var(--dsh-composer-model-text-display,block)}',
      '.smp-trigger-effort{flex:none;max-width:7em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-caption,#8a8f88);display:var(--dsh-composer-model-text-display,block)}',
      '.smp-trigger-icon{display:var(--dsh-composer-model-icon-display,none);flex:none;width:16px;height:16px}',
      '.smp-chevron{flex:none;width:15px;height:15px;color:var(--dsw-alias-label-caption,#8a8f88)}',
      '.smp-chevron-inline{display:inline;width:12px;height:12px;vertical-align:middle;margin-inline-start:2px}',
      '.smp-icon{width:15px;height:15px;flex:none}',
      '.smp-check{flex:none;width:15px;height:15px;color:var(--dsw-alias-brand-primary,#4d6bfe)}',
      '.smp-popup{position:fixed;z-index:1100;box-sizing:border-box;display:flex;flex-direction:column;overflow:auto;padding:6px;border:1px solid var(--dsw-alias-border-l1,rgba(0,0,0,.08));border-radius:var(--dsw-radius-md,12px);background:var(--dsw-alias-bg-overlay,#fff);color:var(--dsw-alias-label-primary,#1f2320);box-shadow:var(--dsw-elevation-prominent,0 12px 32px rgba(0,0,0,.18));font-size:13px;line-height:20px}',
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
      '.smp-spinner{flex:none;width:12px;height:12px;border-radius:50%;border:2px solid var(--dsw-alias-border-l2,rgba(0,0,0,.2));border-top-color:var(--dsw-alias-brand-primary,#4d6bfe);animation:smp-spin .8s linear infinite}',
      '@keyframes smp-spin{to{transform:rotate(360deg)}}',
      '.smp-effort-header{display:grid;grid-template-columns:26px minmax(0,1fr) 26px;align-items:start;gap:6px;color:var(--dsw-alias-label-secondary,#6b7280)}',
      '.smp-effort-model{grid-column:2;display:grid;justify-items:center;gap:2px;padding:6px 4px;border:0;border-radius:var(--dsw-radius-sm,8px);background:var(--dsw-alias-bg-layer-2,#f1f2f4);color:inherit;font:inherit;text-align:center;overflow-wrap:anywhere;cursor:pointer}',
      '.smp-effort-model strong{color:var(--dsw-alias-brand-primary,#4d6bfe);font-weight:600}',
      '.smp-effort-model span{font-size:12px;display:inline-flex;align-items:center;gap:2px;min-width:0}',
      '.smp-effort-reset{grid-column:3;display:grid;place-items:center;height:28px;border:0;border-radius:var(--dsw-radius-sm,8px);background:transparent;color:inherit;cursor:pointer}',
      '.smp-effort-reset:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}',
      '.smp-effort-reset:disabled{opacity:.45;cursor:default}',
      '.smp-slider{position:relative;height:20px;margin:14px 8px 6px;border-radius:999px;background:var(--dsw-alias-bg-layer-2,#e8eaec);box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l1,rgba(0,0,0,.08))}',
      '.smp-slider-visual{position:absolute;inset:0 11px;pointer-events:none}',
      '.smp-slider-fill{position:absolute;inset:0 auto 0 -11px;width:calc(11px + var(--smp-level));border-radius:999px;background:var(--dsw-alias-brand-primary,#4d6bfe);transition:width .18s ease-out}',
      '.smp-slider-max .smp-slider-fill{width:calc(22px + var(--smp-level))}',
      '.smp-slider-marks{position:absolute;inset:0 -2px;display:flex;align-items:center;justify-content:space-between}',
      '.smp-slider-marks>span{width:4px;height:4px;border-radius:50%;background:var(--dsw-alias-bg-overlay,#fff);opacity:.8}',
      '.smp-slider-thumb{position:absolute;top:50%;left:var(--smp-level);box-sizing:border-box;width:20px;height:20px;transform:translate(-50%,-50%);border-radius:50%;border:2px solid var(--dsw-alias-brand-primary,#4d6bfe);background:var(--dsw-alias-bg-overlay,#fff);transition:left .18s ease-out}',
      '.smp-slider-range{position:absolute;inset:0;width:100%;height:100%;margin:0;appearance:none;opacity:0;cursor:pointer}',
      '.smp-slider-range::-webkit-slider-thumb{appearance:none;width:22px;height:22px}',
      '.smp-slider-range::-moz-range-thumb{width:22px;height:22px}',
      '.smp-slider:has(.smp-slider-range:focus-visible){outline:2px solid var(--dsw-alias-brand-primary,#4d6bfe);outline-offset:4px}',
      '@media (prefers-reduced-motion: reduce){.smp-slider-fill,.smp-slider-thumb{transition:none}.smp-spinner{animation:none}}',
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
      if (locale && typeof locale.register === 'function') {
        ctx.effect(() => locale.register(NS, { en, zh }), 'slothy-model-picker: dictionaries')
      }

      const mount = (scope) => {
        const slots = scope.get('slots')
        const models = scope.get('modelDirectories')
        if (!slots || typeof slots.inject !== 'function' || !models || typeof models.directoryFor !== 'function') {
          console.warn('[slothy-model-picker] model selection service unavailable; keeping the shipped model control')
          return
        }
        return slots.inject('conversation.input.model', () => slots.register({
          name: 'conversation.input.model',
          priority: SEAT_PRIORITY,
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
        }, ModelPickerSeat))
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
