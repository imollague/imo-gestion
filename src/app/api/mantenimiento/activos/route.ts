import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function GET() {
  const auth = await requireRole("ADMIN", "ENCARGADO", "MANTENIMIENTO")
  if (!auth.ok) return auth.response

  const activos = await prisma.activoMantenimiento.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
  })

  return NextResponse.json(activos)
}

export async function POST(req: NextRequest) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { nombre } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: "Nombre es obligatorio" }, { status: 400 })

  const activo = await prisma.activoMantenimiento.create({ data: { nombre: nombre.trim() } })
  return NextResponse.json(activo, { status: 201 })
}
