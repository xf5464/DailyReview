'use strict';

const API_ROOT = 'https://dailyreview-reader.xf5464.workers.dev';
const ARCHIVE_URLS = [
  'https://raw.githubusercontent.com/xf5464/DailyReview/main/site/reader/data/recent.json',
  new URL('data/recent.json', location.href).toString(),
];
const ARCHIVE_CACHE_KEY = 'dailyreview-recent-v3';
const ARTICLE_CACHE_KEY = 'dailyreview-articles-v1';
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const RESUME_REFRESH_MS = 5 * 60 * 1000;

const refs = {
  days: document.querySelector('#daysContainer'),
  empty: document.querySelector('#emptyArchive'),
  archiveMeta: document.querySelector('#archiveMeta'),
  tabs: [...document.querySelectorAll('.category-tab')],
  dialog: document.querySelector('#readerDialog'),
  close: document.querySelector('#closeDialog'),
  loading: document.querySelector('#loadingState'),
  article: document.querySelector('#article'),
  error: document.querySelector('#errorState'),
  title: document.querySelector('#articleTitle'),
  site: document.querySelector('#siteName'),
  meta: document.querySelector('#articleMeta'),
  body: document.querySelector('#articleBody'),
  source: document.querySelector('#footerSourceLink'),
  errorSource: document.querySelector('#errorSourceLink'),
  errorMessage: document.querySelector('#errorMessage'),
  retry: document.querySelector('#retryButton'),
  dialogFont: document.querySelector('#dialogFontButton'),
};

let archive = { schemaVersion: 2, updatedAt: null, items: [] };
const savedCategory = localStorage.getItem('dailyreview-reader-category');
let activeCategory = ['tech', 'market', 'world', 'youtube', 'trends'].includes(savedCategory) ? savedCategory : 'tech';
let currentUrl = '';
let backgroundedAt = 0;
let fontStep = Number(localStorage.getItem('dailyreview-reader-font') || 1);
const fontSizes = [17, 19, 21, 23];

function jsonStorage(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
}

function chinaDate(value = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(value));
}

function pruneArchive(value) {
  const items = Array.isArray(value?.items)
    ? value.items
    : (value?.days || []).flatMap((day) => day.items || []);
  const bySource = new Map();
  items.forEach((item) => {
    const key = item.sourceKey || item.id || item.url;
    if (!key) return;
    const previous = bySource.get(key);
    if (!previous || itemTimestamp(item) > itemTimestamp(previous)) bySource.set(key, item);
  });
  return {
    schemaVersion: 2,
    updatedAt: value?.updatedAt || null,
    items: [...bySource.values()],
    trends: Array.isArray(value?.trends) ? value.trends.slice(0, 30) : [],
  };
}

function pruneArticleCache() {
  const cached = jsonStorage(ARTICLE_CACHE_KEY, {});
  const cutoff = Date.now() - THREE_DAYS_MS;
  const next = Object.fromEntries(Object.entries(cached).filter(([, entry]) =>
    Number(entry?.cachedAt || 0) >= cutoff && entry?.payload?.translatedText));
  localStorage.setItem(ARTICLE_CACHE_KEY, JSON.stringify(next));
  return next;
}

function categoryLabel(category) {
  return category === 'market' ? '美股' : category === 'world' ? '国际' : category === 'youtube' ? 'YouTube' : category === 'trends' ? '热点词云' : '科技';
}

function publishedTimeLabel(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '时间未知';
  const time = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(date);
  const dateKey = chinaDate(date);
  if (dateKey === chinaDate()) return `今天 ${time}`;
  if (dateKey === chinaDate(Date.now() - 24 * 60 * 60 * 1000)) return `昨天 ${time}`;
  const day = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric',
  }).format(date);
  return `${day} ${time}`;
}

function directArticleUrl(url) {
  try {
    const target = new URL(url);
    if (target.hostname === 'news.google.com' || target.hostname.endsWith('.news.google.com')) {
      const resolver = new URL('/open', API_ROOT);
      resolver.searchParams.set('url', target.toString());
      return resolver.toString();
    }
  } catch {
    return url;
  }
  return url;
}

