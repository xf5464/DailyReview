const USER_AGENT = "DailyReview/1.0 (+https://github.com/xf5464/DailyReview)";
const DEFAULT_WINDOW_HOURS = 30;
const MAX_ITEMS = 10;

const SOURCE_WEIGHTS = new Map([
  ["Reuters", 30], ["Bloomberg", 28], ["The Wall Street Journal", 27],
  ["CNBC", 25], ["Financial Times", 25], ["The Verge", 23],
  ["Ars Technica", 23], ["TechCrunch", 22], ["MarketWatch", 21],
  ["Barron's", 21], ["Yahoo Finance", 19], ["Forbes", 17],
]);

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

function decodeXml(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function stripTags(value = "") {
  return decodeXml(String(value)).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function tagValue(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? stripTags(match[1]) : "";
}

function parseRssItems(xml, category, feedRank = 0) {
  const blocks = String(xml).match(/<item\b[\s\S]*?<\/item>/gi) || [];
  return blocks.map((block, index) => {
    const sourceMatch = block.match(/<source(?:\s[^>]*)?>([\s\S]*?)<\/source>/i);
    const source = sourceMatch ? stripTags(sourceMatch[1]) : "Google News";
    const rawTitle = tagValue(block, "title");
    const sourceSuffix = source && rawTitle.endsWith(` - ${source}`) ? ` - ${source}` : "";
    return {
      category,
      title: sourceSuffix ? rawTitle.slice(0, -sourceSuffix.length) : rawTitle,
      url: tagValue(block, "link"),
      source,
      publishedAt: tagValue(block, "pubDate"),
      feedRank: feedRank + index,
      score: 0,
    };
  }).filter((item) => item.title && item.url);
}

function normalizeTitle(title) {
  return String(title).toLowerCase()
    .replace(/\b(live|update|updates|breaking|exclusive|analysis)\b/g, " ")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ").replace(/\s+/g, " ").trim();
}

function titleTokens(title) {
  return new Set(normalizeTitle(title).split(" ").filter((token) => token.length > 2));
}

function isSimilarTitle(left, right) {
  const a = titleTokens(left);
  const b = titleTokens(right);
  if (!a.size || !b.size) return normalizeTitle(left) === normalizeTitle(right);
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / Math.min(a.size, b.size) >= 0.72;
}

function hoursOld(date, now = Date.now()) {
  const timestamp = typeof date === "number" ? date : Date.parse(date);
  return Number.isFinite(timestamp) ? Math.max(0, (now - timestamp) / 3_600_000) : 999;
}

function keywordScore(title, category) {
  const text = String(title).toLowerCase();
  const keywords = category === "market"
    ? ["stock", "shares", "wall street", "nasdaq", "s&p", "dow", "earnings", "fed", "market", "investor"]
    : ["ai", "chip", "software", "technology", "tech", "robot", "cloud", "security", "startup", "semiconductor"];
  return Math.min(18, keywords.reduce((sum, keyword) => sum + (text.includes(keyword) ? 3 : 0), 0));
}

function rankGoogleItem(item, now = Date.now()) {
  const freshness = Math.max(0, 28 - hoursOld(item.publishedAt, now));
  const source = SOURCE_WEIGHTS.get(item.source) || 12;
  const position = Math.max(0, 18 - item.feedRank * 0.3);
  return Math.round((freshness + source + position + keywordScore(item.title, item.category)) * 10) / 10;
}

function rankAndDedupe(items, limit = MAX_ITEMS, now = Date.now()) {
  const ranked = items
    .map((item) => ({ ...item, score: item.score || rankGoogleItem(item, now) }))
    .sort((a, b) => b.score - a.score || Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  const result = [];
  for (const item of ranked) {
    if (!result.some((chosen) => isSimilarTitle(chosen.title, item.title))) result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

async function fetchText(url, timeoutMs = 15_000) {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "application/rss+xml, application/json;q=0.9, */*;q=0.8" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.text();
}

function googleNewsUrl(query) {
  const params = new URLSearchParams({ q: query, hl: "en-US", gl: "US", ceid: "US:en" });
  return `https://news.google.com/rss/search?${params}`;
}

async function fetchGoogleFeed(query, category, feedRank) {
  const xml = await fetchText(googleNewsUrl(query));
  return parseRssItems(xml, category, feedRank);
}

async function fetchHackerNews(windowHours, now = Date.now()) {
  const ids = JSON.parse(await fetchText("https://hacker-news.firebaseio.com/v0/topstories.json"));
  const stories = await Promise.all(ids.slice(0, 80).map(async (id) => {
    try {
      return JSON.parse(await fetchText(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, 8_000));
    } catch {
      return null;
    }
  }));
  return stories.filter((story) => story && story.type === "story" && story.url && hoursOld(story.time * 1000, now) <= windowHours)
    .map((story, index) => ({
      category: "tech",
      title: story.title,
      url: story.url,
      source: new URL(story.url).hostname.replace(/^www\./, ""),
      publishedAt: new Date(story.time * 1000).toISOString(),
      feedRank: index,
      score: Math.round((Math.log2((story.score || 0) + 1) * 9 + Math.log2((story.descendants || 0) + 1) * 5 + Math.max(0, 24 - hoursOld(story.time * 1000, now))) * 10) / 10,
      engagement: `${story.score || 0} points · ${story.descendants || 0} comments`,
    }));
}

async function collectHotNews(windowHours = DEFAULT_WINDOW_HOURS, now = Date.now()) {
  const requests = [
    fetchHackerNews(windowHours, now),
    fetchGoogleFeed("technology OR AI OR chips OR software when:1d", "tech", 0),
    fetchGoogleFeed('("stock market" OR "Wall Street" OR Nasdaq OR "S&P 500") when:1d', "market", 0),
    fetchGoogleFeed("(earnings OR shares OR stock) (Nvidia OR Apple OR Microsoft OR Amazon OR Meta OR Tesla OR Alphabet) when:1d", "market", 40),
  ];
  const settled = await Promise.allSettled(requests);
  const failures = settled.filter((result) => result.status === "rejected");
  const groups = settled.filter((result) => result.status === "fulfilled").map((result) => result.value);
  if (!groups.length) throw new Error("All hot-news sources failed.");
  const all = groups.flat().filter((item) => hoursOld(item.publishedAt, now) <= windowHours);
  const tech = rankAndDedupe(all.filter((item) => item.category === "tech"), MAX_ITEMS, now);
  const market = rankAndDedupe(all.filter((item) => item.category === "market"), MAX_ITEMS, now);
  if (!tech.length || !market.length) throw new Error(`Not enough news: tech=${tech.length}, market=${market.length}`);
  return { tech, market, failureCount: failures.length, fetchedAt: new Date(now).toISOString() };
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function formatChinaTime(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(date));
}

function triggerType() {
  const source = String(process.env.TRIGGER_SOURCE || "manual").trim().toLowerCase();
  return source === "cloudflare" ? "Cloudflare 定时" : "GitHub 手动触发";
}

function itemText(item, index) {
  const extra = item.engagement ? `；${item.engagement}` : `；热度分 ${item.score}`;
  return `${index + 1}. ${item.title}\n   ${item.source} · ${formatChinaTime(item.publishedAt)}${extra}\n   ${item.url}`;
}

function itemHtml(item, index) {
  const extra = item.engagement ? item.engagement : `综合热度 ${item.score}`;
  return `<li style="margin:0 0 18px"><a href="${escapeHtml(item.url)}" style="color:#1558d6;font-size:16px;font-weight:600;text-decoration:none">${escapeHtml(item.title)}</a><div style="margin-top:5px;color:#667085;font-size:13px">${escapeHtml(item.source)} · ${escapeHtml(formatChinaTime(item.publishedAt))} · ${escapeHtml(extra)}</div></li>`;
}

function newsMessage(news) {
  const time = formatChinaTime(news.fetchedAt);
  const textSection = (title, items) => [title, "", ...items.map(itemText), ""].join("\n");
  const htmlSection = (title, items) => `<h2 style="margin:28px 0 14px;color:#101828">${title}</h2><ol style="padding-left:24px">${items.map(itemHtml).join("")}</ol>`;
  return {
    subject: `[DailyReview] 海外科技与美股热点 Top 10｜${time.slice(0, 10)}`,
    text: [
      `采集时间：${time}（北京时间）`, `触发方式：${triggerType()}`,
      "排序综合考虑发布时间、来源权威度、聚合位置；科技新闻同时参考 Hacker News 讨论热度。", "",
      textSection("全球科技热点 Top 10", news.tech), textSection("美股热点 Top 10", news.market),
      news.failureCount ? `备注：${news.failureCount} 个备用信息源本次不可用，邮件已使用其余来源生成。` : "",
    ].filter(Boolean).join("\n"),
    html: `<div style="max-width:760px;margin:auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#101828;line-height:1.55"><h1 style="margin-bottom:6px">海外科技与美股热点</h1><div style="color:#667085">${escapeHtml(time)}（北京时间） · ${escapeHtml(triggerType())}</div><p style="color:#475467">排序综合考虑发布时间、来源权威度、聚合位置；科技新闻同时参考 Hacker News 讨论热度。</p>${htmlSection("全球科技热点 Top 10", news.tech)}${htmlSection("美股热点 Top 10", news.market)}${news.failureCount ? `<p style="color:#b54708">${news.failureCount} 个备用信息源本次不可用，已自动降级。</p>` : ""}</div>`,
  };
}

async function main() {
  const nodemailer = require("nodemailer");
  const username = requiredEnvironment("GMAIL_USERNAME");
  const password = requiredEnvironment("GMAIL_APP_PASSWORD").replace(/\s+/g, "");
  const to = recipients(requiredEnvironment("ALERT_EMAIL_TO"));
  const windowHours = Math.min(72, Math.max(12, Number(process.env.HOT_NEWS_WINDOW_HOURS) || DEFAULT_WINDOW_HOURS));
  const news = await collectHotNews(windowHours);
  const transport = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: username, pass: password } });
  const result = await transport.sendMail({ from: username, to, ...newsMessage(news) });
  console.log(`Hot-news email accepted for ${result.accepted.length} recipient(s): tech=${news.tech.length}, market=${news.market.length}.`);
  if (result.rejected.length) throw new Error(`Email rejected for ${result.rejected.length} recipient(s).`);
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });

module.exports = { collectHotNews, decodeXml, isSimilarTitle, newsMessage, normalizeTitle, parseRssItems, rankAndDedupe, recipients };
