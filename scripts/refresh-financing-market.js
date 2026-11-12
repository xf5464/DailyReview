'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { unzipSync, strFromU8 } = require('fflate');

const SOURCE = 'https://www.csdata.cn';
const LIST_URL = SOURCE + '/cmsmc/cgfb/rzrqsj/rzrqscmrsjtj/index.html';
const OUTPUT = path.join(__dirname, 'data', 'financing-market.json');
const METRICS = Object.freeze([
  { id:'marginTradeInvestors', title:'参与交易的投资者数量', unit:'名', decimals:0,
    labels:['参与交易的投资者数量','参与交易投资者数量','参与交易投资者数'] },
  { id:'marginAverageGuarantee', title:'融资融券平均维持担保比例', unit:'%', decimals:2,
    labels:['平均维持担保比例','融资融券平均维持担保比例','平均担保比例'] },
  { id:'marginMarketCapRatio', title:'两融余额占A股流通市值比重', unit:'%', decimals:2,
    labels:['两融余额占A股流通市值比重','融资融券余额占A股流通市值比重','融资融券余额占流通市值比例'] },
  { id:'marginTotalBalance', title:'融资融券余额', unit:'亿元', decimals:2,
    labels:['融资融券余额','两融余额'] },
  { id:'marginTradeRatio', title:'两融交易额占A股交易额比重', unit:'%', decimals:2,
    labels:['两融交易额占A股交易额比重','融资融券交易额占A股交易额比重'] },
  { id:'marginDebtInvestors', title:'有融资融券负债的投资者数量', unit:'名', decimals:0,
    labels:['有融资融券负债的投资者数量','有融资融券负债投资者数量','有融资融券负债的投资者数'] }
]);
function xmlText(value) {
  return String(value).replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
}
function normalizeLabel(value) {
  return String(value||'').replace(/[\s　:：()（）]/g,'').replace(/A股/g,'A股').trim();
}
function readXlsxRows(bytes) {
  const files = unzipSync(new Uint8Array(bytes));
  const sharedXml = files['xl/sharedStrings.xml'] ? strFromU8(files['xl/sharedStrings.xml']) : '';
  const shared = [...sharedXml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)]
    .map(match => xmlText([...match[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
      .map(part=>part[1]).join('')));
  const sheetName = Object.keys(files).filter(name=>/^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((a,b)=>Number(a.match(/\d+/)[0])-Number(b.match(/\d+/)[0]))[0];
  if (!sheetName) throw new Error('官方 XLSX 缺少工作表');
  const sheet = strFromU8(files[sheetName]);
  return [...sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(row=>{
    const cells=[];
    for(const match of row[1].matchAll(/<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)){
      const ref=match[1].match(/\br="([A-Z]+)\d+"/);
      if(!ref)continue;
      let column=0;
      for(const letter of ref[1])column=column*26+letter.charCodeAt(0)-64;
      const type=match[1].match(/\bt="([^"]+)"/)?.[1];
      const raw=match[2]||'';
      const value=raw.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      const inline=raw.match(/<is>([\s\S]*?)<\/is>/)?.[1];
      cells[column-1]=type==='s' ? shared[Number(value)] :
        type==='inlineStr' ? xmlText((inline||'').replace(/<[^>]+>/g,'')) :
        value===undefined ? '' : xmlText(value);
    }
    return cells;
  });
}
function numeric(value) {
  if(value===null||value===undefined||String(value).trim()==='')return null;
  const raw=String(value).replace(/,/g,'').replace(/，/g,'').trim();
  const match=raw.match(/^(-?\d+(?:\.\d+)?)\s*(万亿|亿元|亿|万|%|％|元|人|名)?$/);
  if(!match)return null;
  let amount=Number(match[1]);
  if(!Number.isFinite(amount))return null;
  if(match[2]==='万亿')amount*=10000;
  else if(match[2]==='亿'||match[2]==='亿元')amount*=1e8;
  else if(match[2]==='万')amount*=10000;
  return amount;
}
function parseMetricRows(rows, date) {
  // Official daily workbook stores the descriptions in merged cells. In its
  // exported XML the following rows can contain numeric string indices rather
  // than their displayed labels. Validate the section anchors before using
  // their stable positions; fail closed if the official layout changes.
  if(rows.length>=20 &&
    normalizeLabel(rows[0]?.[0]).includes('融资融券市场每日数据统计') &&
    normalizeLabel(rows[2]?.[0]).includes('融资融券余额情况') &&
    normalizeLabel(rows[6]?.[0]).includes('融资融券交易情况') &&
    normalizeLabel(rows[10]?.[0]).includes('证券公司开展业务情况') &&
    normalizeLabel(rows[16]?.[0]).includes('担保品情况')) {
    const read=(index)=>Number(rows[index]?.[2]);
    const total=read(4), marketRatio=read(5), tradeRatio=read(9),
      active=read(14), debt=read(15), guarantee=read(19);
    if([total,marketRatio,tradeRatio,active,debt,guarantee].every(Number.isFinite) &&
      total>0 && total<100000 && marketRatio>0 && marketRatio<1 &&
      tradeRatio>=0 && tradeRatio<1 && active>=0 && debt>=0 &&
      guarantee>1 && guarantee<10) {
      return {
        marginTradeInvestors:active, marginAverageGuarantee:guarantee*100,
        marginMarketCapRatio:marketRatio*100, marginTotalBalance:total,
        marginTradeRatio:tradeRatio*100, marginDebtInvestors:debt
      };
    }
  }
  const values={};
  for(let rowIndex=0;rowIndex<rows.length;rowIndex++){
    const row=rows[rowIndex];
    for(let col=0;col<row.length;col++){
      const label=normalizeLabel(row[col]);
      const metric=METRICS.find(item=>item.labels.some(name=>normalizeLabel(name)===label));
      if(!metric||values[metric.id]!==undefined)continue;
      const candidates=[row[col+1],row[col+2],rows[rowIndex+1]?.[col],rows[rowIndex+1]?.[col+1]];
      const found=candidates.map(numeric).find(value=>value!==null);
      if(found===undefined)continue;
      // Official spreadsheet amount units must be explicit; do not guess whether
      // bare values are yuan, ten-thousand yuan or hundred-million yuan.
      if(metric.id==='marginTotalBalance'){
        const heading=rows.slice(Math.max(0,rowIndex-3),rowIndex+1).flat().join(' ');
        const cell=String(candidates.find(value=>numeric(value)===found)||'');
        if(/亿元|亿/.test(cell))values[metric.id]=found/1e8;
        else if(/亿元/.test(heading))values[metric.id]=found;
        else continue;
      }else if(metric.unit==='%'){
        values[metric.id]=found<=10 && String(candidates.find(value=>numeric(value)===found)).includes('%')
          ? found : found;
      }else values[metric.id]=found;
    }
  }
  return values;
}
function listFiles(html) {
  const found=[];
  const re=/<a\b[^>]*href=["']([^"']+\.xlsx(?:\?[^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for(const match of String(html).matchAll(re)){
    const title=match[2].replace(/<[^>]+>/g,'');
    const date=title.match(/(20\d{2})(\d{2})(\d{2})/);
    if(date)found.push({date:date.slice(1).join('-'),url:new URL(match[1],LIST_URL).href});
  }
  return [...new Map(found.map(item=>[item.date,item])).values()].sort((a,b)=>b.date.localeCompare(a.date));
}
async function refresh(previous, fetchImpl=globalThis.fetch, listUrl=LIST_URL) {
  const existing=previous?.series||{};
  const series=Object.fromEntries(METRICS.map(metric=>[metric.id,Array.isArray(existing[metric.id])?existing[metric.id].slice():[]]));
  const response=await fetchImpl(listUrl);
  if(!response.ok)throw new Error('中证数据目录 HTTP '+response.status);
  const files=listFiles(await response.text());
  if(!files.length)throw new Error('中证数据目录未找到每日 XLSX 下载链接');
  const lastDates=METRICS.map(metric=>series[metric.id].at(-1)?.date).filter(Boolean);
  const earliest=lastDates.length===METRICS.length?lastDates.sort()[0]:null;
  const start=earliest?new Date(Date.parse(earliest+'T00:00:00Z')-12*86400000).toISOString().slice(0,10):null;
  const targets=files.filter(item=>!start||item.date>=start);
  let accepted=0;
  const failures=[];
  for(const file of targets){
    try{
      const res=await fetchImpl(file.url);
      if(!res.ok)throw new Error('XLSX HTTP '+res.status);
      const rows=readXlsxRows(await res.arrayBuffer());
      const values=parseMetricRows(rows,file.date);
      if(!Object.keys(values).length) {
        console.warn('官方 XLSX 未匹配字段：'+file.date+'；表格前20行：'+
          JSON.stringify(rows.slice(0,20).map(row=>row.slice(0,12))));
      }
      for(const metric of METRICS){
        if(!Number.isFinite(values[metric.id]))continue;
        const byDate=new Map(series[metric.id].map(item=>[item.date,item]));
        byDate.set(file.date,{date:file.date,value:values[metric.id]});
        series[metric.id]=[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
        accepted++;
      }
    }catch(error){failures.push({date:file.date,error:error.message});}
  }
  return {snapshot:{schemaVersion:1,series},accepted,failures};
}
async function main(){
  const previous=fs.existsSync(OUTPUT)?JSON.parse(fs.readFileSync(OUTPUT,'utf8')):{schemaVersion:1,series:{}};
  const result=await refresh(previous);
  if(!result.accepted)throw new Error('未采集到任何有效融资指标，保留历史快照；'+JSON.stringify(result.failures.slice(0,3)));
  fs.writeFileSync(OUTPUT,JSON.stringify(result.snapshot)+'\n');
  console.log('融资市场指标新增/修订 '+result.accepted+' 条，失败文件 '+result.failures.length);
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={METRICS,listFiles,readXlsxRows,parseMetricRows,refresh};
