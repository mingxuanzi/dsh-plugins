# dsh-pet

A desktop pet for DeepSeek Harness: a sprite in its **own transparent, always-on-top window** — drag it anywhere on screen, including outside the Harness window — that reacts to what the agent is doing.

English | [中文](README.zh.md)

## What it does

- **Own window, not an overlay.** The pet runs in a separate borderless window (`desktop/pet-window.ps1` on Windows, WPF) so it floats above other applications and can be dragged off the Harness window entirely. If that window cannot be started, the plugin falls back to an in-page overlay.
- **Reacts to agent state.** The sprite changes animation with the session: running, waiting, failed, idle.
- **Running-session badge.** A corner badge shows how many sessions are running right now (hidden at zero).
- **Right-click menu.** Show/hide, change scale, manage pets, or quit the pet window without touching the Harness UI.
- **Marketplace.** Browse and install pets from [codex-pets.net](https://codex-pets.net) inside **Settings → Desktop Pet**; downloaded sprites stay in `~/.dsh/pet` and are never part of this package.

## Install

From the market: **Settings → Plugin Market → Desktop Pet → Install**.

Manually:

```sh
dsh plugin --profile desktop add dsh-pet
```

Then restart Harness once (the pet window is spawned by the plugin's Host half).

## Configure

**Settings → Desktop Pet** — active pet, scale, visibility, and the marketplace. The window's own right-click menu writes the same settings, so both stay in sync.

## Compatibility

- Desktop app (Windows) is the intended target: the always-on-top window is a PowerShell/WPF process.
- In a plain web profile the plugin still loads and the pet renders as an in-page overlay.
- Requires Harness `0.2.0-rc.2` or newer.

## License

MIT © 2026 MingXuanZi
