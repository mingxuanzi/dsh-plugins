/**
 * "Open In…" — the desktop application's own Session-header feature, carried by
 * a plugin so a stock installation gets the working version without an
 * app.asar patch.
 *
 * The Host half is `vendor/open-in-app-host.js`, which is the application's
 * own built resolver with the two fixes a desktop build needs baked in
 * (Store-alias icon extraction, and Git install-record matching). The third
 * one — scrubbing `ELECTRON_RUN_AS_NODE` for the opened application — lives in
 * the vendored `vendor/dsh-subprocess.js`, which the resolver uses to build
 * that application's launch environment.
 */

import { Config, apply as openInApp, inject } from './vendor/open-in-app-host.js'

/** Cordis function-plugin name; the bundle patch mounts it as `dsh-open-in-app`. */
export const name = 'dsh-open-in-app'

export { Config, inject }

/**
 * Mount the resolver. The environment handed to an application it opens is
 * built by the vendored `scrubbedParentEnv()`, which drops
 * `ELECTRON_RUN_AS_NODE` there: an Electron-based target (VS Code, Cursor,
 * Windsurf, Zed's Electron builds) launched with it boots as plain node,
 * tries to load the workspace path as a module, and exits 1 inside the launch
 * watch window — the user sees "nothing happened".
 *
 * The variable is deliberately left in this process's own environment. The
 * framework's process-spawning tools re-enter node mode through
 * `process.execPath` and inherit it, so deleting it process-wide breaks every
 * `pwsh` / `glob` / `grep` call with "Windows Job runner exited with exit
 * code 0 before proving its managed range empty". Only the launched
 * application's copy is scrubbed.
 *
 * @param ctx - composition context carrying webServer, connection, subprocess.
 * @param config - resolved plugin configuration (the three command deadlines).
 * @returns the mounted effect disposer.
 */
export function apply(ctx, config) {
  return openInApp(ctx, config)
}
