const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CHART_METADATA,
  BEA_NEWS_RSS_URL,
  CBOE_VIX_HISTORY_URL,
  ISM_OFFICIAL_MANUFACTURING_SNAPSHOT,
  RANGE_CONFIG,
  calculateDxy,
  calculateYearOverYear,
  filterRecentItems,
  mergeSpotWithFuturesSupplement,
  normalizeRange,
  normalizeChartIds,
  buildDbnomicsIsmUrl,
  buildTonghuashunSentimentUrl,
  buildEastmoneyHolderUrl,
  buildTonghuashunWeeklyPriceUrl,
  buildImfCommodityUrl,
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
const ISM_PMI_SNAPSHOT_HTML = [
  '<h3>THE LAST 12 MONTHS</h3>',
  '<table>',
  '<tr><th scope="row">Dec 2025</th><td class="text-center">47.9</td></tr>',
  '<tr><th scope="row">Nov 2025</th><td class="text-center">48.2</td></tr>',
  '</table>',
  '<label>Average for 12 months -</label>',
  '<table><tr><th scope="row">Dec 2025</th><td>10.3</td></tr></table>',
].join('');
const BEA_PCE_RSS_XML = [
  '<rss><channel><item name="Personal Income and Outlays">',
  '<title>Personal Income and Outlays, July 2026</title>',
  '<link>https://www.bea.gov/news/2026/personal-income-and-outlays-july-2026</link>',
  '</item></channel></rss>',
].join('');
const BEA_PCE_RELEASE_HTML = [
  '<p>From the preceding month, the PCE price index for July increased 0.2 percent.</p>',
  '<p>From the same month one year ago, the <strong>PCE price index for July increased 3.7 percent</strong>.',
  ' Excluding food and energy, the PCE price index increased 3.3 percent.</p>',
].join('');
const FILM_CINEMA_HTML = [
  '<a href="https://stockpage.10jqka.com.cn/600088/">600088</a>',
  '<a href="https://stockpage.10jqka.com.cn/600088/">中视传媒</a>',
  '<a href="https://stockpage.10jqka.com.cn/600977/">600977</a>',
  '<a href="https://stockpage.10jqka.com.cn/600977/">中国电影</a>',
].join('');
const TONGHUASHUN_HOLDER_HTML = [
  'var lholder = [12000, 11000, 10000];',
  'var lyear = ["2025-12-31", "2026-03-31", "2026-06-30"];',
].join('');
const EASTMONEY_HOLDER_JSON = JSON.stringify({ success: true, result: { data: [
  { END_DATE: '2024-12-31 00:00:00', HOLDER_NUM: 13000 },
] } });
const TONGHUASHUN_WEEKLY_PRICE = 'quotebridge_v6_line_hs_600088_11_last({' +
  '"data":"20251231,10,11,9,10.50,1,2;20260331,11,12,10,11.80,1,2;20260630,12,13,11,12.60,1,2"})';

function makeDbnomicsPayload(datasetCode, seriesCode, values) {
  const periods = ['2026-06', '2026-07', '2026-08'].slice(0, values.length);
  return JSON.stringify({ series: { docs: [{
    dataset_code: datasetCode,
    series_code: seriesCode,
    period: periods,
    value: values,
  }] } });
}
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

test('CBOE VIX parser reads the official daily close and normalizes US dates', () => {
  assert.equal(CBOE_VIX_HISTORY_URL, 'https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv');
  assert.deepEqual(parseCboeVixCsv([
    'DATE,OPEN,HIGH,LOW,CLOSE',
    '08/24/2026,15.900000,16.060000,15.610000,15.850000',
    '08/25/2026,15.710000,16.300000,15.130000,15.450000',
  ].join('\n')), [
    { date: '2026-08-24', value: 15.85 },
    { date: '2026-08-25', value: 15.45 },
  ]);
});

