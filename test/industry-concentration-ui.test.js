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


test('industry concentration uses persistent history and a recent incremental window',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const macro=fs.readFileSync(path.join(__dirname,'../scripts/macro-outlook.js'),'utf8');
 const build=fs.readFileSync(path.join(__dirname,'../scripts/build.js'),'utf8');
 const workflow=fs.readFileSync(path.join(__dirname,'../.github/workflows/deploy-pages.yml'),'utf8');
 assert.ok(macro.includes('industryIncrementalStart'));
 assert.ok(macro.includes('industryHistoryCache.industryHistories.find'));
 assert.ok(macro.includes('dataFallback: true'));
 assert.ok(build.includes("'.cache', 'a-share-industry-concentration.json'"));
 assert.ok(workflow.includes('actions/cache/restore@v4'));
 assert.ok(workflow.includes('actions/cache/save@v4'));
});
