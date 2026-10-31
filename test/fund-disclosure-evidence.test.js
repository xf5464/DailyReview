const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {selectEffectiveDocument,classifyContractText,quarterEnd}=require('../scripts/fund-contract-evidence');
const {classifyReportTitle,reportIdentity,parseReportList,selectQuarterReports}=require('../scripts/fund-report-evidence');
const {parseCompleteReportPdf}=require('../scripts/fund-report-pdf-evidence');
const {buildPublishedUniverse}=require('../scripts/fund-published-universe');
const {reconcileFundUniverse}=require('../scripts/reconcile-fund-report-universe');
const {parseEM2016Industry,buildFixedIndustryInputs}=require('../scripts/fund-fixed-industry-taxonomy');
const name='测试成长混合型证券投资基金',quarter='2026-Q3';
const classify=(text,pages=[])=>classifyContractText({pages:[{page:1,text:name+'\n'+text},...pages]},{productName:name,quarter});
const sha=t=>crypto.createHash('sha256').update(t).digest('hex');
test('dated legal document selection rejects future documents, unrelated products and draft changes',()=>{
 const row=(id,title,date)=>({id,title,publishedAt:date});
 const rows=[row('future',name+'产品资料概要','2026-10-01'),row('valid',name+'基金合同','2026-09-01'),row('draft',name+'基金合同草案','2026-09-25'),row('wrong','另一基金产品资料概要','2026-09-26')];
 assert.equal(selectEffectiveDocument(rows,{productName:name,quarter}).id,'valid');
 assert.equal(quarterEnd('2024-Q1'),'2024-03-31');
 assert.equal(selectEffectiveDocument(rows,{productName:name,quarter:'2026-Q2'}),null);
});
test('official contract stock-allocation wording variants preserve the same whole-fund constraint',()=>{
 for(const text of ['股票（含存托凭证）资产占基金资产的比例为60%-95%','股票及存托凭证资产占基金资产的比例为60%-95%','股票资产及存托凭证的投资比例占基金资产的60%-95%','股票、存托凭证的比例为基金资产的60%-95%','股票资产占基金资产的60%－95%','股票类资产投资比例为60-95%','股票投资占基金资产比例为60%-95%','股票投资比例为基金总资产的60％～95％','股票资产配置比例为60%-95%']) {
  assert.equal(classify(text).status,'active',text);
 }
 assert.equal(classify('股票投资占基金资产的比例为0-30%').status,'excluded');
 assert.equal(classify('股票资产占基金资产的比例为0%-95%').status,'active');
});
test('page numbers do not corrupt allocation percentages spanning pages',()=>{
 const result=classify('股票资产占基金资产的比例为',[{page:2,text:' 2 / 5 \n60%-95%（其中港股通标的股票不超过50%）'}]);
 assert.equal(result.status,'active');assert.equal(result.stockAllocation.lower,60);
});
test('theme, Hong Kong, non-cash and investee-fund ratios cannot establish a whole-fund allocation',()=>{
 for(const text of ['港股通标的股票投资比例为0%-50%','科技主题股票投资比例不低于80%','股票占非现金基金资产的比例不低于80%','基金合同约定股票资产占基金资产的比例不低于60%的混合型基金'])assert.equal(classify(text).status,'unresolved',text);
});
test('conflicting legal constraints stay unresolved and explicit risk comparisons do not set product type',()=>{
 assert.equal(classify('股票资产占基金资产的比例为60%-95%。股票资产占基金资产的比例为0%-30%').status,'unresolved');
 assert.equal(classify('本基金预期风险低于股票型基金，高于债券型基金。').status,'unresolved');
 assert.equal(classify('本基金为偏债混合型基金。股票资产占基金资产的比例为0%-30%').status,'excluded');
 assert.throws(()=>classifyContractText({pages:[{page:1,text:'另一基金 股票资产占基金资产的比例为60%-95%'}]},{productName:name,quarter}),/identify/);
});
test('report identity and classification come from dated full legal titles',()=>{
 assert.equal(reportIdentity(name+'2016年第3季度报告').quarter,'2016-Q3');
 for(const product of ['测试指数增强混合型证券投资基金','测试基础设施证券投资基金','测试商业不动产证券投资基金','测试集合资产管理计划'])assert.equal(classifyReportTitle(product+'2026年第3季度报告').status,'excluded');
 assert.equal(classifyReportTitle(name+'2026年第3季度报告').status,'unresolved');
 assert.equal(classifyReportTitle('测试灵活配置混合型证券投资基金2026年第3季度报告').status,'active');
});
test('announcement page size is checked against actual server pagination',()=>{
 const data={ErrCode:0,PageIndex:1,PageSize:100,TotalCount:1,Data:[{FUNDCODE:'000001',ID:'AN20261001001',TITLE:name+'2026年第3季度报告',PUBLISHDATE:'2026-10-15'}]};
 assert.equal(parseReportList(data,{fundCode:'000001'}).rows.length,1);
 assert.throws(()=>parseReportList({...data,TotalCount:101},{fundCode:'000001'}),/Incomplete/);
 assert.throws(()=>parseReportList({...data,PageSize:1000},{fundCode:'000001'}),/Incomplete/);
 const row={id:'AN1',title:name+'2026年第3季度报告',publishedAt:'2026-09-29',classification:classifyReportTitle(name+'2026年第3季度报告')};
 assert.throws(()=>selectQuarterReports([row]),/precedes/);
});
test('complete report layout sums A/C NAV in CNY and never adds adjacent financial rows',()=>{
 const request={fundCode:'000001',fundCodes:['000001','000002'],quarter,id:'AN20261001001',title:name+'2026年第3季度报告',publishedAt:'2026-10-15'};
 const text=request.title+'\n基金产品概况 基金主代码 000001\n单位：人民币元\n期末基金资产净值\n1,000,000.00 2,000,000.00\n期末基金份额净值\n1.1111 2.2222';
 const result=parseCompleteReportPdf({pages:[{page:1,text}],pdfSha256:'a'.repeat(64)},request);
 assert.equal(result.navTotal10kCny,300);assert.equal(result.mainFundCode,'000001');
 assert.equal(parseCompleteReportPdf({pages:[{page:1,text:text.replace('人民币元','人民币万元')}],pdfSha256:'a'.repeat(64)},request).navTotal10kCny,null);
});
function report(code,product=name){return {fundCode:code,id:'AN20261001001',title:product+'2026年第3季度报告',publishedAt:'2026-10-15',classification:classifyReportTitle(product+'2026年第3季度报告')};}
function inputs(){
 const activeName='测试灵活配置混合型证券投资基金';
 const funds=[{fundCode:'000001',fundName:'现名不能分类',netAsset10kCny:10000},{fundCode:'000002',fundName:'现名不能分类C',netAsset10kCny:20000},{fundCode:'000003',fundName:'未知混合',netAsset10kCny:100}];
 const census={schemaVersion:1,quarters:[{quarter,recordCount:funds.length,funds}]};
 const archive={schemaVersion:1,quarter,cutoffReached:true,preparedAt:'2026-10-31',sources:[{url:'https://api.fund.eastmoney.com/f10/JJGG?fundcode=',hash:'a'.repeat(64)}],histories:funds.map(f=>({fundCode:f.fundCode,reports:[report(f.fundCode,f.fundCode==='000003'?name:activeName)]}))};
 return {census,archive};
}
test('published cohort merges legal-product share classes and counts all uncertain NAV conservatively',()=>{
 const {census,archive}=inputs();const out=buildPublishedUniverse(census,[archive]);const q=out.universe.quarters[quarter];
 assert.equal(q.funds.length,1);assert.equal(q.funds[0].netAsset10kCny,30000);assert.equal(q.funds[0].netAssetLowerBound10kCny,29900);assert.equal(q.funds[0].netAssetUpperBound10kCny,30100);
 assert.equal(q.unclassifiedFunds.length,1);assert.equal(q.unclassifiedFunds[0].netAssetUpperBound10kCny,150);
 assert.equal(out.summaries[0].quantityCoverageLowerBound,0.5);assert.equal(out.productionReady,false);
 assert.throws(()=>buildPublishedUniverse(census,[{...archive,cutoffReached:false}]),/Unverified/);
});
test('current fund type never resolves a missing historical legal classification',()=>{
 const {census,archive}=inputs();census.quarters[0].funds[2].currentType='股票型';
 const out=reconcileFundUniverse(census,[archive]);assert.equal(out.summaries[0].unresolved.length,1);
});
test('contract evidence cannot override dated scope exclusions or use future publication dates',()=>{
 const {census,archive}=inputs();const excluded='测试基础设施证券投资基金';archive.histories[2].reports=[report('000003',excluded)];
 const quote='股票资产占基金资产的比例为60%-95%';
 const proof={fundCode:'000003',quarter,productName:excluded,status:'active',type:'主动权益',rule:'Contract ratio',quote,quoteSha256:sha(quote),source:{id:'AN20260901001',url:'https://pdf.dfcfw.com/pdf/H2_AN20260901001_1.pdf',hash:'b'.repeat(64),publishedAt:'2026-09-01'}};
 const set={schemaVersion:1,classifierVersion:'contract-equity-scope-v1',evidence:[proof]};
 assert.equal(reconcileFundUniverse(census,[archive,set]).eligibilityLedger.find(r=>r.fundCode==='000003').status,'excluded');
 proof.source.publishedAt='2026-10-01';assert.throws(()=>reconcileFundUniverse(census,[archive,set]),/future-dated/);
});
test('official fixed taxonomy reads the direct second segment including retired stocks',()=>{
 const source={url:'https://emweb.securities.eastmoney.com/PC_HSF10/CompanySurvey/PageAjax?code=SZ000671',hash:'c'.repeat(64)};
 const parsed=parseEM2016Industry({jbzl:[{SECURITY_CODE:'000671',EM2016:'房地产-房地产开发-房地产开发'}]},'000671');
 const out=buildFixedIndustryInputs([{...parsed,source}],{asOf:'2026-10-31'});
 assert.equal(out.fixedMap['000671'],'房地产开发');assert.equal(out.historicalMappingVerified,false);assert.equal(out.classificationBasis,'fixed-taxonomy-restatement');
 assert.throws(()=>buildFixedIndustryInputs([{...parsed,source:{...source,url:source.url.replace('000671','000001')}}],{asOf:'2026-10-31'}),/Unverified/);
 assert.throws(()=>parseEM2016Industry({jbzl:[{SECURITY_CODE:'000672',EM2016:'房地产-房地产开发-房地产开发'}]},'000671'),/identify/);
});

test('combined equity/convertible ceilings exclude bond-oriented products without treating their floor as a stock floor',()=>{
 for(const text of ['权益类资产、可转换债券和可交换债券合计占基金资产的比例为10%-30%','权益类资产及可转换债券、可交换债券的投资合计占基金资产的比例为10%-30%','权益类资产、可转换债券、可分离交易可转债、可交换债的比例占基金资产的10%-30%','股票、权证等权益类金融工具占基金资产的比例不超过30%'])assert.equal(classify(text).status,'excluded',text);
 assert.equal(classify('权益类资产、可转换债券和可交换债券合计占基金资产的比例为60%-95%').status,'unresolved');
});

test('a share rounded to zero does not invalidate a positive-NAV legal product',()=>{
 const {census,archive}=inputs();census.quarters[0].funds[1].netAsset10kCny=0;
 const out=buildPublishedUniverse(census,[archive]);const f=out.universe.quarters[quarter].funds[0];
 assert.equal(f.netAsset10kCny,10000);assert.equal(f.memberFundCodes.length,2);assert.equal(f.netAssetLowerBound10kCny,9900);assert.equal(f.netAssetUpperBound10kCny,10100);
});
