# dsh-pet 桌宠

给你的 DeepSeek Harness 加一只桌宠：它住在**独立的透明置顶小窗**里（不是页面浮层），可以拖到屏幕任何位置，包括 Harness 窗口之外，并随 agent 状态变化。

[English](README.md) | 中文

## 功能

- **独立窗口，不是浮层。** Windows 上用 PowerShell/WPF 开一个无边框窗口（`desktop/pet-window.ps1`），因此能浮在其它应用之上、也能拖出 Harness 窗口；窗口拉不起来时自动退回页内浮层。
- **随 agent 状态联动。** 运行中 / 等待批准 / 出错 / 空闲各有动画。
- **运行会话角标。** 右上角显示当前运行中的会话数（为 0 时自动隐藏）。
- **右键菜单。** 显示/隐藏、缩放、管理宠物、直接关掉小窗，都不用回 Harness 界面。
- **桌宠市场。** 在 **设置 → 桌宠** 里浏览安装 [codex-pets.net](https://codex-pets.net) 的素材；下载的素材存在 `~/.dsh/pet`，不随本包发布。

## 安装

市场里：**设置 → 插件市场 → 桌宠 → 安装**。

手动：

```sh
dsh plugin --profile desktop add dsh-pet
```

然后重启一次 Harness（小窗由插件的 Host 半边拉起）。

## 配置

**设置 → 桌宠**：当前宠物、缩放、显示开关、市场。小窗右键菜单写的是同一份配置，两边始终同步。

## 兼容性

- 目标平台是桌面端（Windows）：置顶小窗是个 PowerShell/WPF 进程。
- 纯 Web profile 下插件照常加载，桌宠以页内浮层呈现。
- 需要 Harness `0.2.0-rc.2` 或更新。

## 许可

MIT © 2026 MingXuanZi
