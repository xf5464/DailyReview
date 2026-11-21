const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app = fs.readFileSync(require.resolve('../site/app.js'), 'utf8');
const start = app.indexOf('  var filmFinancingPeriods =');
const end = app.indexOf('  function filmFinancingChart()', start);
const context = vm.createContext({
  hasNumericValue: value => value !== null && value !== '' && Number.isFinite(Number(value)),
});
vm.runInContext(app.slice(start, end), context);
const rows = (movies, stocks) => JSON.parse(JSON.stringify(context.filmFinancingRows(movies, stocks)));

test('movie financing uses trading dates, preserves zero, and excludes stocks outside movie list', () => {
  const stocks = { A: [
    {date: '2026-11-12', value: 0}, {date: '2026-11-13', value: 1},
    {date: '2026-11-16', value: 2}, {date: '2026-11-17', value: 1.5},
  ], B: [], OTHER: [{date: '2026-11-17', value: 9}] };
  const result = rows([{code: 'A', name: '电影A'}, {code: 'B', name: '电影B'}], stocks);
  assert.equal(result.length, 1);
  assert.equal(result[0].change1, -0.5);
  assert.equal(result[0].change3, 1.5);
  assert.equal(result[0].change5, null);
});

test('a missing target trading date stays unavailable and stale rows keep their actual date', () => {
  const stocks = {
    A: [{date: '2026-11-12', value: 1}, {date: '2026-11-16', value: 2}],
    B: [{date: '2026-11-13', value: 3}, {date: '2026-11-17', value: 4}],
  };
  const [stock] = rows([{code: 'A', name: '电影A'}], stocks);
  assert.equal(stock.date, '2026-11-16');
  assert.equal(stock.change1, null);
  assert.equal(stock.change3, null);
});

test('all six periods use the balance difference in existing hundred-million-yuan units', () => {
  const dates = Array.from({length: 31}, (_, index) => ({
    date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10), value: index / 10,
  }));
  const [stock] = rows([{code: 'A', name: '电影A'}], {A: dates.reverse()});
  for (const period of [1, 3, 5, 10, 20, 30]) {
    assert.ok(Math.abs(stock['change' + period] - period / 10) < 1e-12);
  }
});

