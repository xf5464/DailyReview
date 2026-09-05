const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const distDirectory = path.join(projectRoot, 'dist');
const chartPath = path.join(distDirectory, 'data', 'charts', 'ismNewOrders.json');
const outlookPath = path.join(distDirectory, 'data', 'outlook.json');
const manifestPath = path.join(distDirectory, 'data', 'offline-manifest.json');

const SERIES_ID = 'NAPMNOI';
const HISTORY_YEARS = 30;
const REQUEST_TIMEOUT_MS = 20_000;

// FRED-MD removed the ISM series beginning with the 2016-06 vintage.  Use a
// pinned copy of the official 2015-04 FRED-MD vintage for the older history,
// then bridge 2015-04 through 2020-12 with the contemporaneously published ISM
// new-orders readings.  The normal DailyReview build already supplies
// DBnomics 2021-2025 plus the latest official ISM monthly snapshot.
const LEGACY_FRED_MD_URL = 'https://raw.githubusercontent.com/xinaut/SOFARI/d3d235826925e1197f2165e7f9cbf41ad6bc378a/real%20data/economic/2015-04.csv';
const LEGACY_FRED_MD_PAGE_URL = 'https://github.com/xinaut/SOFARI/blob/d3d235826925e1197f2165e7f9cbf41ad6bc378a/real%20data/economic/2015-04.csv';
const FRED_MD_DOCUMENTATION_URL = 'https://www.stlouisfed.org/research/economists/mccracken/fred-databases';

const HISTORICAL_BRIDGE_ITEMS = Object.freeze([
  ['2015-04-01', 53.5], ['2015-05-01', 55.8], ['2015-06-01', 56.0], ['2015-07-01', 56.5],
  ['2015-08-01', 51.7], ['2015-09-01', 50.1], ['2015-10-01', 52.9], ['2015-11-01', 48.9],
  ['2015-12-01', 49.2],
  ['2016-01-01', 51.5], ['2016-02-01', 51.5], ['2016-03-01', 58.3], ['2016-04-01', 55.8],
  ['2016-05-01', 55.7], ['2016-06-01', 57.0], ['2016-07-01', 56.9], ['2016-08-01', 49.1],
  ['2016-09-01', 55.1], ['2016-10-01', 52.1], ['2016-11-01', 53.0], ['2016-12-01', 60.2],
  ['2017-01-01', 60.4], ['2017-02-01', 65.1], ['2017-03-01', 64.5], ['2017-04-01', 57.5],
  ['2017-05-01', 59.5], ['2017-06-01', 63.5], ['2017-07-01', 60.4], ['2017-08-01', 60.3],
  ['2017-09-01', 64.6], ['2017-10-01', 63.4], ['2017-11-01', 64.0], ['2017-12-01', 69.4],
  ['2018-01-01', 65.4], ['2018-02-01', 64.2], ['2018-03-01', 61.9], ['2018-04-01', 61.2],
  ['2018-05-01', 63.7], ['2018-06-01', 63.5], ['2018-07-01', 60.2], ['2018-08-01', 65.1],
  ['2018-09-01', 61.8], ['2018-10-01', 57.4], ['2018-11-01', 62.1], ['2018-12-01', 51.1],
  ['2019-01-01', 58.2], ['2019-02-01', 55.5], ['2019-03-01', 57.4], ['2019-04-01', 51.7],
  ['2019-05-01', 52.7], ['2019-06-01', 50.0], ['2019-07-01', 50.8], ['2019-08-01', 47.2],
  ['2019-09-01', 47.3], ['2019-10-01', 49.1], ['2019-11-01', 47.2], ['2019-12-01', 46.8],
  ['2020-01-01', 52.0], ['2020-02-01', 49.8], ['2020-03-01', 42.2], ['2020-04-01', 27.1],
  ['2020-05-01', 31.8], ['2020-06-01', 56.4], ['2020-07-01', 61.5], ['2020-08-01', 67.6],
  ['2020-09-01', 60.2], ['2020-10-01', 67.9], ['2020-11-01', 65.1], ['2020-12-01', 67.9],
].map(([date, value]) => Object.freeze({ date, value })));

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const source = String(text ?? '');
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (inQuotes) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') inQuotes = false;
      else field += character;
      continue;
    }
    if (character === '"') inQuotes = true;
    else if (character === ',') { row.push(field); field = ''; }
    else if (character === '\n') {
      row.push(field.replace(/\r$/, ''));
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += character;
  }
  if (field !== '' || row.length) {
    row.push(field.replace(/\r$/, ''));
    if (row.some((value) => value !== '')) rows.push(row);
  }
  return rows;
}

