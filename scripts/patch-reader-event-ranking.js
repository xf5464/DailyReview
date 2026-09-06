const fs = require('node:fs');

const file = 'site/reader/reader.js';
let text = fs.readFileSync(file, 'utf8');

const sorterPattern = /function selectedItems\(value\) \{[\s\S]*?\n\}/;
const sorterReplacement = `function selectedItems(value) {
  const items = (value.items || []).filter((item) => item.category === activeCategory);
  if (['tech', 'market', 'world'].includes(activeCategory)) {
    return items.sort((left, right) => Number(right.score || 0) - Number(left.score || 0) || itemTimestamp(right) - itemTimestamp(left)).slice(0, 10);
  }
  return items.sort((left, right) => itemTimestamp(right) - itemTimestamp(left)).slice(0, 10);
}`;

if (!sorterPattern.test(text)) throw new Error('reader selectedItems function not found');
text = text.replace(sorterPattern, sorterReplacement);

const modePattern = /const mode = .*?;\n  refs\.archiveMeta\.textContent = items\.length \? `\$\{categoryLabel\(activeCategory\)\} · \$\{mode\} · \$\{categoryFreshness\(items, fromCache\)\}` : `本次抓取暂无\$\{categoryLabel\(activeCategory\)\}新闻`;/;
const directMetaPattern = /refs\.archiveMeta\.textContent = items\.length \? `\$\{categoryLabel\(activeCategory\)\} · \$\{activeCategory === 'youtube' \? '最近24小时热度前10' : activeCategory === 'world' \? '免费来源综合热点前10' : '每个网站当前头条'\} · \$\{categoryFreshness\(items, fromCache\)\}` : `本次抓取暂无\$\{categoryLabel\(activeCategory\)\}新闻`;/;
const modeReplacement = `const mode = activeCategory === 'youtube'
    ? '最近24小时热度前10'
    : ['tech', 'market', 'world'].includes(activeCategory)
      ? '多源聚合综合热度 Top 10'
      : '当前热点';
  refs.archiveMeta.textContent = items.length ? \`${'${categoryLabel(activeCategory)}'} · ${'${mode}'} · ${'${categoryFreshness(items, fromCache)}'}\` : \`本次抓取暂无${'${categoryLabel(activeCategory)}'}新闻\`;`;

if (modePattern.test(text)) text = text.replace(modePattern, modeReplacement);
else if (directMetaPattern.test(text)) text = text.replace(directMetaPattern, modeReplacement);
else if (!text.includes("'多源聚合综合热度 Top 10'")) throw new Error('reader archive meta target not found');

text = text.replace(
  "if ((item.category === 'world' || item.category === 'tech') && item.engagement)",
  "if (['tech', 'market', 'world'].includes(item.category) && item.engagement)",
);

fs.writeFileSync(file, text, 'utf8');
console.log('Reader event ranking UI is up to date.');
