import 'dotenv/config'
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const items = [
  // DOCUMENTACION
  { categoria: "DOCUMENTACION", descripcion: "SOAP vigente", orden: 1 },
  { categoria: "DOCUMENTACION", descripcion: "Revisión técnica al día", orden: 2 },
  { categoria: "DOCUMENTACION", descripcion: "Permiso de circulación vigente", orden: 3 },
  { categoria: "DOCUMENTACION", descripcion: "Licencia de conducir (conductor)", orden: 4 },
  // NIVELES
  { categoria: "NIVELES", descripcion: "Nivel de aceite motor", orden: 1 },
  { categoria: "NIVELES", descripcion: "Nivel de agua / refrigerante", orden: 2 },
  { categoria: "NIVELES", descripcion: "Nivel de combustible", orden: 3 },
  { categoria: "NIVELES", descripcion: "Presión de neumáticos", orden: 4 },
  // ELECTRICO
  { categoria: "ELECTRICO", descripcion: "Luces delanteras", orden: 1 },
  { categoria: "ELECTRICO", descripcion: "Luces traseras y freno", orden: 2 },
  { categoria: "ELECTRICO", descripcion: "Luces de emergencia", orden: 3 },
  { categoria: "ELECTRICO", descripcion: "Estado de batería", orden: 4 },
  // SISTEMAS
  { categoria: "SISTEMAS", descripcion: "Frenos", orden: 1 },
  { categoria: "SISTEMAS", descripcion: "Dirección", orden: 2 },
  { categoria: "SISTEMAS", descripcion: "Limpiaparabrisas", orden: 3 },
  { categoria: "SISTEMAS", descripcion: "Cinturones de seguridad", orden: 4 },
  // GENERAL
  { categoria: "GENERAL", descripcion: "Estado externo del vehículo", orden: 1 },
  { categoria: "GENERAL", descripcion: "Extintor operativo", orden: 2 },
  { categoria: "GENERAL", descripcion: "Triángulos de emergencia", orden: 3 },
  { categoria: "GENERAL", descripcion: "Botiquín de primeros auxilios", orden: 4 },
]

async function main() {
  for (const item of items) {
    await prisma.checklistItem.upsert({
      where: { id: items.indexOf(item) + 1 },
      update: {},
      create: item,
    })
  }
  console.log(`${items.length} ítems de checklist creados`)
}

main().catch(console.error).finally(() => prisma.$disconnect())