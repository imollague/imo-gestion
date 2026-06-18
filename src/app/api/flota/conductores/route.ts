import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/apiAuth"

export async function GET() {
  const auth = await requireRole("ADMIN", "FLOTA", "ENCARGADO")
  if (!auth.ok) return auth.response

  const conductores = await prisma.conductorFlota.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
    include: { user: { select: { id: true, name: true, username: true } } },
  })

  return NextResponse.json(conductores)
}

export async function POST(req: NextRequest) {
  const auth = await requireRole("ADMIN", "ENCARGADO")
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { nombre, rut, numeroCaucion, numeroLicencia, tipoLicencia, fechaLicencia, userId } = body

  if (!nombre || !tipoLicencia) {
    return NextResponse.json({ error: "Nombre y tipo de licencia son obligatorios" }, { status: 400 })
  }

  const conductor = await prisma.conductorFlota.create({
    data: {
      nombre: nombre.trim(),
      rut: rut?.trim() || null,
      numeroCaucion: numeroCaucion?.trim() || null,
      numeroLicencia: numeroLicencia?.trim() || null,
      tipoLicencia,
      fechaLicencia: fechaLicencia ? new Date(fechaLicencia) : null,
      userId: userId ? parseInt(userId) : null,
    },
  })

  return NextResponse.json(conductor, { status: 201 })
}
