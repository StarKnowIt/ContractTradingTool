export default function MonitorPage() {
  return (
    <main style={{ padding: "12px 0" }}>
      <h2 style={{ fontSize: 16, marginBottom: 8 }}>监控（迁移中）</h2>
      <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6 }}>
        该页后续会引入统一的数据请求层（SWR/React Query），替代原先的轮询与 allSettled 聚合逻辑，提升可维护性与错误恢复能力。
      </p>
    </main>
  );
}

