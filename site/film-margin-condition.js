(function () {
  'use strict';

  function threshold(value) {
    var number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 2000;
  }

  function changes(items) {
    var byDate = new Map();
    (items || []).forEach(function (item) {
      if (item && /^\d{4}-\d{2}-\d{2}$/.test(item.date) && Number.isFinite(item.value) && item.value >= 0) {
        // The snapshot is in 亿元. Work in integer yuan to preserve exact threshold comparisons.
        byDate.set(item.date, Math.round(item.value * 100000000));
      }
    });
    var dates = Array.from(byDate.keys()).sort();
    return dates.slice(1).map(function (date, index) {
      var previousDate = dates[index];
      var signedChange = (byDate.get(date) - byDate.get(previousDate)) / 10000;
      return { date: date, previousDate: previousDate, value: Math.abs(signedChange), signedChange: signedChange };
    });
  }

  var condition = { threshold: threshold, changes: changes };
  if (typeof module === 'object' && module.exports) module.exports = condition;
  else window.filmMarginCondition = condition;
}());
