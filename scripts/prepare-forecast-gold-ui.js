const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const distDirectory = path.join(projectRoot, 'dist');
const indexPath = path.join(distDirectory, 'index.html');
const configPath = path.join(distDirectory, 'forecast-gold-trend-config.js');
const featureSource = path.join(projectRoot, 'site', 'forecast-gold-trend.js');
const featureTarget = path.join(distDirectory, 'forecast-gold-trend.js');

function number(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const config = {
  baselineQuarters: positiveInteger(process.env.CENTRAL_BANK_GOLD_BASE_QUARTERS, 4),
  riseThreshold: number(process.env.CENTRAL_BANK_GOLD_RISE_THRESHOLD, 25),
  consecutiveQuarters: positiveInteger(process.env.CENTRAL_BANK_GOLD_CONSECUTIVE_QUARTERS, 2),
};

if (!fs.existsSync(indexPath)) throw new Error('dist/index.html not found; run the normal build first.');
if (!fs.existsSync(featureSource)) throw new Error('site/forecast-gold-trend.js not found.');

fs.copyFileSync(featureSource, featureTarget);
fs.writeFileSync(
  configPath,
  `window.__CENTRAL_BANK_GOLD_TREND_CONFIG__ = ${JSON.stringify(config)};\n`,
  'utf8',
);

let html = fs.readFileSync(indexPath, 'utf8');
const marker = '</body>';
const scripts = [
  '    <script src="forecast-gold-trend-config.js"></script>',
  '    <script src="forecast-gold-trend.js" defer></script>',
].join('\n');
if (!html.includes('forecast-gold-trend.js')) {
  if (!html.includes(marker)) throw new Error('Unable to inject forecast gold UI scripts: </body> not found.');
  html = html.replace(marker, `${scripts}\n  ${marker}`);
  fs.writeFileSync(indexPath, html, 'utf8');
}

process.stdout.write(
  `Prepared central-bank gold forecast UI with baseline=${config.baselineQuarters}, rise=${config.riseThreshold}%, consecutive=${config.consecutiveQuarters}.\n`,
);
