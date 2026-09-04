const fs = require('node:fs');
const path = require('node:path');

const stylesPath = path.resolve(__dirname, '..', 'dist', 'styles.css');
const css = `

/* 所有图表详情弹窗禁止横向整体移动；内容必须在视口内自适应。 */
html:has(#overallDetailDialog[open]),
html:has(#wideEtfCurveDialog[open]),
html:has(#shareholderHistoryDialog[open]),
html:has(#shareholderBarChartsDialog[open]),
body:has(#overallDetailDialog[open]),
body:has(#wideEtfCurveDialog[open]),
body:has(#shareholderHistoryDialog[open]),
body:has(#shareholderBarChartsDialog[open]) {
  overflow-x: hidden;
}

#overallDetailDialog,
#wideEtfCurveDialog,
#shareholderHistoryDialog,
#shareholderBarChartsDialog {
  max-width: calc(100vw - 16px);
  overflow-x: hidden;
}

#overallDetailDialog .overall-config-card,
#wideEtfCurveDialog .overall-config-card,
#shareholderHistoryDialog .overall-config-card,
#shareholderBarChartsDialog .overall-config-card {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: hidden;
}

#overallDetailDialog .overall-detail-chart,
#wideEtfCurveDialog .overall-detail-chart,
#shareholderHistoryDialog .overall-detail-chart,
#shareholderBarChartsDialog .shareholder-bars-grid,
#overallDetailDialog .shareholder-table-wrap {
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

#overallDetailDialog table,
#wideEtfCurveDialog table,
#shareholderHistoryDialog table,
#shareholderBarChartsDialog table {
  max-width: 100%;
}
`;

if (!fs.existsSync(stylesPath)) {
  throw new Error('dist/styles.css not found; run the main build first.');
}
fs.appendFileSync(stylesPath, css, 'utf8');
