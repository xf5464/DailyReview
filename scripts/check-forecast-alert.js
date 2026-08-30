const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const CONDITION_DEFINITIONS = [
  { id: "ndx", label: "NDX 距离最高点下降", thresholdEnv: "NDX_DRAWDOWN_THRESHOLD", defaultThreshold: 30, unit: "%" },
  { id: "vix", label: "VIX", thresholdEnv: "VIX_THRESHOLD", defaultThreshold: 30, unit: "" },
  { id: "unemploymentRate", label: "美国失业率", thresholdEnv: "UNEMPLOYMENT_THRESHOLD", defaultThreshold: 6, unit: "%" },
  { id: "sahmRule", label: "萨姆规则", thresholdEnv: "SAHM_THRESHOLD", defaultThreshold: 0.5, unit: "" },
];

function readNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function buildAlert(seriesById, env = process.env, fetchedAt = new Date().toISOString()) {
  const conditions = CONDITION_DEFINITIONS
    .map((definition) => activeCondition(
      definition,
      seriesById[definition.id],
      readNumber(env[definition.thresholdEnv], definition.defaultThreshold),
    ))
    .filter(Boolean);
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
  const wantedIds = new Set(CONDITION_DEFINITIONS.map((definition) => definition.id));
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

module.exports = { activeCondition, buildAlert, ndxDrawdownSeries, normalizeSeries };
