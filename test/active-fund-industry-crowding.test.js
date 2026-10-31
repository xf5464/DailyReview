const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateIndustryCrowding } = require('../scripts/active-fund-industry-crowding');

test('only disclosed active-equity holdings contribute to industry weights', () => {
  const result = calculateIndustryCrowding([{quarter:'2026-Q3',coverage:1,holdings:[
    {industry:'半导体',marketValue:60,activeEquity:true},
    {industry:'银行',marketValue:40,activeEquity:true},
    {industry:'半导体',marketValue:900,activeEquity:true,indexFund:true},
    {industry:'银行',marketValue:100,activeEquity:false}
  ]}]);
  assert.equal(result.rows.find(x=>x.industry==='半导体').share,60);
  assert.equal(result.rows.find(x=>x.industry==='银行').share,40);
  assert.equal(result.rows[0].percentiles[40],null);
});

test('insufficient coverage is excluded rather than interpreted as zero',()=>{
  const result=calculateIndustryCrowding([{quarter:'2026-Q3',coverage:0.5,holdings:[{industry:'银行',marketValue:100,activeEquity:true}]}]);
  assert.equal(result.latestQuarter,null);
});

test('quarterly changes and 1 year percentile need continuous historical span',()=>{
  const quarters=Array.from({length:5},(_,i)=>({quarter:(2025+Math.floor(i/4))+'-Q'+(i%4+1),coverage:1,holdings:[
    {industry:'半导体',marketValue:10+i,activeEquity:true},{industry:'银行',marketValue:90-i,activeEquity:true}
  ]}));
  const result=calculateIndustryCrowding(quarters);
  const semi=result.rows.find(x=>x.industry==='半导体');
  assert.ok(Math.abs(semi.quarterChange - 1) < 1e-9);
  assert.equal(semi.percentiles[4],100);
  assert.equal(semi.percentiles[12],null);
});

test('duplicate quarterly snapshots are rejected',()=>{
  const q={quarter:'2026-Q3',coverage:1,holdings:[{industry:'银行',marketValue:1,activeEquity:true}]};
  assert.throws(()=>calculateIndustryCrowding([q,q]),/Duplicate quarterly holdings snapshot/);
});

test('regular build only copies approved static snapshots',()=>{
  const fs=require('node:fs');const path=require('node:path');
  const build=fs.readFileSync(path.join(__dirname,'../scripts/build.js'),'utf8');
  assert.match(build,/active-fund-industry-crowding\.json/);
  assert.doesNotMatch(build,/calculateIndustryCrowding\(/);
});

test('A-share group shows only a snapshot-backed top-five summary row',()=>{
 const fs=require('node:fs');const path=require('node:path');
 const html=fs.readFileSync(path.join(__dirname,'../site/index.html'),'utf8');
 const app=fs.readFileSync(path.join(__dirname,'../site/app.js'),'utf8');
 assert.doesNotMatch(html,/id="activeFundCrowdingPanel"/);
 assert.match(html,/id="overallTableBody"/);
 assert.match(app,/config.selectedGroupId !== 'group_a_share'/);
 assert.match(app,/appendActiveFundTopFiveRow/);
 assert.match(app,/slice\(0, 5\)/);
 assert.match(app,/sum \+ item.share/);
 assert.ok(app.includes("fetch('data/active-fund-industry-crowding.json')"));
 assert.equal(app.includes('queryFundPortfolio('), false);
});
