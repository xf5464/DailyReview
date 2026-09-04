const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const { queryMacroOutlook } = require('./macro-outlook');
const { pruneArchiveFile } = require('./hot-news-archive');

const projectRoot = path.resolve(__dirname, '..');
const siteDirectory = path.join(projectRoot, 'site');
const outputDirectory = path.join(projectRoot, 'dist');
const dataDirectory = path.join(outputDirectory, 'data');
const chartDataDirectory = path.join(dataDirectory, 'charts');
const offlineDataDirectory = path.join(dataDirectory, 'offline');

// 总览页小图的统一观察期配置。季度图按季度数，其余普通时间序列小图按月数。
// 新增图表时自动沿用，不允许单图按 ID 写死观察期。
const overviewMiniChartPeriods = {
  monthly: 12,
  quarterly: 12,
};

function contentHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value) + '\n', 'utf8');
}

function applyChartPresentationOverrides() {
  const appPath = path.join(outputDirectory, 'app.js');
  let source = fs.readFileSync(appPath, 'utf8');

  const rangesAnchor = '  var RANGES = {';
  const rangesReplacement = [
    '  var OVERVIEW_MINI_CHART_PERIODS = {',
    `    monthly: ${overviewMiniChartPeriods.monthly},`,
    `    quarterly: ${overviewMiniChartPeriods.quarterly}`,
    '  };',
    '',
    rangesAnchor,
  ].join('\n');
  if (!source.includes(rangesAnchor)) {
    throw new Error('Unable to inject overview mini chart period config: RANGES pattern changed.');
  }
  source = source.replace(rangesAnchor, rangesReplacement);

  const cardRangeSource = "    var chart = filteredChart(source, refs.range.value);";
  const cardRangeReplacement = [
    '    var chart = source ? Object.assign({}, source) : null;',
    "    var cardFrequency = chart && chart.frequency || '';",
    "    var fixedPeriodCard = chart && chart.chartType !== 'stockTable' && chart.chartType !== 'wideEtfTable';",
    "    if (fixedPeriodCard && cardFrequency.includes('季')) {",
    '      chart.items = (source.items || []).slice(-OVERVIEW_MINI_CHART_PERIODS.quarterly);',
    '    } else if (fixedPeriodCard) {',
    '      var cardItems = (source.items || []).filter(function (item) { return item && item.date; })',
    '        .slice().sort(function (left, right) { return left.date.localeCompare(right.date); });',
    '      if (cardItems.length) {',
    "        var cardLatest = new Date(cardItems[cardItems.length - 1].date + 'T00:00:00Z');",
    '        var cardStart = shiftMonths(cardLatest, -OVERVIEW_MINI_CHART_PERIODS.monthly);',
    '        var cardStartText = cardStart.toISOString().slice(0, 10);',
    '        chart.items = cardItems.filter(function (item) { return item.date >= cardStartText; });',
    '      } else {',
    '        chart.items = [];',
    '      }',
    '    } else {',
    '      chart = filteredChart(source, refs.range.value);',
    '    }',
  ].join('\n');
  if (!source.includes(cardRangeSource)) {
    throw new Error('Unable to apply overview mini chart period rules: createCard pattern changed.');
  }
  source = source.replace(cardRangeSource, cardRangeReplacement);

  const axisLabelSource = "        label.textContent = formatDate(item.date, chart.frequency);";
  const axisLabelReplacement = [
    "        var compactQuarterlyAxis = !isDetailChart && chart.frequency && chart.frequency.includes('季');",
    '        var compactMonthlyAxis = !isDetailChart && !compactQuarterlyAxis;',
    '        if (compactMonthlyAxis || compactQuarterlyAxis) {',
    "          var itemDate = new Date(item.date + 'T00:00:00Z');",
    "          var firstLabelDate = new Date(items[xIndexes[0]].date + 'T00:00:00Z');",
    "          var lastLabelDate = new Date(items[xIndexes[xIndexes.length - 1]].date + 'T00:00:00Z');",
    '          var previousLabelDate = labelIndex > 0',
    "            ? new Date(items[xIndexes[labelIndex - 1]].date + 'T00:00:00Z')",
    '            : null;',
    '          var spansYears = firstLabelDate.getUTCFullYear() !== lastLabelDate.getUTCFullYear();',
    '          var showYear = spansYears && (labelIndex === 0 ||',
    '            !previousLabelDate || itemDate.getUTCFullYear() !== previousLabelDate.getUTCFullYear());',
    '          var compactPeriod = compactQuarterlyAxis',
    "            ? 'Q' + (Math.floor(itemDate.getUTCMonth() / 3) + 1)",
    "            : (itemDate.getUTCMonth() + 1) + '月';",
    "          label.textContent = (showYear ? itemDate.getUTCFullYear() + '年' : '') + compactPeriod;",
    '        } else {',
    '          label.textContent = formatDate(item.date, chart.frequency);',
    '        }',
  ].join('\n');
  if (!source.includes(axisLabelSource)) {
    throw new Error('Unable to apply compact overview axis labels: renderLineChart pattern changed.');
  }
  source = source.replace(axisLabelSource, axisLabelReplacement);

  const marketCapFormatterSource = [
    '  function formatMarketCap(value) {',
    '    return hasNumericValue(value)',
    "      ? new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(Number(value)) + ' 亿元'",
    "      : '--';",
    '  }',
  ].join('\n');
  const marketCapFormatterReplacement = [
    marketCapFormatterSource,
    '',
    '  function formatWideEtfMarketCap(value) {',
    '    return hasNumericValue(value)',
    "      ? new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(Number(value)) + ' 亿元'",
    "      : '--';",
    '  }',
    '',
    '  function formatCinemaMarketCap(value) {',
    '    return hasNumericValue(value)',
    "      ? new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(Number(value)) + ' 亿元'",
    "      : '--';",
    '  }',
  ].join('\n');
  if (!source.includes(marketCapFormatterSource)) {
    throw new Error('Unable to add integer holdings formatters: formatMarketCap pattern changed.');
  }
  source = source.replace(marketCapFormatterSource, marketCapFormatterReplacement);
  source = source.replace("formatMarketCap(entry.item.value)", "formatWideEtfMarketCap(entry.item.value)");
  source = source.replace("' · 宽基合计 ' + formatMarketCap(latest.value)", "' · 宽基合计 ' + formatWideEtfMarketCap(latest.value)");
  source = source.replace("totalItem ? formatMarketCap(totalItem.value) : '--'", "totalItem ? formatWideEtfMarketCap(totalItem.value) : '--'");

  const holderCountSource = [
    '  function formatHolderCount(value) {',
    '    return hasNumericValue(value)',
    "      ? new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(Number(value)) + ' 户'",
    "      : '--';",
    '  }',
  ].join('\n');
  const holderCountReplacement = [
    holderCountSource,
    '',
    '  function formatHolderCountNumber(value) {',
    '    return hasNumericValue(value)',
    "      ? new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(Number(value))",
    "      : '--';",
    '  }',
  ].join('\n');
  if (!source.includes(holderCountSource)) {
    throw new Error('Unable to add unitless cinema holder formatter: formatHolderCount pattern changed.');
  }
  source = source.replace(holderCountSource, holderCountReplacement);

  const holderChangeSource = [
    '  function formatHolderChange(value) {',
    "    if (!Number.isFinite(Number(value))) return '--';",
    '    var numericValue = Number(value);',
    "    return (numericValue > 0 ? '+' : '') + new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(numericValue) + ' 户';",
    '  }',
  ].join('\n');
  const holderChangeReplacement = [
    holderChangeSource,
    '',
    '  function formatHolderChangeNumber(value) {',
    "    if (!Number.isFinite(Number(value))) return '--';",
    '    var numericValue = Number(value);',
    "    return (numericValue > 0 ? '+' : '') + new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(numericValue);",
    '  }',
  ].join('\n');
  if (!source.includes(holderChangeSource)) {
    throw new Error('Unable to add unitless cinema change formatter: formatHolderChange pattern changed.');
  }
  source = source.replace(holderChangeSource, holderChangeReplacement);

  source = source.replace(
    "row.append(createElement('td', stock.error || !hasNumericValue(stock.latestValue) ? 'shareholder-value-missing' : '', formatHolderCount(stock.latestValue)));",
    "row.append(createElement('td', stock.error || !hasNumericValue(stock.latestValue) ? 'shareholder-value-missing' : '', interactive ? formatHolderCountNumber(stock.latestValue) : formatHolderCount(stock.latestValue)));"
  );
  source = source.replace(
    "var changeCell = createElement('td', changeClass, formatHolderChange(change.value));",
    "var changeCell = createElement('td', changeClass, formatHolderChangeNumber(change.value));"
  );
  source = source.replace(
    "row.append(createElement('td', hasNumericValue(stock.marketCap) ? '' : 'shareholder-value-missing', formatMarketCap(stock.marketCap)));",
    "row.append(createElement('td', hasNumericValue(stock.marketCap) ? '' : 'shareholder-value-missing', formatCinemaMarketCap(stock.marketCap)));"
  );

  source = source.replace(
    "      if (!compact) tr.append(createElement('td', 'number-cell', entry.item.priceDate || '--'));",
    ''
  );
  source = source.replace(
    '      emptyCell.colSpan = compact ? 2 : 4;',
    '      emptyCell.colSpan = compact ? 2 : 3;'
  );

  fs.writeFileSync(appPath, source, 'utf8');

  const stylesPath = path.join(outputDirectory, 'styles.css');
  const styles = fs.readFileSync(stylesPath, 'utf8');
  const responsiveCinemaTableRules = [
    '',
    '/* 影视院线总览卡：三列等分，不允许产生横向滚动。 */',
    '.shareholder-card-table-wrap {',
    '  overflow-x: hidden;',
    '  overflow-y: auto;',
    '}',
    '',
    '.shareholder-card-table-wrap .shareholder-table {',
    '  width: 100%;',
    '  min-width: 0;',
    '  table-layout: fixed;',
    '}',
    '',
    '.shareholder-card-table-wrap .shareholder-table th,',
    '.shareholder-card-table-wrap .shareholder-table td {',
    '  width: 33.333333%;',
    '  padding-left: 6px;',
    '  padding-right: 6px;',
    '  white-space: normal;',
    '  overflow-wrap: anywhere;',
    '}',
    '',
    '/* 国家队持仓详情：三列等宽，禁止横向滚动。 */',
    '.wide-etf-detail-wrap {',
    '  overflow-x: hidden;',
    '  overflow-y: auto;',
    '}',
    '',
    '.wide-etf-detail-wrap .wide-etf-table {',
    '  width: 100%;',
    '  min-width: 0;',
    '  table-layout: fixed;',
    '}',
    '',
    '.wide-etf-detail-wrap .wide-etf-table th,',
    '.wide-etf-detail-wrap .wide-etf-table td {',
    '  width: 33.333333%;',
    '  padding-left: 8px;',
    '  padding-right: 8px;',
    '  white-space: normal;',
    '  overflow-wrap: anywhere;',
    '  text-align: center;',
    '}',
    '',
    '/* 详情页同类操作区：优先等宽、左右边界对齐；窄控件放在等宽网格中居中。 */',
    '.shareholder-table-quarter-browser {',
    '  display: grid;',
    '  grid-template-columns: repeat(4, minmax(0, 1fr));',
    '  align-items: end;',
    '  justify-content: stretch;',
    '  gap: 12px;',
    '}',
    '',
    '.shareholder-table-quarter-browser > *,',
    '.shareholder-table-quarter-browser > label {',
    '  width: 100%;',
    '  min-width: 0;',
    '  justify-self: center;',
    '}',
    '',
    '.shareholder-table-quarter-browser > label {',
    '  display: grid;',
    '  align-content: end;',
    '}',
    '',
    '.shareholder-table-quarter-browser > label .level-select,',
    '.shareholder-table-quarter-browser > .secondary-button,',
    '.shareholder-table-quarter-browser > .primary-button {',
    '  width: 100%;',
    '  height: 34px;',
    '  min-height: 34px;',
    '  min-width: 0;',
    '  white-space: nowrap;',
    '}',
    '',
    '.overall-compare-controls,',
    '.shareholder-bars-controls {',
    '  display: grid;',
    '  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));',
    '  align-items: end;',
    '  justify-content: stretch;',
    '}',
    '',
    '.overall-compare-controls > label,',
    '.shareholder-bars-controls > label,',
    '.overall-compare-controls > .secondary-button,',
    '.overall-compare-controls > .primary-button,',
    '.shareholder-bars-controls > .secondary-button,',
    '.shareholder-bars-controls > .primary-button {',
    '  width: 100%;',
    '  min-width: 0;',
    '  justify-self: center;',
    '}',
    '',
    '.overall-compare-controls > label .level-select,',
    '.shareholder-bars-controls > label .level-select {',
    '  width: 100%;',
    '  min-width: 0;',
    '}',
    '',
    '@media (max-width: 680px) {',
    '  .shareholder-table-quarter-browser {',
    '    grid-template-columns: repeat(2, minmax(0, 1fr));',
    '  }',
    '}',
    '',
  ].join('\n');
  fs.writeFileSync(stylesPath, styles + responsiveCinemaTableRules, 'utf8');

  const indexPath = path.join(outputDirectory, 'index.html');
  let indexSource = fs.readFileSync(indexPath, 'utf8');
  const wideEtfHeaderSource = '<thead><tr><th>宽基指数</th><th>ETF 数量</th><th>持仓总市值</th><th>行情日期</th></tr></thead>';
  const wideEtfHeaderReplacement = '<thead><tr><th>宽基指数</th><th>ETF 数量</th><th>持仓总市值</th></tr></thead>';
  if (!indexSource.includes(wideEtfHeaderSource)) {
    throw new Error('Unable to simplify national-team detail header: index pattern changed.');
  }
  indexSource = indexSource.replace(wideEtfHeaderSource, wideEtfHeaderReplacement);
  fs.writeFileSync(indexPath, indexSource, 'utf8');
}

