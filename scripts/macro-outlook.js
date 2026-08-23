const DEFAULT_MONTH_COUNT = 12;
const REQUEST_TIMEOUT_MS = 20_000;

// Nasdaq-100 monthly trailing P/E snapshot. Public historical index valuation APIs are not reliably available
// without a paid key, so the verified monthly series is bundled to keep the chart deterministic and usable offline.
const NASDAQ_100_PE_MONTHLY_CSV = `date,value
2016-08,22.82
2016-09,24.30
2016-10,23.93
2016-11,23.98
2016-12,24.24
2017-01,23.68
2017-02,24.66
2017-03,23.81
2017-04,24.45
2017-05,25.35
2017-06,24.06
2017-07,25.06
2017-08,25.53
2017-09,25.49
2017-10,24.09
2017-11,24.54
2017-12,24.66
2018-01,28.72
2018-02,28.32
2018-03,27.20
2018-04,25.70
2018-05,27.11
2018-06,27.39
2018-07,25.81
2018-08,27.31
2018-09,27.22
2018-10,23.43
2018-11,23.37
2018-12,18.92
2019-01,20.65
2019-02,21.22
2019-03,22.06
2019-04,23.21
2019-05,21.26
2019-06,22.88
2019-07,23.45
2019-08,22.98
2019-09,23.30
2019-10,24.30
2019-11,25.26
2019-12,24.74
2020-01,25.48
2020-02,23.97
2020-03,22.72
2020-04,26.18
2020-05,27.79
2020-06,30.09
2020-07,32.32
2020-08,35.88
2020-09,34.10
2020-10,33.01
2020-11,36.64
2020-12,35.54
2021-01,35.64
2021-02,35.60
2021-03,32.06
2021-04,33.94
2021-05,33.52
2021-06,30.28
2021-07,31.13
2021-08,32.42
2021-09,29.19
2021-10,31.51
2021-11,32.07
2021-12,31.08
2022-01,28.42
2022-02,27.11
2022-03,28.65
2022-04,24.82
2022-05,24.41
2022-06,23.85
2022-07,26.85
2022-08,25.46
2022-09,24.04
2022-10,24.99
2022-11,26.36
2022-12,23.97
2023-01,28.40
2023-02,28.26
2023-03,30.81
2023-04,30.96
2023-05,33.33
2023-06,32.66
2023-07,33.91
2023-08,33.36
2023-09,31.67
2023-10,29.61
2023-11,32.77
2023-12,34.57
2024-01,30.49
2024-02,32.11
2024-03,32.48
2024-04,29.90
2024-05,31.79
2024-06,33.75
2024-07,32.72
2024-08,33.08
2024-09,33.90
2024-10,34.42
2024-11,35.60
2024-12,34.18
2025-01,35.09
2025-02,33.95
2025-03,31.13
2025-04,32.90
2025-05,34.57
2025-06,35.61
2025-07,35.12
2025-08,34.94
2025-09,35.31
2025-10,34.30
2025-11,33.21
2025-12,34.21
2026-01,34.29
2026-02,34.61
2026-03,32.45
2026-04,36.77
2026-05,39.79
2026-06,42.16
2026-07,36.05
2026-08,33.82`;

const RANGE_CONFIG = {
  day1: { label: '1天', days: 1 },
  week1: { label: '1周', days: 7 },
  week2: { label: '2周', days: 14 },
  week4: { label: '4周', days: 28 },
  month1: { label: '1个月', months: 1 },
  month3: { label: '3个月', months: 3 },
  month6: { label: '6个月', months: 6 },
  year1: { label: '1年', months: 12 },
  year2: { label: '2年', months: 24 },
  year3: { label: '3年', months: 36 },
  year5: { label: '5年', months: 60 },
  year10: { label: '10年', months: 120 },
};

