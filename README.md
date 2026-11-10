# dsh-slothy-model-picker

[![npm](https://img.shields.io/npm/v/dsh-slothy-model-picker.svg)](https://www.npmjs.com/package/dsh-slothy-model-picker)
[![license](https://img.shields.io/npm/l/dsh-slothy-model-picker.svg)](./LICENSE)

English | [中文](./README.zh.md)

A Slothy-style model picker plugin for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web GUI. It replaces the composer's model control with a trigger button, a provider-grouped model list, and a two-stage reasoning-effort slider — over the same per-session model directory used by the built-in picker and the `/model` popup.

## Features

- **Provider-grouped model list** with the deployment order (account → official → third-party).
- **Two-stage effort control**: pick a model, then drag the slider; a click on the model name goes back to the list.
- **Smooth level switching**: `requestAnimationFrame`-coalesced drag updates, a locked settle position until the host confirms, and CSS transitions between levels.
- **Wide, rounded slider** with a left-side fill that always reaches the thumb.
- **Top-level effects only**: shimmer, flowing gradient, glow and particle sparks appear only at the highest effort level, are clipped inside the track, and never change layout size.
- **Appearance settings page** (Settings → Appearance): default mode follows the DSH theme; custom mode overrides background color/image, accent, track, thumb, text and max-effort color with the highest cascade priority, and raises the seat registration priority.
- **Bilingual UI** (`en` / `zh`) through the host locale service.

## Requirements

- DeepSeek Harness `0.2.2-rc.1` or newer with the Web GUI (`ui-conversation`).
- The shipped `@deepseek-ai/dsh-client-ui-model-selection` package (bundled with DSH) provides `ctx.modelDirectories`; this plugin reads it and does not reimplement model selection.
- Installing a plugin requires Full access / approval in the Harness, as for any third-party plugin.

## Install

### npm (one command)

```
plugin_manager  action: install_bundle
                target: dsh-slothy-model-picker
```

The plugin manager resolves the npm package, links it into the profile, and activates the bundle.

> The npm package is not published yet. Until the first publish, install from the GitHub Release or the source checkout below. Maintainers: see [docs/PUBLISHING.md](./docs/PUBLISHING.md).

### GitHub Release

1. Download `dsh-slothy-model-picker-<version>.tgz` from [Releases](https://github.com/Mzys521/dsh-slothy-model-picker/releases) and extract it.
2. Point `plugin_manager install_bundle` at the extracted directory.

### From source

```bash
git clone https://github.com/Mzys521/dsh-slothy-model-picker.git
```

Then point `plugin_manager install_bundle` at the cloned directory.

## Usage

- Open the trigger: with a model that has reasoning levels, the effort pane opens first; click the model name to return to the model list.
- Pick a model: it is submitted with that model's default effort and the effort pane opens (or the popup closes when the model has no levels).
- Drag the slider: the thumb follows the pointer, levels transition smoothly, and the selection is submitted once on release (`pointerup` / `keyup` / `blur`).
- At the highest level the slider shows its effects and the reasoning-level labels use the configured **max effort color**.
- `Esc` and outside clicks close the popup. The popup portals to `document.body` so the docked composer cannot clip it.
- Switching the model goes through the same host path as the built-in picker (`directory.select({ provider, model, reasoningEffort })`) and applies to the next request; a running step keeps the model it started with.

## Appearance

Open Harness Settings → **Appearance**:

- **Default mode** keeps the current DSH theme and seat priority `-1`.
- **Custom mode** sets background color/image, accent, track, thumb, text and max-effort color. Values are applied as inline CSS custom properties (highest priority over theme/skin rules) and the seat registers at `-1000` so this plugin renders the composer model control. Clear a value to fall back to the theme; **Reset** restores the default mode.
- Settings live in the browser's `localStorage` under `dsh-slothy-model-picker:appearance:v1`.

See [docs/CUSTOMIZATION.md](./docs/CUSTOMIZATION.md) for the full mechanism.

## Compatibility

Tested on DeepSeek Harness `0.2.2-rc.1` Web GUI. The plugin shadows the `conversation.input.model` seat; if the slot contract changes in a future Harness release, an update may be required. Disabling the plugin restores the shipped picker without a restart.

## Uninstall

```
plugin_manager  action: set_plugin    target: include:slothy-model-picker enabled: false
plugin_manager  action: remove_bundle target: dsh-slothy-model-picker
```

## Development

```bash
npm test          # node --test tests/
npm pack          # build the installable tarball
```

Layout:

- `lib/index.js` — host half (`apply` only; rendering is browser-side).
- `lib/client.js` — browser half: registers the composer seat and the appearance settings page, subscribes to `ctx.modelDirectories`, renders with React without JSX.
- `src/` — original extracted sources (`ModelPicker.tsx`, `ModelPicker.vue`, `types.ts`) kept for provenance; not loaded at runtime.
- `tests/` — offline wiring tests with a fake module loader and fake Cordis services.
- `docs/` — installation, development and customization notes.

See [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) for the release checklist.

## License

[MIT](./LICENSE) © 2026 Mzys521
