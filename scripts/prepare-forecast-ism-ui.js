const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const distDirectory = path.join(projectRoot, 'dist');
const indexPath = path.join(distDirectory, 'index.html');
const configPath = path.join(distDirectory, 'forecast-ism-new-orders-config.js');
const featureSource = path.join(projectRoot, 'site', 'forecast-ism-new-orders.js');
const featureTarget = path.join(distDirectory, 'forecast-ism-new-orders.js');

function number(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const config = {
  dropThreshold: number(process.env.ISM_NEW_ORDERS_DROP_THRESHOLD, 10),
};

if (!fs.existsSync(indexPath)) throw new Error('dist/index.html not found; run the normal build first.');
if (!fs.existsSync(featureSource)) throw new Error('site/forecast-ism-new-orders.js not found.');

fs.copyFileSync(featureSource, featureTarget);
fs.writeFileSync(
  configPath,
  `window.__ISM_NEW_ORDERS_FORECAST_CONFIG__ = ${JSON.stringify(config)};\n`,
  'utf8',
);

let html = fs.readFileSync(indexPath, 'utf8');
const marker = '</body>';
const scripts = [
  '    <script src="forecast-ism-new-orders-config.js"></script>',
  '    <script src="forecast-ism-new-orders.js" defer></script>',
].join('\n');
if (!html.includes('forecast-ism-new-orders.js')) {
  if (!html.includes(marker)) throw new Error('Unable to inject ISM forecast UI scripts: </body> not found.');
  html = html.replace(marker, `${scripts}\n  ${marker}`);
  fs.writeFileSync(indexPath, html, 'utf8');
}

process.stdout.write(`Prepared ISM new-orders forecast UI with drop threshold=${config.dropThreshold}%.\n`);
