# Development and release

## Layout

| Path | Role |
|---|---|
| `lib/index.js` | Host half: `apply()` only; the bundle contributes no host service. |
| `lib/client.js` | Browser half: registers the composer model seat (`conversation.input.model`) and the appearance settings page (`settings.section`), reads `ctx.modelDirectories`, renders with React without JSX. |
| `cordis.patch.yml` | Inserts the `slothy-model-picker` bundle row. |
| `locale/*.json` | Plugin Manager title/description per locale. |
| `icon.svg` | Plugin icon. |
| `src/` | Original extracted sources (`ModelPicker.tsx`, `ModelPicker.vue`, `types.ts`); not loaded at runtime. |
| `tests/` | Offline wiring tests (fake module loader + fake Cordis services, `node:test`). |
| `docs/` | Install, development and customization notes. |

## Tests

```bash
npm test
```

The tests load `lib/client.js` through a fake `window.__ModuleLoader__`, apply the plugin to fake `slots`/`modelDirectories`/`locale` services, and assert:

- the `settings.section` registration (`id: slothy-picker`, `order: 35`, localized label);
- the composer seat priority (`-1` in default mode, `-1000` in custom mode);
- the seat inject face (`available`, `load`, `select`, `directory`);
- the host half exports `apply`;
- `package.json` keeps `main: lib/index.js` and `exports["./client"]: ./lib/client.js`.

## Manual verification in a Harness

1. Install the package (link or tarball) and reload the page.
2. Inspect the live Client slots:
   - `conversation.input.model` → occupant `priority: -1` (or `-1000` in custom mode), `active: true`, shipped occupant inactive.
   - `settings.section` → occupant `id: slothy-picker`, `active: true`.
3. Open the composer picker: model list, effort pane, slider drag, top-level effects, and Settings → Appearance.

## Release checklist

1. Bump `version` in `package.json`.
2. Update `README.md`, `README.zh.md` and the changelog section.
3. `npm test` and `npm pack`; confirm the tarball contains `lib/index.js`, `lib/client.js`, `cordis.patch.yml`, `locale/*.json`, `icon.svg`, both READMEs.
4. Commit and push to `main`.
5. Publish to npm (`npm publish --access public`).
6. Create a GitHub Release for the tag with the packed `.tgz` attached.
7. Reinstall locally from the new artifact and re-run the slot inspection above.
