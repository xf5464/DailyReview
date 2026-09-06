const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function itemId(url) {
  return crypto.createHash('sha256').update(String(url)).digest('hex').slice(0, 16);
}

function emptyArchive() {
  return { schemaVersion: 2, updatedAt: null, items: [], trends: [] };
}

function normalizeTrend(trend) {
  return {
    id: trend.id || itemId(`trend:${trend.term}`), term: String(trend.term || '').trim(),
    labelZh: String(trend.labelZh || '').trim(), score: Number(trend.score) || 0,
    mentions: Number(trend.mentions) || 0, platformCount: Number(trend.platformCount) || 0,
    platforms: Array.isArray(trend.platforms) ? trend.platforms.map(String) : [],
    url: String(trend.url || ''),
  };
}

function normalizeItem(item, fallbackOrder = 0) {
  return {
    id: item.id || itemId(item.url), category: item.category, title: item.title,
    titleZh: item.titleZh || '', url: item.url,
    ...(item.googleNewsUrl ? { googleNewsUrl: item.googleNewsUrl } : {}),
    source: item.source, sourceKey: item.sourceKey || '',
    sourceOrder: Number.isFinite(Number(item.sourceOrder)) ? Number(item.sourceOrder) : fallbackOrder,
    publishedAt: item.publishedAt, score: item.score,
    engagement: item.engagement || '', fetchedAt: item.fetchedAt || item.pushedAt || '',
  };
}

function legacyItems(archive) {
  return (Array.isArray(archive?.days) ? archive.days : []).flatMap((day) => day.items || []);
}

function pruneArchive(archive) {
  const rawItems = Array.isArray(archive?.items) ? archive.items : legacyItems(archive);
  const bySource = new Map();
  rawItems.forEach((item, index) => {
    if (!item?.url) return;
    const normalized = normalizeItem(item, index);
    const key = normalized.sourceKey || normalized.id;
    const previous = bySource.get(key);
    if (!previous || Date.parse(normalized.fetchedAt || normalized.publishedAt) > Date.parse(previous.fetchedAt || previous.publishedAt)) {
      bySource.set(key, normalized);
    }
  });
  return {
    schemaVersion: 2,
    updatedAt: archive?.updatedAt || null,
    items: [...bySource.values()].sort((left, right) =>
      String(left.category).localeCompare(String(right.category)) || left.sourceOrder - right.sourceOrder),
    trends: (Array.isArray(archive?.trends) ? archive.trends : []).map(normalizeTrend).filter((trend) => trend.term).slice(0, 30),
  };
}

function mergeNews(_archive, news, now = Date.now(), shouldKeepItem = () => true) {
  const fetchedAt = new Date(now).toISOString();
  const items = [...(news.tech || []), ...(news.market || []), ...(news.world || []), ...(news.youtube || [])]
    .map((item, index) => normalizeItem({ ...item, fetchedAt }, index % 10))
    .filter(shouldKeepItem);
  return pruneArchive({ schemaVersion: 2, updatedAt: fetchedAt, items, trends: news.trends || [] });
}

function readArchive(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return emptyArchive(); }
}

function saveNewsArchive(news, filePath, now = Date.now(), shouldKeepItem = () => true) {
  const next = mergeNews(readArchive(filePath), news, now, shouldKeepItem);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

function pruneArchiveFile(filePath) {
  const next = pruneArchive(readArchive(filePath));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

module.exports = { emptyArchive, itemId, mergeNews, pruneArchive, pruneArchiveFile, saveNewsArchive };
