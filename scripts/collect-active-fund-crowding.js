'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { queryFundPortfolio, deduplicateFundShares } = require('./fund-portfolio-source');
const { CALCULATION_VERSION, quarterIndex, calculateIndustryCrowding } = require('./active-fund-industry-crowding');

function activeFund(fund) {
  const type = String(fund.type || '');
  if (!/^\d{6}$/.test(String(fund.fundCode || ''))) return false;
  if (/指数|ETF|增强|联接|被动|QDII|FOF|债券|偏债/i.test(type + ' ' + String(fund.fundName || ''))) return false;
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
  if (universe?.schemaVersion !== 1 || !universe.source || !universe.reviewedAt ||
      universe.historicalMembershipVerified !== true || !universe.quarters) throw new Error('Verified quarterly fund universe required');
  if (industries?.schemaVersion !== 1 || industries.taxonomy !== 'eastmoney-level2' ||
      !industries.taxonomyVersion || !industries.source || !industries.reviewedAt ||
      industries.historicalMappingVerified !== true || !industries.quarters) throw new Error('Verified quarterly Eastmoney level-2 industry mapping required');
  for (const [key, quarter] of Object.entries(universe.quarters)) {
    quarterIndex(key);
    if (!Array.isArray(quarter.funds) || !quarter.funds.length) throw new Error('Missing quarterly fund members: ' + key);
    const codes = new Set(), products = new Set();
    for (const f of quarter.funds) {
      if (!activeFund(f) || !f.productId || codes.has(f.fundCode) || products.has(f.productId) ||
          !Number.isFinite(f.netAsset10kCny) || f.netAsset10kCny <= 0) throw new Error('Invalid/duplicate quarterly active fund member: ' + key);
      codes.add(f.fundCode); products.add(f.productId);
    }
    if (!industries.quarters[key] || typeof industries.quarters[key] !== 'object') throw new Error('Missing quarterly industry map: ' + key);
  }
}
async function collect({ funds = [], industries, years, universe, fetchImpl, concurrency = 4, onProgress = () => {} }) {
  if (!Array.isArray(funds) || !industries || !Array.isArray(years) ||
      !years.length || years.some(y => !Number.isInteger(y) || y < 1990 || y > 2100) ||
      new Set(years).size !== years.length) throw new TypeError('Invalid collection inputs');
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new Error('concurrency must be between 1 and 8');
  if (universe) validateInputs(universe, industries);
  const selected = universe
    ? [...new Map(Object.values(universe.quarters).flatMap(q => q.funds).map(f => [f.fundCode, f])).values()]
    : deduplicateFundShares(funds.filter(activeFund));
  if (!selected.length) throw new Error('No verified active equity funds');
  const quarters = new Map();
  for (const year of years) for (let q = 1; q <= 4; q++) {
    const key = year + '-Q' + q;
    quarters.set(key, {quarter:key, holdings:[], successful:0, stockCount:0, unmapped:0,
      totalMarketValue:0, mappedMarketValue:0, successfulNetAssets:0, successfulFunds:[], sourceReports:[], errors:[]});
  }
  const jobs = selected.flatMap(fund => years.map(year => ({fund, year}))).filter(({fund, year}) =>
    !universe || Object.entries(universe.quarters).some(([key, q]) => key.startsWith(year + '-') && q.funds.some(f => f.fundCode === fund.fundCode)));
  let cursor = 0;
  await Promise.all(Array.from({length:Math.min(concurrency, jobs.length)}, async () => {
    while (cursor < jobs.length) {
      const {fund, year} = jobs[cursor++];
      let portfolio;
      try { portfolio = await queryFundPortfolio(fund.fundCode, year, {fetchImpl, timeoutMs:20000}); }
      catch (error) { onProgress({fund:fund.fundCode,year,error:error.message}); continue; }
      const responseQuarters = new Set();
      for (const quarter of portfolio.quarters) {
        const row = quarters.get(quarter.key);
        const member = universe?.quarters[quarter.key]?.funds.find(f => f.fundCode === fund.fundCode);
        if (!row || (universe && !member)) continue;
        if (responseQuarters.has(quarter.key) || !validRows(quarter, year)) {
          row.errors.push(fund.fundCode + ': invalid or duplicate quarterly report');
          continue;
        }
        responseQuarters.add(quarter.key);
        row.successful++;
        row.successfulFunds.push(fund.fundCode);
        row.sourceReports.push({fundCode:fund.fundCode, year, ...portfolio.source});
        row.successfulNetAssets += member?.netAsset10kCny || 0;
        const mapping = universe ? industries.quarters[quarter.key] : industries;
        for (const h of quarter.rows) {
          row.stockCount++;
          row.totalMarketValue += h.marketValue10kCny;
          const industry = mapping[h.stockCode];
          if (typeof industry !== 'string' || !industry.trim()) { row.unmapped++; continue; }
          row.mappedMarketValue += h.marketValue10kCny;
          row.holdings.push({industry, marketValue:h.marketValue10kCny, activeEquity:true, indexFund:false});
        }
      }
      onProgress({fund:fund.fundCode, year, quarters:portfolio.quarters.length});
    }
  }));
  const snapshots = [...quarters.values()].map(q => {
    const members = universe?.quarters[q.quarter]?.funds || [];
    const eligibleNetAssets = members.reduce((sum, f) => sum + f.netAsset10kCny, 0);
    const fundCoverage = members.length ? q.successful / members.length : 0;
    const assetCoverage = eligibleNetAssets ? q.successfulNetAssets / eligibleNetAssets : 0;
    const mappingCoverage = q.totalMarketValue ? q.mappedMarketValue / q.totalMarketValue : 0;
    // Counts alone cannot establish coverage; protect against small-fund or mapping bias.
    const coverage = universe && !q.errors.length ? Math.min(fundCoverage, assetCoverage, mappingCoverage) : 0;
    return {...q, eligibleFundCount:members.length || null, eligibleNetAssets,
      fundCoverage, assetCoverage, mappingCoverage, coverage,
      taxonomyVersion:universe ? industries.taxonomyVersion : null};
  });
  return {fundCount:selected.length, snapshots, result:calculateIndustryCrowding(snapshots)};
}
function createSnapshot(collection, {universe, industries, now = new Date().toISOString()}) {
  validateInputs(universe, industries);
  const {result, snapshots, fundCount} = collection;
  if (!result.latestQuarter || !result.rows.length) throw new Error('Insufficient validated coverage; existing snapshot retained');
  // Do not quietly publish an old quarter when the requested latest quarter failed.
  const requestedLatest = Object.keys(universe.quarters).sort((a,b) => quarterIndex(a) - quarterIndex(b)).at(-1);
  if (requestedLatest !== result.latestQuarter) throw new Error('Latest requested quarter has insufficient coverage; existing snapshot retained');
  return {schemaVersion:1, calculationVersion:CALCULATION_VERSION, updatedAt:now,
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
function cachedFetch(directory, {refresh = false, fetchImpl = fetch} = {}) {
  fs.mkdirSync(directory, {recursive:true});
  return async (url, options) => {
    const stable = new URL(url); stable.searchParams.delete('rt');
    const key = hash(stable.href), file = path.join(directory, key + '.json');
    if (!refresh && fs.existsSync(file)) {
      const record = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (record.url !== stable.href || record.hash !== hash(record.body)) throw new Error('Corrupt cached report: ' + file);
      return {ok:true, fundCrowdingSource:{url:record.url,fetchedAt:record.fetchedAt,hash:record.hash}, text:async () => record.body};
    }
    const response = await fetchImpl(url, options);
    if (!response.ok) return response;
    const body = await response.text();
    // Never cache an HTML error page or an empty report as a successful disclosure.
    const {parseFundPortfolioText} = require('./fund-portfolio-source');
    if (!parseFundPortfolioText(body).quarters.length) throw new Error('No disclosed quarterly holdings');
    const record = {url:stable.href, fetchedAt:new Date().toISOString(), hash:hash(body), body};
    const temporary = file + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify(record) + '\n');
    fs.renameSync(temporary, file);
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
