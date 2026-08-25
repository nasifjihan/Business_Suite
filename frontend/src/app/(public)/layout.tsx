export default function PublicRouteGroupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Public marketing pages share no chrome besides <html/body> (root layout handles StoreProvider)
  return children;
}