test('BEA PCE release discovery and parser supplement a newly published year-over-year value', () => {
  assert.equal(BEA_NEWS_RSS_URL, 'https://apps.bea.gov/rss/rss.xml');
  const release = findLatestBeaPceRelease(BEA_PCE_RSS_XML);
  assert.deepEqual(release, {
    date: '2026-07-01',
    url: 'https://www.bea.gov/news/2026/personal-income-and-outlays-july-2026',
  });
  assert.deepEqual(parseBeaPceRelease(BEA_PCE_RELEASE_HTML, release.date), {
    date: '2026-07-01',
    value: 3.7,
  });
});

test('macro query supplements stale FRED PCE and VIX with official latest releases', async () => {
  const fetchImpl = async (url) => ({
    ok: true,
    status: 200,
    text: async () => url === BEA_NEWS_RSS_URL ? BEA_PCE_RSS_XML
      : url.includes('personal-income-and-outlays-july-2026') ? BEA_PCE_RELEASE_HTML
      : url === CBOE_VIX_HISTORY_URL ? [
        'DATE,OPEN,HIGH,LOW,CLOSE',
        '08/24/2026,15.90,16.06,15.61,15.85',
        '08/25/2026,15.71,16.30,15.13,15.45',
      ].join('\n')
      : url.includes('id=PCEPI') ? [
        'observation_date,PCEPI',
        '2025-06-01,100',
        '2026-06-01,103.6',
      ].join('\n')
      : 'observation_date,VIXCLS\n2026-08-24,15.85\n',
  });
  const result = await queryMacroOutlook({
    fetchImpl,
    now: new Date('2026-08-26T13:00:00Z'),
    chartIds: ['pce', 'vix'],
  });
  assert.deepEqual(result.charts.find((chart) => chart.id === 'pce').items.at(-1), {
    date: '2026-07-01',
    value: 3.7,
  });
  assert.deepEqual(result.charts.find((chart) => chart.id === 'vix').items.at(-1), {
    date: '2026-08-25',
    value: 15.45,
  });
});

test('ISM PMI snapshot parser reads only the latest twelve-month table', () => {
  assert.deepEqual(parseIsmPmiSnapshot(ISM_PMI_SNAPSHOT_HTML), [
    { date: '2025-11-01', value: 48.2 },
    { date: '2025-12-01', value: 47.9 },
  ]);
});

test('film and cinema constituent and shareholder parsers normalize public source data', () => {
  assert.deepEqual(parseTonghuashunIndustryConstituents(FILM_CINEMA_HTML), [
    { code: '600088', name: '中视传媒' },
    { code: '600977', name: '中国电影' },
  ]);
  const history = parseTonghuashunHolderHistory(TONGHUASHUN_HOLDER_HTML);
  assert.deepEqual(history.at(-1), { date: '2026-06-30', value: 10000 });
  assert.deepEqual(quarterlyHolderItems(history), history);
  assert.deepEqual(parseEastmoneyHolderHistory(JSON.stringify({ success: true, result: { data: [
    { END_DATE: '2026-03-31 00:00:00', HOLDER_NUM: 11000 },
  ] } })), [{ date: '2026-03-31', value: 11000 }]);
  assert.match(buildEastmoneyHolderUrl('600088'), /RPT_HOLDERNUM_DET/);
  assert.match(buildTonghuashunWeeklyPriceUrl('600088'), /hs_600088\/11\/last\.js/);
  const priceItems = parseTonghuashunWeeklyPriceHistory(TONGHUASHUN_WEEKLY_PRICE);
  assert.deepEqual(priceItems.at(-1), { date: '2026-06-30', value: 12.6 });
  assert.deepEqual(attachQuarterlyPrices(history, priceItems).at(-1), {
    date: '2026-06-30', value: 10000, priceValue: 12.6, priceDate: '2026-06-30',
  });
  const industryRow = '<tr>' + [
    '1', '<a href="http://stockpage.10jqka.com.cn/600088/">600088</a>',
    '<a href="http://stockpage.10jqka.com.cn/600088">中视传媒</a>',
    '11.55', '0', '0', '0', '0', '0', '0', '0.28亿', '3.98亿', '45.94亿', '16.96',
  ].map((value) => '<td>' + value + '</td>').join('') + '</tr>';
  assert.equal(parseTonghuashunIndustryConstituents(industryRow)[0].marketCap, 45.94);
});

