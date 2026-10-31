# 公募基金 A 股行业集中度：手动更新

网站只读取紧凑季度快照。基金、股票及原始披露明细保留在本地采集缓存，普通构建和部署不会采集或计算。

## 统计口径

- 样本是各季度公开发布定期报告的产品，不宣称覆盖所有已登记公募资产。历史窗口逐日完整采集季末后 45 个自然日，最新季度截至实际采集日。包括已经清盘、改名及转型产品在当期实际发布的报告，不能拿今天存续产品名单回填历史。
- 使用报告中的当期法律全名，并以季末之前发布的合同、招募说明书或产品资料概要核验主动权益范围。指数、增强、ETF、联接、QDII、FOF、货币、债券、偏债、保本、黄金和基础设施等产品剔除。明确股票型、偏股、灵活配置及平衡混合类型可以纳入；普通混合须有全基金股票配置约束证明。分类属于可复核的分析口径，不伪称源站提供了历史细分类别。
- 普通混合明确股票下限至少 60%，或完整区间下限不超过 50%、上限至少 80%，可确认其主动权益配置能力。明确股票上限不超过 40% 则剔除。权益资产与可转债等合计上限不超过 40%，也能证明股票上限不超过 40%；合计下限不能当作股票下限。其余无法确认的产品保留在覆盖率分母，禁止直接删除。
- 同一法律产品的收费份额合并，基金净资产相加，持仓只取一次。已用两组真实 A/C 份额核对源站持仓完全一致。规模列表每份额以 0.01 亿元取整，故保留每份额正负 50 万元的上下界；显示为零的小份额不会误判为缺失。完整季报可以提供人民币元精确净资产，统一换算为万元。
- 使用各基金季报前十大股票；行业表只统计其中的 A 股。港股及其他非 A 股重仓的市值占比单独展示，不悄悄混入行业分母。接口不足十只或字段不完整时，转读完整原始季报；不足十只的股票表必须与资产组合中的全部股票市值吻合，零持股须同时有期末未持有股票的明确说明和零股票资产。否则仍占覆盖率分母。接口中的 A 股归属使用交易市场链接；完整季报使用已核验境内基金股票表及证券代码，海外代码不能仅凭六位格式算作 A 股。市场不明确的可能 A 股记录按未映射处理。
- 统一使用东方财富公司档案直接提供的三层路径 EM2016 的第二段。当前按统一分类回溯重述，**不是股票当年的实际行业归属**。行业映射包含退市股票，不通过其他股票或新旧分类名称猜测归属。
- 基金数量覆盖率、净资产覆盖率下界、A 股重仓市值映射率均须至少 90%。数量和净资产分母包含所有尚不能排除的产品及其保守上界。未映射 A 股市值保留在行业占比分母。
- 环比只比较相邻季度。1/3/5/10 年百分位需要连续 5/13/21/41 个季度，不能跨缺季或分类版本。恒为零的行业不显示有误导性的高百分位。

## 数据准备

FRED 不提供基金产品及持仓层面的中国公募行业集中度输入，因此使用天天基金与东方财富原始披露。具体依据见系统设计文档。所有命令均须手动调用。

1. 保存基金目录后，采集完整季度规模列表；目录仅作候选参考，当前类型不证明历史类型。

~~~powershell
npm run prepare:fund-crowding-sources -- --quarters 2016-Q3,2026-Q3 --catalogue work/fundcode_search.js --output work/census.json --cache work/source-cache
~~~

2. 采集定期报告公告。近期可使用全局 JSON 归档；较早季度使用完整逐日 HTML 归档，校验日期、每页行数、总页数、当前页及跨页重复。旧站翻页必须包含其提供的 allpages 参数。

~~~powershell
npm run prepare:fund-report-evidence -- --global-quarter 2026-Q3 --output work/2026-Q3-reports.json --cache work/report-cache
npm run prepare:fund-quarter-archive -- --quarters 2016-Q3 --output-directory work/archives --cache work/archive-cache
~~~

3. 对账报告与当季规模列表。输出会同时生成 .universe.json、.contract-requests.json 和 .needs-reports.json；缺少证明时 productionReady 为 false。需要时补读当期合同及完整季度报告 PDF，再对账一次。

