'use strict';
const crypto=require('node:crypto');
const {quarterIndex}=require('./active-fund-industry-crowding');
const {classifyReportTitle}=require('./fund-report-evidence');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function preferReportDetail(previous,claim){
  if(!claim.detail)return false;
  if(!previous.detail)return true;
  const oldExcluded=previous.classification.status==='excluded',newExcluded=claim.classification.status==='excluded';
  if(oldExcluded!==newExcluded)return newExcluded;
  const oldNav=Number.isFinite(previous.detail.navTotal10kCny),newNav=Number.isFinite(claim.detail.navTotal10kCny);
  if(oldNav!==newNav)return newNav;
  return claim.detail.extractionMethod==='complete-PDF-layout';
}
function reconcileFundUniverse(source,evidenceSets,{quarters}={}) {
  if(source?.schemaVersion!==1 || !Array.isArray(source.quarters) || !Array.isArray(evidenceSets))throw new Error('Invalid reconciliation inputs');
  const requested=new Set(quarters || source.quarters.map(q=>q.quarter));
  [...requested].forEach(quarterIndex);
  const claims=new Map(),evidenceHashes=evidenceSets.map(e=>hash(JSON.stringify(e)));
  const contractSets=evidenceSets.filter(set=>Array.isArray(set?.evidence));
  for(const set of evidenceSets.filter(set=>Array.isArray(set?.histories))) {
    if(set?.schemaVersion!==1 || !Array.isArray(set.histories))throw new Error('Invalid quarterly report evidence');
    for(const history of set.histories)for(const report of history.reports || []) {
      const dated=classifyReportTitle(report.title);
      if(!dated.quarter || !requested.has(dated.quarter))continue;
      const detail=report.evidence;
      if(detail && (detail.id!==report.id || detail.fundCode!==history.fundCode || detail.quarter!==dated.quarter ||
          detail.productName!==dated.productName))throw new Error('Report detail does not match announcement');
      const classification=dated.status==='excluded'||dated.reason==='Dated overseas-market scope requires legal-document verification'&&detail?.classification?.status!=='excluded'?dated:(detail?.classification || dated);
      if(classification.quarter!==dated.quarter || classification.productName!==dated.productName)throw new Error('Classification does not match report period');
      const codes=new Set([history.fundCode,...(detail?.associatedFundCodes || [])]);
      for(const code of codes) {
        if(!/^\d{6}$/.test(code))throw new Error('Invalid associated fund code');
        const key=dated.quarter+':'+code, previous=claims.get(key);
        const claim={fundCode:code,quarter:dated.quarter,id:report.id,productName:dated.productName,
          publishedAt:report.publishedAt,classification,detail,announcementSource:set.source || null};
        if(!previous || (claim.id===previous.id?preferReportDetail(previous,claim):claim.publishedAt>previous.publishedAt))claims.set(key,claim);
        else if(claim.publishedAt===previous.publishedAt && claim.id!==previous.id &&
          !(claim.classification.status==='excluded' && previous.classification.status==='excluded') &&
          (claim.classification.status!==previous.classification.status || claim.productName!==previous.productName))throw new Error('Conflicting dated product classification: '+key+' '+previous.id+' '+claim.id+' '+previous.productName+' / '+claim.productName);
      }
    }
  }
  const canonical=value=>String(value).normalize('NFKC').replace(/\s+/g,'');
  const {quarterEnd}=require('./fund-contract-evidence');
  const familyIndex=new Map();for(const claim of claims.values()){const key=claim.quarter+':'+canonical(claim.productName);if(!familyIndex.has(key))familyIndex.set(key,[]);familyIndex.get(key).push(claim);}
  for(const set of contractSets) {
    if(set.schemaVersion!==1 || set.classifierVersion!=='contract-equity-scope-v1')throw new Error('Unknown contract evidence classifier');
    for(const evidence of set.evidence) {
      if(!requested.has(evidence.quarter) || evidence.status==='unresolved')continue;
      const textSource=evidence.source?.scheme==='official-disclosure-text-v1';
      if(textSource)require('./fund-disclosure-text').validateDisclosureTextSource(evidence.source);
      if(!['active','excluded'].includes(evidence.status) || !evidence.rule || !evidence.quote ||
          evidence.quoteSha256!==hash(evidence.quote) || !/^[a-f0-9]{64}$/.test(evidence.source?.hash || '') ||
          (!textSource&&!/^https:\/\/pdf\.dfcfw\.com\/pdf\/H[0-9]{1,2}_AN\d+_1\.pdf$/.test(evidence.source?.url || '')) ||
          !evidence.source.publishedAt || evidence.source.publishedAt.slice(0,10)>quarterEnd(evidence.quarter))
        throw new Error('Unverified or future-dated contract evidence');
      const seed=claims.get(evidence.quarter+':'+evidence.fundCode);
      if(!seed || canonical(seed.productName)!==canonical(evidence.productName))throw new Error('Contract evidence does not match a dated product report');
      const family=familyIndex.get(evidence.quarter+':'+canonical(evidence.productName)) || [];
      for(const claim of family) {
        if(claim.classification.status==='excluded')continue; // Scope exclusions cannot be overridden by equity-allocation evidence.
        claim.classification={...claim.classification,status:evidence.status,type:evidence.type,
          reason:evidence.rule,eligibilityBasis:'dated-contract-equity-scope'};
        claim.contractEvidence={source:evidence.source,quoteSha256:evidence.quoteSha256,rule:evidence.rule,page:evidence.page,quoteBasis:evidence.quoteBasis || (textSource?'official-announcement-text-chunk':'PDF-text')};
      }
    }
  }
  const summaries=[],resultQuarters={};

  for(const input of source.quarters.filter(q=>requested.has(q.quarter))) {
    if(!Array.isArray(input.funds) || input.recordCount!==input.funds.length ||
        new Set(input.funds.map(f=>f.fundCode)).size!==input.funds.length)throw new Error('Incomplete quarterly census');
    const unresolved=[],excluded=[],groups=new Map(),errors=[];
    for(const fund of input.funds) {
      const claim=claims.get(input.quarter+':'+fund.fundCode);
      if(!claim || claim.classification.status==='unresolved') {
        unresolved.push({fundCode:fund.fundCode,fundName:fund.fundName,reason:claim?.classification.reason || 'No dated quarterly classification',reportId:claim?.id || null});continue;
      }
      if(claim.classification.status==='excluded'){excluded.push({fundCode:fund.fundCode,reportId:claim.id});continue;}
      if(claim.classification.status!=='active' || !claim.classification.type)throw new Error('Unsupported report classification');
      const productName=claim.productName;
      if(!groups.has(productName))groups.set(productName,{productName,members:[],claims:[]});
      groups.get(productName).members.push(fund);groups.get(productName).claims.push(claim);
    }
    const funds=[];
    for(const group of groups.values()) {
      const types=new Set(group.claims.map(c=>c.classification.type));
      if(types.size!==1){errors.push({productName:group.productName,reason:'Conflicting active subtypes'});continue;}
      const details=group.claims.map(c=>c.detail).filter(Boolean);
      const mainCodes=new Set(details.map(d=>d.mainFundCode).filter(Boolean));
      if(mainCodes.size>1){errors.push({productName:group.productName,reason:'Conflicting main fund codes'});continue;}
      const reportedNavs=details.map(d=>d.navTotal10kCny).filter(n=>Number.isFinite(n)&&n>0);
      if(reportedNavs.some(n=>Math.abs(n-reportedNavs[0])>0.01)){errors.push({productName:group.productName,reason:'Conflicting reported product NAV'});continue;}
      const bulkComplete=group.members.every(f=>Number.isFinite(f.netAsset10kCny)&&f.netAsset10kCny>=0);
      const bulkNav=bulkComplete?group.members.reduce((s,f)=>s+f.netAsset10kCny,0):null;
      const exactNav=reportedNavs[0] || null;
      // The bulk source rounds each share-class NAV to 0.01 billion CNY = 100 ten-thousand CNY.
      const roundingTolerance=50*group.members.length+0.01;
      const hierarchy=details.find(d=>d.structuredShareHierarchyVerified===true&&d.extractionMethod==='complete-PDF-layout'&&/分级/.test(group.productName)&&d.navClassValuesCny?.length===1&&group.members.every(m=>d.hierarchyCodes?.includes(m.fundCode)));
      const parent=hierarchy&&group.members.find(m=>m.fundCode===hierarchy.mainFundCode);
      const children=parent?group.members.filter(m=>m!==parent):[];
      const near=(a,b,tolerance)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance;
      const structuredOverlap=!!(exactNav&&parent&&children.length&&near(parent.netAsset10kCny,exactNav,50.01)&&(group.members.every(m=>near(m.netAsset10kCny,exactNav,50.01))||near(children.reduce((n,m)=>n+m.netAsset10kCny,0),exactNav,50*children.length+0.01)));
      if(exactNav && bulkNav && Math.abs(exactNav-bulkNav)>roundingTolerance && !structuredOverlap) {
        errors.push({productName:group.productName,reason:'Share NAV sum conflicts with dated report',bulkNav,reportedNav:exactNav});continue;
      }
      const nav=exactNav || bulkNav;
      if(!nav){errors.push({productName:group.productName,reason:'Quarterly product NAV unavailable'});continue;}
      const main=[...mainCodes][0];
      const representative=group.members.find(m=>m.fundCode===main) ||
        [...group.members].sort((a,b)=>a.fundCode.localeCompare(b.fundCode))[0];
      funds.push({fundCode:representative.fundCode,fundName:group.productName,
        type:[...types][0],productId:'reported-legal-name:'+hash(group.productName),netAsset10kCny:nav,
        memberFundCodes:group.members.map(m=>m.fundCode).sort(),
        evidence:{reportIds:[...new Set(group.claims.map(c=>c.id))].sort(),
          contractProofs:[...new Map(group.claims.filter(c=>c.contractEvidence).map(c=>[c.contractEvidence.source.id,c.contractEvidence])).values()],
          mainFundCode:main || null,navBasis:structuredOverlap?'whole-structured-fund-report':exactNav?'dated-report':'quarterly-census-share-sum',
          structuredCensusOverlap:structuredOverlap,
          censusNetAsset10kCny:bulkNav,reportedNetAsset10kCny:exactNav}});
    }
    resultQuarters[input.quarter]={funds};
    summaries.push({quarter:input.quarter,censusShareCount:input.recordCount,excludedShareCount:excluded.length,
      verifiedActiveShareCount:[...groups.values()].reduce((n,g)=>n+g.members.length,0),
      verifiedActiveProductCount:funds.length,mergedShareCount:funds.reduce((n,f)=>n+f.memberFundCodes.length-1,0),
      reportNavRecoveries:funds.filter(f=>f.evidence.censusNetAsset10kCny===null && f.evidence.reportedNetAsset10kCny!==null).length,
      unresolved,errors});
  }
  if(summaries.length!==requested.size)throw new Error('Requested quarter missing from source census');
  const ready=summaries.length>0 && summaries.every(q=>!q.unresolved.length&&!q.errors.length&&q.verifiedActiveProductCount>0);
  return {schemaVersion:1,productionReady:ready,eligibilityLedger:[...claims.values()].map(c=>({fundCode:c.fundCode,quarter:c.quarter,productName:c.productName,status:c.classification.status,type:c.classification.type,reportId:c.id,publishedAt:c.publishedAt,reportedNav10kCny:c.detail?.navTotal10kCny ?? null})),
    universe:{schemaVersion:1,source:'Quarterly fund census reconciled with dated legal product reports',
      reviewedAt:new Date().toISOString(),historicalMembershipVerified:ready,
      evidenceHashes,quarters:resultQuarters},summaries};
}
function main(args=process.argv.slice(2)) {
  const fs=require('node:fs'),path=require('node:path');
  const get=flag=>{const i=args.indexOf(flag);return i<0?null:args[i+1];};
  if(!get('--census')||!get('--evidence')||!get('--output'))throw new Error('Usage: --census source-inputs.json --evidence report-evidence.json[,another.json] --output work/reconciliation.json [--quarters 2016-Q3]');
  const census=JSON.parse(fs.readFileSync(get('--census'),'utf8'));
  const sets=get('--evidence').split(',').map(file=>JSON.parse(fs.readFileSync(file,'utf8')));
  const result=reconcileFundUniverse(census,sets,{quarters:get('--quarters')?.split(',')});
  const file=path.resolve(get('--output'));fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(result)+'\n');
  console.log(JSON.stringify({productionReady:result.productionReady,quarters:result.summaries.map(q=>({
    quarter:q.quarter,products:q.verifiedActiveProductCount,mergedShares:q.mergedShareCount,navRecoveries:q.reportNavRecoveries,unresolved:q.unresolved.length,errors:q.errors.length}))}));
}
if(require.main===module){try{main();}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={reconcileFundUniverse,main};
