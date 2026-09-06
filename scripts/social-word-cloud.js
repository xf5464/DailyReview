const crypto = require('node:crypto');

const USER_AGENT = 'DailyReview/1.0 (+https://github.com/xf5464/DailyReview)';
const CLOUD_SIZE = 30;
const HN_LIMIT = 180;
const MASTODON_INSTANCES = ['mastodon.social', 'fosstodon.org', 'techhub.social'];

const STOP_WORDS = new Set(`a an and are as at be been being but by can could did do does doing done for from had has have having how i if in into is it its may might must more most new no not of on one or our out over so than that the their there these they them this to two three four up us was we were what when where which who why will with would you your after all about above across again against ago almost along already also although always among around away back became become becomes before behind below between both came come coming down during each either else enough even ever everything far find found get gets getting give given going gone got here however just keep last less let life like look looking lot made make makes making many maybe meet much near need never next now off often once only other own per perhaps place please put rather really report reports right same safe say says search see seem seen services should show side since six some soon start state still such sure take tell ten than then thing things through time today together too took top toward under until upon use used using very via want watch way while within without work working world would year years yet news live breaking latest first people thought know few old open september history limit vote running free don job reaches name built case best big every video any bad public reading private ask help http https www com org net payload payloads`.split(/\s+/));

const ALIASES = new Map([
  ['ai', 'AI'], ['artificial intelligence', 'AI'], ['machine learning', '机器学习'],
  ['openai', 'OpenAI'], ['chatgpt', 'ChatGPT'], ['nvidia', '英伟达'], ['apple', '苹果'],
  ['microsoft', '微软'], ['google', 'Google'], ['tesla', '特斯拉'], ['bitcoin', '比特币'],
  ['crypto', '加密货币'], ['stock', '股票'], ['stocks', '股票'], ['market', '市场'],
  ['markets', '市场'], ['chip', '芯片'], ['chips', '芯片'], ['robot', '机器人'], ['robots', '机器人'],
  ['security', '网络安全'], ['browser', '浏览器'], ['web', '互联网'], ['internet', '互联网'], ['memory', '内存'],
  ['code', '编程'], ['testing', '测试'], ['software', '软件'], ['developer', '开发者'], ['developers', '开发者'],
  ['cloud', '云计算'], ['linux', 'Linux'], ['rust', 'Rust'], ['python', 'Python'], ['privacy', '隐私'],
  ['space', '太空'], ['launch', '发射'], ['orbit', '轨道'], ['aerospace', '航空航天'],
  ['trump', '特朗普'], ['putin', '普京'], ['iran', '伊朗'], ['ukraine', '乌克兰'],
  ['agent', 'AI智能体'], ['agents', 'AI智能体'], ['llm', '大语言模型'], ['model', '模型'],
  ['programming', '编程'], ['coding', '编程'], ['game', '游戏'], ['productivity', '生产力'],
]);

async function fetchJson(url, timeoutMs = 15_000, fetcher = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, {
      headers: { accept: 'application/json', 'user-agent': USER_AGENT },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
    return response.json();
  } finally { clearTimeout(timer); }
}

function stripHtml(value = '') {
  return String(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/https?:\/\/\S+|www\.\S+/gi, ' ')
    .replace(/\s+/g, ' ').trim();
}

function signal(text, platform, engagement = 0, url = '', publishedAt = '') {
  return { text: stripHtml(text), platform, engagement: Math.max(0, Number(engagement) || 0), url, publishedAt };
}

async function hackerNewsSignals(fetcher = fetch) {
  const ids = (await fetchJson('https://hacker-news.firebaseio.com/v0/topstories.json', 15_000, fetcher)).slice(0, HN_LIMIT);
  const items = await Promise.all(ids.map(async (id) => {
    try { return await fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, 8_000, fetcher); }
    catch { return null; }
  }));
  return items.filter((item) => item?.title && item?.type === 'story').map((item) => signal(
    item.title, 'Hacker News', Number(item.score) + Number(item.descendants || 0) * 1.5,
    item.url || `https://news.ycombinator.com/item?id=${item.id}`,
    item.time ? new Date(item.time * 1000).toISOString() : '',
  ));
}

async function mastodonSignals(instance, fetcher = fetch) {
  const items = await fetchJson(`https://${instance}/api/v1/trends/statuses?limit=40`, 15_000, fetcher);
  return (items || []).map((item) => signal(
    item.content, 'Mastodon',
    Number(item.favourites_count) + Number(item.reblogs_count) * 2 + Number(item.replies_count) * 1.5,
    item.url || '', item.created_at || '',
  )).filter((item) => item.text);
}

async function blueskySignals(fetcher = fetch) {
  const payload = await fetchJson('https://public.api.bsky.app/xrpc/app.bsky.unspecced.getTrends?limit=25', 15_000, fetcher);
  return (payload.trends || []).map((item) => signal(
    item.displayName || item.topic, 'Bluesky', item.postCount,
    item.link ? new URL(item.link, 'https://bsky.app').toString() : 'https://bsky.app/', item.startedAt || '',
  )).filter((item) => item.text);
}

async function devSignals(fetcher = fetch) {
  const items = await fetchJson('https://dev.to/api/articles?top=1&per_page=100', 15_000, fetcher);
  return (items || []).map((item) => signal(
    `${item.title || ''} ${(item.tag_list || []).join(' ')}`, 'DEV Community',
    Number(item.public_reactions_count) + Number(item.comments_count) * 1.5,
    item.url || '', item.published_at || '',
  )).filter((item) => item.text);
}

