# dsh-extend

Three DeepSeek Harness plugins in one bundle — **Desktop Pet**, **Wallpaper** and **Open In…** — replacing the separate `@qwqweeo123/dsh-pet`, `@qwqweeo123/dsh-wallpaper` and `@qwqweeo123/dsh-open-in-app` packages, which are deprecated.

English | [中文](README.zh.md)

## What is inside

- **Desktop Pet** — a sprite in its **own transparent, always-on-top window** (`desktop/pet-window.ps1`, WPF on Windows) that you can drag anywhere on screen, including outside the Harness window. It reacts to agent state (running / waiting / failed / idle), shows a running-session badge, has a right-click menu, and falls back to an in-page overlay when the window cannot start. Browse and install pets from [codex-pets.net](https://codex-pets.net) under **Settings → Desktop Pet**; downloads stay in `~/.dsh/pet`.
- **Wallpaper** — one global background re-composited so every surface shows the same image weight, from the [wallhaven.cc](https://wallhaven.cc) marketplace (**SFW only**) or a local upload, with a local download library (`~/.dsh/wallpaper/library`), live blur/opacity/fill sliders, and native titlebar integration on the Windows desktop build. Configure under **Settings → Wallpaper**.
- **Open In…** — the Session-header split button that opens the workspace directory in an installed editor, Git GUI, terminal or file manager: a self-contained copy of the app's own feature, carrying the fixes a stock desktop build needs (Electron `ELECTRON_RUN_AS_NODE` scrubbing, Git install-record matching, Microsoft Store alias resolution). The bundle patch disables the shipped pair and mounts this copy, so the fixes travel with the plugin instead of an `app.asar` patch.

All three share one Host entry and one browser module; every feature keeps its own routes (`/dsh-pet/*`, `/dsh-wallpaper/*`, `/open-in-app/*`), settings sections, state directories and service gating, exactly as the standalone packages behaved.

## Install

From the market: **Settings → Plugin Market → Extend Suite → Install**, then restart once (the Host half loads at boot).

Manually:

```sh
dsh plugin --profile desktop add @qwqweeo123/dsh-extend
```

Do not install it together with the old `@qwqweeo123/dsh-pet`, `@qwqweeo123/dsh-wallpaper` or `@qwqweeo123/dsh-open-in-app` packages — the features are identical and their routes would collide. Remove the old ones first; your pets (`~/.dsh/pet`) and wallpapers (`~/.dsh/wallpaper`) carry over untouched.

## Layout

```
index.js                 Host composition root: mounts all three feature halves
pet.js                   Desktop Pet Host half (/dsh-pet/* routes, desktop window helper)
wallpaper.js             Wallpaper Host half (/dsh-wallpaper/* routes, wallhaven proxy, library)
open-in-app …            Open In… Host half lives in vendor/open-in-app-host.js
vendor/                  the app's own Open In… Host code + framework pieces it imports
desktop/pet-window.ps1   the transparent always-on-top pet window (WPF, Windows)
client.js                browser half: the three feature modules + the composition module
cordis.patch.yml         bundle patch: insert this package, disable the built-in Open In… pair
```

The vendored files are the `0.2.0-rc.2` builds of MIT-licensed DSH code; see [THIRD-PARTY.md](THIRD-PARTY.md).

## Compatibility

- Desktop app (Windows) is the intended target for the pet window and the Open In… fixes; in a plain web profile the pet renders as an in-page overlay and wallpaper works everywhere.
- Requires Harness `0.2.0-rc.2` or newer.

## License

MIT © 2026 MingXuanZi. Vendored DeepSeek Harness code is MIT © DeepSeek — see [THIRD-PARTY.md](THIRD-PARTY.md).
