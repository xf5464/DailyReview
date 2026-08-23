(function () {
  'use strict';

  var CHART_IDS = [
    'treasuryYield', 'treasuryYield30', 'cpi', 'pce', 'gold', 'bitcoin',
    'federalDebt', 'jpyUsd', 'brentOil', 'wtiOil', 'aShareTurnover', 'aShareMarginBalance', 'aShareActiveMarketValueThs',
    'nasdaq100Pe', 'ndx', 'sp500', 'vix', 'treasurySpread',
    'highYieldSpread', 'broadDollar', 'initialClaims', 'financialConditions'
  ];

  var TITLES = {
    treasuryYield: '美国 10 年期国债收益率',
    treasuryYield30: '美国 30 年期国债收益率',
    cpi: '美国 CPI 同比',
    pce: '美国 PCE 同比',
    gold: '黄金价格',
    bitcoin: '比特币价格',
    federalDebt: '美国联邦债务总额',
    jpyUsd: '日元兑美元汇率',
    brentOil: '布伦特原油价格',
    wtiOil: 'WTI 原油价格',
    aShareTurnover: 'A股全A成交额',
    aShareMarginBalance: 'A股融资余额（三市）',
    aShareActiveMarketValueThs: 'A股活跃市值（同花顺公式版）',
    nasdaq100Pe: '纳斯达克100市盈率（NDX）',
    ndx: 'NDX（纳斯达克100指数）',
    sp500: '标普500指数（SPX）',
    vix: 'VIX恐慌指数',
    treasurySpread: '美国10年-2年国债利差',
    highYieldSpread: '美国高收益债信用利差',
    broadDollar: '广义美元指数',
    initialClaims: '美国初次申请失业金人数',
    financialConditions: '美国金融状况指数'
  };

  var CATEGORIES = {
    treasuryYield: '利率',
    treasuryYield30: '长期利率',
    cpi: '通胀',
    pce: '通胀',
    gold: '避险资产',
    bitcoin: '数字资产',
    federalDebt: '财政',
    jpyUsd: '外汇',
    brentOil: '能源',
    wtiOil: '能源',
    aShareTurnover: 'A股市场',
    aShareMarginBalance: 'A股杠杆资金',
    aShareActiveMarketValueThs: 'A股市场活跃度',
    nasdaq100Pe: '美股估值',
    ndx: '美股指数',
    sp500: '美股指数',
    vix: '风险偏好',
    treasurySpread: '利率曲线',
    highYieldSpread: '信用风险',
    broadDollar: '美元流动性',
    initialClaims: '就业',
    financialConditions: '金融压力'
  };

  var DESCRIPTIONS = {
    treasuryYield: '美国 10 年期国债的市场收益率，是长期无风险利率和资产定价的重要基准。上升通常意味着融资成本与估值折现率提高。',
    treasuryYield30: '美国 30 年期国债的市场收益率，反映更长期的利率、通胀和期限风险预期，对长期资产的利率变化更敏感。',
    cpi: '美国消费者价格指数（CPI）的同比涨幅，衡量居民购买的一篮子商品和服务相对一年前的价格变化。',
    pce: '美国个人消费支出价格指数（PCE）的同比涨幅。本图为总体 PCE，而非核心 PCE。',
    gold: '伦敦现货黄金的美元价格，单位为美元/盎司，常受实际利率、美元、通胀预期和避险需求影响。',
    bitcoin: '比特币兑美元的市场价格。该资产全天候交易、波动较大，通常受流动性、风险偏好、监管和资金流入影响。',
    federalDebt: '美国财政部记录的联邦债务总额，包括公众持有债务和政府内部持有债务，单位换算为万亿美元。',
    jpyUsd: '一美元可兑换的日元数量。数值上升表示美元兑日元走强、日元贬值；数值下降表示日元升值。',
    brentOil: '布伦特原油现货价格，是欧洲及全球原油定价的重要基准，受全球供需、库存和地缘风险影响。',
    wtiOil: '美国西得克萨斯中质原油现货价格，是美国原油定价基准，受美国供需、库存和全球油市影响。',
    aShareTurnover: 'A 股全市场当日成交金额，单位为亿元。它主要反映市场交易活跃度和资金参与度，不直接代表指数涨跌方向。',
    aShareMarginBalance: '沪、深、北三市融资余额合计，单位为亿元，表示投资者尚未偿还的融资买入金额。余额上升通常代表杠杆资金净流入，但不等同于市场一定上涨。',
    aShareActiveMarketValueThs: '按同花顺指标平台公开用户公式计算：上证指数与深证综指成交额之和，再取 SMA(10,1)，单位为亿元。它是可复现的成交活跃度平滑指标，并非指南针原版 0AMV，也不是同花顺官方统一指数。',
    nasdaq100Pe: '纳斯达克 100 指数的滚动市盈率（TTM），即指数市值相对过去 12 个月盈利的倍数，用于观察估值高低。',
    ndx: '纳斯达克 100 指数点位，覆盖纳斯达克上市的主要非金融公司，科技和成长型公司的权重较高。',
    sp500: '标普 500 指数点位，覆盖美国约 500 家大型上市公司，是衡量美国大盘股表现的核心基准之一。',
    vix: '由标普 500 期权价格推算的未来约 30 天预期波动率。数值越高，通常表示市场不确定性和避险情绪越强。',
    treasurySpread: '美国 10 年期与 2 年期国债收益率之差。负值代表收益率曲线倒挂。',
    highYieldSpread: '美国高收益债相对同期限美国国债的期权调整利差。利差扩大通常表示信用风险和融资压力上升。',
    broadDollar: '美联储编制的贸易加权广义美元指数。指数上升表示美元对主要贸易伙伴货币整体走强。',
    initialClaims: '美国每周首次申请失业保险的人数，是观察裁员和劳动力市场转弱的高频领先指标。',
    financialConditions: '芝加哥联储金融状况指数（NFCI）。零值附近代表历史平均，正值偏紧，负值偏松。'
  };

  var COLORS = {
    treasuryYield: '#1f5fd2',
    treasuryYield30: '#1685a9',
    cpi: '#c23b3b',
    pce: '#7c3aed',
    gold: '#b7791f',
    bitcoin: '#e67e00',
    federalDebt: '#256f5b',
    jpyUsd: '#b3336f',
    brentOil: '#52606d',
    wtiOil: '#8a5a2b',
    aShareTurnover: '#b84f16',
    aShareMarginBalance: '#0f766e',
    aShareActiveMarketValueThs: '#c2410c',
    nasdaq100Pe: '#6a42c2',
    ndx: '#335cc7',
    sp500: '#16806a',
    vix: '#d14343',
    treasurySpread: '#5b66c9',
    highYieldSpread: '#9a5c1f',
    broadDollar: '#367493',
    initialClaims: '#7e57a6',
    financialConditions: '#246b5e'
  };

  var RANGES = {
    day1: { label: '1天', days: 1 },
    week1: { label: '1周', days: 7 },
    week2: { label: '2周', days: 14 },
    week4: { label: '4周', days: 28 },
    month1: { label: '1个月', months: 1 },
    month3: { label: '3个月', months: 3 },
    month6: { label: '6个月', months: 6 },
    year1: { label: '1年', months: 12 },
    year2: { label: '2年', months: 24 },
    year3: { label: '3年', months: 36 },
    year5: { label: '5年', months: 60 },
    year10: { label: '10年', months: 120 }
  };

  var STORAGE_KEY = 'daily-review.overall-situation-config.v2';
  var LINE_WIDTH_STORAGE_KEY = 'daily-review.chart-line-width.v1';
  var DEFAULT_LINE_WIDTH = 1;
  var DEFAULT_CONFIG = {
    chartsPerRow: 4,
    chartOrder: [
      'treasuryYield30', 'jpyUsd', 'gold', 'aShareTurnover', 'aShareMarginBalance', 'aShareActiveMarketValueThs', 'federalDebt',
      'cpi', 'pce', 'bitcoin', 'brentOil', 'wtiOil', 'nasdaq100Pe', 'ndx',
      'sp500', 'vix', 'treasurySpread', 'highYieldSpread', 'broadDollar',
      'initialClaims', 'financialConditions', 'treasuryYield'
    ],
    groupChartOrder: {
      default: [
        'treasuryYield30', 'jpyUsd', 'gold', 'aShareTurnover', 'aShareMarginBalance', 'aShareActiveMarketValueThs', 'federalDebt',
        'cpi', 'pce', 'bitcoin', 'brentOil', 'wtiOil', 'nasdaq100Pe', 'ndx',
        'sp500', 'vix', 'treasurySpread', 'highYieldSpread', 'broadDollar',
        'initialClaims', 'financialConditions', 'treasuryYield'
      ],
      group_mt432xl1_kz1mx7: [
        'treasuryYield30', 'vix', 'ndx', 'sp500', 'nasdaq100Pe',
        'federalDebt', 'cpi', 'pce', 'treasurySpread', 'highYieldSpread',
        'initialClaims', 'broadDollar', 'financialConditions', 'treasuryYield'
      ],
      group_mt49f5yl_pctlb6: ['gold', 'brentOil', 'wtiOil']
    },
    visibleChartIds: [
      'treasuryYield30', 'jpyUsd', 'gold', 'aShareTurnover', 'aShareMarginBalance', 'aShareActiveMarketValueThs', 'federalDebt',
      'cpi', 'pce', 'bitcoin', 'brentOil', 'wtiOil', 'nasdaq100Pe', 'ndx',
      'sp500', 'vix', 'treasurySpread', 'highYieldSpread', 'broadDollar',
      'initialClaims', 'financialConditions'
    ],
    groups: [
      { id: 'default', name: '默认' },
      { id: 'group_mt432xl1_kz1mx7', name: '美国' },
      { id: 'group_mt49f5yl_pctlb6', name: '资源' }
    ],
    chartGroups: {
      treasuryYield: ['default', 'group_mt432xl1_kz1mx7'],
      treasuryYield30: ['default', 'group_mt432xl1_kz1mx7'],
      cpi: ['default', 'group_mt432xl1_kz1mx7'],
      pce: ['default', 'group_mt432xl1_kz1mx7'],
      gold: ['default', 'group_mt49f5yl_pctlb6'],
      bitcoin: ['default'],
      federalDebt: ['default', 'group_mt432xl1_kz1mx7'],
      jpyUsd: ['default'],
      brentOil: ['default', 'group_mt49f5yl_pctlb6'],
      wtiOil: ['default', 'group_mt49f5yl_pctlb6'],
      aShareTurnover: ['default'],
      aShareMarginBalance: ['default'],
      aShareActiveMarketValueThs: ['default'],
      nasdaq100Pe: ['default', 'group_mt432xl1_kz1mx7'],
      ndx: ['default', 'group_mt432xl1_kz1mx7'],
      sp500: ['default', 'group_mt432xl1_kz1mx7'],
      vix: ['default', 'group_mt432xl1_kz1mx7'],
      treasurySpread: ['default', 'group_mt432xl1_kz1mx7'],
      highYieldSpread: ['default', 'group_mt432xl1_kz1mx7'],
      broadDollar: ['default', 'group_mt432xl1_kz1mx7'],
      initialClaims: ['default', 'group_mt432xl1_kz1mx7'],
      financialConditions: ['default', 'group_mt432xl1_kz1mx7']
    },
    selectedGroupId: 'group_mt432xl1_kz1mx7'
  };

  var data = null;
  var config = loadConfig();
  var viewMode = 'charts';
  var activeDetailId = null;
  var draggedChartId = null;
  var tooltip = null;
  var sharedConfigAvailable = false;
  var sharedConfigSaveQueue = Promise.resolve();

  var refs = {
    meta: document.querySelector('#overallPageMeta'),
    rangeKicker: document.querySelector('#overallRangeKicker'),
    group: document.querySelector('#overallGroupSelect'),
    range: document.querySelector('#overallRangeSelect'),
    columns: document.querySelector('#overallColumnsSelect'),
    refresh: document.querySelector('#overallRefreshButton'),
    viewToggle: document.querySelector('#overallViewToggleButton'),
    compareButton: document.querySelector('#overallCompareButton'),
    displayButton: document.querySelector('#displayControlsButton'),
    groupsButton: document.querySelector('#overallManageGroupsButton'),
    manageButton: document.querySelector('#overallManageButton'),
    grid: document.querySelector('#overallChartGrid'),
    tableView: document.querySelector('#overallTableView'),
    tableBody: document.querySelector('#overallTableBody'),
    configDialog: document.querySelector('#overallConfigDialog'),
    configList: document.querySelector('#overallConfigList'),
    configMessage: document.querySelector('#overallConfigMessage'),
    configFile: document.querySelector('#overallConfigFileInput'),
    compareDialog: document.querySelector('#overallCompareDialog'),
    compareRange: document.querySelector('#overallCompareRangeSelect'),
    compareFirst: document.querySelector('#overallCompareFirstSelect'),
    compareSecond: document.querySelector('#overallCompareSecondSelect'),
    compareMessage: document.querySelector('#overallCompareMessage'),
    compareChart: document.querySelector('#overallCompareChart'),
    detailDialog: document.querySelector('#overallDetailDialog'),
    detailClose: document.querySelector('#overallDetailCloseButton'),
    detailTitle: document.querySelector('#overallDetailTitle'),
    detailHelp: document.querySelector('#overallDetailHelpTooltip'),
    detailRange: document.querySelector('#overallDetailRangeSelect'),
    detailMessage: document.querySelector('#overallDetailMessage'),
    detailHighValue: document.querySelector('#overallDetailHighValue'),
    detailHighDate: document.querySelector('#overallDetailHighDate'),
    detailLowValue: document.querySelector('#overallDetailLowValue'),
    detailLowDate: document.querySelector('#overallDetailLowDate'),
    detailChart: document.querySelector('#overallDetailChart'),
    detailSource: document.querySelector('#overallDetailSourceLink'),
    groupsDialog: document.querySelector('#overallGroupsDialog'),
    groupsList: document.querySelector('#overallGroupsList'),
    groupsMessage: document.querySelector('#overallGroupsMessage'),
    newGroupName: document.querySelector('#overallNewGroupName'),
    displayDialog: document.querySelector('#displayControlsDialog'),
    lineWidth: document.querySelector('#chartLineWidthInput'),
    lineWidthOutput: document.querySelector('#chartLineWidthOutput'),
    displayFile: document.querySelector('#displayControlsConfigFileInput'),
    displayMessage: document.querySelector('#displayControlsMessage')
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeLineWidth(value) {
    if (value === null || value === undefined || value === '') return DEFAULT_LINE_WIDTH;
    var parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_LINE_WIDTH;
    return Math.min(6, Math.max(1, Math.round(parsed * 2) / 2));
  }

  function applyLineWidth(value, persist) {
    var width = normalizeLineWidth(value);
    document.documentElement.style.setProperty('--chart-line-width', width + 'px');
    refs.lineWidth.value = String(width);
    refs.lineWidthOutput.value = width + ' px';
    refs.lineWidthOutput.textContent = width + ' px';
    if (persist !== false) {
      localStorage.setItem(LINE_WIDTH_STORAGE_KEY, String(width));
      persistSharedConfig();
    }
  }

  function uniqueKnown(values) {
    var seen = new Set();
    return (Array.isArray(values) ? values : []).filter(function (id) {
      if (!CHART_IDS.includes(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function sanitizeConfig(value) {
    var source = value && value.overallSituation ? value.overallSituation : value || {};
    var groups = [{ id: 'default', name: '默认' }];
    var groupIds = new Set(['default']);
    (Array.isArray(source.groups) ? source.groups : []).forEach(function (group) {
      var id = String(group && group.id || '').trim();
      var name = String(group && group.name || '').trim().slice(0, 40);
      if (!id || id === 'default' || groupIds.has(id) || !name) return;
      groups.push({ id: id, name: name });
      groupIds.add(id);
    });

    var chartOrder = uniqueKnown(source.chartOrder);
    var newlyAddedChartIds = CHART_IDS.filter(function (id) { return !chartOrder.includes(id); });
    CHART_IDS.forEach(function (id) {
      if (!chartOrder.includes(id)) chartOrder.push(id);
    });

    var visible = uniqueKnown(source.visibleChartIds);
    if (!Array.isArray(source.visibleChartIds)) visible = CHART_IDS.slice();
    else newlyAddedChartIds.forEach(function (id) {
      if (!visible.includes(id)) visible.push(id);
    });

    var chartGroups = {};
    CHART_IDS.forEach(function (id) {
      var memberships = Array.isArray(source.chartGroups && source.chartGroups[id])
        ? source.chartGroups[id].filter(function (groupId) { return groupIds.has(groupId); })
        : ['default'];
      chartGroups[id] = Array.from(new Set(['default'].concat(memberships)));
    });

    var groupChartOrder = {};
    groups.forEach(function (group) {
      var order = uniqueKnown(source.groupChartOrder && source.groupChartOrder[group.id]);
      var members = chartOrder.filter(function (id) { return chartGroups[id].includes(group.id); });
      members.forEach(function (id) {
        if (!order.includes(id)) order.push(id);
      });
      groupChartOrder[group.id] = order.filter(function (id) { return members.includes(id); });
    });

    var columns = Number(source.chartsPerRow);
    if (![1, 2, 3, 4].includes(columns)) columns = 3;
    var selectedGroupId = groupIds.has(source.selectedGroupId) ? source.selectedGroupId : 'default';

    return {
      chartsPerRow: columns,
      chartOrder: chartOrder,
      groupChartOrder: groupChartOrder,
      visibleChartIds: visible,
      groups: groups,
      chartGroups: chartGroups,
      selectedGroupId: selectedGroupId
    };
  }

  function loadConfig() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      return sanitizeConfig(stored ? JSON.parse(stored) : clone(DEFAULT_CONFIG));
    } catch (error) {
      return sanitizeConfig(clone(DEFAULT_CONFIG));
    }
  }

  function persistConfig() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    persistSharedConfig();
  }

  function sharedConfigPayload() {
    return {
      overallSituation: config,
      displayControls: {
        chartLineWidth: normalizeLineWidth(refs.lineWidth && refs.lineWidth.value)
      }
    };
  }

  function persistSharedConfig() {
    if (!sharedConfigAvailable) return;
    var body = JSON.stringify(sharedConfigPayload());
    sharedConfigSaveQueue = sharedConfigSaveQueue.catch(function () {}).then(function () {
      return fetch('api/local-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body
      });
    }).catch(function () {
      // GitHub Pages 等纯静态环境继续使用当前浏览器的 localStorage。
    });
  }

  async function syncSharedLocalConfig() {
    try {
      var response = await fetch('api/local-config', { cache: 'no-store' });
      if (!response.ok) return;
      var payload = await response.json();
      sharedConfigAvailable = true;
      if (!payload || !payload.config) {
        persistSharedConfig();
        return;
      }
      var storedConfig = payload.config;
      if (storedConfig.overallSituation) {
        config = sanitizeConfig(storedConfig.overallSituation);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      }
      var storedWidth = storedConfig.displayControls && storedConfig.displayControls.chartLineWidth;
      if (storedWidth !== undefined) {
        applyLineWidth(storedWidth, false);
        localStorage.setItem(LINE_WIDTH_STORAGE_KEY, String(normalizeLineWidth(storedWidth)));
      }
      syncGroups();
      refs.columns.value = String(config.chartsPerRow);
      renderAll();
    } catch (error) {
      // 未提供本机配置接口时保持浏览器本地配置。
    }
  }

  function createElement(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function createSvg(tag, attributes) {
    var node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attributes || {}).forEach(function (key) {
      node.setAttribute(key, String(attributes[key]));
    });
    return node;
  }

  function chartById(id) {
    return data && Array.isArray(data.charts)
      ? data.charts.find(function (chart) { return chart.id === id; })
      : null;
  }

  function selectedGroupOrder() {
    var id = config.selectedGroupId;
    return (config.groupChartOrder[id] || []).filter(function (chartId) {
      return config.chartGroups[chartId] && config.chartGroups[chartId].includes(id);
    });
  }

  function activeChartIds() {
    return selectedGroupOrder().filter(function (id) {
      return config.visibleChartIds.includes(id);
    });
  }

  function shiftMonths(date, offset) {
    var value = new Date(date.getTime());
    var day = value.getUTCDate();
    value.setUTCDate(1);
    value.setUTCMonth(value.getUTCMonth() + offset);
    var lastDay = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate();
    value.setUTCDate(Math.min(day, lastDay));
    return value;
  }

  function filterItems(chart, rangeKey) {
    var items = (chart && Array.isArray(chart.items) ? chart.items : [])
      .filter(function (item) { return item && item.date && Number.isFinite(Number(item.value)); })
      .map(function (item) { return { date: item.date, value: Number(item.value) }; })
      .sort(function (left, right) { return left.date.localeCompare(right.date); });
    if (!items.length) return [];

    var range = RANGES[rangeKey] || RANGES.month3;
    var frequency = chart.frequency || '';
    if (frequency.includes('月')) {
      return Number.isInteger(range.months) ? items.slice(-range.months) : items.slice(-1);
    }
    if (frequency.includes('季')) {
      return Number.isInteger(range.months) ? items.slice(-Math.ceil(range.months / 3)) : items.slice(-1);
    }

    var latest = new Date(items[items.length - 1].date + 'T00:00:00Z');
    var start;
    if (rangeKey === 'month1') {
      start = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth(), 1));
    } else if (Number.isInteger(range.months)) {
      start = shiftMonths(latest, -range.months);
    } else {
      start = new Date(latest.getTime() - range.days * 86400000);
    }
    var startText = start.toISOString().slice(0, 10);
    return items.filter(function (item) { return item.date >= startText; });
  }

  function filteredChart(chart, rangeKey) {
    if (!chart) return null;
    var result = Object.assign({}, chart);
    result.items = filterItems(chart, rangeKey);
    return result;
  }

  function formatDate(dateText, frequency) {
    if (!dateText) return '--';
    var date = new Date(dateText + 'T00:00:00Z');
    if (Number.isNaN(date.getTime())) return dateText;
    var options = frequency && frequency.includes('月')
      ? { year: 'numeric', month: '2-digit', timeZone: 'UTC' }
      : { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' };
    return new Intl.DateTimeFormat('zh-CN', options).format(date);
  }

  function formatValue(chart, value, compact) {
    if (!chart || !Number.isFinite(Number(value))) return '--';
    var number = Number(value);
    var digits = Number.isInteger(chart.decimals) ? chart.decimals : 2;
    var options = {
      minimumFractionDigits: compact ? 0 : digits,
      maximumFractionDigits: digits
    };
    if (compact && Math.abs(number) >= 10000) options.notation = 'compact';
    return number.toLocaleString('zh-CN', options) + (chart.unit || '');
  }

  function axisValue(value) {
    var absolute = Math.abs(value);
    if (absolute >= 1000000) return (value / 1000000).toFixed(1) + 'm';
    if (absolute >= 1000) return (value / 1000).toFixed(1) + 'k';
    if (absolute >= 100) return value.toFixed(0);
    if (absolute >= 10) return value.toFixed(1);
    return value.toFixed(2);
  }

  function rangeSummary(chart) {
    if (!chart) return '等待数据';
    if (chart.error && !chart.items.length) return chart.error;
    if (!chart.items.length) return '当前时间范围暂无数据';
    var first = chart.items[0];
    var latest = chart.items[chart.items.length - 1];
    if (chart.items.length === 1 || first.value === 0) {
      return formatDate(latest.date, chart.frequency) + ' · 最近可用值';
    }
    var change = (latest.value / first.value - 1) * 100;
    var sign = change > 0 ? '+' : '';
    return formatDate(first.date, chart.frequency) + ' 至 ' +
      formatDate(latest.date, chart.frequency) + ' · 区间 ' + sign + change.toFixed(2) + '%';
  }

  function hexToRgba(hex, alpha) {
    var match = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!match) return 'rgba(31, 95, 210, ' + alpha + ')';
    var raw = match[1];
    return 'rgba(' + parseInt(raw.slice(0, 2), 16) + ', ' +
      parseInt(raw.slice(2, 4), 16) + ', ' + parseInt(raw.slice(4, 6), 16) + ', ' + alpha + ')';
  }

  function extent(values) {
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    if (min === max) {
      var offset = Math.abs(min || 1) * 0.06;
      return [min - offset, max + offset];
    }
    var padding = (max - min) * 0.08;
    return [min - padding, max + padding];
  }

  function linePath(items, box, domainX, domainY) {
    var start = domainX[0];
    var spanX = Math.max(1, domainX[1] - start);
    var minY = domainY[0];
    var spanY = Math.max(Number.EPSILON, domainY[1] - minY);
    return items.map(function (item, index) {
      var timestamp = Date.parse(item.date + 'T00:00:00Z');
      var x = box.left + (timestamp - start) / spanX * box.width;
      var y = box.top + (1 - (item.value - minY) / spanY) * box.height;
      return (index ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2);
    }).join(' ');
  }

  function renderEmpty(svg, message) {
    svg.replaceChildren();
    svg.setAttribute('viewBox', '0 0 520 270');
    var label = createSvg('text', {
      x: 260, y: 138, class: 'overall-chart-empty', 'text-anchor': 'middle'
    });
    label.textContent = message;
    svg.append(label);
  }

  function nearestItem(items, timestamp) {
    var best = items[0];
    var distance = Math.abs(Date.parse(best.date + 'T00:00:00Z') - timestamp);
    for (var index = 1; index < items.length; index += 1) {
      var nextDistance = Math.abs(Date.parse(items[index].date + 'T00:00:00Z') - timestamp);
      if (nextDistance >= distance) break;
      best = items[index];
      distance = nextDistance;
    }
    return best;
  }

  function ensureTooltip(anchor) {
    var dialogHost = anchor && anchor.closest ? anchor.closest('dialog[open]') : null;
    var host = dialogHost || document.body;
    if (!tooltip) {
      tooltip = createElement('div', 'floating-chart-tooltip');
      tooltip.hidden = true;
    }
    if (tooltip.parentNode !== host) host.append(tooltip);
    return tooltip;
  }

  function renderLineChart(svg, chart) {
    if (!chart || !chart.items || !chart.items.length) {
      renderEmpty(svg, chart && chart.error ? '数据源暂不可用' : '暂无可绘制的数据');
      return;
    }

    var items = chart.items;
    var width = 520;
    var height = 270;
    var box = { left: 58, top: 28, width: 438, height: 198 };
    var values = items.map(function (item) { return item.value; });
    var domainY = extent(values);
    var domainX = [
      Date.parse(items[0].date + 'T00:00:00Z'),
      Date.parse(items[items.length - 1].date + 'T00:00:00Z')
    ];
    if (domainX[0] === domainX[1]) domainX[1] += 86400000;
    var color = COLORS[chart.id] || '#1f5fd2';
    var path = linePath(items, box, domainX, domainY);
    var baseline = box.top + box.height;

    svg.replaceChildren();
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.setAttribute('aria-label', chart.title + '，' + rangeSummary(chart));

    for (var gridIndex = 0; gridIndex <= 4; gridIndex += 1) {
      var ratio = gridIndex / 4;
      var y = box.top + ratio * box.height;
      var value = domainY[1] - ratio * (domainY[1] - domainY[0]);
      svg.append(createSvg('line', {
        x1: box.left, y1: y, x2: box.left + box.width, y2: y, class: 'chart-grid'
      }));
      var yLabel = createSvg('text', {
        x: box.left - 9, y: y + 4, class: 'chart-label', 'text-anchor': 'end'
      });
      yLabel.textContent = axisValue(value);
      svg.append(yLabel);
    }

    var unit = createSvg('text', { x: box.left, y: 16, class: 'overall-chart-unit' });
    unit.textContent = chart.unit || '';
    svg.append(unit);

    var xIndexes = Array.from(new Set([0, Math.floor((items.length - 1) / 2), items.length - 1]));
    xIndexes.forEach(function (itemIndex, labelIndex) {
      var item = items[itemIndex];
      var timestamp = Date.parse(item.date + 'T00:00:00Z');
      var x = box.left + (timestamp - domainX[0]) / (domainX[1] - domainX[0]) * box.width;
      var label = createSvg('text', {
        x: x,
        y: height - 15,
        class: 'chart-label',
        'text-anchor': labelIndex === 0 ? 'start' : labelIndex === xIndexes.length - 1 ? 'end' : 'middle'
      });
      label.textContent = formatDate(item.date, chart.frequency);
      svg.append(label);
    });

    var area = createSvg('path', {
      d: path + ' L' + (box.left + box.width) + ' ' + baseline + ' L' + box.left + ' ' + baseline + ' Z',
      class: 'overall-chart-area'
    });
    area.style.fill = hexToRgba(color, 0.12);
    svg.append(area);

    var line = createSvg('path', { d: path, class: 'overall-chart-line' });
    line.style.stroke = color;
    svg.append(line);

    var guide = createSvg('line', {
      y1: box.top, y2: box.top + box.height, stroke: color,
      'stroke-width': 1, 'stroke-dasharray': '4 4', opacity: 0
    });
    var point = createSvg('circle', {
      r: 4.5, class: 'overall-chart-tip-point', opacity: 0
    });
    point.style.fill = color;
    svg.append(guide, point);

    var overlay = createSvg('rect', {
      x: box.left, y: box.top, width: box.width, height: box.height,
      fill: 'transparent'
    });
    overlay.style.cursor = 'crosshair';
    overlay.addEventListener('pointermove', function (event) {
      var rect = svg.getBoundingClientRect();
      var localX = (event.clientX - rect.left) / rect.width * width;
      var ratio = Math.max(0, Math.min(1, (localX - box.left) / box.width));
      var target = domainX[0] + ratio * (domainX[1] - domainX[0]);
      var item = nearestItem(items, target);
      var itemTime = Date.parse(item.date + 'T00:00:00Z');
      var x = box.left + (itemTime - domainX[0]) / (domainX[1] - domainX[0]) * box.width;
      var y = box.top + (1 - (item.value - domainY[0]) / (domainY[1] - domainY[0])) * box.height;
      guide.setAttribute('x1', x);
      guide.setAttribute('x2', x);
      guide.setAttribute('opacity', '0.55');
      point.setAttribute('cx', x);
      point.setAttribute('cy', y);
      point.setAttribute('opacity', '1');
      var tip = ensureTooltip(svg);
      tip.textContent = formatDate(item.date, chart.frequency) + ' · ' + formatValue(chart, item.value);
      tip.style.left = Math.min(window.innerWidth - 12, event.clientX + 12) + 'px';
      tip.style.top = Math.max(12, event.clientY - 38) + 'px';
      tip.hidden = false;
    });
    overlay.addEventListener('pointerleave', function () {
      guide.setAttribute('opacity', '0');
      point.setAttribute('opacity', '0');
      if (tooltip) tooltip.hidden = true;
    });
    svg.append(overlay);
  }

  function createCard(chartId) {
    var source = chartById(chartId);
    var chart = filteredChart(source, refs.range.value);
    var card = createElement('article', 'overall-chart-card');
    card.dataset.chartId = chartId;
    card.draggable = true;
    if (chart && chart.error && !chart.items.length) card.classList.add('has-error');

    var header = createElement('div', 'overall-chart-card-header');
    var heading = createElement('div');
    heading.append(createElement('p', '', CATEGORIES[chartId] || '市场指标'));
    var title = createElement('h3', '', (chart && chart.title) || TITLES[chartId]);
    title.tabIndex = 0;
    title.setAttribute('role', 'button');
    title.addEventListener('click', function () { showDetail(chartId); });
    title.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        showDetail(chartId);
      }
    });
    heading.append(title);

    var actions = createElement('div', 'overall-chart-card-header-actions');
    var latest = chart && chart.items.length ? chart.items[chart.items.length - 1] : null;
    var latestBlock = createElement('div', 'overall-chart-latest');
    latestBlock.append(createElement('strong', '', latest ? formatValue(chart, latest.value, true) : '--'));
    var latestDate = createElement('time', 'overall-chart-latest-date', latest ? formatDate(latest.date) : '暂无日期');
    if (latest) latestDate.dateTime = latest.date;
    latestBlock.append(latestDate);
    actions.append(latestBlock);
    var refresh = createElement('button', 'overall-chart-refresh-button', '↻');
    refresh.type = 'button';
    refresh.title = '刷新已发布数据';
    refresh.setAttribute('aria-label', '刷新' + TITLES[chartId]);
    refresh.addEventListener('click', function () { loadData(true, refresh); });
    actions.append(refresh);
    header.append(heading, actions);

    var summary = createElement('p', 'overall-chart-summary', rangeSummary(chart));
    var svg = createSvg('svg', {
      class: 'overall-chart', role: 'img', 'aria-label': TITLES[chartId] + '曲线'
    });
    renderLineChart(svg, chart);
    var sourceLine = createElement('p', 'overall-chart-source');
    sourceLine.append(document.createTextNode('数据源：'));
    if (chart && chart.sourceUrl) {
      var link = createElement('a', '', chart.sourceName || '查看来源');
      link.href = chart.sourceUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      sourceLine.append(link);
    } else {
      sourceLine.append(document.createTextNode(chart && chart.sourceName || '--'));
    }
    card.append(header, summary, svg, sourceLine);

    card.addEventListener('dragstart', function (event) {
      draggedChartId = chartId;
      card.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', function () {
      draggedChartId = null;
      card.classList.remove('is-dragging');
      document.querySelectorAll('.is-drop-target').forEach(function (node) {
        node.classList.remove('is-drop-target');
      });
    });
    card.addEventListener('dragover', function (event) {
      if (!draggedChartId || draggedChartId === chartId) return;
      event.preventDefault();
      card.classList.add('is-drop-target');
    });
    card.addEventListener('dragleave', function () { card.classList.remove('is-drop-target'); });
    card.addEventListener('drop', function (event) {
      event.preventDefault();
      card.classList.remove('is-drop-target');
      moveChartBefore(draggedChartId, chartId);
    });
    return card;
  }

  function renderCards() {
    refs.grid.style.setProperty('--overall-columns', String(config.chartsPerRow));
    var ids = activeChartIds();
    refs.grid.replaceChildren();
    if (!ids.length) {
      var empty = createElement('div', 'placeholder-panel');
      empty.append(createElement('p', '', '当前分组没有可显示的图表，请在“管理图表”或“管理分组”中添加。'));
      refs.grid.append(empty);
      return;
    }
    ids.forEach(function (id) { refs.grid.append(createCard(id)); });
  }

  function renderTable() {
    refs.tableBody.replaceChildren();
    activeChartIds().forEach(function (id) {
      var chart = filteredChart(chartById(id), refs.range.value);
      var latest = chart && chart.items.length ? chart.items[chart.items.length - 1] : null;
      var row = document.createElement('tr');
      var name = createElement('th', '', TITLES[id]);
      name.scope = 'row';
      row.append(name);
      row.append(createElement('td', chart && chart.error && !latest ? 'overall-table-error' : '', latest ? formatValue(chart, latest.value) : '--'));
      row.append(createElement('td', '', latest ? formatDate(latest.date, chart.frequency) : '--'));
      row.append(createElement('td', '', chart && chart.frequency || '--'));
      var actionCell = document.createElement('td');
      var button = createElement('button', 'secondary-button', '查看图表');
      button.type = 'button';
      button.addEventListener('click', function (event) {
        event.stopPropagation();
        showDetail(id);
      });
      actionCell.append(button);
      row.append(actionCell);
      row.addEventListener('click', function () { showDetail(id); });
      refs.tableBody.append(row);
    });
  }

  function renderMeta() {
    refs.rangeKicker.textContent = '最近 ' + RANGES[refs.range.value].label;
    if (!data) return;
    var fetched = new Date(data.fetchedAt);
    var fetchedLabel = Number.isNaN(fetched.getTime())
      ? '--'
      : new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai'
      }).format(fetched);
    var failed = data.charts.filter(function (chart) { return chart.error && !chart.items.length; }).length;
    refs.meta.textContent = '数据更新时间：' + fetchedLabel +
      (failed ? ' · ' + failed + ' 个数据源暂不可用' : ' · ' + data.charts.length + ' 个指标已就绪');
  }

  function renderAll() {
    renderMeta();
    renderCards();
    renderTable();
    if (activeDetailId && refs.detailDialog.open) renderDetail();
  }

  function syncGroups() {
    refs.group.replaceChildren();
    config.groups.forEach(function (group) {
      refs.group.append(new Option(group.name, group.id));
    });
    refs.group.value = config.selectedGroupId;
  }

  function syncView() {
    var showTable = viewMode === 'table';
    refs.grid.hidden = showTable;
    refs.tableView.hidden = !showTable;
    refs.viewToggle.textContent = showTable ? '图表视图' : '表格视图';
    if (showTable) renderTable();
  }

  function moveChartBefore(sourceId, targetId) {
    if (!sourceId || sourceId === targetId) return;
    var groupId = config.selectedGroupId;
    var order = (config.groupChartOrder[groupId] || []).slice();
    var sourceIndex = order.indexOf(sourceId);
    var targetIndex = order.indexOf(targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    order.splice(sourceIndex, 1);
    targetIndex = order.indexOf(targetId);
    order.splice(targetIndex, 0, sourceId);
    config.groupChartOrder[groupId] = order;
    if (groupId === 'default') config.chartOrder = order.slice();
    persistConfig();
    renderAll();
  }

  function moveChart(id, offset) {
    var groupId = config.selectedGroupId;
    var order = (config.groupChartOrder[groupId] || []).slice();
    var index = order.indexOf(id);
    var target = index + offset;
    if (index < 0 || target < 0 || target >= order.length) return;
    var temp = order[index];
    order[index] = order[target];
    order[target] = temp;
    config.groupChartOrder[groupId] = order;
    if (groupId === 'default') config.chartOrder = order.slice();
    persistConfig();
    renderConfigList();
    renderAll();
  }

  function renderConfigList() {
    refs.configList.replaceChildren();
    var order = selectedGroupOrder();
    order.forEach(function (id, index) {
      var item = createElement('li');
      item.draggable = true;
      item.dataset.chartId = id;
      item.tabIndex = 0;
      if (!config.visibleChartIds.includes(id)) item.classList.add('is-hidden-chart');
      item.append(createElement('span', 'overall-config-drag-handle', '⠿'));
      item.append(createElement('span', 'overall-config-chart-name', TITLES[id]));

      var up = createElement('button', 'config-order-button', '↑');
      up.type = 'button';
      up.title = '上移';
      up.disabled = index === 0;
      up.addEventListener('click', function () { moveChart(id, -1); });
      var down = createElement('button', 'config-order-button', '↓');
      down.type = 'button';
      down.title = '下移';
      down.disabled = index === order.length - 1;
      down.addEventListener('click', function () { moveChart(id, 1); });
      item.append(up, down);

      var label = createElement('label', 'overall-config-visibility');
      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = config.visibleChartIds.includes(id);
      checkbox.addEventListener('change', function () {
        config.visibleChartIds = checkbox.checked
          ? Array.from(new Set(config.visibleChartIds.concat(id)))
          : config.visibleChartIds.filter(function (chartId) { return chartId !== id; });
        persistConfig();
        renderConfigList();
        renderAll();
      });
      label.append(checkbox, document.createTextNode('显示'));
      item.append(label);

      item.addEventListener('dragstart', function () {
        draggedChartId = id;
        item.classList.add('is-dragging');
      });
      item.addEventListener('dragend', function () {
        draggedChartId = null;
        item.classList.remove('is-dragging');
      });
      item.addEventListener('dragover', function (event) { event.preventDefault(); });
      item.addEventListener('drop', function (event) {
        event.preventDefault();
        moveChartBefore(draggedChartId, id);
        renderConfigList();
      });
      refs.configList.append(item);
    });
  }

  function populateRangeSelect(select, selected) {
    select.replaceChildren();
    Object.keys(RANGES).forEach(function (key) {
      select.append(new Option(RANGES[key].label, key));
    });
    select.value = selected;
  }

  function showDetail(id) {
    activeDetailId = id;
    var chart = chartById(id);
    refs.detailTitle.textContent = chart && chart.title || TITLES[id];
    refs.detailHelp.textContent = DESCRIPTIONS[id] || '暂无说明。';
    refs.detailSource.href = chart && chart.sourceUrl || '#';
    refs.detailSource.hidden = !(chart && chart.sourceUrl);
    refs.detailRange.value = refs.range.value;
    renderDetail();
    refs.detailDialog.showModal();
    refs.detailClose.focus({ preventScroll: true });
  }

  function renderDetail() {
    var chart = filteredChart(chartById(activeDetailId), refs.detailRange.value);
    if (!chart || !chart.items.length) {
      refs.detailMessage.textContent = chart && chart.error || '当前时间范围暂无数据。';
      refs.detailHighValue.textContent = '--';
      refs.detailHighDate.textContent = '--';
      refs.detailLowValue.textContent = '--';
      refs.detailLowDate.textContent = '--';
      renderEmpty(refs.detailChart, '暂无可绘制的数据');
      return;
    }
    var highest = chart.items.reduce(function (best, item) { return item.value > best.value ? item : best; });
    var lowest = chart.items.reduce(function (best, item) { return item.value < best.value ? item : best; });
    refs.detailMessage.textContent = rangeSummary(chart);
    refs.detailHighValue.textContent = formatValue(chart, highest.value);
    refs.detailHighDate.textContent = formatDate(highest.date, chart.frequency);
    refs.detailLowValue.textContent = formatValue(chart, lowest.value);
    refs.detailLowDate.textContent = formatDate(lowest.date, chart.frequency);
    renderLineChart(refs.detailChart, chart);
  }

  function showCompare() {
    var ids = activeChartIds();
    refs.compareFirst.replaceChildren();
    refs.compareSecond.replaceChildren();
    ids.forEach(function (id) {
      refs.compareFirst.append(new Option(TITLES[id], id));
      refs.compareSecond.append(new Option(TITLES[id], id));
    });
    refs.compareFirst.value = ids[0] || '';
    refs.compareSecond.value = ids[1] || ids[0] || '';
    refs.compareRange.value = refs.range.value;
    renderComparison();
    refs.compareDialog.showModal();
  }

  function renderComparison() {
    var firstId = refs.compareFirst.value;
    var secondId = refs.compareSecond.value;
    if (!firstId || !secondId || firstId === secondId) {
      refs.compareMessage.textContent = '请选择两个不同的指标。';
      renderEmpty(refs.compareChart, '请选择两个不同的指标');
      return;
    }
    var first = filteredChart(chartById(firstId), refs.compareRange.value);
    var second = filteredChart(chartById(secondId), refs.compareRange.value);
    if (!first || !second || !first.items.length || !second.items.length) {
      refs.compareMessage.textContent = '所选指标在当前时间范围内暂无完整数据。';
      renderEmpty(refs.compareChart, '所选指标暂无可对比数据');
      return;
    }

    var width = 900;
    var height = 390;
    var box = { left: 82, top: 52, width: 736, height: 278 };
    var allDates = first.items.concat(second.items).map(function (item) {
      return Date.parse(item.date + 'T00:00:00Z');
    });
    var domainX = [Math.min.apply(null, allDates), Math.max.apply(null, allDates)];
    if (domainX[0] === domainX[1]) domainX[1] += 86400000;
    var firstY = extent(first.items.map(function (item) { return item.value; }));
    var secondY = extent(second.items.map(function (item) { return item.value; }));

    refs.compareChart.replaceChildren();
    refs.compareChart.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    for (var index = 0; index <= 4; index += 1) {
      var ratio = index / 4;
      var y = box.top + ratio * box.height;
      refs.compareChart.append(createSvg('line', {
        x1: box.left, y1: y, x2: box.left + box.width, y2: y, class: 'chart-grid'
      }));
      var leftLabel = createSvg('text', {
        x: box.left - 10, y: y + 4, class: 'chart-label overall-compare-label-left', 'text-anchor': 'end'
      });
      leftLabel.textContent = axisValue(firstY[1] - ratio * (firstY[1] - firstY[0]));
      var rightLabel = createSvg('text', {
        x: box.left + box.width + 10, y: y + 4, class: 'chart-label overall-compare-label-right', 'text-anchor': 'start'
      });
      rightLabel.textContent = axisValue(secondY[1] - ratio * (secondY[1] - secondY[0]));
      refs.compareChart.append(leftLabel, rightLabel);
    }
    var leftTitle = createSvg('text', {
      x: box.left, y: 25, class: 'overall-compare-label-left', 'font-weight': 700
    });
    leftTitle.textContent = first.title + '（' + first.unit + '）';
    var rightTitle = createSvg('text', {
      x: box.left + box.width, y: 25, class: 'overall-compare-label-right',
      'font-weight': 700, 'text-anchor': 'end'
    });
    rightTitle.textContent = second.title + '（' + second.unit + '）';
    refs.compareChart.append(leftTitle, rightTitle);
    refs.compareChart.append(createSvg('path', {
      d: linePath(first.items, box, domainX, firstY), class: 'overall-compare-line-left'
    }));
    refs.compareChart.append(createSvg('path', {
      d: linePath(second.items, box, domainX, secondY), class: 'overall-compare-line-right'
    }));
    var startLabel = createSvg('text', {
      x: box.left, y: height - 22, class: 'chart-label', 'text-anchor': 'start'
    });
    startLabel.textContent = formatDate(new Date(domainX[0]).toISOString().slice(0, 10));
    var endLabel = createSvg('text', {
      x: box.left + box.width, y: height - 22, class: 'chart-label', 'text-anchor': 'end'
    });
    endLabel.textContent = formatDate(new Date(domainX[1]).toISOString().slice(0, 10));
    refs.compareChart.append(startLabel, endLabel);
    refs.compareMessage.textContent = RANGES[refs.compareRange.value].label + ' · 左右双轴独立缩放';
  }

  function renderGroups() {
    refs.groupsList.replaceChildren();
    config.groups.forEach(function (group) {
      var card = createElement('section', 'overall-group-item');
      var header = createElement('div', 'overall-group-item-header');
      if (group.id === 'default') {
        header.append(createElement('strong', '', group.name));
        header.append(createElement('span', 'overall-group-fixed-badge', '固定分组'));
      } else {
        var input = document.createElement('input');
        input.className = 'level-select overall-group-name-input';
        input.value = group.name;
        input.maxLength = 40;
        input.addEventListener('change', function () {
          var name = input.value.trim();
          if (!name) {
            input.value = group.name;
            return;
          }
          group.name = name;
          persistConfig();
          syncGroups();
        });
        var remove = createElement('button', 'secondary-button danger-button', '删除');
        remove.type = 'button';
        remove.addEventListener('click', function () {
          if (!window.confirm('删除分组“' + group.name + '”？图表本身不会被删除。')) return;
          config.groups = config.groups.filter(function (item) { return item.id !== group.id; });
          delete config.groupChartOrder[group.id];
          CHART_IDS.forEach(function (id) {
            config.chartGroups[id] = config.chartGroups[id].filter(function (groupId) { return groupId !== group.id; });
          });
          if (config.selectedGroupId === group.id) config.selectedGroupId = 'default';
          persistConfig();
          syncGroups();
          renderGroups();
          renderAll();
        });
        header.append(input, remove);
      }
      card.append(header);
      card.append(createElement('p', 'overall-group-members-title', group.id === 'default' ? '默认分组包含全部图表' : '选择此分组包含的图表'));
      var members = createElement('div', 'overall-group-members');
      CHART_IDS.forEach(function (id) {
        var label = document.createElement('label');
        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = config.chartGroups[id].includes(group.id);
        checkbox.disabled = group.id === 'default';
        checkbox.addEventListener('change', function () {
          if (checkbox.checked) {
            config.chartGroups[id] = Array.from(new Set(config.chartGroups[id].concat(group.id)));
            var order = config.groupChartOrder[group.id] || [];
            if (!order.includes(id)) order.push(id);
            config.groupChartOrder[group.id] = order;
          } else {
            config.chartGroups[id] = config.chartGroups[id].filter(function (groupId) { return groupId !== group.id; });
            config.groupChartOrder[group.id] = (config.groupChartOrder[group.id] || []).filter(function (chartId) { return chartId !== id; });
          }
          persistConfig();
          renderAll();
        });
        label.append(checkbox, document.createTextNode(TITLES[id]));
        members.append(label);
      });
      card.append(members);
      refs.groupsList.append(card);
    });
  }

  function addGroup() {
    var name = refs.newGroupName.value.trim();
    if (!name) {
      refs.groupsMessage.textContent = '请输入分组名称。';
      return;
    }
    var id = 'group-' + Date.now().toString(36);
    config.groups.push({ id: id, name: name.slice(0, 40) });
    config.groupChartOrder[id] = [];
    config.selectedGroupId = id;
    refs.newGroupName.value = '';
    refs.groupsMessage.textContent = '已新增分组“' + name.slice(0, 40) + '”。';
    persistConfig();
    syncGroups();
    renderGroups();
    renderAll();
  }

  async function loadData(fresh, button) {
    var control = button || refs.refresh;
    control.disabled = true;
    if (!data) refs.meta.textContent = '正在加载宏观、资产与汇率数据...';
    try {
      var url = 'data/outlook.json' + (fresh ? '?v=' + Date.now() : '');
      var response = await fetch(url, { cache: fresh ? 'no-store' : 'default' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      var payload = await response.json();
      if (!payload || !Array.isArray(payload.charts)) throw new Error('数据格式无效');
      data = payload;
      renderAll();
    } catch (error) {
      refs.meta.textContent = data
        ? '刷新失败，继续显示上一次成功加载的数据。'
        : '数据加载失败，请稍后刷新页面。';
      if (!data) {
        refs.grid.replaceChildren(createElement('p', 'fatal-message', '无法读取已发布的数据：' + error.message));
      }
    } finally {
      control.disabled = false;
    }
  }

  function exportConfig() {
    var payload = {
      exportedAt: new Date().toISOString(),
      overallSituation: config
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'daily-review-config.json';
    anchor.click();
    URL.revokeObjectURL(url);
    refs.configMessage.textContent = '配置已导出。';
  }

  async function importConfig(file) {
    try {
      config = sanitizeConfig(JSON.parse(await file.text()));
      persistConfig();
      syncGroups();
      refs.columns.value = String(config.chartsPerRow);
      renderConfigList();
      renderAll();
      refs.configMessage.textContent = '配置已导入。';
    } catch (error) {
      refs.configMessage.textContent = '配置文件无效，请选择此前导出的 JSON 文件。';
    } finally {
      refs.configFile.value = '';
    }
  }

  function exportDisplayConfig() {
    var payload = { version: 1, displayControls: { chartLineWidth: normalizeLineWidth(refs.lineWidth.value) } };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'daily-review-display-config.json';
    anchor.click();
    URL.revokeObjectURL(url);
    refs.displayMessage.textContent = '显示设置已导出。';
  }

  async function importDisplayConfig(file) {
    try {
      var parsed = JSON.parse(await file.text());
      var source = parsed && parsed.displayControls || parsed;
      var width = Number(source && source.chartLineWidth);
      if (!Number.isFinite(width) || width < 1 || width > 6 || width * 2 % 1 !== 0) {
        throw new Error('invalid line width');
      }
      applyLineWidth(width);
      refs.displayMessage.textContent = '已上传显示设置：图表线条 ' + width + ' px。';
    } catch (error) {
      refs.displayMessage.textContent = '显示设置文件无效，线条粗细必须为 1–6，步进为 0.5。';
    } finally {
      refs.displayFile.value = '';
    }
  }

  function bindEvents() {
    refs.range.addEventListener('change', renderAll);
    refs.columns.addEventListener('change', function () {
      config.chartsPerRow = Number(refs.columns.value);
      persistConfig();
      renderCards();
    });
    refs.group.addEventListener('change', function () {
      config.selectedGroupId = refs.group.value;
      persistConfig();
      renderAll();
    });
    refs.refresh.addEventListener('click', function () { loadData(true); });
    refs.viewToggle.addEventListener('click', function () {
      viewMode = viewMode === 'charts' ? 'table' : 'charts';
      syncView();
    });
    refs.manageButton.addEventListener('click', function () {
      renderConfigList();
      refs.configMessage.textContent = '';
      refs.configDialog.showModal();
    });
    refs.compareButton.addEventListener('click', showCompare);
    refs.displayButton.addEventListener('click', function () {
      refs.displayMessage.textContent = '';
      refs.displayDialog.showModal();
      refs.lineWidth.focus({ preventScroll: true });
    });
    refs.lineWidth.addEventListener('input', function () { applyLineWidth(refs.lineWidth.value); });
    document.querySelector('#displayControlsResetButton').addEventListener('click', function () {
      applyLineWidth(DEFAULT_LINE_WIDTH);
      refs.displayMessage.textContent = '已恢复迁移后的默认显示设置。';
    });
    document.querySelector('#displayControlsImportButton').addEventListener('click', function () {
      refs.displayFile.click();
    });
    refs.displayFile.addEventListener('change', function () {
      if (refs.displayFile.files[0]) importDisplayConfig(refs.displayFile.files[0]);
    });
    document.querySelector('#displayControlsExportButton').addEventListener('click', exportDisplayConfig);
    refs.groupsButton.addEventListener('click', function () {
      renderGroups();
      refs.groupsMessage.textContent = '';
      refs.groupsDialog.showModal();
    });
    document.querySelector('#overallCompareRunButton').addEventListener('click', renderComparison);
    refs.compareRange.addEventListener('change', renderComparison);
    refs.detailRange.addEventListener('change', renderDetail);
    document.querySelector('#overallAddGroupButton').addEventListener('click', addGroup);
    refs.newGroupName.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') addGroup();
    });
    document.querySelector('#overallImportConfigButton').addEventListener('click', function () {
      refs.configFile.click();
    });
    refs.configFile.addEventListener('change', function () {
      if (refs.configFile.files[0]) importConfig(refs.configFile.files[0]);
    });
    document.querySelector('#overallExportConfigButton').addEventListener('click', exportConfig);
    document.querySelector('#overallResetConfigButton').addEventListener('click', function () {
      if (!window.confirm('恢复默认图表、顺序和分组设置？')) return;
      config = sanitizeConfig(clone(DEFAULT_CONFIG));
      persistConfig();
      syncGroups();
      refs.columns.value = String(config.chartsPerRow);
      renderConfigList();
      renderAll();
      refs.configMessage.textContent = '已恢复默认配置。';
    });
    document.querySelectorAll('[data-close]').forEach(function (button) {
      button.addEventListener('click', function () {
        document.querySelector('#' + button.dataset.close).close();
      });
    });
  }

  function initialize() {
    applyLineWidth(localStorage.getItem(LINE_WIDTH_STORAGE_KEY), false);
    syncGroups();
    refs.columns.value = String(config.chartsPerRow);
    populateRangeSelect(refs.compareRange, refs.range.value);
    populateRangeSelect(refs.detailRange, refs.range.value);
    bindEvents();
    syncView();
    loadData(false);
    syncSharedLocalConfig();
  }

  initialize();
}());
