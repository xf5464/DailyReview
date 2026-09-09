const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('service worker activation claims clients without navigating active pages', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'site', 'service-worker.js'), 'utf8');
  assert.match(source, /await self\.clients\.claim\(\)/);
  assert.doesNotMatch(source, /client\.navigate\(/);
  assert.doesNotMatch(source, /clients\.matchAll\(/);
});
