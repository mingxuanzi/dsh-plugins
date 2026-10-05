# DSH plugins by MingXuanZi

Three plugins for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), published to npm and listed in the [DSH plugin market](https://awesome-dsh-plugin.com).

| Package | What it does | Category |
|---|---|---|
| [`packages/dsh-pet`](packages/dsh-pet) | A draggable desktop pet in its own transparent always-on-top window, reacting to agent state, with the codex-pets.net marketplace. | `fun` |
| [`packages/dsh-wallpaper`](packages/dsh-wallpaper) | A global wallpaper that stays consistent across every surface, from wallhaven.cc or a local file — plus native titlebar integration on the Windows desktop build. | `theme` |
| [`packages/dsh-open-in-app`](packages/dsh-open-in-app) | The Session-header "Open In…" split button, shipped with the fixes a stock desktop build needs (Electron env scrubbing, Git record matching, Microsoft Store alias resolution). | `tools` |

Each package declares a `dsh.bundle` manifest, so it installs with `dsh plugin add`:

```sh
dsh plugin --profile desktop add @qwqweeo123/dsh-pet
dsh plugin --profile desktop add @qwqweeo123/dsh-wallpaper
dsh plugin --profile desktop add @qwqweeo123/dsh-open-in-app
```

Or install them from **Settings → Plugin Market** (the market maps a repository to its npm package automatically).

## Layout

```
packages/dsh-pet/            index.js · client.js · cordis.patch.yml · locale/ · desktop/ · icon.svg
packages/dsh-wallpaper/      index.js · client.js · cordis.patch.yml · locale/ · icon.svg
packages/dsh-open-in-app/    index.js · client.js · cordis.patch.yml · vendor/ · THIRD-PARTY.md
```

`dsh-open-in-app` vendors MIT-licensed DeepSeek Harness code (the built Host and browser halves of the built-in "Open In…" feature); attribution and the upstream licence are in its [THIRD-PARTY.md](packages/dsh-open-in-app/THIRD-PARTY.md).

## License

MIT © 2026 MingXuanZi. Vendored upstream code keeps its own MIT terms.
