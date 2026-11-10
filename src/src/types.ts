/**
 * Shared model-picker types for the extracted Slothy component.
 * 提取后的 Slothy 模型选择器共用类型。
 */

/** One catalog entry shown in the picker. / 选择器展示的一条模型目录项。 */
export interface ModelItem {
  id: string
  provider: string
  display_name?: string | null
  reasoning_levels?: string[] | null
  default_effort?: string | null
}

/** Localized labels; hosts can override any entry. / 本地化文案，宿主可覆盖任意条目。 */
export interface ModelPickerLabels {
  trigger: string
  selectModel: string
  defaultModel: string
  modelSettings: string
  thinkingEffort: string
  restoreDefault: string
  auto: string
  off: string
  thinking: string
  low: string
  high: string
  max: string
}
