import "dotenv/config";
import { defineConfig, env, type PrismaConfig } from "prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
  seed: [
    {
      run: "npx ts-node prisma/seed.ts",
    },
  ],
} as PrismaConfig);
