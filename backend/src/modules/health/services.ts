import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../../lib/prisma";

export class HealthService {
  static async getStatus(): Promise<{
    status: "ok" | "degraded";
    uptimeSeconds: number;
    db: "connected" | "disconnected";
    version: string;
    timestamp: string;
  }> {
    // __dirname is <backend>/src/modules/health under ts-node (dev/test) and
    // <backend>/dist/modules/health in production. tsconfig.build.json sets
    // rootDir: "src", so dist/ mirrors src/ and this depth is correct in BOTH.
    // (It was "../../../../" before, which pointed one level ABOVE backend/ —
    // there is no package.json there, so readFileSync threw and /health 500'd.)
    //
    // The try/catch matters independently: a health probe must never fail because
    // of a missing version string. Docker HEALTHCHECK and Render both read any
    // non-2xx as "this container is dead" and will restart or refuse to route to it.
    let version = "0.0.0";
    try {
      const packageJsonPath = resolve(__dirname, "../../../package.json");
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
      version = packageJson.version || "0.0.0";
    } catch {
      version = process.env.npm_package_version || "0.0.0";
    }

    const uptimeSeconds = Math.round(process.uptime());

    let db: "connected" | "disconnected" = "disconnected";
    try {
      const row = await prisma.$queryRawUnsafe<[{ ok: number }]>("SELECT 1::int as ok");
      if (Array.isArray(row) && row[0]?.ok === 1) {
        db = "connected";
      }
    } catch {
      db = "disconnected";
    }

    const status: "ok" | "degraded" = db === "connected" ? "ok" : "degraded";
    const timestamp = new Date().toISOString();

    return {
      status,
      uptimeSeconds,
      db,
      version,
      timestamp,
    };
  }
}