function addAssetVersions() {
  const indexPath = path.join(outputDirectory, 'index.html');
  const versionFor = (fileName) => crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(outputDirectory, fileName)))
    .digest('hex')
    .slice(0, 12);
  const appVersion = versionFor('app.js');
  const stylesVersion = versionFor('styles.css');
  const shellVersion = contentHash([
    'index.html', 'styles.css', 'app.js', 'service-worker.js', 'manifest.webmanifest', 'icon.svg',
  ].map((fileName) => fs.readFileSync(path.join(outputDirectory, fileName))).join('\n'));
  const html = fs.readFileSync(indexPath, 'utf8')
    .replace('href="styles.css"', `href="styles.css?v=${stylesVersion}"`)
    .replace('src="app.js"', `src="app.js?v=${appVersion}"`)
    .replace('__APP_VERSION__', shellVersion);
  fs.writeFileSync(indexPath, html, 'utf8');
  const workerPath = path.join(outputDirectory, 'service-worker.js');
  const worker = fs.readFileSync(workerPath, 'utf8').replace('__APP_VERSION__', shellVersion);
  fs.writeFileSync(workerPath, worker, 'utf8');
  writeJson(path.join(outputDirectory, 'app-version.json'), {
    version: shellVersion,
    publishedAt: new Date().toISOString(),
  });
}

