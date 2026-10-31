'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {parallel}=require('./collect-fund-crowding-sources');
const {readDisclosurePdf}=require('./fund-contract-evidence');
const {parseReportPage,pacedContentFetch}=require('./fund-report-evidence');
const {sourceFetch}=require('./collect-fund-crowding-sources');
const {readDisclosureText,validateDisclosureTextSource,createDisclosureTextFetch}=require('./fund-disclosure-text');
const crypto=require('node:crypto');
function parseCompleteReportPdf(document,request) {
  if(!Array.isArray(document?.pages) || !document.pages.length)throw new Error('Missing complete quarterly report PDF');
  const text=document.pages.map(p=>p.text.split(/\r?\n/).map(line=>line.replace(/[ \t]{2,}/g,'  ').trim()).join('\n')).join('\n');
  const result=parseReportPage({success:1,data:{art_code:request.id,notice_title:request.title,
    notice_content:text,notice_date:request.publishedAt,page_size:1,
    security:(request.fundCodes || [request.fundCode]).map(stock=>({stock}))}},
    {fundCode:request.fundCode,id:request.id,quarter:request.quarter});
  const row4=text.match(/4[.、．]\s*期末基金资产(?:\s*净值)?/);
  const start=row4?row4.index:text.indexOf('期末基金资产净值');
  const row5=start>=0?text.slice(start).match(/5[.、．]\s*期末基金份额(?:\s*净值)?/):null;
  const end=row5?start+row5.index:start>=0?text.indexOf('期末基金份额净值',start):-1;
  const section=start>=0&&end>start?text.slice(start+(row4?row4[0].length:'期末基金资产净值'.length),end):null;
  if(section && section.length<2000) {
    const values=[...section.matchAll(/(?<![\d.])[\d,]+\.\d{2}(?!\d)/g)].map(m=>Number(m[0].replaceAll(',','')));
    const currency=/单\s*位[\s：:]*人\s*民\s*币\s*元/.test(text.slice(Math.max(0,start-4500),start));
    if(currency && values.length && values.every(n=>Number.isFinite(n)&&n>=0)){
      result.navTotal10kCny=values.reduce((a,b)=>a+b,0)/10000;
      result.navClassValuesCny=values;result.currencyConfirmed=true;
      result.navEvidence={text:section,fromLabel:'期末基金资产净值',toLabel:'期末基金份额净值'};
    }
  }
  const compact=text.normalize('NFKC').replace(/\s+/g,'');
  const overviewStart=compact.indexOf('基金简称'),overviewEnd=compact.indexOf('主要财务指标',overviewStart);
  const overview=overviewStart>=0&&overviewEnd>overviewStart?compact.slice(overviewStart,overviewEnd):'';
  const codeChanges=[...overview.matchAll(/本基金的(?:基金|交易)?代码由(\d{6})(?:变更|修改|调整)为(\d{6})/g)].filter(m=>m[2]===result.mainFundCode).map(m=>({from:m[1],to:m[2],quote:m[0]}));
  const reportedFundCodes=[...new Set([...overview.matchAll(/(?:基金主代码|交易代码|基金代码)((?:\d{6})+)/g)].flatMap(m=>m[1].match(/\d{6}/g)).concat(codeChanges.flatMap(c=>[c.from,c.to])))].sort();
  const tradingLines=[...text.matchAll(/(?:^|\n)\s*交易代码[ \t|：:]+(\d{6})(?=[ \t]*(?:\n|$))/g)].map(m=>m[1]);
  if(!result.mainFundCode&&reportedFundCodes.length===1&&!/下属/.test(overview)&&tradingLines.includes(reportedFundCodes[0])){
    result.mainFundCode=reportedFundCodes[0];result.productId='main-code:'+result.mainFundCode;
    result.mainCodeBasis='single-overview-trading-code';
  }
  const reportCodeBindingComplete=!!result.mainFundCode&&reportedFundCodes.includes(result.mainFundCode)&&(!/下属/.test(overview)||/交易代码(?:\d{6})+/.test(overview));
  const hierarchyCodes=(request.fundCodes||[request.fundCode]).filter(code=>compact.includes(code));
  const structuredShareHierarchyVerified=/分级/.test(result.productName)&&/下属分级基金/.test(compact)&&!!result.mainFundCode&&hierarchyCodes.includes(result.mainFundCode)&&hierarchyCodes.length>1&&result.navClassValuesCny?.length===1&&Number.isFinite(result.navTotal10kCny);
  return {...result,codeChanges,reportedFundCodes,reportCodeBindingComplete,reportParserVersion:2,structuredShareHierarchyVerified,hierarchyCodes,pdfPages:document.pages.length,documentSha256:document.pdfSha256,extractionMethod:'complete-PDF-layout'};
}
function parseOfficialReportText(result,request){
 validateDisclosureTextSource(result.source);
 const {document,source}=result;
 const normalize=value=>String(value||'').normalize('NFKC').replace(/\s+/g,'');
 if(source.id!==request.id||normalize(source.title)!==normalize(request.title)||source.publishedAt.slice(0,10)!==request.publishedAt.slice(0,10))throw new Error('Official report text announcement identity mismatch');
 if(document.textSourceHash!==source.hash||document.pages?.length!==source.chunks.length||document.pages.some((p,i)=>p.page!==i+1||crypto.createHash('sha256').update(p.text).digest('hex')!==source.chunks[i].textSha256))throw new Error('Official report text checksum mismatch');
 const evidence=parseCompleteReportPdf(document,request),expected=request.fundCodes||[request.fundCode];
 const owner=evidence.reportedFundCodes.includes(request.fundCode)?request.fundCode:expected.find(c=>evidence.reportedFundCodes.includes(c));
 if(!owner)throw new Error('Official report overview belongs to a different fund code');
 return {...evidence,fundCode:owner,associatedFundCodes:evidence.reportedFundCodes.filter(c=>expected.includes(c)),
   reportCodeBindingComplete:false,structuredShareHierarchyVerified:false,documentSha256:undefined,pdfPages:undefined,
   extractionMethod:'complete-official-disclosure-text',textSourceHash:source.hash,textChunks:source.chunks.length,contentPages:source.chunks.length,
   source:{...source,downloadedAt:source.chunks.at(-1).fetchedAt}};
}
async function main(args=process.argv.slice(2)) {
  const get=flag=>{const i=args.indexOf(flag);return i<0?null:args[i+1];};
  if(!get('--requests')||!get('--output'))throw new Error('Usage: --requests quarterly-report-requests.json --output work/pdf-report-evidence.json --python python');
  const requests=JSON.parse(fs.readFileSync(get('--requests'),'utf8'));
  const textDirectory=path.join(path.resolve(get('--cache') || 'work/quarter-report-pdfs'),'official-text');
  const textLoad=sourceFetch(path.join(textDirectory,'raw'),{fetchImpl:pacedContentFetch({fetchImpl:createDisclosureTextFetch()})});
  const rows=await parallel(requests,Number(get('--concurrency') || 4),async request=>{
    try{
      const result=await readDisclosurePdf({id:request.id,title:request.title,publishedAt:request.publishedAt},
        {directory:path.resolve(get('--cache') || 'work/quarter-report-pdfs'),python:get('--python')||'python',extractionMode:'layout'});
      let evidence=parseCompleteReportPdf(result.document,request);
      if(evidence.reportCodeBindingComplete){request={...request,fundCode:evidence.reportedFundCodes.includes(request.fundCode)?request.fundCode:evidence.mainFundCode,fundCodes:evidence.reportedFundCodes};evidence=parseCompleteReportPdf(result.document,request);}
      if(args.includes('--require-nav')&&!Number.isFinite(evidence.navTotal10kCny)&&evidence.classification.status!=='excluded'){
        try{
          const textResult=await readDisclosureText(request,{directory:textDirectory,load:textLoad}),textEvidence=parseOfficialReportText(textResult,request);
          if(Number.isFinite(textEvidence.navTotal10kCny)||textEvidence.classification.status==='excluded')return {...request,fundCode:textEvidence.fundCode,evidence:textEvidence};
          evidence.navRecoveryError='No unambiguous CNY NAV in complete official text';
        }catch(error){evidence.navRecoveryError=error.message;}
      }
      console.error(JSON.stringify({fundCode:request.fundCode,quarter:request.quarter,nav:evidence.navTotal10kCny}));
      const holdings=require('./fund-report-holdings').parseReportHoldings(result.document,request,result.source);
      return {...request,evidence:{...evidence,source:result.source},holdings};
    }catch(error){
      try{
        const result=await readDisclosureText(request,{directory:textDirectory,load:textLoad});
        const evidence=parseOfficialReportText(result,request);
        console.error(JSON.stringify({fundCode:evidence.fundCode,quarter:request.quarter,source:'complete-official-text',nav:evidence.navTotal10kCny}));
        return {...request,fundCode:evidence.fundCode,evidence,pdfRecoveryReason:error.message};
      }catch(fallback){return {...request,error:error.message+'; official text: '+fallback.message};}
    }
  });
  const byCode=new Map();
  for(const row of rows){
    if(!byCode.has(row.fundCode))byCode.set(row.fundCode,{fundCode:row.fundCode,reports:[]});
    const identity=require('./fund-report-evidence').classifyReportTitle(row.title);
    byCode.get(row.fundCode).reports.push({fundCode:row.fundCode,id:row.id,title:row.title,
      publishedAt:row.publishedAt,classification:identity,...(row.evidence?{evidence:row.evidence}:{contentError:row.error})});
  }
  const output={schemaVersion:1,source:'Original quarterly PDFs with fully paginated official-text recovery',preparedAt:new Date().toISOString(),histories:[...byCode.values()],holdingsEvidence:rows.map(r=>r.holdings).filter(Boolean)};
  const file=path.resolve(get('--output'));fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(output)+'\n');
  console.log(JSON.stringify({requests:rows.length,navConfirmed:rows.filter(r=>Number.isFinite(r.evidence?.navTotal10kCny)).length,errors:rows.filter(r=>r.error).length}));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={parseCompleteReportPdf,parseOfficialReportText,main};
