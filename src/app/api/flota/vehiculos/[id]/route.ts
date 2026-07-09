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
      vencimientos: { include: { tipoDocumento: true } },
    },
  })

  if (!vehiculo) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  return NextResponse.json(vehiculo)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "FLOTA", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const vehiculoId = parseInt(id)
  const body = await req.json()
  const { patente, marca, modelo, anio, tipo, estado, kmActual,
    licenciasPermitidas, observaciones, vencimientos } = body

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const operaciones: any[] = [
    prisma.vehiculo.update({
      where: { id: vehiculoId },
      data: {
        ...(patente && { patente: patente.toUpperCase().trim() }),
        ...(marca && { marca }),
        ...(modelo && { modelo }),
        ...(anio && { anio: parseInt(anio) }),
        ...(tipo && { tipo }),
        ...(estado && { estado }),
        ...(kmActual !== undefined && { kmActual: parseInt(kmActual) }),
        ...(licenciasPermitidas !== undefined && { licenciasPermitidas }),
        ...(observaciones !== undefined && { observaciones }),
      },
    }),
  ]

  // vencimientos: [{ tipoDocumentoId, fechaVencimiento }] — fechaVencimiento vacía borra el registro
  if (Array.isArray(vencimientos)) {
    for (const v of vencimientos as { tipoDocumentoId: number; fechaVencimiento: string | null }[]) {
      if (v.fechaVencimiento) {
        operaciones.push(
          prisma.vencimientoDocumentoVehiculo.upsert({
            where: { vehiculoId_tipoDocumentoId: { vehiculoId, tipoDocumentoId: v.tipoDocumentoId } },
            update: { fechaVencimiento: new Date(v.fechaVencimiento) },
            create: { vehiculoId, tipoDocumentoId: v.tipoDocumentoId, fechaVencimiento: new Date(v.fechaVencimiento) },
          })
        )
      } else {
        operaciones.push(
          prisma.vencimientoDocumentoVehiculo.deleteMany({
            where: { vehiculoId, tipoDocumentoId: v.tipoDocumentoId },
          })
        )
      }
    }
  }

  const [vehiculo] = await prisma.$transaction(operaciones)

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