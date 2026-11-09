<script setup lang="ts">
/**
 * Standalone Slothy-style model picker: trigger, provider-grouped model list and
 * reasoning-effort slider. No project imports; style variables fall back to a
 * neutral theme so the component can be embedded anywhere.
 *
 * 独立版 Slothy 模型选择器：触发按钮、按 provider 分组的模型列表与推理强度滑轨。
 * 不依赖原项目；样式变量带中性回退，可嵌入任意宿主。
 */
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import type { ModelItem, ModelPickerLabels } from './types'

const props = withDefaults(
  defineProps<{
    items: ModelItem[]
    modelValue: string
    selected?: ModelItem
    effort?: string
    locale?: string
    labels?: Partial<ModelPickerLabels>
  }>(),
  { locale: 'en' },
)
const emit = defineEmits<{
  'update:modelValue': [id: string]
  effort: [level: string]
}>()

const root = ref<HTMLElement>()
const trigger = ref<HTMLButtonElement>()
const popup = ref<HTMLElement>()
const open = ref(false)
const showModels = ref(false)

const zh = computed(() => props.locale.toLowerCase().startsWith('zh'))
const defaultLabels: ModelPickerLabels = {
  trigger: zh.value ? 'LLM 模型' : 'LLM model',
  selectModel: zh.value ? '选择模型' : 'Select a model',
  defaultModel: zh.value ? '默认' : 'Default',
  modelSettings: zh.value ? '模型设置' : 'Model settings',
  thinkingEffort: zh.value ? '思考强度' : 'Thinking effort',
  restoreDefault: zh.value ? '恢复默认档位' : 'Restore default',
  auto: zh.value ? '自动' : 'Auto',
  off: zh.value ? '关闭' : 'Off',
  thinking: zh.value ? '思考' : 'Thinking',
  low: zh.value ? '低' : 'Low',
  high: zh.value ? '高' : 'High',
  max: zh.value ? '最高' : 'Max',
}
const label = (key: keyof ModelPickerLabels) => props.labels?.[key] ?? defaultLabels[key]

const levels = computed(() => props.selected?.reasoning_levels ?? [])
/** Index of the active effort level, clamped to a valid position. / 当前推理强度档位索引，保证落在有效范围。 */
const levelIndex = computed(() => Math.max(0, levels.value.indexOf(props.effort ?? '')))
/** Slider position as a percentage of the available effort range. / 以可用强度区间百分比表示的滑块位置。 */
const levelPosition = computed(
  () => `${(100 * levelIndex.value) / Math.max(1, levels.value.length - 1)}%`,
)
const modelLabel = computed(() =>
  props.modelValue === 'auto' ? label('auto') : props.selected?.display_name || props.modelValue,
)
const currentEffort = computed(() => effortLabel(levels.value[levelIndex.value]))
/** Models grouped by provider, preserving catalog order. / 按 provider 分组后的模型，保持目录顺序。 */
const groups = computed(() => {
  const providers = new Map<string, ModelItem[]>()
  for (const item of props.items) {
    const group = providers.get(item.provider) ?? []
    group.push(item)
    providers.set(item.provider, group)
  }
  return providers
})
const providerNames: Record<string, string> = {
  deepseek: 'DeepSeek',
  mimo: 'MiMo',
  openai_compatible: 'OpenAI-compatible',
}

/**
 * Maps a raw reasoning level to its display label.
 *
 * 将原始推理强度档位映射为显示名称。
 *
 * @param value - Raw effort level such as none, low, high or max. / 原始强度档位。
 * @returns Short human-readable effort label, or an empty string. / 简短强度名称或空字符串。
 */
function effortLabel(value: string | undefined) {
  if (!value) return ''
  if (value === 'none') return label('off')
  if (props.selected?.provider === 'mimo') return label('thinking')
  if (value === 'low') return label('low')
  if (value === 'max') return label('max')
  return label('high')
}

/**
 * Switches panes and moves focus into the popup.
 *
 * 切换面板并将焦点移入弹层。
 *
 * @param list - True to show the model list, false to show the effort slider. / true 显示模型列表。
 */
function show(list: boolean) {
  showModels.value = list
  void nextTick(() => popup.value?.querySelector<HTMLElement>('input, button')?.focus())
}

/** Opens or closes the popup, choosing the pane for the current state. / 打开或关闭弹层并选择面板。 */
function toggle() {
  open.value = !open.value
  if (open.value) show(!levels.value.length)
}

/**
 * Closes the popup, optionally returning focus to the trigger.
 *
 * 关闭弹层，可选择把焦点还给触发按钮。
 *
 * @param restoreFocus - True to focus the trigger after closing. / 关闭后聚焦触发按钮。
 */
function close(restoreFocus = false) {
  open.value = false
  if (restoreFocus) trigger.value?.focus()
}

