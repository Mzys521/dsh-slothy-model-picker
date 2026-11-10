# dsh-slothy-model-picker

[![npm](https://img.shields.io/npm/v/dsh-slothy-model-picker.svg)](https://www.npmjs.com/package/dsh-slothy-model-picker)
[![license](https://img.shields.io/npm/l/dsh-slothy-model-picker.svg)](./LICENSE)

[English](./README.md) | 中文

DeepSeek Harness Web GUI 的 Slothy 风格模型选择器插件。它把输入框里的模型控件替换为「触发按钮 + 按服务商分组的模型列表 + 推理强度滑轨」，数据复用内置选择器与 `/model` 弹窗相同的会话模型目录。

## 功能

- **按服务商分组的模型列表**，顺序与部署一致（账号 → 官方 → 第三方）。
- **两段式强度控制**：先选模型，再拖滑轨；点模型名可回到模型列表。
- **挡位平滑切换**：拖动事件用 `requestAnimationFrame` 合并渲染，松手后锁定位置等待 Host 确认再平滑落位，挡位之间保留 CSS 过渡。
- **加宽圆角滑轨**：填充从滑轨左端延伸到滑钮，滑钮左侧始终保持填充。
- **特效仅最高档**：流光渐变、流动高光、呼吸辉光与粒子拖尾只在最高档出现，严格裁剪在滑轨内部，不改变布局尺寸。
- **外观设置页**（设置 →「外观」）：默认模式跟随 DSH 主题；自定义模式可覆盖背景色/背景图、强调色、轨道色、滑钮色、文字色与最高档位色，以内联样式获得最高优先级，并把座位注册优先级提升到最高。
- **双语界面**（`en` / `zh`），通过宿主 locale 服务切换。

## 环境要求

- DeepSeek Harness `0.2.2-rc.1` 或更新版本，并启用 Web GUI（`ui-conversation`）。
- 内置 `@deepseek-ai/dsh-client-ui-model-selection` 提供 `ctx.modelDirectories`；本插件只读取该服务，不重复实现模型选择。
- 安装插件需要 Harness 的 Full access / 审批，与普通第三方插件一致。

## 安装

### npm（一键安装）

```
plugin_manager  action: install_bundle
                target: dsh-slothy-model-picker
```

插件管理器会解析 npm 包、链接到当前 profile 并激活 bundle。

> npm 包尚未发布。首次发布完成前，请使用下面的 GitHub Release 或源码目录安装；维护者参考 [docs/PUBLISHING.md](./docs/PUBLISHING.md)。

### GitHub Release

1. 从 [Releases](https://github.com/Mzys521/dsh-slothy-model-picker/releases) 下载 `dsh-slothy-model-picker-<版本>.tgz` 并解压。
2. 用 `plugin_manager install_bundle` 指向解压出的目录。

### 从源码安装

```bash
git clone https://github.com/Mzys521/dsh-slothy-model-picker.git
```

然后用 `plugin_manager install_bundle` 指向克隆下来的目录。

## 使用

- 点触发器打开：当前模型有推理档位时先显示强度面板；点面板里的模型名可回到模型列表。
- 选模型：按该模型的默认档位提交并进入强度面板；无档位则直接关闭。
- 拖滑轨：滑钮跟随指针，挡位之间平滑过渡，松手（`pointerup` / `keyup` / `blur`）后才提交一次。
- 拉到最高档时，滑轨显示特效，所有推理等级文字使用配置的「最高档位色」。
- `Esc` 与点击外部关闭；弹层 portal 到 `document.body`，不会被输入框底栏裁剪。
- 模型切换走与内置选择器相同的 Host 路径（`directory.select({ provider, model, reasoningEffort })`），在下一请求生效；运行中的步骤保持它开始时的模型。

## 外观自定义

打开 Harness 设置 →「外观」：

- **默认模式**：跟随 DSH 主题，座位注册优先级保持 `-1`。
- **自定义模式**：可设置背景色/背景图、强调色、轨道色、滑钮色、文字色、最高档位色。自定义值以内联 CSS 自定义属性写入（优先级最高，覆盖主题与皮肤），座位以 `-1000` 注册，确保输入框的模型控件由本插件渲染。留空某项即回退主题色；「恢复默认」清除全部自定义并回到默认模式。
- 设置保存在浏览器 `localStorage`，键为 `dsh-slothy-model-picker:appearance:v1`。

完整机制见 [docs/CUSTOMIZATION.md](./docs/CUSTOMIZATION.md)。

## 兼容性

已在 DeepSeek Harness `0.2.2-rc.1` 的 Web GUI 上验证。插件遮蔽 `conversation.input.model` 座位；若未来 Harness 调整该插槽契约，可能需要适配更新。停用插件即可恢复内置选择器，无需重启。

## 停用 / 卸载

```
plugin_manager  action: set_plugin    target: include:slothy-model-picker enabled: false
plugin_manager  action: remove_bundle target: dsh-slothy-model-picker
```

## 开发

```bash
npm test          # node --test tests/
npm pack          # 生成可安装的 tgz
```

目录结构：

- `lib/index.js`：宿主半侧（只有 `apply`，渲染全在浏览器侧）。
- `lib/client.js`：浏览器半侧，注册输入框座位与外观设置页，订阅 `ctx.modelDirectories`，用无 JSX 的 React 渲染。
- `src/`：原始提取文件（`ModelPicker.tsx`、`ModelPicker.vue`、`types.ts`），仅作来源，运行时不加载。
- `tests/`：离线接线测试（fake module loader + fake Cordis services）。
- `docs/`：安装、开发与自定义说明。

发布流程见 [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)。

## 许可

[MIT](./LICENSE) © 2026 Mzys521
