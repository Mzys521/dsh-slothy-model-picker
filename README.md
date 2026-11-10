# dsh-slothy-model-picker

A Slothy-style model picker for the DeepSeek Harness Web GUI. It replaces the composer's model control with a trigger button, a provider-grouped model list, and a two-stage reasoning-effort slider — over the same per-session model directory the built-in picker and `/model` popup use.

为 DeepSeek Harness Web GUI 提供的 Slothy 风格模型选择器：替换输入框里的模型控件，改为「触发按钮 + 按服务商分组的模型列表 + 推理强度滑轨」，数据复用内置的会话模型目录。

> 组件来源：从 Slothy 桌面端 `ModelPicker.vue` 提取后 React 化（原始文件保留在 [`src/`](src/)）。视觉与交互沿用 Slothy，配色与尺寸跟随 DSH 主题。

## 需求

- DeepSeek Harness ≥ 0.2.x（已在 `0.2.2-rc.1` 实测），Web GUI 已启用输入框（`ui-conversation`）。
- 内置 `@deepseek-ai/dsh-client-ui-model-selection`：本插件复用它的 `ctx.modelDirectories` 会话目录服务。该包默认随 DSH 发行版提供。
- 安装插件需要 Harness 的 Full access / 审批（与普通第三方插件一致）。

## 安装

### 方式 A：从仓库安装（推荐）

```bash
git clone https://github.com/Mzys521/dsh-slothy-model-picker.git
```

然后在 Harness 里安装（target 指向克隆下来的目录绝对路径）：

```
plugin_manager  action: install_bundle
                target: <克隆目录>/dsh-slothy-model-picker
```

### 方式 B：从 Release 安装

