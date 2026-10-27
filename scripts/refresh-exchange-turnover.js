const {queryExchangeTurnover} = require('./exchange-turnover');
(async () => {
  for (const market of ['sh','sz']) {
    const result = await queryExchangeTurnover(market,{persist:true});
    console.log(market,result.items.length,result.items.at(-1),result.stale ? 'cached' : 'refreshed');
  }
})().catch(error => { console.error(error); process.exitCode=1; });
