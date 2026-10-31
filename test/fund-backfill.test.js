'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {combineSnapshots,selectReusable}=require('../scripts/backfill-active-fund-crowding');
const {calculateIndustryCrowding}=require('../scripts/active-fund-industry-crowding');
const {createPublicSnapshot}=require('../scripts/fund-crowding-snapshot');
const hash=o=>crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
const industries={taxonomyVersion:'EM2016-level2',reviewedAt:'2026-10-31'};
function entry(quarter,value){
 const universe={schemaVersion:2,source:'Dated report cohort',reviewedAt:'2026-10-31',evidenceHashes:[],quarters:{[quarter]:{funds:[{fundCode:'000001'}]}}};
 const result=calculateIndustryCrowding([{quarter,coverage:1,taxonomyVersion:industries.taxonomyVersion,totalMarketValue:100,
  holdings:[{industry:'银行',activeEquity:true,marketValue:value},{industry:'半导体',activeEquity:true,marketValue:100-value}]}]);
 const audit={universeHash:hash(universe),industryMapHash:hash(industries),universeReviewedAt:universe.reviewedAt,industriesReviewedAt:industries.reviewedAt,
  quarters:[{quarter,coverage:1,fundCoverage:1,assetCoverage:1,mappingCoverage:1,successful:1,eligibleFundCount:1,
   successfulNetAssets:100,eligibleNetAssets:100,totalMarketValue:100,mappedMarketValue:100,successfulFunds:['000001'],errors:[],
   sourceReports:[{fundCode:'000001',url:'https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc',hash:'a'.repeat(64),fetchedAt:'2026-10-31T00:00:00Z'}]}]};
 return {universe,snapshot:{schemaVersion:1,calculationVersion:3,disclosureBasis:'quarterly-top10',taxonomy:'eastmoney-level2',taxonomyVersion:industries.taxonomyVersion,
  source:'Dated report cohort',updatedAt:'2026-10-31T00:00:00Z',equityScope:'mainland-A',classificationBasis:'fixed-taxonomy-restatement',universeBasis:'published-quarterly-reports',
  fundCount:1,quarterCount:1,...result,audit}};
}
test('validated quarter checkpoints recompute continuous history and percentiles without raw holdings',()=>{
 const entries=['2025-Q3','2025-Q4','2026-Q1','2026-Q2','2026-Q3'].map((q,i)=>entry(q,10+i));
 const combined=combineSnapshots(entries.reverse(),industries);
 const publicSnapshot=createPublicSnapshot(combined.snapshot);
 assert.equal(publicSnapshot.quarterCount,5);
 const bank=publicSnapshot.rows.find(r=>r.industry==='银行');
 assert.equal(bank.quarterChange,1);assert.equal(bank.percentiles[4],100);
 const withGap=combineSnapshots([entry('2026-Q1',10),entry('2026-Q3',12)],industries);
 assert.equal(withGap.snapshot.rows[0].quarterChange,null);
 assert.equal(withGap.snapshot.rows[0].percentiles[4],null);
});
test('resumed checkpoints reject altered universes, taxonomy maps, and duplicate quarters',()=>{
 const changed=entry('2026-Q3',10);changed.universe.quarters['2026-Q3'].funds[0].fundCode='999999';
 assert.throws(()=>combineSnapshots([changed],industries),/universe checksum/);
 assert.throws(()=>combineSnapshots([entry('2026-Q3',10)],{...industries,reviewedAt:'2026-11-01'}),/different industry map/);
 assert.throws(()=>combineSnapshots([entry('2026-Q3',10),entry('2026-Q3',10)],industries),/Duplicate/);
});
test('batch reuse selects latest applicable dated proof and rejects contradictory evidence',()=>{
 const productName='示例混合型证券投资基金';
 const archive={quarter:'2026-Q1',histories:[{fundCode:'000001',reports:[{title:productName+'2026年第1季度报告'}]}]};
 const row={fundCode:'000002',productName,quarter:'2026-Q3',status:'active',source:{publishedAt:'2025-01-01'}};
 const set=rows=>({schemaVersion:1,classifierVersion:'contract-equity-scope-v1',evidence:rows});
 const result=selectReusable([set([row,{...row,source:{publishedAt:'2026-02-01'}},{...row,source:{publishedAt:'2026-04-01'}}])],archive);
 assert.equal(result.evidence.length,1);assert.equal(result.evidence[0].source.publishedAt,'2026-02-01');assert.equal(result.evidence[0].fundCode,'000001');
 assert.throws(()=>selectReusable([set([row,{...row,status:'excluded'}])],archive),/Conflicting/);
});
