const test=require('node:test');
const assert=require('node:assert/strict');
const {parseNav,parseFallbackNav,parsePrices,mergeOfficialPremium,queryOfficialPremium159941}=require('../scripts/etf-official-premium-159941');
test('match official NAV to unadjusted same-day ETF closing prices',()=>{
 const nav=parseNav({Data:{LSJZList:[{FSRQ:'2026-10-28',DWJZ:'1.00'},{FSRQ:'2026-10-29',DWJZ:'1.10'}]}});
 const prices=parsePrices({data:{klines:['2026-10-28,1,1.05,1,1,1','2026-10-29,1,1.21,1,1,1','2026-10-30,1,1.30,1,1,1']}});
 assert.deepEqual(mergeOfficialPremium(prices,nav),[{date:'2026-10-28',value:5},{date:'2026-10-29',value:10}]);
});
test('official premium requires at least two matching dates',async()=>{
 const fetchImpl=async url=>({ok:true,json:async()=>url.includes('/f10/lsjz')?{Data:{LSJZList:[{FSRQ:'2026-10-29',DWJZ:'1.10'}]}}:{data:{klines:['2026-10-29,1,1.21,1,1,1']}}});
 await assert.rejects(queryOfficialPremium159941({fetchImpl}),/Insufficient/);
});
test('A-share official NAV premium has 1y and 3y percentile labels',()=>{
 const fs=require('node:fs');
 const app=fs.readFileSync(require('node:path').join(__dirname,'../site/app.js'),'utf8');
 assert.ok(app.includes("group_a_share: ['etfOfficialPremium159941', 'etfPremium159941'"));
 assert.ok(app.includes("etfOfficialPremium159941: ['group_a_share']"));
 assert.ok(app.includes("if (id !== 'etfPremium159941') valueCell.append"));
});

test('fallback official net worth trend preserves NAV dates',()=>{
 const text='var Data_netWorthTrend = [{"x":1793232000000,"y":1.1},{"x":1793318400000,"y":1.2}];';
 const nav=parseFallbackNav(text);
 assert.equal(nav.size,2);
 assert.ok([...nav.values()].includes(1.2));
});
