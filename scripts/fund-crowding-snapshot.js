'use strict';
const {quarterIndex} = require('./active-fund-industry-crowding');
function validateCrowdingSnapshot(snapshot) {
  const invalid = message => {throw new Error('Invalid approved active fund crowding snapshot: ' + message);};
  const number = (n, lo, hi) => typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;
  if (snapshot?.schemaVersion !== 1 || snapshot.calculationVersion !== 2 ||
      snapshot.disclosureBasis !== 'quarterly-top10' || snapshot.taxonomy !== 'eastmoney-level2' ||
      !snapshot.taxonomyVersion || !snapshot.source || !Number.isFinite(Date.parse(snapshot.updatedAt)) ||
      !number(snapshot.coverage,0.9,1)) invalid('metadata');
  if (!Array.isArray(snapshot.rows) || !snapshot.rows.length || !Array.isArray(snapshot.quarters) ||
      snapshot.quarterCount !== snapshot.quarters.length || !snapshot.quarters.length) invalid('rows or history missing');
  if (!snapshot.audit || !/^[a-f0-9]{64}$/.test(snapshot.audit.universeHash || '') ||
      !/^[a-f0-9]{64}$/.test(snapshot.audit.industryMapHash || '') ||
      !snapshot.audit.universeReviewedAt || !snapshot.audit.industriesReviewedAt ||
      !Array.isArray(snapshot.audit.quarters)) invalid('audit trail missing');
  let previous = -1;
  for (const q of snapshot.quarters) {
    const index = quarterIndex(q.quarter);
    if (index <= previous || !number(q.coverage,0.9,1) ||
        q.taxonomyVersion !== snapshot.taxonomyVersion || !q.shares || !Object.keys(q.shares).length ||
        Object.values(q.shares).some(n => !number(n,0,100)) ||
        Object.values(q.shares).reduce((a,b)=>a+b,0) > 100.000001) invalid('quarterly history');
    const audit = snapshot.audit.quarters.find(a => a.quarter === q.quarter);
    if (!audit || !Number.isInteger(snapshot.fundCount) || snapshot.fundCount < 1 || !number(audit.fundCoverage,0.9,1) || !number(audit.assetCoverage,0.9,1) ||
        !number(audit.mappingCoverage,0.9,1) || audit.coverage !== q.coverage ||
        audit.coverage !== Math.min(audit.fundCoverage,audit.assetCoverage,audit.mappingCoverage) ||
        !Array.isArray(audit.successfulFunds) || new Set(audit.successfulFunds).size !== audit.successful ||
        !Number.isInteger(audit.eligibleFundCount) || audit.eligibleFundCount <= 0 ||
        audit.successful / audit.eligibleFundCount !== audit.fundCoverage ||
        audit.successfulNetAssets / audit.eligibleNetAssets !== audit.assetCoverage ||
        audit.mappedMarketValue / audit.totalMarketValue !== audit.mappingCoverage ||
        !Array.isArray(audit.sourceReports) || audit.sourceReports.length !== audit.successful ||
        audit.sourceReports.some(r => !audit.successfulFunds.includes(r.fundCode) ||
          !/^[a-f0-9]{64}$/.test(r.hash || '') || !Number.isFinite(Date.parse(r.fetchedAt)) ||
          !String(r.url || '').startsWith('https://fundf10.eastmoney.com/FundArchivesDatas.aspx?')) ||
        !Array.isArray(audit.errors) || audit.errors.length) invalid('quarterly coverage');
    previous = index;
  }
  const latest = snapshot.quarters.at(-1);
  if (snapshot.latestQuarter !== latest.quarter || snapshot.coverage !== latest.coverage) invalid('latest quarter');
  const industries = new Set();
  for (const row of snapshot.rows) {
    if (typeof row.industry !== 'string' || !row.industry || industries.has(row.industry) ||
        !number(row.share,0,100) || row.share !== latest.shares[row.industry] ||
        !(row.quarterChange === null || number(row.quarterChange,-100,100)) ||
        !Array.isArray(row.history) || !row.history.length || !row.percentiles) invalid('industry row');
    industries.add(row.industry);
    for (const p of [4,12,20,40]) if (!(row.percentiles[p] === null || number(row.percentiles[p],0,100))) invalid('percentile');
    const expected = snapshot.quarters.filter(q => Number.isFinite(q.shares[row.industry]));
    if (row.history.length !== expected.length || row.history.some((point,i) =>
      point.quarter !== expected[i].quarter || point.share !== expected[i].shares[row.industry])) invalid('industry history');
  }
  if (industries.size !== Object.keys(latest.shares).length) invalid('missing industries');
  return snapshot;
}
function createPublicSnapshot(snapshot) {
  validateCrowdingSnapshot(snapshot);
  const round = value => Number.isFinite(value) ? Number(value.toFixed(8)) : null;
  const industries = [...new Set(snapshot.quarters.flatMap(q => Object.keys(q.shares)))].sort();
  const summaryByQuarter = new Map(snapshot.audit.quarters.map(q => [q.quarter,q]));
  const quarters = snapshot.quarters.map(q => {
    const summary = summaryByQuarter.get(q.quarter);
    return {quarter:q.quarter, coverage:q.coverage, fundCount:summary.successful,
      eligibleFundCount:summary.eligibleFundCount,
      fundCoverage:summary.fundCoverage, assetCoverage:summary.assetCoverage, mappingCoverage:summary.mappingCoverage,
      shares:industries.map(industry => round(q.shares[industry]))};
  });
  const result = {
    schemaVersion:2, calculationVersion:snapshot.calculationVersion,
    source:snapshot.source, updatedAt:snapshot.updatedAt, disclosureBasis:snapshot.disclosureBasis,
    taxonomy:snapshot.taxonomy, taxonomyVersion:snapshot.taxonomyVersion,
    fundCount:snapshot.fundCount, latestQuarter:snapshot.latestQuarter,
    coverage:snapshot.coverage, quarterCount:quarters.length, industries, quarters,
    rows:snapshot.rows.map(row => ({industry:row.industry, share:round(row.share),
      quarterChange:round(row.quarterChange),
      percentiles:Object.fromEntries([4,12,20,40].map(n => [n,round(row.percentiles[n])]))})),
    auditDigest:require('node:crypto').createHash('sha256').update(JSON.stringify(snapshot.audit)).digest('hex'),
    inputHashes:{universe:snapshot.audit.universeHash,industries:snapshot.audit.industryMapHash},
  };
  return validatePublicCrowdingSnapshot(result);
}
function validatePublicCrowdingSnapshot(snapshot) {
  const invalid = message => {throw new Error('Invalid compact active fund crowding snapshot: ' + message);};
  const finite = (n, lo, hi) => typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;
  if (snapshot?.schemaVersion !== 2 || snapshot.calculationVersion !== 2 ||
      snapshot.disclosureBasis !== 'quarterly-top10' || snapshot.taxonomy !== 'eastmoney-level2' ||
      !snapshot.taxonomyVersion || !snapshot.source || !Number.isFinite(Date.parse(snapshot.updatedAt)) ||
      !Number.isInteger(snapshot.fundCount) || snapshot.fundCount < 1 ||
      !finite(snapshot.coverage,0.9,1) || !/^[a-f0-9]{64}$/.test(snapshot.auditDigest || '') ||
      !/^[a-f0-9]{64}$/.test(snapshot.inputHashes?.universe || '') ||
      !/^[a-f0-9]{64}$/.test(snapshot.inputHashes?.industries || '')) invalid('metadata');
  if (!Array.isArray(snapshot.industries) || !snapshot.industries.length ||
      snapshot.industries.some(i => typeof i !== 'string' || !i.trim()) ||
      new Set(snapshot.industries).size !== snapshot.industries.length ||
      !Array.isArray(snapshot.quarters) || !snapshot.quarters.length ||
      snapshot.quarterCount !== snapshot.quarters.length || !Array.isArray(snapshot.rows) || !snapshot.rows.length) invalid('dimensions');
  // Permit only aggregate fields; raw fund identities and report details stay local.
  const topKeys = new Set(['schemaVersion','calculationVersion','source','updatedAt','disclosureBasis','taxonomy','taxonomyVersion','fundCount','latestQuarter','coverage','quarterCount','industries','quarters','rows','auditDigest','inputHashes']);
  if (Object.keys(snapshot).some(k => !topKeys.has(k)) ||
      Object.keys(snapshot.inputHashes).some(k => !['universe','industries'].includes(k))) invalid('non-aggregate fields');
  let previous = -1;
  for (const q of snapshot.quarters) {
    const index = quarterIndex(q.quarter);
    if (index <= previous || !finite(q.coverage,0.9,1) ||
        !Number.isInteger(q.fundCount) || !Number.isInteger(q.eligibleFundCount) ||
        q.fundCount < 1 || q.eligibleFundCount < q.fundCount ||
        q.fundCoverage !== q.fundCount/q.eligibleFundCount ||
        !finite(q.assetCoverage,0.9,1) || !finite(q.mappingCoverage,0.9,1) ||
        q.coverage !== Math.min(q.fundCoverage,q.assetCoverage,q.mappingCoverage) ||
        !Array.isArray(q.shares) || q.shares.length !== snapshot.industries.length ||
        q.shares.every(n => n === null) || q.shares.some(n => n !== null && !finite(n,0,100)) ||
        q.shares.reduce((sum,n)=>sum+(n || 0),0) > 100.000001 ||
        Object.keys(q).some(k => !['quarter','coverage','fundCount','eligibleFundCount','fundCoverage','assetCoverage','mappingCoverage','shares'].includes(k))) invalid('quarterly aggregates');
    previous = index;
  }
  const latest = snapshot.quarters.at(-1);
  if (snapshot.latestQuarter !== latest.quarter || snapshot.coverage !== latest.coverage) invalid('latest quarter');
  const seen = new Set();
  for (const row of snapshot.rows) {
    const index = snapshot.industries.indexOf(row.industry);
    if (index < 0 || seen.has(row.industry) || !finite(row.share,0,100) ||
        row.share !== latest.shares[index] ||
        !(row.quarterChange === null || finite(row.quarterChange,-100,100)) ||
        !row.percentiles || Object.keys(row.percentiles).some(n => !['4','12','20','40'].includes(n)) ||
        [4,12,20,40].some(n => !(row.percentiles[n] === null || finite(row.percentiles[n],0,100))) ||
        Object.keys(row).some(k => !['industry','share','quarterChange','percentiles'].includes(k))) invalid('ranking');
    seen.add(row.industry);
  }
  if (seen.size !== latest.shares.filter(n=>n!==null).length) invalid('missing ranked industry');
  return snapshot;
}
function validateSavedCrowdingSnapshot(snapshot) {
  return snapshot?.schemaVersion === 2 ? validatePublicCrowdingSnapshot(snapshot) : validateCrowdingSnapshot(snapshot);
}
module.exports = {validateCrowdingSnapshot,createPublicSnapshot,validatePublicCrowdingSnapshot,validateSavedCrowdingSnapshot};
