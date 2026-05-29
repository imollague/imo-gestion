import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const solicitud = await prisma.solicitudVehiculo.findUnique({ where: { id: parseInt(id) } })
  if (!solicitud) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (solicitud.estado !== "PENDIENTE") {
    return NextResponse.json({ error: "Solo se pueden aprobar solicitudes pendientes" }, { status: 400 })
  }

  const actualizada = await prisma.solicitudVehiculo.update({
    where: { id: parseInt(id) },
    data: {
      estado: "APROBADA",
      aprobadoPorId: parseInt(auth.session.user.id),
      fechaAprobacion: new Date(),
    },
  })

  return NextResponse.json(actualizada)
}