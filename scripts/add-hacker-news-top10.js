'use strict';

const fs = require('node:fs');
const { addChineseTranslations } = require('./send-hot-news-email');

const ARCHIVE_PATH = String(process.env.HOT_NEWS_ARCHIVE_PATH || 'site/reader/data/recent.json').trim();
const TOP_LIMIT = 10;

async function fetchJson(url, timeout = 10000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout), headers: { 'user-agent': 'DailyReview/2.5' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}

async function fetchHackerNewsTop10(now = Date.now()) {
  const ids = await fetchJson('https://hacker-news.firebaseio.com/v0/topstories.json');
  const candidates = await Promise.all(ids.slice(0, 30).map(async (id) => {
    try { return await fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`); }
    catch { return null; }
  }));
  const stories = candidates
    .filter((item) => item && item.type === 'story' && item.title)
    .slice(0, TOP_LIMIT)
    .map((item, index) => ({
      category: 'hn',
      title: item.title,
      titleZh: '',
      url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
      source: 'Hacker News',
      sourceKey: `hn-${item.id}`,
      sourceOrder: index,
      publishedAt: new Date(Number(item.time || 0) * 1000).toISOString(),
      score: Number(item.score || 0),
      engagement: `${Number(item.score || 0)} points · ${Number(item.descendants || 0)} comments`,
      fetchedAt: new Date(now).toISOString(),
      sourceUpdatedAt: new Date(now).toISOString(),
      isCached: false,
    }));
  if (stories.length < TOP_LIMIT) throw new Error(`Hacker News returned only ${stories.length}/${TOP_LIMIT} usable stories.`);
  return addChineseTranslations(stories);
}

async function main() {
  const archive = JSON.parse(fs.readFileSync(ARCHIVE_PATH, 'utf8'));
  let hn;
  try {
    hn = await fetchHackerNewsTop10();
  } catch (error) {
    const previous = (archive.items || []).filter((item) => item.category === 'hn').slice(0, TOP_LIMIT);
    if (previous.length !== TOP_LIMIT) throw error;
    hn = previous.map((item) => ({ ...item, isCached: true }));
    console.warn(`Hacker News refresh failed; kept previous Top 10: ${error.message}`);
  }
  archive.items = (archive.items || []).filter((item) => item.category !== 'hn').concat(hn);
  archive.trends = [];
  archive.updatedAt = new Date().toISOString();
  archive.refreshAttemptedAt = archive.updatedAt;
  fs.writeFileSync(ARCHIVE_PATH, `${JSON.stringify(archive, null, 2)}\n`, 'utf8');
  console.log(`Saved Hacker News Top 10: ${hn.length} stories.`);
}

if (require.main === module) main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
module.exports = { fetchHackerNewsTop10 };
