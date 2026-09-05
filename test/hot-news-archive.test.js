const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { mergeNews, pruneArchive, pruneArchiveFile } = require('../scripts/hot-news-archive');

function item(category, sourceKey, title) {
  return {
    category, sourceKey, sourceOrder: 0, title, titleZh: `中文${title}`,
    url: `https://example.com/${title}`, source: sourceKey,
    publishedAt: '2026-09-04T01:00:00Z', score: 80,
  };
}

test('stores only the latest fetch snapshot', () => {
  let archive = mergeNews(null, { tech: [item('tech', 'tech-a', 'old')], market: [] }, Date.parse('2026-09-04T01:00:00Z'));
  archive = mergeNews(archive, { tech: [item('tech', 'tech-a', 'new')], market: [] }, Date.parse('2026-09-04T03:00:00Z'));
  assert.equal(archive.schemaVersion, 2);
  assert.deepEqual(archive.items.map((entry) => entry.title), ['new']);
});

test('keeps one item per configured source', () => {
  const archive = pruneArchive({ schemaVersion: 2, updatedAt: '2026-09-04T03:00:00Z', items: [
    { ...item('tech', 'tech-a', 'old'), fetchedAt: '2026-09-04T01:00:00Z' },
    { ...item('tech', 'tech-a', 'new'), fetchedAt: '2026-09-04T03:00:00Z' },
    item('market', 'market-a', 'stock'),
  ] });
  assert.deepEqual(archive.items.map((entry) => entry.title).sort(), ['new', 'stock']);
});

test('converts a legacy day archive when a build starts', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dailyreview-archive-'));
  const filePath = path.join(directory, 'recent.json');
  fs.writeFileSync(filePath, JSON.stringify({ updatedAt: '2026-09-04T03:00:00Z', days: [
    { date: '2026-09-04', items: [item('tech', 'tech-a', 'legacy')] },
  ] }));
  const result = pruneArchiveFile(filePath);
  assert.equal(result.schemaVersion, 2);
  assert.deepEqual(result.items.map((entry) => entry.title), ['legacy']);
  assert.equal('days' in JSON.parse(fs.readFileSync(filePath, 'utf8')), false);
  fs.rmSync(directory, { recursive: true, force: true });
});

test('applies the current free-source filter to the new snapshot', () => {
  const archive = mergeNews(null, {
    tech: [item('tech', 'paid', 'paid'), item('tech', 'free', 'free')], market: [],
  }, Date.parse('2026-09-04T03:00:00Z'), (entry) => entry.sourceKey !== 'paid');
  assert.deepEqual(archive.items.map((entry) => entry.sourceKey), ['free']);
});

test('stores the YouTube Top 10 with the news snapshot', () => {
  const youtube = Array.from({ length: 10 }, (_, index) => item('youtube', `youtube-${index}`, `video-${index}`));
  const archive = mergeNews(null, { tech: [], market: [], youtube }, Date.parse('2026-09-04T03:00:00Z'));
  assert.equal(archive.items.filter((entry) => entry.category === 'youtube').length, 10);
});
