const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CHART_METADATA,
  RANGE_CONFIG,
  calculateYearOverYear,
  filterRecentItems,
  mergeSpotWithFuturesSupplement,
  normalizeRange,
  normalizeChartIds,
  buildImfCommodityUrl,
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
  findLatestWorldGoldCouncilReport,
  findWorldGoldCouncilCentralBankChartUrl,
  parseWorldGoldCouncilCentralBankChart,
  queryMacroOutlook,
} = require('../scripts/macro-outlook');

const WGC_INDEX_HTML = [
  '<a href="/goldhub/research/gold-demand-trends/gold-demand-trends-full-year-2025">2025</a>',
  '<a href="/goldhub/research/gold-demand-trends/gold-demand-trends-us-focus-q2-2026">US</a>',
  '<a href="/goldhub/research/gold-demand-trends/gold-demand-trends-q1-2026">Q1</a>',
  '<a href="/goldhub/research/gold-demand-trends/gold-demand-trends-q2-2026">Q2</a>',
].join('');
const WGC_REPORT_HTML = [
  '<div class="chart-description"><p>Quarterly central bank net purchases, tonnes*</p></div>',
  '<div class="wgc-chart-container" data-chart-data-lib="https://fsapi.gold.org/api/v12/charts/js/test/3430"></div>',
].join('');
const WGC_CHART_SCRIPT = '_self._opt = ' + JSON.stringify({
  series: [
    { name: 'Q1', data: [235.87, 56.52] },
    { name: 'Q2', data: [177.85, 288.86] },
    { name: 'Q3', data: [226.25, 0] },
    { name: 'Q4', data: [208.19, 0] },
  ],
  xAxis: { categories: [2025, 2026] },
}) + ';var opt = _self._opt;';

test('macro outlook exposes every requested time range', () => {
  assert.deepEqual(Object.values(RANGE_CONFIG).map((range) => range.label), [
    '1天', '1周', '2周', '4周', '1个月', '3个月', '6个月', '1年', '2年', '3年', '5年', '7年', '10年', '15年', '20年', '25年', '30年',
  ]);
  assert.equal(normalizeRange(), 'month3');
  assert.deepEqual(normalizeChartIds(['bitcoin', 'unknown']), ['bitcoin']);
  assert.equal(CHART_METADATA.aShareTurnover.decimals, 0);
  assert.equal(CHART_METADATA.centralBankGoldPurchases.decimals, 0);
  assert.equal(CHART_METADATA.centralBankGoldPurchases.unit, '吨');
  assert.equal(CHART_METADATA.silver.unit, '美元/盎司');
  assert.equal(CHART_METADATA.copper.unit, '美元/吨');
  assert.equal(CHART_METADATA.naturalGas.unit, '美元/MMBtu');
  assert.equal(CHART_METADATA.federalFundsRate.sourceUrl, 'https://fred.stlouisfed.org/series/DFF');
  assert.match(buildImfCommodityUrl('PSILVER', '2025-01', '2026-08'), /G001\.PSILVER\.USD\.M/);
});

test('CSV parser keeps quoted commas and escaped quotes intact', () => {
  const rows = parseCsv('name,description\nGold,"Monthly, average ""price"""\n');
  assert.deepEqual(rows, [
    ['name', 'description'],
    ['Gold', 'Monthly, average "price"'],
  ]);
});

test('FRED parser ignores dot and blank missing observations', () => {
  const rows = parseFredCsv('observation_date,DGS10\n2026-08-20,4.69\n2026-08-21,.\n2026-08-22,\n', 'DGS10');
  assert.deepEqual(rows, [{ date: '2026-08-20', value: 4.69 }]);
});

test('IMF parser reads only gold observations and normalizes month dates', () => {
  const csv = [
    'COUNTRY,INDICATOR,TIME_PERIOD,OBS_VALUE,SERIES_NAME',
    'G001,PGOLD,2026-M06,4237.1,"Gold, US dollars per ounce"',
    'G001,PSILVER,2026-M06,55.2,Silver',
  ].join('\n');
  const rows = parseImfCsv(csv);
  assert.deepEqual(rows, [{ date: '2026-06-01', value: 4237.1 }]);
  assert.deepEqual(parseImfCsv(csv, 'PSILVER'), [{ date: '2026-06-01', value: 55.2 }]);
});

