/**
 * Binance USDT 本位常见标的（仅基础币种，不含 USDT 后缀）。
 * 用于分析页 / 计算器的下拉选择；与 `/api/klines` 等常用交易对一致。
 */
export const USDT_BASE_OPTIONS = [
  "BTC",
  "ETH",
  "BNB",
  "SOL",
  "XRP",
  "DOGE",
  "ADA",
  "AVAX",
  "DOT",
  "LINK",
  "LTC",
  "MATIC",
  "OP",
  "ARB",
  "ATOM",
  "FIL",
  "UNI",
  "APT",
  "NEAR",
  "WLD",
] as const;
