# Slothy Model Picker — 提取组件与 Harness 集成说明

> 来源：`web/src/ModelPicker.vue`（Slothy 0.1.3.x 桌面端）
> 目标：可复用组件 + 接入 DeepSeek Harness Web GUI
> 目录内容：`ModelPicker.vue`（Vue 3）、`ModelPicker.tsx`（React 18，Harness 用）、`types.ts`、本说明

---

## 1. 原实现总结

### 1.1 组件结构

```
ModelPicker（触发按钮 + 弹层）
├─ trigger：模型名 + 当前推理强度 + ChevronDown
└─ popup（两态面板，同一弹层内切换）
   ├─ 模型列表态
   │   ├─ "Default / 默认" 行（value = "auto"）
   │   └─ 按 provider 分组的模型行（Check 标记当前项）
   └─ 强度态（选中模型有 reasoning levels 时）
       ├─ Header：当前档位（加粗）+ 模型名 + 返回箭头 + 恢复默认
       ├─ 滑轨：fill + 档位圆点 + thumb
       └─ 原生 range input 覆盖全轨（可访问性）
```

### 1.2 数据与状态（原项目）

| 数据 | 来源 / 持久化 |
|---|---|
| 模型目录 | `GET /api/v1/models` → `{ items: ModelItem[], default: string \| null }`（ChatPage.vue:89） |
| 当前选择 | `model = ref(readLocal('adaptive.model', 'auto'))`；`watch(model)` 写回 localStorage（ChatPage.vue:32,73） |
| 实际模型对象 | `selectedModel = items.find(id === (model==='auto' ? default : model))` |
| 推理强度 | 按模型 id 持久化：`adaptive.reasoningLevels = { [modelId]: effort }`；优先保存值，若模型已不支持则回退 `default_effort`（ChatPage.vue:42-58） |
| 默认项 | `selectedModel.reasoning_levels: string[]`、`default_effort: string \| null` |
| 强度标签 | `none → Off`；MiMo provider → `Thinking`；`low → Low`；`max → Max`；其余 → `High` |

### 1.3 交互与可访问性

- 点 trigger 打开/关闭；打开时若模型无强度档位直接显示模型列表，否则显示强度面板。
- 选择模型：`auto` 或具体 id；若该模型有强度档位 → 切到强度面板；否则关闭并聚焦 trigger。
- 强度滑轨：`input[type=range]` 覆盖整个视觉轨道（opacity:0），`@input` 发出 `effort` 事件；`--level` CSS 变量驱动 fill/thumb 位置。
- 外部 `pointerdown` 关闭；`Esc` 关闭并把焦点还给 trigger。
- `aria-expanded`、`aria-label="LLM model · 模型 · 强度"`、`aria-pressed` 标记当前行、`title` 显示 model id + 强度。
- 纯 CSS 主题变量（`--surface/--neutral/--accent/--ink/--muted/--radius`），深色/浅色自动继承；`prefers-reduced-motion` 关闭过渡。
- 单行宽度上限 `min(31cqw, 240px)`，弹层 `min(282px, 77cqw)`，向上弹出（`bottom: calc(100% + 12px)`）。

### 1.4 与原项目耦合点（提取时已解除）

| 原依赖 | 处理 |
|---|---|
| `import { t } from './preferences'` | 改为 `locale` prop + 组件内置双语字符串 |
| `import type { ModelItem } from './workApi'` | 移到 `types.ts` |
| `lucide-vue-next` 图标 | 改为内联 SVG（无第三方依赖） |
| 全局 `style.css` 中的类 | 组件内 `<style scoped>`，变量带 fallback |
| localStorage 持久化 | 由宿主负责（组件只暴露 `v-model` / `effort`） |

---

## 2. 组件 API

### Vue（`ModelPicker.vue`）

```ts
props: {
  items: ModelItem[]              // 必填：模型目录
  modelValue: string              // v-model：'auto' 或模型 id
  selected?: ModelItem            // 当前模型对象（用于强度/显示名）
  effort?: string                 // 当前推理强度
  locale?: string                 // 'zh-CN' | 'en'，默认 en
}
emits: {
  'update:modelValue': [id: string]
  'effort': [level: string]
}
```

### React（`ModelPicker.tsx`）

```tsx
<ModelPicker
  items={items}
  value={modelId}
  selected={selected}
  effort={effort}
  locale={locale}
  onChange={(id) => ...}      // 选模型
  onEffort={(level) => ...}   // 选强度
/>
```

`ModelItem`：

```ts
interface ModelItem {
  id: string
  provider: string
  display_name?: string | null
  reasoning_levels?: string[] | null
  default_effort?: string | null
}
```

---

## 3. 接入 DeepSeek Harness（Web GUI）

### 3.1 现状（2026-11-07 检查）

Harness 已自带模型选择，**不要重复造轮子**：

- 包：`@deepseek-ai/dsh-client-ui-model-selection`（Web 模型选择：`/model` 弹窗 + composer 模型位）
- 槽位：`conversation.input.model`（single，`replaceRisk: shadows-shipped-ui`）
  - 子槽 `conversation.input.model.label`（single，非交互标签，可自定义徽标）
