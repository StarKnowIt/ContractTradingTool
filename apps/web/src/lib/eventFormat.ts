/** 与 `js/utils.js` 对齐，用于事件合约页展示 */
export function fmt(n: number, dec = 2) {
  if (!Number.isFinite(n)) return "--";
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return Number(n.toFixed(dec)).toString();
}

export function fmtPrice(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "--";
  if (n >= 1000) return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}
