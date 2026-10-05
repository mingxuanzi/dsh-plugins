# dsh-open-in-app

The Session-header **“Open In…”** split button — open the workspace directory in an installed editor, Git GUI, terminal, or file manager.

English | [中文](README.zh.md)

## Why this exists as a plugin

The desktop app already ships this feature (`@deepseek-ai/dsh-host-open-in-app` + its browser companion), so a fresh install shows the button. What a stock desktop build gets wrong is the **launch**:

| Gap | What the user sees | Fix in this package |
|---|---|---|
| The Host process *is* the Electron binary in node mode, so children inherit `ELECTRON_RUN_AS_NODE=1` | VS Code, Cursor, Windsurf, Zed boot as plain node, exit 1 inside the launch watch window — clicking does nothing | `index.js` deletes that variable before mounting the resolver (the framework's own env scrubber keeps it) |
| Git for Windows registers as “Git version …” while the catalog matches install records by display name | Git Bash can be missing from the menu (a default-path fallback still finds `%ProgramFiles%\Git\git-bash.exe`) | the vendored host half carries the fixed record matching |
| Microsoft Store applications are 0-byte execution aliases under `…\Microsoft\WindowsApps\` | Windows Terminal lists but fails to launch, or shows no icon | the vendored host half resolves the alias to the real package path |

So the **feature ships with the app, the fixes ship with the plugin** — no `app.asar` patching, and an app upgrade cannot take them away.

## Install

From the market: **Settings → Plugin Market → Open In… → Install**, then restart once (the Host half loads at boot).

Manually:

```sh
dsh plugin --profile desktop add dsh-open-in-app
```

The package replaces the built-in pair through its own bundle patch: it disables the shipped `open-in-app` / `ui-open-in-app` entries (both register the same routes and slot ids) and mounts its own copy. Removing the plugin restores them.

## What is inside

```
index.js                     Host half: environment fix + mount the resolver
vendor/open-in-app-host.js   the app's own Host half (imports localized), with the fixes above
vendor/dsh-native-command.js, vendor/dsh-launch-environment.js, vendor/dsh-subprocess.js
                             the framework pieces it imports (the last is a documented
                             local stand-in for scrubbedParentEnv())
client.js                    the app's own browser half, registration id rewritten
cordis.patch.yml             bundle patch: disable the built-in pair, insert this package
```

The vendored files are the `0.2.0-rc.2` builds of MIT-licensed DSH code; see [THIRD-PARTY.md](THIRD-PARTY.md).

## Compatibility

- Harness desktop app `0.2.0-rc.2`. After a Harness upgrade, re-extract the vendored halves if slot names, route prefixes or Host service APIs changed (`tools/vendor.mjs` in the source repository).
- Windows, macOS and Linux all resolve their own entries; the two fixes above are Windows-specific.

## License

MIT © 2026 MingXuanZi. Vendored DeepSeek Harness code is MIT © DeepSeek — see [THIRD-PARTY.md](THIRD-PARTY.md).