async function lobstersSignals(fetcher = fetch) {
  const items = await fetchJson('https://lobste.rs/hottest.json', 15_000, fetcher);
  return (items || []).map((item) => signal(
    `${item.title || ''} ${(item.tags || []).join(' ')}`, 'Lobsters',
    Number(item.score) + Number(item.comment_count) * 1.5,
    item.url || item.comments_url || '', item.created_at || '',
  )).filter((item) => item.text);
}

async function githubSignals(now = Date.now(), fetcher = fetch) {
  const since = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const query = new URLSearchParams({ q: `created:>${since}`, sort: 'stars', order: 'desc', per_page: '100' });
  const payload = await fetchJson(`https://api.github.com/search/repositories?${query}`, 15_000, fetcher);
  return (payload.items || []).map((item) => signal(
    `${item.name || ''} ${item.description || ''} ${(item.topics || []).join(' ')}`, 'GitHub Trending',
    Number(item.stargazers_count) + Number(item.forks_count) * 1.5,
    item.html_url || '', item.created_at || '',
  )).filter((item) => item.text);
}

function termsFromText(text) {
  const lower = String(text || '').toLowerCase();
  const terms = new Set();
  for (const [phrase, alias] of ALIASES) {
    if (new RegExp(`(^|[^a-z0-9])${phrase.replace(/ /g, '\\s+')}([^a-z0-9]|$)`, 'i').test(lower)) terms.add(alias);
  }
  for (const raw of lower.match(/[\p{L}\p{N}+#.-]+/gu) || []) {
    const word = raw.replace(/^[#.+-]+|[#.+-]+$/g, '');
    if (word.length < 3 || word.length > 28 || STOP_WORDS.has(word) || /^\d+$/.test(word)) continue;
    terms.add(ALIASES.get(word) || word);
  }
  return [...terms].slice(0, 18);
}

function buildWordCloud(signals, now = Date.now(), limit = CLOUD_SIZE) {
  const usable = signals.filter((item) => item?.text);
  const platformCounts = new Map();
  usable.forEach((item) => platformCounts.set(item.platform, (platformCounts.get(item.platform) || 0) + 1));
  const aggregate = new Map();
  for (const item of usable) {
    const ageHours = Math.max(0, (now - Date.parse(item.publishedAt || now)) / 3_600_000);
    const freshness = Number.isFinite(ageHours) ? Math.max(0.25, Math.exp(-ageHours / 36)) : 0.7;
    const sourceScale = Math.sqrt(platformCounts.get(item.platform) || 1);
    const weight = freshness * (1 + Math.log10(1 + item.engagement)) / sourceScale;
    for (const term of termsFromText(item.text)) {
      const key = term.toLocaleLowerCase();
      if (!aggregate.has(key)) aggregate.set(key, { term, score: 0, mentions: 0, platforms: new Set(), url: item.url });
      const entry = aggregate.get(key);
      entry.score += weight;
      entry.mentions += 1;
      entry.platforms.add(item.platform);
      if (!entry.url && item.url) entry.url = item.url;
    }
  }
  return [...aggregate.values()].map((entry) => ({
    id: crypto.createHash('sha1').update(entry.term).digest('hex').slice(0, 10),
    term: entry.term, score: Math.round(entry.score * (1 + Math.max(0, entry.platforms.size - 1) * 0.45) * 100) / 100,
    mentions: entry.mentions, platformCount: entry.platforms.size,
    platforms: [...entry.platforms], url: entry.url || '',
  })).filter((entry) => entry.mentions >= 2 || entry.platformCount >= 2)
    .sort((left, right) => right.score - left.score || right.platformCount - left.platformCount || right.mentions - left.mentions)
    .slice(0, limit);
}

async function collectSocialWordCloud(baseItems = [], now = Date.now(), fetcher = fetch) {
  const baseSignals = baseItems.filter((item) => item?.category !== 'youtube').map((item) => signal(
    `${item.titleZh || ''} ${item.title || ''}`, 'DailyReview',
    Number(item.score) || 1, item.url || '', item.publishedAt || '',
  ));
  const jobs = [
    ['Hacker News', () => hackerNewsSignals(fetcher)],
    ...MASTODON_INSTANCES.map((instance) => [`Mastodon · ${instance}`, () => mastodonSignals(instance, fetcher)]),
    ['Bluesky', () => blueskySignals(fetcher)],
    ['GitHub Trending', () => githubSignals(now, fetcher)],
    ['DEV Community', () => devSignals(fetcher)],
    ['Lobsters', () => lobstersSignals(fetcher)],
  ];
  const settled = await Promise.allSettled(jobs.map(([, job]) => job()));
  const signals = [...baseSignals];
  const sources = [];
  settled.forEach((result, index) => {
    const name = jobs[index][0];
    if (result.status === 'fulfilled' && result.value.length) {
      signals.push(...result.value);
      sources.push({ name, count: result.value.length });
    } else {
      console.warn(`${name} word-cloud source failed: ${result.reason?.message || 'empty response'}`);
    }
  });
  const trends = buildWordCloud(signals, now);
  if (trends.length < 10) throw new Error(`Word cloud returned only ${trends.length}/10 usable terms.`);
  return { trends, sources, signalCount: signals.length };
}

module.exports = { buildWordCloud, collectSocialWordCloud, stripHtml, termsFromText };
