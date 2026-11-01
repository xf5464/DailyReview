'use strict';
const path=require('node:path'),fs=require('node:fs');
const {createSourceCache}=require('./source-response-cache');
const directory=process.env.DAILY_REVIEW_SOURCE_CACHE||path.join(__dirname,'../.cache/source-responses');
globalThis.fetch=createSourceCache({directory,onRequest:event=>{
 fs.mkdirSync(directory,{recursive:true});
 fs.appendFileSync(path.join(directory,'requests-'+process.pid+'.jsonl'),JSON.stringify({at:new Date().toISOString(),...event})+'\n');
}});
