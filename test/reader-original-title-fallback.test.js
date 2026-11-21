const test = require('node:test');
const assert = require('node:assert/strict');
const { fetchHackerNewsTop10, fetchHackerNewsFront10 } = require('../scripts/add-hacker-news-top10');
const { translateItems } = require('../scripts/refresh-reader-news');

test('HN current and front publish all fresh original stories during a translation outage', async t => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  const now = Date.parse('2026-11-21T01:17:00Z');
  global.fetch = async url => {
    url = String(url);
    if (url.endsWith('/topstories.json')) return { ok: true, json: async () => Array.from({ length: 10 }, (_, i) => i + 1) };
    if (url === 'https://news.ycombinator.com/front') return { ok: true, text: async () => Array.from({ length: 10 }, (_, i) => `<tr class="athing" id="${i + 1}">`).join('') };
    const id = url.match(/\/item\/(\d+)\.json$/)?.[1];
    if (id) return { ok: true, json: async () => ({ id: Number(id), type: 'story', title: `Fresh original story ${id}`, time: now / 1000, url: `https://example.com/new/${id}` }) };
    throw new Error('translation unavailable');
  };
  for (const fetcher of [fetchHackerNewsTop10, fetchHackerNewsFront10]) {
    const items = await fetcher(now);
    assert.equal(items.length, 10);
    assert.ok(items.every(item => item.title.startsWith('Fresh original story') && !item.isCached && item.fetchedAt === new Date(now).toISOString()));
  }
});

test('reader keeps a new original headline instead of a different cached Chinese story', async t => {
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  global.fetch = async () => { throw new Error('translation unavailable'); };
  const fresh = { title: 'Fresh story about new chips', titleZh: '', url: 'https://example.com/new', category: 'tech', sourceKey: 'example', isCached: false, fetchedAt: '2026-11-21T01:17:00Z' };
  const old = new Map([['example', { ...fresh, title: 'Old story', titleZh: '旧新闻', url: 'https://example.com/old' }]]);
  const items = await translateItems([fresh], new Map(), old, old);
  assert.equal(items.length, 1);
  assert.equal(items[0].url, fresh.url);
  assert.equal(items[0].title, fresh.title);
  assert.equal(items[0].titleZh, '');
  assert.equal(items[0].isCached, false);
  assert.equal(items[0].fetchedAt, fresh.fetchedAt);
});
