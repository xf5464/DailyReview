const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FRED_MD_ISM_SERIES,
  FRED_MD_URL,
  normalizeFredMdDate,
  parseFredMdSeries,
} = require('../scripts/supplement-ism-fred-md-history');

test('FRED-MD parser reads the ISM PMI, new-orders, and supplier-deliveries histories', () => {
  const csv = [
    'sasdate,RPI,NAPM,NAPMNOI,NAPMSDI,UNRATE',
    'Transform:,5,1,1,1,2',
    '1/1/2000,100,56.3,55.2,53.1,4.0',
    '2/1/2000,101,55.8,52.0,52.4,4.1',
    '3/1/2020,102,49.1,42.2,65.0,4.4',
    '4/1/2020,103,41.5,27.1,76.0,14.8',
  ].join('\n');

  assert.deepEqual(parseFredMdSeries(csv, 'NAPMNOI'), [
    { date: '2000-01-01', value: 55.2 },
    { date: '2000-02-01', value: 52.0 },
    { date: '2020-03-01', value: 42.2 },
    { date: '2020-04-01', value: 27.1 },
  ]);
  assert.deepEqual(parseFredMdSeries(csv, 'NAPM').slice(-2), [
    { date: '2020-03-01', value: 49.1 },
    { date: '2020-04-01', value: 41.5 },
  ]);
  assert.deepEqual(parseFredMdSeries(csv, 'NAPMSDI').slice(-2), [
    { date: '2020-03-01', value: 65.0 },
    { date: '2020-04-01', value: 76.0 },
  ]);
});

test('ISM FRED-MD mapping uses the official St. Louis Fed current dataset and excludes backlog orders', () => {
  assert.equal(FRED_MD_URL, 'https://files.stlouisfed.org/files/htdocs/fred-md/monthly/current.csv');
  assert.deepEqual(FRED_MD_ISM_SERIES, {
    ismManufacturingPmi: 'NAPM',
    ismSupplierDeliveries: 'NAPMSDI',
    ismNewOrders: 'NAPMNOI',
  });
  assert.equal(Object.hasOwn(FRED_MD_ISM_SERIES, 'ismBacklogOrders'), false);
  assert.equal(normalizeFredMdDate('12/1/2008'), '2008-12-01');
});
