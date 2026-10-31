'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {collectDisclosureText,readDisclosureText,parseDisclosureMetadata}=require('../scripts/fund-disclosure-text');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const row={id:'AN201609300001',title:'示例基金基金合同',publishedAt:'2016-09-30'};
function loader(texts,{changed=false}={}) {
 return async(url,parse)=>{
   const page=Number(new URL(url).searchParams.get('page_index'));
   const body=JSON.stringify({success:1,data:{art_code:row.id,notice_title:row.title,notice_date:row.publishedAt,
     page_size:changed&&page>1?texts.length+1:texts.length,notice_content:texts[page-1],attach_url:'https://pdf.dfcfw.com/pdf/H22_'+row.id+'_1.pdf'}});
   return {value:parse(body),source:{url,hash:hash(body),fetchedAt:'2026-10-31T00:00:00Z'}};
 };
}
test('complete official text preserves every chunk and actual attachment prefix',async()=>{
 const result=await collectDisclosureText(row,loader(['第一页投资目标','第二页投资范围']));
 assert.deepEqual(result.document.pages.map(p=>p.text),['第一页投资目标','第二页投资范围']);
 assert.equal(result.source.chunks.length,2);
 assert.equal(result.source.pageBasis,'source-text-chunk');
 assert.match(result.source.attachmentUrl,/H22_/);
});
test('changed pagination and repeated chunks cannot become complete source evidence',async()=>{
 await assert.rejects(collectDisclosureText(row,loader(['重复','重复'])),/Repeated/);
 await assert.rejects(collectDisclosureText(row,loader(['第一页','第二页'],{changed:true})),/changed/);
});
test('official attachment metadata must match announcement identity and publication date',()=>{
 const body={success:1,data:{art_code:row.id,notice_title:row.title,notice_date:'2016-10-01',page_size:1}};
 assert.throws(()=>parseDisclosureMetadata(body,row),/does not match/);
 body.data.notice_date=row.publishedAt;body.data.art_code='AN999';
 assert.throws(()=>parseDisclosureMetadata(body,row),/does not match/);
});
test('cached text rejects changed extracted text and wrong announcement IDs',async t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'fund-text-'));
 t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const original=await readDisclosureText(row,{directory,load:loader(['完整正文'])});
 const file=path.join(directory,row.id+'.complete.json');
 await readDisclosureText(row,{directory,cacheOnly:true});
 original.document.pages[0].text='被改写的正文';fs.writeFileSync(file,JSON.stringify(original));
 await assert.rejects(readDisclosureText(row,{directory,cacheOnly:true}),/checksum/);
 const other={...row,id:'AN201609300002'};
 const valid=await collectDisclosureText(other,async(url,parse)=>{
   const body=JSON.stringify({success:1,data:{art_code:other.id,notice_title:other.title,notice_date:other.publishedAt,page_size:1,notice_content:'完整正文'}});
   return {value:parse(body),source:{url,hash:hash(body),fetchedAt:'2026-10-31T00:00:00Z'}};
 });
 fs.writeFileSync(file,JSON.stringify(valid));
 await assert.rejects(readDisclosureText(row,{directory,cacheOnly:true}),/checksum/);
});
