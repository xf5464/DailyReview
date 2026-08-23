const fs = require('node:fs');
const path = require('node:path');
const { queryMacroOutlook } = require('./macro-outlook');

const projectRoot = path.resolve(__dirname, '..');
const siteDirectory = path.join(projectRoot, 'site');
const outputDirectory = path.join(projectRoot, 'dist');
const dataDirectory = path.join(outputDirectory, 'data');

async function build() {
  fs.rmSync(outputDirectory, { recursive: true, force: true });
  fs.cpSync(siteDirectory, outputDirectory, { recursive: true });
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.writeFileSync(path.join(outputDirectory, '.nojekyll'), '');

  process.stdout.write('Fetching the 10-year macro dataset...\n');
  const outlook = await queryMacroOutlook({ range: 'year10' });
  const usableCharts = outlook.charts.filter((chart) => chart.items.length > 0);
  if (usableCharts.length === 0) {
    throw new Error('No macro chart returned usable data; refusing to publish an empty site.');
  }

  const payload = {
    ...outlook,
    generatedBy: 'DailyReview GitHub Pages build',
  };
  fs.writeFileSync(
    path.join(dataDirectory, 'outlook.json'),
    JSON.stringify(payload) + '\n',
    'utf8',
  );

  const failedCharts = outlook.charts.filter((chart) => chart.error && chart.items.length === 0);
  process.stdout.write(
    'Built ' + usableCharts.length + '/' + outlook.charts.length + ' charts' +
    (failedCharts.length ? ' (' + failedCharts.length + ' source failures)' : '') + '.\n',
  );
  failedCharts.forEach((chart) => {
    process.stdout.write('- ' + chart.title + ': ' + chart.error + '\n');
  });
}

build().catch((error) => {
  process.stderr.write((error.stack || error.message) + '\n');
  process.exitCode = 1;
});
