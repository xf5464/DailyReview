// Both exchanges: A shares only, turnover by total market capitalization.
const fs = require('node:fs');
const path = require('node:path');
const SNAPSHOT = path.join(__dirname, 'data/exchange-turnover.json');
function number(value) {
  if (value === null || value === undefined || String(value).trim() === '' || value === '-') throw new Error('缺少市场数据');
  const n = Number(String(value).replaceAll(',', ''));
  if (!Number.isFinite(n) || n < 0) throw new Error('市场数据无效');
  return n;
}
function parseDay(market, payload, date) {
  let rows;
  if (market === 'sh') {
    rows = payload.result.filter(r => ['01','03'].includes(r.PRODUCT_CODE) && r.TRADE_DATE === date.replaceAll('-', ''));
  } else {
    if (payload[0].metadata.subname !== date) throw new Error('返回日期不符');
    rows = payload[0].data.filter(r => /A股/.test(r.lbmc));
  }
  if (rows.length !== 2) throw new Error('A股板块数据不完整');
  const amount = rows.reduce((sum,r) => sum + number(market === 'sh' ? r.TRADE_AMT : r.cjje),0);
  const cap = rows.reduce((sum,r) => sum + number(market === 'sh' ? r.TOTAL_VALUE : r.sjzz),0);
  if (!cap || !amount) throw new Error('无有效成交或市值');
  return { date, value: amount / cap * 100 };
}
async function queryExchangeTurnover(market, {fetchImpl = fetch, now = new Date(), persist = false} = {}) {
  const saved = JSON.parse(fs.readFileSync(SNAPSHOT,'utf8'))[market];
  const map = new Map(Object.entries(saved).map(([date,value]) => [date,{date,value}]));
  const end = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  let refreshed = false;
  await Promise.all(Array.from({length:7},async (_,i) => {
    const date = new Date(Date.parse(end+'T00:00:00Z')-i*86400000).toISOString().slice(0,10);
    if ([0,6].includes(new Date(date+'T00:00:00Z').getUTCDay())) return;
    const url = market === 'sh'
      ? 'https://query.sse.com.cn/commonQuery.do?'+new URLSearchParams({sqlId:'COMMON_SSE_SJ_GPSJ_CJGK_MRGK_C',PRODUCT_CODE:'01,03',type:'inParams',SEARCH_DATE:date})
      : 'https://www.szse.cn/api/report/ShowReport/data?'+new URLSearchParams({SHOWTYPE:'JSON',CATALOGID:'1803_sczm',TABKEY:'tab1',txtQueryDate:date,random:String(Date.now())});
    try {
      const response = await fetchImpl(url,{headers:{Referer:market === 'sh' ? 'https://www.sse.com.cn/' : 'https://www.szse.cn/'},signal:AbortSignal.timeout(20000)});
      if (!response.ok) throw new Error('HTTP '+response.status);
      const item = parseDay(market,await response.json(),date);
      map.set(date,item); refreshed = true;
    } catch { /* Preserve verified history; never invent holiday observations. */ }
  }));
  const items = [...map.values()].filter(x => x.date <= end).sort((a,b)=>a.date.localeCompare(b.date));
  if (!items.length) throw new Error('暂无交易所换手率历史');
  if (persist) {
    const all = JSON.parse(fs.readFileSync(SNAPSHOT,'utf8'));
    all[market] = Object.fromEntries(items.map(item => [item.date,item.value]));
    fs.writeFileSync(SNAPSHOT,JSON.stringify(all,null,2)+'\n');
  }
  return {items, stale:!refreshed, methodology:'A股成交额 ÷ A股总市值 × 100%，不含B股；非自由流通口径',
    notice:!refreshed ? '来源刷新失败，保留已核验历史' : '最新交易日数据，非盘中实时换手率'};
}
module.exports={parseDay,queryExchangeTurnover};
