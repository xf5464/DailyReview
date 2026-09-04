'use strict';

const API_ROOT = 'https://dailyreview-reader.xf5464.workers.dev';
const ARCHIVE_URL = 'https://raw.githubusercontent.com/xf5464/DailyReview/main/site/reader/data/recent.json';
const VAPID_PUBLIC_KEY = 'BEHmGzDXFg7hlOBk3NGv5KIaMroGXDIr5YfeetHNRFgQu0J1kl6eX1-5JqsxmHRApQbC_4Y-Zm_YHYTZ8XVIMCs';
const ARCHIVE_CACHE_KEY = 'dailyreview-recent-v1';
const ARTICLE_CACHE_KEY = 'dailyreview-articles-v1';
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

const refs = {
  days: document.querySelector('#daysContainer'),
  empty: document.querySelector('#emptyArchive'),
  archiveMeta: document.querySelector('#archiveMeta'),
  installHint: document.querySelector('#installHint'),
  push: document.querySelector('#pushButton'),
  form: document.querySelector('#readerForm'),
  input: document.querySelector('#urlInput'),
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
  font: document.querySelector('#fontButton'),
  dialogFont: document.querySelector('#dialogFontButton'),
};

let archive = { days: [] };
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

function dayLabel(date) {
  const today = chinaDate();
  const yesterday = new Date(`${today}T12:00:00+08:00`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const prefix = date === today ? '今天' : date === chinaDate(yesterday) ? '昨天' : '';
  const formatted = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'short',
  }).format(new Date(`${date}T12:00:00+08:00`));
  return prefix ? `${prefix} · ${formatted}` : formatted;
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
  original.textContent = [item.source, item.title].filter(Boolean).join(' · ');
  copy.append(translated, original);
  const category = document.createElement('span');
  category.className = 'category';
  category.textContent = categoryLabel(item.category);
  button.append(number, copy, category);

  const browser = document.createElement('a');
  browser.className = 'safari-link';
  browser.href = chromeUrl(item.url);
  browser.textContent = 'Chrome';
  browser.setAttribute('aria-label', `使用 Chrome 打开：${translated.textContent}`);

  row.append(button, browser);
  return row;
}

function renderArchive(value, fromCache = false) {
  archive = pruneArchive(value);
  localStorage.setItem(ARCHIVE_CACHE_KEY, JSON.stringify(archive));
  refs.days.replaceChildren();
  refs.empty.hidden = archive.days.length > 0;
  const total = archive.days.reduce((sum, day) => sum + (day.items?.length || 0), 0);
  refs.archiveMeta.textContent = archive.days.length
    ? `${archive.days.length} 天 · ${total} 条${fromCache ? ' · 本地缓存' : ''}`
    : '等待下一次热点推送';

  archive.days.forEach((day) => {
    const section = document.createElement('section');
    section.className = 'day';
    const header = document.createElement('header');
    header.className = 'day-header';
    const heading = document.createElement('button');
    heading.type = 'button';
    heading.className = 'day-toggle';
    heading.setAttribute('aria-expanded', 'true');
    const headingText = document.createElement('span');
    headingText.textContent = dayLabel(day.date);
    const caret = document.createElement('span');
    caret.className = 'day-caret';
    caret.setAttribute('aria-hidden', 'true');
    caret.textContent = '⌄';
    heading.append(headingText, caret);
    const count = document.createElement('span');
    count.className = 'day-count';
    count.textContent = `${day.items?.length || 0} 条 · ${day.pushes?.length || 1} 次推送`;
    header.append(heading, count);
    const list = document.createElement('ol');
    list.className = 'news-list';
    list.id = `news-${day.date}`;
    heading.setAttribute('aria-controls', list.id);
    (day.items || []).forEach((item, index) => {
      const row = document.createElement('li');
      row.append(itemButton(item, index + 1));
      list.append(row);
    });
    section.append(header, list);
    refs.days.append(section);
  });
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

function base64UrlToBytes(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

async function refreshPushButton(registration) {
  const subscription = await registration.pushManager.getSubscription();
  refs.push.textContent = subscription ? '提醒已开启' : '开启提醒';
  refs.push.disabled = Boolean(subscription);
}

async function enablePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert('当前浏览器不支持网页推送。');
    return;
  }
  if (/iP(hone|ad|od)/.test(navigator.userAgent) && !isStandalone()) {
    refs.installHint.hidden = false;
    refs.installHint.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('没有获得通知权限。');
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY),
    });
    const response = await fetch(`${API_ROOT}/push/subscribe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(subscription),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || '订阅保存失败。');
    }
    await refreshPushButton(registration);
  } catch (error) {
    alert(error.message || '开启提醒失败。');
  }
}

refs.days.addEventListener('click', (event) => {
  const externalLink = event.target.closest('.news-item, .safari-link');
  if (externalLink) {
    event.preventDefault();
    location.href = externalLink.getAttribute('href');
    return;
  }

  const toggle = event.target.closest('.day-toggle');
  if (!toggle) return;
  const list = document.getElementById(toggle.getAttribute('aria-controls'));
  if (!list) return;
  const expanded = toggle.getAttribute('aria-expanded') === 'true';
  toggle.setAttribute('aria-expanded', String(!expanded));
  list.hidden = expanded;
});
refs.form.addEventListener('submit', (event) => {
  event.preventDefault();
  const url = refs.input.value.trim();
  if (url) loadArticle(url);
});
refs.retry.addEventListener('click', () => { if (currentUrl) loadArticle(currentUrl, true); });
refs.close.addEventListener('click', () => refs.dialog.close());
refs.dialog.addEventListener('click', (event) => { if (event.target === refs.dialog) refs.dialog.close(); });
refs.font.addEventListener('click', changeFont);
refs.dialogFont.addEventListener('click', changeFont);
refs.push.addEventListener('click', enablePush);
document.documentElement.style.setProperty('--reader-size', `${fontSizes[fontStep] || 19}px`);

pruneArticleCache();
loadArchive();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('../service-worker.js').then(async (registration) => {
    await refreshPushButton(registration);
  }).catch(() => {});
}

const params = new URL(location.href).searchParams;
const initialUrl = params.get('url');
const openItemId = params.get('open');
if (initialUrl) loadArticle(initialUrl);
if (openItemId) {
  const waitForArchive = setInterval(() => {
    const item = archive.days.flatMap((day) => day.items || []).find((entry) => entry.id === openItemId);
    if (item) {
      clearInterval(waitForArchive);
      loadArticle(item.url);
    }
  }, 250);
  setTimeout(() => clearInterval(waitForArchive), 5000);
}
