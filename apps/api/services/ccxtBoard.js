/**
 * CCXT：Binance USDT 永续行情聚合（tickers + 多周期涨跌幅）。
 * - 仅服务端使用；enableRateLimit 降低被封风险。
 * - 多周期：相对「上一根完整 K 收盘价」相对当前 last 的涨跌幅（与 ticker 24h 口径不同）。
 */
const ccxt = require('ccxt');
const { cGet, cSet } = require('./cache');

const DEFAULT_TIMEFRAMES = ['5m', '30m', '4h', '12h'];

/** @type {import('ccxt').Exchange | null} */
let exchangeSingleton = null;

async function getBinanceUsdm() {
  if (exchangeSingleton) return exchangeSingleton;
  const ex = new ccxt.binanceusdm({
    enableRateLimit: true,
    timeout: 30000,
    options: { defaultType: 'future' },
  });
  await ex.loadMarkets();
  exchangeSingleton = ex;
  return ex;
}

/**
 * 上一根 K 的收盘价作参考价，与当前 last 比较。
 * @param {number[][]} ohlcv
 * @param {number} last
 */
function pctSincePrevBarClose(ohlcv, last) {
  if (!Array.isArray(ohlcv) || ohlcv.length < 1 || !Number.isFinite(last) || last <= 0) return null;
  if (ohlcv.length < 2) {
    const row = ohlcv[0];
    const ref = row[4] ?? row[1];
    if (!Number.isFinite(ref) || ref === 0) return null;
    return ((last - ref) / ref) * 100;
  }
  const prevClose = ohlcv[ohlcv.length - 2][4];
  if (!Number.isFinite(prevClose) || prevClose === 0) return null;
  return ((last - prevClose) / prevClose) * 100;
}

/**
 * 将 ticker 限制为「公开 ticker 常见字段」，避免把 ccxt 内部大对象透出。
 * @param {import('ccxt').Ticker} t
 * @param {string} displaySymbol 如 BTCUSDT
 */
function normalizeTicker(t, displaySymbol) {
  return {
    symbol: displaySymbol,
    timestamp: t.timestamp ?? null,
    datetime: t.datetime ?? null,
    high: t.high ?? null,
    low: t.low ?? null,
    bid: t.bid ?? null,
    ask: t.ask ?? null,
    open: t.open ?? null,
    close: t.close ?? null,
    last: t.last ?? null,
    previousClose: t.previousClose ?? null,
    change: t.change ?? null,
    percentage: t.percentage ?? null,
    average: t.average ?? null,
    baseVolume: t.baseVolume ?? null,
    quoteVolume: t.quoteVolume ?? null,
    vwap: t.vwap ?? null,
  };
}

/**
 * @returns {Promise<{ exchange: string, rows: object[], fetchedAt: number }>}
 */
async function fetchFuturesTickerTable() {
  const cacheKey = 'ccxt:binanceusdm:tickers:v1';
  const cached = cGet(cacheKey);
  if (cached) return cached;

  const ex = await getBinanceUsdm();
  const tickers = await ex.fetchTickers();
  const rows = [];

  for (const m of Object.values(ex.markets)) {
    if (!m?.swap || m.quote !== 'USDT' || m.active === false) continue;
    const sym = m.symbol;
    const t = tickers[sym];
    if (!t?.last) continue;
    const id = m.id || sym.replace(/[/:]/g, '');
    rows.push(normalizeTicker(t, id));
  }

  rows.sort((a, b) => {
    const qa = parseFloat(String(a.quoteVolume ?? 0));
    const qb = parseFloat(String(b.quoteVolume ?? 0));
    return qb - qa;
  });

  const out = { exchange: 'binance', market: 'usdm', rows, fetchedAt: Date.now() };
  cSet(cacheKey, out, 15_000);
  return out;
}

/**
 * @param {object} opts
 * @param {number} [opts.limit]
 * @param {string[]} [opts.timeframes]
 */
async function fetchTopGainersMultiPeriod(opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit) || 20, 1), 50);
  const timeframes = Array.isArray(opts.timeframes) && opts.timeframes.length
    ? opts.timeframes
    : DEFAULT_TIMEFRAMES;

  const cacheKey = `ccxt:binanceusdm:gainers:${limit}:${timeframes.join(',')}`;
  const cached = cGet(cacheKey);
  if (cached) return cached;

  const ex = await getBinanceUsdm();
  const tickers = await ex.fetchTickers();

  const candidates = [];
  for (const m of Object.values(ex.markets)) {
    if (!m?.swap || m.quote !== 'USDT' || m.active === false) continue;
    const sym = m.symbol;
    const t = tickers[sym];
    const pct = t?.percentage != null ? parseFloat(String(t.percentage)) : NaN;
    const last = t?.last != null ? parseFloat(String(t.last)) : NaN;
    if (!Number.isFinite(last) || !Number.isFinite(pct)) continue;
    candidates.push({
      ccxtSymbol: sym,
      displaySymbol: m.id || sym.replace(/[/:]/g, ''),
      last,
      pct24h: pct,
      quoteVolume: t.quoteVolume != null ? parseFloat(String(t.quoteVolume)) : null,
    });
  }

  candidates.sort((a, b) => b.pct24h - a.pct24h);
  const top = candidates.slice(0, limit);

  const items = [];
  for (const c of top) {
    const periods = {};
    for (const tf of timeframes) {
      try {
        const ohlcv = await ex.fetchOHLCV(c.ccxtSymbol, tf, undefined, 2);
        periods[tf] = pctSincePrevBarClose(ohlcv, c.last);
      } catch {
        periods[tf] = null;
      }
    }
    items.push({
      symbol: c.displaySymbol,
      last: c.last,
      pct24h: c.pct24h,
      quoteVolume: c.quoteVolume,
      periods,
    });
  }

  const out = {
    exchange: 'binance',
    market: 'usdm',
    limit,
    timeframes,
    items,
    fetchedAt: Date.now(),
  };
  cSet(cacheKey, out, 45_000);
  return out;
}

module.exports = {
  getBinanceUsdm,
  pctSincePrevBarClose,
  normalizeTicker,
  fetchFuturesTickerTable,
  fetchTopGainersMultiPeriod,
  DEFAULT_TIMEFRAMES,
};
