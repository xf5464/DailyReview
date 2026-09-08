const fs = require('node:fs');
const path = require('node:path');

const appPath = path.resolve(__dirname, '..', 'dist', 'app.js');
// Build inputs may use CRLF on Windows.  Normalize the generated asset once so
// this and the remaining text patches can match the same canonical line ending.
let source = fs.readFileSync(appPath, 'utf8').replace(/\r\n/g, '\n');

const target = [
  "    var number = Number(value);",
  "    var digits = Number.isInteger(chart.decimals) ? chart.decimals : 2;",
  "    var options = {",
  "      minimumFractionDigits: compact ? 0 : digits,",
  "      maximumFractionDigits: digits",
  "    };",
].join('\n');

const replacement = [
  "    var number = Number(value);",
  "    var digits = Number.isInteger(chart.decimals) ? chart.decimals : 2;",
  "    if (Math.abs(number) >= 1000) digits = 0;",
  "    var options = {",
  "      minimumFractionDigits: compact ? 0 : digits,",
  "      maximumFractionDigits: digits",
  "    };",
].join('\n');

if (!source.includes(target)) {
  throw new Error('Unable to patch large-number formatting: formatValue pattern changed.');
}

source = source.replace(target, replacement);
fs.writeFileSync(appPath, source, 'utf8');
process.stdout.write('Large values now render without decimals.\n');
