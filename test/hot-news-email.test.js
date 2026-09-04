const test = require("node:test");
const assert = require("node:assert/strict");

const { isSimilarTitle, newsMessage, parseRssItems, rankAndDedupe, readerUrl, recipients } = require("../scripts/send-hot-news-email");

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
});

test("builds a reader URL without losing characters in the source URL", () => {
  const original = "https://example.com/story?a=1&b=two words";
  const translated = new URL(readerUrl(original));
  assert.equal(translated.pathname, "/DailyReview/reader/");
  assert.equal(translated.searchParams.get("url"), original);
});

test("supports comma-separated Gmail recipients", () => {
  assert.deepEqual(recipients("a@example.com, b@example.com"), ["a@example.com", "b@example.com"]);
  assert.throws(() => recipients("  "), /at least one/);
});
