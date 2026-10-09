/**
 * Host half of @qwqweeo123/dsh-extend — one bundle carrying three features
 * that used to ship as three separate packages:
 *
 *   - Open In…   (was @qwqweeo123/dsh-open-in-app): the Session-header split
 *     button, a self-contained copy of the desktop app's own feature with the
 *     fixes a stock desktop build needs (Electron env scrubbing, Git
 *     install-record matching, Microsoft Store alias resolution). The bundle
 *     patch disables the shipped pair, so this copy owns /open-in-app/*.
 *   - Desktop Pet (was @qwqweeo123/dsh-pet): same-origin /dsh-pet/* routes —
 *     the codex-pets.net marketplace proxy, pet on-disk state, and the
 *     transparent always-on-top desktop window helper.
 *   - Wallpaper  (was @qwqweeo123/dsh-wallpaper): same-origin /dsh-wallpaper/*
 *     routes — the wallhaven.cc proxy, the validated wallpaper store and the
 *     download library.
 *
 * Every feature keeps the service gating its standalone package had, so a
 * profile missing one feature's services still gets the rest: the pet and
 * wallpaper halves subscribe to the optional `webServer` themselves, and
 * Open In… mounts through `ctx.inject` exactly where its standalone package
 * declared a static `inject` — on a profile without webServer/connection/
 * subprocess (pure browser shell) that half simply never starts.
 */

import { Config, inject as openInAppInject, apply as openInApp } from './vendor/open-in-app-host.js'
import { apply as pet } from './pet.js'
import { apply as wallpaper } from './wallpaper.js'

/** Cordis function-plugin name; the bundle patch mounts it as `dsh-extend`. */
export const name = 'dsh-extend'

/**
 * The Open In… command deadlines are the only configuration the suite takes;
 * the schema is re-exported so the row config in cordis.patch.yml validates
 * exactly as it did for the standalone package.
 */
export { Config }

/**
 * Mount all three features. The Open In… half's disposer is returned from the
 * `ctx.inject` callback, so cordis disposes it with this plugin; the pet and
 * wallpaper halves register their own effects on this context.
 *
 * @param ctx - composition context.
 * @param config - resolved plugin configuration (the three command deadlines).
 */
export function apply(ctx, config) {
  ctx.inject(openInAppInject, (featureCtx) => openInApp(featureCtx, config))
  pet(ctx)
  wallpaper(ctx)
}
