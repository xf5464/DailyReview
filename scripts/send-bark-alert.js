const fs = require("node:fs");
const path = require("node:path");

function formatValue(condition) {
  const value = Number(condition.value);
  const threshold = Number(condition.threshold);
  const digits = Number.isInteger(value) ? 0 : 2;
  const thresholdDigits = Number.isInteger(threshold) ? 0 : 2;
  const unit = condition.unit || "";
  return `${value.toFixed(digits)}${unit}（要求 ≥ ${threshold.toFixed(thresholdDigits)}${unit}，数据日期 ${condition.date}）`;
}

async function main() {
  const barkKey = process.env.BARK_KEY;
  if (!barkKey) throw new Error("BARK_KEY is not configured.");

  const alertPath = path.resolve(process.cwd(), ".forecast-alert.json");
  const alert = JSON.parse(fs.readFileSync(alertPath, "utf8"));
  const forceTest = String(process.env.FORCE_NOTIFICATION_TEST || "").toLowerCase() === "true";
  const hasConditions = alert.shouldNotify && Array.isArray(alert.conditions) && alert.conditions.length > 0;

  if (!hasConditions && !forceTest) {
    console.log("No active forecast conditions; Bark notification skipped.");
    return;
  }

  const title = hasConditions
    ? `[DailyReview] ${alert.conditions.length} 项预测条件已达到要求`
    : "[DailyReview] Bark 推送测试成功";
  const body = hasConditions
    ? [
        ...alert.conditions.map((condition) => `${condition.label}：${formatValue(condition)}`),
        `数据构建时间：${alert.fetchedAt || "未知"}`,
      ].join("\n")
    : [
        "这是一条由 GitHub Actions 强制发送的测试通知。",
        "当前没有预测条件达到要求，但测试选项已开启，因此仍执行推送。",
        `数据构建时间：${alert.fetchedAt || "未知"}`,
      ].join("\n");

  const response = await fetch("https://api.day.app/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      device_key: barkKey,
      title,
      body,
      group: "DailyReview",
    }),
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`Bark HTTP ${response.status}: ${text}`);

  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(`Unexpected Bark response: ${text}`);
  }

  if (result.code !== 200) {
    throw new Error(`Bark ${result.code}: ${result.message || result.msg || "unknown error"}`);
  }

  console.log(hasConditions
    ? `Bark notification sent for ${alert.conditions.length} condition(s).`
    : "Bark test notification sent with no active conditions.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
