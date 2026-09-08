'use strict';

const fs = require('node:fs');

const TARGET = 'scripts/send-hot-news-email.js';
let source = fs.readFileSync(TARGET, 'utf8');

const replacements = [
  {
    before: `        catch (fallbackError) {\n          console.warn(\`Could not translate title from \${language}: MyMemory: \${error.message}; Google fallback: \${fallbackError.message}\`);\n        }`,
    after: `        catch (fallbackError) {\n          output[indexes[0]].titleZh = items[indexes[0]].title;\n          console.warn(\`Could not translate title from \${language}; kept original title: MyMemory: \${error.message}; Google fallback: \${fallbackError.message}\`);\n        }`,
  },
  {
    before: '  return assertChineseTranslations(output);',
    after: '  return output; // Best effort: failed translations keep the original title.',
  },
  {
    before: 'async function translateTitleWithRetry(title, attempts = 4) {',
    after: 'async function translateTitleWithRetry(title, attempts = 1) {',
  },
  {
    before: 'const payload = JSON.parse(await fetchText(`https://api.mymemory.translated.net/get?${params}`, 15_000));',
    after: 'const payload = JSON.parse(await fetchText(`https://api.mymemory.translated.net/get?${params}`, 5_000));',
  },
  {
    before: 'const payload = JSON.parse(await fetchText(`https://translate.googleapis.com/translate_a/single?${params}`, 15_000));',
    after: 'const payload = JSON.parse(await fetchText(`https://translate.googleapis.com/translate_a/single?${params}`, 5_000));',
  },
  {
    before: 'async function fetchText(url, timeoutMs = 15_000) {',
    after: 'async function fetchText(url, timeoutMs = 8_000) {',
  },
  {
    before: 'parseRssItems(await fetchText(source.headlineFeed, 15_000), category, 0)',
    after: 'parseRssItems(await fetchText(source.headlineFeed, 8_000), category, 0)',
  },
  {
    before: 'lead = parseHomepageHeadline(await fetchText(source.homepage, 15_000), source);',
    after: 'lead = parseHomepageHeadline(await fetchText(source.homepage, 8_000), source);',
  },
  {
    before: 'try { lead = parseHomepageHeadline(await fetchText(readerUrl, 20_000), source); }',
    after: 'try { lead = parseHomepageHeadline(await fetchText(readerUrl, 10_000), source); }',
  },
  {
    before: 'try { publishedAt = publishedDateFromHtml(await fetchText(lead.url, 10_000)); }',
    after: 'try { publishedAt = publishedDateFromHtml(await fetchText(lead.url, 6_000)); }',
  },
];

for (const { before, after } of replacements) {
  if (source.includes(before)) source = source.replace(before, after);
  else if (!source.includes(after)) throw new Error(`Could not find refresh optimization target: ${before.slice(0, 80)}`);
}

fs.writeFileSync(TARGET, source, 'utf8');
console.log('Enabled best-effort translations and fast network timeouts for reader refresh.');
