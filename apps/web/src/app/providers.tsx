"use client";

import { BaseStyles, ThemeProvider } from "@primer/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/**
 * 全局「外壳」组件：挂在根 layout 里，所有页面都会经过这里。
 *
 * - ThemeProvider：配色（浅色 / 深色 / 跟随系统），与顶栏里的主题切换联动。
 * - BaseStyles：Primer 的基础文字色、链接样式等；minHeight 让页面至少铺满一屏高。
 * - QueryClientProvider：React Query（监控页等用）。这里配置了：
 *   - 失败重试 1 次；
 *   - 切回浏览器窗口时不自动全量刷新（避免打扰）；
 *   - 数据约 10 秒内视为「还算新鲜」、5 分钟内在内存里保留缓存。
 *
 * 若你只想改「监控页多久自动刷一次」，请去具体页面里的 useQuery 选项，而不是只改这里。
 */
export default function Providers(props: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 10_000,
            gcTime: 5 * 60_000,
          },
        },
      })
  );

  return (
    <ThemeProvider
      colorMode="day"
      dayScheme="light"
      nightScheme="dark_dimmed"
      preventSSRMismatch
    >
      <BaseStyles style={{ minHeight: "100vh" }}>
        <QueryClientProvider client={client}>{props.children}</QueryClientProvider>
      </BaseStyles>
    </ThemeProvider>
  );
}
