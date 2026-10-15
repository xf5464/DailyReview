const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'site', 'app.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'site', 'index.html'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'site', 'styles.css'), 'utf8');
const workerSource = fs.readFileSync(path.join(root, 'cloudflare', 'dailyreview-reader.js'), 'utf8');

test('main header opens a dedicated global market overview', () => {
  assert.match(htmlSource, /id="marketOverviewButton"[^>]*>全球市场</);
  assert.match(htmlSource, /id="marketOverviewDialog"/);
  assert.match(htmlSource, /id="marketSessionTimeline"/);
  assert.match(htmlSource, /id="marketOverviewGroups"/);
  assert.match(appSource, /refs\.marketOverviewButton\.addEventListener\('click', showMarketOverview\)/);
  assert.match(htmlSource, /id="marketOverviewCloseButton"[^>]*autofocus/);
  assert.match(appSource, /refs\.marketOverviewDialog\.showModal\(\);\s*refs\.marketOverviewClose\.focus\(\{ preventScroll: true \}\)/);
});

test('market overview refreshes only while it is open and retains a local fallback', () => {
  assert.match(appSource, /MARKET_REFRESH_INTERVAL = 60000/);
  assert.match(appSource, /daily-review\.market-overview-cache\.v1/);
  assert.match(appSource, /setInterval\([\s\S]*refs\.marketOverviewDialog\.open/);
  assert.match(appSource, /refs\.marketOverviewDialog\.addEventListener\('close', stopMarketRefresh\)/);
  assert.match(appSource, /marketRequestController\.abort\(\)/);
  assert.match(appSource, /联网刷新失败，显示上次缓存/);
});

test('market overview is mobile responsive and uses mainland market colors', () => {
  assert.match(cssSource, /\.market-card-grid\s*\{[\s\S]*repeat\(var\(--market-columns, 4\)/);
  assert.match(htmlSource, /id="marketOverviewColumnsSelect"[\s\S]*value="4" selected/);
  assert.match(appSource, /MARKET_COLUMNS_KEY = 'daily-review\.market-overview-columns\.v1'/);
  assert.match(appSource, /applyMarketColumns\(localStorage\.getItem\(MARKET_COLUMNS_KEY\), false\)/);
  assert.match(cssSource, /\.market-overview-dialog\[data-columns="4"\]\s*\{ --market-columns: 4; \}/);
  assert.match(cssSource, /\.market-change\.up[\s\S]*#ef3f46/);
  assert.match(cssSource, /\.market-change\.down[\s\S]*#25d345/);
});

test('reader worker provides cached free market data with per-item fallback', () => {
  assert.match(workerSource, /url\.pathname === "\/market-api"/);
  assert.match(workerSource, /query2\.finance\.yahoo\.com/);
  assert.match(workerSource, /MARKET_CACHE_SECONDS = 60/);
  assert.match(workerSource, /Promise\.allSettled\(MARKET_INSTRUMENTS\.map\(fetchMarketInstrument\)\)/);
  assert.match(workerSource, /staleById\.get\(instrument\.id\)/);
  assert.doesNotMatch(workerSource, /marketwatch\.com/i);
});

test('session timeline uses Asia Shanghai and DST-aware overseas zones', () => {
  assert.match(appSource, /Asia\/Shanghai/);
  assert.match(appSource, /Europe\/Paris/);
  assert.match(appSource, /America\/New_York/);
  assert.match(appSource, /Intl\.DateTimeFormat/);
});
