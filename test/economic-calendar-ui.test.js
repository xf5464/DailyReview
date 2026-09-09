const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(projectRoot, 'site', 'app.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(projectRoot, 'site', 'index.html'), 'utf8');

test('US economic calendar is visible and placed first in the primary group', () => {
  assert.match(appSource, /group_primary: \['usEconomicCalendar', 'treasuryYield30'/);
  assert.match(appSource, /usEconomicCalendar: \['default', 'group_primary'\]/);
  assert.match(appSource, /visibleChartIds: \[\s*'usEconomicCalendar'/);
});

test('economic calendar detail exposes four persistent display filters', () => {
  const values = [...htmlSource.matchAll(/name="economicCalendarType" value="([^"]+)"/g)]
    .map((match) => match[1]);
  assert.deepEqual(values, ['cpi', 'pce', 'payrolls', 'fomc']);
  assert.match(appSource, /economicCalendarTypes: economicCalendarTypes/);
  assert.match(appSource, /config\.economicCalendarTypes = refs\.economicCalendarFilters\.filter/);
  assert.match(appSource, /persistConfig\(\);\s*renderCards\(\);\s*renderTable\(\);\s*renderDetail\(\);/);
});

test('economic calendar uses its timeline and list instead of numeric detail controls', () => {
  assert.match(appSource, /renderEconomicCalendarTimeline\(svg, chart\)/);
  assert.match(appSource, /refs\.detailEconomicCalendarWrap\.hidden = !economicCalendarChart/);
  assert.match(appSource, /if \(economicCalendarChart\) \{\s*renderEconomicCalendarDetail\(sourceChart\);\s*return;/);
});
