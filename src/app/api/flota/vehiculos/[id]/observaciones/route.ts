import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "FLOTA", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const observaciones = await prisma.observacionVehiculo.findMany({
    where: { vehiculoId: parseInt(id) },
    orderBy: [{ estado: "asc" }, { fecha: "desc" }],
    include: {
      creadoPor: { select: { name: true } },
      cerradoPor: { select: { name: true } },
      notas: { orderBy: { fecha: "asc" }, include: { autor: { select: { name: true } } } },
      archivos: { orderBy: { fecha: "asc" }, include: { subidoPor: { select: { name: true } } } },
    },
  })

  return NextResponse.json(observaciones)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const { descripcion } = await req.json()
  if (!descripcion?.trim()) return NextResponse.json({ error: "La descripción es obligatoria" }, { status: 400 })

  const observacion = await prisma.observacionVehiculo.create({
    data: {
      vehiculoId: parseInt(id),
      origen: "MANUAL",
      descripcion: descripcion.trim(),
      creadoPorId: parseInt(auth.session.user.id),
    },
  })

  return NextResponse.json(observacion, { status: 201 })
}
