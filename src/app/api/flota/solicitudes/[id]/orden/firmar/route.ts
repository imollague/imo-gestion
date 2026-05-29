import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const solicitud = await prisma.solicitudVehiculo.findUnique({
    where: { id: parseInt(id) },
    include: { ordenServicio: true },
  })
  if (!solicitud) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (!solicitud.ordenServicio) {
    return NextResponse.json({ error: "No existe orden de servicio" }, { status: 400 })
  }
  if (solicitud.ordenServicio.firmada) {
    return NextResponse.json({ error: "Orden ya firmada" }, { status: 409 })
  }

  const orden = await prisma.ordenServicioFlota.update({
    where: { solicitudId: parseInt(id) },
    data: {
      firmada: true,
      firmadaPorId: parseInt(auth.session.user.id),
      fechaFirma: new Date(),
    },
  })

  return NextResponse.json(orden)
}