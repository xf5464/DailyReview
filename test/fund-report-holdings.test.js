'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {parseReportHoldings,validateReportHoldings}=require('../scripts/fund-report-holdings');
const {collect,createSnapshot}=require('../scripts/collect-active-fund-crowding');
const {createPublicSnapshot}=require('../scripts/fund-crowding-snapshot');
const {sourceFetch}=require('../scripts/collect-fund-crowding-sources');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const name='示例灵活配置混合型证券投资基金';
const request={fundCode:'000001',quarter:'2016-Q3',id:'AN20161025001',title:name+'2016年第3季度报告',publishedAt:'2016-10-25'};
const source={id:request.id,title:request.title,publishedAt:request.publishedAt,url:'https://pdf.dfcfw.com/pdf/H2_'+request.id+'_1.pdf',hash:'a'.repeat(64),downloadedAt:'2026-10-31T00:00:00Z'};
function document(rows,total=100){
 const text=request.title+'\n基金产品概况 基金主代码000001\n5.1 报告期末基金资产组合情况\n其中：股票 '+(total?total.toFixed(2):'-')+' 1.00\n5.2 报告期末按行业分类的股票投资组合\n5.3 报告期末按公允价值占基金资产净值比例大小排序的前十名股票投资明细\n序号 股票代码 股票名称 数量（股） 公允价值（元） 占基金资产净值比例\n'+rows+'\n5.4 报告期末按债券品种分类的债券投资组合';
 return {pages:[{page:1,text}],pdfSha256:source.hash};
}
test('short stock table needs the complete original report and a matching whole-stock-portfolio total',()=>{
 const doc=document('1 600001 测试公司 10 100.00 1.00');
 const result=parseReportHoldings(doc,request,source);
 assert.equal(result.rows.length,1);assert.equal(result.rows[0].marketValue10kCny,0.01);
 assert.equal(parseReportHoldings(document('1 600001 测试公司 10 100.00 1.00',200),request,source),null);
 assert.equal(parseReportHoldings(document('2 600001 测试公司 10 100.00 1.00'),request,source),null);
 result.rows[0].marketValue10kCny=0.02;assert.throws(()=>validateReportHoldings(result),/Unverified/);
});
test('zero-stock holdings require an explicit quarter-end statement and zero composition amount',()=>{
 const proof=parseReportHoldings(document('本基金本报告期末未持有股票。',0),request,source);
 assert.equal(proof.rows.length,0);
 assert.equal(parseReportHoldings(document('本基金本报告期末未持有港股通股票。',0),request,source),null);
 assert.equal(parseReportHoldings(document('本基金本报告期末未持有股票。',100),request,source),null);
});
test('verified short and zero holdings enter coverage and keep PDF provenance through compact export',async()=>{
 const proof=parseReportHoldings(document('1 600001 测试公司 10 100.00 1.00'),request,source);
 const universe={schemaVersion:1,source:'Dated reports',reviewedAt:'2026-10-31',historicalMembershipVerified:true,equityScope:'mainland-A',quarters:{'2016-Q3':{funds:[{fundCode:'000001',fundName:name,type:'灵活配置混合型',productId:'p1',netAsset10kCny:100}]}}};
 const industries={schemaVersion:1,source:'Dated classification',reviewedAt:'2026-10-31',taxonomy:'eastmoney-level2',taxonomyVersion:'v1',historicalMappingVerified:true,quarters:{'2016-Q3':{'600001':'银行'}}};
 const options={universe,industries,years:[2016],fetchImpl:async()=>{throw Error('Archive interface unavailable');},reportHoldings:[proof]};
 const result=await collect(options);
 assert.equal(result.snapshots.find(q=>q.quarter==='2016-Q3').coverage,1);
 const compact=createPublicSnapshot(createSnapshot(result,{universe,industries}));
 assert.equal(compact.quarters[0].fundCount,1);assert.equal(compact.rows[0].share,100);
 const zero=parseReportHoldings(document('本基金本报告期末未持有股票。',0),request,source);
 const empty=await collect({...options,reportHoldings:[zero]});
 assert.equal(empty.snapshots.find(q=>q.quarter==='2016-Q3').fundCoverage,1);
 assert.equal(empty.snapshots.find(q=>q.quarter==='2016-Q3').totalMarketValue,0);
});
test('cache-only source misses fail immediately without attempting network or retry delays',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'fund-source-cache-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));let calls=0;
 const load=sourceFetch(directory,{cacheOnly:true,fetchImpl:async()=>{calls++;throw Error('Network must not run');}});
 await assert.rejects(load('https://fund.eastmoney.com/example',JSON.parse),/not in local cache/);assert.equal(calls,0);
});
