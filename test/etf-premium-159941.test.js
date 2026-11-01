const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parsePremiumPage, parsePremiumHistory, queryEtfPremium159941 } = require('../scripts/etf-premium-159941');
test('parse same-session IOPV reference premium rather than delayed NAV',()=>{
 const item=parsePremiumPage('<p>行情截至 2026-10-29 收盘</p><p>参考溢价 +13.30%</p><p>净值溢价 +11.95%</p>');
 assert.deepEqual(item,{date:'2026-10-29',value:13.3});
});
test('reject unavailable same-session premium',()=>{
 assert.throws(()=>parsePremiumPage('净值溢价 +13.30%'),/unavailable/);
});
test('A-share premium colors use inclusive 3 and 10 percent thresholds',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../site/app.js'),'utf8');
 assert.ok(source.includes("id === 'etfOfficialPremium159941') ? etfPremiumRowBackground"));
 assert.ok(source.includes('var low = value <= 3;'));
 assert.ok(source.includes('if (!low && value < 10) return'));
});

test('parse multiple historical reference premium rows without mixing NAV premium',()=>{
 const html='<p>行情截至 2026-10-30 收盘 参考溢价 +12.12%</p><table><tr><th>交易日</th><th>收盘价</th><th>参考溢价</th><th>净值溢价</th></tr><tr><td>2026-10-29</td><td>1.690</td><td>+13.30%</td><td>+14.92%</td></tr><tr><td>2026-10-28</td><td>1.708</td><td>+15.12%</td><td>+14.50%</td></tr><tr><td>2026-10-19</td><td>1.723</td><td>不可用</td><td>+16.50%</td></tr></table>';
 assert.deepEqual(parsePremiumHistory(html),[{date:'2026-10-28',value:15.12},{date:'2026-10-29',value:13.3}]);
});
