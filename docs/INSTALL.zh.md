# 安装与升级（中文）

本文说明 `dsh-slothy-model-picker` 在 DeepSeek Harness 中的三种安装方式、升级与卸载。

## 环境要求

- DeepSeek Harness `0.2.2-rc.1` 或更新版本，并启用 Web GUI（`ui-conversation`）。
- Harness 内置 `@deepseek-ai/dsh-client-ui-model-selection`（提供 `ctx.modelDirectories`）。
- 安装插件需要 Full access / 审批。

## 方式一：npm 一键安装（推荐）

在 Harness 中执行：

```
plugin_manager  action: install_bundle
                target: dsh-slothy-model-picker
```

插件管理器会从 npm registry 解析包、安装到当前 profile 并激活 bundle。安装后输入框里的模型控件即由本插件提供。

## 方式二：GitHub Release

1. 打开 <https://github.com/Mzys521/dsh-slothy-model-picker/releases>，下载对应版本的 `dsh-slothy-model-picker-<版本>.tgz`。
2. 解压到任意目录。
3. 执行：

```
plugin_manager  action: install_bundle
                target: <解压目录绝对路径>
```

## 方式三：从源码目录安装

```bash
git clone https://github.com/Mzys521/dsh-slothy-model-picker.git
```

然后 `install_bundle` 指向克隆下来的目录。该方式是链接安装，工作目录内容修改后重新加载即可生效，适合开发调试。

## 升级

- npm：重新执行一次 `install_bundle target: dsh-slothy-model-picker`（先 `remove_bundle` 再安装可强制刷新版本）。
- Release / 源码：下载或拉取新版本后，先 `remove_bundle target: dsh-slothy-model-picker`，再指向新目录安装。

升级后建议刷新一次页面，确保浏览器加载最新的 `lib/client.js`。

## 停用与卸载

```
plugin_manager  action: set_plugin    target: include:slothy-model-picker enabled: false
plugin_manager  action: remove_bundle target: dsh-slothy-model-picker
```

停用后输入框回到内置模型位，无需重启。
