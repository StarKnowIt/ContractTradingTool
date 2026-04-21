import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
// Primer 基础样式（按钮、变量等），需在自定义样式之前引入，便于我们覆盖。
import "@primer/css/dist/primer.css";
import "./globals.css";
// 旧版静态站迁移来的组件样式（panel、指标行等），与业务页强相关。
import "./legacy.css";
// 把 legacy 里的颜色/字号桥接到 Primer 主题变量，并放最后以便覆盖。
import "./ctbox-primer-bridge.css";
import { AppChrome } from "./AppChrome";
// 全局：主题 + React Query + 基础排版。
import Providers from "./providers";

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

/**
 * 根布局：所有页面共用。
 * - body 挂上字体 CSS 变量，子组件用 var(--font-geist-sans) 等即可。
 * - Providers 再包一层 AppChrome：先有「主题/请求库」，再有「顶栏+页脚+主内容槽」。
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Providers>
          <AppChrome>{children}</AppChrome>
        </Providers>
      </body>
    </html>
  );
}
