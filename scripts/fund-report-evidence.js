'use strict';
const {quarterIndex}=require('./active-fund-industry-crowding');
const {classificationProductName}=require('./fund-portfolio-source');
const {sourceFetch,parallel}=require('./collect-fund-crowding-sources');
function reportIdentity(title) {
  const normalized=String(title || '').replace(/\s+/g,'');
  const match=normalized.match(/^(.*?)((?:19|20)\d{2})年第?([1-4一二三四])季度报告/);
  if(!match || !match[1]) return null;
  const quarter=Number(match[3]) || '一二三四'.indexOf(match[3])+1;
  return {quarter:match[2]+'-Q'+quarter,productName:match[1],summary:/摘要/.test(normalized)};
}
function classifyReportTitle(title) {
  const identity=reportIdentity(title);
  if(!identity)return {status:'unresolved',reason:'No explicit quarterly report period'};
  const name=classificationProductName(identity.productName);
  if(/指数|ETF|增强|联接|被动|QDII|FOF|基金中基金|债券|货币|偏债|保本|不动产投资信托|基础设施证券投资基金|商业不动产证券投资基金|集合资产管理计划/i.test(name))return {...identity,status:'excluded',reason:'Dated product title identifies excluded strategy'};
  let type=null;
  if(/灵活配置.*混合|混合.*灵活配置/.test(name))type='灵活配置混合型';
  else if(/偏股.*混合|混合.*偏股/.test(name))type='偏股混合型';
  else if(/平衡.*混合|混合.*平衡/.test(name))type='混合型-平衡';
  else if(/股票型|股票证券投资基金/.test(name))type='股票型';
  if(type && /全球|环球|海外|亚太|亚洲|香港|美国|欧洲|大中华|中国概念|东南亚|日本/.test(name))return {...identity,status:'unresolved',type:null,reason:'Dated overseas-market scope requires legal-document verification'};
  return {...identity,status:type?'active':'unresolved',type,reason:type?'Explicit dated legal product title':'Mixed subtype not established by title'};
}
function parseReportList(body,{fundCode,page=1,pageSize=100}) {
  const data=typeof body==='string'?JSON.parse(body):body;
  if(data?.ErrCode!==0 || !Array.isArray(data.Data) || !Number.isInteger(data.TotalCount) ||
      data.TotalCount<0 || Number(data.PageIndex)!==page || Number(data.PageSize)!==pageSize ||
      data.Data.length!==Math.min(pageSize,Math.max(0,data.TotalCount-(page-1)*pageSize)))throw new Error('Incomplete fund report announcement page');
  const rows=data.Data.map(row=>{
    if((fundCode && row.FUNDCODE!==fundCode) || !/^\d{6}$/.test(row.FUNDCODE || '') || !/^AN\d+$/.test(row.ID || '') || typeof row.TITLE!=='string' ||
        !/^\d{4}-\d{2}-\d{2}/.test(row.PUBLISHDATE || ''))throw new Error('Mismatched fund report announcement');
    return {fundCode:row.FUNDCODE,id:row.ID,title:row.TITLE,publishedAt:row.PUBLISHDATE,classification:classifyReportTitle(row.TITLE)};
  });
  if(new Set(rows.map(r=>r.fundCode+':'+r.id)).size!==rows.length)throw new Error('Duplicate fund report announcement');
  return {total:data.TotalCount,pages:Math.ceil(data.TotalCount/pageSize),rows};
}
function selectQuarterReports(rows) {
  const selected=new Map();
  for(const row of rows) {
    const identity=reportIdentity(row.title);
    if(!identity || identity.summary)continue;
    const quarter=identity.quarter;
    const month=Number(quarter.slice(-1))*3, day=month===3 || month===12?'31':'30';
    if(row.publishedAt.slice(0,10)<=quarter.slice(0,4)+'-'+String(month).padStart(2,'0')+'-'+day)throw new Error('Report publication precedes quarter end');
    const previous=selected.get(quarter);
    if(!previous || row.publishedAt>previous.publishedAt)selected.set(quarter,row);
    else if(row.publishedAt===previous.publishedAt && row.id!==previous.id && (row.classification.status!==previous.classification.status || identity.productName!==reportIdentity(previous.title).productName))throw new Error('Conflicting report versions');
  }
  return [...selected.values()].sort((a,b)=>quarterIndex(a.classification.quarter)-quarterIndex(b.classification.quarter));
}
function parseReportPage(body,{fundCode,id,quarter,page=1}) {
  const response=typeof body==='string'?JSON.parse(body):body;
  const data=response?.data,identity=reportIdentity(data?.notice_title);
  if(![true,1].includes(response?.success) || data?.art_code!==id || !identity || identity.quarter!==quarter ||
      typeof data.notice_content!=='string' || !data.notice_content.trim() ||
      !Number.isInteger(Number(data.page_size)) || Number(data.page_size)<page)throw new Error('Mismatched or empty quarterly report content');
  const contents=data.notice_content;
  const compact=contents.normalize('NFKC').replace(/\s+/g,'');
  const qNumber=Number(quarter.slice(-1));
  const bodyPeriod=new RegExp(quarter.slice(0,4)+'年第?['+qNumber+'一二三四'[qNumber-1]+']季度报告');
  if(page===1 && (!bodyPeriod.test(compact.slice(0,2000)) || !compact.slice(0,2000).includes(identity.productName.normalize('NFKC'))))throw new Error('Report body has different product or quarter');
  const sectionStart=contents.search(/基金产品概况|基金基本情况/);
  const overview=sectionStart>=0?contents.slice(sectionStart,sectionStart+7000):contents.slice(0,7000);
  const mainMatch=overview.replace(/\s+/g,'').match(/基金主代码[|：:]*([0-9]{6})(?!\d)/);
  const codeSet=new Set([...(overview.matchAll(/(?<!\d)\d{6}(?!\d)/g))].map(m=>m[0]));
  const associated=Array.isArray(data.security)&&data.security.some(s=>s.stock===fundCode);
  if(!associated && !codeSet.has(fundCode))throw new Error('Report does not identify requested fund');
  const classification=classifyReportTitle(data.notice_title);
  const riskText=overview.replace(/\s+/g,'');
  const abbreviation=riskText.match(/基金简称[|：:]*([^。；]{1,100}?)(?:场内简称|基金主代码|交易代码|基金运作方式|基金合同生效日)/)?.[1]||'';
  const overseasCustody=/境外资产托管人/.test(riskText)&&/境外(?:证券|股票|资本)?市场|全球[^。；]{0,80}(?:证券|股票|基金)|合格境内机构投资者|外汇额度/.test(riskText);
  if(classification.status!=='excluded'&&(/QDII|FOF/i.test(abbreviation)||overseasCustody)) {
    classification.status='excluded';classification.type=null;classification.reason='Dated report fund abbreviation explicitly identifies QDII or FOF';
  }
  const protectedType=/本基金(?:属于|为|是)(?:一只|一支)?(?:保本型|保本混合型|保本|避险型)(?:证券投资)?基金/.test(riskText);
  const insuredMandate=/基金保证人[|：:]?[^|\d]{2,60}(?:公司|中心)/.test(riskText)&&/恒定比例投资组合保险/.test(riskText)&&/本金损失/.test(riskText)&&/避险周期/.test(riskText);
  if(classification.status!=='excluded'&&(protectedType||insuredMandate)) {
    classification.status='excluded';classification.type=null;classification.reason='Dated report overview establishes capital-protection mandate';
  }
  if(classification.status==='unresolved') {
    const type=riskText.match(/本基金(?:属于|为|是)(?:一只|一支)?(偏股混合型|灵活配置混合型|平衡混合型|股票型)(?:证券投资)?基金/);
    if(type) {classification.status='active';classification.type=type[1]==='平衡混合型'?'混合型-平衡':type[1];classification.reason='Explicit fund type in dated report overview';}
  }
  const navLine=contents.match(/期末基金资产净值[^\S\r\n]*([^\r\n]+)/);
  const navValues=navLine?[...navLine[1].matchAll(/(?<![\d.])[\d,]+\.\d{2}(?!\d)/g)].map(m=>Number(m[0].replaceAll(',',''))):[];
  const currencyConfirmed=/单位[\s：:]*人民币元/.test(contents.slice(0,navLine?.index || 0).slice(-1000));
  const navTotal10kCny=currencyConfirmed && navValues.length && navValues.every(n=>Number.isFinite(n)&&n>0)
    ? navValues.reduce((a,b)=>a+b,0)/10000:null;
  return {fundCode,quarter,id,productName:identity.productName,
    mainFundCode:mainMatch?.[1] || null,productId:mainMatch?'main-code:'+mainMatch[1]:null,
    classification,navTotal10kCny,navClassValuesCny:navValues,currencyConfirmed,
    contentPages:Number(data.page_size),page,sourceTitle:data.notice_title,
    sourceDate:data.notice_date,associatedFundCodes:Array.isArray(data.security)?data.security.map(s=>s.stock):[]};
}
async function collectReportHistory(fundCode,load,{onProgress=()=>{}}={}) {
  if(!/^\d{6}$/.test(fundCode))throw new Error('Invalid fund code');
  const url=page=>'https://api.fund.eastmoney.com/f10/JJGG?fundcode='+fundCode+'&pageIndex='+page+'&pageSize=100&type=3';
  const first=await load(url(1),body=>parseReportList(body,{fundCode,page:1}),'https://fundf10.eastmoney.com/jjgg_'+fundCode+'_3.html');
  const pages=[first];
  for(let page=2;page<=first.value.pages;page++) {
    const next=await load(url(page),body=>parseReportList(body,{fundCode,page}),'https://fundf10.eastmoney.com/');
    if(next.value.total!==first.value.total)throw new Error('Report list changed during pagination');pages.push(next);
  }
  const rows=pages.flatMap(p=>p.value.rows);
  if(new Set(rows.map(r=>r.id)).size!==first.value.total)throw new Error('Incomplete report history');
  const reports=selectQuarterReports(rows);
  onProgress({fundCode,reportCount:reports.length});
  return {fundCode,reports,sources:pages.map(p=>p.source)};
}
async function main(args=process.argv.slice(2)) {
  const fs=require('node:fs'),path=require('node:path');
  const get=flag=>{const i=args.indexOf(flag);return i<0?null:args[i+1];};
  const globalQuarter=get('--global-quarter');
  if(!get('--output') || (!get('--funds')&&!globalQuarter))throw new Error('Usage: --funds fund-codes.json OR --global-quarter 2026-Q3 --output work/report-evidence.json');
  if(globalQuarter && (get('--funds') || args.includes('--content')))throw new Error('Global archive mode collects titles; use --funds with --content for selected report bodies');
  const codes=globalQuarter?[]:JSON.parse(fs.readFileSync(get('--funds'),'utf8'));
  if(!Array.isArray(codes)||new Set(codes).size!==codes.length||codes.some(c=>!/^\d{6}$/.test(c)))throw new Error('Expected unique six-digit fund codes');
  const quarters=get('--quarters')?.split(',');if(quarters)quarters.forEach(quarterIndex);
  const load=sourceFetch(path.resolve(get('--cache') || 'work/fund-report-cache'),{refresh:args.includes('--refresh'),
    fetchImpl:pacedContentFetch({intervalMs:Number(get('--content-interval-ms') || 1200)})});
  const globalArchive=globalQuarter?await collectGlobalQuarterReports(globalQuarter,load,{concurrency:Number(get('--concurrency') || 3),onProgress:e=>console.error(JSON.stringify(e))}):null;
  const histories=globalArchive?globalArchive.histories:await parallel(codes,Number(get('--concurrency') || 3),async code=>{
    try {
      const history=await collectReportHistory(code,load,{onProgress:e=>console.error(JSON.stringify(e))});
      history.reports=history.reports.filter(r=>!quarters || quarters.includes(r.classification.quarter));
      if(args.includes('--content'))for(const report of history.reports) {
        const url='https://np-cnotice-stock.eastmoney.com/api/content/ann?art_code='+report.id+'&client_source=web&page_index=1';
        try{const result=await load(url,body=>parseReportPage(body,{fundCode:code,id:report.id,quarter:report.classification.quarter}),'https://fund.eastmoney.com/');
          report.evidence={...result.value,source:result.source};}
        catch(error){report.contentError=error.message;}
      }
      return history;
    }catch(error){return {fundCode:code,error:error.message,reports:[]};}
  });
  const output={schemaVersion:1,source:'Dated Eastmoney quarterly report announcements and report text',
    preparedAt:new Date().toISOString(),...(globalArchive?{quarter:globalArchive.quarter,cutoffReached:globalArchive.cutoffReached,sources:globalArchive.sources}:{}),histories};
  const file=path.resolve(get('--output'));fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(output)+'\n');fs.renameSync(tmp,file);
  console.log(JSON.stringify({funds:histories.length,failed:histories.filter(h=>h.error).length,
    reports:histories.reduce((s,h)=>s+h.reports.length,0),
    activeReports:histories.flatMap(h=>h.reports).filter(r=>(r.evidence?.classification || r.classification).status==='active').length,
    mainCodeReports:histories.flatMap(h=>h.reports).filter(r=>r.evidence?.mainFundCode).length}));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
