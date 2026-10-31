'use strict';
const crypto=require('node:crypto');
const {parseCompleteReportPdf}=require('./fund-report-pdf-evidence');
const {reportIdentity}=require('./fund-report-evidence');
const hash=t=>crypto.createHash('sha256').update(t).digest('hex');
function parseReportHoldings(document,request,source) {
 const identity=parseCompleteReportPdf(document,request);
 const text=document.pages.map(p=>p.text).join('\n').normalize('NFKC');
 const start=text.search(/报告期末基金资产组合情况/);
 if(start<0)return null;
 const composition=text.slice(start,start+4500);
 const stock=composition.match(/其中[:：]?\s*股票\s+([\d,]+\.\d{2}|-)\s+([\d.]+|-)/);
 if(!stock)return null;
 const total=stock[1]==='-'?0:Number(stock[1].replaceAll(',',''));
 const heading=/\d+\.\d+\s*报告期末按公允价值占基金资产净值比例大小排序的前十名股票投资明细/g;
 for(const match of text.matchAll(heading)){
  const after=text.slice(match.index+match[0].length);
  const end=after.search(/\d+\.\d+\s*报告期末按债券品种分类的债券投资组合/);
  if(end<0)continue;
  const section=after.slice(0,end);
  if(section.length>18000)continue;
  const rows=[];
  const pattern=/^\s*(\d{1,2})\s+(\d{5,6})\s+(.+?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+\.\d{2})\s+(\d+(?:\.\d+)?)\s*$/gm;
  for(const m of section.matchAll(pattern)){
   rows.push({rank:Number(m[1]),stockCode:m[2],stockName:m[3].replace(/\s+/g,''),shares10k:Number(m[4].replaceAll(',',''))/10000,
    marketValue10kCny:Number(m[5].replaceAll(',',''))/10000,netValueRatio:Number(m[6]),
    market:/^(?:[03468]\d{5}|92\d{4})$/.test(m[2])?'mainland-A':'non-A'});
  }
  const zero=rows.length===0&&total===0&&/本基金(?:本报告期末|报告期末|期末)未持有股票/.test(section.replace(/\s+/g,''));
  if(!zero&&(!rows.length||rows.length>10||rows.some((r,i)=>r.rank!==i+1||r.marketValue10kCny<=0)||new Set(rows.map(r=>r.stockCode)).size!==rows.length))continue;
  const sum=rows.reduce((n,r)=>n+r.marketValue10kCny*10000,0);
  // A short table is complete only when it accounts for the report's entire stock portfolio.
  if(rows.length<10&&Math.abs(sum-total)>0.05||rows.length===10&&sum>total+0.05)continue;
  const quote=stock[0]+'\n'+match[0]+'\n'+section;
  const proof={fundCode:request.fundCode,quarter:request.quarter,productName:identity.productName,id:request.id,
   reportDate:require('./fund-contract-evidence').quarterEnd(request.quarter),rows,stockValueCny:total,
   quote,quoteSha256:hash(quote),documentSha256:document.pdfSha256,
   source:{...source,scheme:'complete-quarter-report-holdings-v1'}};
  return validateReportHoldings(proof);
 }
 return null;
}
function validateReportHoldings(e) {
 const identity=reportIdentity(e?.source?.title);
 if(e?.source?.scheme!=='complete-quarter-report-holdings-v1'||!/^\d{6}$/.test(e.fundCode||'')||!identity||identity.quarter!==e.quarter||identity.productName!==e.productName||e.source.id!==e.id||
  !new RegExp('^https://pdf[.]dfcfw[.]com/pdf/H[0-9]{1,2}_'+e.id+'_1[.]pdf$').test(e.source.url||'')||!/^AN\d+$/.test(e.id)||
  !/^[a-f0-9]{64}$/.test(e.documentSha256||'')||e.source.hash!==e.documentSha256||!Number.isFinite(Date.parse(e.source.downloadedAt))||
  e.quoteSha256!==hash(e.quote||'')||!Number.isFinite(e.stockValueCny)||e.stockValueCny<0||!Array.isArray(e.rows)||e.rows.length>10||
  e.reportDate!==require('./fund-contract-evidence').quarterEnd(e.quarter)||new Set(e.rows.map(r=>r.stockCode)).size!==e.rows.length||
  e.rows.some((r,i)=>r.rank!==i+1||!/^\d{5,6}$/.test(r.stockCode)||!Number.isFinite(r.marketValue10kCny)||r.marketValue10kCny<=0)||
  (e.rows.length<10&&Math.abs(e.rows.reduce((n,r)=>n+r.marketValue10kCny*10000,0)-e.stockValueCny)>0.05))throw new Error('Unverified complete-report stock holdings');
 return e;
}
module.exports={parseReportHoldings,validateReportHoldings};
