const fs = require('node:fs');
const path = require('node:path');

const appPath = path.resolve(__dirname, '..', 'dist', 'app.js');

function patchApp(source) {
  const oldPrimary = "      group_primary: ['treasuryYield30', 'cpi', 'unemploymentRate', 'gold', 'sp500', 'brentOil', 'federalFundsRate', 'copper', 'centralBankGoldPurchases'],";
  const newPrimary = "      group_primary: ['treasuryYield30', 'cpi', 'unemploymentRate', 'gold', 'sp500', 'vix', 'brentOil', 'federalFundsRate', 'copper', 'centralBankGoldPurchases'],";
  const oldVix = "      vix: ['default', 'group_mt432xl1_kz1mx7'],";
  const newVix = "      vix: ['default', 'group_mt432xl1_kz1mx7', 'group_primary'],";

  if (!source.includes(newPrimary)) {
    if (!source.includes(oldPrimary)) throw new Error('primary group list pattern changed');
    source = source.replace(oldPrimary, newPrimary);
  }
  if (!source.includes(newVix)) {
    if (!source.includes(oldVix)) throw new Error('VIX chart group pattern changed');
    source = source.replace(oldVix, newVix);
  }
  return source;
}

function main() {
  if (!fs.existsSync(appPath)) throw new Error('dist/app.js missing; run normal build first');
  const source = fs.readFileSync(appPath, 'utf8');
  fs.writeFileSync(appPath, patchApp(source), 'utf8');
  process.stdout.write('Added VIX to the primary group.\n');
}

if (require.main === module) main();

module.exports = { patchApp };
