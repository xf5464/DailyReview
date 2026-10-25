const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../site/app.js'), 'utf8');
const extract = name => { const start = source.indexOf('  function ' + name + '('); return source.slice(start, source.indexOf('\n  function ', start + 10)); };
const rank = new Function('hasNumericValue', extract('shiftMonths') + extract('pePercentile') + ';return pePercentile;')(
  value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)));
test('PE percentile uses a trailing calendar-year window and midrank ties', () => {
  const items = [{date:'2020-10-23',value:1},{date:'2023-10-23',value:10},{date:'2024-10-23',value:20},
    {date:'2025-10-23',value:20},{date:'2026-10-23',value:30},{date:'2026-10-24',value:100}];
  assert.equal(rank(items,20,'2026-10-23',3).value,50);
  assert.equal(rank(items,30,'2026-10-23',1).count,2);
  assert.equal(rank(items,0.1,'2026-10-23',3).value,0);
  assert.equal(rank(items,100,'2026-10-23',3).value,100);
  assert.equal(rank(items,null,'2026-10-23',3),null);
  assert.equal(rank([],20,'2026-10-23',3),null);
});
test('short history and missing values are handled without padding samples', () => {
  const result = rank([{date:'2026-01-01',value:null},{date:'2026-03-01',value:10},{date:'2026-10-23',value:10}],10,'2026-10-23',3);
  assert.equal(result.short,true);
  assert.equal(result.count,2);
  assert.equal(result.value,50);
  assert.match(source,/refs.pePercentileYears.value = '3'/);
  assert.match(source,/refs.pePercentileYears.addEventListener\('change', renderPeHistory\)/);
});
