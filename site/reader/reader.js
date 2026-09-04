'use strict';

const API_ROOT = 'https://dailyreview-reader.xf5464.workers.dev';
const ARCHIVE_URL = 'https://raw.githubusercontent.com/xf5464/DailyReview/main/site/reader/data/recent.json';
const ARCHIVE_CACHE_KEY = 'dailyreview-recent-v1';
const ARTICLE_CACHE_KEY = 'dailyreview-articles-v1';
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

const refs = {
  days: document.querySelector('#daysContainer'),
  empty: document.querySelector('#emptyArchive'),
  archiveMeta: document.querySelector('#archiveMeta'),
  tabs: [...document.querySelectorAll('.category-tab')],
  timeTabs: [...document.querySelectorAll('.time-tab')],
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

let archive = { days: [] };
let activeCategory = localStorage.getItem('dailyreview-reader-category') === 'market' ? 'market' : 'tech';
const savedHours = Number(localStorage.getItem('dailyreview-reader-hours'));
let activeHours = [6, 12, 18, 24].includes(savedHours) ? savedHours : 24;
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

function retainedDates() {
  const dates = [];
  const noon = new Date(`${chinaDate()}T12:00:00+08:00`);
  for (let offset = 0; offset < 3; offset += 1) {
    const value = new Date(noon);
    value.setUTCDate(value.getUTCDate() - offset);
    dates.push(chinaDate(value));
  }
  return new Set(dates);
}

function pruneArchive(value) {
  const keep = retainedDates();
  return {
    schemaVersion: 1,
    updatedAt: value?.updatedAt || null,
    days: (Array.isArray(value?.days) ? value.days : [])
      .filter((day) => keep.has(day?.date))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3),
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
  return category === 'market' ? '美股' : '科技';
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
  button.href = chromeUrl(item.url);
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
  const source = document.createElement('span');
  source.className = 'news-source';
  source.textContent = item.source || '来源未知';
  button.append(number, copy, source);

  const browser = document.createElement('a');
  browser.className = 'safari-link';
  browser.href = chromeUrl(item.url);
  browser.textContent = 'Chrome';
  browser.setAttribute('aria-label', `使用 Chrome 打开：${translated.textContent}`);

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
  const now = Date.now();
  const cutoff = now - activeHours * 60 * 60 * 1000;
  const byId = new Map();
  (value.days || []).flatMap((day) => day.items || []).forEach((item) => {
    const timestamp = itemTimestamp(item);
    if (item.category !== activeCategory || timestamp < cutoff || timestamp > now + 5 * 60 * 1000) return;
    const key = item.id || item.url;
    const previous = byId.get(key);
    if (!previous || Date.parse(item.pushedAt || 0) > Date.parse(previous.pushedAt || 0)) byId.set(key, item);
  });
  return [...byId.values()]
    .sort((left, right) =>
      (Number(right.score) || 0) - (Number(left.score) || 0)
      || itemTimestamp(right) - itemTimestamp(left))
    .slice(0, 10);
}

function updateTimeTabs() {
  refs.timeTabs.forEach((tab) => {
    const selected = Number(tab.dataset.hours) === activeHours;
    tab.setAttribute('aria-pressed', String(selected));
  });
}

function renderArchive(value, fromCache = false) {
  archive = pruneArchive(value);
  localStorage.setItem(ARCHIVE_CACHE_KEY, JSON.stringify(archive));
  refs.days.replaceChildren();
  updateCategoryTabs();
  updateTimeTabs();

  const items = selectedItems(archive);
  refs.empty.hidden = items.length > 0;
  refs.archiveMeta.textContent = items.length
    ? `${categoryLabel(activeCategory)} · 最近${activeHours}小时 · ${items.length} 条${fromCache ? ' · 本地缓存' : ''}`
    : `最近${activeHours}小时暂无${categoryLabel(activeCategory)}热点`;

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
  if (!['tech', 'market'].includes(category) || category === activeCategory) return;
  activeCategory = category;
  localStorage.setItem('dailyreview-reader-category', category);
  renderArchive(archive);
}

function selectHours(hours) {
  const next = Number(hours);
  if (![6, 12, 18, 24].includes(next) || next === activeHours) return;
  activeHours = next;
  localStorage.setItem('dailyreview-reader-hours', String(next));
  renderArchive(archive);
}

async function loadArchive() {
  const cached = pruneArchive(jsonStorage(ARCHIVE_CACHE_KEY, { days: [] }));
  if (cached.days.length) renderArchive(cached, true);
  try {
    const response = await fetch(`${ARCHIVE_URL}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(String(response.status));
    renderArchive(await response.json());
  } catch {
    if (!cached.days.length) renderArchive(cached, true);
  }
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
  event.preventDefault();
  location.href = externalLink.getAttribute('href');
});
refs.tabs.forEach((tab) => tab.addEventListener('click', () => selectCategory(tab.dataset.category)));
refs.timeTabs.forEach((tab) => tab.addEventListener('click', () => selectHours(tab.dataset.hours)));
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
