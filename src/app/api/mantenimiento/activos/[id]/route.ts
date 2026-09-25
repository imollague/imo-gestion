import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const { nombre, activo } = await req.json()

  const datos: Record<string, unknown> = {}
  if (nombre !== undefined) datos.nombre = nombre.trim()
  if (activo !== undefined) datos.activo = activo

  const resultado = await prisma.activoMantenimiento.update({ where: { id: parseInt(id) }, data: datos })
  return NextResponse.json(resultado)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const activoId = parseInt(id)

  const enUso = await prisma.registroMantenimiento.findFirst({ where: { activoId } })
  if (enUso) {
    const resultado = await prisma.activoMantenimiento.update({ where: { id: activoId }, data: { activo: false } })
    return NextResponse.json(resultado)
  }

  await prisma.activoMantenimiento.delete({ where: { id: activoId } })
  return NextResponse.json({ ok: true })
}
