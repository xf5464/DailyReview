const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const {
  NEWS_SOURCES, environmentFlag, isPaywalledItem, isSimilarTitle, newsMessage, parseRssItems, rankAndDedupe,
  readerUrl, recipients, resolveGoogleNewsItems, resolveGoogleNewsUrl,
  youtubeItemsFromResponses,
} = require("../scripts/send-hot-news-email");

test("uses ten fixed free sources for each reader tab", () => {
  assert.equal(NEWS_SOURCES.tech.length, 10);
  assert.equal(NEWS_SOURCES.market.length, 10);
  assert.equal(new Set(NEWS_SOURCES.tech.map((source) => source.key)).size, 10);
  assert.equal(new Set(NEWS_SOURCES.market.map((source) => source.key)).size, 10);
});

test("reader shows the latest snapshot without hour filters", () => {
  const html = fs.readFileSync("site/reader/index.html", "utf8");
  const script = fs.readFileSync("site/reader/reader.js", "utf8");
  assert.doesNotMatch(html, /time-tab|6小时|12小时|18小时|24小时/);
  assert.doesNotMatch(script, /activeHours|selectHours|timeTabs/);
  assert.match(html, /v2026\.09\.05\.18/);
  assert.match(html, /data-category="youtube"[^>]*>YouTube</);
  assert.match(script, /'tech', 'market', 'youtube'/);
});

test("orders YouTube results by views and creates direct video links", () => {
  const search = { items: [
    { id: { videoId: "low" } }, { id: { videoId: "high" } },
  ] };
  const videos = { items: [
    { id: "low", snippet: { title: "Low", channelTitle: "A", publishedAt: "2026-09-05T01:00:00Z" }, statistics: { viewCount: "10" } },
    { id: "high", snippet: { title: "High", channelTitle: "B", publishedAt: "2026-09-05T02:00:00Z" }, statistics: { viewCount: "100" } },
  ] };
  const items = youtubeItemsFromResponses(search, videos);
  assert.deepEqual(items.map((item) => item.title), ["High", "Low"]);
  assert.equal(items[0].category, "youtube");
  assert.equal(items[0].url, "https://www.youtube.com/watch?v=high");
  assert.equal(items[0].source, "B");
  assert.match(items[0].engagement, /100 次观看/);
});

test("parses Google News RSS and removes source suffix", () => {
  const xml = `<rss><channel><item><title><![CDATA[Nvidia launches a new chip - Reuters]]></title><link>https://example.com/a?x=1&amp;y=2</link><pubDate>Fri, 04 Sep 2026 01:00:00 GMT</pubDate><source url="https://reuters.com">Reuters</source></item></channel></rss>`;
  assert.deepEqual(parseRssItems(xml, "tech")[0], {
    category: "tech", title: "Nvidia launches a new chip", url: "https://example.com/a?x=1&y=2",
    source: "Reuters", publishedAt: "Fri, 04 Sep 2026 01:00:00 GMT", feedRank: 0, score: 0,
  });
});

test("deduplicates substantially similar headlines", () => {
  assert.equal(isSimilarTitle("Nvidia launches new AI chip for data centers", "Breaking: Nvidia launches a new AI chip for data centers"), true);
  const now = Date.parse("2026-09-04T02:00:00Z");
  const items = [
    { category: "tech", title: "Nvidia launches new AI chip for data centers", url: "a", source: "Reuters", publishedAt: "2026-09-04T01:00:00Z", feedRank: 0 },
    { category: "tech", title: "Breaking: Nvidia launches a new AI chip for data centers", url: "b", source: "Other", publishedAt: "2026-09-04T00:00:00Z", feedRank: 1 },
    { category: "tech", title: "Apple updates iPhone software", url: "c", source: "The Verge", publishedAt: "2026-09-04T00:30:00Z", feedRank: 2 },
  ];
  assert.equal(rankAndDedupe(items, 10, now).length, 2);
});

