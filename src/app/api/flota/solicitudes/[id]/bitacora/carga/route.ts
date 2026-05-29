import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "FLOTA", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const { kmAlMomento, litros, comprobanteRef } = await req.json()

  if (!kmAlMomento || !litros) {
    return NextResponse.json({ error: "Km y litros son obligatorios" }, { status: 400 })
  }

  const solicitud = await prisma.solicitudVehiculo.findUnique({
    where: { id: parseInt(id) },
    include: { bitacora: true },
  })
  if (!solicitud?.bitacora) return NextResponse.json({ error: "Bitácora no iniciada" }, { status: 404 })
  if (solicitud.estado !== "EN_CURSO") {
    return NextResponse.json({ error: "Solicitud no está en curso" }, { status: 400 })
  }

  const carga = await prisma.cargaCombustible.create({
    data: {
      bitacoraId: solicitud.bitacora.id,
      kmAlMomento: parseInt(kmAlMomento),
      litros: parseFloat(litros),
      comprobanteRef: comprobanteRef?.trim() || null,
    },
  })

  return NextResponse.json(carga, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "FLOTA", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const { cargaId } = await req.json()

  const solicitud = await prisma.solicitudVehiculo.findUnique({ where: { id: parseInt(id) } })
  if (solicitud?.estado === "CERRADA") {
    return NextResponse.json({ error: "Proceso cerrado, no se puede modificar" }, { status: 400 })
  }

  await prisma.cargaCombustible.delete({ where: { id: parseInt(cargaId) } })
  return NextResponse.json({ ok: true })
}