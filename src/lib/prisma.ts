import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../generated/prisma/client"
import { Pool } from "pg"

// En Vercel (serverless) limitamos el pool a 1 conexión por instancia para no agotar
// el límite del Transaction mode pooler de Supabase (puerto 6543).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 1,
})

const adapter = new PrismaPg(pool)

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma || new PrismaClient({ adapter })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma