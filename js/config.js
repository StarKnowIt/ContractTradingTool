// ── 全局配置 ──────────────────────────────────────────────────────────────────
const API       = 'https://api1.qianyubtc.com';
const BINANCE   = 'https://api.binance.com';
const BINANCE_F = 'https://fapi.binance.com';
const COINGECKO = 'https://api.coingecko.com/api/v3';

// 币种搜索
window._allSymbols = [];
window._symbolDropdownOpen = false;

// CoinGecko 缓存
const _cgCache = {};
let _trendingCache = null, _trendingTs = 0;
let _globalCache = null, _globalTs = 0;

// 页面状态
let _currentPage = 'analysis';
let _lastAnalysisData = null;
let _monitorLastLoad = 0;
let _eventCoin = 'BTC';

// 直播状态
let _liveStreamers = [];
let _liveSort = 'score';
let _liveFilter = 'all';
let _liveSummary = { total: 0, online: 0, totalViewers: 0, totalViews: 0 };
let _liveLoading = false;

// 指标名称映射
const nameMap = {
  macd: 'MACD', ema: 'EMA 均线', ema200: 'EMA200',
  boll: '布林带', rsi: 'RSI', kdj: 'KDJ',
  stochrsi: 'Stoch RSI', williamsr: 'Williams %R', cci: 'CCI',
  obv: 'OBV', volume: '成交量', cmf: 'CMF', vwap: 'VWAP',
  atr: 'ATR', bw: '带宽', donchian: '唐奇安通道',
  ichimoku: '一目均衡表', adx: 'ADX 趋势强度', mfi: 'MFI 资金流量', roc: 'ROC 变动率',
  ma510: 'MA5 / MA10', ma2060: 'MA20 / MA60', ma60120: 'MA60 / MA120',
  maArrange: '均线排列', ma120: 'MA120 长期',
  vegasTrend: '维加斯通道', vegasEma12: 'EMA12 位置',
};

const nameMapVpa = {
  vpDiv: '量价背离', volBreak: '放量突破', volChange: '量能变化',
  bigTrade: '大单信号', volShrink: '缩量分析'
};
