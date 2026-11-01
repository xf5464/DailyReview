'use strict';
const NAV_URL = 'https://api.fund.eastmoney.com/f10/lsjz?fundCode=159941&pageIndex=1&pageSize=10000';
const PRICE_URL = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=0.159941&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=0&end=20500101&lmt=10000';
function parseNav(data) {
  const rows = data && data.Data && data.Data.LSJZList;
  if (!Array.isArray(rows)) throw new Error('Historical official NAV unavailable');
  return new Map(rows.filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x.FSRQ || '') && Number(x.DWJZ)>0)
    .map(x => [x.FSRQ, Number(x.DWJZ)]));
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
async function queryOfficialPremium159941({fetchImpl=fetch}={}) {
  const headers = {'User-Agent':'Mozilla/5.0','Referer':'https://fund.eastmoney.com/'};
  async function json(url) {
    const response = await fetchImpl(url,{headers,signal:AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error('159941 source HTTP '+response.status);
    return response.json();
  }
  const [nav,prices]=await Promise.all([json(NAV_URL),json(PRICE_URL)]);
  const items=mergeOfficialPremium(parsePrices(prices),parseNav(nav));
  if (items.length<2) throw new Error('Insufficient date-matched official NAV premium history');
  return {items, sourceName:'东方财富 ETF 未复权收盘价 / 天天基金官方单位净值'};
}
module.exports={NAV_URL,PRICE_URL,parseNav,parsePrices,mergeOfficialPremium,queryOfficialPremium159941};