test('official ISM snapshot covers the four manufacturing indexes through July 2026', () => {
  assert.deepEqual(ISM_OFFICIAL_MANUFACTURING_SNAPSHOT.at(-1), {
    date: '2026-07-01',
    pmi: 55.6,
    supplierDeliveries: 58.9,
    newOrders: 56.7,
    backlogOrders: 55,
  });
});

test('DXY calculation applies the ICE six-currency fixed-weight formula', () => {
  const unitRate = [{ date: '2026-08-20', value: 1 }];
  const result = calculateDxy({
    DEXUSEU: unitRate,
    DEXJPUS: unitRate,
    DEXUSUK: unitRate,
    DEXCAUS: unitRate,
    DEXSDUS: unitRate,
    DEXSZUS: unitRate,
  });
  assert.deepEqual(result, [{ date: '2026-08-20', value: 50.14348112 }]);
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

test('DBnomics parser reads ISM diffusion indexes and rejects malformed low values', () => {
  assert.equal(
    buildDbnomicsIsmUrl('neword', 'in'),
    'https://api.db.nomics.world/v22/series/ISM/neword?observations=1',
  );
  assert.deepEqual(
    parseDbnomicsSeries(makeDbnomicsPayload('pmi', 'pm', [48.5, 49.2, 10.3]), 'pmi', 'pm', {
      minValue: 20,
      maxValue: 80,
    }),
    [
      { date: '2026-06-01', value: 48.5 },
      { date: '2026-07-01', value: 49.2 },
    ],
  );
});

test('Tonghuashun sentiment parser reads official 883404 daily closes and years', () => {
  const text = 'quotebridge_v4_line_bk_883404_00_last({' +
    '"year":{"2025":243,"2026":158},' +
    '"data":"20260820,890.1,905.0,888.0,901.2,1,2,,,,0;20260821,901.2,910.0,899.0,905.6,1,2,,,,0"' +
    '})';
  assert.equal(buildTonghuashunSentimentUrl(), 'https://d.10jqka.com.cn/v4/line/bk_883404/00/last.js');
  assert.deepEqual(parseTonghuashunSentimentYears(text), ['2025', '2026']);
  assert.deepEqual(parseTonghuashunSentimentHistory(text), [
    { date: '2026-08-20', value: 901.2 },
    { date: '2026-08-21', value: 905.6 },
  ]);
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

test('macro outlook query returns thirty-four independent chart payloads', async () => {
  const fredData = {
    DGS10: 'observation_date,DGS10\n2025-08-22,4.2\n2026-08-20,4.7\n',
    DGS30: 'observation_date,DGS30\n2025-08-22,4.8\n2026-08-20,5.1\n',
    DFF: 'observation_date,DFF\n2026-08-20,3.64\n2026-08-21,3.64\n',
    CPIAUCSL: 'observation_date,CPIAUCSL\n2025-07-01,100\n2026-07-01,103\n',
    PCEPI: 'observation_date,PCEPI\n2025-06-01,100\n2026-06-01,102.5\n',
    CBBTCUSD: 'observation_date,CBBTCUSD\n2026-08-20,73000\n2026-08-21,78000\n',
    DEXJPUS: 'observation_date,DEXJPUS\n2026-08-20,158.9\n2026-08-21,159.2\n',
    DEXUSEU: 'observation_date,DEXUSEU\n2026-08-20,1.18\n2026-08-21,1.17\n',
    DEXUSUK: 'observation_date,DEXUSUK\n2026-08-20,1.35\n2026-08-21,1.34\n',
    DEXCAUS: 'observation_date,DEXCAUS\n2026-08-20,1.36\n2026-08-21,1.37\n',
    DEXSDUS: 'observation_date,DEXSDUS\n2026-08-20,9.4\n2026-08-21,9.5\n',
    DEXSZUS: 'observation_date,DEXSZUS\n2026-08-20,0.8\n2026-08-21,0.81\n',
    DCOILBRENTEU: 'observation_date,DCOILBRENTEU\n2026-08-20,94.2\n2026-08-21,95.3\n',
    DCOILWTICO: 'observation_date,DCOILWTICO\n2026-08-20,85.1\n2026-08-21,86.5\n',
    PCOPPUSDM: 'observation_date,PCOPPUSDM\n2026-06-01,9800.25\n2026-07-01,9950.75\n',
    DHHNGSP: 'observation_date,DHHNGSP\n2026-08-20,2.75\n2026-08-21,2.82\n',
    NASDAQ100: 'observation_date,NASDAQ100\n2026-08-20,29213.16\n2026-08-21,29308.86\n',
    SP500: 'observation_date,SP500\n2026-08-20,7758.20\n2026-08-21,7780.45\n',
    VIXCLS: 'observation_date,VIXCLS\n2026-08-20,16.01\n2026-08-21,15.80\n',
    T10Y2Y: 'observation_date,T10Y2Y\n2026-08-20,0.46\n2026-08-21,0.48\n',
    BAMLH0A0HYM2: 'observation_date,BAMLH0A0HYM2\n2026-08-20,2.90\n2026-08-21,2.88\n',
    ICSA: 'observation_date,ICSA\n2026-08-15,245000\n',
    UNRATE: 'observation_date,UNRATE\n2026-06-01,4.1\n2026-07-01,4.2\n',
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
  const aShareSentimentData = 'quotebridge_v4_line_bk_883404_00_last({' +
    '"year":{"2026":2},' +
    '"data":"20260820,890.1,905.0,888.0,901.2,1,2,,,,0;20260821,901.2,910.0,899.0,905.6,1,2,,,,0"' +
    '})';
  const ismData = {
    '/pmi?': JSON.stringify({ series: { docs: [{
      dataset_code: 'pmi',
      series_code: 'pm',
      period: ['2025-06', '2025-07', '2025-08'],
      value: [48.5, 49.2, 10.3],
    }] } }),
    '/supdel?': makeDbnomicsPayload('supdel', 'in', [51.1, 50.8]),
    '/neword?': makeDbnomicsPayload('neword', 'in', [47.4, 47.7]),
    '/bacord?': makeDbnomicsPayload('bacord', 'in', [44, 45.8]),
  };
  const fetchImpl = async (url) => {
    const seriesId = Object.keys(fredData).find((id) => url.includes(`id=${id}`));
    const ismPath = Object.keys(ismData).find((path) => url.includes(path));
    return {
      ok: true,
      status: 200,
      text: async () => url.includes('api.fiscaldata.treasury.gov')
        ? JSON.stringify({ data: [{ record_date: '2026-08-20', tot_pub_debt_out_amt: '39500000000000' }] })
        : url.includes('git.nomics.world') ? ISM_PMI_SNAPSHOT_HTML
        : url === 'https://www.gold.org/goldhub/research/gold-demand-trends' ? WGC_INDEX_HTML
        : url.endsWith('/central-banks') ? WGC_REPORT_HTML
        : url.includes('fsapi.gold.org') ? WGC_CHART_SCRIPT
        : url.includes('RPTA_WEB_MARGIN_DAILYTRADE') ? aShareMarginData
        : url.includes('code=zs_000001') ? shanghaiIndexData
        : url.includes('code=zs_399106') ? shenzhenIndexData
        : url.includes('/11/last.js') ? TONGHUASHUN_WEEKLY_PRICE
        : url.includes('RPT_HOLDERNUM_DET') ? EASTMONEY_HOLDER_JSON
        : url.includes('/thshy/detail/code/881274') ? FILM_CINEMA_HTML
        : url.includes('basic.10jqka.com.cn/mobile/') ? TONGHUASHUN_HOLDER_HTML
        : url.includes('d.10jqka.com.cn/v4/line/bk_883404/00') ? aShareSentimentData
        : url.includes('csindex.com.cn/csindex-home/perf') ? aShareTurnoverData
        : ismPath ? ismData[ismPath]
        : url.includes('stock2.finance.sina.com.cn') ? sinaGoldData : seriesId ? fredData[seriesId] : imfData,
    };
  };

  const result = await queryMacroOutlook({ fetchImpl, now: new Date('2026-08-22T00:00:00Z') });
  assert.deepEqual(result.charts.map((chart) => chart.id), [
    'treasuryYield', 'treasuryYield30', 'federalFundsRate', 'cpi', 'pce', 'gold', 'silver', 'centralBankGoldPurchases', 'bitcoin', 'federalDebt', 'jpyUsd',
    'brentOil', 'wtiOil', 'copper', 'naturalGas', 'aShareTurnover', 'aShareMarginBalance', 'aShareActiveMarketValueThs', 'aShareSentimentThs', 'filmCinemaShareholders', 'nasdaq100Pe', 'ndx', 'sp500', 'vix',
    'treasurySpread', 'highYieldSpread', 'broadDollar', 'ismManufacturingPmi', 'ismSupplierDeliveries', 'ismNewOrders', 'ismBacklogOrders',
    'initialClaims', 'unemploymentRate', 'financialConditions',
  ]);
  assert.deepEqual(result.charts.map((chart) => chart.error), Array(34).fill(null));
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
  assert.equal(result.charts.find((chart) => chart.id === 'aShareSentimentThs').items.at(-1).value, 905.6);
  assert.equal(result.charts.find((chart) => chart.id === 'filmCinemaShareholders').rows.length, 2);
  assert.equal(result.charts.find((chart) => chart.id === 'nasdaq100Pe').items.at(-1).value, 33.82);
  assert.equal(result.charts.find((chart) => chart.id === 'ndx').items.at(-1).value, 29308.86);
  assert.equal(result.charts.find((chart) => chart.id === 'sp500').items.at(-1).value, 7780.45);
  assert.equal(result.charts.find((chart) => chart.id === 'vix').items.at(-1).value, 15.8);
  assert.equal(result.charts.find((chart) => chart.id === 'treasurySpread').items.at(-1).value, 0.48);
  assert.equal(result.charts.find((chart) => chart.id === 'highYieldSpread').items.at(-1).value, 2.88);
  const expectedDxy = 50.14348112 * (1.17 ** -0.576) * (159.2 ** 0.136) * (1.34 ** -0.119) *
    (1.37 ** 0.091) * (9.5 ** 0.042) * (0.81 ** 0.036);
  assert.ok(Math.abs(result.charts.find((chart) => chart.id === 'broadDollar').items.at(-1).value - expectedDxy) < 1e-9);
  assert.equal(result.charts.find((chart) => chart.id === 'ismManufacturingPmi').items.at(-1).value, 55.6);
  assert.equal(result.charts.find((chart) => chart.id === 'ismSupplierDeliveries').items.at(-1).value, 58.9);
  assert.equal(result.charts.find((chart) => chart.id === 'ismNewOrders').items.at(-1).value, 56.7);
  assert.equal(result.charts.find((chart) => chart.id === 'ismBacklogOrders').items.at(-1).value, 55);
  assert.equal(result.charts.find((chart) => chart.id === 'initialClaims').items.at(-1).value, 24.5);
  assert.equal(result.charts.find((chart) => chart.id === 'unemploymentRate').items.at(-1).value, 4.2);
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
    if (url.includes('d.10jqka.com.cn/v4/line/bk_883404/00')) {
      return { ok: true, status: 200, text: async () => 'quotebridge_v4_line_bk_883404_00_last({' +
        '"year":{"2026":1},"data":"20260820,890.1,905.0,888.0,901.2,1,2,,,,0"})' };
    }
    if (url.includes('RPT_HOLDERNUM_DET')) {
      return { ok: true, status: 200, text: async () => EASTMONEY_HOLDER_JSON };
    }
    if (url.includes('/11/last.js')) {
      return { ok: true, status: 200, text: async () => TONGHUASHUN_WEEKLY_PRICE };
    }
    if (url.includes('/thshy/detail/code/881274')) {
      return { ok: true, status: 200, text: async () => FILM_CINEMA_HTML };
    }
    if (url.includes('basic.10jqka.com.cn/mobile/')) {
      return { ok: true, status: 200, text: async () => TONGHUASHUN_HOLDER_HTML };
    }
    const ismSeries = [
      ['/pmi?', 'pmi', 'pm', [48.5, 49.2, 10.3]],
      ['/supdel?', 'supdel', 'in', [51.1, 50.8]],
      ['/neword?', 'neword', 'in', [47.4, 47.7]],
      ['/bacord?', 'bacord', 'in', [44, 45.8]],
    ].find((entry) => url.includes(entry[0]));
    if (ismSeries) {
      return {
        ok: true,
        status: 200,
        text: async () => makeDbnomicsPayload(ismSeries[1], ismSeries[2], ismSeries[3]),
      };
    }
    const id = ['DGS10', 'DGS30', 'DFF', 'CPIAUCSL', 'CBBTCUSD', 'DEXJPUS', 'DEXUSEU', 'DEXUSUK', 'DEXCAUS', 'DEXSDUS', 'DEXSZUS', 'DCOILBRENTEU', 'DCOILWTICO', 'PCOPPUSDM', 'DHHNGSP', 'NASDAQ100', 'SP500', 'VIXCLS', 'T10Y2Y', 'BAMLH0A0HYM2', 'ICSA', 'UNRATE', 'NFCI']
      .find((seriesId) => url.includes(`id=${seriesId}`));
    const rowsById = {
      DGS10: '2025-08-22,4.2\n2026-08-20,4.7',
      DGS30: '2025-08-22,4.8\n2026-08-20,5.1',
      DFF: '2026-08-20,3.64\n2026-08-21,3.64',
      CPIAUCSL: '2025-07-01,100\n2026-07-01,103',
      CBBTCUSD: '2026-08-20,73000\n2026-08-21,78000',
      DEXJPUS: '2026-08-20,158.9\n2026-08-21,159.2',
      DEXUSEU: '2026-08-20,1.18\n2026-08-21,1.17',
      DEXUSUK: '2026-08-20,1.35\n2026-08-21,1.34',
      DEXCAUS: '2026-08-20,1.36\n2026-08-21,1.37',
      DEXSDUS: '2026-08-20,9.4\n2026-08-21,9.5',
      DEXSZUS: '2026-08-20,0.8\n2026-08-21,0.81',
      DCOILBRENTEU: '2026-08-20,94.2\n2026-08-21,95.3',
      DCOILWTICO: '2026-08-20,85.1\n2026-08-21,86.5',
      PCOPPUSDM: '2026-06-01,9800.25\n2026-07-01,9950.75',
      DHHNGSP: '2026-08-20,2.75\n2026-08-21,2.82',
      NASDAQ100: '2026-08-20,29213.16\n2026-08-21,29308.86',
      SP500: '2026-08-20,7758.20\n2026-08-21,7780.45',
      VIXCLS: '2026-08-20,16.01\n2026-08-21,15.80',
      T10Y2Y: '2026-08-20,0.46\n2026-08-21,0.48',
      BAMLH0A0HYM2: '2026-08-20,2.90\n2026-08-21,2.88',
      ICSA: '2026-08-15,245000',
      UNRATE: '2026-06-01,4.1\n2026-07-01,4.2',
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
  assert.equal(result.charts.find((chart) => chart.id === 'aShareSentimentThs').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'filmCinemaShareholders').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'nasdaq100Pe').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'ndx').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'sp500').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'vix').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'treasurySpread').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'highYieldSpread').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'broadDollar').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'ismManufacturingPmi').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'ismSupplierDeliveries').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'ismNewOrders').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'ismBacklogOrders').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'initialClaims').error, null);
  assert.equal(result.charts.find((chart) => chart.id === 'unemploymentRate').error, null);
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