function chromeUrl(url) {
  if (url.startsWith('https://')) return `googlechromes://${url.slice(8)}`;
  if (url.startsWith('http://')) return `googlechrome://${url.slice(7)}`;
  return url;
}

function itemButton(item, rank) {
  const row = document.createElement('div');
  row.className = 'news-row';

  const button = document.createElement('a');
  button.className = 'news-item';
  button.href = chromeUrl(directArticleUrl(item.url));
  button.dataset.id = item.id || '';

  const number = document.createElement('span');
  number.className = 'rank';
  number.textContent = String(rank);
  const copy = document.createElement('span');
  const translated = document.createElement('span');
  translated.className = 'news-title';
  translated.textContent = item.titleZh || item.title || '未命名新闻';
  const original = document.createElement('span');
  original.className = 'news-original';
  original.textContent = item.title || '';
  copy.append(translated, original);
  if (item.category === 'world' && item.engagement) {
    const note = document.createElement('span');
    note.className = 'news-note';
    note.textContent = item.engagement;
    copy.append(note);
  }
  const details = document.createElement('span');
  details.className = 'news-details';
  const source = document.createElement('span');
  source.className = 'news-source';
  source.textContent = item.source || '来源未知';
  const published = document.createElement('span');
  published.className = 'news-time';
  published.textContent = publishedTimeLabel(item.publishedAt);
  details.append(source, published);
  if (item.category === 'youtube' && item.engagement) {
    const views = document.createElement('span');
    views.className = 'news-views';
    views.textContent = item.engagement;
    details.append(views);
  }
  button.append(number, copy, details);

  const browser = document.createElement('a');
  browser.className = 'safari-link';
  const youtube = item.category === 'youtube';
  browser.href = youtube ? item.url : chromeUrl(directArticleUrl(item.url));
  browser.textContent = youtube ? 'YouTube' : 'Chrome';
  browser.setAttribute('aria-label', `${youtube ? '使用 YouTube 打开' : '使用 Chrome 打开'}：${translated.textContent}`);
  if (youtube) browser.dataset.nativeApp = 'youtube';

  row.append(button, browser);
  return row;
}

