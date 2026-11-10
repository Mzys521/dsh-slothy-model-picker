# Appearance customization

The picker ships with an appearance store shared by the composer seat and the settings page. This note documents what the settings change and how they win over the host theme.

## Where it lives

Settings → **Appearance** (`settings.section` id `slothy-picker`, order 35).

## Modes

| Mode | Behavior |
|---|---|
| Default | No inline overrides; the picker uses DSH theme tokens (`--dsw-alias-*`) and the seat registers at priority `-1`. |
| Custom | Inline CSS custom properties override background, accent, track, thumb, text and max-effort colors; the seat re-registers at `-1000`. |

Custom values are applied as inline `style` custom properties on the trigger root and on the portaled popup. Inline declarations outrank theme and skin stylesheet declarations, which is why custom mode is the highest visual priority. Clearing a field removes that property and falls back to the theme token.

## Fields

- **Background color** (`--smp-surface`): popup surface. Empty → `--dsw-alias-bg-overlay`.
- **Background image**: URL or `data:image/...`; rendered as `cover` behind the popup content.
- **Accent** (`--smp-accent`): slider fill, thumb border, focus ring, check marks. Empty → `--dsw-alias-brand-primary`.
- **Track** (`--smp-track`): slider track background. Empty → `--dsw-alias-bg-layer-2`.
- **Thumb** (`--smp-thumb`): thumb fill. Empty → `--dsw-alias-bg-overlay`.
- **Text** (`--smp-ink`): popup text color. Empty → `--dsw-alias-label-primary`.
- **Max effort color** (`--smp-max-color`): used at the highest reasoning level for the level labels, the slider gradient, glow and particles. Empty → accent.

## Persistence

Values are stored in the browser's `localStorage` under `dsh-slothy-model-picker:appearance:v1`. The stored JSON is normalized on read; unknown values fall back to the default.

## Priority

Priority is implemented on two levels:

1. **Style**: inline custom properties (above) beat theme and skin declarations.
2. **Seat**: the composer seat is registered at priority `-1` in default mode and `-1000` in custom mode. A `single` slot renders its lowest priority, so custom mode keeps this plugin in front consistently.

Disabling the plugin restores the shipped model control without a restart.
