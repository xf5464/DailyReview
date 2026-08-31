const fs = require("node:fs");
const nodemailer = require("nodemailer");

function requiredEnvironment(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function recipients(value) {
  const result = String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
  if (!result.length) throw new Error("ALERT_EMAIL_TO must contain at least one email address.");
  return result;
}

function formatNumber(value, digits = 2) {
  return Number(value).toLocaleString("zh-CN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function conditionLine(condition) {
  const base = `${condition.label}：${formatNumber(condition.value)}${condition.unit}（要求 ≥ ${formatNumber(condition.threshold)}${condition.unit}，数据日期 ${condition.date}）`;
  if (condition.id !== "ndx") return base;
  return `${base}；最高点 ${formatNumber(condition.highValue)}（${condition.highDate}），当前 NDX ${formatNumber(condition.indexValue)}`;
}

function triggerType() {
  return String(process.env.GITHUB_EVENT_NAME || "unknown").trim() || "unknown";
}

function messageFromAlert(alert) {
  const lines = alert.conditions.map(conditionLine);
  return {
    subject: `[DailyReview] ${alert.conditions.length} 项预测条件已达到要求`,
    text: [
      "DailyReview 自动构建检测到以下预测条件已达到要求：",
      "",
      ...lines.map((line) => `- ${line}`),
      "",
      `触发方式：${triggerType()}`,
      `数据构建时间：${alert.fetchedAt}`,
      "同一轮持续满足的条件不会重复发送；条件解除后再次达到时会重新提醒。",
    ].join("\n"),
  };
}

function testMessage() {
  return {
    subject: "[DailyReview] Gmail 邮件提醒测试成功",
    text: [
      "这是一封由 DailyReview GitHub Actions 主动发送的测试邮件。",
      "",
      "Gmail SMTP、应用专用密码以及逗号分隔的收件人配置均已成功工作。",
      `触发方式：${triggerType()}`,
      "之后自动构建会检查预测条件，并在达到要求时发送提醒。",
    ].join("\n"),
  };
}

async function main() {
  const username = requiredEnvironment("GMAIL_USERNAME");
  const password = requiredEnvironment("GMAIL_APP_PASSWORD").replace(/\s+/g, "");
  const to = recipients(requiredEnvironment("ALERT_EMAIL_TO"));
  const isTest = process.argv.includes("--test");
  const message = isTest
    ? testMessage()
    : messageFromAlert(JSON.parse(fs.readFileSync(".forecast-alert.json", "utf8")));
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: username, pass: password },
  });
  const result = await transport.sendMail({ from: username, to, ...message });
  console.log(`Email accepted for ${result.accepted.length} recipient(s).`);
  if (result.rejected.length) throw new Error(`Email rejected for ${result.rejected.length} recipient(s).`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { conditionLine, messageFromAlert, recipients, testMessage, triggerType };