async function collectGlobalQuarterReports(quarter,load,{concurrency=3,onProgress=()=>{}}={}) {
  quarterIndex(quarter);
  const month=Number(quarter.slice(-1))*3,cutoff=quarter.slice(0,4)+'-'+String(month).padStart(2,'0')+'-'+(month===3||month===12?'31':'30');
  const url=page=>'https://api.fund.eastmoney.com/f10/JJGG?fundcode=&pageIndex='+page+'&pageSize=100&type=3';
  const first=await load(url(1),body=>parseReportList(body,{page:1}),'https://fund.eastmoney.com/gonggao/');
  const pages=[first];let reachedCutoff=first.value.rows.at(-1)?.publishedAt.slice(0,10)<=cutoff;
  for(let start=2;start<=first.value.pages && !reachedCutoff;start+=concurrency) {
    const batch=await parallel(Array.from({length:Math.min(concurrency,first.value.pages-start+1)},(_,i)=>start+i),concurrency,async page=>{
      const result=await load(url(page),body=>parseReportList(body,{page}),'https://fund.eastmoney.com/gonggao/');
      if(result.value.total!==first.value.total)throw new Error('Global report list changed while collecting');
      onProgress({page,pages:first.value.pages,oldest:result.value.rows.at(-1)?.publishedAt});return result;
    });
    for(const page of batch){pages.push(page);if(page.value.rows.at(-1)?.publishedAt.slice(0,10)<=cutoff){reachedCutoff=true;break;}}
  }
  if(!reachedCutoff)throw new Error('Global report archive is truncated before requested quarter; use per-fund histories');
  const rows=pages.flatMap(p=>p.value.rows),keys=new Set();
  for(let i=0;i<rows.length;i++){
    const key=rows[i].fundCode+':'+rows[i].id;
    if(keys.has(key))throw new Error('Duplicate global report row; refresh changed pagination');
    keys.add(key);
    if(i && rows[i].publishedAt>rows[i-1].publishedAt)throw new Error('Global report dates are not descending');
  }
  const byCode=new Map();
  for(const row of rows){if(!byCode.has(row.fundCode))byCode.set(row.fundCode,[]);byCode.get(row.fundCode).push(row);}
  const histories=[...byCode].map(([fundCode,items])=>({fundCode,reports:selectQuarterReports(items).filter(r=>r.classification.quarter===quarter)})).filter(h=>h.reports.length);
  return {schemaVersion:1,source:'Complete global dated fund announcement window',
    preparedAt:new Date().toISOString(),quarter,pages:pages.length,rows:rows.length,
    cutoffReached:true,sources:pages.map(p=>p.source),histories};
}
function pacedContentFetch({fetchImpl=fetch,intervalMs=1200,retries=2,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}) {
  if(!Number.isFinite(intervalMs)||intervalMs<0||intervalMs>30000)throw new Error('Invalid content request interval');
  let queue=Promise.resolve(),nextTime=0;
  return async (url,options) => {
    if(new URL(url).hostname!=='np-cnotice-stock.eastmoney.com')return fetchImpl(url,options);
    const run=async()=>{
      for(let attempt=0;;attempt++){
        const wait=Math.max(0,nextTime-Date.now());if(wait)await sleep(wait);
        const response=await fetchImpl(url,options);nextTime=Date.now()+intervalMs;
        if(![429,503,567].includes(response.status) || attempt>=retries)return response;
        const header=response.headers?.get?.('retry-after') || '';
        const parsed=/^\d+$/.test(header)?Number(header)*1000:Date.parse(header)-Date.now();
        const retryAfter=Number.isFinite(parsed)?Math.max(0,parsed):0;
        if(retryAfter>30000)return response;
        await response.body?.cancel?.();
        await sleep(Math.max(retryAfter,2000*2**attempt));
      }
    };
    const result=queue.then(run,run);queue=result.then(()=>{},()=>{});return result;
  };
}
module.exports={reportIdentity,classifyReportTitle,parseReportList,selectQuarterReports,parseReportPage,collectReportHistory,collectGlobalQuarterReports,pacedContentFetch,main};


