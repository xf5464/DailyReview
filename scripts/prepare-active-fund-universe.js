'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {activeFund} = require('./collect-active-fund-crowding');
const {deduplicateFundShares} = require('./fund-portfolio-source');
function parseFundCatalogue(text) {
  const match = String(text).match(/^\s*var\s+r\s*=\s*(\[[\s\S]*\])\s*;?\s*$/);
  if (!match) throw new Error('Unrecognized Eastmoney fund catalogue');
  const rows = JSON.parse(match[1]);
  if (!Array.isArray(rows) || !rows.length || rows.some(r => !Array.isArray(r) ||
      r.length < 4 || !/^\d{6}$/.test(r[0]) || typeof r[2] !== 'string' || typeof r[3] !== 'string')) throw new Error('Invalid fund catalogue rows');
  const funds = rows.map(r => ({fundCode:r[0],fundName:r[2],type:r[3]}));
  if (new Set(funds.map(f=>f.fundCode)).size !== funds.length) throw new Error('Duplicate fund codes');
  return {recordCount:rows.length, funds:deduplicateFundShares(funds.filter(activeFund))};
}
function main(args = process.argv.slice(2)) {
  const get = flag => {const i=args.indexOf(flag); return i < 0 ? null : args[i+1];};
  if (!get('--input') || !get('--output')) throw new Error('Usage: --input fundcode_search.js --output candidate-funds.json');
  const raw = fs.readFileSync(get('--input'),'utf8');
  const {recordCount,funds} = parseFundCatalogue(raw);
  const output = path.resolve(get('--output'));
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,JSON.stringify(funds,null,2) + '\n');
  fs.writeFileSync(output + '.provenance.json',JSON.stringify({
    source:'https://fund.eastmoney.com/js/fundcode_search.js',
    preparedAt:new Date().toISOString(), rawSha256:crypto.createHash('sha256').update(raw).digest('hex'),
    recordCount, candidateProductCount:funds.length, historicalMembershipVerified:false,
    limitation:'Current catalogue and name-based share deduplication are candidates only. Quarterly membership, product identity, fund-type history, terminated funds and quarter-end NAV require separate verification.'
  },null,2) + '\n');
  console.log('Prepared ' + funds.length + ' candidate products; not a verified historical universe.');
}
if (require.main === module) {try {main();} catch(e) {console.error(e.message);process.exitCode=1;}}
module.exports = {parseFundCatalogue,main};
