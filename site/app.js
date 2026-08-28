(function () {
  'use strict';

  var CHART_IDS = [
    'treasuryYield', 'treasuryYield30', 'federalFundsRate', 'cpi', 'pce', 'gold', 'silver', 'centralBankGoldPurchases', 'bitcoin',
    'federalDebt', 'jpyUsd', 'brentOil', 'wtiOil', 'copper', 'naturalGas', 'aShareTurnover', 'aShareMarginBalance', 'aShareActiveMarketValueThs', 'aShareSentimentThs', 'filmCinemaShareholders',
    'nasdaq100Pe', 'ndx', 'sp500', 'vix', 'treasurySpread',
    'highYieldSpread', 'broadDollar', 'ismManufacturingPmi', 'ismSupplierDeliveries', 'ismNewOrders', 'ismBacklogOrders',
    'initialClaims', 'unemploymentRate', 'financialConditions'
  ];

  var TITLES = {
    treasuryYield: '美国 10 年期国债收益率',
    treasuryYield30: '美国 30 年期国债收益率',
    federalFundsRate: '美联储有效联邦基金利率',
    cpi: '美国 CPI 同比',
    pce: '美国 PCE 同比',
    gold: '黄金价格',
    silver: '全球白银价格',
    centralBankGoldPurchases: '全球央行净购金量',
    bitcoin: '比特币价格',
    federalDebt: '美国联邦债务总额',
    jpyUsd: '日元兑美元汇率',
    brentOil: '布伦特原油价格',
    wtiOil: 'WTI 原油价格',
    copper: '全球铜价',
    naturalGas: 'Henry Hub 天然气价格',
    aShareTurnover: 'A股全A成交额',
    aShareMarginBalance: 'A股融资余额（三市）',
    aShareActiveMarketValueThs: 'A股活跃市值（同花顺公式版）',
    aShareSentimentThs: '同花顺情绪指数',
    filmCinemaShareholders: '影视院线成分股股东人数',
    nasdaq100Pe: '纳斯达克100市盈率（NDX）',
    ndx: 'NDX（纳斯达克100指数）',
    sp500: '标普500指数（SPX）',
    vix: 'VIX恐慌指数',
    treasurySpread: '美国10年-2年国债利差',
    highYieldSpread: '美国高收益债信用利差',
    broadDollar: '美元指数（DXY）',
    ismManufacturingPmi: '美国 ISM 制造业 PMI',
    ismSupplierDeliveries: '美国 ISM 供应商交付指数',
    ismNewOrders: '美国 ISM 新订单指数',
    ismBacklogOrders: '美国 ISM 订单积压指数',
    initialClaims: '美国初次申请失业金人数',
    unemploymentRate: '美国失业率',
    financialConditions: '美国金融状况指数'
  };

  var CATEGORIES = {
    treasuryYield: '利率',
    treasuryYield30: '长期利率',
    federalFundsRate: '政策利率',
    cpi: '通胀',
    pce: '通胀',
    gold: '避险资产',
    silver: '贵金属',
    centralBankGoldPurchases: '官方黄金需求',
    bitcoin: '数字资产',
    federalDebt: '财政',
    jpyUsd: '外汇',
    brentOil: '能源',
    wtiOil: '能源',
    copper: '工业金属',
    naturalGas: '能源',
    aShareTurnover: 'A股市场',
    aShareMarginBalance: 'A股杠杆资金',
    aShareActiveMarketValueThs: 'A股市场活跃度',
    aShareSentimentThs: 'A股市场情绪',
    filmCinemaShareholders: '影视院线',
    nasdaq100Pe: '美股估值',
    ndx: '美股指数',
    sp500: '美股指数',
    vix: '风险偏好',
    treasurySpread: '利率曲线',
    highYieldSpread: '信用风险',
    broadDollar: '美元流动性',
    ismManufacturingPmi: '制造业景气',
    ismSupplierDeliveries: '供应链',
    ismNewOrders: '制造业订单',
    ismBacklogOrders: '制造业订单',
    initialClaims: '就业',
    unemploymentRate: '就业',
    financialConditions: '金融压力'
  };

  var DESCRIPTIONS = {
    treasuryYield: '美国 10 年期国债的市场收益率，是长期无风险利率和资产定价的重要基准。上升通常意味着融资成本与估值折现率提高。',
    treasuryYield30: '美国 30 年期国债的市场收益率，反映更长期的利率、通胀和期限风险预期，对长期资产的利率变化更敏感。',
    federalFundsRate: '美国存款类机构隔夜无担保联邦基金交易的成交量加权中位利率，由纽约联储计算。本图使用日度有效联邦基金利率（EFFR），用于观察美联储政策利率实际运行水平。',
    cpi: '美国消费者价格指数（CPI）的同比涨幅，衡量居民购买的一篮子商品和服务相对一年前的价格变化。',
    pce: '美国个人消费支出价格指数（PCE）的同比涨幅。本图为总体 PCE，而非核心 PCE。',
    gold: '伦敦现货黄金的美元价格，单位为美元/盎司，常受实际利率、美元、通胀预期和避险需求影响。',
    silver: 'IMF 全球白银基准价的月度平均值，单位为美元/盎司。白银同时具有贵金属与工业原料属性，价格会受到美元、实际利率和工业需求影响。',
    centralBankGoldPurchases: '世界黄金协会按季度统计的全球央行及其他官方机构净购金量，即买入量减去卖出量，剔除互换与 Delta 对冲影响。正值表示净买入，负值表示净卖出，单位为吨。',
    bitcoin: '比特币兑美元的市场价格。该资产全天候交易、波动较大，通常受流动性、风险偏好、监管和资金流入影响。',
    federalDebt: '美国财政部记录的联邦债务总额，包括公众持有债务和政府内部持有债务，单位换算为万亿美元。',
    jpyUsd: '一美元可兑换的日元数量。数值上升表示美元兑日元走强、日元贬值；数值下降表示日元升值。',
    brentOil: '主序列为 EIA 布伦特原油日度现货价。现货数据尚未发布的最近日期，使用 Brent 近月期货相对最后重叠日的涨跌幅推算临时值，以虚线显示；EIA 发布后自动替换。',
    wtiOil: '主序列为 EIA WTI 原油日度现货价。现货数据尚未发布的最近日期，使用 WTI 近月期货相对最后重叠日的涨跌幅推算临时值，以虚线显示；EIA 发布后自动替换。',
    copper: 'IMF 全球铜基准价的月度平均值，单位为美元/吨。铜对制造业、建筑、电网和新能源需求较敏感，常用于观察全球工业周期。',
    naturalGas: '美国路易斯安那州 Henry Hub 天然气日度现货价格，单位为美元/MMBtu，由美国能源信息署 EIA 发布。',
    aShareTurnover: 'A 股全市场当日成交金额，单位为亿元。它主要反映市场交易活跃度和资金参与度，不直接代表指数涨跌方向。',
    aShareMarginBalance: '沪、深、北三市融资余额合计，单位为亿元，表示投资者尚未偿还的融资买入金额。余额上升通常代表杠杆资金净流入，但不等同于市场一定上涨。',
    aShareActiveMarketValueThs: '按同花顺指标平台公开用户公式计算：上证指数与深证综指成交额之和，再取 SMA(10,1)，单位为亿元。它是可复现的成交活跃度平滑指标，并非指南针原版 0AMV，也不是同花顺官方统一指数。',
    aShareSentimentThs: '同花顺官方情绪指数（883404）的日度收盘点位，用于观察 A 股市场情绪变化。该指数历史自 2022 年 8 月开始，点位高低应结合自身历史区间比较。',
    filmCinemaShareholders: '同花顺影视院线（881274）全部成分股的季度股东人数和当前流通市值。总表支持季度翻页与排序；点击股票可查看股东人数及连续周线收盘价双轴历史。',
    nasdaq100Pe: '纳斯达克 100 指数的滚动市盈率（TTM），即指数市值相对过去 12 个月盈利的倍数，用于观察估值高低。',
    ndx: '纳斯达克 100 指数点位，覆盖纳斯达克上市的主要非金融公司，科技和成长型公司的权重较高。',
    sp500: '标普 500 指数点位，覆盖美国约 500 家大型上市公司，是衡量美国大盘股表现的核心基准之一。',
    vix: '由标普 500 期权价格推算的未来约 30 天预期波动率。数值越高，通常表示市场不确定性和避险情绪越强。',
    treasurySpread: '美国 10 年期与 2 年期国债收益率之差。负值代表收益率曲线倒挂。',
    highYieldSpread: '美国高收益债相对同期限美国国债的期权调整利差。利差扩大通常表示信用风险和融资压力上升。',
    broadDollar: 'ICE 美元指数（DXY），由欧元、日元、英镑、加元、瑞典克朗和瑞士法郎六种货币构成，不含人民币。本图使用 FRED H.10 双边汇率按 ICE 固定权重公式重建，数值上升表示美元相对该货币篮子走强。',
    ismManufacturingPmi: '美国供应管理协会（ISM）制造业采购经理人综合扩散指数。高于 50 通常表示制造业活动扩张，低于 50 表示收缩。',
    ismSupplierDeliveries: '美国 ISM 制造业供应商交付扩散指数。该分项方向与一般速度指标相反：高于 50 表示交付变慢，低于 50 表示交付加快。',
    ismNewOrders: '美国 ISM 制造业新订单扩散指数，衡量受访企业新订单相对上月的变化。高于 50 表示新订单总体增加，低于 50 表示减少。',
    ismBacklogOrders: '美国 ISM 制造业订单积压扩散指数，衡量尚未完成订单相对上月的变化。高于 50 表示积压增加，低于 50 表示积压减少。',
    initialClaims: '美国每周首次申请失业保险的人数，是观察裁员和劳动力市场转弱的高频领先指标。',
    unemploymentRate: '美国劳工统计局按月公布的季节调整失业率，表示失业人口占劳动力人口的比例。上升通常意味着劳动力市场走弱。',
    financialConditions: '芝加哥联储金融状况指数（NFCI）。零值附近代表历史平均，正值偏紧，负值偏松。'
  };

  var COLORS = {
    treasuryYield: '#1f5fd2',
    treasuryYield30: '#1685a9',
    federalFundsRate: '#7048a8',
    cpi: '#c23b3b',
    pce: '#7c3aed',
    gold: '#b7791f',
    silver: '#64748b',
    centralBankGoldPurchases: '#9a6a16',
    bitcoin: '#e67e00',
    federalDebt: '#256f5b',
    jpyUsd: '#b3336f',
    brentOil: '#52606d',
    wtiOil: '#8a5a2b',
    copper: '#b05a2a',
    naturalGas: '#2d7d5f',
    aShareTurnover: '#b84f16',
    aShareMarginBalance: '#0f766e',
    aShareActiveMarketValueThs: '#c2410c',
    aShareSentimentThs: '#d9465f',
    filmCinemaShareholders: '#7c3aed',
    nasdaq100Pe: '#6a42c2',
    ndx: '#335cc7',
    sp500: '#16806a',
    vix: '#d14343',
    treasurySpread: '#5b66c9',
    highYieldSpread: '#9a5c1f',
    broadDollar: '#367493',
    ismManufacturingPmi: '#7c3aed',
    ismSupplierDeliveries: '#0f766e',
    ismNewOrders: '#2563eb',
    ismBacklogOrders: '#c2410c',
    initialClaims: '#7e57a6',
    unemploymentRate: '#b45309',
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
    year7: { label: '7年', months: 84 },
    year10: { label: '10年', months: 120 },
    year15: { label: '15年', months: 180 },
    year20: { label: '20年', months: 240 },
    year25: { label: '25年', months: 300 },
    year30: { label: '30年', months: 360 }
  };

  var STORAGE_KEY = 'daily-review.overall-situation-config.v2';
  var GROUP_ORDER_VERSION = 1;
  var LINE_WIDTH_STORAGE_KEY = 'daily-review.chart-line-width.v1';
  var QUARTER_POINT_SIZE_STORAGE_KEY = 'daily-review.quarter-point-size.v1';
  var DEFAULT_LINE_WIDTH = 1;
  var DEFAULT_QUARTER_POINT_SIZE = 4.5;
  var quarterlyPointSize = DEFAULT_QUARTER_POINT_SIZE;
  var DEFAULT_CONFIG = {
    groupOrderVersion: GROUP_ORDER_VERSION,
    chartsPerRow: 4,
    chartOrder: [
      'treasuryYield30', 'federalFundsRate', 'jpyUsd', 'gold', 'silver', 'centralBankGoldPurchases', 'aShareTurnover', 'aShareMarginBalance', 'aShareActiveMarketValueThs', 'aShareSentimentThs', 'filmCinemaShareholders', 'federalDebt',
      'cpi', 'pce', 'ismManufacturingPmi', 'ismSupplierDeliveries', 'ismNewOrders', 'ismBacklogOrders',
      'bitcoin', 'brentOil', 'wtiOil', 'naturalGas', 'copper', 'nasdaq100Pe', 'ndx',
      'sp500', 'vix', 'treasurySpread', 'highYieldSpread', 'broadDollar',
      'initialClaims', 'unemploymentRate', 'financialConditions', 'treasuryYield'
    ],
    groupChartOrder: {
      default: [
        'treasuryYield30', 'federalFundsRate', 'jpyUsd', 'gold', 'silver', 'centralBankGoldPurchases', 'aShareTurnover', 'aShareMarginBalance', 'aShareActiveMarketValueThs', 'aShareSentimentThs', 'filmCinemaShareholders', 'federalDebt',
        'cpi', 'pce', 'ismManufacturingPmi', 'ismSupplierDeliveries', 'ismNewOrders', 'ismBacklogOrders',
        'bitcoin', 'brentOil', 'wtiOil', 'naturalGas', 'copper', 'nasdaq100Pe', 'ndx',
        'sp500', 'vix', 'treasurySpread', 'highYieldSpread', 'broadDollar',
        'initialClaims', 'unemploymentRate', 'financialConditions', 'treasuryYield'
      ],
      group_mt432xl1_kz1mx7: [
        'treasuryYield30', 'federalFundsRate', 'vix', 'ndx', 'sp500', 'nasdaq100Pe',
        'federalDebt', 'cpi', 'pce', 'ismManufacturingPmi', 'ismSupplierDeliveries', 'ismNewOrders', 'ismBacklogOrders',
        'treasurySpread', 'highYieldSpread',
        'initialClaims', 'unemploymentRate', 'broadDollar', 'financialConditions', 'treasuryYield'
      ],
      group_mt49f5yl_pctlb6: ['gold', 'silver', 'centralBankGoldPurchases', 'brentOil', 'wtiOil', 'naturalGas', 'copper'],
      group_a_share: ['aShareTurnover', 'aShareMarginBalance', 'aShareActiveMarketValueThs', 'aShareSentimentThs', 'filmCinemaShareholders'],
      group_primary: ['treasuryYield30', 'cpi', 'unemploymentRate', 'gold', 'sp500', 'brentOil', 'federalFundsRate', 'copper', 'centralBankGoldPurchases'],
      group_us_manufacturing: ['ismManufacturingPmi', 'ismSupplierDeliveries', 'ismNewOrders', 'ismBacklogOrders']
    },
    visibleChartIds: [
      'treasuryYield30', 'federalFundsRate', 'jpyUsd', 'gold', 'silver', 'centralBankGoldPurchases', 'aShareTurnover', 'aShareMarginBalance', 'aShareActiveMarketValueThs', 'aShareSentimentThs', 'filmCinemaShareholders', 'federalDebt',
      'cpi', 'pce', 'ismManufacturingPmi', 'ismSupplierDeliveries', 'ismNewOrders', 'ismBacklogOrders',
      'bitcoin', 'brentOil', 'wtiOil', 'naturalGas', 'copper', 'nasdaq100Pe', 'ndx',
      'sp500', 'vix', 'treasurySpread', 'highYieldSpread', 'broadDollar',
      'initialClaims', 'unemploymentRate', 'financialConditions'
    ],
    groups: [
      { id: 'group_primary', name: '主要' },
      { id: 'group_us_manufacturing', name: '美国制造' },
      { id: 'default', name: '默认' },
      { id: 'group_mt432xl1_kz1mx7', name: '美国' },
      { id: 'group_mt49f5yl_pctlb6', name: '资源' },
      { id: 'group_a_share', name: 'A股' }
    ],
    chartGroups: {
      treasuryYield: ['default', 'group_mt432xl1_kz1mx7'],
      treasuryYield30: ['default', 'group_mt432xl1_kz1mx7', 'group_primary'],
      federalFundsRate: ['default', 'group_mt432xl1_kz1mx7', 'group_primary'],
      cpi: ['default', 'group_mt432xl1_kz1mx7', 'group_primary'],
      pce: ['default', 'group_mt432xl1_kz1mx7'],
      gold: ['default', 'group_mt49f5yl_pctlb6', 'group_primary'],
      silver: ['default', 'group_mt49f5yl_pctlb6'],
      centralBankGoldPurchases: ['default', 'group_mt49f5yl_pctlb6', 'group_primary'],
      bitcoin: ['default'],
      federalDebt: ['default', 'group_mt432xl1_kz1mx7'],
      jpyUsd: ['default'],
      brentOil: ['default', 'group_mt49f5yl_pctlb6', 'group_primary'],
      wtiOil: ['default', 'group_mt49f5yl_pctlb6'],
      copper: ['default', 'group_mt49f5yl_pctlb6', 'group_primary'],
      naturalGas: ['default', 'group_mt49f5yl_pctlb6'],
      aShareTurnover: ['default', 'group_a_share'],
      aShareMarginBalance: ['default', 'group_a_share'],
      aShareActiveMarketValueThs: ['default', 'group_a_share'],
      aShareSentimentThs: ['default', 'group_a_share'],
      filmCinemaShareholders: ['default', 'group_a_share'],
      nasdaq100Pe: ['default', 'group_mt432xl1_kz1mx7'],
      ndx: ['default', 'group_mt432xl1_kz1mx7'],
      sp500: ['default', 'group_mt432xl1_kz1mx7', 'group_primary'],
      vix: ['default', 'group_mt432xl1_kz1mx7'],
      treasurySpread: ['default', 'group_mt432xl1_kz1mx7'],
      highYieldSpread: ['default', 'group_mt432xl1_kz1mx7'],
      broadDollar: ['default', 'group_mt432xl1_kz1mx7'],
      ismManufacturingPmi: ['default', 'group_mt432xl1_kz1mx7', 'group_us_manufacturing'],
      ismSupplierDeliveries: ['default', 'group_mt432xl1_kz1mx7', 'group_us_manufacturing'],
      ismNewOrders: ['default', 'group_mt432xl1_kz1mx7', 'group_us_manufacturing'],
      ismBacklogOrders: ['default', 'group_mt432xl1_kz1mx7', 'group_us_manufacturing'],
      initialClaims: ['default', 'group_mt432xl1_kz1mx7'],
      unemploymentRate: ['default', 'group_mt432xl1_kz1mx7', 'group_primary'],
      financialConditions: ['default', 'group_mt432xl1_kz1mx7']
    },
    selectedGroupId: 'group_mt432xl1_kz1mx7'
  };

  var data = null;
  var config = loadConfig();
  var viewMode = 'charts';
  var activeDetailId = null;
  var activeShareholderCode = null;
  var activeShareholderTableQuarterDate = null;
  var shareholderSortKey = null;
  var shareholderSortDirection = null;
  var draggedChartId = null;
  var draggedGroupId = null;
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
    detailRangeControl: document.querySelector('#overallDetailRangeControl'),
    detailRange: document.querySelector('#overallDetailRangeSelect'),
    detailMessage: document.querySelector('#overallDetailMessage'),
    detailHighValue: document.querySelector('#overallDetailHighValue'),
    detailHighDate: document.querySelector('#overallDetailHighDate'),
    detailLowValue: document.querySelector('#overallDetailLowValue'),
    detailLowDate: document.querySelector('#overallDetailLowDate'),
    detailExtremes: document.querySelector('#overallDetailExtremes'),
    detailStockTableWrap: document.querySelector('#overallDetailStockTableWrap'),
    detailStockTableBody: document.querySelector('#overallDetailStockTableBody'),
    shareholderTableQuarter: document.querySelector('#shareholderTableQuarterSelect'),
    shareholderTablePreviousQuarter: document.querySelector('#shareholderTablePreviousQuarterButton'),
    shareholderTableNextQuarter: document.querySelector('#shareholderTableNextQuarterButton'),
    shareholderBarChartsButton: document.querySelector('#shareholderBarChartsButton'),
    shareholderSortHeader: document.querySelector('#shareholderCountSortHeader'),
    shareholderSortButton: document.querySelector('#shareholderCountSortButton'),
    shareholderChangeSortHeader: document.querySelector('#shareholderChangeSortHeader'),
    shareholderChangeSortButton: document.querySelector('#shareholderChangeSortButton'),
    shareholderMarketCapSortHeader: document.querySelector('#shareholderMarketCapSortHeader'),
    shareholderMarketCapSortButton: document.querySelector('#shareholderMarketCapSortButton'),
    detailChart: document.querySelector('#overallDetailChart'),
    detailSource: document.querySelector('#overallDetailSourceLink'),
    shareholderDialog: document.querySelector('#shareholderHistoryDialog'),
    shareholderClose: document.querySelector('#shareholderHistoryCloseButton'),
    shareholderTitle: document.querySelector('#shareholderHistoryTitle'),
    shareholderRange: document.querySelector('#shareholderHistoryRangeSelect'),
    shareholderMessage: document.querySelector('#shareholderHistoryMessage'),
    shareholderChart: document.querySelector('#shareholderHistoryChart'),
    shareholderBarsDialog: document.querySelector('#shareholderBarChartsDialog'),
    shareholderBarsClose: document.querySelector('#shareholderBarChartsCloseButton'),
    shareholderBarsSort: document.querySelector('#shareholderBarChartsSortSelect'),
    shareholderBarsColumns: document.querySelector('#shareholderBarChartsColumnsSelect'),
    shareholderBarsMessage: document.querySelector('#shareholderBarChartsMessage'),
    shareholderBarsGrid: document.querySelector('#shareholderBarChartsGrid'),
    groupsDialog: document.querySelector('#overallGroupsDialog'),
    groupsList: document.querySelector('#overallGroupsList'),
    groupsMessage: document.querySelector('#overallGroupsMessage'),
    newGroupName: document.querySelector('#overallNewGroupName'),
    groupOrderDialog: document.querySelector('#overallGroupOrderDialog'),
    groupOrderList: document.querySelector('#overallGroupOrderList'),
    displayDialog: document.querySelector('#displayControlsDialog'),
    lineWidth: document.querySelector('#chartLineWidthInput'),
    lineWidthOutput: document.querySelector('#chartLineWidthOutput'),
    quarterPointSize: document.querySelector('#quarterPointSizeInput'),
    quarterPointSizeOutput: document.querySelector('#quarterPointSizeOutput'),
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

  function normalizeQuarterPointSize(value) {
    if (value === null || value === undefined || value === '') return DEFAULT_QUARTER_POINT_SIZE;
    var parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_QUARTER_POINT_SIZE;
    return Math.min(10, Math.max(2, Math.round(parsed * 2) / 2));
  }

  function applyQuarterPointSize(value, persist) {
    quarterlyPointSize = normalizeQuarterPointSize(value);
    refs.quarterPointSize.value = String(quarterlyPointSize);
    refs.quarterPointSizeOutput.value = quarterlyPointSize + ' px';
    refs.quarterPointSizeOutput.textContent = quarterlyPointSize + ' px';
    if (activeDetailId && refs.detailDialog.open) renderDetail();
    if (persist !== false) {
      localStorage.setItem(QUARTER_POINT_SIZE_STORAGE_KEY, String(quarterlyPointSize));
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
    var groupIdAliases = {};
    (Array.isArray(source.groups) ? source.groups : []).forEach(function (group) {
      var id = String(group && group.id || '').trim();
      var name = String(group && group.name || '').trim();
      var matchingBuiltIn = DEFAULT_CONFIG.groups.find(function (item) { return item.name === name; });
      if (id && matchingBuiltIn && id !== matchingBuiltIn.id) {
        groupIdAliases[id] = matchingBuiltIn.id;
      }
    });
    var groups = [];
    var groupIds = new Set();
    var addedDefaultGroupIds = new Set();
    (Array.isArray(source.groups) ? source.groups : []).forEach(function (group) {
      var originalId = String(group && group.id || '').trim();
      var id = groupIdAliases[originalId] || originalId;
      var name = String(group && group.name || '').trim().slice(0, 40);
      if (!id || groupIds.has(id) || !name) return;
      var builtIn = DEFAULT_CONFIG.groups.find(function (item) { return item.id === id; });
      groups.push({ id: id, name: builtIn ? builtIn.name : name });
      groupIds.add(id);
    });
    if (!groupIds.has('default')) {
      groups.unshift({ id: 'default', name: '默认' });
      groupIds.add('default');
    }
    DEFAULT_CONFIG.groups.forEach(function (group) {
      if (groupIds.has(group.id)) return;
      var hasSameName = groups.some(function (item) { return item.name === group.name; });
      if (hasSameName) return;
      groups.push({ id: group.id, name: group.name });
      groupIds.add(group.id);
      addedDefaultGroupIds.add(group.id);
    });
    if (Number(source.groupOrderVersion) !== GROUP_ORDER_VERSION) {
      var defaultGroupIds = DEFAULT_CONFIG.groups.map(function (group) { return group.id; });
      var groupById = new Map(groups.map(function (group) { return [group.id, group]; }));
      groups = defaultGroupIds.map(function (id) { return groupById.get(id); }).filter(Boolean)
        .concat(groups.filter(function (group) { return !defaultGroupIds.includes(group.id); }));
    }

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
        ? source.chartGroups[id].map(function (groupId) { return groupIdAliases[groupId] || groupId; })
          .filter(function (groupId) { return groupIds.has(groupId); })
        : ['default'];
      var migratedMemberships = (DEFAULT_CONFIG.chartGroups[id] || []).filter(function (groupId) {
        return groupIds.has(groupId) && (newlyAddedChartIds.includes(id) || addedDefaultGroupIds.has(groupId));
      });
      chartGroups[id] = Array.from(new Set(['default'].concat(memberships, migratedMemberships)));
    });

    var groupChartOrder = {};
    groups.forEach(function (group) {
      var legacyGroupId = Object.keys(groupIdAliases).find(function (id) { return groupIdAliases[id] === group.id; });
      var sourceOrder = source.groupChartOrder && (source.groupChartOrder[group.id] || source.groupChartOrder[legacyGroupId]);
      var order = uniqueKnown(addedDefaultGroupIds.has(group.id)
        ? DEFAULT_CONFIG.groupChartOrder[group.id]
        : sourceOrder);
      var members = chartOrder.filter(function (id) { return chartGroups[id].includes(group.id); });
      members.forEach(function (id) {
        if (!order.includes(id)) order.push(id);
      });
      groupChartOrder[group.id] = order.filter(function (id) { return members.includes(id); });
    });

    var columns = Number(source.chartsPerRow);
    if (![1, 2, 3, 4].includes(columns)) columns = 3;
    var requestedGroupId = groupIdAliases[source.selectedGroupId] || source.selectedGroupId;
    var selectedGroupId = groupIds.has(requestedGroupId) ? requestedGroupId : 'default';

    return {
      groupOrderVersion: GROUP_ORDER_VERSION,
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
        chartLineWidth: normalizeLineWidth(refs.lineWidth && refs.lineWidth.value),
        quarterPointSize: normalizeQuarterPointSize(refs.quarterPointSize && refs.quarterPointSize.value)
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
      var storedPointSize = storedConfig.displayControls && storedConfig.displayControls.quarterPointSize;
      if (storedPointSize !== undefined) {
        applyQuarterPointSize(storedPointSize, false);
        localStorage.setItem(QUARTER_POINT_SIZE_STORAGE_KEY, String(normalizeQuarterPointSize(storedPointSize)));
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
      .map(function (item) { return Object.assign({}, item, { value: Number(item.value) }); })
      .sort(function (left, right) { return left.date.localeCompare(right.date); });
    if (!items.length) return [];

    var range = RANGES[rangeKey] || RANGES.month3;
    var frequency = chart.frequency || '';
    if (frequency.includes('月')) {
      return Number.isInteger(range.months) ? items.slice(-range.months) : items.slice(-1);
    }
    if (frequency.includes('季')) {
      return Number.isInteger(range.months)
        ? items.slice(-(Math.ceil(range.months / 3) + 1))
        : items.slice(-2);
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
    if (Array.isArray(chart.rightAxisItems)) {
      result.rightAxisItems = filterItems({ items: chart.rightAxisItems, frequency: '周度' }, rangeKey);
    }
    return result;
  }

  function formatDate(dateText, frequency) {
    if (!dateText) return '--';
    var date = new Date(dateText + 'T00:00:00Z');
    if (Number.isNaN(date.getTime())) return dateText;
    if (frequency && frequency.includes('季')) {
      return date.getUTCFullYear() + '年第' + (Math.floor(date.getUTCMonth() / 3) + 1) + '季度';
    }
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

  function axisValue(value, decimals) {
    if (decimals === 0) {
      return Number(value).toLocaleString('zh-CN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      });
    }
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
    var provisionalSuffix = chart.items.some(function (item) { return item.provisional; })
      ? ' · 含期货推算临时值'
      : '';
    if (chart.items.length === 1 || first.value === 0) {
      return formatDate(latest.date, chart.frequency) + ' · 最近可用值' + provisionalSuffix;
    }
    if (chart.changeMode === 'difference') {
      var difference = latest.value - first.value;
      var differenceSign = difference > 0 ? '+' : '';
      var differenceDigits = Number.isInteger(chart.decimals) ? chart.decimals : 1;
      return formatDate(first.date, chart.frequency) + ' 至 ' +
        formatDate(latest.date, chart.frequency) + ' · 区间 ' + differenceSign +
        difference.toFixed(differenceDigits) + ' 点' + provisionalSuffix;
    }
    var change = (latest.value / first.value - 1) * 100;
    var sign = change > 0 ? '+' : '';
    return formatDate(first.date, chart.frequency) + ' 至 ' +
      formatDate(latest.date, chart.frequency) + ' · 区间 ' + sign + change.toFixed(2) + '%' + provisionalSuffix;
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
    var denseRightAxis = Array.isArray(chart.rightAxisItems);
    var rightAxisItems = (denseRightAxis ? chart.rightAxisItems : items.filter(function (item) {
      return hasNumericValue(item.priceValue);
    }).map(function (item) {
      return { date: item.date, value: Number(item.priceValue), priceDate: item.priceDate };
    })).filter(function (item) { return item && item.date && hasNumericValue(item.value); });
    var hasRightAxis = rightAxisItems.length > 0;
    var box = { left: 58, top: 28, width: hasRightAxis ? 382 : 438, height: 198 };
    var values = items.map(function (item) { return item.value; });
    var referenceValue = Number(chart.referenceValue);
    if (Number.isFinite(referenceValue)) values.push(referenceValue);
    var domainY = extent(values);
    var rightDomainY = hasRightAxis ? extent(rightAxisItems.map(function (item) { return item.value; })) : null;
    var singleItem = items.length === 1;
    var firstTimestamp = Date.parse(items[0].date + 'T00:00:00Z');
    var allTimestamps = items.concat(rightAxisItems).map(function (item) { return Date.parse(item.date + 'T00:00:00Z'); });
    var domainX = [Math.min.apply(null, allTimestamps), Math.max.apply(null, allTimestamps)];
    if (singleItem) domainX = [firstTimestamp - 86400000, firstTimestamp + 86400000];
    var color = COLORS[chart.id] || '#1f5fd2';
    var path = linePath(items, box, domainX, domainY);
    var firstProvisionalIndex = items.findIndex(function (item) { return item.provisional; });
    var solidItems = firstProvisionalIndex > 0 ? items.slice(0, firstProvisionalIndex) : items;
    var provisionalItems = firstProvisionalIndex > 0 ? items.slice(firstProvisionalIndex - 1) : [];
    var solidPath = linePath(solidItems, box, domainX, domainY);
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
      yLabel.textContent = axisValue(value, chart.decimals);
      svg.append(yLabel);
      if (hasRightAxis) {
        var rightValue = rightDomainY[1] - ratio * (rightDomainY[1] - rightDomainY[0]);
        var rightLabel = createSvg('text', {
          x: box.left + box.width + 9, y: y + 4, class: 'chart-label shareholder-price-axis-label', 'text-anchor': 'start'
        });
        rightLabel.textContent = axisValue(rightValue, 2);
        svg.append(rightLabel);
      }
    }

    var unit = createSvg('text', { x: box.left, y: 16, class: 'overall-chart-unit' });
    unit.textContent = chart.unit || '';
    svg.append(unit);
    if (hasRightAxis) {
      var rightUnit = createSvg('text', {
        x: box.left + box.width, y: 16, class: 'overall-chart-unit shareholder-price-axis-label', 'text-anchor': 'end'
      });
      rightUnit.textContent = '股价（元）';
      svg.append(rightUnit);
    }

    var isDetailChart = svg === refs.detailChart || svg === refs.shareholderChart;
    var longDetailRange = isDetailChart && domainX[1] - domainX[0] >= 365 * 86400000 * 2.75;
    if (longDetailRange) {
      var firstYear = new Date(domainX[0]).getUTCFullYear();
      var lastYear = new Date(domainX[1]).getUTCFullYear();
      var availableYears = [];
      for (var year = firstYear; year <= lastYear; year += 1) {
        var yearTimestamp = Date.UTC(year, 0, 1);
        if (yearTimestamp >= domainX[0] && yearTimestamp <= domainX[1]) availableYears.push(year);
      }
      var rawYearStep = Math.max(1, Math.ceil(availableYears.length / 8));
      var yearStep = [1, 2, 5, 10, 20, 50].find(function (step) { return step >= rawYearStep; }) || rawYearStep;
      availableYears.filter(function (year) { return year % yearStep === 0; }).forEach(function (year) {
        var yearTimestamp = Date.UTC(year, 0, 1);
        var x = box.left + (yearTimestamp - domainX[0]) / (domainX[1] - domainX[0]) * box.width;
        svg.append(createSvg('line', {
          x1: x, y1: baseline, x2: x, y2: baseline + 5, class: 'overall-chart-year-tick'
        }));
        var yearLabel = createSvg('text', {
          x: x + 3,
          y: height - 7,
          class: 'chart-label overall-chart-year-label',
          'text-anchor': 'start',
          transform: 'rotate(-90 ' + (x + 3) + ' ' + (height - 7) + ')'
        });
        yearLabel.textContent = year + '年';
        svg.append(yearLabel);
      });
    } else {
      var xIndexes = Array.from(new Set([0, Math.floor((items.length - 1) / 2), items.length - 1]));
      xIndexes.forEach(function (itemIndex, labelIndex) {
        var item = items[itemIndex];
        var timestamp = Date.parse(item.date + 'T00:00:00Z');
        var x = box.left + (timestamp - domainX[0]) / (domainX[1] - domainX[0]) * box.width;
        var label = createSvg('text', {
          x: x,
          y: height - 15,
          class: 'chart-label',
          'text-anchor': xIndexes.length === 1 ? 'middle' : labelIndex === 0 ? 'start' : labelIndex === xIndexes.length - 1 ? 'end' : 'middle'
        });
        label.textContent = formatDate(item.date, chart.frequency);
        svg.append(label);
      });
    }

    if (!singleItem) {
      var area = createSvg('path', {
        d: path + ' L' + (box.left + box.width) + ' ' + baseline + ' L' + box.left + ' ' + baseline + ' Z',
        class: 'overall-chart-area'
      });
      area.style.fill = hexToRgba(color, 0.12);
      svg.append(area);
    }

    if (Number.isFinite(referenceValue)) {
      var referenceY = box.top + (1 - (referenceValue - domainY[0]) / (domainY[1] - domainY[0])) * box.height;
      svg.append(createSvg('line', {
        x1: box.left, y1: referenceY, x2: box.left + box.width, y2: referenceY,
        class: 'overall-chart-reference-line'
      }));
      var referenceLabel = createSvg('text', {
        x: box.left + box.width - 4, y: referenceY - 5,
        class: 'overall-chart-reference-label', 'text-anchor': 'end'
      });
      referenceLabel.textContent = chart.referenceLabel || axisValue(referenceValue, chart.decimals);
      svg.append(referenceLabel);
    }

    var line = createSvg('path', { d: solidPath, class: 'overall-chart-line' });
    line.style.stroke = color;
    svg.append(line);
    if (provisionalItems.length > 1) {
      var provisionalLine = createSvg('path', {
        d: linePath(provisionalItems, box, domainX, domainY),
        class: 'overall-chart-line overall-chart-provisional-line'
      });
      provisionalLine.style.stroke = color;
      svg.append(provisionalLine);
      provisionalItems.slice(1).forEach(function (item) {
        var provisionalTime = Date.parse(item.date + 'T00:00:00Z');
        var provisionalX = box.left + (provisionalTime - domainX[0]) / (domainX[1] - domainX[0]) * box.width;
        var provisionalY = box.top + (1 - (item.value - domainY[0]) / (domainY[1] - domainY[0])) * box.height;
        var provisionalPoint = createSvg('circle', {
          cx: provisionalX, cy: provisionalY, r: 3.5, class: 'overall-chart-provisional-point'
        });
        provisionalPoint.style.fill = color;
        svg.append(provisionalPoint);
      });
    }
    var showQuarterlyPoints = chart.frequency && chart.frequency.includes('季') && isDetailChart;
    if (showQuarterlyPoints) {
      items.forEach(function (item) {
        var itemTime = Date.parse(item.date + 'T00:00:00Z');
        var pointX = box.left + (itemTime - domainX[0]) / (domainX[1] - domainX[0]) * box.width;
        var pointY = box.top + (1 - (item.value - domainY[0]) / (domainY[1] - domainY[0])) * box.height;
        var dataPoint = createSvg('circle', {
          cx: pointX, cy: pointY, r: quarterlyPointSize, class: 'overall-chart-data-point'
        });
        dataPoint.style.fill = color;
        svg.append(dataPoint);
      });
    } else if (singleItem) {
      var singleY = box.top + (1 - (items[0].value - domainY[0]) / (domainY[1] - domainY[0])) * box.height;
      var singlePoint = createSvg('circle', {
        cx: box.left + box.width / 2, cy: singleY, r: 4.5, class: 'overall-chart-tip-point'
      });
      singlePoint.style.fill = color;
      svg.append(singlePoint);
    }

    if (hasRightAxis) {
      var priceColor = '#ea580c';
      var priceLine = createSvg('path', {
        d: linePath(rightAxisItems, box, domainX, rightDomainY), class: 'shareholder-price-line'
      });
      priceLine.style.stroke = priceColor;
      svg.append(priceLine);
      if (showQuarterlyPoints && !denseRightAxis) {
        rightAxisItems.forEach(function (item) {
          var priceTime = Date.parse(item.date + 'T00:00:00Z');
          var priceX = box.left + (priceTime - domainX[0]) / (domainX[1] - domainX[0]) * box.width;
          var priceY = box.top + (1 - (item.value - rightDomainY[0]) / (rightDomainY[1] - rightDomainY[0])) * box.height;
          var pricePoint = createSvg('circle', {
            cx: priceX, cy: priceY, r: Math.max(2.5, quarterlyPointSize - 1), class: 'shareholder-price-point'
          });
          pricePoint.style.fill = priceColor;
          svg.append(pricePoint);
        });
      }
    }

    var guide = createSvg('line', {
      y1: box.top, y2: box.top + box.height, stroke: color,
      'stroke-width': 1, 'stroke-dasharray': '4 4', opacity: 0
    });
    var point = createSvg('circle', {
      r: 4.5, class: 'overall-chart-tip-point', opacity: 0
    });
    point.style.fill = color;
    var rightPoint = hasRightAxis ? createSvg('circle', {
      r: 4.5, class: 'overall-chart-tip-point shareholder-price-tip-point', opacity: 0
    }) : null;
    if (rightPoint) rightPoint.style.fill = '#ea580c';
    svg.append(guide, point);
    if (rightPoint) svg.append(rightPoint);

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
      var hoveredPriceItem = hasRightAxis ? nearestItem(rightAxisItems, target) : null;
      if (rightPoint && hoveredPriceItem) {
        var hoveredPriceTime = Date.parse(hoveredPriceItem.date + 'T00:00:00Z');
        var rightX = box.left + (hoveredPriceTime - domainX[0]) / (domainX[1] - domainX[0]) * box.width;
        var rightY = box.top + (1 - (Number(hoveredPriceItem.value) - rightDomainY[0]) / (rightDomainY[1] - rightDomainY[0])) * box.height;
        rightPoint.setAttribute('cx', rightX);
        rightPoint.setAttribute('cy', rightY);
        rightPoint.setAttribute('opacity', '1');
      } else if (rightPoint) {
        rightPoint.setAttribute('opacity', '0');
      }
      var tip = ensureTooltip(svg);
      tip.textContent = formatDate(item.date, chart.frequency) + ' · ' + formatValue(chart, item.value) +
        (hoveredPriceItem ? ' · ' + formatDate(hoveredPriceItem.date, '周度') + ' 股价 ¥' + Number(hoveredPriceItem.value).toFixed(2) : '') +
        (item.provisional ? ' · 期货涨跌幅推算临时值' : '');
      tip.style.left = Math.min(window.innerWidth - 12, event.clientX + 12) + 'px';
      tip.style.top = Math.max(12, event.clientY - 38) + 'px';
      tip.hidden = false;
    });
    overlay.addEventListener('pointerleave', function () {
      guide.setAttribute('opacity', '0');
      point.setAttribute('opacity', '0');
      if (rightPoint) rightPoint.setAttribute('opacity', '0');
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
    var titleRow = createElement('div', 'overall-detail-title-row overall-chart-title-row');
    var help = createElement('span', 'overall-detail-help');
    var helpButton = createElement('button', 'overall-detail-help-button', '?');
    helpButton.type = 'button';
    helpButton.setAttribute('aria-label', '查看' + TITLES[chartId] + '说明');
    var helpTooltip = createElement('span', 'overall-detail-help-tooltip', DESCRIPTIONS[chartId] || '暂无说明。');
    helpTooltip.id = 'overallCardHelp_' + chartId;
    helpTooltip.setAttribute('role', 'tooltip');
    helpButton.setAttribute('aria-describedby', helpTooltip.id);
    help.append(helpButton, helpTooltip);
    titleRow.append(title, help);
    heading.append(titleRow);

    var actions = createElement('div', 'overall-chart-card-header-actions');
    var latest = chart && chart.items.length ? chart.items[chart.items.length - 1] : null;
    var latestBlock = createElement('div', 'overall-chart-latest');
    latestBlock.append(createElement('strong', '', latest ? formatValue(chart, latest.value, false) : '--'));
    if (latest && latest.provisional) latestBlock.append(createElement('span', 'overall-chart-provisional-badge', '临时补点'));
    var latestDate = createElement('time', 'overall-chart-latest-date', latest ? formatDate(latest.date, chart.frequency) : '暂无日期');
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

    var stockTableChart = chart && chart.chartType === 'stockTable';
    var availableStockRows = stockTableChart ? (chart.rows || []).filter(function (row) {
      return hasNumericValue(row.latestValue);
    }) : [];
    var summary = createElement('p', 'overall-chart-summary', stockTableChart
      ? availableStockRows.length + '/' + (chart.rows || []).length + ' 只成分股已有最新披露'
      : rangeSummary(chart));
    var svg = createSvg('svg', {
      class: 'overall-chart', role: 'img', 'aria-label': TITLES[chartId] + '曲线'
    });
    var cardStockTable = null;
    if (stockTableChart) {
      cardStockTable = createElement('div', 'shareholder-table-wrap shareholder-card-table-wrap');
      renderShareholderTable(cardStockTable, chart.rows || [], false);
    } else {
      renderLineChart(svg, chart);
    }
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
    if (chart && chart.supplementSourceUrl) {
      sourceLine.append(document.createTextNode('；补点：'));
      var supplementLink = createElement('a', '', chart.supplementSourceName || '查看补点来源');
      supplementLink.href = chart.supplementSourceUrl;
      supplementLink.target = '_blank';
      supplementLink.rel = 'noopener noreferrer';
      sourceLine.append(supplementLink);
    }
    card.append(header, summary, stockTableChart ? cardStockTable : svg, sourceLine);

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
    activeShareholderTableQuarterDate = null;
    shareholderSortKey = null;
    shareholderSortDirection = null;
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
    var sourceChart = chartById(activeDetailId);
    var stockTableChart = sourceChart && sourceChart.chartType === 'stockTable';
    refs.detailRangeControl.hidden = Boolean(stockTableChart);
    refs.detailExtremes.hidden = Boolean(stockTableChart);
    refs.detailChart.hidden = Boolean(stockTableChart);
    refs.detailStockTableWrap.hidden = !stockTableChart;
    if (stockTableChart) {
      var rows = sourceChart.rows || [];
      var quarterDates = Array.from(new Set(rows.flatMap(function (row) {
        return (row.quarterlyItems || []).map(function (item) { return item.date; });
      }))).sort();
      if (!quarterDates.includes(activeShareholderTableQuarterDate)) {
        activeShareholderTableQuarterDate = quarterDates.at(-1) || null;
      }
      syncShareholderTableQuarterSelect(quarterDates);
      var displayedRows = rows.map(function (row) {
        var quarterItem = (row.quarterlyItems || []).find(function (item) {
          return item.date === activeShareholderTableQuarterDate;
        });
        return Object.assign({}, row, {
          latestDate: activeShareholderTableQuarterDate,
          latestValue: quarterItem ? quarterItem.value : null,
        });
      });
      if (shareholderSortKey && shareholderSortDirection) {
        displayedRows.sort(function (left, right) {
          var leftValue = shareholderSortKey === 'change'
            ? shareholderQuarterChange(left).value
            : shareholderSortKey === 'marketCap' && hasNumericValue(left.marketCap) ? Number(left.marketCap)
            : hasNumericValue(left.latestValue) ? Number(left.latestValue) : Number.NaN;
          var rightValue = shareholderSortKey === 'change'
            ? shareholderQuarterChange(right).value
            : shareholderSortKey === 'marketCap' && hasNumericValue(right.marketCap) ? Number(right.marketCap)
            : hasNumericValue(right.latestValue) ? Number(right.latestValue) : Number.NaN;
          var leftAvailable = Number.isFinite(leftValue);
          var rightAvailable = Number.isFinite(rightValue);
          if (leftAvailable !== rightAvailable) return leftAvailable ? -1 : 1;
          if (!leftAvailable) return 0;
          return shareholderSortDirection === 'ascending' ? leftValue - rightValue : rightValue - leftValue;
        });
      }
      updateShareholderSortHeader('count', refs.shareholderSortHeader, refs.shareholderSortButton);
      updateShareholderSortHeader('change', refs.shareholderChangeSortHeader, refs.shareholderChangeSortButton);
      updateShareholderSortHeader('marketCap', refs.shareholderMarketCapSortHeader, refs.shareholderMarketCapSortButton);
      renderShareholderTable(refs.detailStockTableBody, displayedRows, true);
      var availableCount = displayedRows.filter(function (row) { return hasNumericValue(row.latestValue); }).length;
      refs.detailMessage.textContent = (activeShareholderTableQuarterDate ? formatDate(activeShareholderTableQuarterDate, '季度') + ' · ' : '') +
        availableCount + '/' + rows.length + ' 只成分股已有数据；可选择或左右翻季度，点击股票查看单股历史。';
      return;
    }
    var chart = filteredChart(sourceChart, refs.detailRange.value);
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

  function hasNumericValue(value) {
    return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  }

  function formatHolderCount(value) {
    return hasNumericValue(value)
      ? new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(Number(value)) + ' 户'
      : '--';
  }

  function shareholderQuarterChange(stock) {
    var latestValue = hasNumericValue(stock && stock.latestValue) ? Number(stock.latestValue) : Number.NaN;
    var latestDate = stock && stock.latestDate;
    var previous = (stock && stock.quarterlyItems || []).filter(function (item) {
      return item.date < latestDate;
    }).at(-1);
    return Number.isFinite(latestValue) && previous
      ? { value: latestValue - Number(previous.value), previousDate: previous.date }
      : { value: Number.NaN, previousDate: null };
  }

  function formatHolderChange(value) {
    if (!Number.isFinite(Number(value))) return '--';
    var numericValue = Number(value);
    return (numericValue > 0 ? '+' : '') + new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(numericValue) + ' 户';
  }

  function formatMarketCap(value) {
    return hasNumericValue(value)
      ? new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(Number(value)) + ' 亿元'
      : '--';
  }

  function updateShareholderSortHeader(key, header, button) {
    var active = shareholderSortKey === key ? shareholderSortDirection : null;
    header.setAttribute('aria-sort', active || 'none');
    button.querySelector('span').textContent = active === 'ascending' ? '↑' : active === 'descending' ? '↓' : '↕';
  }

  function toggleShareholderSort(key) {
    shareholderSortDirection = shareholderSortKey === key && shareholderSortDirection === 'descending'
      ? 'ascending' : 'descending';
    shareholderSortKey = key;
    renderDetail();
  }

  function syncShareholderTableQuarterSelect(quarterDates) {
    var currentOptions = Array.from(refs.shareholderTableQuarter.options).map(function (option) { return option.value; });
    if (currentOptions.join('|') !== quarterDates.join('|')) {
      refs.shareholderTableQuarter.replaceChildren();
      quarterDates.forEach(function (date) {
        refs.shareholderTableQuarter.append(new Option(formatDate(date, '季度'), date));
      });
    }
    refs.shareholderTableQuarter.value = activeShareholderTableQuarterDate || '';
    var index = quarterDates.indexOf(activeShareholderTableQuarterDate);
    refs.shareholderTablePreviousQuarter.disabled = index <= 0;
    refs.shareholderTableNextQuarter.disabled = index < 0 || index >= quarterDates.length - 1;
    refs.shareholderTablePreviousQuarter.title = refs.shareholderTablePreviousQuarter.disabled ? '已经是最早季度' : '查看上一季度';
    refs.shareholderTableNextQuarter.title = refs.shareholderTableNextQuarter.disabled ? '已经是最新季度' : '查看下一季度';
  }

  function moveShareholderTableQuarter(offset) {
    var chart = chartById('filmCinemaShareholders');
    var quarterDates = Array.from(new Set((chart && chart.rows || []).flatMap(function (row) {
      return (row.quarterlyItems || []).map(function (item) { return item.date; });
    }))).sort();
    var index = quarterDates.indexOf(activeShareholderTableQuarterDate);
    var target = Math.min(quarterDates.length - 1, Math.max(0, index + offset));
    if (target >= 0 && quarterDates[target]) activeShareholderTableQuarterDate = quarterDates[target];
    renderDetail();
  }

  function shareholderValueAtQuarter(stock, quarterDate) {
    var item = (stock && stock.quarterlyItems || []).find(function (entry) { return entry.date === quarterDate; });
    return item && hasNumericValue(item.value) ? Number(item.value) : Number.NaN;
  }

  function compactHolderValue(value) {
    return new Intl.NumberFormat('zh-CN', {
      notation: 'compact', maximumFractionDigits: 1,
    }).format(Number(value));
  }

  function renderShareholderMiniBarChart(stock) {
    var card = createElement('article', 'shareholder-bar-card');
    var title = createElement('div', 'shareholder-bar-card-title');
    title.append(createElement('strong', '', stock.name), createElement('span', '', stock.code));
    card.append(title);
    var items = (stock.quarterlyItems || []).filter(function (item) {
      return !activeShareholderTableQuarterDate || item.date <= activeShareholderTableQuarterDate;
    }).slice(-4);
    if (!items.length) {
      card.append(createElement('p', 'shareholder-bar-empty', '所选季度前暂无数据'));
      return card;
    }
    var svg = createSvg('svg', {
      class: 'shareholder-mini-bar-chart', viewBox: '0 0 360 220', role: 'img',
      'aria-label': stock.name + '最近四季度股东人数条状图',
    });
    var maximum = Math.max.apply(null, items.map(function (item) { return Number(item.value); }));
    var chartTop = 30;
    var baseline = 172;
    var chartHeight = baseline - chartTop;
    var slotWidth = 82;
    var barWidth = 52;
    items.forEach(function (item, index) {
      var value = Number(item.value);
      var height = maximum > 0 ? value / maximum * chartHeight : 0;
      var x = 18 + index * slotWidth + (slotWidth - barWidth) / 2;
      var y = baseline - height;
      var bar = createSvg('rect', {
        x: x, y: y, width: barWidth, height: Math.max(1, height), rx: 5, class: 'shareholder-mini-bar',
      });
      var valueLabel = createSvg('text', {
        x: x + barWidth / 2, y: Math.max(16, y - 7), class: 'shareholder-mini-bar-value', 'text-anchor': 'middle',
      });
      valueLabel.textContent = compactHolderValue(value);
      var date = new Date(item.date + 'T00:00:00Z');
      var quarterLabel = createSvg('text', {
        x: x + barWidth / 2, y: 197, class: 'shareholder-mini-bar-quarter', 'text-anchor': 'middle',
      });
      quarterLabel.textContent = date.getUTCFullYear() + ' Q' + (Math.floor(date.getUTCMonth() / 3) + 1);
      svg.append(bar, valueLabel, quarterLabel);
    });
    svg.append(createSvg('line', { x1: 18, y1: baseline, x2: 346, y2: baseline, class: 'shareholder-mini-bar-axis' }));
    card.append(svg);
    return card;
  }

  function renderShareholderBarCharts() {
    var chart = chartById('filmCinemaShareholders');
    var rows = (chart && chart.rows || []).slice();
    var sortDirection = refs.shareholderBarsSort.value;
    if (sortDirection !== 'default') {
      rows.sort(function (left, right) {
        var leftValue = shareholderValueAtQuarter(left, activeShareholderTableQuarterDate);
        var rightValue = shareholderValueAtQuarter(right, activeShareholderTableQuarterDate);
        var leftAvailable = Number.isFinite(leftValue);
        var rightAvailable = Number.isFinite(rightValue);
        if (leftAvailable !== rightAvailable) return leftAvailable ? -1 : 1;
        if (!leftAvailable) return 0;
        return sortDirection === 'ascending' ? leftValue - rightValue : rightValue - leftValue;
      });
    }
    refs.shareholderBarsGrid.style.setProperty('--shareholder-bar-columns', refs.shareholderBarsColumns.value);
    refs.shareholderBarsGrid.replaceChildren();
    rows.forEach(function (stock) { refs.shareholderBarsGrid.append(renderShareholderMiniBarChart(stock)); });
    refs.shareholderBarsMessage.textContent = formatDate(activeShareholderTableQuarterDate, '季度') +
      '为截止季度 · 每只股票显示截至该季度的最近四期数据 · 共 ' + rows.length + ' 只';
  }

  function showShareholderBarCharts() {
    refs.shareholderBarsSort.value = 'descending';
    refs.shareholderBarsColumns.value = '4';
    renderShareholderBarCharts();
    refs.shareholderBarsDialog.showModal();
    refs.shareholderBarsClose.focus({ preventScroll: true });
  }

  function renderShareholderTable(container, rows, interactive) {
    var body = container.tagName === 'TBODY' ? container : document.createElement('tbody');
    body.replaceChildren();
    (rows || []).forEach(function (stock) {
      var row = document.createElement('tr');
      if (interactive) {
        row.tabIndex = 0;
        row.setAttribute('role', 'button');
        row.title = '查看' + stock.name + '季度股东人数';
      }
      var stockCell = document.createElement('th');
      stockCell.scope = 'row';
      stockCell.append(createElement('strong', '', stock.name), createElement('span', '', stock.code));
      row.append(stockCell);
      row.append(createElement('td', stock.error || !hasNumericValue(stock.latestValue) ? 'shareholder-value-missing' : '', formatHolderCount(stock.latestValue)));
      if (interactive) {
        var change = shareholderQuarterChange(stock);
        var changeClass = Number.isFinite(change.value)
          ? change.value > 0 ? 'shareholder-change-up' : change.value < 0 ? 'shareholder-change-down' : ''
          : 'shareholder-value-missing';
        var changeCell = createElement('td', changeClass, formatHolderChange(change.value));
        if (change.previousDate) changeCell.title = '相对 ' + change.previousDate + ' 季末';
        row.append(changeCell);
        row.append(createElement('td', hasNumericValue(stock.marketCap) ? '' : 'shareholder-value-missing', formatMarketCap(stock.marketCap)));
      }
      row.append(createElement('td', '', stock.latestDate || '--'));
      if (interactive) row.append(createElement('td', '', stock.historySource || '--'));
      var open = function () { if (interactive) showShareholderHistory(stock.code); };
      row.addEventListener('click', open);
      row.addEventListener('keydown', function (event) {
        if (interactive && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          open();
        }
      });
      body.append(row);
    });
    if (container.tagName !== 'TBODY') {
      var table = createElement('table', 'shareholder-table');
      var head = document.createElement('thead');
      var headerRow = document.createElement('tr');
      ['股票', '最新股东人数', '截止日期'].forEach(function (label) { headerRow.append(createElement('th', '', label)); });
      head.append(headerRow);
      table.append(head, body);
      container.replaceChildren(table);
    }
  }

  function showShareholderHistory(code) {
    activeShareholderCode = code;
    refs.shareholderRange.value = 'year5';
    renderShareholderHistory();
    refs.shareholderDialog.showModal();
    refs.shareholderClose.focus({ preventScroll: true });
  }

  function renderShareholderHistory() {
    var chart = chartById('filmCinemaShareholders');
    var stock = chart && (chart.rows || []).find(function (row) { return row.code === activeShareholderCode; });
    if (!stock) {
      refs.shareholderTitle.textContent = '--';
      refs.shareholderMessage.textContent = '未找到该股票。';
      renderEmpty(refs.shareholderChart, '暂无可绘制的数据');
      return;
    }
    refs.shareholderTitle.textContent = stock.name + '（' + stock.code + '）';
    var historyChart = filteredChart({
      id: 'filmCinemaShareholders', title: stock.name + '股东人数', unit: '户', decimals: 0, frequency: '季度',
      items: stock.quarterlyItems || [], rightAxisItems: stock.priceItems || [],
    }, refs.shareholderRange.value);
    if (!historyChart.items.length) {
      refs.shareholderMessage.textContent = stock.error || '当前时间跨度暂无季末股东人数。';
      renderEmpty(refs.shareholderChart, '暂无季度数据');
      return;
    }
    refs.shareholderMessage.textContent = RANGES[refs.shareholderRange.value].label + ' · ' + stock.historySource + ' · 共 ' + historyChart.items.length + ' 个季度';
    renderLineChart(refs.shareholderChart, historyChart);
  }

  function showCompare() {
    var ids = activeChartIds().filter(function (id) {
      var chart = chartById(id);
      return !(chart && chart.chartType === 'stockTable');
    });
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
      leftLabel.textContent = axisValue(firstY[1] - ratio * (firstY[1] - firstY[0]), first.decimals);
      var rightLabel = createSvg('text', {
        x: box.left + box.width + 10, y: y + 4, class: 'chart-label overall-compare-label-right', 'text-anchor': 'start'
      });
      rightLabel.textContent = axisValue(secondY[1] - ratio * (secondY[1] - secondY[0]), second.decimals);
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

    var guide = createSvg('line', {
      y1: box.top, y2: box.top + box.height, stroke: '#657089',
      'stroke-width': 1, 'stroke-dasharray': '4 4', opacity: 0
    });
    var leftPoint = createSvg('circle', {
      r: 5, class: 'overall-compare-left-point', opacity: 0
    });
    var rightPoint = createSvg('circle', {
      r: 5, class: 'overall-compare-right-point', opacity: 0
    });
    refs.compareChart.append(guide, leftPoint, rightPoint);

    var overlay = createSvg('rect', {
      x: box.left, y: box.top, width: box.width, height: box.height, fill: 'transparent'
    });
    overlay.style.cursor = 'crosshair';
    overlay.addEventListener('pointermove', function (event) {
      var rect = refs.compareChart.getBoundingClientRect();
      var localX = (event.clientX - rect.left) / rect.width * width;
      var positionRatio = Math.max(0, Math.min(1, (localX - box.left) / box.width));
      var targetTime = domainX[0] + positionRatio * (domainX[1] - domainX[0]);
      var firstItem = nearestItem(first.items, targetTime);
      var secondItem = nearestItem(second.items, targetTime);
      var cursorX = box.left + positionRatio * box.width;
      var firstTime = Date.parse(firstItem.date + 'T00:00:00Z');
      var secondTime = Date.parse(secondItem.date + 'T00:00:00Z');
      var firstX = box.left + (firstTime - domainX[0]) / (domainX[1] - domainX[0]) * box.width;
      var secondX = box.left + (secondTime - domainX[0]) / (domainX[1] - domainX[0]) * box.width;
      var firstYPosition = box.top + (1 - (firstItem.value - firstY[0]) / (firstY[1] - firstY[0])) * box.height;
      var secondYPosition = box.top + (1 - (secondItem.value - secondY[0]) / (secondY[1] - secondY[0])) * box.height;
      guide.setAttribute('x1', cursorX);
      guide.setAttribute('x2', cursorX);
      guide.setAttribute('opacity', '0.65');
      leftPoint.setAttribute('cx', firstX);
      leftPoint.setAttribute('cy', firstYPosition);
      leftPoint.setAttribute('opacity', '1');
      rightPoint.setAttribute('cx', secondX);
      rightPoint.setAttribute('cy', secondYPosition);
      rightPoint.setAttribute('opacity', '1');
      var tip = ensureTooltip(refs.compareChart);
      tip.style.whiteSpace = 'pre-line';
      tip.textContent = first.title + '：' + formatValue(first, firstItem.value) + ' · ' + formatDate(firstItem.date, first.frequency) +
        (firstItem.provisional ? '（临时补点）' : '') + '\n' +
        second.title + '：' + formatValue(second, secondItem.value) + ' · ' + formatDate(secondItem.date, second.frequency) +
        (secondItem.provisional ? '（临时补点）' : '');
      tip.style.left = Math.min(window.innerWidth - 12, event.clientX + 12) + 'px';
      tip.style.top = Math.max(12, event.clientY - 58) + 'px';
      tip.hidden = false;
    });
    overlay.addEventListener('pointerleave', function () {
      guide.setAttribute('opacity', '0');
      leftPoint.setAttribute('opacity', '0');
      rightPoint.setAttribute('opacity', '0');
      if (tooltip) tooltip.hidden = true;
    });
    refs.compareChart.append(overlay);
    refs.compareMessage.textContent = RANGES[refs.compareRange.value].label + ' · 左右双轴独立缩放';
  }

  function renderGroups() {
    refs.groupsList.replaceChildren();
    config.groups.forEach(function (group, groupIndex) {
      var card = createElement('section', 'overall-group-item');
      var header = createElement('div', 'overall-group-item-header');
      var identity = createElement('div', 'overall-group-identity');
      var isBuiltInGroup = DEFAULT_CONFIG.groups.some(function (item) { return item.id === group.id; });
      if (isBuiltInGroup) {
        identity.append(createElement('strong', '', group.name));
        identity.append(createElement('span', 'overall-group-fixed-badge', group.id === 'default' ? '固定分组' : '内置分组'));
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
        identity.append(input);
        identity.append(remove);
      }
      var orderActions = createElement('div', 'overall-group-order-actions');
      var top = createElement('button', 'secondary-button overall-group-top-button', '置顶');
      top.type = 'button';
      top.title = '将此分组移到最前面';
      top.setAttribute('aria-label', '置顶分组“' + group.name + '”');
      top.disabled = groupIndex === 0;
      top.addEventListener('click', function () { moveGroupToTop(group.id); });
      var up = createElement('button', 'config-order-button', '↑');
      up.type = 'button';
      up.title = '上移分组';
      up.setAttribute('aria-label', '上移分组“' + group.name + '”');
      up.disabled = groupIndex === 0;
      up.addEventListener('click', function () { moveGroup(group.id, -1); });
      var down = createElement('button', 'config-order-button', '↓');
      down.type = 'button';
      down.title = '下移分组';
      down.setAttribute('aria-label', '下移分组“' + group.name + '”');
      down.disabled = groupIndex === config.groups.length - 1;
      down.addEventListener('click', function () { moveGroup(group.id, 1); });
      orderActions.append(top, up, down);
      header.append(identity, orderActions);
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

  function moveGroup(id, offset) {
    var index = config.groups.findIndex(function (group) { return group.id === id; });
    var target = index + offset;
    if (index < 0 || target < 0 || target >= config.groups.length) return;
    var reordered = config.groups.slice();
    var moved = reordered.splice(index, 1)[0];
    reordered.splice(target, 0, moved);
    config.groups = reordered;
    persistConfig();
    syncGroups();
    renderGroups();
    if (refs.groupOrderDialog.open) renderGroupOrderList();
  }

  function moveGroupToTop(id) {
    var index = config.groups.findIndex(function (group) { return group.id === id; });
    if (index <= 0) return;
    var reordered = config.groups.slice();
    var moved = reordered.splice(index, 1)[0];
    reordered.unshift(moved);
    config.groups = reordered;
    persistConfig();
    syncGroups();
    renderGroups();
    if (refs.groupOrderDialog.open) renderGroupOrderList();
  }

  function moveGroupBefore(sourceId, targetId) {
    if (!sourceId || sourceId === targetId) return;
    var reordered = config.groups.slice();
    var sourceIndex = reordered.findIndex(function (group) { return group.id === sourceId; });
    var targetIndex = reordered.findIndex(function (group) { return group.id === targetId; });
    if (sourceIndex < 0 || targetIndex < 0) return;
    var moved = reordered.splice(sourceIndex, 1)[0];
    targetIndex = reordered.findIndex(function (group) { return group.id === targetId; });
    reordered.splice(targetIndex, 0, moved);
    config.groups = reordered;
    persistConfig();
    syncGroups();
    renderGroups();
    renderGroupOrderList();
  }

  function renderGroupOrderList() {
    refs.groupOrderList.replaceChildren();
    config.groups.forEach(function (group, index) {
      var item = createElement('li');
      item.draggable = true;
      item.dataset.groupId = group.id;
      item.tabIndex = 0;
      item.append(createElement('span', 'overall-config-drag-handle', '⠿'));
      item.append(createElement('span', 'overall-config-chart-name', group.name));

      var top = createElement('button', 'secondary-button overall-group-top-button', '置顶');
      top.type = 'button';
      top.disabled = index === 0;
      top.setAttribute('aria-label', '置顶分组“' + group.name + '”');
      top.addEventListener('click', function () { moveGroupToTop(group.id); });
      var up = createElement('button', 'config-order-button', '↑');
      up.type = 'button';
      up.title = '上移';
      up.setAttribute('aria-label', '上移分组“' + group.name + '”');
      up.disabled = index === 0;
      up.addEventListener('click', function () { moveGroup(group.id, -1); });
      var down = createElement('button', 'config-order-button', '↓');
      down.type = 'button';
      down.title = '下移';
      down.setAttribute('aria-label', '下移分组“' + group.name + '”');
      down.disabled = index === config.groups.length - 1;
      down.addEventListener('click', function () { moveGroup(group.id, 1); });
      item.append(top, up, down);

      item.addEventListener('dragstart', function () {
        draggedGroupId = group.id;
        item.classList.add('is-dragging');
      });
      item.addEventListener('dragend', function () {
        draggedGroupId = null;
        item.classList.remove('is-dragging');
      });
      item.addEventListener('dragover', function (event) { event.preventDefault(); });
      item.addEventListener('drop', function (event) {
        event.preventDefault();
        moveGroupBefore(draggedGroupId, group.id);
      });
      refs.groupOrderList.append(item);
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
      var url = 'data/outlook.json?v=' + Date.now();
      var response = await fetch(url, { cache: 'no-store' });
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
    var payload = {
      version: 2,
      displayControls: {
        chartLineWidth: normalizeLineWidth(refs.lineWidth.value),
        quarterPointSize: normalizeQuarterPointSize(refs.quarterPointSize.value)
      }
    };
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
      var pointSize = source && source.quarterPointSize === undefined
        ? normalizeQuarterPointSize(refs.quarterPointSize.value)
        : Number(source && source.quarterPointSize);
      if (!Number.isFinite(width) || width < 1 || width > 6 || width * 2 % 1 !== 0) {
        throw new Error('invalid line width');
      }
      if (!Number.isFinite(pointSize) || pointSize < 2 || pointSize > 10 || pointSize * 2 % 1 !== 0) {
        throw new Error('invalid quarter point size');
      }
      applyLineWidth(width, false);
      applyQuarterPointSize(pointSize, false);
      localStorage.setItem(LINE_WIDTH_STORAGE_KEY, String(width));
      localStorage.setItem(QUARTER_POINT_SIZE_STORAGE_KEY, String(pointSize));
      persistSharedConfig();
      refs.displayMessage.textContent = '已上传显示设置：图表线条 ' + width + ' px，季度点 ' + pointSize + ' px。';
    } catch (error) {
      refs.displayMessage.textContent = '显示设置文件无效：线条粗细须为 1–6，季度点须为 2–10，步进均为 0.5。';
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
    refs.quarterPointSize.addEventListener('input', function () { applyQuarterPointSize(refs.quarterPointSize.value); });
    document.querySelector('#displayControlsResetButton').addEventListener('click', function () {
      applyLineWidth(DEFAULT_LINE_WIDTH, false);
      applyQuarterPointSize(DEFAULT_QUARTER_POINT_SIZE, false);
      localStorage.setItem(LINE_WIDTH_STORAGE_KEY, String(DEFAULT_LINE_WIDTH));
      localStorage.setItem(QUARTER_POINT_SIZE_STORAGE_KEY, String(DEFAULT_QUARTER_POINT_SIZE));
      persistSharedConfig();
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
    document.querySelector('#overallOpenGroupOrderButton').addEventListener('click', function () {
      renderGroupOrderList();
      refs.groupOrderDialog.showModal();
    });
    document.querySelector('#overallCompareRunButton').addEventListener('click', renderComparison);
    refs.compareRange.addEventListener('change', renderComparison);
    refs.detailRange.addEventListener('change', renderDetail);
    refs.shareholderSortButton.addEventListener('click', function () { toggleShareholderSort('count'); });
    refs.shareholderChangeSortButton.addEventListener('click', function () { toggleShareholderSort('change'); });
    refs.shareholderMarketCapSortButton.addEventListener('click', function () { toggleShareholderSort('marketCap'); });
    refs.shareholderTableQuarter.addEventListener('change', function () {
      activeShareholderTableQuarterDate = refs.shareholderTableQuarter.value;
      renderDetail();
    });
    refs.shareholderTablePreviousQuarter.addEventListener('click', function () { moveShareholderTableQuarter(-1); });
    refs.shareholderTableNextQuarter.addEventListener('click', function () { moveShareholderTableQuarter(1); });
    refs.shareholderBarChartsButton.addEventListener('click', showShareholderBarCharts);
    refs.shareholderBarsSort.addEventListener('change', renderShareholderBarCharts);
    refs.shareholderBarsColumns.addEventListener('change', renderShareholderBarCharts);
    refs.shareholderRange.addEventListener('change', function () {
      renderShareholderHistory();
    });
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
    refs.shareholderDialog.addEventListener('click', function (event) {
      if (event.target === refs.shareholderDialog) refs.shareholderDialog.close();
    });
    refs.shareholderBarsDialog.addEventListener('click', function (event) {
      if (event.target === refs.shareholderBarsDialog) refs.shareholderBarsDialog.close();
    });
  }

  function applyRuntimeCapabilities() {
    var isLocalRuntime = ['127.0.0.1', 'localhost', '::1'].includes(window.location.hostname);
    [refs.displayButton, refs.groupsButton, refs.manageButton].forEach(function (button) {
      button.hidden = !isLocalRuntime;
    });
  }

  function initialize() {
    applyRuntimeCapabilities();
    applyLineWidth(localStorage.getItem(LINE_WIDTH_STORAGE_KEY), false);
    applyQuarterPointSize(localStorage.getItem(QUARTER_POINT_SIZE_STORAGE_KEY), false);
    syncGroups();
    refs.columns.value = String(config.chartsPerRow);
    populateRangeSelect(refs.compareRange, refs.range.value);
    populateRangeSelect(refs.detailRange, refs.range.value);
    refs.shareholderRange.replaceChildren();
    Object.keys(RANGES).filter(function (key) { return key.indexOf('year') === 0; }).forEach(function (key) {
      refs.shareholderRange.append(new Option(RANGES[key].label, key));
    });
    refs.shareholderRange.value = 'year5';
    bindEvents();
    syncView();
    loadData(false);
    syncSharedLocalConfig();
  }

  initialize();
}());
