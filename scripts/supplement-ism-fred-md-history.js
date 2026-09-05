const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const distDirectory = path.join(projectRoot, 'dist');
const outlookPath = path.join(distDirectory, 'data', 'outlook.json');
const manifestPath = path.join(distDirectory, 'data', 'offline-manifest.json');
const FRED_MD_PAGE_URL = 'https://www.stlouisfed.org/research/economists/mccracken/fred-databases';
const HISTORY_YEARS = 30;
const REQUEST_TIMEOUT_MS = 20_000;

// FRED-MD directly includes these three ISM manufacturing diffusion indexes.
// Backlog Orders is not part of FRED-MD, so that chart keeps the existing
// DBnomics history + ISM official latest-month supplement.
const FRED_MD_ISM_SERIES = Object.freeze({
  ismManufacturingPmi: 'NAPM',
  ismSupplierDeliveries: 'NAPMSDI',
  ismNewOrders: 'NAPMNOI',
});

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

function normalizeFredMdDate(value) {
  const text = String(value ?? '').trim();
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (match) return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  match = /^(\d{4})-(\d{2})$/.exec(text);
  if (match) return `${match[1]}-${match[2]}-01`;
  return null;
}

function parseFredMdSeries(text, seriesId) {
  const rows = parseCsv(text);
  const headerIndex = rows.findIndex((row) => row.includes(seriesId));
  if (headerIndex < 0) throw new Error(`FRED-MD missing ${seriesId}`);
  const header = rows[headerIndex];
  const valueIndex = header.indexOf(seriesId);
  const items = rows.slice(headerIndex + 1).map((row) => {
    const rawDate = normalizeFredMdDate(row[0]);
    const value = Number(String(row[valueIndex] ?? '').trim());
    if (!rawDate || !Number.isFinite(value) || value < 0 || value > 100) return null;
    return { date: `${rawDate.slice(0, 7)}-01`, value };
  }).filter(Boolean);
  if (!items.length) throw new Error(`FRED-MD returned no usable ${seriesId} data`);
  return [...new Map(items.map((item) => [item.date, item])).values()]
    .sort((left, right) => left.date.localeCompare(right.date));
}

