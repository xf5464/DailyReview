const test=require('node:test');
const assert=require('node:assert/strict');
const {backfill,FIELDS}=require('../scripts/backfill-financing-market');
const {refresh}=require('../scripts/refresh-financing-market');
function row(date){return {STATISTICS_DATE:date+' 00:00:00',...Object.fromEntries(Object.values(FIELDS).map(f=>[f,100]))};}
function previous(){return {schemaVersion:1,series:Object.fromEntries(Object.keys(FIELDS).map(id=>[id,[{date:'2026-11-12',value:100}]]))};}
test('historical import preserves official overlap verbatim, fills history and is idempotent',()=>{
 const old=previous();old.series.marginAverageGuarantee[0].value=100+1e-14;
 const rows=[row('2026-11-11'),row('2026-11-12')];
 const result=backfill(old,rows,{minimumOverlap:1});
 assert.deepEqual(result.series.marginAverageGuarantee.at(-1),old.series.marginAverageGuarantee[0]);
 assert.equal(result.series.marginTotalBalance.length,2);
 assert.equal(result.historyBackfill.sourceUrl,'https://data.eastmoney.com/rzrq/zhtjday.html');
 assert.deepEqual(backfill(result,rows,{minimumOverlap:1}).series,result.series);
});
test('import fails closed on missing values, duplicate dates, mismatches and insufficient overlap',()=>{
 for(const rows of [[{...row('2026-11-12'),MARGIN_BALANCE:null}],[row('2026-11-12'),row('2026-11-12')],[{...row('2026-11-12'),INVESTOR_NUM:101}],[row('2026-11-11')]]){
  assert.throws(()=>backfill(previous(),rows,{minimumOverlap:1}));
 }
});
test('full history has six identical date sets, three years and exact official values',()=>{
 const snapshot=require('../scripts/data/financing-market.json');
 const reference=snapshot.series.marginTotalBalance;
 assert.equal(reference[0].date,'2023-11-01');assert.ok(reference.at(-1).date>='2026-11-12');
 assert.equal(reference.filter(p=>p.date<='2026-11-12').length,735);
 for(const [id,points] of Object.entries(snapshot.series)){
  assert.deepEqual(points.map(p=>p.date),reference.map(p=>p.date));
  assert.equal(new Set(points.map(p=>p.date)).size,points.length);
  assert.ok(points.every(p=>Number.isFinite(p.value)));
  assert.equal(snapshot.historyBackfill.officialOverlap[id],11);
 }
 assert.equal(reference.find(p=>p.date==='2026-11-12').value,23028.63796468);
 assert.equal(snapshot.series.marginTradeInvestors.find(p=>p.date==='2026-11-12').value,419978);
});
test('official refresh retains all backfill metadata and historical observations',async()=>{
 const old=require('../scripts/data/financing-market.json');
 const list='<a href="/old.xlsx">融资融券市场每日数据统计20200101</a>';
 const result=await refresh(old,async()=>new Response(list));
 assert.deepEqual(result.snapshot,old);
 assert.equal(result.accepted,0);
});