1. 从 [Releases](https://github.com/Mzys521/dsh-slothy-model-picker/releases) 下载 `dsh-slothy-model-picker-<版本>.tgz` 并解压。
2. 用 `plugin_manager install_bundle` 指向解压出的目录。

安装完成后，输入框里的模型控件即为本插件；`/model` 命令与模型切换逻辑保持不变。

## 使用

- 点触发器打开：当前模型有推理档位时先显示**强度面板**，点面板里的模型名可回到**模型列表**。
- 选模型：立即按该模型的默认档位提交，并进入强度面板（无档位则直接关闭）。
- 拖滑轨：加宽、加厚的圆角滑轨；拖动时本地跟手，松手（`pointerup` / `keyup` / `blur`）才提交一次；重置按钮恢复服务商默认档位。
- **滑轨动效（仅最高档）**：普通档位保持简洁；仅当拉到**最高档**时，滑轨内部出现流光渐变、流动高光、滑钮呼吸光环与粒子拖尾。所有特效都被 `overflow:hidden` + `contain:paint` 严格裁剪在滑轨内部，且全部为绝对定位，**不会改变滑轨/弹层/页面尺寸，也不产生滚动条**；`prefers-reduced-motion` 下自动关闭。
- **最高档位配色**：处于最高档时，**所有位置**显示的推理等级（输入框触发器的档位文字、强度面板标题、设置页预览）统一使用「最高档位色」（默认 DSH 品牌色，可在外观设置里自定义），并加粗。
- `Esc`、点击外部关闭；弹层以 portal 渲染到 `body`，不会被输入框底栏裁剪。
- 模型切换走与内置选择器相同的 Host 路径（`directory.select({ provider, model, reasoningEffort })`），在下一请求生效；运行中的步骤保持它开始时的模型。

## 自定义（背景 / 配色 / 优先级）

打开 Harness 设置 →「外观」（Settings → Appearance）即可配置本插件：

- **默认模式**：完全跟随 DSH 主题（当前行为），座位注册优先级保持 `-1`。
- **自定义模式**：可设置背景色、背景图（URL / data URI）、强调色、轨道色、滑钮色、文字色、**最高档位色**；自定义值以**内联 CSS 自定义属性**写入，优先级最高，覆盖 DSH 主题与第三方皮肤；同时座位注册优先级提升到 `-1000`（最高），确保 `conversation.input.model` 上始终由本插件渲染。
- 留空某项即回退到主题色；「恢复默认」清除全部自定义并回到默认模式。
- 设置保存在当前浏览器的 `localStorage`（键 `dsh-slothy-model-picker:appearance:v1`），并有实时预览。

> “最高优先级”分两层实现：样式层用内联自定义属性压过主题/皮肤声明；座位层用 `priority: -1000` 压过其他占用者。默认模式保持 `-1` 不变。

## 配色与主题

- 默认模式下，滑块与弹层的颜色**全部来自 DSH 主题变量**（`--dsw-alias-*`）：填充/焦点/描边用 DSH 品牌色，轨道与滑钮用 DSH 表面色与描边色，随 DSH 的深色/浅色主题自动切换。
- 自定义模式下可逐项覆盖上述颜色与弹层背景，未覆盖的仍走 DSH 主题变量；「最高档位色」用于拉满时的滑钮/流光/粒子与输入框档位文字。
- 不写死 Slothy 的绿色或任何品牌色；`prefers-reduced-motion` 下关闭过渡与粒子动画。

## 实现

- `index.js`：宿主半侧，空实现。
- `client.js`：浏览器半侧（纯 JS，React 无 JSX）：
  - 以 `priority: -1` 注册 `conversation.input.model`——`single` 槽渲染**最低优先级**，因此遮蔽内置模型位而不注销它；
  - 通过 `ctx.modelDirectories.directoryFor(sessionId)` 取 `store`（`useSyncExternalStore` 订阅）与 `load()` / `select()`；
  - 插件自有 locale 命名空间 `slothyModelPicker`（`en` / `zh`），随宿主语言切换。
- `src/`：原始提取文件（`ModelPicker.tsx`、`ModelPicker.vue`、`types.ts`、原始说明），仅作来源与 Vue 宿主参考，运行时不加载。

## 更新记录

- `v1.2.5`：进一步优化挡位切换流畅度——填充层由 `width` 动画改为 GPU 合成层的 `transform: scaleX`，消除拖动/过渡时的布局重排。
- `v1.2.4`：挡位之间平滑过渡——松手后滑钮锁定在释放位置，提交确认后无缝落位；失败平滑回退；过渡时长调整为 0.22s。
- `v1.2.3`：修复挡位切换卡顿——拖动中的 `input` 事件用 `requestAnimationFrame` 合并为每帧一次渲染，并在拖动期间关闭填充/滑钮的 CSS 过渡，松手后再平滑落位。
- `v1.2.2`：最高档时，所有显示推理等级的位置（输入框档位文字、强度面板标题、预览）统一使用「最高档位色」。
- `v1.2.1`：特效收紧——仅最高档生效，严格裁剪在滑轨内部，不改变布局或页面尺寸；移除拖动中的特效与输入框文字光晕（只保留可配置颜色 + 字重）。
- `v1.2.0`：滑轨加宽加厚、更圆润；拖动/拉满时流光渐变、呼吸辉光与粒子特效；拉满时输入框思考档位按「最高档位色」高亮（可配置）；外观设置与预览同步展示最高档效果。
- `v1.1.0`：新增「外观」设置页（背景 / 配色自定义、默认/自定义模式、实时预览）；自定义模式启用最高样式与座位优先级。
- `v1.0.0`：首个公开版本，滑块与弹层配色跟随 DSH 主题。

## 停用 / 卸载

```
plugin_manager  action: set_plugin     target: include:slothy-model-picker enabled: false
plugin_manager  action: remove_bundle  target: dsh-slothy-model-picker
```

停用后输入框回到内置模型位，无需重启。

## 已知限制

- 本插件不注册 `/model` 命令（内置已有）。
- 未接 `conversation.input.model.label` 子槽渲染：内置的 label 贡献仍注册，但本插件直接显示目录中的模型名。
- 仅在 DeepSeek Harness `0.2.2-rc.1` 的 Web GUI 上验证；升级 Harness 后若座位协议变化，可能需适配。
- 视觉与交互验证基于槽位注册与模块加载，仓库维护者应在自己的页面上确认深浅色观感。

## 许可

[MIT](LICENSE) © 2026 Mzys521
