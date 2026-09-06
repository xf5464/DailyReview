const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const appPath = path.join(projectRoot, 'dist', 'app.js');

const DETAIL_RANGE_CONFIG = Object.freeze({
  default: 'year1',
  charts: Object.freeze({
    ismManufacturingPmi: 'year3',
    ismSupplierDeliveries: 'year3',
    ismNewOrders: 'year3',
    ismBacklogOrders: 'year3',
  }),
});

function patchApp(source) {
  const oldLines = [
    "    refs.detailRange.value = refs.range.value;",
    "    refs.detailRange.value = 'year1';",
    "    refs.detailRange.value = [\"ismManufacturingPmi\",\"ismSupplierDeliveries\",\"ismNewOrders\",\"ismBacklogOrders\"].includes(id) ? 'year3' : refs.range.value;",
  ];
  const newLine = "    refs.detailRange.value = ({\"ismManufacturingPmi\":\"year3\",\"ismSupplierDeliveries\":\"year3\",\"ismNewOrders\":\"year3\",\"ismBacklogOrders\":\"year3\"}[id] || 'year1');";

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
  process.stdout.write('Configured detail defaults: 1 year generally, 3 years for all four ISM charts.\n');
}

if (require.main === module) main();

module.exports = { DETAIL_RANGE_CONFIG, patchApp };
