'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
// Validators save bandwidth without guessing that a dated report is immutable.
function createSourceCache({directory,fetchImpl=globalThis.fetch,onRequest=()=>{}}){
 const failures=new Map();
 return async function cachedFetch(input,options={}){
  const request=new Request(input,options),headers=new Headers(request.headers);
  const url=new URL(request.url);
  if(request.method!=='GET'||headers.has('authorization')||headers.has('cookie')||headers.has('range')||headers.has('if-none-match')||headers.has('if-modified-since')||url.username||url.password||[...url.searchParams.keys()].some(k=>/^(api[_-]?key|access_token|password|secret)$/i.test(k))||request.cache==='no-store')return fetchImpl(input,options);
  const key=hash(JSON.stringify([request.url,[...headers].sort()])),file=path.join(directory,key+'.json');
  // Abort signals belong to each caller; never coalesce independently cancellable requests.
  let old;try{old=JSON.parse(fs.readFileSync(file,'utf8'));if(old.url!==request.url||hash(Buffer.from(old.body,'base64'))!==old.hash)old=null;}catch{}
  if(old&&/^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[a-f0-9]{40}\//.test(request.url)){
   onRequest({url:request.url,mode:'immutable',bytes:0});
   return new Response(Buffer.from(old.body,'base64'),{status:200,headers:old.headers});
  }
  if(old?.etag)headers.set('If-None-Match',old.etag);
  if(old?.lastModified)headers.set('If-Modified-Since',old.lastModified);
  if((failures.get(url.origin)||0)>=3){const error=new Error('Source temporarily unavailable: '+url.origin);error.retryable=false;throw error;}
  let response;
  try{
   response=await fetchImpl(input,{...options,headers,signal:AbortSignal.any([request.signal,AbortSignal.timeout(30000)])});
  }catch(error){if(request.signal.aborted&&request.signal.reason?.name!=='TimeoutError')throw error;failures.set(url.origin,(failures.get(url.origin)||0)+1);onRequest({url:request.url,mode:'failed',bytes:0});throw error;}
  if([429,502,503,504].includes(response.status))failures.set(url.origin,(failures.get(url.origin)||0)+1);
  else if(!response.ok||response.status===304)failures.set(url.origin,0);
  if(response.status===304){
   if(!old)throw Error('Source returned 304 without a verified local body');
   onRequest({url:request.url,mode:'not-modified',bytes:0});
   return new Response(Buffer.from(old.body,'base64'),{status:200,headers:old.headers});
  }
  if(!response.ok){onRequest({url:request.url,mode:'failed',bytes:0,status:response.status});return response;}
  let bytes;
  try{bytes=Buffer.from(await response.clone().arrayBuffer());}
  catch(error){failures.set(url.origin,(failures.get(url.origin)||0)+1);onRequest({url:request.url,mode:'failed',bytes:0});throw error;}
  failures.set(url.origin,0);
  const mode=old?'changed-file':'baseline';
  onRequest({url:request.url,mode,bytes:bytes.length,conditional:Boolean(old?.etag||old?.lastModified)});
  if(bytes.length<=32*1024*1024&&!/no-store/i.test(response.headers.get('cache-control')||'')&&!response.headers.has('set-cookie')&&response.headers.get('vary')!=='*'){
   const record={url:request.url,hash:hash(bytes),body:bytes.toString('base64'),headers:[...response.headers].filter(([name])=>!['content-encoding','content-length','transfer-encoding'].includes(name)),etag:response.headers.get('etag'),lastModified:response.headers.get('last-modified')};
   fs.mkdirSync(directory,{recursive:true});const tmp=file+'.'+crypto.randomUUID()+'.tmp';
   fs.writeFileSync(tmp,JSON.stringify(record));fs.renameSync(tmp,file);
  }
  return response;
 };
}
module.exports={createSourceCache};
