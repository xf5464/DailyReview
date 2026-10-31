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

test('native text extraction falls back to original extraction when a column layout hides a stock mandate',async()=>{
 const {classifyDisclosureDocument}=require('../scripts/fund-contract-evidence');
 const document=(text,engine)=>({document:{extractionEngine:engine,pages:[{page:1,text:name+text}]},source:{title:name+'基金合同'}});
 let classicCalls=0;
 const result=await classifyDisclosureDocument({}, {productName:name,quarter},{
  readRow:async()=>document('投资范围详见基金合同','pymupdf-text-1.26.7'),
  readClassic:async()=>{classicCalls++;return document('股票资产占基金资产的60%-95%','pypdf');}
 });
 assert.equal(result.classification.status,'active');assert.equal(result.result.document.extractionEngine,'pypdf');assert.equal(classicCalls,1);
 const direct=await classifyDisclosureDocument({}, {productName:name,quarter},{
  readRow:async()=>document('股票资产占基金资产的60%-95%','pymupdf-text-1.26.7'),
  readClassic:async()=>{throw Error('Unexpected second extraction');}
 });
 assert.equal(direct.classification.status,'active');assert.equal(direct.classification.extractionFallbackError,undefined);
});
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

test('numbered financial rows recover NAV when a wrapped label surrounds its numeric cells',()=>{
 const request={fundCode:'000001',fundCodes:['000001','000002'],quarter,id:'AN20261001001',title:name+'2026年第3季度报告',publishedAt:'2026-10-15'};
 const text=request.title+'\n基金产品概况 基金主代码000001\n3.1主要财务指标 单位：人民币元\n4.期末基金资产\n48,635,033.24 62,786.08 -\n净值\n5.期末基金份额\n1.7509 1.7400 -\n净值';
 const result=parseCompleteReportPdf({pages:[{page:1,text}],pdfSha256:'a'.repeat(64)},request);
 assert.equal(result.navTotal10kCny,(48635033.24+62786.08)/10000);
 assert.deepEqual(result.navClassValuesCny,[48635033.24,62786.08]);
});

