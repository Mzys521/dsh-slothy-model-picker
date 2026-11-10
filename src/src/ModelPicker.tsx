/**
 * Slothy-style model picker for React 18 (DeepSeek Harness Web GUI plugins).
 *
 * Visual/behavioral port of Slothy's `web/src/ModelPicker.vue`: provider-grouped
 * model list plus a reasoning-effort slider. Dependency-free apart from React.
 *
 * Slothy 模型选择器的 React 18 版本（用于 DeepSeek Harness Web GUI 插件）：
 * 按 provider 分组的模型列表 + 推理强度滑轨；除 React 外无依赖。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import type { ModelItem, ModelPickerLabels } from './types'

export interface ModelPickerProps {
  items: ModelItem[]
  value: string
  selected?: ModelItem
  effort?: string
  locale?: string
  labels?: Partial<ModelPickerLabels>
  onChange: (id: string) => void
  onEffort: (level: string) => void
  /** Optional class for the trigger; the popup inherits the component theme vars. / 可选触发器类名。 */
  className?: string
}

const PROVIDER_NAMES: Record<string, string> = {
  deepseek: 'DeepSeek',
  mimo: 'MiMo',
  openai_compatible: 'OpenAI-compatible',
}

/** Inline SVGs keep the component free of icon packages. / 内联 SVG，避免图标依赖。 */
const ChevronDown = () => (
  <svg className="slothy-mp-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.6" />
  </svg>
)
const ChevronRight = () => (
  <svg className="slothy-mp-icon slothy-mp-chevron" viewBox="0 0 24 24" aria-hidden="true">
    <path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" />
  </svg>
)
const Check = () => (
  <svg className="slothy-mp-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="m5 12 5 5L20 6" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
)
const Reset = () => (
  <svg className="slothy-mp-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 4v6h6M20 20v-6h-6" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M5 10a8 8 0 0 1 14-4M19 14a8 8 0 0 1-14 4" fill="none" stroke="currentColor" strokeWidth="1.6" />
  </svg>
)

/**
 * Resolves bilingual labels with host overrides.
 *
 * 解析双语文案，宿主可覆盖。
 *
 * @param locale - Host locale string such as zh-CN or en. / 宿主语言标识。
 * @param overrides - Optional label overrides. / 可选的文案覆盖。
 * @returns Complete label set. / 完整文案集合。
 */
function resolveLabels(locale: string, overrides?: Partial<ModelPickerLabels>): ModelPickerLabels {
  const zh = locale.toLowerCase().startsWith('zh')
  const defaults: ModelPickerLabels = {
    trigger: zh ? 'LLM 模型' : 'LLM model',
    selectModel: zh ? '选择模型' : 'Select a model',
    defaultModel: zh ? '默认' : 'Default',
    modelSettings: zh ? '模型设置' : 'Model settings',
    thinkingEffort: zh ? '思考强度' : 'Thinking effort',
    restoreDefault: zh ? '恢复默认档位' : 'Restore default',
    auto: zh ? '自动' : 'Auto',
    off: zh ? '关闭' : 'Off',
    thinking: zh ? '思考' : 'Thinking',
    low: zh ? '低' : 'Low',
    high: zh ? '高' : 'High',
    max: zh ? '最高' : 'Max',
  }
  return { ...defaults, ...overrides }
}

