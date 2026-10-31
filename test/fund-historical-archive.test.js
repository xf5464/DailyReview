const test=require('node:test'),assert=require('node:assert/strict');
const {parseArchiveDay,collectArchiveDay,publicationDates}=require('../scripts/fund-historical-report-archive');
function html({date='2016-10-25',page=1,pages=1,codes=['000001'],empty=false}={}) {
 const rows=empty?'<tr><td colspan="6">暂无数据</td></tr>':codes.map((c,i)=>'<tr><td><a href="'+c+',AN20161025000'+i+'.html" title="测试混合型证券投资基金2016年第3季度报告">报告</a></td><td>'+date+'</td></tr>').join('');
 return '<table id="jjggbt"><tr><th>基金代码</th><th>发布时间</th></tr>'+rows+'</table>'+(pages>1?'<div id="PageNav"><span class="at" class="on">'+page+'</span><a href="?page=2&allpages='+pages+'">2</a></div>':'');
}
test('historical archive parser distinguishes verified empty dates from broken responses',()=>{
 assert.equal(parseArchiveDay(html({empty:true}),{date:'2016-10-25'}).rows.length,0);
 assert.throws(()=>parseArchiveDay('<html>维护</html>',{date:'2016-10-25'}),/Unrecognized/);
 assert.throws(()=>parseArchiveDay(html({date:'2016-10-26'}),{date:'2016-10-25'}),/date mismatch/);
 assert.equal(parseArchiveDay(html({codes:['37001B']}),{date:'2016-10-25'}).rows[0].fundCode,'37001B');
});
test('historical pagination requires full intermediate pages and verifies current page',()=>{
 const codes=Array.from({length:20},(_,i)=>String(i+1).padStart(6,'0'));
 assert.equal(parseArchiveDay(html({codes,pages:2}),{date:'2016-10-25'}).pages,2);
 assert.throws(()=>parseArchiveDay(html({codes:['000001'],pages:2}),{date:'2016-10-25'}),/Incomplete/);
 assert.throws(()=>parseArchiveDay(html({codes,pages:2,page:1}),{date:'2016-10-25',page:2}),/another page/);
});
test('collector follows the official allpages parameter and catches duplicate pages',async()=>{
 const codes=Array.from({length:20},(_,i)=>String(i+1).padStart(6,'0'));let requests=[];
 const load=async(url,parse)=>{requests.push(url);const p=Number(new URL(url).searchParams.get('page'));return {value:parse(html({pages:2,page:p,codes:p===1?codes:['000021']})),source:{url}};};
 const out=await collectArchiveDay('2016-10-25',load);assert.equal(out.rows.length,21);assert.equal(new URL(requests[1]).searchParams.get('allpages'),'2');
 await assert.rejects(collectArchiveDay('2016-10-25',async(url,parse)=>{const p=Number(new URL(url).searchParams.get('page'));return {value:parse(html({pages:2,page:p,codes:p===1?codes:['000001']})),source:{url}};}),/Duplicate.*across pages/);
});
test('publication window is finite, explicit and never includes future calendar dates',()=>{
 const dates=publicationDates('2016-Q3',45,'2026-10-31');assert.equal(dates.length,45);assert.equal(dates[0],'2016-10-01');assert.equal(dates.at(-1),'2016-11-14');
 assert.equal(publicationDates('2026-Q3',45,'2026-10-31').length,31);
 assert.throws(()=>publicationDates('2026-Q4',45,'2026-10-31'),/no completed/);
});
