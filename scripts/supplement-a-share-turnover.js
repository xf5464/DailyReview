const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const distDirectory = path.join(projectRoot, 'dist');
const chartPath = path.join(distDirectory, 'data', 'charts', 'aShareTurnover.json');
const outlookPath = path.join(distDirectory, 'data', 'outlook.json');
const manifestPath = path.join(distDirectory, 'data', 'offline-manifest.json');
const REQUEST_TIMEOUT_MS = 20_000;
const EASTMONEY_SOURCE_URL = 'https://quote.eastmoney.com/zs000985.html';

function contentHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

function buildEastmoneyUrl(limit = 8000) {
  const params = new URLSearchParams({
    secid: '1.000985',
    fields1: 'f1,f2,f3',
    fields2: 'f51,f52,f53,f54,f55,f56,f57',
    klt: '101',
    fqt: '0',
    end: '20500101',
    lmt: String(limit),
    ut: 'fa5fd1943c7b386f172d6893dbbd1d0c',
  });
  return `https://push2his.eastmoney.com/api/qt/stock/kline/get?${params.toString()}`;
}

function parseEastmoneyTurnover(text) {
  const payload = JSON.parse(String(text ?? ''));
  const klines = payload?.data?.klines;
  if (!Array.isArray(klines) || !klines.length) throw new Error('东方财富未返回中证全指日线');
  return klines.map((line) => {
    const fields = String(line).split(',');
    const date = /^\d{4}-\d{2}-\d{2}$/.test(fields[0] || '') ? fields[0] : null;
    const amountYuan = Number(fields[6]);
    return date && Number.isFinite(amountYuan) && amountYuan >= 0
      ? { date, value: amountYuan / 100000000 }
      : null;
  }).filter(Boolean).sort((left, right) => left.date.localeCompare(right.date));
}

async function fetchText(url, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch unavailable');
  const options = {
    headers: {
      Accept: 'application/json,text/plain,*/*',
      Referer: 'https://quote.eastmoney.com/',
      'User-Agent': 'Mozilla/5.0 DailyReview/1.0',
    },
  };
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    options.signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  }
  const response = await fetchImpl(url, options);
  if (!response?.ok) throw new Error(`东方财富中证全指 HTTP ${response?.status ?? '--'}`);
  const text = await response.text();
  if (!text.trim()) throw new Error('东方财富中证全指返回空内容');
  return text;
}

function rewriteOfflineChunks(chart, manifest) {
  const entry = (manifest.charts || []).find((item) => item.id === chart.id);
  if (!entry) return;
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
  const extrasPath = entry.extras?.path;
  if (extrasPath) {
    const extrasContent = fs.readFileSync(path.join(distDirectory, ...String(extrasPath).split('/')), 'utf8');
    entry.signature = contentHash(extrasContent + entry.chunks.map((chunk) => chunk.hash).join(':'));
  }
}

async function supplement(options = {}) {
  if (!fs.existsSync(chartPath)) throw new Error('built A-share turnover chart missing; run normal build first');
  const chart = JSON.parse(fs.readFileSync(chartPath, 'utf8'));
  if (Array.isArray(chart.items) && chart.items.length && !chart.error) {
    process.stdout.write('A-share turnover primary source is healthy; fallback not needed.\n');
    return false;
  }

  const text = options.text ?? await fetchText(buildEastmoneyUrl(), options.fetchImpl);
  const items = parseEastmoneyTurnover(text);
  if (!items.length) throw new Error('东方财富中证全指无可用成交额');

  chart.items = items;
  chart.sourceName = '东方财富 / 中证全指（000985）';
  chart.sourceUrl = EASTMONEY_SOURCE_URL;
  chart.historyStart = items[0]?.date || null;
  delete chart.error;
  fs.writeFileSync(chartPath, JSON.stringify(chart) + '\n', 'utf8');

  if (fs.existsSync(outlookPath)) {
    const outlook = JSON.parse(fs.readFileSync(outlookPath, 'utf8'));
    const metadata = (outlook.charts || []).find((item) => item.id === chart.id);
    if (metadata) {
      metadata.itemCount = items.length;
      metadata.sourceName = chart.sourceName;
      metadata.sourceUrl = chart.sourceUrl;
      metadata.historyStart = chart.historyStart;
      delete metadata.error;
    }
    fs.writeFileSync(outlookPath, JSON.stringify(outlook) + '\n', 'utf8');
  }

  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    rewriteOfflineChunks(chart, manifest);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest) + '\n', 'utf8');
  }

  process.stdout.write(`Recovered A-share turnover from Eastmoney (${items.length} daily points, latest ${items.at(-1)?.date || '--'}).\n`);
  return true;
}

if (require.main === module) {
  supplement().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { buildEastmoneyUrl, parseEastmoneyTurnover, supplement };
