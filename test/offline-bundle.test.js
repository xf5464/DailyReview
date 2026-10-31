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

test('automatic offline update stays non-modal and paints before scanning caches', () => {
  const projectRoot = path.resolve(__dirname, '..');
  const source = fs.readFileSync(path.join(projectRoot, 'site', 'app.js'), 'utf8');
  const patched = patchApp(source);
  const showDialog = patched.slice(patched.indexOf('  async function showOfflineData(message) {'), patched.indexOf('  function isMobileDevice()'));
  assert.match(showDialog, /if \(automatic\) await waitForPageVisible\(\)/);
  assert.match(showDialog, /refs\.offlineDataDialog\.show\(\)/);
  assert.ok(showDialog.indexOf('refs.offlineDataDialog.show()') < showDialog.indexOf('await waitForUiPaint()'));
  assert.ok(showDialog.indexOf('await waitForUiPaint()') < showDialog.indexOf('refreshOfflineDataStatus({ skipCacheSize: Boolean(message) })'));
});

test('full offline ZIP includes the fingerprinted quarterly fund dataset',t=>{const output=fs.mkdtempSync(path.join(os.tmpdir(),'fund-offline-zip-'));t.after(()=>fs.rmSync(output,{recursive:true,force:true}));const body=fs.readFileSync(path.join(__dirname,'../scripts/data/active-fund-industry-crowding.json'));const hash=contentHash(body),relative='data/offline/datasets/active-fund-industry-crowding.'+hash+'.json';fs.mkdirSync(path.dirname(path.join(output,relative)),{recursive:true});fs.writeFileSync(path.join(output,relative),body);fs.writeFileSync(path.join(output,'data/offline-manifest.json'),JSON.stringify({schemaVersion:1,charts:[],datasets:[{id:'activeFundIndustryCrowding',path:relative,canonicalPath:'data/active-fund-industry-crowding.json',hash,bytes:body.length}]}));const result=createOfflineBundle(output),entries=unzipSync(result.archive);assert.deepEqual(Buffer.from(entries[relative]),body);assert.equal(result.manifest.bundle.fileCount,1);});
function offlineDatasetApi(){const source=fs.readFileSync(path.join(__dirname,'../site/app.js'),'utf8');const start=source.indexOf('  function offlineManifestNeedsUpdate('),end=source.indexOf('  async function checkOfflineDataUpdateOnLaunch(',start),a=source.indexOf('  async function assembleOfflineDatasets('),b=source.indexOf('  async function downloadAllOfflineData(',a);assert.ok(start>=0&&end>start&&a>=0&&b>a);return new Function('absoluteAppUrl','responseMatchesHash',source.slice(start,end)+source.slice(a,b)+'return {offlineManifestNeedsUpdate,assembleOfflineDatasets};')(p=>new URL(p,'https://example.test/').href,async(response,hash)=>contentHash(Buffer.from(await response.clone().arrayBuffer()))===hash);}
test('quarter-only dataset changes trigger an offline update even when chart signatures stay unchanged',()=>{const api=offlineDatasetApi(),charts=[{id:'same',signature:'same'}],datasets=[{path:'data/offline/datasets/fund.new.json',hash:'new'}];assert.equal(api.offlineManifestNeedsUpdate({schemaVersion:1,charts},{schemaVersion:1,charts,datasets}),true);assert.equal(api.offlineManifestNeedsUpdate({schemaVersion:1,charts,datasets},{schemaVersion:1,charts,datasets}),false);assert.equal(api.offlineManifestNeedsUpdate({schemaVersion:1,charts,datasets},{schemaVersion:1,charts,datasets:[{path:'data/offline/datasets/fund.next.json',hash:'next'}]}),true);});
test('downloaded quarterly datasets populate the canonical offline URL and preserve old data on checksum failure',async()=>{const api=offlineDatasetApi(),body=Buffer.from('{"quarterCount":41}'),dataset={path:'data/offline/datasets/fund.new.json',canonicalPath:'data/active-fund-industry-crowding.json',hash:contentHash(body)},canonical='https://example.test/'+dataset.canonicalPath,versioned='https://example.test/'+dataset.path,entries=new Map([[canonical,new Response('{"quarterCount":9}')],[versioned,new Response(body)]]),cache={match:async key=>entries.get(key),put:async(key,value)=>{entries.set(key,value);}};await api.assembleOfflineDatasets({datasets:[dataset]},cache);assert.equal((await entries.get(canonical).clone().json()).quarterCount,41);entries.set(versioned,new Response('corrupt'));await assert.rejects(()=>api.assembleOfflineDatasets({datasets:[dataset]},cache),/校验失败/);assert.equal((await entries.get(canonical).clone().json()).quarterCount,41);});

test('incremental download repairs a corrupt cached quarterly dataset instead of repeatedly reusing it',async()=>{const source=fs.readFileSync(path.join(__dirname,'../site/app.js'),'utf8'),a=source.indexOf('  async function downloadOfflineFiles('),b=source.indexOf('  async function assembleOfflineChart(',a),body=Buffer.from('{"quarterCount":41}'),file={path:'data/offline/datasets/fund.new.json',canonicalPath:'data/active-fund-industry-crowding.json',hash:contentHash(body),bytes:body.length},url='https://example.test/'+file.path,entries=new Map([[url,new Response('corrupt')]]);let fetched=0;const cache={match:async key=>entries.get(key),put:async(key,value)=>{entries.set(key,value);}},api=new Function('absoluteAppUrl','responseMatchesHash','readOfflineCachePaths','fetch',source.slice(a,b)+'return downloadOfflineFiles;')(p=>new URL(p,'https://example.test/').href,async(r,hash)=>Boolean(r)&&contentHash(Buffer.from(await r.clone().arrayBuffer()))===hash,async()=>new Set([new URL(url).pathname]),async()=>{fetched++;return new Response(body);});assert.equal(await api([file],cache,()=>{}),body.length);assert.equal(fetched,1);assert.equal((await entries.get(url).json()).quarterCount,41);});
