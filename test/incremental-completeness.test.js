'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {queryMacroOutlook}=require('../scripts/macro-outlook');
test('an unresponsive source reaches its deadline and preserves the previous chart',async()=>{
 const out=await queryMacroOutlook({now:'2026-11-01',chartIds:['ndx'],chartTimeoutMs:10,incrementalMode:true,historicalChartCache:{ndx:{items:[{date:'2026-10-30',value:100}]}},fetchImpl:()=>new Promise(()=>{})});
 assert.equal(out.charts[0].dataFallback,true);assert.equal(out.charts[0].items[0].value,100);assert.match(out.charts[0].sourceError,/deadline/);
});
test('exchange turnover catches up after a pause with bounded concurrency',async()=>{
 const {queryExchangeTurnover}=require('../scripts/exchange-turnover');
 const saved=require('../scripts/data/exchange-turnover.json').sh,last=Object.keys(saved).sort().at(-1),now=new Date(Date.parse(last)+30*86400000);let active=0,maxActive=0;const dates=[];
 const result=await queryExchangeTurnover('sh',{now,fetchImpl:async url=>{const date=new URL(url).searchParams.get('SEARCH_DATE');dates.push(date);active++;maxActive=Math.max(active,maxActive);await new Promise(r=>setImmediate(r));active--;return new Response(JSON.stringify({result:['01','03'].map(PRODUCT_CODE=>({PRODUCT_CODE,TRADE_DATE:date.replaceAll('-',''),TRADE_AMT:100,TOTAL_VALUE:1000}))}));}});
 assert.ok(dates.some(date=>date>last&&date<new Date(now-7*86400000).toISOString().slice(0,10)));assert.ok(maxActive<=3);assert.ok(result.items.length>Object.keys(saved).length);
});
test('official ETF premium widens its bounded request after a long pause',async()=>{
 const {queryOfficialPremium159941}=require('../scripts/etf-official-premium-159941');const urls=[];
 await queryOfficialPremium159941({incremental:true,lookbackDays:200,fetchImpl:async url=>{urls.push(new URL(url));return new Response(JSON.stringify(url.includes('/f10/lsjz')?{Data:{LSJZList:[{FSRQ:'2026-10-28',DWJZ:'1'},{FSRQ:'2026-10-29',DWJZ:'1'}]}}:{data:{klines:['2026-10-28,1,1.1','2026-10-29,1,1.2']}}));}});
 assert.ok(Number(urls[0].searchParams.get('lmt'))>=200);assert.ok(Number(urls[1].searchParams.get('pageSize'))>=200);
});
test('each chart bootstraps independently while warm charts only fetch their update window',async()=>{
 const urls=[];const out=await queryMacroOutlook({now:'2026-11-01',range:'year30',chartIds:['ndx','treasuryYield'],incrementalMode:true,historicalChartCache:{ndx:{items:[{date:'2026-10-30',value:100}]}},fetchImpl:async url=>{urls.push(url);const id=new URL(url).searchParams.get('id');return new Response('DATE,'+id+'\n2026-10-30,100\n2026-10-31,101');}});
 assert.equal(out.charts.length,2);const warm=new URL(urls.find(u=>u.includes('NASDAQ100'))),cold=new URL(urls.find(u=>u.includes('DGS10')));assert.ok(warm.searchParams.get('cosd')>='2026-10-01');assert.ok(cold.searchParams.get('cosd')<'2000-01-01');
});
test('long pauses resume before the last observation instead of losing the missing interval',async()=>{
 let url;await queryMacroOutlook({now:'2026-11-01',chartIds:['ndx'],incrementalMode:true,historicalChartCache:{ndx:{items:[{date:'2025-01-01',value:100}]}},fetchImpl:async u=>{url=new URL(u);return new Response('DATE,NASDAQ100\n2026-10-30,101');}});assert.ok(url.searchParams.get('cosd')<='2025-01-01');
});
test('incremental CPI retains enough raw months to calculate a new year-over-year point',async()=>{
 const rows=Array.from({length:20},(_,i)=>({date:new Date(Date.UTC(2025,i,1)).toISOString().slice(0,10),value:100+i}));let requested;
 const out=await queryMacroOutlook({now:'2026-08-15',chartIds:['cpi'],incrementalMode:true,historicalChartCache:{cpi:{items:[{date:'2026-06-01',value:5}]}},fetchImpl:async u=>{requested=new URL(u).searchParams.get('cosd');return new Response('DATE,CPIAUCSL\n'+rows.filter(r=>r.date>=requested).map(r=>r.date+','+r.value).join('\n'));}});
 assert.ok(requested<='2025-07-01');assert.ok(out.charts[0].items.some(r=>r.date==='2026-08-01'&&Number.isFinite(r.value)));
});
