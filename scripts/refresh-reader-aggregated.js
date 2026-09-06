const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const {
  NEWS_SOURCES,
  addChineseTranslations,
  archivedTitleTranslations,
  decodeXml,
  isPaywalledItem,
  isSimilarTitle,
  parseRssItems,
} = require('./send-hot-news-email');

const ARCHIVE_PATH = String(process.env.HOT_NEWS_ARCHIVE_PATH || 'site/reader/data/recent.json').trim();
const USER_AGENT = 'DailyReview/2.2 (+https://github.com/xf5464/DailyReview)';
const MARKET_WINDOW_HOURS = 48;
const ITEMS_PER_SOURCE = 4;

const MARKET_AUTHORITY = new Map([
  ['guardian-business', 27], ['yahoo-finance', 27], ['cnbc-markets', 30], ['bbc-business', 28],
  ['cnn-business', 27], ['marketwatch', 28], ['benzinga', 22], ['the-street', 22],
  ['motley-fool', 21], ['ap-business', 30],
]);
const WORLD_AUTHORITY = new Map([
  ['reuters-world', 32], ['ap-world', 31], ['bbc-world', 30], ['al-jazeera', 28], ['dw-world', 27],
  ['france24', 27], ['guardian-world', 28], ['npr-world', 27], ['cnn-world', 27], ['un-news', 29],
]);
const COMMON_STOP = new Set(['about','after','against','amid','and','are','but','could','from','has','have','into','its','new','over','says','that','the','their','this','with','will','would','news','latest','live','update','updates','report','reports']);
const MARKET_IMPACT = [
  'fed','federal reserve','powell','interest rate','rates','treasury','yield','cpi','inflation','pce','payroll','jobs','unemployment','gdp','recession',
  's&p','s&p 500','nasdaq','dow','wall street','stocks','market','earnings','guidance','nvidia','apple','microsoft','amazon','meta','tesla','alphabet','google',
  'bank','banks','oil','tariff','trade','merger','acquisition','ipo','antitrust','semiconductor','chip','ai','artificial intelligence',
];
const WORLD_IMPACT = [
  'war','attack','strike','missile','military','nuclear','sanction','ceasefire','election','president','government','coup','protest','hostage','terror',
  'russia','ukraine','china','taiwan','iran','israel','gaza','north korea','south china sea','nato','united nations','tariff','trade','oil','energy','shipping',
  'earthquake','flood','hurricane','typhoon','wildfire','disaster','killed','dead','crisis','refugee','border',
];