test('dated report excludes insured capital-protection mandate without inferring from a generic loss warning',()=>{
 const request={fundCode:'000001',quarter,id:'AN20261001001',title:name+'2026年第3季度报告',publishedAt:'2026-10-15'};
 const parse=body=>parseCompleteReportPdf({pages:[{page:1,text:request.title+'\n基金产品概况 基金主代码 000001\n'+body}],pdfSha256:'a'.repeat(64)},request).classification;
 assert.equal(parse('本基金为保本型基金').status,'excluded');
 assert.equal(parse('本基金在三年避险周期到期时控制本金损失。恒定比例投资组合保险机制。基金保证人 中投信用担保有限公司').status,'excluded');
 assert.equal(parse('投资有本金损失风险；基金管理人不保证基金一定盈利。').status,'unresolved');
 assert.equal(parse('基金简称 测试油气（QDII-FOF-LOF） 基金主代码000001').status,'excluded');
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

test('complete official text is accepted as dated contract proof with its own provenance scheme',async()=>{
 const {collectDisclosureText}=require('../scripts/fund-disclosure-text');
 const {census,archive}=inputs(),quote='股票资产占基金资产的比例为60%-95%';
 const row={id:'AN20260901001',title:name+'基金合同',publishedAt:'2026-09-01'};
 const result=await collectDisclosureText(row,async(url,parse)=>{
  const body=JSON.stringify({success:1,data:{art_code:row.id,notice_title:row.title,notice_date:row.publishedAt,page_size:1,notice_content:name+quote}});
  return {value:parse(body),source:{url,hash:sha(body),fetchedAt:'2026-10-31T00:00:00Z'}};
 });
 const proof={fundCode:'000003',quarter,productName:name,status:'active',type:'主动权益',rule:'Contract ratio',quote,quoteSha256:sha(quote),source:result.source};
 const set={schemaVersion:1,classifierVersion:'contract-equity-scope-v1',evidence:[proof]};
 assert.equal(reconcileFundUniverse(census,[archive,set]).eligibilityLedger.find(r=>r.fundCode==='000003').status,'active');
 proof.source.chunks[0].hash='tampered';
 assert.throws(()=>reconcileFundUniverse(census,[archive,set]),/Unverified|Incomplete/);
});
test('official fixed taxonomy reads the direct second segment including retired stocks',()=>{
 const source={url:'https://emweb.securities.eastmoney.com/PC_HSF10/CompanySurvey/PageAjax?code=SZ000671',hash:'c'.repeat(64)};
 const parsed=parseEM2016Industry({jbzl:[{SECURITY_CODE:'000671',EM2016:'房地产-房地产开发-房地产开发'}]},'000671');
 const out=buildFixedIndustryInputs([{...parsed,source}],{asOf:'2026-10-31'});
 assert.equal(out.fixedMap['000671'],'房地产开发');assert.equal(out.historicalMappingVerified,false);assert.equal(out.classificationBasis,'fixed-taxonomy-restatement');
 assert.throws(()=>buildFixedIndustryInputs([{...parsed,source:{...source,url:source.url.replace('000671','000001')}}],{asOf:'2026-10-31'}),/Unverified/);
 assert.throws(()=>parseEM2016Industry({jbzl:[{SECURITY_CODE:'000672',EM2016:'房地产-房地产开发-房地产开发'}]},'000671'),/identify/);
});

test('direct company identities require matching exchange, A-share type, and official security names',()=>{
 const source={url:'https://emweb.securities.eastmoney.com/PC_HSF10/CompanySurvey/PageAjax?code=SZ000004',hash:'c'.repeat(64)};
 const row={SECURITY_CODE:'000004',SECUCODE:'000004.SZ',SECURITY_TYPE:'深交所风险警示板A股',TRADE_MARKET:'深圳证券交易所',SECURITY_NAME_ABBR:'国华退',FORMERNAME:'国农科技→国华网安',EM2016:'信息技术-计算机软件-其他软件服务'};
 const parsed=parseEM2016Industry({jbzl:[row]},'000004');
 const fixed=buildFixedIndustryInputs([{...parsed,source}],{asOf:'2026-10-31'});
 assert.deepEqual(fixed.securityIdentities['000004'].names,['国华退','国农科技','国华网安']);
 assert.equal(parseEM2016Industry({jbzl:[{...row,SECURITY_TYPE:'境外股票'}]},'000004').securityIdentity,undefined);
 assert.throws(()=>buildFixedIndustryInputs([{...parsed,source:{...source,url:source.url.replace('SZ','SH')}}],{asOf:'2026-10-31'}),/identity/);
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

test('reusing a legal document never reuses future membership or a document published after the target quarter',()=>{
 const {reuseDatedContracts}=require('../scripts/fund-published-universe');
 const archive={quarter:'2026-Q2',histories:[{fundCode:'000001',reports:[{title:name+'2026年第2季度报告'}]}]};
 const base={productName:name,quarter:'2026-Q3',fundCode:'999999',status:'active',source:{publishedAt:'2026-06-01'}};
 const set={schemaVersion:1,classifierVersion:'contract-equity-scope-v1',evidence:[base,{...base,source:{publishedAt:'2026-08-01'}},{...base,productName:'新改名基金'},{...base,quarter:'2026-Q1',source:{publishedAt:'2026-03-01'}}]};
 const out=reuseDatedContracts(set,archive);assert.equal(out.evidence.length,1);assert.equal(out.evidence[0].quarter,'2026-Q2');assert.equal(out.evidence[0].fundCode,'000001');assert.equal(out.evidence[0].reusedFromQuarter,'2026-Q3');
});

test('overseas-market titles require legal scope proof and approved overseas-quota clauses identify excluded QDII funds',()=>{
 assert.equal(classifyReportTitle('测试全球精选股票型证券投资基金2026年第3季度报告').status,'unresolved');
 const out=classify('基金类型混合型。',[{page:39,text:'本基金的资产规模达到中国证监会、外管局核准的境外证券投资额度。股票占基金资产的比例不低于60%。'}]);
 assert.equal(out.status,'excluded');assert.equal(out.page,39);
 assert.equal(classify('本基金是股票型基金。').status,'active');
});

test('legacy allocation lists and reverse stock mandates identify whole-fund allocation without using theme ratios',()=>{
 for(const text of ['四类资产配置的比例范围：股票60-95%，债券0-35%','本基金投资组合的资产配置范围为：股票资产60%～95%，债券0～40%','股票投资比例浮动范围：60%-95%','本基金将资产的60%-95%投资于股票','本基金将60%以上的资产投资于股票市场'])assert.equal(classify(text).status,'active',text);
 assert.equal(classify('本基金将80%的股票资产投资于科技主题股票').status,'unresolved');
});
test('manager biographies about other products do not establish the target fund type or allocation',()=>{
 const result=classify('第三部分 基金管理人\n本基金为债券型基金。\n第四部分 基金托管人\n本基金为货币市场基金。\n第五部分 基金的投资\n股票资产占基金资产的比例为60%-95%。');
 assert.equal(result.status,'active');
});
test('old own-product money-market and passive-index mandate statements exclude products with ambiguous names',()=>{
 for(const text of ['本货币市场基金债券正回购的资金余额未超过20%。','本基金可投资的大类资产主要为短期金融市场工具','本基金采取指数化投资方式','本基金采用完全复制法进行投资'])assert.equal(classify(text).status,'excluded',text);
});

test('a former protected-product name does not override the transformed fund current legal type',()=>{
 const title='测试灵活配置混合型证券投资基金(原测试保本混合型证券投资基金)2026年第3季度报告';
 assert.equal(classifyReportTitle(title).status,'active');
 const {activeFund}=require('../scripts/collect-active-fund-crowding');
 assert.equal(activeFund({fundCode:'000001',fundName:reportIdentity(title).productName,type:'灵活配置混合型'}),true);
 assert.equal(classifyReportTitle('测试保本混合型证券投资基金2016年第3季度报告').status,'excluded');
});
test('fund-of-funds wording does not require a duplicated final fund noun',()=>{
 assert.equal(classify('本基金属基金中基金。').status,'excluded');
});

test('the phrase investment ratios as follows is not mistaken for a hypothetical example',()=>{
 assert.equal(classify('本基金的具体投资比例如下：股票投资比例浮动范围：60%-95%；其他资产5%-40%。').status,'active');
 assert.equal(classify('例如，股票资产占基金资产的比例为60%-95%。').status,'unresolved');
});

test('legacy configuration and baseline bands preserve whole-fund allocation requirements',()=>{
 assert.equal(classify('本基金股票资产的配置占基金资产的30%-95%，债券资产占0%-65%。').status,'active');
 assert.equal(classify('股票资产的基准比例为基金资产净值的90％，浮动范围为85－95％。').status,'active');
 assert.equal(classify('对权益类资产的投资不高于基金资产净值的30%').status,'excluded');
 assert.equal(classify('股票资产30%-75%').status,'unresolved');
 assert.equal(classify('股票资产的基准比例为非现金基金资产净值的90%，浮动范围为85-95%。').status,'unresolved');
 assert.equal(classify('本基金投资于股票的比例为基金资产总值的30%-95%').status,'active');
 assert.equal(classify('本基金股票、存托凭证资产投资占基金资产的比例为60%-95%').status,'active');
 assert.equal(classify('股票的资产配置比例为基金资产的60%-95%').status,'active');
});

test('a repeated own-product QDII disclosure heading identifies old overseas funds without classifying manager biographies',()=>{
 const own=classify('测试成长（QDII）更新招募说明书摘要\n股票资产占基金资产的比例为60%-95%。');
 assert.equal(own.status,'excluded');
 const unrelated=classify('第三部分基金管理人\n测试成长（QDII）更新招募说明书摘要\n第四部分基金的投资\n股票资产占基金资产的比例为60%-95%。');
 assert.equal(unrelated.status,'active');
});
