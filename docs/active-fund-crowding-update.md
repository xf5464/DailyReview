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
- 正式输出默认为 `scripts/data/active-fund-industry-crowding.json`。旧版归档到同目录 `active-fund-crowding-history/`，诊断、缓存及输入保留在 work 中。
- 缺少来源和核验标记、重复产品、覆盖率不达标、最新季度失败、历史丢失等错误都会阻止覆盖已有生产快照。
- 数据发布沿用普通网站部署流程，但部署不能执行这两个手动采集命令。网页仅请求静态快照。

## 四、当前实际验证状态

2026-10-30 对 12 个候选代码查询 2016、2025、2026 三年，共发起 36 个年度查询，29 个年度返回有效持仓；取得 106 份季度披露及 1,060 条股票持仓。每份有效季度通过日期、十条排名、唯一股票与正市值校验。已测试后端收费代码返回空数据的情况。

未取得并核验完整逐季度基金范围、净资产及东方财富二级行业历史映射，因此当前没有可发布的全市场行业集中度排名或十年百分位。已有的试采集只证明持仓接口可批量读取，不能证明全市场覆盖率。

FRED 的中国市场系列不包含中国主动权益基金逐只季度重仓和二级行业归属；保持系统设计中已记录的选源结论。基金目录、季度持仓及分类均使用相应原始来源，不使用研究报道中的汇总比例替代逐只持仓数据。
