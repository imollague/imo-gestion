import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function GET(req: NextRequest) {
  const auth = await requireRole("ADMIN", "FLOTA", "ENCARGADO")
  if (!auth.ok) return auth.response

  const userId = parseInt(auth.session.user.id)
  const role = auth.session.user.role
  const { searchParams } = new URL(req.url)
  const todas = searchParams.get("todas") === "1"

  const puedeVerTodas = role === "ADMIN" || role === "ENCARGADO"
  const where = (puedeVerTodas && todas) ? {} : { creadoPorId: userId }

  const solicitudes = await prisma.solicitudVehiculo.findMany({
    where,
    orderBy: { fechaSolicitud: "desc" },
    include: {
      vehiculo: { select: { patente: true, marca: true, modelo: true } },
      checklist: { select: { id: true } },
      ordenServicio: { select: { id: true, firmada: true } },
      bitacora: { select: { id: true, kmSalida: true, kmLlegada: true } },
      aprobadoPor: { select: { name: true } },
    },
  })

  return NextResponse.json(solicitudes)
}

export async function POST(req: NextRequest) {
  const auth = await requireRole("ADMIN", "FLOTA", "ENCARGADO")
  if (!auth.ok) return auth.response

  const userId = parseInt(auth.session.user.id)
  const body = await req.json()
  const { vehiculoId, conductorNombre, destino, proposito } = body

  if (!vehiculoId || !conductorNombre || !destino || !proposito) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 })
  }

  const vehiculo = await prisma.vehiculo.findUnique({
    where: { id: parseInt(vehiculoId) },
    include: {
      solicitudes: {
        where: { estado: { in: ["PENDIENTE", "APROBADA", "EN_CURSO"] } },
      },
    },
  })
  if (!vehiculo) return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 })
  if (vehiculo.estado !== "OPERATIVO") {
    return NextResponse.json({ error: "El vehículo no está operativo" }, { status: 409 })
  }
  if (vehiculo.solicitudes.length > 0) {
    return NextResponse.json({ error: "El vehículo ya tiene una solicitud activa" }, { status: 409 })
  }

  const solicitud = await prisma.solicitudVehiculo.create({
    data: {
      vehiculoId: parseInt(vehiculoId),
      creadoPorId: userId,
      conductorNombre: conductorNombre.trim(),
      destino: destino.trim(),
      proposito: proposito.trim(),
    },
  })

  return NextResponse.json(solicitud, { status: 201 })
}