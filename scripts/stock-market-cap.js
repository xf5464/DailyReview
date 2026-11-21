// Tencent quote: field 44 is circulating cap; field 45 is total cap (CNY 100 million).
function parseStockMarketCap(text, code) {
  const match = String(text).match(/="([^"]+)"/);
  const fields = match ? match[1].split('~') : [];
  const timestamp = fields[30] || '';
  const value = Number(fields[45]);
  if (fields[2] !== code || !/^20\d{12}$/.test(timestamp) || !Number.isFinite(value) || value <= 0) {
    throw new Error('总市值行情数据无效');
  }
  return { totalMarketCap: value, marketCapDate: timestamp.slice(0, 4) + '-' + timestamp.slice(4, 6) + '-' + timestamp.slice(6, 8),
    marketCapSource: '腾讯财经总市值', marketCapIsCached: false };
}
async function fetchStockMarketCap(code, fetchImpl = globalThis.fetch) {
  const symbol = (/^[69]/.test(code) ? 'sh' : /^[48]/.test(code) ? 'bj' : 'sz') + code;
  const response = await fetchImpl('https://qt.gtimg.cn/q=' + symbol, {
    headers: { Referer: 'https://gu.qq.com/', 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(10000), cache: 'no-store',
  });
  if (!response.ok) throw new Error('总市值行情 HTTP ' + response.status);
  return parseStockMarketCap(await response.text(), code);
}
module.exports = { parseStockMarketCap, fetchStockMarketCap };
