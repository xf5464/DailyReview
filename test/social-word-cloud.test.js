const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWordCloud, stripHtml, termsFromText } = require('../scripts/social-word-cloud');

test('removes Mastodon HTML before keyword extraction', () => {
  assert.equal(stripHtml('<p>OpenAI &amp; robots<br>are trending https://example.com/post</p>'), 'OpenAI & robots are trending');
});

test('normalizes important aliases and removes filler words', () => {
  const terms = termsFromText('Please ask for help reading everything about the latest best big artificial intelligence video chips from Nvidia on the public internet every day');
  assert.ok(terms.includes('AI'));
  assert.ok(terms.includes('芯片'));
  assert.ok(terms.includes('英伟达'));
  assert.ok(terms.includes('互联网'));
  assert.ok(!terms.includes('the'));
  assert.ok(!terms.includes('https'));
  assert.ok(!terms.includes('best'));
  assert.ok(!terms.includes('big'));
  assert.ok(!terms.includes('video'));
  assert.ok(!terms.includes('public'));
  assert.ok(!terms.includes('every'));
  assert.ok(!terms.includes('everything'));
  assert.ok(!terms.includes('please'));
  assert.ok(!terms.includes('reading'));
  assert.ok(!terms.includes('ask'));
  assert.ok(!terms.includes('help'));
});

test('boosts terms confirmed across free platforms', () => {
  const now = Date.parse('2026-09-06T08:00:00Z');
  const trends = buildWordCloud([
    { text: 'OpenAI releases AI model', platform: 'Hacker News', engagement: 100, publishedAt: '2026-09-06T07:00:00Z', url: 'a' },
    { text: 'AI model discussion', platform: 'Bluesky', engagement: 200, publishedAt: '2026-09-06T07:30:00Z', url: 'b' },
    { text: 'AI chips and Nvidia', platform: 'Mastodon', engagement: 40, publishedAt: '2026-09-06T07:45:00Z', url: 'c' },
    { text: 'Rust compiler release', platform: 'Lobsters', engagement: 20, publishedAt: '2026-09-06T07:45:00Z', url: 'd' },
  ], now, 10);
  assert.equal(trends[0].term, 'AI');
  assert.equal(trends[0].platformCount, 3);
  assert.ok(trends.every((trend) => !trend.platforms.includes('YouTube')));
});
