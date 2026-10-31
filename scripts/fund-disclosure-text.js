'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const normalize=value=>String(value||'').normalize('NFKC').replace(/\s+/g,'');
function textUrl(id,page){return 'https://np-cnotice-stock.eastmoney.com/api/content/ann?art_code='+id+'&client_source=web&page_index='+page;}
function parseDisclosureMetadata(body,row) {
 const data=typeof body==='string'?JSON.parse(body):body,r=data?.data;
 if(![true,1].includes(data?.success)||r?.art_code!==row.id||normalize(r.notice_title)!==normalize(row.title)||String(r.notice_date||'').slice(0,10)!==row.publishedAt.slice(0,10))throw new Error('Disclosure attachment metadata does not match dated announcement');
 return {title:r.notice_title,attachmentUrl:r.attach_url||null,pages:Number(r.page_size)};
}
function parseDisclosureChunk(body,row,page) {
 const data=(typeof body==='string'?JSON.parse(body):body),r=data?.data;
 if(![true,1].includes(data?.success)||r?.art_code!==row.id||normalize(r.notice_title)!==normalize(row.title)||
   typeof r.notice_content!=='string'||!r.notice_content.trim()||!Number.isInteger(Number(r.page_size))||Number(r.page_size)<page||Number(r.page_size)>300||
   String(r.notice_date||'').slice(0,10)!==row.publishedAt.slice(0,10))throw new Error('Disclosure text identity, date or chunk count mismatch');
 return {page,pages:Number(r.page_size),text:r.notice_content,title:r.notice_title,attachmentUrl:r.attach_url||null};
}
function validateDisclosureTextSource(source) {
 if(source?.scheme!=='official-disclosure-text-v1'||!/^AN\d+$/.test(source.id||'')||source.pageBasis!=='source-text-chunk'||
   !/^\d{4}-\d{2}-\d{2}/.test(source.publishedAt||'')||!source.title||!Array.isArray(source.chunks)||!source.chunks.length||source.chunks.length>300||
   source.hash!==hash(JSON.stringify(source.chunks))||source.url!==textUrl(source.id,1))throw new Error('Unverified complete disclosure text source');
 for(let i=0;i<source.chunks.length;i++) {
   const chunk=source.chunks[i];
   if(chunk.url!==textUrl(source.id,i+1)||!/^[a-f0-9]{64}$/.test(chunk.hash||'')||!/^[a-f0-9]{64}$/.test(chunk.textSha256||'')||!Number.isFinite(Date.parse(chunk.fetchedAt)))throw new Error('Incomplete disclosure text provenance');
 }
 return source;
}
async function collectDisclosureText(row,load) {
 if(!/^AN\d+$/.test(row.id||'')||!row.title||!/^\d{4}-\d{2}-\d{2}/.test(row.publishedAt||''))throw new Error('Invalid disclosure text request');
 const first=await load(textUrl(row.id,1),body=>parseDisclosureChunk(body,row,1),'https://fund.eastmoney.com/');
 const values=[first];
 for(let page=2;page<=first.value.pages;page++){
   const next=await load(textUrl(row.id,page),body=>parseDisclosureChunk(body,row,page),'https://fund.eastmoney.com/');
   if(next.value.pages!==first.value.pages)throw new Error('Disclosure text changed during pagination');values.push(next);
 }
 if(new Set(values.map(v=>hash(v.value.text))).size!==values.length)throw new Error('Repeated disclosure text chunk; incomplete source');
 const chunks=values.map(v=>({...v.source,textSha256:hash(v.value.text)}));
 const source=validateDisclosureTextSource({scheme:'official-disclosure-text-v1',id:row.id,title:row.title,publishedAt:row.publishedAt,
   url:textUrl(row.id,1),hash:hash(JSON.stringify(chunks)),pageBasis:'source-text-chunk',attachmentUrl:first.value.attachmentUrl,chunks});
 return {document:{pages:values.map(v=>({page:v.value.page,text:v.value.text})),textSourceHash:source.hash},source};
}
function createDisclosureTextFetch({fetchImpl=fetch,httpsGet=require('node:https').get}={}){
 return async(url,options={})=>{
  try{return await fetchImpl(url,options);}catch(original){
   if(options.signal?.aborted)throw original;
   return new Promise((resolve,reject)=>{
    const request=httpsGet(url,{agent:false,family:4,headers:options.headers,signal:options.signal},response=>{
     const chunks=[];let length=0;
     response.on('data',chunk=>{length+=chunk.length;if(length>20*1024*1024){request.destroy();reject(new Error('Oversized official disclosure text'));}else chunks.push(chunk);});
     response.on('error',reject);response.on('end',()=>{
      try{let body=Buffer.concat(chunks);const encoding=response.headers['content-encoding'];
       if(encoding==='gzip')body=require('node:zlib').gunzipSync(body);else if(encoding==='deflate')body=require('node:zlib').inflateSync(body);else if(encoding==='br')body=require('node:zlib').brotliDecompressSync(body);
       const headers={...response.headers};delete headers['content-encoding'];delete headers['content-length'];
       resolve(new Response(body,{status:response.statusCode,headers}));
      }catch(error){reject(error);}
     });
    });
    request.setTimeout(30000,()=>request.destroy(new Error('Official disclosure HTTPS timeout')));request.on('error',reject);
   });
  }
 };
}
async function readDisclosureText(row,{directory,load,cacheOnly=false,refresh=false}) {
 fs.mkdirSync(directory,{recursive:true});const file=path.join(directory,row.id+'.complete.json');
 if(!refresh&&fs.existsSync(file)){
   const cached=JSON.parse(fs.readFileSync(file,'utf8'));validateDisclosureTextSource(cached.source);
   if(cached.source.id!==row.id||normalize(cached.source.title)!==normalize(row.title)||cached.source.publishedAt.slice(0,10)!==row.publishedAt.slice(0,10)||cached.document.textSourceHash!==cached.source.hash||cached.document.pages?.length!==cached.source.chunks.length||
     cached.document.pages.some((p,i)=>p.page!==i+1||hash(p.text)!==cached.source.chunks[i].textSha256))throw new Error('Disclosure text cache checksum mismatch');
   return cached;
 }
 if(cacheOnly)throw new Error('Complete disclosure text not in local cache');
 const result=await collectDisclosureText(row,load);const tmp=file+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(result));fs.renameSync(tmp,file);return result;
}
module.exports={textUrl,parseDisclosureMetadata,parseDisclosureChunk,validateDisclosureTextSource,collectDisclosureText,readDisclosureText,createDisclosureTextFetch};