const CHART_METADATA = {
  treasuryYield: {
    id: 'treasuryYield',
    title: '美国 10 年期国债收益率',
    unit: '%',
    decimals: 2,
    frequency: '日度',
    sourceName: 'FRED / 美联储 H.15',
    sourceUrl: 'https://fred.stlouisfed.org/series/DGS10',
  },
  treasuryYield30: {
    id: 'treasuryYield30',
    title: '美国 30 年期国债收益率',
    unit: '%',
    decimals: 2,
    frequency: '日度',
    sourceName: 'FRED / 美联储 H.15',
    sourceUrl: 'https://fred.stlouisfed.org/series/DGS30',
  },
  cpi: {
    id: 'cpi',
    title: '美国 CPI 同比',
    unit: '%',
    decimals: 2,
    frequency: '月度',
    sourceName: 'FRED / 美国劳工统计局',
    sourceUrl: 'https://fred.stlouisfed.org/series/CPIAUCSL',
  },
  pce: {
    id: 'pce',
    title: '美国 PCE 同比',
    unit: '%',
    decimals: 2,
    frequency: '月度',
    sourceName: 'FRED / 美国经济分析局',
    sourceUrl: 'https://fred.stlouisfed.org/series/PCEPI',
  },
  gold: {
    id: 'gold',
    title: '黄金价格',
    unit: '美元/盎司',
    decimals: 2,
    frequency: '日度',
    sourceName: '新浪财经 / 伦敦金现货',
    sourceUrl: 'https://finance.sina.com.cn/futures/quotes/XAU.shtml',
  },
  bitcoin: {
    id: 'bitcoin',
    title: '比特币价格',
    unit: '美元',
    decimals: 2,
    frequency: '日度',
    sourceName: 'FRED / Coinbase',
    sourceUrl: 'https://fred.stlouisfed.org/series/CBBTCUSD',
  },
  federalDebt: {
    id: 'federalDebt',
    title: '美国联邦债务总额',
    unit: '万亿美元',
    decimals: 2,
    frequency: '日度',
    sourceName: '美国财政部 Fiscal Data / Debt to the Penny',
    sourceUrl: 'https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/',
  },
  jpyUsd: {
    id: 'jpyUsd',
    title: '日元兑美元汇率',
    unit: '日元/美元',
    decimals: 2,
    frequency: '日度',
    sourceName: 'FRED / 美联储 H.10',
    sourceUrl: 'https://fred.stlouisfed.org/series/DEXJPUS',
  },
  brentOil: {
    id: 'brentOil',
    title: '布伦特原油价格',
    unit: '美元/桶',
    decimals: 2,
    frequency: '日度',
    sourceName: 'FRED / 美国能源信息署 EIA',
    sourceUrl: 'https://fred.stlouisfed.org/series/DCOILBRENTEU',
  },
  wtiOil: {
    id: 'wtiOil',
    title: 'WTI 原油价格',
    unit: '美元/桶',
    decimals: 2,
    frequency: '日度',
    sourceName: 'FRED / 美国能源信息署 EIA',
    sourceUrl: 'https://fred.stlouisfed.org/series/DCOILWTICO',
  },
  aShareTurnover: {
    id: 'aShareTurnover',
    title: 'A股全A成交额',
    unit: '亿元',
    decimals: 0,
    frequency: '日度',
    sourceName: '中证指数官网 / 中证全指（000985）',
    sourceUrl: 'https://www.csindex.com.cn/#/indices/family/detail?indexCode=000985',
  },
  aShareMarginBalance: {
    id: 'aShareMarginBalance',
    title: 'A股融资余额（三市）',
    unit: '亿元',
    decimals: 0,
    frequency: '日度',
    sourceName: '东方财富 / 沪深北交易所汇总',
    sourceUrl: 'https://data.eastmoney.com/rzrq/',
  },
  aShareActiveMarketValueThs: {
    id: 'aShareActiveMarketValueThs',
    title: 'A股活跃市值（同花顺公式版）',
    unit: '亿元',
    decimals: 0,
    frequency: '日度',
    sourceName: '同花顺指标平台公开公式 / 搜狐证券行情',
    sourceUrl: 'https://poi.10jqka.com.cn/store/formula/detail/indexid/45424',
  },
  nasdaq100Pe: {
    id: 'nasdaq100Pe',
    title: '纳斯达克100市盈率（NDX）',
    unit: '倍',
    decimals: 2,
    frequency: '月度',
    sourceName: 'Trendonify / Nasdaq-100 TTM P/E（月度）',
    sourceUrl: 'https://trendonify.com/united-states/stock-market/nasdaq-100/pe-ratio',
  },
  ndx: {
    id: 'ndx',
    title: 'NDX（纳斯达克100指数）',
    unit: '点',
    decimals: 2,
    frequency: '日度',
    sourceName: 'FRED / Nasdaq, Inc.',
    sourceUrl: 'https://fred.stlouisfed.org/series/NASDAQ100',
  },
  sp500: {
    id: 'sp500',
    title: '标普500指数（SPX）',
    unit: '点',
    decimals: 2,
    frequency: '日度',
    sourceName: 'FRED / S&P Dow Jones Indices',
    sourceUrl: 'https://fred.stlouisfed.org/series/SP500',
  },
  vix: {
    id: 'vix', title: 'VIX恐慌指数', unit: '点', decimals: 2, frequency: '日度',
    sourceName: 'FRED / CBOE', sourceUrl: 'https://fred.stlouisfed.org/series/VIXCLS',
  },
  treasurySpread: {
    id: 'treasurySpread', title: '美国10年-2年国债利差', unit: '%', decimals: 2, frequency: '日度',
    sourceName: 'FRED / 美国财政部', sourceUrl: 'https://fred.stlouisfed.org/series/T10Y2Y',
  },
  highYieldSpread: {
    id: 'highYieldSpread', title: '美国高收益债信用利差', unit: '%', decimals: 2, frequency: '日度',
    sourceName: 'FRED / ICE BofA', sourceUrl: 'https://fred.stlouisfed.org/series/BAMLH0A0HYM2',
  },
  broadDollar: {
    id: 'broadDollar', title: '广义美元指数', unit: '点', decimals: 2, frequency: '日度',
    sourceName: 'FRED / 美联储 H.10', sourceUrl: 'https://fred.stlouisfed.org/series/DTWEXBGS',
  },
  initialClaims: {
    id: 'initialClaims', title: '美国初次申请失业金人数', unit: '万人', decimals: 1, frequency: '周度',
    sourceName: 'FRED / 美国劳工部', sourceUrl: 'https://fred.stlouisfed.org/series/ICSA',
  },
  financialConditions: {
    id: 'financialConditions', title: '美国金融状况指数', unit: '指数', decimals: 2, frequency: '周度',
    sourceName: 'FRED / 芝加哥联储', sourceUrl: 'https://fred.stlouisfed.org/series/NFCI',
  },
};