test('Sina parser reads daily London gold closes and skips invalid values', () => {
  const rows = parseSinaGold('var _XAU=([{"date":"2026-08-03","close":"4500.5"},{"date":"2026-08-04","close":null}]);');
  assert.deepEqual(rows, [{ date: '2026-08-03', value: 4500.5 }]);
});

test('Treasury debt parser converts daily dollars to trillions', () => {
  const rows = parseTreasuryDebt(JSON.stringify({ data: [
    { record_date: '2026-08-20', tot_pub_debt_out_amt: '40033256786764.37' },
  ] }));
  assert.equal(rows[0].date, '2026-08-20');
  assert.ok(Math.abs(rows[0].value - 40.03325678676437) < 1e-12);
});

test('A-share all-market parser reads official turnover in 100 million yuan', () => {
  const rows = parseAShareTurnover(JSON.stringify({
    code: '200',
    data: [
      { tradeDate: '20260820', tradingValue: 19346.8 },
    ],
  }));
  assert.deepEqual(rows, [{ date: '2026-08-20', value: 19346.8 }]);
});

test('A-share margin parser reads the three-market financing balance in 100 million yuan', () => {
  const rows = parseAShareMarginBalance(JSON.stringify({
    success: true,
    result: { data: [
      { STATISTICS_DATE: '2026-08-20 00:00:00', FIN_BALANCE: 26305.15364858 },
    ], pages: 1 },
  }));
  assert.deepEqual(rows, [{ date: '2026-08-20', value: 26305.15364858 }]);
});

test('Tonghuashun active-market-value formula combines both markets and applies SMA(10,1)', () => {
  const shanghai = parseSohuIndexAmount(JSON.stringify([{ hq: [
    ['2026-08-20', '1', '1', '0', '0%', '1', '1', '1', '100000000'],
    ['2026-08-21', '1', '1', '0', '0%', '1', '1', '1', '110000000'],
  ] }]));
  const shenzhen = parseSohuIndexAmount(JSON.stringify([{ hq: [
    ['2026-08-20', '1', '1', '0', '0%', '1', '1', '1', '100000000'],
    ['2026-08-21', '1', '1', '0', '0%', '1', '1', '1', '110000000'],
  ] }]));
  assert.deepEqual(calculateTonghuashunActiveMarketValue(shanghai, shenzhen), [
    { date: '2026-08-20', value: 20000 },
    { date: '2026-08-21', value: 20200 },
  ]);
});

test('Nasdaq-100 PE snapshot parser reads monthly trailing multiples', () => {
  assert.deepEqual(parseNasdaq100PeSnapshot('date,value\n2026-07,36.05\n2026-08,33.82'), [
    { date: '2026-07-01', value: 36.05 },
    { date: '2026-08-01', value: 33.82 },
  ]);
});

test('World Gold Council discovery selects the latest global report and its quarterly chart', () => {
  assert.deepEqual(findLatestWorldGoldCouncilReport(WGC_INDEX_HTML), {
    url: 'https://www.gold.org/goldhub/research/gold-demand-trends/gold-demand-trends-q2-2026',
    centralBanksUrl: 'https://www.gold.org/goldhub/research/gold-demand-trends/gold-demand-trends-q2-2026/central-banks',
    year: 2026,
    quarter: 2,
  });
  assert.equal(
    findWorldGoldCouncilCentralBankChartUrl(WGC_REPORT_HTML),
    'https://fsapi.gold.org/api/v12/charts/js/test/3430',
  );
});

test('World Gold Council chart parser converts quarter series to dated tonnes and omits future placeholders', () => {
  assert.deepEqual(parseWorldGoldCouncilCentralBankChart(WGC_CHART_SCRIPT, { year: 2026, quarter: 2 }), [
    { date: '2025-03-31', value: 235.87 },
    { date: '2025-06-30', value: 177.85 },
    { date: '2025-09-30', value: 226.25 },
    { date: '2025-12-31', value: 208.19 },
    { date: '2026-03-31', value: 56.52 },
    { date: '2026-06-30', value: 288.86 },
  ]);
});

test('year-over-year conversion matches the same month in the prior year', () => {
  const rows = calculateYearOverYear([
    { date: '2025-01-01', value: 100 },
    { date: '2025-02-01', value: 200 },
    { date: '2026-01-01', value: 103 },
    { date: '2026-02-01', value: 210 },
  ]);
  assert.equal(rows.length, 2);
  assert.ok(Math.abs(rows[0].value - 3) < 1e-9);
  assert.ok(Math.abs(rows[1].value - 5) < 1e-9);
});

