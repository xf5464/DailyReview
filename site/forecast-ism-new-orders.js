(function () {
  'use strict';

  var config = window.__ISM_NEW_ORDERS_FORECAST_CONFIG__ || { dropThreshold: 10 };
  var latestState = null;

  function number(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  config = { dropThreshold: number(config.dropThreshold, 10) };

  function compute(items) {
    var series = (Array.isArray(items) ? items : [])
      .map(function (item) { return { date: String(item.date || ''), value: Number(item.value) }; })
      .filter(function (item) { return item.date && Number.isFinite(item.value); })
      .sort(function (left, right) { return left.date.localeCompare(right.date); });
    if (series.length < 2) return { available: false };

    var previous = series[series.length - 2];
    var latest = series[series.length - 1];
    if (!(previous.value > 0)) return { available: false };
    var dropPercent = (previous.value - latest.value) / previous.value * 100;
    return {
      available: true,
      latest: latest,
      previous: previous,
      dropPercent: dropPercent,
      below50: latest.value < 50,
      reached: latest.value < 50 && dropPercent >= config.dropThreshold
    };
  }

  function ensureSection() {
    var existing = document.querySelector('#forecastIsmNewOrdersCondition');
    if (existing) return existing;
    var gold = document.querySelector('#forecastCentralBankGoldCondition');
    var sahm = document.querySelector('#forecastSahmCondition');
    var anchor = gold || sahm;
    if (!anchor) return null;

    var section = document.createElement('section');
    section.className = 'forecast-condition';
    section.id = 'forecastIsmNewOrdersCondition';
    section.innerHTML = '' +
      '<div class="forecast-condition-heading">' +
        '<div>' +
          '<div class="forecast-condition-title-row">' +
            '<h3>ISM 新订单快速恶化</h3>' +
            '<span class="overall-detail-help forecast-help">' +
              '<button class="overall-detail-help-button" type="button" aria-label="查看 ISM 新订单快速恶化说明" aria-expanded="false">?</button>' +
              '<span class="overall-detail-help-tooltip" role="tooltip">当 ISM 制造业新订单指数低于 50，且较上个月下降达到设定百分比时触发。默认下降阈值为 10%。</span>' +
            '</span>' +
          '</div>' +
          '<p id="forecastIsmNewOrdersDetail">正在读取 ISM 新订单...</p>' +
        '</div>' +
        '<span class="forecast-status" id="forecastIsmNewOrdersStatus">等待数据</span>' +
      '</div>' +
      '<div class="forecast-ism-metrics">' +
        '<div><span>上月</span><strong id="forecastIsmNewOrdersPrevious">--</strong></div>' +
        '<div><span>本月</span><strong id="forecastIsmNewOrdersLatest">--</strong></div>' +
        '<div><span>环比下降</span><strong id="forecastIsmNewOrdersDrop">--</strong></div>' +
        '<div><span>低于 50</span><strong id="forecastIsmNewOrdersBelow50">--</strong></div>' +
      '</div>' +
      '<p class="forecast-ism-rule" id="forecastIsmNewOrdersRule"></p>';
    anchor.insertAdjacentElement('afterend', section);

    var style = document.createElement('style');
    style.textContent = '' +
      '.forecast-ism-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px}' +
      '.forecast-ism-metrics>div{padding:10px;border:1px solid #e4eaf3;border-radius:8px;background:#f8fbff;text-align:center}' +
      '.forecast-ism-metrics span{display:block;color:#657089;font-size:11px;font-weight:700}' +
      '.forecast-ism-metrics strong{display:block;margin-top:4px;color:#172033;font-size:14px}' +
      '.forecast-ism-rule{margin:10px 0 0;color:#657089;font-size:12px;line-height:1.5}' +
      '@media(max-width:680px){.forecast-ism-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}';
    document.head.append(style);
    return section;
  }

  function applySummaryOverride() {
    var summary = document.querySelector('#forecastSummary');
    if (!summary || !latestState || !latestState.reached) return;
    var strong = summary.querySelector('strong');
    summary.classList.add('is-reached');
    if (strong && strong.textContent !== '已有条件达到') strong.textContent = '已有条件达到';
  }

  function render(state) {
    latestState = state;
    var section = ensureSection();
    if (!section) return;
    var status = document.querySelector('#forecastIsmNewOrdersStatus');
    var detail = document.querySelector('#forecastIsmNewOrdersDetail');
    var previous = document.querySelector('#forecastIsmNewOrdersPrevious');
    var latest = document.querySelector('#forecastIsmNewOrdersLatest');
    var drop = document.querySelector('#forecastIsmNewOrdersDrop');
    var below50 = document.querySelector('#forecastIsmNewOrdersBelow50');
    var rule = document.querySelector('#forecastIsmNewOrdersRule');

    rule.textContent = '规则：ISM 新订单 < 50，且较上个月下降 ≥ ' + config.dropThreshold + '%。';

    if (!state.available) {
      status.textContent = '暂无数据';
      status.classList.remove('is-reached');
      detail.textContent = '当前数据不足，暂时无法判断。';
      previous.textContent = '--';
      latest.textContent = '--';
      drop.textContent = '--';
      below50.textContent = '--';
      return;
    }

    status.textContent = state.reached ? '已触发' : '未触发';
    status.classList.toggle('is-reached', state.reached);
    previous.textContent = state.previous.value.toFixed(1);
    latest.textContent = state.latest.value.toFixed(1);
    drop.textContent = (state.dropPercent >= 0 ? '' : '+') + (-state.dropPercent).toFixed(1) + '%';
    below50.textContent = state.below50 ? '是' : '否';
    detail.textContent = 'ISM 新订单由 ' + state.previous.value.toFixed(1) + ' 变为 ' + state.latest.value.toFixed(1) + '，' +
      (state.dropPercent >= 0 ? '下降 ' + state.dropPercent.toFixed(1) + '%' : '上升 ' + Math.abs(state.dropPercent).toFixed(1) + '%') + '。';
    applySummaryOverride();
  }

  async function refresh() {
    ensureSection();
    try {
      var response = await fetch('data/charts/ismNewOrders.json?v=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      var chart = await response.json();
      render(compute(chart && chart.items));
    } catch (error) {
      render({ available: false });
    }
  }

  function initialize() {
    ensureSection();
    var button = document.querySelector('#forecastButton');
    if (button) button.addEventListener('click', function () { window.setTimeout(refresh, 0); });
    var dialog = document.querySelector('#forecastDialog');
    if (dialog) {
      new MutationObserver(function () {
        if (dialog.open) refresh();
      }).observe(dialog, { attributes: true, attributeFilter: ['open'] });
    }
    var summary = document.querySelector('#forecastSummary');
    if (summary) new MutationObserver(applySummaryOverride).observe(summary, { childList: true, subtree: true, attributes: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
}());