const ALL_CHART_IDS = Object.freeze(Object.keys(CHART_METADATA));

function normalizeChartIds(chartIds) {
  if (!Array.isArray(chartIds)) return [...ALL_CHART_IDS];
  return ALL_CHART_IDS.filter((chartId) => chartIds.includes(chartId));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < String(text ?? '').length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      inQuotes = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''));
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    if (row.some((value) => value !== '')) rows.push(row);
  }

  return rows;
}

function normalizeObservationDate(value) {
  const text = String(value ?? '').trim();
  const imfMonth = /^(\d{4})-M(\d{1,2})$/.exec(text);
  if (imfMonth) return `${imfMonth[1]}-${imfMonth[2].padStart(2, '0')}-01`;
  if (/^\d{4}-\d{2}$/.test(text)) return `${text}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return null;
}

function parseFredCsv(text, seriesId) {
  const rows = parseCsv(text);
  const header = rows[0] ?? [];
  const dateIndex = header.findIndex((value) => ['observation_date', 'DATE', 'TIME_PERIOD'].includes(value));
  const valueIndex = header.indexOf(seriesId);

  if (dateIndex < 0 || valueIndex < 0) {
    throw new Error(`FRED 返回内容缺少 ${seriesId} 字段`);
  }

  return rows.slice(1).map((row) => {
    const date = normalizeObservationDate(row[dateIndex]);
    const rawValue = String(row[valueIndex] ?? '').trim();
    const value = rawValue && rawValue !== '.' ? Number(rawValue) : Number.NaN;
    return date && Number.isFinite(value) ? { date, value } : null;
  }).filter(Boolean);
}

function parseImfCsv(text, indicator = 'PGOLD') {
  const rows = parseCsv(text);
  const header = rows[0] ?? [];
  const indicatorIndex = header.indexOf('INDICATOR');
  const dateIndex = header.indexOf('TIME_PERIOD');
  const valueIndex = header.indexOf('OBS_VALUE');

  if (indicatorIndex < 0 || dateIndex < 0 || valueIndex < 0) {
    throw new Error('IMF 返回内容缺少黄金价格字段');
  }

  return rows.slice(1).map((row) => {
    if (row[indicatorIndex] !== indicator) return null;
    const date = normalizeObservationDate(row[dateIndex]);
    const rawValue = String(row[valueIndex] ?? '').trim();
    const value = rawValue ? Number(rawValue) : Number.NaN;
    return date && Number.isFinite(value) ? { date, value } : null;
  }).filter(Boolean);
}

function getMonthKey(dateText) {
  return String(dateText ?? '').slice(0, 7);
}

function shiftMonthKey(monthKey, offset) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return null;
  const shifted = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

function calculateYearOverYear(items, count = DEFAULT_MONTH_COUNT) {
  const sortedItems = [...items].sort((left, right) => left.date.localeCompare(right.date));
  const valuesByMonth = new Map(sortedItems.map((item) => [getMonthKey(item.date), Number(item.value)]));

  const convertedItems = sortedItems.map((item) => {
    const previousValue = valuesByMonth.get(shiftMonthKey(getMonthKey(item.date), -12));
    if (!Number.isFinite(previousValue) || previousValue === 0) return null;
    return {
      date: item.date,
      value: ((Number(item.value) / previousValue) - 1) * 100,
    };
  }).filter(Boolean);

  return Number.isInteger(count) && count > 0 ? convertedItems.slice(-count) : convertedItems;
}

function getUtcDate(value = new Date()) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('无效的查询日期');
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function shiftUtcMonths(value, offset) {
  const date = getUtcDate(value);
  const targetMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
  const lastDay = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)).getUTCDate();
  targetMonth.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return targetMonth;
}

function shiftUtcDays(value, offset) {
  const date = getUtcDate(value);
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
}

function normalizeRange(range) {
  return RANGE_CONFIG[range] ? range : 'month3';
}

function getRangeStart(value, range) {
  const config = RANGE_CONFIG[normalizeRange(range)];
  if (normalizeRange(range) === 'month1') {
    const date = getUtcDate(value);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }
  return Number.isInteger(config.months)
    ? shiftUtcMonths(value, -config.months)
    : shiftUtcDays(value, -config.days);
}

function formatIsoDate(value) {
  return getUtcDate(value).toISOString().slice(0, 10);
}

function formatIsoMonth(value) {
  return formatIsoDate(value).slice(0, 7);
}

function buildFredUrl(seriesId, startDate, endDate) {
  const params = new URLSearchParams({
    id: seriesId,
    cosd: startDate,
    coed: endDate,
  });
  return `https://fred.stlouisfed.org/graph/fredgraph.csv?${params.toString()}`;
}

