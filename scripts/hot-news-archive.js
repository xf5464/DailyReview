const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const RETENTION_DAYS = 3;

function chinaDate(value) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(value));
}

function itemId(url) {
  return crypto.createHash('sha256').update(String(url)).digest('hex').slice(0, 16);
}

function emptyArchive() {
  return { schemaVersion: 1, updatedAt: null, days: [] };
}

function pruneArchive(archive, now = Date.now()) {
  const current = chinaDate(now);
  const cutoff = new Date(`${current}T00:00:00+08:00`);
  cutoff.setUTCDate(cutoff.getUTCDate() - (RETENTION_DAYS - 1));
  const cutoffDate = chinaDate(cutoff);
  return {
    schemaVersion: 1,
    updatedAt: archive.updatedAt || null,
    days: (Array.isArray(archive.days) ? archive.days : [])
      .filter((day) => day && day.date >= cutoffDate && day.date <= current)
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, RETENTION_DAYS),
  };
}

function mergeNews(archive, news, now = Date.now(), shouldKeepItem = () => true) {
  const pushedAt = new Date(now).toISOString();
  const date = chinaDate(now);
  const next = pruneArchive(archive || emptyArchive(), now);
  let day = next.days.find((entry) => entry.date === date);
  if (!day) {
    day = { date, pushes: [], items: [] };
    next.days.unshift(day);
  }
  day.pushes = [...new Set([pushedAt, ...(day.pushes || [])])].sort().reverse();
  const incoming = [...(news.tech || []), ...(news.market || [])].map((item) => ({
    id: itemId(item.url), category: item.category, title: item.title, titleZh: item.titleZh || '',
    url: item.url, source: item.source, publishedAt: item.publishedAt, score: item.score,
    engagement: item.engagement || '', pushedAt,
  }));
  const byId = new Map((day.items || []).map((item) => [item.id, item]));
  incoming.forEach((item) => byId.set(item.id, item));
  day.items = [...byId.values()].sort((left, right) =>
    Date.parse(right.pushedAt || right.publishedAt) - Date.parse(left.pushedAt || left.publishedAt));
  next.days.forEach((entry) => {
    entry.items = (entry.items || []).filter(shouldKeepItem);
  });
  next.updatedAt = pushedAt;
  return pruneArchive(next, now);
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

function pruneArchiveFile(filePath, now = Date.now()) {
  const next = pruneArchive(readArchive(filePath), now);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

module.exports = {
  RETENTION_DAYS, chinaDate, emptyArchive, itemId, mergeNews, pruneArchive, pruneArchiveFile, saveNewsArchive,
};
