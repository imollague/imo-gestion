import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "FLOTA", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const { horaSalidaEst, horaRetornoEst, folioFedoks } = await req.json()

  if (!horaSalidaEst) {
    return NextResponse.json({ error: "Hora de salida estimada es obligatoria" }, { status: 400 })
  }

  const solicitud = await prisma.solicitudVehiculo.findUnique({
    where: { id: parseInt(id) },
    include: { checklist: true, ordenServicio: true },
  })
  if (!solicitud) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (solicitud.estado !== "APROBADA") {
    return NextResponse.json({ error: "La solicitud debe estar aprobada" }, { status: 400 })
  }
  if (!solicitud.checklist) {
    return NextResponse.json({ error: "Debe completar el checklist primero" }, { status: 400 })
  }
  if (solicitud.ordenServicio) {
    return NextResponse.json({ error: "Orden de servicio ya creada" }, { status: 409 })
  }

  const orden = await prisma.ordenServicioFlota.create({
    data: {
      solicitudId: parseInt(id),
      horaSalidaEst: new Date(horaSalidaEst),
      horaRetornoEst: horaRetornoEst ? new Date(horaRetornoEst) : null,
      folioFedoks: folioFedoks?.trim() || null,
    },
  })

  return NextResponse.json(orden, { status: 201 })
}