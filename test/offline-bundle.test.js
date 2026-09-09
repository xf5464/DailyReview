const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { unzipSync } = require('fflate');
const { contentHash, createOfflineBundle } = require('../scripts/create-offline-bundle');
const { patchApp } = require('../scripts/patch-offline-download-diagnostics');

test('creates a hashed ZIP containing every offline file and records it in the manifest', () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-review-offline-'));
  const chunkPath = 'data/offline/example/items-2026.abc.json';
  const extrasPath = 'data/offline/example/extras.def.json';
  const manifestPath = path.join(output, 'data', 'offline-manifest.json');
  fs.mkdirSync(path.dirname(path.join(output, chunkPath)), { recursive: true });
  fs.writeFileSync(path.join(output, chunkPath), '[{"date":"2026-09-08","value":1}]\n');
  fs.writeFileSync(path.join(output, extrasPath), '{"id":"example"}\n');
  fs.writeFileSync(path.join(output, 'data', 'outlook.json'), '{"charts":[]}\n');
  fs.writeFileSync(manifestPath, JSON.stringify({
    schemaVersion: 1,
    fetchedAt: '2026-09-08T00:00:00.000Z',
    charts: [{
      id: 'example',
      signature: 'signature',
      extras: { path: extrasPath, hash: 'def', bytes: 17 },
      chunks: [{ path: chunkPath, hash: 'abc', bytes: 34 }],
    }],
  }));

  const result = createOfflineBundle(output);
  const savedManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(savedManifest.bundle.path, result.relativePath);
  assert.equal(savedManifest.bundle.hash, contentHash(result.archive));
  assert.equal(savedManifest.bundle.fileCount, 3);
  assert.match(savedManifest.bundle.path, /^data\/offline-bundle\.[a-f0-9]{16}\.zip$/);

  const entries = unzipSync(new Uint8Array(result.archive));
  assert.deepEqual(Object.keys(entries).sort(), [chunkPath, extrasPath, 'data/outlook.json'].sort());
  assert.equal(Buffer.from(entries[chunkPath]).toString(), '[{"date":"2026-09-08","value":1}]\n');
});

test('full offline downloads prefer the ZIP and retain per-file fallback', () => {
  const projectRoot = path.resolve(__dirname, '..');
  const source = fs.readFileSync(path.join(projectRoot, 'site', 'app.js'), 'utf8');
  const patched = patchApp(source);
  assert.match(patched, /offlineDiagnostic\.mode === 'full' && manifest\.bundle/);
  assert.match(patched, /await downloadOfflineBundle\(manifest, files, cache/);
  assert.match(patched, /downloadedBytes \+= await downloadOfflineFiles/);
  assert.match(patched, /var cachedPaths = await readOfflineCachePaths\(cache\)/);
  assert.doesNotMatch(patched, /await cache\.match\(absoluteAppUrl\(files\[index\]\.path\)\)/);
  assert.doesNotThrow(() => new Function(patched));

  const worker = fs.readFileSync(path.join(projectRoot, 'site', 'service-worker.js'), 'utf8');
  assert.match(worker, /url\.pathname\.endsWith\('\.zip'\)/);
  assert.match(worker, /fetch\(request, \{ cache: 'no-store' \}\)/);
});

test('automatic offline update paints its dialog before scanning caches', () => {
  const projectRoot = path.resolve(__dirname, '..');
  const source = fs.readFileSync(path.join(projectRoot, 'site', 'app.js'), 'utf8');
  const patched = patchApp(source);
  const showDialog = patched.slice(patched.indexOf('  async function showOfflineData(message) {'), patched.indexOf('  function isMobileDevice()'));
  assert.ok(showDialog.indexOf('showModal()') < showDialog.indexOf('await waitForUiPaint()'));
  assert.ok(showDialog.indexOf('await waitForUiPaint()') < showDialog.indexOf('refreshOfflineDataStatus({ skipCacheSize: Boolean(message) })'));
});
