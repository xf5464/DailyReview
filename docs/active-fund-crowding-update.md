# 公募基金行业集中度：手动更新

界面位于 A 股分组，展示主动权益公募季报前十大股票持仓按东方财富二级行业汇总的占比、环比百分点变化和 1/3/5/10 年历史百分位，默认按十年百分位降序。该口径不能解释为基金完整股票仓位或全公募持仓。

## 一、准备候选名单

从天天基金原始目录保存响应后执行：

```powershell
npm run prepare:active-fund-universe -- --input work/fundcode_search.js --output work/candidate-funds.json
```

来源为 https://fund.eastmoney.com/js/fundcode_search.js。命令不执行源站 JavaScript；仅解析 JSON 数组，排除指数、增强、债券、偏债、QDII、FOF 等类型。输出旁的 provenance 文件保存原始目录哈希和来源。

候选名单没有历史完整性保证，不能用来填充一个相同的十年覆盖率分母。须核验每个季度当时存在、属于主动权益范围并应披露持仓的产品，纳入已经清盘的产品和类型变化，核验不同收费份额属于同一产品。名称去重不能替代产品身份核验。

## 二、生产输入

基金范围文件的结构如下。示意值不能作为真实数据使用：

```json
{
  "schemaVersion": 1,
  "source": "基金类型、成立/终止日期、报告及季度净资产的可追溯来源",
  "reviewedAt": "2026-10-30",
  "historicalMembershipVerified": true,
  "quarters": {
    "2026-Q3": {
      "funds": [
        {
          "fundCode": "六位基金代码",
          "fundName": "基金全名",
          "type": "混合型-偏股",
          "productId": "已核验的唯一产品身份",
          "netAsset10kCny": 100
        }
      ]
    }
  }
}
```

`netAsset10kCny` 是该季度产品净资产（万元），不是把 A/C 份额各当一只产品重复统计。允许的类型为主动权益、股票型、普通股票型、偏股混合型、灵活配置混合型、混合型-偏股/灵活/平衡；名称含指数、增强、ETF、联接等仍剔除。

行业映射文件：

```json
{
  "schemaVersion": 1,
  "taxonomy": "eastmoney-level2",
  "taxonomyVersion": "已核验的统一二级分类版本",
  "source": "行业层级与历史归属的可追溯来源",
  "reviewedAt": "2026-10-30",
  "historicalMappingVerified": true,
  "quarters": {
    "2026-Q3": {
      "六位A股或五位港股代码": "该分类版本中的二级行业名称"
    }
  }
}
```

同一代码不同季度的归属可不同，但必须在统一可比分类版本下提供依据。不能将当前行业归属无说明地应用于十年历史；港股持仓也需要可比的映射，不可静默丢弃。源站目录混合返回多个层级，不能直接把所有板块当作二级分类。

## 三、试采集和正式更新

缺少核验输入时可以运行诊断。平面行业映射允许为空；诊断模式永远不生成生产快照：

```powershell
npm run update:active-fund-crowding -- --diagnostic --funds work/candidate-funds.json --industries work/unverified-industry-map.json --years 2025,2026 --cache work/fund-cache --diagnostics work/fund-diagnostics.json
```

正式更新必须同时提供两个核验文件：

```powershell
npm run update:active-fund-crowding -- --universe work/verified-quarterly-universe.json --industries work/verified-quarterly-industries.json --cache work/fund-cache --diagnostics work/fund-diagnostics.json
```

- 年份默认从核验范围读取；诊断模式默认包含当前年及前十年，以支持完整十年观察跨度。
- 并发默认 4，`--concurrency` 允许 1–8。
- 默认复用已保存的原始年度响应，更新当年披露或修订历史时显式加 `--refresh`。无效响应不写入成功缓存。
- 正式输出默认为 `scripts/data/active-fund-industry-crowding.json`，只包含紧凑季度行业汇总。完整核验记录保留在采集缓存的 `audits/<SHA-256>.json`；旧版汇总归档到同目录 `active-fund-crowding-history/`，诊断、原始缓存及输入保留在 work 中。
- 缺少来源和核验标记、重复产品、覆盖率不达标、最新季度失败、历史丢失等错误都会阻止覆盖已有生产快照。
- 数据发布沿用普通网站部署流程，但部署不能执行这两个手动采集命令。网页仅请求静态快照。

## 四、当前实际验证状态

