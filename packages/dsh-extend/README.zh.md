# dsh-extend

一个包装三个 DeepSeek Harness 插件 —— **桌面宠物**、**全局壁纸**、**Open In…** —— 取代已弃用的独立包 `@qwqweeo123/dsh-pet`、`@qwqweeo123/dsh-wallpaper` 和 `@qwqweeo123/dsh-open-in-app`。

[English](README.md) | 中文

## 包含什么

- **桌面宠物** —— 住在**独立透明置顶小窗**里的桌宠（Windows 上由 `desktop/pet-window.ps1` 驱动的 WPF 窗口），可以拖到屏幕任意位置，包括 Harness 窗口之外。随 agent 状态联动（运行 / 等待批准 / 出错 / 空闲），角落显示运行中会话数徽章，自带右键菜单；窗口无法启动时回退为页面内浮层。在 **设置 → 桌面宠物** 里浏览、安装 [codex-pets.net](https://codex-pets.net) 市场的桌宠；下载内容保存在 `~/.dsh/pet`。
- **全局壁纸** —— 一张图按同一套合成铺满整个界面，来自 [wallhaven.cc](https://wallhaven.cc) 市场（仅全年龄）或本地上传，附带本地下载库（`~/.dsh/wallpaper/library`）、实时模糊 / 不透明度 / 填充滑块，并适配 Windows 桌面端原生标题栏。在 **设置 → 壁纸** 里配置。
- **Open In…** —— 会话栏的分体式按钮，在已安装的编辑器、Git GUI、终端或文件管理器中打开工作目录：官方功能的自包含副本，自带原版桌面构建缺失的修复（Electron `ELECTRON_RUN_AS_NODE` 环境清理、Git 安装记录匹配、Microsoft Store 别名解析）。bundle 补丁会禁用内置实现并挂载本副本，修复随插件走，不再需要给 `app.asar` 打补丁。

三个功能共用一个 Host 入口和一个浏览器模块；每个功能保留自己的路由（`/dsh-pet/*`、`/dsh-wallpaper/*`、`/open-in-app/*`）、设置页、状态目录和服务依赖门槛，行为与独立包完全一致。

## 安装

从市场安装：**设置 → 插件市场 → 扩展套件 → 安装**，然后重启一次（Host 半包在启动时加载）。

手动安装：

```sh
dsh plugin --profile desktop add @qwqweeo123/dsh-extend
```

不要与旧的 `@qwqweeo123/dsh-pet`、`@qwqweeo123/dsh-wallpaper`、`@qwqweeo123/dsh-open-in-app` 同时安装 —— 功能完全相同，路由会冲突。请先移除旧包；已有的桌宠（`~/.dsh/pet`）和壁纸（`~/.dsh/wallpaper`）数据会原样保留并被继续使用。

## 目录结构

```
index.js                 Host 组合入口：挂载全部三个功能半包
pet.js                   桌面宠物 Host 半包（/dsh-pet/* 路由、桌面小窗助手）
wallpaper.js             壁纸 Host 半包（/dsh-wallpaper/* 路由、wallhaven 代理、下载库）
open-in-app …            Open In… Host 半包位于 vendor/open-in-app-host.js
vendor/                  官方 Open In… Host 代码及其依赖的框架文件
desktop/pet-window.ps1   透明置顶桌宠窗口（WPF，Windows）
client.js                浏览器半包：三个功能模块 + 组合模块
cordis.patch.yml         bundle 补丁：插入本包，禁用内置 Open In… 对
```

vendor/ 中的文件是 MIT 授权的 DSH `0.2.0-rc.2` 构建产物，详见 [THIRD-PARTY.md](THIRD-PARTY.md)。

## 兼容性

- 桌宠窗口与 Open In… 修复面向 Windows 桌面端；在纯 web 配置里桌宠以页面内浮层呈现，壁纸全平台可用。
- 需要 Harness `0.2.0-rc.2` 或更新版本。

## 许可证

MIT © 2026 MingXuanZi。vendor 内的 DeepSeek Harness 代码为 MIT © DeepSeek —— 见 [THIRD-PARTY.md](THIRD-PARTY.md)。
