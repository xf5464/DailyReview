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
async function queryEtfPremium159941({fetchImpl=fetch}={}) {
  const response=await fetchImpl(SOURCE_URL,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error('ETF premium source HTTP '+response.status);
  const item=parsePremiumPage(await response.text());
  return {items:[item]};
}
module.exports={parsePremiumPage,queryEtfPremium159941,SOURCE_URL};