function buildImfGoldUrl(startMonth, endMonth) {
  const params = new URLSearchParams({ startPeriod: startMonth, endPeriod: endMonth });
  return `https://api.imf.org/external/sdmx/2.1/data/IMF.RES,PCPS/G001.PGOLD.USD.M?${params.toString()}`;
}

function buildSinaGoldUrl() {
  return 'https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20_XAU=/GlobalFuturesService.getGlobalFuturesDailyKLine?symbol=XAU';
}

function buildTreasuryDebtUrl(startDate, endDate) {
  const params = new URLSearchParams({
    fields: 'record_date,tot_pub_debt_out_amt',
    filter: `record_date:gte:${startDate},record_date:lte:${endDate}`,
    sort: 'record_date',
    'page[size]': '10000',
  });
  return `https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?${params.toString()}`;
}

function buildAShareTurnoverUrl(startDate, endDate) {
  const params = new URLSearchParams({
    indexCode: '000985',
    startDate: String(startDate).replaceAll('-', ''),
    endDate: String(endDate).replaceAll('-', ''),
  });
  return `https://www.csindex.com.cn/csindex-home/perf/index-perf?${params.toString()}`;
}

function buildAShareMarginBalanceUrl(startDate, pageNumber = 1) {
  const params = new URLSearchParams({
    reportName: 'RPTA_WEB_MARGIN_DAILYTRADE',
    columns: 'STATISTICS_DATE,FIN_BALANCE',
    filter: `(STATISTICS_DATE>='${startDate}')`,
    pageNumber: String(pageNumber),
    pageSize: '500',
    sortTypes: '1',
    sortColumns: 'STATISTICS_DATE',
    source: 'WEB',
    client: 'WEB',
  });
  return `https://datacenter-web.eastmoney.com/api/data/v1/get?${params.toString()}`;
}

function buildSohuIndexHistoryUrl(code, startDate, endDate) {
  const params = new URLSearchParams({
    code,
    start: String(startDate).replaceAll('-', ''),
    end: String(endDate).replaceAll('-', ''),
    stat: '1',
    order: 'D',
    period: 'd',
    rt: 'json',
  });
  return `https://q.stock.sohu.com/hisHq?${params.toString()}`;
}

