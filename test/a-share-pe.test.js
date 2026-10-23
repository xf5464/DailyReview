const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const modulePromise = import('../cloudflare/a-share-pe.mjs');

test('A-share PE preserves eight distinct series and separates STAR board from STAR 50', async () => {
  const { A_SHARE_PE_SERIES: series } = await modulePromise;
  assert.equal(series.length, 8);
  assert.equal(new Set(series.map(row => row.id)).size, 8);
  assert.equal(series[0].code, '930050');
  assert.equal(series[4].code, '000985');
  assert.equal(series[6].provider, 'eastmoney');
  assert.equal(series[7].provider, 'csi');
  assert.match(series[6].methodology, /TTM/);
});

test('PE parsing keeps source dates, rejects missing numbers and never borrows another index', async () => {
  const { A_SHARE_PE_SERIES: series, parsePeResponse, peNumber } = await modulePromise;
  for (const value of [null, undefined, '', ' ', '-', NaN, Infinity, 0, -1]) assert.equal(peNumber(value), null);
  const payload = { success: true, data: [
    { indexCode: '930050', tradeDate: '20261022', peg: 15.11 },
    { indexCode: '000300', tradeDate: '20261023', peg: 22 },
    { indexCode: '930050', tradeDate: '20261024', peg: 99 },
    { indexCode: '930050', tradeDate: '20261023', peg: null },
  ] };
  const row = parsePeResponse(series[0], payload, '2026-10-23');
  assert.equal(row.pe, 15.11);
  assert.equal(row.date, '2026-10-22');
  assert.throws(() => parsePeResponse(series[1], { success: true, data: [] }, '2026-10-23'));
  const board = parsePeResponse(series[6], { success: true, result: { data: [
    { TRADE_MARKET_CODE: '000688', TRADE_DATE: '2026-10-23 00:00:00', PE_TTM_AVG: 100.96 },
  ] } }, '2026-10-23');
  assert.equal(board.pe, 100.96);
  assert.equal(board.date, '2026-10-23');
});

test('one failed PE source cannot erase the other seven or change cached quote dates', async () => {
  const { queryASharePe, mergePeRows } = await modulePromise;
  const payload = await queryASharePe({ now: new Date('2026-10-23T12:00:00Z'), fetchImpl: async url => {
    const params = new URL(url).searchParams;
    const code = params.get('indexCode');
    if (code === '932000') throw new Error('source offline');
    return { ok: true, json: async () => code
      ? { success: true, data: [{ indexCode: code, tradeDate: '20261023', peg: 20 }] }
      : { success: true, result: { data: [{ TRADE_MARKET_CODE: params.get('filter').match(/"(\d+)"/)[1],
        TRADE_DATE: '2026-10-22 00:00:00', PE_TTM_AVG: 30 }] } } };
  } });
  assert.equal(payload.rows.length, 8);
  assert.equal(payload.items[0].value, 7);
  const rows = mergePeRows(payload.rows, [{ id: 'csi-932000', pe: 37, date: '2026-10-21' }]);
  assert.equal(rows[3].pe, 37);
  assert.equal(rows[3].date, '2026-10-21');
  assert.equal(rows[3].stale, true);
  assert.match(payload.notice, /非盘中实时/);
});

test('A-share PE UI is visible by default and refreshes live without changing forecast conditions', () => {
  const app = fs.readFileSync(path.join(__dirname, '../site/app.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '../site/index.html'), 'utf8');
  assert.match(app, /group_a_share: \['aSharePe',/);
  assert.match(app, /aSharePe: \['default', 'group_a_share'\]/);
  assert.match(app, /visibleChartIds: \[\s*'usEconomicCalendar',\s*'aSharePe'/);
  assert.match(app, /a-share-pe-api/);
  assert.match(app, /setInterval\(refreshVisiblePe, 60000\)/);
  assert.match(app, /refreshASharePe\(false\)/);
  assert.match(app, /localStorage.setItem\('daily-review.a-share-pe.v1'/);
  assert.match(app, /renderASharePeTable\(refs.detailPeTable, sourceChart\)/);
  assert.match(html, /id="overallDetailPeWrap" hidden/);
});

test('PE table renders eight values, source links and unchanged cached quote dates', async () => {
  const { A_SHARE_PE_SERIES: series } = await modulePromise;
  const app = fs.readFileSync(path.join(__dirname, '../site/app.js'), 'utf8');
  function element(tag, className, textContent) {
    return { tag, textContent, children: [], append(...nodes) { this.children.push(...nodes); },
      replaceChildren() { this.children = []; } };
  }
  const start = app.indexOf('  function renderASharePeTable(');
  const end = app.indexOf('\n  function ', start + 10);
  const render = new Function('createElement', 'hasNumericValue',
    app.slice(start, end) + ';return renderASharePeTable;')(element, value => value != null && Number.isFinite(Number(value)));
  const container = element('div');
  render(container, { rows: series.map((row, index) => ({ ...row,
    pe: index === 0 ? null : 20.45, date: '2026-10-22', stale: index === 1 })) });
  const body = container.children[1].children[1];
  assert.equal(body.children.length, 8);
  assert.equal(container.children[1].children[0].children[0].children.length, 3);
  assert.ok(body.children.every(row => row.children.length === 3));
  assert.equal(body.children[0].children[1].textContent, '--');
  assert.equal(body.children[1].children[1].textContent, '20.45');
  assert.equal(body.children[1].children[2].textContent, '2026-10-22 · 缓存');
  assert.equal(body.children[1].children[0].children[0].href, series[1].sourceUrl);
  assert.equal(body.children[1].children[0].children[0].title, series[1].methodology);
});

test('PE compact layout overrides global table widths and keeps quote dates on one line', () => {
  const css = fs.readFileSync(path.join(__dirname, '../site/styles.css'), 'utf8');
  const rules = css.slice(css.indexOf('.shareholder-table.a-share-pe-table {'));
  assert.match(rules, /min-width: 0;\s*table-layout: fixed;/);
  assert.match(rules, /height: auto;\s*padding: 6px 5px;\s*line-height: 1\.3;/);
  assert.match(rules, /white-space: nowrap;\s*overflow-wrap: normal;/);
  assert.match(rules, /width: 48%/);
  assert.match(rules, /width: 18%/);
  assert.match(rules, /width: 34%/);
});
