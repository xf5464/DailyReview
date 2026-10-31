'use strict';
const fs=require('node:fs'),path=require('node:path');
const {sourceFetch,parallel}=require('./collect-fund-crowding-sources');
const {quarterEnd}=require('./fund-contract-evidence');
const {classifyReportTitle,reportIdentity}=require('./fund-report-evidence');
function parseArchiveDay(html,{date,page=1}) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isInteger(page)||page<1)throw new Error('Invalid archive date/page');
 const table=html.match(/<table id="jjggbt"[^>]*>([\s\S]*?)<\/table>/)?.[1];
 if(!table || !/基金代码/.test(table) || !/发布时间/.test(table))throw new Error('Unrecognized historical archive table');
 const rowHtml=[...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m=>m[1]).filter(t=>/<td/.test(t));
 const empty=rowHtml.length===1&&/<td colspan="6">暂无数据<\/td>/.test(rowHtml[0]);
 const rows=empty?[]:rowHtml.map(t=>{
  const m=t.match(/<a href="([0-9A-Z]{6}),(AN\d+)\.html" title="([^"]+)"/),day=t.match(/<td>(\d{4}-\d{2}-\d{2})<\/td>\s*$/)?.[1];
  if(!m||day!==date)throw new Error('Historical archive row/date mismatch');
  const title=m[3].replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>');
  return {fundCode:m[1],id:m[2],title,publishedAt:day,classification:classifyReportTitle(title)};
 });
 const counts=[...html.matchAll(/(?:allpages=|name="allpages"\s+value=')([0-9]+)/g)].map(m=>Number(m[1]));
 const pages=counts.length?counts[0]:1;
 if(counts.some(n=>n!==pages)||page>pages || rows.length>20 || page<pages&&rows.length!==20 || !rows.length&&!empty)throw new Error('Incomplete historical archive pagination');
 const current=html.match(/<span class="at"[^>]*>(\d+)<\/span>/)?.[1];
 if(pages>1&&Number(current)!==page)throw new Error('Historical archive returned another page');
 if(new Set(rows.map(r=>r.fundCode+':'+r.id)).size!==rows.length)throw new Error('Duplicate historical archive row');
 return {pages,rows};
}
function dayUrl(date,page,pages){return 'https://fund.eastmoney.com/gonggao/default.aspx?page='+page+'&classid=3&date='+date+(pages?'&allpages='+pages:'');}
async function collectArchiveDay(date,load,{concurrency=4}={}) {
 const first=await load(dayUrl(date,1),body=>parseArchiveDay(body,{date,page:1}));
 const rest=await parallel(Array.from({length:first.value.pages-1},(_,i)=>i+2),concurrency,async page=>{
  const result=await load(dayUrl(date,page,first.value.pages),body=>parseArchiveDay(body,{date,page}));
  if(result.value.pages!==first.value.pages)throw new Error('Historical archive page count changed');return result;
 });
 const all=[first,...rest],rows=all.flatMap(r=>r.value.rows);
 if(new Set(rows.map(r=>r.fundCode+':'+r.id)).size!==rows.length)throw new Error('Duplicate historical archive rows across pages');
 return {date,pages:all.length,rows,sources:all.map(r=>r.source)};
}
function publicationDates(quarter,days=45,asOf=new Date().toISOString().slice(0,10)) {
 const first=new Date(quarterEnd(quarter)+'T00:00:00Z'),dates=[];
 if(!Number.isInteger(days)||days<1||days>90||!/^\d{4}-\d{2}-\d{2}$/.test(asOf))throw new Error('Invalid publication window');
 for(let i=1;i<=days;i++){const date=new Date(+first+i*86400000).toISOString().slice(0,10);if(date<=asOf)dates.push(date);}
 if(!dates.length)throw new Error('Quarter has no completed publication dates');return dates;
}
async function collectHistoricalQuarter(quarter,load,{onProgress=()=>{},concurrency=4,asOf,days=45}={}) {
 const dates=publicationDates(quarter,days,asOf),all=[];
 for(const date of dates){const result=await collectArchiveDay(date,load,{concurrency});all.push(result);onProgress({quarter,date,pages:result.pages,rows:result.rows.length});}
 const rows=all.flatMap(d=>d.rows).filter(r=>{const id=reportIdentity(r.title);return id?.quarter===quarter&&!id.summary;});
 const excludedLegacyAliases=rows.filter(r=>!/^\d{6}$/.test(r.fundCode)&&r.classification.status==='excluded');
 const eligibleRows=rows.filter(r=>!excludedLegacyAliases.includes(r));
 if(eligibleRows.some(r=>!/^\d{6}$/.test(r.fundCode)))throw new Error('Unsupported potentially active legacy fund alias');
 const byCode=new Map();for(const row of eligibleRows){if(!byCode.has(row.fundCode))byCode.set(row.fundCode,[]);byCode.get(row.fundCode).push(row);}
 if(!rows.length)throw new Error('No quarterly reports in complete publication window');
 return {schemaVersion:1,source:'Complete official daily publication archive within stated calendar window',preparedAt:new Date().toISOString(),quarter,cutoffReached:true,
  publicationWindow:{from:dates[0],through:dates.at(-1),days:dates.length,requestedDays:days,complete:true},
  excludedLegacyAliases,sources:all.flatMap(d=>d.sources),histories:[...byCode].map(([fundCode,reports])=>({fundCode,reports}))};
}
async function main(args=process.argv.slice(2)) {
 const get=f=>{const i=args.indexOf(f);return i<0?null:args[i+1];};
 const quarters=get('--quarters')?.split(',');if(!quarters?.length||!get('--output-directory'))throw new Error('Usage: --quarters 2016-Q3,... --output-directory work/historical-report-archives [--cache work/archive-cache]');
 const directory=path.resolve(get('--output-directory'));fs.mkdirSync(directory,{recursive:true});
 let queue=Promise.resolve();const fetchImpl=async(url,options)=>{
  const next=queue.then(()=>new Promise(r=>setTimeout(r,300)));queue=next;await next;
  return fetch(url,options);
 };
 const load=sourceFetch(path.resolve(get('--cache')||'work/historical-archive-cache'),{fetchImpl});
 for(const quarter of quarters){
  const file=path.join(directory,quarter+'.json');
  if(fs.existsSync(file)){const old=JSON.parse(fs.readFileSync(file));if(old.quarter===quarter&&old.publicationWindow?.complete===true)continue;throw new Error('Unexpected existing archive');}
  const archive=await collectHistoricalQuarter(quarter,load,{asOf:get('--as-of')||undefined,concurrency:Number(get('--concurrency')||4),onProgress:e=>console.error(JSON.stringify(e))});
  const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(archive));fs.renameSync(tmp,file);
  console.log(JSON.stringify({quarter,complete:true,fundShareCodes:archive.histories.length,pages:archive.sources.length}));
 }
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={parseArchiveDay,collectArchiveDay,publicationDates,collectHistoricalQuarter,main};
