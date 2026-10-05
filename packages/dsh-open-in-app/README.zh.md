# dsh-open-in-app 在应用中打开

会话头部的 **「在应用中打开」** 分裂按钮：把当前工作目录在已安装的编辑器 / Git GUI / 终端 / 文件管理器里打开。

[English](README.md) | 中文

## 为什么做成插件

桌面端**本来就自带**这个功能（`@deepseek-ai/dsh-host-open-in-app` 及其浏览器半边），新装一台电脑就能看到按钮。随包发布的 host 半边真正的问题是**启动环节**：

| 坑 | 现象 | 本包的修法 |
|---|---|---|
| Host 进程本身就是 Electron 以 node 模式跑的，子进程会继承 `ELECTRON_RUN_AS_NODE=1` | VS Code / Cursor / Windsurf / Zed 被当 node 启动，在观察窗口内以退出码 1 结束 —— 点了没反应 | `index.js` 在挂载解析器前删掉这个变量（框架自带的 env 清洗会保留它） |
| Git for Windows 的注册表记录名是「Git version …」，而 catalog 按显示名前缀匹配 | 菜单里可能没有 Git Bash（默认路径安装仍有 `%ProgramFiles%\Git\git-bash.exe` 兜底） | vendor 的 host 半边带修好的记录匹配 |
| 商店版应用是 `…\Microsoft\WindowsApps\` 下的 0 字节执行别名 | Windows Terminal 能列出却打不开，或缺图标 | vendor 的 host 半边把别名解析到真实包路径 |

所以：**功能随 App 走，修复随插件走** —— 不用改 `app.asar`，App 升级也不会丢。

## 安装

市场里：**设置 → 插件市场 → 在应用中打开 → 安装**，然后重启一次（Host 半边只在启动时加载）。

手动：

```sh
dsh plugin --profile desktop add dsh-open-in-app
```

本包通过自带的 bundle 补丁替换内置那一对：停用内置的 `open-in-app` / `ui-open-in-app`（两者注册同样的路由与 slot id），再挂载自己的副本。卸载插件即自动还原。

## 包内容

```
index.js                     Host 半边：环境修复 + 挂载解析器
vendor/open-in-app-host.js   App 自带 host 半边的副本（import 本地化），含上述修复
vendor/dsh-native-command.js、vendor/dsh-launch-environment.js、vendor/dsh-subprocess.js
                             它依赖的框架代码（最后一个是 scrubbedParentEnv() 的本地等价实现，注释写明语义）
client.js                    App 自带浏览器半边的副本，注册 id 改为本包
cordis.patch.yml             bundle 补丁：停用内置那一对，插入本包
```

vendor 的是 MIT 许可的 DSH 代码 `0.2.0-rc.2` 构建产物，见 [THIRD-PARTY.md](THIRD-PARTY.md)。

## 兼容性

- Harness 桌面端 `0.2.0-rc.2`。App 升级后若 slot 名、路由前缀或 Host 服务 API 变了，需要重新提取 vendor 的两个半边（源码仓库里的 `tools/vendor.mjs`）。
- Windows / macOS / Linux 各自解析本平台条目；上面两条修复是 Windows 专属。

## 许可

MIT © 2026 MingXuanZi。vendor 的 DeepSeek Harness 代码为 MIT © DeepSeek，见 [THIRD-PARTY.md](THIRD-PARTY.md)。
