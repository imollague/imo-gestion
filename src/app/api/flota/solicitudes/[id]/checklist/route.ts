import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "FLOTA", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const solicitudId = parseInt(id)
  const { respuestas } = await req.json()
  // respuestas: [{ itemId, valor, observacion }]

  const solicitud = await prisma.solicitudVehiculo.findUnique({
    where: { id: solicitudId },
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

  const noOk = respuestas.filter((r: { valor: string }) => r.valor === "NO_OK")
  const items = noOk.length > 0
    ? await prisma.checklistItem.findMany({ where: { id: { in: noOk.map((r: { itemId: number }) => r.itemId) } } })
    : []
  const itemPorId = new Map(items.map((i) => [i.id, i.descripcion]))
  const userId = parseInt(auth.session.user.id)

  const [checklist] = await prisma.$transaction([
    prisma.checklistSolicitud.create({
      data: {
        solicitudId,
        respuestas: {
          create: respuestas.map((r: { itemId: number; valor: string; observacion?: string }) => ({
            itemId: r.itemId,
            valor: r.valor,
            observacion: r.observacion || null,
          })),
        },
      },
    }),
    prisma.hojaVidaVehiculo.create({
      data: {
        vehiculoId: solicitud.vehiculoId,
        solicitudId,
        tipo: "CHECKLIST",
        descripcion: `Checklist pre-salida: ${respuestas.length - noOk.length} OK, ${noOk.length} NO OK`,
        usuarioId: userId,
      },
    }),
    ...noOk.flatMap((r: { itemId: number; observacion?: string }) => {
      const descripcion = `${itemPorId.get(r.itemId) ?? "Ítem"}: ${r.observacion}`
      return [
        prisma.observacionVehiculo.create({
          data: {
            vehiculoId: solicitud.vehiculoId,
            solicitudId,
            origen: "CHECKLIST",
            descripcion,
            creadoPorId: userId,
          },
        }),
        prisma.hojaVidaVehiculo.create({
          data: {
            vehiculoId: solicitud.vehiculoId,
            solicitudId,
            tipo: "OBSERVACION",
            descripcion,
            usuarioId: userId,
          },
        }),
      ]
    }),
  ])

  return NextResponse.json(checklist, { status: 201 })
}