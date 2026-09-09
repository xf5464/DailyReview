const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'site', 'app.js'), 'utf8');

test('mobile app update stays non-modal and paints before installing the service worker', () => {
  const updateFlow = source.slice(
    source.indexOf('  async function checkMobileAppUpdateOnLaunch() {'),
    source.indexOf('  async function syncSharedLocalConfig()')
  );
  assert.doesNotMatch(updateFlow, /refs\.appUpdateDialog\.showModal\(\)/);
  assert.ok(updateFlow.indexOf('refs.appUpdateDialog.show()') < updateFlow.indexOf('await waitForUiPaint()'));
  assert.ok(
    updateFlow.indexOf('await waitForUiPaint()') <
      updateFlow.indexOf('var registration = await registerServiceWorker();')
  );
});

test('offline launch check always continues after the app update attempt', () => {
  assert.match(source, /checkMobileAppUpdateOnLaunch\(\)\.then\(function \(\) \{\s+checkOfflineDataUpdateOnLaunch\(\);/);
  assert.doesNotMatch(source, /if \(!updating\) checkOfflineDataUpdateOnLaunch\(\)/);
});

test('mobile app update continues offline checks when iOS does not reload', () => {
  assert.match(source, /function reloadPageWithFallback\(timeoutMs\)/);
  assert.match(source, /window\.addEventListener\('pagehide', handlePageHide/);
  assert.match(source, /var reloadStarted = await reloadPageWithFallback\(2500\)/);
  assert.match(source, /if \(reloadStarted\) return true;/);
  assert.match(source, /if \(refs\.appUpdateDialog\.open\) refs\.appUpdateDialog\.close\(\);\s+return false;/);
});
