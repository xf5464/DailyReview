# DailyReview 系统设计文档

## 1. 系统目标

DailyReview 是一个全球宏观与市场指标仪表盘，同一套页面同时运行于：

- GitHub Pages 网页版：公开只读发布，数据由 GitHub Actions 定时构建。
- Electron 桌面版：本机窗口加载构建后的静态站点，分组与显示设置保存在独立的桌面用户目录。

两个版本共用 `site/` 前端和 `scripts/` 数据层。GitHub Pages 访问者的配置仍只属于各自浏览器；同一台电脑上的 Electron 桌面版和 `npm run preview` 本地网页版通过本机配置文件共享设置。

## 2. 目录与组件

```text
DailyReview/
├─ site/                       # HTML、CSS、前端交互与分享图
├─ scripts/
│  ├─ macro-outlook.js         # 数据源、解析、区间处理和容错
│  ├─ build.js                 # 生成 dist/ 和 data/outlook.json
│  └─ serve.js                 # 本地网页预览服务器
├─ desktop/main.js             # Electron 主进程与本机静态服务器
├─ test/macro-outlook.test.js  # 数据解析、区间与独立失败测试
├─ .github/workflows/
│  └─ deploy-pages.yml         # GitHub Pages 构建与部署
└─ dist/                       # 构建产物，不提交 Git
```

## 3. 数据构建

`npm run build` 执行以下流程：

1. 清空并重建 `dist/`。
2. 复制 `site/` 静态资源。
3. 并行请求各指标最近十年或数据源允许的最长可用历史。
4. 单个数据源失败时保留对应错误，不阻断其他指标。
5. 至少一个指标可用才写出 `dist/data/outlook.json`。

前端不在访问时直接请求第三方金融接口，只读取同版本构建产物，避免跨域、限流和不同用户看到不一致的数据。

### 3.1 指标清单

当前共 22 个指标：

- 利率：美国 10 年期、30 年期国债收益率。
- 通胀：美国 CPI 同比、PCE 同比。
- 资产：黄金、比特币、布伦特原油、WTI 原油。
- 财政与外汇：美国联邦债务、日元兑美元。
- A 股：中证全指成交额、沪深北三市融资余额、同花顺公开公式版活跃市值。
- 美股：纳斯达克 100 市盈率、NDX、标普 500、VIX。
- 宏观压力：美债 10 年-2 年利差、高收益债信用利差、广义美元、初次申请失业金、美国金融状况指数。

### 3.2 A 股融资余额

- 图表 ID：`aShareMarginBalance`。
- 名称：A股融资余额（三市）。
- 口径：沪、深、北三市尚未偿还的融资买入金额合计。
- 字段：东方财富公开数据中心 `RPTA_WEB_MARGIN_DAILYTRADE.FIN_BALANCE`，按页合并并按日期去重。
- 单位：该数据集的 `FIN_BALANCE` 已按亿元提供，构建时直接保留。
- 更新频率：交易日更新。
- 历史范围：该公开数据集自 2012 年 9 月起有记录；页面最长显示最近十年，选择更短区间时从完整历史中截取。
- 权威性说明：东方财富页面声明数据以交易所发布为准；指标用于观察杠杆资金存量，不代表确定的涨跌信号。

### 3.3 活跃度与流动性口径

指南针 `0AMV` 属于其自有活筹指标，未发现稳定公开 API 和完整统一算法，因此本项目不将第三方近似公式标记为原版 `0AMV`。项目新增的 `aShareActiveMarketValueThs` 使用同花顺指标平台上的公开用户公式：

```text
OAMV = 上证指数成交额 + 深证综指成交额
活跃市值 = SMA(OAMV, 10, 1) / 100,000,000
SMA 当日值 = (OAMV 当日亿元值 + 9 × SMA 前值) / 10
```

成交额从搜狐证券指数日线行情取得，正式区间前额外读取 180 天作为 SMA 预热期。该图名称固定为“A股活跃市值（同花顺公式版）”，说明中明确它来自用户上传公式、并非同花顺官方统一指数或指南针原版 `0AMV`。其他公开、可复现的活跃度观察口径包括：

- A 股成交额：衡量实际交易规模，项目已提供。
- 市值换手率：交易所定义为成交金额除以市价总值。
- Amihud 非流动性指标：绝对收益率除以成交金额，数值越高代表同等成交额引发的价格冲击越大。

