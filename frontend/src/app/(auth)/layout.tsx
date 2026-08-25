export default function AuthRouteGroupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Auth pages share a centered card layout on a soft gradient background
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30 p-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
