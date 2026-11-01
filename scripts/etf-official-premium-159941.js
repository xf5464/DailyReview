'use strict';
const NAV_URL = 'https://api.fund.eastmoney.com/f10/lsjz?fundCode=159941&pageIndex=1&pageSize=10000';
const NAV_FALLBACK_URL = 'https://fund.eastmoney.com/pingzhongdata/159941.js';
const PRICE_URL = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=0.159941&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=0&end=20500101&lmt=10000';
function parseNav(data) {
  const rows = data && data.Data && data.Data.LSJZList;
  if (!Array.isArray(rows)) throw new Error('Historical official NAV unavailable');
  return new Map(rows.filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x.FSRQ || '') && Number(x.DWJZ)>0)
    .map(x => [x.FSRQ, Number(x.DWJZ)]));
}
function parseFallbackNav(text) {
  const match=String(text).match(/Data_netWorthTrend\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) throw new Error('Fallback historical NAV trend unavailable');
  const rows=JSON.parse(match[1]);
  if (!Array.isArray(rows)) throw new Error('Fallback NAV trend invalid');
  return new Map(rows.filter(x=>Number.isFinite(x.x)&&Number(x.y)>0).map(x=>[
    new Date(x.x).toISOString().slice(0,10),Number(x.y)
  ]));
}
function parsePrices(data) {
  const rows = data && data.data && data.data.klines;
  if (!Array.isArray(rows)) throw new Error('ETF unadjusted close history unavailable');
  return rows.map(x => String(x).split(',')).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x[0]) && Number(x[2])>0)
    .map(x => ({date:x[0],close:Number(x[2])}));
}
function mergeOfficialPremium(prices, nav) {
  return prices.filter(x => nav.has(x.date)).map(x => ({
    date:x.date, value: Math.round((x.close/nav.get(x.date)-1)*1000000)/10000
  })).filter(x => Number.isFinite(x.value) && x.value>-100 && x.value<200);
}
async function queryOfficialPremium159941({fetchImpl=fetch,incremental=false,lookbackDays=20}={}) {
  const headers = {'User-Agent':'Mozilla/5.0','Referer':'https://fund.eastmoney.com/'};
  async function json(url) {
    const response = await fetchImpl(url,{headers,signal:AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error('159941 source HTTP '+response.status);
    return response.json();
  }
  // The Eastmoney hosts may intermittently fail independently. Retry each
  // source without making the other successful response expire.
  async function retry(task, attempts=4) {
    let lastError;
    for (let attempt=0; attempt<attempts; attempt++) {
      try { return await task(); } catch(error) {
        lastError=error;
        if (attempt+1<attempts) await new Promise(resolve=>setTimeout(resolve,400*(attempt+1)));
      }
    }
    throw lastError;
  }
  const count=Math.min(10000,Math.max(40,Math.ceil(lookbackDays)*2));
  const priceUrl = incremental ? PRICE_URL.replace('lmt=10000','lmt='+count) : PRICE_URL;
  const navUrl = incremental ? NAV_URL.replace('pageSize=10000','pageSize='+count) : NAV_URL;
  const prices=await retry(()=>json(priceUrl));
  let nav;
  try { nav=parseNav(await retry(()=>json(navUrl),2)); } catch (_) { /* fallback */ }
  if (!nav || nav.size<2) {
    const response=await retry(async()=>{
      const result=await fetchImpl(NAV_FALLBACK_URL,{headers,signal:AbortSignal.timeout(30000)});
      if (!result.ok) throw new Error('Fallback NAV source HTTP '+result.status);
      return result;
    });
    nav=parseFallbackNav(await response.text());
  }
  const items=mergeOfficialPremium(parsePrices(prices),nav);
  if (items.length<2) throw new Error('Insufficient date-matched official NAV premium history');
  return {items, sourceName:'东方财富 ETF 未复权收盘价 / 天天基金官方单位净值'};
}
module.exports={NAV_URL,NAV_FALLBACK_URL,PRICE_URL,parseNav,parseFallbackNav,parsePrices,mergeOfficialPremium,queryOfficialPremium159941};
