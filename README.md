# DailyReview

全球宏观温度计，同时支持 Electron 桌面版和 GitHub Pages 网页版。两个版本共用页面与构建数据，各自保存浏览器端分组配置。

完整架构、数据口径和变更约定见 [`docs/system-design.md`](docs/system-design.md)。

## 桌面版

首次使用先安装依赖，然后启动：

~~~powershell
npm install
npm run desktop
~~~

`npm run desktop` 会先获取最新数据，再打开 Electron 窗口。若已经构建过数据，可用 `npm run desktop:open` 直接打开。

生成 Windows 安装程序：

~~~powershell
npm run desktop:dist
~~~

安装程序输出到 `release/`。

## 本地验证

需要 Node.js 20 或更高版本。

~~~bash
npm test
npm run build
npm run preview
~~~

打开 http://127.0.0.1:4173 。

## iPhone 安装与离线使用

1. 在 iPhone Safari 中打开 GitHub Pages 网页。
2. 点击“分享 → 添加到主屏幕”，并选择作为 Web App 打开。
3. 首次联网进入后点击页头“离线数据 → 下载全部离线数据”。

首次下载会保存全部指标；以后点击“检查并增量更新”时，只下载新增或发生修订的年度数据分块。更新失败不会删除上次成功缓存，分组、预测阈值等个人配置也不会被覆盖。

## 发布

推送 main 分支后，GitHub Actions 会构建并发布到 GitHub Pages。工作流也会在北京时间每周一至周六 06:15 自动刷新一次数据，并支持手动运行。

推送只会自动更新 GitHub Pages。桌面安装包需要在本地运行 `npm run desktop:dist` 生成。
