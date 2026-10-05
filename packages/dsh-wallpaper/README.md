# dsh-wallpaper

A global wallpaper for DeepSeek Harness that stays **consistent across every surface**, not just behind the conversation.

English | [中文](README.zh.md)

## What it does

- **One image, one composite.** Instead of letting each panel keep its own opaque fill, the plugin re-composites the surfaces it walks (frame, columns, sidebar, chat canvas, composer) from the same recipe, so the wallpaper shows through with the *same* weight everywhere — the input box and the conversation area measure identical.
- **Marketplace + local files.** Search [wallhaven.cc](https://wallhaven.cc) inside **Settings → Wallpaper**, or pick any local image. The source image lives in `~/.dsh/wallpaper`.
- **Live sliders.** Image blur, mask (veil) opacity, panel opacity and fill mode (cover / contain / tile) apply immediately, no reload.
- **Native titlebar on the desktop app.** On the Windows desktop build the caption strip and its Electron window-controls overlay are painted opaque from a theme token; the plugin points that token at transparent, so the wallpaper continues to the top edge while the drag region and the caption buttons keep working.

## Install

From the market: **Settings → Plugin Market → Wallpaper → Install** (the market lists it under **Themes** as well).

Manually:

```sh
dsh plugin --profile desktop add dsh-wallpaper
```

## Configure

**Settings → Wallpaper** — image source, blur, mask opacity, panel opacity, fill mode. Lower panel opacity means more wallpaper; `0` leaves only the veil.

## Compatibility

- Any Harness web UI; the titlebar integration applies to the Windows desktop app only (detected from its preload marker).
- Requires Harness `0.2.0-rc.2` or newer.

## License

MIT © 2026 MingXuanZi
