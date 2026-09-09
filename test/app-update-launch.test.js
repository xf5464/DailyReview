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

test('mobile app update never forces the active iOS page to reload', () => {
  assert.doesNotMatch(source, /reloadPageWithFallback/);
  assert.doesNotMatch(source, /window\.location\.reload\(\)/);
  assert.match(source, /应用文件已更新，下次打开自动使用新版；正在继续检查离线数据/);
  assert.match(source, /if \(refs\.appUpdateDialog\.open\) refs\.appUpdateDialog\.close\(\);\s+return false;/);
});
