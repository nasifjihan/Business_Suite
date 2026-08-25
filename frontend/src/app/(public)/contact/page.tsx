export default function ContactPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">Contact</h1>
      <p className="mt-2 text-muted">Questions? Feedback? Found a bug?</p>
      <div className="mt-10 rounded-2xl border border-border bg-card p-8">
        <p className="text-muted">
          This is an open-source project. For feature requests and bug reports,
          please <a href="#" className="text-primary underline">open a GitHub issue</a> (repo to be linked after Phase 0+1 commit push).
        </p>
        <dl className="mt-6 grid sm:grid-cols-2 gap-4 text-sm">
          <div><dt className="text-muted">Maintainer</dt><dd className="mt-0.5 font-medium">Nasif Jihan</dd></div>
          <div><dt className="text-muted">License</dt><dd className="mt-0.5 font-medium">MIT</dd></div>
          <div><dt className="text-muted">Stack</dt><dd className="mt-0.5 font-medium">Next.js 16 · Express · Prisma · Postgres 18</dd></div>
          <div><dt className="text-muted">Repository</dt><dd className="mt-0.5 font-medium truncate">github.com/Nasif28/business-suite (coming)</dd></div>
        </dl>
      </div>
    </main>
  );
}
