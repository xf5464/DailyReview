const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { mergeNews, pruneArchive, pruneArchiveFile } = require('../scripts/hot-news-archive');

function news(title, url) {
  return { tech: [{ category: 'tech', title, titleZh: `中文${title}`, url, source: 'Test', publishedAt: '2026-09-04T01:00:00Z', score: 80 }], market: [] };
}

test('keeps today and the previous two China calendar days', () => {
  const archive = { schemaVersion: 1, updatedAt: null, days: [
    { date: '2026-09-04', pushes: [], items: [] },
    { date: '2026-09-03', pushes: [], items: [] },
    { date: '2026-09-02', pushes: [], items: [] },
    { date: '2026-09-01', pushes: [], items: [] },
  ] };
  assert.deepEqual(pruneArchive(archive, Date.parse('2026-09-04T08:00:00Z')).days.map((day) => day.date), ['2026-09-04', '2026-09-03', '2026-09-02']);
});

test('merges repeated pushes without duplicating the same URL', () => {
  let archive = mergeNews(null, news('A', 'https://example.com/a'), Date.parse('2026-09-04T01:00:00Z'));
  archive = mergeNews(archive, news('A updated', 'https://example.com/a'), Date.parse('2026-09-04T03:00:00Z'));
  assert.equal(archive.days[0].items.length, 1);
  assert.equal(archive.days[0].items[0].title, 'A updated');
  assert.equal(archive.days[0].pushes.length, 2);
});

test('prunes the repository archive when a build starts', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dailyreview-archive-'));
  const filePath = path.join(directory, 'recent.json');
  fs.writeFileSync(filePath, JSON.stringify({ days: [
    { date: '2026-09-04', pushes: [], items: [] },
    { date: '2026-09-01', pushes: [], items: [] },
  ] }));
  const result = pruneArchiveFile(filePath, Date.parse('2026-09-04T08:00:00Z'));
  assert.deepEqual(result.days.map((day) => day.date), ['2026-09-04']);
  assert.deepEqual(JSON.parse(fs.readFileSync(filePath, 'utf8')).days.map((day) => day.date), ['2026-09-04']);
  fs.rmSync(directory, { recursive: true, force: true });
});

test('removes previously archived items rejected by the current filter', () => {
  let archive = mergeNews(null, news('Paid', 'https://example.com/paid'), Date.parse('2026-09-04T01:00:00Z'));
  archive = mergeNews(archive, news('Free', 'https://example.com/free'), Date.parse('2026-09-04T03:00:00Z'),
    (item) => !item.url.endsWith('/paid'));
  assert.deepEqual(archive.days[0].items.map((item) => item.url), ['https://example.com/free']);
});


test('replaces old Google News relay records with the resolved publisher URL', () => {
  const googleUrl = 'https://news.google.com/rss/articles/CBMiExample?oc=5';
  let archive = mergeNews(null, news('Old relay', googleUrl), Date.parse('2026-09-04T01:00:00Z'));
  const directItem = {
    category: 'tech', title: 'Resolved story', titleZh: '已解析新闻',
    url: 'https://www.cnbc.com/2026/09/04/story.html', googleNewsUrl: googleUrl,
    source: 'CNBC', publishedAt: '2026-09-04T01:00:00Z', score: 90,
  };
  archive = mergeNews(archive, { tech: [directItem], market: [] }, Date.parse('2026-09-04T03:00:00Z'));
  assert.deepEqual(archive.days[0].items.map((item) => item.url), [directItem.url]);
  assert.equal(archive.days[0].items[0].googleNewsUrl, googleUrl);
});
