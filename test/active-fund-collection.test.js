const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {calculateIndustryCrowding} = require('../scripts/active-fund-industry-crowding');
const {activeFund, collect, createSnapshot, saveSnapshot, cachedFetch, validateInputs, main} = require('../scripts/collect-active-fund-crowding');
const {parseFundCatalogue} = require('../scripts/prepare-active-fund-universe');
const {validateCrowdingSnapshot} = require('../scripts/fund-crowding-snapshot');
const {deduplicateFundShares} = require('../scripts/fund-portfolio-source');
function holdingsText(year=2026, quarter=3) {
  const date = year + '-' + ({1:'03-31',2:'06-30',3:'09-30',4:'12-31'}[quarter]);
  const headers = ['序号','股票代码','股票名称','占净值比例','持股数','持仓市值'].map(h=>'<th>'+h+'</th>').join('');
  const rows = Array.from({length:10},(_,i)=>'<tr>'+[i+1,String(600000+i),'股票',1,1,i ? 1 : 91].map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('');
  const html = '<h4>'+year+'年'+quarter+'季度股票投资明细</h4>截止至：<font>'+date+'</font><thead>'+headers+'</thead><tbody>'+rows+'</tbody>';
  return 'var apidata={content:'+JSON.stringify(html)+',arryear:['+year+'],curyear:'+year+'};';
}
function inputs(keys=['2026-Q3']) {
  const fund={fundCode:'000001',fundName:'测试混合A',type:'混合型-偏股',productId:'product-1',netAsset10kCny:100};
  return {
    funds:[fund],years:[2026],
    universe:{schemaVersion:1,source:'Disclosed quarterly fund universe',reviewedAt:'2026-10-30',historicalMembershipVerified:true,
      quarters:Object.fromEntries(keys.map(k=>[k,{funds:[fund]}]))},
    industries:{schemaVersion:1,taxonomy:'eastmoney-level2',taxonomyVersion:'reviewed-v1',source:'Verified quarterly classification',
      reviewedAt:'2026-10-30',historicalMappingVerified:true,
      quarters:Object.fromEntries(keys.map(k=>[k,Object.fromEntries(Array.from({length:10},(_,i)=>[String(600000+i),i?'银行':'半导体']))]))},
    fetchImpl:async()=>({ok:true,text:async()=>holdingsText()})
  };
}
function q(quarter,value=10) {return {quarter,coverage:1,holdings:[
  {industry:'半导体',marketValue:value,activeEquity:true},{industry:'银行',marketValue:100-value,activeEquity:true}
]};}

test('quarter changes never bridge a missing quarter or taxonomy change',()=>{
  assert.equal(calculateIndustryCrowding([q('2025-Q4'),q('2026-Q2')]).rows[0].quarterChange,null);
  assert.equal(calculateIndustryCrowding([{...q('2026-Q1'),taxonomyVersion:'v1'},{...q('2026-Q2'),taxonomyVersion:'v2'}]).rows[0].quarterChange,null);
});
test('percentile requires every quarter, including gaps hidden by longer history',()=>{
  const result=calculateIndustryCrowding([q('2024-Q4'),q('2025-Q2'),q('2025-Q3'),q('2025-Q4'),q('2026-Q1')]);
  assert.equal(result.rows[0].percentiles[4],null);
});
test('unmapped market value remains in the denominator',()=>{
  const result=calculateIndustryCrowding([{...q('2026-Q1'),totalMarketValue:110}]);
  assert.ok(Math.abs(result.rows.find(r=>r.industry==='半导体').share-100/11)<1e-10);
});
test('candidate fund filter excludes bond, QDII, FOF, index and enhanced products',()=>{
  for(const type of ['混合型-偏债','债券型-混合二级','QDII-混合偏股','FOF-进取型','指数型-股票','混合型'])
    assert.equal(activeFund({fundCode:'000001',type}),false);
  assert.equal(activeFund({fundCode:'000001',type:'股票型'}),true);
  assert.equal(activeFund({fundCode:'000001',type:'股票型',fundName:'指数增强'}),false);
});
test('catalogue is parsed without execution; backend and C shares are candidates of one product',()=>{
  const raw='var r = '+JSON.stringify([
    ['000002','','基金A(后端)','混合型-偏股'],['000003','','基金C','混合型-偏股'],['000001','','基金A','混合型-偏股'],
    ['000004','','债券','债券型-混合二级']])+';';
  const result=parseFundCatalogue(raw);
  assert.equal(result.recordCount,4);assert.equal(result.funds.length,1);
  assert.equal(result.funds[0].fundCode,'000001');assert.equal(result.funds[0].type,'混合型-偏股');
  assert.throws(()=>parseFundCatalogue(raw+'global.executed=true;'));
  assert.equal(deduplicateFundShares(result.funds)[0].type,'混合型-偏股');
});
test('verified quarterly collection produces auditable weights and serializable snapshot',async()=>{
  const options=inputs();const collection=await collect(options);
  assert.equal(collection.result.latestQuarter,'2026-Q3');
  assert.equal(collection.result.rows.find(r=>r.industry==='半导体').share,91);
  const snapshot=createSnapshot(collection,options);
  assert.equal(validateCrowdingSnapshot(JSON.parse(JSON.stringify(snapshot))).coverage,1);
});
test('a small successful fund cannot disguise missing large funds as adequate coverage',async()=>{
  const options=inputs();
  options.universe.quarters['2026-Q3'].funds.push({...options.funds[0],fundCode:'000002',productId:'large',netAsset10kCny:9900});
  options.fetchImpl=async url=>{if(url.searchParams.get('code')==='000002') throw Error('unavailable');return {ok:true,text:async()=>holdingsText()};};
  const result=await collect(options);
  assert.equal(result.snapshots.find(q=>q.quarter==='2026-Q3').coverage,0.01);
  assert.throws(()=>createSnapshot(result,options),/Insufficient/);
});
test('mapping coverage uses market value, not stock count',async()=>{
  const options=inputs();delete options.industries.quarters['2026-Q3']['600000'];
  const result=await collect(options);
  assert.equal(result.snapshots.find(q=>q.quarter==='2026-Q3').mappingCoverage,0.09);
  assert.equal(result.result.latestQuarter,null);
});
test('current candidate list and arbitrary count cannot authorize production data',async()=>{
  const options=inputs();delete options.universe;
  const result=await collect({...options,industries:options.industries.quarters['2026-Q3'],eligibleFundCounts:{'2026-Q3':1}});
  assert.equal(result.result.latestQuarter,null);
  assert.throws(()=>validateInputs({...inputs().universe,historicalMembershipVerified:false},inputs().industries),/Verified/);
});
test('duplicate product identities and absent period mappings fail before fetching',()=>{
  const options=inputs();options.universe.quarters['2026-Q3'].funds.push({...options.funds[0],fundCode:'000002'});
  assert.throws(()=>validateInputs(options.universe,options.industries),/duplicate/);
  const other=inputs();delete other.industries.quarters['2026-Q3'];
  assert.throws(()=>validateInputs(other.universe,other.industries),/Missing quarterly industry/);
});
test('invalid dates, duplicate stocks and partial reports never count as successful disclosure',async()=>{
  for(const body of [
    holdingsText().replace('2026-09-30','2026-06-30'),
    holdingsText().replace('600001','600000'),
    holdingsText().replace('<tr><td>10</td>','<tr><td>9</td>')
  ]) {
    const options=inputs();options.fetchImpl=async()=>({ok:true,text:async()=>body});
    assert.equal((await collect(options)).result.latestQuarter,null);
  }
});
test('failed latest requested quarter cannot silently publish an older quarter',async()=>{
  const options=inputs(['2026-Q2','2026-Q3']);
  options.fetchImpl=async()=>({ok:true,text:async()=>holdingsText(2026,2)});
  const collection=await collect(options);assert.equal(collection.result.latestQuarter,'2026-Q2');
  assert.throws(()=>createSnapshot(collection,options),/Latest requested quarter/);
});
test('snapshot writes valid JSON, archives old data, and rejects loss of history',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'crowding-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const output=path.join(dir,'snapshot.json'), options=inputs();
  const snapshot=createSnapshot(await collect(options),options);
  saveSnapshot(output,snapshot);assert.equal(JSON.parse(fs.readFileSync(output)).latestQuarter,'2026-Q3');
  saveSnapshot(output,{...snapshot,updatedAt:'2026-10-31T00:00:00Z'});
  assert.equal(fs.readdirSync(path.join(dir,'active-fund-crowding-history')).length,1);
  const invalid={...snapshot,coverage:0.1};const before=fs.readFileSync(output,'utf8');
  assert.throws(()=>saveSnapshot(output,invalid),/Invalid approved/);assert.equal(fs.readFileSync(output,'utf8'),before);
});
test('raw response cache reuses verified bytes and never stores HTTP error pages',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'crowding-cache-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  let calls=0;const fetchImpl=async()=>{calls++;return {ok:true,text:async()=>holdingsText()};};
  const cached=cachedFetch(dir,{fetchImpl});
  await cached('https://fundf10.eastmoney.com/FundArchivesDatas.aspx?code=000001&year=2026&rt=1');
  await cached('https://fundf10.eastmoney.com/FundArchivesDatas.aspx?code=000001&year=2026&rt=2');
  assert.equal(calls,1);
  const bad=cachedFetch(dir,{fetchImpl:async()=>({ok:true,text:async()=>'<html>404</html>'})});
  await assert.rejects(bad('https://fundf10.eastmoney.com/error'),/无法识别/);
  assert.equal(fs.readdirSync(dir).length,1);
});
test('publication validation rejects missing audit, inconsistent weights and coverage',async()=>{
  const options=inputs(), snapshot=createSnapshot(await collect(options),options);
  for(const mutate of [s=>delete s.audit,s=>s.rows[0].share=99,s=>s.audit.quarters.find(q=>q.quarter==='2026-Q3').fundCoverage=0.2]) {
    const copy=structuredClone(snapshot);mutate(copy);assert.throws(()=>validateCrowdingSnapshot(copy),/Invalid approved/);
  }
});
test('missing CLI flag value fails before any collection',async()=>{
  await assert.rejects(main(['--industries','--diagnostic','--funds','missing.json']),/Missing --industries/);
});

