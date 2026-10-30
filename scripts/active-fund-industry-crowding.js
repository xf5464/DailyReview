'use strict';

// Quarterly holdings must be sourced from disclosed active-equity fund positions.
// Never treat a missing quarter or incomplete universe as zero exposure.
function calculateIndustryCrowding(quarters, options = {}) {
  const minimumCoverage = options.minimumCoverage ?? 0.9;
  const periods = [4, 12, 20, 40];
  const normalized = quarters.filter(q => q && /^\\d{4}-Q[1-4]$/.test(q.quarter || '') && Array.isArray(q.holdings))
    .map(q => {
      const coverage = Number(q.coverage);
      if (!Number.isFinite(coverage) || coverage < minimumCoverage || coverage > 1) return null;
      const byIndustry = new Map();
      let total = 0;
      for (const holding of q.holdings) {
        if (!holding || !holding.industry || !holding.activeEquity || holding.indexFund) continue;
        const value = Number(holding.marketValue);
        if (!Number.isFinite(value) || value <= 0) continue;
        total += value;
        byIndustry.set(holding.industry, (byIndustry.get(holding.industry) || 0) + value);
      }
      if (!total) return null;
      return { quarter: q.quarter, coverage, shares: Object.fromEntries([...byIndustry].map(([name, value]) => [name, value / total * 100])) };
    }).filter(Boolean).sort((a,b) => a.quarter.localeCompare(b.quarter));
  const latest = normalized.at(-1);
  if (!latest) return { latestQuarter: null, rows: [], quarters: [] };
  const previous = normalized.at(-2);
  const rows = Object.entries(latest.shares).map(([industry, share]) => {
    const history = normalized.filter(q => Number.isFinite(q.shares[industry]));
    const percentiles = {};
    for (const n of periods) {
      // n quarters requires n+1 observations to span the full period.
      const window = history.slice(-(n+1));
      const latestIndex = window.at(-1)?.quarter;
      const first = window[0]?.quarter;
      const quarterIndex = q => Number(q.slice(0,4))*4 + Number(q.slice(-1));
      percentiles[n] = window.length >= n+1 && quarterIndex(latestIndex)-quarterIndex(first) >= n
        ? 100 * window.filter(q => q.shares[industry] <= share).length / window.length : null;
    }
    return { industry, share, quarterChange: previous && Number.isFinite(previous.shares[industry]) ? share - previous.shares[industry] : null,
      percentiles, history: history.map(q => ({ quarter:q.quarter, share:q.shares[industry] })) };
  }).sort((a,b) => (b.percentiles[40] ?? -1)-(a.percentiles[40] ?? -1) || b.share-a.share);
  return { latestQuarter:latest.quarter, coverage:latest.coverage, rows, quarters:normalized };
}
module.exports = { calculateIndustryCrowding };
