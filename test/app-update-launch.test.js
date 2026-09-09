const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'site', 'app.js'), 'utf8');

test('mobile app update paints before installing the service worker', () => {
  const updateFlow = source.slice(
    source.indexOf('  async function checkMobileAppUpdateOnLaunch() {'),
    source.indexOf('  async function syncSharedLocalConfig()')
  );
  assert.ok(updateFlow.indexOf('refs.appUpdateDialog.showModal()') < updateFlow.indexOf('await waitForUiPaint()'));
  assert.ok(
    updateFlow.indexOf('await waitForUiPaint()') <
      updateFlow.indexOf('var registration = await registerServiceWorker();')
  );
});

test('mobile app update continues offline checks when iOS does not reload', () => {
  assert.match(source, /function reloadPageWithFallback\(timeoutMs\)/);
  assert.match(source, /window\.addEventListener\('pagehide', handlePageHide/);
  assert.match(source, /var reloadStarted = await reloadPageWithFallback\(2500\)/);
  assert.match(source, /if \(reloadStarted\) return true;/);
  assert.match(source, /if \(refs\.appUpdateDialog\.open\) refs\.appUpdateDialog\.close\(\);\s+return false;/);
});
