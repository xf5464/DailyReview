'use strict';
const SOURCE_URL = 'https://qdiilens.com/fund/159941';
function parsePremiumPage(html) {
  const text = String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ');
  // The reference premium is explicitly close / IOPV - 1, NOT the stale NAV premium.
  const match = text.match(/参考溢价\s*([+−-]?\d+(?:\.\d+)?)%/);
  const date = text.match(/行情截至\s*(\d{4}-\d{2}-\d{2})\s*收盘/);
  if (!match || !date) throw new Error('159941 same-session reference premium unavailable');
  const value = Number(match[1].replace('−','-'));
  if (!Number.isFinite(value) || Math.abs(value)>100) throw new Error('Invalid ETF premium');
  return {date:date[1],value};
}
function parsePremiumHistory(html) {
  const rows = [];
  const tr = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const td = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let match;
  while ((match = tr.exec(String(html))) !== null) {
    const cells = Array.from(match[1].matchAll(td), item => item[1].replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').trim());
    if (cells.length < 3 || !/^\d{4}-\d{2}-\d{2}$/.test(cells[0])) continue;
    const value = cells[2].match(/^([+−-]?\d+(?:\.\d+)?)%$/);
    if (!value) continue;
    const number = Number(value[1].replace('−','-'));
    if (Number.isFinite(number) && Math.abs(number) <= 100) rows.push({date:cells[0],value:number});
  }
  return [...new Map(rows.map(item => [item.date,item])).values()].sort((a,b) => a.date.localeCompare(b.date));
}
async function queryEtfPremium159941({fetchImpl=fetch}={}) {
  const response=await fetchImpl(SOURCE_URL,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error('ETF premium source HTTP '+response.status);
  const html=await response.text();
  const item=parsePremiumPage(html);
  const history = parsePremiumHistory(html);
  const items = [...new Map([...history, item].map(point => [point.date, point])).values()].sort((a,b) => a.date.localeCompare(b.date));
  return {items};
}
module.exports={parsePremiumPage,parsePremiumHistory,queryEtfPremium159941,SOURCE_URL};
