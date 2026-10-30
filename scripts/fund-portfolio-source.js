// Adapted from xf5464/StockValueEstimate/src/fund-portfolio.js.
// Source is intentionally invoked only by an explicit manual collector.
const FUND_HOLDING_STOCK_LIMIT = 100;

function decodeHtml(text) {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

function toNumber(value) {
  const number = Number(String(value).replaceAll(',', '').replace('%', '').trim());
  return Number.isFinite(number) ? number : null;
}

function parseFundPortfolioText(text) {
  const contentMatch = text.match(/content:"([\s\S]*?)",arryear:/);
  const yearsMatch = text.match(/arryear:\[([^\]]*)\]/);
  const availableYears = (yearsMatch?.[1].match(/\d{4}/g) ?? [])
    .map(Number)
    .sort((left, right) => left - right);

  if (!contentMatch) {
    throw new Error('基金持仓接口返回了无法识别的数据');
  }

  const html = JSON.parse(`"${contentMatch[1]}"`);
  const quarters = [];
  const sectionPattern = /<h4[^>]*>[\s\S]*?(\d{4})年(\d)季度股票投资明细[\s\S]*?截止至：<font[^>]*>(\d{4}-\d{2}-\d{2})<\/font>[\s\S]*?<thead>([\s\S]*?)<\/thead>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/g;
  let sectionMatch;

  while ((sectionMatch = sectionPattern.exec(html)) !== null) {
    const headers = [...sectionMatch[4].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)]
      .map((match) => decodeHtml(match[1]).replace(/\s/g, ''));
    const indexes = {
      rank: headers.findIndex((header) => header === '序号'),
      stockCode: headers.findIndex((header) => header === '股票代码'),
      stockName: headers.findIndex((header) => header === '股票名称'),
      netValueRatio: headers.findIndex((header) => header.startsWith('占净值比例')),
      shares10k: headers.findIndex((header) => header.startsWith('持股数')),
      marketValue10kCny: headers.findIndex((header) => header.startsWith('持仓市值')),
    };
    const requiredIndexes = Object.values(indexes);
    const rows = [];
    const rowPattern = /<tr>([\s\S]*?)<\/tr>/g;
    let rowMatch;

    while ((rowMatch = rowPattern.exec(sectionMatch[5])) !== null && rows.length < 10) {
      const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((match) => decodeHtml(match[1]));

      if (requiredIndexes.some((index) => index < 0 || index >= cells.length)) {
        continue;
      }

      rows.push({
        rank: Number(cells[indexes.rank]),
        stockCode: cells[indexes.stockCode],
        stockName: cells[indexes.stockName],
        netValueRatio: toNumber(cells[indexes.netValueRatio]),
        shares10k: toNumber(cells[indexes.shares10k]),
        marketValue10kCny: toNumber(cells[indexes.marketValue10kCny]),
      });
    }

    quarters.push({
      key: `${sectionMatch[1]}-Q${sectionMatch[2]}`,
      year: Number(sectionMatch[1]),
      quarter: Number(sectionMatch[2]),
      reportDate: sectionMatch[3],
      rows,
    });
  }

  return {
    availableYears,
    quarters: quarters.sort((left, right) => left.reportDate.localeCompare(right.reportDate)),
  };
}

async function queryFundPortfolio(fundCode, year, options = {}) {
  if (!/^\d{6}$/.test(String(fundCode))) {
    throw new Error('基金代码格式不正确');
  }

  if (!/^\d{4}$/.test(String(year))) {
    throw new Error('查询年份格式不正确');
  }

  const url = new URL('https://fundf10.eastmoney.com/FundArchivesDatas.aspx');
  const params = {
    type: 'jjcc',
    code: String(fundCode),
    topline: '10',
    year: String(year),
    month: '',
    rt: String(Math.random()),
  };
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);

  try {
    const response = await (options.fetchImpl ?? fetch)(url, {
      headers: {
        Referer: `https://fundf10.eastmoney.com/ccmx_${fundCode}.html`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`基金持仓请求失败（HTTP ${response.status}）`);
    }

    return {
      fundCode: String(fundCode),
      year: Number(year),
      ...parseFundPortfolioText(await response.text()),
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('基金持仓请求超时，请稍后重试');
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeFundProductName(name) {
  return String(name ?? '')
    .replace(/(?:份额)?[A-Z](?:类)?$/u, '')
    .replace(/(?:份额)?[A-Z]\d?(?:类)?$/u, '')
    .trim();
}

function deduplicateFundShares(funds) {
  const products = new Map();

  function shareClassPriority(name) {
    const value = String(name ?? '').trim();
    if (/A(?:类)?$/u.test(value)) return 0;
    if (normalizeFundProductName(value) === value) return 1;
    return 2;
  }

  for (const fund of funds) {
    const productName = normalizeFundProductName(fund.fundName) || fund.fundCode;
    const existing = products.get(productName);
    if (!existing || shareClassPriority(fund.fundName) < shareClassPriority(existing.fundName)) {
      products.set(productName, {
        fundCode: String(fund.fundCode),
        fundName: fund.fundName,
        productName,
      });
    }
  }

  return [...products.values()];
}

function aggregateFundStockHoldings(portfolios) {
  const stocks = new Map();
  const reportDates = new Set();

  for (const portfolio of portfolios) {
    const quarter = portfolio.quarter;
    if (!quarter) continue;
    reportDates.add(quarter.reportDate);

    for (const holding of quarter.rows ?? []) {
      const marketValue = Number(holding.marketValue10kCny);
      if (!holding.stockCode || !Number.isFinite(marketValue)) continue;
      const current = stocks.get(holding.stockCode) ?? {
        stockCode: holding.stockCode,
        stockName: holding.stockName,
        marketValue10kCny: 0,
        fundProducts: new Set(),
      };
      current.stockName = holding.stockName || current.stockName;
      current.marketValue10kCny += marketValue;
      current.fundProducts.add(portfolio.productName ?? portfolio.fundCode);
      stocks.set(holding.stockCode, current);
    }
  }

  return {
    reportDates: [...reportDates].sort(),
    rows: [...stocks.values()]
      .map((stock) => ({
        stockCode: stock.stockCode,
        stockName: stock.stockName,
        marketValue10kCny: stock.marketValue10kCny,
        fundCount: stock.fundProducts.size,
      }))
      .sort((left, right) => right.marketValue10kCny - left.marketValue10kCny)
      .slice(0, FUND_HOLDING_STOCK_LIMIT)
      .map((row, index) => ({ ...row, rank: index + 1 })),
  };
}

module.exports = {
  aggregateFundStockHoldings,
  deduplicateFundShares,
  normalizeFundProductName,
  parseFundPortfolioText,
  queryFundPortfolio,
};
