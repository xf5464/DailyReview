const test = require('node:test');
const assert = require('node:assert/strict');

const {
  HISTORICAL_BRIDGE_ITEMS,
  LEGACY_FRED_MD_URL,
  areConsecutiveMonths,
  findDropHits,
  parseFredMdNewOrders,
  validateLegacyHistory,
} = require('../scripts/supplement-ism-new-orders-history');

test('legacy FRED-MD parser reads the NAPMNOI column by name', () => {
  const csv = [
    'sasdate,RPI,NAPM,NAPMNOI,NAPMSDI',
    'Transform:,5,1,1,1',
    '10/1/2008,100,38.9,33.2,50.3',
    '12/1/2008,99,33.1,23.2,48.1',
    '3/1/2015,101,51.5,51.8,50.0',
  ].join('\n');
  const items = parseFredMdNewOrders(csv);
  assert.deepEqual(items, [
    { date: '2008-10-01', value: 33.2 },
    { date: '2008-12-01', value: 23.2 },
    { date: '2015-03-01', value: 51.8 },
  ]);
  validateLegacyHistory(items);
});

test('legacy FRED-MD source is pinned to an immutable snapshot copy', () => {
  assert.match(LEGACY_FRED_MD_URL, /raw\.githubusercontent\.com\/xinaut\/SOFARI\/d3d235826925e1197f2165e7f9cbf41ad6bc378a\//);
});

test('historical bridge is continuous from April 2015 through December 2020', () => {
  assert.equal(HISTORICAL_BRIDGE_ITEMS[0].date, '2015-04-01');
  assert.equal(HISTORICAL_BRIDGE_ITEMS.at(-1).date, '2020-12-01');
  for (let index = 1; index < HISTORICAL_BRIDGE_ITEMS.length; index += 1) {
    assert.equal(
      areConsecutiveMonths(HISTORICAL_BRIDGE_ITEMS[index - 1].date, HISTORICAL_BRIDGE_ITEMS[index].date),
      true,
      `${HISTORICAL_BRIDGE_ITEMS[index - 1].date} -> ${HISTORICAL_BRIDGE_ITEMS[index].date}`,
    );
  }
});

test('default 10 percent rule catches the COVID shock months', () => {
  const hits = findDropHits(HISTORICAL_BRIDGE_ITEMS, 10);
  const dates = hits.map((item) => item.date);
  assert.ok(dates.includes('2020-03-01'));
  assert.ok(dates.includes('2020-04-01'));
});

test('default 10 percent rule catches the 2008 credit-crisis collapse', () => {
  const items = [
    { date: '2008-09-01', value: 41.8 },
    { date: '2008-10-01', value: 33.2 },
    { date: '2008-11-01', value: 27.6 },
    { date: '2008-12-01', value: 23.2 },
  ];
  assert.deepEqual(findDropHits(items, 10).map((item) => item.date), [
    '2008-10-01',
    '2008-11-01',
    '2008-12-01',
  ]);
});

test('backtest helper never compares across a missing month', () => {
  const items = [
    { date: '2020-01-01', value: 60 },
    { date: '2020-03-01', value: 40 },
  ];
  assert.equal(areConsecutiveMonths('2020-01-01', '2020-03-01'), false);
  assert.deepEqual(findDropHits(items, 10), []);
});
