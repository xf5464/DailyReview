const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const distDirectory = path.join(projectRoot, 'dist');
const indexPath = path.join(distDirectory, 'index.html');
const appPath = path.join(distDirectory, 'app.js');

if (!fs.existsSync(indexPath) || !fs.existsSync(appPath)) {
  throw new Error('dist forecast files not found; run the normal build first.');
}

let html = fs.readFileSync(indexPath, 'utf8');
const fieldsetStart = html.indexOf('<fieldset class="forecast-data-options">');
const fieldsetEnd = fieldsetStart >= 0 ? html.indexOf('</fieldset>', fieldsetStart) : -1;
if (fieldsetStart < 0 || fieldsetEnd < 0) {
  throw new Error('Unable to patch forecast condition data list: fieldset not found.');
}

let fieldset = html.slice(fieldsetStart, fieldsetEnd);
fieldset = fieldset.replace(/(<input[^>]*name="forecastDataCondition"[^>]*?)\schecked(\s*\/?>)/g, '$1$2');

if (!fieldset.includes('value="centralBankGoldTrend"')) {
  fieldset += `
          <div class="forecast-data-option">
            <label class="forecast-data-option-check" for="forecastDataCentralBankGoldEnabled">全球央行净购金趋势<input id="forecastDataCentralBankGoldEnabled" type="checkbox" name="forecastDataCondition" value="centralBankGoldTrend" /></label>
            <label class="forecast-data-threshold" for="forecastDataCentralBankGoldThreshold"><span>较前 N 季均值提升至少</span><input class="level-select" id="forecastDataCentralBankGoldThreshold" type="number" name="forecastDataThreshold" data-kind="centralBankGoldTrend" min="0" max="500" step="1" inputmode="decimal" required /><span>%</span></label>
          </div>`;
}

if (!fieldset.includes('value="ismNewOrdersDrop"')) {
  fieldset += `
          <div class="forecast-data-option">
            <label class="forecast-data-option-check" for="forecastDataIsmNewOrdersEnabled">ISM 新订单急剧恶化<input id="forecastDataIsmNewOrdersEnabled" type="checkbox" name="forecastDataCondition" value="ismNewOrdersDrop" /></label>
            <label class="forecast-data-threshold" for="forecastDataIsmNewOrdersThreshold"><span>低于 50 且环比下降至少</span><input class="level-select" id="forecastDataIsmNewOrdersThreshold" type="number" name="forecastDataThreshold" data-kind="ismNewOrdersDrop" min="0" max="100" step="1" inputmode="decimal" required /><span>%</span></label>
          </div>`;
}

html = html.slice(0, fieldsetStart) + fieldset + html.slice(fieldsetEnd);
fs.writeFileSync(indexPath, html, 'utf8');

let source = fs.readFileSync(appPath, 'utf8');

const optionAnchor = "    { kind: 'sahm', chartId: 'sahmRule', label: '萨姆规则衰退指标', decimals: 2, unit: ' 个百分点' }";
if (!source.includes("kind: 'centralBankGoldTrend'")) {
  if (!source.includes(optionAnchor)) throw new Error('FORECAST_DATA_OPTIONS pattern changed.');
  source = source.replace(
    optionAnchor,
    optionAnchor + ",\n" +
      "    { kind: 'centralBankGoldTrend', chartId: 'centralBankGoldPurchases', label: '全球央行净购金趋势', decimals: 1, unit: '%' },\n" +
      "    { kind: 'ismNewOrdersDrop', chartId: 'ismNewOrders', label: 'ISM 新订单急剧恶化', decimals: 1, unit: '%' }"
  );
}

const sourceSeriesOld = [
  "    var chartId = kind === 'ndx'",
  "      ? 'ndx'",
  "      : (kind === 'vix' ? 'vix' : (kind === 'unemployment' ? 'unemploymentRate' : 'sahmRule'));",
].join('\n');
const sourceSeriesNew = [
  "    var chartId = kind === 'ndx'",
  "      ? 'ndx'",
  "      : (kind === 'vix' ? 'vix'",
  "        : (kind === 'unemployment' ? 'unemploymentRate'",
  "          : (kind === 'sahm' ? 'sahmRule'",
  "            : (kind === 'centralBankGoldTrend' ? 'centralBankGoldPurchases' : 'ismNewOrders'))));",
].join('\n');
if (!source.includes(sourceSeriesNew)) {
  if (!source.includes(sourceSeriesOld)) throw new Error('forecastSourceSeries pattern changed.');
  source = source.replace(sourceSeriesOld, sourceSeriesNew);
}