function normalizeMonthDate(value) {
  const text = String(value ?? '').trim();
  let match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(text);
  if (match) return `${match[1]}-${match[2]}-01`;
  match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (match) return `${match[3]}-${match[1].padStart(2, '0')}-01`;
  return null;
}

function parseFredMdNewOrders(text) {
  const rows = parseCsv(text);
  const headerIndex = rows.findIndex((row) => row.includes(SERIES_ID));
  if (headerIndex < 0) throw new Error(`legacy FRED-MD snapshot missing ${SERIES_ID}`);
  const header = rows[headerIndex];
  const valueIndex = header.indexOf(SERIES_ID);
  const items = rows.slice(headerIndex + 1).map((row) => {
    const date = normalizeMonthDate(row[0]);
    const value = Number(String(row[valueIndex] ?? '').trim());
    if (!date || !Number.isFinite(value) || value < 0 || value > 100) return null;
    return { date, value };
  }).filter(Boolean);
  if (!items.length) throw new Error('legacy FRED-MD snapshot returned no usable ISM new-orders data');
  return [...new Map(items.map((item) => [item.date, item])).values()]
    .sort((left, right) => left.date.localeCompare(right.date));
}

function mergeDatedItems(...groups) {
  return [...new Map(groups.flat().map((item) => [item.date, { date: item.date, value: Number(item.value) }])).values()]
    .filter((item) => item.date && Number.isFinite(item.value))
    .sort((left, right) => left.date.localeCompare(right.date));
}

function areConsecutiveMonths(previousDate, currentDate) {
  const previous = /^\d{4}-\d{2}/.test(String(previousDate || ''))
    ? new Date(`${String(previousDate).slice(0, 7)}-01T00:00:00Z`)
    : null;
  const current = /^\d{4}-\d{2}/.test(String(currentDate || ''))
    ? new Date(`${String(currentDate).slice(0, 7)}-01T00:00:00Z`)
    : null;
  if (!previous || !current || Number.isNaN(previous.getTime()) || Number.isNaN(current.getTime())) return false;
  const expected = new Date(Date.UTC(previous.getUTCFullYear(), previous.getUTCMonth() + 1, 1));
  return current.getUTCFullYear() === expected.getUTCFullYear()
    && current.getUTCMonth() === expected.getUTCMonth();
}

function findDropHits(items, threshold = 10) {
  const series = mergeDatedItems(items);
  const hits = [];
  for (let index = 1; index < series.length; index += 1) {
    const previous = series[index - 1];
    const current = series[index];
    if (!areConsecutiveMonths(previous.date, current.date) || !(previous.value > 0) || !(current.value < 50)) continue;
    const dropPercent = ((previous.value - current.value) / previous.value) * 100;
    if (dropPercent >= threshold) hits.push({ date: current.date, value: dropPercent });
  }
  return hits;
}

