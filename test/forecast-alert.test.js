const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildAlert,
  centralBankGoldTrendCondition,
  ismNewOrdersDeteriorationCondition,
  ndxDrawdownSeries,
} = require("../scripts/check-forecast-alert");
const { recipients } = require("../scripts/send-forecast-email");

test("NDX alert uses drawdown from the running high", () => {
  const points = ndxDrawdownSeries([
    { date: "2026-01-01", value: 100 },
    { date: "2026-01-02", value: 110 },
    { date: "2026-01-03", value: 77 },
  ]);
  assert.equal(points.at(-1).value, 30);
  assert.equal(points.at(-1).highDate, "2026-01-02");
  assert.equal(points.at(-1).highValue, 110);
});

test("alert fires when any latest prediction condition meets its threshold", () => {
  const alert = buildAlert({
    ndx: [{ date: "2026-01-01", value: 100 }, { date: "2026-01-02", value: 69 }],
    vix: [{ date: "2026-01-02", value: 20 }],
    unemploymentRate: [{ date: "2026-01-01", value: 4 }],
    sahmRule: [{ date: "2026-01-01", value: 0.2 }],
  }, {}, "2026-01-02T00:00:00Z");
  assert.equal(alert.shouldNotify, true);
  assert.equal(alert.conditions.length, 1);
  assert.equal(alert.conditions[0].id, "ndx");
  assert.equal(alert.conditions[0].episodeStart, "2026-01-02");
  assert.notEqual(alert.fingerprint, "none");
});

test("alert remains inactive when no latest value meets a threshold", () => {
  const alert = buildAlert({
    ndx: [{ date: "2026-01-01", value: 100 }, { date: "2026-01-02", value: 80 }],
    vix: [{ date: "2026-01-02", value: 20 }],
    unemploymentRate: [{ date: "2026-01-01", value: 4 }],
    sahmRule: [{ date: "2026-01-01", value: 0.2 }],
  }, {});
  assert.equal(alert.shouldNotify, false);
  assert.equal(alert.fingerprint, "none");
});

test("central bank gold trend fires at 25 percent above prior four-quarter average with two consecutive rises", () => {
  const condition = centralBankGoldTrendCondition([
    { date: "2025-01-01", value: 180 },
    { date: "2025-04-01", value: 200 },
    { date: "2025-07-01", value: 190 },
    { date: "2025-10-01", value: 210 },
    { date: "2026-01-01", value: 240 },
    { date: "2026-04-01", value: 270 },
  ], {
    CENTRAL_BANK_GOLD_BASE_QUARTERS: "4",
    CENTRAL_BANK_GOLD_RISE_THRESHOLD: "25",
    CENTRAL_BANK_GOLD_CONSECUTIVE_QUARTERS: "2",
  });

  assert.ok(condition);
  assert.equal(condition.id, "centralBankGoldPurchases");
  assert.equal(condition.latestPurchaseTonnes, 270);
  assert.equal(condition.baselineQuarters, 4);
  assert.equal(condition.consecutiveQuarters, 2);
  assert.equal(condition.consecutiveRise, true);
  assert.ok(condition.value >= 25);
});

test("central bank gold trend stays inactive without consecutive increases", () => {
  const condition = centralBankGoldTrendCondition([
    { date: "2025-01-01", value: 150 },
    { date: "2025-04-01", value: 160 },
    { date: "2025-07-01", value: 170 },
    { date: "2025-10-01", value: 180 },
    { date: "2026-01-01", value: 300 },
    { date: "2026-04-01", value: 260 },
  ], {
    CENTRAL_BANK_GOLD_BASE_QUARTERS: "4",
    CENTRAL_BANK_GOLD_RISE_THRESHOLD: "25",
    CENTRAL_BANK_GOLD_CONSECUTIVE_QUARTERS: "2",
  });
  assert.equal(condition, null);
});

test("ISM new orders deterioration fires below 50 with at least a 10 percent monthly drop", () => {
  const condition = ismNewOrdersDeteriorationCondition([
    { date: "2020-02-01", value: 49.8 },
    { date: "2020-03-01", value: 42.2 },
  ], { ISM_NEW_ORDERS_DROP_THRESHOLD: "10" });

  assert.ok(condition);
  assert.equal(condition.id, "ismNewOrdersDeterioration");
  assert.equal(condition.latestLevel, 42.2);
  assert.equal(condition.previousLevel, 49.8);
  assert.ok(condition.value >= 10);
});

test("ISM new orders deterioration stays inactive if either requirement is missing", () => {
  assert.equal(ismNewOrdersDeteriorationCondition([
    { date: "2026-01-01", value: 55 },
    { date: "2026-02-01", value: 49.9 },
  ], { ISM_NEW_ORDERS_DROP_THRESHOLD: "10" }), null);

  assert.equal(ismNewOrdersDeteriorationCondition([
    { date: "2026-01-01", value: 52 },
    { date: "2026-02-01", value: 50.1 },
  ], { ISM_NEW_ORDERS_DROP_THRESHOLD: "1" }), null);
});

test("comma-separated recipients are trimmed and empty entries ignored", () => {
  assert.deepEqual(recipients("a@example.com, b@example.com, ,c@example.com"), [
    "a@example.com",
    "b@example.com",
    "c@example.com",
  ]);
});
