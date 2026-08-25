export default function DashboardIndexPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome 👋</h1>
          <p className="text-muted mt-1 text-sm">
            Phases 5-9 will replace these placeholder cards with real KPI widgets, tables and charts.
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Customers", value: "—", trend: "CRM · Phase 5" },
          { label: "Products in stock", value: "—", trend: "Inventory · Phase 6" },
          { label: "Revenue (MTD)", value: "$ —", trend: "Sales · Phase 7" },
          { label: "Active employees", value: "—", trend: "HRM · Phase 8" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-5">
            <div className="text-sm text-muted">{k.label}</div>
            <div className="mt-2 text-2xl font-semibold">{k.value}</div>
            <div className="mt-2 text-xs text-muted">{k.trend}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6 min-h-[320px]">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Sales trend</h2>
            <span className="text-xs text-muted">ECharts · Phase 9</span>
          </div>
          <p className="mt-12 text-center text-muted text-sm">Chart placeholder</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 min-h-[320px]">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recent activity</h2>
            <span className="text-xs text-muted">Phase 5+</span>
          </div>
          <div className="mt-4 space-y-2 text-sm text-muted">
            <p>• No activity yet — start exploring modules after Phase 3.</p>
            <p>• Tip: visit <a className="text-primary underline" href="/dashboard/health-test">/dashboard/health-test</a> to verify 3-tier connectivity.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
