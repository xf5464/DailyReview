const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const CONDITION_DEFINITIONS = [
  { id: "ndx", label: "NDX 距离最高点下降", thresholdEnv: "NDX_DRAWDOWN_THRESHOLD", defaultThreshold: 30, unit: "%" },
  { id: "vix", label: "VIX", thresholdEnv: "VIX_THRESHOLD", defaultThreshold: 30, unit: "" },
  { id: "unemploymentRate", label: "美国失业率", thresholdEnv: "UNEMPLOYMENT_THRESHOLD", defaultThreshold: 6, unit: "%" },
  { id: "sahmRule", label: "萨姆规则", thresholdEnv: "SAHM_THRESHOLD", defaultThreshold: 0.5, unit: "" },
];

const CENTRAL_BANK_GOLD_DEFAULTS = {
  baselineQuarters: 4,
  riseThreshold: 25,
  consecutiveQuarters: 2,
};

function readNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readPositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeSeries(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({ date: String(item.date || ""), value: Number(item.value) }))
    .filter((item) => item.date && Number.isFinite(item.value))
    .sort((left, right) => left.date.localeCompare(right.date));
}

function ndxDrawdownSeries(items) {
  let highValue = Number.NEGATIVE_INFINITY;
  let highDate = "";
  return normalizeSeries(items).map((item) => {
    if (item.value >= highValue) {
      highValue = item.value;
      highDate = item.date;
    }
    return {
      date: item.date,
      value: highValue > 0 ? ((highValue - item.value) / highValue) * 100 : 0,
      indexValue: item.value,
      highDate,
      highValue,
    };
  });
}

function activeCondition(definition, items, threshold) {
  const series = definition.id === "ndx" ? ndxDrawdownSeries(items) : normalizeSeries(items);
  const latest = series.at(-1);
  if (!latest || latest.value < threshold) return null;

  let startIndex = series.length - 1;
  while (startIndex > 0 && series[startIndex - 1].value >= threshold) startIndex -= 1;
  return {
    ...definition,
    threshold,
    date: latest.date,
    value: latest.value,
    episodeStart: series[startIndex].date,
    ...(definition.id === "ndx"
      ? { indexValue: latest.indexValue, highDate: latest.highDate, highValue: latest.highValue }
      : {}),
  };
}

function centralBankGoldTrendCondition(items, env = process.env) {
  const series = normalizeSeries(items);
  const baselineQuarters = readPositiveInteger(
    env.CENTRAL_BANK_GOLD_BASE_QUARTERS,
    CENTRAL_BANK_GOLD_DEFAULTS.baselineQuarters,
  );
  const riseThreshold = readNumber(
    env.CENTRAL_BANK_GOLD_RISE_THRESHOLD,
    CENTRAL_BANK_GOLD_DEFAULTS.riseThreshold,
  );
  const consecutiveQuarters = readPositiveInteger(
    env.CENTRAL_BANK_GOLD_CONSECUTIVE_QUARTERS,
    CENTRAL_BANK_GOLD_DEFAULTS.consecutiveQuarters,
  );

  const minimumPoints = Math.max(baselineQuarters + 1, consecutiveQuarters + 1);
  if (series.length < minimumPoints) return null;

  const latest = series.at(-1);
  const baselineItems = series.slice(-(baselineQuarters + 1), -1);
  const baselineAverage = baselineItems.reduce((sum, item) => sum + item.value, 0) / baselineItems.length;
  if (!(baselineAverage > 0)) return null;

  const risePercent = ((latest.value - baselineAverage) / baselineAverage) * 100;
  const recent = series.slice(-(consecutiveQuarters + 1));
  const consecutiveRise = recent.slice(1).every((item, index) => item.value > recent[index].value);
  if (risePercent < riseThreshold || !consecutiveRise) return null;

  return {
    id: "centralBankGoldPurchases",
    label: "全球央行净购金趋势启动",
    threshold: riseThreshold,
    unit: "%",
    date: latest.date,
    value: risePercent,
    episodeStart: recent[0].date,
    latestPurchaseTonnes: latest.value,
    baselineAverageTonnes: baselineAverage,
    baselineQuarters,
    consecutiveQuarters,
    consecutiveRise,
  };
}

function buildAlert(seriesById, env = process.env, fetchedAt = new Date().toISOString()) {
  const conditions = CONDITION_DEFINITIONS
    .map((definition) => activeCondition(
      definition,
      seriesById[definition.id],
      readNumber(env[definition.thresholdEnv], definition.defaultThreshold),
    ))
    .filter(Boolean);

  const goldTrend = centralBankGoldTrendCondition(seriesById.centralBankGoldPurchases, env);
  if (goldTrend) conditions.push(goldTrend);

  const identity = conditions
    .map((condition) => `${condition.id}:${condition.threshold}:${condition.episodeStart}`)
    .sort()
    .join("|");
  const fingerprint = identity
    ? crypto.createHash("sha256").update(identity).digest("hex").slice(0, 20)
    : "none";

  return {
    shouldNotify: conditions.length > 0,
    fingerprint,
    fetchedAt,
    conditions,
  };
}

function loadOfflineSeries(distDirectory) {
  const manifestPath = path.join(distDirectory, "data", "offline-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const wantedIds = new Set([
    ...CONDITION_DEFINITIONS.map((definition) => definition.id),
    "centralBankGoldPurchases",
  ]);
  const seriesById = {};

  for (const chart of manifest.charts || []) {
    if (!wantedIds.has(chart.id)) continue;
    seriesById[chart.id] = (chart.chunks || []).flatMap((chunk) => {
      const chunkPath = path.join(distDirectory, ...String(chunk.path).split("/"));
      return JSON.parse(fs.readFileSync(chunkPath, "utf8"));
    });
  }
  return { seriesById, fetchedAt: manifest.fetchedAt };
}

function writeGithubOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

function main() {
  const outputIndex = process.argv.indexOf("--output");
  const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : ".forecast-alert.json";
  const distDirectory = path.resolve(process.cwd(), "dist");
  const { seriesById, fetchedAt } = loadOfflineSeries(distDirectory);
  const alert = buildAlert(seriesById, process.env, fetchedAt);
  fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(alert, null, 2)}\n`);
  writeGithubOutput("should_notify", String(alert.shouldNotify));
  writeGithubOutput("fingerprint", alert.fingerprint);
  console.log(alert.shouldNotify
    ? `Forecast alert matched ${alert.conditions.length} condition(s).`
    : "Forecast alert did not match any condition.");
}

if (require.main === module) main();

module.exports = {
  activeCondition,
  buildAlert,
  centralBankGoldTrendCondition,
  ndxDrawdownSeries,
  normalizeSeries,
};