2026-10-30 对 12 个候选代码查询 2016、2025、2026 三年，共发起 36 个年度查询，29 个年度返回有效持仓；取得 106 份季度披露及 1,060 条股票持仓。每份有效季度通过日期、十条排名、唯一股票与正市值校验。已测试后端收费代码返回空数据的情况。

后续已经采集 2016Q3—2026Q3 的完整全公募季度份额与净资产原始列表，共 41 季度、1,178 页、579,489 条记录。它们还需要完成主动权益类型历史、产品份额合并与历史行业映射核验，因此当前没有可发布的全市场行业集中度排名或十年百分位。持仓试采集只证明持仓接口可批量读取，不能证明全市场覆盖率。

FRED 的中国市场系列不包含中国主动权益基金逐只季度重仓和二级行业归属；保持系统设计中已记录的选源结论。基金目录、季度持仓及分类均使用相应原始来源，不使用研究报道中的汇总比例替代逐只持仓数据。


## 五、自动准备原始核验输入（仅手动调用）

```powershell
npm run prepare:fund-crowding-sources -- --quarters 2016-Q3,2026-Q3 --catalogue work/fundcode_search.js --stocks work/stock-codes.json --profile-codes work/fund-codes.json --cache work/fund-source-cache --output work/source-inputs.json
```

- `--quarters` 接受逗号分隔季度；每个季度取得全公募份额明细，默认每页 500 条，并发 4。分页总数、页号、行数、跨页唯一基金代码全部匹配才保存结果，避免漏页导致分母缩小。
- 净资产来源是天天基金规模变动明细原始接口：`https://fund.eastmoney.com/data/FundDataPortfolio_Interface.aspx`，dt=8、t=年份_季度。第六列为亿元，换算为万元；`--` 保留为空值，不能当成零资产。当前基金目录的类型仅保存在 currentType 字段，historicalTypeVerified 始终为 false。
- 二级行业目录使用东方财富行情中心 `https://quote.eastmoney.com/center/api/sidemenu_new.json`，严格筛选 type=2 且 flag=2。股票行业通过官方 F10 `https://emweb.securities.eastmoney.com/PC_HSF10/CoreConception/PageAjax?code=SZ300308` 读取 BOARD_RANK=2，并与目录代码和名称双重校验，不再使用混合层级的板块列表。
- `--stocks` 是六位境内股票代码数组；当前分类保存在 currentStockIndustries，不能自动当作历史分类。缺失、重复或名称不一致会记录错误，不猜测补值。
- `--profile-codes` 是指定的六位基金代码数组；`--profiles` 可改为读取全部当前主动权益候选份额的概况，两者互斥。概况页提取基金全称、成立日期、当前类型、前后端代码与跟踪标的，并为产品全称生成身份指纹；当前概况不是历史基金类型证明。
- 原始响应按 URL 缓存并保存 SHA-256 和采集时间。原始输入输出 productionReady=false，必须经过历史类型和行业核验才能作为正式计算输入。
- 真实采集中，华夏成长 000001/000002 与华夏大盘精选 000011/000012 分别被确认是同一产品；12 个试查代码中 9 个概况请求成功，3 个返回源站 HTTP 514，均保留错误而未填造结果。
- 411 只已取得历史持仓的境内股票中，395 只当前二级行业明确；其余 16 只缺少可确认分类。2016Q3 有 1,077 个代码在当前目录中缺失，2026Q3 有 4 个，因此不能只从当前目录推定历史完整性。

## 六、最终数据大小与发布边界

网站使用 schemaVersion 2，结构只包含：

- `industries`：去重后的行业名称列表。
- `quarters`：季度、行业占比数组、基金数量与覆盖率汇总；数组与 industries 按列对应。缺值是 null，真实零值保留 0。
- `rows`：最新季度排名、季度变化及历史百分位，不重复保存每个行业的历史数组。
- 来源、更新日期、计算版本、输入哈希及本地核验记录的摘要指纹。

网站不接收基金代码、股票代码、持仓明细或逐份报告信息。生产格式校验器会拒绝这些明细字段；本地完整核验记录不会写入 dist。普通部署只复制已保存的生产汇总，不执行采集或重算。

128 行业 × 41 季度的测试规模约 82 KB，gzip 后约 28 KB。这是合成测试用例的文件体积，用于约束格式，不是已生成的真实行业集中度结果。真实数据体积会随行业和季度数量略有变化。
