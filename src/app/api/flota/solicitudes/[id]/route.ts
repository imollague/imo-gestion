import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "FLOTA")
  if (!auth.ok) return auth.response

  const { id } = await params
  const solicitud = await prisma.solicitudVehiculo.findUnique({
    where: { id: parseInt(id) },
    include: {
      vehiculo: true,
      creadoPor: { select: { id: true, name: true } },
      aprobadoPor: { select: { name: true } },
      cerradoPor: { select: { name: true } },
      checklist: {
        include: {
          respuestas: {
            include: { item: true },
            orderBy: { item: { orden: "asc" } },
          },
        },
      },
      ordenServicio: {
        include: { firmadaPor: { select: { name: true } } },
      },
      bitacora: {
        include: {
          cargas: { orderBy: { fecha: "asc" } },
        },
      },
      hojaVida: {
        orderBy: { fecha: "desc" },
        include: { usuario: { select: { name: true } } },
      },
    },
  })

  if (!solicitud) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  return NextResponse.json(solicitud)
}