test('updating latest quarter cannot discard existing older quarterly history',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'crowding-history-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const output=path.join(dir,'snapshot.json');
  const oldOptions=inputs(['2026-Q2']);
  oldOptions.fetchImpl=async()=>({ok:true,text:async()=>holdingsText(2026,2)});
  saveSnapshot(output,createSnapshot(await collect(oldOptions),oldOptions));
  const nextOptions=inputs();
  const before=fs.readFileSync(output,'utf8');
  const nextSnapshot=createSnapshot(await collect(nextOptions),nextOptions);
  assert.throws(()=>saveSnapshot(output,nextSnapshot),/discard existing quarterly history/);
  assert.equal(fs.readFileSync(output,'utf8'),before);
});

test('tampered raw caches are rejected before reuse',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'crowding-tamper-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const cached=cachedFetch(dir,{fetchImpl:async()=>({ok:true,text:async()=>holdingsText()})});
  const url='https://fundf10.eastmoney.com/FundArchivesDatas.aspx?code=000001&year=2026';
  await cached(url);
  const file=path.join(dir,fs.readdirSync(dir)[0]);
  const record=JSON.parse(fs.readFileSync(file,'utf8'));record.body+='tampered';fs.writeFileSync(file,JSON.stringify(record));
  await assert.rejects(cached(url),/Corrupt cached report/);
});

