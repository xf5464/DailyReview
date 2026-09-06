const fs = require('node:fs');

const file = 'site/reader/reader.js';
let text = fs.readFileSync(file, 'utf8');

const oldSorter = "function selectedItems(value) {\n  return (value.items || []).filter((item) => item.category === activeCategory).sort((left, right) => itemTimestamp(right) - itemTimestamp(left)).slice(0, 10);\n}";
const newSorter = "function selectedItems(value) {\n  const items = (value.items || []).filter((item) => item.category === activeCategory);\n  if (['tech', 'market', 'world'].includes(activeCategory)) {\n    return items.sort((left, right) => Number(right.score || 0) - Number(left.score || 0) || itemTimestamp(right) - itemTimestamp(left)).slice(0, 10);\n  }\n  return items.sort((left, right) => itemTimestamp(right) - itemTimestamp(left)).slice(0, 10);\n}";

const oldMeta = "refs.archiveMeta.textContent = items.length ? `${categoryLabel(activeCategory)} · ${activeCategory === 'youtube' ? '最近24小时热度前10' : activeCategory === 'world' ? '免费来源综合热点前10' : '每个网站当前头条'} · ${categoryFreshness(items, fromCache)}` : `本次抓取暂无${categoryLabel(activeCategory)}新闻`;";
const newMeta = "refs.archiveMeta.textContent = items.length ? `${categoryLabel(activeCategory)} · ${activeCategory === 'youtube' ? '最近24小时热度前10' : ['tech', 'market', 'world'].includes(activeCategory) ? '多源聚合综合热度 Top 10' : '当前热点'} · ${categoryFreshness(items, fromCache)}` : `本次抓取暂无${categoryLabel(activeCategory)}新闻`;";

if (!text.includes(oldSorter)) throw new Error('reader selectedItems target not found');
if (!text.includes(oldMeta)) throw new Error('reader archive meta target not found');
text = text.replace(oldSorter, newSorter).replace(oldMeta, newMeta);
fs.writeFileSync(file, text, 'utf8');
console.log('Patched reader event ranking and labels.');
