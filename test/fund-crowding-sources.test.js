const test=require('node:test');
const assert=require('node:assert/strict');
const {parseQuarterFundPage,parseIndustryDirectory,parseStockIndustry,parseFundProfile,collectQuarterFunds,quarterUrl}=require('../scripts/collect-fund-crowding-sources');
function page(rows,total,current,pageSize=2){return 'var returnJson={data:'+JSON.stringify(rows)+',record:"'+total+'",pages:"'+Math.ceil(total/pageSize)+'",curpage:"'+current+'"};';}
function row(code,assets='1,234.56'){return [code,'测试基金','1','2','3',assets];}
test('quarterly source parser enforces pagination and converts billion-CNY units to 10k CNY',()=>{
 const result=parseQuarterFundPage(page([row('000001'),row('000002','--')],3,1),{page:1,pageSize:2});
 assert.equal(result.funds[0].netAsset10kCny,12345600);
 assert.equal(result.funds[1].netAsset10kCny,null);
 assert.throws(()=>parseQuarterFundPage(page([row('000001')],3,1),{page:1,pageSize:2}),/Incomplete/);
 assert.throws(()=>parseQuarterFundPage(page([row('000001'),row('000002')],3,2),{page:1,pageSize:2}),/Incomplete/);
 assert.throws(()=>parseQuarterFundPage(page([row('000001'),row('000001')],2,1),{page:1,pageSize:2}),/Duplicate/);
});
test('quarterly parser never executes server JavaScript or accepts a fallback empty response',()=>{
 const raw=page([row('000001')],1,1);
 assert.throws(()=>parseQuarterFundPage(raw+'global.executed=true',{page:1,pageSize:2}),/Unrecognized/);
 assert.throws(()=>parseQuarterFundPage('var ScaleAlterationList={data:[],record:"",pages:"",curpage:""}',{page:1,pageSize:2}),/Unrecognized/);
});
test('source collector retains historical quarter membership and detects duplicates across pages',async()=>{
 const load=async(url,parse)=>{
   const current=Number(new URL(url).searchParams.get('pi'));
   return {value:parse(current===1?page([row('000001'),row('000002')],3,1):page([row('000003')],3,2)),source:{url}};
 };
 const result=await collectQuarterFunds('2016-Q3',load,{pageSize:2});
 assert.equal(result.recordCount,3);assert.equal(result.sources.length,2);
 assert.equal(new URL(result.sources[0].url).searchParams.get('t'),'2016_3');
 await assert.rejects(collectQuarterFunds('2016-Q3',async(url,parse)=>{
   const current=Number(new URL(url).searchParams.get('pi'));
   return {value:parse(current===1?page([row('000001'),row('000002')],3,1):page([row('000001')],3,2)),source:{url}};
 },{pageSize:2}),/duplicate funds across/);
});
test('changed total while paginating fails without a partial universe',async()=>{
 let count=0;
 await assert.rejects(collectQuarterFunds('2026-Q3',async(url,parse)=>{
   count++;
   return {value:parse(count===1?page([row('000001'),row('000002')],3,1):page([row('000003'),row('000004')],4,2)),source:{url}};
 },{pageSize:2}),/changed during pagination/);
});
const hierarchy={bklist:[
 {market:90,code:'BK0001',name:'一级',type:2,flag:1},
 {market:90,code:'BK0448',name:'通信设备',type:2,flag:2},
 {market:90,code:'BK0003',name:'三级',type:2,flag:3},
 {market:90,code:'BK0004',name:'概念',type:3,flag:2}
]};
test('industry directory includes only explicitly marked level-2 industries',()=>{
 assert.deepEqual(parseIndustryDirectory(hierarchy),[{code:'BK0448',name:'通信设备',level:2}]);
 assert.throws(()=>parseIndustryDirectory({bklist:[...hierarchy.bklist,hierarchy.bklist[1]]}),/duplicate/);
});
test('stock classification uses rank 2 and cross-checks exact code and name against directory',()=>{
 const directory=parseIndustryDirectory(hierarchy);
 const body={ssbk:[
   {SECURITY_CODE:'300308',BOARD_CODE:'1215',BOARD_NAME:'通信',BOARD_RANK:1},
   {SECURITY_CODE:'300308',BOARD_CODE:'448',BOARD_NAME:'通信设备',BOARD_RANK:2}
 ]};
 assert.deepEqual(parseStockIndustry(body,'300308',directory),{stockCode:'300308',industryCode:'BK0448',industry:'通信设备'});
 assert.throws(()=>parseStockIndustry(body,'000001',directory),/mismatched/);
 assert.throws(()=>parseStockIndustry({ssbk:[...body.ssbk,body.ssbk[1]]},'300308',directory),/ambiguous/);
 assert.throws(()=>parseStockIndustry(body,'300308',[{code:'BK0448',name:'错误名称'}]),/verified level-2/);
});
test('fund profile preserves product identity and fee codes without asserting historical type',()=>{
 const body='<table><thead><tr><th>irrelevant header</th></tr></thead></table><table><tr><th>基金全称</th><td>测试证券投资基金</td><th>基金代码</th><td>000001（前端）、000002（后端）<th>基金类型</th><td>混合型-灵活</td></tr><tr><th>成立日期/规模</th><td>2001年12月18日 / 32亿份</td><th>跟踪标的</th><td>该基金无跟踪标的</td></tr></table>';
 const profile=parseFundProfile(body,'000001');
 assert.equal(profile.established,'2001-12-18');assert.equal(profile.fullName,'测试证券投资基金');
 assert.deepEqual(profile.relatedFeeCodes,['000001','000002']);assert.equal(profile.historicalTypeVerified,false);
 assert.equal(parseFundProfile(body,'000002').productIdentity,profile.productIdentity);
 assert.throws(()=>parseFundProfile(body,'000003'),/mismatched/);
 assert.throws(()=>quarterUrl('2026-Q5',1,500),/Invalid quarter/);
});
