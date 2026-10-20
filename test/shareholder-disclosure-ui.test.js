const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../site/app.js'), 'utf8');
const start = source.indexOf('  function shareholderScheduledDateText(');
const end = source.indexOf('  function showShareholderHistory(', start);
function createElement(tag, className, textContent) {
  return { tagName: tag.toUpperCase(), className, textContent, children: [],
    append(...nodes) { this.children.push(...nodes); },
    replaceChildren() { this.children = []; },
    setAttribute() {}, addEventListener() {} };
}
const { format, render } = new Function('createElement', 'document', 'hasNumericValue', 'formatHolderCount',
  'shareholderQuarterChange', 'formatHolderChange', 'formatMarketCap',
  source.slice(start, end) + '; return { format: shareholderScheduledDateText, render: renderShareholderTable };'
)(createElement, { createElement }, value => value != null && Number.isFinite(Number(value)),
  value => value == null ? '--' : value + ' 户', () => ({ value: NaN }), () => '--', () => '--');

test('appointment date renders MM.DD only for its matching report quarter, including old cached data', () => {
  const stock = { scheduledDisclosureDate: '2026-10-28' };
  assert.equal(format(stock, '2026-09-30'), '10.28');
  assert.equal(format(stock, '2026-06-30'), '');
  assert.equal(format(stock, '2025-09-30'), '');
  assert.equal(format({ scheduledDisclosureDate: '2027-01-20' }, '2026-12-31'), '01.20');
  assert.equal(format({ ...stock, scheduledDisclosureReportDate: '2026-06-30' }, '2026-09-30'), '');
  assert.equal(format({ ...stock, scheduledDisclosureReportDate: '2026-06-30' }, '2026-06-30'), '10.28');
  for (const date of [null, '', 'invalid', '2026-02-30', '2026-13-01']) {
    assert.equal(format({ scheduledDisclosureDate: date }, '2026-09-30'), '');
  }
});

test('shareholder table shows appointments for missing quarter values, retains disclosed counts and history blanks', () => {
  const body = createElement('tbody');
  const stock = { name: '中国电影', code: '600977', latestDate: '2026-09-30',
    latestValue: null, scheduledDisclosureDate: '2026-10-29' };
  render(body, [stock], true);
  assert.equal(body.children[0].children[1].textContent, '10.29');
  assert.equal(body.children[0].children[1].title, '预约披露日期：10.29');
  render(body, [{ ...stock, latestValue: 129702 }], true);
  assert.equal(body.children[0].children[1].textContent, '129702 户');
  render(body, [{ ...stock, latestDate: '2026-06-30' }], true);
  assert.equal(body.children[0].children[1].textContent, '--');
  render(body, [stock], false);
  assert.equal(body.children[0].children[1].textContent, '--');
});
