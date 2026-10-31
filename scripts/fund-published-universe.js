'use strict';
const crypto=require('node:crypto');
const {reconcileFundUniverse}=require('./reconcile-fund-report-universe');
const {quarterEnd}=require('./fund-contract-evidence');
const canonical=name=>String(name).normalize('NFKC').replace(/\s+/g,'');
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function buildPublishedUniverse(census,archives,extraEvidence=[]) {
  if(!Array.isArray(archives)||!archives.length)throw new Error('Complete quarterly report windows required');
  const filtered={...census,quarters:[]},familyMaps=new Map();
  for(const archive of archives) {
    const historical=archive.publicationWindow?.complete===true;
    if(historical) {
      const window=archive.publicationWindow;
      const dates=require('./fund-historical-report-archive').publicationDates(archive.quarter,window.requestedDays,window.through);
      const collected=new Set((archive.sources||[]).map(s=>new URL(s.url).searchParams.get('date')));
      if(window.days!==dates.length||window.from!==dates[0]||collected.size!==dates.length||dates.some(d=>!collected.has(d)))throw new Error('Incomplete historical publication calendar');
    }
    if(archive.schemaVersion!==1 || archive.cutoffReached!==true || !archive.quarter ||
        !Array.isArray(archive.histories)||!Array.isArray(archive.sources)||!archive.sources.length ||
        archive.sources.some(s=>!/^[a-f0-9]{64}$/.test(s.hash || '') || !(s.url?.startsWith('https://api.fund.eastmoney.com/f10/JJGG?') || historical&&s.url?.startsWith('https://fund.eastmoney.com/gonggao/default.aspx?'))))
      throw new Error('Unverified complete quarterly publication window');
    const original=census.quarters.find(q=>q.quarter===archive.quarter);
    if(!original)throw new Error('Quarterly census missing');
    const byCode=new Map(original.funds.map(f=>[f.fundCode,f])),funds=new Map(),families=new Map();
    for(const history of archive.histories)for(const report of history.reports) {
      const identity=require('./fund-report-evidence').reportIdentity(report.title);
      if(!identity || identity.quarter!==archive.quarter || identity.summary)continue;
      const key=canonical(identity.productName);
      if(!families.has(key))families.set(key,{productName:identity.productName,codes:new Set(),reports:[]});
      const family=families.get(key);family.codes.add(history.fundCode);family.reports.push(report);
      if(!funds.has(history.fundCode))funds.set(history.fundCode,byCode.get(history.fundCode) ||
        {fundCode:history.fundCode,fundName:identity.productName,netAsset10kCny:null});
    }
    filtered.quarters.push({quarter:archive.quarter,recordCount:funds.size,funds:[...funds.values()]});
    familyMaps.set(archive.quarter,{families,byCode,publishedCodes:new Set(funds.keys()),archive,censusCount:original.recordCount});
  }
  const evidence=[...archives,...extraEvidence];
  const reconciliation=reconcileFundUniverse(filtered,evidence,{quarters:archives.map(a=>a.quarter)});
  const ledger=new Map(reconciliation.eligibilityLedger.map(row=>[row.quarter+':'+row.fundCode,row]));
  const quarters={},summaries=[],needsReportPdfs=[],needsContracts=[];
  for(const [quarter,context] of familyMaps) {
    const known=reconciliation.universe.quarters[quarter].funds;
    const knownByName=new Map(known.map(f=>[canonical(f.fundName),f]));
    const eligible=[],unclassified=[];
    let excludedProducts=0;
    for(const [key,family] of context.families) {
      const entries=[...family.codes].map(code=>ledger.get(quarter+':'+code)).filter(Boolean);
      if(entries.length && entries.every(e=>e.status==='excluded')){excludedProducts++;continue;}
      const confirmed=knownByName.get(key);
      const subtypeSuffix=/(?:[A-Z]类(?:基金)?份额|[（(][A-Z]类(?:基金)?份额[）)])$/.test(family.productName);
      if(confirmed && !subtypeSuffix) {
        const exact=confirmed.evidence.reportedNetAsset10kCny!==null;
        const tolerance=exact?0:50*confirmed.memberFundCodes.length;
        eligible.push({...confirmed,netAssetLowerBound10kCny:Math.max(0,confirmed.netAsset10kCny-tolerance),
          netAssetUpperBound10kCny:confirmed.netAsset10kCny+tolerance});
        continue;
      }
      const members=[...family.codes].map(code=>context.byCode.get(code));
      const censusComplete=members.every(f=>f && Number.isFinite(f.netAsset10kCny)&&f.netAsset10kCny>=0);
      const sum=censusComplete?members.reduce((n,f)=>n+f.netAsset10kCny,0):null;
      const reportValues=[...new Set(entries.map(e=>e.reportedNav10kCny).filter(n=>Number.isFinite(n)&&n>=0))];
      let upper=null,basis=null;
      if(censusComplete){upper=sum+50*members.length;basis='rounded-census-upper-bound';}
      else if(reportValues.length===1){upper=reportValues[0];basis='complete-reported-product-NAV';}
      if(upper===null){
        const report=[...family.reports].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt))[0];
        needsReportPdfs.push({fundCode:report.fundCode,quarter,id:report.id,title:report.title,publishedAt:report.publishedAt,
          fundCodes:[...family.codes].sort(),productName:family.productName});
      }
      const seedCode=[...family.codes].sort()[0];
      if(!confirmed)needsContracts.push({fundCode:seedCode,quarter,productName:family.productName});
      unclassified.push({productId:'potential:'+digest(family.productName),fundName:family.productName,
        countUpperBound:Math.max(1,subtypeSuffix?family.codes.size:1),netAssetUpperBound10kCny:upper,
        navBoundBasis:basis,reportIds:[...new Set(family.reports.map(r=>r.id))],
        reason:confirmed?'Share-class product identity requires confirmation':'Type, product identity, or NAV still uncertain'});
    }
    const unbounded=unclassified.filter(f=>f.netAssetUpperBound10kCny===null).length;
    const countUpper=eligible.length+unclassified.reduce((n,f)=>n+f.countUpperBound,0);
    const navLower=eligible.reduce((n,f)=>n+f.netAssetLowerBound10kCny,0);
    const navUpper=eligible.reduce((n,f)=>n+f.netAssetUpperBound10kCny,0)+unclassified.reduce((n,f)=>n+(f.netAssetUpperBound10kCny || 0),0);
    const quantityCoverage=countUpper?eligible.length/countUpper:0;
    const assetCoverage=!unbounded&&navUpper?navLower/navUpper:0;
    const complete=true;
    quarters[quarter]={funds:eligible,unclassifiedFunds:unclassified,
      reportWindow:{complete,from:quarterEnd(quarter),through:context.archive.publicationWindow?.through || context.archive.preparedAt?.slice(0,10),collectedAt:context.archive.preparedAt,
        sourceDigest:digest(context.archive.sources)}};
    summaries.push({quarter,publishedShareCodes:context.publishedCodes.size,censusShareCount:context.censusCount,
      eligibleProducts:eligible.length,excludedProducts,uncertainProducts:unclassified.length,unboundedProducts:unbounded,
      quantityCoverageLowerBound:quantityCoverage,assetCoverageLowerBound:assetCoverage,
      sourceDigest:digest(context.archive.sources)});
  }
  const ready=summaries.every(q=>q.unboundedProducts===0 && q.quantityCoverageLowerBound>=0.9 && q.assetCoverageLowerBound>=0.9);
  return {schemaVersion:1,productionReady:ready,summaries,needsReportPdfs,needsContracts,
    universe:{schemaVersion:2,verificationBasis:'complete-published-quarterly-reports',
      quarterlyReportWindowVerified:true,equityScope:'mainland-A',
      source:'Complete dated public quarterly-report cohort; confirmed active-equity products plus conservative uncertain-product count and NAV bounds',
      reviewedAt:new Date().toISOString(),evidenceHashes:evidence.map(digest),quarters}};
}
function reuseDatedContracts(set,archive) {
  if(set?.schemaVersion!==1||set.classifierVersion!=='contract-equity-scope-v1'||!Array.isArray(set.evidence))throw new Error('Invalid reusable disclosure evidence');
  const cutoff=quarterEnd(archive.quarter),families=new Map();
  for(const history of archive.histories||[])for(const report of history.reports||[]) {
    const identity=require('./fund-report-evidence').reportIdentity(report.title);
    if(identity?.quarter!==archive.quarter||identity.summary)continue;
    const key=canonical(identity.productName);if(!families.has(key))families.set(key,{productName:identity.productName,codes:[]});
    families.get(key).codes.push(history.fundCode);
  }
  const evidence=[];
  for(const row of set.evidence) {
    const family=families.get(canonical(row.productName));
    if(!family||!['active','excluded'].includes(row.status)||!row.source?.publishedAt||row.source.publishedAt.slice(0,10)>cutoff||require('./active-fund-industry-crowding').quarterIndex(row.quarter)<require('./active-fund-industry-crowding').quarterIndex(archive.quarter))continue;
    // Reuse the dated document only. Membership and share aliases come from the target report window.
    evidence.push({...row,quarter:archive.quarter,productName:family.productName,fundCode:[...new Set(family.codes)].sort()[0],reusedFromQuarter:row.quarter});
  }
  return {schemaVersion:1,classifierVersion:set.classifierVersion,source:'Dated legal documents matched to target-quarter report identities',preparedAt:new Date().toISOString(),evidence};
}
function main(args=process.argv.slice(2)){
  const fs=require('node:fs'),path=require('node:path');
  const get=flag=>{const i=args.indexOf(flag);return i<0?null:args[i+1];};
  if(!get('--census')||!get('--archives')||!get('--output'))throw new Error('Usage: --census census.json --archives archive.json[,archive2.json] --evidence evidence.json[,another.json] --output work/published-universe.json');
  const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
  const archives=get('--archives').split(',').map(read);
  const evidence=get('--evidence')?get('--evidence').split(',').map(read):[];
  if(get('--reuse-contracts')) {
    const rows=get('--reuse-contracts').split(',').flatMap(file=>read(file).evidence||[]);
    const set={schemaVersion:1,classifierVersion:'contract-equity-scope-v1',evidence:rows};
    for(const archive of archives) {
      const reused=reuseDatedContracts(set,archive),byName=new Map();
      for(const row of reused.evidence){const key=canonical(row.productName),old=byName.get(key);if(!old||row.source.publishedAt>old.source.publishedAt)byName.set(key,row);else if(row.source.publishedAt===old.source.publishedAt&&row.status!==old.status)throw new Error('Conflicting reusable dated classification');}
      evidence.push({...reused,evidence:[...byName.values()]});
    }
  }
  const result=buildPublishedUniverse(read(get('--census')),archives,evidence);
  const file=path.resolve(get('--output'));fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify(result)+'\n');
  fs.writeFileSync(file+'.universe.json',JSON.stringify(result.universe)+'\n');
  fs.writeFileSync(file+'.needs-reports.json',JSON.stringify(result.needsReportPdfs)+'\n');
  fs.writeFileSync(file+'.contract-requests.json',JSON.stringify(result.needsContracts)+'\n');
  console.log(JSON.stringify({productionReady:result.productionReady,summaries:result.summaries,neededReportPdfs:result.needsReportPdfs.length}));
}
if(require.main===module){try{main();}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={buildPublishedUniverse,reuseDatedContracts,main};
