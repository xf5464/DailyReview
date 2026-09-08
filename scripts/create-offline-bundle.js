const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { zipSync } = require('fflate');

const projectRoot = path.resolve(__dirname, '..');
const defaultOutputDirectory = path.join(projectRoot, 'dist');

function contentHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

function normalizeBundlePath(value) {
  const normalized = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('../')) throw new Error(`Invalid offline bundle path: ${value}`);
  return normalized;
}

function createOfflineBundle(outputDirectory = defaultOutputDirectory) {
  const manifestPath = path.join(outputDirectory, 'data', 'offline-manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error('Offline manifest missing; run the normal build first.');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.charts)) throw new Error('Offline manifest charts are invalid.');

  const dataFiles = manifest.charts.flatMap((chart) => [chart.extras, ...(chart.chunks || [])]);
  const paths = [...new Set(dataFiles.map((file) => normalizeBundlePath(file.path)))];
  const outlookPath = 'data/outlook.json';
  if (fs.existsSync(path.join(outputDirectory, outlookPath))) paths.push(outlookPath);

  const entries = {};
  paths.forEach((relativePath) => {
    const absolutePath = path.resolve(outputDirectory, relativePath);
    if (!absolutePath.startsWith(path.resolve(outputDirectory) + path.sep) || !fs.existsSync(absolutePath)) {
      throw new Error(`Offline bundle source missing: ${relativePath}`);
    }
    entries[relativePath] = new Uint8Array(fs.readFileSync(absolutePath));
  });

  const archive = Buffer.from(zipSync(entries, {
    level: 9,
    mtime: new Date('1980-01-01T00:00:00.000Z'),
  }));
  const hash = contentHash(archive);
  const fileName = `offline-bundle.${hash}.zip`;
  const relativePath = `data/${fileName}`;
  fs.writeFileSync(path.join(outputDirectory, relativePath), archive);

  manifest.bundle = {
    path: relativePath,
    hash,
    bytes: archive.byteLength,
    fileCount: paths.length,
    format: 'zip',
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest) + '\n', 'utf8');
  process.stdout.write(`Created ${relativePath}: ${(archive.byteLength / 1024 / 1024).toFixed(2)} MB, ${paths.length} files.\n`);
  return { archive, manifest, paths, relativePath };
}

if (require.main === module) createOfflineBundle();

module.exports = { contentHash, createOfflineBundle, normalizeBundlePath };
