import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "FLOTA", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const vehiculo = await prisma.vehiculo.findUnique({
    where: { id: parseInt(id) },
    include: {
      hojaVida: {
        orderBy: { fecha: "desc" },
        include: { usuario: { select: { name: true } } },
      },
      documentos: {
        orderBy: { fecha: "desc" },
        include: { subidoPor: { select: { name: true } } },
      },
      solicitudes: {
        orderBy: { fechaSolicitud: "desc" },
        take: 10,
        select: {
          id: true, estado: true, destino: true, proposito: true,
          conductorNombre: true, fechaSolicitud: true, fechaCierre: true,
        },
      },
    },
  })

  if (!vehiculo) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  return NextResponse.json(vehiculo)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "FLOTA", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = await req.json()
  const { patente, marca, modelo, anio, tipo, estado, kmActual,
    vencimientoSOAP, vencimientoRevTecnica, vencimientoPermiso, observaciones } = body

  const vehiculo = await prisma.vehiculo.update({
    where: { id: parseInt(id) },
    data: {
      ...(patente && { patente: patente.toUpperCase().trim() }),
      ...(marca && { marca }),
      ...(modelo && { modelo }),
      ...(anio && { anio: parseInt(anio) }),
      ...(tipo && { tipo }),
      ...(estado && { estado }),
      ...(kmActual !== undefined && { kmActual: parseInt(kmActual) }),
      ...(vencimientoSOAP !== undefined && { vencimientoSOAP: vencimientoSOAP ? new Date(vencimientoSOAP) : null }),
      ...(vencimientoRevTecnica !== undefined && { vencimientoRevTecnica: vencimientoRevTecnica ? new Date(vencimientoRevTecnica) : null }),
      ...(vencimientoPermiso !== undefined && { vencimientoPermiso: vencimientoPermiso ? new Date(vencimientoPermiso) : null }),
      ...(observaciones !== undefined && { observaciones }),
    },
  })

  return NextResponse.json(vehiculo)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN")
  if (!auth.ok) return auth.response

  const { id } = await params
  await prisma.vehiculo.update({
    where: { id: parseInt(id) },
    data: { activo: false },
  })

  return NextResponse.json({ ok: true })
}