function parseTreasuryDebt(text) {
  const rows = JSON.parse(String(text ?? ''))?.data;
  if (!Array.isArray(rows)) throw new Error('美国财政部债务数据格式无效');
  return rows.map((row) => {
    const date = normalizeObservationDate(row?.record_date);
    const rawValue = row?.tot_pub_debt_out_amt;
    const value = rawValue === null || rawValue === undefined || rawValue === '' ? Number.NaN : Number(rawValue) / 1_000_000_000_000;
    return date && Number.isFinite(value) ? { date, value } : null;
  }).filter(Boolean);
}

function parseSinaGold(text) {
  const source = String(text ?? '');
  const startIndex = source.indexOf('[');
  const endIndex = source.lastIndexOf(']');
  if (startIndex < 0 || endIndex <= startIndex) throw new Error('黄金数据格式无效');
  const rows = JSON.parse(source.slice(startIndex, endIndex + 1));
  return rows.map((row) => {
    const date = normalizeObservationDate(row?.date);
    const rawValue = row?.close;
    const value = rawValue === null || rawValue === undefined || rawValue === '' ? Number.NaN : Number(rawValue);
    return date && Number.isFinite(value) ? { date, value } : null;
  }).filter(Boolean);
}

function parseAShareTurnover(text) {
  const payload = JSON.parse(String(text ?? ''));
  if (String(payload?.code) !== '200') throw new Error(payload?.msg || 'A股全A成交额返回异常');
  const rows = payload?.data;
  if (!Array.isArray(rows)) throw new Error('A股全A成交额数据格式无效');
  return rows.map((row) => {
    const compactDate = String(row?.tradeDate ?? '');
    const date = /^\d{8}$/.test(compactDate)
      ? `${compactDate.slice(0, 4)}-${compactDate.slice(4, 6)}-${compactDate.slice(6, 8)}`
      : normalizeObservationDate(compactDate);
    // 中证指数官网的 tradingValue 字段单位为亿元。
    const rawValue = row?.tradingValue;
    const value = rawValue === null || rawValue === undefined || rawValue === '' ? Number.NaN : Number(rawValue);
    return date && Number.isFinite(value) ? { date, value } : null;
  }).filter(Boolean);
}

function parseAShareMarginBalance(text) {
  const payload = JSON.parse(String(text ?? ''));
  if (payload?.success !== true) throw new Error(payload?.message || 'A股融资余额返回异常');
  const rows = payload?.result?.data;
  if (!Array.isArray(rows)) throw new Error('A股融资余额数据格式无效');
  return rows.map((row) => {
    const dateText = String(row?.STATISTICS_DATE ?? row?.TRADE_DATE ?? '').slice(0, 10);
    const date = normalizeObservationDate(dateText);
    const rawValue = row?.FIN_BALANCE;
    // RPTA_WEB_MARGIN_DAILYTRADE 的 FIN_BALANCE 已按亿元提供。
    const value = rawValue === null || rawValue === undefined || rawValue === ''
      ? Number.NaN
      : Number(rawValue);
    return date && Number.isFinite(value) ? { date, value } : null;
  }).filter(Boolean);
}

function parseSohuIndexAmount(text) {
  const payload = JSON.parse(String(text ?? ''));
  const rows = payload?.[0]?.hq;
  if (!Array.isArray(rows)) throw new Error('搜狐指数成交额数据格式无效');
  return rows.map((row) => {
    const date = normalizeObservationDate(row?.[0]);
    // 搜狐指数历史行情的成交额字段单位为万元，统一换算成元。
    const amount = Number(row?.[8]) * 10_000;
    return date && Number.isFinite(amount) ? { date, value: amount } : null;
  }).filter(Boolean);
}

function calculateTonghuashunActiveMarketValue(shanghaiItems, shenzhenItems) {
  const shenzhenByDate = new Map(shenzhenItems.map((item) => [item.date, Number(item.value)]));
  let previous;
  return [...shanghaiItems]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((item) => {
      const shanghaiAmount = Number(item.value);
      const shenzhenAmount = shenzhenByDate.get(item.date);
      if (!Number.isFinite(shanghaiAmount) || !Number.isFinite(shenzhenAmount)) return null;
      const combinedAmountInHundredMillion = (shanghaiAmount + shenzhenAmount) / 100_000_000;
      // 同花顺 SMA(X, 10, 1)：Y = (X + 9 * 上一期 Y) / 10。
      previous = Number.isFinite(previous)
        ? (combinedAmountInHundredMillion + 9 * previous) / 10
        : combinedAmountInHundredMillion;
      return { date: item.date, value: previous };
    })
    .filter(Boolean);
}

