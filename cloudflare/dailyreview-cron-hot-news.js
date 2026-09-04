// Add these workflow dispatch helpers to the existing dailyreview-cron Worker.
// Cloudflare Cron uses UTC:
// - `17 4,10,16,22 * * *` sends email at 12:17, 18:17, 00:17 and 06:17 China time.
// - `*/30 * * * *` refreshes the reader every 30 minutes without sending email.

const GITHUB_API = "https://api.github.com/repos/xf5464/DailyReview/actions/workflows";
const EMAIL_CRONS = new Set([
  "17 4,10,16,22 * * *",
  "17 4 * * *",
  "17 10 * * *",
  "17 16 * * *",
  "17 22 * * *",
]);
const READER_REFRESH_CRON = "*/30 * * * *";

async function dispatchWorkflow(env, workflow, inputs) {
  const response = await fetch(`${GITHUB_API}/${workflow}/dispatches`, {
    method: "POST",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "content-type": "application/json",
      "user-agent": "dailyreview-cron",
      "x-github-api-version": "2026-03-10",
    },
    body: JSON.stringify({ ref: "main", inputs }),
  });
  if (!response.ok) throw new Error(`${workflow} dispatch failed: HTTP ${response.status} ${await response.text()}`);
}

export async function sendDailyHotNews(event, env) {
  if (event.cron === READER_REFRESH_CRON) {
    await dispatchWorkflow(env, "send-hot-news.yml", {
      trigger_source: "cloudflare-refresh",
      window_hours: "30",
      refresh_only: "true",
    });
    return true;
  }
  if (!EMAIL_CRONS.has(event.cron)) return false;
  await dispatchWorkflow(env, "send-hot-news.yml", {
    trigger_source: "cloudflare",
    window_hours: "30",
    refresh_only: "false",
  });
  return true;
}

export async function sendHotNewsNow(env) {
  await dispatchWorkflow(env, "send-hot-news.yml", {
    trigger_source: "cloudflare-manual",
    window_hours: "30",
    refresh_only: "false",
  });
}

export async function refreshReaderNow(env) {
  await dispatchWorkflow(env, "send-hot-news.yml", {
    trigger_source: "cloudflare-refresh-manual",
    window_hours: "30",
    refresh_only: "true",
  });
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendDailyHotNews(event, env));
  },

  async fetch() {
    return Response.json({
      service: "DailyReview Cron Hot News",
      status: "ok",
      emailCron: "17 4,10,16,22 * * *",
      readerRefreshCron: "*/30 * * * *",
    });
  },
};
