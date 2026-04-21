/**
 * React Query 的「缓存键」集中定义（给监控页等用）
 * ------------------------------------------------
 * React Query 用「键」区分不同请求：同一个键会共用缓存、去重、一起失效。
 * 这里用函数返回数组，既避免手写字符串拼错，又能在键里带上 symbol 等参数。
 *
 * 修改监控页接口时：若换了 URL 或含义，记得同步改这里的键，否则浏览器里可能看到旧缓存。
 */
export const qk = {
  // 经后端 /api/proxy 转发的 Binance 类数据
  validSymbols: () => ["proxy", "exchangeInfo"] as const,
  ticker24hr: () => ["proxy", "ticker24hr"] as const,
  premiumIndex: () => ["proxy", "premiumIndex"] as const,
  openInterestHist: (symbol: string) => ["proxy", "openInterestHist", symbol] as const,

  // 走后端一手封装的路由（同域 /api/*）
  forceOrders: (symbol: string) => ["api", "force", symbol] as const,
  lsRatio: (symbol: string) => ["api", "ls", symbol] as const,

  liveList: () => ["api", "live"] as const,

  /** CCXT 市场大盘 */
  futuresTickers: () => ["api", "market", "futures-tickers"] as const,
  topGainers: () => ["api", "market", "top-gainers"] as const,
};