- 数据：文档说明两个入口共用 `ctx.modelDirectories` 的 per-session 目录，通过 `session.models` 加载、`session.selectModel` 提交；目录按 provider 分组、支持搜索与 reasoning effort。
- 安装状态：该包在当前 profile 中为 `absent`，当前 composer 的模型占位由 `conversation.input.model` 的现有 occupant 提供。

### 3.2 两种接入方式

| 方式 | 做法 | 风险 | 适用 |
|---|---|---|---|
| **A. 只定制标签**（推荐先做） | 注册 `conversation.input.model.label`，保留 Harness 的选择逻辑/搜索/effort，只把模型名/徽标换成 Slothy 视觉 | 无（非交互） | 想要 Slothy 品牌样式但不改交互 |
| **B. 替换整个 seat** | 注册 `conversation.input.model`（single，替换内置 occupant），用本组件渲染并自行接 `ModelDirectory` | 高：遮蔽内置选择器，需完整接目录/选择/失败/实时刷新；升级 Harness 可能冲突 | 明确要 Slothy 的两段式交互（模型列表 → 强度滑轨） |

方式 B 的适配层需要（按 Harness 文档整理）：

```ts
// 伪代码：在插件 client 入口中获取 per-session 目录
const directory = ctx.modelDirectories.resolve(sessionId) // 实际 API 以安装包类型为准
const snapshot = await directory.load()                   // 映射为 ModelItem[]
await directory.select({ provider, model, reasoningEffort })
```

把 Harness 目录映射为本组件类型：

```ts
const items: ModelItem[] = groups.flatMap(group => group.models.map(m => ({
  id: m.modelId,                       // Harness 的 model id
  provider: group.provider.id,         // deepseek / deepseek-account / third-party
  display_name: m.name,
  reasoning_levels: m.reasoningEfforts ?? [],
  default_effort: m.defaultReasoningEffort ?? null,
})))
```

### 3.3 插件骨架（方式 B）

`package.json`：

```json
{
  "name": "@local/slothy-model-picker",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./index.js",
    "./client": "./client.js",
    "./locale/*.json": "./locale/*.json",
    "./icon": "./icon.svg"
  },
  "files": ["index.js", "client.js", "cordis.patch.yml", "locale/*.json", "icon.svg"],
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "platform": "web",
      "immediately": true,
      "inject": [
        "@deepseek-ai/dsh-client-ui-conversation",
        "@deepseek-ai/dsh-client-ui-model-selection"
      ]
    }
  }
}
```

`cordis.patch.yml`：

```yaml
- insert:
    - id: slothy-model-picker
      name: '@local/slothy-model-picker'
```

`client.js` 注册（与 Harness 内置单槽一致；组件需编译为 `client.js` 中的 React 工厂）：

```js
window.__ModuleLoader__.load({
  id: '@local/slothy-model-picker',
  factory(require) {
    const React = require('react')
    const { ModelPicker } = require('./ModelPicker.js') // 构建产物
    function Seat(props) {
      // props 来自 PropsRuntime<'conversation.input.model'>：sessionId、useSession、inputActions 等
      // 通过 ctx.modelDirectories / session.models / session.selectModel 接线
      return React.createElement(ModelPicker, { ... })
    }
    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('conversation.input.model', () => ctx.slots.register({
          name: 'conversation.input.model',
        }, Seat))
      },
    }
  },
})
```

> 注意：`conversation.input.model` 是 single 槽，注册即**替代**内置模型位；若只想加视觉徽标，改注册 `conversation.input.model.label`。

### 3.4 安装与验证

1. 将本目录中的 `ModelPicker.tsx` 编译进插件的 `client.js`（Harness 的 Client 构建工具，或 esbuild → 纯 JS 工厂）。
2. 补齐展示检查：`locale/en.json`、`locale/zh.json`（插件标题/描述）、原创或授权图标 `icon.svg`。
3. 在 Harness 中安装（`plugin_manager install_bundle`，target 为包目录绝对路径），需要 Full access/审批；本环境审批被自动拒绝，故**本轮未安装**，避免遮蔽内置选择器。
4. 安装后验证：`conversation.input.model` 的 occupant 变为本插件、`/model` 仍工作、模型切换在下一请求生效、Escape/外部点击/键盘可用、双语与深色主题正常。

### 3.5 未完成/待确认

- 方式 B 需要以 `@deepseek-ai/dsh-client-ui-model-selection` 的实际 Client 类型（`ModelDirectory`、`session.models`、`session.selectModel`）为准；本轮通过文档与槽位检查确认了架构，未读取到已发布的 `.d.ts`（asar 内未包含）。
- 替换 single 槽会影响 Harness 升级兼容性，建议先 A 后 B，或把 B 做成可开关配置。
- 组件未接 `/model` 命令弹窗（Harness 已有）。

---

## 4. 文件清单

| 文件 | 说明 |
|---|---|
| `ModelPicker.vue` | Vue 3 独立组件（无外部依赖） |
| `ModelPicker.tsx` | React 18 组件（Harness/客户端插件用） |
| `types.ts` | `ModelItem`、`ModelPickerProps` |
| `README.md` | 本文件：实现总结 + API + Harness 接入 |
