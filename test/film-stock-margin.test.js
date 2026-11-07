const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
test('film stock detail provides financing balance toggle without replacing shareholder chart',()=>{
 const html=read('site/index.html'), app=read('site/app.js');
 assert.match(html,/id="shareholderHistoryMarginButton"/);
 assert.match(html,/id="shareholderHistoryHoldersButton"/);
 assert.ok(app.includes("shareholderHistoryMode = 'margin'"));
 assert.ok(app.includes("shareholderHistoryMode = 'holders'"));
 assert.ok(app.includes("id:'stockMarginBalance'"));
 assert.ok(app.includes("renderLineChart(refs.shareholderChart, marginChart)"));
});
test('individual stock financing balance source uses RZYE not margin total',()=>{
 const worker=read('cloudflare/dailyreview-reader.js');
 assert.ok(worker.includes("reportName:'RPTA_WEB_RZRQ_GGMX'"));
 assert.ok(worker.includes('Number(row.RZYE) / 100000000'));
 assert.ok(worker.includes('stock-margin-balance-api'));
});

test('stock margin uses durable KV, merges by date, and preserves stale data',()=>{
 const worker=read('cloudflare/dailyreview-reader.js');
 assert.ok(worker.includes('env.STOCK_MARGIN_HISTORY'));
 assert.ok(worker.includes("await store.get(key, 'json')"));
 assert.ok(worker.includes('await store.put(key,JSON.stringify(result))'));
 assert.ok(worker.includes('mergeStockMarginRows(cached?.items || [], fresh)'));
 assert.ok(worker.includes('stockMarginDateBefore(lastDate, 12)'));
 assert.ok(worker.includes('stale:true'));
 assert.ok(worker.includes('融资余额持久化存储未配置'));
});
