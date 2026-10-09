# Third-party notices

This package is MIT © 2026 MingXuanZi. It ships modified copies of MIT-licensed
DeepSeek Harness code, taken from the `0.2.0-rc.2` desktop build
(`app.asar → dsh/node_modules/@deepseek-ai/…`):

| File | Upstream package | Change |
|---|---|---|
| `vendor/open-in-app-host.js` | `@deepseek-ai/dsh-host-open-in-app` | imports localized to the vendored files below; carries the Store-alias and Git install-record fixes |
| `vendor/dsh-native-command.js` | `@deepseek-ai/dsh-native-command` | verbatim copy |
| `vendor/dsh-launch-environment.js` | `@deepseek-ai/dsh-launch-environment` | verbatim copy |
| `client.js` | `@deepseek-ai/dsh-client-ui-open-in-app` | registration id and CSS markers rewritten to this package |
| `vendor/dsh-subprocess.js` | `@deepseek-ai/dsh-subprocess` | **reimplementation** of `scrubbedParentEnv()` only (the upstream module is a Cordis service that would drag the framework in); behaviour documented in the file |

Upstream project: <https://github.com/deepseek-ai/deepseek-harness>

## Upstream license

```
MIT License

Copyright (c) 2026 DeepSeek

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
