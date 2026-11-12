const test=require('node:test');
const assert=require('node:assert/strict');
const {zipSync,strToU8}=require('fflate');
const {METRICS,listFiles,readXlsxRows,parseMetricRows,refresh}=require('../scripts/refresh-financing-market');
function fixture(){
 const xml='<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+
 '<row r="1"><c r="A1" t="inlineStr"><is><t>参与交易的投资者数量</t></is></c><c r="B1"><v>368788</v></c></row>'+
 '<row r="2"><c r="A2" t="inlineStr"><is><t>平均维持担保比例</t></is></c><c r="B2"><v>263.87</v></c></row>'+
 '<row r="3"><c r="A3" t="inlineStr"><is><t>两融余额占A股流通市值比重</t></is></c><c r="B3"><v>2.45</v></c></row>'+
 '<row r="4"><c r="A4" t="inlineStr"><is><t>融资融券余额</t></is></c><c r="B4" t="inlineStr"><is><t>23022.97亿元</t></is></c></row>'+
 '<row r="5"><c r="A5" t="inlineStr"><is><t>两融交易额占A股交易额比重</t></is></c><c r="B5"><v>9.01</v></c></row>'+
 '<row r="6"><c r="A6" t="inlineStr"><is><t>有融资融券负债的投资者数量</t></is></c><c r="B6"><v>1984312</v></c></row>'+
 '</sheetData></worksheet>';
 return zipSync({'xl/worksheets/sheet1.xml':strToU8(xml)});
}
test('official six financing fields map to expected values and units',()=>{
 const values=parseMetricRows(readXlsxRows(fixture()),'2026-11-11');
 assert.equal(METRICS.length,6);
 assert.deepEqual(values,{marginTradeInvestors:368788,marginAverageGuarantee:263.87,
 marginMarketCapRatio:2.45,marginTotalBalance:23022.97,marginTradeRatio:9.01,
 marginDebtInvestors:1984312});
});
test('daily refresh overlaps last 12 days and overwrites revisions without losing history',async()=>{
 const previous={schemaVersion:1,series:Object.fromEntries(METRICS.map(m=>[m.id,[
 {date:'2026-10-01',value:1},{date:'2026-11-10',value:2}]]))};
 const list='<a href="/cmsmc/articleFileDir/2026-11/11/sample.xlsx">融资融券市场每日数据统计20261111</a>'+
 '<a href="/cmsmc/articleFileDir/2026-10/01/old.xlsx">融资融券市场每日数据统计20261001</a>';
 const calls=[];
 const {snapshot,accepted}=await refresh(previous,async url=>{
 calls.push(url);
 return url.endsWith('.xlsx')?new Response(fixture()):new Response(list);
 });
 assert.equal(accepted,6);
 assert.equal(calls.length,2);
 assert.equal(snapshot.series.marginTotalBalance[0].value,1);
 assert.equal(snapshot.series.marginTotalBalance.at(-1).value,23022.97);
});
test('list extracts only dated xlsx links',()=>{
 const files=listFiles('<a href="/a.xlsx">融资融券市场每日数据统计20261111</a>');
 assert.equal(files[0].date,'2026-11-11');
});

test('official merged-cell workbook layout preserves six daily fields and ratio units',()=>{
 const rows=Array.from({length:20},()=>[]);
 rows[0][0]=' 融资融券市场每日数据统计';
 rows[2][0]='融资融券余额情况';
 rows[6][0]='融资融券交易情况';
 rows[10][0]='证券公司开展业务情况';
 rows[16][0]='担保品情况';
 rows[4][2]='23022.96648909';
 rows[5][2]='0.024518';
 rows[9][2]='0.090092';
 rows[14][2]='368788';
 rows[15][2]='1984312';
 rows[19][2]='2.638731';
 const result=parseMetricRows(rows,'2026-11-11');
 assert.equal(result.marginTotalBalance,23022.96648909);
 assert.equal(result.marginTradeInvestors,368788);
 assert.equal(result.marginDebtInvestors,1984312);
 assert.equal(result.marginMarketCapRatio,2.4518);
 assert.equal(result.marginTradeRatio,9.0092);
 assert.ok(Math.abs(result.marginAverageGuarantee-263.8731)<1e-8);
});
