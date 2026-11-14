'use strict';
// Offline, explicitly authorized import. This does not change the official updater
// or fetch third-party data automatically. Never overwrite official observations.
const fs=require('node:fs');
const crypto=require('node:crypto');
const {METRICS}=require('./refresh-financing-market');
const FIELDS=Object.freeze({marginTradeInvestors:'INVESTOR_NUM',marginAverageGuarantee:'AVG_GUARANTEE_RATIO',marginMarketCapRatio:'BALANCE_RATIO',marginTotalBalance:'MARGIN_BALANCE',marginTradeRatio:'TRADE_AMT_RATIO',marginDebtInvestors:'MARGINLIAB_INVESTOR_NUM'});
const SOURCE_URL='https://data.eastmoney.com/rzrq/zhtjday.html';
function backfill(previous,rows,{start='2023-11-01',minimumOverlap=11}={}){
 if(!Array.isArray(rows)||!rows.length)throw new Error('Empty historical input');
 const dates=new Map();
 for(const row of rows){
  const date=String(row.STATISTICS_DATE||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new Error('Invalid date');
  if(date<start)continue;
  if(dates.has(date))throw new Error('Duplicate date: '+date);
  if([0,6].includes(new Date(date+'T00:00:00Z').getUTCDay()))throw new Error('Weekend date: '+date);
  for(const metric of METRICS){
   const value=row[FIELDS[metric.id]];
   if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw new Error('Missing/invalid '+metric.id+' on '+date);
   if(metric.unit==='名'&&!Number.isSafeInteger(value))throw new Error('Noninteger investors');
  }
  dates.set(date,row);
 }
 if(!dates.size)throw new Error('No dates in requested range');
 const series={},overlap={};
 for(const metric of METRICS){
  const existing=previous.series?.[metric.id]||[];
  let count=0;
  for(const point of existing){
   const row=dates.get(point.date);if(!row)continue;
   if(Math.abs(point.value-row[FIELDS[metric.id]])>1e-8)throw new Error('Official overlap mismatch: '+metric.id+' '+point.date);
   count++;
  }
  if(count<minimumOverlap)throw new Error('Insufficient official overlap: '+metric.id);
  overlap[metric.id]=count;
  const merged=new Map([...dates].map(([date,row])=>[date,{date,value:row[FIELDS[metric.id]]}]));
  for(const point of existing)merged.set(point.date,point);
  series[metric.id]=[...merged.values()].sort((a,b)=>a.date.localeCompare(b.date));
 }
 const sorted=[...dates.keys()].sort();
 return {...previous,schemaVersion:1,series,historyBackfill:{sourceName:'东方财富 Choice（历史回填）',sourceUrl:SOURCE_URL,reportName:'RPTA_WEB_MARGIN_DAILYTRADE',start:sorted[0],end:sorted.at(-1),observations:sorted.length,officialOverlap:overlap,fields:FIELDS,policy:'仅补缺失日期，保留中证数据官方观测；后续官方增量可修订重叠日期'}};
}
if(require.main===module){
 const [input,output]=process.argv.slice(2);
 if(!input||!output)throw new Error('Usage: node scripts/backfill-financing-market.js INPUT_JSON OUTPUT_JSON');
 const bytes=fs.readFileSync(input);
 const result=backfill(JSON.parse(fs.readFileSync(output,'utf8')),JSON.parse(bytes));
 result.historyBackfill.inputSha256=crypto.createHash('sha256').update(bytes).digest('hex');
 fs.writeFileSync(output,JSON.stringify(result)+'\n');
 console.log(JSON.stringify(result.historyBackfill));
}
module.exports={backfill,FIELDS,SOURCE_URL};
