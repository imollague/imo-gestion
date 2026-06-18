import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function GET() {
  const auth = await requireRole("ADMIN", "FLOTA", "ENCARGADO")
  if (!auth.ok) return auth.response

  const tipos = await prisma.tipoDocumentoVehiculo.findMany({
    where: { activo: true },
    orderBy: [{ esDefault: "desc" }, { nombre: "asc" }],
  })

  return NextResponse.json(tipos)
}

export async function POST(req: NextRequest) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { nombre, diasAlertaDefault } = body

  if (!nombre) return NextResponse.json({ error: "Nombre es obligatorio" }, { status: 400 })

  const tipo = await prisma.tipoDocumentoVehiculo.create({
    data: {
      nombre: nombre.trim(),
      diasAlertaDefault: diasAlertaDefault ? parseInt(diasAlertaDefault) : 30,
    },
  })

  return NextResponse.json(tipo, { status: 201 })
}
