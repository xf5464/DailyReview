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
module.exports = {validateCrowdingSnapshot};
