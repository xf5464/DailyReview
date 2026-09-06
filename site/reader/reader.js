'use strict';

const API_ROOT = 'https://dailyreview-reader.xf5464.workers.dev';
const ARCHIVE_URLS = [
  'https://raw.githubusercontent.com/xf5464/DailyReview/main/site/reader/data/recent.json',
  new URL('data/recent.json', location.href).toString(),
];
const ARCHIVE_CACHE_KEY = 'dailyreview-recent-v3';
const ARTICLE_CACHE_KEY = 'dailyreview-articles-v1';
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

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
let activeCategory = ['tech', 'market', 'world', 'youtube'].includes(savedCategory) ? savedCategory : 'tech';
let currentUrl = '';
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
  return category === 'market' ? '美股' : category === 'world' ? '国际' : category === 'youtube' ? 'YouTube' : '科技';
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
    .sort((left, right) =>
      (Number(left.sourceOrder) || 0) - (Number(right.sourceOrder) || 0))
    .slice(0, 10);
}

function updatedTimeLabel(value) {
  if (!value) return '更新时间未知';
  return `更新于 ${publishedTimeLabel(value)}`;
}

function renderArchive(value, fromCache = false) {
  archive = pruneArchive(value);
  localStorage.setItem(ARCHIVE_CACHE_KEY, JSON.stringify(archive));
  refs.days.replaceChildren();
  updateCategoryTabs();

  const items = selectedItems(archive);
  refs.empty.hidden = items.length > 0;
  refs.archiveMeta.textContent = items.length
    ? `${categoryLabel(activeCategory)} · ${activeCategory === 'youtube' ? '最近24小时热度前10' : activeCategory === 'world' ? '免费来源综合热点前10' : '每个来源最新 1 条'} · ${updatedTimeLabel(archive.updatedAt)}${fromCache ? ' · 本地缓存' : ''}`
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
  if (!['tech', 'market', 'world', 'youtube'].includes(category) || category === activeCategory) return;
  activeCategory = category;
  localStorage.setItem('dailyreview-reader-category', category);
  renderArchive(archive);
  if (!selectedItems(archive).length) loadArchive();
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

refs.days.addEventListener('click', (event) => {
  const externalLink = event.target.closest('.news-item, .safari-link');
  if (!externalLink) return;
  if (externalLink.dataset.nativeApp === 'youtube') return;
  event.preventDefault();
  location.href = externalLink.getAttribute('href');
});
refs.tabs.forEach((tab) => tab.addEventListener('click', () => selectCategory(tab.dataset.category)));
refs.retry.addEventListener('click', () => { if (currentUrl) loadArticle(currentUrl, true); });
refs.close.addEventListener('click', () => refs.dialog.close());
refs.dialog.addEventListener('click', (event) => { if (event.target === refs.dialog) refs.dialog.close(); });
refs.dialogFont.addEventListener('click', changeFont);
document.documentElement.style.setProperty('--reader-size', `${fontSizes[fontStep] || 19}px`);

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
