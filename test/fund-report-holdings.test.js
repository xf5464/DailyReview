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

test('concatenated quantity and value need an explicit sole-stock statement and exact independent amount',()=>{
 const text='1 300437 清水源 3,525,64183,064,101.96 5.12\n本基金本报告期末仅持有上述股票。';
 const proof=parseReportHoldings(document(text,83064101.96),request,source);
 assert.equal(proof.rows[0].shares10k,352.5641);assert.ok(Math.abs(proof.rows[0].marketValue10kCny-8306.410196)<1e-8);
 assert.equal(parseReportHoldings(document(text.replace('仅持有上述股票','持有股票'),83064101.96),request,source),null);
 assert.equal(parseReportHoldings(document(text,93064101.96),request,source),null);
});
test('zero-stock holdings require an explicit quarter-end statement and zero composition amount',()=>{
 const proof=parseReportHoldings(document('本基金本报告期末未持有股票。',0),request,source);
 assert.equal(proof.rows.length,0);
 assert.equal(parseReportHoldings(document('本基金本报告期末未持有港股通股票。',0),request,source),null);
 assert.equal(parseReportHoldings(document('本基金本报告期末未持有股票。',100),request,source),null);
 assert.equal(parseReportHoldings(document('本报告期末本基金未持有股票。',0),request,source).rows.length,0);
 assert.equal(parseReportHoldings(document('注：无。',0),request,source).rows.length,0);
 assert.equal(parseReportHoldings(document('注：无。',100),request,source),null);
 const paged=document('注：无。\n第11页 共15页\n示例基金报告',0);paged.pages[0].text=paged.pages[0].text.replace('5.3 报告','5.3.1 报告');
 assert.equal(parseReportHoldings(paged,request,source).rows.length,0);
});
test('verified short and zero holdings enter coverage and keep PDF provenance through compact export',async()=>{
 const proof=parseReportHoldings(document('1 600001 测试公司 10 100.00 1.00'),request,source);
 const universe={schemaVersion:1,source:'Dated reports',reviewedAt:'2026-10-31',historicalMembershipVerified:true,equityScope:'mainland-A',quarters:{'2016-Q3':{funds:[{fundCode:'000001',fundName:name,type:'灵活配置混合型',productId:'p1',netAsset10kCny:100}]}}};
 const industries={schemaVersion:1,source:'Dated classification',reviewedAt:'2026-10-31',taxonomy:'eastmoney-level2',taxonomyVersion:'v1',historicalMappingVerified:true,quarters:{'2016-Q3':{'600001':'银行'}}};
 let networkCalls=0;
 const options={universe,industries,years:[2016],fetchImpl:async()=>{networkCalls++;throw Error('Archive interface unavailable');},reportHoldings:[proof]};
 const result=await collect(options);
 assert.equal(networkCalls,0);
 assert.equal(result.snapshots.find(q=>q.quarter==='2016-Q3').coverage,1);
 const compact=createPublicSnapshot(createSnapshot(result,{universe,industries}));
 assert.equal(compact.quarters[0].fundCount,1);assert.equal(compact.rows[0].share,100);
 const zero=parseReportHoldings(document('本基金本报告期末未持有股票。',0),request,source);
 const empty=await collect({...options,reportHoldings:[zero]});
 assert.equal(empty.snapshots.find(q=>q.quarter==='2016-Q3').fundCoverage,1);
 assert.equal(empty.snapshots.find(q=>q.quarter==='2016-Q3').totalMarketValue,0);
 universe.quarters['2016-Q3'].funds[0].memberFundCodes=['000001','000002'];
 const alias={...proof,fundCode:'000002'};
 const merged=await collect({...options,reportHoldings:[proof,alias]});
 assert.equal(merged.snapshots.find(q=>q.quarter==='2016-Q3').successful,1);
 const onlyAlias=await collect({...options,reportHoldings:[alias]});
 assert.equal(onlyAlias.snapshots.find(q=>q.quarter==='2016-Q3').fundCoverage,1);
 const excluded={...proof,fundCode:'999999'};
 assert.equal((await collect({...options,reportHoldings:[alias,excluded]})).snapshots.find(q=>q.quarter==='2016-Q3').successful,1);
 await assert.rejects(collect({...options,reportHoldings:[{...alias,productName:'另一产品'}]}),/Unverified|do not match/);
 const second={...request,quarter:'2016-Q4',id:'AN20170125001',title:name+'2016年第4季度报告',publishedAt:'2017-01-25'},secondSource={...source,id:second.id,title:second.title,publishedAt:second.publishedAt,url:'https://pdf.dfcfw.com/pdf/H2_'+second.id+'_1.pdf'};
 const secondDoc=document('1 600001 测试公司 10 100.00 1.00');secondDoc.pages[0].text=secondDoc.pages[0].text.replace(request.title,second.title);
 const secondProof=parseReportHoldings(secondDoc,second,secondSource);
 universe.quarters['2016-Q4']=structuredClone(universe.quarters['2016-Q3']);industries.quarters['2016-Q4']={'600001':'银行'};
 universe.quarters['2016-Q4'].funds[0].memberFundCodes=['000001'];
 networkCalls=0;const partial=await collect(options);assert.equal(networkCalls,1);assert.equal(partial.snapshots.find(q=>q.quarter==='2016-Q4').successful,0);
 networkCalls=0;const complete=await collect({...options,reportHoldings:[proof,secondProof]});assert.equal(networkCalls,0);assert.equal(complete.snapshots.find(q=>q.quarter==='2016-Q4').successful,1);
});
test('cache-only source misses fail immediately without attempting network or retry delays',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'fund-source-cache-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));let calls=0;
 const load=sourceFetch(directory,{cacheOnly:true,fetchImpl:async()=>{calls++;throw Error('Network must not run');}});
 await assert.rejects(load('https://fund.eastmoney.com/example',JSON.parse),/not in local cache/);assert.equal(calls,0);
});

test('independent report workers publish the same immutable PDF and metadata without shared temporary files',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fund-pdf-workers-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const bytes=Buffer.from('%PDF-1.4\noriginal attachment fixture'),hash=require('node:crypto').createHash('sha256').update(bytes).digest('hex');
 fs.writeFileSync(path.join(dir,request.id+'.text.json'),JSON.stringify({pdfSha256:hash,extractionMode:'plain',extractionEngine:'pypdf',pages:[{page:1,text:'original extracted fixture'}]}));
 const worker=path.join(dir,'worker.cjs');fs.writeFileSync(worker,"const fs=require('node:fs');const link=fs.linkSync;fs.linkSync=(a,b)=>{Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100);return link(a,b)};require(process.argv[3]).readDisclosurePdf(JSON.parse(process.argv[4]),{directory:process.argv[2],fetchImpl:async()=>({ok:true,arrayBuffer:async()=>Buffer.from(process.argv[5],'base64')})}).catch(e=>{console.error(e);process.exitCode=1});");
 const run=require('node:util').promisify(require('node:child_process').execFile),args=[worker,dir,require.resolve('../scripts/fund-contract-evidence'),JSON.stringify(request),bytes.toString('base64')];await Promise.all([run(process.execPath,args),run(process.execPath,args)]);
 assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(dir,request.id+'.pdf'))).digest('hex'),hash);assert.equal(JSON.parse(fs.readFileSync(path.join(dir,request.id+'.source.json'),'utf8')).hash,hash);assert.equal(fs.readdirSync(dir).some(n=>n.endsWith('.tmp')),false);
});