若未来加入代理指标，名称和说明必须明确标注计算公式及“非指南针 0AMV”。

## 4. 前端设计

前端使用原生 HTML、CSS、JavaScript 和 SVG，无运行时框架依赖。`site/app.js` 负责：

- 读取 `data/outlook.json` 并按时间范围过滤。
- 图表视图与表格视图。
- 单图详情、区间高低点、双指标双轴对比。
- 图表拖拽排序、显示/隐藏和分组管理。
- 全局曲线宽度设置。

卡片右上角的数值取当前筛选结果中日期最新的一条，并在数值下方直接显示该观察日期。顶部“更新时间”是整批静态数据的构建时间，两者含义不同；遇到周末、节假日或数据源发布滞后时，观察日期可能早于构建时间。

详情标题的问号说明仅在鼠标悬停或键盘主动聚焦时显示。打开详情弹窗时焦点放在关闭按钮，说明默认关闭。

### 4.1 本地配置

- 总体配置键：`daily-review.overall-situation-config.v2`。
- 线宽配置键：`daily-review.chart-line-width.v1`。
- 线宽范围：1–6 px，步进 0.5 px，迁移后的默认值为 1 px。

总体配置包含每行图表数、可见指标、分组、成员关系、各组独立顺序和当前分组。`DEFAULT_CONFIG` 维护“默认、美国、资源、A股”四个内置分组；A股内置分组默认包含成交额、融资余额和同花顺公式版活跃市值。所有图表永久属于“默认”组；新增指标和新增内置分组会自动迁移到旧配置，按分组名称去重，避免同名分组重复。总体配置与显示配置均支持 JSON 导入、导出和恢复默认。

配置始终写入当前运行环境的 `localStorage`。在桌面版和 `127.0.0.1` 本地预览中，页面还会通过同源 `/api/local-config` 接口同步到 `~/.daily-review/settings.json`；任一端修改分组、顺序、可见性或线宽后，另一端下次打开即可读取同一份配置。该文件也避免 Electron 随机本机端口变化导致配置看似丢失。

GitHub Pages 是远程纯静态站点，浏览器安全模型不允许它直接读取电脑上的该文件，因此线上网页仍使用其自身的 `localStorage`。如需跨设备或让线上网页使用同一配置，继续使用页面的 JSON 导入/导出功能。

## 5. Electron 桌面版

`desktop/main.js` 在 `127.0.0.1` 的随机端口启动本机 HTTP 服务，再由沙箱化 `BrowserWindow` 加载。除 `dist/` 静态文件外，只额外提供受大小限制的同源本机配置读写接口。使用 HTTP 而不是 `file://`，确保 JSON `fetch` 行为与网页版一致。

安全设置：

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- 单实例运行
- 外部链接只允许 HTTP/HTTPS，并交给系统浏览器
- 路径解析阻止访问 `dist/` 之外的文件

启动与打包：

```powershell
npm run desktop       # 获取最新数据后启动
npm run desktop:open  # 使用已有 dist/ 直接启动
npm run desktop:dist  # 生成 Windows NSIS 安装程序
```

## 6. 发布与运行

### 6.1 GitHub Pages

`.github/workflows/deploy-pages.yml` 在以下条件执行：

- 推送到 `main`。
- 北京时间每周一至周六 06:15 定时刷新。
- GitHub Actions 页面手动运行。

工作流依次执行测试、构建、上传 Pages artifact 和部署。线上地址为 `https://xf5464.github.io/DailyReview/`。

### 6.2 本地网页

```powershell
npm run build
npm run preview
```

访问 `http://127.0.0.1:4173/`。

## 7. 测试与变更约定

`npm test` 覆盖 CSV/JSON 解析、同比换算、时间范围、选择性请求和单源失败隔离。新增或修改指标时必须同步：

1. 更新 `scripts/macro-outlook.js` 元数据、URL、解析器和加载器。
2. 更新 `site/app.js` 标题、类别、说明、颜色和默认配置。
3. 增加解析及完整查询测试。
4. 更新本设计文档中的指标与口径。
5. 运行 `npm test` 和 `npm run build`，确认所有可用数据源成功生成。