function findCurrentFredMdCsvUrl(html) {
  const source = String(html ?? '');
  const anchors = [...source.matchAll(/<a\b[^>]*href=["']([^"']+\.csv)["'][^>]*>\s*current\.csv\s*<\/a>/gi)];
  const match = anchors.find((entry) => /\/fred-md\/monthly\/[^"']*-md\.csv(?:[?#]|$)/i.test(entry[1]));
  if (!match) throw new Error('FRED-MD page does not expose the monthly current.csv');
  return new URL(match[1].replace(/&amp;/gi, '&'), FRED_MD_PAGE_URL).href;
}

function mergeDatedItems(...groups) {
  return [...new Map(groups.flat().map((item) => [item.date, item])).values()]
    .sort((left, right) => left.date.localeCompare(right.date));
}

function historyCutoff(items, years = HISTORY_YEARS) {
  const latest = items.at(-1);
  if (!latest) return '0000-01-01';
  const date = new Date(`${latest.date}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return date.toISOString().slice(0, 10);
}

function contentHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

async function fetchText(url, fetchImpl = globalThis.fetch, accept = '*/*') {
  if (typeof fetchImpl !== 'function') throw new Error('fetch unavailable');
  const options = { headers: { Accept: accept, 'User-Agent': 'DailyReview/1.0' } };
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    options.signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  }
  const response = await fetchImpl(url, options);
  if (!response?.ok) throw new Error(`FRED-MD HTTP ${response?.status ?? '--'} for ${url}`);
  const text = await response.text();
  if (!text.trim()) throw new Error('FRED-MD returned empty content');
  return text;
}

async function fetchCurrentFredMdCsv(fetchImpl = globalThis.fetch) {
  const pageHtml = await fetchText(FRED_MD_PAGE_URL, fetchImpl, 'text/html');
  const csvUrl = findCurrentFredMdCsvUrl(pageHtml);
  const text = await fetchText(csvUrl, fetchImpl, 'text/csv,*/*');
  return { text, csvUrl };
}

function rewriteOfflineChunks(chart, manifest) {
  const entry = (manifest.charts || []).find((item) => item.id === chart.id);
  if (!entry) throw new Error(`offline manifest missing ${chart.id}`);
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
  if (!fs.existsSync(outlookPath) || !fs.existsSync(manifestPath)) {
    throw new Error('built ISM files are missing; run normal build first');
  }
  const fetched = options.text
    ? { text: options.text, csvUrl: options.csvUrl || 'test-fixture' }
    : await fetchCurrentFredMdCsv(options.fetchImpl);
  const text = fetched.text;
  const outlook = JSON.parse(fs.readFileSync(outlookPath, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const results = {};

  for (const [chartId, seriesId] of Object.entries(FRED_MD_ISM_SERIES)) {
    const chartPath = path.join(distDirectory, 'data', 'charts', `${chartId}.json`);
    if (!fs.existsSync(chartPath)) throw new Error(`built ${chartId} chart is missing`);
    const chart = JSON.parse(fs.readFileSync(chartPath, 'utf8'));
    const existingItems = Array.isArray(chart.items) ? chart.items : [];
    const fredItems = parseFredMdSeries(text, seriesId);
    const latestFredDate = fredItems.at(-1).date;

    // FRED-MD is the sole historical source. Only values newer than the latest
    // FRED-MD observation are retained from the normal build; these are the
    // ISM official latest-month snapshots, not overlapping DBnomics history.
    const officialLatest = existingItems.filter((item) => item.date > latestFredDate);
    const merged = mergeDatedItems(fredItems, officialLatest);
    const cutoff = historyCutoff(merged);
    chart.items = merged.filter((item) => item.date >= cutoff);
    chart.sourceName = 'FRED-MD 历史 / ISM 官方最新月报';
    chart.sourceUrl = FRED_MD_PAGE_URL;
    chart.fredMdCsvUrl = fetched.csvUrl;
    chart.historyStart = chart.items[0]?.date || null;
    chart.fredMdSeriesId = seriesId;
    fs.writeFileSync(chartPath, JSON.stringify(chart) + '\n', 'utf8');

    const metadata = (outlook.charts || []).find((item) => item.id === chartId);
    if (metadata) {
      metadata.itemCount = chart.items.length;
      metadata.sourceName = chart.sourceName;
      metadata.sourceUrl = chart.sourceUrl;
      metadata.fredMdCsvUrl = chart.fredMdCsvUrl;
      metadata.historyStart = chart.historyStart;
      metadata.fredMdSeriesId = seriesId;
    }
    rewriteOfflineChunks(chart, manifest);
    results[chartId] = chart;
  }

  // FRED-MD does not contain the ISM Backlog Orders diffusion index.
  const backlogPath = path.join(distDirectory, 'data', 'charts', 'ismBacklogOrders.json');
  if (fs.existsSync(backlogPath)) {
    const backlog = JSON.parse(fs.readFileSync(backlogPath, 'utf8'));
    backlog.sourceName = 'DBnomics 历史 / ISM 官方最新月报（FRED-MD 未收录）';
    fs.writeFileSync(backlogPath, JSON.stringify(backlog) + '\n', 'utf8');
    const metadata = (outlook.charts || []).find((item) => item.id === 'ismBacklogOrders');
    if (metadata) metadata.sourceName = backlog.sourceName;
  }

  fs.writeFileSync(outlookPath, JSON.stringify(outlook) + '\n', 'utf8');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest) + '\n', 'utf8');

  process.stdout.write(
    `Unified ISM history from ${fetched.csvUrl}: PMI=NAPM, New Orders=NAPMNOI, Supplier Deliveries=NAPMSDI; Backlog Orders remains DBnomics.\n`,
  );
  return results;
}

if (require.main === module) {
  supplement().catch((error) => {
    process.stderr.write((error.stack || error.message) + '\n');
    process.exitCode = 1;
  });
}

module.exports = {
  FRED_MD_ISM_SERIES,
  FRED_MD_PAGE_URL,
  HISTORY_YEARS,
  fetchCurrentFredMdCsv,
  findCurrentFredMdCsvUrl,
  mergeDatedItems,
  normalizeFredMdDate,
  parseFredMdSeries,
  supplement,
};
