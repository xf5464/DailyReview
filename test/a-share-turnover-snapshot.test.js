const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSnapshot, completedEastmoneyItems } = require('../scripts/refresh-a-share-turnover-snapshot');
const { loadTurnoverFallback, parseSnapshot } = require('../scripts/supplement-a-share-turnover');

test('normalizes and validates the persisted A-share turnover snapshot', () => {
  const snapshot = buildSnapshot([
    { date: '2026-09-08', value: 25000 },
    { date: '2026-09-07', value: 24000 },
  ], 'source', 'https://example.com', new Date('2026-09-08T08:00:00Z'));
  assert.equal(snapshot.latestDate, '2026-09-08');
  assert.deepEqual(parseSnapshot(snapshot).items, [
    { date: '2026-09-07', value: 24000 },
    { date: '2026-09-08', value: 25000 },
  ]);
});

test('rejects an empty persisted A-share turnover snapshot', () => {
  assert.throws(() => parseSnapshot({ items: [] }), /快照无可用数据/);
});

test('does not persist an incomplete Eastmoney trading-day candle before the China close', () => {
  const items = [{ date: '2026-09-07', value: 18000 }, { date: '2026-09-08', value: 9000 }];
  assert.deepEqual(completedEastmoneyItems(items, new Date('2026-09-08T04:00:00Z')), [items[0]]);
  assert.deepEqual(completedEastmoneyItems(items, new Date('2026-09-08T08:20:00Z')), items);
});

test('uses the persisted snapshot when the live fallback source is unreachable', async () => {
  const result = await loadTurnoverFallback({
    text: '{}',
    snapshot: {
      sourceName: 'saved source',
      sourceUrl: 'https://example.com',
      items: [{ date: '2026-09-08', value: 25000 }],
    },
  });
  assert.equal(result.fromSnapshot, true);
  assert.equal(result.items[0].value, 25000);
  assert.match(result.sourceName, /快照截至 2026-09-08/);
});
