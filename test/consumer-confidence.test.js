const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '../site/app.js'), 'utf8');
const macro = fs.readFileSync(path.join(__dirname, '../scripts/macro-outlook.js'), 'utf8');
test('Michigan consumer sentiment uses FRED UMCSENT monthly history', () => {
  assert.match(macro, /consumerConfidence: \{/);
  assert.match(macro, /fred\.stlouisfed\.org\/series\/UMCSENT/);
  assert.match(macro, /buildFredUrl\('UMCSENT', inflationStartDate, endDate\)/);
  assert.match(macro, /parseFredCsv\(text, 'UMCSENT'\), range, 'monthly'/);
});
test('consumer sentiment appears in primary and US groups', () => {
  assert.match(app, /consumerConfidence: \['group_primary', 'group_mt432xl1_kz1mx7'\]/);
  assert.match(app, /consumerConfidence: '美国消费者信心指数（密歇根大学）'/);
  assert.match(app, /'unemploymentRate', 'consumerConfidence'/);
});
