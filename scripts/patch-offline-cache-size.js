const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const appPath = path.join(projectRoot, 'dist', 'app.js');
const indexPath = path.join(projectRoot, 'dist', 'index.html');

function replaceOnce(source, oldText, newText, label) {
  if (source.includes(newText)) return source;
  if (!source.includes(oldText)) throw new Error(`offline cache size patch failed: ${label}`);
  return source.replace(oldText, newText);
}

function patchIndex(html) {
  const oldSummary = [
    '        <div class="offline-data-summary">',
    '          <div><span>本地状态</span><strong id="offlineDataState">尚未下载</strong></div>',
    '          <div><span>数据版本</span><strong id="offlineDataVersion">--</strong></div>',
    '        </div>',
  ].join('\n');
  const newSummary = [
    '        <div class="offline-data-summary">',
    '          <div><span>本地状态</span><strong id="offlineDataState">尚未下载</strong></div>',
    '          <div><span>数据版本</span><strong id="offlineDataVersion">--</strong></div>',
    '          <div><span>离线缓存</span><strong id="offlineDataCacheSize">计算中...</strong></div>',
    '        </div>',
  ].join('\n');
  return replaceOnce(html, oldSummary, newSummary, 'offline summary');
}

function patchApp(source) {
  source = replaceOnce(
    source,
    "    offlineDataVersion: document.querySelector('#offlineDataVersion'),",
    "    offlineDataVersion: document.querySelector('#offlineDataVersion'),\n    offlineDataCacheSize: document.querySelector('#offlineDataCacheSize'),",
    'offline cache ref'
  );

  const statusAnchor = '  async function refreshOfflineDataStatus(options) {';
  const helpers = [
    '  function formatStorageBytes(bytes) {',
    "    if (!Number.isFinite(Number(bytes)) || Number(bytes) <= 0) return '0 MB';",
    '    var mb = Number(bytes) / 1024 / 1024;',
    "    if (mb < 0.01) return '<0.01 MB';",
    "    return mb.toFixed(mb < 10 ? 2 : 1) + ' MB';",
    '  }',
    '',
    '  async function readOfflineCacheSize(cache) {',
    '    var requests = await cache.keys();',
    '    var totalBytes = 0;',
    '    var batchSize = 24;',
    '    for (var start = 0; start < requests.length; start += batchSize) {',
    '      var batch = requests.slice(start, start + batchSize);',
    '      var sizes = await Promise.all(batch.map(async function (request) {',
    '        var response = await cache.match(request);',
    '        if (!response) return 0;',
    '        try {',
    '          var length = Number(response.headers.get(\'content-length\'));',
    '          if (Number.isFinite(length) && length >= 0) return length;',
    '          return (await response.blob()).size;',
    '        } catch (error) {',
    '          return 0;',
    '        }',
    '      }));',
    '      sizes.forEach(function (size) { totalBytes += size; });',
    '    }',
    '    return { bytes: totalBytes, files: requests.length };',
    '  }',
    '',
    statusAnchor,
  ].join('\n');
  source = replaceOnce(source, statusAnchor, helpers, 'cache size helpers');

  source = replaceOnce(
    source,
    "      refs.offlineDataVersion.textContent = '--';\n      refs.offlineDataDownloadButton.disabled = true;",
    "      refs.offlineDataVersion.textContent = '--';\n      if (refs.offlineDataCacheSize) refs.offlineDataCacheSize.textContent = '--';\n      refs.offlineDataDownloadButton.disabled = true;",
    'unsupported cache size'
  );

  const cacheStatus = [
    '    var cache = await caches.open(OFFLINE_DATA_CACHE);',
    '    var state = await readOfflineState(cache);',
    "    refs.offlineDataState.textContent = state ? '全部数据可离线使用' : '尚未下载';",
    "    refs.offlineDataVersion.textContent = state ? formatOfflineVersion(state.fetchedAt) : '--';",
  ].join('\n');
  const cacheStatusWithSize = [
    '    var cache = await caches.open(OFFLINE_DATA_CACHE);',
    '    var state = await readOfflineState(cache);',
    "    refs.offlineDataState.textContent = state ? '全部数据可离线使用' : '尚未下载';",
    "    refs.offlineDataVersion.textContent = state ? formatOfflineVersion(state.fetchedAt) : '--';",
    "    if (refs.offlineDataCacheSize) refs.offlineDataCacheSize.textContent = '计算中...';",
    '    if (options && options.skipCacheSize) {',
    "      if (refs.offlineDataCacheSize) refs.offlineDataCacheSize.textContent = '更新完成后计算';",
    '    } else {',
    '      try {',
    '        var cacheUsage = await readOfflineCacheSize(cache);',
    "        if (refs.offlineDataCacheSize) refs.offlineDataCacheSize.textContent = formatStorageBytes(cacheUsage.bytes) + ' · ' + cacheUsage.files + ' 个文件';",
    '      } catch (error) {',
    "        if (refs.offlineDataCacheSize) refs.offlineDataCacheSize.textContent = '无法读取';",
    '      }',
    '    }',
  ].join('\n');
  source = replaceOnce(source, cacheStatus, cacheStatusWithSize, 'refresh cache size');

  return source;
}

function main() {
  if (!fs.existsSync(appPath) || !fs.existsSync(indexPath)) {
    throw new Error('dist app/index missing; run normal build first');
  }
  const html = fs.readFileSync(indexPath, 'utf8').replace(/\r\n/g, '\n');
  const source = fs.readFileSync(appPath, 'utf8').replace(/\r\n/g, '\n');
  fs.writeFileSync(indexPath, patchIndex(html), 'utf8');
  fs.writeFileSync(appPath, patchApp(source), 'utf8');
  process.stdout.write('Offline dialog now displays exact Cache Storage usage.\n');
}

if (require.main === module) main();

module.exports = { formatStorageBytes: null, patchApp, patchIndex };