const backtestAnchor = "  function forecastBacktestSeries(kind, sourceItems) {\n    if (kind !== 'ndx') return sourceItems;";
if (!source.includes("    if (kind === 'centralBankGoldTrend') {")) {
  if (!source.includes(backtestAnchor)) throw new Error('forecastBacktestSeries pattern changed.');
  const replacement = [
    "  function forecastBacktestSeries(kind, sourceItems) {",
    "    if (kind === 'centralBankGoldTrend') {",
    "      var goldConfig = window.__CENTRAL_BANK_GOLD_TREND_CONFIG__ || {};",
    "      var baselineQuarters = Number.isInteger(Number(goldConfig.baselineQuarters)) && Number(goldConfig.baselineQuarters) > 0 ? Number(goldConfig.baselineQuarters) : 4;",
    "      var consecutiveQuarters = Number.isInteger(Number(goldConfig.consecutiveQuarters)) && Number(goldConfig.consecutiveQuarters) > 0 ? Number(goldConfig.consecutiveQuarters) : 2;",
    "      return sourceItems.map(function (item, index) {",
    "        if (index < Math.max(baselineQuarters, consecutiveQuarters)) return { date: item.date, value: Number.NEGATIVE_INFINITY };",
    "        var baseline = sourceItems.slice(index - baselineQuarters, index);",
    "        var average = baseline.reduce(function (sum, entry) { return sum + Number(entry.value); }, 0) / baseline.length;",
    "        var recent = sourceItems.slice(index - consecutiveQuarters, index + 1);",
    "        var rising = recent.slice(1).every(function (entry, recentIndex) { return Number(entry.value) > Number(recent[recentIndex].value); });",
    "        var rise = average > 0 ? (Number(item.value) - average) / average * 100 : Number.NEGATIVE_INFINITY;",
    "        return { date: item.date, value: rising ? rise : Number.NEGATIVE_INFINITY };",
    "      });",
    "    }",
    "    if (kind === 'ismNewOrdersDrop') {",
    "      return sourceItems.map(function (item, index) {",
    "        if (index === 0) return { date: item.date, value: Number.NEGATIVE_INFINITY };",
    "        var previous = Number(sourceItems[index - 1].value);",
    "        var current = Number(item.value);",
    "        var drop = previous > 0 ? (previous - current) / previous * 100 : Number.NEGATIVE_INFINITY;",
    "        return { date: item.date, value: current < 50 ? drop : Number.NEGATIVE_INFINITY };",
    "      });",
    "    }",
    "    if (kind !== 'ndx') return sourceItems;",
  ].join('\n');
  source = source.replace(backtestAnchor, replacement);
}

const defaultsOld = [
  "      unemployment: thresholds.unemploymentRatePercent,",
  "      sahm: thresholds.sahmRulePoints",
].join('\n');
const defaultsNew = [
  "      unemployment: thresholds.unemploymentRatePercent,",
  "      sahm: thresholds.sahmRulePoints,",
  "      centralBankGoldTrend: Number((window.__CENTRAL_BANK_GOLD_TREND_CONFIG__ || {}).riseThreshold || 25),",
  "      ismNewOrdersDrop: Number((window.__ISM_NEW_ORDERS_FORECAST_CONFIG__ || {}).dropThreshold || 10)",
].join('\n');
if (!source.includes(defaultsNew)) {
  if (!source.includes(defaultsOld)) throw new Error('forecastDataDefaults pattern changed.');
  source = source.replace(defaultsOld, defaultsNew);
}

if (source.includes('      input.checked = true;')) {
  source = source.replace('      input.checked = true;', '      input.checked = false;');
} else if (!source.includes('      input.checked = false;')) {
  throw new Error('showForecastData default selection pattern changed.');
}

fs.writeFileSync(appPath, source, 'utf8');
process.stdout.write('Forecast condition data list now mirrors all prediction conditions and defaults to unchecked.\n');
