const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('overall detail dialog closes only when its blank backdrop is clicked', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'site', 'app.js'), 'utf8');
  assert.match(source, /refs\.detailDialog\.addEventListener\('click', function \(event\) \{\s+if \(event\.target === refs\.detailDialog\) refs\.detailDialog\.close\(\);\s+\}\);/);
});
