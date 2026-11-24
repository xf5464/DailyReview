'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { REQUIRED_CATEGORIES, verifyReaderRefresh } = require('./verify-reader-refresh');

function usable(items, category) {
  const rows = (items || []).filter(item => item.category === category);
  return rows.length === 10 && rows.every(item => String(item.title || item.titleZh || '').trim() && item.url) ? rows : null;
}
function reconcile(current, previous, now = Date.now()) {
  const output = { ...current, items: [], refreshWarnings: [] };
  for (const category of REQUIRED_CATEGORIES) {
    const rows = usable(current.items, category);
    let error;
    try { verifyReaderRefresh({items: rows || []}, now, 10, [category]); }
    catch (caught) { error = caught; }
    if (!error) { output.items.push(...rows); continue; }
    const fallback = usable(previous.items, category);
    if (!fallback) throw new Error(`No complete current or previous snapshot for ${category}: ${error.message}`);
    output.items.push(...fallback.map(item => ({...item, isCached: true})));
    output.refreshWarnings.push(`${category}: upstream unavailable; retained previous content with original timestamps`);
  }
  output.failureCount = output.items.filter(item => item.isCached).length;
  return output;
}
function main() {
  const file = path.resolve(process.env.HOT_NEWS_ARCHIVE_PATH || 'site/reader/data/recent.json');
  const previous = JSON.parse(fs.readFileSync(file, 'utf8'));
  const stages = [['refresh-reader-aggregated.js', 150000], ['refresh-youtube-top10-best-effort.js', 90000],
    ['resolve-world-original-urls.js', 30000], ['add-hacker-news-top10.js', 90000]];
  const warnings = [];
  for (const [script, timeout] of stages) {
    try { execFileSync(process.execPath, ['--require', './scripts/register-source-cache.js', 'scripts/' + script], {stdio:'inherit',timeout}); }
    catch { warnings.push(script + ': upstream refresh did not finish; checking category-level results'); }
  }
  const output = reconcile(JSON.parse(fs.readFileSync(file, 'utf8')), previous);
  output.refreshWarnings.push(...warnings);
  fs.writeFileSync(file, JSON.stringify(output, null, 2) + '\n');
  for (const warning of output.refreshWarnings) console.warn(warning);
  if (process.env.GITHUB_STEP_SUMMARY && output.refreshWarnings.length) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### Reader refresh degraded\n\n' + output.refreshWarnings.map(x => '- ' + x).join('\n') + '\n');
  }
  console.log(`Reader snapshot saved: ${output.items.length} items; ${output.failureCount} explicitly cached items.`);
}
if (require.main === module) { try { main(); } catch (error) { console.error(error); process.exitCode=1; } }
module.exports = {reconcile};
