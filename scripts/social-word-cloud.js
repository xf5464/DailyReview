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
  if (clauses.length > 1) {
    const eventClause = clauses.find((part) => EVENT_VERBS.test(part));
    if (eventClause) text = eventClause;
    else text = clauses[0];
  }

  if (text.length > 24) {
    const commaParts = text.split(/[，,:：]/).map((part) => part.trim()).filter(Boolean);
    const eventPart = commaParts.find((part) => EVENT_VERBS.test(part));
    if (eventPart && eventPart.length >= 7) text = eventPart;
    else if (commaParts[0]?.length >= 8) text = commaParts[0];
  }

  if (text.length > 24) text = `${text.slice(0, 23)}…`;
  return text;
}

function titleTokens(value = '') {
  const normalized = String(value).toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ').trim();
  const latin = normalized.split(' ').filter((token) => token.length > 2);
  const chinese = normalized.match(/[\u4e00-\u9fff]{2,6}/g) || [];
  return new Set([...latin, ...chinese]);
}

function sameEvent(left, right) {
  const a = titleTokens(left);
  const b = titleTokens(right);
  if (!a.size || !b.size) return false;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
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
    const score = base * 0.45 + freshnessScore(item.publishedAt, now) + sources.size * 9 + related.length * 4;
    return {
      item,
      label: cleanEventLabel(item.titleZh || item.title),
      score,
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
    term: entry.label,
    labelZh: entry.label,
    score: Math.round(entry.score * 100) / 100,
    mentions: entry.mentions,
    platformCount: entry.platformCount,
    platforms: entry.platforms,
    url: entry.item.url || '',
    category: entry.item.category || '',
  }));
}

function termsFromText(text) {
  const label = cleanEventLabel(text);
  return label ? [label] : [];
}

function buildWordCloud(signals, now = Date.now(), limit = CLOUD_SIZE) {
  const items = (signals || []).map((item) => ({
    title: item.text || '', titleZh: item.text || '', source: item.platform || '',
    score: item.engagement || 0, publishedAt: item.publishedAt || '', url: item.url || '', category: item.category || 'tech',
  }));
  return buildEventCloud(items, now, limit);
}

async function collectSocialWordCloud(baseItems = [], now = Date.now()) {
  const trends = buildEventCloud(baseItems, now);
  if (trends.length < 10) throw new Error(`Event cloud returned only ${trends.length}/10 usable events.`);
  return {
    trends,
    sources: [...new Set(baseItems.filter((item) => item?.category !== 'youtube').map((item) => item.source).filter(Boolean))]
      .map((name) => ({ name, count: baseItems.filter((item) => item?.source === name).length })),
    signalCount: baseItems.filter((item) => item?.category !== 'youtube').length,
  };
}

module.exports = { buildEventCloud, buildWordCloud, cleanEventLabel, collectSocialWordCloud, stripHtml, termsFromText };
