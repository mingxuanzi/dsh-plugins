# dsh-extend

Five DeepSeek Harness plugins in one bundle — **Desktop Pet**, **Wallpaper**, **Open In…**, **Session Tabs** and the **Default Workspace Suite** — the first three replacing the separate `@qwqweeo123/dsh-pet`, `@qwqweeo123/dsh-wallpaper` and `@qwqweeo123/dsh-open-in-app` packages, which are deprecated.

English | [中文](README.zh.md)

## What is inside

- **Desktop Pet** — a sprite in its **own transparent, always-on-top window** (`desktop/pet-window.ps1`, WPF on Windows) that you can drag anywhere on screen, including outside the Harness window. It reacts to agent state (running / waiting / failed / idle), shows a running-session badge, has a right-click menu, and falls back to an in-page overlay when the window cannot start. Browse and install pets from [codex-pets.net](https://codex-pets.net) under **Settings → Desktop Pet**; downloads stay in `~/.dsh/pet`.
- **Wallpaper** — one global background re-composited so every surface shows the same image weight, from the [wallhaven.cc](https://wallhaven.cc) marketplace (**SFW only**) or a local upload, with a local download library (`~/.dsh/wallpaper/library`), live blur/opacity/fill sliders, and native titlebar integration on the Windows desktop build. Configure under **Settings → Wallpaper**.
- **Open In…** — the Session-header split button that opens the workspace directory in an installed editor, Git GUI, terminal or file manager: a self-contained copy of the app's own feature, carrying the fixes a stock desktop build needs (Electron `ELECTRON_RUN_AS_NODE` scrubbing, Git install-record matching, Microsoft Store alias resolution). The bundle patch disables the shipped pair and mounts this copy, so the fixes travel with the plugin instead of an `app.asar` patch.
- **Session Tabs** — a codeg-style browser tab strip in the window caption (the conversation header's top bar on the web shell): one tab per visible session (status dot, fading title, × on hover), click to switch, middle-click or right-click to close, drag sideways to reorder, and a trailing compose button for a new session. Closing only hides the tab; the session stays in the sidebar. **Every tab that newly appears lands at the end of the strip** — whether it is newly created, reopened from the closed set, or unarchived.
- **Window State** — remembers the desktop shell's primary-window geometry across launches: the maximized flag plus the normal-position bounds, watched continuously through Win32 `WINDOWPLACEMENT` and atomically rewritten to `~/.dsh/dsh-extend/window-state.json` on every change, then re-applied at boot (clamped back onto the visible monitors when the saved spot no longer exists). Windows desktop only; silently skipped elsewhere.
- **Default Workspace Suite** — three rules centered on the default workspace (`Documents/deepseek-harness/default-workspace`): the **default workspace cannot be deleted** (its sidebar row no longer renders the "…" actions button at all — the Rename/Delete menu cannot be opened; should the menu ever surface anyway, its Delete row is hidden the moment it mounts, and every residual deletion path is still refused at the model with the reason shown in the confirm dialog); a new session created in the default workspace is born at the workspace root with **no folder at all** (the shell's blank-session reuse keeps a single pending session no matter how often "+" is clicked), and only when its **first message is actually sent** does one random `ws-xxxxxxxx` folder appear — the prompt is seamlessly re-homed into a fresh session living in that folder, the view swaps onto it, and later prompts follow — so only a session that truly received a message owns a disposable random workspace; and in the sidebar grouping, all of those random-workspace sessions (including the implicit workspace records the host adopts for the sub-folders after a restart) are **filed under the default workspace group**, never in the Ungrouped bucket.

The first three share one Host entry; all five share one browser module. Every host feature keeps its own routes (`/dsh-pet/*`, `/dsh-wallpaper/*`, `/open-in-app/*`), settings sections, state directories and service gating, exactly as the standalone packages behaved; the tab bar and the Default Workspace Suite are browser-only and mount no routes.

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
client.js                browser half: the four feature modules + the composition module
cordis.patch.yml         bundle patch: insert this package, disable the built-in Open In… pair
```

The vendored files are the `0.2.0-rc.2` builds of MIT-licensed DSH code; see [THIRD-PARTY.md](THIRD-PARTY.md).

## Compatibility

- Desktop app (Windows) is the intended target for the pet window and the Open In… fixes; in a plain web profile the pet renders as an in-page overlay and wallpaper works everywhere.
- Requires Harness `0.2.0-rc.2` or newer.

## License

MIT © 2026 MingXuanZi. Vendored DeepSeek Harness code is MIT © DeepSeek — see [THIRD-PARTY.md](THIRD-PARTY.md).
