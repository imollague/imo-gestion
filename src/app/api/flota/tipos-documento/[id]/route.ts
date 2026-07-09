import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = await req.json()
  const { nombre, diasAlertaDefault } = body

  const tipo = await prisma.tipoDocumentoVehiculo.findUnique({ where: { id: parseInt(id) } })
  if (!tipo) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (tipo.esDefault && nombre !== undefined) {
    return NextResponse.json({ error: "No se puede renombrar un tipo de documento por defecto" }, { status: 400 })
  }

  const actualizado = await prisma.tipoDocumentoVehiculo.update({
    where: { id: parseInt(id) },
    data: {
      ...(nombre !== undefined && !tipo.esDefault && { nombre: nombre.trim() }),
      ...(diasAlertaDefault !== undefined && { diasAlertaDefault: parseInt(diasAlertaDefault) }),
    },
  })

  return NextResponse.json(actualizado)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const tipo = await prisma.tipoDocumentoVehiculo.findUnique({ where: { id: parseInt(id) } })
  if (!tipo) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (tipo.esDefault) {
    return NextResponse.json({ error: "No se puede eliminar un tipo de documento por defecto" }, { status: 400 })
  }

  await prisma.tipoDocumentoVehiculo.update({ where: { id: parseInt(id) }, data: { activo: false } })
  return NextResponse.json({ ok: true })
}
