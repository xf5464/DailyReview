const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const stylesPath = path.join(projectRoot, 'dist', 'styles.css');

let styles = fs.readFileSync(stylesPath, 'utf8');
const marker = '/* Overall table: chart name and latest value use equal width on mobile. */';

if (!styles.includes(marker)) {
  styles += [
    '',
    marker,
    '@media (max-width: 680px) {',
    '  .overall-table-view table {',
    '    width: 100%;',
    '    min-width: 0;',
    '    table-layout: fixed;',
    '  }',
    '',
    '  .overall-table-view th:first-child,',
    '  .overall-table-view td:first-child,',
    '  .overall-table-view th:nth-child(2),',
    '  .overall-table-view td:nth-child(2) {',
    '    width: 50%;',
    '  }',
    '}',
    '',
  ].join('\n');
}

fs.writeFileSync(stylesPath, styles, 'utf8');
console.log('Patched overall table to 50/50 name and latest-value columns on mobile.');
