import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./legacy.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ContractTradingTool (CTBox)",
  description: "合约交易看板（Next.js Web）",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "12px 14px" }}>
          <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <a href="/" style={{ fontWeight: 800, letterSpacing: 0.2 }}>
              CTBox
            </a>
            <nav style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 13, color: "var(--text-dim)" }}>
              <a href="/analysis">分析</a>
              <a href="/monitor">监控</a>
              <a href="/event">事件合约</a>
              <a href="/live">直播</a>
              <a href="/calc">计算器</a>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