function parseNasdaq100PeSnapshot(text = NASDAQ_100_PE_MONTHLY_CSV) {
  const rows = parseCsv(text);
  return rows.slice(1).map((row) => {
    const date = normalizeObservationDate(row[0]);
    const value = Number(row[1]);
    return date && Number.isFinite(value) ? { date, value } : null;
  }).filter(Boolean);
}

async function fetchCsv(url, fetchImpl, extraHeaders = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const options = {
      headers: {
        Accept: 'text/csv',
        'User-Agent': 'DailyReview/1.0',
        ...extraHeaders,
      },
    };
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      options.signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    }

    try {
      const response = await fetchImpl(url, options);
      if (!response?.ok) {
        throw new Error('数据源请求失败（HTTP ' + (response?.status ?? '--') + '）');
      }
      const text = await response.text();
      if (!text.trim()) throw new Error('数据源返回空内容');
      return text;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }
  }
  throw lastError;
}

function filterDateRange(items, startDate, endDate) {
  return items
    .filter((item) => item.date >= startDate && item.date <= endDate)
    .sort((left, right) => left.date.localeCompare(right.date));
}

function filterRecentItems(items, range, frequency = 'daily') {
  const sortedItems = [...items].sort((left, right) => left.date.localeCompare(right.date));
  if (sortedItems.length === 0) return [];
  const config = RANGE_CONFIG[normalizeRange(range)];

  if (frequency === 'monthly') {
    return Number.isInteger(config.months) ? sortedItems.slice(-config.months) : sortedItems.slice(-1);
  }

  if (frequency === 'quarterly') {
    return Number.isInteger(config.months) ? sortedItems.slice(-Math.ceil(config.months / 3)) : sortedItems.slice(-1);
  }

  const latestDate = getUtcDate(sortedItems.at(-1).date);
  const startDate = normalizeRange(range) === 'month1'
    ? new Date(Date.UTC(latestDate.getUTCFullYear(), latestDate.getUTCMonth(), 1))
    : Number.isInteger(config.months)
    ? shiftUtcMonths(latestDate, -config.months)
    : shiftUtcDays(latestDate, -config.days);
  const startDateText = formatIsoDate(startDate);
  return sortedItems.filter((item) => item.date >= startDateText);
}

