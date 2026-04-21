"use client";

/**
 * 全站「壳子」：顶栏导航 + 中间主内容（由每个页面的 page.tsx 填充）+ 页脚。
 * ----------------------------------------------------------------
 * - 使用 Primer 的 PageLayout；rowGap 设为 none，避免顶栏与正文之间多出一大条缝。
 * - 主内容区加上 className `ctbox-page-content-wrap`：只在 **内层** 关掉纵向 flex-grow，
 *   避免短页面底部空白；不要对外层关横向 grow，否则主栏会变窄条。
 * - NAV_MENUS：顶栏下拉菜单的数据源；要加新页面时在这里补链接即可。
 */

import {
  ActionList,
  ActionMenu,
  Link as PrimerLink,
  PageLayout,
  SegmentedControl,
  Stack,
  useTheme,
} from "@primer/react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { SiteFooter } from "./SiteFooter";

/** 避免 pathname 为空字符串时误判非首页，引发顶栏 Link `muted` 的 hydration 警告 */
function normalizePathname(pathname: string | null | undefined) {
  if (pathname === "") return "/";
  return pathname ?? "/";
}

type NavLinkItem = {
  href: string;
  label: string;
  description?: string;
};

type NavGroup = {
  heading: string;
  items: NavLinkItem[];
};

type NavMenu = {
  id: string;
  label: string;
  groups: NavGroup[];
};

/** 顶栏「营销站」式结构：顶层为下拉菜单，每组内可继续分组，便于后续加链接 */
const NAV_MENUS: NavMenu[] = [
  {
    id: "market",
    label: "行情",
    groups: [
      {
        heading: "分析",
        items: [
          {
            href: "/analysis",
            label: "技术分析",
            description: "指标引擎、综合评分与订单簿摘要",
          },
          {
            href: "/market",
            label: "市场大盘",
            description: "Ticker 表、多周期涨幅榜与 24h 热力图",
          },
        ],
      },
      {
        heading: "监控",
        items: [
          {
            href: "/monitor",
            label: "市场监控",
            description: "黑马、费率、持仓、清算与多空比",
          },
        ],
      },
    ],
  },
  {
    id: "derivatives",
    label: "合约",
    groups: [
      {
        heading: "交易与内容",
        items: [
          { href: "/event", label: "事件合约", description: "策略输入与结算推演" },
          { href: "/live", label: "直播", description: "列表、排序与筛选" },
        ],
      },
    ],
  },
  {
    id: "tools",
    label: "工具",
    groups: [
      {
        heading: "计算",
        items: [{ href: "/calc", label: "计算器", description: "仓位与盈亏试算" }],
      },
    ],
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function menuHasActive(pathname: string, menu: NavMenu) {
  return menu.groups.some((g) => g.items.some((item) => isActivePath(pathname, item.href)));
}

/**
 * 是否在浏览器里（已挂载）。用于主题切换：服务端渲染时还不知道用户系统主题，
 * 先占位避免 SegmentedControl 与客户端不一致导致 hydration 警告。
 */
function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

function ThemeSwitcher() {
  const { colorMode, setColorMode } = useTheme();
  const isClient = useIsClient();

  const idx =
    colorMode === "auto"
      ? 1
      : colorMode === "day" || colorMode === "light"
        ? 0
        : colorMode === "night" || colorMode === "dark"
          ? 2
          : 1;

  if (!isClient) {
    return (
      <span
        aria-hidden
        style={{
          display: "inline-block",
          minHeight: 28,
          minWidth: 200,
          verticalAlign: "middle",
        }}
      />
    );
  }

  return (
    <SegmentedControl
      aria-label="配色主题"
      size="small"
      onChange={(selectedIndex) => {
        if (selectedIndex === 0) setColorMode("day");
        else if (selectedIndex === 1) setColorMode("auto");
        else setColorMode("night");
      }}
    >
      <SegmentedControl.Button selected={idx === 0}>浅色</SegmentedControl.Button>
      <SegmentedControl.Button selected={idx === 1}>系统</SegmentedControl.Button>
      <SegmentedControl.Button selected={idx === 2}>深色</SegmentedControl.Button>
    </SegmentedControl>
  );
}

function NavMenuDropdown({ menu, pathname }: { menu: NavMenu; pathname: string }) {
  const active = menuHasActive(pathname, menu);

  return (
    <ActionMenu>
      <ActionMenu.Button
        variant="invisible"
        size="medium"
        className="ctbox-nav-menu-trigger"
        data-active={active ? "true" : "false"}
        style={{ columnGap: 6 }}
      >
        {menu.label}
      </ActionMenu.Button>
      <ActionMenu.Overlay width="xlarge" align="start">
        <ActionList showDividers>
          {menu.groups.map((group) => (
            <ActionList.Group key={`${menu.id}-${group.heading}`}>
              <ActionList.GroupHeading>{group.heading}</ActionList.GroupHeading>
              {group.items.map((item) => {
                const itemActive = isActivePath(pathname, item.href);
                return (
                  <ActionList.LinkItem
                    key={item.href}
                    as={NextLink}
                    href={item.href}
                    active={itemActive}
                  >
                    {item.label}
                    {item.description ? (
                      <ActionList.Description variant="block">{item.description}</ActionList.Description>
                    ) : null}
                  </ActionList.LinkItem>
                );
              })}
            </ActionList.Group>
          ))}
        </ActionList>
      </ActionMenu.Overlay>
    </ActionMenu>
  );
}

export function AppChrome(props: { children: React.ReactNode }) {
  const pathname = normalizePathname(usePathname());

  return (
    <PageLayout containerWidth="xlarge" padding="normal" rowGap="none">
      <PageLayout.Header divider="none" padding="condensed" className="ctbox-site-header">
        <Stack direction="horizontal" justify="space-between" align="center" wrap="wrap" gap="normal">
          <Stack direction="horizontal" align="center" gap="normal" wrap="wrap">
            <PrimerLink
              as={NextLink}
              href="/"
              className="ctbox-nav-link ctbox-brand-wordmark"
              data-active={pathname === "/" ? "true" : "false"}
              muted={pathname !== "/"}
            >
              CTBox
            </PrimerLink>
            <Stack
              direction="horizontal"
              gap="none"
              wrap="wrap"
              className="ctbox-marketing-nav"
              align="center"
            >
              {NAV_MENUS.map((menu) => (
                <NavMenuDropdown key={menu.id} menu={menu} pathname={pathname} />
              ))}
            </Stack>
          </Stack>
          <ThemeSwitcher />
        </Stack>
      </PageLayout.Header>
      <PageLayout.Content
        width="full"
        padding="condensed"
        as="div"
        className="ctbox-page-content-wrap"
      >
        {props.children}
      </PageLayout.Content>
      <PageLayout.Footer divider="none" padding="none" className="ctbox-site-footer-shell">
        <SiteFooter />
      </PageLayout.Footer>
    </PageLayout>
  );
}
