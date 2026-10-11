# dsh-extend

一个包装五个 DeepSeek Harness 插件 —— **桌面宠物**、**全局壁纸**、**Open In…**、**会话标签栏**、**默认工作区套件** —— 前三个取代已弃用的独立包 `@qwqweeo123/dsh-pet`、`@qwqweeo123/dsh-wallpaper` 和 `@qwqweeo123/dsh-open-in-app`。

[English](README.md) | 中文

## 包含什么

- **桌面宠物** —— 住在**独立透明置顶小窗**里的桌宠（Windows 上由 `desktop/pet-window.ps1` 驱动的 WPF 窗口），可以拖到屏幕任意位置，包括 Harness 窗口之外。随 agent 状态联动（运行 / 等待批准 / 出错 / 空闲），角落显示运行中会话数徽章，自带右键菜单；窗口无法启动时回退为页面内浮层。在 **设置 → 桌面宠物** 里浏览、安装 [codex-pets.net](https://codex-pets.net) 市场的桌宠；下载内容保存在 `~/.dsh/pet`。
- **全局壁纸** —— 一张图按同一套合成铺满整个界面，来自 [wallhaven.cc](https://wallhaven.cc) 市场（仅全年龄）或本地上传，附带本地下载库（`~/.dsh/wallpaper/library`）、实时模糊 / 不透明度 / 填充滑块，并适配 Windows 桌面端原生标题栏。在 **设置 → 壁纸** 里配置。
- **Open In…** —— 会话栏的分体式按钮，在已安装的编辑器、Git GUI、终端或文件管理器中打开工作目录：官方功能的自包含副本，自带原版桌面构建缺失的修复（Electron `ELECTRON_RUN_AS_NODE` 环境清理、Git 安装记录匹配、Microsoft Store 别名解析）。bundle 补丁会禁用内置实现并挂载本副本，修复随插件走，不再需要给 `app.asar` 打补丁。
- **会话标签栏** —— 窗口标题栏（Web 外壳为会话栏顶部）的 codeg 风格全局会话标签条：每个可见会话一个标签（状态点、渐隐标题、悬停 ×），点击切换，中键 / 右键关闭，拖拽排序，末尾圆形按钮新建会话；关闭只隐藏标签、不归档会话。**新出现的标签统一排在最后面**——无论新建、从关闭集合恢复还是取消归档。
- **窗口状态记忆** —— 记住桌面端主窗口的几何状态：最大化标记与非最大化时的位置尺寸（Win32 `WINDOWPLACEMENT` 常驻监听，变化即原子写入 `~/.dsh/dsh-extend/window-state.json`），下次启动自动按原状态恢复；保存的位置在当前显示器布局下完全不可见时，自动收回虚拟屏幕内。仅 Windows 桌面端生效，其他平台静默跳过。
- **默认工作区套件** —— 围绕默认工作区（`文档/deepseek-harness/default-workspace`）的三条规则：**默认工作区不可删除**（侧栏行内不再渲染"…"操作按钮——重命名/删除菜单完全打不开；若菜单经任何路径弹出，其中的删除项也会被即时隐藏；底层删除守卫仍会在任何残余入口拒绝删除并给出提示）；在默认工作区里新建会话时，会话先直接落在工作区根目录（复用壳层自带的空白会话复用机制，连点"+"也只会有一个待用的会话，**不会产生任何文件夹**），直到**第一句消息真正发出**时才在默认工作区下随机创建 `ws-xxxxxxxx` 文件夹、把会话无缝迁入（视图自动切换、消息回显无缝衔接）——只有真正发过消息的会话才拥有自己的随机工作区；左侧栏分组时，所有这些随机工作区会话（以及重启后宿主为子目录自动补建的隐式工作区）都**归类在默认工作区一组**里，不会散落进"未分组"。

前三个功能共用一个 Host 入口，五个功能共用一个浏览器模块；每个 Host 功能保留自己的路由（`/dsh-pet/*`、`/dsh-wallpaper/*`、`/open-in-app/*`）、设置页、状态目录和服务依赖门槛，行为与独立包完全一致；标签栏与默认工作区套件纯浏览器侧，不注册路由。

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
client.js                浏览器半包：四个功能模块 + 组合模块
cordis.patch.yml         bundle 补丁：插入本包，禁用内置 Open In… 对
```

vendor/ 中的文件是 MIT 授权的 DSH `0.2.0-rc.2` 构建产物，详见 [THIRD-PARTY.md](THIRD-PARTY.md)。

## 兼容性

- 桌宠窗口与 Open In… 修复面向 Windows 桌面端；在纯 web 配置里桌宠以页面内浮层呈现，壁纸全平台可用。
- 需要 Harness `0.2.0-rc.2` 或更新版本。

## 许可证

MIT © 2026 MingXuanZi。vendor 内的 DeepSeek Harness 代码为 MIT © DeepSeek —— 见 [THIRD-PARTY.md](THIRD-PARTY.md)。
