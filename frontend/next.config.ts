import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Required for the Docker image.
   *
   * "standalone" makes `next build` emit .next/standalone/ containing a
   * self-contained server.js plus ONLY the node_modules actually reached by
   * the code (Next traces the imports). The runtime image then needs no
   * `npm install` at all: copy that folder, .next/static and public/, and run
   * `node server.js`.
   *
   * Without it the image must carry the entire production node_modules tree,
   * which is several hundred MB of packages the server never loads.
   *
   * This has no effect on `npm run dev`, and Vercel ignores it - Vercel uses
   * its own build pipeline, so production deployment is unchanged.
   */
  output: "standalone",
};

export default nextConfig;
