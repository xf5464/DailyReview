'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {CHART_METADATA}=require('../scripts/macro-outlook'),{policies,updateReport}=require('../scripts/data-update-policies');
test('every published metric has an explicit update policy',()=>{assert.deepEqual(Object.keys(policies).sort(),Object.keys(CHART_METADATA).sort());});
test('update audit distinguishes additions, revisions and failed refreshes',()=>{
 const previous={ndx:{items:[{date:'2026-01-01',value:1}]}},chart={id:'ndx',items:[{date:'2026-01-01',value:2},{date:'2026-01-02',value:3}]};
 const report=updateReport([chart],previous)[0];assert.equal(report.added,1);assert.equal(report.revised,1);assert.equal(report.mode,'incremental');assert.equal(updateReport([{...chart,dataFallback:true}],previous)[0].mode,'fallback');assert.throws(()=>updateReport([{id:'unknown',items:[]}],{}),/Missing/);
});
