import "dotenv/config";
import { defineConfig } from "prisma/config";

// `prisma generate` does not connect to the database, so allow a placeholder
// URL when no environment is present (e.g. during a fresh npm install).
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: databaseUrl,
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
