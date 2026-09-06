'use strict';

// Replace the retired event-cloud tab with Hacker News Top 10.
if (typeof activeCategory !== 'undefined') {
  const saved = localStorage.getItem('dailyreview-reader-category');
  if (saved === 'hn' || activeCategory === 'trends') activeCategory = saved === 'hn' ? 'hn' : 'tech';
}

categoryLabel = function categoryLabel(category) {
  return category === 'market' ? '美股' : category === 'world' ? '国际' : category === 'youtube' ? 'YouTube' : category === 'hn' ? 'Hacker News' : '科技';
};

selectedItems = function selectedItems(value) {
  const items = (value.items || []).filter((item) => item.category === activeCategory);
  if (activeCategory === 'tech') return items.sort((left, right) => Number(right.score || 0) - Number(left.score || 0)).slice(0, 10);
  if (activeCategory === 'hn') return items.sort((left, right) => Number(left.sourceOrder || 0) - Number(right.sourceOrder || 0)).slice(0, 10);
  return items.sort((left, right) => itemTimestamp(right) - itemTimestamp(left)).slice(0, 10);
};

renderArchive = function renderArchive(value, fromCache = false) {
  archive = pruneArchive(value);
  archiveLoadedFromCache = fromCache;
  localStorage.setItem(ARCHIVE_CACHE_KEY, JSON.stringify(archive));
  refs.days.replaceChildren();
  updateCategoryTabs();

  const items = selectedItems(archive);
  refs.empty.hidden = items.length > 0;
  const mode = activeCategory === 'tech' ? '17家优质科技来源综合热点前10'
    : activeCategory === 'youtube' ? '最近24小时热度前10'
    : activeCategory === 'world' ? '免费来源综合热点前10'
    : activeCategory === 'hn' ? '当前 Top 10 帖子'
    : '每个网站当前头条';
  refs.archiveMeta.textContent = items.length
    ? `${categoryLabel(activeCategory)} · ${mode} · ${categoryFreshness(items, fromCache)}`
    : `本次抓取暂无${categoryLabel(activeCategory)}内容`;
  if (!items.length) return;

  const section = document.createElement('section');
  section.className = 'day';
  const list = document.createElement('ol');
  list.className = 'news-list';
  items.forEach((item, index) => {
    const li = document.createElement('li');
    li.append(itemButton(item, index + 1));
    list.append(li);
  });
  section.append(list);
  refs.days.append(section);
};

selectCategory = function selectCategory(category) {
  if (!['tech', 'market', 'world', 'youtube', 'hn'].includes(category) || category === activeCategory) return;
  activeCategory = category;
  localStorage.setItem('dailyreview-reader-category', category);
  renderArchive(archive, archiveLoadedFromCache);
  if (!selectedItems(archive).length) loadArchive();
};

updateCategoryTabs();
if (archive?.items?.length) renderArchive(archive, archiveLoadedFromCache);
