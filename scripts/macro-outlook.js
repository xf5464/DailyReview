const DEFAULT_MONTH_COUNT = 12;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_OIL_SUPPLEMENT_DAYS = 14;
const WORLD_GOLD_COUNCIL_ORIGIN = 'https://www.gold.org';
const WORLD_GOLD_COUNCIL_GDT_INDEX_URL = `${WORLD_GOLD_COUNCIL_ORIGIN}/goldhub/research/gold-demand-trends`;
const WORLD_GOLD_COUNCIL_DEMAND_SOURCE_URL = `${WORLD_GOLD_COUNCIL_ORIGIN}/goldhub/data/gold-demand-by-country`;
const CBOE_VIX_HISTORY_URL = 'https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv';
const CBOE_VIX_HISTORY_PAGE_URL = 'https://www.cboe.com/tradable-products/vix/vix-historical-data';
const BEA_NEWS_RSS_URL = 'https://apps.bea.gov/rss/rss.xml';
const BEA_PCE_SOURCE_URL = 'https://www.bea.gov/data/personal-consumption-expenditures-price-index';
const TONGHUASHUN_SENTIMENT_PAGE_URL = 'https://q.10jqka.com.cn/thshy/detail/code/883404';
const TONGHUASHUN_SENTIMENT_LINE_BASE_URL = 'https://d.10jqka.com.cn/v4/line/bk_883404/00';
const TONGHUASHUN_FILM_CINEMA_PAGE_URL = 'https://q.10jqka.com.cn/thshy/detail/code/881274/';
const ENGLISH_MONTH_NUMBERS = Object.freeze({
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
});
const ISM_PMI_SOURCE_SNAPSHOT_URL = 'https://git.nomics.world/api/v4/projects/201/repository/files/index_PMI.html/raw?ref=master';
const ISM_OFFICIAL_REPORT_URL = 'https://www.ismworld.org/supply-management-news-and-reports/reports/ism-pmi-reports/pmi/july/';
// ISM 官方月报的 Manufacturing at a Glance 数值。DBnomics 提供长期历史，
// 此快照覆盖镜像尚未同步的月份，避免最新图表停留在旧年份。
const ISM_OFFICIAL_MANUFACTURING_SNAPSHOT = Object.freeze([
  { date: '2026-01-01', pmi: 52.6, supplierDeliveries: 54.4, newOrders: 57.1, backlogOrders: 51.6 },
  { date: '2026-02-01', pmi: 52.4, supplierDeliveries: 55.1, newOrders: 55.8, backlogOrders: 56.6 },
  { date: '2026-03-01', pmi: 52.7, supplierDeliveries: 58.9, newOrders: 53.5, backlogOrders: 54.4 },
  { date: '2026-04-01', pmi: 52.7, supplierDeliveries: 60.6, newOrders: 54.1, backlogOrders: 51.4 },
  { date: '2026-05-01', pmi: 54.0, supplierDeliveries: 60.6, newOrders: 56.8, backlogOrders: 52.2 },
  { date: '2026-06-01', pmi: 53.3, supplierDeliveries: 57.4, newOrders: 56.0, backlogOrders: 50.5 },
  { date: '2026-07-01', pmi: 55.6, supplierDeliveries: 58.9, newOrders: 56.7, backlogOrders: 55.0 },
]);
const DXY_COMPONENTS = Object.freeze([
  ['DEXUSEU', -0.576],
  ['DEXJPUS', 0.136],
  ['DEXUSUK', -0.119],
  ['DEXCAUS', 0.091],
  ['DEXSDUS', 0.042],
  ['DEXSZUS', 0.036],
]);
const DXY_BASE = 50.14348112;

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
  year7: { label: '7年', months: 84 },
  year10: { label: '10年', months: 120 },
  year15: { label: '15年', months: 180 },
  year20: { label: '20年', months: 240 },
  year25: { label: '25年', months: 300 },
  year30: { label: '30年', months: 360 },
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
  federalFundsRate: {
    id: 'federalFundsRate',
    title: '美联储有效联邦基金利率',
    unit: '%',
    decimals: 2,
    frequency: '日度',
    sourceName: 'FRED / 纽约联储',
    sourceUrl: 'https://fred.stlouisfed.org/series/DFF',
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
    sourceName: '美国经济分析局（BEA）/ FRED',
    sourceUrl: BEA_PCE_SOURCE_URL,
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
  silver: {
    id: 'silver',
    title: '全球白银价格',
    unit: '美元/盎司',
    decimals: 2,
    frequency: '月度',
    sourceName: 'IMF Primary Commodity Price System',
    sourceUrl: 'https://data.imf.org/en/datasets/IMF.RES:PCPS',
  },
  centralBankGoldPurchases: {
    id: 'centralBankGoldPurchases',
    title: '全球央行净购金量',
    unit: '吨',
    decimals: 0,
    frequency: '季度',
    sourceName: '世界黄金协会 / Gold Demand Trends',
    sourceUrl: WORLD_GOLD_COUNCIL_DEMAND_SOURCE_URL,
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
    supplementSourceName: '新浪财经 / Brent 近月期货',
    supplementSourceUrl: 'https://finance.sina.com.cn/futures/quotes/OIL.shtml',
  },
  wtiOil: {
    id: 'wtiOil',
    title: 'WTI 原油价格',
    unit: '美元/桶',
    decimals: 2,
    frequency: '日度',
    sourceName: 'FRED / 美国能源信息署 EIA',
    sourceUrl: 'https://fred.stlouisfed.org/series/DCOILWTICO',
    supplementSourceName: '新浪财经 / WTI 近月期货',
    supplementSourceUrl: 'https://finance.sina.com.cn/futures/quotes/CL.shtml',
  },
  copper: {
    id: 'copper',
    title: '全球铜价',
    unit: '美元/吨',
    decimals: 2,
    frequency: '月度',
    sourceName: 'FRED / IMF Primary Commodity Prices',
    sourceUrl: 'https://fred.stlouisfed.org/series/PCOPPUSDM',
  },
  naturalGas: {
    id: 'naturalGas',
    title: 'Henry Hub 天然气价格',
    unit: '美元/MMBtu',
    decimals: 2,
    frequency: '日度',
    sourceName: 'FRED / 美国能源信息署 EIA',
    sourceUrl: 'https://fred.stlouisfed.org/series/DHHNGSP',
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
  aShareSentimentThs: {
    id: 'aShareSentimentThs',
    title: '同花顺情绪指数',
    unit: '点',
    decimals: 2,
    frequency: '日度',
    sourceName: '同花顺官方行情 / 883404',
    sourceUrl: TONGHUASHUN_SENTIMENT_PAGE_URL,
  },
  filmCinemaShareholders: {
    id: 'filmCinemaShareholders',
    title: '影视院线成分股股东人数',
    unit: '只',
    decimals: 0,
    frequency: '最新披露',
    chartType: 'stockTable',
    sourceName: '同花顺影视院线（881274）/ 同花顺 F10',
    sourceUrl: TONGHUASHUN_FILM_CINEMA_PAGE_URL,
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
    sourceName: 'CBOE 官方日线 / FRED', sourceUrl: CBOE_VIX_HISTORY_PAGE_URL,
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
    id: 'broadDollar', title: '美元指数（DXY）', unit: '点', decimals: 2, frequency: '日度',
    sourceName: 'FRED H.10 汇率 / ICE DXY 公式', sourceUrl: 'https://www.ice.com/products/194/US-Dollar-Index-Futures',
  },
  ismManufacturingPmi: {
    id: 'ismManufacturingPmi', title: '美国 ISM 制造业 PMI', unit: '点', decimals: 1, frequency: '月度',
    sourceName: 'ISM 官方月报 / DBnomics 历史', sourceUrl: ISM_OFFICIAL_REPORT_URL,
    referenceValue: 50, referenceLabel: '50 荣枯线', changeMode: 'difference',
  },
  ismSupplierDeliveries: {
    id: 'ismSupplierDeliveries', title: '美国 ISM 供应商交付指数', unit: '点', decimals: 1, frequency: '月度',
    sourceName: 'ISM 官方月报 / DBnomics 历史', sourceUrl: ISM_OFFICIAL_REPORT_URL,
    referenceValue: 50, referenceLabel: '50 分界线', changeMode: 'difference',
  },
  ismNewOrders: {
    id: 'ismNewOrders', title: '美国 ISM 新订单指数', unit: '点', decimals: 1, frequency: '月度',
    sourceName: 'ISM 官方月报 / DBnomics 历史', sourceUrl: ISM_OFFICIAL_REPORT_URL,
    referenceValue: 50, referenceLabel: '50 荣枯线', changeMode: 'difference',
  },
  ismBacklogOrders: {
    id: 'ismBacklogOrders', title: '美国 ISM 订单积压指数', unit: '点', decimals: 1, frequency: '月度',
    sourceName: 'ISM 官方月报 / DBnomics 历史', sourceUrl: ISM_OFFICIAL_REPORT_URL,
    referenceValue: 50, referenceLabel: '50 荣枯线', changeMode: 'difference',
  },
  initialClaims: {
    id: 'initialClaims', title: '美国初次申请失业金人数', unit: '万人', decimals: 1, frequency: '周度',
    sourceName: 'FRED / 美国劳工部', sourceUrl: 'https://fred.stlouisfed.org/series/ICSA',
  },
  unemploymentRate: {
    id: 'unemploymentRate', title: '美国失业率', unit: '%', decimals: 1, frequency: '月度',
    sourceName: 'FRED / 美国劳工统计局', sourceUrl: 'https://fred.stlouisfed.org/series/UNRATE',
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

function mergeDatedItems(...itemGroups) {
  return [...new Map(itemGroups.flat().map((item) => [item.date, item])).values()]
    .sort((left, right) => left.date.localeCompare(right.date));
}

function decodeHtmlText(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .trim();
}

function parseTonghuashunIndustryConstituents(text) {
  const source = String(text ?? '');
  const stocks = new Map();
  const pattern = /<a\b[^>]*href=["'][^"']*stockpage\.10jqka\.com\.cn\/(\d{6})\/?["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const code = match[1];
    const label = decodeHtmlText(match[2]);
    const current = stocks.get(code) || { code, name: code };
    if (label && label !== code) current.name = label;
    stocks.set(code, current);
  }
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  while ((match = rowPattern.exec(source)) !== null) {
    const codeMatch = match[1].match(/stockpage\.10jqka\.com\.cn\/(\d{6})/i);
    if (!codeMatch || !stocks.has(codeMatch[1])) continue;
    const cells = [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => decodeHtmlText(cell[1]));
    const marketCapMatch = String(cells[12] || '').replace(/,/g, '').match(/^([\d.]+)亿$/);
    stocks.get(codeMatch[1]).marketCap = marketCapMatch ? Number(marketCapMatch[1]) : null;
  }
  return [...stocks.values()];
}

function parseTonghuashunHolderHistory(text) {
  const source = String(text ?? '');
  const dateMatch = source.match(/\bvar\s+lyear\s*=\s*(\[[\s\S]*?\])\s*;/);
  const valueMatch = source.match(/\bvar\s+lholder\s*=\s*(\[[\s\S]*?\])\s*;/);
  if (!dateMatch || !valueMatch) throw new Error('同花顺 F10 未返回股东人数历史');
  const dates = JSON.parse(dateMatch[1]);
  const values = JSON.parse(valueMatch[1]);
  const items = [];
  for (let index = 0; index < Math.min(dates.length, values.length); index += 1) {
    const date = normalizeObservationDate(dates[index]);
    const value = Number(String(values[index]).replace(/,/g, ''));
    if (date && Number.isFinite(value) && value >= 0) items.push({ date, value });
  }
  return [...new Map(items.map((item) => [item.date, item])).values()]
    .sort((left, right) => left.date.localeCompare(right.date));
}

function parseEastmoneyHolderHistory(text) {
  const payload = JSON.parse(String(text ?? ''));
  if (payload?.success !== true || !Array.isArray(payload?.result?.data)) {
    throw new Error(payload?.message || '东方财富未返回股东人数历史');
  }
  return [...new Map(payload.result.data.map((row) => ({
    date: normalizeObservationDate(String(row.END_DATE ?? '').slice(0, 10)),
    value: Number(row.HOLDER_NUM),
  })).filter((item) => item.date && Number.isFinite(item.value) && item.value >= 0)
    .map((item) => [item.date, item])).values()]
    .sort((left, right) => left.date.localeCompare(right.date));
}

function quarterlyHolderItems(items) {
  return items.filter((item) => /-(?:03-31|06-30|09-30|12-31)$/.test(item.date));
}

function buildTonghuashunHolderUrl(code) {
  return `https://basic.10jqka.com.cn/mobile/${code}/holder.html`;
}

function buildTonghuashunWeeklyPriceUrl(code) {
  return `https://d.10jqka.com.cn/v6/line/hs_${code}/11/last.js`;
}

function parseTonghuashunWeeklyPriceHistory(text) {
  const match = String(text ?? '').match(/\((\{[\s\S]*\})\)\s*;?\s*$/);
  if (!match) throw new Error('同花顺未返回个股月线历史');
  const payload = JSON.parse(match[1]);
  return String(payload.data || '').split(';').map((record) => {
    const fields = record.split(',');
    const rawDate = fields[0];
    const date = /^\d{8}$/.test(rawDate)
      ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}` : null;
    const value = Number(fields[4]);
    return date && Number.isFinite(value) && value > 0 ? { date, value } : null;
  }).filter(Boolean).sort((left, right) => left.date.localeCompare(right.date));
}

function attachQuarterlyPrices(holderItems, priceItems) {
  return holderItems.map((holderItem) => {
    const priceItem = priceItems.filter((item) => item.date <= holderItem.date).at(-1);
    return priceItem ? { ...holderItem, priceValue: priceItem.value, priceDate: priceItem.date } : holderItem;
  });
}

function buildEastmoneyHolderUrl(code) {
  const parameters = new URLSearchParams({
    reportName: 'RPT_HOLDERNUM_DET',
    columns: 'SECURITY_CODE,SECURITY_NAME_ABBR,END_DATE,HOLDER_NUM,HOLD_NOTICE_DATE',
    filter: `(SECURITY_CODE="${code}")`,
    pageNumber: '1', pageSize: '500', sortColumns: 'END_DATE', sortTypes: '-1', source: 'WEB', client: 'WEB',
  });
  return `https://datacenter-web.eastmoney.com/api/data/v1/get?${parameters}`;
}

async function mapWithConcurrency(values, concurrency, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

function parseCboeVixCsv(text) {
  const rows = parseCsv(text);
  const header = (rows[0] ?? []).map((value) => String(value).trim().toUpperCase());
  const dateIndex = header.indexOf('DATE');
  const closeIndex = header.indexOf('CLOSE');
  if (dateIndex < 0 || closeIndex < 0) throw new Error('CBOE VIX 数据缺少 DATE/CLOSE 字段');

  return rows.slice(1).map((row) => {
    const dateMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(row[dateIndex] ?? '').trim());
    const value = Number(row[closeIndex]);
    const date = dateMatch
      ? `${dateMatch[3]}-${dateMatch[1].padStart(2, '0')}-${dateMatch[2].padStart(2, '0')}`
      : null;
    return date && Number.isFinite(value) && value > 0 && value < 200 ? { date, value } : null;
  }).filter(Boolean);
}

function findLatestBeaPceRelease(text) {
  const source = String(text ?? '');
  const itemMatch = /<item\b[^>]*name\s*=\s*(["'])Personal Income and Outlays\1[^>]*>([\s\S]*?)<\/item>/i.exec(source);
  if (!itemMatch) throw new Error('BEA RSS 未找到 Personal Income and Outlays 发布项');
  const titleMatch = /<title>\s*Personal Income and Outlays,\s*([A-Za-z]+)\s+(\d{4})\s*<\/title>/i.exec(itemMatch[2]);
  const linkMatch = /<link>\s*(https:\/\/www\.bea\.gov\/news\/[^<\s]+)\s*<\/link>/i.exec(itemMatch[2]);
  const month = titleMatch ? ENGLISH_MONTH_NUMBERS[titleMatch[1].toLowerCase()] : null;
  if (!titleMatch || !linkMatch || !month) throw new Error('BEA PCE 发布项格式无效');
  return { date: `${titleMatch[2]}-${month}-01`, url: decodeHtmlEntities(linkMatch[1]) };
}

function parseBeaPceRelease(text, expectedDate) {
  const plainText = decodeHtmlEntities(String(text ?? ''))
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
  const match = /From the same month one year ago,\s*the PCE price index for\s+([A-Za-z]+)\s+(increased|decreased)\s+([0-9]+(?:\.[0-9]+)?)\s+percent/i.exec(plainText);
  if (!match) throw new Error('BEA PCE 发布页缺少同比数据');
  const releaseMonth = ENGLISH_MONTH_NUMBERS[match[1].toLowerCase()];
  if (!/^\d{4}-\d{2}-01$/.test(String(expectedDate)) || releaseMonth !== expectedDate.slice(5, 7)) {
    throw new Error('BEA PCE 发布月份不一致');
  }
  const value = Number(match[3]) * (match[2].toLowerCase() === 'decreased' ? -1 : 1);
  return { date: expectedDate, value };
}

function calculateDxy(seriesById) {
  const valueMaps = new Map(DXY_COMPONENTS.map(([seriesId]) => [
    seriesId,
    new Map((seriesById?.[seriesId] || []).map((item) => [item.date, Number(item.value)])),
  ]));
  const baseDates = [...(valueMaps.get(DXY_COMPONENTS[0][0]) || new Map()).keys()].sort();
  return baseDates.map((date) => {
    let value = DXY_BASE;
    for (const [seriesId, exponent] of DXY_COMPONENTS) {
      const rate = valueMaps.get(seriesId)?.get(date);
      if (!Number.isFinite(rate) || rate <= 0) return null;
      value *= rate ** exponent;
    }
    return Number.isFinite(value) ? { date, value } : null;
  }).filter(Boolean);
}

function parseImfCsv(text, indicator = 'PGOLD') {
  const rows = parseCsv(text);
  const header = rows[0] ?? [];
  const indicatorIndex = header.indexOf('INDICATOR');
  const dateIndex = header.indexOf('TIME_PERIOD');
  const valueIndex = header.indexOf('OBS_VALUE');

  if (indicatorIndex < 0 || dateIndex < 0 || valueIndex < 0) {
    throw new Error('IMF 返回内容缺少商品价格字段');
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

function buildDbnomicsIsmUrl(datasetCode, seriesCode) {
  if (!/^[a-z-]+$/.test(datasetCode) || !/^[a-z]+$/.test(seriesCode)) {
    throw new Error('DBnomics ISM 序列代码无效');
  }
  return `https://api.db.nomics.world/v22/series/ISM/${datasetCode}?observations=1`;
}

function buildImfCommodityUrl(indicator, startMonth, endMonth) {
  if (!/^[A-Z0-9_]+$/.test(indicator)) throw new Error('IMF 商品指标代码无效');
  const params = new URLSearchParams({ startPeriod: startMonth, endPeriod: endMonth });
  return `https://api.imf.org/external/sdmx/2.1/data/IMF.RES,PCPS/G001.${indicator}.USD.M?${params.toString()}`;
}

function buildImfGoldUrl(startMonth, endMonth) {
  return buildImfCommodityUrl('PGOLD', startMonth, endMonth);
}

function buildSinaGoldUrl() {
  return buildSinaGlobalFuturesUrl('XAU');
}

function buildSinaGlobalFuturesUrl(symbol) {
  if (!/^[A-Z0-9]+$/.test(symbol)) throw new Error('新浪期货品种代码无效');
  return `https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20_${symbol}=/GlobalFuturesService.getGlobalFuturesDailyKLine?symbol=${symbol}`;
}

function decodeHtmlEntities(value) {
  return String(value ?? '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number(codePoint)))
    .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)));
}

function findLatestWorldGoldCouncilReport(text) {
  const reports = [];
  const hrefPattern = /href\s*=\s*(["'])(.*?)\1/gi;
  let hrefMatch;

  while ((hrefMatch = hrefPattern.exec(String(text ?? '')))) {
    const href = decodeHtmlEntities(hrefMatch[2]);
    let url;
    try {
      url = new URL(href, WORLD_GOLD_COUNCIL_ORIGIN);
    } catch {
      continue;
    }

    const path = url.pathname.replace(/\/$/, '');
    const periodMatch = /^\/goldhub\/research\/gold-demand-trends\/gold-demand-trends-(?:q([1-4])-(\d{4})|full-year-(\d{4}))$/.exec(path);
    if (!periodMatch) continue;
    const year = Number(periodMatch[2] ?? periodMatch[3]);
    const quarter = periodMatch[1] ? Number(periodMatch[1]) : 4;
    reports.push({
      url: `${WORLD_GOLD_COUNCIL_ORIGIN}${path}`,
      centralBanksUrl: `${WORLD_GOLD_COUNCIL_ORIGIN}${path}/central-banks`,
      year,
      quarter,
    });
  }

  reports.sort((left, right) => (right.year * 4 + right.quarter) - (left.year * 4 + left.quarter));
  if (!reports.length) throw new Error('世界黄金协会页面未找到最新 Gold Demand Trends 报告');
  return reports[0];
}

function getHtmlAttribute(tag, name) {
  const escapedName = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escapedName}\\s*=\\s*(["'])(.*?)\\1`, 'i').exec(tag);
  return match ? decodeHtmlEntities(match[2]) : null;
}

function findWorldGoldCouncilCentralBankChartUrl(text) {
  const source = String(text ?? '');
  const containerPattern = /<div\b[^>]*class\s*=\s*(["'])[^"']*\bwgc-chart-container\b[^"']*\1[^>]*>/gi;
  let containerMatch;

  while ((containerMatch = containerPattern.exec(source))) {
    const context = decodeHtmlEntities(source.slice(Math.max(0, containerMatch.index - 3500), containerMatch.index))
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ');
    if (!/quarterly central bank net purchases,?\s*tonnes/i.test(context)) continue;
    const chartUrl = getHtmlAttribute(containerMatch[0], 'data-chart-data-lib');
    if (chartUrl) return new URL(chartUrl, WORLD_GOLD_COUNCIL_ORIGIN).href;
  }

  throw new Error('世界黄金协会报告未找到全球央行季度净购金图表');
}

function parseEmbeddedChartOptions(text) {
  const source = String(text ?? '');
  const assignment = /\b_self\._opt\s*=\s*/.exec(source);
  const startIndex = assignment ? source.indexOf('{', assignment.index + assignment[0].length) : -1;
  if (startIndex < 0) throw new Error('世界黄金协会图表缺少配置数据');

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = startIndex; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return JSON.parse(source.slice(startIndex, index + 1));
    }
  }
  throw new Error('世界黄金协会图表配置不完整');
}

function parseWorldGoldCouncilCentralBankChart(text, latestPeriod = {}) {
  const options = parseEmbeddedChartOptions(text);
  const categories = Array.isArray(options?.xAxis?.categories) ? options.xAxis.categories : [];
  const series = Array.isArray(options?.series) ? options.series : [];
  const maxYear = Number(latestPeriod.year);
  const maxQuarter = Number(latestPeriod.quarter);
  const hasPeriodLimit = Number.isInteger(maxYear) && Number.isInteger(maxQuarter);
  const items = [];

  series.forEach((entry) => {
    const quarterMatch = /^Q([1-4])$/i.exec(String(entry?.name ?? '').trim());
    if (!quarterMatch || !Array.isArray(entry.data)) return;
    const quarter = Number(quarterMatch[1]);
    categories.forEach((category, index) => {
      const year = Number(category);
      if (!Number.isInteger(year)) return;
      if (hasPeriodLimit && (year > maxYear || (year === maxYear && quarter > maxQuarter))) return;
      const rawValue = entry.data[index];
      if (rawValue === null || rawValue === undefined || rawValue === '') return;
      const normalizedValue = Array.isArray(rawValue) ? rawValue.at(-1) : rawValue?.y ?? rawValue;
      if (normalizedValue === null || normalizedValue === undefined || normalizedValue === '') return;
      const value = Number(normalizedValue);
      if (!Number.isFinite(value)) return;
      const quarterEnd = new Date(Date.UTC(year, quarter * 3, 0)).toISOString().slice(0, 10);
      items.push({ date: quarterEnd, value });
    });
  });

  const sortedItems = [...new Map(items.map((item) => [item.date, item])).values()]
    .sort((left, right) => left.date.localeCompare(right.date));
  if (!sortedItems.length) throw new Error('世界黄金协会图表暂无可用的央行购金数据');

  if (hasPeriodLimit) return sortedItems;
  const lastObservedIndex = sortedItems.findLastIndex((item) => item.value !== 0);
  return lastObservedIndex >= 0 ? sortedItems.slice(0, lastObservedIndex + 1) : sortedItems;
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

function buildTonghuashunSentimentUrl(segment = 'last') {
  if (!/^(?:last|\d{4})$/.test(String(segment))) {
    throw new Error('同花顺情绪指数历史分段无效');
  }
  return `${TONGHUASHUN_SENTIMENT_LINE_BASE_URL}/${segment}.js`;
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
  if (startIndex < 0 || endIndex <= startIndex) throw new Error('新浪期货数据格式无效');
  const rows = JSON.parse(source.slice(startIndex, endIndex + 1));
  return rows.map((row) => {
    const date = normalizeObservationDate(row?.date);
    const rawValue = row?.close;
    const value = rawValue === null || rawValue === undefined || rawValue === '' ? Number.NaN : Number(rawValue);
    return date && Number.isFinite(value) ? { date, value } : null;
  }).filter(Boolean);
}

function parseDbnomicsSeries(text, datasetCode, seriesCode, options = {}) {
  const payload = JSON.parse(String(text ?? ''));
  const docs = payload?.series?.docs;
  if (!Array.isArray(docs)) throw new Error('DBnomics ISM 数据格式无效');
  const series = docs.find((item) => (
    item?.dataset_code === datasetCode && item?.series_code === seriesCode
  ));
  if (!series || !Array.isArray(series.period) || !Array.isArray(series.value)) {
    throw new Error('DBnomics ISM 序列不存在');
  }
  const minValue = Number.isFinite(options.minValue) ? options.minValue : Number.NEGATIVE_INFINITY;
  const maxValue = Number.isFinite(options.maxValue) ? options.maxValue : Number.POSITIVE_INFINITY;
  return series.period.map((period, index) => {
    const periodText = String(period ?? '');
    const date = /^\d{4}-\d{2}$/.test(periodText)
      ? `${periodText}-01`
      : normalizeObservationDate(periodText);
    const rawValue = series.value[index];
    const value = rawValue === null || rawValue === undefined || rawValue === '' ? Number.NaN : Number(rawValue);
    return date && Number.isFinite(value) && value >= minValue && value <= maxValue ? { date, value } : null;
  }).filter(Boolean);
}

function parseIsmPmiSnapshot(text) {
  const source = String(text ?? '');
  const startIndex = source.search(/THE LAST 12 MONTHS/i);
  if (startIndex < 0) throw new Error('ISM PMI 报告缺少最近 12 个月表格');
  const endIndex = source.search(/Average for 12 months/i);
  const section = source.slice(startIndex, endIndex > startIndex ? endIndex : undefined);
  const monthNumbers = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const items = [];
  const rowPattern = /<th\b[^>]*scope\s*=\s*(["'])row\1[^>]*>\s*([a-z]{3})\s+(\d{4})\s*<\/th>\s*<td\b[^>]*>\s*([0-9]+(?:\.[0-9]+)?)\s*<\/td>/gi;
  let match;
  while ((match = rowPattern.exec(section))) {
    const month = monthNumbers[match[2].toLowerCase()];
    const value = Number(match[4]);
    if (month && Number.isFinite(value) && value >= 20 && value <= 80) {
      items.push({ date: `${match[3]}-${month}-01`, value });
    }
  }
  const sortedItems = [...new Map(items.map((item) => [item.date, item])).values()]
    .sort((left, right) => left.date.localeCompare(right.date));
  if (!sortedItems.length) throw new Error('ISM PMI 最近 12 个月表格暂无可用数据');
  return sortedItems;
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

function parseTonghuashunSentimentHistory(text) {
  const source = String(text ?? '').trim();
  const startIndex = source.indexOf('(');
  const endIndex = source.lastIndexOf(')');
  if (startIndex < 0 || endIndex <= startIndex) throw new Error('同花顺情绪指数数据格式无效');
  const payload = JSON.parse(source.slice(startIndex + 1, endIndex));
  if (typeof payload?.data !== 'string') throw new Error('同花顺情绪指数缺少日线数据');
  return payload.data.split(';').map((row) => {
    const fields = row.split(',');
    const dateText = String(fields[0] ?? '');
    const date = /^\d{8}$/.test(dateText)
      ? `${dateText.slice(0, 4)}-${dateText.slice(4, 6)}-${dateText.slice(6, 8)}`
      : null;
    const value = Number(fields[4]);
    return date && Number.isFinite(value) ? { date, value } : null;
  }).filter(Boolean);
}

function parseTonghuashunSentimentYears(text) {
  const source = String(text ?? '').trim();
  const startIndex = source.indexOf('(');
  const endIndex = source.lastIndexOf(')');
  if (startIndex < 0 || endIndex <= startIndex) return [];
  const years = JSON.parse(source.slice(startIndex + 1, endIndex))?.year;
  return years && typeof years === 'object'
    ? Object.keys(years).filter((year) => /^\d{4}$/.test(year)).sort()
    : [];
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

async function fetchCsv(url, fetchImpl, extraHeaders = {}, encoding = 'utf-8') {
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
      const text = encoding !== 'utf-8' && typeof response.arrayBuffer === 'function'
        ? new TextDecoder(encoding).decode(await response.arrayBuffer())
        : await response.text();
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

function mergeSpotWithFuturesSupplement(spotItems, futuresItems, options = {}) {
  const sortedSpotItems = [...spotItems]
    .filter((item) => item?.date && Number.isFinite(Number(item.value)))
    .map((item) => ({ ...item, value: Number(item.value) }))
    .sort((left, right) => left.date.localeCompare(right.date));
  if (!sortedSpotItems.length) return [];

  const latestSpot = sortedSpotItems.at(-1);
  const sortedFuturesItems = [...futuresItems]
    .filter((item) => item?.date && Number.isFinite(Number(item.value)))
    .map((item) => ({ ...item, value: Number(item.value) }))
    .sort((left, right) => left.date.localeCompare(right.date));
  const anchor = sortedFuturesItems.filter((item) => item.date <= latestSpot.date).at(-1);
  if (!anchor || anchor.value === 0) return sortedSpotItems;

  const maxDays = Number.isInteger(options.maxDays) ? options.maxDays : MAX_OIL_SUPPLEMENT_DAYS;
  const cutoffDate = formatIsoDate(shiftUtcDays(latestSpot.date, maxDays));
  const supplement = sortedFuturesItems
    .filter((item) => item.date > latestSpot.date && item.date <= cutoffDate)
    .map((item) => ({
      date: item.date,
      value: latestSpot.value * item.value / anchor.value,
      provisional: true,
      provisionalType: 'futuresChangeEstimate',
      futuresSymbol: options.futuresSymbol || '',
      futuresValue: item.value,
      anchorDate: anchor.date,
      supplementSourceName: options.sourceName || '',
    }));

  return sortedSpotItems.concat(supplement);
}

function filterRecentItems(items, range, frequency = 'daily') {
  const sortedItems = [...items].sort((left, right) => left.date.localeCompare(right.date));
  if (sortedItems.length === 0) return [];
  const config = RANGE_CONFIG[normalizeRange(range)];

  if (frequency === 'monthly') {
    return Number.isInteger(config.months) ? sortedItems.slice(-config.months) : sortedItems.slice(-1);
  }

  if (frequency === 'quarterly') {
    // A line covering N months needs both interval endpoints. For example, Q1 to Q2
    // is the two-point representation of a three-month interval.
    return Number.isInteger(config.months)
      ? sortedItems.slice(-(Math.ceil(config.months / 3) + 1))
      : sortedItems.slice(-2);
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
    const loaded = await loader();
    const items = Array.isArray(loaded) ? loaded : loaded.items;
    if (items.length === 0) throw new Error('最近 12 个月暂无可用数据');
    return { ...metadata, ...(Array.isArray(loaded) ? {} : loaded), items, error: null };
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
  const bitcoinStartDate = dailyStartDate < '2014-12-01' ? '2014-12-01' : dailyStartDate;

  const loadSupplementedOil = async (metadata, fredSeriesId, futuresSymbol) => {
    const spotText = await fetchCsv(buildFredUrl(fredSeriesId, dailyStartDate, endDate), fetchImpl);
    const spotItems = filterDateRange(parseFredCsv(spotText, fredSeriesId), dailyStartDate, endDate);
    let futuresItems = [];
    try {
      const futuresText = await fetchCsv(buildSinaGlobalFuturesUrl(futuresSymbol), fetchImpl, {
        Referer: 'https://finance.sina.com.cn/',
      });
      futuresItems = filterDateRange(parseSinaGold(futuresText), dailyStartDate, endDate);
    } catch {
      // 补点源不可用时仍保留 EIA/FRED 现货主序列。
    }
    const combinedItems = mergeSpotWithFuturesSupplement(spotItems, futuresItems, {
      futuresSymbol,
      sourceName: metadata.supplementSourceName,
    });
    return filterRecentItems(combinedItems, range);
  };

  const fetchIsmIndexItems = async (datasetCode, seriesCode) => {
    const text = await fetchCsv(buildDbnomicsIsmUrl(datasetCode, seriesCode), fetchImpl, {
      Accept: 'application/json',
    });
    return parseDbnomicsSeries(text, datasetCode, seriesCode, { minValue: 20, maxValue: 80 });
  };

  const officialIsmItems = (key) => ISM_OFFICIAL_MANUFACTURING_SNAPSHOT.map((item) => ({
    date: item.date,
    value: item[key],
  }));

  const loadIsmIndex = async (datasetCode, seriesCode, officialKey) => {
    const historyItems = await fetchIsmIndexItems(datasetCode, seriesCode);
    return filterRecentItems(mergeDatedItems(historyItems, officialIsmItems(officialKey)), range, 'monthly');
  };

  const loadIsmPmi = async () => {
    const historyItems = await fetchIsmIndexItems('pmi', 'pm');
    let snapshotItems = [];
    try {
      const snapshotText = await fetchCsv(ISM_PMI_SOURCE_SNAPSHOT_URL, fetchImpl, {
        Accept: 'text/html',
      });
      snapshotItems = parseIsmPmiSnapshot(snapshotText);
    } catch {
      // 原始报告镜像暂不可用时仍保留经过范围校验的 DBnomics 历史序列。
    }
    const items = mergeDatedItems(historyItems, snapshotItems, officialIsmItems('pmi'));
    return filterRecentItems(items, range, 'monthly');
  };

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
    federalFundsRate: () => loadChart(CHART_METADATA.federalFundsRate, async () => {
      const text = await fetchCsv(buildFredUrl('DFF', dailyStartDate, endDate), fetchImpl);
      const availableItems = filterDateRange(parseFredCsv(text, 'DFF'), dailyStartDate, endDate);
      return filterRecentItems(availableItems, range);
    }),
    cpi: () => loadChart(CHART_METADATA.cpi, async () => {
      const text = await fetchCsv(buildFredUrl('CPIAUCSL', inflationStartDate, endDate), fetchImpl);
      return filterRecentItems(calculateYearOverYear(parseFredCsv(text, 'CPIAUCSL'), null), range, 'monthly');
    }),
    pce: () => loadChart(CHART_METADATA.pce, async () => {
      const officialReleasePromise = (async () => {
        const rssText = await fetchCsv(BEA_NEWS_RSS_URL, fetchImpl, { Accept: 'application/xml,text/xml' });
        const release = findLatestBeaPceRelease(rssText);
        const releaseText = await fetchCsv(release.url, fetchImpl, { Accept: 'text/html' });
        return parseBeaPceRelease(releaseText, release.date);
      })().catch(() => null);
      const [text, officialRelease] = await Promise.all([
        fetchCsv(buildFredUrl('PCEPI', inflationStartDate, endDate), fetchImpl),
        officialReleasePromise,
      ]);
      const fredItems = calculateYearOverYear(parseFredCsv(text, 'PCEPI'), null);
      const items = mergeDatedItems(fredItems, officialRelease ? [officialRelease] : []);
      return filterRecentItems(filterDateRange(items, inflationStartDate, endDate), range, 'monthly');
    }),
    gold: () => loadChart(CHART_METADATA.gold, async () => {
      const text = await fetchCsv(buildSinaGoldUrl(), fetchImpl, { Referer: 'https://finance.sina.com.cn/' });
      const availableItems = filterDateRange(parseSinaGold(text), dailyStartDate, endDate);
      return filterRecentItems(availableItems, range);
    }),
    silver: () => loadChart(CHART_METADATA.silver, async () => {
      const text = await fetchCsv(
        buildImfCommodityUrl('PSILVER', formatIsoMonth(inflationStartDate), formatIsoMonth(endDate)),
        fetchImpl,
      );
      return filterRecentItems(parseImfCsv(text, 'PSILVER'), range, 'monthly');
    }),
    centralBankGoldPurchases: () => loadChart(CHART_METADATA.centralBankGoldPurchases, async () => {
      const indexText = await fetchCsv(WORLD_GOLD_COUNCIL_GDT_INDEX_URL, fetchImpl, {
        Accept: 'text/html',
        Referer: WORLD_GOLD_COUNCIL_ORIGIN,
      });
      const report = findLatestWorldGoldCouncilReport(indexText);
      const reportText = await fetchCsv(report.centralBanksUrl, fetchImpl, {
        Accept: 'text/html',
        Referer: report.url,
      });
      const chartUrl = findWorldGoldCouncilCentralBankChartUrl(reportText);
      const chartText = await fetchCsv(chartUrl, fetchImpl, {
        Accept: 'application/javascript',
        Referer: report.centralBanksUrl,
      });
      const items = parseWorldGoldCouncilCentralBankChart(chartText, report);
      return filterRecentItems(items, range, 'quarterly');
    }),
    bitcoin: () => loadChart(CHART_METADATA.bitcoin, async () => {
      const text = await fetchCsv(buildFredUrl('CBBTCUSD', bitcoinStartDate, endDate), fetchImpl);
      const availableItems = filterDateRange(parseFredCsv(text, 'CBBTCUSD'), bitcoinStartDate, endDate);
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
      return loadSupplementedOil(CHART_METADATA.brentOil, 'DCOILBRENTEU', 'OIL');
    }),
    wtiOil: () => loadChart(CHART_METADATA.wtiOil, async () => {
      return loadSupplementedOil(CHART_METADATA.wtiOil, 'DCOILWTICO', 'CL');
    }),
    copper: () => loadChart(CHART_METADATA.copper, async () => {
      const text = await fetchCsv(buildFredUrl('PCOPPUSDM', inflationStartDate, endDate), fetchImpl);
      return filterRecentItems(parseFredCsv(text, 'PCOPPUSDM'), range, 'monthly');
    }),
    naturalGas: () => loadChart(CHART_METADATA.naturalGas, async () => {
      const text = await fetchCsv(buildFredUrl('DHHNGSP', dailyStartDate, endDate), fetchImpl);
      const availableItems = filterDateRange(parseFredCsv(text, 'DHHNGSP'), dailyStartDate, endDate);
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
    aShareSentimentThs: () => loadChart(CHART_METADATA.aShareSentimentThs, async () => {
      const headers = {
        Accept: 'application/javascript,text/javascript,*/*',
        Referer: TONGHUASHUN_SENTIMENT_PAGE_URL,
      };
      const latestText = await fetchCsv(buildTonghuashunSentimentUrl(), fetchImpl, headers);
      const startYear = Number(dailyStartDate.slice(0, 4));
      const endYear = Number(endDate.slice(0, 4));
      const historyYears = parseTonghuashunSentimentYears(latestText).filter((year) => {
        const numericYear = Number(year);
        return numericYear >= startYear && numericYear <= endYear;
      });
      const historyResults = await Promise.allSettled(historyYears.map((year) => (
        fetchCsv(buildTonghuashunSentimentUrl(year), fetchImpl, headers)
      )));
      const allItems = [parseTonghuashunSentimentHistory(latestText)];
      historyResults.forEach((result) => {
        if (result.status === 'fulfilled') allItems.push(parseTonghuashunSentimentHistory(result.value));
      });
      const uniqueItems = [...new Map(allItems.flat().map((item) => [item.date, item])).values()];
      const availableItems = filterDateRange(uniqueItems, dailyStartDate, endDate);
      return filterRecentItems(availableItems, range);
    }),
    filmCinemaShareholders: () => loadChart(CHART_METADATA.filmCinemaShareholders, async () => {
      const industryText = await fetchCsv(TONGHUASHUN_FILM_CINEMA_PAGE_URL, fetchImpl, {
        Accept: 'text/html', Referer: 'https://q.10jqka.com.cn/',
      }, 'gb18030');
      const constituents = parseTonghuashunIndustryConstituents(industryText);
      if (!constituents.length) throw new Error('同花顺影视院线页面未返回成分股');
      const rows = await mapWithConcurrency(constituents, 5, async (stock) => {
        let history = [];
        let historySource = '同花顺 F10';
        let error = null;
        let tonghuashunError = null;
        const pricePromise = fetchCsv(buildTonghuashunWeeklyPriceUrl(stock.code), fetchImpl, {
          Accept: 'application/javascript,text/javascript,*/*',
          Referer: `https://stockpage.10jqka.com.cn/${stock.code}/`,
        }).then(parseTonghuashunWeeklyPriceHistory).catch(() => []);
        try {
          const holderText = await fetchCsv(buildTonghuashunHolderUrl(stock.code), fetchImpl, {
            Accept: 'text/html', Referer: TONGHUASHUN_FILM_CINEMA_PAGE_URL,
          });
          history = parseTonghuashunHolderHistory(holderText);
        } catch (caughtError) {
          tonghuashunError = caughtError;
        }
        try {
          const supplementalText = await fetchCsv(buildEastmoneyHolderUrl(stock.code), fetchImpl, {
            Accept: 'application/json', Referer: 'https://data.eastmoney.com/',
          });
          const supplementalHistory = parseEastmoneyHolderHistory(supplementalText);
          if (history.length) {
            history = mergeDatedItems(supplementalHistory, history);
            historySource = '同花顺 F10 / 东方财富历史补充';
          } else {
            history = supplementalHistory;
            historySource = '东方财富公开数据（回退）';
          }
        } catch (supplementalError) {
          if (!history.length) {
            error = `${tonghuashunError instanceof Error ? tonghuashunError.message : tonghuashunError}；备用源：${supplementalError instanceof Error ? supplementalError.message : supplementalError}`;
          }
        }
        const latest = history.at(-1) || null;
        const priceItems = await pricePromise;
        return {
          ...stock, latestDate: latest?.date || null, latestValue: latest?.value ?? null,
          quarterlyItems: attachQuarterlyPrices(quarterlyHolderItems(history), priceItems),
          priceItems, historySource, error,
        };
      });
      const availableRows = rows.filter((row) => Number.isFinite(row.latestValue));
      if (!availableRows.length) throw new Error('影视院线成分股股东人数暂不可用');
      const latestDate = availableRows.map((row) => row.latestDate).sort().at(-1);
      return { items: [{ date: latestDate, value: availableRows.length }], rows };
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
      const cboePromise = fetchCsv(CBOE_VIX_HISTORY_URL, fetchImpl)
        .then(parseCboeVixCsv)
        .catch(() => []);
      const [text, cboeItems] = await Promise.all([
        fetchCsv(buildFredUrl('VIXCLS', dailyStartDate, endDate), fetchImpl),
        cboePromise,
      ]);
      const fredItems = parseFredCsv(text, 'VIXCLS');
      const items = filterDateRange(mergeDatedItems(fredItems, cboeItems), dailyStartDate, endDate);
      return filterRecentItems(items, range);
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
      const entries = await Promise.all(DXY_COMPONENTS.map(async ([seriesId]) => {
        const text = await fetchCsv(buildFredUrl(seriesId, dailyStartDate, endDate), fetchImpl);
        return [seriesId, parseFredCsv(text, seriesId)];
      }));
      const items = calculateDxy(Object.fromEntries(entries));
      return filterRecentItems(filterDateRange(items, dailyStartDate, endDate), range);
    }),
    ismManufacturingPmi: () => loadChart(CHART_METADATA.ismManufacturingPmi, loadIsmPmi),
    ismSupplierDeliveries: () => loadChart(CHART_METADATA.ismSupplierDeliveries, () => (
      loadIsmIndex('supdel', 'in', 'supplierDeliveries')
    )),
    ismNewOrders: () => loadChart(CHART_METADATA.ismNewOrders, () => (
      loadIsmIndex('neword', 'in', 'newOrders')
    )),
    ismBacklogOrders: () => loadChart(CHART_METADATA.ismBacklogOrders, () => (
      loadIsmIndex('bacord', 'in', 'backlogOrders')
    )),
    initialClaims: () => loadChart(CHART_METADATA.initialClaims, async () => {
      const text = await fetchCsv(buildFredUrl('ICSA', dailyStartDate, endDate), fetchImpl);
      const items = filterDateRange(parseFredCsv(text, 'ICSA'), dailyStartDate, endDate)
        .map((item) => ({ ...item, value: item.value / 10_000 }));
      return filterRecentItems(items, range);
    }),
    unemploymentRate: () => loadChart(CHART_METADATA.unemploymentRate, async () => {
      const text = await fetchCsv(buildFredUrl('UNRATE', inflationStartDate, endDate), fetchImpl);
      return filterRecentItems(parseFredCsv(text, 'UNRATE'), range, 'monthly');
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
  buildDbnomicsIsmUrl,
  buildFredUrl,
  buildImfCommodityUrl,
  buildImfGoldUrl,
  buildSinaGoldUrl,
  buildSinaGlobalFuturesUrl,
  findLatestWorldGoldCouncilReport,
  findWorldGoldCouncilCentralBankChartUrl,
  parseWorldGoldCouncilCentralBankChart,
  buildTreasuryDebtUrl,
  buildAShareTurnoverUrl,
  buildAShareMarginBalanceUrl,
  buildSohuIndexHistoryUrl,
  buildTonghuashunSentimentUrl,
  buildTonghuashunHolderUrl,
  buildTonghuashunWeeklyPriceUrl,
  buildEastmoneyHolderUrl,
  calculateDxy,
  CBOE_VIX_HISTORY_URL,
  BEA_NEWS_RSS_URL,
  ISM_OFFICIAL_MANUFACTURING_SNAPSHOT,
  calculateYearOverYear,
  filterRecentItems,
  mergeSpotWithFuturesSupplement,
  normalizeObservationDate,
  normalizeChartIds,
  normalizeRange,
  parseCsv,
  parseFredCsv,
  parseCboeVixCsv,
  findLatestBeaPceRelease,
  parseBeaPceRelease,
  parseImfCsv,
  parseSinaGold,
  parseDbnomicsSeries,
  parseIsmPmiSnapshot,
  parseTreasuryDebt,
  parseAShareTurnover,
  parseAShareMarginBalance,
  parseSohuIndexAmount,
  calculateTonghuashunActiveMarketValue,
  parseTonghuashunSentimentHistory,
  parseTonghuashunSentimentYears,
  parseTonghuashunIndustryConstituents,
  parseTonghuashunHolderHistory,
  parseTonghuashunWeeklyPriceHistory,
  attachQuarterlyPrices,
  parseEastmoneyHolderHistory,
  quarterlyHolderItems,
  parseNasdaq100PeSnapshot,
  queryMacroOutlook,
};
