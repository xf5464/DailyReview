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
  const webhook = process.env.WECHAT_WEBHOOK;
  if (!webhook) throw new Error("WECHAT_WEBHOOK is not configured.");

  const alertPath = path.resolve(process.cwd(), ".forecast-alert.json");
  const alert = JSON.parse(fs.readFileSync(alertPath, "utf8"));

  if (!alert.shouldNotify || !Array.isArray(alert.conditions) || alert.conditions.length === 0) {
    console.log("No active forecast conditions; WeCom notification skipped.");
    return;
  }

  const lines = [
    `**[DailyReview] ${alert.conditions.length} 项预测条件已达到要求**`,
    "",
    ...alert.conditions.flatMap((condition) => [
      `> ${condition.label}：${formatValue(condition)}`,
      "",
    ]),
    `数据构建时间：${alert.fetchedAt || "未知"}`,
  ];

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      msgtype: "markdown",
      markdown: { content: lines.join("\n") },
    }),
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`WeCom HTTP ${response.status}: ${text}`);

  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(`Unexpected WeCom response: ${text}`);
  }

  if (result.errcode !== 0) {
    throw new Error(`WeCom ${result.errcode}: ${result.errmsg || "unknown error"}`);
  }

  console.log(`WeCom notification sent for ${alert.conditions.length} condition(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
