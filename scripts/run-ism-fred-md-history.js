const { supplement } = require('./supplement-ism-fred-md-history');

const FRED_MD_CURRENT_URL = 'https://www.stlouisfed.org/-/media/project/frbstl/stlouisfed/research/fred-md/monthly/current.csv';
const REQUIRED_COLUMNS = ['NAPM', 'NAPMNOI', 'NAPMSDI'];

async function fetchCurrentFredMd(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch unavailable');
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetchImpl(FRED_MD_CURRENT_URL, {
        headers: {
          Accept: 'text/csv,*/*',
          Referer: 'https://www.stlouisfed.org/research/economists/mccracken/fred-databases',
          'User-Agent': 'Mozilla/5.0 DailyReview/1.0',
        },
      });
      if (!response?.ok) throw new Error(`FRED-MD HTTP ${response?.status ?? '--'}`);
      const text = await response.text();
      const header = String(text).split(/\r?\n/, 1)[0];
      const missing = REQUIRED_COLUMNS.filter((column) => !header.split(',').includes(column));
      if (missing.length) throw new Error(`FRED-MD current.csv missing ${missing.join(', ')}`);
      return text;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError;
}

async function main() {
  const text = await fetchCurrentFredMd();
  await supplement({ text, csvUrl: FRED_MD_CURRENT_URL });
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write((error.stack || error.message) + '\n');
    process.exitCode = 1;
  });
}

module.exports = { FRED_MD_CURRENT_URL, fetchCurrentFredMd };
