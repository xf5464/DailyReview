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
  const forceTest = String(process.env.FORCE_NOTIFICATION_TEST || "").toLowerCase() === "true";
  const hasConditions = alert.shouldNotify && Array.isArray(alert.conditions) && alert.conditions.length > 0;

  if (!hasConditions && !forceTest) {
    console.log("No active forecast conditions; WeCom notification skipped.");
    return;
  }

  const lines = hasConditions
    ? [
        `**[DailyReview] ${alert.conditions.length} 项预测条件已达到要求**`,
        "",
        ...alert.conditions.flatMap((condition) => [
          `> ${condition.label}：${formatValue(condition)}`,
          "",
        ]),
        `数据构建时间：${alert.fetchedAt || "未知"}`,
      ]
    : [
        "**[DailyReview] 企业微信通知测试成功**",
        "",
        "> 这是一条由 GitHub Actions 强制发送的测试通知。",
        "",
        "> 当前没有预测条件达到要求，但测试选项已开启，因此仍执行推送。",
        "",
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

  console.log(hasConditions
    ? `WeCom notification sent for ${alert.conditions.length} condition(s).`
    : "WeCom test notification sent with no active conditions.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
