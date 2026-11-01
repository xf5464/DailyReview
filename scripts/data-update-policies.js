'use strict';
const groups={
 'dated-observations':'treasuryYield treasuryYield30 federalFundsRate bitcoin federalDebt jpyUsd naturalGas aShareTurnover aShareMarginBalance aShareSentimentThs ndx sp500 treasurySpread highYieldSpread broadDollar initialClaims financialConditions',
 'monthly-observations':'silver copper consumerConfidence unemploymentRate sahmRule',
 'derived-with-warmup':'cpi pce aShareActiveMarketValueThs',
 'series-and-file-revalidation':'gold brentOil wtiOil vix ismManufacturingPmi ismSupplierDeliveries ismNewOrders ismBacklogOrders',
 'industry-observations':'aShareIndustryConcentration',
 'exchange-observations':'shTurnoverRate szTurnoverRate',
 'matched-nav-and-price':'etfOfficialPremium159941',
 'report-or-snapshot-revalidation':'usEconomicCalendar centralBankGoldPurchases aShareNewAccountsThs filmCinemaShareholders etfPremium159941 nationalTeamWideEtf aSharePe',
 'bundled-snapshot':'nasdaq100Pe'
};
const policies=Object.fromEntries(Object.entries(groups).flatMap(([policy,ids])=>ids.split(' ').map(id=>[id,policy])));
function updateReport(charts,previous){return charts.map(chart=>{
 if(!policies[chart.id])throw Error('Missing incremental update policy: '+chart.id);
 const old=new Map((previous[chart.id]?.items||[]).map(item=>[item.date,item]));
 let added=0,revised=0;
 for(const item of chart.items||[]){const before=old.get(item.date);if(!before)added++;else if(JSON.stringify(before)!==JSON.stringify(item))revised++;}
 return {id:chart.id,policy:policies[chart.id],mode:chart.error?'unavailable':chart.dataFallback?'fallback':old.size?'incremental':'baseline',previousPoints:old.size,currentPoints:chart.items.length,added,revised};
});}
module.exports={policies,updateReport};