test('manual CLI keeps report-level audit local and writes only compact quarterly aggregates',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'crowding-cli-'));
  const originalFetch=global.fetch;
  t.after(()=>{global.fetch=originalFetch;fs.rmSync(dir,{recursive:true,force:true});});
  const options=inputs();global.fetch=options.fetchImpl;
  const universe=path.join(dir,'universe.json'),industries=path.join(dir,'industries.json');
  fs.writeFileSync(universe,JSON.stringify(options.universe));fs.writeFileSync(industries,JSON.stringify(options.industries));
  const output=path.join(dir,'public.json'),cache=path.join(dir,'cache');
  await main(['--universe',universe,'--industries',industries,'--years','2026','--cache',cache,'--output',output,'--diagnostics',path.join(dir,'diagnostics.json')]);
  const publicText=fs.readFileSync(output,'utf8'),published=JSON.parse(publicText);
  assert.equal(published.schemaVersion,2);assert.ok(!publicText.includes('fundCode'));
  assert.ok(!publicText.includes('sourceReports'));assert.equal(published.quarters.length,1);
  const auditFile=path.join(cache,'audits',published.auditDigest+'.json');
  assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(auditFile)).digest('hex'),published.auditDigest);
  const audit=JSON.parse(fs.readFileSync(auditFile));
  assert.equal(audit.quarters.find(q=>q.quarter==='2026-Q3').sourceReports[0].fundCode,'000001');
});