test('short ranges keep the latest monthly point while daily data uses elapsed time', () => {
  const monthly = [
    { date: '2026-05-01', value: 1 },
    { date: '2026-06-01', value: 2 },
  ];
  const daily = [
    { date: '2026-06-01', value: 1 },
    { date: '2026-06-08', value: 2 },
    { date: '2026-06-09', value: 3 },
  ];
  const quarterly = [
    { date: '2025-03-31', value: 1 },
    { date: '2025-06-30', value: 2 },
    { date: '2025-09-30', value: 3 },
    { date: '2025-12-31', value: 4 },
    { date: '2026-03-31', value: 5 },
    { date: '2026-06-30', value: 6 },
  ];
  assert.deepEqual(filterRecentItems(monthly, 'day1', 'monthly'), [monthly[1]]);
  assert.deepEqual(filterRecentItems(daily, 'week1'), daily.slice(1));
  assert.equal(filterRecentItems(monthly, 'month1', 'monthly').length, 1);
  assert.deepEqual(filterRecentItems(monthly, 'year1', 'quarterly'), monthly.slice(-2));
  assert.deepEqual(filterRecentItems(quarterly, 'month3', 'quarterly'), quarterly.slice(-2));
  assert.deepEqual(filterRecentItems(quarterly, 'year1', 'quarterly'), quarterly.slice(-5));
  assert.deepEqual(filterRecentItems([
    { date: '2026-07-31', value: 1 },
    { date: '2026-08-03', value: 2 },
    { date: '2026-08-21', value: 3 },
  ], 'month1'), [
    { date: '2026-08-03', value: 2 },
    { date: '2026-08-21', value: 3 },
  ]);
});

test('oil supplement anchors futures returns to the latest spot price and marks provisional points', () => {
  const result = mergeSpotWithFuturesSupplement([
    { date: '2026-08-17', value: 98 },
    { date: '2026-08-18', value: 100 },
  ], [
    { date: '2026-08-18', value: 80 },
    { date: '2026-08-19', value: 84 },
    { date: '2026-08-20', value: 88 },
    { date: '2026-09-03', value: 90 },
  ], { futuresSymbol: 'CL', sourceName: 'WTI futures' });

  assert.equal(result.length, 4);
  assert.deepEqual(result.slice(-2).map((item) => ({ date: item.date, value: item.value })), [
    { date: '2026-08-19', value: 105 },
    { date: '2026-08-20', value: 110 },
  ]);
  assert.equal(result.at(-1).provisional, true);
  assert.equal(result.at(-1).futuresSymbol, 'CL');
  assert.equal(result.at(-1).anchorDate, '2026-08-18');
});

