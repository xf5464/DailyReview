const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const appPath = path.join(projectRoot, 'dist', 'app.js');

function patchApp(source) {
  const oldLines = [
    "    refs.detailRange.value = refs.range.value;",
    "    refs.detailRange.value = [\"ismManufacturingPmi\",\"ismSupplierDeliveries\",\"ismNewOrders\",\"ismBacklogOrders\"].includes(id) ? 'year3' : refs.range.value;",
  ];
  const newLine = "    refs.detailRange.value = 'year1';";

  if (source.includes(newLine)) return source;
  for (const oldLine of oldLines) {
    if (source.includes(oldLine)) return source.replace(oldLine, newLine);
  }
  throw new Error('detail range initialization line not found');
}

function main() {
  if (!fs.existsSync(appPath)) throw new Error('dist/app.js missing; run normal build first');
  const source = fs.readFileSync(appPath, 'utf8');
  fs.writeFileSync(appPath, patchApp(source), 'utf8');
  process.stdout.write('Set all chart detail dialogs to default to 1 year.\n');
}

if (require.main === module) main();

module.exports = { patchApp };
