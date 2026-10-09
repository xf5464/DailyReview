const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'site', 'app.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'site', 'index.html'), 'utf8');

test('A-share industry concentration is in the default A-share group', () => {
  assert.match(appSource, /group_a_share:\s*\[[^\]]*'aShareIndustryConcentration'/);
  assert.match(appSource, /aShareIndustryConcentration:\s*\['default', 'group_a_share'\]/);
});

test('industry concentration detail shows C5, HHI and top-five rows', () => {
  assert.match(htmlSource, /id="overallDetailIndustryConcentrationWrap"/);
  assert.match(htmlSource, /id="industryConcentrationC5"/);
  assert.match(htmlSource, /id="industryConcentrationHhi"/);
  assert.match(htmlSource, /id="industryConcentrationTableBody"/);
  assert.match(appSource, /renderIndustryConcentrationDetail\(latestItem\)/);
  assert.match(appSource, /item\.topIndustries/);
});

test('clicking an industry opens a one-year turnover and index chart', () => {
  assert.match(htmlSource, /id="industryHistoryDialog"/);
  assert.match(htmlSource, /id="industryHistoryRangeSelect"/);
  assert.match(htmlSource, /id="industryHistoryChart"/);
  assert.match(appSource, /showIndustryHistory\(row\.code\)/);
  assert.match(appSource, /refs\.industryHistoryRange\.value = 'year1'/);
  assert.match(appSource, /rightAxisLabel: '行业指数（点）'/);
  assert.match(appSource, /紫线为成交额，橙线为行业指数/);
});