async function build() {
  pruneArchiveFile(path.join(siteDirectory, 'reader', 'data', 'recent.json'));
  fs.rmSync(outputDirectory, { recursive: true, force: true });
  fs.cpSync(siteDirectory, outputDirectory, { recursive: true });
  applyChartPresentationOverrides();
  addAssetVersions();
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.mkdirSync(chartDataDirectory, { recursive: true });
  fs.mkdirSync(offlineDataDirectory, { recursive: true });
  fs.writeFileSync(path.join(outputDirectory, '.nojekyll'), '');

  process.stdout.write('Fetching the 30-year macro dataset...\n');
  const outlook = await queryMacroOutlook({ range: 'year30' });
  outlook.charts.forEach((chart) => {
    if (chart.id === 'nationalTeamWideEtf') chart.decimals = 0;
  });
  const usableCharts = outlook.charts.filter((chart) => chart.items.length > 0);
  if (usableCharts.length === 0) {
    throw new Error('No macro chart returned usable data; refusing to publish an empty site.');
  }

  const offlineCharts = outlook.charts.map((chart) => {
    writeJson(path.join(chartDataDirectory, `${chart.id}.json`), chart);
    const chunksByYear = new Map();
    chart.items.forEach((item) => {
      const year = /^\d{4}/.test(item.date || '') ? item.date.slice(0, 4) : 'undated';
      if (!chunksByYear.has(year)) chunksByYear.set(year, []);
      chunksByYear.get(year).push(item);
    });
    const chunks = [...chunksByYear.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([year, items]) => {
      const content = JSON.stringify(items) + '\n';
      const hash = contentHash(content);
      const relativePath = `offline/${chart.id}/items-${year}.${hash}.json`;
      fs.mkdirSync(path.dirname(path.join(dataDirectory, relativePath)), { recursive: true });
      fs.writeFileSync(path.join(dataDirectory, relativePath), content, 'utf8');
      return { year, path: `data/${relativePath}`, hash, bytes: Buffer.byteLength(content) };
    });
    const { items, ...extras } = chart;
    const extrasContent = JSON.stringify(extras) + '\n';
    const extrasHash = contentHash(extrasContent);
    const extrasRelativePath = `offline/${chart.id}/extras.${extrasHash}.json`;
    fs.mkdirSync(path.dirname(path.join(dataDirectory, extrasRelativePath)), { recursive: true });
    fs.writeFileSync(path.join(dataDirectory, extrasRelativePath), extrasContent, 'utf8');
    return {
      id: chart.id,
      signature: contentHash(extrasContent + chunks.map((chunk) => chunk.hash).join(':')),
      extras: { path: `data/${extrasRelativePath}`, hash: extrasHash, bytes: Buffer.byteLength(extrasContent) },
      chunks,
    };
  });
  const payload = {
    ...outlook,
    charts: outlook.charts.map((chart) => {
      const { items, rows, ...metadata } = chart;
      return { ...metadata, itemCount: items.length };
    }),
    generatedBy: 'DailyReview GitHub Pages build',
  };
  fs.writeFileSync(
    path.join(dataDirectory, 'outlook.json'),
    JSON.stringify(payload) + '\n',
    'utf8',
  );
  writeJson(path.join(dataDirectory, 'offline-manifest.json'), {
    schemaVersion: 1,
    fetchedAt: outlook.fetchedAt,
    charts: offlineCharts,
  });

  const failedCharts = outlook.charts.filter((chart) => chart.error && chart.items.length === 0);
  process.stdout.write(
    'Built ' + usableCharts.length + '/' + outlook.charts.length + ' charts' +
    (failedCharts.length ? ' (' + failedCharts.length + ' source failures)' : '') + '.\n',
  );
  failedCharts.forEach((chart) => {
    process.stdout.write('- ' + chart.title + ': ' + chart.error + '\n');
  });
}

build().catch((error) => {
  process.stderr.write((error.stack || error.message) + '\n');
  process.exitCode = 1;
});