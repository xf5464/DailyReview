const fs = require('node:fs');
const path = require('node:path');

const appPath = path.resolve(__dirname, '..', 'dist', 'app.js');

function replaceOnce(source, oldText, newText, label) {
  if (source.includes(newText)) return source;
  if (!source.includes(oldText)) throw new Error(`offline diagnostics patch failed: ${label}`);
  return source.replace(oldText, newText);
}

function patchApp(source) {
  source = replaceOnce(
    source,
    "  var OFFLINE_STATE_PATH = 'data/offline-state.json';",
    "  var OFFLINE_STATE_PATH = 'data/offline-state.json';\n  var OFFLINE_DOWNLOAD_DIAGNOSTIC_KEY = 'daily-review.offline-download-diagnostic.v1';",
    'diagnostic storage key'
  );

  const manifestAnchor = '  function offlineManifestNeedsUpdate(state, manifest) {';
  const helpers = [
    '  function recordOfflineDownloadDiagnostic(diagnostic) {',
    '    try {',
    '      localStorage.setItem(OFFLINE_DOWNLOAD_DIAGNOSTIC_KEY, JSON.stringify(diagnostic));',
    '    } catch (error) {',
    '      // Storage may be unavailable in private/restricted browsing; display still works for this run.',
    '    }',
    '  }',
    '',
    '  async function diagnoseOfflineDownload(cache, state, manifest, files) {',
    '    var totalFiles = files.length;',
    '    var missingFiles = 0;',
    '    for (var index = 0; index < files.length; index += 1) {',
    '      var cached = await cache.match(absoluteAppUrl(files[index].path));',
    '      if (!cached) missingFiles += 1;',
    '    }',
    '    var fullDownload = totalFiles > 0 && missingFiles === totalFiles;',
    "    var reason = '已有缓存，仅下载变化的数据分块';",
    '    if (!state) {',
    "      reason = '未找到离线状态记录，可能是首次使用或浏览器已清理站点离线数据';",
    '    } else if (state.schemaVersion !== manifest.schemaVersion) {',
    "      reason = '离线数据结构版本发生变化，需要重新建立完整缓存';",
    '    } else if (fullDownload) {',
    "      reason = '离线状态记录仍存在，但全部数据分块缓存都已丢失，可能被系统或浏览器清理';",
    '    } else if (missingFiles > 0) {',
    "      reason = '部分离线数据分块缺失或发生变化，只需增量补齐';",
    '    } else {',
    "      reason = '离线数据分块均存在，仅检查并更新签名变化的指标';",
    '    }',
    '    return {',
    '      at: new Date().toISOString(),',
    "      mode: fullDownload ? 'full' : 'incremental',",
    '      reason: reason,',
    '      missingFiles: missingFiles,',
    '      totalFiles: totalFiles,',
    '      hadState: Boolean(state),',
    '      localSchemaVersion: state ? state.schemaVersion : null,',
    '      remoteSchemaVersion: manifest.schemaVersion',
    '    };',
    '  }',
    '',
    manifestAnchor,
  ].join('\n');
  source = replaceOnce(source, manifestAnchor, helpers, 'diagnostic helpers');

  const filesLine = "      var files = manifest.charts.flatMap(function (chart) { return [chart.extras].concat(chart.chunks); });";
  const filesWithDiagnosis = [
    filesLine,
    '      var offlineDiagnostic = await diagnoseOfflineDownload(cache, previousState, manifest, files);',
    '      recordOfflineDownloadDiagnostic(offlineDiagnostic);',
    "      refs.offlineDataMessage.textContent = (offlineDiagnostic.mode === 'full' ? '需要全量下载。原因：' : '执行增量更新。原因：') + offlineDiagnostic.reason + '（缺失 ' + offlineDiagnostic.missingFiles + '/' + offlineDiagnostic.totalFiles + ' 个数据文件）';",
    '      var downloadedBytes = 0;',
    "      if (offlineDiagnostic.mode === 'full' && manifest.bundle) {",
    '        try {',
    "          refs.offlineDataMessage.textContent = '正在下载每日全量 ZIP：' + (Number(manifest.bundle.bytes) / 1024 / 1024).toFixed(2) + ' MB';",
    '          var bundleResult = await downloadOfflineBundle(manifest, files, cache, function (completed, total) {',
    '            refs.offlineDataProgress.value = total ? completed / total * 70 : 70;',
    "            refs.offlineDataMessage.textContent = '正在解压并校验全量 ZIP：' + completed + '/' + total;",
    '          });',
    '          downloadedBytes += bundleResult.bytes;',
    '        } catch (bundleError) {',
    "          refs.offlineDataMessage.textContent = '全量 ZIP 不可用，自动改用逐文件下载：' + bundleError.message;",
    '        }',
    '      }',
  ].join('\n');
  source = replaceOnce(source, filesLine, filesWithDiagnosis, 'download diagnosis');

  source = replaceOnce(
    source,
    '      var downloadedBytes = await downloadOfflineFiles(files, cache, function (completed, total) {',
    '      downloadedBytes += await downloadOfflineFiles(files, cache, function (completed, total) {',
    'bundle fallback download'
  );

  const completion = [
    '      refs.offlineDataMessage.textContent = downloadedBytes',
    "        ? '增量更新完成：下载 ' + (downloadedBytes / 1024 / 1024).toFixed(2) + ' MB，更新 ' + changedCharts + ' 个指标。'",
    "        : '已是最新版本，无需下载新的数据分块。';",
  ].join('\n');
  const completionWithReason = [
    "      var offlineCompletion = downloadedBytes",
    "        ? (offlineDiagnostic.mode === 'full' ? '全量下载完成：下载 ' : '增量更新完成：下载 ') + (downloadedBytes / 1024 / 1024).toFixed(2) + ' MB，更新 ' + changedCharts + ' 个指标。'",
    "        : '已是最新版本，无需下载新的数据分块。';",
    "      refs.offlineDataMessage.textContent = offlineCompletion + ' 原因：' + offlineDiagnostic.reason;",
  ].join('\n');
  source = replaceOnce(source, completion, completionWithReason, 'completion reason');

  return source;
}

function main() {
  if (!fs.existsSync(appPath)) throw new Error('dist/app.js missing; run normal build first');
  const source = fs.readFileSync(appPath, 'utf8');
  fs.writeFileSync(appPath, patchApp(source), 'utf8');
  process.stdout.write('Added persistent offline download diagnostics and full-download reasons.\n');
}

if (require.main === module) main();

module.exports = { patchApp };
