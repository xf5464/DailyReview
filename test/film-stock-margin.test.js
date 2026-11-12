const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { refreshStockMargin } = require('../scripts/refresh-film-stock-margin');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
test('film stock detail provides financing balance toggle without replacing shareholder chart',()=>{
 const html=read('site/index.html'), app=read('site/app.js');
 assert.match(html,/id="shareholderHistoryMarginButton"/);
 assert.match(html,/id="shareholderHistoryHoldersButton"/);
 assert.ok(app.includes("shareholderHistoryMode = 'margin'"));
 assert.ok(app.includes("shareholderHistoryMode = 'holders'"));
 assert.ok(app.includes("id:'stockMarginBalance'"));
 assert.ok(app.includes("renderLineChart(refs.shareholderChart, marginChart)"));
});
test('film margin is published from the repository snapshot', () => {
  assert.ok(read('site/app.js').includes("fetch('data/film-stock-margin.json')"));
  assert.ok(read('scripts/build.js').includes("publishDataset('filmStockMargin', 'film-stock-margin.json'"));
  assert.ok(read('.github/workflows/refresh-film-stock-margin.yml').includes('git add scripts/data/film-stock-margin.json'));
  assert.doesNotMatch(read('cloudflare/dailyreview-reader.js'), /STOCK_MARGIN_HISTORY|stock-margin-balance-api/);
});

test('stock margin requests an overlap and merges only RZYE by date, preserving failed stock history', async () => {
  const history = [{ date: '2026-09-01', value: 1 }, { date: '2026-11-03', value: 2 }];
  const previous = { schemaVersion: 1, stocks: { '300251': history, '600977': history } };
  const { snapshot, failures } = await refreshStockMargin(previous, ['300251', '600977'], async url => {
    const params = new URL(url).searchParams;
    const filter = params.get('filter');
    assert.equal(params.get('reportName'), 'RPTA_WEB_RZRQ_GGMX');
    assert.equal(params.get('columns'), 'DATE,RZYE');
    assert.match(filter, /\(DATE>='2026-10-22'\)$/);
    if (filter.includes('300251')) return new Response(null, { status: 503 });
    return Response.json({ success: true, result: { pages: 1, data: [
      { DATE: '2026-11-06 00:00:00', RZYE: 300000000, RZRQYE: 999999999 },
      { DATE: '2026-11-05 00:00:00', RZYE: null },
      { DATE: '2026-11-03 00:00:00', RZYE: 250000000 },
    ] } });
  });
  assert.deepEqual(failures.map(failure => failure.code), ['300251']);
  assert.deepEqual(snapshot.stocks['300251'], history);
  assert.deepEqual(snapshot.stocks['600977'], [history[0], { date: '2026-11-03', value: 2.5 }, { date: '2026-11-06', value: 3 }]);
});

test('stock margin leaves an incomplete baseline for retry and accepts explicit no-data results', async () => {
  const codes = ['000892', '600977'];
  const requests = [];
  const { snapshot, failures } = await refreshStockMargin({ stocks: {} }, codes, async url => {
    const params = new URL(url).searchParams;
    const filter = params.get('filter');
    assert.doesNotMatch(filter, /DATE/);
    if (filter.includes('000892')) return Response.json({ success: false, code: 9201 });
    requests.push(params.get('pageNumber'));
    if (params.get('pageNumber') === '2') return Response.json({ success: false, code: 9201 });
    return Response.json({ success: true, result: { pages: 2, data: Array.from({ length: 500 }, () => ({
      DATE: '2026-11-06 00:00:00', RZYE: 300000000,
    })) } });
  });
  assert.deepEqual(requests, ['1', '2']);
  assert.deepEqual(failures.map(failure => failure.code), ['600977']);
  assert.deepEqual(snapshot.stocks, { '000892': [] });
});

test('financing balance chart overlays stock price on independent right axis',()=>{
 const app=read('site/app.js');
 assert.ok(app.includes("id:'stockMarginBalance'"));
 assert.ok(app.includes('rightAxisItems: stock.priceItems || []'));
 assert.ok(app.includes("rightAxisName: '股价', rightAxisUnit: '元'"));
 assert.ok(app.includes("rightAxisName: '股价', rightAxisUnit: '元'"));
 assert.ok(app.includes("refs.shareholderMessage.textContent = latestSummary"));
});

test('financing summary remains visible above chart without hover',()=>{
 const html=read('site/index.html'), app=read('site/app.js'), css=read('site/styles.css');
 for(const id of ['shareholderMarginLatest','shareholderMarginLatestDate','shareholderMarginLatestBalance','shareholderMarginLatestPrice']) assert.ok(html.includes('id="'+id+'"'));
 assert.ok(app.includes("refs.shareholderMarginLatest.hidden = shareholderHistoryMode !== 'margin'"));
 assert.ok(app.includes('refs.shareholderMarginLatestDate.textContent = latestMargin.date'));
 assert.ok(app.includes('refs.shareholderMarginLatestBalance.textContent'));
 assert.ok(app.includes('refs.shareholderMarginLatestPrice.textContent'));
 assert.ok(css.includes('.shareholder-margin-latest:not([hidden])'));
});
