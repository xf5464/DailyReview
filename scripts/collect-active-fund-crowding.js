'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { queryFundPortfolio, deduplicateFundShares } = require('./fund-portfolio-source');
const { calculateIndustryCrowding } = require('./active-fund-industry-crowding');

// Manual invocation only: node scripts/collect-active-fund-crowding.js --funds path --industries path
function activeFund(fund) {
  const type = String(fund.type || '');
  const name = String(fund.fundName || '');
  if (!/^\d{6}$/.test(String(fund.fundCode || ''))) return false;
  if (/指数|ETF|LOF指数|增强|联接|被动/i.test(type + ' ' + name)) return false;
  return /主动|股票型|偏股混合|灵活配置混合|普通股票|混合型/.test(type);
}
async function collect({ funds, industries, years, eligibleFundCounts = {}, fetchImpl, onProgress = () => {} }) {
  if (!Array.isArray(funds) || !industries || typeof industries !== 'object' || !Array.isArray(years)) throw new TypeError('Invalid collection inputs');
  const selected = deduplicateFundShares(funds.filter(activeFund));
  if (!selected.length) throw new Error('No verified active equity funds');
  const quarters = new Map();
  for (const year of years) for (let q=1;q<=4;q++) quarters.set(year+'-Q'+q,{quarter:year+'-Q'+q,holdings:[],successful:0,unmapped:0,stockCount:0});
  for (const fund of selected) {
    for (const year of years) {
      let portfolio;
      try { portfolio = await queryFundPortfolio(fund.fundCode,year,{fetchImpl,timeoutMs:20000}); }
      catch(error) { onProgress({fund:fund.fundCode,year,error:error.message}); continue; }
      for (const quarter of portfolio.quarters) {
        const row=quarters.get(quarter.key);
        if (!row || !quarter.rows?.length) continue;
        if (!quarter.rows.every(h => Number.isFinite(Number(h.marketValue10kCny)) && Number(h.marketValue10kCny)>0 && /^\d{6}$/.test(String(h.stockCode || '')))) {
          onProgress({fund:fund.fundCode,quarter:quarter.key,error:'Invalid holding values'});
          continue;
        }
        row.successful++;
        for (const holding of quarter.rows) {
          row.stockCount++;
          const industry=industries[String(holding.stockCode).padStart(6,'0')];
          const marketValue=Number(holding.marketValue10kCny);
          if (!industry || !Number.isFinite(marketValue) || marketValue<=0) { row.unmapped++; continue; }
          row.holdings.push({industry,marketValue,activeEquity:true,indexFund:false});
        }
      }
    }
  }
  // A successful HTTP response is not proof of complete holdings or historical fund coverage.
  // Require externally verified eligible-fund counts per quarter; without them no publishable result is produced.
  const eligibleCounts = eligibleFundCounts;
  const snapshots=[...quarters.values()].filter(q=>q.successful).map(q=>{
    const eligible=Number(eligibleCounts[q.quarter]);
    const mapped=q.stockCount-q.unmapped;
    const coverage=Number.isInteger(eligible)&&eligible>0&&q.successful<=eligible&&q.stockCount>0
      ? (q.successful/eligible)*(mapped/q.stockCount) : 0;
    return {...q,eligibleFundCount:eligible||null,coverage};
  });
  return {fundCount:selected.length,snapshots,result:calculateIndustryCrowding(snapshots)};
}
async function main() {
  const args=process.argv.slice(2);
  const get=flag=>args[args.indexOf(flag)+1];
  if (!args.includes('--funds') || !args.includes('--industries')) throw new Error('Usage: --funds active-fund-list.json --industries stock-industry-map.json [--output file]');
  const funds=JSON.parse(fs.readFileSync(get('--funds'),'utf8'));
  const industries=JSON.parse(fs.readFileSync(get('--industries'),'utf8'));
  const years=Array.from({length:10},(_,i)=>2017+i);
  if (!args.includes('--eligible-counts')) throw new Error('Verified quarterly eligible fund counts required: --eligible-counts file.json');
  const eligibleFundCounts=JSON.parse(fs.readFileSync(get('--eligible-counts'),'utf8'));
  const {fundCount,snapshots,result}=await collect({funds,industries,years,eligibleFundCounts,onProgress:console.error});
  if (!result.latestQuarter || !result.rows.length) throw new Error('Insufficient validated coverage; no snapshot written');
  const output=get('--output') || path.resolve(__dirname,'data/active-fund-industry-crowding.json');
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,JSON.stringify({schemaVersion:1,source:'Eastmoney fund quarterly holdings, manually collected',fundCount,latestQuarter:result.latestQuarter,coverage:result.coverage,rows:result.rows,quarterCount:snapshots.length})+'\\n');
}
if (require.main===module) main().catch(e=>{console.error(e);process.exitCode=1});
module.exports={activeFund,collect};