export function ModelPicker(props: ModelPickerProps): ReactElement {
  const { items, value, selected, effort, locale = 'en', labels, onChange, onEffort, className } = props
  const [open, setOpen] = useState(false)
  const [showModels, setShowModels] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const text = useMemo(() => resolveLabels(locale, labels), [locale, labels])
  const levels = selected?.reasoning_levels ?? []
  const levelIndex = Math.max(0, levels.indexOf(effort ?? ''))
  const levelPosition = `${(100 * levelIndex) / Math.max(1, levels.length - 1)}%`

  const groups = useMemo(() => {
    const map = new Map<string, ModelItem[]>()
    for (const item of items) {
      const group = map.get(item.provider) ?? []
      group.push(item)
      map.set(item.provider, group)
    }
    return map
  }, [items])

  const effortLabel = (level: string | undefined): string => {
    if (!level) return ''
    if (level === 'none') return text.off
    if (selected?.provider === 'mimo') return text.thinking
    if (level === 'low') return text.low
    if (level === 'max') return text.max
    return text.high
  }
  const currentEffort = effortLabel(levels[levelIndex])
  const modelLabel = value === 'auto' ? text.auto : selected?.display_name || value

  const show = useCallback((list: boolean) => {
    setShowModels(list)
    requestAnimationFrame(() => popup.current?.querySelector<HTMLElement>('input, button')?.focus())
  }, [])

  const close = useCallback((restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) trigger.current?.focus()
  }, [])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) show(levels.length === 0)
  }

  const choose = (id: string) => {
    onChange(id)
    requestAnimationFrame(() => (levels.length ? show(false) : close(true)))
  }

  useEffect(() => {
    const onOutside = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && !root.current?.contains(target)) close()
    }
    document.addEventListener('pointerdown', onOutside)
    return () => document.removeEventListener('pointerdown', onOutside)
  }, [close])

  return (
    <div ref={root} className={`slothy-mp ${className ?? ''}`.trim()} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(true) } }}>
      <style>{PICKER_CSS}</style>
      <button
        ref={trigger}
        className="slothy-mp-trigger"
        type="button"
        aria-expanded={open}
        aria-label={[text.trigger, modelLabel, currentEffort].filter(Boolean).join(' · ')}
        title={[selected?.id, currentEffort].filter(Boolean).join(' ')}
        onClick={toggle}
      >
        <span className="slothy-mp-trigger-name">{modelLabel}</span>
        {currentEffort ? <span className="slothy-mp-trigger-effort" lang="en">{currentEffort}</span> : null}
        <ChevronDown />
      </button>

      {open ? (
        <div ref={popup} className="slothy-mp-popup" role="group" aria-label={text.modelSettings}>
          {showModels ? (
            <>
              <p>{text.selectModel}</p>
              <button type="button" className="slothy-mp-row" aria-pressed={value === 'auto'} onClick={() => choose('auto')}>
                <span>{text.defaultModel}</span>
                {value === 'auto' ? <Check /> : null}
              </button>
              {Array.from(groups, ([provider, models]) => (
                <div key={provider}>
                  <p className="slothy-mp-provider">{PROVIDER_NAMES[provider] ?? provider}</p>
                  {models.map(item => (
                    <button key={item.id} type="button" className="slothy-mp-row" aria-pressed={value === item.id} onClick={() => choose(item.id)}>
                      <span>{item.display_name || item.id}</span>
                      {value === item.id ? <Check /> : null}
                    </button>
                  ))}
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="slothy-mp-effort-header">
                <button type="button" className="slothy-mp-effort-model" onClick={() => show(true)}>
                  <strong lang="en">{currentEffort}</strong>
                  <span>{selected?.display_name || selected?.id}{ChevronRight()}</span>
                </button>
                <button
                  type="button"
                  className="slothy-mp-effort-reset"
                  title={text.restoreDefault}
                  aria-label={text.restoreDefault}
                  onClick={() => { if (selected?.default_effort) onEffort(selected.default_effort) }}
                >
                  <Reset />
                </button>
              </div>
              <div
                className={`slothy-mp-effort-slider${levels.length > 1 && levelIndex === levels.length - 1 ? ' slothy-mp-effort-max' : ''}`}
                style={{ '--level': levelPosition } as CSSProperties}
              >
                <span className="slothy-mp-effort-visual" aria-hidden="true">
                  <span className="slothy-mp-effort-fill" />
                  <span className="slothy-mp-effort-marks">{levels.map(level => <span key={level} />)}</span>
                  <span className="slothy-mp-effort-thumb" />
                </span>
                <input
                  className="slothy-mp-effort-range"
                  type="range"
                  min={0}
                  max={levels.length - 1}
                  step={1}
                  value={levelIndex}
                  aria-label={text.thinkingEffort}
                  aria-valuetext={currentEffort}
                  onChange={event => {
                    const level = levels[Number(event.currentTarget.value)]
                    if (level) onEffort(level)
                  }}
                />
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

/** Scoped styles; hosts may instead import this CSS into their own stylesheet. / 组件样式。 */
const PICKER_CSS = `
.slothy-mp{position:relative;display:inline-flex;font:inherit}
.slothy-mp-trigger{display:flex;align-items:center;gap:5px;max-width:min(31cqw,240px);padding:5px 8px;border:0;border-radius:999px;background:transparent;color:var(--slothy-muted,#6b7280);font:inherit;font-size:var(--type-body,13px);cursor:pointer}
.slothy-mp-trigger:is(:hover,[aria-expanded="true"]){color:var(--slothy-ink,#1f2320);background:var(--slothy-canvas,#f6f6f4)}
.slothy-mp-trigger:focus-visible{outline:none;text-decoration:underline;text-underline-offset:3px}
.slothy-mp-trigger-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.slothy-mp-trigger-effort{flex:none;color:var(--slothy-soft-ink,#8a8f88)}
.slothy-mp-icon{width:15px;height:15px;flex:none}
.slothy-mp-popup{position:absolute;inset-inline-end:0;bottom:calc(100% + 12px);z-index:20;width:min(282px,77cqw);max-height:min(440px,58dvh);overflow:auto;padding:12px;border-radius:var(--radius-surface,16px);background:var(--slothy-surface,#fff);box-shadow:0 12px 32px rgb(0 0 0/12%)}
.slothy-mp-popup p{margin:0;padding:4px 8px;color:var(--slothy-muted,#6b7280);font-size:var(--type-sm,12px)}
.slothy-mp-popup .slothy-mp-provider{margin-top:5px}
.slothy-mp-row{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;padding:6px 8px;border:0;border-radius:var(--radius,8px);background:transparent;color:inherit;font:inherit;font-size:var(--type-body,13px);text-align:start;overflow-wrap:anywhere;cursor:pointer}
.slothy-mp-row:is(:hover,:focus-visible,[aria-pressed="true"]){background:var(--slothy-neutral,#ececea)}
.slothy-mp-row .slothy-mp-icon,.slothy-mp-effort-model strong{color:var(--slothy-accent-ink,#3f7d00)}
.slothy-mp-effort-header{display:grid;grid-template-columns:26px minmax(0,1fr) 26px;align-items:start;gap:6px;color:var(--slothy-muted,#6b7280)}
.slothy-mp-effort-model{grid-column:2;display:grid;justify-items:center;gap:2px;padding:4px;border:0;border-radius:var(--radius,8px);background:var(--slothy-neutral,#ececea);color:inherit;font:inherit;text-align:center;overflow-wrap:anywhere;cursor:pointer}
.slothy-mp-effort-model span{font-size:var(--type-sm,12px)}
.slothy-mp-chevron{display:inline;width:12px;height:12px;vertical-align:middle}
.slothy-mp-effort-reset{grid-column:3;display:grid;place-items:center;height:28px;border:0;border-radius:var(--radius,8px);background:transparent;color:inherit;cursor:pointer}
.slothy-mp-effort-reset:hover{background:var(--slothy-neutral,#ececea)}
.slothy-mp-effort-slider{position:relative;height:20px;margin:14px 0 4px;border-radius:999px;background:var(--slothy-neutral,#ececea)}
.slothy-mp-effort-visual{position:absolute;inset:0 11px;pointer-events:none}
.slothy-mp-effort-fill{position:absolute;inset:0 auto 0 -11px;width:calc(11px + var(--level));border-radius:999px;background:var(--slothy-accent,#60dd06);transition:width 180ms ease-out}
.slothy-mp-effort-max .slothy-mp-effort-fill{width:calc(22px + var(--level));background:var(--slothy-accent-ink,#3f7d00)}
.slothy-mp-effort-marks{position:absolute;inset:0 -2px;display:flex;align-items:center;justify-content:space-between}
.slothy-mp-effort-marks > span{width:4px;height:4px;border-radius:50%;background:rgb(255 255 255/70%)}
.slothy-mp-effort-thumb{position:absolute;top:50%;left:var(--level);width:22px;height:22px;transform:translate(-50%,-50%);border-radius:50%;background:var(--slothy-ink,#1f2320);transition:left 180ms ease-out}
.slothy-mp-effort-range{position:absolute;inset:0;width:100%;height:100%;margin:0;appearance:none;opacity:0;cursor:pointer}
.slothy-mp-effort-range::-webkit-slider-thumb{appearance:none;width:22px;height:22px}
.slothy-mp-effort-range::-moz-range-thumb{width:22px;height:22px}
.slothy-mp-effort-slider:has(.slothy-mp-effort-range:focus-visible){outline:2px solid var(--slothy-accent,#60dd06);outline-offset:4px}
@media (prefers-reduced-motion: reduce){.slothy-mp-effort-fill,.slothy-mp-effort-thumb{transition:none}}
`