function updateCategoryTabs() {
  refs.tabs.forEach((tab) => {
    const selected = tab.dataset.category === activeCategory;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
}

function itemTimestamp(item) {
  const publishedAt = Date.parse(item?.publishedAt);
  if (Number.isFinite(publishedAt)) return publishedAt;
  const pushedAt = Date.parse(item?.pushedAt);
  return Number.isFinite(pushedAt) ? pushedAt : 0;
}

function selectedItems(value) {
  return (value.items || [])
    .filter((item) => item.category === activeCategory)
    .sort((left, right) => itemTimestamp(right) - itemTimestamp(left))
    .slice(0, 10);
}

function updatedTimeLabel(value) {
  if (!value) return '更新时间未知';
  return `更新于 ${publishedTimeLabel(value)}`;
}

function renderWordCloud(trends) {
  const panel = document.createElement('section');
  panel.className = 'day word-cloud-panel';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('word-cloud');
  svg.setAttribute('viewBox', '0 0 600 600');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', '社交平台与公开社区热点关键词词云');
  const sorted = [...trends].sort((left, right) => Number(right.score) - Number(left.score));
  const scores = sorted.map((item) => Number(item.score) || 0);
  const minimum = Math.min(...scores, 0);
  const maximum = Math.max(...scores, 1);
  const boxes = [];
  const colors = ['#175cd3', '#7f56d9', '#c4320a', '#087443', '#b54708', '#344054'];
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  sorted.forEach((trend, index) => {
    const ratio = (Number(trend.score) - minimum) / Math.max(1, maximum - minimum);
    const size = Math.round(20 + Math.sqrt(Math.max(0, ratio)) * 48);
    const label = trend.labelZh || trend.term;
    context.font = `760 ${size}px serif`;
    const width = Math.min(260, context.measureText(label).width + 12);
    const height = size * 1.1;
    let position = null;
    for (let step = 0; step < 900; step += 1) {
      const angle = step * 0.43;
      const radius = 2.35 * Math.sqrt(step);
      const x = 300 + Math.cos(angle) * radius;
      const y = 300 + Math.sin(angle) * radius;
      const box = { left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 };
      const corners = [[box.left, box.top], [box.right, box.top], [box.left, box.bottom], [box.right, box.bottom]];
      const inside = corners.every(([cx, cy]) => Math.hypot(cx - 300, cy - 300) <= 286);
      const overlaps = boxes.some((other) => !(box.right + 4 < other.left || box.left - 4 > other.right || box.bottom + 3 < other.top || box.top - 3 > other.bottom));
      if (inside && !overlaps) { position = { x, y, box }; break; }
    }
    if (!position) return;
    boxes.push(position.box);
    const anchor = document.createElementNS('http://www.w3.org/2000/svg', 'a');
    if (trend.url) { anchor.setAttribute('href', trend.url); anchor.setAttribute('target', '_blank'); }
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.classList.add('cloud-word');
    text.setAttribute('x', position.x); text.setAttribute('y', position.y);
    text.setAttribute('text-anchor', 'middle'); text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-size', size); text.setAttribute('fill', colors[index % colors.length]);
    text.textContent = label;
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${label} · ${trend.mentions || 0}次出现 · ${trend.platformCount || 0}个平台`;
    text.append(title); anchor.append(text); svg.append(anchor);
  });
  const meta = document.createElement('p');
  meta.className = 'cloud-meta';
  meta.textContent = '字号综合出现次数、跨平台数量、互动量和发布时间；不包含 YouTube。点击词语可打开代表内容。';
  panel.append(svg, meta);
  refs.days.append(panel);
}

function renderArchive(value, fromCache = false) {
  archive = pruneArchive(value);
  localStorage.setItem(ARCHIVE_CACHE_KEY, JSON.stringify(archive));
  refs.days.replaceChildren();
  updateCategoryTabs();

  if (activeCategory === 'trends') {
    const trends = archive.trends || [];
    refs.empty.hidden = trends.length > 0;
    refs.archiveMeta.textContent = trends.length
      ? `热点词云 · ${trends.length}个关键词 · ${updatedTimeLabel(archive.updatedAt)}${fromCache ? ' · 本地缓存' : ''}`
      : '本次抓取暂无热点关键词';
    if (trends.length) renderWordCloud(trends);
    return;
  }

  const items = selectedItems(archive);
  refs.empty.hidden = items.length > 0;
  refs.archiveMeta.textContent = items.length
    ? `${categoryLabel(activeCategory)} · ${activeCategory === 'youtube' ? '最近24小时热度前10' : activeCategory === 'world' ? '免费来源综合热点前10' : '每个网站当前头条'} · ${updatedTimeLabel(archive.updatedAt)}${fromCache ? ' · 本地缓存' : ''}`
    : `本次抓取暂无${categoryLabel(activeCategory)}新闻`;

  if (!items.length) return;
  const section = document.createElement('section');
  section.className = 'day';
  const list = document.createElement('ol');
  list.className = 'news-list';
  items.forEach((item, index) => {
    const row = document.createElement('li');
    row.append(itemButton(item, index + 1));
    list.append(row);
  });
  section.append(list);
  refs.days.append(section);
}

function selectCategory(category) {
  if (!['tech', 'market', 'world', 'youtube', 'trends'].includes(category) || category === activeCategory) return;
  activeCategory = category;
  localStorage.setItem('dailyreview-reader-category', category);
  renderArchive(archive);
  if (!selectedItems(archive).length) loadArchive();
}

function recoverAfterResume() {
  document.documentElement.style.pointerEvents = '';
  document.body.style.pointerEvents = '';
  updateCategoryTabs();
  if (archive.items.length) renderArchive(archive, true);
  if (!archive.updatedAt || Date.now() - Date.parse(archive.updatedAt) >= RESUME_REFRESH_MS) loadArchive();
}

async function loadArchive() {
  const cached = pruneArchive(jsonStorage(ARCHIVE_CACHE_KEY, { items: [] }));
  if (cached.items.length) renderArchive(cached, true);
  let lastError;
  for (const archiveUrl of ARCHIVE_URLS) {
    try {
      const target = new URL(archiveUrl);
      target.searchParams.set('v', String(Date.now()));
      const response = await fetch(target, { cache: 'no-store' });
      if (!response.ok) throw new Error(String(response.status));
      const next = await response.json();
      if (!Array.isArray(next?.items)) throw new Error('数据格式错误');
      renderArchive(next);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  if (!cached.items.length) renderArchive(cached, true);
  refs.archiveMeta.textContent += ` · 加载失败，点击页签重试（${lastError?.message || '网络错误'}）`;
}

function showDialogState(name) {
  refs.loading.hidden = name !== 'loading';
  refs.article.hidden = name !== 'article';
  refs.error.hidden = name !== 'error';
}

function renderParagraphs(text) {
  refs.body.replaceChildren();
  String(text || '').split(/\n{2,}/).map((part) => part.trim()).filter(Boolean).forEach((paragraph) => {
    const element = document.createElement('p');
    element.textContent = paragraph;
    refs.body.append(element);
  });
}

function renderArticle(payload, localCache = false) {
  refs.title.textContent = payload.titleZh || payload.title || '中文译文';
  refs.site.textContent = payload.siteName || new URL(payload.url).hostname;
  const sourceNames = { direct: '原站', 'browser-run': '浏览器渲染', 'jina-reader': '阅读服务' };
  const source = sourceNames[payload.extractionSource] || '网页';
  refs.meta.textContent = `${source}提取 · Cloudflare Workers AI 翻译 · ${localCache || payload.cached ? '已读取缓存' : '刚刚生成'}`;
  refs.source.href = payload.url;
  renderParagraphs(payload.translatedText);
  showDialogState('article');
}

async function loadArticle(url, force = false) {
  currentUrl = url;
  refs.source.href = url;
  refs.errorSource.href = url;
  if (!refs.dialog.open) refs.dialog.showModal();
  showDialogState('loading');

  const articleCache = pruneArticleCache();
  if (!force && articleCache[url]?.payload) {
    renderArticle(articleCache[url].payload, true);
    return;
  }

  try {
    const endpoint = new URL('/reader-api', API_ROOT);
    endpoint.searchParams.set('url', url);
    const response = await fetch(endpoint, { headers: { accept: 'application/json' } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `服务器返回 ${response.status}`);
    if (!payload.translatedText) throw new Error('没有提取到可阅读的文章正文。');
    articleCache[url] = { cachedAt: Date.now(), payload };
    localStorage.setItem(ARTICLE_CACHE_KEY, JSON.stringify(articleCache));
    renderArticle(payload);
  } catch (error) {
    refs.errorMessage.textContent = `${error.message} 你仍可打开英文原文。`;
    showDialogState('error');
  }
}

function changeFont() {
  fontStep = (fontStep + 1) % fontSizes.length;
  localStorage.setItem('dailyreview-reader-font', String(fontStep));
  document.documentElement.style.setProperty('--reader-size', `${fontSizes[fontStep]}px`);
}

refs.tabs[0]?.parentElement.addEventListener('click', (event) => {
  const tab = event.target.closest('.category-tab');
  if (tab) selectCategory(tab.dataset.category);
});
refs.retry.addEventListener('click', () => { if (currentUrl) loadArticle(currentUrl, true); });
refs.close.addEventListener('click', () => refs.dialog.close());
refs.dialog.addEventListener('click', (event) => { if (event.target === refs.dialog) refs.dialog.close(); });
refs.dialogFont.addEventListener('click', changeFont);
document.documentElement.style.setProperty('--reader-size', `${fontSizes[fontStep] || 19}px`);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    backgroundedAt = Date.now();
    return;
  }
  if (backgroundedAt) recoverAfterResume();
  backgroundedAt = 0;
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted || backgroundedAt) recoverAfterResume();
  backgroundedAt = 0;
});

pruneArticleCache();
loadArchive();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('../service-worker.js').then(async (registration) => {
    const subscription = await registration.pushManager?.getSubscription();
    if (!subscription) return;
    await fetch(`${API_ROOT}/push/unsubscribe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(subscription),
    }).catch(() => null);
    await subscription.unsubscribe();
  }).catch(() => {});
}

const params = new URL(location.href).searchParams;
const initialUrl = params.get('url');
if (initialUrl) loadArticle(initialUrl);
