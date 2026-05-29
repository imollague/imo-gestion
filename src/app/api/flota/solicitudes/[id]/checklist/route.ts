import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "FLOTA", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const { respuestas } = await req.json()
  // respuestas: [{ itemId, valor, observacion }]

  const solicitud = await prisma.solicitudVehiculo.findUnique({
    where: { id: parseInt(id) },
    include: { checklist: true },
  })
  if (!solicitud) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (solicitud.estado !== "APROBADA") {
    return NextResponse.json({ error: "La solicitud debe estar aprobada" }, { status: 400 })
  }
  if (solicitud.checklist) {
    return NextResponse.json({ error: "Checklist ya completado" }, { status: 409 })
  }
  if (!respuestas?.length) {
    return NextResponse.json({ error: "Se requieren respuestas del checklist" }, { status: 400 })
  }

  const checklist = await prisma.checklistSolicitud.create({
    data: {
      solicitudId: parseInt(id),
      respuestas: {
        create: respuestas.map((r: { itemId: number; valor: string; observacion?: string }) => ({
          itemId: r.itemId,
          valor: r.valor,
          observacion: r.observacion || null,
        })),
      },
    },
  })

  return NextResponse.json(checklist, { status: 201 })
}