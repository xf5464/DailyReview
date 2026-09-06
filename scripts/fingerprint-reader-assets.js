'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const projectRoot = path.resolve(__dirname, '..');
const distRoot = path.join(projectRoot, 'dist');
const readerDir = path.join(distRoot, 'reader');
const readerIndexPath = path.join(readerDir, 'index.html');
const workerPath = path.join(distRoot, 'service-worker.js');

const assets = [
  { source: 'reader.js', stem: 'reader', ext: '.js' },
  { source: 'reader-hn.js', stem: 'reader-hn', ext: '.js' },
  { source: 'reader.css', stem: 'reader', ext: '.css' },
];

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').slice(0, 12);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function main() {
  if (!fs.existsSync(readerIndexPath)) throw new Error(`Missing ${readerIndexPath}`);
  if (!fs.existsSync(workerPath)) throw new Error(`Missing ${workerPath}`);

  const generated = [];

  for (const asset of assets) {
    const sourcePath = path.join(readerDir, asset.source);
    if (!fs.existsSync(sourcePath)) throw new Error(`Missing reader asset: ${asset.source}`);

    // Keep dist clean even if this script is run repeatedly without a full rebuild.
    const oldPattern = new RegExp(`^${escapeRegExp(asset.stem)}\\.[0-9a-f]{8,64}${escapeRegExp(asset.ext)}$`);
    for (const entry of fs.readdirSync(readerDir)) {
      if (oldPattern.test(entry)) fs.rmSync(path.join(readerDir, entry), { force: true });
    }

    const hash = hashFile(sourcePath);
    const fingerprinted = `${asset.stem}.${hash}${asset.ext}`;
    fs.renameSync(sourcePath, path.join(readerDir, fingerprinted));
    generated.push({ ...asset, fingerprinted });
  }

  let html = fs.readFileSync(readerIndexPath, 'utf8');
  for (const asset of generated) {
    const sourcePattern = new RegExp(`${escapeRegExp(asset.source)}(?:\\?v=[^\"']+)?`, 'g');
    html = html.replace(sourcePattern, asset.fingerprinted);
  }
  fs.writeFileSync(readerIndexPath, html, 'utf8');

  let worker = fs.readFileSync(workerPath, 'utf8');
  for (const asset of generated) {
    worker = worker.replace(new RegExp(`reader/${escapeRegExp(asset.source)}`, 'g'), `reader/${asset.fingerprinted}`);
  }

  const hn = generated.find((asset) => asset.source === 'reader-hn.js');
  if (hn && !worker.includes(`reader/${hn.fingerprinted}`)) {
    const readerJs = generated.find((asset) => asset.source === 'reader.js');
    if (!readerJs) throw new Error('Unable to locate fingerprinted reader.js');
    const anchor = `  'reader/${readerJs.fingerprinted}',`;
    if (!worker.includes(anchor)) throw new Error('Unable to add reader-hn.js to service worker shell');
    worker = worker.replace(anchor, `${anchor}\n  'reader/${hn.fingerprinted}',`);
  }
  fs.writeFileSync(workerPath, worker, 'utf8');

  process.stdout.write(`Fingerprinted reader assets: ${generated.map((asset) => asset.fingerprinted).join(', ')}\n`);
}

main();
