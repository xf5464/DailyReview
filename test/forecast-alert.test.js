const test = require("node:test");
const assert = require("node:assert/strict");

const { buildAlert, ndxDrawdownSeries } = require("../scripts/check-forecast-alert");
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

test("comma-separated recipients are trimmed and empty entries ignored", () => {
  assert.deepEqual(recipients("a@example.com, b@example.com, ,c@example.com"), [
    "a@example.com",
    "b@example.com",
    "c@example.com",
  ]);
});
