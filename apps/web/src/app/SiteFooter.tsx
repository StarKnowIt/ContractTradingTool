import NextLink from "next/link";

/**
 * 全站页脚：多列站内链接 + 版权与免责声明。
 * 链接若调整，请与 AppChrome 里顶栏 NAV_MENUS 保持大致一致，避免用户迷路。
 */

const FOOTER_COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "行情",
    links: [
      { href: "/analysis", label: "技术分析" },
      { href: "/market", label: "市场大盘" },
      { href: "/monitor", label: "市场监控" },
    ],
  },
  {
    title: "合约与内容",
    links: [
      { href: "/event", label: "事件合约" },
      { href: "/live", label: "直播广场" },
    ],
  },
  {
    title: "工具",
    links: [{ href: "/calc", label: "合约计算器" }],
  },
  {
    title: "产品",
    links: [{ href: "/", label: "首页" }],
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <div className="ctbox-site-footer">
      <div className="ctbox-site-footer-main">
        <div className="ctbox-site-footer-grid" role="navigation" aria-label="页脚导航">
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title} className="ctbox-site-footer-col">
              <div className="ctbox-site-footer-col-title">{col.title}</div>
              <ul className="ctbox-site-footer-list">
                {col.links.map((item) => (
                  <li key={item.href}>
                    <NextLink href={item.href} className="ctbox-site-footer-link">
                      {item.label}
                    </NextLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="ctbox-site-footer-legal">
        <div className="ctbox-site-footer-legal-row">
          <span className="ctbox-site-footer-copy">© {year} CTBox · ContractTradingTool</span>
          <span className="ctbox-site-footer-sep" aria-hidden>
            ·
          </span>
          <span className="ctbox-site-footer-disclaimer">
            数据来自公开接口聚合，仅供学习与研究参考，不构成任何投资建议。
          </span>
        </div>
      </div>
    </div>
  );
}
