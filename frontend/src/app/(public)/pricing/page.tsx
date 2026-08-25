export default function PricingPage() {
  const tiers = [
    { name: "Self-hosted", price: "FREE", desc: "Forever — MIT licensed", features: ["All modules", "Full source code", "Self-host on Vercel + Render / Docker", "Community support"] },
    { name: "Managed (V2)", price: "TBD", desc: "Coming after v1 GA", features: ["Cloud hosting", "SSO & SCIM", "SLA + backups", "Priority email support"] },
  ];
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight text-center">Pricing</h1>
      <p className="mt-2 text-center text-muted">Simple, transparent — and free to self-host forever.</p>
      <div className="mt-12 grid md:grid-cols-2 gap-6">
        {tiers.map((t) => (
          <div key={t.name} className="rounded-2xl border border-border bg-card p-8">
            <div className="text-sm text-primary font-semibold">{t.name}</div>
            <div className="mt-2 text-5xl font-bold tracking-tight">{t.price}</div>
            <p className="mt-2 text-muted">{t.desc}</p>
            <ul className="mt-6 space-y-2 text-sm">
              {t.features.map((f) => (
                <li key={f} className="flex gap-2"><span className="text-success">✓</span>{f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </main>
  );
}
