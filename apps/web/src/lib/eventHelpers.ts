/** 与 legacy `evLoadMarketData` 中 interval 选择一致 */
export function durationToKlineInterval(durationMinutes: number): "1m" | "5m" | "15m" | "1h" {
  if (durationMinutes <= 10) return "1m";
  if (durationMinutes <= 30) return "5m";
  if (durationMinutes <= 60) return "15m";
  return "1h";
}
