// Add this workflow dispatch to the existing dailyreview-cron Worker.
// The Cron Trigger `17 22 * * *` is 06:17 in China Standard Time (UTC+8).

const GITHUB_API = "https://api.github.com/repos/xf5464/DailyReview/actions/workflows";

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
  if (event.cron !== "17 22 * * *") return false;
  await dispatchWorkflow(env, "send-hot-news.yml", { trigger_source: "cloudflare", window_hours: "30" });
  return true;
}

export async function sendHotNewsNow(env) {
  await dispatchWorkflow(env, "send-hot-news.yml", { trigger_source: "cloudflare-manual", window_hours: "30" });
}
