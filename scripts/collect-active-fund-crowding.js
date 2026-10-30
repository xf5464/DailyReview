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
function quarterIndex(q) { return Number(q.slice(0,4))*4 + Number(q.slice(-1)); }
async function collect({ funds, industries, years, fetchImpl, onProgress = () => {} }) {
  const selected = deduplicateFundShares(funds.filter(activeFund));
  if (!selected.length) throw new Error('No verified active equity funds');
  const quarters = new Map();
  for (const year of years) for (let q=1;q<=4;q++) quarters.set(year+'-Q'+q,{quarter:year+'-Q'+q,holdings:[],attempted:0,successful:0,unmapped:0});
  for (const fund of selected) {
    for (const year of years) {
      let portfolio;
      try { portfolio = await queryFundPortfolio(fund.fundCode,year,{fetchImpl,timeoutMs:20000}); }
      catch(error) { onProgress({fund:fund.fundCode,year,error:error.message}); continue; }
      for (const quarter of portfolio.quarters) {
        const row=quarters.get(quarter.key);
        if (!row || !quarter.rows?.length) continue;
        row.successful++;
        for (const holding of quarter.rows) {
          const industry=industries[String(holding.stockCode).padStart(6,'0')];
          const marketValue=Number(holding.marketValue10kCny);
          if (!industry || !Number.isFinite(marketValue) || marketValue<=0) { row.unmapped++; continue; }
          row.holdings.push({industry,marketValue,activeEquity:true,indexFund:false});
        }
      }
    }
  }
  const snapshots=[...quarters.values()].filter(q=>q.successful).map(q=>({...q,coverage:q.successful/selected.length}));
  return {fundCount:selected.length,snapshots,result:calculateIndustryCrowding(snapshots)};
}
async function main() {
  const args=process.argv.slice(2);
  const get=flag=>args[args.indexOf(flag)+1];
  if (!args.includes('--funds') || !args.includes('--industries')) throw new Error('Usage: --funds active-fund-list.json --industries stock-industry-map.json [--output file]');
  const funds=JSON.parse(fs.readFileSync(get('--funds'),'utf8'));
  const industries=JSON.parse(fs.readFileSync(get('--industries'),'utf8'));
  const years=Array.from({length:10},(_,i)=>2017+i);
  const {fundCount,snapshots,result}=await collect({funds,industries,years,onProgress:console.error});
  if (!result.latestQuarter || !result.rows.length) throw new Error('Insufficient validated coverage; no snapshot written');
  const output=get('--output') || path.resolve(__dirname,'data/active-fund-industry-crowding.json');
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,JSON.stringify({schemaVersion:1,source:'Eastmoney fund quarterly holdings, manually collected',fundCount,latestQuarter:result.latestQuarter,coverage:result.coverage,rows:result.rows,quarterCount:snapshots.length})+'\\n');
}
if (require.main===module) main().catch(e=>{console.error(e);process.exitCode=1});
module.exports={activeFund,collect};
