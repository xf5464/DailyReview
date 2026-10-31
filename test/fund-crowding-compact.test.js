const test=require('node:test');
const assert=require('node:assert/strict');
const zlib=require('node:zlib');
const {calculateIndustryCrowding}=require('../scripts/active-fund-industry-crowding');
const {createPublicSnapshot,validatePublicCrowdingSnapshot}=require('../scripts/fund-crowding-snapshot');
function snapshot(industryCount=2,quarterCount=5) {
 const first=2016*4+2;
 const quarters=Array.from({length:quarterCount},(_,i)=>{
   const ix=first+i,quarter=Math.floor(ix/4)+'-Q'+(ix%4+1);
   return {quarter,coverage:1,taxonomyVersion:'reviewed-v1',holdings:Array.from({length:industryCount},(_,j)=>({
     industry:'行业'+String(j).padStart(3,'0'),marketValue:1+j+i/10,activeEquity:true
   }))};
 });
 const result=calculateIndustryCrowding(quarters);
 const fundCount=13,funds=Array.from({length:fundCount},(_,i)=>String(i+1).padStart(6,'0'));
 return {schemaVersion:1,calculationVersion:2,updatedAt:'2026-10-30T00:00:00Z',source:'Unit test fixture',
   disclosureBasis:'quarterly-top10',taxonomy:'eastmoney-level2',taxonomyVersion:'reviewed-v1',
   fundCount,latestQuarter:result.latestQuarter,coverage:1,rows:result.rows,quarters:result.quarters,quarterCount,
   audit:{universeHash:'1'.repeat(64),industryMapHash:'2'.repeat(64),universeReviewedAt:'2026-10-30',industriesReviewedAt:'2026-10-30',
     quarters:quarters.map(q=>({quarter:q.quarter,coverage:1,fundCoverage:1,assetCoverage:1,mappingCoverage:1,
       successful:fundCount,eligibleFundCount:fundCount,successfulNetAssets:100,eligibleNetAssets:100,
       totalMarketValue:100,mappedMarketValue:100,successfulFunds:funds,errors:[],
       sourceReports:funds.map(code=>({fundCode:code,url:'https://fundf10.eastmoney.com/FundArchivesDatas.aspx?code='+code,
         fetchedAt:'2026-10-30T00:00:00Z',hash:'a'.repeat(64)}))}))}};
}
test('published data stores one quarterly industry matrix and no fund-level details',()=>{
 const full=snapshot(), compact=createPublicSnapshot(full);
 assert.equal(compact.schemaVersion,2);assert.equal(compact.industries.length,2);
 assert.equal(compact.quarters.length,5);
 assert.equal(compact.rows[0].industry,full.rows[0].industry);
 assert.equal(compact.rows[0].history,undefined);
 const raw=JSON.stringify(compact);
 for(const key of ['successfulFunds','sourceReports','holdings','fundCode','stockCode','audit":','Unit test fixture private']) assert.ok(!raw.includes(key));
 assert.equal(compact.auditDigest.length,64);
 assert.equal(validatePublicCrowdingSnapshot(JSON.parse(raw)).latestQuarter,full.latestQuarter);
});
test('128 industries across 41 quarters fit under 100 KiB uncompressed',()=>{
 const full=snapshot(128,41), compact=createPublicSnapshot(full), body=Buffer.from(JSON.stringify(compact));
 assert.ok(body.length<100*1024,'Aggregate dataset exceeded 100 KiB: '+body.length);
 assert.ok(body.length<Buffer.byteLength(JSON.stringify(full))/2);
 assert.ok(zlib.gzipSync(body).length<40*1024);
 console.log(JSON.stringify({sizeFixture:'128 industries x 41 quarters; synthetic only',bytes:body.length,gzipBytes:zlib.gzipSync(body).length}));
});
test('aggregate validator rejects dimension mismatches, duplicate industry IDs and private detail fields',()=>{
 const compact=createPublicSnapshot(snapshot());
 for(const mutate of [
   s=>s.quarters[0].shares.pop(),s=>s.industries[1]=s.industries[0],s=>s.rows[0].share=99,
   s=>s.audit={sourceReports:[]},s=>s.rows[0].history=[],s=>s.quarters[0].fundCodes=['000001'],
   s=>s.quarters[0].shares[0]=Infinity,s=>s.quarters.reverse()
 ]) {const changed=structuredClone(compact);mutate(changed);assert.throws(()=>validatePublicCrowdingSnapshot(changed));}
 assert.throws(()=>validatePublicCrowdingSnapshot(snapshot()),/Invalid compact/);
});
test('aggregation preserves the distinction between a missing industry and a recorded zero',()=>{
 const full=snapshot();
 const industry=full.rows[0].industry;
 delete full.quarters[0].shares[industry];
 full.rows.find(r=>r.industry===industry).history.shift();
 const compact=createPublicSnapshot(full), index=compact.industries.indexOf(industry);
 assert.equal(compact.quarters[0].shares[index],null);
 assert.ok(Number.isFinite(compact.quarters.at(-1).shares[index]));
});