~~~powershell
npm run prepare:published-fund-universe -- --census work/census.json --archives work/2026-Q3-reports.json --output work/reconciliation.json
npm run prepare:fund-contract-evidence -- --requests work/reconciliation.json.contract-requests.json --output work/contracts.json --cache work/disclosures --python python --fallback --concurrency 4
npm run prepare:fund-report-pdfs -- --requests work/reconciliation.json.needs-reports.json --output work/report-pdfs.json --cache work/quarter-pdfs --python python
npm run prepare:published-fund-universe -- --census work/census.json --archives work/2026-Q3-reports.json --evidence work/contracts.json,work/report-pdfs.json --output work/reconciliation.json
~~~

Python 需要 pypdf。PDF 的原始字节、来源 URL、日期及 SHA-256 随本地缓存保留；提取结果校验原文件哈希并原子写入。没有足够文字的扫描件、错名文件及损坏文件保持未确认。简版资料缺少比例时，--fallback 读取有效完整合同或招募说明书。--cache-only 可以禁止 PDF 联网下载，复核已有缓存。

4. 从直接公司档案建立固定行业表。股票代码 JSON 为去重的六位 A 股代码数组，须包含持仓中已退市代码。

~~~powershell
npm run prepare:fund-fixed-industries -- --stocks work/held-a-stock-codes.json --output work/industries.json --cache work/company-cache
~~~

旧的 schemaVersion 1 人工核验输入仍可使用，但不得随意设置 historicalMembershipVerified 或 historicalMappingVerified。新的公开报告样本与固定分类文件均使用 schemaVersion 2，明确区分样本范围及分类重述。

## 持仓采集与发布

~~~powershell
npm run update:active-fund-crowding -- --universe work/reconciliation.json.universe.json --industries work/industries.json --cache work/fund-cache --diagnostics work/diagnostics.json
~~~

- 年度原始响应按稳定 URL 缓存，一次响应包含该年已披露的季度。默认限制请求间隔并对临时错误有限重试，--refresh 显式重新请求。失败响应不写入成功缓存。
- 默认生产文件是 scripts/data/active-fund-industry-crowding.json：行业名称只存一次，季度只存占比数组及覆盖汇总，最新排名不重复保存历史。完整核验记录保留在缓存 audits/ 下，并以 SHA-256 与公开文件关联。
- 不达标、最新季度失败、日期或版本冲突都会阻止覆盖。更新已有文件须保留所有已发布季度；旧快照归档，禁止因补齐失败删掉历史。
- 普通构建仅验证并复制静态快照。网页提供行业占比、季度变化及连续历史百分位，详情展开说明统计范围和覆盖率。

## 实测状态

截至 2026-10-31，已取得 41 个季度的完整规模原始列表（1,178 页、579,489 条份额季度记录），5,704 只 A 股的直接 EM2016 路径（包含退市股票），以及最新季度 25,905 个份额代码的报告公告。2016Q3 的逐日窗口已完整采齐 276 页、4,352 个份额代码。更早报告、合同及持仓仍在继续核验，不能将采集完成度当成最终统计覆盖率。

已生成并验证 2016Q3、2026Q2、2026Q3 三个真实季度，103 个行业的公开文件为 19,716 字节，不含基金或股票明细。最新季度有 4,600 只完整披露产品，数量覆盖下界 93.29%、净资产覆盖下界 95.41%、A 股重仓行业映射率 100%。2016Q3 有 1,286 只有效披露产品，数量覆盖率 90.82%、净资产覆盖率下界 90.04%、行业映射率 100%。相邻季度环比已可计算；历史百分位仍为空，十年目标尚余 38 个季度。不把原始规模或公告采齐等同于行业统计完成。界面提供报告季度选择，历史季度可以直接从同一紧凑矩阵读取。

## 可恢复的批量回补

`node scripts/backfill-active-fund-crowding.js --census work/census.json --archives work/historical-report-archives --industries work/fixed-industries.json --state work/backfill --cache work/holdings-cache --disclosures work/disclosure-cache --report-cache work/report-pdfs --output scripts/data/active-fund-industry-crowding.json`

这是手动准备任务，不由构建或部署调用。可用 `--seed-universe` 保留已验证季度，`--reuse-contracts` 传入已核验合同证据，`--quarters` 限定本轮季度。先快速复核本地缓存，再按未定净资产上界分批查找当时有效披露；缺失持仓转读完整季报。每季度独立保存分类证据、覆盖率诊断和检查点，全部门槛通过后才合并公开矩阵，环比和分位数按实际连续季度重新计算。进程锁防止重复运行，崩溃后须核对进程已退出再清理锁并重跑。原始文件及检查点留在本地，失败不会删除已有季度结果。
