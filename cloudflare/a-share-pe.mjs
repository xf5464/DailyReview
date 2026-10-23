// Shared by the scheduled build and the on-demand Worker route.
export const A_SHARE_PE_SERIES = Object.freeze([
  { code: '930050', name: 'A50（中证A50）', provider: 'csi' },
  { code: '000300', name: '沪深300', provider: 'csi' },
  { code: '000852', name: '中证1000', provider: 'csi' },
  { code: '932000', name: '中证2000', provider: 'csi' },
  { code: '000985', name: '全A（中证全指）', provider: 'csi' },
  { code: '399006', name: '创业板（全板）', provider: 'eastmoney' },
  { code: '000688', name: '科创板（全板）', provider: 'eastmoney' },
  { code: '000688', name: '科创50', provider: 'csi' },
].map(row => Object.freeze({ ...row, id: row.provider + '-' + row.code,
  methodology: row.provider === 'csi' ? '官方指数市盈率' : '全板平均 PE（TTM）',
  sourceName: row.provider === 'csi' ? '中证指数' : '东方财富',
  sourceUrl: row.provider === 'csi'
    ? 'https://www.csindex.com.cn/#/indices/family/detail?indexCode=' + row.code
    : 'https://data.eastmoney.com/gzfx/scgk.html?MKTCODE=' + row.code,
})));

export function peNumber(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function parsePeItems(series, payload, endDate) {
  if (payload.success !== true) throw new Error('估值来源未返回成功结果');
  const records = series.provider === 'csi' ? payload.data : payload.result?.data;
  if (!Array.isArray(records)) throw new Error('估值数据格式无效');
  const rows = records.filter(item => String(series.provider === 'csi' ? item.indexCode : item.TRADE_MARKET_CODE) === series.code)
    .map(item => ({
      date: String(series.provider === 'csi' ? item.tradeDate : item.TRADE_DATE).slice(0, 10)
        .replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'),
      pe: peNumber(series.provider === 'csi' ? item.peg : item.PE_TTM_AVG),
    })).filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item.date) && item.date <= endDate && item.pe !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
  return [...new Map(rows.map(row => [row.date, { date: row.date, value: row.pe }])).values()];
}

export function parsePeResponse(series, payload, endDate) {
  const items = parsePeItems(series, payload, endDate);
  if (!items.length) throw new Error('暂无有效市盈率');
  const latest = items.at(-1);
  return { ...series, date: latest.date, pe: latest.value, stale: false, error: null };
}

export function mergePeRows(rows, previousRows = []) {
  return rows.map(row => {
    const previous = previousRows.find(item => item.id === row.id);
    if (row.pe === null && previous && peNumber(previous.pe) !== null && previous.date) {
      return { ...previous, ...row, pe: previous.pe, date: previous.date, stale: true };
    }
    return row;
  });
}

export async function queryASharePe({ fetchImpl = globalThis.fetch, now = new Date() } = {}) {
  const endDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const startDate = new Date(Date.parse(endDate + 'T00:00:00Z') - 35 * 86400000).toISOString().slice(0, 10);
  const rows = await Promise.all(A_SHARE_PE_SERIES.map(async series => {
    try {
      const url = series.provider === 'csi'
        ? 'https://www.csindex.com.cn/csindex-home/perf/index-perf?' + new URLSearchParams({
          indexCode: series.code, startDate: startDate.replaceAll('-', ''), endDate: endDate.replaceAll('-', ''),
        })
        : 'https://datacenter-web.eastmoney.com/api/data/v1/get?' + new URLSearchParams({
          reportName: 'RPT_VALUEMARKET', columns: 'ALL',
          filter: '(TRADE_MARKET_CODE="' + series.code + '")',
          sortColumns: 'TRADE_DATE', sortTypes: '-1', pageSize: '10', pageNumber: '1',
        });
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(15000),
        headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return parsePeResponse(series, await response.json(), endDate);
    } catch (error) {
      return { ...series, pe: null, date: null, stale: false, error: error.message || String(error) };
    }
  }));
  return { id: 'aSharePe', rows, items: [{ date: endDate, value: rows.filter(row => row.pe !== null).length }],
    generatedAt: now.toISOString(), frequency: '最新交易日', chartType: 'valuationTable',
    notice: '打开时联网刷新 · PE 为来源最新交易日数据，非盘中实时估值；不同来源口径不完全相同。' };
}

export async function queryASharePeHistory(seriesId, { fetchImpl = globalThis.fetch, now = new Date() } = {}) {
  const series = A_SHARE_PE_SERIES.find(item => item.id === seriesId);
  if (!series) throw new Error('不支持的估值序列');
  const endDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const read = async url => {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const payload = await response.json();
    if (payload.success !== true) throw new Error('历史估值来源返回失败');
    return payload;
  };
  let items;
  if (series.provider === 'csi') {
    const url = 'https://www.csindex.com.cn/csindex-home/perf/index-perf?' + new URLSearchParams({
      indexCode: series.code, startDate: '19900101', endDate: endDate.replaceAll('-', ''),
    });
    items = parsePeItems(series, await read(url), endDate);
  } else {
    const pageUrl = pageNumber => 'https://datacenter-web.eastmoney.com/api/data/v1/get?' + new URLSearchParams({
      reportName: 'RPT_VALUEMARKET', columns: 'TRADE_MARKET_CODE,TRADE_DATE,PE_TTM_AVG',
      filter: '(TRADE_MARKET_CODE="' + series.code + '")', sortColumns: 'TRADE_DATE', sortTypes: '1',
      pageSize: '500', pageNumber: String(pageNumber),
    });
    const first = await read(pageUrl(1));
    const pageCount = Number(first.result?.pages);
    if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 30) throw new Error('历史估值分页格式无效');
    const pages = [first, ...await Promise.all(Array.from({ length: pageCount - 1 }, (_, index) => read(pageUrl(index + 2))))];
    const records = pages.flatMap(page => {
      if (!Array.isArray(page.result?.data) || !page.result.data.length) throw new Error('历史估值分页数据缺失');
      return page.result.data;
    });
    const count = Number(first.result?.count);
    if (!Number.isInteger(count) || records.length !== count) throw new Error('历史估值分页不完整');
    items = parsePeItems(series, { success: true, result: { data: records } }, endDate);
  }
  if (!items.length) throw new Error('暂无可用历史市盈率');
  return { id: 'aSharePeHistory', seriesId, title: series.name + '历史 PE',
    name: series.name, code: series.code, methodology: series.methodology,
    sourceName: series.sourceName, sourceUrl: series.sourceUrl,
    frequency: '日度', unit: '倍', decimals: 2, items,
    generatedAt: now.toISOString(), stale: false,
    notice: '仅显示来源实际提供的有效历史PE；历史起点以数据覆盖为准。' };
}
