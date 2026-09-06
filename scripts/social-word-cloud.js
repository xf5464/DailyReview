const crypto = require('node:crypto');

const CLOUD_SIZE = 24;
const EVENT_VERBS = /(起诉|发布|推出|上线|宣布|裁员|收购|批准|禁用|调查|袭击|攻击|会晤|会谈|通过|发射|部署|撤回|辞职|任命|判处|飙升|上涨|下跌|增长|下降|创.*新高|刷新.*纪录|达成|签署|制裁|停火|起飞|首飞|获批|开放|关闭|接管|管理|摧毁|离开|撤离|被捕|获释|当选|辞任|禁售|停售|召回|停产|量产|交付|扩产|融资|上市|破产|重组|拒绝|允许|要求|警告|击落|恢复|停止|爆炸|坠毁|突破)/;
const IMPACT_WORDS = /(战争|导弹|无人机|油轮|航母|洪水|地震|火灾|死亡|死刑|关税|贸易|利率|降息|加息|失业|通胀|铜价|油价|股价|出货量|CEO|首席执行官|火箭|轨道|GPU|芯片|诉讼|制裁)/i;
const NON_EVENT = /(如何|how to|最佳|best |购买|buy |优惠|deal|折扣|省钱|观看|watch |直播|live stream|评测|review|教程|guide|值得买吗|盘点|推荐|不要扔掉|把它变成|强烈反弹|开放的|original link|store|商城|智力飞翔|技巧|攻略)/i;

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
    .replace(/^(塔斯社|路透社|美联社|新华社|BBC|CNN)报道[，,:：\s]*/i, '')
    .replace(/^据[^，,]{2,12}报道[，,:：\s]*/i, '')
    .replace(/以下是.*$/i, '')
    .replace(/这里是.*$/i, '')
    .replace(/最新出版物$/i, '')
    .replace(/对此感到震惊.*$/i, '')
    .replace(/点击.*$/i, '')
    .replace(/\s*[-—–]\s*.*$/i, '')
    .trim();

  // Repair a few recurring bad machine translations and turn them into event phrases.
  text = text
    .replace(/美国航空公司亚伯拉罕·林肯[^，。]*/i, '美军林肯号航母')
    .replace(/俄罗斯拉夫罗夫/g, '拉夫罗夫')
    .replace(/莫斯科并未排除俄罗斯、美国、中国总统之间举行三方会晤的可能性/g, '俄美中领导人三方会晤仍有可能')
    .replace(/在埃及毒品案中被判处死刑的11人中的电视节目主持人/g, '埃及毒品案11人被判死刑')
    .replace(/德国公司成为欧洲第一家发射完全商业化轨道火箭的公司/g, '德国公司完成欧洲首个商业轨道火箭发射')
    .replace(/在洪水摧毁的中尼边境，没有迹象表明曾经繁忙的港口/g, '中尼边境洪水摧毁繁忙港口')
    .replace(/莫斯科参与莱比锡无人机事件的指控是.?真正的战争开始.?/g, '莱比锡无人机指控意味着真正战争开始')
    .trim();

  const clauses = text.split(/[。！？!?；;]/).map((part) => part.trim()).filter(Boolean);
  if (clauses.length > 1) text = clauses.find((part) => EVENT_VERBS.test(part) || IMPACT_WORDS.test(part)) || clauses[0];

  text = text
    .replace(/^在([^，,]{2,14})[，,]\s*/, '$1：')
    .replace(/，?以下是.*$/, '')
    .replace(/，?此前.*$/, '')
    .replace(/，?原因是.*$/, '')
    .trim();

  if (text.length > 20) {
    const parts = text.split(/[，,:：]/).map((part) => part.trim()).filter(Boolean);
    const eventPart = parts.find((part) => (EVENT_VERBS.test(part) || IMPACT_WORDS.test(part)) && part.length >= 6 && part.length <= 20);
    if (eventPart) text = eventPart;
    else if (parts.length >= 2 && `${parts[0]}${parts[1]}`.length <= 20) text = `${parts[0]}：${parts[1]}`;
  }
  if (text.length > 20) text = `${text.slice(0, 19)}…`;
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
function hoursOld(value, now) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? Math.max(0, (now - parsed) / 3_600_000) : 999;
}
function freshnessScore(value, now) {
  const ageHours = hoursOld(value, now);
  return Math.max(0, 36 - ageHours) * 1.4;
}
function isConcreteEvent(item, label) {
  const sourceText = `${item.titleZh || ''} ${item.title || ''}`;
  if (NON_EVENT.test(sourceText) || NON_EVENT.test(label)) return false;
  if (EVENT_VERBS.test(label) || EVENT_VERBS.test(sourceText)) return true;
  if (item.category === 'world' && IMPACT_WORDS.test(sourceText)) return true;
  if (/\d/.test(label) && /(增长|下降|上涨|下跌|裁员|死亡|获利|亏损|出货|销量|营收|利润|失业|通胀)/.test(sourceText)) return true;
  return false;
}

function buildEventCloud(items = [], now = Date.now(), limit = CLOUD_SIZE) {
  const usable = items.filter((item) => item && item.category !== 'youtube' && (item.titleZh || item.title)
    && hoursOld(item.publishedAt, now) <= 72);
  const ranked = usable.map((item) => {
    const related = usable.filter((other) => other !== item && sameEvent(item.title || item.titleZh, other.title || other.titleZh));
    const sources = new Set([item.source, ...related.map((other) => other.source)].filter(Boolean));
    const base = Math.min(100, Math.max(0, Number(item.score) || 0));
    const label = cleanEventLabel(item.titleZh || item.title);
    return {
      item, label,
      score: base * 0.45 + freshnessScore(item.publishedAt, now) + sources.size * 9 + related.length * 4,
      mentions: related.length + 1,
      platformCount: sources.size,
      platforms: [...sources],
    };
  }).filter((entry) => entry.label.length >= 6 && isConcreteEvent(entry.item, entry.label));
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
  if (trends.length < 8) throw new Error(`Event cloud returned only ${trends.length}/8 usable events.`);
  const newsItems = baseItems.filter((item) => item?.category !== 'youtube');
  const names = [...new Set(newsItems.map((item) => item.source).filter(Boolean))];
  return { trends, sources: names.map((name) => ({ name, count: newsItems.filter((item) => item.source === name).length })), signalCount: newsItems.length };
}

module.exports = { buildEventCloud, buildWordCloud, cleanEventLabel, collectSocialWordCloud, stripHtml, termsFromText };