import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "FLOTA")
  if (!auth.ok) return auth.response

  const { id } = await params
  const { observacionHojaVida } = await req.json()

  const solicitud = await prisma.solicitudVehiculo.findUnique({
    where: { id: parseInt(id) },
    include: { bitacora: true },
  })
  if (!solicitud) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (solicitud.estado !== "EN_CURSO") {
    return NextResponse.json({ error: "Solo se puede cerrar una solicitud en curso" }, { status: 400 })
  }
  if (!solicitud.bitacora?.kmLlegada) {
    return NextResponse.json({ error: "Debe registrar km de llegada antes de cerrar" }, { status: 400 })
  }

  const userId = parseInt(auth.session.user.id)
  const kmRecorridos = solicitud.bitacora.kmLlegada - solicitud.bitacora.kmSalida

  await prisma.$transaction([
    prisma.solicitudVehiculo.update({
      where: { id: parseInt(id) },
      data: { estado: "CERRADA", fechaCierre: new Date(), cerradoPorId: userId },
    }),
    prisma.hojaVidaVehiculo.create({
      data: {
        vehiculoId: solicitud.vehiculoId,
        solicitudId: parseInt(id),
        tipo: "USO",
        descripcion: observacionHojaVida?.trim() ||
          `Viaje a ${solicitud.destino} — ${kmRecorridos} km recorridos`,
        usuarioId: userId,
      },
    }),
  ])

  return NextResponse.json({ ok: true })
}