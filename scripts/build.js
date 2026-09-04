const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const { queryMacroOutlook } = require('./macro-outlook');

const projectRoot = path.resolve(__dirname, '..');
const siteDirectory = path.join(projectRoot, 'site');
const outputDirectory = path.join(projectRoot, 'dist');
const dataDirectory = path.join(outputDirectory, 'data');
const chartDataDirectory = path.join(dataDirectory, 'charts');
const offlineDataDirectory = path.join(dataDirectory, 'offline');

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

  const cardRangeSource = "    var chart = filteredChart(source, refs.range.value);";
  const cardRangeReplacement = [
    "    var cardRangeKey = chartId === 'silver' && refs.range.value === 'month3' ? 'year1' : refs.range.value;",
    '    var chart = filteredChart(source, cardRangeKey);',
  ].join('\n');
  if (!source.includes(cardRangeSource)) {
    throw new Error('Unable to apply silver card range override: createCard pattern changed.');
  }
  source = source.replace(cardRangeSource, cardRangeReplacement);

  const axisLabelSource = "        label.textContent = formatDate(item.date, chart.frequency);";
  const axisLabelReplacement = [
    "        if (!isDetailChart && chart.id === 'silver' && chart.frequency && chart.frequency.includes('月')) {",
    "          var itemDate = new Date(item.date + 'T00:00:00Z');",
    '          var firstLabelDate = new Date(items[xIndexes[0]].date + \'T00:00:00Z\');',
    '          var lastLabelDate = new Date(items[xIndexes[xIndexes.length - 1]].date + \'T00:00:00Z\');',
    '          var previousLabelDate = labelIndex > 0',
    "            ? new Date(items[xIndexes[labelIndex - 1]].date + 'T00:00:00Z')",
    '            : null;',
    '          var spansYears = firstLabelDate.getUTCFullYear() !== lastLabelDate.getUTCFullYear();',
    '          var showYear = spansYears && (labelIndex === 0 ||',
    '            !previousLabelDate || itemDate.getUTCFullYear() !== previousLabelDate.getUTCFullYear());',
    "          label.textContent = (showYear ? itemDate.getUTCFullYear() + '年' : '') +",
    "            (itemDate.getUTCMonth() + 1) + '月';",
    '        } else {',
    '          label.textContent = formatDate(item.date, chart.frequency);',
    '        }',
  ].join('\n');
  if (!source.includes(axisLabelSource)) {
    throw new Error('Unable to apply compact silver axis labels: renderLineChart pattern changed.');
  }
  source = source.replace(axisLabelSource, axisLabelReplacement);

  fs.writeFileSync(appPath, source, 'utf8');
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
