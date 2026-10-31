'use strict';
const crypto=require('node:crypto');
function parseEM2016Industry(profile,stockCode) {
  if(!/^\d{6}$/.test(stockCode))throw new Error('Expected a six-digit mainland stock code');
  const row=profile?.jbzl?.find(r=>r.SECURITY_CODE===stockCode);
  if(!row || typeof row.EM2016!=='string')throw new Error('Company archive does not identify the requested stock and taxonomy');
  const parts=row.EM2016.split('-').map(p=>p.trim());
  if(parts.length!==3 || parts.some(p=>!p))throw new Error('Incomplete official three-level industry path');
  return {stockCode,industry:parts[1],industryPath:row.EM2016,
    taxonomy:'eastmoney-level2',taxonomyVersion:'EM2016-level2',
    classificationBasis:'fixed-taxonomy-restatement'};
}
function buildFixedIndustryInputs(records,{asOf}={}) {
  if(!Array.isArray(records)||!records.length||!/^\d{4}-\d{2}-\d{2}$/.test(asOf || ''))throw new Error('Missing taxonomy records or compilation date');
  const fixedMap={},sources=[],catalogue=new Map();
  for(const record of records) {
    const code=record.stockCode,path=record.industryPath || record.oldPath,source=record.source || record.profileSource;
    if(!/^\d{6}$/.test(code) || typeof path!=='string' || !/^[a-f0-9]{64}$/.test(source?.hash || '') ||
      !source.url?.startsWith('https://emweb.securities.eastmoney.com/PC_HSF10/CompanySurvey/PageAjax?') ||
      new URL(source.url).searchParams.get('code')?.slice(2)!==code)throw new Error('Unverified direct company classification');
    const parts=path.split('-').map(p=>p.trim());
    if(parts.length!==3 || parts.some(p=>!p))throw new Error('Incomplete industry path');
    if(fixedMap[code] && fixedMap[code]!==parts[1])throw new Error('Conflicting direct company industries');
    fixedMap[code]=parts[1];sources.push({stockCode:code,path,source});
    if(catalogue.has(parts[1]) && catalogue.get(parts[1])!==parts[0])throw new Error('Ambiguous second-level industry across first-level parents');
    catalogue.set(parts[1],parts[0]);
  }
  return {schemaVersion:2,taxonomy:'eastmoney-level2',taxonomyVersion:'EM2016-level2',
    classificationBasis:'fixed-taxonomy-restatement',mappingVerified:true,asOf,
    historicalMappingVerified:false,reviewedAt:asOf,
    source:'Eastmoney company archives; second segment of the official EM2016 three-level path; fixed-taxonomy restatement',
    sourceDigest:crypto.createHash('sha256').update(JSON.stringify(sources)).digest('hex'),
    fixedMap,industryUniverse:[...catalogue.keys()].sort()};
}
async function collectFixedIndustries(codes,load,{concurrency=4,onProgress=()=>{}}={}) {
  if(!Array.isArray(codes)||!codes.length||new Set(codes).size!==codes.length||codes.some(c=>!/^\d{6}$/.test(c)))throw new Error('Expected unique mainland stock codes');
  const {parallel}=require('./collect-fund-crowding-sources');
  return parallel(codes,concurrency,async stockCode=>{
    const exchange=/^(?:[48]|92)/.test(stockCode)?'BJ':/^[569]/.test(stockCode)?'SH':'SZ';
    const url='https://emweb.securities.eastmoney.com/PC_HSF10/CompanySurvey/PageAjax?code='+exchange+stockCode;
    const response=await load(url,body=>parseEM2016Industry(JSON.parse(body),stockCode),'https://emweb.securities.eastmoney.com/');
    onProgress({stockCode,industry:response.value.industry});return {...response.value,source:response.source};
  });
}
async function main(args=process.argv.slice(2)) {
  const fs=require('node:fs'),path=require('node:path');
  const get=f=>{const i=args.indexOf(f);return i<0?null:args[i+1];};
  if(!get('--stocks')||!get('--output'))throw new Error('Usage: --stocks unique-mainland-stock-codes.json --output work/fixed-industries.json [--cache work/company-classifications]');
  const load=require('./collect-fund-crowding-sources').sourceFetch(path.resolve(get('--cache')||'work/company-classifications'));
  const records=await collectFixedIndustries(JSON.parse(fs.readFileSync(get('--stocks'),'utf8')),load,{concurrency:Number(get('--concurrency')||4),onProgress:e=>console.error(JSON.stringify(e))});
  const output=buildFixedIndustryInputs(records,{asOf:get('--as-of')||new Date().toISOString().slice(0,10)});
  const file=path.resolve(get('--output'));fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(output));
  console.log(JSON.stringify({stocks:records.length,industries:output.industryUniverse.length}));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={parseEM2016Industry,buildFixedIndustryInputs,collectFixedIndustries,main};
