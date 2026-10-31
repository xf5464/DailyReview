'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {parallel}=require('./collect-fund-crowding-sources');
const {readDisclosurePdf}=require('./fund-contract-evidence');
const {parseReportPage}=require('./fund-report-evidence');
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
    const currency=/单位[\s：:]*人民币元/.test(text.slice(Math.max(0,start-4500),start));
    if(currency && values.length && values.every(n=>Number.isFinite(n)&&n>=0)){
      result.navTotal10kCny=values.reduce((a,b)=>a+b,0)/10000;
      result.navClassValuesCny=values;result.currencyConfirmed=true;
      result.navEvidence={text:section,fromLabel:'期末基金资产净值',toLabel:'期末基金份额净值'};
    }
  }
  const compact=text.normalize('NFKC').replace(/\s+/g,'');
  const hierarchyCodes=(request.fundCodes||[request.fundCode]).filter(code=>compact.includes(code));
  const structuredShareHierarchyVerified=/分级/.test(result.productName)&&/下属分级基金/.test(compact)&&!!result.mainFundCode&&hierarchyCodes.includes(result.mainFundCode)&&hierarchyCodes.length>1&&result.navClassValuesCny?.length===1&&Number.isFinite(result.navTotal10kCny);
  return {...result,reportParserVersion:2,structuredShareHierarchyVerified,hierarchyCodes,pdfPages:document.pages.length,documentSha256:document.pdfSha256,extractionMethod:'complete-PDF-layout'};
}
async function main(args=process.argv.slice(2)) {
  const get=flag=>{const i=args.indexOf(flag);return i<0?null:args[i+1];};
  if(!get('--requests')||!get('--output'))throw new Error('Usage: --requests quarterly-report-requests.json --output work/pdf-report-evidence.json --python python');
  const requests=JSON.parse(fs.readFileSync(get('--requests'),'utf8'));
  const rows=await parallel(requests,Number(get('--concurrency') || 4),async request=>{
    try{
      const result=await readDisclosurePdf({id:request.id,title:request.title,publishedAt:request.publishedAt},
        {directory:path.resolve(get('--cache') || 'work/quarter-report-pdfs'),python:get('--python')||'python',extractionMode:'layout'});
      const evidence=parseCompleteReportPdf(result.document,request);
      console.error(JSON.stringify({fundCode:request.fundCode,quarter:request.quarter,nav:evidence.navTotal10kCny}));
      const holdings=require('./fund-report-holdings').parseReportHoldings(result.document,request,result.source);
      return {...request,evidence:{...evidence,source:result.source},holdings};
    }catch(error){return {...request,error:error.message};}
  });
  const byCode=new Map();
  for(const row of rows){
    if(!byCode.has(row.fundCode))byCode.set(row.fundCode,{fundCode:row.fundCode,reports:[]});
    const identity=require('./fund-report-evidence').classifyReportTitle(row.title);
    byCode.get(row.fundCode).reports.push({fundCode:row.fundCode,id:row.id,title:row.title,
      publishedAt:row.publishedAt,classification:identity,...(row.evidence?{evidence:row.evidence}:{contentError:row.error})});
  }
  const output={schemaVersion:1,source:'Complete original quarterly report PDFs',preparedAt:new Date().toISOString(),histories:[...byCode.values()],holdingsEvidence:rows.map(r=>r.holdings).filter(Boolean)};
  const file=path.resolve(get('--output'));fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(output)+'\n');
  console.log(JSON.stringify({requests:rows.length,navConfirmed:rows.filter(r=>Number.isFinite(r.evidence?.navTotal10kCny)).length,errors:rows.filter(r=>r.error).length}));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={parseCompleteReportPdf,main};
