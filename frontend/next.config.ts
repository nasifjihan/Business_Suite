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
};

export default nextConfig;
