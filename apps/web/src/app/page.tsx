import { fetchJson } from "@/lib/api";

export default function Home() {
  return (
    <main style={{ padding: "16px 0" }}>
      <h1 style={{ fontSize: 18, marginBottom: 8 }}>ContractTradingTool (CTBox)</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
        这是 React/Next.js 迁移版的入口页。目前先完成路由骨架与样式复用，接下来会按顺序迁移各功能页。
      </p>
      <Ping />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a className="btn" href="/analysis">进入分析页</a>
        <a className="btn secondary" href="/monitor">进入监控页</a>
        <a className="btn secondary" href="/calc">进入计算器</a>
      </div>
    </main>
  );
}

async function Ping() {
  try {
    const data = await fetchJson<{ ok: boolean; t: number }>("/ping");
    return (
      <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 10 }}>
        API：{data.ok ? "OK" : "FAIL"}（{new Date(data.t).toLocaleString("zh-CN")}）
      </div>
    );
  } catch (e) {
    return (
      <div style={{ fontSize: 12, color: "var(--red)", marginBottom: 10 }}>
        API 未连通：{e instanceof Error ? e.message : String(e)}
      </div>
    );
  }
}
