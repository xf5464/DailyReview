const fs = require('node:fs/promises');
const path = require('node:path');
const { classifyBroadIndex } = require('./national-team-wide-etf');

const OUTPUT_PATH = path.join(__dirname, 'data', 'national-team-etf-holdings.json');
const EASTMONEY_FUND_LIST_URL = 'https://fund.eastmoney.com/js/fundcode_search.js';
const SINA_HOLDER_API = 'https://stock.finance.sina.com.cn/fundInfo/api/openapi.php/CaihuiFundInfoService.getFundHolder';

function classifyHolder(holderName) {
  if (/中央汇金|汇金资管/.test(holderName)) return 'huijin';
  if (/中国证券金融|中证金融资产管理计划/.test(holderName)) return 'zhengjin';
  return null;
}

function reportPeriod(reportDate) {
  const match = String(reportDate).match(/^(\d{4})-(06-30|12-31)$/);
  if (!match) throw new Error('报告日必须是 YYYY-06-30 或 YYYY-12-31');
  const quarter = match[2] === '06-30' ? 2 : 4;
  return { key: `${match[1]}-${quarter}`, label: `${match[1]}Q${quarter}`, reportDate };
}

function defaultReportDate(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  if (month >= 9) return `${year}-06-30`;
  return `${year - 1}-12-31`;
}

async function fetchJsonWithRetry(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Referer: 'https://stock.finance.sina.com.cn/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 400));
    }
  }
  throw lastError;
}

async function loadBroadEtfUniverse() {
  const response = await fetch(EASTMONEY_FUND_LIST_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  if (!response.ok) throw new Error(`ETF 基金列表请求失败（HTTP ${response.status}）`);
  const text = await response.text();
  const records = JSON.parse(text.replace(/^\uFEFF?var r = /, '').replace(/;\s*$/, ''));
  return records
    .filter(([code, , name]) => /^(15|51|52|56|58)\d{4}$/.test(code) && /ETF/i.test(name) && !/联接|连接|ETF-FOF/i.test(name))
    .map(([code, , name]) => ({ etfCode: code, etfName: name }))
    .filter((etf) => classifyBroadIndex(etf.etfName));
}

async function updateNationalTeamHoldings(options = {}) {
  const reportDate = options.reportDate ?? defaultReportDate(options.now);
  const period = reportPeriod(reportDate);
  const holdingsData = JSON.parse(await fs.readFile(OUTPUT_PATH, 'utf8'));
  const periods = [...(holdingsData.periods ?? []).filter((item) => item.key !== period.key), period]
    .sort((left, right) => left.reportDate.localeCompare(right.reportDate));
  const universe = await loadBroadEtfUniverse();
  const snapshots = { huijin: new Map(), zhengjin: new Map() };
  let nextIndex = 0;
  let completed = 0;

  async function worker() {
    while (nextIndex < universe.length) {
      const etf = universe[nextIndex];
      nextIndex += 1;
      const url = new URL(SINA_HOLDER_API);
      url.searchParams.set('symbol', etf.etfCode);
      url.searchParams.set('date', period.reportDate);
      const payload = await fetchJsonWithRetry(url);
      for (const holder of payload.result?.data ?? []) {
        const organization = classifyHolder(String(holder.cyrmc ?? ''));
        const shares = Number(holder.cyfe);
        if (!organization || !Number.isFinite(shares)) continue;
        const current = snapshots[organization].get(etf.etfCode) ?? {
          etfCode: etf.etfCode,
          etfName: etf.etfName,
          shares10k: 0,
        };
        current.shares10k += shares / 10000;
        snapshots[organization].set(etf.etfCode, current);
      }
      completed += 1;
      options.onProgress?.({ completed, total: universe.length });
    }
  }

  await Promise.all(Array.from({ length: Math.min(options.concurrency ?? 20, universe.length) }, () => worker()));
  const series = {};
  for (const organization of ['huijin', 'zhengjin']) {
    const existing = new Map((holdingsData.series?.[organization] ?? []).map((item) => [item.etfCode, {
      ...item,
      holdings: { ...item.holdings, [period.key]: 0 },
    }]));
    for (const item of snapshots[organization].values()) {
      const record = existing.get(item.etfCode) ?? { etfCode: item.etfCode, etfName: item.etfName, holdings: {} };
      record.etfName = item.etfName;
      record.holdings[period.key] = Number(item.shares10k.toFixed(4));
      existing.set(item.etfCode, record);
    }
    series[organization] = [...existing.values()].sort((left, right) => left.etfCode.localeCompare(right.etfCode));
  }
  const output = {
    ...holdingsData,
    generatedAt: new Date().toISOString(),
    periods,
    series,
  };
  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  return {
    reportDate,
    period,
    scannedEtfs: universe.length,
    huijinEtfs: snapshots.huijin.size,
    zhengjinEtfs: snapshots.zhengjin.size,
  };
}

async function main() {
  const dateArgumentIndex = process.argv.indexOf('--date');
  const reportDate = dateArgumentIndex >= 0 ? process.argv[dateArgumentIndex + 1] : undefined;
  let lastPercent = -1;
  const result = await updateNationalTeamHoldings({
    reportDate,
    onProgress({ completed, total }) {
      const percent = Math.floor(completed / total * 100);
      if (percent !== lastPercent && (percent % 5 === 0 || completed === total)) {
        process.stdout.write(`已扫描 ${completed}/${total}（${percent}%）\n`);
        lastPercent = percent;
      }
    },
  });
  console.log(`已追加 ${result.period.label}：扫描 ${result.scannedEtfs} 只宽基 ETF，汇金 ${result.huijinEtfs} 只，证金 ${result.zhengjinEtfs} 只。`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { classifyHolder, defaultReportDate, reportPeriod, updateNationalTeamHoldings };
