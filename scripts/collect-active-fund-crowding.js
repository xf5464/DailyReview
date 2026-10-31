'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { queryFundPortfolio, deduplicateFundShares, classificationProductName } = require('./fund-portfolio-source');
const { CALCULATION_VERSION, quarterIndex, calculateIndustryCrowding } = require('./active-fund-industry-crowding');

function activeFund(fund) {
  const type = String(fund.type || '');
  if (!/^\d{6}$/.test(String(fund.fundCode || ''))) return false;
  if (/指数|ETF|增强|联接|被动|QDII|FOF|债券|偏债|保本/i.test(type + ' ' + classificationProductName(fund.fundName))) return false;
  return /^(主动权益|股票型|普通股票型|偏股混合型|灵活配置混合型|混合型-(偏股|灵活|平衡))$/.test(type);
}
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function validRows(quarter, year) {
  const expectedDate = {1:'03-31', 2:'06-30', 3:'09-30', 4:'12-31'}[quarter.quarter];
  return quarter.year === year && quarter.key === year + '-Q' + quarter.quarter &&
    quarter.reportDate === year + '-' + expectedDate &&
    quarter.rows?.length === 10 &&
    new Set(quarter.rows.map(h => h.stockCode)).size === 10 &&
    quarter.rows.every((h, i) => h.rank === i + 1 && /^\d{5,6}$/.test(h.stockCode) &&
      typeof h.marketValue10kCny === 'number' && Number.isFinite(h.marketValue10kCny) && h.marketValue10kCny > 0);
}
function validateInputs(universe, industries) {
  const publicCohort=universe?.schemaVersion===2 && universe.verificationBasis==='complete-published-quarterly-reports' && universe.quarterlyReportWindowVerified===true;
  if ((!publicCohort && (universe?.schemaVersion!==1 || universe.historicalMembershipVerified!==true)) || !universe.source || !universe.reviewedAt || !universe.quarters) throw new Error('Verified quarterly fund universe required');
  const fixedTaxonomy=industries?.schemaVersion===2 && industries.classificationBasis==='fixed-taxonomy-restatement' && industries.mappingVerified===true && industries.taxonomyVersion==='EM2016-level2' && /^[a-f0-9]{64}$/.test(industries.sourceDigest || '') && industries.fixedMap;
  if ((!fixedTaxonomy && (industries?.schemaVersion!==1 || industries.historicalMappingVerified!==true || !industries.quarters)) || industries.taxonomy!=='eastmoney-level2' || !industries.taxonomyVersion || !industries.source || !industries.reviewedAt) throw new Error('Verified quarterly Eastmoney level-2 industry mapping required');
  for (const [key, quarter] of Object.entries(universe.quarters)) {
    quarterIndex(key);
    if (!Array.isArray(quarter.funds) || !quarter.funds.length) throw new Error('Missing quarterly fund members: ' + key);
    const codes = new Set(), products = new Set();
    for (const f of quarter.funds) {
      if (!activeFund(f) || !f.productId || codes.has(f.fundCode) || products.has(f.productId) ||
          !Number.isFinite(f.netAsset10kCny) || f.netAsset10kCny <= 0) throw new Error('Invalid/duplicate quarterly active fund member: ' + key);
      codes.add(f.fundCode); products.add(f.productId);
    }
    if (!fixedTaxonomy && (!industries.quarters[key] || typeof industries.quarters[key] !== 'object')) throw new Error('Missing quarterly industry map: ' + key);
    if (publicCohort) {
      for (const member of quarter.funds) if (!Number.isFinite(member.netAssetLowerBound10kCny) || !Number.isFinite(member.netAssetUpperBound10kCny) || member.netAssetLowerBound10kCny<0 || member.netAssetLowerBound10kCny>member.netAsset10kCny || member.netAssetUpperBound10kCny<member.netAsset10kCny) throw new Error('Unverified active product NAV bounds');
      if (!Array.isArray(quarter.unclassifiedFunds) || quarter.reportWindow?.complete!==true) throw new Error('Unverified public report cohort bounds');
      for (const pending of quarter.unclassifiedFunds) if (!pending.productId || !Number.isInteger(pending.countUpperBound) || pending.countUpperBound<1 || !Number.isFinite(pending.netAssetUpperBound10kCny) || pending.netAssetUpperBound10kCny<0) throw new Error('Unbounded unclassified product exposure');
    }
  }
}
function verifiedReportScopeSource(e,member){
 const source=e.source;if(!source||!/^[a-f0-9]{64}$/.test(source.hash||''))return false;
 if(e.extractionMethod==='complete-PDF-layout')return e.documentSha256===source.hash&&new RegExp('^https://pdf[.]dfcfw[.]com/pdf/H[0-9]{1,2}_'+e.id+'_1[.]pdf$').test(source.url);
 if(e.extractionMethod!=='complete-official-disclosure-text')return false;
 require('./fund-disclosure-text').validateDisclosureTextSource(source);
 return e.textSourceHash===source.hash&&e.textChunks===source.chunks.length&&Array.isArray(e.reportedFundCodes)&&e.reportedFundCodes.some(c=>c===member.fundCode||member.memberFundCodes?.includes(c));
}
async function collect({ funds = [], industries, years, universe, fetchImpl, reportHoldings = [], reportScopeEvidence = [], concurrency = 4, onProgress = () => {} }) {
  if (!Array.isArray(funds) || !industries || !Array.isArray(years) ||
      !years.length || years.some(y => !Number.isInteger(y) || y < 1990 || y > 2100) ||
      new Set(years).size !== years.length) throw new TypeError('Invalid collection inputs');
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new Error('concurrency must be between 1 and 8');
  if (universe) validateInputs(universe, industries);
  const memberIndex=new Map(),eligibleYears=new Map();
  if(universe)for(const [key,q] of Object.entries(universe.quarters)) {
    memberIndex.set(key,new Map(q.funds.map(f=>[f.fundCode,f])));
    for(const fund of q.funds){if(!eligibleYears.has(fund.fundCode))eligibleYears.set(fund.fundCode,new Set());eligibleYears.get(fund.fundCode).add(Number(key.slice(0,4)));}
  }
  const selected = universe
    ? [...new Map(Object.values(universe.quarters).flatMap(q => q.funds).map(f => [f.fundCode, f])).values()]
    : deduplicateFundShares(funds.filter(activeFund));
  if (!selected.length) throw new Error('No verified active equity funds');
  const equityScope=universe?.equityScope || 'all-equities';
  const reportIndex=new Map(),scopeReviewed=new Set();
  for(const evidence of reportHoldings){
    require('./fund-report-holdings').validateReportHoldings(evidence);
    const member=memberIndex.get(evidence.quarter)?.get(evidence.fundCode)||universe?.quarters[evidence.quarter]?.funds.find(f=>f.memberFundCodes?.includes(evidence.fundCode));
    if(!member)continue;
    if(member.fundName.normalize('NFKC').replace(/\s+/g,'')!==evidence.productName.normalize('NFKC').replace(/\s+/g,''))throw new Error('Report holdings do not match target-quarter product');
    if(evidence.reportClassification?.status==='excluded')throw new Error('Report scope excludes a product still present in the input universe');
    const key=evidence.quarter+':'+member.fundCode,previous=reportIndex.get(key);
    if(previous){if(previous.id===evidence.id&&previous.stockValueCny===evidence.stockValueCny&&hash(JSON.stringify(previous.rows))===hash(JSON.stringify(evidence.rows)))continue;throw new Error('Conflicting verified report holdings');}
    reportIndex.set(key,evidence);
    if(evidence.reportParserVersion===2&&['active','unresolved'].includes(evidence.reportClassification?.status))scopeReviewed.add(key);
  }
  for(const e of reportScopeEvidence){
    const member=memberIndex.get(e.quarter)?.get(e.fundCode)||universe?.quarters[e.quarter]?.funds.find(f=>f.memberFundCodes?.includes(e.fundCode));
    if(!member||e.reportParserVersion!==2)continue;
    const identity=require('./fund-report-evidence').reportIdentity(e.source?.title);
    if(!identity||identity.quarter!==e.quarter||identity.productName!==e.productName||!['active','unresolved','excluded'].includes(e.classification?.status)||!Number.isFinite(Date.parse(e.source?.downloadedAt))||e.productName.normalize('NFKC').replace(/\s+/g,'')!==member.fundName.normalize('NFKC').replace(/\s+/g,'')||!verifiedReportScopeSource(e,member)||e.source?.id!==e.id||
      !/^AN\d+$/.test(e.id||'')||
      member.evidence?.reportIds&&!member.evidence.reportIds.includes(e.id))throw new Error('Unverified dated report scope');
    if(e.classification?.status==='excluded')throw new Error('Report scope excludes a product still present in the input universe');
    scopeReviewed.add(e.quarter+':'+member.fundCode);
  }
  if (!['all-equities','mainland-A'].includes(equityScope)) throw new Error('Unsupported equity scope');
  const quarters = new Map();
  for (const year of years) for (let q = 1; q <= 4; q++) {
    const key = year + '-Q' + q;
    quarters.set(key, {quarter:key, holdings:[], successful:0, stockCount:0, unmapped:0,
      totalMarketValue:0, grossMarketValue:0,nonAMarketValue:0,nonAStockCount:0,mappedMarketValue:0, successfulNetAssets:0, successfulFunds:[], sourceReports:[], unmappedStockCodes:[], scopeReviewFundCodes:[], rejectedReports:[], errors:[]});
  }
  const jobs=selected.flatMap(fund=>years.filter(year=>!universe || eligibleYears.get(fund.fundCode)?.has(year)).map(year=>({fund,year})));
  let cursor = 0;
  await Promise.all(Array.from({length:Math.min(concurrency, jobs.length)}, async () => {
    while (cursor < jobs.length) {
      const {fund, year} = jobs[cursor++];
      const required=universe?[...memberIndex].filter(([key,members])=>key.startsWith(year+'-Q')&&members.has(fund.fundCode)).map(([key])=>key):[];
      const originalReportsComplete=required.length>0&&required.every(key=>reportIndex.has(key+':'+fund.fundCode));
      let portfolio={quarters:[],source:null};
      try { if(!originalReportsComplete)portfolio = await queryFundPortfolio(fund.fundCode, year, {fetchImpl, timeoutMs:20000}); }
      catch (error) { onProgress({fund:fund.fundCode,year,error:error.message}); portfolio={quarters:[],source:null}; }
      for(let q=1;q<=4;q++){
        const key=year+'-Q'+q,evidence=reportIndex.get(key+':'+fund.fundCode);
        if(!evidence||portfolio.quarters.filter(q=>q.key===key).length>1)continue;
        portfolio.quarters=portfolio.quarters.filter(q=>q.key!==key);
        portfolio.quarters.push({key,year,quarter:q,reportDate:evidence.reportDate,rows:evidence.rows,completeReport:true,
          source:{...evidence.source,fetchedAt:evidence.source.downloadedAt,completeness:{quoteSha256:evidence.quoteSha256,stockValueCny:evidence.stockValueCny,rowCount:evidence.rows.length,documentSha256:evidence.documentSha256}}});
      }
      // A historic main code can stop serving holdings while a verified fee-class alias still serves the same product.
      for(let q=1;q<=4;q++){
        const key=year+'-Q'+q,member=memberIndex.get(key)?.get(fund.fundCode);
        const present=portfolio.quarters.filter(q=>q.key===key);
        if(!member||present.length>1||present.length===1&&(present[0].completeReport||validRows(present[0],year)))continue;
        for(const alias of member.memberFundCodes||[]){
          if(alias===fund.fundCode)continue;
          try{
            const alternate=await queryFundPortfolio(alias,year,{fetchImpl,timeoutMs:20000});
            const matches=alternate.quarters.filter(q=>q.key===key);
            if(matches.length!==1||!validRows(matches[0],year))continue;
            portfolio.quarters=portfolio.quarters.filter(q=>q.key!==key);
            portfolio.quarters.push({...matches[0],source:{...alternate.source,holdingFundCode:alias}});break;
          }catch(error){onProgress({fund:fund.fundCode,alias,year,error:error.message});}
        }
      }
      const responseQuarters = new Set();
      for (const quarter of portfolio.quarters) {
        const row = quarters.get(quarter.key);
        const member = memberIndex.get(quarter.key)?.get(fund.fundCode);
        if (!row || (universe && !member)) continue;
        if (responseQuarters.has(quarter.key)) {
          row.errors.push(fund.fundCode + ': duplicate quarterly report');continue;
        }
        responseQuarters.add(quarter.key);
        if(!quarter.completeReport&&!validRows(quarter,year)) {
          row.rejectedReports.push(fund.fundCode + ': incomplete or invalid quarterly holdings');continue;
        }
        const hasConfirmedA=quarter.rows.some(h=>/^(?:[03468]\d{5}|92\d{4})$/.test(h.stockCode)&&h.market!=='non-A'&&(h.market==='mainland-A'||industries.securityIdentities?.[h.stockCode]?.names.includes(String(h.stockName||'').normalize('NFKC').replace(/\s+/g,''))));
        if(equityScope==='mainland-A'&&!hasConfirmedA&&!scopeReviewed.has(quarter.key+':'+fund.fundCode)){
          row.scopeReviewFundCodes.push(fund.fundCode);row.rejectedReports.push(fund.fundCode+': dated scope review required for a portfolio without confirmed A-shares');continue;
        }
        row.successful++;
        row.successfulFunds.push(fund.fundCode);
        row.sourceReports.push({fundCode:fund.fundCode, year, ...(quarter.source||portfolio.source)});
        row.successfulNetAssets += member?.netAssetLowerBound10kCny ?? member?.netAsset10kCny ?? 0;
        const mapping = universe ? (industries.fixedMap || industries.quarters[quarter.key]) : industries;
        for (const h of quarter.rows) {
          row.grossMarketValue += h.marketValue10kCny;
          if (equityScope==='mainland-A' && (h.market==='non-A'||!/^(?:[03468]\d{5}|92\d{4})$/.test(h.stockCode))) {row.nonAMarketValue+=h.marketValue10kCny;row.nonAStockCount++;continue;}
          row.stockCount++;
          row.totalMarketValue += h.marketValue10kCny;
          const identity=industries.securityIdentities?.[h.stockCode];
          const identityMatches=h.market==null&&identity?.names.includes(String(h.stockName||'').normalize('NFKC').replace(/\s+/g,''));
          const industry = equityScope==='mainland-A' && h.market!=='mainland-A'&&!identityMatches?null:mapping[h.stockCode];
          if (typeof industry !== 'string' || !industry.trim()) { row.unmapped++;row.unmappedStockCodes.push(h.stockCode);continue; }
          row.mappedMarketValue += h.marketValue10kCny;
          row.holdings.push({industry, marketValue:h.marketValue10kCny, activeEquity:true, indexFund:false});
        }
      }
      onProgress({fund:fund.fundCode, year, quarters:portfolio.quarters.length});
    }
  }));
  const snapshots = [...quarters.values()].map(q => {
    const members = universe?.quarters[q.quarter]?.funds || [];
    const pending=universe?.quarters[q.quarter]?.unclassifiedFunds || [];
    const pendingCount=pending.reduce((n,p)=>n+p.countUpperBound,0);
    const eligibleCount=members.length+pendingCount;
    const eligibleNetAssets = members.reduce((sum, f) => sum + (f.netAssetUpperBound10kCny ?? f.netAsset10kCny), 0)+pending.reduce((n,p)=>n+p.netAssetUpperBound10kCny,0);
    const fundCoverage = eligibleCount ? q.successful / eligibleCount : 0;
    const assetCoverage = eligibleNetAssets ? q.successfulNetAssets / eligibleNetAssets : 0;
    const mappingCoverage = q.totalMarketValue ? q.mappedMarketValue / q.totalMarketValue : 0;
    // Counts alone cannot establish coverage; protect against small-fund or mapping bias.
    const coverage = universe && !q.errors.length ? Math.min(fundCoverage, assetCoverage, mappingCoverage) : 0;
    return {...q,unmappedStockCodes:[...new Set(q.unmappedStockCodes)].sort(),eligibleFundCount:eligibleCount || null,eligibleNetAssets,unclassifiedCountUpperBound:pendingCount,
      fundCoverage, assetCoverage, mappingCoverage, coverage,
      taxonomyVersion:universe ? industries.taxonomyVersion : null};
  });
  return {fundCount:selected.length, snapshots, result:calculateIndustryCrowding(snapshots,{industryUniverse:industries.industryUniverse,requireVariableHistory:universe?.schemaVersion===2})};
}
function createSnapshot(collection, {universe, industries, now = new Date().toISOString()}) {
  validateInputs(universe, industries);
  const {result, snapshots, fundCount} = collection;
  if (!result.latestQuarter || !result.rows.length) throw new Error('Insufficient validated coverage; existing snapshot retained');
  // Do not quietly publish an old quarter when the requested latest quarter failed.
  const requestedLatest = Object.keys(universe.quarters).sort((a,b) => quarterIndex(a) - quarterIndex(b)).at(-1);
  if (requestedLatest !== result.latestQuarter) throw new Error('Latest requested quarter has insufficient coverage; existing snapshot retained');
  return {schemaVersion:1, calculationVersion:universe.schemaVersion===2?3:CALCULATION_VERSION, updatedAt:now,
    equityScope:universe.equityScope || 'all-equities',universeBasis:universe.schemaVersion===2?'published-quarterly-reports':'verified-quarterly-universe',classificationBasis:industries.classificationBasis || 'point-in-time',
    source:universe.source + '; ' + industries.source, disclosureBasis:'quarterly-top10',
    taxonomy:industries.taxonomy, taxonomyVersion:industries.taxonomyVersion,
    fundCount, latestQuarter:result.latestQuarter, coverage:result.coverage,
    rows:result.rows, quarterCount:result.quarters.length,
    quarters:result.quarters,
    audit:{universeHash:hash(JSON.stringify(universe)), industryMapHash:hash(JSON.stringify(industries)),
      universeReviewedAt:universe.reviewedAt, industriesReviewedAt:industries.reviewedAt,
      quarters:snapshots.map(({holdings, ...q}) => q)}};
}
function saveSnapshot(output, snapshot) {
  const {validateSavedCrowdingSnapshot} = require('./fund-crowding-snapshot');
  validateSavedCrowdingSnapshot(snapshot);
  fs.mkdirSync(path.dirname(output), {recursive:true});
  if (fs.existsSync(output)) {
    const previous = JSON.parse(fs.readFileSync(output, 'utf8'));
    validateSavedCrowdingSnapshot(previous);
    if (quarterIndex(snapshot.latestQuarter) < quarterIndex(previous.latestQuarter)) throw new Error('Refusing to replace a newer snapshot');
    const replacementKeys = new Set(snapshot.quarters.map(q => q.quarter));
    if (previous.quarters.some(q => !replacementKeys.has(q.quarter))) throw new Error('Refusing to discard existing quarterly history; include all previous quarters');
    const archive = path.join(path.dirname(output), 'active-fund-crowding-history', hash(JSON.stringify(previous)) + '.json');
    fs.mkdirSync(path.dirname(archive), {recursive:true});
    if (!fs.existsSync(archive)) fs.writeFileSync(archive, JSON.stringify(previous) + '\n', {flag:'wx'});
  }
  const temporary = output + '.' + process.pid + '.tmp';
  try { fs.writeFileSync(temporary, JSON.stringify(snapshot) + '\n'); fs.renameSync(temporary, output); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
function cachedFetch(directory, {refresh = false, fetchImpl = fetch, intervalMs = 350} = {}) {
  let queue=Promise.resolve();
  const pace=()=>{const next=queue.then(()=>new Promise(resolve=>setTimeout(resolve,intervalMs)));queue=next;return next;};
  fs.mkdirSync(directory, {recursive:true});
  return async (url, options) => {
    const stable = new URL(url); stable.searchParams.delete('rt');
    const key = hash(stable.href), file = path.join(directory, key + '.json');
    if (!refresh && fs.existsSync(file)) {
      const record = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (record.url !== stable.href || record.hash !== hash(record.body)) throw new Error('Corrupt cached report: ' + file);
      return {ok:true, fundCrowdingSource:{url:record.url,fetchedAt:record.fetchedAt,hash:record.hash}, text:async () => record.body};
    }
    let response;
    for(let attempt=0;attempt<3;attempt++) {
      await pace();
      response=await fetchImpl(url,options);
      if(response.ok || ![429,503,514].includes(response.status) || attempt===2)break;
      const retryAfter=response.headers?.get('retry-after');
      const seconds=retryAfter===null||retryAfter===undefined?NaN:Number(retryAfter);
      const wait=Number.isFinite(seconds)?seconds*1000:retryAfter?Math.max(0,Date.parse(retryAfter)-Date.now()):1000*(attempt+1);
      await response.body?.cancel();
      if(wait>10000)return response;
      await new Promise(resolve=>setTimeout(resolve,Math.max(1000,wait)));
    }
    if (!response.ok) return response;
    const body = await response.text();
    // Never cache an HTML error page or an empty report as a successful disclosure.
    const {parseFundPortfolioText} = require('./fund-portfolio-source');
    if (!parseFundPortfolioText(body).quarters.length) throw new Error('No disclosed quarterly holdings');
    const record = {url:stable.href, fetchedAt:new Date().toISOString(), hash:hash(body), body};
    const temporary = file + '.' + process.pid + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify(record) + '\n');
    try {
      for(let attempt=0;;attempt++) {
        try { fs.renameSync(temporary,file); break; }
        catch(error) {
          if(!['EPERM','EACCES','EEXIST'].includes(error.code))throw error;
          // Windows can briefly lock the destination while another collector publishes it.
          try { const winner=JSON.parse(fs.readFileSync(file,'utf8')); if(winner.url===record.url&&winner.hash===record.hash&&hash(winner.body)===record.hash)break; } catch {}
          if(attempt===9)throw error;
          await new Promise(resolve=>setTimeout(resolve,50));
        }
      }
    } finally { if(fs.existsSync(temporary))fs.unlinkSync(temporary); }
    return {ok:true, fundCrowdingSource:{url:record.url,fetchedAt:record.fetchedAt,hash:record.hash}, text:async () => body};
  };
}
async function main(args = process.argv.slice(2)) {
  const get = flag => { const i=args.indexOf(flag); if(i<0 || !args[i+1] || args[i+1].startsWith('--')) return null; return args[i+1]; };
  const read = flag => { const file=get(flag); if(!file) throw new Error('Missing ' + flag); return JSON.parse(fs.readFileSync(file,'utf8')); };
  const diagnostic = args.includes('--diagnostic');
  const universe = diagnostic ? undefined : read('--universe');
  const industries = read('--industries');
  if (!diagnostic) validateInputs(universe, industries);
  const funds = diagnostic ? read('--funds') : [];
  const currentYear = Number(new Intl.DateTimeFormat('en',{timeZone:'Asia/Shanghai',year:'numeric'}).format(new Date()));
  const yearText = get('--years');
  const years = yearText ? yearText.split(',').map(Number) : universe
    ? [...new Set(Object.keys(universe.quarters).map(q => Number(q.slice(0,4))))]
    : Array.from({length:11},(_,i) => currentYear - 10 + i);
  const cacheDirectory = path.resolve(get('--cache') || 'work/active-fund-crowding-cache');
  const collection = await collect({funds, industries, years, universe,
    reportHoldings:get('--report-holdings')?get('--report-holdings').split(',').flatMap(file=>JSON.parse(fs.readFileSync(file,'utf8')).holdingsEvidence||[]):[],
    reportScopeEvidence:get('--report-holdings')?get('--report-holdings').split(',').flatMap(file=>(JSON.parse(fs.readFileSync(file,'utf8')).histories||[]).flatMap(h=>h.reports.map(r=>r.evidence).filter(Boolean))):[],
    concurrency:Number(get('--concurrency') || 4),
    fetchImpl:cachedFetch(cacheDirectory,{refresh:args.includes('--refresh')}),
    onProgress:event => console.error(JSON.stringify(event))});
  const diagnosticsFile = path.resolve(get('--diagnostics') || 'work/active-fund-crowding-diagnostics.json');
  fs.mkdirSync(path.dirname(diagnosticsFile),{recursive:true});
  fs.writeFileSync(diagnosticsFile, JSON.stringify({diagnosticOnly:diagnostic,
    ...collection, snapshots:collection.snapshots.map(({holdings,...q})=>q)},null,2) + '\n');
  if (diagnostic) { console.log('Diagnostic collection saved; no production snapshot written.'); return; }
  const snapshot = createSnapshot(collection,{universe,industries});
  const output = path.resolve(get('--output') || path.join(__dirname,'data/active-fund-industry-crowding.json'));
  const {createPublicSnapshot} = require('./fund-crowding-snapshot');
  const compact = createPublicSnapshot(snapshot);
  const auditDirectory = path.join(cacheDirectory,'audits');
  fs.mkdirSync(auditDirectory,{recursive:true});
  const auditFile = path.join(auditDirectory,compact.auditDigest + '.json');
  if (fs.existsSync(auditFile)) {
    if (hash(fs.readFileSync(auditFile)) !== compact.auditDigest) throw new Error('Private audit checksum mismatch');
  } else fs.writeFileSync(auditFile,JSON.stringify(snapshot.audit),{flag:'wx'});
  saveSnapshot(output,compact);
  console.log('Saved validated snapshot: ' + output);
}
if (require.main === module) main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports = {activeFund, validRows, validateInputs, collect, createSnapshot, saveSnapshot, cachedFetch, main};
