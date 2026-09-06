const crypto = require('node:crypto');

const CLOUD_SIZE = 24;
const EVENT_VERBS = /(起诉|发布|推出|上线|宣布|裁员|收购|批准|禁用|调查|袭击|攻击|会晤|会谈|通过|发射|部署|撤回|辞职|任命|判处|飙升|上涨|下跌|增长|下降|创.*新高|刷新.*纪录|达成|签署|制裁|停火|起飞|首飞|获批|开放|关闭|接管|管理)/;

function stripHtml(value = '') {
  return String(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/https?:\/\/\S+|www\.\S+/gi, ' ')
    .replace(/\s+/g, ' ').trim();
}

function cleanEventLabel(value = '') {
  let text = stripHtml(value)
    .replace(/^【[^】]+】\s*/, '')
    .replace(/^[-–—:：\s]+/, '')
    .replace(/[“”‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  text = text
    .replace(/以下是.*$/i, '')
    .replace(/这里是.*$/i, '')
    .replace(/最新出版物$/i, '')
    .replace(/对此感到震惊.*$/i, '')
    .replace(/点击.*$/i, '')
    .replace(/\s*[-—–]\s*.*$/i, '')
    .trim();
  const clauses = text.split(/[。！？!?；;]/).map((part) => part.trim()).filter(Boolean);
  if (clauses.length > 1) text = clauses.find((part) => EVENT_VERBS.test(part)) || clauses[0];
  if (text.length > 24) {
    const parts = text.split(/[，,:：]/).map((part) => part.trim()).filter(Boolean);
    const eventPart = parts.find((part) => EVENT_VERBS.test(part));
    if (eventPart && eventPart.length >= 7) text = eventPart;
    else if (parts[0]?.length >= 8) text = parts[0];
  }
  if (text.length > 24) text = `${text.slice(0, 23)}…`;
  return text;
}

function titleTokens(value = '') {
  const normalized = String(value).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ').replace(/\s+/g, ' ').trim();
  const latin = normalized.split(' ').filter((token) => token.length > 2);
  const chinese = normalized.match(/[\u4e00-\u9fff]{2,6}/g) || [];
  return new Set([...latin, ...chinese]);
}
function sameEvent(left, right) {
  const a = titleTokens(left); const b = titleTokens(right);
  if (!a.size || !b.size) return false;
  let shared = 0; for (const token of a) if (b.has(token)) shared += 1;
  return shared >= 2 && shared / Math.min(a.size, b.size) >= 0.35;
}
function freshnessScore(value, now) {
  const parsed = Date.parse(value || '');
  if (!Number.isFinite(parsed)) return 8;
  const ageHours = Math.max(0, (now - parsed) / 3_600_000);
  return Math.max(0, 36 - ageHours) * 1.4;
}

function buildEventCloud(items = [], now = Date.now(), limit = CLOUD_SIZE) {
  const usable = items.filter((item) => item && item.category !== 'youtube' && (item.titleZh || item.title));
  const ranked = usable.map((item) => {
    const related = usable.filter((other) => other !== item && sameEvent(item.title || item.titleZh, other.title || other.titleZh));
    const sources = new Set([item.source, ...related.map((other) => other.source)].filter(Boolean));
    const base = Math.min(100, Math.max(0, Number(item.score) || 0));
    return {
      item,
      label: cleanEventLabel(item.titleZh || item.title),
      score: base * 0.45 + freshnessScore(item.publishedAt, now) + sources.size * 9 + related.length * 4,
      mentions: related.length + 1,
      platformCount: sources.size,
      platforms: [...sources],
    };
  }).filter((entry) => entry.label.length >= 4);
  ranked.sort((a, b) => b.score - a.score || b.platformCount - a.platformCount);
  const selected = [];
  for (const entry of ranked) {
    if (selected.some((chosen) => sameEvent(chosen.item.title || chosen.item.titleZh, entry.item.title || entry.item.titleZh))) continue;
    selected.push(entry);
    if (selected.length >= limit) break;
  }
  return selected.map((entry) => ({
    id: crypto.createHash('sha1').update(entry.label).digest('hex').slice(0, 10),
    term: entry.label, labelZh: entry.label, score: Math.round(entry.score * 100) / 100,
    mentions: entry.mentions, platformCount: entry.platformCount, platforms: entry.platforms,
    url: entry.item.url || '', category: entry.item.category || '',
  }));
}

// Compatibility helpers retained for unit tests and older callers. The live reader uses buildEventCloud.
function termsFromText(text) {
  const lower = String(text || '').toLowerCase();
  const terms = [];
  const add = (value) => { if (value && !terms.includes(value)) terms.push(value); };
  if (/\bopenai\b/.test(lower)) add('OpenAI');
  if (/\bnvidia\b/.test(lower)) add('英伟达');
  if (/\brubin\b/.test(lower)) add('Rubin');
  if (/\bclaude\b/.test(lower)) add('Claude');
  for (const match of String(text || '').match(/\bGPT\s*-?\s*\d+(?:\.\d+)*\b/gi) || []) add(match.replace(/\s+/g, '').replace(/^gpt/i, 'GPT'));
  return terms;
}
function buildWordCloud(signals, now = Date.now(), limit = CLOUD_SIZE) {
  const aggregate = new Map();
  for (const item of (signals || []).filter((signal) => signal?.platform !== 'YouTube')) {
    for (const term of termsFromText(item.text || '')) {
      const key = term.toLowerCase();
      if (!aggregate.has(key)) aggregate.set(key, { term, score: 0, mentions: 0, platforms: new Set(), url: item.url || '' });
      const entry = aggregate.get(key); entry.mentions += 1; entry.platforms.add(item.platform || 'source'); entry.score += 1 + Math.log10(1 + Number(item.engagement || 0));
    }
  }
  return [...aggregate.values()].map((entry) => ({
    id: crypto.createHash('sha1').update(entry.term).digest('hex').slice(0, 10), term: entry.term,
    score: Math.round((entry.score + entry.platforms.size * 5) * 100) / 100, mentions: entry.mentions,
    platformCount: entry.platforms.size, platforms: [...entry.platforms], url: entry.url,
  })).sort((a, b) => b.score - a.score).slice(0, limit);
}

async function collectSocialWordCloud(baseItems = [], now = Date.now()) {
  const trends = buildEventCloud(baseItems, now);
  if (trends.length < 10) throw new Error(`Event cloud returned only ${trends.length}/10 usable events.`);
  const newsItems = baseItems.filter((item) => item?.category !== 'youtube');
  const names = [...new Set(newsItems.map((item) => item.source).filter(Boolean))];
  return { trends, sources: names.map((name) => ({ name, count: newsItems.filter((item) => item.source === name).length })), signalCount: newsItems.length };
}

module.exports = { buildEventCloud, buildWordCloud, cleanEventLabel, collectSocialWordCloud, stripHtml, termsFromText };
