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
    const packageJsonPath = resolve(__dirname, "../../../../package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    const version: string = packageJson.version || "0.0.0";

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