function historyCutoff(items, years = HISTORY_YEARS) {
  const latest = items.at(-1);
  if (!latest) return '0000-01-01';
  const date = new Date(`${latest.date}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return date.toISOString().slice(0, 10);
}

function assertNear(items, date, expected, tolerance = 0.15) {
  const item = items.find((entry) => entry.date === date);
  if (!item || Math.abs(item.value - expected) > tolerance) {
    throw new Error(`ISM history anchor mismatch for ${date}: expected ${expected}, got ${item ? item.value : 'missing'}`);
  }
}

function validateLegacyHistory(items) {
  // Anchors from the pinned 2015-04 FRED-MD vintage. These checks prevent a
  // wrong CSV or a column shift from silently entering the backtest history.
  assertNear(items, '2008-10-01', 33.2);
  assertNear(items, '2008-12-01', 23.2);
  assertNear(items, '2015-03-01', 51.8);
}

function validateContinuousMonthlyHistory(items, startDate) {
  const series = items.filter((item) => item.date >= startDate);
  for (let index = 1; index < series.length; index += 1) {
    if (!areConsecutiveMonths(series[index - 1].date, series[index].date)) {
      throw new Error(`ISM new-orders history gap between ${series[index - 1].date} and ${series[index].date}`);
    }
  }
}

function contentHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

async function fetchText(url, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch unavailable');
  const options = {
    headers: { Accept: 'text/csv,text/plain,*/*', 'User-Agent': 'DailyReview/1.0' },
  };
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    options.signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  }
  const response = await fetchImpl(url, options);
  if (!response?.ok) throw new Error(`legacy FRED-MD snapshot HTTP ${response?.status ?? '--'}`);
  const text = await response.text();
  if (!text.trim()) throw new Error('legacy FRED-MD snapshot returned empty content');
  return text;
}

function rewriteOfflineChunks(chart, manifest) {
  const entry = (manifest.charts || []).find((item) => item.id === chart.id);
  if (!entry) throw new Error('offline manifest missing ismNewOrders');
  const grouped = new Map();
  chart.items.forEach((item) => {
    const year = /^\d{4}/.test(item.date || '') ? item.date.slice(0, 4) : 'undated';
    if (!grouped.has(year)) grouped.set(year, []);
    grouped.get(year).push(item);
  });
  entry.chunks = [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([year, items]) => {
    const content = JSON.stringify(items) + '\n';
    const hash = contentHash(content);
    const relativePath = `offline/${chart.id}/items-${year}.${hash}.json`;
    const absolutePath = path.join(distDirectory, 'data', relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content, 'utf8');
    return { year, path: `data/${relativePath}`, hash, bytes: Buffer.byteLength(content) };
  });
  const extrasContent = fs.readFileSync(path.join(distDirectory, ...String(entry.extras.path).split('/')), 'utf8');
  entry.signature = contentHash(extrasContent + entry.chunks.map((chunk) => chunk.hash).join(':'));
}

async function supplement(options = {}) {
  if (!fs.existsSync(chartPath) || !fs.existsSync(outlookPath) || !fs.existsSync(manifestPath)) {
    throw new Error('built ISM new-orders files are missing; run normal build first');
  }

  const chart = JSON.parse(fs.readFileSync(chartPath, 'utf8'));
  const existingItems = Array.isArray(chart.items) ? chart.items : [];
  const text = options.text ?? await fetchText(LEGACY_FRED_MD_URL, options.fetchImpl);
  const legacyItems = parseFredMdNewOrders(text);
  validateLegacyHistory(legacyItems);

  const merged = mergeDatedItems(legacyItems, HISTORICAL_BRIDGE_ITEMS, existingItems);
  const cutoff = historyCutoff(merged);
  chart.items = merged.filter((item) => item.date >= cutoff);
  validateContinuousMonthlyHistory(chart.items, chart.items[0]?.date || cutoff);

  chart.sourceName = 'FRED-MD 历史快照 / ISM 历史发布 / DBnomics 近期 / ISM 官方最新月报';
  chart.sourceUrl = FRED_MD_DOCUMENTATION_URL;
  chart.historyStart = chart.items[0]?.date || null;
  chart.historySources = [
    { range: `${chart.historyStart || '历史'}–2015-03`, name: 'FRED-MD 2015-04 vintage（固定历史快照）', url: LEGACY_FRED_MD_PAGE_URL },
    { range: '2015-04–2020-12', name: 'ISM 历史月度发布值' },
    { range: '2021-01–2025-12', name: 'DBnomics ISM 历史' },
    { range: '2026-01–最新', name: 'ISM 官方月报快照' },
  ];
  fs.writeFileSync(chartPath, JSON.stringify(chart) + '\n', 'utf8');

  const outlook = JSON.parse(fs.readFileSync(outlookPath, 'utf8'));
  const metadata = (outlook.charts || []).find((item) => item.id === chart.id);
  if (metadata) {
    metadata.itemCount = chart.items.length;
    metadata.sourceName = chart.sourceName;
    metadata.sourceUrl = chart.sourceUrl;
    metadata.historyStart = chart.historyStart;
    metadata.historySources = chart.historySources;
  }
  fs.writeFileSync(outlookPath, JSON.stringify(outlook) + '\n', 'utf8');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  rewriteOfflineChunks(chart, manifest);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest) + '\n', 'utf8');

  const defaultHits = findDropHits(chart.items, 10);
  const hasCovid = defaultHits.some((item) => item.date === '2020-03-01')
    && defaultHits.some((item) => item.date === '2020-04-01');
  const hasGfc = defaultHits.some((item) => item.date === '2008-10-01')
    && defaultHits.some((item) => item.date === '2008-11-01')
    && defaultHits.some((item) => item.date === '2008-12-01');
  if (!hasCovid || !hasGfc) {
    throw new Error(`ISM historical backtest validation failed: COVID=${hasCovid}, GFC=${hasGfc}`);
  }

  process.stdout.write(
    `Extended ISM new-orders history to ${chart.historyStart || 'unknown'} (${chart.items.length} monthly points); 10% rule includes 2008 and 2020 crisis hits.\n`,
  );
  return chart;
}

if (require.main === module) {
  supplement().catch((error) => {
    process.stderr.write((error.stack || error.message) + '\n');
    process.exitCode = 1;
  });
}

module.exports = {
  FRED_MD_DOCUMENTATION_URL,
  HISTORICAL_BRIDGE_ITEMS,
  HISTORY_YEARS,
  LEGACY_FRED_MD_URL,
  SERIES_ID,
  areConsecutiveMonths,
  findDropHits,
  mergeDatedItems,
  normalizeMonthDate,
  parseFredMdNewOrders,
  supplement,
  validateLegacyHistory,
};
