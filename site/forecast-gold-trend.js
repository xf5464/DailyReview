(function () {
  'use strict';

  var config = window.__CENTRAL_BANK_GOLD_TREND_CONFIG__ || {
    baselineQuarters: 4,
    riseThreshold: 25,
    consecutiveQuarters: 2
  };
  var latestState = null;

  function number(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function positiveInteger(value, fallback) {
    var parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  config = {
    baselineQuarters: positiveInteger(config.baselineQuarters, 4),
    riseThreshold: number(config.riseThreshold, 25),
    consecutiveQuarters: positiveInteger(config.consecutiveQuarters, 2)
  };

  function formatQuarter(dateText) {
    var date = new Date(String(dateText || '') + 'T00:00:00Z');
    if (Number.isNaN(date.getTime())) return dateText || '--';
    return date.getUTCFullYear() + ' Q' + (Math.floor(date.getUTCMonth() / 3) + 1);
  }

  function formatTonnes(value) {
    return Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 1 }) + ' 吨';
  }

  function compute(items) {
    var series = (Array.isArray(items) ? items : [])
      .map(function (item) { return { date: String(item.date || ''), value: Number(item.value) }; })
      .filter(function (item) { return item.date && Number.isFinite(item.value); })
      .sort(function (left, right) { return left.date.localeCompare(right.date); });
    var minimumPoints = Math.max(config.baselineQuarters + 1, config.consecutiveQuarters + 1);
    if (series.length < minimumPoints) return { available: false };

    var latest = series[series.length - 1];
    var baselineItems = series.slice(-(config.baselineQuarters + 1), -1);
    var baselineAverage = baselineItems.reduce(function (sum, item) { return sum + item.value; }, 0) / baselineItems.length;
    if (!(baselineAverage > 0)) return { available: false };

    var risePercent = (latest.value - baselineAverage) / baselineAverage * 100;
    var recent = series.slice(-(config.consecutiveQuarters + 1));
    var consecutiveRise = recent.slice(1).every(function (item, index) {
      return item.value > recent[index].value;
    });
    return {
      available: true,
      latest: latest,
      baselineAverage: baselineAverage,
      risePercent: risePercent,
      consecutiveRise: consecutiveRise,
      reached: risePercent >= config.riseThreshold && consecutiveRise,
      recent: recent
    };
  }

  function ensureSection() {
    var existing = document.querySelector('#forecastCentralBankGoldCondition');
    if (existing) return existing;
    var sahm = document.querySelector('#forecastSahmCondition');
    if (!sahm) return null;
    var section = document.createElement('section');
    section.className = 'forecast-condition';
    section.id = 'forecastCentralBankGoldCondition';
    section.innerHTML = '' +
      '<div class="forecast-condition-heading">' +
        '<div>' +
          '<div class="forecast-condition-title-row">' +
            '<h3>全球央行净购金趋势</h3>' +
            '<span class="overall-detail-help forecast-help">' +
              '<button class="overall-detail-help-button" type="button" aria-label="查看央行购金趋势说明" aria-expanded="false">?</button>' +
              '<span class="overall-detail-help-tooltip" role="tooltip">最新季度相对前 N 季均值提升达到设定阈值，并且最近若干次季度变化连续上涨时，判断趋势启动。参数来自 GitHub Variables。</span>' +
            '</span>' +
          '</div>' +
          '<p id="forecastCentralBankGoldDetail">正在读取全球央行净购金数据...</p>' +
        '</div>' +
        '<span class="forecast-status" id="forecastCentralBankGoldStatus">等待数据</span>' +
      '</div>' +
      '<div class="forecast-gold-trend-metrics">' +
        '<div><span>最新季度</span><strong id="forecastCentralBankGoldLatest">--</strong></div>' +
        '<div><span>前 N 季均值</span><strong id="forecastCentralBankGoldBaseline">--</strong></div>' +
        '<div><span>提升幅度</span><strong id="forecastCentralBankGoldRise">--</strong></div>' +
        '<div><span>连续上涨</span><strong id="forecastCentralBankGoldConsecutive">--</strong></div>' +
      '</div>' +
      '<p class="forecast-gold-trend-rule" id="forecastCentralBankGoldRule"></p>';
    sahm.insertAdjacentElement('afterend', section);

    var style = document.createElement('style');
    style.textContent = '' +
      '.forecast-gold-trend-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px}' +
      '.forecast-gold-trend-metrics>div{padding:10px;border:1px solid #e4eaf3;border-radius:8px;background:#f8fbff;text-align:center}' +
      '.forecast-gold-trend-metrics span{display:block;color:#657089;font-size:11px;font-weight:700}' +
      '.forecast-gold-trend-metrics strong{display:block;margin-top:4px;color:#172033;font-size:14px}' +
      '.forecast-gold-trend-rule{margin:10px 0 0;color:#657089;font-size:12px;line-height:1.5}' +
      '@media(max-width:680px){.forecast-gold-trend-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}';
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
    var status = document.querySelector('#forecastCentralBankGoldStatus');
    var detail = document.querySelector('#forecastCentralBankGoldDetail');
    var latest = document.querySelector('#forecastCentralBankGoldLatest');
    var baseline = document.querySelector('#forecastCentralBankGoldBaseline');
    var rise = document.querySelector('#forecastCentralBankGoldRise');
    var consecutive = document.querySelector('#forecastCentralBankGoldConsecutive');
    var rule = document.querySelector('#forecastCentralBankGoldRule');

    rule.textContent = '规则：最新季度 ≥ 前 ' + config.baselineQuarters + ' 季均值提升 ' +
      config.riseThreshold + '%，且最近 ' + config.consecutiveQuarters + ' 次季度变化连续上涨。';

    if (!state.available) {
      status.textContent = '暂无数据';
      status.classList.remove('is-reached');
      detail.textContent = '当前季度数据不足，暂时无法判断趋势。';
      latest.textContent = '--';
      baseline.textContent = '--';
      rise.textContent = '--';
      consecutive.textContent = '--';
      return;
    }

    status.textContent = state.reached ? '已启动' : '未启动';
    status.classList.toggle('is-reached', state.reached);
    latest.textContent = formatTonnes(state.latest.value) + ' · ' + formatQuarter(state.latest.date);
    baseline.textContent = formatTonnes(state.baselineAverage);
    rise.textContent = (state.risePercent >= 0 ? '+' : '') + state.risePercent.toFixed(1) + '%';
    consecutive.textContent = state.consecutiveRise ? '是' : '否';
    detail.textContent = '最新季度较前 ' + config.baselineQuarters + ' 季均值' +
      (state.risePercent >= 0 ? '提升 ' : '下降 ') + Math.abs(state.risePercent).toFixed(1) + '%；' +
      '最近 ' + config.consecutiveQuarters + ' 次季度变化' + (state.consecutiveRise ? '连续上涨。' : '未连续上涨。');
    applySummaryOverride();
  }

  async function refresh() {
    ensureSection();
    try {
      var response = await fetch('data/charts/centralBankGoldPurchases.json?v=' + Date.now(), { cache: 'no-store' });
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
    if (summary) {
      new MutationObserver(applySummaryOverride).observe(summary, { childList: true, subtree: true, attributes: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
}());
