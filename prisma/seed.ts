import 'dotenv/config'
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"
import bcrypt from "bcryptjs"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME ?? "admin"
  const password = process.env.SEED_ADMIN_PASSWORD
  const name = process.env.SEED_ADMIN_NAME ?? "Administrador"

  if (!password) {
    throw new Error("SEED_ADMIN_PASSWORD no definida en variables de entorno")
  }
  const hashedPassword = await bcrypt.hash(password, 10)

  const admin = await prisma.user.upsert({
    where: { username },
    update: {},
    create: {
      username,
      name,
      password: hashedPassword,
      role: "ADMIN",
    },
  })

  console.log("Usuario admin creado:", username)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())