test('macro outlook query returns twenty-seven independent chart payloads', async () => {
  const fredData = {
    DGS10: 'observation_date,DGS10\n2025-08-22,4.2\n2026-08-20,4.7\n',
    DGS30: 'observation_date,DGS30\n2025-08-22,4.8\n2026-08-20,5.1\n',
    DFF: 'observation_date,DFF\n2026-08-20,3.64\n2026-08-21,3.64\n',
    CPIAUCSL: 'observation_date,CPIAUCSL\n2025-07-01,100\n2026-07-01,103\n',
    PCEPI: 'observation_date,PCEPI\n2025-06-01,100\n2026-06-01,102.5\n',
    CBBTCUSD: 'observation_date,CBBTCUSD\n2026-08-20,73000\n2026-08-21,78000\n',
    DEXJPUS: 'observation_date,DEXJPUS\n2026-08-20,158.9\n2026-08-21,159.2\n',
    DCOILBRENTEU: 'observation_date,DCOILBRENTEU\n2026-08-20,94.2\n2026-08-21,95.3\n',
    DCOILWTICO: 'observation_date,DCOILWTICO\n2026-08-20,85.1\n2026-08-21,86.5\n',
    PCOPPUSDM: 'observation_date,PCOPPUSDM\n2026-06-01,9800.25\n2026-07-01,9950.75\n',
    DHHNGSP: 'observation_date,DHHNGSP\n2026-08-20,2.75\n2026-08-21,2.82\n',
    NASDAQ100: 'observation_date,NASDAQ100\n2026-08-20,29213.16\n2026-08-21,29308.86\n',
    SP500: 'observation_date,SP500\n2026-08-20,7758.20\n2026-08-21,7780.45\n',
    VIXCLS: 'observation_date,VIXCLS\n2026-08-20,16.01\n2026-08-21,15.80\n',
    T10Y2Y: 'observation_date,T10Y2Y\n2026-08-20,0.46\n2026-08-21,0.48\n',
    BAMLH0A0HYM2: 'observation_date,BAMLH0A0HYM2\n2026-08-20,2.90\n2026-08-21,2.88\n',
    DTWEXBGS: 'observation_date,DTWEXBGS\n2026-08-20,119.1\n2026-08-21,118.9\n',
    ICSA: 'observation_date,ICSA\n2026-08-15,245000\n',
    NFCI: 'observation_date,NFCI\n2026-08-14,-0.50\n2026-08-21,-0.48\n',
  };
  const imfData = [
    'COUNTRY,INDICATOR,TIME_PERIOD,OBS_VALUE',
    'G001,PGOLD,2026-M05,4200',
    'G001,PGOLD,2026-M06,4300',
    'G001,PSILVER,2026-M05,52.4',
    'G001,PSILVER,2026-M06,55.2',
  ].join('\n');
  const sinaGoldData = 'var _XAU=([{"date":"2026-08-20","close":"4500"},{"date":"2026-08-21","close":"4520"}]);';
  const aShareTurnoverData = JSON.stringify({ code: '200', data: [
    { tradeDate: '20260820', tradingValue: 19346.8 },
    { tradeDate: '20260821', tradingValue: 20500.25 },
  ] });
  const aShareMarginData = JSON.stringify({ success: true, result: { data: [
    { STATISTICS_DATE: '2026-08-20 00:00:00', FIN_BALANCE: 26305.15364858 },
    { STATISTICS_DATE: '2026-08-21 00:00:00', FIN_BALANCE: 26400.15364858 },
  ], pages: 1 } });
  const shanghaiIndexData = JSON.stringify([{ hq: [
    ['2026-08-20', '1', '1', '0', '0%', '1', '1', '1', '100000000'],
    ['2026-08-21', '1', '1', '0', '0%', '1', '1', '1', '110000000'],
  ] }]);
  const shenzhenIndexData = JSON.stringify([{ hq: [
    ['2026-08-20', '1', '1', '0', '0%', '1', '1', '1', '100000000'],
    ['2026-08-21', '1', '1', '0', '0%', '1', '1', '1', '110000000'],
  ] }]);
  const fetchImpl = async (url) => {
    const seriesId = Object.keys(fredData).find((id) => url.includes(`id=${id}`));
    return {
      ok: true,
      status: 200,
      text: async () => url.includes('api.fiscaldata.treasury.gov')
        ? JSON.stringify({ data: [{ record_date: '2026-08-20', tot_pub_debt_out_amt: '39500000000000' }] })
        : url === 'https://www.gold.org/goldhub/research/gold-demand-trends' ? WGC_INDEX_HTML
        : url.endsWith('/central-banks') ? WGC_REPORT_HTML
        : url.includes('fsapi.gold.org') ? WGC_CHART_SCRIPT
        : url.includes('RPTA_WEB_MARGIN_DAILYTRADE') ? aShareMarginData
        : url.includes('code=zs_000001') ? shanghaiIndexData
        : url.includes('code=zs_399106') ? shenzhenIndexData
        : url.includes('csindex.com.cn/csindex-home/perf') ? aShareTurnoverData
        : url.includes('stock2.finance.sina.com.cn') ? sinaGoldData : seriesId ? fredData[seriesId] : imfData,
    };
  };

  const result = await queryMacroOutlook({ fetchImpl, now: new Date('2026-08-22T00:00:00Z') });
  assert.deepEqual(result.charts.map((chart) => chart.id), [
    'treasuryYield', 'treasuryYield30', 'federalFundsRate', 'cpi', 'pce', 'gold', 'silver', 'centralBankGoldPurchases', 'bitcoin', 'federalDebt', 'jpyUsd',
    'brentOil', 'wtiOil', 'copper', 'naturalGas', 'aShareTurnover', 'aShareMarginBalance', 'aShareActiveMarketValueThs', 'nasdaq100Pe', 'ndx', 'sp500', 'vix',
    'treasurySpread', 'highYieldSpread', 'broadDollar', 'initialClaims', 'financialConditions',
  ]);
  assert.deepEqual(result.charts.map((chart) => chart.error), Array(27).fill(null));
  assert.equal(result.charts.find((chart) => chart.id === 'federalFundsRate').items.at(-1).value, 3.64);
  assert.ok(Math.abs(result.charts.find((chart) => chart.id === 'cpi').items[0].value - 3) < 1e-9);
  assert.equal(result.charts.find((chart) => chart.id === 'gold').items.at(-1).value, 4520);
  assert.equal(result.charts.find((chart) => chart.id === 'silver').items.at(-1).value, 55.2);
  assert.equal(result.charts.find((chart) => chart.id === 'centralBankGoldPurchases').items.at(-1).value, 288.86);
  assert.equal(result.charts.find((chart) => chart.id === 'bitcoin').items.at(-1).value, 78000);
  assert.equal(result.charts.find((chart) => chart.id === 'federalDebt').items.at(-1).value, 39.5);
  assert.equal(result.charts.find((chart) => chart.id === 'jpyUsd').items.at(-1).value, 159.2);
  assert.equal(result.charts.find((chart) => chart.id === 'brentOil').items.at(-1).value, 95.3);
  assert.equal(result.charts.find((chart) => chart.id === 'wtiOil').items.at(-1).value, 86.5);
  assert.equal(result.charts.find((chart) => chart.id === 'copper').items.at(-1).value, 9950.75);
  assert.equal(result.charts.find((chart) => chart.id === 'naturalGas').items.at(-1).value, 2.82);
  assert.equal(result.charts.find((chart) => chart.id === 'aShareTurnover').items.at(-1).value, 20500.25);
  assert.equal(result.charts.find((chart) => chart.id === 'aShareMarginBalance').items.at(-1).value, 26400.15364858);
  assert.equal(result.charts.find((chart) => chart.id === 'aShareActiveMarketValueThs').items.at(-1).value, 20200);
  assert.equal(result.charts.find((chart) => chart.id === 'nasdaq100Pe').items.at(-1).value, 33.82);
  assert.equal(result.charts.find((chart) => chart.id === 'ndx').items.at(-1).value, 29308.86);
  assert.equal(result.charts.find((chart) => chart.id === 'sp500').items.at(-1).value, 7780.45);
  assert.equal(result.charts.find((chart) => chart.id === 'vix').items.at(-1).value, 15.8);
  assert.equal(result.charts.find((chart) => chart.id === 'treasurySpread').items.at(-1).value, 0.48);
  assert.equal(result.charts.find((chart) => chart.id === 'highYieldSpread').items.at(-1).value, 2.88);
  assert.equal(result.charts.find((chart) => chart.id === 'broadDollar').items.at(-1).value, 118.9);
  assert.equal(result.charts.find((chart) => chart.id === 'initialClaims').items.at(-1).value, 24.5);
  assert.equal(result.charts.find((chart) => chart.id === 'financialConditions').items.at(-1).value, -0.48);
});

