import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

// Registrar km salida → crea bitácora y pasa a EN_CURSO
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "FLOTA", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const { kmSalida } = await req.json()

  if (kmSalida == null) return NextResponse.json({ error: "Km de salida obligatorio" }, { status: 400 })

  const solicitud = await prisma.solicitudVehiculo.findUnique({
    where: { id: parseInt(id) },
    include: { ordenServicio: true, bitacora: true },
  })
  if (!solicitud) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (solicitud.estado !== "APROBADA" || !solicitud.ordenServicio?.firmada) {
    return NextResponse.json({ error: "La orden debe estar firmada antes de registrar salida" }, { status: 400 })
  }
  if (solicitud.bitacora) {
    return NextResponse.json({ error: "Bitácora ya iniciada" }, { status: 409 })
  }

  const [bitacora] = await prisma.$transaction([
    prisma.bitacoraViaje.create({
      data: { solicitudId: parseInt(id), kmSalida: parseInt(kmSalida) },
    }),
    prisma.solicitudVehiculo.update({
      where: { id: parseInt(id) },
      data: { estado: "EN_CURSO" },
    }),
    prisma.vehiculo.update({
      where: { id: solicitud.vehiculoId },
      data: { kmActual: parseInt(kmSalida) },
    }),
  ])

  return NextResponse.json(bitacora, { status: 201 })
}

// Registrar km llegada + observacion
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "FLOTA", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const { kmLlegada, horaRetornoReal, observacion } = await req.json()

  if (kmLlegada == null) return NextResponse.json({ error: "Km de llegada obligatorio" }, { status: 400 })

  const solicitud = await prisma.solicitudVehiculo.findUnique({
    where: { id: parseInt(id) },
    include: { bitacora: true },
  })
  if (!solicitud?.bitacora) return NextResponse.json({ error: "Bitácora no iniciada" }, { status: 404 })
  if (solicitud.bitacora.kmLlegada) {
    return NextResponse.json({ error: "Km de llegada ya registrado" }, { status: 409 })
  }
  if (parseInt(kmLlegada) <= solicitud.bitacora.kmSalida) {
    return NextResponse.json({ error: `El km de llegada debe ser mayor al de salida (${solicitud.bitacora.kmSalida} km)` }, { status: 400 })
  }

  const [bitacora] = await prisma.$transaction([
    prisma.bitacoraViaje.update({
      where: { solicitudId: parseInt(id) },
      data: {
        kmLlegada: parseInt(kmLlegada),
        horaRetornoReal: horaRetornoReal ? new Date(horaRetornoReal) : null,
        observacion: observacion?.trim() || null,
      },
    }),
    prisma.vehiculo.update({
      where: { id: solicitud.vehiculoId },
      data: { kmActual: parseInt(kmLlegada) },
    }),
  ])

  return NextResponse.json(bitacora)
}