/**
 * Selects a model id and moves to the effort pane or closes.
 *
 * 选择模型 ID，并进入强度面板或关闭弹层。
 *
 * @param id - Model id or auto. / 模型 ID 或 auto。
 */
function choose(id: string) {
  emit('update:modelValue', id)
  void nextTick(() => (levels.value.length ? show(false) : close(true)))
}

/**
 * Emits the effort level picked on the range input.
 *
 * 触发滑轨所选的推理强度档位。
 *
 * @param event - Input event from the native range control. / 原生 range 的输入事件。
 */
function setLevel(event: Event) {
  const level = levels.value[Number((event.target as HTMLInputElement).value)]
  if (level) emit('effort', level)
}

/**
 * Closes the popup when a pointer press happens outside the picker.
 *
 * 指针在选择器外部按下时关闭弹层。
 *
 * @param event - Pointer-down event from the document. / 文档指针按下事件。
 */
function onOutside(event: PointerEvent) {
  if (event.target instanceof Node && !root.value?.contains(event.target)) close()
}

onMounted(() => document.addEventListener('pointerdown', onOutside))
onUnmounted(() => document.removeEventListener('pointerdown', onOutside))
</script>

<template>
  <div ref="root" class="slothy-mp" @keydown.esc.stop="close(true)">
    <button
      ref="trigger"
      class="slothy-mp-trigger"
      type="button"
      :aria-expanded="open"
      :aria-label="[label('trigger'), modelLabel, currentEffort].filter(Boolean).join(' · ')"
      :title="[selected?.id, currentEffort].filter(Boolean).join(' ')"
      @click="toggle"
    >
      <span class="slothy-mp-trigger-name">{{ modelLabel }}</span>
      <span v-if="currentEffort" class="slothy-mp-trigger-effort" lang="en">{{ currentEffort }}</span>
      <svg class="slothy-mp-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.6" />
      </svg>
    </button>

    <div v-if="open" ref="popup" class="slothy-mp-popup" role="group" :aria-label="label('modelSettings')">
      <template v-if="showModels">
        <p>{{ label('selectModel') }}</p>
        <button
          type="button"
          class="slothy-mp-row"
          :aria-pressed="modelValue === 'auto'"
          @click="choose('auto')"
        >
          <span>{{ label('defaultModel') }}</span>
          <svg v-if="modelValue === 'auto'" class="slothy-mp-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m5 12 5 5L20 6" fill="none" stroke="currentColor" stroke-width="2" />
          </svg>
        </button>
        <template v-for="[provider, models] in groups" :key="provider">
          <p class="slothy-mp-provider">{{ providerNames[provider] ?? provider }}</p>
          <button
            v-for="item in models"
            :key="item.id"
            type="button"
            class="slothy-mp-row"
            :aria-pressed="modelValue === item.id"
            @click="choose(item.id)"
          >
            <span>{{ item.display_name || item.id }}</span>
            <svg v-if="modelValue === item.id" class="slothy-mp-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m5 12 5 5L20 6" fill="none" stroke="currentColor" stroke-width="2" />
            </svg>
          </button>
        </template>
      </template>

      <template v-else>
        <div class="slothy-mp-effort-header">
          <button type="button" class="slothy-mp-effort-model" @click="show(true)">
            <strong lang="en">{{ currentEffort }}</strong>
            <span>
              {{ selected?.display_name || selected?.id }}
              <svg class="slothy-mp-icon slothy-mp-chevron" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.6" />
              </svg>
            </span>
          </button>
          <button
            type="button"
            class="slothy-mp-effort-reset"
            :title="label('restoreDefault')"
            :aria-label="label('restoreDefault')"
            @click="selected?.default_effort && emit('effort', selected.default_effort)"
          >
            <svg class="slothy-mp-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 4v6h6M20 20v-6h-6" fill="none" stroke="currentColor" stroke-width="1.6" />
              <path d="M5 10a8 8 0 0 1 14-4M19 14a8 8 0 0 1-14 4" fill="none" stroke="currentColor" stroke-width="1.6" />
            </svg>
          </button>
        </div>

        <div
          class="slothy-mp-effort-slider"
          :class="{ 'slothy-mp-effort-max': levels.length > 1 && levelIndex === levels.length - 1 }"
          :style="{ '--level': levelPosition }"
        >
          <span class="slothy-mp-effort-visual" aria-hidden="true">
            <span class="slothy-mp-effort-fill"></span>
            <span class="slothy-mp-effort-marks">
              <span v-for="level in levels" :key="level"></span>
            </span>
            <span class="slothy-mp-effort-thumb"></span>
          </span>
          <input
            class="slothy-mp-effort-range"
            type="range"
            min="0"
            :max="levels.length - 1"
            step="1"
            :value="levelIndex"
            :aria-label="label('thinkingEffort')"
            :aria-valuetext="currentEffort"
            @input="setLevel"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.slothy-mp {
  position: relative;
  display: inline-flex;
  color: var(--slothy-ink, #1f2320);
  font: inherit;
}
.slothy-mp-trigger {
  display: flex;
  align-items: center;
  gap: 5px;
  max-width: min(31cqw, 240px);
  padding: 5px 8px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--slothy-muted, #6b7280);
  font: inherit;
  font-size: var(--type-body, 13px);
  cursor: pointer;
}
.slothy-mp-trigger:is(:hover, [aria-expanded='true']) {
  color: var(--slothy-ink, #1f2320);
  background: var(--slothy-canvas, #f6f6f4);
}
.slothy-mp-trigger:focus-visible {
  outline: none;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.slothy-mp-trigger-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.slothy-mp-trigger-effort {
  flex: none;
  color: var(--slothy-soft-ink, #8a8f88);
}
.slothy-mp-icon {
  width: 15px;
  height: 15px;
  flex: none;
}
.slothy-mp-popup {
  position: absolute;
  inset-inline-end: 0;
  bottom: calc(100% + 12px);
  z-index: 20;
  width: min(282px, 77cqw);
  max-height: min(440px, 58dvh);
  overflow: auto;
  padding: 12px;
  border-radius: var(--radius-surface, 16px);
  background: var(--slothy-surface, #fff);
  box-shadow: 0 12px 32px rgb(0 0 0 / 12%);
}
.slothy-mp-popup p {
  margin: 0;
  padding: 4px 8px;
  color: var(--slothy-muted, #6b7280);
  font-size: var(--type-sm, 12px);
}
.slothy-mp-popup .slothy-mp-provider {
  margin-top: 5px;
}
.slothy-mp-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: var(--radius, 8px);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: var(--type-body, 13px);
  text-align: start;
  overflow-wrap: anywhere;
  cursor: pointer;
}
.slothy-mp-row:is(:hover, :focus-visible, [aria-pressed='true']) {
  background: var(--slothy-neutral, #ececea);
}
.slothy-mp-row .slothy-mp-icon,
.slothy-mp-effort-model strong {
  color: var(--slothy-accent-ink, #3f7d00);
}
.slothy-mp-effort-header {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) 26px;
  align-items: start;
  gap: 6px;
  color: var(--slothy-muted, #6b7280);
}
.slothy-mp-effort-model {
  grid-column: 2;
  display: grid;
  justify-items: center;
  gap: 2px;
  padding: 4px;
  border: 0;
  border-radius: var(--radius, 8px);
  background: var(--slothy-neutral, #ececea);
  color: inherit;
  font: inherit;
  text-align: center;
  overflow-wrap: anywhere;
  cursor: pointer;
}
.slothy-mp-effort-model span {
  font-size: var(--type-sm, 12px);
}
.slothy-mp-chevron {
  display: inline;
  width: 12px;
  height: 12px;
  vertical-align: middle;
}
.slothy-mp-effort-reset {
  grid-column: 3;
  display: grid;
  place-items: center;
  height: 28px;
  border: 0;
  border-radius: var(--radius, 8px);
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.slothy-mp-effort-reset:hover {
  background: var(--slothy-neutral, #ececea);
}
.slothy-mp-effort-slider {
  position: relative;
  height: 20px;
  margin: 14px 0 4px;
  border-radius: 999px;
  background: var(--slothy-neutral, #ececea);
}
.slothy-mp-effort-visual {
  position: absolute;
  inset: 0 11px;
  pointer-events: none;
}
.slothy-mp-effort-fill {
  position: absolute;
  inset: 0 auto 0 -11px;
  width: calc(11px + var(--level));
  border-radius: 999px;
  background: var(--slothy-accent, #60dd06);
  transition: width 180ms ease-out;
}
.slothy-mp-effort-max .slothy-mp-effort-fill {
  width: calc(22px + var(--level));
  background: var(--slothy-accent-ink, #3f7d00);
}
.slothy-mp-effort-marks {
  position: absolute;
  inset: 0 -2px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.slothy-mp-effort-marks > span {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgb(255 255 255 / 70%);
}
.slothy-mp-effort-thumb {
  position: absolute;
  top: 50%;
  left: var(--level);
  width: 22px;
  height: 22px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: var(--slothy-ink, #1f2320);
  transition: left 180ms ease-out;
}
.slothy-mp-effort-range {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  appearance: none;
  opacity: 0;
  cursor: pointer;
}
.slothy-mp-effort-range::-webkit-slider-thumb {
  appearance: none;
  width: 22px;
  height: 22px;
}
.slothy-mp-effort-range::-moz-range-thumb {
  width: 22px;
  height: 22px;
}
.slothy-mp-effort-slider:has(.slothy-mp-effort-range:focus-visible) {
  outline: 2px solid var(--slothy-accent, #60dd06);
  outline-offset: 4px;
}
@media (prefers-reduced-motion: reduce) {
  .slothy-mp-effort-fill,
  .slothy-mp-effort-thumb {
    transition: none;
  }
}
</style>
