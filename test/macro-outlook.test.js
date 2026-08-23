const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CHART_METADATA,
  RANGE_CONFIG,
  calculateYearOverYear,
  filterRecentItems,
  normalizeRange,
  normalizeChartIds,
  parseCsv,
  parseFredCsv,
  parseImfCsv,
  parseSinaGold,
  parseTreasuryDebt,
  parseAShareTurnover,
  parseNasdaq100PeSnapshot,
  queryMacroOutlook,
} = require('../scripts/macro-outlook');

test('macro outlook exposes every requested time range', () => {
  assert.deepEqual(Object.values(RANGE_CONFIG).map((range) => range.label), [
    '1天', '1周', '2周', '4周', '1个月', '3个月', '6个月', '1年', '2年', '3年', '5年', '10年',
  ]);
  assert.equal(normalizeRange(), 'month3');
  assert.deepEqual(normalizeChartIds(['bitcoin', 'unknown']), ['bitcoin']);
  assert.equal(CHART_METADATA.aShareTurnover.decimals, 0);
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
  const rows = parseImfCsv([
    'COUNTRY,INDICATOR,TIME_PERIOD,OBS_VALUE,SERIES_NAME',
    'G001,PGOLD,2026-M06,4237.1,"Gold, US dollars per ounce"',
    'G001,PSILVER,2026-M06,55.2,Silver',
  ].join('\n'));
  assert.deepEqual(rows, [{ date: '2026-06-01', value: 4237.1 }]);
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

test('Nasdaq-100 PE snapshot parser reads monthly trailing multiples', () => {
  assert.deepEqual(parseNasdaq100PeSnapshot('date,value\n2026-07,36.05\n2026-08,33.82'), [
    { date: '2026-07-01', value: 36.05 },
    { date: '2026-08-01', value: 33.82 },
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
  assert.deepEqual(filterRecentItems(monthly, 'day1', 'monthly'), [monthly[1]]);
  assert.deepEqual(filterRecentItems(daily, 'week1'), daily.slice(1));
  assert.equal(filterRecentItems(monthly, 'month1', 'monthly').length, 1);
  assert.deepEqual(filterRecentItems(monthly, 'year1', 'quarterly'), monthly.slice(-2));
  assert.deepEqual(filterRecentItems([
    { date: '2026-07-31', value: 1 },
    { date: '2026-08-03', value: 2 },
    { date: '2026-08-21', value: 3 },
  ], 'month1'), [
    { date: '2026-08-03', value: 2 },
    { date: '2026-08-21', value: 3 },
  ]);
});

test('macro outlook query returns twenty independent chart payloads', async () => {
  const fredData = {
    DGS10: 'observation_date,DGS10\n2025-08-22,4.2\n2026-08-20,4.7\n',
    DGS30: 'observation_date,DGS30\n2025-08-22,4.8\n2026-08-20,5.1\n',
    CPIAUCSL: 'observation_date,CPIAUCSL\n2025-07-01,100\n2026-07-01,103\n',
    PCEPI: 'observation_date,PCEPI\n2025-06-01,100\n2026-06-01,102.5\n',
    CBBTCUSD: 'observation_date,CBBTCUSD\n2026-08-20,73000\n2026-08-21,78000\n',
    DEXJPUS: 'observation_date,DEXJPUS\n2026-08-20,158.9\n2026-08-21,159.2\n',
    DCOILBRENTEU: 'observation_date,DCOILBRENTEU\n2026-08-20,94.2\n2026-08-21,95.3\n',
    DCOILWTICO: 'observation_date,DCOILWTICO\n2026-08-20,85.1\n2026-08-21,86.5\n',
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
  ].join('\n');
  const sinaGoldData = 'var _XAU=([{"date":"2026-08-20","close":"4500"},{"date":"2026-08-21","close":"4520"}]);';
  const aShareTurnoverData = JSON.stringify({ code: '200', data: [
    { tradeDate: '20260820', tradingValue: 19346.8 },
    { tradeDate: '20260821', tradingValue: 20500.25 },
  ] });
  const fetchImpl = async (url) => {
    const seriesId = Object.keys(fredData).find((id) => url.includes(`id=${id}`));
    return {
      ok: true,
      status: 200,
      text: async () => url.includes('api.fiscaldata.treasury.gov')
        ? JSON.stringify({ data: [{ record_date: '2026-08-20', tot_pub_debt_out_amt: '39500000000000' }] })
        : url.includes('csindex.com.cn/csindex-home/perf') ? aShareTurnoverData
        : url.includes('stock2.finance.sina.com.cn') ? sinaGoldData : seriesId ? fredData[seriesId] : imfData,
    };
  };

  const result = await queryMacroOutlook({ fetchImpl, now: new Date('2026-08-22T00:00:00Z') });
  assert.deepEqual(result.charts.map((chart) => chart.id), [
    'treasuryYield', 'treasuryYield30', 'cpi', 'pce', 'gold', 'bitcoin', 'federalDebt', 'jpyUsd',
    'brentOil', 'wtiOil', 'aShareTurnover', 'nasdaq100Pe', 'ndx', 'sp500', 'vix',
    'treasurySpread', 'highYieldSpread', 'broadDollar', 'initialClaims', 'financialConditions',
  ]);
  assert.deepEqual(result.charts.map((chart) => chart.error), Array(20).fill(null));
  assert.ok(Math.abs(result.charts.find((chart) => chart.id === 'cpi').items[0].value - 3) < 1e-9);
  assert.equal(result.charts.find((chart) => chart.id === 'gold').items.at(-1).value, 4520);
  assert.equal(result.charts.find((chart) => chart.id === 'bitcoin').items.at(-1).value, 78000);
  assert.equal(result.charts.find((chart) => chart.id === 'federalDebt').items.at(-1).value, 39.5);
  assert.equal(result.charts.find((chart) => chart.id === 'jpyUsd').items.at(-1).value, 159.2);
  assert.equal(result.charts.find((chart) => chart.id === 'brentOil').items.at(-1).value, 95.3);
  assert.equal(result.charts.find((chart) => chart.id === 'wtiOil').items.at(-1).value, 86.5);
  assert.equal(result.charts.find((chart) => chart.id === 'aShareTurnover').items.at(-1).value, 20500.25);
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
    if (url.includes('api.imf.org')) {
      return { ok: true, status: 200, text: async () => 'COUNTRY,INDICATOR,TIME_PERIOD,OBS_VALUE\nG001,PGOLD,2026-M06,4300\n' };
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
    const id = ['DGS10', 'DGS30', 'CPIAUCSL', 'CBBTCUSD', 'DEXJPUS', 'DCOILBRENTEU', 'DCOILWTICO', 'NASDAQ100', 'SP500', 'VIXCLS', 'T10Y2Y', 'BAMLH0A0HYM2', 'DTWEXBGS', 'ICSA', 'NFCI']
      .find((seriesId) => url.includes(`id=${seriesId}`));
    const rowsById = {
      DGS10: '2025-08-22,4.2\n2026-08-20,4.7',
      DGS30: '2025-08-22,4.8\n2026-08-20,5.1',
      CPIAUCSL: '2025-07-01,100\n2026-07-01,103',
      CBBTCUSD: '2026-08-20,73000\n2026-08-21,78000',
      DEXJPUS: '2026-08-20,158.9\n2026-08-21,159.2',
      DCOILBRENTEU: '2026-08-20,94.2\n2026-08-21,95.3',
      DCOILWTICO: '2026-08-20,85.1\n2026-08-21,86.5',
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
  assert.equal(result.charts.find((chart) => chart.id === 'bitcoin').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'federalDebt').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'jpyUsd').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'brentOil').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'wtiOil').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'aShareTurnover').error, null);
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

