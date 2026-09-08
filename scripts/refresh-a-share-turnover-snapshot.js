'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  buildAShareTurnoverUrl,
  parseAShareTurnover,
} = require('./macro-outlook');
const {
  buildEastmoneyUrl,
  parseEastmoneyTurnover,
} = require('./supplement-a-share-turnover');

const projectRoot = path.resolve(__dirname, '..');
const snapshotPath = path.join(projectRoot, 'scripts', 'data', 'a-share-turnover-snapshot.json');
const CSI_SOURCE_URL = 'https://www.csindex.com.cn/#/indices/family/detail?indexCode=000985';
const EASTMONEY_SOURCE_URL = 'https://quote.eastmoney.com/zs000985.html';
const ATTEMPTS = 3;

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function completedEastmoneyItems(items, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  const chinaDate = `${parts.year}-${parts.month}-${parts.day}`;
  const chinaMinutes = Number(parts.hour) * 60 + Number(parts.minute);
  const sorted = [...items].sort((left, right) => left.date.localeCompare(right.date));
  return sorted.at(-1)?.date === chinaDate && chinaMinutes < 15 * 60 + 10 ? sorted.slice(0, -1) : sorted;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchText(url, referer, fetchImpl = globalThis.fetch) {
  let lastError;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(30_000),
        headers: {
          Accept: 'application/json,text/plain,*/*',
          Referer: referer,
          'User-Agent': 'Mozilla/5.0 DailyReview/1.0',
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < ATTEMPTS) await sleep(attempt * 2_000);
    }
  }
  throw lastError;
}

function buildSnapshot(items, sourceName, sourceUrl, now = new Date()) {
  const normalized = [...new Map(items.map((item) => [item.date, item])).values()]
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(String(item.date)) && Number.isFinite(Number(item.value)))
    .map((item) => ({ date: item.date, value: Number(item.value) }))
    .sort((left, right) => left.date.localeCompare(right.date));
  if (!normalized.length) throw new Error('A股全A成交额快照没有有效数据');
  return {
    schemaVersion: 1,
    updatedAt: now.toISOString(),
    sourceName,
    sourceUrl,
    historyStart: normalized[0].date,
    latestDate: normalized.at(-1).date,
    items: normalized,
  };
}

async function collectSnapshot(options = {}) {
  const end = new Date();
  const start = new Date(Date.UTC(end.getUTCFullYear() - 30, end.getUTCMonth(), end.getUTCDate()));
  if (options.eastmoneyText) {
    return buildSnapshot(completedEastmoneyItems(parseEastmoneyTurnover(options.eastmoneyText), end), '东方财富 / 中证全指（000985）', EASTMONEY_SOURCE_URL, end);
  }
  try {
    const text = await fetchText(buildAShareTurnoverUrl(isoDate(start), isoDate(end)), 'https://www.csindex.com.cn/', options.fetchImpl);
    return buildSnapshot(parseAShareTurnover(text), '中证指数官网 / 中证全指（000985）', CSI_SOURCE_URL, end);
  } catch (primaryError) {
    try {
      const text = await fetchText(buildEastmoneyUrl(), 'https://quote.eastmoney.com/', options.fetchImpl);
      return buildSnapshot(completedEastmoneyItems(parseEastmoneyTurnover(text), end), '东方财富 / 中证全指（000985）', EASTMONEY_SOURCE_URL, end);
    } catch (fallbackError) {
      throw new Error(`中证指数：${primaryError?.message || primaryError}；东方财富：${fallbackError?.message || fallbackError}`);
    }
  }
}

async function main() {
  const fileIndex = process.argv.indexOf('--eastmoney-file');
  const eastmoneyText = fileIndex >= 0 ? fs.readFileSync(process.argv[fileIndex + 1], 'utf8') : null;
  const snapshot = await collectSnapshot({ eastmoneyText });
  fs.mkdirSync(path.dirname(snapshotPath), { recursive: true });
  fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  process.stdout.write(`Saved A-share turnover snapshot (${snapshot.items.length} points, ${snapshot.historyStart} to ${snapshot.latestDate}).\n`);
}

if (require.main === module) {
  main().catch((error) => { process.stderr.write(`${error?.stack || error}\n`); process.exitCode = 1; });
}

module.exports = { buildSnapshot, collectSnapshot, completedEastmoneyItems };
