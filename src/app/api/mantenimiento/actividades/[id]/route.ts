import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = await req.json()
  const { nombre, orden, activo, intervaloDiasAlerta } = body

  const datos: Record<string, unknown> = {}
  if (nombre !== undefined) datos.nombre = nombre.trim()
  if (orden !== undefined) datos.orden = parseInt(orden)
  if (activo !== undefined) datos.activo = activo
  if (intervaloDiasAlerta !== undefined) {
    datos.intervaloDiasAlerta = intervaloDiasAlerta === null || intervaloDiasAlerta === "" ? null : parseInt(intervaloDiasAlerta)
  }

  const actividad = await prisma.actividadMantenimiento.update({
    where: { id: parseInt(id) },
    data: datos,
  })

  return NextResponse.json(actividad)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const actividadId = parseInt(id)

  const tieneBloques = await prisma.bloqueMantenimiento.findFirst({ where: { actividadId } })
  if (tieneBloques) {
    // Ya tiene historial: se desactiva en vez de borrar, para no perder datos
    const actividad = await prisma.actividadMantenimiento.update({ where: { id: actividadId }, data: { activo: false } })
    return NextResponse.json(actividad)
  }

  await prisma.campoActividadMantenimiento.deleteMany({ where: { actividadId } })
  await prisma.actividadMantenimiento.delete({ where: { id: actividadId } })
  return NextResponse.json({ ok: true })
}
