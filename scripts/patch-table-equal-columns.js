const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const stylesPath = path.join(projectRoot, 'dist', 'styles.css');

let styles = fs.readFileSync(stylesPath, 'utf8');
const marker = '/* Overall table mobile layout: keep only chart/latest columns at equal width. */';

if (!styles.includes(marker)) {
  styles += [
    '',
    marker,
    '@media (max-width: 680px) {',
    '  .overall-table-view {',
    '    overflow-x: hidden;',
    '  }',
    '',
    '  .overall-table-view table {',
    '    width: 100%;',
    '    min-width: 0;',
    '    table-layout: fixed;',
    '  }',
    '',
    '  .overall-table-view th:nth-child(3),',
    '  .overall-table-view td:nth-child(3),',
    '  .overall-table-view th:nth-child(4),',
    '  .overall-table-view td:nth-child(4),',
    '  .overall-table-view th:nth-child(5),',
    '  .overall-table-view td:nth-child(5) {',
    '    display: none;',
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
console.log('Patched mobile overall table to keep only chart/latest columns at 50/50 width.');
