/**
 * Host half feature: primary-window state persistence (Windows desktop).
 *
 * The Electron shell always opens its primary window at a fixed 1280x820 and
 * forgets the user's geometry on every launch. This feature remembers it:
 *
 * - At profile boot, a one-shot `desktop/window-state.ps1 -Mode restore`
 *   polls (up to 60s) for the primary window and re-applies the saved
 *   placement — maximized, or the last normal bounds — through
 *   SetWindowPlacement, clamped back onto the connected monitors.
 * - A long-lived `-Mode watch` helper reads the window's WINDOWPLACEMENT
 *   every couple of seconds and atomically rewrites the state file whenever
 *   it changes, so the geometry on disk is always current (resize, move,
 *   maximize, unmaximize, tray-close — everything funnels through the same
 *   Win32 call).
 *
 * State lives at `$DSH_HOME/dsh-extend/window-state.json`. Both helpers find
 * the Electron main process as this process's parent and the primary window
 * as the main process's largest top-level window, so no Electron API or IPC
 * is needed — the Host half runs as a plain Node child of the shell.
 *
 * Windows-only; on any other platform the feature is a silent no-op.
 */

import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Win32 placement helper (see the header for the two modes). */
const HELPER_SCRIPT = fileURLToPath(new URL('./desktop/window-state.ps1', import.meta.url))

function storageDir() {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  return path.join(home, 'dsh-extend')
}

function statePath() {
  return path.join(storageDir(), 'window-state.json')
}

/**
 * Spawn the hidden helper; failures never reach the caller — a window-state
 * nicety must never break profile boot.
 */
function spawnHelper(extraArgs) {
  let child
  try {
    child = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-WindowStyle',
        'Hidden',
        '-File',
        HELPER_SCRIPT,
        ...extraArgs,
      ],
      { stdio: 'ignore', windowsHide: true }
    )
  } catch {
    return null
  }
  child.on('error', () => {})
  return child
}

/**
 * Mount the feature on the profile context.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function windowState(ctx) {
  if (process.platform !== 'win32') return

  let watcher = null

  ctx.effect(() => {
    void (async () => {
      try {
        await fs.mkdir(storageDir(), { recursive: true })
      } catch {
        /* best effort: a missing dir simply means nothing is restored */
      }
      const args = ['-HostPid', String(process.pid), '-StatePath', statePath()]
      // One-shot: re-apply the saved placement as soon as the window exists.
      spawnHelper([...args, '-Mode', 'restore'])
      // Persistent: keep the state file current for the next launch.
      watcher = spawnHelper([...args, '-Mode', 'watch'])
      if (watcher !== null) {
        watcher.on('exit', () => {
          if (watcher !== null) watcher = null
        })
      }
    })()
    return () => {
      if (watcher !== null) {
        try {
          watcher.kill()
        } catch {
          /* already gone */
        }
        watcher = null
      }
    }
  }, 'dsh-extend: window-state')
}
