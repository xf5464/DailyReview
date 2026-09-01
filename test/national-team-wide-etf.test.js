const test = require('node:test');
const assert = require('node:assert/strict');
const {
  aggregateWideEtfHoldings,
  classifyBroadIndex,
  parseEastmoneyKlines,
} = require('../scripts/national-team-wide-etf');
const {
  classifyHolder,
  defaultReportDate,
  reportPeriod,
} = require('../scripts/update-national-team-etf-holdings');

test('classifies the migrated broad ETF names', () => {
  assert.equal(classifyBroadIndex('沪深300ETF华泰柏瑞'), '沪深300');
  assert.equal(classifyBroadIndex('科创50ETF易方达'), '科创50');
  assert.equal(classifyBroadIndex('中小100ETF华夏'), '中小100');
  assert.equal(classifyBroadIndex('黄金股ETF华夏'), null);
});

test('parses Eastmoney monthly prices and aggregates total and per-index market values', () => {
  const prices = parseEastmoneyKlines({ rc: 0, data: { klines: [
    '2024-06-28,1,2.00',
    '2024-12-31,1,3.00',
  ] } });
  const periods = [
    { key: '2024-2', label: '2024Q2', reportDate: '2024-06-30' },
    { key: '2024-4', label: '2024Q4', reportDate: '2024-12-31' },
  ];
  const series = [
    { etfCode: '510300', etfName: '沪深300ETF华泰柏瑞', holdings: { '2024-2': 10000, '2024-4': 20000 } },
    { etfCode: '510500', etfName: '中证500ETF南方', holdings: { '2024-2': 5000, '2024-4': 10000 } },
  ];
  const result = aggregateWideEtfHoldings(series, periods, new Map([
    ['510300', prices],
    ['510500', prices],
  ]));
  assert.deepEqual(result.items.map((item) => item.value), [3, 9]);
  assert.equal(result.rows.find((row) => row.broadIndex === '沪深300').quarterlyItems.at(-1).value, 6);
  assert.equal(result.rows.find((row) => row.broadIndex === '中证500').quarterlyItems.at(-1).value, 3);
});

test('incremental updater selects formal half-year reports and national-team holder names', () => {
  assert.deepEqual(reportPeriod('2026-06-30'), {
    key: '2026-2', label: '2026Q2', reportDate: '2026-06-30',
  });
  assert.equal(defaultReportDate(new Date('2026-09-01T00:00:00Z')), '2026-06-30');
  assert.equal(defaultReportDate(new Date('2026-08-31T00:00:00Z')), '2025-12-31');
  assert.equal(classifyHolder('中央汇金资产管理有限责任公司'), 'huijin');
  assert.equal(classifyHolder('中国证券金融股份有限公司'), 'zhengjin');
  assert.equal(classifyHolder('华泰证券股份有限公司'), null);
});
