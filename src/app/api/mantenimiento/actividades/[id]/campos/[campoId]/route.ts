import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; campoId: string }> }) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { campoId } = await params
  const body = await req.json()
  const { descripcion, requiereImagen, tipo, valorMin, valorMax, orden, activo } = body

  if (tipo !== undefined && !["TEXTO", "FECHA_HORA", "NUMERO"].includes(tipo)) {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 })
  }

  const datos: Record<string, unknown> = {}
  if (descripcion !== undefined) datos.descripcion = descripcion.trim()
  if (requiereImagen !== undefined) datos.requiereImagen = Boolean(requiereImagen)
  if (tipo !== undefined) datos.tipo = tipo
  if (valorMin !== undefined) datos.valorMin = valorMin === null || valorMin === "" ? null : parseFloat(valorMin)
  if (valorMax !== undefined) datos.valorMax = valorMax === null || valorMax === "" ? null : parseFloat(valorMax)
  if (orden !== undefined) datos.orden = parseInt(orden)
  if (activo !== undefined) datos.activo = activo

  const campo = await prisma.campoActividadMantenimiento.update({
    where: { id: parseInt(campoId) },
    data: datos,
  })

  return NextResponse.json(campo)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; campoId: string }> }) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { campoId } = await params
  const id = parseInt(campoId)

  const tieneRespuestas = await prisma.respuestaMantenimiento.findFirst({ where: { campoId: id } })
  if (tieneRespuestas) {
    const campo = await prisma.campoActividadMantenimiento.update({ where: { id }, data: { activo: false } })
    return NextResponse.json(campo)
  }

  await prisma.campoActividadMantenimiento.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
