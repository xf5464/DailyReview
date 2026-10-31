'use strict';

const CALCULATION_VERSION = 2;
function quarterIndex(quarter) {
  if (!/^\d{4}-Q[1-4]$/.test(quarter || '')) throw new Error('Invalid quarter: ' + quarter);
  return Number(quarter.slice(0, 4)) * 4 + Number(quarter.slice(-1)) - 1;
}
function calculateIndustryCrowding(quarters, options = {}) {
  const minimumCoverage = options.minimumCoverage ?? 0.9;
  if (!Array.isArray(quarters)) throw new TypeError('quarters must be an array');
  if (!Number.isFinite(minimumCoverage) || minimumCoverage < 0.9 || minimumCoverage > 1) throw new Error('minimumCoverage must be between 0.9 and 1');
  const seen = new Set();
  const normalized = [];
  for (const q of quarters) {
    if (!q || !/^\d{4}-Q[1-4]$/.test(q.quarter || '') || !Array.isArray(q.holdings)) continue;
    if (seen.has(q.quarter)) throw new Error('Duplicate quarterly holdings snapshot: ' + q.quarter);
    seen.add(q.quarter);
    if (typeof q.coverage !== 'number' || !Number.isFinite(q.coverage) || q.coverage < minimumCoverage || q.coverage > 1) continue;
    const byIndustry = new Map((options.industryUniverse || []).map(name=>[name,0]));
    let mappedTotal = 0;
    for (const h of q.holdings) {
      if (!h || !h.industry || !h.activeEquity || h.indexFund) continue;
      if (typeof h.marketValue !== 'number' || !Number.isFinite(h.marketValue) || h.marketValue <= 0) continue;
      mappedTotal += h.marketValue;
      byIndustry.set(h.industry, (byIndustry.get(h.industry) || 0) + h.marketValue);
    }
    const total = q.totalMarketValue ?? mappedTotal;
    if (!mappedTotal || !Number.isFinite(total) || total < mappedTotal) continue;
    normalized.push({
      quarter: q.quarter, coverage: q.coverage,
      taxonomyVersion: q.taxonomyVersion || null,
      shares: Object.fromEntries([...byIndustry].map(([industry, value]) => [industry, value / total * 100])),
    });
  }
  return rankIndustryQuarters(normalized,options);
}
function rankIndustryQuarters(quarters,options={}) {
  const normalized=[...quarters].sort((a,b)=>quarterIndex(a.quarter)-quarterIndex(b.quarter));
  const latest = normalized.at(-1);
  if (!latest) return { latestQuarter: null, rows: [], quarters: [] };
  const previous = normalized.find(q => quarterIndex(q.quarter) === quarterIndex(latest.quarter) - 1 && q.taxonomyVersion === latest.taxonomyVersion);
  const rows = Object.entries(latest.shares).map(([industry, share]) => {
    // Absence is unknown, not a fabricated zero. Missing quarters break every window.
    const history = normalized.filter(q => q.taxonomyVersion === latest.taxonomyVersion && Number.isFinite(q.shares[industry]));
    const percentiles = {};
    for (const n of [4, 12, 20, 40]) {
      const window = history.filter(q => quarterIndex(q.quarter) >= quarterIndex(latest.quarter) - n);
      percentiles[n] = window.length === n + 1 &&
        window.every((q, i) => quarterIndex(q.quarter) === quarterIndex(latest.quarter) - n + i)
        && (!options.requireVariableHistory || window.some(q=>Math.abs(q.shares[industry]-share)>1e-12))
        ? 100 * window.filter(q => q.shares[industry] <= share).length / window.length : null;
    }
    return { industry, share,
      quarterChange: previous && Number.isFinite(previous.shares[industry]) ? share - previous.shares[industry] : null,
      percentiles, history: history.map(q => ({ quarter: q.quarter, share: q.shares[industry] })),
    };
  }).sort((a, b) => (b.percentiles[40] ?? -1) - (a.percentiles[40] ?? -1) || b.share - a.share);
  return { latestQuarter: latest.quarter, coverage: latest.coverage, rows, quarters: normalized };
}
module.exports = { CALCULATION_VERSION, quarterIndex, calculateIndustryCrowding, rankIndustryQuarters };
