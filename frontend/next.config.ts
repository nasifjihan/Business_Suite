import type { NextConfig } from "next";

/**
 * `output: "standalone"` exists for the Docker image only.
 *
 * "standalone" makes `next build` emit .next/standalone/ containing a
 * self-contained server.js plus ONLY the node_modules actually reached by the
 * code (Next traces the imports). The runtime image then needs no
 * `npm install` at all: copy that folder, .next/static and public/, and run
 * `node server.js`.
 *
 * Without it the image must carry the entire production node_modules tree,
 * which is several hundred MB of packages the server never loads.
 *
 * It MUST NOT be enabled on Vercel. Vercel builds through its own pipeline and
 * injects a build adapter via NEXT_ADAPTER_PATH; in Next.js 16.3 the two are
 * incompatible. When the adapter is active Next.js stops writing
 * .next/next-server.js.nft.json, but the standalone finalizer still reads it,
 * so the build dies with:
 *   ENOENT: no such file or directory, open '.next/next-server.js.nft.json'
 * Vercel sets VERCEL=1 in its build environment, so gating on it keeps
 * standalone for Docker and self-hosting while Vercel uses normal output.
 *
 * This has no effect on `npm run dev` either way.
 */
const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",

  /**
   * Same-origin API proxy — needed whenever the API sits on a DIFFERENT site
   * than the UI (e.g. UI on Vercel, API on Render).
   *
   * The refresh token is an HTTP-only cookie, and a browser only returns a
   * cookie to the site that set it. Across sites that cookie is a THIRD-PARTY
   * cookie, which Safari and Firefox block by default — and which Chrome is
   * phasing out. The failure looks like a working login followed by an
   * immediate logout: the access token lives only in Redux memory, so any
   * reload depends on POST /auth/refresh, and that is the one request whose
   * cookie the browser withholds. The app then redirects to
   * /login?expired=1.
   *
   * Pointing the browser at our OWN origin and proxying /api/v1 through to the
   * API makes the cookie first-party again. Pair this with
   * NEXT_PUBLIC_API_URL=/api/v1 so the client issues relative requests.
   *
   * Opt-in by design: with API_PROXY_TARGET unset there is no rewrite, so
   * `npm run dev` and the Docker/nginx image (already same-origin, and
   * therefore already first-party) are untouched.
   */
  async rewrites() {
    const target = process.env.API_PROXY_TARGET?.replace(/\/+$/, "");
    if (!target) return [];
    return [
      { source: "/api/v1/:path*", destination: `${target}/api/v1/:path*` },
    ];
  },
};

export default nextConfig;