function hoursOld(value, now = Date.now()) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, (now - timestamp) / 3_600_000) : 999;
}
function stripTags(value = '') {
  return decodeXml(String(value)).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
function parseAtomItems(xml, category) {
  const blocks = String(xml).match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  return blocks.map((block, index) => {
    const title = stripTags((block.match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i) || [])[1] || '');
    const link = (block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i) || [])[1] || '';
    const publishedAt = stripTags((block.match(/<(?:published|updated)(?:\s[^>]*)?>([\s\S]*?)<\/(?:published|updated)>/i) || [])[1] || '');
    return { category, title, url: link, publishedAt, feedRank: index };
  }).filter((item) => item.title && item.url);
}
function parseFeed(xml, category) {
  const rss = parseRssItems(xml, category, 0);
  return rss.length ? rss : parseAtomItems(xml, category);
}
async function fetchText(url, timeout = 15000) {
  const target = new URL(url);
  target.searchParams.set('_dr', String(Date.now()));
  const response = await fetch(target, {
    redirect: 'follow', cache: 'no-store', signal: AbortSignal.timeout(timeout),
    headers: { 'user-agent': USER_AGENT, 'cache-control': 'no-cache', pragma: 'no-cache' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}
function words(title) {
  return new Set(String(title || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff+.-]+/g, ' ').split(/\s+/)
    .filter((token) => token.length > 2 && !COMMON_STOP.has(token)));
}
function sameEvent(a, b) {
  if (isSimilarTitle(a, b)) return true;
  const left = words(a); const right = words(b);
  if (!left.size || !right.size) return false;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared >= 2 && shared / Math.min(left.size, right.size) >= 0.34;
}
function impactScore(title, keywords, cap) {
  const text = String(title || '').toLowerCase();
  return Math.min(cap, keywords.reduce((sum, keyword) => sum + (text.includes(keyword) ? 5 : 0), 0));
}
function rankClusters(items, { category, authorityMap, impactKeywords, windowHours, now }) {
  const clusters = [];
  for (const item of [...items].sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0))) {
    let cluster = clusters.find((candidate) => candidate.items.some((other) => sameEvent(item.title, other.title)));
    if (!cluster) { cluster = { items: [] }; clusters.push(cluster); }
    cluster.items.push(item);
  }
  return clusters.map((cluster) => {
    const sources = new Set(cluster.items.map((item) => item.sourceKey || item.source));
    const representative = [...cluster.items].sort((a, b) =>
      (authorityMap.get(b.sourceKey) || 20) - (authorityMap.get(a.sourceKey) || 20) ||
      Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0))[0];
    const newestAge = Math.min(...cluster.items.map((item) => hoursOld(item.publishedAt, now)));
    const freshness = Math.max(0, windowHours - newestAge);
    const authority = Math.max(...cluster.items.map((item) => authorityMap.get(item.sourceKey) || 20));
    const impact = impactScore(representative.title, impactKeywords, category === 'market' ? 45 : 50);
    const confirmation = sources.size * (category === 'market' ? 38 : 42);
    const score = Math.round((confirmation + freshness * 1.25 + authority + impact) * 10) / 10;
    return { representative, sourceCount: sources.size, score };
  }).sort((a, b) => b.score - a.score || Date.parse(b.representative.publishedAt || 0) - Date.parse(a.representative.publishedAt || 0));
}
async function marketCandidates(now, existing) {
  const batches = await Promise.all((NEWS_SOURCES.market || []).map(async (source, sourceOrder) => {
    const feedUrl = source.headlineFeed || source.feed;
    if (!feedUrl) return [];
    try {
      const xml = await fetchText(feedUrl);
      return parseFeed(xml, 'market')
        .filter((item) => item.title && item.url && !isPaywalledItem(item))
        .filter((item) => !item.publishedAt || hoursOld(item.publishedAt, now) <= MARKET_WINDOW_HOURS)
        .slice(0, ITEMS_PER_SOURCE)
        .map((item) => ({ ...item, category: 'market', source: source.name, sourceKey: source.key, sourceOrder }));
    } catch (error) {
      console.warn(`${source.name} market feed failed: ${error.message}`);
      return existing.filter((item) => item.sourceKey === source.key).slice(0, 1);
    }
  }));
  return batches.flat();
}
async function translateRepresentatives(items) {
  const known = archivedTitleTranslations(ARCHIVE_PATH);
  const prepared = items.map((item) => ({ ...item, titleZh: known.get(item.url) || item.titleZh || '' }));
  try {
    return await addChineseTranslations(prepared);
  } catch (error) {
    console.warn(`Aggregated headline translation failed: ${error.message}`);
    return prepared;
  }
}
function worldSourceKey(item) {
  if (item.sourceKey) return item.sourceKey;
  const name = String(item.source || '').toLowerCase();
  const source = (NEWS_SOURCES.world || []).find((candidate) => name.includes(String(candidate.name || '').toLowerCase()));
  return source?.key || name;
}
async function main() {
  execFileSync(process.execPath, ['scripts/refresh-reader-news.js'], { stdio: 'inherit', env: process.env });
  const archive = JSON.parse(fs.readFileSync(ARCHIVE_PATH, 'utf8'));
  const now = Date.now();
  const existingMarket = (archive.items || []).filter((item) => item.category === 'market');
  const existingWorld = (archive.items || []).filter((item) => item.category === 'world').map((item) => ({ ...item, sourceKey: worldSourceKey(item) }));

  const marketPool = await marketCandidates(now, existingMarket);
  const marketClusters = rankClusters(marketPool, {
    category: 'market', authorityMap: MARKET_AUTHORITY, impactKeywords: MARKET_IMPACT, windowHours: MARKET_WINDOW_HOURS, now,
  }).slice(0, 10);
  let market = marketClusters.map((cluster, index) => ({
    ...cluster.representative,
    category: 'market', sourceKey: `market-event-${index + 1}`, sourceOrder: index, score: cluster.score,
    engagement: cluster.sourceCount >= 2 ? `${cluster.sourceCount}家财经媒体交叉确认` : '单一来源',
    fetchedAt: new Date(now).toISOString(), sourceUpdatedAt: new Date(now).toISOString(), isCached: false,
  }));
  market = await translateRepresentatives(market);

  const worldClusters = rankClusters(existingWorld, {
    category: 'world', authorityMap: WORLD_AUTHORITY, impactKeywords: WORLD_IMPACT, windowHours: 48, now,
  }).slice(0, 10);
  const world = worldClusters.map((cluster, index) => ({
    ...cluster.representative,
    category: 'world', sourceKey: `world-event-${index + 1}`, sourceOrder: index, score: cluster.score,
    engagement: cluster.sourceCount >= 2 ? `${cluster.sourceCount}家国际媒体交叉确认` : (cluster.representative.engagement || '单一来源'),
    fetchedAt: new Date(now).toISOString(), sourceUpdatedAt: new Date(now).toISOString(), isCached: false,
  }));

  archive.items = (archive.items || []).filter((item) => item.category !== 'market' && item.category !== 'world').concat(market, world);
  archive.updatedAt = new Date(now).toISOString();
  archive.refreshAttemptedAt = archive.updatedAt;
  fs.writeFileSync(ARCHIVE_PATH, `${JSON.stringify(archive, null, 2)}\n`, 'utf8');
  console.log(`Event aggregation complete: market=${market.length}/${marketPool.length} candidates, world=${world.length}/${existingWorld.length} candidates.`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
