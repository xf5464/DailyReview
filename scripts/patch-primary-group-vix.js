const fs = require('node:fs');
const path = require('node:path');

const appPath = path.resolve(__dirname, '..', 'dist', 'app.js');

function patchApp(source) {
  const currentPrimary = "      group_primary: ['usEconomicCalendar', 'treasuryYield30', 'broadDollar', 'cpi', 'pce', 'unemploymentRate', 'vix', 'brentOil', 'gold', 'sp500', 'federalFundsRate', 'copper', 'centralBankGoldPurchases'],";
  const currentVix = "      vix: ['default', 'group_mt432xl1_kz1mx7', 'group_primary'],";
  const migrationSource = "      var migratedMemberships = (DEFAULT_CONFIG.chartGroups[id] || []).filter(function (groupId) {\n        return groupIds.has(groupId) && (newlyAddedChartIds.includes(id) || addedDefaultGroupIds.has(groupId));\n      });";
  const migrationReplacement = "      var migratedMemberships = (DEFAULT_CONFIG.chartGroups[id] || []).filter(function (groupId) {\n        var forcedPrimaryMigration = ['broadDollar', 'pce', 'vix'].includes(id) && groupId === 'group_primary';\n        return groupIds.has(groupId) && (newlyAddedChartIds.includes(id) || addedDefaultGroupIds.has(groupId) || forcedPrimaryMigration);\n      });";

  if (!source.includes(currentPrimary)) throw new Error('primary group list pattern changed');
  if (!source.includes(currentVix)) throw new Error('VIX chart group pattern changed');
  if (!source.includes(migrationReplacement)) {
    if (!source.includes(migrationSource)) throw new Error('chart group migration pattern changed');
    source = source.replace(migrationSource, migrationReplacement);
  }
  return source;
}

function main() {
  if (!fs.existsSync(appPath)) throw new Error('dist/app.js missing; run normal build first');
  const source = fs.readFileSync(appPath, 'utf8');
  fs.writeFileSync(appPath, patchApp(source), 'utf8');
  process.stdout.write('Migrated the expanded primary group into existing saved configs.\n');
}

if (require.main === module) main();

module.exports = { patchApp };