async function loadChart(metadata, loader) {
  try {
    const items = await loader();
    if (items.length === 0) throw new Error('最近 12 个月暂无可用数据');
    return { ...metadata, items, error: null };
  } catch (error) {
    return {
      ...metadata,
      items: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function queryMacroOutlook(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('当前运行环境不支持网络请求');

  const now = getUtcDate(options.now ?? new Date());
  const range = normalizeRange(options.range);
  const rangeConfig = RANGE_CONFIG[range];
  const endDate = formatIsoDate(now);
  const requestedStartDate = getRangeStart(now, range);
  const dailyStartDate = formatIsoDate(shiftUtcDays(requestedStartDate, -14));
  const inflationStartDate = formatIsoDate(shiftUtcMonths(requestedStartDate, -15));

  const loaders = {
    treasuryYield: () => loadChart(CHART_METADATA.treasuryYield, async () => {
      const text = await fetchCsv(buildFredUrl('DGS10', dailyStartDate, endDate), fetchImpl);
      const availableItems = filterDateRange(parseFredCsv(text, 'DGS10'), dailyStartDate, endDate);
      return filterRecentItems(availableItems, range);
    }),
    treasuryYield30: () => loadChart(CHART_METADATA.treasuryYield30, async () => {
      const text = await fetchCsv(buildFredUrl('DGS30', dailyStartDate, endDate), fetchImpl);
      const availableItems = filterDateRange(parseFredCsv(text, 'DGS30'), dailyStartDate, endDate);
      return filterRecentItems(availableItems, range);
    }),
    cpi: () => loadChart(CHART_METADATA.cpi, async () => {
      const text = await fetchCsv(buildFredUrl('CPIAUCSL', inflationStartDate, endDate), fetchImpl);
      return filterRecentItems(calculateYearOverYear(parseFredCsv(text, 'CPIAUCSL'), null), range, 'monthly');
    }),
    pce: () => loadChart(CHART_METADATA.pce, async () => {
      const text = await fetchCsv(buildFredUrl('PCEPI', inflationStartDate, endDate), fetchImpl);
      return filterRecentItems(calculateYearOverYear(parseFredCsv(text, 'PCEPI'), null), range, 'monthly');
    }),
    gold: () => loadChart(CHART_METADATA.gold, async () => {
      const text = await fetchCsv(buildSinaGoldUrl(), fetchImpl, { Referer: 'https://finance.sina.com.cn/' });
      const availableItems = filterDateRange(parseSinaGold(text), dailyStartDate, endDate);
      return filterRecentItems(availableItems, range);
    }),
    bitcoin: () => loadChart(CHART_METADATA.bitcoin, async () => {
      const text = await fetchCsv(buildFredUrl('CBBTCUSD', dailyStartDate, endDate), fetchImpl);
      const availableItems = filterDateRange(parseFredCsv(text, 'CBBTCUSD'), dailyStartDate, endDate);
      return filterRecentItems(availableItems, range);
    }),
    federalDebt: () => loadChart(CHART_METADATA.federalDebt, async () => {
      const text = await fetchCsv(buildTreasuryDebtUrl(dailyStartDate, endDate), fetchImpl, { Accept: 'application/json' });
      return filterRecentItems(parseTreasuryDebt(text), range);
    }),
    jpyUsd: () => loadChart(CHART_METADATA.jpyUsd, async () => {
      const text = await fetchCsv(buildFredUrl('DEXJPUS', dailyStartDate, endDate), fetchImpl);
      const availableItems = filterDateRange(parseFredCsv(text, 'DEXJPUS'), dailyStartDate, endDate);
      return filterRecentItems(availableItems, range);
    }),
    brentOil: () => loadChart(CHART_METADATA.brentOil, async () => {
      const text = await fetchCsv(buildFredUrl('DCOILBRENTEU', dailyStartDate, endDate), fetchImpl);
      const availableItems = filterDateRange(parseFredCsv(text, 'DCOILBRENTEU'), dailyStartDate, endDate);
      return filterRecentItems(availableItems, range);
    }),
    wtiOil: () => loadChart(CHART_METADATA.wtiOil, async () => {
      const text = await fetchCsv(buildFredUrl('DCOILWTICO', dailyStartDate, endDate), fetchImpl);
      const availableItems = filterDateRange(parseFredCsv(text, 'DCOILWTICO'), dailyStartDate, endDate);
      return filterRecentItems(availableItems, range);
    }),
    aShareTurnover: () => loadChart(CHART_METADATA.aShareTurnover, async () => {
      const text = await fetchCsv(buildAShareTurnoverUrl(dailyStartDate, endDate), fetchImpl, {
        Accept: 'application/json',
        Referer: 'https://www.csindex.com.cn/',
      });
      const uniqueItems = [...new Map(parseAShareTurnover(text).map((item) => [item.date, item])).values()];
      const availableItems = filterDateRange(uniqueItems, dailyStartDate, endDate);
      return filterRecentItems(availableItems, range);
    }),
    aShareMarginBalance: () => loadChart(CHART_METADATA.aShareMarginBalance, async () => {
      const headers = {
        Accept: 'application/json',
        Referer: 'https://data.eastmoney.com/',
      };
      const firstText = await fetchCsv(buildAShareMarginBalanceUrl(dailyStartDate, 1), fetchImpl, headers);
      const firstPayload = JSON.parse(firstText);
      const pageCount = Math.max(1, Math.min(20, Number(firstPayload?.result?.pages) || 1));
      const remainingTexts = await Promise.all(
        Array.from({ length: pageCount - 1 }, (_, index) => (
          fetchCsv(buildAShareMarginBalanceUrl(dailyStartDate, index + 2), fetchImpl, headers)
        )),
      );
      const uniqueItems = [...new Map(
        [firstText, ...remainingTexts].flatMap(parseAShareMarginBalance).map((item) => [item.date, item]),
      ).values()];
      const availableItems = filterDateRange(uniqueItems, dailyStartDate, endDate);
      return filterRecentItems(availableItems, range);
    }),
    aShareActiveMarketValueThs: () => loadChart(CHART_METADATA.aShareActiveMarketValueThs, async () => {
      const warmupStartDate = formatIsoDate(shiftUtcDays(requestedStartDate, -180));
      const headers = { Accept: 'application/json', Referer: 'https://q.stock.sohu.com/' };
      const [shanghaiText, shenzhenText] = await Promise.all([
        fetchCsv(buildSohuIndexHistoryUrl('zs_000001', warmupStartDate, endDate), fetchImpl, headers),
        fetchCsv(buildSohuIndexHistoryUrl('zs_399106', warmupStartDate, endDate), fetchImpl, headers),
      ]);
      const calculatedItems = calculateTonghuashunActiveMarketValue(
        parseSohuIndexAmount(shanghaiText),
        parseSohuIndexAmount(shenzhenText),
      );
      const availableItems = filterDateRange(calculatedItems, dailyStartDate, endDate);
      return filterRecentItems(availableItems, range);
    }),
    nasdaq100Pe: () => loadChart(CHART_METADATA.nasdaq100Pe, async () => (
      filterRecentItems(parseNasdaq100PeSnapshot(), range, 'monthly')
    )),
    ndx: () => loadChart(CHART_METADATA.ndx, async () => {
      const text = await fetchCsv(buildFredUrl('NASDAQ100', dailyStartDate, endDate), fetchImpl);
      const availableItems = filterDateRange(parseFredCsv(text, 'NASDAQ100'), dailyStartDate, endDate);
      return filterRecentItems(availableItems, range);
    }),
    sp500: () => loadChart(CHART_METADATA.sp500, async () => {
      const text = await fetchCsv(buildFredUrl('SP500', dailyStartDate, endDate), fetchImpl);
      const availableItems = filterDateRange(parseFredCsv(text, 'SP500'), dailyStartDate, endDate);
      return filterRecentItems(availableItems, range);
    }),
    vix: () => loadChart(CHART_METADATA.vix, async () => {
      const text = await fetchCsv(buildFredUrl('VIXCLS', dailyStartDate, endDate), fetchImpl);
      return filterRecentItems(filterDateRange(parseFredCsv(text, 'VIXCLS'), dailyStartDate, endDate), range);
    }),
    treasurySpread: () => loadChart(CHART_METADATA.treasurySpread, async () => {
      const text = await fetchCsv(buildFredUrl('T10Y2Y', dailyStartDate, endDate), fetchImpl);
      return filterRecentItems(filterDateRange(parseFredCsv(text, 'T10Y2Y'), dailyStartDate, endDate), range);
    }),
    highYieldSpread: () => loadChart(CHART_METADATA.highYieldSpread, async () => {
      const text = await fetchCsv(buildFredUrl('BAMLH0A0HYM2', dailyStartDate, endDate), fetchImpl);
      return filterRecentItems(filterDateRange(parseFredCsv(text, 'BAMLH0A0HYM2'), dailyStartDate, endDate), range);
    }),
    broadDollar: () => loadChart(CHART_METADATA.broadDollar, async () => {
      const text = await fetchCsv(buildFredUrl('DTWEXBGS', dailyStartDate, endDate), fetchImpl);
      return filterRecentItems(filterDateRange(parseFredCsv(text, 'DTWEXBGS'), dailyStartDate, endDate), range);
    }),
    initialClaims: () => loadChart(CHART_METADATA.initialClaims, async () => {
      const text = await fetchCsv(buildFredUrl('ICSA', dailyStartDate, endDate), fetchImpl);
      const items = filterDateRange(parseFredCsv(text, 'ICSA'), dailyStartDate, endDate)
        .map((item) => ({ ...item, value: item.value / 10_000 }));
      return filterRecentItems(items, range);
    }),
    financialConditions: () => loadChart(CHART_METADATA.financialConditions, async () => {
      const text = await fetchCsv(buildFredUrl('NFCI', dailyStartDate, endDate), fetchImpl);
      return filterRecentItems(filterDateRange(parseFredCsv(text, 'NFCI'), dailyStartDate, endDate), range);
    }),
  };
  const selectedChartIds = normalizeChartIds(options.chartIds);
  const charts = await Promise.all(selectedChartIds.map((chartId) => loaders[chartId]()));

  return {
    charts,
    fetchedAt: new Date().toISOString(),
    range,
    rangeLabel: rangeConfig.label,
  };
}

module.exports = {
  CHART_METADATA,
  DEFAULT_MONTH_COUNT,
  RANGE_CONFIG,
  buildFredUrl,
  buildImfGoldUrl,
  buildSinaGoldUrl,
  buildTreasuryDebtUrl,
  buildAShareTurnoverUrl,
  buildAShareMarginBalanceUrl,
  buildSohuIndexHistoryUrl,
  calculateYearOverYear,
  filterRecentItems,
  normalizeObservationDate,
  normalizeChartIds,
  normalizeRange,
  parseCsv,
  parseFredCsv,
  parseImfCsv,
  parseSinaGold,
  parseTreasuryDebt,
  parseAShareTurnover,
  parseAShareMarginBalance,
  parseSohuIndexAmount,
  calculateTonghuashunActiveMarketValue,
  parseNasdaq100PeSnapshot,
  queryMacroOutlook,
};
