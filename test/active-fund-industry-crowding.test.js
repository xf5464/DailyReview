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
  assert.equal(semi.quarterChange,1);
  assert.equal(semi.percentiles[4],100);
  assert.equal(semi.percentiles[12],null);
});
