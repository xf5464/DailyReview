const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  FRED_MD_DOCUMENTATION_URL,
  LEGACY_FRED_MD_URL,
  mergeDatedItems,
  normalizeMonthDate,
} = require('./supplement-ism-new-orders-history');

const projectRoot = path.resolve(__dirname, '..');
const distDirectory = path.join(projectRoot, 'dist');
const outlookPath = path.join(distDirectory, 'data', 'outlook.json');
const manifestPath = path.join(distDirectory, 'data', 'offline-manifest.json');
const HISTORY_YEARS = 30;
const REQUEST_TIMEOUT_MS = 20_000;

const LEGACY_FRED_MD_PAGE_URL = 'https://github.com/xinaut/SOFARI/blob/d3d235826925e1197f2165e7f9cbf41ad6bc378a/real%20data/economic/2015-04.csv';
const GRETl_COMMIT = '153aa306f05d78698511b8dc03468d16f45bad58';
const GRETl_INDEX_URL = `https://raw.githubusercontent.com/progtologist/gretl/${GRETl_COMMIT}/share/gretl/bcih/fedstl.idx`;
const GRETl_DATA_URL = `https://raw.githubusercontent.com/progtologist/gretl/${GRETl_COMMIT}/share/gretl/bcih/fedstl.dat`;
const GRETl_PAGE_URL = `https://github.com/progtologist/gretl/tree/${GRETl_COMMIT}/share/gretl/bcih`;

const SERIES = Object.freeze([
  {
    chartId: 'ismManufacturingPmi',
    fredMdColumn: 'NAPM',
    legacyEnd: '2015-03',
    sourceName: 'FRED-MD 历史快照 / DBnomics 近期 / ISM 官方最新月报',
  },
  {
    chartId: 'ismSupplierDeliveries',
    fredMdColumn: 'NAPMSDI',
    legacyEnd: '2015-03',
    sourceName: 'FRED-MD 历史快照 / DBnomics 近期 / ISM 官方最新月报',
  },
  {
    chartId: 'ismBacklogOrders',
    gretlSeries: 'napmbi',
    legacyEnd: '2014-01',
    sourceName: 'FRED 历史存档 / DBnomics 近期 / ISM 官方最新月报',
  },
]);

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

function parseFredMdSeries(text, seriesId) {
  const rows = parseCsv(text);
  const headerIndex = rows.findIndex((row) => row.includes(seriesId));
  if (headerIndex < 0) throw new Error(`legacy FRED-MD snapshot missing ${seriesId}`);
  const header = rows[headerIndex];
  const valueIndex = header.indexOf(seriesId);
  return rows.slice(headerIndex + 1).map((row) => {
    const date = normalizeMonthDate(row[0]);
    const value = Number(String(row[valueIndex] ?? '').trim());
    if (!date || !Number.isFinite(value) || value < 0 || value > 100) return null;
    return { date, value };
  }).filter(Boolean);
}

function monthRange(start, count) {
  const match = /^(\d{4})\.(\d{2})$/.exec(start);
  if (!match) throw new Error(`unsupported monthly start date: ${start}`);
  const startYear = Number(match[1]);
  const startMonth = Number(match[2]) - 1;
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(startYear, startMonth + index, 1));
    return date.toISOString().slice(0, 10);
  });
}

function parseGretlSeries(indexText, dataText, seriesName) {
  const lines = String(indexText ?? '').split(/\r?\n/);
  const values = String(dataText ?? '').trim().split(/\s+/).map(Number);
  let offset = 0;

  for (let index = 0; index < lines.length - 1; index += 1) {
    const nameMatch = /^([a-z0-9_]+)\s+/.exec(lines[index].trim());
    if (!nameMatch) continue;
    const metaMatch = /^M\s+(\d{4}\.\d{2})\s+-\s+(\d{4}\.\d{2})\s+n\s*=\s*(\d+)/i.exec(lines[index + 1].trim());
    if (!metaMatch) continue;
    const count = Number(metaMatch[3]);
    if (!Number.isInteger(count) || count <= 0) continue;
    if (nameMatch[1] === seriesName) {
      const slice = values.slice(offset, offset + count);
      if (slice.length !== count || slice.some((value) => !Number.isFinite(value))) {
        throw new Error(`gretl historical series ${seriesName} data length mismatch`);
      }
      const dates = monthRange(metaMatch[1], count);
      return dates.map((date, valueIndex) => ({ date, value: slice[valueIndex] }))
        .filter((item) => item.value >= 0 && item.value <= 100);
    }
    offset += count;
    index += 1;
  }
  throw new Error(`gretl historical series not found: ${seriesName}`);
}

function contentHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

function historyCutoff(items, years = HISTORY_YEARS) {
  const latest = items.at(-1);
  if (!latest) return '0000-01-01';
  const date = new Date(`${latest.date}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return date.toISOString().slice(0, 10);
}

async function fetchText(url, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch unavailable');
  const options = { headers: { Accept: 'text/plain,text/csv,*/*', 'User-Agent': 'DailyReview/1.0' } };
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    options.signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  }
  const response = await fetchImpl(url, options);
  if (!response?.ok) throw new Error(`historical ISM source HTTP ${response?.status ?? '--'}: ${url}`);
  const text = await response.text();
  if (!text.trim()) throw new Error(`historical ISM source returned empty content: ${url}`);
  return text;
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

  const [fredMdText, gretlIndexText, gretlDataText] = await Promise.all([
    options.fredMdText ?? fetchText(LEGACY_FRED_MD_URL, options.fetchImpl),
    options.gretlIndexText ?? fetchText(GRETl_INDEX_URL, options.fetchImpl),
    options.gretlDataText ?? fetchText(GRETl_DATA_URL, options.fetchImpl),
  ]);

  const legacyByChart = {
    ismManufacturingPmi: parseFredMdSeries(fredMdText, 'NAPM'),
    ismSupplierDeliveries: parseFredMdSeries(fredMdText, 'NAPMSDI'),
    ismBacklogOrders: parseGretlSeries(gretlIndexText, gretlDataText, 'napmbi'),
  };

  const outlook = JSON.parse(fs.readFileSync(outlookPath, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const updated = [];

  for (const config of SERIES) {
    const chartPath = path.join(distDirectory, 'data', 'charts', `${config.chartId}.json`);
    if (!fs.existsSync(chartPath)) throw new Error(`built chart missing: ${config.chartId}`);
    const chart = JSON.parse(fs.readFileSync(chartPath, 'utf8'));
    const existingItems = Array.isArray(chart.items) ? chart.items : [];
    const merged = mergeDatedItems(legacyByChart[config.chartId], existingItems);
    const cutoff = historyCutoff(merged);
    chart.items = merged.filter((item) => item.date >= cutoff);
    chart.sourceName = config.sourceName;
    chart.sourceUrl = config.chartId === 'ismBacklogOrders' ? GRETl_PAGE_URL : FRED_MD_DOCUMENTATION_URL;
    chart.historyStart = chart.items[0]?.date || null;
    chart.historySources = config.chartId === 'ismBacklogOrders'
      ? [
        { range: `${chart.historyStart || '历史'}–${config.legacyEnd}`, name: 'FRED 历史存档（gretl 固定镜像）', url: GRETl_PAGE_URL },
        { range: '2021-01–2025-12', name: 'DBnomics ISM 历史' },
        { range: '2026-01–最新', name: 'ISM 官方月报快照' },
      ]
      : [
        { range: `${chart.historyStart || '历史'}–${config.legacyEnd}`, name: 'FRED-MD 2015-04 vintage（固定历史快照）', url: LEGACY_FRED_MD_PAGE_URL },
        { range: '近期', name: 'DBnomics ISM 历史' },
        { range: '2026-01–最新', name: 'ISM 官方月报快照' },
      ];
    fs.writeFileSync(chartPath, JSON.stringify(chart) + '\n', 'utf8');

    const metadata = (outlook.charts || []).find((item) => item.id === chart.id);
    if (metadata) {
      metadata.itemCount = chart.items.length;
      metadata.sourceName = chart.sourceName;
      metadata.sourceUrl = chart.sourceUrl;
      metadata.historyStart = chart.historyStart;
      metadata.historySources = chart.historySources;
    }
    rewriteOfflineChunks(chart, manifest);
    updated.push({ id: chart.id, start: chart.historyStart, count: chart.items.length });
  }

  fs.writeFileSync(outlookPath, JSON.stringify(outlook) + '\n', 'utf8');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest) + '\n', 'utf8');
  process.stdout.write(`Extended remaining ISM histories: ${updated.map((item) => `${item.id}=${item.start} (${item.count})`).join(', ')}\n`);
  return updated;
}

if (require.main === module) {
  supplement().catch((error) => {
    process.stderr.write((error.stack || error.message) + '\n');
    process.exitCode = 1;
  });
}

module.exports = {
  GRETl_DATA_URL,
  GRETl_INDEX_URL,
  SERIES,
  monthRange,
  parseFredMdSeries,
  parseGretlSeries,
  supplement,
};
