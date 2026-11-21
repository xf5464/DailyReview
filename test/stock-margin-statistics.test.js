const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseStockMarketCap, fetchStockMarketCap } = require('../scripts/stock-market-cap');
const source = fs.readFileSync(path.join(__dirname, '../site/app.js'), 'utf8');
const extract = name => { const start = source.indexOf('  function ' + name + '('); return source.slice(start, source.indexOf('\n  function ', start + 10)); };
const stats = new Function('hasNumericValue', extract('shiftMonths') + extract('pePercentile') + extract('stockMarginStatistics') + ';return stockMarginStatistics;')(
  value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)));
function quote(total = '287.70') {
  const fields = Array(50).fill('');
  fields[2] = '600977'; fields[30] = '20261120161459'; fields[44] = '123.45'; fields[45] = total;
  return 'v_sh600977="' + fields.join('~') + '";';
}
test('total market cap uses total rather than circulating shares and preserves quote date', async () => {
  const parsed = parseStockMarketCap(quote(), '600977');
  assert.equal(parsed.totalMarketCap, 287.7);
  assert.equal(parsed.marketCapDate, '2026-11-20');
  assert.throws(() => parseStockMarketCap(quote(), '300251'));
  assert.throws(() => parseStockMarketCap(quote('0'), '600977'));
  assert.throws(() => parseStockMarketCap(quote(''), '600977'));
  assert.throws(() => parseStockMarketCap(quote('NaN'), '600977'));
  const fetched = await fetchStockMarketCap('600977', async url => {
    assert.equal(url, 'https://qt.gtimg.cn/q=sh600977');
    return new Response(quote());
  });
  assert.deepEqual(fetched, parsed);
});
test('ratio uses the same hundred-million unit and missing cap stays unavailable', () => {
  const items = [{date:'2026-11-20', value:3.57}];
  assert.ok(Math.abs(stats(items, {totalMarketCap:287.7}).ratio - 1.2408759124) < 1e-8);
  for (const totalMarketCap of [null, '', 0, -1]) assert.equal(stats(items, {totalMarketCap}).ratio, null);
  assert.equal(stats([], {totalMarketCap:287.7}).ratio, null);
});
test('calendar windows rank latest balance with ties, zero and short-history disclosure', () => {
  const result = stats([
    {date:'2026-11-20', value:2}, {date:'2025-11-20', value:0},
    {date:'2024-11-20', value:1}, {date:'2026-01-01', value:2},
    {date:'2022-11-20', value:99}, {date:'2026-06-01', value:null},
    {date:'2026-08-01', value:-1}, {date:'2026-01-01', value:2},
  ], {});
  assert.equal(result.rank1.count, 3);
  assert.ok(Math.abs(result.rank1.value - 200 / 3) < 1e-10);
  assert.equal(result.rank3.count, 4);
  assert.equal(result.rank3.value, 75);
  assert.equal(result.rank3.short, false);
  const short = stats([{date:'2026-11-20', value:2}], {});
  assert.equal(short.rank1.value, 50);
  assert.equal(short.rank3.short, true);
});
