import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local", override: true }); // sobreescribe con valores locales si existe
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: 'tsx prisma/seed.ts'
  },
  datasource: {
    // Para migrations usar DIRECT_URL (conexión directa, no pooler)
    url: (process.env.DIRECT_URL || process.env.DATABASE_URL)!,
  },
});
