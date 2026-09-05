const test = require('node:test');
const assert = require('node:assert/strict');

const {
  monthRange,
  parseFredMdSeries,
  parseGretlSeries,
} = require('../scripts/supplement-ism-other-history');

test('legacy FRED-MD parser reads PMI and supplier deliveries by column name', () => {
  const csv = [
    'sasdate,RPI,NAPM,NAPMNOI,NAPMSDI',
    'Transform:,5,1,1,1',
    '1/1/2008,100,50.8,49.1,52.3',
    '2/1/2008,101,48.3,47.6,51.1',
  ].join('\n');
  assert.deepEqual(parseFredMdSeries(csv, 'NAPM'), [
    { date: '2008-01-01', value: 50.8 },
    { date: '2008-02-01', value: 48.3 },
  ]);
  assert.deepEqual(parseFredMdSeries(csv, 'NAPMSDI'), [
    { date: '2008-01-01', value: 52.3 },
    { date: '2008-02-01', value: 51.1 },
  ]);
});

test('gretl archive parser resolves the backlog series offset and monthly dates', () => {
  const indexText = [
    '# sample',
    'foo  Example series',
    'M  2000.01 - 2000.02  n = 2',
    'napmbi  ISM Manufacturing: Backlog of Orders Index, Index, NSA',
    'M  2008.10 - 2008.12  n = 3',
  ].join('\n');
  const dataText = '1 2 35.0 28.0 24.0';
  assert.deepEqual(parseGretlSeries(indexText, dataText, 'napmbi'), [
    { date: '2008-10-01', value: 35.0 },
    { date: '2008-11-01', value: 28.0 },
    { date: '2008-12-01', value: 24.0 },
  ]);
});

test('monthRange rolls across years', () => {
  assert.deepEqual(monthRange('2020.11', 3), [
    '2020-11-01', '2020-12-01', '2021-01-01',
  ]);
});
