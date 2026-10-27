const test=require('node:test');
const assert=require('node:assert/strict');
const {parseDay}=require('../scripts/exchange-turnover');
test('Shanghai turnover combines A-share amount and cap, excluding B shares',()=>{
 const payload={result:[
  {PRODUCT_CODE:'01',TRADE_DATE:'20261026',TRADE_AMT:'100',TOTAL_VALUE:'10,000'},
  {PRODUCT_CODE:'03',TRADE_DATE:'20261026',TRADE_AMT:'200',TOTAL_VALUE:'5,000'},
  {PRODUCT_CODE:'02',TRADE_DATE:'20261026',TRADE_AMT:'999',TOTAL_VALUE:'1'}]};
 assert.deepEqual(parseDay('sh',payload,'2026-10-26'),{date:'2026-10-26',value:2});
 assert.throws(()=>parseDay('sh',payload,'2026-10-25'));
 payload.result[0].TOTAL_VALUE='-'; assert.throws(()=>parseDay('sh',payload,'2026-10-26'));
});
test('Shenzhen total-cap turnover requires both A-share boards and the exact date',()=>{
 const payload=[{metadata:{subname:'2026-10-26'},data:[{lbmc:'主板A股',cjje:'100',sjzz:'1,000'},
  {lbmc:'创业板A股',cjje:'50',sjzz:'500'},{lbmc:'主板B股',cjje:'999',sjzz:'1'}]}];
 assert.equal(parseDay('sz',payload,'2026-10-26').value,10);
 assert.throws(()=>parseDay('sz',payload,'2026-10-25'));
 payload[0].data.pop();payload[0].data.pop();assert.throws(()=>parseDay('sz',payload,'2026-10-26'));
});
