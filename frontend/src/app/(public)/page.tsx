"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Activity, ArrowRight, Boxes, Users, Wallet, UserCog, Building2 } from "lucide-react";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Business Suite";

export default function HomePage() {
  // (Phase 1 placeholder — Phase 4 swaps this out for real shadcn-style landing)
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <header className="sticky top-0 z-40 backdrop-blur border-b border-border/70 bg-card/80">
        <nav className="mx-auto max-w-7xl flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <Building2 className="w-5 h-5 text-primary" />
            <span>{appName}</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-muted">
            <Link href="/features">Features</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/contact">Contact</Link>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/login">
              <Button size="sm">Get started <ArrowRight className="w-4 h-4 ml-1" /></Button>
            </Link>
          </div>
        </nav>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-24 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary border border-primary/20">
          <Activity className="w-3.5 h-3.5" />
          Phase 1 — 3-tier connectivity verified
        </span>
        <h1 className="mt-6 text-5xl md:text-6xl font-bold tracking-tight leading-tight">
          One unified suite to run your<br />
          <span className="bg-gradient-to-r from-primary to-indigo-400 bg-clip-text text-transparent">
            entire small business.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
          CRM, Inventory, Point of Sale, Sales Invoicing, HR & Attendance —
          all with role-based access control, audit logs, and PostgreSQL-backed correctness.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link href="/login">
            <Button size="lg">Launch Dashboard <ArrowRight className="w-4 h-4 ml-1.5" /></Button>
          </Link>
          <Link href="/features">
            <Button size="lg" variant="outline">Explore modules</Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Users, title: "CRM", desc: "Leads, customers, pipeline, follow-ups" },
          { icon: Boxes, title: "Inventory", desc: "Products, stock levels, warehouses, movements" },
          { icon: Wallet, title: "POS + Sales", desc: "Atomic checkout, invoices, payments, ledger" },
          { icon: UserCog, title: "HRM", desc: "Employees, attendance, leave approvals" },
        ].map((m) => (
          <div key={m.title} className="rounded-xl border border-border bg-card p-6 transition hover:shadow-md hover:-translate-y-0.5">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <m.icon className="w-5 h-5" />
            </div>
            <h3 className="mt-4 font-semibold">{m.title}</h3>
            <p className="mt-1 text-sm text-muted">{m.desc}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border py-10 text-center text-sm text-muted">
        Built with Next.js 16 · Express · Prisma · PostgreSQL — &copy; {new Date().getFullYear()} {appName}
      </footer>
    </main>
  );
}
