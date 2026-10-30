const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parsePremiumPage } = require('../scripts/etf-premium-159941');
test('parse same-session IOPV reference premium rather than delayed NAV',()=>{
 const item=parsePremiumPage('<p>行情截至 2026-10-29 收盘</p><p>参考溢价 +13.30%</p><p>净值溢价 +11.95%</p>');
 assert.deepEqual(item,{date:'2026-10-29',value:13.3});
});
test('reject unavailable same-session premium',()=>{
 assert.throws(()=>parsePremiumPage('净值溢价 +13.30%'),/unavailable/);
});
test('A-share premium colors use inclusive 3 and 10 percent thresholds',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../site/app.js'),'utf8');
 assert.ok(source.includes("id === 'etfPremium159941' ? etfPremiumRowBackground"));
 assert.ok(source.includes('var low = value <= 3;'));
 assert.ok(source.includes('if (!low && value < 10) return'));
});
