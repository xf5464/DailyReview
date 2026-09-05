const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const appPath = path.join(projectRoot, 'dist', 'app.js');
const ISM_IDS = [
  'ismManufacturingPmi',
  'ismSupplierDeliveries',
  'ismNewOrders',
  'ismBacklogOrders',
];

function patchApp(source) {
  const oldLine = "    refs.detailRange.value = refs.range.value;";
  const newLine = "    refs.detailRange.value = " + JSON.stringify(ISM_IDS) + ".includes(id) ? 'year3' : refs.range.value;";
  if (!source.includes(oldLine)) {
    if (source.includes(newLine)) return source;
    throw new Error('detail range initialization line not found');
  }
  return source.replace(oldLine, newLine);
}

function main() {
  if (!fs.existsSync(appPath)) throw new Error('dist/app.js missing; run normal build first');
  const source = fs.readFileSync(appPath, 'utf8');
  fs.writeFileSync(appPath, patchApp(source), 'utf8');
  process.stdout.write('Set all four ISM detail dialogs to default to 3 years.\n');
}

if (require.main === module) main();

module.exports = { ISM_IDS, patchApp };
