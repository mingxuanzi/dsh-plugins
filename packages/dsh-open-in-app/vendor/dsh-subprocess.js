/**
 * Local stand-in for `scrubbedParentEnv()` from `@deepseek-ai/dsh-subprocess`.
 *
 * That package is a Cordis *service*: importing it drags in the framework
 * (`@deepseek-ai/cordis`) and the proxy overlay package, while the Open In…
 * host half only ever calls this one free function to build the environment a
 * launched application inherits. Vendoring the function keeps the plugin
 * self-contained; the behaviour it has to preserve is small and explicit:
 *
 *   * credential-shaped names never leak into an application the user opens
 *     (`KEY`, `PASSWORD`, `SECRET`, `TOKEN`, case-insensitive);
 *   * Harness-internal `DSH_*` names stay inside the Harness;
 *   * everything else — `PATH`, `HOME`, locale, proxies — survives, so the
 *     launched editor or terminal behaves exactly as it does from a shell.
 *
 * One name is removed on top of that: `ELECTRON_RUN_AS_NODE`, which the desktop
 * Host carries because it *is* the Electron binary in node mode. An Electron
 * application launched with it boots as plain node instead. This scrub is the
 * only place it is dropped — never the Host's own `process.env`, because the
 * framework's process-spawning tools inherit it to re-enter node mode.
 */

/** Names whose value must never reach a launched application. */
const SENSITIVE_ENV_PATTERN = /KEY|PASSWORD|SECRET|TOKEN/i

/** Harness-internal namespace. */
const HARNESS_ENV_PREFIX = 'DSH_'

/**
 * The ambient parent environment minus credentials and Harness names.
 *
 * @returns a fresh, mutable copy safe to hand to `spawn`.
 */
export function scrubbedParentEnv() {
  const env = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue
    if (SENSITIVE_ENV_PATTERN.test(key)) continue
    if (key.toUpperCase().startsWith(HARNESS_ENV_PREFIX)) continue
    if (key === 'ELECTRON_RUN_AS_NODE') continue
    env[key] = value
  }
  return env
}
