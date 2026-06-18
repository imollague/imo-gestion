import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "FLOTA", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const conductor = await prisma.conductorFlota.findUnique({
    where: { id: parseInt(id) },
    include: { user: { select: { id: true, name: true, username: true } } },
  })
  if (!conductor) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  return NextResponse.json(conductor)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = await req.json()
  const { nombre, rut, numeroCaucion, numeroLicencia, tipoLicencia, fechaLicencia, userId, activo } = body

  const conductor = await prisma.conductorFlota.update({
    where: { id: parseInt(id) },
    data: {
      ...(nombre !== undefined && { nombre: nombre.trim() }),
      ...(rut !== undefined && { rut: rut?.trim() || null }),
      ...(numeroCaucion !== undefined && { numeroCaucion: numeroCaucion?.trim() || null }),
      ...(numeroLicencia !== undefined && { numeroLicencia: numeroLicencia?.trim() || null }),
      ...(tipoLicencia !== undefined && { tipoLicencia }),
      ...(fechaLicencia !== undefined && { fechaLicencia: fechaLicencia ? new Date(fechaLicencia) : null }),
      ...(userId !== undefined && { userId: userId ? parseInt(userId) : null }),
      ...(activo !== undefined && { activo }),
    },
  })

  return NextResponse.json(conductor)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const { id } = await params
  await prisma.conductorFlota.update({ where: { id: parseInt(id) }, data: { activo: false } })
  return NextResponse.json({ ok: true })
}
