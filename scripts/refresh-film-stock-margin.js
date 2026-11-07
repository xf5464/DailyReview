const fs = require('node:fs');
const path = require('node:path');
const {
  TONGHUASHUN_FILM_CINEMA_CONSTITUENT_SNAPSHOT,
  fetchFilmCinemaConstituents,
} = require('./macro-outlook');

const snapshotPath = path.join(__dirname, 'data', 'film-stock-margin.json');
const pageSize = 500;
const pageLimit = 100;

async function fetchStockMarginRows(code, startDate, fetchImpl) {
  const items = [];
  for (let page = 1; page <= pageLimit; page++) {
    const params = new URLSearchParams({
      reportName: 'RPTA_WEB_RZRQ_GGMX', columns: 'DATE,RZYE',
      filter: `(SCODE="${code}")` + (startDate ? `(DATE>='${startDate}')` : ''),
      sortColumns: 'DATE', sortTypes: '-1', pageNumber: String(page), pageSize: String(pageSize),
      source: 'WEB', client: 'WEB',
    });
    const response = await fetchImpl('https://datacenter-web.eastmoney.com/api/data/v1/get?' + params, {
      headers: { Accept: 'application/json', Referer: 'https://data.eastmoney.com/' },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('东方财富 HTTP ' + response.status);
    const payload = await response.json();
    if (page === 1 && payload.code === 9201) return [];
    const result = payload.result;
    const pages = Number(result?.pages);
    if (payload.success !== true || !Array.isArray(result?.data) || !result.data.length ||
        !Number.isInteger(pages) || pages < page || pages > pageLimit ||
        (page < pages && result.data.length !== pageSize)) {
      throw new Error(payload.message === 'ok' ? '融资余额分页不完整' : payload.message || '融资余额数据异常');
    }
    for (const row of result.data) {
      const date = String(row.DATE).slice(0, 10);
      if (row.RZYE === null || row.RZYE === undefined || row.RZYE === '') continue;
      const balance = Number(row.RZYE);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || (startDate && date < startDate) ||
          !Number.isFinite(balance) || balance < 0) throw new Error('融资余额观测无效');
      items.push({ date, value: balance / 100000000 });
    }
    if (page === pages) return items;
  }
  throw new Error('融资余额历史超过分页上限');
}

async function refreshStockMargin(previous, codes, fetchImpl = globalThis.fetch) {
  const stocks = { ...previous.stocks };
  const failures = [];
  for (const code of [...new Set(codes)].sort()) {
    const oldItems = stocks[code] || [];
    const last = oldItems.at(-1);
    const startDate = last ? new Date(Date.parse(last.date) - 12 * 86400000).toISOString().slice(0, 10) : null;
    try {
      const fresh = await fetchStockMarginRows(code, startDate, fetchImpl);
      const byDate = new Map([...oldItems, ...fresh].map(item => [item.date, item]));
      stocks[code] = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      failures.push({ code, message: error.message });
    }
  }
  const sortedStocks = Object.fromEntries(Object.entries(stocks).sort(([a], [b]) => a.localeCompare(b)));
  return { snapshot: { schemaVersion: 1, stocks: sortedStocks }, failures };
}

async function main() {
  const previous = fs.existsSync(snapshotPath) ? JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) : { stocks: {} };
  let codes;
  try {
    codes = (await fetchFilmCinemaConstituents(globalThis.fetch)).map(stock => stock.code);
  } catch (error) {
    console.warn('影视院线成分股回退至内置名单和仓库已跟踪股票：' + error.message);
    codes = [...new Set([...TONGHUASHUN_FILM_CINEMA_CONSTITUENT_SNAPSHOT.map(stock => stock.code),
      ...Object.keys(previous.stocks)])];
  }
  const { snapshot, failures } = await refreshStockMargin(previous, codes);
  for (const { code, message } of failures) console.warn(`${code} 融资余额更新失败：${message}`);
  if (failures.length === codes.length) throw new Error('影视股票融资余额全部更新失败');
  if (JSON.stringify(snapshot) !== JSON.stringify(previous)) {
    const temporaryPath = `${snapshotPath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(snapshot) + '\n');
    fs.renameSync(temporaryPath, snapshotPath);
  }
  const populated = Object.values(snapshot.stocks).filter(items => items.length);
  console.log(`影视股票融资余额：${populated.length} 只有记录，${failures.length} 只更新失败`);
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });

module.exports = { refreshStockMargin };
