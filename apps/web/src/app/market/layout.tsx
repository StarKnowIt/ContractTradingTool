import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "市场大盘 · CTBox",
  description: "Binance USDT 永续 Ticker、多周期涨幅榜与 24h 热力图",
};

export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return children;
}
