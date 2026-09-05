const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const indexPath = path.join(projectRoot, 'dist', 'index.html');

function readMetaVersion(html) {
  const match = /<meta\s+name=["']daily-review-version["']\s+content=["']([^"']+)["']\s*\/?\s*>/i.exec(html);
  return match ? match[1] : '';
}

function visibleVersion(html, env = process.env) {
  const runNumber = String(env.GITHUB_RUN_NUMBER || '').trim();
  if (/^\d+$/.test(runNumber)) return `v${runNumber}`;

  const sha = String(env.GITHUB_SHA || '').trim();
  if (/^[0-9a-f]{7,40}$/i.test(sha)) return `v${sha.slice(0, 7)}`;

  const shellVersion = readMetaVersion(html);
  if (shellVersion && shellVersion !== '__APP_VERSION__') return `v${shellVersion.slice(0, 8)}`;
  return 'vlocal';
}

function patch(html, env = process.env) {
  const version = visibleVersion(html, env);
  const sha = String(env.GITHUB_SHA || '').trim();
  const runNumber = String(env.GITHUB_RUN_NUMBER || '').trim();
  const details = [
    /^\d+$/.test(runNumber) ? `GitHub Actions Run #${runNumber}` : '',
    /^[0-9a-f]{7,40}$/i.test(sha) ? sha.slice(0, 7) : '',
  ].filter(Boolean).join(' · ');
  const badge = `<span id="appVisibleVersion" title="${details || version}" aria-label="当前版本 ${version}" style="display:inline-block;margin-left:10px;font-size:12px;font-weight:700;line-height:1;letter-spacing:.04em;opacity:.55;vertical-align:middle;white-space:nowrap">${version}</span>`;

  const titlePattern = /<h1>全球宏观温度计(?:\s*<span\b[^>]*id=["']appVisibleVersion["'][^>]*>.*?<\/span>)?<\/h1>/i;
  if (!titlePattern.test(html)) {
    throw new Error('Unable to add visible version: main title pattern changed.');
  }
  return html.replace(titlePattern, `<h1>全球宏观温度计 ${badge}</h1>`);
}

function main() {
  if (!fs.existsSync(indexPath)) throw new Error('dist/index.html not found; run the normal build first.');
  const html = fs.readFileSync(indexPath, 'utf8');
  fs.writeFileSync(indexPath, patch(html), 'utf8');
  process.stdout.write(`Visible app version added: ${visibleVersion(html)}\n`);
}

if (require.main === module) main();

module.exports = { patch, readMetaVersion, visibleVersion };
