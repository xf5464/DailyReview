(function(root,factory){
  'use strict';
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.DailyReviewFundCrowding=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function index(key){if(!/^\d{4}-Q[1-4]$/.test(key||''))throw new Error('Invalid quarter');return Number(key.slice(0,4))*4+Number(key.slice(-1))-1;}
  function quarterView(snapshot,key){
    var q=snapshot.quarters.find(function(q){return q.quarter===key;});
    if(!q)throw new Error('Quarter is not available');
    if(key===snapshot.latestQuarter)return {quarter:q,rows:snapshot.rows};
    var ix=index(key),prior=snapshot.quarters.find(function(p){return index(p.quarter)===ix-1;});
    var rows=snapshot.industries.map(function(name,column){
      var share=q.shares[column];if(!Number.isFinite(share))return null;
      var points=snapshot.quarters.filter(function(p){return index(p.quarter)<=ix&&Number.isFinite(p.shares[column]);});
      var percentiles={};[4,12,20,40].forEach(function(n){
        var window=points.filter(function(p){return index(p.quarter)>=ix-n;});
        var complete=window.length===n+1&&window.every(function(p,i){return index(p.quarter)===ix-n+i;});
        var variable=snapshot.calculationVersion!==3||window.some(function(p){return Math.abs(p.shares[column]-share)>1e-12;});
        percentiles[n]=complete&&variable?100*window.filter(function(p){return p.shares[column]<=share;}).length/window.length:null;
      });
      return {industry:name,share:share,quarterChange:prior&&Number.isFinite(prior.shares[column])?share-prior.shares[column]:null,percentiles:percentiles};
    }).filter(Boolean).sort(function(a,b){return (b.percentiles[40]===null?-1:b.percentiles[40])-(a.percentiles[40]===null?-1:a.percentiles[40])||b.share-a.share;});
    return {quarter:q,rows:rows};
  }
  return {quarterView:quarterView};
});
