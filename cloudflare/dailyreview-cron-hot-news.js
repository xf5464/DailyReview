const CRON = "17 1,4,7,10,13,16,19,22 * * *";

export async function dispatchCollection(env) {
  const response = await fetch(
    "https://api.github.com/repos/xf5464/DailyReview/actions/workflows/collect-dailyreview.yml/dispatches",
    {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${env.GITHUB_TOKEN}`,
        "content-type": "application/json",
        "user-agent": "dailyreview-cron",
      },
      body: JSON.stringify({ ref: "main" }),
    }
  );
  if (!response.ok) throw new Error("Collection dispatch failed: HTTP " + response.status);
}

export default {
  async scheduled(event, env, ctx) {
    if (event.cron === CRON) ctx.waitUntil(dispatchCollection(env));
  },
  async fetch() {
    return Response.json({
      service: "DailyReview Cron",
      status: "ok",
      collectionCron: CRON,
      timezone: "UTC",
      beijingTimes: ["06:17", "09:17", "12:17", "15:17", "18:17", "21:17", "00:17", "03:17"],
    });
  },
};
