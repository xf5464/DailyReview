const holdingsData = require('./data/national-team-etf-holdings.json');
const summarySnapshot = require('./data/national-team-wide-etf-summary.json');

const EASTMONEY_KLINE_URL = 'https://push2his.eastmoney.com/api/qt/stock/kline/get';
const TENCENT_KLINE_URL = 'https://ifzq.gtimg.cn/appstock/app/fqkline/get';
const BROAD_INDEX_PATTERNS = Object.freeze([
  ['沪深300', /沪深300|^300ETF|HS300ETF|华夏300/],
  ['中证500', /中证500|^500ETF|500基金/],
  ['中证1000', /中证1000|^1000ETF|1000基金/],
  ['中证A50', /中证A50|中国A50/],
  ['科创50', /科创板?50|科创50|^科创ETF/],
  ['创业板50', /创业板50/],
  ['创业板价值', /创业板价值/],
  ['创业板成长', /创业板成长/],
  ['创业板', /创业板ETF|创业板指/],
  ['上证50', /上证50|^50ETF/],
  ['上证180', /上证180|180ETF/],
  ['深证100', /深证100/],
  ['中证800', /中证800|800ETF/],
  ['中小100', /中小100/],
]);

function classifyBroadIndex(etfName) {
  return BROAD_INDEX_PATTERNS.find(([, pattern]) => pattern.test(String(etfName)))?.[0] ?? null;
}

function buildEastmoneyKlineUrl(etfCode, firstReportDate, lastReportDate) {
  const url = new URL(EASTMONEY_KLINE_URL);
  const market = /^[569]/.test(String(etfCode)) ? '1' : '0';
  Object.entries({
    secid: `${market}.${etfCode}`,
    klt: '103',
    fqt: '1',
    beg: firstReportDate.replaceAll('-', ''),
    end: lastReportDate.replaceAll('-', ''),
    lmt: '240',
    fields1: 'f1,f2,f3,f4,f5,f6',
    fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
  }).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

function parseEastmoneyKlines(payload) {
  const value = typeof payload === 'string' ? JSON.parse(payload) : payload;
  if (value?.rc !== 0 || !Array.isArray(value?.data?.klines)) return [];
  return value.data.klines.map((line) => {
    const [date, , close] = String(line).split(',');
    return { date, close: Number(close) };
  }).filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && Number.isFinite(row.close) && row.close > 0)
    .sort((left, right) => left.date.localeCompare(right.date));
}

function buildTencentKlineUrl(etfCode, firstReportDate, lastReportDate) {
  const market = /^[569]/.test(String(etfCode)) ? 'sh' : 'sz';
  const url = new URL(TENCENT_KLINE_URL);
  url.searchParams.set('param', `${market}${etfCode},month,${firstReportDate},${lastReportDate},240,qfq`);
  return url.toString();
}

function parseTencentKlines(payload, etfCode) {
  const value = typeof payload === 'string' ? JSON.parse(payload) : payload;
  const market = /^[569]/.test(String(etfCode)) ? 'sh' : 'sz';
  const security = value?.data?.[`${market}${etfCode}`];
  const klines = security?.qfqmonth ?? security?.month ?? [];
  return klines.map((line) => {
    const fields = Array.isArray(line) ? line : String(line).split(',');
    return { date: fields[0], close: Number(fields[2]) };
  }).filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && Number.isFinite(row.close) && row.close > 0)
    .sort((left, right) => left.date.localeCompare(right.date));
}

