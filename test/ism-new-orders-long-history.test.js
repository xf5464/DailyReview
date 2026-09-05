const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FRED_MD_URL,
  normalizeFredMdDate,
  parseFredMdNewOrders,
} = require('../scripts/supplement-ism-new-orders-history');

test('FRED-MD parser reads long ISM new-orders history and skips transform row', () => {
  const csv = [
    'sasdate,RPI,NAPMNOI,UNRATE',
    'Transform:,5,1,2',
    '1/1/2000,100,55.2,4.0',
    '2/1/2000,101,52.0,4.1',
    '3/1/2020,102,42.2,4.4',
    '4/1/2020,103,27.1,14.8',
  ].join('\n');
  assert.deepEqual(parseFredMdNewOrders(csv), [
    { date: '2000-01-01', value: 55.2 },
    { date: '2000-02-01', value: 52.0 },
    { date: '2020-03-01', value: 42.2 },
    { date: '2020-04-01', value: 27.1 },
  ]);
});

test('FRED-MD history uses the official St. Louis Fed current dataset URL', () => {
  assert.equal(FRED_MD_URL, 'https://files.stlouisfed.org/files/htdocs/fred-md/monthly/current.csv');
  assert.equal(normalizeFredMdDate('12/1/2008'), '2008-12-01');
});
