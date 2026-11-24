const test=require('node:test');
const assert=require('node:assert/strict');
const {reconcile}=require('../scripts/refresh-reader-resilient');
const {REQUIRED_CATEGORIES}=require('../scripts/verify-reader-refresh');
const now=Date.parse('2026-11-24T00:00:00Z');
const archive=()=>({items:REQUIRED_CATEGORIES.flatMap(category=>Array.from({length:10},(_,i)=>({category,title:'Current '+i,url:'https://example.com/'+category+'/'+i,fetchedAt:new Date(now).toISOString(),isCached:false})))});
test('one missing category retains its old timestamps without discarding five fresh categories',()=>{
 const old=archive(),current=archive(); old.items.forEach(x=>x.fetchedAt='2026-11-23T00:00:00Z');
 current.items=current.items.filter(x=>x.category!=='world');
 const result=reconcile(current,old,now);
 assert.equal(result.items.length,60);assert.equal(result.failureCount,10);
 assert.ok(result.items.filter(x=>x.category==='world').every(x=>x.isCached&&x.fetchedAt==='2026-11-23T00:00:00Z'));
 assert.ok(result.items.filter(x=>x.category!=='world').every(x=>!x.isCached&&x.fetchedAt===new Date(now).toISOString()));
});
test('fresh originals and Google News links are accepted; real absence of all usable history still fails',()=>{
 const current=archive();current.items[0].url='https://news.google.com/rss/articles/example';
 assert.equal(reconcile(current,{},now).failureCount,0);
 current.items=current.items.filter(x=>x.category!=='world');
 assert.throws(()=>reconcile(current,{},now),/No complete current or previous snapshot for world/);
});