test('one failed source does not prevent the remaining charts from loading', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('id=PCEPI')) return { ok: false, status: 503, text: async () => '' };
    if (url === 'https://www.gold.org/goldhub/research/gold-demand-trends') {
      return { ok: true, status: 200, text: async () => WGC_INDEX_HTML };
    }
    if (url.endsWith('/central-banks')) {
      return { ok: true, status: 200, text: async () => WGC_REPORT_HTML };
    }
    if (url.includes('fsapi.gold.org')) {
      return { ok: true, status: 200, text: async () => WGC_CHART_SCRIPT };
    }
    if (url.includes('api.imf.org')) {
      return { ok: true, status: 200, text: async () => 'COUNTRY,INDICATOR,TIME_PERIOD,OBS_VALUE\nG001,PSILVER,2026-M06,55.2\n' };
    }
    if (url.includes('stock2.finance.sina.com.cn')) {
      return { ok: true, status: 200, text: async () => 'var _XAU=([{"date":"2026-08-20","close":"4500"}]);' };
    }
    if (url.includes('api.fiscaldata.treasury.gov')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ data: [
        { record_date: '2026-08-20', tot_pub_debt_out_amt: '39500000000000' },
      ] }) };
    }
    if (url.includes('csindex.com.cn/csindex-home/perf')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ code: '200', data: [
        { tradeDate: '20260820', tradingValue: 19346.8 },
      ] }) };
    }
    if (url.includes('RPTA_WEB_MARGIN_DAILYTRADE')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ success: true, result: { data: [
        { STATISTICS_DATE: '2026-08-20 00:00:00', FIN_BALANCE: 26305.15364858 },
      ], pages: 1 } }) };
    }
    if (url.includes('q.stock.sohu.com')) {
      return { ok: true, status: 200, text: async () => JSON.stringify([{ hq: [
        ['2026-08-20', '1', '1', '0', '0%', '1', '1', '1', '100000000'],
      ] }]) };
    }
    const id = ['DGS10', 'DGS30', 'DFF', 'CPIAUCSL', 'CBBTCUSD', 'DEXJPUS', 'DCOILBRENTEU', 'DCOILWTICO', 'PCOPPUSDM', 'DHHNGSP', 'NASDAQ100', 'SP500', 'VIXCLS', 'T10Y2Y', 'BAMLH0A0HYM2', 'DTWEXBGS', 'ICSA', 'NFCI']
      .find((seriesId) => url.includes(`id=${seriesId}`));
    const rowsById = {
      DGS10: '2025-08-22,4.2\n2026-08-20,4.7',
      DGS30: '2025-08-22,4.8\n2026-08-20,5.1',
      DFF: '2026-08-20,3.64\n2026-08-21,3.64',
      CPIAUCSL: '2025-07-01,100\n2026-07-01,103',
      CBBTCUSD: '2026-08-20,73000\n2026-08-21,78000',
      DEXJPUS: '2026-08-20,158.9\n2026-08-21,159.2',
      DCOILBRENTEU: '2026-08-20,94.2\n2026-08-21,95.3',
      DCOILWTICO: '2026-08-20,85.1\n2026-08-21,86.5',
      PCOPPUSDM: '2026-06-01,9800.25\n2026-07-01,9950.75',
      DHHNGSP: '2026-08-20,2.75\n2026-08-21,2.82',
      NASDAQ100: '2026-08-20,29213.16\n2026-08-21,29308.86',
      SP500: '2026-08-20,7758.20\n2026-08-21,7780.45',
      VIXCLS: '2026-08-20,16.01\n2026-08-21,15.80',
      T10Y2Y: '2026-08-20,0.46\n2026-08-21,0.48',
      BAMLH0A0HYM2: '2026-08-20,2.90\n2026-08-21,2.88',
      DTWEXBGS: '2026-08-20,119.1\n2026-08-21,118.9',
      ICSA: '2026-08-15,245000',
      NFCI: '2026-08-14,-0.50\n2026-08-21,-0.48',
    };
    const rows = rowsById[id];
    return { ok: true, status: 200, text: async () => `observation_date,${id}\n${rows}\n` };
  };

  const result = await queryMacroOutlook({ fetchImpl, now: new Date('2026-08-22T00:00:00Z') });
  assert.equal(result.charts.find((chart) => chart.id === 'pce').items.length, 0);
  assert.match(result.charts.find((chart) => chart.id === 'pce').error, /HTTP 503/);
  assert.equal(result.charts.find((chart) => chart.id === 'gold').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'federalFundsRate').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'silver').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'centralBankGoldPurchases').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'bitcoin').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'federalDebt').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'jpyUsd').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'brentOil').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'wtiOil').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'copper').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'naturalGas').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'aShareTurnover').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'aShareMarginBalance').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'aShareActiveMarketValueThs').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'nasdaq100Pe').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'ndx').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'sp500').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'vix').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'treasurySpread').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'highYieldSpread').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'broadDollar').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'initialClaims').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'financialConditions').error, null);
});

test('macro outlook only requests selected visible charts', async () => {
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(url);
    return {
      ok: true,
      status: 200,
      text: async () => 'observation_date,CBBTCUSD\n2026-08-20,73000\n2026-08-21,78000\n',
    };
  };
  const result = await queryMacroOutlook({
    chartIds: ['bitcoin'],
    fetchImpl,
    now: new Date('2026-08-22T00:00:00Z'),
  });
  assert.deepEqual(result.charts.map((chart) => chart.id), ['bitcoin']);
  assert.equal(urls.length, 1);
  assert.match(urls[0], /id=CBBTCUSD/);
});
