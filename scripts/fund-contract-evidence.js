'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFile}=require('node:child_process');
const runFile=require('node:util').promisify(execFile);
const {sourceFetch,parallel}=require('./collect-fund-crowding-sources');
const {parseReportList}=require('./fund-report-evidence');
const {quarterIndex}=require('./active-fund-industry-crowding');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function quarterEnd(quarter) {
  quarterIndex(quarter);const month=Number(quarter.slice(-1))*3;
  return quarter.slice(0,4)+'-'+String(month).padStart(2,'0')+'-'+(month===3||month===12?'31':'30');
}
function selectEffectiveDocument(rows,{quarter,productName}) {
  const cutoff=quarterEnd(quarter);
  const eligible=rows.filter(row=>row.publishedAt.slice(0,10)<=cutoff && row.title.normalize('NFKC').replace(/\s+/g,'').includes(productName.normalize('NFKC').replace(/\s+/g,'')) &&
    /基金合同|招募说明书|产品资料概要/.test(row.title) && !/关于|草案|对照|修订说明|提示性|终止|清算|召开/.test(row.title));
  eligible.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt) ||
    Number(/产品资料概要/.test(b.title))-Number(/产品资料概要/.test(a.title)) ||
    Number(/摘要/.test(b.title))-Number(/摘要/.test(a.title)) || b.id.localeCompare(a.id));
  return eligible[0] || null;
}
function classifyContractText(document,{productName,quarter}) {
  const cutoff=quarterEnd(quarter);
  if(!Array.isArray(document?.pages) || !document.pages.length)throw new Error('Missing disclosure PDF pages');
  const clean=text=>text.replace(/(^|\n)\s*(?:第\s*)?\d{1,3}\s*(?:\/|页\s*共)\s*\d{1,3}\s*页?\s*(?=\n|$)/g,'$1');
  const pages=document.pages.map((p,i)=>({...p,text:clean(p.text)+'\n'+(document.pages[i+1]?clean(document.pages[i+1].text).slice(0,500):'')}));
  const joined=pages.map(p=>p.text).join('\n');
  const compact=joined.normalize('NFKC').replace(/\s+/g,'').replaceAll('％','%').replace(/[－—–~～]/g,'-');
  if(!compact.slice(0,8000).includes(productName.normalize('NFKC').replace(/\s+/g,'')))throw new Error('Disclosure PDF does not identify the reported legal product');
  const proof=(status,type,rule,page,quote,details={})=>({status,type,rule,page,quote,quoteSha256:hash(quote),...details});
  if(/指数|ETF|联接|增强|QDII|FOF|基金中基金|债券|货币|偏债|基础设施证券投资基金|商业不动产证券投资基金|集合资产管理计划|黄金交易型|上海金交易型|期货交易型/.test(productName))return proof('excluded',null,'Excluded legal product name',1,productName);
  const typedExclusion=compact.match(/基金类型[：:]?[^。；]{0,18}(?:基金中基金|FOF|QDII|货币型|货币市场|债券型|商品型|黄金型)/) || compact.match(/本基金(?:为|属于|是)(?:一只|一支)?(?:债券型|货币市场|货币型|基金中基金|混合型基金中基金|QDII)(?:证券投资)?基金/);
  if(typedExclusion)return proof('excluded',null,'Explicit non-active-equity product category',1,typedExclusion[0]);
  let explicitActive=null;
  for(const page of pages) {
    const t=page.text.replace(/(^|\n)\s*\d{1,3}\s*\/\s*\d{1,3}\s*(?=\n|$)/g,'$1').normalize('NFKC').replace(/\s+/g,'').replaceAll('％','%').replace(/[－—–~～]/g,'-');
    const explicit=t.match(/(?:本基金(?:为|属于|是一只)|基金类型[：:]?)(偏债混合型|偏股混合型|灵活配置混合型|平衡混合型|股票型)(?:证券投资)?基金?/);
    if(explicit) {
      if(explicit[1]==='偏债混合型')return proof('excluded',null,'Explicit dated bond-oriented mixed-fund type',page.page,explicit[0]);
      explicitActive=proof('active',explicit[1]==='平衡混合型'?'混合型-平衡':explicit[1],'Explicit dated product subtype',page.page,explicit[0]);
    }
    const passive=t.match(/本基金(?:为|属于|是一只)(?:[^。；]{0,25})(?:指数型基金|被动指数|指数增强型基金)/);
    if(passive)return proof('excluded',null,'Explicit passive or enhanced-index strategy',page.page,passive[0]);
  }
  const allocations=[];
  const pattern=/股票(?:(?:资产|投资|类资产)?(?:[（(](?:含|包括)(?:(?!债券|可转债)[^%()（）]){1,90}[）)])?(?:资产|投资)?(?:(?:及|和|、)存托凭证(?:资产|投资)?)?|等权益类资产)(?:占(?:本)?基金(?:总)?资产(?:净值|总值)?(?:的比例|的比重|的|比例)?|的投资比例(?:占(?:本)?基金资产的)?|的投资比重|的投资|投资比例|的配置比例|配置比例|(?:的|资产)?比例(?:占(?:本)?基金资产(?:净值|总值)?的)?(?:范围)?)(?:的)?(?:变动)?(?:范围)?(?:为|是|应为|不低于|不得低于|不少于|不超过|不得超过|不高于|：|:)?(?:本?基金(?:(?:总)?资产(?:净值)?|财产)的)?(\d{1,3}(?:\.\d+)?)%?(?:[-至](\d{1,3}(?:\.\d+)?)%)?/g;
  for(const page of pages) {
    const t=page.text.replace(/(^|\n)\s*\d{1,3}\s*\/\s*\d{1,3}\s*(?=\n|$)/g,'$1').normalize('NFKC').replace(/\s+/g,'').replaceAll('％','%').replace(/[－—–~～]/g,'-');
    for(const match of t.matchAll(pattern)) {
      if(!match[0].includes('%'))continue;
      const prefix=t.slice(Math.max(0,match.index-20),match.index);
      if(/港股|香港|境外|主题|科创|创业板|非现金|特定|基金合同约定|混合型基金需|例如|举例/.test(prefix))continue;
      const a=Number(match[1]),b=match[2]===undefined?null:Number(match[2]);
      if(a>100 || b!==null&&(b>100||a>b))continue;
      let lower=null,upper=null;
      if(b!==null){lower=a;upper=b;}
      else if(/不低于|不得低于|不少于/.test(match[0]))lower=a;
      else if(/不超过|不得超过|不高于/.test(match[0])){lower=0;upper=a;}
      else continue;
      allocations.push({page:page.page,quote:match[0],lower,upper});
    }
  }
  // A ceiling on equities plus convertible bonds also bounds stocks; its floor does not.
  const combined=/(?:权益类资产|股票)(?:(?:、|及|和|与|存托凭证|股票型ETF|可转换债券|可分离交易可转债|可交换债券|可交换债|可转债|权证|等权益类金融工具|的投资|的比例|比例|合计|投资))+(?:占(?:本)?基金资产(?:净值)?(?:的比例|的)?)(?:为|不超过|不得超过|不高于)?(\d{1,3}(?:\.\d+)?)%?(?:[-至](\d{1,3}(?:\.\d+)?)%)?/g;
  for(const page of pages) {
    const t=page.text.normalize('NFKC').replace(/\s+/g,'').replace(/[－—–~～]/g,'-');
    for(const m of t.matchAll(combined)) {
      if(!/债|权证/.test(m[0])||!m[0].includes('%'))continue;
      const upper=m[2]!==undefined?Number(m[2]):/不超过|不得超过|不高于/.test(m[0])?Number(m[1]):null;
      if(upper!==null&&upper<=40)allocations.push({page:page.page,quote:m[0],lower:null,upper,combinedAssetCeiling:true});
    }
  }
  const ceiling=allocations.filter(a=>a.upper!==null&&a.upper<=40).sort((a,b)=>a.upper-b.upper)[0];
  if(ceiling && allocations.every(a=>a.lower===null||a.lower<=ceiling.upper)) {
    if(explicitActive)return {status:'unresolved',reason:'Active subtype conflicts with low-stock allocation cap',allocations};
    return proof('excluded',null,'Dated disclosure bounds overall-stock allocation to at most 40%',ceiling.page,ceiling.quote,{stockAllocation:ceiling});
  }
  const ranges=[...new Map(allocations.filter(a=>a.lower!==null&&a.upper!==null).map(a=>[a.lower+':'+a.upper,a])).values()];
  const compatible=ranges.length===1 && allocations.every(a=>(a.lower===null||a.lower<=ranges[0].lower)&&(a.upper===null||a.upper>=ranges[0].upper));
  const distinct=[...new Set(allocations.map(a=>a.lower+':'+a.upper))];
  const allocationClass=a=>a.lower!==null&&a.lower>=60?'active':a.upper!==null&&a.upper<=40?'excluded':a.lower!==null&&a.upper!==null&&a.lower<=50&&a.upper>=80?'active':null;
  const sameEligibility=allocations.length>0&&allocations.every(a=>allocationClass(a)!==null&&allocationClass(a)===allocationClass(allocations[0]));
  if(distinct.length>1 && !compatible && !sameEligibility)return {status:'unresolved',reason:'Conflicting overall-stock allocation constraints',allocations};
  if(allocations.length) {
    const a=compatible?ranges[0]:allocations[0];
    if(a.lower!==null && a.lower>=60)return proof('active','主动权益','Contract requires at least 60% overall-stock allocation',a.page,a.quote,{stockAllocation:a});
    if(a.upper!==null && a.upper<=40 && explicitActive)return {status:'unresolved',reason:'Active subtype conflicts with low-stock allocation cap',allocations};
    if(a.upper!==null && a.upper<=40)return proof('excluded',null,'Contract limits overall-stock allocation to at most 40%',a.page,a.quote,{stockAllocation:a});
    if(a.lower!==null && a.upper!==null && a.lower<=50 && a.upper>=80)return proof('active','主动权益','Contract allows flexible or balanced majority-equity allocation',a.page,a.quote,{stockAllocation:a});
  }
  if(explicitActive)return explicitActive;
  for(const page of pages) {
    const t=page.text.replace(/(^|\n)\s*\d{1,3}\s*\/\s*\d{1,3}\s*(?=\n|$)/g,'$1').normalize('NFKC').replace(/\s+/g,'');
    const objective=t.match(/本基金属(?:于)?成长型基金[^。]{0,100}主要(?:通过)?投资于[^。]{0,100}股票/);
    if(objective)return proof('active','主动权益','Dated contract explicitly states a primarily-stock growth objective',page.page,objective[0]);
  }
  return {status:'unresolved',reason:'No unambiguous dated overall-stock allocation or active product subtype',allocations};
}
async function collectDocumentList(fundCode,load) {
  const url=page=>'https://api.fund.eastmoney.com/f10/JJGG?fundcode='+fundCode+'&pageIndex='+page+'&pageSize=100&type=1';
  const first=await load(url(1),body=>parseReportList(body,{fundCode,page:1}),'https://fundf10.eastmoney.com/');
  const results=[first];
  for(let page=2;page<=first.value.pages;page++){
    const next=await load(url(page),body=>parseReportList(body,{fundCode,page}),'https://fundf10.eastmoney.com/');
    if(next.value.total!==first.value.total)throw new Error('Disclosure history changed during pagination');
    results.push(next);
  }
  const rows=results.flatMap(r=>r.value.rows);
  if(new Set(rows.map(r=>r.id)).size!==first.value.total)throw new Error('Incomplete disclosure history');
  return {rows,sources:results.map(r=>r.source)};
}
async function readDisclosurePdf(row,{directory,python='python',fetchImpl=fetch,extractionMode='plain',cacheOnly=false}) {
  fs.mkdirSync(directory,{recursive:true});
  const pdfFile=path.join(directory,row.id+'.pdf'),textFile=path.join(directory,row.id+(extractionMode==='layout'?'.text-layout.json':'.text.json')),metaFile=path.join(directory,row.id+'.source.json');
  const url='https://pdf.dfcfw.com/pdf/H2_'+row.id+'_1.pdf';
  if(cacheOnly && (!fs.existsSync(pdfFile)||!fs.existsSync(textFile)||!fs.existsSync(metaFile)))throw new Error('Complete disclosure not in local cache');
  if(!fs.existsSync(pdfFile)) {
    const response=await fetchImpl(url,{headers:{'User-Agent':'Mozilla/5.0',Referer:'https://fund.eastmoney.com/'},signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw new Error('Disclosure PDF HTTP '+response.status);
    const data=Buffer.from(await response.arrayBuffer());
    if(data.length>20*1024*1024 || !data.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('Invalid or oversized disclosure PDF');
    const tmp=pdfFile+'.tmp';fs.writeFileSync(tmp,data);fs.renameSync(tmp,pdfFile);
    fs.writeFileSync(metaFile,JSON.stringify({url,hash:hash(data),downloadedAt:new Date().toISOString()}));
  }
  const meta=JSON.parse(fs.readFileSync(metaFile,'utf8'));
  if(meta.url!==url || hash(fs.readFileSync(pdfFile))!==meta.hash)throw new Error('Disclosure PDF cache checksum mismatch');
  if(!fs.existsSync(textFile))await runFile(python,[path.join(__dirname,'extract-fund-disclosure.py'),pdfFile,textFile,extractionMode],{timeout:120000,windowsHide:true,maxBuffer:2*1024*1024});
  const extracted=JSON.parse(fs.readFileSync(textFile,'utf8'));
  if(extracted.pdfSha256!==meta.hash || (extracted.extractionMode || 'plain')!==extractionMode)throw new Error('Extracted PDF text checksum mismatch');
  return {document:extracted,source:{...meta,id:row.id,publishedAt:row.publishedAt,title:row.title}};
}
async function main(args=process.argv.slice(2)) {
  const get=flag=>{const i=args.indexOf(flag);return i<0?null:args[i+1];};
  if(!get('--requests')||!get('--output'))throw new Error('Usage: --requests dated-product-requests.json --output work/contract-evidence.json --python python [--cache work/disclosure-cache]');
  const requests=JSON.parse(fs.readFileSync(get('--requests'),'utf8'));
  if(!Array.isArray(requests)||requests.some(r=>!/^\d{6}$/.test(r.fundCode)||!r.productName))throw new Error('Invalid disclosure evidence requests');
  requests.forEach(r=>quarterIndex(r.quarter));
  const directory=path.resolve(get('--cache') || 'work/fund-disclosure-cache');
  const load=sourceFetch(path.join(directory,'lists')),histories=new Map();
  const file=path.resolve(get('--output'));fs.mkdirSync(path.dirname(file),{recursive:true});
  const journal=file+'.progress.jsonl';fs.writeFileSync(journal,'');
  const work=async request=>{
    try {
      if(!histories.has(request.fundCode))histories.set(request.fundCode,collectDocumentList(request.fundCode,load));
      const list=await histories.get(request.fundCode),selected=selectEffectiveDocument(list.rows,request);
      if(!selected)return {...request,status:'unresolved',reason:'No applicable disclosure published by quarter end'};
      let result,classification;
      try {
        result=await readDisclosurePdf(selected,{directory:path.join(directory,'pdfs'),python:get('--python') || 'python',cacheOnly:args.includes('--cache-only')});
        classification=classifyContractText(result.document,request);
      }catch(error){classification={status:'unresolved',reason:error.message};}
      if(args.includes('--fallback') && classification.status==='unresolved') {
        const alternatives=[selectEffectiveDocument(list.rows.filter(r=>/基金合同/.test(r.title)),request),selectEffectiveDocument(list.rows.filter(r=>/招募说明书/.test(r.title)&&!/摘要/.test(r.title)),request)].filter(Boolean);
        for(const alternative of alternatives) {
          if(alternative.id===result?.source.id)continue;
          if(args.includes('--cache-only') && !fs.existsSync(path.join(directory,'pdfs',alternative.id+'.text.json')))continue;
          try {
          const next=await readDisclosurePdf(alternative,{directory:path.join(directory,'pdfs'),python:get('--python') || 'python'});
          const nextClass=classifyContractText(next.document,request);
          if(nextClass.status!=='unresolved'){result=next;classification=nextClass;break;}
          }catch(error){classification.alternativeErrors=[...(classification.alternativeErrors||[]),{id:alternative.id,reason:error.message}];}
        }
      }
      console.error(JSON.stringify({fundCode:request.fundCode,quarter:request.quarter,status:classification.status,rule:classification.rule || classification.reason}));
      return {...request,...classification,...(result?{source:result.source}:{}),listSources:list.sources};
    }catch(error){return {...request,status:'unresolved',reason:error.message};}
  };
  const rows=await parallel(requests,Number(get('--concurrency') || 2),async request=>{
    const result=await work(request);fs.appendFileSync(journal,JSON.stringify(result)+'\n');return result;
  });
  const output={schemaVersion:1,classifierVersion:'contract-equity-scope-v1',source:'Point-in-time official fund disclosures, selected by publication date',preparedAt:new Date().toISOString(),evidence:rows};
  fs.writeFileSync(file,JSON.stringify(output)+'\n');
  console.log(JSON.stringify(rows.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{})));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={quarterEnd,selectEffectiveDocument,classifyContractText,collectDocumentList,readDisclosurePdf,main};
