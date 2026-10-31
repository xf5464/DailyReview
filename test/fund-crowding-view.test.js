const test=require('node:test'),assert=require('node:assert/strict');
const {quarterView}=require('../site/fund-crowding-view');
function data(){return {calculationVersion:3,latestQuarter:'2026-Q2',industries:['半导体','银行','无持仓'],quarters:Array.from({length:6},(_,i)=>({quarter:(2025+Math.floor(i/4))+'-Q'+(i%4+1),coverage:0.99,shares:[10+i,90-i,0]})),rows:[{industry:'cached latest',share:15}]};}
test('quarter selection keeps the validated latest ranking and computes historical rows only from that quarter and earlier',()=>{
 const s=data();assert.equal(quarterView(s,'2026-Q2').rows,s.rows);
 const old=quarterView(s,'2026-Q1');const semi=old.rows.find(r=>r.industry==='半导体');
 assert.equal(old.quarter.coverage,0.99);assert.equal(semi.share,14);assert.equal(semi.quarterChange,1);assert.equal(semi.percentiles[4],100);assert.equal(semi.percentiles[12],null);
 s.quarters.at(-1).shares[0]=999;assert.deepEqual(quarterView(s,'2026-Q1'),old);
});
test('historical views do not bridge missing quarters or convert an unknown industry into zero',()=>{
 const s=data();s.quarters.splice(2,1);s.quarters[0].shares[1]=null;
 const view=quarterView(s,'2026-Q1');assert.equal(view.rows.find(r=>r.industry==='半导体').percentiles[4],null);
 assert.equal(quarterView(s,'2025-Q1').rows.some(r=>r.industry==='银行'),false);
 assert.equal(quarterView(s,'2025-Q4').rows.find(r=>r.industry==='银行').quarterChange,null);
 assert.throws(()=>quarterView(s,'2016-Q1'),/not available/);
});
test('fixed zero industries do not receive a high percentile under the new method',()=>{
 const s=data();assert.equal(quarterView(s,'2026-Q1').rows.find(r=>r.industry==='无持仓').percentiles[4],null);
});
test('real published fund snapshot contains only validated quarterly aggregates',()=>{
 const fs=require('fs'),path=require('path');const {validatePublicCrowdingSnapshot}=require('../scripts/fund-crowding-snapshot');
 const file=path.join(__dirname,'../scripts/data/active-fund-industry-crowding.json');
 const raw=fs.readFileSync(file,'utf8');const s=validatePublicCrowdingSnapshot(JSON.parse(raw));
 assert.equal(s.equityScope,'mainland-A');assert.equal(s.classificationBasis,'fixed-taxonomy-restatement');
 assert.ok(s.quarters.every(q=>q.fundCoverage>=0.9&&q.assetCoverage>=0.9&&q.mappingCoverage>=0.9));
 assert.doesNotMatch(raw,/"(?:fundCode|stockCode|holdings|successfulFunds|sourceReports)"/);
});
