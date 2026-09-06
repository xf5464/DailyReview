const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const appPath = path.join(distDir, 'app.js');
const stylesPath = path.join(distDir, 'styles.css');

function patchApp() {
  let source = fs.readFileSync(appPath, 'utf8');

  const renderCardsSource = [
    '  function renderCards() {',
    "    refs.grid.style.setProperty('--overall-columns', String(config.chartsPerRow));",
  ].join('\n');
  const renderCardsReplacement = [
    '  function renderCards() {',
    '    config.chartsPerRow = 2;',
    "    refs.columns.value = '2';",
    "    refs.grid.style.setProperty('--overall-columns', '2');",
  ].join('\n');
  if (!source.includes(renderCardsSource)) {
    throw new Error('Unable to force two-column chart mode: renderCards pattern changed.');
  }
  source = source.replace(renderCardsSource, renderCardsReplacement);

  const columnChangeSource = [
    "    refs.columns.addEventListener('change', function () {",
    '      config.chartsPerRow = Number(refs.columns.value);',
    '      persistConfig();',
    '      renderCards();',
    '    });',
  ].join('\n');
  const columnChangeReplacement = [
    "    refs.columns.addEventListener('change', function () {",
    '      config.chartsPerRow = 2;',
    "      refs.columns.value = '2';",
    '      persistConfig();',
    '      renderCards();',
    '    });',
  ].join('\n');
  if (!source.includes(columnChangeSource)) {
    throw new Error('Unable to lock two-column selector: columns change pattern changed.');
  }
  source = source.replace(columnChangeSource, columnChangeReplacement);

  fs.writeFileSync(appPath, source, 'utf8');
}

function patchStyles() {
  let styles = fs.readFileSync(stylesPath, 'utf8');
  const marker = '/* Fixed two-column equal-width chart mode. */';
  if (!styles.includes(marker)) {
    styles += [
      '',
      marker,
      '.overall-chart-grid {',
      '  --overall-columns: 2 !important;',
      '  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;',
      '}',
      '',
    ].join('\n');
  }
  fs.writeFileSync(stylesPath, styles, 'utf8');
}

patchApp();
patchStyles();
console.log('Patched chart mode to two equal-width columns.');
