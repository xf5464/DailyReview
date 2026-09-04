'use strict';

const API_URL = 'https://dailyreview-reader.xf5464.workers.dev/reader-api';
const refs = {
  form: document.querySelector('#readerForm'),
  input: document.querySelector('#urlInput'),
  empty: document.querySelector('#emptyState'),
  loading: document.querySelector('#loadingState'),
  article: document.querySelector('#article'),
  error: document.querySelector('#errorState'),
  title: document.querySelector('#articleTitle'),
  site: document.querySelector('#siteName'),
  meta: document.querySelector('#articleMeta'),
  body: document.querySelector('#articleBody'),
  source: document.querySelector('#sourceLink'),
  footerSource: document.querySelector('#footerSourceLink'),
  errorSource: document.querySelector('#errorSourceLink'),
  errorTitle: document.querySelector('#errorTitle'),
  errorMessage: document.querySelector('#errorMessage'),
  retry: document.querySelector('#retryButton'),
  font: document.querySelector('#fontButton'),
};

let currentUrl = '';
let fontStep = Number(localStorage.getItem('dailyreview-reader-font') || 1);
const fontSizes = [17, 19, 21, 23];

function show(name) {
  ['empty', 'loading', 'article', 'error'].forEach((key) => { refs[key].hidden = key !== name; });
}

function setSourceLinks(url) {
  [refs.source, refs.footerSource, refs.errorSource].forEach((link) => { link.href = url || '../'; });
}

function renderParagraphs(text) {
  refs.body.replaceChildren();
  String(text || '').split(/\n{2,}/).map((item) => item.trim()).filter(Boolean).forEach((paragraph) => {
    const element = document.createElement('p');
    element.textContent = paragraph;
    refs.body.append(element);
  });
}

function renderArticle(payload) {
  refs.title.textContent = payload.titleZh || payload.title || '中文译文';
  refs.site.textContent = payload.siteName || new URL(payload.url).hostname;
  refs.meta.textContent = `由 Cloudflare Workers AI 翻译 · ${payload.cached ? '已读取缓存' : '刚刚生成'}`;
  renderParagraphs(payload.translatedText);
  document.title = `${refs.title.textContent} · DailyReview`;
  show('article');
}

async function loadArticle(url) {
  currentUrl = url;
  refs.input.value = url;
  setSourceLinks(url);
  show('loading');
  try {
    const endpoint = new URL(API_URL);
    endpoint.searchParams.set('url', url);
    const response = await fetch(endpoint, { headers: { accept: 'application/json' } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `服务器返回 ${response.status}`);
    if (!payload.translatedText) throw new Error('没有提取到可阅读的文章正文。');
    renderArticle(payload);
  } catch (error) {
    refs.errorTitle.textContent = '文章读取失败';
    refs.errorMessage.textContent = `${error.message} 部分网站可能限制自动读取，你仍可打开英文原文。`;
    show('error');
  }
}

refs.form.addEventListener('submit', (event) => {
  event.preventDefault();
  const url = refs.input.value.trim();
  if (url) {
    history.replaceState(null, '', `?url=${encodeURIComponent(url)}`);
    loadArticle(url);
  }
});
refs.retry.addEventListener('click', () => { if (currentUrl) loadArticle(currentUrl); });
refs.font.addEventListener('click', () => {
  fontStep = (fontStep + 1) % fontSizes.length;
  localStorage.setItem('dailyreview-reader-font', String(fontStep));
  document.documentElement.style.setProperty('--reader-size', `${fontSizes[fontStep]}px`);
});
document.documentElement.style.setProperty('--reader-size', `${fontSizes[fontStep] || 19}px`);

const initialUrl = new URL(location.href).searchParams.get('url');
if (initialUrl) loadArticle(initialUrl);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('../service-worker.js').catch(() => {});
}
