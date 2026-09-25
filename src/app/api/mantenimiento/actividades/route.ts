import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function GET() {
  const auth = await requireRole("ADMIN", "ENCARGADO", "MANTENIMIENTO")
  if (!auth.ok) return auth.response

  const actividades = await prisma.actividadMantenimiento.findMany({
    where: { activo: true },
    include: { campos: { where: { activo: true }, orderBy: { orden: "asc" } } },
    orderBy: { orden: "asc" },
  })

  return NextResponse.json(actividades)
}

export async function POST(req: NextRequest) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { nombre } = body
  if (!nombre?.trim()) return NextResponse.json({ error: "Nombre es obligatorio" }, { status: 400 })

  const max = await prisma.actividadMantenimiento.aggregate({ _max: { orden: true } })

  const actividad = await prisma.actividadMantenimiento.create({
    data: { nombre: nombre.trim(), orden: (max._max.orden ?? -1) + 1 },
    include: { campos: true },
  })

  return NextResponse.json(actividad, { status: 201 })
}
