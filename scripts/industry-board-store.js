'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function validate(row){
 if(!/^BK\d{4}$/.test(row.code)||!/^\d{4}-\d{2}-\d{2}$/.test(row.verifiedThrough)||!Array.isArray(row.points)||!row.points.length)throw Error('Invalid industry checkpoint');
 let last='';for(const p of row.points){if(!Array.isArray(p)||p.length!==3||!/^\d{4}-\d{2}-\d{2}$/.test(p[0])||p[0]<=last||p[0]>row.verifiedThrough||!Number.isFinite(p[1])||p[1]<=0||!Number.isFinite(p[2])||p[2]<=0)throw Error('Invalid industry observations');last=p[0];}
 return row;
}
function createIndustryStore({seedDirectory=path.join(__dirname,'data/industry-baseline'),directory=path.join(__dirname,'../.cache/industry-boards')}={}){
 const manifest=JSON.parse(fs.readFileSync(path.join(seedDirectory,'manifest.json'),'utf8'));
 if(manifest.schemaVersion!==1||manifest.boards.length!==86||new Set(manifest.boards.map(b=>b.code)).size!==86)throw Error('Incomplete industry baseline');
 const baseline=new Map(manifest.boards.map(meta=>{if(!/^BK\d{4}$/.test(meta.code))throw Error('Invalid board code');const bytes=fs.readFileSync(path.join(seedDirectory,meta.code+'.json.gz'));if(hash(bytes)!==meta.hash)throw Error('Industry baseline checksum mismatch');const row=validate(JSON.parse(zlib.gunzipSync(bytes)));if(row.code!==meta.code||row.verifiedThrough!==manifest.verifiedThrough)throw Error('Industry baseline identity mismatch');return [row.code,row];}));
 const get=code=>{let row=baseline.get(code);if(!row)throw Error('Unknown industry');try{const p=JSON.parse(fs.readFileSync(path.join(directory,code+'.json'),'utf8'));if(p.hash!==hash(JSON.stringify(p.row)))throw Error('Industry checkpoint checksum mismatch');validate(p.row);if(p.row.code!==code)throw Error('Industry checkpoint identity mismatch');if(p.row.verifiedThrough>row.verifiedThrough)row=p.row;}catch(error){if(error.code!=='ENOENT')throw error;}return row;};
 return {boards:manifest.boards.map(({code,name})=>({code,name})),baseline:[...baseline.values()],
 read(code,endDate){const row=get(code);return row.verifiedThrough>=endDate?row:null;},
 save(board,points,endDate,source){const row=validate({code:board.code,name:board.name,verifiedThrough:endDate,points,sourceUrl:source.url,sourceHash:hash(source.text)});fs.mkdirSync(directory,{recursive:true});const file=path.join(directory,board.code+'.json'),tmp=file+'.'+crypto.randomUUID()+'.tmp';fs.writeFileSync(tmp,JSON.stringify({hash:hash(JSON.stringify(row)),row}));fs.renameSync(tmp,file);}
 };
}
module.exports={createIndustryStore,validate};
