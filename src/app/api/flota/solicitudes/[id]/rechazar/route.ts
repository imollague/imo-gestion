import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN")
  if (!auth.ok) return auth.response

  const { id } = await params
  const { motivo } = await req.json()

  const solicitud = await prisma.solicitudVehiculo.findUnique({ where: { id: parseInt(id) } })
  if (!solicitud) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (solicitud.estado !== "PENDIENTE") {
    return NextResponse.json({ error: "Solo se pueden rechazar solicitudes pendientes" }, { status: 400 })
  }

  const actualizada = await prisma.solicitudVehiculo.update({
    where: { id: parseInt(id) },
    data: {
      estado: "RECHAZADA",
      motivoRechazo: motivo?.trim() || null,
      aprobadoPorId: parseInt(auth.session.user.id),
      fechaAprobacion: new Date(),
    },
  })

  return NextResponse.json(actualizada)
}