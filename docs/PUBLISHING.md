# 发布到 npm

npm 发布需要 npm registry 凭据。本文说明两种发布方式：GitHub Actions（无需在本机登录 npm）或本地 `npm publish`。

## 方式一：GitHub Actions（推荐）

1. 在 npm 账号里创建一个 **Automation** token（npm → Access Tokens → Generate New Token → Automation）。
2. 打开仓库 Settings → Secrets and variables → Actions → New repository secret：
   - Name: `NPM_TOKEN`
   - Value: 刚创建的 token
3. 打开 Actions → **Publish to npm** → Run workflow（可选 dist-tag，默认 `latest`）。

工作流会先跑 `npm test`，通过后执行 `npm publish --access public`。

## 方式二：本地发布

```bash
npm login                # 已在 npm 登录可跳过
npm test                 # 先跑测试
npm publish --access public
```

发布后验证：

```bash
npm view dsh-slothy-model-picker version
```

用户即可一键安装：

```
plugin_manager  action: install_bundle
                target: dsh-slothy-model-picker
```

## 发布前检查

- `package.json` 的 `version` 已递增，且该版本未在 npm 上存在。
- `npm pack --dry-run` 包含 `lib/index.js`、`lib/client.js`、`cordis.patch.yml`、`locale/*.json`、`icon.svg`、`README.md`、`README.zh.md`。
- Git tag / GitHub Release 与 npm 版本一致。

## 当前状态

本仓库尚未完成首次 npm 发布（等待可用的 npm 凭据）。在发布完成前，请使用 GitHub Release 的 `.tgz` 或源码目录安装。
