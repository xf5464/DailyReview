'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createIndustryStore}=require('../scripts/industry-board-store'),{queryMacroOutlook}=require('../scripts/macro-outlook');
function store(t){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'industry-boards-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));return {directory,cache:createIndustryStore({directory})};}
test('verified baseline supplies all 86 boards on a cold build without upstream availability',async t=>{
 const {cache}=store(t);const result=await queryMacroOutlook({now:'2026-11-01',range:'year30',chartIds:['aShareIndustryConcentration'],industryBoardStore:cache,fetchImpl:async()=>{throw Error('Unexpected network request');}});
 const chart=result.charts[0];assert.equal(chart.error,null);assert.equal(chart.industryHistories.length,86);assert.equal(chart.items.at(-1).industryCount,86);assert.equal(chart.items.at(-1).date,'2026-10-30');assert.ok(!chart.dataFallback);
});
test('incremental refresh retains historical board price and turnover observations',async t=>{
 const {cache}=store(t);const result=await queryMacroOutlook({now:'2026-11-01',range:'year30',chartIds:['aShareIndustryConcentration'],incrementalMode:true,historicalChartCache:{aShareIndustryConcentration:{items:[{date:'2026-10-30',value:1}]}},industryBoardStore:cache,fetchImpl:async()=>{throw Error('Unexpected request');}});
 assert.ok(result.charts[0].industryHistories.reduce((n,row)=>n+row.points.length,0)>300000);
});
test('a restart retries only failed boards and retains every successful checkpoint',async t=>{
 const {directory,cache}=store(t),histories=cache.baseline.map(r=>({code:r.code,name:r.name,points:r.points}));let fail=true,calls=[];
 const fetchImpl=async url=>{const code=new URL(url).searchParams.get('secid').slice(3);calls.push(code);if(fail&&code===cache.boards[0].code){const error=Error('temporary');error.retryable=false;throw error;}return new Response(JSON.stringify({data:{klines:['2026-11-02,10,100000000']}}));};
 const options={now:'2026-11-02',range:'year30',chartIds:['aShareIndustryConcentration'],industryHistoryCache:{industryHistories:histories,items:[]},fetchImpl};
 await queryMacroOutlook({...options,industryBoardStore:cache});assert.equal(fs.readdirSync(directory).length,85);
 calls=[];fail=false;const result=await queryMacroOutlook({...options,industryBoardStore:createIndustryStore({directory})});assert.deepEqual(calls,[cache.boards[0].code]);assert.equal(result.charts[0].industryHistories.length,86);assert.equal(result.charts[0].items.at(-1).industryCount,86);assert.equal(result.charts[0].items.at(-1).date,'2026-11-02');
});
