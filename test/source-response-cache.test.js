'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createSourceCache}=require('../scripts/source-response-cache');
function directory(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'source-cache-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
test('conditional response cache persists across instances and accepts a zero-byte 304',async t=>{
 const dir=directory(t),events=[];let calls=0;
 const fetchImpl=async(url,opts)=>{calls++;if(calls===1)return new Response('date,value\n2026-01-01,1',{headers:{etag:'"v1"','content-encoding':'gzip','content-length':'20'}});assert.equal(opts.headers.get('if-none-match'),'"v1"');return new Response(null,{status:304});};
 const body=await (await createSourceCache({directory:dir,fetchImpl})('https://example.test/data.csv')).text();
 const second=await createSourceCache({directory:dir,fetchImpl,onRequest:e=>events.push(e)})('https://example.test/data.csv');assert.equal(await second.text(),body);assert.equal(second.headers.get('content-encoding'),null);assert.equal(events[0].bytes,0);
});
test('commit-pinned source files are reused without another network request',async t=>{
 const dir=directory(t);let calls=0;const load=createSourceCache({directory:dir,fetchImpl:async()=>{calls++;return new Response('immutable');}}),url='https://raw.githubusercontent.com/owner/repo/'+ 'a'.repeat(40)+'/data.csv';
 await load(url);assert.equal(await(await load(url)).text(),'immutable');assert.equal(calls,1);
});
test('partial responses and caller-managed validators bypass the shared cache',async t=>{
 const dir=directory(t),load=createSourceCache({directory:dir,fetchImpl:async()=>new Response('partial',{status:206})});await load('https://example.test/data',{headers:{range:'bytes=10-'}});assert.equal(fs.readdirSync(dir).length,0);
});
test('repeated source outages open a per-origin circuit without affecting other origins',async t=>{
 const dir=directory(t);let calls=0;const load=createSourceCache({directory:dir,fetchImpl:async()=>{calls++;return new Response('unavailable',{status:503});}});
 for(let i=0;i<3;i++)await load('https://example.test/data');await assert.rejects(load('https://example.test/other'),/temporarily unavailable/);assert.equal(calls,3);await load('https://another.test/data');assert.equal(calls,4);
});
test('broken response bodies cannot hang repeated refreshes or corrupt the previous body',async t=>{
 const dir=directory(t);let calls=0;const load=createSourceCache({directory:dir,fetchImpl:async()=>{calls++;return new Response(new ReadableStream({start(controller){controller.error(new Error('broken body'));}}));}});
 for(let i=0;i<3;i++)await assert.rejects(load('https://example.test/data'),/broken body/);await assert.rejects(load('https://example.test/data'),/temporarily unavailable/);assert.equal(calls,3);assert.equal(fs.readdirSync(dir).length,0);
});
test('changed source replaces body; failed source never overwrites successful cache',async t=>{
 const dir=directory(t);let phase=0;const load=createSourceCache({directory:dir,fetchImpl:async()=>phase===2?new Response('bad',{status:503}):phase===3?new Response(null,{status:304}):new Response('version'+phase,{headers:{etag:'v'+phase}})});
 await load('https://example.test/data');phase=1;await load('https://example.test/data');phase=2;assert.equal((await load('https://example.test/data')).status,503);phase=3;assert.equal(await(await load('https://example.test/data')).text(),'version1');
});
test('corrupt body is discarded and conditional validators are not sent',async t=>{
 const dir=directory(t);await createSourceCache({directory:dir,fetchImpl:async()=>new Response('good',{headers:{etag:'v1'}})})('https://example.test/data');const file=path.join(dir,fs.readdirSync(dir)[0]),record=JSON.parse(fs.readFileSync(file));record.body=Buffer.from('corrupt').toString('base64');fs.writeFileSync(file,JSON.stringify(record));await createSourceCache({directory:dir,fetchImpl:async(url,opts)=>{assert.equal(opts.headers.has('if-none-match'),false);return new Response('repaired');}})('https://example.test/data');
});
test('private requests and no-store responses are never persisted',async t=>{
 const dir=directory(t),load=createSourceCache({directory:dir,fetchImpl:async()=>new Response('private',{headers:{'cache-control':'no-store'}})});await load('https://example.test/data',{headers:{authorization:'Bearer private'}});await load('https://example.test/public');assert.equal(fs.readdirSync(dir).length,0);
});
