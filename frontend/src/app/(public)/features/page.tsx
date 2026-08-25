export default function FeaturesPage() {
  const modules = [
    { name: "CRM", bullets: ["Customer & contact directory", "Lead pipeline stages", "Timeline activities", "Segment filters & export"] },
    { name: "Inventory", bullets: ["Categories, SKUs, variants", "Multi-warehouse stock", "Movement audit log", "Negative-stock DB CHECK"] },
    { name: "POS + Sales", bullets: ["Cart + quick checkout", "Atomic transaction: order → items → invoice → payment → stock", "Partial payments + balance tracking", "Sales & top-products analytics"] },
    { name: "HRM", bullets: ["Employees, departments, designations", "Check-in / check-out attendance", "Leave workflow & approvals", "Reporting dashboard"] },
    { name: "RBAC + Audit", bullets: ["6 roles: Super Admin → Sales Rep", "Permission-based (not role-based)", "Immutable audit log with before/after snapshots", "Rate-limited auth endpoints"] },
    { name: "Deployment-ready", bullets: ["Dockerfiles (Phase 13)", "Vercel + Render runbooks (Phase 12)", "Zod-validated env config", "Graceful shutdown + Prisma disconnect"] },
  ];
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">Features</h1>
      <p className="mt-2 text-muted">What's included out of the box.</p>
      <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((m) => (
          <div key={m.name} className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">{m.name}</h2>
            <ul className="mt-3 space-y-1.5 text-sm text-muted">
              {m.bullets.map((b) => (
                <li key={b} className="flex gap-2"><span className="text-primary">•</span>{b}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-12 text-sm text-muted">
        <a className="text-primary underline" href="/">← Back home</a>
      </div>
    </main>
  );
}
