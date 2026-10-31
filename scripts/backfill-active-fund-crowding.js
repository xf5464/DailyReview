'use strict';
// Manual, resumable preparation task. Never called by the site build or deployment.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {buildPublishedUniverse,reuseDatedContracts}=require('./fund-published-universe');
const {collect,createSnapshot,cachedFetch,saveSnapshot}=require('./collect-active-fund-crowding');
const {createPublicSnapshot,validateCrowdingSnapshot}=require('./fund-crowding-snapshot');
const {quarterIndex,rankIndustryQuarters}=require('./active-fund-industry-crowding');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const hash=o=>crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
const canonical=s=>String(s).normalize('NFKC').replace(/\s+/g,'');
function catalogueScopeCandidates(text){
 const match=String(text).match(/^\s*var\s+r\s*=\s*(\[[\s\S]*\])\s*;?\s*$/);
 if(!match)throw new Error('Invalid discovery catalogue');const rows=JSON.parse(match[1]);
 if(!Array.isArray(rows)||rows.some(r=>!Array.isArray(r)||!/^\d{6}$/.test(r[0])||typeof r[3]!=='string'))throw new Error('Invalid discovery catalogue rows');
 return new Set(rows.filter(r=>/QDII|FOF/i.test(r[3])).map(r=>r[0]));
}
function scopeReportRequests(preview,archive,candidates,pdfs,attemptedIds=new Set()){
 const q=preview.universe.quarters[archive.quarter];
 const possible=new Set([...q.funds,...q.unclassifiedFunds].map(f=>canonical(f.fundName)));
 const families=new Map();
 for(const h of archive.histories)for(const r of h.reports){
  const id=require('./fund-report-evidence').reportIdentity(r.title);
  if(!id||id.summary||id.quarter!==archive.quarter||!possible.has(canonical(id.productName)))continue;
  const key=canonical(id.productName);if(!families.has(key))families.set(key,{name:id.productName,codes:new Set(),reports:[]});
  const f=families.get(key);f.codes.add(h.fundCode);f.reports.push({...r,fundCode:h.fundCode});
 }
 const reviewed=new Set((pdfs?.histories||[]).flatMap(h=>h.reports.filter(r=>r.evidence?.reportParserVersion===2).map(r=>r.id)));
 return [...families.values()].filter(f=>[...f.codes].some(c=>candidates.has(c))||/全球|环球|海外|境外|国际|亚太|亚洲|大中华|成熟市场|新兴市场|中国价值发现|中国互联网|油气能源|美国|欧洲|日本|印度|越南|韩国|台湾|德国|巴西|俄罗斯|东南亚|美元/.test(f.name)).flatMap(f=>{
  const report=f.reports.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)||a.fundCode.localeCompare(b.fundCode))[0];
  if(reviewed.has(report.id)||attemptedIds.has(report.id))return [];
  return [{...report,quarter:archive.quarter,productName:f.name,fundCodes:[...f.codes].sort()}];
 });
}
function mergeReportEvidence(base,extra){
 const holdings=new Map([...(base?.holdingsEvidence||[]),...(extra.holdingsEvidence||[])].map(e=>[e.quarter+':'+e.fundCode,e]));
 return {...extra,histories:[...(base?.histories||[]),...extra.histories],holdingsEvidence:[...holdings.values()]};
}
function write(file,value,trailingNewline=true){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value)+(trailingNewline?'\n':''));fs.renameSync(tmp,file);}
function selectReusable(sets,archive) {
 const rows=sets.flatMap(set=>reuseDatedContracts(set,archive).evidence),byName=new Map();
 for(const row of rows){const key=canonical(row.productName),old=byName.get(key);if(!old||row.source.publishedAt>old.source.publishedAt)byName.set(key,row);else if(row.source.publishedAt===old.source.publishedAt&&row.status!==old.status)throw new Error('Conflicting dated contract evidence: '+row.productName);}
 return {schemaVersion:1,classifierVersion:'contract-equity-scope-v1',evidence:[...byName.values()]};
}
function mergeContractEvidence(...sets) {
 const rows=new Map();
 for(const set of sets)for(const row of set?.evidence||[]){const key=row.quarter+':'+canonical(row.productName);rows.set(key,row);}
 return {schemaVersion:1,classifierVersion:'contract-equity-scope-v1',evidence:[...rows.values()]};
}
function combineSnapshots(entries,industries) {
 if(!entries.length)throw new Error('No validated quarterly entries');
 const quarters={},audits=[],normalized=[];
 for(const {snapshot,universe} of entries){
  validateCrowdingSnapshot(snapshot);
  if(snapshot.audit.universeHash!==hash(universe))throw new Error('Quarter universe checksum mismatch');
  if(snapshot.audit.industryMapHash!==hash(industries))throw new Error('Quarter was prepared with a different industry map; recollect it');
  if(snapshot.calculationVersion!==3||snapshot.equityScope!=='mainland-A'||snapshot.classificationBasis!=='fixed-taxonomy-restatement')throw new Error('Incompatible quarterly scope');
  for(const q of snapshot.quarters){
   if(quarters[q.quarter])throw new Error('Duplicate prepared quarter');
   if(!universe.quarters[q.quarter])throw new Error('Prepared quarter lacks its source universe');
   quarters[q.quarter]=universe.quarters[q.quarter];normalized.push(q);
   audits.push(snapshot.audit.quarters.find(a=>a.quarter===q.quarter));
  }
 }
 const universe={...entries[0].universe,reviewedAt:new Date().toISOString(),quarters,
  evidenceHashes:entries.flatMap(e=>e.universe.evidenceHashes||[])};
 const ranked=rankIndustryQuarters(normalized,{requireVariableHistory:true});
 const template=entries[0].snapshot;
 const full={...template,updatedAt:new Date().toISOString(),fundCount:new Set(Object.values(quarters).flatMap(q=>q.funds.map(f=>f.fundCode))).size,
  ...ranked,quarterCount:ranked.quarters.length,
  audit:{universeHash:hash(universe),industryMapHash:hash(industries),universeReviewedAt:universe.reviewedAt,industriesReviewedAt:industries.reviewedAt,quarters:audits.sort((a,b)=>quarterIndex(a.quarter)-quarterIndex(b.quarter))}};
 return {snapshot:validateCrowdingSnapshot(full),universe};
}
function refreshPreparedEntries(directory,entries,industries) {
 for(const name of fs.readdirSync(directory).filter(n=>/^\d{4}-Q[1-4]$/.test(n))){
  const saved=path.join(directory,name,'validated.json'),uf=path.join(directory,name,'universe.json');
  if(!fs.existsSync(saved)||!fs.existsSync(uf)||entries.some(e=>e.snapshot.quarters.some(q=>q.quarter===name)))continue;
  const snapshot=read(saved),universe=read(uf);validateCrowdingSnapshot(snapshot);
  if(snapshot.audit.industryMapHash!==hash(industries))continue;
  if(snapshot.audit.universeHash!==hash(universe))throw new Error('Imported quarter universe checksum mismatch');
  entries.push({snapshot,universe});
 }
 return entries;
}
async function main(args=process.argv.slice(2)) {
 const get=f=>{const i=args.indexOf(f);return i<0?null:args[i+1];};
 for(const flag of ['--census','--archives','--industries','--state','--cache','--output'])if(!get(flag))throw new Error('Missing '+flag);
 const census=read(get('--census')),industries=read(get('--industries'));
 const directory=path.resolve(get('--state')),cache=path.resolve(get('--cache'));
 fs.mkdirSync(directory,{recursive:true});
 const lock=path.join(directory,'running.lock');let lockFd;
 try{lockFd=fs.openSync(lock,'wx');fs.writeFileSync(lockFd,String(process.pid));}catch{throw new Error('Backfill already running or stale running.lock; verify process before resuming');}
 const log=e=>{const event={at:new Date().toISOString(),...e};fs.appendFileSync(path.join(directory,'progress.jsonl'),JSON.stringify(event)+'\n');console.log(JSON.stringify(event));};
 const run=async(script,argv,logFile)=>{
  const stream=fs.createWriteStream(logFile,{flags:'a'});
  try{await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(__dirname,script),...argv],{windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.pipe(stream,{end:false});child.stderr.pipe(stream,{end:false});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(script+' exited '+code)));});}finally{await new Promise(r=>stream.end(r));}
 };
 try {
  const reusableFiles=get('--reuse-contracts')?.split(',')||[],reuseSets=reusableFiles.map(read);
  const scopeCandidates=get('--catalogue')?catalogueScopeCandidates(fs.readFileSync(get('--catalogue'),'utf8')):new Set();
  for(const name of fs.readdirSync(directory).filter(n=>/^\d{4}-Q[1-4]$/.test(n))){const f=path.join(directory,name,'contracts.json');if(fs.existsSync(f))reuseSets.push(read(f));}
  const entries=[];
  if(get('--seed-universe')){
   const universe=read(get('--seed-universe'));
   if(get('--seed-snapshot')){
    const snapshot=validateCrowdingSnapshot(read(get('--seed-snapshot')));
    if(snapshot.audit.universeHash!==hash(universe)||snapshot.audit.industryMapHash!==hash(industries))throw new Error('Seed checkpoint input checksum mismatch');
    entries.push({snapshot,universe});
   }else{
    const reports=get('--seed-reports')?get('--seed-reports').split(',').map(read):[];
    const collection=await collect({universe,industries,reportHoldings:reports.flatMap(r=>r.holdingsEvidence||[]),reportScopeEvidence:reports.flatMap(r=>(r.histories||[]).flatMap(h=>h.reports.map(r=>r.evidence).filter(Boolean))),years:[...new Set(Object.keys(universe.quarters).map(q=>Number(q.slice(0,4))))],fetchImpl:cachedFetch(cache),onProgress:()=>{}});
    entries.push({snapshot:createSnapshot(collection,{universe,industries}),universe});
   }
  }
  const publish=()=>{
   refreshPreparedEntries(directory,entries,industries);
   const result=combineSnapshots(entries,industries),compact=createPublicSnapshot(result.snapshot);
   write(path.join(cache,'audits',compact.auditDigest+'.json'),result.snapshot.audit,false);
   saveSnapshot(path.resolve(get('--output')),compact);write(path.join(directory,'verified-universe.json'),result.universe);
   log({stage:'published',quarters:compact.quarterCount,bytes:fs.statSync(get('--output')).size});
  };
  refreshPreparedEntries(directory,entries,industries);
  if(entries.length)publish();
  const requested=get('--quarters')?.split(',')||census.quarters.map(q=>q.quarter);
  requested.forEach(quarterIndex);requested.sort((a,b)=>quarterIndex(b)-quarterIndex(a));
  for(const quarter of requested){
   if(entries.some(e=>e.snapshot.quarters.some(q=>q.quarter===quarter)))continue;
   const archiveFile=path.join(path.resolve(get('--archives')),quarter+'.json');
   if(!fs.existsSync(archiveFile)){log({quarter,stage:'awaiting-archive'});continue;}
   const dir=path.join(directory,quarter);fs.mkdirSync(dir,{recursive:true});
   const saved=path.join(dir,'validated.json'),universeFile=path.join(dir,'universe.json');
   try{
    if(fs.existsSync(saved)&&fs.existsSync(universeFile)){
     const snapshot=read(saved),universe=read(universeFile);validateCrowdingSnapshot(snapshot);
     if(snapshot.audit.industryMapHash===hash(industries)){entries.push({snapshot,universe});publish();continue;}
    }
    let archive=read(archiveFile);const contractFile=path.join(dir,'contracts.json'),pdfFile=path.join(dir,'report-evidence.json');
    let contracts=fs.existsSync(contractFile)?read(contractFile):{schemaVersion:1,classifierVersion:'contract-equity-scope-v1',evidence:[]};
    let pdfs=fs.existsSync(pdfFile)?read(pdfFile):null;
    const {bindingRequests,bindArchive}=require('./fund-report-bindings');
    const binding=bindingRequests(archive);
    if(binding.length){
     const file=path.join(dir,'binding-requests.json'),output=path.join(dir,'binding-evidence.json');write(file,binding);log({quarter,stage:'report-code-binding',requests:binding.length});
     await run('fund-report-pdf-evidence.js',['--requests',file,'--output',output,'--cache',path.resolve(get('--report-cache')||path.join(cache,'quarter-report-pdfs')),'--python',get('--python')||'python'],path.join(dir,'reports.log'));
     const bindingEvidence=read(output);pdfs=mergeReportEvidence(pdfs,bindingEvidence);archive=bindArchive(archive,bindingEvidence);pdfs=bindArchive({...pdfs,quarter},bindingEvidence);write(pdfFile,pdfs);
    }
    const rebuild=()=>{
     if(fs.existsSync(pdfFile))pdfs=read(pdfFile);
     const reused=selectReusable(reuseSets,archive),merged=mergeContractEvidence(reused,contracts);
     const preview=buildPublishedUniverse(census,[archive],[merged,...(pdfs?[pdfs]:[])]);
     write(path.join(dir,'preview.json'),preview);write(universeFile,preview.universe);return preview;
    };
    let preview=rebuild();log({quarter,stage:'cohort',...preview.summaries[0]});
    const scopeRequests=scopeReportRequests(preview,archive,scopeCandidates,pdfs);
    if(scopeRequests.length){
     const file=path.join(dir,'dated-scope-requests.json'),output=path.join(dir,'dated-scope-evidence.json');write(file,scopeRequests);
     log({quarter,stage:'dated-scope-review',requests:scopeRequests.length});
     await run('fund-report-pdf-evidence.js',['--requests',file,'--output',output,'--cache',path.resolve(get('--report-cache')||path.join(cache,'quarter-report-pdfs')),'--python',get('--python')||'python'],path.join(dir,'reports.log'));
     pdfs=mergeReportEvidence(pdfs,read(output));write(pdfFile,pdfs);preview=rebuild();
    }
    if(preview.needsReportPdfs.length){
     const requests=path.join(dir,'missing-report-requests.json');write(requests,preview.needsReportPdfs);
     const output=path.join(dir,'missing-report-evidence.json');
     await run('fund-report-pdf-evidence.js',['--requests',requests,'--output',output,'--require-nav','--cache',path.resolve(get('--report-cache')||path.join(cache,'quarter-report-pdfs')),'--python',get('--python')||'python'],path.join(dir,'reports.log'));
     pdfs=mergeReportEvidence(pdfs,read(output));write(pdfFile,pdfs);preview=rebuild();
    }
    // Reclassify available complete local documents first, without network access.
    const cacheRequests=path.join(dir,'cached-contract-requests.json'),cachedResult=path.join(dir,'cached-contracts.json');
    write(cacheRequests,preview.needsContracts);
    const contractArgs=['--cache',path.resolve(get('--disclosures')||path.join(cache,'disclosures')),'--python',get('--python')||'python','--fallback','--text-fallback','--concurrency',get('--concurrency')||'3'];
    await run('fund-contract-evidence.js',['--requests',cacheRequests,'--output',cachedResult,'--cache-only','--defer-classic',...contractArgs],path.join(dir,'contracts.log'));
    contracts=mergeContractEvidence(contracts,{...read(cachedResult),evidence:read(cachedResult).evidence.filter(e=>e.status!=='unresolved')});write(contractFile,contracts);preview=rebuild();
    const attempted=new Set(),reportAttempted=new Set(),scopeAttempted=new Set();let validated=false,classicPass=false;
    for(let batch=0;batch<100;batch++){
     if(preview.productionReady){
      for(let reportPass=0;reportPass<4&&preview.productionReady;reportPass++){
       const universe=preview.universe;
       const collection=await collect({universe,industries,reportHoldings:pdfs?.holdingsEvidence||[],reportScopeEvidence:(pdfs?.histories||[]).flatMap(h=>h.reports.map(r=>r.evidence).filter(Boolean)),years:[Number(quarter.slice(0,4))],fetchImpl:cachedFetch(cache),concurrency:3,onProgress:e=>{if(e.error)log({quarter,stage:'holdings-source',...e});}});
       write(path.join(dir,'holdings-diagnostics.json'),{...collection,snapshots:collection.snapshots.map(({holdings,...q})=>q)});
       const scopeRequests=scopeReportRequests(preview,archive,new Set(collection.snapshots.find(q=>q.quarter===quarter)?.scopeReviewFundCodes||[]),pdfs,scopeAttempted);
       if(scopeRequests.length){
        scopeRequests.forEach(r=>scopeAttempted.add(r.id));
        const file=path.join(dir,'holdings-scope-requests.json'),output=path.join(dir,'holdings-scope-evidence.json');write(file,scopeRequests);
        log({quarter,stage:'scope-from-holdings',requests:scopeRequests.length});
        await run('fund-report-pdf-evidence.js',['--requests',file,'--output',output,'--cache',path.resolve(get('--report-cache')||path.join(cache,'quarter-report-pdfs')),'--python',get('--python')||'python'],path.join(dir,'reports.log'));
        pdfs=mergeReportEvidence(pdfs,read(output));write(pdfFile,pdfs);preview=rebuild();continue;
       }
       try{const snapshot=createSnapshot(collection,{universe,industries});write(saved,snapshot);entries.push({snapshot,universe});publish();validated=true;break;}
       catch(error){log({quarter,stage:'holdings-coverage',error:error.message,coverage:collection.snapshots.find(q=>q.quarter===quarter)?.coverage});}
       const successful=new Set(collection.snapshots.find(q=>q.quarter===quarter)?.successfulFunds||[]);
       const requests=universe.quarters[quarter].funds.filter(f=>!successful.has(f.fundCode)&&!reportAttempted.has(f.fundCode)).flatMap(f=>{
        const history=archive.histories.find(h=>h.fundCode===f.fundCode);
        const report=[...(history?.reports||[])].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt))[0];
        return report?[{...report,fundCode:f.fundCode,quarter,fundCodes:f.memberFundCodes}]:[];
       });
       if(!requests.length)break;requests.forEach(r=>reportAttempted.add(r.fundCode));
       const file=path.join(dir,'holdings-report-requests.json'),output=path.join(dir,'holdings-report-evidence.json');write(file,requests);
       log({quarter,stage:'complete-report-holdings',requests:requests.length});
       await run('fund-report-pdf-evidence.js',['--requests',file,'--output',output,'--cache',path.resolve(get('--report-cache')||path.join(cache,'quarter-report-pdfs')),'--python',get('--python')||'python'],path.join(dir,'reports.log'));
       const extra=read(output),holdings=new Map([...(pdfs?.holdingsEvidence||[]),...(extra.holdingsEvidence||[])].map(e=>[e.quarter+':'+e.fundCode,e]));
       pdfs={...extra,histories:[...(pdfs?.histories||[]),...extra.histories],holdingsEvidence:[...holdings.values()]};write(pdfFile,pdfs);preview=rebuild();
      }
      if(validated)break;
     }
     const nav=new Map(preview.universe.quarters[quarter].unclassifiedFunds.map(f=>[canonical(f.fundName),f.netAssetUpperBound10kCny??Infinity]));
     const requests=preview.needsContracts.filter(r=>!attempted.has(canonical(r.productName))).sort((a,b)=>(nav.get(canonical(b.productName))||0)-(nav.get(canonical(a.productName))||0)).slice(0,200);
     if(!requests.length&&!classicPass){classicPass=true;attempted.clear();log({quarter,stage:'classic-extraction-pass'});continue;}
     if(!requests.length)break;
     requests.forEach(r=>attempted.add(canonical(r.productName)));
     const file=path.join(dir,'batch-requests.json'),output=path.join(dir,'batch-evidence.json');write(file,requests);
     log({quarter,stage:'disclosures',batch,requests:requests.length});
     await run('fund-contract-evidence.js',['--requests',file,'--output',output,...contractArgs,...(!classicPass?['--defer-classic']:[])],path.join(dir,'contracts.log'));
     contracts=mergeContractEvidence(contracts,read(output));write(contractFile,contracts);preview=rebuild();
     log({quarter,stage:'cohort',...preview.summaries[0]});
    }
    reuseSets.push(contracts);
    if(!validated)log({quarter,stage:'requires-more-evidence',...preview.summaries[0]});
   }catch(error){log({quarter,stage:'retry-required',error:error.message});}
  }
  if(entries.length)publish();
  log({stage:'pass-finished',validatedQuarters:entries.reduce((n,e)=>n+e.snapshot.quarterCount,0),targetQuarters:requested.length});
 }finally{fs.closeSync(lockFd);fs.unlinkSync(lock);}
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
module.exports={selectReusable,mergeContractEvidence,combineSnapshots,catalogueScopeCandidates,scopeReportRequests,mergeReportEvidence,refreshPreparedEntries,main};
