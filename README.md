# DailyReview

全球宏观温度计静态站点。页面从 StockValueEstimate 的 Electron 桌面版“总体形势”分页迁移而来，可与桌面版同时维护和发布。

## 本地验证

需要 Node.js 20 或更高版本。

~~~bash
npm test
npm run build
npm run preview
~~~

打开 http://127.0.0.1:4173 。

## 发布

推送 main 分支后，GitHub Actions 会构建并发布到 GitHub Pages。工作流也会在北京时间每周一至周六 06:15 自动刷新一次数据，并支持手动运行。

桌面版仍由 StockValueEstimate 独立构建 Electron 安装包；两个发布渠道互不影响。
