'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {quarterIndex} = require('./active-fund-industry-crowding');
const {activeFund} = require('./collect-active-fund-crowding');
const {parseFundCatalogue} = require('./prepare-active-fund-universe');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const text = html => String(html).replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').trim();
function parseQuarterFundPage(body, {page,pageSize}) {
  // Fixed source grammar: data is JSON; metadata keys are matched explicitly. Never eval source JS.
  const match = String(body).match(/^\s*var\s+returnJson\s*=\s*\{data:(\[[\s\S]*\]),record:"(\d+)",pages:"(\d+)",curpage:"(\d+)"\};?\s*$/);
  if (!match) throw new Error('Unrecognized quarterly fund-size response');
  const rows = JSON.parse(match[1]), total = Number(match[2]), pages = Number(match[3]), current = Number(match[4]);
  if (!Number.isInteger(page) || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500 ||
      !Array.isArray(rows) || total < 1 || pages !== Math.ceil(total/pageSize) ||
      current !== page || page > pages || rows.length !== Math.min(pageSize,total-(page-1)*pageSize)) throw new Error('Incomplete quarterly fund-size page');
  const funds = rows.map(row => {
    if (!Array.isArray(row) || row.length !== 6 || !/^\d{6}$/.test(row[0]) || typeof row[1] !== 'string' || !row[1]) throw new Error('Invalid quarterly fund row');
    const raw = String(row[5]).replaceAll(',','').trim();
    const value = /^\d+(?:\.\d+)?$/.test(raw) ? Number(raw)*10000 : null;
    return {fundCode:row[0],fundName:row[1],netAsset10kCny:value};
  });
  if (new Set(funds.map(f=>f.fundCode)).size !== funds.length) throw new Error('Duplicate quarterly fund code');
  return {total,pages,page:current,funds};
}
function parseIndustryDirectory(body) {
  const source = typeof body === 'string' ? JSON.parse(body) : body;
  if (!Array.isArray(source?.bklist)) throw new Error('Missing Eastmoney industry hierarchy');
  const rows = source.bklist.filter(b=>b.type===2 && b.flag===2).map(b=>{
    if (b.market!==90 || !/^BK\d{4}$/.test(b.code) || typeof b.name!=='string' || !b.name.trim()) throw new Error('Invalid level-2 industry');
    return {code:b.code,name:b.name,level:2};
  });
  if (!rows.length || new Set(rows.map(r=>r.code)).size!==rows.length ||
      new Set(rows.map(r=>r.name)).size!==rows.length) throw new Error('Empty or duplicate level-2 industries');
  return rows.sort((a,b)=>a.code.localeCompare(b.code));
}
function parseStockIndustry(body, stockCode, directory) {
  if (!/^\d{6}$/.test(stockCode)) throw new Error('Only verified mainland stock codes are supported by this source');
  const result = typeof body==='string' ? JSON.parse(body) : body;
  if (!Array.isArray(result?.ssbk)) throw new Error('Stock industry response missing');
  const rows = result.ssbk.filter(b=>Number(b.BOARD_RANK)===2);
  if (rows.length!==1 || rows[0].SECURITY_CODE!==stockCode) throw new Error('Missing, ambiguous or mismatched level-2 stock industry');
  const row = rows[0], code='BK'+String(row.BOARD_CODE).padStart(4,'0');
  const industry=directory.find(b=>b.code===code);
  if (!industry || industry.name!==row.BOARD_NAME) throw new Error('Stock industry not found in verified level-2 directory');
  return {stockCode,industryCode:code,industry:industry.name};
}
function parseFundProfile(body, requestedCode) {
  const values={};
  for (const match of String(body).matchAll(/<th\b[^>]*>([^<]*)<\/th>\s*<td\b[^>]*>([\s\S]*?)(?=<th\b|<\/tr>|<\/table>)/g)) {
    values[text(match[1])] = text(match[2]);
  }
  const fullName=values['基金全称'], type=values['基金类型'], codes=[...(values['基金代码'] || '').matchAll(/\d{6}/g)].map(m=>m[0]);
  const date=(values['成立日期/规模'] || '').match(/(\d{4})年(\d{2})月(\d{2})日/);
  if (!fullName || !type || !codes.includes(requestedCode) || !date) throw new Error('Incomplete or mismatched fund profile');
  const established=date[1]+'-'+date[2]+'-'+date[3];
  return {fundCode:requestedCode,fullName,type,established,relatedFeeCodes:codes,
    productIdentity:'eastmoney-full-name:'+sha256(fullName),
    trackingTarget:values['跟踪标的'] || null,
    historicalTypeVerified:false};
}
function sourceFetch(cacheDirectory,{fetchImpl=fetch,refresh=false,cacheOnly=false}={}) {
  fs.mkdirSync(cacheDirectory,{recursive:true});
  return async (url,parse,referer) => {
    const file=path.join(cacheDirectory,sha256(url)+'.json');
    if (!refresh && fs.existsSync(file)) {
      const record=JSON.parse(fs.readFileSync(file,'utf8'));
      if (record.url!==url || record.hash!==sha256(record.body)) throw new Error('Source cache checksum mismatch');
      return {value:parse(record.body),source:{url,hash:record.hash,fetchedAt:record.fetchedAt}};
    }
    if(cacheOnly)throw new Error('Source not in local cache');
    let response;
    for(let attempt=0;attempt<3;attempt++) {
      try {
        response=await fetchImpl(url,{headers:{'User-Agent':'Mozilla/5.0',Referer:referer || 'https://fund.eastmoney.com/'},signal:AbortSignal.timeout(20000)});
      }catch(error){if(attempt===2)throw error;await new Promise(r=>setTimeout(r,1000*(attempt+1)));continue;}
      if(response.ok||![429,503,514,567].includes(response.status)||attempt===2)break;
      const header=response.headers?.get('retry-after');
      let wait=header?(/^[0-9.]+$/.test(header)?Number(header)*1000:Date.parse(header)-Date.now()):1000*(attempt+1);
      if(!Number.isFinite(wait))wait=1000*(attempt+1);
      await response.body?.cancel();
      if(wait>30000)throw new Error('Source HTTP '+response.status+'; retry after '+header);
      await new Promise(r=>setTimeout(r,Math.max(1000,wait)));
    }
    if (!response.ok) throw new Error('Source HTTP '+response.status);
    const body=await response.text(), value=parse(body);
    const record={url,hash:sha256(body),fetchedAt:new Date().toISOString(),body};
    const temporary=file+'.'+process.pid+'.tmp';
    fs.writeFileSync(temporary,JSON.stringify(record));fs.renameSync(temporary,file);
    return {value,source:{url,hash:record.hash,fetchedAt:record.fetchedAt}};
  };
}
async function parallel(items,concurrency,worker) {
  if (!Number.isInteger(concurrency) || concurrency<1 || concurrency>8) throw new Error('concurrency must be between 1 and 8');
  let cursor=0;const output=new Array(items.length);
  await Promise.all(Array.from({length:Math.min(items.length,concurrency)},async()=>{
    while(cursor<items.length){const i=cursor++;output[i]=await worker(items[i],i);}
  }));
  return output;
}
function quarterUrl(quarter,page,pageSize) {
  quarterIndex(quarter);
  const url=new URL('https://fund.eastmoney.com/data/FundDataPortfolio_Interface.aspx');
  const query={dt:'8',pi:String(page),pn:String(pageSize),mc:'returnJson',st:'desc',sc:'qmzfe',t:quarter.replace('-Q','_')};
  Object.entries(query).forEach(([key,value])=>url.searchParams.set(key,value));return url.href;
}
async function collectQuarterFunds(quarter,load,{pageSize=500,concurrency=4,onProgress=()=>{}}={}) {
  const first=await load(quarterUrl(quarter,1,pageSize),body=>parseQuarterFundPage(body,{page:1,pageSize}));
  const rest=await parallel(Array.from({length:first.value.pages-1},(_,i)=>i+2),concurrency,async page=>{
    const result=await load(quarterUrl(quarter,page,pageSize),body=>parseQuarterFundPage(body,{page,pageSize}));
    if(result.value.total!==first.value.total || result.value.pages!==first.value.pages) throw new Error('Quarterly source changed during pagination; retry with --refresh');
    onProgress({quarter,page,pages:first.value.pages});return result;
  });
  const pages=[first,...rest],funds=pages.flatMap(p=>p.value.funds);
  if(funds.length!==first.value.total || new Set(funds.map(f=>f.fundCode)).size!==funds.length) throw new Error('Missing or duplicate funds across quarterly pages');
  return {quarter,recordCount:funds.length,funds,sources:pages.map(p=>p.source)};
}
async function main(args=process.argv.slice(2)) {
  const get=flag=>{const i=args.indexOf(flag);return i<0?null:args[i+1]&&!args[i+1].startsWith('--')?args[i+1]:null;};
  const quarters=get('--quarters')?.split(',');
  if(!quarters?.length || !get('--catalogue') || !get('--output')) throw new Error('Usage: --quarters 2016-Q3,2026-Q3 --catalogue fundcode_search.js --output work/source-inputs.json [--stocks stock-codes.json] [--profiles]');
  quarters.forEach(quarterIndex);
  if(new Set(quarters).size!==quarters.length) throw new Error('Duplicate requested quarter');
  const rawCatalogue=fs.readFileSync(get('--catalogue'),'utf8');
  const catalogue=parseFundCatalogue(rawCatalogue);
  // Use the raw share catalogue too: the quarterly source is share-level, before product deduplication.
  const rawRows=JSON.parse(rawCatalogue.slice(rawCatalogue.indexOf('['),rawCatalogue.lastIndexOf(']')+1));
  const currentByCode=new Map(rawRows.map(r=>[r[0],{fundName:r[2],type:r[3]}]));
  const load=sourceFetch(path.resolve(get('--cache') || 'work/fund-crowding-source-cache'),{refresh:args.includes('--refresh')});
  const industry=await load('https://quote.eastmoney.com/center/api/sidemenu_new.json',parseIndustryDirectory,'https://quote.eastmoney.com/center/gridlist.html');
  const quarterResults=[];
  const concurrency=Number(get('--concurrency') || 4);
  for(const quarter of quarters) {
    const result=await collectQuarterFunds(quarter,load,{concurrency,onProgress:e=>console.error(JSON.stringify(e))});
    const funds=result.funds.map(f=>{
      const current=currentByCode.get(f.fundCode);
      return {...f,currentType:current?.type || null,currentFundName:current?.fundName || null,
        currentActiveCandidate:!!current && activeFund({...f,type:current.type}),
        historicalTypeVerified:false};
    });
    quarterResults.push({...result,funds});
  }
  const stocks=get('--stocks') ? JSON.parse(fs.readFileSync(get('--stocks'),'utf8')) : [];
  if(!Array.isArray(stocks) || new Set(stocks).size!==stocks.length || stocks.some(c=>!/^\d{6}$/.test(c))) throw new Error('Stocks must be unique six-digit mainland codes');
  const mappings=await parallel(stocks,concurrency,async code=>{
    const exchange=/^(?:[48]|92)/.test(code)?'BJ':/^[569]/.test(code)?'SH':'SZ';
    const url='https://emweb.securities.eastmoney.com/PC_HSF10/CoreConception/PageAjax?code='+exchange+code;
    try {const response=await load(url,body=>parseStockIndustry(body,code,industry.value),'https://emweb.securities.eastmoney.com/');return {...response.value,source:response.source};}
    catch(error){return {stockCode:code,error:error.message};}
  });
  if (args.includes('--profiles') && get('--profile-codes')) throw new Error('Choose --profiles or --profile-codes');
  const profileCodes=get('--profile-codes') ? JSON.parse(fs.readFileSync(get('--profile-codes'),'utf8'))
    : args.includes('--profiles') ? [...new Set(quarterResults.flatMap(q=>q.funds.filter(f=>f.currentActiveCandidate).map(f=>f.fundCode)))] : [];
  if (!Array.isArray(profileCodes) || new Set(profileCodes).size!==profileCodes.length || profileCodes.some(c=>!/^\d{6}$/.test(c))) throw new Error('Profile codes must be unique six-digit fund codes');
  const profiles=await parallel(profileCodes,concurrency,async code=>{
    try{const response=await load('https://fundf10.eastmoney.com/jbgk_'+code+'.html',body=>parseFundProfile(body,code),'https://fundf10.eastmoney.com/');return {...response.value,source:response.source};}
    catch(error){return {fundCode:code,error:error.message};}
  });
  const output={schemaVersion:1,preparedAt:new Date().toISOString(),productionReady:false,
    catalogue:{recordCount:catalogue.recordCount,candidateProductCount:catalogue.funds.length,sha256:sha256(rawCatalogue)},
    industryDirectory:{industries:industry.value,source:industry.source},
    currentStockIndustries:mappings,profiles,quarters:quarterResults,
    limitations:['Quarterly size lists contain all public-fund shares, not only active equity products.',
      'Current fund types do not verify historical classifications or transformations.',
      'Current stock classifications are dated at collection time, not historical industry assignments.',
      'Product identities and fee-class assets must be reconciled before production.']};
  const outputFile=path.resolve(get('--output'));fs.mkdirSync(path.dirname(outputFile),{recursive:true});
  const temporary=outputFile+'.tmp';fs.writeFileSync(temporary,JSON.stringify(output)+'\n');fs.renameSync(temporary,outputFile);
  console.log(JSON.stringify({output:outputFile,productionReady:false,industries:industry.value.length,
    quarters:quarterResults.map(q=>({quarter:q.quarter,records:q.recordCount,currentActiveCandidates:q.funds.filter(f=>f.currentActiveCandidate).length})),
    stockMappings:mappings.filter(r=>!r.error).length,profiles:profiles.filter(r=>!r.error).length}));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={parseQuarterFundPage,parseIndustryDirectory,parseStockIndustry,parseFundProfile,sourceFetch,parallel,collectQuarterFunds,quarterUrl,main};
