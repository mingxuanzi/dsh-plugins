# DSH plugins by MingXuanZi

One plugin bundle for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), published to npm and listed in the [DSH plugin market](https://awesome-dsh-plugin.com).

| Package | What it does | Category |
|---|---|---|
| [`packages/dsh-extend`](packages/dsh-extend) | Three plugins in one: a draggable desktop pet in its own transparent always-on-top window (codex-pets.net marketplace), a global wallpaper consistent across every surface (wallhaven.cc or a local file, with Windows titlebar integration), and the Session-header "Open In…" split button with the desktop-build fixes. | `ui` |

It replaces the deprecated `@qwqweeo123/dsh-pet`, `@qwqweeo123/dsh-wallpaper` and `@qwqweeo123/dsh-open-in-app` packages — install only this one:

```sh
dsh plugin --profile desktop add @qwqweeo123/dsh-extend
```

Or install it from **Settings → Plugin Market** (the market maps a repository to its npm package automatically).

## Layout

```
packages/dsh-extend/    index.js · pet.js · wallpaper.js · client.js · cordis.patch.yml · vendor/ · desktop/ · locale/ · icon.svg · THIRD-PARTY.md
```

`dsh-extend` vendors MIT-licensed DeepSeek Harness code (the built Host and browser halves of the built-in "Open In…" feature); attribution and the upstream licence are in its [THIRD-PARTY.md](packages/dsh-extend/THIRD-PARTY.md).

## License

MIT © 2026 MingXuanZi. Vendored upstream code keeps its own MIT terms.
