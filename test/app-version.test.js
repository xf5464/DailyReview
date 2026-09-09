const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { patch, readMetaVersion } = require('../scripts/patch-visible-version');

test('visible run number does not replace the content-based app shell version', () => {
  const html = [
    '<meta name="daily-review-version" content="shell-content-hash" />',
    '<link rel="stylesheet" href="styles.css?v=old">',
    '<h1>全球宏观温度计</h1>',
    '<script src="app.js?v=old"></script>',
  ].join('\n');
  const patched = patch(html, { GITHUB_RUN_NUMBER: '508', GITHUB_SHA: 'abcdef1234567890' }, {
    app: path.resolve(__dirname, '..', 'site', 'app.js'),
    styles: path.resolve(__dirname, '..', 'site', 'styles.css'),
  });

  assert.equal(readMetaVersion(patched), 'shell-content-hash');
  assert.match(patched, />v508<\/span>/);
});