test("places a Chinese translation directly below each English headline", () => {
  process.env.READER_BASE_URL = "https://xf5464.github.io/DailyReview/reader/";
  const item = { title: "Test & news", titleZh: "测试新闻", url: "https://example.com?a=1&b=2", source: "Reuters", publishedAt: "2026-09-04T01:00:00Z", score: 88 };
  const message = newsMessage({ tech: [item], market: [item], failureCount: 0, fetchedAt: "2026-09-04T02:00:00Z" });
  assert.match(message.subject, /海外科技与美股热点/);
  assert.match(message.subject, /2026\/09\/04 10:00/);
  assert.match(message.text, /全球科技热点 Top 10/);
  assert.match(message.text, /美股热点 Top 10/);
  assert.match(message.text, /中文：测试新闻/);
  assert.match(message.html, /Test &amp; news/);
  assert.match(message.html, /测试新闻/);
  assert.match(message.html, /中文阅读全文/);
  assert.match(message.html, /DailyReview\/reader\/\?url=/);
  assert.match(message.text, /中文阅读：https:\/\/xf5464\.github\.io\/DailyReview\/reader\//);
  delete process.env.READER_BASE_URL;
});

test("builds a reader URL without losing characters in the source URL", () => {
  process.env.READER_BASE_URL = "https://xf5464.github.io/DailyReview/reader/";
  const original = "https://example.com/story?a=1&b=two words";
  const translated = new URL(readerUrl(original));
  assert.equal(translated.pathname, "/DailyReview/reader/");
  assert.equal(translated.searchParams.get("url"), original);
  delete process.env.READER_BASE_URL;
});

test("keeps original links until the reader backend is enabled", () => {
  delete process.env.READER_BASE_URL;
  const item = { title: "News", titleZh: "新闻", url: "https://example.com/story", source: "Reuters", publishedAt: "2026-09-04T01:00:00Z", score: 88 };
  const message = newsMessage({ tech: [item], market: [item], failureCount: 0, fetchedAt: "2026-09-04T02:00:00Z" });
  assert.doesNotMatch(message.html, /中文阅读全文/);
  assert.match(message.html, /href="https:\/\/example\.com\/story"/);
});

test("supports comma-separated Gmail recipients", () => {
  assert.deepEqual(recipients("a@example.com, b@example.com"), ["a@example.com", "b@example.com"]);
  assert.throws(() => recipients("  "), /at least one/);
});

test("recognizes refresh-only environment values", () => {
  assert.equal(environmentFlag("true"), true);
  assert.equal(environmentFlag("1"), true);
  assert.equal(environmentFlag("on"), true);
  assert.equal(environmentFlag("false"), false);
  assert.equal(environmentFlag(""), false);
});

test("reuses an existing Chinese title without calling the translation service", async () => {
  const items = [{ title: "Existing English headline", titleZh: "已有中文标题" }];
  assert.deepEqual(await require("../scripts/send-hot-news-email").addChineseTranslations(items), items);
});

test("filters strict paid-subscription sources by publisher or domain", () => {
  assert.equal(isPaywalledItem({ source: "The Wall Street Journal", url: "https://news.google.com/story" }), true);
  assert.equal(isPaywalledItem({ source: "Unknown", url: "https://www.bloomberg.com/news/a" }), true);
  assert.equal(isPaywalledItem({ source: "Reuters", url: "https://reuters.com/world/a" }), false);
});


test("resolves a signed Google News URL to its publisher during collection", async () => {
  const googleUrl = "https://news.google.com/rss/articles/CBMiTest?oc=5";
  const calls = [];
  const fetcher = async (url, options = {}) => {
    calls.push({ url, options });
    if (calls.length === 1) {
      return { ok: true, text: async () => '<div data-n-a-sg="signature" data-n-a-ts="1788480000"></div>' };
    }
    return { ok: true, text: async () => '[\\\"garturlres\\\",\\\"https://www.cnbc.com/2026/09/04/story.html\\\",' };
  };
  const resolved = await resolveGoogleNewsUrl(googleUrl, fetcher);
  assert.equal(resolved, "https://www.cnbc.com/2026/09/04/story.html");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].options.method, "POST");
  assert.match(calls[1].options.body, /Fbv4je/);
});

test("reuses an archived Google News mapping without another network request", async () => {
  const googleUrl = "https://news.google.com/rss/articles/CBMiCached?oc=5";
  const directUrl = "https://www.reuters.com/technology/example/";
  const result = await resolveGoogleNewsItems(
    [{ title: "Cached story", url: googleUrl, source: "Reuters" }],
    new Map([[googleUrl, directUrl]]),
    async () => { throw new Error("fetch should not run"); },
  );
  assert.equal(result.resolvedCount, 1);
  assert.equal(result.items[0].url, directUrl);
  assert.equal(result.items[0].googleNewsUrl, googleUrl);
});


test("keeps the four DailyReview runs disconnected from hot-news collection", () => {
  const workflow = fs.readFileSync(".github/workflows/send-hot-news.yml", "utf8");
  assert.doesNotMatch(workflow, /workflow_run:/);
  assert.match(workflow, /DISPATCH_TRIGGER_SOURCE/);
  assert.match(workflow, /DISPATCH_TRIGGER_SOURCE" == "cloudflare"/);
  const cron = fs.readFileSync("cloudflare/dailyreview-cron-hot-news.js", "utf8");
  assert.match(cron, /"refresh-reader\.yml"/);
  assert.doesNotMatch(cron, /"send-hot-news\.yml"/);
  assert.match(cron, /event\.cron !== READER_REFRESH_CRON/);
});

test("keeps reader publication free of Gmail configuration", () => {
  const workflow = fs.readFileSync(".github/workflows/refresh-reader.yml", "utf8");
  assert.match(workflow, /HOT_NEWS_REFRESH_ONLY: "true"/);
  assert.match(workflow, /YOUTUBE_API_KEY: \$\{\{ secrets\.YOUTUBE_API_KEY \}\}/);
  assert.match(workflow, /for attempt in 1 2 3/);
  assert.doesNotMatch(workflow, /GMAIL_USERNAME|GMAIL_APP_PASSWORD|ALERT_EMAIL_TO/);
});

test("runs the flaky online reader diagnostic only when requested manually", () => {
  const workflow = fs.readFileSync(".github/workflows/test-reader.yml", "utf8");
  assert.match(workflow, /on:\n  workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\n  push:/);
});
