export default function LivePage() {
  return (
    <main style={{ padding: "12px 0" }}>
      <h2 style={{ fontSize: 16, marginBottom: 8 }}>直播（迁移中）</h2>
      <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6 }}>
        该页会把原 `pages/live.html` 的排序/筛选/聚合逻辑迁到 React，并与独立 API 的直播数据源配置解耦。
      </p>
    </main>
  );
}