test('column clicks sort numbers in both directions, keep missing values last, and format two decimals', () => {
  class Element {
    constructor(tag, text = '') { this.tag = tag; this.textContent = text; this.children = []; this.events = {}; this.attributes = {}; this.classList = {add() {}}; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(key, callback) { this.events[key] = callback; }
  }
  const container = new Element('div');
  const stocks = [
    {name: '十', code: 'A', date: '2026-11-17'},
    {name: '二', code: 'B', date: '2026-11-16'},
    {name: '缺失', code: 'C', date: '2026-11-17'},
    {name: '负值', code: 'D', date: '2026-11-17'},
  ];
  for (const stock of stocks) {
    for (const days of [1, 3, 5, 10, 20, 30]) {
      stock['change' + days] = {A: 10.125, B: 2.125, C: null, D: -0.002}[stock.code];
    }
  }
  const domContext = vm.createContext({
    createElement: (tag, className, text) => new Element(tag, text),
    document: {createElement: tag => new Element(tag)},
    renderDetail: () => domContext.renderFilmFinancingTable(container, stocks),
  });
  const rendererEnd = app.indexOf("  var shareholderHistoryMode = 'holders';", start);
  vm.runInContext(app.slice(start, rendererEnd), domContext);
  const body = () => container.children[0].children[1].children;
  const headers = () => container.children[0].children[0].children[0].children;
  domContext.renderFilmFinancingTable(container, stocks);
  assert.equal(headers().length, 8);
  assert.deepEqual(body().map(row => row.children[2].textContent), ['+10.13', '+2.13', '0.00', '--']);
  headers()[2].children[0].events.click();
  assert.deepEqual(body().map(row => row.children[2].textContent), ['0.00', '+2.13', '+10.13', '--']);
  for (const index of [3, 4, 5, 6, 7]) {
    headers()[index].children[0].events.click();
    assert.equal(headers()[index].attributes['aria-sort'], 'descending');
    assert.equal(body()[0].children[index].textContent, '+10.13');
    assert.equal(body().at(-1).children[index].textContent, '--');
  }
  const extract = name => {const a=app.indexOf('  function '+name+'(');return app.slice(a,app.indexOf('\n  function ',a+10));};
  domContext.hasNumericValue = value => value != null && value !== '' && Number.isFinite(Number(value));
  vm.runInContext(['shiftMonths','pePercentile','stockMarginPercentile','stockMarginStatistics'].map(extract).join(''), domContext);
  for (const stock of stocks) stock.history = stock.code === 'C' ? [] : [
    {date:'2026-11-10',value:stock.code === 'A' ? 0 : 10},
    {date:'2026-11-17',value:stock.code === 'A' ? 10 : 0},
  ];
  domContext.filmFinancingView = 'percentiles';
  domContext.filmFinancingSortKey = 'rankWeek';
  domContext.filmFinancingSortDirection = 'descending';
  domContext.renderFilmFinancingTable(container, stocks);
  assert.equal(headers()[2].children[0].textContent, '1周 ↓');
  assert.deepEqual(body().map(row => row.children[2].textContent), ['100.0', '0.0', '0.0', '--']);
  headers()[2].children[0].events.click();
  assert.deepEqual(body().map(row => row.children[2].textContent), ['0.0', '0.0', '100.0', '--']);
  stocks[0].inactive = true;
  domContext.renderFilmFinancingTable(container, stocks);
  assert.equal(body().find(row => row.children[0].children[0].textContent === '十').children[2].textContent, '--');
});

test('existing saved configurations gain the A-share entry and normal lazy loading joins movie rows with margin data', async () => {
  const chartIds = vm.runInNewContext(app.match(/var CHART_IDS = (\[[\s\S]*?\]);/)[1]);
  const legacy = {chartOrder: chartIds.filter(id => id !== 'filmFinancing'), visibleChartIds: [],
    groups: [{id: 'group_a_share', name: 'A股'}], selectedGroupId: 'group_a_share', chartGroups: {}};
  const snapshot = JSON.parse(fs.readFileSync(require.resolve('../scripts/data/film-stock-margin.json'), 'utf8'));
  const calls = [];
  const window = {};
  const source = app.replace('  initialize();', `  window.testApi = {
    config: config, loadChartById: loadChartById,
    setData: function (value) { data = value; }
  };`);
  vm.runInNewContext(source, {
    window,
    document: {querySelector: () => ({}), querySelectorAll: () => []},
    localStorage: {getItem: () => JSON.stringify(legacy)},
    fetch: async url => {
      calls.push(url);
      return {ok: true, json: async () => url.includes('film-stock-margin') ? snapshot : {
        id: 'filmCinemaShareholders', items: [], rows: [{code: '600977', name: '中国电影'}, {code: 'NO_DATA', name: '无融资'}],
      }};
    },
  });
  const api = window.testApi;
  assert.ok(api.config.visibleChartIds.includes('filmFinancing'));
  assert.ok(api.config.chartGroups.filmFinancing.includes('group_a_share'));
  assert.ok(api.config.groupChartOrder.group_a_share.includes('filmFinancing'));
  api.setData({charts: [], chartCatalog: [{id: 'filmCinemaShareholders'}], fetchedAt: '2026-11-18'});
  const result = await api.loadChartById('filmFinancing');
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].name, '中国电影');
  const history = snapshot.stocks['600977'];
  assert.equal(result.rows[0].date, history.at(-1).date);
  assert.ok(Math.abs(result.rows[0].change1 - (history.at(-1).value - history.at(-2).value)) < 1e-12);
  assert.equal(calls.length, 2);
  await api.loadChartById('filmFinancing');
  assert.equal(calls.length, 2);
});


test('confirmed removals are historical-only until observations resume after the removal date', () => {
  const stocks = {'000802':[{date:'2021-04-30',value:2.38}], '300027':[{date:'2026-04-29',value:3.36}]};
  const movies = [{code:'000802',name:'北京文化'},{code:'300027',name:'ST华谊'}];
  assert.ok(rows(movies,stocks).every(row => row.inactive));
  stocks['300027'].push({date:'2026-11-20',value:1});
  assert.equal(rows(movies,stocks)[1].inactive,false);
});
