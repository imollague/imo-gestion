import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "FLOTA", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const { km, descripcion, litros, comprobanteRef, pasajeros } = await req.json()

  if (km == null) {
    return NextResponse.json({ error: "Km es obligatorio" }, { status: 400 })
  }

  const solicitud = await prisma.solicitudVehiculo.findUnique({
    where: { id: parseInt(id) },
    include: { bitacora: true },
  })
  if (!solicitud?.bitacora) return NextResponse.json({ error: "Bitácora no iniciada" }, { status: 404 })
  if (solicitud.estado !== "EN_CURSO") {
    return NextResponse.json({ error: "Solicitud no está en curso" }, { status: 400 })
  }

  const pasajerosData = Array.isArray(pasajeros)
    ? pasajeros
        .filter((p: { nombre?: string }) => p.nombre?.trim())
        .map((p: { nombre: string; rut?: string }) => ({ nombre: p.nombre.trim(), rut: p.rut?.trim() || null }))
    : []

  const parada = await prisma.paradaViaje.create({
    data: {
      bitacoraId: solicitud.bitacora.id,
      km: parseInt(km),
      descripcion: descripcion?.trim() || null,
      litros: litros ? parseFloat(litros) : null,
      comprobanteRef: comprobanteRef?.trim() || null,
      pasajeros: pasajerosData.length > 0 ? { create: pasajerosData } : undefined,
    },
    include: { pasajeros: { orderBy: { id: "asc" } } },
  })

  return NextResponse.json(parada, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "FLOTA", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const { paradaId } = await req.json()

  const solicitud = await prisma.solicitudVehiculo.findUnique({ where: { id: parseInt(id) } })
  if (solicitud?.estado === "CERRADA") {
    return NextResponse.json({ error: "Proceso cerrado, no se puede modificar" }, { status: 400 })
  }

  await prisma.paradaViaje.delete({ where: { id: parseInt(paradaId) } })
  return NextResponse.json({ ok: true })
}