function closeAtOrBefore(rows, reportDate) {
  return rows.filter((row) => row.date <= reportDate).at(-1) ?? null;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function fetchEtfPriceHistory(etfCode, firstReportDate, lastReportDate, fetchImpl) {
  const providers = [
    {
      url: buildTencentKlineUrl(etfCode, firstReportDate, lastReportDate),
      referer: 'https://gu.qq.com/',
      parse: (payload) => parseTencentKlines(payload, etfCode),
    },
    {
      url: buildEastmoneyKlineUrl(etfCode, firstReportDate, lastReportDate),
      referer: 'https://quote.eastmoney.com/',
      parse: parseEastmoneyKlines,
    },
  ];
  const errors = [];
  for (const provider of providers) {
    try {
      const response = await fetchImpl(provider.url, {
        headers: {
          Accept: 'application/json',
          Referer: provider.referer,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = typeof response.json === 'function' ? await response.json() : await response.text();
      const rows = provider.parse(payload);
      if (!rows.length) throw new Error('行情返回空数据');
      return rows;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(errors.join('；'));
}

function aggregateWideEtfHoldings(series, periods, priceHistoryByCode) {
  const rowsByIndex = new Map();
  for (const period of periods) {
    const groups = new Map();
    for (const item of series) {
      const broadIndex = classifyBroadIndex(item.etfName);
      const shares10k = Number(item.holdings?.[period.key] ?? 0);
      if (!broadIndex || shares10k <= 0) continue;
      const quote = closeAtOrBefore(priceHistoryByCode.get(item.etfCode) ?? [], period.reportDate);
      if (!quote) continue;
      const group = groups.get(broadIndex) ?? { value: 0, etfCodes: new Set(), pricedDate: quote.date };
      group.value += shares10k * quote.close / 10000;
      group.etfCodes.add(item.etfCode);
      if (quote.date > group.pricedDate) group.pricedDate = quote.date;
      groups.set(broadIndex, group);
    }
    for (const [broadIndex, group] of groups) {
      if (!rowsByIndex.has(broadIndex)) rowsByIndex.set(broadIndex, []);
      rowsByIndex.get(broadIndex).push({
        date: period.reportDate,
        quarter: period.label,
        value: group.value,
        etfCount: group.etfCodes.size,
        priceDate: group.pricedDate,
      });
    }
  }
  const rows = [...rowsByIndex.entries()].map(([broadIndex, quarterlyItems]) => ({ broadIndex, quarterlyItems }));
  const items = periods.map((period) => ({
    date: period.reportDate,
    quarter: period.label,
    value: rows.reduce((sum, row) => sum + Number(row.quarterlyItems.find((item) => item.date === period.reportDate)?.value ?? 0), 0),
  })).filter((item) => item.value > 0);
  return { items, rows };
}

async function queryNationalTeamWideEtf(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('当前运行环境不支持网络请求');
  const periods = holdingsData.periods ?? [];
  if (!periods.length) throw new Error('国家队 ETF 披露快照没有报告期');
  const combinedByCode = new Map();
  Object.values(holdingsData.series ?? {}).flat().forEach((item) => {
    const broadIndex = classifyBroadIndex(item.etfName);
    if (!broadIndex) return;
    const combined = combinedByCode.get(item.etfCode) ?? {
      etfCode: item.etfCode,
      etfName: item.etfName,
      holdings: {},
    };
    periods.forEach((period) => {
      combined.holdings[period.key] = Number(combined.holdings[period.key] ?? 0) + Number(item.holdings?.[period.key] ?? 0);
    });
    combinedByCode.set(item.etfCode, combined);
  });
  const series = [...combinedByCode.values()];
  const priceResults = await mapWithConcurrency(series, options.concurrency ?? 6, async (item) => {
    try {
      return [item.etfCode, await fetchEtfPriceHistory(
        item.etfCode,
        periods[0].reportDate,
        periods.at(-1).reportDate,
        fetchImpl,
      )];
    } catch {
      return [item.etfCode, []];
    }
  });
  const priceHistoryByCode = new Map(priceResults);
  let result = aggregateWideEtfHoldings(series, periods, priceHistoryByCode);
  let dataFallback = false;
  if (!result.items.length) {
    result = {
      items: summarySnapshot.items ?? [],
      rows: summarySnapshot.rows ?? [],
    };
    dataFallback = true;
  }
  if (!result.items.length) throw new Error('国家队宽基 ETF 暂未匹配到报告期行情');
  const latestDate = result.items.at(-1).date;
  result.rows.forEach((row) => {
    const latest = row.quarterlyItems.filter((item) => item.date <= latestDate).at(-1) ?? null;
    row.latestDate = latest?.date ?? null;
    row.latestValue = latest?.value ?? null;
  });
  result.rows.sort((left, right) => Number(right.latestValue ?? 0) - Number(left.latestValue ?? 0));
  return {
    ...result,
    chartType: 'wideEtfTable',
    periods,
    organizations: holdingsData.organizations,
    disclosureGeneratedAt: holdingsData.generatedAt,
    estimateGeneratedAt: dataFallback ? summarySnapshot.generatedAt : new Date().toISOString(),
    dataFallback,
    sourceNote: holdingsData.source?.note,
    pricedEtfs: dataFallback ? summarySnapshot.pricedEtfs : priceResults.filter(([, rows]) => rows.length > 0).length,
    totalEtfs: series.length,
  };
}

module.exports = {
  BROAD_INDEX_PATTERNS,
  aggregateWideEtfHoldings,
  buildEastmoneyKlineUrl,
  buildTencentKlineUrl,
  classifyBroadIndex,
  parseEastmoneyKlines,
  parseTencentKlines,
  queryNationalTeamWideEtf,
};
