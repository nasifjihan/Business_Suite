import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import StoreProvider from "@/store/StoreProvider";
import AuthHydrationProvider from "@/components/auth/AuthHydrationProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Business Suite";

export const metadata: Metadata = {
  title: {
    default: appName,
    template: `%s · ${appName}`,
  },
  description: "Open-source CRM + Inventory + POS + HRM Business Suite built with Next.js 16, Express 4, Prisma, and PostgreSQL 18.",
  keywords: ["CRM", "POS", "Inventory", "HRM", "Business Suite", "SaaS"],
  authors: [{ name: "Nasif Jihan" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <StoreProvider>
          <AuthHydrationProvider>{children}</AuthHydrationProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
